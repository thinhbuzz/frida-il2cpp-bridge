import { initialize } from './module';
import { domain } from './structs/domain';
import { currentThread, mainThread, Thread } from './structs/thread';

/** Attaches the caller thread to Il2Cpp domain and executes the given block.  */
export async function perform<T>(
    block: () => T | Promise<T>,
    flag: 'free' | 'bind' | 'leak' | 'main' = 'bind',
): Promise<T> {
    let attachedThread: Thread | null = null;
    try {
        const isInMainThread = await initialize(flag == 'main');

        if (flag == 'main' && !isInMainThread) {
            return perform(() => mainThread.value.schedule(block), 'free');
        }

        if (currentThread == null) {
            attachedThread = domain.value.attach();
        }

        if (flag == 'bind' && attachedThread != null) {
            Script.bindWeak(globalThis, () => attachedThread?.detach());
        }

        const result = block();

        return result instanceof Promise ? await result : result;
    } catch (error: any) {
        Script.nextTick(_ => {
            throw _;
        }, error); // prettier-ignore
        return Promise.reject<T>(error);
    } finally {
        if (flag == 'free' && attachedThread != null) {
            attachedThread.detach();
        }
    }
}
