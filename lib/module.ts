namespace Il2Cpp {
    /**
     * Gets the IL2CPP module (a *native library*), that is where the IL2CPP
     * exports will be searched for (see {@link Il2Cpp.exports}).
     *
     * The module is located by its name:
     * - Android: `libil2cpp.so`
     * - Linux: `GameAssembly.so`
     * - Windows: `GameAssembly.dll`
     * - iOS: `UnityFramework`
     * - macOS: `GameAssembly.dylib`
     *
     * On iOS and macOS, IL2CPP exports may be located within a module having
     * a different name.
     *
     * Il2Cpp.perform(() => {
     *     // ...
     * });
     * ```
     */
    export declare const module: Module;
    getter(Il2Cpp, "module", () => {
        return tryModule() ?? raise("Could not find IL2CPP module");
    });

    /**
     * Waits for the IL2CPP native library to be loaded and initialized.
     */
    export async function initialize(blocking = false): Promise<boolean> {
        Reflect.defineProperty(Il2Cpp, "module", { value: await forModule(getExpectedModuleName()) });

        // At this point, the IL2CPP native library has been loaded, but we
        // cannot interact with IL2CPP until `il2cpp_init` is done.
        // It looks like `il2cpp_get_corlib` returns NULL only when the
        // initialization is not completed yet.
        if (Il2Cpp.exports.getCorlib().isNull()) {
            return await new Promise<boolean>(resolve => {
                const interceptor = Interceptor.attach(Il2Cpp.exports.initialize, {
                    onLeave() {
                        interceptor.detach();
                        blocking ? resolve(true) : setImmediate(() => resolve(false));
                    }
                });
            });
        }

        return false;
    }

    function tryModule(): Module | undefined {
        const moduleName = getExpectedModuleName();
        return (
            Process.findModuleByName(moduleName) ??
            Process.findModuleByAddress(DebugSymbol.fromName("il2cpp_init").address) ??
            undefined
        );
    }

    function getExpectedModuleName(): string {
        return 'libil2cpp.so';
    }
}
