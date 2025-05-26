import {
    alloc,
    free,
    gcCollect as gcCollectNative,
    gcCollectALittle as gcCollectALittleNative,
    gcDisable as gcDisableNative,
    gcEnable as gcEnableNative,
    gcGetHeapSize as gcGetHeapSizeNative,
    gcGetMaxTimeSlice as gcGetMaxTimeSliceNative,
    gcIsDisabled as gcIsDisabledNative,
    gcIsIncremental as gcIsIncrementalNative,
    gcSetMaxTimeSlice as gcSetMaxTimeSliceNative,
    gcStartIncrementalCollection as gcStartIncrementalCollectionNative,
    gcStartWorld as gcStartWorldNative,
    gcStopWorld as gcStopWorldNative,
    livenessAllocateStruct,
    livenessCalculationFromStatics,
    livenessFinalize,
    livenessFreeStruct,
} from './api';
import { Class } from './structs/class';
import { Il2CppObject } from './structs/object';

/**
 * Gets the heap size in bytes.
 */
export function getHeapSize(): Int64 {
    return gcGetHeapSizeNative.value();
}

/**
 * Gets whether the garbage collector is enabled.
 */
export function isEnabled(): boolean {
    return !gcIsDisabledNative.value();
}

/**
 * Sets whether the garbage collector is enabled.
 */
export function setEnabled(value: boolean): void {
    value ? gcEnableNative.value() : gcDisableNative.value();
}

/**
 * Gets whether the garbage collector is incremental
 * ([source](https://docs.unity3d.com/Manual/performance-incremental-garbage-collection.html)).
 */
export function isIncremental(): boolean {
    return !!gcIsIncrementalNative.value();
}

/**
 * Gets the number of nanoseconds the garbage collector can spend in a
 * collection step.
 */
export function getMaxTimeSlice(): Int64 {
    return gcGetMaxTimeSliceNative.value();
}

/**
 * Sets the number of nanoseconds the garbage collector can spend in
 * a collection step.
 */
export function setMaxTimeSlice(nanoseconds: number | Int64): void {
    gcSetMaxTimeSliceNative.value(nanoseconds);
}

/**
 * Returns the heap allocated objects of the specified class. \
 * This variant reads GC descriptors.
 */
export function choose(klass: Class): Il2CppObject[] {
    const matches: Il2CppObject[] = [];

    const callback = (objects: NativePointer, size: number) => {
        for (let i = 0; i < size; i++) {
            matches.push(new Il2CppObject(objects.add(i * Process.pointerSize).readPointer()));
        }
    };

    const chooseCallback = new NativeCallback(callback, 'void', ['pointer', 'int', 'pointer']);

    const realloc = (handle: NativePointer, size: UInt64) => {
        if (!handle.isNull() && size.compare(0) == 0) {
            free.value(handle);
            return NULL;
        } else {
            return alloc.value(size);
        }
    };

    const reallocCallback = new NativeCallback(realloc, 'pointer', ['pointer', 'size_t', 'pointer']);

    stopWorld();

    const state = livenessAllocateStruct.value(klass, 0, chooseCallback, NULL, reallocCallback);
    livenessCalculationFromStatics.value(state);
    livenessFinalize.value(state);

    startWorld();

    livenessFreeStruct.value(state);

    return matches;
}

/**
 * Forces a garbage collection of the specified generation.
 */
export function collect(generation: 0 | 1 | 2): void {
    gcCollectNative.value(generation < 0 ? 0 : generation > 2 ? 2 : generation);
}

/**
 * Forces a garbage collection.
 */
export function collectALittle(): void {
    gcCollectALittleNative.value();
}

/**
 * Resumes all the previously stopped threads.
 */
export function startWorld(): void {
    return gcStartWorldNative.value();
}

/**
 * Performs an incremental garbage collection.
 */
export function startIncrementalCollection(): void {
    return gcStartIncrementalCollectionNative.value();
}

/**
 * Stops all threads which may access the garbage collected heap, other
 * than the caller.
 */
export function stopWorld(): void {
    return gcStopWorldNative.value();
}
