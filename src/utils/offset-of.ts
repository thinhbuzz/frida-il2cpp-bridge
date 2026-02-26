export function offsetOf(handle: NativePointer, condition: (handle: NativePointer) => boolean, depth?: number): number | null {
    depth ??= 512;

    for (let i = 0; depth > 0 ? i < depth : i < -depth; i++) {
        if (condition(depth > 0 ? handle.add(i) : handle.sub(i))) {
            return i;
        }
    }

    return null;
}

export function offsetOfPointer(handle: NativePointer, value: NativePointer): number | null {
    const step = Process.pointerSize;
    for (let i = 0; i < 512; i += step) {
        if (handle.add(i).readPointer().equals(value)) {
            return i;
        }
    }
    return null;
}

