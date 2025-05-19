import { getDataPath, getIdentifier, getVersion } from './application';
import { domain } from './structs/domain';
import { inform, ok } from './utils/console';

/**
 * Dumps the application, i.e. it creates a dummy `.cs` file that contains
 * all the class, field and method declarations.
 *
 * The dump is very useful when it comes to inspecting the application as
 * you can easily search for succulent members using a simple text search,
 * hence this is typically the very first thing it should be done when
 * working with a new application. \
 * Keep in mind the dump is version, platform and arch dependentend, so
 * it has to be re-genereated if any of these changes.
 *
 * The file is generated in the **target** device, so you might need to
 * pull it to the host device afterwards.
 *
 * Dumping *may* require a file name and a directory path (a place where the
 * application can write to). If not provided, the target path is generated
 * automatically using the information from.
 *
 * ```ts
 * perform(() => {
 *     dump();
 * });
 * ```
 *
 * For instance, the dump resembles the following:
 * ```
 * class Mono.DataConverter.PackContext : System.Object
 * {
 *     System.Byte[] buffer; // 0x10
 *     System.Int32 next; // 0x18
 *     System.String description; // 0x20
 *     System.Int32 i; // 0x28
 *     Mono.DataConverter conv; // 0x30
 *     System.Int32 repeat; // 0x38
 *     System.Int32 align; // 0x3c
 *
 *     System.Void Add(System.Byte[] group); // 0x012ef4f0
 *     System.Byte[] Get(); // 0x012ef6ec
 *     System.Void .ctor(); // 0x012ef78c
 *   }
 * ```
 */
export function dump(fileName?: string, path?: string): void {
    fileName = fileName ?? `${getIdentifier() ?? 'unknown'}_${getVersion() ?? 'unknown'}.cs`;

    const destination = `${path ?? getDataPath()}/${fileName}`;
    const file = new File(destination, 'w');

    for (const assembly of domain.value.assemblies) {
        inform(`dumping ${assembly.name}...`);

        for (const klass of assembly.image.classes) {
            file.write(`${klass}\n\n`);
        }
    }

    file.flush();
    file.close();
    ok(`dump saved to ${destination}`);
}
