import { warn } from './console';

/*
 * A fault inside a game method called from JavaScript is fatal in a way that
 * has nothing to do with the fault itself: Frida unwinds straight out of the
 * native frames that ART pushed for the call, so ART keeps a ManagedStack
 * pointing at frames that no longer exist, and the next stack walk or GC reads
 * whatever has been written there since - which is what crashes the process
 * minutes later.
 *
 * Catching the fault here instead, and stepping over the instruction that
 * faulted, keeps every frame in place: the callee carries on with whatever was
 * in the register, exactly as if the load had returned zero. Game code that
 * dereferences a null pointer then produces nonsense instead of killing the
 * process, which is a trade this build makes on purpose.
 *
 * Only faults raised by code that is not managed by ART are handled, so the
 * runtime keeps its own implicit null checks (and the Java exceptions they
 * raise) for itself.
 */

let invocationDepth = 0;
let installAttempted = false;
let skipped = 0;
let managed: ModuleMap | null = null;

function isManagedCode (address: NativePointer): boolean {
    if (managed === null) {
        managed = new ModuleMap(module => {
            const path = module.path ?? module.name;
            return path.includes('oat') ||
                path.includes('odex') ||
                path.includes('vdex') ||
                path.includes('framework') ||
                path.endsWith('.jar') ||
                path.endsWith('.apk');
        });
    }

    return managed.has(address);
}

export function installFaultGuard (): void {
    if (installAttempted) {
        return;
    }
    installAttempted = true;

    try {
        Process.setExceptionHandler(details => {
            if (invocationDepth === 0) {
                return false;
            }

            const type = details.type;
            if (type !== 'access-violation' && type !== 'guard-page') {
                return false;
            }

            /*
             * ART performs its implicit null checks with a fault too, so
             * anything that faults inside code it manages is left to it.
             */
            const pc = details.context.pc;
            if (isManagedCode(pc)) {
                return false;
            }

            /*
             * Only the near-null dereferences seen in this game are stepped
             * over; a wild address means something else is wrong and is left
             * to be reported.
             */
            const accessed = (details as any).memory?.address as NativePointer | undefined;
            if (accessed !== undefined && accessed.compare(ptr('0x100000')) >= 0) {
                return false;
            }

            let size = 4;
            try {
                size = Instruction.parse(pc).size;
            } catch (e) {
                /* Not decodable: the architecture's instruction size is 4. */
            }

            details.context.pc = pc.add(size);
            skipped++;

            if (skipped <= 20 || (skipped % 200) === 0) {
                warn(`stepped over a fault at ${pc} (access to ${accessed ?? 'unknown'}) ` +
                    `inside a game call; ${skipped} so far`);
            }

            return true;
        });
    } catch (e) {
        warn('could not install the fault guard: ' + e);
    }
}

export function beginGuardedInvocation (): void {
    if (invocationDepth === 0) {
        installFaultGuard();
    }
    invocationDepth++;
}

export function endGuardedInvocation (): void {
    if (invocationDepth !== 0) {
        invocationDepth--;
    }
}
