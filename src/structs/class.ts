import {
    classForEach,
    classFromObject,
    classGetArrayClass,
    classGetArrayElementSize,
    classGetAssemblyName,
    classGetBaseType,
    classGetDeclaringType,
    classGetElementClass,
    classGetFieldFromName,
    classGetFields,
    classGetFlags,
    classGetImage,
    classGetInstanceSize,
    classGetInterfaces,
    classGetMethodFromName,
    classGetMethods,
    classGetName,
    classGetNamespace,
    classGetNestedClasses,
    classGetParent,
    classGetStaticFieldData,
    classGetType,
    classGetValueTypeSize,
    classHasReferences,
    classInitialize,
    classIsAbstract,
    classIsAssignableFrom,
    classIsBlittable,
    classIsEnum,
    classIsGeneric,
    classIsInflated,
    classIsInterface,
    classIsSubclassOf,
    classIsValueType,
    objectInitialize,
    objectNew,
} from '../api';
import { raise } from '../utils/console';
import { getter } from '../utils/getter';
import { lazy } from '../utils/lazy';
import { NativeStruct } from '../utils/native-struct';
import { offsetOf } from '../utils/offset-of';
import { readNativeIterator } from '../utils/read-native-iterator';
import { recycle } from '../utils/recycle';
import { array, Il2CppArray } from './array';
import { Field, FieldType } from './field';
import { corlib, Image } from './image';
import { Method, MethodReturnType } from './method';
import { Il2CppObject } from './object';
import { Type } from './type';

@recycle
export class Class extends NativeStruct {
    /** Available in implementation block. */
    currentMethod?: Method;

    /** Gets the actual size of the instance of the current class. */
    get actualInstanceSize(): number {
        const SystemString = corlib.value.class('System.String');

        // prettier-ignore
        const offset = offsetOf(SystemString.handle, _ => _.readInt() == SystemString.instanceSize - 2)
            ?? raise('couldn\'t find the actual instance size offset in the native class struct');

        // prettier-ignore
        getter(Class.prototype, 'actualInstanceSize', function (this: Class) {
            return this.handle.add(offset).readS32();
        }, lazy);

        return this.actualInstanceSize;
    }

    /** Gets the array class which encompass the current class. */
    @lazy
    get arrayClass(): Class {
        return new Class(classGetArrayClass.value(this, 1));
    }

    /** Gets the size of the object encompassed by the current array class. */
    @lazy
    get arrayElementSize(): number {
        return classGetArrayElementSize.value(this);
    }

    /** Gets the name of the assembly in which the current class is defined. */
    @lazy
    get assemblyName(): string {
        return classGetAssemblyName.value(this).readUtf8String()!.replace('.dll', '');
    }

    /** Gets the class that declares the current nested class. */
    @lazy
    get declaringClass(): Class | null {
        return new Class(classGetDeclaringType.value(this)).asNullable();
    }

    /** Gets the encompassed type of this array, reference, pointer or enum type. */
    @lazy
    get baseType(): Type | null {
        return new Type(classGetBaseType.value(this)).asNullable();
    }

    /** Gets the class of the object encompassed or referred to by the current array, pointer or reference class. */
    @lazy
    get elementClass(): Class | null {
        return new Class(classGetElementClass.value(this)).asNullable();
    }

    /** Gets the fields of the current class. */
    @lazy
    get fields(): Field[] {
        return readNativeIterator(_ => classGetFields.value(this, _)).map(_ => new Field(_));
    }

    /** Gets the flags of the current class. */
    @lazy
    get flags(): number {
        return classGetFlags.value(this);
    }

    /** Gets the full name (namespace + name) of the current class. */
    @lazy
    get fullName(): string {
        return this.namespace ? `${this.namespace}.${this.name}` : this.name;
    }

