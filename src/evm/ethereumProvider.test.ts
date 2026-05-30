import { afterEach, describe, expect, it } from "vitest";
import { getEthereumProvider, type EthereumProvider } from "./ethereumProvider";

const originalWindow = globalThis.window;

function setTestWindow(ethereum?: EthereumProvider) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: ethereum ? { ethereum } : {},
  });
}

function provider(isMetaMask = false): EthereumProvider {
  return {
    isMetaMask,
    request: async <T = unknown>() => undefined as T,
  };
}

describe("ethereum provider detection", () => {
  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  it("returns undefined when no injected provider exists", () => {
    setTestWindow();

    expect(getEthereumProvider()).toBeUndefined();
  });

  it("prefers the MetaMask provider when multiple providers are injected", () => {
    const genericProvider = provider();
    const metaMaskProvider = provider(true);
    setTestWindow({
      ...genericProvider,
      providers: [genericProvider, metaMaskProvider],
    });

    expect(getEthereumProvider()).toBe(metaMaskProvider);
  });
});
