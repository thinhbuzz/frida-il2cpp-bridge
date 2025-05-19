import { initialize } from './module';
import { domain } from './structs/domain';
import { currentThread, mainThread } from './structs/thread';

/** Attaches the caller thread to Il2Cpp domain and executes the given block.  */
export async function perform<T>(
    block: () => T | Promise<T>,
    flag: 'free' | 'bind' | 'leak' | 'main' = 'bind',
): Promise<T> {
    try {
        const isInMainThread = await initialize(flag == 'main');

        if (flag == 'main' && !isInMainThread) {
            return perform(() => mainThread.value.schedule(block), 'free');
        }

        let thread = currentThread.value;
        const isForeignThread = thread == null;
        thread ??= domain.value.attach();

        const result = block();

        if (isForeignThread) {
            if (flag == 'free') {
                thread.detach();
            } else if (flag == 'bind') {
                Script.bindWeak(globalThis, () => thread!.detach());
            }
        }

        return result instanceof Promise ? await result : result;
    } catch (error: any) {
        Script.nextTick(_ => {
            throw _;
        }, error); // prettier-ignore
        return Promise.reject<T>(error);
    }
}
