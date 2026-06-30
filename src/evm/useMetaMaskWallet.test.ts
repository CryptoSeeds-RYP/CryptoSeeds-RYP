import { describe, expect, it } from "vitest";
import { evmChainLabel, isLikelyEvmAddress, normalizeEvmAccounts, shortEvmAddress } from "./useMetaMaskWallet";

describe("MetaMask wallet formatting", () => {
  it("formats EVM addresses for compact wallet controls", () => {
    expect(shortEvmAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234...5678");
    expect(shortEvmAddress("not-a-wallet")).toBe("");
  });

  it("labels common EVM chain ids", () => {
    expect(evmChainLabel()).toBe("EVM");
    expect(evmChainLabel("0x1")).toBe("Ethereum");
    expect(evmChainLabel("0x2105")).toBe("Base");
    expect(evmChainLabel("0x66eed")).toBe("EVM 421613");
  });

  it("normalizes injected account responses before showing a connected MetaMask route", () => {
    expect(
      normalizeEvmAccounts([
        " 0x1234567890abcdef1234567890abcdef12345678 ",
        "not-a-wallet",
        123,
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      ]),
    ).toEqual([
      "0x1234567890abcdef1234567890abcdef12345678",
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    ]);
    expect(normalizeEvmAccounts("0x1234567890abcdef1234567890abcdef12345678")).toEqual([]);
  });

  it("checks EVM address shape without accepting short or non-hex values", () => {
    expect(isLikelyEvmAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe(true);
    expect(isLikelyEvmAddress("0x1234")).toBe(false);
    expect(isLikelyEvmAddress("0x1234567890abcdef1234567890abcdef1234567z")).toBe(false);
  });
});
