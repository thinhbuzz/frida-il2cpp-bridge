import { valueTypeBox } from '../api';
import { NativeStruct } from '../utils/native-struct';
import { Field, FieldType } from './field';
import { Method, MethodReturnType } from './method';
import { Il2CppObject } from './object';
import { Il2CppString } from './string';
import { Type } from './type';

export class ValueType extends NativeStruct {
    /** Available in implementation block. */
    currentMethod?: Method;

    constructor(handle: NativePointer, readonly type: Type) {
        super(handle);
    }

    /** Boxes the current value type into a reference type. */
    box(): Il2CppObject {
        return new Il2CppObject(valueTypeBox.value(this.type.class, this));
    }

    /** Gets the field with the given name. */
    field<T extends FieldType>(name: string): Field<T> {
        return this.type.class.field<T>(name).withHolder(this);
    }

    /** Gets the method with the given name. */
    method<T extends MethodReturnType>(name: string, parameterCount: number = -1): Method<T> {
        return this.type.class.method<T>(name, parameterCount).withHolder(this);
    }

    /** Gets the field with the given name. */
    tryField<T extends FieldType>(name: string): Field<T> | undefined {
        return this.type.class.tryField<T>(name)?.withHolder(this);
    }

    /** Gets the field with the given name. */
    tryMethod<T extends MethodReturnType>(name: string, parameterCount: number = -1): Method<T> | undefined {
        return this.type.class.tryMethod<T>(name, parameterCount)?.withHolder(this);
    }

    /** */
    toString(): string {
        const ToString = this.method<Il2CppString>('ToString', 0);
        return this.isNull()
            ? 'null'
            : // If ToString is defined within a value type class, we can
              // avoid a boxing operation.
            ToString.class.isValueType
                ? ToString.invoke().content ?? 'null'
                : this.box().toString() ?? 'null';
    }
}
