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
const minimumApiLevel = 35;

let apiLevel = -1;
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

function androidApiLevel (): number {
    if (apiLevel !== -1) {
        return apiLevel;
    }

    apiLevel = 0;
    try {
        const cm = new CModule(`
#include <glib.h>

extern int __system_property_get (const char * name, char * value);

int
android_api_level (void)
{
  char value[92];
  int level = 0;
  int i;

  if (__system_property_get ("ro.build.version.sdk", value) <= 0)
    return 0;

  for (i = 0; value[i] >= '0' && value[i] <= '9'; i++)
    level = (level * 10) + (value[i] - '0');

  return level;
}
`);
        apiLevel = new NativeFunction(cm.android_api_level as NativePointer, 'int', [])() as number;
    } catch (e) {
        /* Not Android, or the property is unavailable: leave it off. */
    }

    return apiLevel;
}

/** Whether invocations are wrapped by the guard on this device. */
export function guardedInvocations (): boolean {
    return apiLevel === -1 ? androidApiLevel() >= minimumApiLevel : apiLevel >= minimumApiLevel;
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
