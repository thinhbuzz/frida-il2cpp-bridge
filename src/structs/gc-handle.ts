import { gcHandleFree, gcHandleGetTarget } from '../api';
import { Il2CppObject } from './object';

export class GCHandle {

    constructor(readonly handle: number) {
    }

    /** Gets the object associated to this handle. */
    get target(): Il2CppObject | null {
        return new Il2CppObject(gcHandleGetTarget.value(this.handle)).asNullable();
    }

    /** Frees this handle. */
    free(): void {
        return gcHandleFree.value(this.handle);
    }
}
