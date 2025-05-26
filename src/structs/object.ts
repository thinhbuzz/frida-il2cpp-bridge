import {
    gcHandleNew,
    gcHandleNewWeakRef,
    monitorEnter,
    monitorExit,
    monitorPulse,
    monitorPulseAll,
    monitorTryEnter,
    monitorTryWait,
    monitorWait,
    objectGetClass,
    objectGetSize,
    objectGetVirtualMethod,
    objectUnbox,
} from '../api';
import { raise } from '../utils/console';
import { lazy } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { Class } from './class';
import { BoundField, Field, FieldType } from './field';
import { GCHandle } from './gc-handle';
import { corlib } from './image';
import { BoundMethod, Method, MethodReturnType } from './method';
import { Il2CppString } from './string';
import { ValueType } from './value-type';

export class Il2CppObject extends NativeStruct {
    /** Available in implementation block. */
    currentMethod?: Method;

    /** Gets the Il2CppObject struct size, possibly equal to `Process.pointerSize * 2`. */
    @lazy
    static get headerSize(): number {
        return corlib.value.class('System.Object').instanceSize;
    }

    /**
     * Returns the same object, but having its parent class as class.
     * It basically is the C# `base` keyword, so that parent members can be
     * accessed.
     *
     * **Example** \
     * Consider the following classes:
     * ```csharp
     * class Foo
     * {
     *     int foo()
     *     {
     *          return 1;
     *     }
     * }
     * class Bar : Foo
     * {
     *     new int foo()
     *     {
     *          return 2;
     *     }
     * }
     * ```
     * then:
     * ```ts
     * const Bar: Class = ...;
     * const bar = Bar.new();
     *
     * console.log(bar.foo()); // 2
     * console.log(bar.base.foo()); // 1
     * ```
     */
    get base(): Il2CppObject {
        if (this.class.parent == null) {
            raise(`class ${this.class.type.name} has no parent`);
        }

        return new Proxy(this, {
            get(target: Il2CppObject, property: keyof Il2CppObject, receiver: Il2CppObject): any {
                if (property == "class") {
                    return Reflect.get(target, property).parent;
                } else if (property == "base") {
                    return Reflect.getOwnPropertyDescriptor(Il2CppObject.prototype, property)!.get!.bind(receiver)();
                }
                return Reflect.get(target, property);
            }
        });
    }

    /** Gets the class of this object. */
    @lazy
    get class(): Class {
        return new Class(objectGetClass.value(this));
    }

    /** Returns a monitor for this object. */
    get monitor(): Monitor {
        return new Monitor(this);
    }

    /** Gets the size of the current object. */
    @lazy
    get size(): number {
        return objectGetSize.value(this);
    }

    /** Gets the non-static field with the given name of the current class hierarchy. */
    field<T extends FieldType>(name: string): BoundField<T> {
        return this.tryField(name) ?? raise(`couldn't find non-static field ${name} in hierarchy of class ${this.class.type.name}`);
    }

    /** Gets the non-static method with the given name (and optionally parameter count) of the current class hierarchy. */
    method<T extends MethodReturnType>(name: string, parameterCount: number = -1): BoundMethod<T> {
        return this.tryMethod<T>(name, parameterCount) ?? raise(`couldn't find non-static method ${name} in hierarchy of class ${this.class.type.name}`);
    }

    /** Creates a reference to this object. */
    ref(pin: boolean): GCHandle {
        return new GCHandle(gcHandleNew.value(this, +pin));
    }

    /** Gets the correct virtual method from the given virtual method. */
    virtualMethod<T extends MethodReturnType>(method: Method): BoundMethod<T> {
        return new Method<T>(objectGetVirtualMethod.value(this, method)).bind(this);
    }

    /** Gets the non-static field with the given name of the current class hierarchy, if it exists. */
    tryField<T extends FieldType>(name: string): BoundField<T> | undefined {
        const field = this.class.tryField<T>(name);

        if (field?.isStatic) {
            // classes cannot have static and non-static fields with the
            // same name, hence we can immediately check the parent
            for (const klass of this.class.hierarchy({ includeCurrent: false })) {
                for (const field of klass.fields) {
                    if (field.name == name && !field.isStatic) {
                        return field.bind(this) as Field<T>;
                    }
                }
            }
            return undefined;
        }

        return field?.bind(this);
    }

    /** Gets the non-static method with the given name (and optionally parameter count) of the current class hierarchy, if it exists. */
    tryMethod<T extends MethodReturnType>(name: string, parameterCount: number = -1): BoundMethod<T> | undefined {
        const method = this.class.tryMethod<T>(name, parameterCount);

        if (method?.isStatic) {
            for (const klass of this.class.hierarchy()) {
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
        return this.isNull() ? "null" : this.method<Il2CppString>("ToString", 0).invoke().content ?? "null";
    }

    /** Unboxes the value type (either a primitive, a struct or an enum) out of this object. */
    unbox(): ValueType {
        return this.class.isValueType
            ? new ValueType(objectUnbox.value(this), this.class.type)
            : raise(`couldn't unbox instances of ${this.class.type.name} as they are not value types`);
    }

    /** Creates a weak reference to this object. */
    weakRef(trackResurrection: boolean): GCHandle {
        return new GCHandle(gcHandleNewWeakRef.value(this, +trackResurrection));
    }
}

export class Monitor {

    constructor(readonly handle: NativePointerValue) {
    }

    /** Acquires an exclusive lock on the current object. */
    enter(): void {
        return monitorEnter.value(this.handle);
    }

    /** Release an exclusive lock on the current object. */
    exit(): void {
        return monitorExit.value(this.handle);
    }

    /** Notifies a thread in the waiting queue of a change in the locked object's state. */
    pulse(): void {
        return monitorPulse.value(this.handle);
    }

    /** Notifies all waiting threads of a change in the object's state. */
    pulseAll(): void {
        return monitorPulseAll.value(this.handle);
    }

    /** Attempts to acquire an exclusive lock on the current object. */
    tryEnter(timeout: number): boolean {
        return !!monitorTryEnter.value(this.handle, timeout);
    }

    /** Releases the lock on an object and attempts to block the current thread until it reacquires the lock. */
    tryWait(timeout: number): boolean {
        return !!monitorTryWait.value(this.handle, timeout);
    }

    /** Releases the lock on an object and blocks the current thread until it reacquires the lock. */
    wait(): void {
        return monitorWait.value(this.handle);
    }
}
