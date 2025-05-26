export function lazy(_: any, propertyKey: PropertyKey, descriptor: PropertyDescriptor) {
    const getter = descriptor.get;

    if (!getter) {
        throw new Error('@lazy can only be applied to getter accessors');
    }

    descriptor.get = function () {
        const value = getter.call(this);
        if (value != null) {
            Object.defineProperty(this, propertyKey, {
                value,
                configurable: descriptor.configurable,
                enumerable: descriptor.enumerable,
                writable: false,
            });
        }
        return value;
    };
    return descriptor;
}

export type LazyValue<T> = { value: T };

export function lazyValue<T>(callback: () => T): LazyValue<T> {
    const obj = {
        get value(): T {
            let value = callback();
            if (value == null) {
                return value;
            }
            Object.defineProperty(obj, 'value', {
                value,
                writable: true,
            });
            return value;
        },
        set value(value: T) {
            Object.defineProperty(obj, 'value', {
                value,
                writable: true,
            });
        },
    };
    return obj;
}
