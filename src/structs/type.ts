import { classGetArrayClass, free, typeEquals, typeGetClass, typeGetName, typeGetObject, typeGetTypeEnum } from '../api';
import { lazy } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { recycle } from '../utils/recycle';
import { Class } from './class';
import { corlib } from './image';
import { Object } from './object';

@recycle
export class Type extends NativeStruct {
    /** */
    @lazy
    static get Enum() {
        const _ = (_: string, block = (_: Class): { type: Type } => _) => block(corlib.value.class(_)).type.enumValue;

        return {
            VOID: _('System.Void'),
            BOOLEAN: _('System.Boolean'),
            CHAR: _('System.Char'),
            BYTE: _('System.SByte'),
            UBYTE: _('System.Byte'),
            SHORT: _('System.Int16'),
            USHORT: _('System.UInt16'),
            INT: _('System.Int32'),
            UINT: _('System.UInt32'),
            LONG: _('System.Int64'),
            ULONG: _('System.UInt64'),
            NINT: _('System.IntPtr'),
            NUINT: _('System.UIntPtr'),
            FLOAT: _('System.Single'),
            DOUBLE: _('System.Double'),
            POINTER: _('System.IntPtr', _ => _.field('m_value')),
            VALUE_TYPE: _('System.Decimal'),
            OBJECT: _('System.Object'),
            STRING: _('System.String'),
            CLASS: _('System.Array'),
            ARRAY: _('System.Void', _ => _.arrayClass),
            NARRAY: _('System.Void', _ => new Class(classGetArrayClass.value(_, 2))),
            GENERIC_INSTANCE: _('System.Int32', _ => _.interfaces.find(_ => _.name.endsWith('`1'))!),
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

        switch (this.enumValue) {
            case Type.Enum.VOID:
                return 'void';
            case Type.Enum.BOOLEAN:
                return 'bool';
            case Type.Enum.CHAR:
                return 'uchar';
            case Type.Enum.BYTE:
                return 'int8';
            case Type.Enum.UBYTE:
                return 'uint8';
            case Type.Enum.SHORT:
                return 'int16';
            case Type.Enum.USHORT:
                return 'uint16';
            case Type.Enum.INT:
                return 'int32';
            case Type.Enum.UINT:
                return 'uint32';
            case Type.Enum.LONG:
                return 'int64';
            case Type.Enum.ULONG:
                return 'uint64';
            case Type.Enum.FLOAT:
                return 'float';
            case Type.Enum.DOUBLE:
                return 'double';
            case Type.Enum.NINT:
            case Type.Enum.NUINT:
            case Type.Enum.POINTER:
            case Type.Enum.STRING:
            case Type.Enum.ARRAY:
            case Type.Enum.NARRAY:
                return 'pointer';
            case Type.Enum.VALUE_TYPE:
                return this.class.isEnum ? this.class.baseType!.fridaAlias : getValueTypeFields(this);
            case Type.Enum.CLASS:
            case Type.Enum.OBJECT:
            case Type.Enum.GENERIC_INSTANCE:
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
        switch (this.enumValue) {
            case Type.Enum.BOOLEAN:
            case Type.Enum.CHAR:
            case Type.Enum.BYTE:
            case Type.Enum.UBYTE:
            case Type.Enum.SHORT:
            case Type.Enum.USHORT:
            case Type.Enum.INT:
            case Type.Enum.UINT:
            case Type.Enum.LONG:
            case Type.Enum.ULONG:
            case Type.Enum.FLOAT:
            case Type.Enum.DOUBLE:
            case Type.Enum.NINT:
            case Type.Enum.NUINT:
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
    get object(): Object {
        return new Object(typeGetObject.value(this));
    }

    /** Gets the type enum of the current type. */
    @lazy
    get enumValue(): number {
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
