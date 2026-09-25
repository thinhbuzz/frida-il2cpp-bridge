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

/*
 * Everything below runs inside `Process.setExceptionHandler`, i.e. inside a
 * signal handler that Frida's exceptor installed with SA_ONSTACK, which means
 * the callback gets the ~32 KB alternate signal stack and nothing else.
 *
 * That budget is smaller than a single Java call: ART's generic JNI trampoline
 * reserves 0x1400 bytes of stack on its own (plus the 224 byte save-refs frame
 * and the interpreter frames), so a `Java.perform` from in here - which is what
 * the warn logger used to do, through sendBroadcast - walks straight through
 * the guard page below the signal stack.  SIGSEGV is already being handled at
 * that point, so the second fault is fatal, and the tombstone reads "stack
 * pointer is not in a rw map; likely due to stack overflow" with the crash
 * sitting in artQuickGenericJniTrampoline.
 *
 * So: no JNI, no Java, no logging that reaches Java from in here.  Faults are
 * only recorded in a plain JS array and flushed from ordinary JS turns - the
 * timer installed alongside the guard, and the invocation wrappers - where a
 * normal stack is available again.
 */

const MAX_PENDING_LOGS = 64;

let invocationDepth = new Map<number, number>();
let installAttempted = false;
let skipped = 0;
let managed: ModuleMap | null = null;
let managedUnavailable = false;
let flushTimer: any = null;

const pendingFaultLogs: string[] = [];

/**
 * Built before the handler can ever run: constructing a ModuleMap inside a
 * signal handler is far too much work for the signal stack.
 */
function buildManagedMap (): void {
    try {
        managed = new ModuleMap(module => {
            const path = module.path ?? module.name;
            return path.includes('oat') ||
                path.includes('odex') ||
                path.includes('vdex') ||
                path.includes('framework') ||
                path.endsWith('.jar') ||
                path.endsWith('.apk');
        });
    } catch (e) {
        managedUnavailable = true;
        warn('could not build the managed-code map: ' + e);
    }
}

function isManagedCode (address: NativePointer): boolean {
    if (managed === null) {
        /*
         * Without the map there is no way to tell ART's implicit null checks
         * apart from a game fault, and touching a managed frame is the one
         * thing that must not happen: let ART deal with it.
         */
        return true;
    }

    return managed.has(address);
}

/**
 * Signal-handler safe: nothing here may allocate a Java call.
 */
function queueFaultLog (message: string): void {
    if (pendingFaultLogs.length < MAX_PENDING_LOGS) {
        pendingFaultLogs.push(message);
    }
}

/**
 * Called from ordinary JS turns only.  The warn logger reaches Java
 * (sendBroadcast), so it must never run on the signal stack.
 */
export function flushFaultLogs (): void {
    if (pendingFaultLogs.length === 0) {
        return;
    }

    const logs = pendingFaultLogs.splice(0, pendingFaultLogs.length);
    for (const log of logs) {
        try {
            warn(log);
        } catch (e) {
            /* A broken logger must never break a game call. */
        }
    }
}

let needsGuard: boolean | null = null;
let guardApiLevel = 0;

/*
 * ART 16 handles a fault on the alternate signal stack, and that stack is only
 * 32 KB: Frida's exceptor builds the exception details and enters V8 before the
 * fault ever reaches ART, so a deep path inside ART's own handler (constructing
 * an exception and filling in its stack trace) runs off the bottom of it and the
 * process dies with "stack pointer is not in a rw map".  Measured on the Pixel 6
 * Pro (Android 16) that happens within minutes, while the same build ran for
/*
 * ART 16 handles a fault on the alternate signal stack, and that stack is only
 * 32 KB: Frida's exceptor builds the exception details and enters V8 before the
 * fault ever reaches ART, so a deep path inside ART's own handler (constructing
 * an exception and filling in its stack trace) runs off the bottom of it and the
 * process dies with "stack pointer is not in a rw map".  Measured on the Pixel 6
 * Pro (Android 16) that happens within minutes, while the same build ran for
 * fourteen hours on Android 15 with the handler in place - so the step-over is
 * only kept where it has the room for it.
 *
 * NOTE: everything in this file compares against `ro.build.version.sdk`, i.e.
 * the *API level* (33 on Android 13, 35 on Android 15, 36 on Android 16).  The
 * thresholds below used to be written as Android version numbers (15 / 16) and
 * compared against that API level, which silently made every modern release
 * "Android 15 and up" - so the JS handler was never installed on any device -
 * and left the ART patch gated on a condition nothing could ever fail.
 */
