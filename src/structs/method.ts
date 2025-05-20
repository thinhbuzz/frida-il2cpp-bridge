import {
    classFromObject,
    methodGetClass,
    methodGetFlags,
    methodGetName,
    methodGetObject,
    methodGetParameterCount,
    methodGetParameterName,
    methodGetParameterType,
    methodGetReturnType,
    methodIsGeneric,
    methodIsInflated,
    methodIsInstance,
} from '../api';
import { unityVersionIsBelow201830 } from '../application';
import { fromFridaValue, toFridaValue } from '../memory';
import { module } from '../module';
import { raise, warn } from '../utils/console';
import { getter } from '../utils/getter';
import { lazy, lazyValue } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { offsetOf } from '../utils/offset-of';
import { array, Array } from './array';
import { Class } from './class';
import { FieldType } from './field';
import { corlib } from './image';
import { Object } from './object';
import { Parameter, ParameterType } from './parameter';
import { Reference } from './reference';
import { Type } from './type';
import { ValueType } from './value-type';

export class Method<T extends MethodReturnType = MethodReturnType> extends NativeStruct {
    /** Gets the class in which this method is defined. */
    @lazy
    get class(): Class {
        return new Class(methodGetClass.value(this));
    }

    /** Gets the flags of the current method. */
    @lazy
    get flags(): number {
        return methodGetFlags.value(this, NULL);
    }

    /** Gets the implementation flags of the current method. */
    @lazy
    get implementationFlags(): number {
        const implementationFlagsPointer = Memory.alloc(Process.pointerSize);
        methodGetFlags.value(this, implementationFlagsPointer);

        return implementationFlagsPointer.readU32();
    }

    /** */
    @lazy
    get fridaSignature(): NativeCallbackArgumentType[] {
        const types: NativeCallbackArgumentType[] = [];

        for (const parameter of this.parameters) {
            types.push(parameter.type.fridaAlias);
        }

        if (!this.isStatic || unityVersionIsBelow201830) {
            types.unshift('pointer');
        }

        if (this.isInflated) {
            types.push('pointer');
        }

        return types;
    }

    /** Gets the generic parameters of this generic method. */
    @lazy
    get generics(): Class[] {
        if (!this.isGeneric && !this.isInflated) {
            return [];
        }

        const types = this.object.method<Array<Object>>('GetGenericArguments').invoke();
        return globalThis.Array.from(types).map(_ => new Class(classFromObject.value(_)));
    }

    /** Determines whether this method is external. */
    @lazy
    get isExternal(): boolean {
        return (this.implementationFlags & MethodImplementationAttribute.InternalCall) != 0;
    }

    /** Determines whether this method is generic. */
    @lazy
    get isGeneric(): boolean {
        return !!methodIsGeneric.value(this);
    }

    /** Determines whether this method is inflated (generic with a concrete type parameter). */
    @lazy
    get isInflated(): boolean {
        return !!methodIsInflated.value(this);
    }

    /** Determines whether this method is static. */
    @lazy
    get isStatic(): boolean {
        return !methodIsInstance.value(this);
    }

    /** Determines whether this method is synchronized. */
    @lazy
    get isSynchronized(): boolean {
        return (this.implementationFlags & MethodImplementationAttribute.Synchronized) != 0;
    }

    /** Gets the access modifier of this method. */
    @lazy
    get modifier(): string | undefined {
        switch (this.flags & MethodAttributes.MemberAccessMask) {
            case MethodAttributes.Private:
                return 'private';
            case MethodAttributes.FamilyAndAssembly:
                return 'private protected';
            case MethodAttributes.Assembly:
                return 'internal';
            case MethodAttributes.Family:
                return 'protected';
            case MethodAttributes.FamilyOrAssembly:
                return 'protected internal';
            case MethodAttributes.Public:
                return 'public';
        }
    }

    /** Gets the name of this method. */
    @lazy
    get name(): string {
        return methodGetName.value(this).readUtf8String()!;
    }

    @lazy
    get nativeFunction(): NativeFunction<any, any> {
        return new NativeFunction(
            this.virtualAddress,
            this.returnType.fridaAlias,
            this.fridaSignature as NativeFunctionArgumentType[],
        );
    }

    /** Gets the encompassing object of the current method. */
    @lazy
    get object(): Object {
        return new Object(methodGetObject.value(this, NULL));
    }

    /** Gets the amount of parameters of this method. */
    @lazy
    get parameterCount(): number {
        return methodGetParameterCount.value(this);
    }

    /** Gets the parameters of this method. */
    @lazy
    get parameters(): Parameter[] {
        return globalThis.Array.from(globalThis.Array(this.parameterCount), (_, i) => {
            const parameterName = methodGetParameterName.value(this, i).readUtf8String()!;
            const parameterType = methodGetParameterType.value(this, i);
            return new Parameter(parameterName, i, new Type(parameterType));
        });
    }

