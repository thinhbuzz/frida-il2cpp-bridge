import { classFromName, classFromObject, getCorlib, imageGetAssembly, imageGetClass, imageGetClassCount, imageGetName } from '../api';
import { unityVersionIsBelow201830 } from '../application';
import { raise } from '../utils/console';
import { lazy, lazyValue } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { recycle } from '../utils/recycle';
import { Il2CppArray } from './array';
import { Assembly } from './assembly';
import { Class } from './class';
import { Il2CppObject } from './object';

@recycle
export class Image extends NativeStruct {
    /** Gets the assembly in which the current image is defined. */
    @lazy
    get assembly(): Assembly {
        return new Assembly(imageGetAssembly.value(this));
    }

    /** Gets the amount of classes defined in this image. */
    @lazy
    get classCount(): number {
        if (unityVersionIsBelow201830) {
            return this.classes.length;
        } else {
            return imageGetClassCount.value(this);
        }
    }

    /** Gets the classes defined in this image. */
    @lazy
    get classes(): Class[] {
        if (unityVersionIsBelow201830) {
            const types = this.assembly.object.method<Il2CppArray<Il2CppObject>>('GetTypes').invoke(false);
            // In Unity 5.3.8f1, getting System.Reflection.Emit.OpCodes type name
            // without iterating all the classes first somehow blows things up at
            // app startup, hence the `Array.from`.
            const classes = globalThis.Array.from(types, _ => new Class(classFromObject.value(_)));
            classes.unshift(this.class('<Module>'));
            return classes;
        } else {
            return globalThis.Array.from(
                globalThis.Array(this.classCount),
                (_, i) => new Class(imageGetClass.value(this, i)),
            );
        }
    }

    /** Gets the name of this image. */
    @lazy
    get name(): string {
        return imageGetName.value(this).readUtf8String()!;
    }

    /** Gets the class with the specified name defined in this image. */
    class(name: string): Class {
        return this.tryClass(name) ?? raise(`couldn't find class ${name} in assembly ${this.name}`);
    }

    /** Gets the class with the specified name defined in this image. */
    tryClass(name: string): Class | null {
        const dotIndex = name.lastIndexOf('.');
        const classNamespace = Memory.allocUtf8String(dotIndex == -1 ? '' : name.slice(0, dotIndex));
        const className = Memory.allocUtf8String(name.slice(dotIndex + 1));

        return new Class(classFromName.value(this, classNamespace, className)).asNullable();
    }
}

export const corlib = lazyValue(() => new Image(getCorlib.value()));
