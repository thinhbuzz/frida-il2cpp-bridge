import { raise } from '../utils/console';
import { Class } from './class';
import { corlib } from './image';
import { MethodReturnType } from './method';
import { Object } from './object';
import { ParameterType } from './parameter';

/** Creates a delegate object of the given delegate class. */
export function delegate<P extends ParameterType[], R extends MethodReturnType>(
    klass: Class,
    block: (...args: P) => R,
): Object {
    const SystemDelegate = corlib.value.class('System.Delegate');
    const SystemMulticastDelegate = corlib.value.class('System.MulticastDelegate');

    if (!SystemDelegate.isAssignableFrom(klass)) {
        raise(`cannot create a delegate for ${klass.type.name} as it's a non-delegate class`);
    }

    if (klass.equals(SystemDelegate) || klass.equals(SystemMulticastDelegate)) {
        raise(`cannot create a delegate for neither ${SystemDelegate.type.name} nor ${SystemMulticastDelegate.type.name}, use a subclass instead`);
    }

    const delegate = klass.alloc();
    const key = delegate.handle.toString();

    const Invoke = delegate.tryMethod('Invoke') ?? raise(`cannot create a delegate for ${klass.type.name}, there is no Invoke method`);
    delegate.method('.ctor').invoke(delegate, Invoke.handle);

    const callback = Invoke.wrap(block as any);

    delegate.field('method_ptr').value = callback;
    delegate.field('invoke_impl').value = callback;
    _callbacksToKeepAlive[key] = callback;

    return delegate;
}

/** Used to prevent eager garbage collection against NativeCallbacks. */
export const _callbacksToKeepAlive: Record<string, NativeCallback<'void', []> | undefined> = {};

export function cleanupDelegates(...delegates: (ObjectWrapper | null | undefined)[]) {
    for (let delegate of delegates) {
        if (delegate) {
            delete _callbacksToKeepAlive[delegate.handle.toString()];
        }
    }
}
