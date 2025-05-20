import { gcHandleFree, gcHandleGetTarget } from '../api';
import { Object } from './object';

export class GCHandle {

    constructor(readonly handle: number) {
    }

    /** Gets the object associated to this handle. */
    get target(): Object | null {
        return new Object(gcHandleGetTarget.value(this.handle)).asNullable();
    }

    /** Frees this handle. */
    free(): void {
        return gcHandleFree.value(this.handle);
    }
}
