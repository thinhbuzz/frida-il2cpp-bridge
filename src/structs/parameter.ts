import { FieldType } from './field';
import { Reference } from './reference';
import { Type as Il2CppType } from './type';

export class Parameter {
    /** Name of this parameter. */
    readonly name: string;

    /** Position of this parameter. */
    readonly position: number;

    /** Type of this parameter. */
    readonly type: Il2CppType;

    constructor(name: string, position: number, type: Il2CppType) {
        this.name = name;
        this.position = position;
        this.type = type;
    }

    /** */
    toString(): string {
        return `${this.type.name} ${this.name}`;
    }
}

export type ParameterType = FieldType | Reference;