    /** Gets the generics parameters of this generic class. */
    @lazy
    get generics(): Class[] {
        if (!this.isGeneric && !this.isInflated) {
            return [];
        }
        const types = this.type.object.method<Il2CppArray<Il2CppObject>>('GetGenericArguments').invoke();
        return globalThis.Array.from(types).map(_ => new Class(classFromObject.value(_)));
    }

    /** Determines whether the GC has tracking references to the current class instances. */
    @lazy
    get hasReferences(): boolean {
        return !!classHasReferences.value(this);
    }

    /** Determines whether ther current class has a valid static constructor. */
    @lazy
    get hasStaticConstructor(): boolean {
        const staticConstructor = this.tryMethod('.cctor');
        return staticConstructor != null && !staticConstructor.virtualAddress.isNull();
    }

    /** Gets the image in which the current class is defined. */
    @lazy
    get image(): Image {
        return new Image(classGetImage.value(this));
    }

    /** Gets the size of the instance of the current class. */
    @lazy
    get instanceSize(): number {
        return classGetInstanceSize.value(this);
    }

    /** Determines whether the current class is abstract. */
    @lazy
    get isAbstract(): boolean {
        return !!classIsAbstract.value(this);
    }

    /** Determines whether the current class is blittable. */
    @lazy
    get isBlittable(): boolean {
        return !!classIsBlittable.value(this);
    }

    /** Determines whether the current class is an enumeration. */
    @lazy
    get isEnum(): boolean {
        return !!classIsEnum.value(this);
    }

    /** Determines whether the current class is a generic one. */
    @lazy
    get isGeneric(): boolean {
        return !!classIsGeneric.value(this);
    }

    /** Determines whether the current class is inflated. */
    @lazy
    get isInflated(): boolean {
        return !!classIsInflated.value(this);
    }

    /** Determines whether the current class is an interface. */
    @lazy
    get isInterface(): boolean {
        return !!classIsInterface.value(this);
    }

    /** Determines whether the current class is a struct. */
    get isStruct(): boolean {
        return this.isValueType && !this.isEnum;
    }

    /** Determines whether the current class is a value type. */
    @lazy
    get isValueType(): boolean {
        return !!classIsValueType.value(this);
    }

    /** Gets the interfaces implemented or inherited by the current class. */
    @lazy
    get interfaces(): Class[] {
        return readNativeIterator(_ => classGetInterfaces.value(this, _)).map(_ => new Class(_));
    }

    /** Gets the methods implemented by the current class. */
    @lazy
    get methods(): Method[] {
        return readNativeIterator(_ => classGetMethods.value(this, _)).map(_ => new Method(_));
    }

    /** Gets the name of the current class. */
    @lazy
    get name(): string {
        return classGetName.value(this).readUtf8String()!;
    }

    /** Gets the namespace of the current class. */
    @lazy
    get namespace(): string {
        return classGetNamespace.value(this).readUtf8String()!;
    }

    /** Gets the classes nested inside the current class. */
    @lazy
    get nestedClasses(): Class[] {
        return readNativeIterator(_ => classGetNestedClasses.value(this, _)).map(_ => new Class(_));
    }

    /** Gets the class from which the current class directly inherits. */
    @lazy
    get parent(): Class | null {
        return new Class(classGetParent.value(this)).asNullable();
    }

    /** Gets the rank (number of dimensions) of the current array class. */
    @lazy
    get rank(): number {
        let rank = 0;
        const name = this.name;

        for (let i = this.name.length - 1; i > 0; i--) {
            const c = name[i];

            if (c == ']') rank++;
            else if (c == '[' || rank == 0) break;
            else if (c == ',') rank++;
            else break;
        }

        return rank;
    }

    /** Gets a pointer to the static fields of the current class. */
    @lazy
    get staticFieldsData(): NativePointer {
        return classGetStaticFieldData.value(this);
    }

    /** Gets the size of the instance - as a value type - of the current class. */
    @lazy
    get valueTypeSize(): number {
        return classGetValueTypeSize.value(this, NULL);
    }

    /** Gets the type of the current class. */
    @lazy
    get type(): Type {
        return new Type(classGetType.value(this));
    }

