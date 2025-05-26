import { domainGet, domainGetAssemblies, domainGetAssemblyFromName, threadAttach } from '../api';
import { raise } from '../utils/console';
import { lazy, lazyValue } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { readNativeList } from '../utils/read-native-list';
import { recycle } from '../utils/recycle';
import { Il2CppArray } from './array';
import { Assembly } from './assembly';
import { corlib } from './image';
import { Il2CppObject } from './object';
import { Thread } from './thread';

@recycle
export class Domain extends NativeStruct {
    /** Gets the assemblies that have been loaded into the execution context of the application domain. */
    @lazy
    get assemblies(): Assembly[] {
        let handles = readNativeList(_ => domainGetAssemblies.value(this, _));

        if (handles.length == 0) {
            const assemblyObjects = this.object.method<Il2CppArray<Il2CppObject>>('GetAssemblies').overload().invoke();
            handles = Array.from(assemblyObjects).map(_ => _.field<NativePointer>('_mono_assembly').value);
        }

        return handles.map(_ => new Assembly(_));
    }

    /** Gets the encompassing object of the application domain. */
    @lazy
    get object(): Il2CppObject {
        return corlib.value.class('System.AppDomain').method<Il2CppObject>('get_CurrentDomain').invoke();
    }

    /** Opens and loads the assembly with the given name. */
    assembly(name: string): Assembly {
        return this.tryAssembly(name) ?? raise(`couldn't find assembly ${name}`);
    }

    /** Attached a new thread to the application domain. */
    attach(): Thread {
        return new Thread(threadAttach.value(this));
    }

    /** Opens and loads the assembly with the given name. */
    tryAssembly(name: string): Assembly | null {
        return new Assembly(domainGetAssemblyFromName.value(this, Memory.allocUtf8String(name))).asNullable();
    }
}

/** Gets the application domain. */
export const domain = lazyValue(() => new Domain(domainGet.value()));
