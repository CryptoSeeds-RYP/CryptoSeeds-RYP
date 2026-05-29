import { describe, expect, it } from "vitest";
import { canAccess, effectiveFee, projectSlotsForTier, tierFromAmount, tierRequirements } from "./tiering";

describe("tiering", () => {
  it("maps RYP amounts to the correct staking tier", () => {
    expect(tierFromAmount(0)).toBe("NONE");
    expect(tierFromAmount(tierRequirements.SEED)).toBe("SEED");
    expect(tierFromAmount(tierRequirements.SPROUT)).toBe("SPROUT");
    expect(tierFromAmount(tierRequirements.SAPLING)).toBe("SAPLING");
    expect(tierFromAmount(tierRequirements.TREE)).toBe("TREE");
    expect(tierFromAmount(tierRequirements.FRUIT)).toBe("FRUIT");
  });

  it("keeps project access tier-gated", () => {
    expect(canAccess("SEED", "SEED")).toBe(true);
    expect(canAccess("SPROUT", "SEED")).toBe(false);
    expect(canAccess("SPROUT", "TREE")).toBe(true);
  });

  it("calculates effective fee reductions by tier", () => {
    expect(effectiveFee("SEED")).toBe("3.5%");
    expect(effectiveFee("SPROUT")).toBe("3.15%");
    expect(effectiveFee("SAPLING")).toBe("2.8%");
    expect(effectiveFee("TREE")).toBe("2.45%");
    expect(effectiveFee("FRUIT")).toBe("2.1%");
  });

  it("maps staking tier to project slots", () => {
    expect(projectSlotsForTier("NONE")).toBe(0);
    expect(projectSlotsForTier("SEED")).toBe(2);
    expect(projectSlotsForTier("SPROUT")).toBe(3);
    expect(projectSlotsForTier("SAPLING")).toBe(4);
    expect(projectSlotsForTier("TREE")).toBe(6);
    expect(projectSlotsForTier("FRUIT")).toBe(8);
  });
});

