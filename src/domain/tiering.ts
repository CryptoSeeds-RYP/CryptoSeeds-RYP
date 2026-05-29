import type { StakingTier } from "./microverse";

export const tierOrder: StakingTier[] = ["NONE", "SEED", "SPROUT", "SAPLING", "TREE", "FRUIT"];

export const selectableTiers: Exclude<StakingTier, "NONE">[] = [
  "SEED",
  "SPROUT",
  "SAPLING",
  "TREE",
  "FRUIT",
];

export const tierRequirements: Record<Exclude<StakingTier, "NONE">, number> = {
  SEED: 5000,
  SPROUT: 20000,
  SAPLING: 50000,
  TREE: 100000,
  FRUIT: 150000,
};

export const tierFeeReduction: Record<StakingTier, number> = {
  NONE: 0,
  SEED: 0,
  SPROUT: 10,
  SAPLING: 20,
  TREE: 30,
  FRUIT: 40,
};

export function canAccess(required: StakingTier, current: StakingTier) {
  return tierOrder.indexOf(current) >= tierOrder.indexOf(required);
}

export function effectiveFee(tier: StakingTier) {
  const fee = 3.5 * (1 - tierFeeReduction[tier] / 100);
  return `${fee.toFixed(2).replace(/0$/, "")}%`;
}

export function tierFromAmount(amount: number): StakingTier {
  if (amount >= tierRequirements.FRUIT) return "FRUIT";
  if (amount >= tierRequirements.TREE) return "TREE";
  if (amount >= tierRequirements.SAPLING) return "SAPLING";
  if (amount >= tierRequirements.SPROUT) return "SPROUT";
  if (amount >= tierRequirements.SEED) return "SEED";
  return "NONE";
}

export function projectSlotsForTier(tier: StakingTier) {
  switch (tier) {
    case "FRUIT":
      return 8;
    case "TREE":
      return 6;
    case "SAPLING":
      return 4;
    case "SPROUT":
      return 3;
    case "SEED":
      return 2;
    default:
      return 0;
  }
}

