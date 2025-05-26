import { arrayGetLength, arrayNew } from '../api';
import { raise } from '../utils/console';
import { getter } from '../utils/getter';
import { lazy } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { offsetOf } from '../utils/offset-of';
import { Class } from './class';
import { FieldType } from './field';
import { corlib } from './image';
import { Il2CppObject } from './object';
import { Pointer } from './pointer';
import { string } from './string';
import { Type } from './type';

export class Il2CppArray<T extends FieldType = FieldType> extends NativeStruct implements Iterable<T> {
    /** Gets the Il2CppArray struct size, possibly equal to `Process.pointerSize * 4`. */
    @lazy
    static get headerSize(): number {
        return corlib.value.class('System.Array').instanceSize;
    }

    /** Gets a pointer to the first element of the current array. */
    get elements(): Pointer<T> {
        // We previosly obtained an array whose content is known by calling
        // 'System.String::Split(NULL)' on a known string. However, that
        // method invocation somehow blows things up in Unity 2018.3.0f1.
        const array = string('v').object.method<Il2CppArray>('ToCharArray', 0).invoke();

        // prettier-ignore
        const offset = offsetOf(array.handle, _ => _.readS16() == 118) ??
            raise('couldn\'t find the elements offset in the native array struct');

        // prettier-ignore
        getter(Il2CppArray.prototype, 'elements', function (this: Il2CppArray) {
            return new Pointer(this.handle.add(offset), this.elementType);
        }, lazy);

        return this.elements;
    }

    /** Gets the size of the object encompassed by the current array. */
    @lazy
    get elementSize(): number {
        return this.elementType.class.arrayElementSize;
    }

    /** Gets the type of the object encompassed by the current array. */
    @lazy
    get elementType(): Type {
        return this.object.class.type.class.baseType!;
    }

    /** Gets the total number of elements in all the dimensions of the current array. */
    @lazy
    get length(): number {
        return arrayGetLength.value(this);
    }

    /** Gets the encompassing object of the current array. */
    @lazy
    get object(): Il2CppObject {
        return new Il2CppObject(this);
    }

    /** Gets the element at the specified index of the current array. */
    get(index: number): T {
        if (index < 0 || index >= this.length) {
            raise(`cannot get element at index ${index} as the array length is ${this.length}`);
        }

        return this.elements.get(index);
    }

    /** Sets the element at the specified index of the current array. */
    set(index: number, value: T) {
        if (index < 0 || index >= this.length) {
            raise(`cannot set element at index ${index} as the array length is ${this.length}`);
        }

        this.elements.set(index, value);
    }

    /** */
    toString(): string {
        return this.isNull() ? 'null' : `[${this.elements.read(this.length, 0)}]`;
    }

    /** Iterable. */
    * [Symbol.iterator](): IterableIterator<T> {
        for (let i = 0; i < this.length; i++) {
            yield this.elements.get(i);
        }
    }
}

/** Creates a new empty array of the given length. */
export function array<T extends FieldType>(klass: Class, length: number): Il2CppArray<T>;

/** Creates a new array with the given elements. */
export function array<T extends FieldType>(klass: Class, elements: T[]): Il2CppArray<T>;

export function array<T extends FieldType>(klass: Class, lengthOrElements: number | T[]): Il2CppArray<T> {
    const length = typeof lengthOrElements == 'number' ? lengthOrElements : lengthOrElements.length;
    const array = new Il2CppArray<T>(arrayNew.value(klass, length));

    if (Array.isArray(lengthOrElements)) {
        array.elements.write(lengthOrElements);
    }

    return array;
}
