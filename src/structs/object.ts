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
import { Field, FieldType } from './field';
import { GCHandle } from './gc-handle';
import { corlib } from './image';
import { Method, MethodReturnType } from './method';
import { String } from './string';
import { ValueType } from './value-type';

export class Object extends NativeStruct {
    /** Available in implementation block. */
    currentMethod?: Method;

    /** Gets the Il2CppObject struct size, possibly equal to `Process.pointerSize * 2`. */
    @lazy
    static get headerSize(): number {
        return corlib.value.class('System.Object').instanceSize;
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

    /** Gets the field with the given name. */
    field<T extends FieldType>(name: string): Field<T> {
        return this.class.field<T>(name).withHolder(this);
    }

    /** Gets the method with the given name. */
    method<T extends MethodReturnType>(name: string, parameterCount: number = -1): Method<T> {
        return this.class.method<T>(name, parameterCount).withHolder(this);
    }

    /** Creates a reference to this object. */
    ref(pin: boolean): GCHandle {
        return new GCHandle(gcHandleNew.value(this, +pin));
    }

    /** Gets the correct virtual method from the given virtual method. */
    virtualMethod<T extends MethodReturnType>(method: Method): Method<T> {
        return new Method<T>(objectGetVirtualMethod.value(this, method)).withHolder(this);
    }

    /** Gets the field with the given name. */
    tryField<T extends FieldType>(name: string): Field<T> | undefined {
        return this.class.tryField<T>(name)?.withHolder(this);
    }

    /** Gets the field with the given name. */
    tryMethod<T extends MethodReturnType>(name: string, parameterCount: number = -1): Method<T> | undefined {
        return this.class.tryMethod<T>(name, parameterCount)?.withHolder(this);
    }

    /** */
    toString(): string {
        return this.isNull() ? 'null' : this.method<String>('ToString', 0).invoke().content ?? 'null';
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
