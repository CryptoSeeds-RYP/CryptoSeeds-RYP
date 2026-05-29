import { describe, expect, it } from "vitest";
import {
  buildSeedBotCapabilities,
  canAccessSeedBotStrategy,
  performanceForWindow,
  seedBotFeeDisclosure,
  seedBotPerformanceDisclaimer,
  seedBotPerformanceWindows,
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
    expect(seedBotStrategies[0].performance.map((item) => item.window)).toEqual(seedBotPerformanceWindows);
    expect(seedBotStrategies[0].performance.every((item) => item.points.length >= 6)).toBe(true);
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

  it("returns selected historical performance windows for graph rendering", () => {
    const selected = performanceForWindow(seedBotStrategies[1], "180D");

    expect(selected.window).toBe("180D");
    expect(selected.returnPercent).toBe(11.9);
    expect(selected.points[selected.points.length - 1]).toBe(11.9);
  });
});
