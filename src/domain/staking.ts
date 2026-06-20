import type { UserMicroVerseState } from "./microverse";
import type { StakingTier } from "./microverse";
import { effectiveFee, projectSlotsForTier, selectableTiers, tierFeeReduction, tierFromAmount, tierRequirements } from "./tiering";

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
  effectivePlatformFee: string;
  effectiveNetworkFee: string;
  projectSlotsUnlocked: number;
};

export type UnstakePreviewValidation = {
  valid: boolean;
  currentStakedAmount: number;
  unstakeAmount: number;
  remainingAmount: number;
  remainingTier: StakingTier;
  reason?: string;
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
    effectivePlatformFee: effectiveFee(user.stakingTier),
    effectiveNetworkFee: effectiveFee(user.stakingTier),
    projectSlotsUnlocked: projectSlotsForTier(user.stakingTier),
  };
}

export function validateUnstakePreview({
  currentStakedAmount,
  unstakeAmount,
}: {
  currentStakedAmount: number | string;
  unstakeAmount: number | string;
}): UnstakePreviewValidation {
  const current = normalizeRypUiAmount(currentStakedAmount);
  const amount = normalizeRypUiAmount(unstakeAmount);
  const remaining = current - amount;
  const remainingTier = remaining > 0 ? tierFromAmount(remaining) : "NONE";

  if (!Number.isFinite(current) || current < 0) {
    return invalidUnstake(current, amount, remaining, remainingTier, "Current staked amount is invalid.");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return invalidUnstake(current, amount, remaining, remainingTier, "Unstake amount must be greater than zero.");
  }

  if (amount > current) {
    return invalidUnstake(current, amount, remaining, remainingTier, "Unstake amount exceeds the current staked balance.");
  }

  if (remaining > 0 && remainingTier === "NONE") {
    return invalidUnstake(
      current,
      amount,
      remaining,
      remainingTier,
      `Partial unstake would leave ${formatRypAmount(remaining)} RYP below the ${formatRypAmount(
        tierRequirements.SEED,
      )} RYP Seed minimum. Fully unstake or leave at least ${formatRypAmount(tierRequirements.SEED)} RYP staked.`,
    );
  }

  return {
    valid: true,
    currentStakedAmount: current,
    unstakeAmount: amount,
    remainingAmount: Math.max(0, remaining),
    remainingTier,
  };
}

function findNextTier(tier: StakingTier) {
  if (tier === "FRUIT") return undefined;
  const currentIndex = selectableTiers.indexOf(tier as Exclude<StakingTier, "NONE">);
  return selectableTiers[Math.max(0, currentIndex + 1)];
}

function invalidUnstake(
  currentStakedAmount: number,
  unstakeAmount: number,
  remainingAmount: number,
  remainingTier: StakingTier,
  reason: string,
): UnstakePreviewValidation {
  return {
    valid: false,
    currentStakedAmount,
    unstakeAmount,
    remainingAmount,
    remainingTier,
    reason,
  };
}

function normalizeRypUiAmount(value: number | string) {
  return typeof value === "number" ? value : Number(value.replace(/,/g, "").trim());
}

function formatRypAmount(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 6 });
}
