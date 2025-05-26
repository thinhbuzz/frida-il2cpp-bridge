import { domainGet, threadDetach, threadGetAttachedThreads, threadGetCurrent, threadIsVm } from '../api';
import { raise } from '../utils/console';
import { getter } from '../utils/getter';
import { lazy, lazyValue } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { offsetOf } from '../utils/offset-of';
import { readNativeList } from '../utils/read-native-list';
import { Class } from './class';
import { cleanupDelegates, delegate } from './delegate';
import { corlib } from './image';
import { Il2CppObject } from './object';

export class Thread extends NativeStruct {
    /** Gets the native id of the current thread. */
    get id(): number {
        let get = function (this: Thread) {
            return this.internal.field<UInt64>('thread_id').value.toNumber();
        };

        // https://github.com/mono/linux-packaging-mono/blob/d586f84dfea30217f34b076a616a098518aa72cd/mono/utils/mono-threads.h#L642
        const currentThreadId = Process.getCurrentThreadId();
        const currentPosixThread = ptr(get.apply(currentThread.value!));

        // prettier-ignore
        const offset = offsetOf(currentPosixThread, _ => _.readS32() == currentThreadId, 1024) ??
            raise(`couldn't find the offset for determining the kernel id of a posix thread`);

        const _get = get;
        get = function (this: Thread) {
            return ptr(_get.apply(this)).add(offset).readS32();
        };

        getter(Thread.prototype, 'id', get, lazy);

        return this.id;
    }

    /** Gets the encompassing internal object (System.Threding.InternalThreead) of the current thread. */
    @lazy
    get internal(): Il2CppObject {
        return this.object.tryField<Il2CppObject>('internal_thread')?.value ?? this.object;
    }

    /** Determines whether the current thread is the garbage collector finalizer one. */
    @lazy
    get isFinalizer(): boolean {
        return !threadIsVm.value(this);
    }

    /** Gets the managed id of the current thread. */
    @lazy
    get managedId(): number {
        return this.object.method<number>('get_ManagedThreadId').invoke();
    }

    /** Gets the encompassing object of the current thread. */
    @lazy
    get object(): Il2CppObject {
        return new Il2CppObject(this);
    }

    @lazy
    private get staticData(): NativePointer {
        return this.internal.field<NativePointer>('static_data').value;
    }

    @lazy
    private get synchronizationContext(): Il2CppObject | null {
        const get_ExecutionContext = this.object.tryMethod<Il2CppObject>('GetMutableExecutionContext') ?? this.object.method('get_ExecutionContext');
        const executionContext = get_ExecutionContext.invoke();

        // From what I observed, only the main thread is supposed to have a
        // synchronization context; however there are two cases where it is
        // not available at all:
        // 1) during early instrumentation;
        // 2) it was dead code has it was stripped out.
        const synchronizationContext =
            executionContext.tryField<Il2CppObject>('_syncContext')?.value ??
            executionContext.tryMethod<Il2CppObject>('get_SynchronizationContext')?.invoke() ??
            this.tryLocalValue(corlib.value.class('System.Threading.SynchronizationContext'));

        return synchronizationContext?.asNullable() ?? null;
    }

    /** Detaches the thread from the application domain. */
    detach(): void {
        return threadDetach.value(this);
    }

    /** Schedules a callback on the current thread. */
    schedule<T>(block: () => T): Promise<T> {
        const Post = this.synchronizationContext?.tryMethod('Post');

        if (Post == null) {
            return Process.runOnThread(this.id, block);
        }
        let sendOrPostCallback: Il2CppObject | null = null;

        return new Promise(resolve => {
            sendOrPostCallback = delegate(corlib.value.class('System.Threading.SendOrPostCallback'), () => {
                const result = block();
                setImmediate(() => resolve(result));
            });

            // This is to replace pending scheduled callbacks when the script is about to get unlaoded.
            // If we skip this cleanup, Frida's native callbacks will point to invalid memory, making
            // the application crash as soon as the IL2CPP runtime tries to execute such callbacks.
            // For instance, without the following code, this is how you can trigger a crash:
            // 1) unfocus the application;
            // 2) schedule a callback;
            // 3) reload the script;
            // 4) focus application.
            //
            // The "proper" solution consists in removing our delegates from the Unity synchroniztion
            // context, but the interface is not consisent across Unity versions - e.g. 2017.4.40f1 uses
            // a queue instead of a list, whereas newer versions do not allow null work requests.
            // The following solution, which basically redirects the invocation to a native function that
            // survives the script reloading, is much simpler, honestly.
            Script.bindWeak(globalThis, () => {
                sendOrPostCallback!.field('method_ptr').value = sendOrPostCallback!.field('invoke_impl').value = domainGet.value;
            });

            Post.invoke(sendOrPostCallback, NULL);
        })
            .finally(() => cleanupDelegates(sendOrPostCallback)) as Promise<T>;
    }

    tryLocalValue(klass: Class): Il2CppObject | undefined {
        for (let i = 0; i < 16; i++) {
            const base = this.staticData.add(i * Process.pointerSize).readPointer();
            if (!base.isNull()) {
                const object = new Il2CppObject(base.readPointer()).asNullable();
                if (object?.class?.isSubclassOf(klass, false)) {
                    return object;
                }
            }
        }
    }
}

/** Gets the attached threads. */
export const attachedThreads = lazyValue(() => {
    if (threadGetAttachedThreads.value.isNull()) {
        const currentThreadHandle = currentThread.value?.handle ?? raise('Current thread is not attached to IL2CPP');
        const pattern = currentThreadHandle.toMatchPattern();

        const threads: Thread[] = [];

        for (const range of Process.enumerateRanges('rw-')) {
            if (range.file == undefined) {
                const matches = Memory.scanSync(range.base, range.size, pattern);
                if (matches.length == 1) {
                    while (true) {
                        const handle = matches[0].address.sub(matches[0].size * threads.length).readPointer();

                        if (handle.isNull() || !handle.readPointer().equals(currentThreadHandle.readPointer())) {
                            break;
                        }

                        threads.unshift(new Thread(handle));
                    }
                    break;
                }
            }
        }

        return threads;
    }

    return readNativeList(threadGetAttachedThreads.value).map(_ => new Thread(_));
});

/** Gets the current attached thread, if any. */
export const currentThread = lazyValue(() => {
    return new Thread(threadGetCurrent.value()).asNullable();
});

/** Gets the current attached thread, if any. */
export const mainThread = lazyValue(() => {
    // I'm not sure if this is always the case. Typically, the main
    // thread managed id is 1, but this isn't always true: spawning
    // an Android application with Unity 5.3.8f1 will cause the Frida
    // thread to have the managed id equal to 1, whereas the main thread
    // managed id is 2.
    return attachedThreads.value[0];
});