    /** Gets the relative virtual address (RVA) of this method. */
    @lazy
    get relativeVirtualAddress(): NativePointer {
        return this.virtualAddress.sub(module.value.base);
    }

    /** Gets the return type of this method. */
    @lazy
    get returnType(): Type {
        return new Type(methodGetReturnType.value(this));
    }

    /** Gets the virtual address (VA) of this method. */
    get virtualAddress(): NativePointer {
        const FilterTypeName = corlib.value.class('System.Reflection.Module').initialize().field<Object>(
            'FilterTypeName').value;
        const FilterTypeNameMethodPointer = FilterTypeName.field<NativePointer>('method_ptr').value;
        const FilterTypeNameMethod = FilterTypeName.field<NativePointer>('method').value;

        // prettier-ignore
        const offset = offsetOf(FilterTypeNameMethod, _ => _.readPointer().equals(FilterTypeNameMethodPointer))
            ?? raise('couldn\'t find the virtual address offset in the native method struct');

        // prettier-ignore
        getter(Method.prototype, 'virtualAddress', function (this: Method) {
            return this.handle.add(offset).readPointer();
        }, lazy);

        // In Unity 2017.4.40f1 (don't know about others),
        // `Class::initialize` somehow triggers a nasty bug during
        // early instrumentation, so that we aren't able to obtain the
        // offset to get the virtual address of a method when the script
        // is reloaded. A workaround consists in manually re-invoking the
        // static constructor.
        corlib.value.class('System.Reflection.Module').method('.cctor').invoke();

        return this.virtualAddress;
    }

    /** Replaces the body of this method. */
    set implementation(block: (this: Class | Object | ValueType, ...parameters: ParameterType[]) => T) {
        try {
            Interceptor.replace(this.virtualAddress, this.wrap(block));
        } catch (e: any) {
            switch (e.message) {
                case 'access violation accessing 0x0':
                    raise(`couldn't set implementation for method ${this.name} as it has a NULL virtual address`);
                case /unable to intercept function at \w+; please file a bug/.exec(e.message)?.input:
                    warn(`couldn't set implementation for method ${this.name} as it may be a thunk`);
                    break;
                case 'already replaced this function':
                    warn(`couldn't set implementation for method ${this.name} as it has already been replaced by a thunk`);
                    break;
                default:
                    throw e;
            }
        }
    }

    /** Creates a generic instance of the current generic method. */
    inflate<R extends MethodReturnType = T>(...classes: Class[]): Method<R> {
        if (!this.isGeneric || this.generics.length != classes.length) {
            for (const method of this.overloads()) {
                if (method.isGeneric && method.generics.length == classes.length) {
                    return method.inflate(...classes);
                }
            }
            raise(`could not find inflatable signature of method ${this.name} with ${classes.length} generic parameter(s)`);
        }

        const types = classes.map(_ => _.type.object);
        const typeArray = array(corlib.value.class('System.Type'), types);

        const inflatedMethodObject = this.object.method<Object>('MakeGenericMethod', 1).invoke(typeArray);
        return new Method(inflatedMethodObject.field<NativePointer>('mhandle').value);
    }

    /** Invokes this method. */
    invoke(...parameters: ParameterType[]): T {
        if (!this.isStatic) {
            raise(`cannot invoke non-static method ${this.name} as it must be invoked throught a Object, not a Class`);
        }
        return this.invokeRaw(NULL, ...parameters);
    }

    invokeRaw(instance: NativePointerValue, ...parameters: ParameterType[]): T {
        const allocatedParameters = parameters.map(toFridaValue);

        if (!this.isStatic || unityVersionIsBelow201830) {
            allocatedParameters.unshift(instance);
        }

        if (this.isInflated) {
            allocatedParameters.push(this.handle);
        }

        try {
            const returnValue = this.nativeFunction(...allocatedParameters);
            return fromFridaValue(returnValue, this.returnType) as T;
        } catch (e: any) {
            if (e == null) {
                raise('an unexpected native invocation exception occurred, this is due to parameter types mismatch');
            }

            switch (e.message) {
                case 'bad argument count':
                    raise(`couldn't invoke method ${this.name} as it needs ${this.parameterCount} parameter(s), not ${parameters.length}`);
                case 'expected a pointer':
                case 'expected number':
                case 'expected array with fields':
                    raise(`couldn't invoke method ${this.name} using incorrect parameter types`);
            }

            throw e;
        }
    }

    /** Gets the overloaded method with the given parameter types. */
    overload(...typeNamesOrClasses: (string | Class)[]): Method<T> {
        const method = this.tryOverload<T>(...typeNamesOrClasses);
        return (
            method ?? raise(`couldn't find overloaded method ${this.name}(${typeNamesOrClasses.map(_ => (_ instanceof Class ? _.type.name : _))})`)
        );
    }

