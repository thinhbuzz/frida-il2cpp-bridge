namespace Il2Cpp {
    /** */
    export const application = {
        /**
         * Gets the data path name of the current application, e.g.
         * `/data/emulated/0/Android/data/com.example.application/files`
         * on Android.
         *
         * **This information is not guaranteed to exist.**
         *
         * ```ts
         * Il2Cpp.perform(() => {
         *     // prints /data/emulated/0/Android/data/com.example.application/files
         *     console.log(Il2Cpp.application.dataPath);
         * });
         * ```
         */
        get dataPath(): string | null {
            return unityEngineCall("get_persistentDataPath");
        },

        /**
         * Gets the identifier name of the current application, e.g.
         * `com.example.application` on Android.
         *
         * In case the identifier cannot be retrieved, the main module name is
         * returned instead, which typically is the process name.
         *
         * ```ts
         * Il2Cpp.perform(() => {
         *     // prints com.example.application
         *     console.log(Il2Cpp.application.identifier);
         * });
         * ```
         */
        get identifier(): string {
            return unityEngineCall("get_identifier") ?? unityEngineCall("get_bundleIdentifier") ?? Process.mainModule.name;
        },

        /**
         * Gets the version name of the current application, e.g. `4.12.8`.
         *
         * In case the version cannot be retrieved, an hash of the IL2CPP
         * module is returned instead.
         *
         * ```ts
         * Il2Cpp.perform(() => {
         *     // prints 4.12.8
         *     console.log(Il2Cpp.application.version);
         * });
         * ```
         */
        get version(): string {
            return unityEngineCall("get_version") ?? exportsHash(Il2Cpp.module).toString(16);
        }
    };

    /**
     * Gets the Unity version of the current application.
     *
     * **It is possible to override or manually set its value using
     * {@link Il2Cpp.$config.unityVersion}:**
     * ```ts
     * Il2Cpp.$config.unityVersion = "5.3.5f1";
     *
     * Il2Cpp.perform(() => {
     *     // prints 5.3.5f1
     *     console.log(Il2Cpp.unityVersion);
     * });
     * ```
     *
     * When overriding its value, the user has to make sure to set a valid
     * value so that it gets matched by the following regular expression:
     * ```
     * (20\d{2}|\d)\.(\d)\.(\d{1,2})(?:[abcfp]|rc){0,2}\d?
     * ```
     */
    export declare const unityVersion: string;
    // prettier-ignore
    getter(Il2Cpp, "unityVersion", () => {
        try {
            const unityVersion = Il2Cpp.$config.unityVersion ?? unityEngineCall("get_unityVersion");

            if (unityVersion != null) {
                return unityVersion;
            }
        } catch(_) {
        }

        const searchPattern = "69 6c 32 63 70 70";

        for (const range of module.enumerateRanges("r--").concat(Process.getRangeByAddress(module.base))) {
            for (let { address } of Memory.scanSync(range.base, range.size, searchPattern)) {
                while (address.readU8() != 0) {
                    address = address.sub(1);
                }
                const match = UnityVersion.find(address.add(1).readCString());

                if (match != undefined) {
                    return match;
                }
            }
        }

        raise("couldn't determine the Unity version, please specify it manually");
    }, lazy);

    /** @internal */
    export declare const unityVersionIsBelow201830: boolean;
    // prettier-ignore
    getter(Il2Cpp, "unityVersionIsBelow201830", () => {
        return UnityVersion.lt(unityVersion, "2018.3.0");
    }, lazy);

    /** @internal */
    export declare const unityVersionIsBelow202120: boolean;
    // prettier-ignore
    getter(Il2Cpp, "unityVersionIsBelow202120", () => {
        return UnityVersion.lt(unityVersion, "2021.2.0");
    }, lazy);

    function unityEngineCall(method: string): string | null {
        const handle = Il2Cpp.exports.resolveInternalCall(Memory.allocUtf8String("UnityEngine.Application::" + method));
        const nativeFunction = new NativeFunction(handle, "pointer", []);

        return nativeFunction.isNull() ? null : new Il2Cpp.String(nativeFunction()).asNullable()?.content ?? null;
    }
}
