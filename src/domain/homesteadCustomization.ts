import type { StakingTier } from "./microverse";

export type HomesteadProfile = {
  tier: StakingTier;
  name: string;
  estateScale: number;
  projectSlots: number;
  buildingSlots: number;
  decorationSlots: number;
  pathSlots: number;
  rareCosmeticSlots: number;
  visualIdentity: string;
  customizationMood: string;
};

export const homesteadProfiles: Record<StakingTier, HomesteadProfile> = {
  NONE: {
    tier: "NONE",
    name: "Wild Fields",
    estateScale: 0.65,
    projectSlots: 0,
    buildingSlots: 0,
    decorationSlots: 0,
    pathSlots: 0,
    rareCosmeticSlots: 0,
    visualIdentity: "Untouched land, distant structures, locked project plots",
    customizationMood: "Aspirational preview before the first RYP stake",
  },
  SEED: {
    tier: "SEED",
    name: "Seed Homestead",
    estateScale: 1,
    projectSlots: 2,
    buildingSlots: 2,
    decorationSlots: 6,
    pathSlots: 4,
    rareCosmeticSlots: 0,
    visualIdentity: "Small active plot, warm cottage light, first cultivated paths",
    customizationMood: "Starter RPG base with meaningful access and early identity",
  },
  SPROUT: {
    tier: "SPROUT",
    name: "Sprout Holding",
    estateScale: 1.28,
    projectSlots: 3,
    buildingSlots: 3,
    decorationSlots: 10,
    pathSlots: 6,
    rareCosmeticSlots: 1,
    visualIdentity: "Expanded fields, workers, small workshops, clearer project zones",
    customizationMood: "Growing village base with more cosmetic expression",
  },
  SAPLING: {
    tier: "SAPLING",
    name: "Sapling Estate",
    estateScale: 1.62,
    projectSlots: 4,
    buildingSlots: 5,
    decorationSlots: 16,
    pathSlots: 9,
    rareCosmeticSlots: 2,
    visualIdentity: "Richer estate, greenhouse structures, layered project gardens",
    customizationMood: "Hero-grade estate with visible strategy and stewardship identity",
  },
  TREE: {
    tier: "TREE",
    name: "Tree Domain",
    estateScale: 2.05,
    projectSlots: 6,
    buildingSlots: 7,
    decorationSlots: 24,
    pathSlots: 12,
    rareCosmeticSlots: 3,
    visualIdentity: "Mature domain, larger project districts, civic and treasury details",
    customizationMood: "Epic RPG settlement with prestige buildings and mature land",
  },
  FRUIT: {
    tier: "FRUIT",
    name: "Fruit Citadel",
    estateScale: 2.5,
    projectSlots: 8,
    buildingSlots: 10,
    decorationSlots: 36,
    pathSlots: 16,
    rareCosmeticSlots: 5,
    visualIdentity: "Full regenerative citadel, rare cosmetics, premium symbolic effects",
    customizationMood: "Top-tier RPG estate with rare visual identity and broad customization",
  },
};

export function homesteadProfileForTier(tier: StakingTier) {
  return homesteadProfiles[tier];
}

export function homesteadCustomizationCapacity(tier: StakingTier) {
  const profile = homesteadProfileForTier(tier);

  return {
    totalSlots:
      profile.buildingSlots + profile.decorationSlots + profile.pathSlots + profile.rareCosmeticSlots,
    projectSlots: profile.projectSlots,
    estateScale: profile.estateScale,
  };
}

