import { memorySnapshotCapture, memorySnapshotFree, memorySnapshotGetClasses, memorySnapshotGetObjects } from '../api';
import { lazy } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { readNativeIterator } from '../utils/read-native-iterator';
import { readNativeList } from '../utils/read-native-list';
import { Class } from './class';
import { Il2CppObject } from './object';

export class MemorySnapshot extends NativeStruct {
    /** Creates a memory snapshot with the given handle. */
    constructor(handle: NativePointer = memorySnapshotCapture.value()) {
        super(handle);
    }

    /** Gets any initialized class. */
    @lazy
    get classes(): Class[] {
        return readNativeIterator(_ => memorySnapshotGetClasses.value(this, _)).map(_ => new Class(_));
    }

    /** Gets the objects tracked by this memory snapshot. */
    @lazy
    get objects(): Il2CppObject[] {
        // prettier-ignore
        return readNativeList(_ => memorySnapshotGetObjects.value(
            this,
            _,
        )).filter(_ => !_.isNull()).map(_ => new Il2CppObject(_));
    }

    /** Captures a memory snapshot. */
    static capture(): MemorySnapshot {
        return new MemorySnapshot();
    }

    /** Frees this memory snapshot. */
    free(): void {
        memorySnapshotFree.value(this);
    }
}

/** */
export function memorySnapshot<T>(block: (memorySnapshot: Omit<MemorySnapshot, 'free'>) => T): T {
    const memorySnapshot = MemorySnapshot.capture();
    const result = block(memorySnapshot);
    memorySnapshot.free();
    return result;
}
