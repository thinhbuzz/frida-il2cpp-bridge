import { Class } from './structs/class';
import { Object } from './structs/object';
import { Type } from './structs/type';

/**
 * Creates a filter to include elements whose type can be assigned to a
 * variable of the given class. \
 * It relies on {@link Class.isAssignableFrom}.
 *
 * ```ts
 * const IComparable = corlib.class("System.IComparable");
 *
 * const objects = [
 *     corlib.class("System.Object").new(),
 *     corlib.class("System.String").new()
 * ];
 *
 * const comparables = objects.filter(is(IComparable));
 * ```
 */
export function is<T extends Class | Object | Type>(klass: Class): (element: T) => boolean {
    return (element: T): boolean => {
        if (element instanceof Class) {
            return klass.isAssignableFrom(element);
        } else {
            return klass.isAssignableFrom(element.class);
        }
    };
}

/**
 * Creates a filter to include elements whose type can be corresponds to
 * the given class. \
 * It compares the native handle of the element classes.
 *
 * ```ts
 * const String = corlib.class("System.String");
 *
 * const objects = [
 *     corlib.class("System.Object").new(),
 *     corlib.class("System.String").new()
 * ];
 *
 * const strings = objects.filter(isExactly(String));
 * ```
 */
export function isExactly<T extends Class | Object | Type>(klass: Class): (element: T) => boolean {
    return (element: T): boolean => {
        if (element instanceof Class) {
            return element.equals(klass);
        } else {
            return element.class.equals(klass);
        }
    };
}
