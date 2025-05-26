import { fieldGetClass, fieldGetFlags, fieldGetName, fieldGetOffset, fieldGetStaticValue, fieldGetType, fieldSetStaticValue } from '../api';
import { read, write } from '../memory';
import { raise } from '../utils/console';
import { getter } from '../utils/getter';
import { lazy } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { Il2CppArray } from './array';
import { Class } from './class';
import { corlib } from './image';
import { Il2CppObject } from './object';
import { Pointer } from './pointer';
import { Il2CppString } from './string';
import { Type } from './type';
import { ValueType } from './value-type';

export class Field<T extends FieldType = FieldType> extends NativeStruct {
    /** Gets the class in which this field is defined. */
    @lazy
    get class(): Class {
        return new Class(fieldGetClass.value(this));
    }

    /** Gets the flags of the current field. */
    @lazy
    get flags(): number {
        return fieldGetFlags.value(this);
    }

    /** Determines whether this field value is known at compile time. */
    @lazy
    get isLiteral(): boolean {
        return (this.flags & FieldAttributes.Literal) != 0;
    }

    /** Determines whether this field is static. */
    @lazy
    get isStatic(): boolean {
        return (this.flags & FieldAttributes.Static) != 0;
    }

    /** Determines whether this field is thread static. */
    @lazy
    get isThreadStatic(): boolean {
        const offset = corlib.value.class('System.AppDomain').field('type_resolve_in_progress').offset;

        // prettier-ignore
        getter(Field.prototype, 'isThreadStatic', function (this: Field) {
            return this.offset == offset;
        }, lazy);

        return this.isThreadStatic;
    }

    /** Gets the access modifier of this field. */
    @lazy
    get modifier(): string | undefined {
        switch (this.flags & FieldAttributes.FieldAccessMask) {
            case FieldAttributes.Private:
                return 'private';
            case FieldAttributes.FamilyAndAssembly:
                return 'private protected';
            case FieldAttributes.Assembly:
                return 'internal';
            case FieldAttributes.Family:
                return 'protected';
            case FieldAttributes.FamilyOrAssembly:
                return 'protected internal';
            case FieldAttributes.Public:
                return 'public';
        }
    }

    /** Gets the name of this field. */
    @lazy
    get name(): string {
        return fieldGetName.value(this).readUtf8String()!;
    }

    /** Gets the offset of this field, calculated as the difference with its owner virtual address. */
    @lazy
    get offset(): number {
        return fieldGetOffset.value(this);
    }

    /** Gets the type of this field. */
    @lazy
    get type(): Type {
        return new Type(fieldGetType.value(this));
    }

    /** Gets the value of this field. */
    get value(): T {
        if (!this.isStatic) {
            raise(`cannot access instance field ${this.class.type.name}::${this.name} from a class, use an object instead`);
        }

        const handle = Memory.alloc(Process.pointerSize);
        fieldGetStaticValue.value(this.handle, handle);

        return read(handle, this.type) as T;
    }

    /** Sets the value of this field. Thread static or literal values cannot be altered yet. */
    set value(value: T) {
        if (!this.isStatic) {
            raise(`cannot access instance field ${this.class.type.name}::${this.name} from a class, use an object instead`);
        }

        if (this.isThreadStatic || this.isLiteral) {
            raise(`cannot write the value of field ${this.name} as it's thread static or literal`);
        }

        const handle =
            // pointer-like values should be passed as-is, but boxed
            // value types (primitives included) must be unboxed first
            value instanceof Il2CppObject && this.type.class.isValueType
                ? value.unbox()
                : value instanceof NativeStruct
                    ? value.handle
                    : value instanceof NativePointer
                        ? value
                        : write(Memory.alloc(this.type.class.valueTypeSize), value, this.type);

        fieldSetStaticValue.value(this.handle, handle);
    }

    /** */
    toString(): string {
        return `\
${this.isThreadStatic ? `[ThreadStatic] ` : ``}\
${this.isStatic ? `static ` : ``}\
${this.type.name} \
${this.name}\
${this.isLiteral ? ` = ${this.type.class.isEnum ? read((this.value as ValueType).handle, this.type.class.baseType!) : this.value}` : ``};\
${this.isThreadStatic || this.isLiteral ? `` : ` // 0x${this.offset.toString(16)}`}`;
    }

    /**
     * Binds the current field to a {@link Il2CppObject} or a
     * {@link ValueType} (also known as *instances*), so that it is
     * possible to retrieve its value - see {@link Field.value} for
     * details. \
     * Binding a static field is forbidden.
     */
    bind(instance: Il2CppObject | ValueType): BoundField<T> {
        if (this.isStatic) {
            raise(`cannot bind static field ${this.class.type.name}::${this.name} to an instance`);
        }

        const offset = this.offset - (instance instanceof ValueType ? Il2CppObject.headerSize : 0);

        return new Proxy(this, {
            get(target: Field<T>, property: keyof Field): any {
                if (property == "value") {
                    return read(instance.handle.add(offset), target.type);
                }
                return Reflect.get(target, property);
            },

            set(target: Field<T>, property: keyof Field, value: any): boolean {
                if (property == "value") {
                    write(instance.handle.add(offset), value, target.type);
                    return true;
                }

                return Reflect.set(target, property, value);
            }
        });
    }
}

/**
 * A {@link Field} bound to a {@link Il2CppObject} or a
 * {@link ValueType} (also known as *instances*).
 * ```ts
 * const object: Il2CppObject = string("Hello, world!").object;
 * const m_length: BoundField<number> = object.field<number>("m_length");
 * const length = m_length.value; // 13
 * ```
 * Of course, binding a static field does not make sense and may cause
 * unwanted behaviors.
 *
 * Binding can be done manually with:
 * ```ts
 * const SystemString = corlib.class("System.String");
 * const m_length: Field<number> = SystemString.field<number>("m_length");
 *
 * const object: Il2CppObject = string("Hello, world!").object;
 * // ＠ts-ignore
 * const m_length_bound: BoundField<number> = m_length.bind(object);
 * ```
 */
export interface BoundField<T extends FieldType = FieldType> extends Field<T> {
}

export type FieldType =
    boolean
    | number
    | Int64
    | UInt64
    | NativePointer
    | Pointer
    | ValueType
    | Il2CppObject
    | Il2CppString
    | Il2CppArray;

export const enum FieldAttributes {
    FieldAccessMask = 0x0007,
    PrivateScope = 0x0000,
    Private = 0x0001,
    FamilyAndAssembly = 0x0002,
    Assembly = 0x0003,
    Family = 0x0004,
    FamilyOrAssembly = 0x0005,
    Public = 0x0006,
    Static = 0x0010,
    InitOnly = 0x0020,
    Literal = 0x0040,
    NotSerialized = 0x0080,
    SpecialName = 0x0200,
    PinvokeImpl = 0x2000,
    ReservedMask = 0x9500,
    RTSpecialName = 0x0400,
    HasFieldMarshal = 0x1000,
    HasDefault = 0x8000,
    HasFieldRVA = 0x0100
}
