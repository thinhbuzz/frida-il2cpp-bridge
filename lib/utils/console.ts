namespace Il2Cpp {
    export function raise(message: any): never {
        const error_ = new Error(message);
        // in the stack message, it is only used by V8 - qjs ignores it
        error_.name = 'Il2CppError';
        error_.stack = error_.stack
          // reset style and replace "(Il2Cpp)?Error" with custom tag
          ?.replace(/^(Il2Cpp)?Error/, 'il2cpp')
          // replace the (unhelpful) first line of the stack ("at raise ...") and
          // add style to the stack lines
          ?.replace(/\n    at (.+) \((.+):(.+)\)/, '\x1b[3m\x1b[2m')
          // reset style
          ?.concat('\x1B[0m');
        error(error_)

        throw error_;
    }

    export function error(message: any): void {
        (globalThis as any).console.error('[il2cpp error]', message);
    }

    export function warn(message: any): void {
        (globalThis as any).console.log(`[il2cpp warning]: ${message}`);
    }

}
