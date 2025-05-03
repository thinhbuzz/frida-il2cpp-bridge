namespace Il2Cpp {
    @recycle
    export class Assembly extends NativeStruct {
        /** Gets the image of this assembly. */
        get image(): Il2Cpp.Image {
            if (Il2Cpp.exports.assemblyGetImage.isNull()) {
                // We need to get the System.Reflection.Module of the current assembly;
                // System.Reflection.Assembly::GetModulesInternal, for some reason,
                // throws a NullReferenceExceptionin Unity 5.3.8f1, so we must rely on
                // System.Type::get_Module instead.
                // Now we need to get any System.Type of this assembly.
                // We cannot use System.Reflection.Assembly::GetTypes because it may
                // return an empty array; hence we use System.Reflection.Assembly::GetType
                // to retrieve <Module>, a class/type that seems to be always present
                // (despite being excluded from System.Reflection.Assembly::GetTypes).
                const runtimeModule =
                    this.object
                        .tryMethod<Il2Cpp.Object>("GetType", 1)
                        ?.invoke(Il2Cpp.string("<Module>"))
                        ?.asNullable()
                        ?.tryMethod<Il2Cpp.Object>("get_Module")
                        ?.invoke() ??
                    this.object.tryMethod<Il2Cpp.Array<Il2Cpp.Object>>("GetModules", 1)?.invoke(false)?.get(0) ??
                    raise(`couldn't find the runtime module object of assembly ${this.name}`);

                return new Il2Cpp.Image(runtimeModule.field<NativePointer>("_impl").value);
            }

            return new Il2Cpp.Image(Il2Cpp.exports.assemblyGetImage(this));
        }

        /** Gets the name of this assembly. */
        @lazy
        get name(): string {
            return this.image.name.replace(".dll", "");
        }

        /** Gets the encompassing object of the current assembly. */
        @lazy
        get object(): Il2Cpp.Object {
            for (const _ of Il2Cpp.domain.object.method<Il2Cpp.Array<Il2Cpp.Object>>("GetAssemblies", 1).invoke(false)) {
                if (_.field<NativePointer>("_mono_assembly").value.equals(this)) {
                    return _;
                }
            }

            raise("couldn't find the object of the native assembly struct");
        }
    }
}
