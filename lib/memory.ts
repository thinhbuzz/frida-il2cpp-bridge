namespace Il2Cpp {
    /**
     * Allocates the given amount of bytes - it's equivalent to C's `malloc`. \
     * The allocated memory should be freed manually.
     */
    export function alloc(size: number | UInt64 = Process.pointerSize): NativePointer {
        return Il2Cpp.exports.alloc(size);
    }

    /**
     * Frees a previously allocated memory using {@link Il2Cpp.alloc} - it's
     *  equivalent to C's `free`..
     *
     * ```ts
     * const handle = Il2Cpp.alloc(64);
     *
     * // ...
     *
     * Il2Cpp.free(handle);
     * ```
     */
    export function free(pointer: NativePointerValue): void {
        return Il2Cpp.exports.free(pointer);
    }

    export function read(pointer: NativePointer, type: Il2Cpp.Type): Il2Cpp.Field.Type {
        switch (type.enumValue) {
            case Il2Cpp.Type.Enum.BOOLEAN:
                return !!pointer.readS8();
            case Il2Cpp.Type.Enum.BYTE:
                return pointer.readS8();
            case Il2Cpp.Type.Enum.UBYTE:
                return pointer.readU8();
            case Il2Cpp.Type.Enum.SHORT:
                return pointer.readS16();
            case Il2Cpp.Type.Enum.USHORT:
                return pointer.readU16();
            case Il2Cpp.Type.Enum.INT:
                return pointer.readS32();
            case Il2Cpp.Type.Enum.UINT:
                return pointer.readU32();
            case Il2Cpp.Type.Enum.CHAR:
                return pointer.readU16();
            case Il2Cpp.Type.Enum.LONG:
                return pointer.readS64();
            case Il2Cpp.Type.Enum.ULONG:
                return pointer.readU64();
            case Il2Cpp.Type.Enum.FLOAT:
                return pointer.readFloat();
            case Il2Cpp.Type.Enum.DOUBLE:
                return pointer.readDouble();
            case Il2Cpp.Type.Enum.NINT:
            case Il2Cpp.Type.Enum.NUINT:
                return pointer.readPointer();
            case Il2Cpp.Type.Enum.POINTER:
                return new Il2Cpp.Pointer(pointer.readPointer(), type.class.baseType!);
            case Il2Cpp.Type.Enum.VALUE_TYPE:
                return new Il2Cpp.ValueType(pointer, type);
            case Il2Cpp.Type.Enum.OBJECT:
            case Il2Cpp.Type.Enum.CLASS:
                return new Il2Cpp.Object(pointer.readPointer());
            case Il2Cpp.Type.Enum.GENERIC_INSTANCE:
                return type.class.isValueType ? new Il2Cpp.ValueType(pointer, type) : new Il2Cpp.Object(pointer.readPointer());
            case Il2Cpp.Type.Enum.STRING:
                return new Il2Cpp.String(pointer.readPointer());
            case Il2Cpp.Type.Enum.ARRAY:
            case Il2Cpp.Type.Enum.NARRAY:
                return new Il2Cpp.Array(pointer.readPointer());
        }

        raise(`couldn't read the value from ${pointer} using an unhandled or unknown type ${type.name} (${type.enumValue}), please file an issue`);
    }

    export function write(pointer: NativePointer, value: any, type: Il2Cpp.Type): NativePointer {
        switch (type.enumValue) {
            case Il2Cpp.Type.Enum.BOOLEAN:
                return pointer.writeS8(+value);
            case Il2Cpp.Type.Enum.BYTE:
                return pointer.writeS8(value);
            case Il2Cpp.Type.Enum.UBYTE:
                return pointer.writeU8(value);
            case Il2Cpp.Type.Enum.SHORT:
                return pointer.writeS16(value);
            case Il2Cpp.Type.Enum.USHORT:
                return pointer.writeU16(value);
            case Il2Cpp.Type.Enum.INT:
                return pointer.writeS32(value);
            case Il2Cpp.Type.Enum.UINT:
                return pointer.writeU32(value);
            case Il2Cpp.Type.Enum.CHAR:
                return pointer.writeU16(value);
            case Il2Cpp.Type.Enum.LONG:
                return pointer.writeS64(value);
            case Il2Cpp.Type.Enum.ULONG:
                return pointer.writeU64(value);
            case Il2Cpp.Type.Enum.FLOAT:
                return pointer.writeFloat(value);
            case Il2Cpp.Type.Enum.DOUBLE:
                return pointer.writeDouble(value);
            case Il2Cpp.Type.Enum.NINT:
            case Il2Cpp.Type.Enum.NUINT:
            case Il2Cpp.Type.Enum.POINTER:
            case Il2Cpp.Type.Enum.STRING:
            case Il2Cpp.Type.Enum.ARRAY:
            case Il2Cpp.Type.Enum.NARRAY:
                return pointer.writePointer(value);
            case Il2Cpp.Type.Enum.VALUE_TYPE:
                return Memory.copy(pointer, value, type.class.valueTypeSize), pointer;
            case Il2Cpp.Type.Enum.OBJECT:
            case Il2Cpp.Type.Enum.CLASS:
            case Il2Cpp.Type.Enum.GENERIC_INSTANCE:
                return value instanceof Il2Cpp.ValueType ? (Memory.copy(pointer, value, type.class.valueTypeSize), pointer) : pointer.writePointer(value);
        }

        raise(`couldn't write value ${value} to ${pointer} using an unhandled or unknown type ${type.name} (${type.enumValue}), please file an issue`);
    }

    export function fromFridaValue(value: NativeCallbackArgumentValue, type: Il2Cpp.Type): Il2Cpp.Parameter.Type;

    export function fromFridaValue(value: NativeFunctionReturnValue, type: Il2Cpp.Type): Il2Cpp.Method.ReturnType;

    export function fromFridaValue(
        value: NativeCallbackArgumentValue | NativeFunctionReturnValue,
        type: Il2Cpp.Type
    ): Il2Cpp.Parameter.Type | Il2Cpp.Method.ReturnType {
        if (globalThis.Array.isArray(value)) {
            const handle = Memory.alloc(type.class.valueTypeSize);
            const fields = type.class.fields.filter(_ => !_.isStatic);

            for (let i = 0; i < fields.length; i++) {
                const convertedValue = fromFridaValue(value[i], fields[i].type);
                write(handle.add(fields[i].offset).sub(Il2Cpp.Object.headerSize), convertedValue, fields[i].type);
            }

            return new Il2Cpp.ValueType(handle, type);
        } else if (value instanceof NativePointer) {
            if (type.isByReference) {
                return new Il2Cpp.Reference(value, type);
            }

            switch (type.enumValue) {
                case Il2Cpp.Type.Enum.POINTER:
                    return new Il2Cpp.Pointer(value, type.class.baseType!);
                case Il2Cpp.Type.Enum.STRING:
                    return new Il2Cpp.String(value);
                case Il2Cpp.Type.Enum.CLASS:
                case Il2Cpp.Type.Enum.GENERIC_INSTANCE:
                case Il2Cpp.Type.Enum.OBJECT:
                    return new Il2Cpp.Object(value);
                case Il2Cpp.Type.Enum.ARRAY:
                case Il2Cpp.Type.Enum.NARRAY:
                    return new Il2Cpp.Array(value);
                default:
                    return value;
            }
        } else if (type.enumValue == Il2Cpp.Type.Enum.BOOLEAN) {
            return !!(value as number);
        } else if (type.enumValue == Il2Cpp.Type.Enum.VALUE_TYPE && type.class.isEnum) {
            return fromFridaValue([value], type);
        } else {
            return value;
        }
    }

    export function toFridaValue(value: Il2Cpp.Method.ReturnType): NativeFunctionReturnValue;

    export function toFridaValue(value: Il2Cpp.Parameter.Type): NativeFunctionArgumentValue;

    export function toFridaValue(value: Il2Cpp.Parameter.Type | Il2Cpp.Method.ReturnType): NativeFunctionArgumentValue | NativeFunctionReturnValue {
        if (typeof value == "boolean") {
            return +value;
        } else if (value instanceof Il2Cpp.ValueType) {
            if (value.type.class.isEnum) {
                return value.field<number | Int64 | UInt64>("value__").value;
            } else {
                const _ = value.type.class.fields.filter(_ => !_.isStatic).map(_ => toFridaValue(_.bind(value).value));
                return _.length == 0 ? [0] : _;
            }
        } else {
            return value;
        }
    }
}
