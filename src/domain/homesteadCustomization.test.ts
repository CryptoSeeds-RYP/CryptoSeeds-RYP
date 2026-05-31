import { describe, expect, it } from "vitest";
import { homesteadCustomizationCapacity, homesteadProfileForTier, homesteadProfiles } from "./homesteadCustomization";

describe("homestead customization", () => {
  it("scales homestead size and customization capacity by staking tier", () => {
    expect(homesteadProfileForTier("NONE").estateScale).toBeLessThan(homesteadProfileForTier("SEED").estateScale);
    expect(homesteadProfileForTier("SEED").estateScale).toBeLessThan(homesteadProfileForTier("SPROUT").estateScale);
    expect(homesteadProfileForTier("SPROUT").estateScale).toBeLessThan(homesteadProfileForTier("SAPLING").estateScale);
    expect(homesteadProfileForTier("SAPLING").estateScale).toBeLessThan(homesteadProfileForTier("TREE").estateScale);
    expect(homesteadProfileForTier("TREE").estateScale).toBeLessThan(homesteadProfileForTier("FRUIT").estateScale);

    expect(homesteadCustomizationCapacity("FRUIT").totalSlots).toBeGreaterThan(
      homesteadCustomizationCapacity("SEED").totalSlots,
    );
  });

  it("keeps Seed meaningful while making Fruit visibly premium", () => {
    expect(homesteadProfiles.SEED.projectSlots).toBe(2);
    expect(homesteadProfiles.SEED.decorationSlots).toBeGreaterThan(0);
    expect(homesteadProfiles.FRUIT.projectSlots).toBe(8);
    expect(homesteadProfiles.FRUIT.rareCosmeticSlots).toBeGreaterThan(homesteadProfiles.SEED.rareCosmeticSlots);
  });
});

