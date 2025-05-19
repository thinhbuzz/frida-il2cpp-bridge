export function lazy(_: any, propertyKey: PropertyKey, descriptor: PropertyDescriptor) {
    const getter = descriptor.get;

    if (!getter) {
        throw new Error('@lazy can only be applied to getter accessors');
    }

    descriptor.get = function () {
        const value = getter.call(this);
        Object.defineProperty(this, propertyKey, {
            value,
            configurable: descriptor.configurable,
            enumerable: descriptor.enumerable,
            writable: false,
        });
        return value;
    };
    return descriptor;
}

export function lazyValue<T>(callback: () => T) {
    let value: T | undefined;
    const obj = {
        get value(): T {
            value = callback();
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
