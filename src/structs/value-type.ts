import { valueTypeBox } from '../api';
import { raise } from '../utils/console';
import { NativeStruct } from '../utils/native-struct';
import { BoundField, FieldType } from './field';
import { BoundMethod, Method, MethodReturnType } from './method';
import { Il2CppObject } from './object';
import { Il2CppString } from './string';
import { Type } from './type';

export class ValueType extends NativeStruct {
    /** Available in implementation block. */
    currentMethod?: Method;

    constructor(handle: NativePointer, readonly type: Type) {
        super(handle);
    }


    box(): Il2CppObject {
        return new Il2CppObject(valueTypeBox.value(this.type.class, this));
    }

    /** Gets the non-static field with the given name of the current class hierarchy. */
    field<T extends FieldType>(name: string): BoundField<T> {
        return this.tryField(name) ?? raise(`couldn't find non-static field ${name} in hierarchy of class ${this.type.name}`);
    }

    /** Gets the non-static method with the given name (and optionally parameter count) of the current class hierarchy. */
    method<T extends MethodReturnType>(name: string, parameterCount: number = -1): BoundMethod<T> {
        return this.tryMethod<T>(name, parameterCount) ?? raise(`couldn't find non-static method ${name} in hierarchy of class ${this.type.name}`);
    }

    /** Gets the non-static field with the given name of the current class hierarchy, if it exists. */
    tryField<T extends FieldType>(name: string): BoundField<T> | undefined {
        const field = this.type.class.tryField<T>(name);

        if (field?.isStatic) {
            for (const klass of this.type.class.hierarchy()) {
                for (const field of klass.fields) {
                    if (field.name == name && !field.isStatic) {
                        return field.bind(this) as BoundField<T>;
                    }
                }
            }
            return undefined;
        }

        return field?.bind(this);
    }

    /** Gets the non-static method with the given name (and optionally parameter count) of the current class hierarchy, if it exists. */
    tryMethod<T extends MethodReturnType>(name: string, parameterCount: number = -1): BoundMethod<T> | undefined {
        const method = this.type.class.tryMethod<T>(name, parameterCount);

        if (method?.isStatic) {
            for (const klass of this.type.class.hierarchy()) {
                for (const method of klass.methods) {
                    if (method.name == name && !method.isStatic && (parameterCount < 0 || method.parameterCount == parameterCount)) {
                        return method.bind(this) as BoundMethod<T>;
                    }
                }
            }
            return undefined;
        }

        return method?.bind(this);
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
