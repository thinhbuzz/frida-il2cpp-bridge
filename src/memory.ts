import { Il2CppArray } from './structs/array';
import { FieldType } from './structs/field';
import { MethodReturnType } from './structs/method';
import { Il2CppObject } from './structs/object';
import { ParameterType } from './structs/parameter';
import { Pointer } from './structs/pointer';
import { Reference } from './structs/reference';
import { Il2CppString } from './structs/string';
import { Type } from './structs/type';
import { ValueType } from './structs/value-type';
import { raise } from './utils/console';

export function read(pointer: NativePointer, type: Type): FieldType {
    switch (type.typeEnum) {
        case Type.enum.boolean:
            return !!pointer.readS8();
        case Type.enum.byte:
            return pointer.readS8();
        case Type.enum.unsignedByte:
            return pointer.readU8();
        case Type.enum.short:
            return pointer.readS16();
        case Type.enum.unsignedShort:
            return pointer.readU16();
        case Type.enum.int:
            return pointer.readS32();
        case Type.enum.unsignedInt:
            return pointer.readU32();
        case Type.enum.char:
            return pointer.readU16();
        case Type.enum.long:
            return pointer.readS64();
        case Type.enum.unsignedLong:
            return pointer.readU64();
        case Type.enum.float:
            return pointer.readFloat();
        case Type.enum.double:
            return pointer.readDouble();
        case Type.enum.nativePointer:
        case Type.enum.unsignedNativePointer:
            return pointer.readPointer();
        case Type.enum.pointer:
            return new Pointer(pointer.readPointer(), type.class.baseType!);
        case Type.enum.valueType:
            return new ValueType(pointer, type);
        case Type.enum.object:
        case Type.enum.class:
            return new Il2CppObject(pointer.readPointer());
        case Type.enum.genericInstance:
            return type.class.isValueType ? new ValueType(pointer, type) : new Il2CppObject(pointer.readPointer());
        case Type.enum.string:
            return new Il2CppString(pointer.readPointer());
        case Type.enum.array:
        case Type.enum.multidimensionalArray:
            return new Il2CppArray(pointer.readPointer());
    }

    raise(`couldn't read the value from ${pointer} using an unhandled or unknown type ${type.name} (${type.typeEnum}), please file an issue`);
}

export function write(pointer: NativePointer, value: any, type: Type): NativePointer {
    switch (type.typeEnum) {
        case Type.enum.boolean:
            return pointer.writeS8(+value);
        case Type.enum.byte:
            return pointer.writeS8(value);
        case Type.enum.unsignedByte:
            return pointer.writeU8(value);
        case Type.enum.short:
            return pointer.writeS16(value);
        case Type.enum.unsignedShort:
            return pointer.writeU16(value);
        case Type.enum.int:
            return pointer.writeS32(value);
        case Type.enum.unsignedInt:
            return pointer.writeU32(value);
        case Type.enum.char:
            return pointer.writeU16(value);
        case Type.enum.long:
            return pointer.writeS64(value);
        case Type.enum.unsignedLong:
            return pointer.writeU64(value);
        case Type.enum.float:
            return pointer.writeFloat(value);
        case Type.enum.double:
            return pointer.writeDouble(value);
        case Type.enum.nativePointer:
        case Type.enum.unsignedNativePointer:
        case Type.enum.pointer:
        case Type.enum.string:
        case Type.enum.array:
        case Type.enum.multidimensionalArray:
            return pointer.writePointer(value);
        case Type.enum.valueType:
            Memory.copy(pointer, value, type.class.valueTypeSize);
            return pointer;
        case Type.enum.object:
        case Type.enum.class:
        case Type.enum.genericInstance:
            if (value instanceof ValueType) {
                Memory.copy(pointer, value, type.class.valueTypeSize);
                return pointer;
            }
            return pointer.writePointer(value);
    }

    raise(`couldn't write value ${value} to ${pointer} using an unhandled or unknown type ${type.name} (${type.typeEnum}), please file an issue`);
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
            write(handle.add(fields[i].offset).sub(Il2CppObject.headerSize), convertedValue, fields[i].type);
        }

        return new ValueType(handle, type);
    } else if (value instanceof NativePointer) {
        if (type.isByReference) {
            return new Reference(value, type);
        }

        switch (type.typeEnum) {
            case Type.enum.pointer:
                return new Pointer(value, type.class.baseType!);
            case Type.enum.string:
                return new Il2CppString(value);
            case Type.enum.class:
            case Type.enum.genericInstance:
            case Type.enum.object:
                return new Il2CppObject(value);
            case Type.enum.array:
            case Type.enum.multidimensionalArray:
                return new Il2CppArray(value);
            default:
                return value;
        }
    } else if (type.typeEnum == Type.enum.boolean) {
        return !!(value as number);
    } else if (type.typeEnum == Type.enum.valueType && type.class.isEnum) {
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
            const _ = value.type.class.fields.filter(_ => !_.isStatic).map(_ => toFridaValue(_.withHolder(value).value));
            return _.length == 0 ? [0] : _;
        }
    } else {
        return value;
    }
}
