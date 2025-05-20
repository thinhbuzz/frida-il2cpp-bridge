import { module } from './module';
import { raise } from './utils/console';
import { lazyValue } from './utils/lazy';

/**
 * The **core** object where all the necessary IL2CPP native functions are
 * held. \
 * `frida-il2cpp-bridge` is built around this object by providing an
 * easy-to-use abstraction layer: the user isn't expected to use it directly,
 * but it can in case of advanced use cases.
 *
 * The APIs depends on the Unity version, hence some of them may be
 * unavailable; moreover, they are searched by **name** (e.g.
 * `il2cpp_class_from_name`) hence they might get stripped, hidden or
 * renamed by a nasty obfuscator.
 *
 * However, it is possible to override or set the handle of any of the
 * exports by using a global variable:
 * ```ts
 * declare global {
 *     let IL2CPP_EXPORTS: Record<string, () => NativePointer>;
 * }
 *
 * IL2CPP_EXPORTS = {
 *     il2cpp_image_get_class: () => module.base.add(0x1204c),
 *     il2cpp_class_get_parent: () => {
 *         return Memory.scanSync(module.base, module.size, "2f 10 ee 10 34 a8")[0].address;
 *     },
 * };
 * ```
 */
export function r<R extends NativeFunctionReturnType, A extends NativeFunctionArgumentType[] | []>(
    exportName: string,
    retType: R,
    argTypes: A,
) {
    const handle = module.value.findExportByName(exportName);
    return new NativeFunction(handle ?? raise(`couldn't resolve export ${exportName}`), retType, argTypes);
}

export function lazyNativeValue<R extends NativeFunctionReturnType, A extends NativeFunctionArgumentType[] | []>(
    exportName: string,
    retType: R,
    argTypes: A,
) {
    return lazyValue(() => r(exportName, retType, argTypes));
}

export const alloc = lazyNativeValue('il2cpp_alloc', 'pointer', ['size_t']);

export const arrayGetLength = lazyNativeValue('il2cpp_array_length', 'uint32', ['pointer']);

export const arrayNew = lazyNativeValue('il2cpp_array_new', 'pointer', ['pointer', 'uint32']);

export const assemblyGetImage = lazyNativeValue('il2cpp_assembly_get_image', 'pointer', ['pointer']);

export const classForEach = lazyNativeValue('il2cpp_class_for_each', 'void', ['pointer', 'pointer']);

export const classFromName = lazyNativeValue('il2cpp_class_from_name', 'pointer', ['pointer', 'pointer', 'pointer']);

export const classFromObject = lazyNativeValue('il2cpp_class_from_system_type', 'pointer', ['pointer']);

export const classGetArrayClass = lazyNativeValue('il2cpp_array_class_get', 'pointer', ['pointer', 'uint32']);

export const classGetArrayElementSize = lazyNativeValue('il2cpp_class_array_element_size', 'int', ['pointer']);

export const classGetAssemblyName = lazyNativeValue('il2cpp_class_get_assemblyname', 'pointer', ['pointer']);

export const classGetBaseType = lazyNativeValue('il2cpp_class_enum_basetype', 'pointer', ['pointer']);

export const classGetDeclaringType = lazyNativeValue('il2cpp_class_get_declaring_type', 'pointer', ['pointer']);

export const classGetElementClass = lazyNativeValue('il2cpp_class_get_element_class', 'pointer', ['pointer']);

export const classGetFieldFromName = lazyNativeValue(
    'il2cpp_class_get_field_from_name',
    'pointer',
    ['pointer', 'pointer'],
);

export const classGetFields = lazyNativeValue('il2cpp_class_get_fields', 'pointer', ['pointer', 'pointer']);

export const classGetFlags = lazyNativeValue('il2cpp_class_get_flags', 'int', ['pointer']);

export const classGetImage = lazyNativeValue('il2cpp_class_get_image', 'pointer', ['pointer']);

export const classGetInstanceSize = lazyNativeValue('il2cpp_class_instance_size', 'int32', ['pointer']);

export const classGetInterfaces = lazyNativeValue('il2cpp_class_get_interfaces', 'pointer', ['pointer', 'pointer']);

