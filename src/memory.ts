import { Array } from './structs/array';
import { FieldType } from './structs/field';
import { MethodReturnType } from './structs/method';
import { Object } from './structs/object';
import { ParameterType } from './structs/parameter';
import { Pointer } from './structs/pointer';
import { Reference } from './structs/reference';
import { String } from './structs/string';
import { Type } from './structs/type';
import { ValueType } from './structs/value-type';
import { raise } from './utils/console';

export function read(pointer: NativePointer, type: Type): FieldType {
    switch (type.enumValue) {
        case Type.Enum.BOOLEAN:
            return !!pointer.readS8();
        case Type.Enum.BYTE:
            return pointer.readS8();
        case Type.Enum.UBYTE:
            return pointer.readU8();
        case Type.Enum.SHORT:
            return pointer.readS16();
        case Type.Enum.USHORT:
            return pointer.readU16();
        case Type.Enum.INT:
            return pointer.readS32();
        case Type.Enum.UINT:
            return pointer.readU32();
        case Type.Enum.CHAR:
            return pointer.readU16();
        case Type.Enum.LONG:
            return pointer.readS64();
        case Type.Enum.ULONG:
            return pointer.readU64();
        case Type.Enum.FLOAT:
            return pointer.readFloat();
        case Type.Enum.DOUBLE:
            return pointer.readDouble();
        case Type.Enum.NINT:
        case Type.Enum.NUINT:
            return pointer.readPointer();
        case Type.Enum.POINTER:
            return new Pointer(pointer.readPointer(), type.class.baseType!);
        case Type.Enum.VALUE_TYPE:
            return new ValueType(pointer, type);
        case Type.Enum.OBJECT:
        case Type.Enum.CLASS:
            return new Object(pointer.readPointer());
        case Type.Enum.GENERIC_INSTANCE:
            return type.class.isValueType ? new ValueType(pointer, type) : new Object(pointer.readPointer());
        case Type.Enum.STRING:
            return new String(pointer.readPointer());
        case Type.Enum.ARRAY:
        case Type.Enum.NARRAY:
            return new Array(pointer.readPointer());
    }

    raise(`couldn't read the value from ${pointer} using an unhandled or unknown type ${type.name} (${type.enumValue}), please file an issue`);
}

export function write(pointer: NativePointer, value: any, type: Type): NativePointer {
    switch (type.enumValue) {
        case Type.Enum.BOOLEAN:
            return pointer.writeS8(+value);
        case Type.Enum.BYTE:
            return pointer.writeS8(value);
        case Type.Enum.UBYTE:
            return pointer.writeU8(value);
        case Type.Enum.SHORT:
            return pointer.writeS16(value);
        case Type.Enum.USHORT:
            return pointer.writeU16(value);
        case Type.Enum.INT:
            return pointer.writeS32(value);
        case Type.Enum.UINT:
            return pointer.writeU32(value);
        case Type.Enum.CHAR:
            return pointer.writeU16(value);
        case Type.Enum.LONG:
            return pointer.writeS64(value);
        case Type.Enum.ULONG:
            return pointer.writeU64(value);
        case Type.Enum.FLOAT:
            return pointer.writeFloat(value);
        case Type.Enum.DOUBLE:
            return pointer.writeDouble(value);
        case Type.Enum.NINT:
        case Type.Enum.NUINT:
        case Type.Enum.POINTER:
        case Type.Enum.STRING:
        case Type.Enum.ARRAY:
        case Type.Enum.NARRAY:
            return pointer.writePointer(value);
        case Type.Enum.VALUE_TYPE:
            Memory.copy(pointer, value, type.class.valueTypeSize);
            return pointer;
        case Type.Enum.OBJECT:
        case Type.Enum.CLASS:
        case Type.Enum.GENERIC_INSTANCE:
            if (value instanceof ValueType) {
                Memory.copy(pointer, value, type.class.valueTypeSize);
                return pointer;
            }
            return pointer.writePointer(value);
    }

    raise(`couldn't write value ${value} to ${pointer} using an unhandled or unknown type ${type.name} (${type.enumValue}), please file an issue`);
}

export function fromFridaValue(value: NativeCallbackArgumentValue, type: Type): ParameterType;

export function fromFridaValue(value: NativeFunctionReturnValue, type: Type): MethodReturnType;

export function fromFridaValue(
    value: NativeCallbackArgumentValue | NativeFunctionReturnValue,
    type: Type,
): ParameterType | MethodReturnType {
    if (globalThis.Array.isArray(value)) {
        const handle = Memory.alloc(type.class.valueTypeSize);
        const fields = type.class.fields.filter(_ => !_.isStatic);

        for (let i = 0; i < fields.length; i++) {
            const convertedValue = fromFridaValue(value[i], fields[i].type);
            write(handle.add(fields[i].offset).sub(Object.headerSize), convertedValue, fields[i].type);
        }

        return new ValueType(handle, type);
    } else if (value instanceof NativePointer) {
        if (type.isByReference) {
            return new Reference(value, type);
        }

        switch (type.enumValue) {
            case Type.Enum.POINTER:
                return new Pointer(value, type.class.baseType!);
            case Type.Enum.STRING:
                return new String(value);
            case Type.Enum.CLASS:
            case Type.Enum.GENERIC_INSTANCE:
            case Type.Enum.OBJECT:
                return new Object(value);
            case Type.Enum.ARRAY:
            case Type.Enum.NARRAY:
                return new Array(value);
            default:
                return value;
        }
    } else if (type.enumValue == Type.Enum.BOOLEAN) {
        return !!(value as number);
    } else if (type.enumValue == Type.Enum.VALUE_TYPE && type.class.isEnum) {
        return fromFridaValue([value], type);
    } else {
        return value;
    }
}

export function toFridaValue(value: MethodReturnType): NativeFunctionReturnValue;

export function toFridaValue(value: ParameterType): NativeFunctionArgumentValue;

export function toFridaValue(value: ParameterType | MethodReturnType): NativeFunctionArgumentValue | NativeFunctionReturnValue {
    if (typeof value == 'boolean') {
        return +value;
    } else if (value instanceof ValueType) {
        if (value.type.class.isEnum) {
            return value.field<number | Int64 | UInt64>('value__').value;
        } else {
            const _ = value.type.class.fields.filter(_ => !_.isStatic).map(_ => toFridaValue(_.bind(value).value));
            return _.length == 0 ? [0] : _;
        }
    } else {
        return value;
    }
}