    * overloads(): Generator<Method> {
        for (const klass of this.class.hierarchy()) {
            for (const method of klass.methods) {
                if (this.name == method.name) {
                    yield method;
                }
            }
        }
    }

    /** Gets the parameter with the given name. */
    parameter(name: string): Parameter {
        return this.tryParameter(name) ?? raise(`couldn't find parameter ${name} in method ${this.name}`);
    }

    /** Restore the original method implementation. */
    revert(): void {
        Interceptor.revert(this.virtualAddress);
        Interceptor.flush();
    }

    /** Gets the overloaded method with the given parameter types. */
    tryOverload<U extends MethodReturnType = T>(...typeNamesOrClasses: (string | Class)[]): Method<U> | undefined {
        const minScore = typeNamesOrClasses.length * 1;
        const maxScore = typeNamesOrClasses.length * 2;

        let candidate: [number, Method] | undefined = undefined;

        loop: for (const method of this.overloads()) {
            if (method.parameterCount != typeNamesOrClasses.length) continue;

            let score = 0;
            let i = 0;
            for (const parameter of method.parameters) {
                const desiredTypeNameOrClass = typeNamesOrClasses[i];
                if (desiredTypeNameOrClass instanceof Class) {
                    if (parameter.type.is(desiredTypeNameOrClass.type)) {
                        score += 2;
                    } else if (parameter.type.class.isAssignableFrom(desiredTypeNameOrClass)) {
                        score += 1;
                    } else {
                        continue loop;
                    }
                } else if (parameter.type.name == desiredTypeNameOrClass) {
                    score += 2;
                } else {
                    continue loop;
                }
                i++;
            }

            if (score < minScore) {

            } else if (score == maxScore) {
                return method as Method<U>;
            } else if (candidate == undefined || score > candidate[0]) {
                candidate = [score, method];
            } else if (score == candidate[0]) {
                // ```cs
                // class Parent {}
                // class Child0 extends Parent {}
                // class Child1 extends Parent {}
                // class Child11 extends Child1 {}
                //
                // class Methods {
                //   void Foo(obj: Parent) {}
                //   void Foo(obj: Child1) {}
                //}
                // ```
                // in this scenario, Foo(Parent) and Foo(Child1) have
                // the same score when looking for Foo(Child11) -
                // we must compare the two candidates to determine the
                // one that is "closer" to Foo(Child11)
                let i = 0;
                for (const parameter of candidate[1].parameters) {
                    // in this case, Foo(Parent) is the candidate
                    // overload: let's compare the parameter types - if
                    // any of the candidate ones is a parent, then the
                    // candidate method is not the closest overload
                    if (parameter.type.class.isAssignableFrom(method.parameters[i].type.class)) {
                        candidate = [score, method];
                        continue loop;
                    }
                    i++;
                }
            }
        }

        return candidate?.[1] as Method<U> | undefined;
    }

    /** Gets the parameter with the given name. */
    tryParameter(name: string): Parameter | undefined {
        return this.parameters.find(_ => _.name == name);
    }

    /** */
    toString(): string {
        return `\
${this.isStatic ? `static ` : ``}\
${this.returnType.name} \
${this.name}\
${this.generics.length > 0 ? `<${this.generics.map(_ => _.type.name).join(',')}>` : ''}\
(${this.parameters.join(`, `)});\
${this.virtualAddress.isNull() ? `` : ` // 0x${this.relativeVirtualAddress.toString(16).padStart(8, `0`)}`}`;
    }

    bind(instance: Object | ValueType): BoundMethod<T> {
        if (this.isStatic) {
            raise(`cannot bind static method ${this.class.type.name}::${this.name} to an instance`);
        }

        return new Proxy(this, {
            get(target: Method<T>, property: keyof Method<T>, receiver: Method<T>): any {
                switch (property) {
                    case 'invoke':
                        // In Unity 5.3.5f1 and >= 2021.2.0f1, value types
                        // methods may assume their `this` parameter is a
                        // pointer to raw data (that is how value types are
                        // layed out in memory) instead of a pointer to an
                        // object (that is object header + raw data).
                        // In any case, they also don't use whatever there
                        // is in the object header, so we can safely "skip"
                        // the object header by adding the object header
                        // size to the object (a boxed value type) handle.
                        const handle =
                            instance instanceof ValueType
                                ? target.class.isValueType
                                    ? instance.handle.sub(structMethodsRequireObjectInstances.value ? Object.headerSize : 0)
                                    : raise(`cannot invoke method ${target.class.type.name}::${target.name} against a value type, you must box it first`)
                                : target.class.isValueType
                                    ? instance.handle.add(structMethodsRequireObjectInstances.value ? 0 : Object.headerSize)
                                    : instance.handle;

                        return target.invokeRaw.bind(target, handle);
                    case 'overloads':
                        return function* () {
                            for (const method of target[property]()) {
                                if (!method.isStatic) {
                                    yield method;
                                }
                            }
                        };
                    case 'inflate':
                    case 'overload':
                    case 'tryOverload':
                        const member = Reflect.get(target, property).bind(receiver);
                        return function (...args: any[]) {
                            return member(...args)?.bind(instance);
                        };
                }

                return Reflect.get(target, property);
            },
        });
    }

