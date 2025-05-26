import { classGetArrayClass, free, typeEquals, typeGetClass, typeGetName, typeGetObject, typeGetTypeEnum } from '../api';
import { lazy } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { recycle } from '../utils/recycle';
import { Class } from './class';
import { corlib } from './image';
import { Il2CppObject } from './object';

@recycle
export class Type extends NativeStruct {
    /** */
    @lazy
    static get enum() {
        const _ = (_: string, block = (_: Class): { type: Type } => _) => block(corlib.value.class(_)).type.typeEnum;

        return {
            void: _('System.Void'),
            boolean: _('System.Boolean'),
            char: _('System.Char'),
            byte: _('System.SByte'),
            unsignedByte: _('System.Byte'),
            short: _('System.Int16'),
            unsignedShort: _('System.UInt16'),
            int: _('System.Int32'),
            unsignedInt: _('System.UInt32'),
            long: _('System.Int64'),
            unsignedLong: _('System.UInt64'),
            nativePointer: _('System.IntPtr'),
            unsignedNativePointer: _('System.UIntPtr'),
            float: _('System.Single'),
            double: _('System.Double'),
            pointer: _('System.IntPtr', _ => _.field('m_value')),
            valueType: _('System.Decimal'),
            object: _('System.Object'),
            string: _('System.String'),
            class: _('System.Array'),
            array: _('System.Void', _ => _.arrayClass),
            multidimensionalArray: _('System.Void', _ => new Class(classGetArrayClass.value(_, 2))),
            genericInstance: _('System.Int32', _ => _.interfaces.find(_ => _.name.endsWith('`1'))!),
        };
    }

    /** Gets the class of this type. */
    @lazy
    get class(): Class {
        return new Class(typeGetClass.value(this));
    }

    /** */
    @lazy
    get fridaAlias(): NativeCallbackArgumentType {
        function getValueTypeFields(type: Type): NativeCallbackArgumentType {
            const instanceFields = type.class.fields.filter(_ => !_.isStatic);
            return instanceFields.length == 0 ? ['char'] : instanceFields.map(_ => _.type.fridaAlias);
        }

        if (this.isByReference) {
            return 'pointer';
        }

        switch (this.typeEnum) {
            case Type.enum.void:
                return 'void';
            case Type.enum.boolean:
                return 'bool';
            case Type.enum.char:
                return 'uchar';
            case Type.enum.byte:
                return 'int8';
            case Type.enum.unsignedByte:
                return 'uint8';
            case Type.enum.short:
                return 'int16';
            case Type.enum.unsignedShort:
                return 'uint16';
            case Type.enum.int:
                return 'int32';
            case Type.enum.unsignedInt:
                return 'uint32';
            case Type.enum.long:
                return 'int64';
            case Type.enum.unsignedLong:
                return 'uint64';
            case Type.enum.float:
                return 'float';
            case Type.enum.double:
                return 'double';
            case Type.enum.nativePointer:
            case Type.enum.unsignedNativePointer:
            case Type.enum.pointer:
            case Type.enum.string:
            case Type.enum.array:
            case Type.enum.multidimensionalArray:
                return 'pointer';
            case Type.enum.valueType:
                return this.class.isEnum ? this.class.baseType!.fridaAlias : getValueTypeFields(this);
            case Type.enum.class:
            case Type.enum.object:
            case Type.enum.genericInstance:
                return this.class.isStruct ? getValueTypeFields(this) : this.class.isEnum ? this.class.baseType!.fridaAlias : 'pointer';
            default:
                return 'pointer';
        }
    }

    /** Determines whether this type is passed by reference. */
    @lazy
    get isByReference(): boolean {
        return this.name.endsWith('&');
    }

    /** Determines whether this type is primitive. */
    @lazy
    get isPrimitive(): boolean {
        switch (this.typeEnum) {
            case Type.enum.boolean:
            case Type.enum.char:
            case Type.enum.byte:
            case Type.enum.unsignedByte:
            case Type.enum.short:
            case Type.enum.unsignedShort:
            case Type.enum.int:
            case Type.enum.unsignedInt:
            case Type.enum.long:
            case Type.enum.unsignedLong:
            case Type.enum.float:
            case Type.enum.double:
            case Type.enum.nativePointer:
            case Type.enum.unsignedNativePointer:
                return true;
            default:
                return false;
        }
    }

    /** Gets the name of this type. */
    @lazy
    get name(): string {
        const handle = typeGetName.value(this);

        try {
            return handle.readUtf8String()!;
        } finally {
            free.value(handle);
        }
    }

    /** Gets the encompassing object of the current type. */
    @lazy
    get object(): Il2CppObject {
        return new Il2CppObject(typeGetObject.value(this));
    }

    /** Gets the type enum of the current type. */
    @lazy
    get typeEnum(): number {
        return typeGetTypeEnum.value(this);
    }

    is(other: Type): boolean {
        if (typeEquals.value.isNull()) {
            return this.object.method<boolean>('Equals').invoke(other.object);
        }

        return !!typeEquals.value(this, other);
    }

    /** */
    toString(): string {
        return this.name;
    }
}
