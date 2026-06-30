import type { ProtocolSnapshot, StakingTier, UserMicroVerseState } from "../domain/microverse";
import { projectSlotsForTier } from "../domain/tiering";
import type { StakePositionInspection, StakeTierName } from "../solana/protocolStateInspection";

const VALID_STAKING_TIERS: StakingTier[] = ["NONE", "SEED", "SPROUT", "SAPLING", "TREE", "FRUIT"];

export function applyStakePositionInspectionToSnapshot({
  inspection,
  nowMs = Date.now(),
  rypDecimals,
  snapshot,
}: {
  inspection: StakePositionInspection;
  nowMs?: number;
  rypDecimals: number;
  snapshot: ProtocolSnapshot;
}): ProtocolSnapshot {
  if (inspection.status !== "DECODED" || !inspection.decoded || inspection.blockers.length > 0) {
    return snapshot;
  }

  const tier = normalizeStakeTier(inspection.decoded.tier);
  if (!tier) return snapshot;

  const stakedAmount = baseUnitsToUiAmount(inspection.decoded.stakedAmount, rypDecimals);
  const user: UserMicroVerseState = {
    ...snapshot.user,
    goldenKeyNft: inspection.decoded.goldenKeyActive,
    stakingDays: stakingDaysFromStart(inspection.decoded.stakingStartTs, nowMs),
    stakingTier: tier,
    stakedAmount,
    votingRightsNft: inspection.decoded.votingRightsActive,
    walletAddress: inspection.decoded.owner,
    walletConnected: true,
  };
  const stakingActive = user.walletConnected && user.stakingTier !== "NONE";
  const rypHolder = user.walletConnected && user.rypBalance > 0;

  return {
    ...snapshot,
    farm: {
      ...snapshot.farm,
      buildingLevel: Math.max(0, projectSlotsForTier(user.stakingTier) - 1),
      governanceActive: stakingActive,
      harvestAvailable: stakingActive,
      projectSlotsUnlocked: projectSlotsForTier(user.stakingTier),
      seedBotUnlocked: stakingActive || rypHolder,
      terrainLevel: user.stakingTier === "NONE" ? 0 : 1,
      weatherState: user.walletConnected ? "CLEAR" : snapshot.farm.weatherState,
    },
    rewards: stakingActive
      ? snapshot.rewards.map((reward) => ({
          ...reward,
          status: reward.status === "LOCKED" ? "PENDING" : reward.status,
        }))
      : snapshot.rewards,
    source: "LIVE_PROTOCOL_ACCOUNT",
    user,
  };
}

export function normalizeStakeTier(tier: StakeTierName): StakingTier | undefined {
  return VALID_STAKING_TIERS.includes(tier as StakingTier) ? (tier as StakingTier) : undefined;
}

export function baseUnitsToUiAmount(value: string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) return 0;
  try {
    const raw = BigInt(value);
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const fraction = raw % divisor;
    return Number(whole) + Number(fraction) / Number(divisor);
  } catch {
    return 0;
  }
}

function stakingDaysFromStart(stakingStartTs: string, nowMs: number) {
  try {
    const startMs = Number(BigInt(stakingStartTs) * 1000n);
    if (!Number.isFinite(startMs) || startMs <= 0 || nowMs <= startMs) return 0;
    return Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000));
  } catch {
    return 0;
  }
}
