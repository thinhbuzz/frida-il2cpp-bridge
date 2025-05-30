namespace Il2Cpp {
    export class Method<T extends Il2Cpp.Method.ReturnType = Il2Cpp.Method.ReturnType> extends NativeStruct {
        /** Gets the class in which this method is defined. */
        @lazy
        get class(): Il2Cpp.Class {
            return new Il2Cpp.Class(Il2Cpp.exports.methodGetClass(this));
        }

        /** Gets the flags of the current method. */
        @lazy
        get flags(): number {
            return Il2Cpp.exports.methodGetFlags(this, NULL);
        }

        /** Gets the implementation flags of the current method. */
        @lazy
        get implementationFlags(): number {
            const implementationFlagsPointer = Memory.alloc(Process.pointerSize);
            Il2Cpp.exports.methodGetFlags(this, implementationFlagsPointer);

            return implementationFlagsPointer.readU32();
        }

        /** */
        @lazy
        get fridaSignature(): NativeCallbackArgumentType[] {
            const types: NativeCallbackArgumentType[] = [];

            for (const parameter of this.parameters) {
                types.push(parameter.type.fridaAlias);
            }

            if (!this.isStatic || Il2Cpp.unityVersionIsBelow201830) {
                types.unshift("pointer");
            }

            if (this.isInflated) {
                types.push("pointer");
            }

            return types;
        }

        /** Gets the generic parameters of this generic method. */
        @lazy
        get generics(): Il2Cpp.Class[] {
            if (!this.isGeneric && !this.isInflated) {
                return [];
            }

            const types = this.object.method<Il2Cpp.Array<Il2Cpp.Object>>("GetGenericArguments").invoke();
            return globalThis.Array.from(types).map(_ => new Il2Cpp.Class(Il2Cpp.exports.classFromObject(_)));
        }

        /** Determines whether this method is external. */
        @lazy
        get isExternal(): boolean {
            return (this.implementationFlags & Il2Cpp.Method.ImplementationAttribute.InternalCall) != 0;
        }

        /** Determines whether this method is generic. */
        @lazy
        get isGeneric(): boolean {
            return !!Il2Cpp.exports.methodIsGeneric(this);
        }

        /** Determines whether this method is inflated (generic with a concrete type parameter). */
        @lazy
        get isInflated(): boolean {
            return !!Il2Cpp.exports.methodIsInflated(this);
        }

        /** Determines whether this method is static. */
        @lazy
        get isStatic(): boolean {
            return !Il2Cpp.exports.methodIsInstance(this);
        }

        /** Determines whether this method is synchronized. */
        @lazy
        get isSynchronized(): boolean {
            return (this.implementationFlags & Il2Cpp.Method.ImplementationAttribute.Synchronized) != 0;
        }

        /** Gets the access modifier of this method. */
        @lazy
        get modifier(): string | undefined {
            switch (this.flags & Il2Cpp.Method.Attributes.MemberAccessMask) {
                case Il2Cpp.Method.Attributes.Private:
                    return "private";
                case Il2Cpp.Method.Attributes.FamilyAndAssembly:
                    return "private protected";
                case Il2Cpp.Method.Attributes.Assembly:
                    return "internal";
                case Il2Cpp.Method.Attributes.Family:
                    return "protected";
                case Il2Cpp.Method.Attributes.FamilyOrAssembly:
                    return "protected internal";
                case Il2Cpp.Method.Attributes.Public:
                    return "public";
            }
        }

        /** Gets the name of this method. */
        @lazy
        get name(): string {
            return Il2Cpp.exports.methodGetName(this).readUtf8String()!;
        }

        /** @internal */
        @lazy
        get nativeFunction(): NativeFunction<any, any> {
            return new NativeFunction(this.virtualAddress, this.returnType.fridaAlias, this.fridaSignature as NativeFunctionArgumentType[]);
        }

        /** Gets the encompassing object of the current method. */
        @lazy
        get object(): Il2Cpp.Object {
            return new Il2Cpp.Object(Il2Cpp.exports.methodGetObject(this, NULL));
        }

        /** Gets the amount of parameters of this method. */
        @lazy
        get parameterCount(): number {
            return Il2Cpp.exports.methodGetParameterCount(this);
        }

        /** Gets the parameters of this method. */
        @lazy
        get parameters(): Il2Cpp.Parameter[] {
            return globalThis.Array.from(globalThis.Array(this.parameterCount), (_, i) => {
                const parameterName = Il2Cpp.exports.methodGetParameterName(this, i).readUtf8String()!;
                const parameterType = Il2Cpp.exports.methodGetParameterType(this, i);
                return new Il2Cpp.Parameter(parameterName, i, new Il2Cpp.Type(parameterType));
            });
        }

        /** Gets the relative virtual address (RVA) of this method. */
        @lazy
        get relativeVirtualAddress(): NativePointer {
            return this.virtualAddress.sub(Il2Cpp.module.base);
        }

        /** Gets the return type of this method. */
        @lazy
        get returnType(): Il2Cpp.Type {
            return new Il2Cpp.Type(Il2Cpp.exports.methodGetReturnType(this));
        }

        /** Gets the virtual address (VA) of this method. */
        get virtualAddress(): NativePointer {
            const FilterTypeName = Il2Cpp.corlib.class("System.Reflection.Module").initialize().field<Il2Cpp.Object>("FilterTypeName").value;
            const FilterTypeNameMethodPointer = FilterTypeName.field<NativePointer>("method_ptr").value;
            const FilterTypeNameMethod = FilterTypeName.field<NativePointer>("method").value;

            // prettier-ignore
            const offset = FilterTypeNameMethod.offsetOf(_ => _.readPointer().equals(FilterTypeNameMethodPointer)) 
                ?? raise("couldn't find the virtual address offset in the native method struct");

            // prettier-ignore
            getter(Il2Cpp.Method.prototype, "virtualAddress", function (this: Il2Cpp.Method) {
                return this.handle.add(offset).readPointer();
            }, lazy);

            // In Unity 2017.4.40f1 (don't know about others),
            // `Il2Cpp.Class::initialize` somehow triggers a nasty bug during
            // early instrumentation, so that we aren't able to obtain the
            // offset to get the virtual address of a method when the script
            // is reloaded. A workaround consists in manually re-invoking the
            // static constructor.
            Il2Cpp.corlib.class("System.Reflection.Module").method(".cctor").invoke();

            return this.virtualAddress;
        }

        /** Replaces the body of this method. */
        set implementation(block: (this: Il2Cpp.Class | Il2Cpp.Object | Il2Cpp.ValueType, ...parameters: Il2Cpp.Parameter.Type[]) => T) {
            try {
                Interceptor.replace(this.virtualAddress, this.wrap(block));
            } catch (e: any) {
                switch (e.message) {
                    case "access violation accessing 0x0":
                        raise(`couldn't set implementation for method ${this.name} as it has a NULL virtual address`);
                    case /unable to intercept function at \w+; please file a bug/.exec(e.message)?.input:
                        warn(`couldn't set implementation for method ${this.name} as it may be a thunk`);
                        break;
                    case "already replaced this function":
                        warn(`couldn't set implementation for method ${this.name} as it has already been replaced by a thunk`);
                        break;
                    default:
                        throw e;
                }
            }
        }

        /** Creates a generic instance of the current generic method. */
        inflate<R extends Il2Cpp.Method.ReturnType = T>(...classes: Il2Cpp.Class[]): Il2Cpp.Method<R> {
            if (!this.isGeneric || this.generics.length != classes.length) {
                for (const method of this.overloads()) {
                    if (method.isGeneric && method.generics.length == classes.length) {
                        return method.inflate(...classes);
                    }
                }
                raise(`could not find inflatable signature of method ${this.name} with ${classes.length} generic parameter(s)`);
            }

            const types = classes.map(_ => _.type.object);
            const typeArray = Il2Cpp.array(Il2Cpp.corlib.class("System.Type"), types);

            const inflatedMethodObject = this.object.method<Il2Cpp.Object>("MakeGenericMethod", 1).invoke(typeArray);
            return new Il2Cpp.Method(inflatedMethodObject.field<NativePointer>("mhandle").value);
        }

        /** Invokes this method. */
        invoke(...parameters: Il2Cpp.Parameter.Type[]): T {
            if (!this.isStatic) {
                raise(`cannot invoke non-static method ${this.name} as it must be invoked throught a Il2Cpp.Object, not a Il2Cpp.Class`);
            }
            return this.invokeRaw(NULL, ...parameters);
        }

        /** @internal */
        invokeRaw(instance: NativePointerValue, ...parameters: Il2Cpp.Parameter.Type[]): T {
            const allocatedParameters = parameters.map(toFridaValue);

            if (!this.isStatic || Il2Cpp.unityVersionIsBelow201830) {
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
                    raise("an unexpected native invocation exception occurred, this is due to parameter types mismatch");
                }

                switch (e.message) {
                    case "bad argument count":
                        raise(`couldn't invoke method ${this.name} as it needs ${this.parameterCount} parameter(s), not ${parameters.length}`);
                    case "expected a pointer":
                    case "expected number":
                    case "expected array with fields":
                        raise(`couldn't invoke method ${this.name} using incorrect parameter types`);
                }

                throw e;
            }
        }

        /** Gets the overloaded method with the given parameter types. */
        overload(...typeNamesOrClasses: (string | Il2Cpp.Class)[]): Il2Cpp.Method<T> {
            const method = this.tryOverload<T>(...typeNamesOrClasses);
            return (
                method ?? raise(`couldn't find overloaded method ${this.name}(${typeNamesOrClasses.map(_ => (_ instanceof Il2Cpp.Class ? _.type.name : _))})`)
            );
        }

        /** @internal */
        *overloads(): Generator<Il2Cpp.Method> {
            for (const klass of this.class.hierarchy()) {
                for (const method of klass.methods) {
                    if (this.name == method.name) {
                        yield method;
                    }
                }
            }
        }

        /** Gets the parameter with the given name. */
        parameter(name: string): Il2Cpp.Parameter {
            return this.tryParameter(name) ?? raise(`couldn't find parameter ${name} in method ${this.name}`);
        }

        /** Restore the original method implementation. */
        revert(): void {
            Interceptor.revert(this.virtualAddress);
            Interceptor.flush();
        }

        /** Gets the overloaded method with the given parameter types. */
        tryOverload<U extends Il2Cpp.Method.ReturnType = T>(...typeNamesOrClasses: (string | Il2Cpp.Class)[]): Il2Cpp.Method<U> | undefined {
            const minScore = typeNamesOrClasses.length * 1;
            const maxScore = typeNamesOrClasses.length * 2;

            let candidate: [number, Il2Cpp.Method] | undefined = undefined;

            loop: for (const method of this.overloads()) {
                if (method.parameterCount != typeNamesOrClasses.length) continue;

                let score = 0;
                let i = 0;
                for (const parameter of method.parameters) {
                    const desiredTypeNameOrClass = typeNamesOrClasses[i];
                    if (desiredTypeNameOrClass instanceof Il2Cpp.Class) {
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
                    continue;
                } else if (score == maxScore) {
                    return method as Il2Cpp.Method<U>;
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

            return candidate?.[1] as Il2Cpp.Method<U> | undefined;
        }

        /** Gets the parameter with the given name. */
        tryParameter(name: string): Il2Cpp.Parameter | undefined {
            return this.parameters.find(_ => _.name == name);
        }

        /** */
        toString(): string {
            return `\
${this.isStatic ? `static ` : ``}\
${this.returnType.name} \
${this.name}\
${this.generics.length > 0 ? `<${this.generics.map(_ => _.type.name).join(",")}>` : ""}\
(${this.parameters.join(`, `)});\
${this.virtualAddress.isNull() ? `` : ` // 0x${this.relativeVirtualAddress.toString(16).padStart(8, `0`)}`}`;
        }

        /**
         * @internal
         * Binds the current method to a {@link Il2Cpp.Object} or a
         * {@link Il2Cpp.ValueType} (also known as *instances*), so that it is
         * possible to invoke it - see {@link Il2Cpp.Method.invoke} for
         * details. \
         * Binding a static method is forbidden.
         */
        bind(instance: Il2Cpp.Object | Il2Cpp.ValueType): Il2Cpp.BoundMethod<T> {
            if (this.isStatic) {
                raise(`cannot bind static method ${this.class.type.name}::${this.name} to an instance`);
            }

            return new Proxy(this, {
                get(target: Il2Cpp.Method<T>, property: keyof Il2Cpp.Method<T>, receiver: Il2Cpp.Method<T>): any {
                    switch (property) {
                        case "invoke":
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
                                instance instanceof Il2Cpp.ValueType
                                    ? target.class.isValueType
                                        ? instance.handle.sub(structMethodsRequireObjectInstances() ? Il2Cpp.Object.headerSize : 0)
                                        : raise(`cannot invoke method ${target.class.type.name}::${target.name} against a value type, you must box it first`)
                                    : target.class.isValueType
                                    ? instance.handle.add(structMethodsRequireObjectInstances() ? 0 : Il2Cpp.Object.headerSize)
                                    : instance.handle;

                            return target.invokeRaw.bind(target, handle);
                        case "overloads":
                            return function* () {
                                for (const method of target[property]()) {
                                    if (!method.isStatic) {
                                        yield method;
                                    }
                                }
                            };
                        case "inflate":
                        case "overload":
                        case "tryOverload":
                            const member = Reflect.get(target, property).bind(receiver);
                            return function (...args: any[]) {
                                return member(...args)?.bind(instance);
                            };
                    }

                    return Reflect.get(target, property);
                }
            });
        }

        /** @internal */
        wrap(block: (this: Il2Cpp.Class | Il2Cpp.Object | Il2Cpp.ValueType, ...parameters: Il2Cpp.Parameter.Type[]) => T): NativeCallback<any, any> {
            const startIndex = +!this.isStatic | +Il2Cpp.unityVersionIsBelow201830;
            return new NativeCallback(
                (...args: NativeCallbackArgumentValue[]): NativeCallbackReturnValue => {
                    const thisObject = this.isStatic
                        ? this.class
                        : this.class.isValueType
                        ? new Il2Cpp.ValueType(
                              (args[0] as NativePointer).add(structMethodsRequireObjectInstances() ? Il2Cpp.Object.headerSize : 0),
                              this.class.type
                          )
                        : new Il2Cpp.Object(args[0] as NativePointer);

                    const parameters = this.parameters.map((_, i) => fromFridaValue(args[i + startIndex], _.type));
                    const result = block.call(thisObject, ...parameters);
                    return toFridaValue(result);
                },
                this.returnType.fridaAlias,
                this.fridaSignature
            );
        }
    }

    /**
     * A {@link Il2Cpp.Method} bound to a {@link Il2Cpp.Object} or a
     * {@link Il2Cpp.ValueType} (also known as *instances*). \
     * Invoking bound methods will pass the assigned instance as `this`.
     * ```ts
     * const object: Il2Cpp.Object = Il2Cpp.string("Hello, world!").object;
     * const GetLength: Il2Cpp.BoundMethod<number> = object.method<number>("GetLength");
     * // There is no need to pass the object when invoking GetLength!
     * const length = GetLength.invoke(); // 13
     * ```
     * Of course, binding a static method does not make sense and may cause
     * unwanted behaviors. \
     *
     * Binding can be done manually with:
     * ```ts
     * const SystemString = Il2Cpp.corlib.class("System.String");
     * const GetLength: Il2Cpp.Method<number> = SystemString.method<number>("GetLength");
     *
     * const object: Il2Cpp.Object = Il2Cpp.string("Hello, world!").object;
     * // ＠ts-ignore
     * const GetLengthBound: Il2Cpp.BoundMethod<number> = GetLength.bind(object);
     * ```
     */
    export interface BoundMethod<T extends Il2Cpp.Method.ReturnType = Il2Cpp.Method.ReturnType> extends Method<T> {}

    let structMethodsRequireObjectInstances = (): boolean => {
        const object = Il2Cpp.corlib.class("System.Int64").alloc();
        object.field("m_value").value = 0xdeadbeef;

        // Here we check where the sentinel value is
        // if it's not where it is supposed to be, it means struct methods
        // assume they are receiving value types (that is a pointer to raw data)
        // hence, we must "skip" the object header when invoking such methods.
        const result = object.method<boolean>("Equals", 1).overload(object.class).invokeRaw(object, 0xdeadbeef);
        return (structMethodsRequireObjectInstances = () => result)();
    };

    export namespace Method {
        export type ReturnType = void | Il2Cpp.Field.Type | Il2Cpp.Reference;

        export const enum Attributes {
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

        export const enum ImplementationAttribute {
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
    }
}
