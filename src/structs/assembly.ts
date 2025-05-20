import { assemblyGetImage } from '../api';
import { raise } from '../utils/console';
import { lazy } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { recycle } from '../utils/recycle';
import { Array } from './array';
import { domain } from './domain';
import { Image } from './image';
import { Object } from './object';
import { string } from './string';

@recycle
export class Assembly extends NativeStruct {
    /** Gets the image of this assembly. */
    get image(): Image {
        if (assemblyGetImage.value.isNull()) {
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
                    .tryMethod<Object>('GetType', 1)
                    ?.invoke(string('<Module>'))
                    ?.asNullable()
                    ?.tryMethod<Object>('get_Module')
                    ?.invoke() ??
                this.object.tryMethod<Array<Object>>('GetModules', 1)?.invoke(false)?.get(0) ??
                raise(`couldn't find the runtime module object of assembly ${this.name}`);

            return new Image(runtimeModule.field<NativePointer>('_impl').value);
        }

        return new Image(assemblyGetImage.value(this));
    }

    /** Gets the name of this assembly. */
    @lazy
    get name(): string {
        return this.image.name.replace('.dll', '');
    }

    /** Gets the encompassing object of the current assembly. */
    @lazy
    get object(): Object {
        for (const _ of domain.value.object.method<Array<Object>>('GetAssemblies', 1).invoke(false)) {
            if (_.field<NativePointer>('_mono_assembly').value.equals(this)) {
                return _;
            }
        }

        raise('couldn\'t find the object of the native assembly struct');
    }
}
