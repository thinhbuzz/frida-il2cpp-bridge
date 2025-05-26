import { resolveInternalCall } from './api';
import { module } from './module';
import { Il2CppString } from './structs/string';
import { raise } from './utils/console';
import { exportsHash } from './utils/hash';
import { lazyValue } from './utils/lazy';
import { find, lt } from './utils/unity-version';

/**
 * Gets the data path name of the current application, e.g.
 * `/data/emulated/0/Android/data/com.example.application/files`
 * on Android.
 *
 * **This information is not guaranteed to exist.**
 *
 * ```ts
 * perform(() => {
 *     // prints /data/emulated/0/Android/data/com.example.application/files
 *     console.log(getDataPath());
 * });
 * ```
 */
export function getDataPath(): string | null {
    return unityEngineCall('get_persistentDataPath');
}

/**
 * Gets the identifier name of the current application, e.g.
 * `com.example.application` on Android.
 *
 * **This information is not guaranteed to exist.**
 *
 * ```ts
 * perform(() => {
 *     // prints com.example.application
 *     console.log(getIdentifier());
 * });
 * ```
 */
export function getIdentifier(): string | null {
    return unityEngineCall("get_identifier") ?? unityEngineCall("get_bundleIdentifier") ?? Process.mainModule.name;
}

/**
 * Gets the version name of the current application, e.g. `4.12.8`.
 *
 * **This information is not guaranteed to exist.**
 *
 * ```ts
 * perform(() => {
 *     // prints 4.12.8
 *     console.log(getVersion());
 * });
 * ```
 */
export function getVersion(): string | null {
    return unityEngineCall("get_version") ?? exportsHash(module.value).toString(16);
}

/**
 * Gets the Unity version of the current application.
 *
 * **It is possible to override or manually set its value using a global
 * variable:**
 * ```ts
 * (globalThis as any).IL2CPP_UNITY_VERSION = "5.3.5f1";
 *
 * perform(() => {
 *     // prints 5.3.5f1
 *     console.log(unityVersion);
 * });
 * ```
 *
 * When overriding its value, the user has to make sure to set a valid
 * value so that it gets matched by the following regular expression:
 * ```
 * (20\d{2}|\d)\.(\d)\.(\d{1,2})(?:[abcfp]|rc){0,2}\d?
 * ```
 */
export const unityVersion = lazyValue(() => {
    try {
        const unityVersion = unityEngineCall('get_unityVersion');

        if (unityVersion != null) {
            return unityVersion;
        }
    } catch (_) {
    }

    const searchPattern = '69 6c 32 63 70 70';

    for (const range of module.value.enumerateRanges('r--').concat(Process.getRangeByAddress(module.value.base))) {
        for (let { address } of Memory.scanSync(range.base, range.size, searchPattern)) {
            while (address.readU8() != 0) {
                address = address.sub(1);
            }
            const match = find(address.add(1).readCString());

            if (match != undefined) {
                return match;
            }
        }
    }

    raise('couldn\'t determine the Unity version, please specify it manually');
});

export const unityVersionIsBelow201830 = lazyValue(() => lt(unityVersion.value, '2018.3.0'));

export const unityVersionIsBelow202120 = lazyValue(() => lt(unityVersion.value, '2021.2.0'));

export function unityEngineCall(method: string): string | null {
    const handle = resolveInternalCall.value(Memory.allocUtf8String('UnityEngine.Application::' + method));
    const nativeFunction = new NativeFunction(handle, 'pointer', []);

    return nativeFunction.isNull() ? null : new Il2CppString(nativeFunction()).asNullable()?.content ?? null;
}
