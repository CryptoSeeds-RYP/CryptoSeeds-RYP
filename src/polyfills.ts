import { Buffer as BufferPolyfill } from "buffer";

const globalScope = globalThis as typeof globalThis & {
  Buffer?: typeof BufferPolyfill;
};

if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = BufferPolyfill;
}