    wrap(block: (this: Class | Object | ValueType, ...parameters: ParameterType[]) => T): NativeCallback<any, any> {
        const startIndex = +!this.isStatic | +unityVersionIsBelow201830;
        return new NativeCallback(
            (...args: NativeCallbackArgumentValue[]): NativeCallbackReturnValue => {
                const thisObject = this.isStatic
                    ? this.class
                    : this.class.isValueType
                        ? new ValueType(
                            (args[0] as NativePointer).add(structMethodsRequireObjectInstances.value ? Object.headerSize : 0),
                            this.class.type,
                        )
                        : new Object(args[0] as NativePointer);

                thisObject.currentMethod = this.isStatic ? this : this.bind(thisObject as (Object | ValueType));
                const parameters = this.parameters.map((_, i) => fromFridaValue(args[i + startIndex], _.type));
                const result = block.call(thisObject, ...parameters);
                return toFridaValue(result);
            },
            this.returnType.fridaAlias,
            this.fridaSignature,
        );
    }
}

/**
 * A {@link Method} bound to a {@link Object} or a
 * {@link ValueType} (also known as *instances*). \
 * Invoking bound methods will pass the assigned instance as `this`.
 * ```ts
 * const object: Object = string("Hello, world!").object;
 * const GetLength: BoundMethod<number> = object.method<number>("GetLength");
 * // There is no need to pass the object when invoking GetLength!
 * const length = GetLength.invoke(); // 13
 * ```
 * Of course, binding a static method does not make sense and may cause
 * unwanted behaviors. \
 *
 * Binding can be done manually with:
 * ```ts
 * const SystemString = corlib.class("System.String");
 * const GetLength: Method<number> = SystemString.method<number>("GetLength");
 *
 * const object: Object = string("Hello, world!").object;
 * // ＠ts-ignore
 * const GetLengthBound: BoundMethod<number> = GetLength.bind(object);
 * ```
 */
export interface BoundMethod<T extends MethodReturnType = MethodReturnType> extends Method<T> {
}

export const structMethodsRequireObjectInstances = lazyValue((): boolean => {
    const object = corlib.value.class('System.Int64').alloc();
    object.field('m_value').value = 0xdeadbeef;

    // Here we check where the sentinel value is
    // if it's not where it is supposed to be, it means struct methods
    // assume they are receiving value types (that is a pointer to raw data)
    // hence, we must "skip" the object header when invoking such methods.
    return object.method<boolean>('Equals', 1).overload(object.class).invokeRaw(object, 0xdeadbeef);
});

export type MethodReturnType = void | FieldType | Reference;

export const enum MethodAttributes {
    MemberAccessMask = 0x0007,
    PrivateScope = 0x0000,
    Private = 0x0001,
    FamilyAndAssembly = 0x0002,
    Assembly = 0x0003,
    Family = 0x0004,
    FamilyOrAssembly = 0x0005,
    Public = 0x0006,
    Static = 0x0010,
    Final = 0x0020,
    Virtual = 0x0040,
    HideBySig = 0x0080,
    CheckAccessOnOverride = 0x0200,
    VtableLayoutMask = 0x0100,
    ReuseSlot = 0x0000,
    NewSlot = 0x0100,
    Abstract = 0x0400,
    SpecialName = 0x0800,
    PinvokeImpl = 0x2000,
    UnmanagedExport = 0x0008,
    RTSpecialName = 0x1000,
    ReservedMask = 0xd000,
    HasSecurity = 0x4000,
    RequireSecObject = 0x8000
}

export const enum MethodImplementationAttribute {
    CodeTypeMask = 0x0003,
    IntermediateLanguage = 0x0000,
    Native = 0x0001,
    OptimizedIntermediateLanguage = 0x0002,
    Runtime = 0x0003,
    ManagedMask = 0x0004,
    Unmanaged = 0x0004,
    Managed = 0x0000,
    ForwardRef = 0x0010,
    PreserveSig = 0x0080,
    InternalCall = 0x1000,
    Synchronized = 0x0020,
    NoInlining = 0x0008,
    AggressiveInlining = 0x0100,
    NoOptimization = 0x0040,
    SecurityMitigations = 0x0400,
    MaxMethodImplVal = 0xffff
}
