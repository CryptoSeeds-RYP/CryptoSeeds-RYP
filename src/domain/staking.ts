import type { UserMicroVerseState } from "./microverse";
import type { StakingTier } from "./microverse";
import { effectiveFee, projectSlotsForTier, selectableTiers, tierFeeReduction, tierRequirements } from "./tiering";

export type GoldenKeyState = "LOCKED" | "ACTIVE" | "RETURN_PENDING";
export type VotingRightsState = "LOCKED" | "TIMER_ACTIVE" | "ACTIVE";

export type StakingPositionSummary = {
  tier: StakingTier;
  stakedAmount: number;
  nextTier?: Exclude<StakingTier, "NONE">;
  rypToNextTier?: number;
  goldenKeyState: GoldenKeyState;
  votingRightsState: VotingRightsState;
  votingDaysRemaining: number;
  feeReductionPercent: number;
  effectiveNetworkFee: string;
  projectSlotsUnlocked: number;
};

export function summarizeStakingPosition(user: UserMicroVerseState): StakingPositionSummary {
  const nextTier = findNextTier(user.stakingTier);
  const nextTierRequirement = nextTier ? tierRequirements[nextTier] : undefined;
  const rypToNextTier = nextTierRequirement ? Math.max(0, nextTierRequirement - user.stakedAmount) : undefined;

  return {
    tier: user.stakingTier,
    stakedAmount: user.stakedAmount,
    nextTier,
    rypToNextTier,
    goldenKeyState: user.goldenKeyNft ? "ACTIVE" : "LOCKED",
    votingRightsState: user.votingRightsNft ? "ACTIVE" : user.stakingTier === "NONE" ? "LOCKED" : "TIMER_ACTIVE",
    votingDaysRemaining: user.votingRightsNft ? 0 : Math.max(0, 14 - user.stakingDays),
    feeReductionPercent: tierFeeReduction[user.stakingTier],
    effectiveNetworkFee: effectiveFee(user.stakingTier),
    projectSlotsUnlocked: projectSlotsForTier(user.stakingTier),
  };
}

function findNextTier(tier: StakingTier) {
  if (tier === "FRUIT") return undefined;
  const currentIndex = selectableTiers.indexOf(tier as Exclude<StakingTier, "NONE">);
  return selectableTiers[Math.max(0, currentIndex + 1)];
}

