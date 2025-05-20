import { unityVersionIsBelow201830 } from './application';
import { fromFridaValue } from './memory';
import { module } from './module';
import { Assembly } from './structs/assembly';
import { Class } from './structs/class';
import { Domain, domain } from './structs/domain';
import { Method } from './structs/method';
import { Parameter } from './structs/parameter';
import { mainThread, Thread } from './structs/thread';
import { inform } from './utils/console';
import { cyrb53 } from './utils/hash';

export class Tracer {

    #threadId: number = mainThread.value.id;

    #verbose: boolean = false;

    #state: TracerState = {
        depth: 0,
        buffer: [],
        history: new Set(),
        flush: () => {
            if (this.#state.depth == 0) {
                const message = `\n${this.#state.buffer.join('\n')}\n`;

                if (this.#verbose) {
                    inform(message);
                } else {
                    const hash = cyrb53(message);
                    if (!this.#state.history.has(hash)) {
                        this.#state.history.add(hash);
                        inform(message);
                    }
                }

                this.#state.buffer.length = 0;
            }
        },
    };

    #applier: TracerApply;

    #targets: Method[] = [];

    #domain?: Domain;

    #assemblies?: Assembly[];

    #classes?: Class[];

    #methods?: Method[];

    #assemblyFilter?: (assembly: Assembly) => boolean;

    #classFilter?: (klass: Class) => boolean;

    #methodFilter?: (method: Method) => boolean;

    #parameterFilter?: (parameter: Parameter) => boolean;

    constructor(applier: TracerApply) {
        this.#applier = applier;
    }

    /** */
    thread(thread: Thread): Pick<Tracer, 'verbose'> & TracerChooseTargets {
        this.#threadId = thread.id;
        return this;
    }

    /** Determines whether print duplicate logs. */
    verbose(value: boolean): TracerChooseTargets {
        this.#verbose = value;
        return this;
    }

    /** Sets the application domain as the place where to find the target methods. */
    domain(): TracerFilterAssemblies {
        this.#domain = domain.value;
        return this;
    }

    /** Sets the passed `assemblies` as the place where to find the target methods. */
    assemblies(...assemblies: Assembly[]): TracerFilterClasses {
        this.#assemblies = assemblies;
        return this;
    }

    /** Sets the passed `classes` as the place where to find the target methods. */
    classes(...classes: Class[]): TracerFilterMethods {
        this.#classes = classes;
        return this;
    }

    /** Sets the passed `methods` as the target methods. */
    methods(...methods: Method[]): TracerFilterParameters {
        this.#methods = methods;
        return this;
    }

    /** Filters the assemblies where to find the target methods. */
    filterAssemblies(filter: (assembly: Assembly) => boolean): TracerFilterClasses {
        this.#assemblyFilter = filter;
        return this;
    }

    /** Filters the classes where to find the target methods. */
    filterClasses(filter: (klass: Class) => boolean): TracerFilterMethods {
        this.#classFilter = filter;
        return this;
    }

    /** Filters the target methods. */
    filterMethods(filter: (method: Method) => boolean): TracerFilterParameters {
        this.#methodFilter = filter;
        return this;
    }

    /** Filters the target methods. */
    filterParameters(filter: (parameter: Parameter) => boolean): Pick<Tracer, 'and'> {
        this.#parameterFilter = filter;
        return this;
    }

    /** Commits the current changes by finding the target methods. */
    and(): TracerChooseTargets & Pick<Tracer, 'attach'> {
        const filterMethod = (method: Method): void => {
            if (this.#parameterFilter == undefined) {
                this.#targets.push(method);
                return;
            }

            for (const parameter of method.parameters) {
                if (this.#parameterFilter(parameter)) {
                    this.#targets.push(method);
                    break;
                }
            }
        };

        const filterMethods = (values: Iterable<Method>): void => {
            for (const method of values) {
                filterMethod(method);
            }
        };

        const filterClass = (klass: Class): void => {
            if (this.#methodFilter == undefined) {
                filterMethods(klass.methods);
                return;
            }

            for (const method of klass.methods) {
                if (this.#methodFilter(method)) {
                    filterMethod(method);
                }
            }
        };

        const filterClasses = (values: Iterable<Class>): void => {
            for (const klass of values) {
                filterClass(klass);
            }
        };

        const filterAssembly = (assembly: Assembly): void => {
            if (this.#classFilter == undefined) {
                filterClasses(assembly.image.classes);
                return;
            }

            for (const klass of assembly.image.classes) {
                if (this.#classFilter(klass)) {
                    filterClass(klass);
                }
            }
        };

        const filterAssemblies = (assemblies: Iterable<Assembly>): void => {
            for (const assembly of assemblies) {
                filterAssembly(assembly);
            }
        };

        const filterDomain = (domain: Domain): void => {
            if (this.#assemblyFilter == undefined) {
                filterAssemblies(domain.assemblies);
                return;
            }

            for (const assembly of domain.assemblies) {
                if (this.#assemblyFilter(assembly)) {
                    filterAssembly(assembly);
                }
            }
        };

        this.#methods
            ? filterMethods(this.#methods)
            : this.#classes
                ? filterClasses(this.#classes)
                : this.#assemblies
                    ? filterAssemblies(this.#assemblies)
                    : this.#domain
                        ? filterDomain(this.#domain)
                        : undefined;

        this.#assemblies = undefined;
        this.#classes = undefined;
        this.#methods = undefined;
        this.#assemblyFilter = undefined;
        this.#classFilter = undefined;
        this.#methodFilter = undefined;
        this.#parameterFilter = undefined;

        return this;
    }

    /** Starts tracing. */
    attach(): void {
        for (const target of this.#targets) {
            if (!target.virtualAddress.isNull()) {
                try {
                    this.#applier(target, this.#state, this.#threadId);
                } catch (e: any) {
                    switch (e.message) {
                        case /unable to intercept function at \w+; please file a bug/.exec(e.message)?.input:
                        case 'already replaced this function':
                            break;
                        default:
                            throw e;
                    }
                }
            }
        }
    }
}

export type TracerConfigure = Pick<Tracer, 'thread' | 'verbose'> & TracerChooseTargets;

export type TracerChooseTargets = Pick<Tracer, 'domain' | 'assemblies' | 'classes' | 'methods'>;

export type TracerFilterAssemblies = TracerFilterClasses & Pick<Tracer, 'filterAssemblies'>;

export type TracerFilterClasses = TracerFilterMethods & Pick<Tracer, 'filterClasses'>;

export type TracerFilterMethods = TracerFilterParameters & Pick<Tracer, 'filterMethods'>;

export type TracerFilterParameters = Pick<Tracer, 'and'> & Pick<Tracer, 'filterParameters'>;

export interface TracerState {
    depth: number;
    buffer: string[];
    history: Set<number>;
    flush: () => void;
}

export type TracerApply = (method: Method, state: TracerState, threadId: number) => void;

/** */
export function trace(parameters: boolean = false): TracerConfigure {
    const applier = (): TracerApply => (method, state, threadId) => {
        const paddedVirtualAddress = method.relativeVirtualAddress.toString(16).padStart(8, '0');

        Interceptor.attach(method.virtualAddress, {
            onEnter() {
                if (this.threadId == threadId) {
                    // prettier-ignore
                    state.buffer.push(`\x1b[2m0x${paddedVirtualAddress}\x1b[0m ${`│ `.repeat(state.depth++)}┌─\x1b[35m${method.class.type.name}::\x1b[1m${method.name}\x1b[0m\x1b[0m`);
                }
            },
            onLeave() {
                if (this.threadId == threadId) {
                    // prettier-ignore
                    state.buffer.push(`\x1b[2m0x${paddedVirtualAddress}\x1b[0m ${`│ `.repeat(--state.depth)}└─\x1b[33m${method.class.type.name}::\x1b[1m${method.name}\x1b[0m\x1b[0m`);
                    state.flush();
                }
            },
        });
    };

    const applierWithParameters = (): TracerApply => (method, state, threadId) => {
        const paddedVirtualAddress = method.relativeVirtualAddress.toString(16).padStart(8, '0');

        const startIndex = +!method.isStatic | +unityVersionIsBelow201830;

        const callback = function (this: CallbackContext | InvocationContext, ...args: any[]) {
            if ((this as InvocationContext).threadId == threadId) {
                const thisParameter = method.isStatic ? undefined : new Parameter('this', -1, method.class.type);
                const parameters = thisParameter ? [thisParameter].concat(method.parameters) : method.parameters;

                // prettier-ignore
                state.buffer.push(`\x1b[2m0x${paddedVirtualAddress}\x1b[0m ${`│ `.repeat(state.depth++)}┌─\x1b[35m${method.class.type.name}::\x1b[1m${method.name}\x1b[0m\x1b[0m(${parameters.map(
                    e => `\x1b[32m${e.name}\x1b[0m = \x1b[31m${fromFridaValue(args[e.position + startIndex], e.type)}\x1b[0m`).join(', ')})`);
            }

            const returnValue = method.nativeFunction(...args);

            if ((this as InvocationContext).threadId == threadId) {
                // prettier-ignore
                state.buffer.push(`\x1b[2m0x${paddedVirtualAddress}\x1b[0m ${`│ `.repeat(--state.depth)}└─\x1b[33m${method.class.type.name}::\x1b[1m${method.name}\x1b[0m\x1b[0m${returnValue == undefined ? '' : ` = \x1b[36m${fromFridaValue(
                    returnValue,
                    method.returnType,
                )}`}\x1b[0m`);
                state.flush();
            }

            return returnValue;
        };

        method.revert();
        const nativeCallback = new NativeCallback(callback, method.returnType.fridaAlias, method.fridaSignature);
        Interceptor.replace(method.virtualAddress, nativeCallback);
    };

    return new Tracer(parameters ? applierWithParameters() : applier());
}

/** */
export function backtrace(mode?: Backtracer): TracerConfigure {
    const methods = domain.value.assemblies
        .flatMap(_ => _.image.classes.flatMap(_ => _.methods.filter(_ => !_.virtualAddress.isNull())))
        .sort((_, __) => _.virtualAddress.compare(__.virtualAddress));

    const searchInsert = (target: NativePointer): Method => {
        let left = 0;
        let right = methods.length - 1;

        while (left <= right) {
            const pivot = Math.floor((left + right) / 2);
            const comparison = methods[pivot].virtualAddress.compare(target);

            if (comparison == 0) {
                return methods[pivot];
            } else if (comparison > 0) {
                right = pivot - 1;
            } else {
                left = pivot + 1;
            }
        }
        return methods[right];
    };

    const applier = (): TracerApply => (method, state, threadId) => {
        Interceptor.attach(method.virtualAddress, function () {
            if (this.threadId == threadId) {
                const handles = globalThis.Thread.backtrace(this.context, mode);
                handles.unshift(method.virtualAddress);

                for (const handle of handles) {
                    if (handle.compare(module.value.base) > 0 && handle.compare(module.value.base.add(module.value.size)) < 0) {
                        const method = searchInsert(handle);

                        if (method) {
                            const offset = handle.sub(method.virtualAddress);

                            if (offset.compare(0xfff) < 0) {
                                // prettier-ignore
                                state.buffer.push(`\x1b[2m0x${method.relativeVirtualAddress.toString(16).padStart(
                                    8,
                                    '0',
                                )}\x1b[0m\x1b[2m+0x${offset.toString(16).padStart(
                                    3,
                                    `0`,
                                )}\x1b[0m ${method.class.type.name}::\x1b[1m${method.name}\x1b[0m`);
                            }
                        }
                    }
                }

                state.flush();
            }
        });
    };

    return new Tracer(applier());
}
