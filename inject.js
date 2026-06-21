"use strict";

const TARGET_LIB = "libqdbi_test_damo.so";
const TRACE_SO_PATH = "/data/user/0/com.grand.qdbi_test_damo/libnativelib.so";

let injected = false;

function findExport(name) {
  if (typeof Module.findGlobalExportByName === "function") {
    return Module.findGlobalExportByName(name);
  }

  if (typeof Module.getGlobalExportByName === "function") {
    try {
      return Module.getGlobalExportByName(name);
    } catch (_) {
      return null;
    }
  }

  if (typeof Module.findExportByName === "function") {
    return Module.findExportByName(null, name);
  }

  for (const module of Process.enumerateModules()) {
    if (typeof module.findExportByName === "function") {
      const ptr = module.findExportByName(name);
      if (ptr !== null) {
        return ptr;
      }
    }

    if (typeof module.getExportByName === "function") {
      try {
        return module.getExportByName(name);
      } catch (_) {
      }
    }
  }

  return null;
}

function matchesTarget(soname) {
  if (soname === null) {
    return false;
  }

  const basename = soname.split("/").pop();
  return basename === TARGET_LIB;
}

function readCString(ptr) {
  if (ptr.isNull()) {
    return null;
  }

  try {
    return ptr.readCString();
  } catch (_) {
    return null;
  }
}

function attachDlopenHook(name) {
  const ptr = findExport(name);
  if (ptr === null) {
    console.log("skip hook, export not found: " + name);
    return false;
  }

  Interceptor.attach(ptr, {
    onEnter(args) {
      this.soname = readCString(args[0]);
      this.needInject = matchesTarget(this.soname);
      if (this.needInject) {
        console.log("matched " + name + ": " + this.soname);
      }
    },
    onLeave(retval) {
      if (this.needInject && !retval.isNull()) {
        inject();
      }
    }
  });

  console.log("hooked " + name + " @ " + ptr);
  return true;
}

function inject() {
  if (injected) {
    return;
  }

  const dlopenPtr = findExport("dlopen");
  if (dlopenPtr === null) {
    console.log("inject failed, dlopen export not found");
    return;
  }

  injected = true;
  const dlopen = new NativeFunction(dlopenPtr, "pointer", ["pointer", "int"]);
  const soPathPtr = Memory.allocUtf8String(TRACE_SO_PATH);
  const handle = dlopen(soPathPtr, 2);

  console.log("inject " + TRACE_SO_PATH + ", handle=" + handle);
  if (handle.isNull()) {
    const dlerrorPtr = findExport("dlerror");
    if (dlerrorPtr !== null) {
      const dlerror = new NativeFunction(dlerrorPtr, "pointer", []);
      const error = dlerror();
      if (!error.isNull()) {
        console.log("dlerror: " + error.readCString());
      }
    }
    injected = false;
  }
}

function injectIfAlreadyLoaded() {
  for (const module of Process.enumerateModules()) {
    const path = module.path || module.name;
    if (matchesTarget(path)) {
      console.log("target already loaded: " + path);
      inject();
      return;
    }
  }
}

function hookLoadLibrary() {
  const hooked = [
    "__loader_dlopen",
    "android_dlopen_ext",
    "dlopen"
  ].map(attachDlopenHook).some(Boolean);

  if (!hooked) {
    console.log("no dlopen-style export found");
  }

  injectIfAlreadyLoaded();
}

function attachInject() {
  inject();
}

setImmediate(hookLoadLibrary);
