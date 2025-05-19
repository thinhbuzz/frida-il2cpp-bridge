import { assemblyGetImage } from '../api';
import { raise } from '../utils/console';
import { getter } from '../utils/getter';
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
    @lazy
    get image(): Image {
        let get = function (this: Assembly) {
            return new Image(assemblyGetImage.value(this));
        };

        try {
            assemblyGetImage.value;
        } catch (_) {
            get = function (this: Assembly) {
                // We need to get the System.Reflection.Module of the current assembly;
                // System.Reflection.Assembly::GetModulesInternal, for some reason,
                // throws a NullReferenceExceptionin Unity 5.3.8f1, so we must rely on
                // System.Type::get_Module instead.
                // Now we need to get any System.Type of this assembly.
                // We cannot use System.Reflection.Assembly::GetTypes because it may
                // return an empty array; hence we use System.Reflection.Assembly::GetType
                // to retrieve <Module>, a class/type that seems to be always present
                // (despite being excluded from System.Reflection.Assembly::GetTypes).
                return new Image(
                    this.object
                        .method<Object>('GetType', 1)
                        .invoke(string('<Module>'))
                        .method<Object>('get_Module')
                        .invoke()
                        .field<NativePointer>('_impl').value,
                );
            };
        }

        getter(Assembly.prototype, 'image', get, lazy);

        return this.image;
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
