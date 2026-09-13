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

/*
 * The problem this works around - a fault abandoning the frames ART pushed for
 * the call, leaving bookkeeping that a later stack walk trips over - only
 * happens on Android 15 and up.  Older releases keep the stock behaviour, where
 * a fault inside a game call surfaces as a JavaScript error the caller can
 * catch, so nothing here is installed there.
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

let needsGuard: boolean | null = null;

function androidVersion (): { level: number; source: string } {
    /*
     * The Java bridge, bundled alongside this one, publishes the release it
     * detected.  Failing that, `Java.androidVersion` answers the same question
     * when the host exposes the bridge globally, and failing that, a symbol
     * that only exists from Android 15 on tells us what we need to know.
     */
    const published = (globalThis as any).__fridaJavaApiLevel;
    if (typeof published === 'number' && published > 0) {
        return { level: published, source: 'java bridge' };
    }

    const java = (globalThis as any).Java;
    if (java !== undefined) {
        try {
            if (java.available === true) {
                const level = parseInt(java.androidVersion, 10);
                if (!isNaN(level)) {
                    return { level, source: 'Java.androidVersion' };
                }
            }
        } catch (e) {
            /* The VM is not up yet: fall through. */
        }
    }

    const art = Process.findModuleByName('libart.so');
    if (art !== null && art.findExportByName('_ZNK3art6Thread19DecodeGlobalJObjectEP8_jobject') !== null) {
        return { level: 15, source: 'libart symbol' };
    }

    return { level: 0, source: 'unknown' };
}

/**
 * Whether this device needs the guard at all.  The abandoned-frame problem only
 * appears on Android 15 and later, and on anything older the stock behaviour -
 * a catchable JavaScript error - is kept, so nothing is installed there.
 */
export function guardedInvocations (): boolean {
    if (needsGuard === null) {
        let detected = { level: 0, source: 'unknown' };
        try {
            detected = androidVersion();
        } catch (e) {
            /* Leave it off. */
        }

        needsGuard = detected.level >= 15;
        warn('[il2cpp-fault-guard] ' + (needsGuard ? 'enabled' : 'disabled') +
            ' (Android ' + detected.level + ', detected via ' + detected.source + ')');
    }

    return needsGuard;
}

export function installFaultGuard (): void {
    if (installAttempted || !guardedInvocations()) {
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
             * A fault on the instruction fetch itself means the call went to a
             * bad address; stepping over it would run whatever happens to be
             * there next, so it is left alone.
             */
            if ((details as any).memory?.operation === 'execute') {
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

            const accessed = (details as any).memory?.address as NativePointer | undefined;

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
