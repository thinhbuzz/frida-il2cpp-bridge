import { getCorlib, initialize as il2cppInitialize } from './api';
import { lazyValue } from './utils/lazy';

/**
 * Gets the IL2CPP module (a *native library*), that is where the IL2CPP
 * exports will be searched for.
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
 * In any case, it is possible to override or set the IL2CPP module name
 * using a global variable:
 * ```ts
 * (globalThis as any).IL2CPP_MODULE_NAME = "CustomName.dylib";
 *
 * perform(() => {
 *     // ...
 * });
 * ```
 */
export const module = lazyValue(() => {
    return Process.findModuleByName(expectedModuleName)!;
});

/**
 * Waits for the IL2CPP native library to be loaded and initialized.
 */
export async function initialize(blocking = false): Promise<boolean> {
    // At this point, the IL2CPP native library has been loaded, but we
    // cannot interact with IL2CPP until `il2cpp_init` is done.
    // It looks like `il2cpp_get_corlib` returns NULL only when the
    // initialization is not completed yet.
    if (getCorlib.value().isNull()) {
        return await new Promise<boolean>(resolve => {
            const interceptor = Interceptor.attach(il2cppInitialize.value, {
                onLeave() {
                    interceptor.detach();
                    blocking ? resolve(true) : setImmediate(() => resolve(false));
                },
            });
        });
    }

    return false;
}

export const expectedModuleName = 'libil2cpp.so';