export const classGetMethodFromName = lazyNativeValue(
    'il2cpp_class_get_method_from_name',
    'pointer',
    ['pointer', 'pointer', 'int'],
);

export const classGetMethods = lazyNativeValue('il2cpp_class_get_methods', 'pointer', ['pointer', 'pointer']);

export const classGetName = lazyNativeValue('il2cpp_class_get_name', 'pointer', ['pointer']);

export const classGetNamespace = lazyNativeValue('il2cpp_class_get_namespace', 'pointer', ['pointer']);

export const classGetNestedClasses = lazyNativeValue(
    'il2cpp_class_get_nested_types',
    'pointer',
    ['pointer', 'pointer'],
);

export const classGetParent = lazyNativeValue('il2cpp_class_get_parent', 'pointer', ['pointer']);

export const classGetStaticFieldData = lazyNativeValue('il2cpp_class_get_static_field_data', 'pointer', ['pointer']);

export const classGetValueTypeSize = lazyNativeValue('il2cpp_class_value_size', 'int32', ['pointer', 'pointer']);

export const classGetType = lazyNativeValue('il2cpp_class_get_type', 'pointer', ['pointer']);

export const classHasReferences = lazyNativeValue('il2cpp_class_has_references', 'bool', ['pointer']);

export const classInitialize = lazyNativeValue('il2cpp_runtime_class_init', 'void', ['pointer']);

export const classIsAbstract = lazyNativeValue('il2cpp_class_is_abstract', 'bool', ['pointer']);

export const classIsAssignableFrom = lazyNativeValue('il2cpp_class_is_assignable_from', 'bool', ['pointer', 'pointer']);

export const classIsBlittable = lazyNativeValue('il2cpp_class_is_blittable', 'bool', ['pointer']);

export const classIsEnum = lazyNativeValue('il2cpp_class_is_enum', 'bool', ['pointer']);

export const classIsGeneric = lazyNativeValue('il2cpp_class_is_generic', 'bool', ['pointer']);

export const classIsInflated = lazyNativeValue('il2cpp_class_is_inflated', 'bool', ['pointer']);

export const classIsInterface = lazyNativeValue('il2cpp_class_is_interface', 'bool', ['pointer']);

export const classIsSubclassOf = lazyNativeValue('il2cpp_class_is_subclass_of', 'bool', ['pointer', 'pointer', 'bool']);

export const classIsValueType = lazyNativeValue('il2cpp_class_is_valuetype', 'bool', ['pointer']);

export const domainGetAssemblyFromName = lazyNativeValue(
    'il2cpp_domain_assembly_open',
    'pointer',
    ['pointer', 'pointer'],
);

export const domainGet = lazyNativeValue('il2cpp_domain_get', 'pointer', []);

export const domainGetAssemblies = lazyNativeValue('il2cpp_domain_get_assemblies', 'pointer', ['pointer', 'pointer']);

export const fieldGetClass = lazyNativeValue('il2cpp_field_get_parent', 'pointer', ['pointer']);

export const fieldGetFlags = lazyNativeValue('il2cpp_field_get_flags', 'int', ['pointer']);

export const fieldGetName = lazyNativeValue('il2cpp_field_get_name', 'pointer', ['pointer']);

export const fieldGetOffset = lazyNativeValue('il2cpp_field_get_offset', 'int32', ['pointer']);

export const fieldGetStaticValue = lazyNativeValue('il2cpp_field_static_get_value', 'void', ['pointer', 'pointer']);

export const fieldGetType = lazyNativeValue('il2cpp_field_get_type', 'pointer', ['pointer']);

export const fieldSetStaticValue = lazyNativeValue('il2cpp_field_static_set_value', 'void', ['pointer', 'pointer']);

export const free = lazyNativeValue('il2cpp_free', 'void', ['pointer']);

export const gcCollect = lazyNativeValue('il2cpp_gc_collect', 'void', ['int']);

export const gcCollectALittle = lazyNativeValue('il2cpp_gc_collect_a_little', 'void', []);

export const gcDisable = lazyNativeValue('il2cpp_gc_disable', 'void', []);

export const gcEnable = lazyNativeValue('il2cpp_gc_enable', 'void', []);