    /** Executes a callback for every defined class. */
    static enumerate(block: (klass: Class) => void): void {
        const callback = new NativeCallback(_ => block(new Class(_)), 'void', ['pointer', 'pointer']);
        return classForEach.value(callback, NULL);
    }

    /** Allocates a new object of the current class. */
    alloc(): Il2CppObject {
        return new Il2CppObject(objectNew.value(this));
    }

    /** Gets the field identified by the given name. */
    field<T extends FieldType>(name: string): Field<T> {
        return this.tryField<T>(name) ?? raise(`couldn't find field ${name} in class ${this.type.name}`);
    }

    /** Builds a generic instance of the current generic class. */
    inflate(...classes: Class[]): Class {
        if (!this.isGeneric) {
            raise(`cannot inflate class ${this.type.name} as it has no generic parameters`);
        }
        if (this.generics.length != classes.length) {
            raise(`cannot inflate class ${this.type.name} as it needs ${this.generics.length} generic parameter(s), not ${classes.length}`);
        }
        const types = classes.map(_ => _.type.object);
        const typeArray = array(corlib.value.class('System.Type'), types);
        const inflatedType = this.type.object.method<Il2CppObject>('MakeGenericType', 1).invoke(typeArray);
        return new Class(classFromObject.value(inflatedType));
    }

    /** Calls the static constructor of the current class. */
    initialize(): Class {
        classInitialize.value(this);
        return this;
    }

    /** Determines whether an instance of `other` class can be assigned to a variable of the current type. */
    isAssignableFrom(other: Class): boolean {
        return !!classIsAssignableFrom.value(this, other);
    }

    /** Determines whether the current class derives from `other` class. */
    isSubclassOf(other: Class, checkInterfaces: boolean): boolean {
        return !!classIsSubclassOf.value(this, other, +checkInterfaces);
    }

    /** Gets the method identified by the given name and parameter count. */
    method<T extends MethodReturnType>(name: string, parameterCount: number = -1): Method<T> {
        return this.tryMethod<T>(
            name,
            parameterCount,
        ) ?? raise(`couldn't find method ${name} in class ${this.type.name}`);
    }

    /** Gets the nested class with the given name. */
    nested(name: string): Class {
        return this.tryNested(name) ?? raise(`couldn't find nested class ${name} in class ${this.type.name}`);
    }

    /** Allocates a new object of the current class and calls its default constructor. */
    new(): Il2CppObject {
        const object = this.alloc();

        const exceptionArray = Memory.alloc(Process.pointerSize);

        objectInitialize.value(object, exceptionArray);

        const exception = exceptionArray.readPointer();

        if (!exception.isNull()) {
            raise(new Il2CppObject(exception).toString());
        }

        return object;
    }

    /** Gets the field with the given name. */
    tryField<T extends FieldType>(name: string): Field<T> | null {
        return new Field<T>(classGetFieldFromName.value(this, Memory.allocUtf8String(name))).asNullable();
    }

    /** Gets the method with the given name and parameter count. */
    tryMethod<T extends MethodReturnType>(name: string, parameterCount: number = -1): Method<T> | null {
        return new Method<T>(classGetMethodFromName.value(
            this,
            Memory.allocUtf8String(name),
            parameterCount,
        )).asNullable();
    }

    /** Gets the nested class with the given name. */
    tryNested(name: string): Class | undefined {
        return this.nestedClasses.find(_ => _.name == name);
    }

    /** */
    toString(): string {
        const inherited = [this.parent].concat(this.interfaces);

        return `\
// ${this.assemblyName}
${this.isEnum ? `enum` : this.isStruct ? `struct` : this.isInterface ? `interface` : `class`} \
${this.type.name}\
${inherited ? ` : ${inherited.map(_ => _?.type.name).join(`, `)}` : ``}
{
    ${this.fields.join(`\n    `)}
    ${this.methods.join(`\n    `)}
}`;
    }
}
