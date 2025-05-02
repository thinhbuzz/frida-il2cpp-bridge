namespace Il2Cpp {
    @recycle
    export class Image extends NativeStruct {
        /** Gets the assembly in which the current image is defined. */
        @lazy
        get assembly(): Il2Cpp.Assembly {
            return new Il2Cpp.Assembly(Il2Cpp.exports.imageGetAssembly(this));
        }

        /** Gets the amount of classes defined in this image. */
        @lazy
        get classCount(): number {
            return Il2Cpp.exports.imageGetClassCount(this);
        }

        /** Gets the classes defined in this image. */
        @lazy
        get classes(): Il2Cpp.Class[] {
            return globalThis.Array.from(globalThis.Array(this.classCount), (_, i) => new Il2Cpp.Class(Il2Cpp.exports.imageGetClass(this, i)));
        }

        /** Gets the name of this image. */
        @lazy
        get name(): string {
            return Il2Cpp.exports.imageGetName(this).readUtf8String()!;
        }

        /** Gets the class with the specified name defined in this image. */
        class(name: string): Il2Cpp.Class {
            return this.tryClass(name) ?? raise(`couldn't find class ${name} in assembly ${this.name}`);
        }

        /** Gets the class with the specified name defined in this image. */
        tryClass(name: string): Il2Cpp.Class | null {
            const dotIndex = name.lastIndexOf(".");
            const classNamespace = Memory.allocUtf8String(dotIndex == -1 ? "" : name.slice(0, dotIndex));
            const className = Memory.allocUtf8String(name.slice(dotIndex + 1));

            return new Il2Cpp.Class(Il2Cpp.exports.classFromName(this, classNamespace, className)).asNullable();
        }
    }

    /** Gets the COR library. */
    export declare const corlib: Il2Cpp.Image;
    // prettier-ignore
    getter(Il2Cpp, "corlib", () => {
        return new Il2Cpp.Image(Il2Cpp.exports.getCorlib());
    }, lazy);
}
