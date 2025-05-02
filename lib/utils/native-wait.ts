namespace Il2Cpp {
  export function forModule(moduleName: string): Promise<Module> {
    const module = Process.findModuleByName(moduleName);
    if (module !== null) {
      return Promise.resolve(module);
    }

    return new Promise<Module>(resolve => {
      const intervalPointer = setInterval(function () {
        const module = Process.findModuleByName(moduleName);
        if (module !== null) {
          clearInterval(intervalPointer);
          resolve(module);
          return;
        }
      }, 100);
    });
  }
}