const ANDROID_15_API_LEVEL = 35;
const ANDROID_16_API_LEVEL = 36;

/** Highest API level that still gets `Process.setExceptionHandler`. */
const MAX_API_LEVEL_WITH_JS_HANDLER = ANDROID_15_API_LEVEL;

/*
 * Android 16's ART aborts the process from
 * `Thread::MadviseAwayAlternateSignalStack()`, which runs from the implicit
 * suspend check that every JNI transition performs:
 *
 *     void Thread::MadviseAwayAlternateSignalStack() {
 *       stack_t old_ss;
 *       sigaltstack(nullptr, &old_ss);
 *       if ((old_ss.ss_flags & SS_DISABLE) == 0 && page aligned) {
 *         CHECK_EQ(old_ss.ss_flags & SS_ONSTACK, 0);   // <-- aborts
 *         madvise(old_ss.ss_sp, old_ss.ss_size, MADV_DONTNEED);
 *       }
 *     }
 *
 * The check is meant to stop ART from madvising away the very stack it is
 * running on, and the tombstone reads:
 *
 *     Abort message: 'Check failed: old_ss.ss_flags & 1 == 0
 *                     (old_ss.ss_flags & 1=1, 0=0)'
 *
 * A thread is on that stack whenever it is inside a signal handler, because
 * both ART's sigchain and Frida's exceptor install their handlers with
 * SA_ONSTACK - so any runtime code running below a fault handler trips the
 * check.  On this game the window is wide: it faults on null pointers often
 * enough that the fault guard above exists, and every one of those faults runs
 * the handler chain on the alternate signal stack.
 *
 * Skipping the madvise is what the check asks for and costs nothing but a few
 * pages of stack that stay resident, so the entry point is turned into a plain
 * return.  The body does nothing else, and the alternative - replacing the
 * function through the interceptor - is not worth it here: it sits on the JNI
 * transition path that every thread walks.
 */
const MADVISE_AWAY_SYMBOL = '_ZN3art6Thread31MadviseAwayAlternateSignalStackEv';

function installArtSignalStackMitigation (): void {
    /*
     * The check is not exclusive to ART 16 in practice: the LineageOS 20
     * (Android 13, API 33) libart of the OnePlus 5T this was diagnosed on
     * carries both `Thread::MadviseAwayAlternateSignalStack()` and its CHECK
     * (verified with objdump/strings on the device's libart.so).  Whether the
     * abort is reachable is answered by whether the symbol exists, which the
     * lookup below checks, so no API level is compared here.
     */
    if (Process.arch !== 'arm64') {
        warn('[art-signal-stack] not patching ART on ' + Process.arch);
        return;
    }

    let address: NativePointer | null = null;
    try {
        const art = Process.getModuleByName('libart.so');

        // ART keeps this one in the dynamic symbol table, but not in the symbol
        // dump Frida's enumerateSymbols() walks.
        address = art.findExportByName(MADVISE_AWAY_SYMBOL);
        if (address === null) {
            const symbol = art.enumerateSymbols().find(s => s.name === MADVISE_AWAY_SYMBOL);
            if (symbol !== undefined) {
                address = symbol.address;
            }
        }
    } catch (e) {
        /* Leave ART alone if it cannot even be inspected. */
    }

    if (address === null) {
        warn('[art-signal-stack] alt-stack madvise abort: symbol not found, leaving ART alone');
        return;
    }

    /*
     * Only entries that look like an ordinary prologue are touched.  A `bti`
     * landing pad in particular has to stay: indirect callers depend on it, and
     * this build of ART starts the function with `paciasp`.
     */
    let prologue = '';
    try {
        prologue = Instruction.parse(address).mnemonic;
    } catch (e) {
        /* Not decodable: leave it alone. */
    }

    const patchedMnemonics = ['paciasp', 'sub', 'stp', 'str', 'mov'];
    if (patchedMnemonics.indexOf(prologue) === -1) {
        warn('[art-signal-stack] unexpected prologue "' + prologue + '" at ' + address + ', leaving ART alone');
        return;
    }

    try {
        /*
         * The code writer flushes the instruction cache for us, which a plain
         * store would not do.
         */
        Memory.patchCode(address, 4, code => {
            const writer = new Arm64Writer(code, { pc: address as NativePointer });
            writer.putRet();
            writer.flush();
        });

        warn('[art-signal-stack] ART 16 alt-stack madvise abort neutralised');
    } catch (e) {
        warn('could not neutralise the ART alt-stack madvise abort: ' + e);
    }
}


