import { describe, expect, it } from "vitest";
import {
  buildSeedBotCapabilities,
  canAccessSeedBotStrategy,
  performanceForWindow,
  seedBotFeeDisclosure,
  seedBotPerformanceDisclaimer,
  seedBotPerformanceWindows,
  seedBotStrategies,
  validateSeedBotFeeModel,
  validateSeedBotStrategy,
  validateSeedBotStrategyCatalog,
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

  it("discloses profit-only strategy fees as review-gated", () => {
    expect(seedBotFeeDisclosure(seedBotStrategies[0].feeModel)).toContain("Review-gated fee preview");
    expect(seedBotFeeDisclosure(seedBotStrategies[0].feeModel)).toContain(
      "success fee on realized positive strategy PnL only",
    );
    expect(seedBotFeeDisclosure(seedBotStrategies[0].feeModel)).toContain("deducted from profit not principal");
    expect(seedBotFeeDisclosure(seedBotStrategies[0].feeModel)).toContain("legal review");
  });

  it("validates SeedBot fee shares before showing fee copy", () => {
    const invalidFeeModel = {
      ...seedBotStrategies[0].feeModel,
      performanceFeeBps: 10_001,
      treasurySharePercent: 59,
    };

    expect(validateSeedBotFeeModel(seedBotStrategies[0].feeModel).valid).toBe(true);
    expect(validateSeedBotFeeModel(invalidFeeModel).blockers).toEqual([
      "SeedBot performance fee must be between 0 and 10000 bps.",
      "SeedBot dev and treasury fee shares must total 100%.",
    ]);
    expect(seedBotFeeDisclosure(invalidFeeModel)).toContain("fee preview is invalid");
  });

  it("returns selected historical performance windows for graph rendering", () => {
    const selected = performanceForWindow(seedBotStrategies[1], "180D");

    expect(selected.window).toBe("180D");
    expect(selected.returnPercent).toBe(11.9);
    expect(selected.points[selected.points.length - 1]).toBe(11.9);
  });

  it("validates the published strategy catalog before display", () => {
    expect(validateSeedBotStrategyCatalog(seedBotStrategies)).toEqual({
      valid: true,
      blockers: [],
    });
  });

  it("blocks strategy metadata with bad weights, missing windows, and route mismatches", () => {
    const invalidStrategy = {
      ...seedBotStrategies[0],
      performance: seedBotStrategies[0].performance.filter((item) => item.window !== "1Y"),
      assets: [
        { ...seedBotStrategies[0].assets[0], targetWeightPercent: 80 },
        { ...seedBotStrategies[0].assets[1], walletRoute: "METAMASK" as const, targetWeightPercent: 30 },
      ],
    };

    expect(validateSeedBotStrategy(invalidStrategy).blockers).toEqual([
      "SeedBot strategy solana-market-roots is missing 1Y performance.",
      "SeedBot strategy solana-market-roots target weights must total 100%.",
      "SeedBot strategy solana-market-roots asset RYP must use PHANTOM for SOLANA.",
      "SeedBot strategy solana-market-roots venue JUPITER does not support METAMASK.",
    ]);
  });

  it("blocks duplicate strategy ids in the catalog", () => {
    const duplicateStrategy = { ...seedBotStrategies[1], id: seedBotStrategies[0].id.toUpperCase() };

    expect(validateSeedBotStrategyCatalog([seedBotStrategies[0], duplicateStrategy]).blockers).toContain(
      "Duplicate SeedBot strategy id: SOLANA-MARKET-ROOTS.",
    );
  });
});
