import { lazyValue } from './lazy';

export function getProperty(name: string): string | undefined {
    const handle = Process.findModuleByName("libc.so")?.findExportByName("__system_property_get");

    if (handle) {
        const __system_property_get = new NativeFunction(handle, 'void', ['pointer', 'pointer']);

        const value = Memory.alloc(92).writePointer(NULL);
        __system_property_get(Memory.allocUtf8String(name), value);

        return value.readCString() ?? undefined;
    }
}

export const apiLevel = lazyValue(() => {
    const value = getProperty('ro.build.version.sdk');
    return value ? parseInt(value) : null;
});