export const gcGetHeapSize = lazyNativeValue('il2cpp_gc_get_heap_size', 'int64', []);

export const gcGetMaxTimeSlice = lazyNativeValue('il2cpp_gc_get_max_time_slice_ns', 'int64', []);

export const gcGetUsedSize = lazyNativeValue('il2cpp_gc_get_used_size', 'int64', []);

export const gcHandleGetTarget = lazyNativeValue('il2cpp_gchandle_get_target', 'pointer', ['uint32']);

export const gcHandleFree = lazyNativeValue('il2cpp_gchandle_free', 'void', ['uint32']);

export const gcHandleNew = lazyNativeValue('il2cpp_gchandle_new', 'uint32', ['pointer', 'bool']);

export const gcHandleNewWeakRef = lazyNativeValue('il2cpp_gchandle_new_weakref', 'uint32', ['pointer', 'bool']);

export const gcIsDisabled = lazyNativeValue('il2cpp_gc_is_disabled', 'bool', []);

export const gcIsIncremental = lazyNativeValue('il2cpp_gc_is_incremental', 'bool', []);

export const gcSetMaxTimeSlice = lazyNativeValue('il2cpp_gc_set_max_time_slice_ns', 'void', ['int64']);

export const gcStartIncrementalCollection = lazyNativeValue('il2cpp_gc_start_incremental_collection', 'void', []);

export const gcStartWorld = lazyNativeValue('il2cpp_start_gc_world', 'void', []);

export const gcStopWorld = lazyNativeValue('il2cpp_stop_gc_world', 'void', []);

export const getCorlib = lazyNativeValue('il2cpp_get_corlib', 'pointer', []);

export const imageGetAssembly = lazyNativeValue('il2cpp_image_get_assembly', 'pointer', ['pointer']);

export const imageGetClass = lazyNativeValue('il2cpp_image_get_class', 'pointer', ['pointer', 'uint']);

export const imageGetClassCount = lazyNativeValue('il2cpp_image_get_class_count', 'uint32', ['pointer']);

export const imageGetName = lazyNativeValue('il2cpp_image_get_name', 'pointer', ['pointer']);

export const initialize = lazyNativeValue('il2cpp_init', 'void', ['pointer']);

export const livenessAllocateStruct = lazyNativeValue(
    'il2cpp_unity_liveness_allocate_struct',
    'pointer',
    ['pointer', 'int', 'pointer', 'pointer', 'pointer'],
);

export const livenessCalculationBegin = lazyNativeValue(
    'il2cpp_unity_liveness_calculation_begin',
    'pointer',
    ['pointer', 'int', 'pointer', 'pointer', 'pointer', 'pointer'],
);

export const livenessCalculationEnd = lazyNativeValue('il2cpp_unity_liveness_calculation_end', 'void', ['pointer']);

export const livenessCalculationFromStatics = lazyNativeValue(
    'il2cpp_unity_liveness_calculation_from_statics',
    'void',
    ['pointer'],
);

export const livenessFinalize = lazyNativeValue('il2cpp_unity_liveness_finalize', 'void', ['pointer']);

export const livenessFreeStruct = lazyNativeValue('il2cpp_unity_liveness_free_struct', 'void', ['pointer']);

export const memorySnapshotCapture = lazyNativeValue('il2cpp_capture_memory_snapshot', 'pointer', []);

export const memorySnapshotFree = lazyNativeValue('il2cpp_free_captured_memory_snapshot', 'void', ['pointer']);

export const memorySnapshotGetClasses = lazyNativeValue(
    'il2cpp_memory_snapshot_get_classes',
    'pointer',
    ['pointer', 'pointer'],
);

export const memorySnapshotGetObjects = lazyNativeValue(
    'il2cpp_memory_snapshot_get_objects',
    'pointer',
    ['pointer', 'pointer'],
);

export const methodGetClass = lazyNativeValue('il2cpp_method_get_class', 'pointer', ['pointer']);

export const methodGetFlags = lazyNativeValue('il2cpp_method_get_flags', 'uint32', ['pointer', 'pointer']);

export const methodGetName = lazyNativeValue('il2cpp_method_get_name', 'pointer', ['pointer']);

export const methodGetObject = lazyNativeValue('il2cpp_method_get_object', 'pointer', ['pointer', 'pointer']);

