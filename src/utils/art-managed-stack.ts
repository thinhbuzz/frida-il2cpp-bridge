/*
 * ART keeps its own view of the native stack (ManagedStack) in the Thread
 * object, so that its stack walks and GC can see the Java frames a thread is
 * running. When a native call faults, the exception unwinds straight past the
 * frames that pushed those fragments: ART keeps pointing at stack memory that
 * nobody owns anymore, and a later stack walk or GC reads whatever has been
 * written there since, which crashes the process.
 *
 * The fields below were verified against ART 15 and ART 16 on device (Pixel 6
 * Pro, Android 16, and Galaxy S21 Ultra, Android 15): TLS slot 7 holds
 * Thread::Current(), and Thread::managed_stack sits at +0xa8 with the same
 * layout in both versions.
 */
const tlsSlotArtThreadSelf = 7;
const managedStackOffset = 0xa8;
const stackEndOffset = 0xa0;
const suspendTriggerOffset = 0xc0;
const stackBeginOffset = 0xf0;
const stackSizeOffset = 0xf8;
const linkOffset = 8;

let getArtThread: (() => NativePointer) | null | undefined;

function resolveGetArtThread(): (() => NativePointer) | null {
    if (getArtThread !== undefined) {
        return getArtThread;
    }

    try {
        const cm = new CModule(`
#include <glib.h>

extern void *pthread_self (void);

gpointer
art_current_thread (void)
{
  return ((gpointer *) pthread_self ())[${tlsSlotArtThreadSelf}];
}
`);
        getArtThread = new NativeFunction(cm.art_current_thread as NativePointer, 'pointer', []) as () => NativePointer;
    } catch (e) {
        getArtThread = null;
    }

    return getArtThread;
}

function getStackBounds(thread: NativePointer): { low: NativePointer; high: NativePointer } | null {
    const stackEnd = thread.add(stackEndOffset).readPointer();
    const stackSize = thread.add(stackSizeOffset).readPointer();

    if (stackEnd.isNull() || stackSize.isNull()) {
        return null;
    }

    const size = stackSize.toUInt32();
    if (size < 0x10000 || size > 0x40000000) {
        return null;
    }

    const stackBegin = thread.add(stackBeginOffset).readPointer();
    const high = stackBegin.add(size);

    if (high.compare(stackEnd) <= 0) {
        return null;
    }

    return { low: stackEnd, high };
}

function isStackAddress(bounds: { low: NativePointer; high: NativePointer }, address: NativePointer): boolean {
    return address.compare(bounds.low) >= 0 && address.compare(bounds.high) < 0;
}

function currentArtThread(): NativePointer | null {
    const getThread = resolveGetArtThread();
    if (getThread === null) {
        return null;
    }

    let thread: NativePointer;
    try {
        thread = getThread();
    } catch (e) {
        return null;
    }

    if (thread.isNull() || thread.and(7).toInt32() !== 0) {
        return null;
    }

    /*
     * tlsPtr_.suspend_trigger points at itself, except while a suspend check is
     * being triggered, in which case it is null. Anything else means this is
     * not a Thread object and must not be written to.
     */
    const suspendTrigger = thread.add(suspendTriggerOffset).readPointer();
    const expected = thread.add(suspendTriggerOffset);
    if (!suspendTrigger.isNull() && !suspendTrigger.equals(expected)) {
        return null;
    }

    if (getStackBounds(thread) === null) {
        return null;
    }

    return thread;
}

/**
 * Captures the managed stack of the calling thread, and returns a function
 * that puts it back. Native calls that fault leave it referring to frames that
 * the unwind removed, so restoring it undoes the damage at the only moment
 * where the previous state is still known.
 */
export function protectManagedStack(): (() => void) | null {
    const thread = currentArtThread();
    if (thread === null) {
        return null;
    }

    const bounds = getStackBounds(thread)!;
    const head = thread.add(managedStackOffset);
    const link = head.add(linkOffset).readPointer();

    /*
     * Only touch what the fault can have invalidated: the chain of fragments
     * that the abandoned frames introduced. The quick frame and the shadow
     * chain belong to code that can still be running (JavaScript is re-entered
     * from Java and back), so they are left exactly as they are - restoring
     * them was measured to wedge the S21 Ultra.
     */
    if (!link.isNull() && !isStackAddress(bounds, link)) {
        return null;
    }

    return () => {
        head.add(linkOffset).writePointer(link);
    };
}
