import { stringGetChars, stringGetLength, stringNew } from '../api';
import { raise } from '../utils/console';
import { NativeStruct } from '../utils/native-struct';
import { offsetOf } from '../utils/offset-of';
import { Object } from './object';

export class String extends NativeStruct {
    /** Gets the content of this string. */
    get content(): string | null {
        return stringGetChars.value(this).readUtf16String(this.length);
    }

    /** @unsafe Sets the content of this string - it may write out of bounds! */
    set content(value: string | null) {
        // prettier-ignore
        const offset = offsetOf(string('vfsfitvnm').handle, _ => _.readInt() == 9)
            ?? raise('couldn\'t find the length offset in the native string struct');

        globalThis.Object.defineProperty(String.prototype, 'content', {
            set(this: String, value: string | null) {
                stringGetChars.value(this).writeUtf16String(value ?? '');
                this.handle.add(offset).writeS32(value?.length ?? 0);
            },
        });

        this.content = value;
    }

    /** Gets the length of this string. */
    get length(): number {
        return stringGetLength.value(this);
    }

    /** Gets the encompassing object of the current string. */
    get object(): Object {
        return new Object(this);
    }

    /** */
    toString(): string {
        return this.isNull() ? 'null' : `"${this.content}"`;
    }
}

/** Creates a new string with the specified content. */
export function string(content: string | null): String {
    return new String(stringNew.value(Memory.allocUtf8String(content ?? '')));
}