export const methodGetParameterCount = lazyNativeValue('il2cpp_method_get_param_count', 'uint8', ['pointer']);

export const methodGetParameterName = lazyNativeValue('il2cpp_method_get_param_name', 'pointer', ['pointer', 'uint32']);

export const methodGetParameters = lazyNativeValue('il2cpp_method_get_parameters', 'pointer', ['pointer', 'pointer']);

export const methodGetParameterType = lazyNativeValue('il2cpp_method_get_param', 'pointer', ['pointer', 'uint32']);

export const methodGetReturnType = lazyNativeValue('il2cpp_method_get_return_type', 'pointer', ['pointer']);

export const methodIsGeneric = lazyNativeValue('il2cpp_method_is_generic', 'bool', ['pointer']);

export const methodIsInflated = lazyNativeValue('il2cpp_method_is_inflated', 'bool', ['pointer']);

export const methodIsInstance = lazyNativeValue('il2cpp_method_is_instance', 'bool', ['pointer']);

export const monitorEnter = lazyNativeValue('il2cpp_monitor_enter', 'void', ['pointer']);

export const monitorExit = lazyNativeValue('il2cpp_monitor_exit', 'void', ['pointer']);

export const monitorPulse = lazyNativeValue('il2cpp_monitor_pulse', 'void', ['pointer']);

export const monitorPulseAll = lazyNativeValue('il2cpp_monitor_pulse_all', 'void', ['pointer']);

export const monitorTryEnter = lazyNativeValue('il2cpp_monitor_try_enter', 'bool', ['pointer', 'uint32']);

export const monitorTryWait = lazyNativeValue('il2cpp_monitor_try_wait', 'bool', ['pointer', 'uint32']);

export const monitorWait = lazyNativeValue('il2cpp_monitor_wait', 'void', ['pointer']);

export const objectGetClass = lazyNativeValue('il2cpp_object_get_class', 'pointer', ['pointer']);

export const objectGetVirtualMethod = lazyNativeValue(
    'il2cpp_object_get_virtual_method',
    'pointer',
    ['pointer', 'pointer'],
);

export const objectInitialize = lazyNativeValue('il2cpp_runtime_object_init_exception', 'void', ['pointer', 'pointer']);

export const objectNew = lazyNativeValue('il2cpp_object_new', 'pointer', ['pointer']);

export const objectGetSize = lazyNativeValue('il2cpp_object_get_size', 'uint32', ['pointer']);

export const objectUnbox = lazyNativeValue('il2cpp_object_unbox', 'pointer', ['pointer']);

export const resolveInternalCall = lazyNativeValue('il2cpp_resolve_icall', 'pointer', ['pointer']);

export const stringGetChars = lazyNativeValue('il2cpp_string_chars', 'pointer', ['pointer']);

export const stringGetLength = lazyNativeValue('il2cpp_string_length', 'int32', ['pointer']);

export const stringNew = lazyNativeValue('il2cpp_string_new', 'pointer', ['pointer']);

export const valueTypeBox = lazyNativeValue('il2cpp_value_box', 'pointer', ['pointer', 'pointer']);

export const threadAttach = lazyNativeValue('il2cpp_thread_attach', 'pointer', ['pointer']);

export const threadDetach = lazyNativeValue('il2cpp_thread_detach', 'void', ['pointer']);

export const threadGetAttachedThreads = lazyNativeValue(
    'il2cpp_thread_get_all_attached_threads',
    'pointer',
    ['pointer'],
);

export const threadGetCurrent = lazyNativeValue('il2cpp_thread_current', 'pointer', []);

export const threadIsVm = lazyNativeValue('il2cpp_is_vm_thread', 'bool', ['pointer']);

export const typeGetClass = lazyNativeValue('il2cpp_class_from_type', 'pointer', ['pointer']);

export const typeGetName = lazyNativeValue('il2cpp_type_get_name', 'pointer', ['pointer']);

export const typeGetObject = lazyNativeValue('il2cpp_type_get_object', 'pointer', ['pointer']);

export const typeGetTypeEnum = lazyNativeValue('il2cpp_type_get_type', 'int', ['pointer']);
