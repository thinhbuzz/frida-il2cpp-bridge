import { read, write } from '../memory';
import { raise } from '../utils/console';
import { NativeStruct } from '../utils/native-struct';
import { Array } from './array';
import { FieldType } from './field';
import { corlib } from './image';
import { Object } from './object';
import { Pointer } from './pointer';
import { String } from './string';
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
            switch (type?.enumValue) {
                case Type.Enum.UBYTE:
                    return new Reference<T>(handle.writeU8(value), type);
                case Type.Enum.BYTE:
                    return new Reference<T>(handle.writeS8(value), type);
                case Type.Enum.CHAR:
                case Type.Enum.USHORT:
                    return new Reference<T>(handle.writeU16(value), type);
                case Type.Enum.SHORT:
                    return new Reference<T>(handle.writeS16(value), type);
                case Type.Enum.UINT:
                    return new Reference<T>(handle.writeU32(value), type);
                case Type.Enum.INT:
                    return new Reference<T>(handle.writeS32(value), type);
                case Type.Enum.ULONG:
                    return new Reference<T>(handle.writeU64(value), type);
                case Type.Enum.LONG:
                    return new Reference<T>(handle.writeS64(value), type);
                case Type.Enum.FLOAT:
                    return new Reference<T>(handle.writeFloat(value), type);
                case Type.Enum.DOUBLE:
                    return new Reference<T>(handle.writeDouble(value), type);
            }
        case 'object':
            if (value instanceof ValueType || value instanceof Pointer) {
                return new Reference<T>(value.handle, value.type);
            } else if (value instanceof Object) {
                return new Reference<T>(handle.writePointer(value), value.class.type);
            } else if (value instanceof String || value instanceof Array) {
                return new Reference<T>(handle.writePointer(value), value.object.class.type);
            } else if (value instanceof NativePointer) {
                switch (type?.enumValue) {
                    case Type.Enum.NUINT:
                    case Type.Enum.NINT:
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
