import { describe, expect, it } from "vitest";
import { evmChainLabel, shortEvmAddress } from "./useMetaMaskWallet";

describe("MetaMask wallet formatting", () => {
  it("formats EVM addresses for compact wallet controls", () => {
    expect(shortEvmAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234...5678");
  });

  it("labels common EVM chain ids", () => {
    expect(evmChainLabel()).toBe("EVM");
    expect(evmChainLabel("0x1")).toBe("Ethereum");
    expect(evmChainLabel("0x2105")).toBe("Base");
    expect(evmChainLabel("0x66eed")).toBe("EVM 421613");
  });
});
