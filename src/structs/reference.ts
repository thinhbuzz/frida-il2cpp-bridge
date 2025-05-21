import { read, write } from '../memory';
import { raise } from '../utils/console';
import { NativeStruct } from '../utils/native-struct';
import { Il2CppArray } from './array';
import { FieldType } from './field';
import { corlib } from './image';
import { Il2CppObject } from './object';
import { Pointer } from './pointer';
import { Il2CppString } from './string';
import { Type } from './type';
import { ValueType } from './value-type';

export class Reference<T extends FieldType = FieldType> extends NativeStruct {
    constructor(handle: NativePointer, readonly type: Type) {
        super(handle);
    }

    /** Gets the element referenced by the current reference. */
    get value(): T {
        return read(this.handle, this.type) as T;
    }

    /** Sets the element referenced by the current reference. */
    set value(value: T) {
        write(this.handle, value, this.type);
    }

    /** */
    toString(): string {
        return this.isNull() ? 'null' : `->${this.value}`;
    }
}

export function reference<T extends number | NativePointer>(value: T, type: Type): Reference<T>;

export function reference<T extends Exclude<FieldType, number | NativePointer>>(value: T): Reference<T>;

/** Creates a reference to the specified value. */
export function reference<T extends FieldType>(value: T, type?: Type): Reference<T> {
    const handle = Memory.alloc(Process.pointerSize);

    switch (typeof value) {
        case 'boolean':
            return new Reference(handle.writeS8(+value), corlib.value.class('System.Boolean').type);
        case 'number':
            switch (type?.typeEnum) {
                case Type.enum.unsignedByte:
                    return new Reference<T>(handle.writeU8(value), type);
                case Type.enum.byte:
                    return new Reference<T>(handle.writeS8(value), type);
                case Type.enum.char:
                case Type.enum.unsignedShort:
                    return new Reference<T>(handle.writeU16(value), type);
                case Type.enum.short:
                    return new Reference<T>(handle.writeS16(value), type);
                case Type.enum.unsignedInt:
                    return new Reference<T>(handle.writeU32(value), type);
                case Type.enum.int:
                    return new Reference<T>(handle.writeS32(value), type);
                case Type.enum.unsignedLong:
                    return new Reference<T>(handle.writeU64(value), type);
                case Type.enum.long:
                    return new Reference<T>(handle.writeS64(value), type);
                case Type.enum.float:
                    return new Reference<T>(handle.writeFloat(value), type);
                case Type.enum.double:
                    return new Reference<T>(handle.writeDouble(value), type);
            }
        case 'object':
            if (value instanceof ValueType || value instanceof Pointer) {
                return new Reference<T>(value.handle, value.type);
            } else if (value instanceof Il2CppObject) {
                return new Reference<T>(handle.writePointer(value), value.class.type);
            } else if (value instanceof Il2CppString || value instanceof Il2CppArray) {
                return new Reference<T>(handle.writePointer(value), value.object.class.type);
            } else if (value instanceof NativePointer) {
                switch (type?.typeEnum) {
                    case Type.enum.unsignedNativePointer:
                    case Type.enum.nativePointer:
                        return new Reference<T>(handle.writePointer(value), type);
                }
            } else if (value instanceof Int64) {
                return new Reference<T>(handle.writeS64(value), corlib.value.class('System.Int64').type);
            } else if (value instanceof UInt64) {
                return new Reference<T>(handle.writeU64(value), corlib.value.class('System.UInt64').type);
            }
        default:
            raise(`couldn't create a reference to ${value} using an unhandled type ${type?.name}`);
    }
}
