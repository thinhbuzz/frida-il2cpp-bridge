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

export type LazyValue<T> = { readonly value: T, patch: (value: T) => void };

export function lazyValue<T>(callback: () => T): LazyValue<T> {
    return {
        get value(): T {
            let value = callback();
            if (value == null) {
                return value;
            }
            Object.defineProperty(this, 'value', {
                value,
                writable: false,
                configurable: true,
                enumerable: true,
            });
            return value;
        },
        patch(value: T): void {
            Object.defineProperty(this, 'value', {
                value,
                writable: false,
                configurable: true,
                enumerable: true,
            });
        }
    };
}