/**
 * Which Android release this is, read from the system property exactly like
 * frida-java-bridge does it.
 */
function androidApiLevel (): number {
    const get = new NativeFunction(
        Process.getModuleByName('libc.so').getExportByName('__system_property_get'),
        'int',
        ['pointer', 'pointer'],
    );

    const value = Memory.alloc(92);
    get(Memory.allocUtf8String('ro.build.version.sdk'), value);

    return parseInt(value.readUtf8String() ?? '', 10) || 0;
}

/**
 * Whether this device needs the guard at all.  The abandoned-frame problem only
 * appears on Android 15 and later; on anything older nothing is installed, and
 * a fault stays what it always was - an error the caller can catch.
 */
export function guardedInvocations (): boolean {
    if (needsGuard === null) {
        let level = 0;
        try {
            level = androidApiLevel();
        } catch (e) {
            /* Leave it off. */
        }

        guardApiLevel = level;
        needsGuard = level >= ANDROID_15_API_LEVEL;
        warn('[il2cpp-fault-guard] ' + (needsGuard ? 'enabled' : 'disabled') + ' (Android ' + level + ')');
    }

    return needsGuard;
}

export function installFaultGuard (): void {
    if (installAttempted) {
        return;
    }
    installAttempted = true;

    const needed = guardedInvocations();

    /*
     * Frida's exceptor installs its own handler with SA_ONSTACK no matter what
     * this build decides below, so a fault ART handles still runs the handler
     * chain on the alternate signal stack.  The mitigation therefore follows the
     * function, not the guard.
     */
    installArtSignalStackMitigation();

    if (!needed) {
        warn('[il2cpp-fault-guard] Android ' + guardApiLevel +
            ': stock behaviour (the abandoned-frame problem starts at Android 15)');
        return;
    }

    buildManagedMap();

    if (guardApiLevel > MAX_API_LEVEL_WITH_JS_HANDLER) {
        warn('[il2cpp-fault-guard] Android ' + guardApiLevel +
            ': no exception handler, so ART keeps the whole signal stack');
        return;
    }

    try {
        Process.setExceptionHandler(details => {
            const depth = invocationDepth.get(Process.getCurrentThreadId());
            if (depth === undefined || depth === 0) {
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
            if (managedUnavailable || isManagedCode(pc)) {
                return false;
            }

            /*
             * Only the near-null dereferences this game produces are stepped
             * over; stepping over a wild address was measured to break the
             * game instead of saving it.
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

            if (skipped <= 3 || (skipped % 1000) === 0) {
                queueFaultLog(`stepped over a fault at ${pc} (access to ${accessed ?? 'unknown'}) ` +
                    `inside a game call; ${skipped} so far`);
            }

            return true;
        });
    } catch (e) {
        warn('could not install the fault guard: ' + e);
    }

    /*
     * Flushing from a timer keeps the messages flowing even when the game does
     * not call anything else afterwards.
     */
    try {
        flushTimer = setInterval(flushFaultLogs, 1000);
    } catch (e) {
        /* The invocation wrappers flush instead. */
    }
}

export function beginGuardedInvocation (): void {
    if (invocationDepth.size === 0) {
        installFaultGuard();
    }

    /*
     * Ordinary JS turn: this is where the messages the handler buffered are
     * finally allowed to reach Java.
     */
    flushFaultLogs();

    const tid = Process.getCurrentThreadId();
    invocationDepth.set(tid, (invocationDepth.get(tid) ?? 0) + 1);
}

export function endGuardedInvocation (): void {
    const tid = Process.getCurrentThreadId();
    const depth = invocationDepth.get(tid);
    if (depth === undefined) {
        return;
    }

    if (depth <= 1) {
        invocationDepth.delete(tid);
    } else {
        invocationDepth.set(tid, depth - 1);
    }

    flushFaultLogs();
}
