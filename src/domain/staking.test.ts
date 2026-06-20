import { describe, expect, it } from "vitest";
import type { UserMicroVerseState } from "./microverse";
import { summarizeStakingPosition, validateUnstakePreview } from "./staking";
import { tierRequirements } from "./tiering";

function user(overrides: Partial<UserMicroVerseState>): UserMicroVerseState {
  return {
    walletConnected: true,
    rypBalance: 0,
    stakedAmount: 0,
    stakingTier: "NONE",
    stakingDays: 0,
    goldenKeyNft: false,
    votingRightsNft: false,
    claimableRewards: [],
    ...overrides,
  };
}

describe("staking summary", () => {
  it("shows locked identity state for unstaked users", () => {
    const summary = summarizeStakingPosition(user({}));

    expect(summary.tier).toBe("NONE");
    expect(summary.goldenKeyState).toBe("LOCKED");
    expect(summary.votingRightsState).toBe("LOCKED");
    expect(summary.votingDaysRemaining).toBe(14);
    expect(summary.projectSlotsUnlocked).toBe(0);
  });

  it("shows voting timer while a user is staked but not eligible yet", () => {
    const summary = summarizeStakingPosition(
      user({
        stakedAmount: tierRequirements.SPROUT,
        stakingTier: "SPROUT",
        stakingDays: 6,
        goldenKeyNft: true,
      }),
    );

    expect(summary.goldenKeyState).toBe("ACTIVE");
    expect(summary.votingRightsState).toBe("TIMER_ACTIVE");
    expect(summary.votingDaysRemaining).toBe(8);
    expect(summary.feeReductionPercent).toBe(10);
    expect(summary.effectivePlatformFee).toBe("3.15%");
    expect(summary.effectiveNetworkFee).toBe("3.15%");
  });

  it("recognizes active voting rights after eligibility", () => {
    const summary = summarizeStakingPosition(
      user({
        stakedAmount: tierRequirements.TREE,
        stakingTier: "TREE",
        stakingDays: 20,
        goldenKeyNft: true,
        votingRightsNft: true,
      }),
    );

    expect(summary.votingRightsState).toBe("ACTIVE");
    expect(summary.votingDaysRemaining).toBe(0);
    expect(summary.nextTier).toBe("FRUIT");
    expect(summary.rypToNextTier).toBe(tierRequirements.FRUIT - tierRequirements.TREE);
  });

  it("validates unstake previews against the protocol remainder rule", () => {
    expect(validateUnstakePreview({ currentStakedAmount: tierRequirements.SEED, unstakeAmount: tierRequirements.SEED })).toMatchObject({
      valid: true,
      remainingAmount: 0,
      remainingTier: "NONE",
    });
    expect(validateUnstakePreview({ currentStakedAmount: tierRequirements.SPROUT, unstakeAmount: 15_000 })).toMatchObject({
      valid: true,
      remainingAmount: tierRequirements.SEED,
      remainingTier: "SEED",
    });
    expect(validateUnstakePreview({ currentStakedAmount: "20,000", unstakeAmount: "16,000" })).toMatchObject({
      valid: false,
      remainingAmount: 4_000,
      remainingTier: "NONE",
    });
    expect(validateUnstakePreview({ currentStakedAmount: 5_000, unstakeAmount: 5_001 }).reason).toContain(
      "exceeds the current staked balance",
    );
  });
});
