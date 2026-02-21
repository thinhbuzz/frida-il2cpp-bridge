export function recycle<T extends ObjectWrapper, U extends new (handle: NativePointer) => T>(Class: U) {
    return new Proxy(Class, {
        cache: new Map(),
        construct(Target: U, argArray: [NativePointer]): T {
            const handle = argArray[0].toString();

            if (!this.cache.has(handle)) {
                this.cache.set(handle, new Target(argArray[0]));
            }
            return this.cache.get(handle)!;
        },
    } as ProxyHandler<U> & { cache: Map<string, T> });
}
