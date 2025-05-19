import { read, write } from '../memory';
import { NativeStruct } from '../utils/native-struct';
import { FieldType } from './field';
import { Type } from './type';

export class Pointer<T extends FieldType = FieldType> extends NativeStruct {
    constructor(handle: NativePointer, readonly type: Type) {
        super(handle);
    }

    /** Gets the element at the given index. */
    get(index: number): T {
        return read(this.handle.add(index * this.type.class.arrayElementSize), this.type) as T;
    }

    /** Reads the given amount of elements starting at the given offset. */
    read(length: number, offset: number = 0): T[] {
        const values = new Array<T>(length);

        for (let i = 0; i < length; i++) {
            values[i] = this.get(i + offset);
        }

        return values;
    }

    /** Sets the given element at the given index */
    set(index: number, value: T): void {
        write(this.handle.add(index * this.type.class.arrayElementSize), value, this.type);
    }

    /** */
    toString(): string {
        return this.handle.toString();
    }

    /** Writes the given elements starting at the given index. */
    write(values: T[], offset: number = 0): void {
        for (let i = 0; i < values.length; i++) {
            this.set(i + offset, values[i]);
        }
    }
}
