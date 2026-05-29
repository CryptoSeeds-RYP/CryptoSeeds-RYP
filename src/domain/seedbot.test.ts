import { describe, expect, it } from "vitest";
import { buildSeedBotCapabilities } from "./seedbot";

describe("seedbot capabilities", () => {
  it("keeps disconnected users in read-only demo access", () => {
    const capabilities = buildSeedBotCapabilities({ walletConnected: false, stakingTier: "FRUIT" });

    expect(capabilities.find((item) => item.id === "demo-terminal")?.enabled).toBe(true);
    expect(capabilities.find((item) => item.id === "signal-only")?.enabled).toBe(false);
    expect(capabilities.find((item) => item.id === "wallet-approved-swaps")?.enabled).toBe(false);
  });

  it("unlocks wallet-approved tools from Sprout without enabling automation", () => {
    const capabilities = buildSeedBotCapabilities({ walletConnected: true, stakingTier: "SPROUT" });

    expect(capabilities.find((item) => item.id === "signal-only")?.enabled).toBe(true);
    expect(capabilities.find((item) => item.id === "wallet-approved-swaps")?.enabled).toBe(true);
    expect(capabilities.find((item) => item.id === "strategy-templates")?.enabled).toBe(false);
    expect(capabilities.find((item) => item.id === "guarded-automation")?.enabled).toBe(false);
  });
});
