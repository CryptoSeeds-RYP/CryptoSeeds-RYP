import { describe, expect, it } from "vitest";
import {
  buildSeedBotCapabilities,
  canAccessSeedBotStrategy,
  seedBotFeeDisclosure,
  seedBotPerformanceDisclaimer,
  seedBotStrategies,
} from "./seedbot";

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

  it("uses historical performance windows instead of projected ROI", () => {
    expect(seedBotStrategies[0].performance.map((item) => item.window)).toEqual(["7D", "30D", "90D", "180D", "1Y"]);
    expect(seedBotPerformanceDisclaimer).toBe("Past performance does not guarantee future results.");
  });

  it("uses RYP holdings to unlock the public strategy collection", () => {
    expect(
      canAccessSeedBotStrategy({
        walletConnected: true,
        stakingTier: "NONE",
        rypBalance: 1,
        strategy: seedBotStrategies[0],
      }),
    ).toBe(true);
    expect(
      canAccessSeedBotStrategy({
        walletConnected: true,
        stakingTier: "NONE",
        rypBalance: 0,
        strategy: seedBotStrategies[0],
      }),
    ).toBe(false);
  });

  it("discloses performance fees as profit-only", () => {
    expect(seedBotFeeDisclosure(seedBotStrategies[0].feeModel)).toContain(
      "performance fee on realized positive strategy PnL only",
    );
    expect(seedBotFeeDisclosure(seedBotStrategies[0].feeModel)).toContain("deducted from profit not principal");
  });
});
