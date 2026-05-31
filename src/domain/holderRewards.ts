export type HolderRewardPayoutStatus = "PAY_NOW" | "ROLL_FORWARD" | "EXCLUDED";
export type HolderRewardCadence = "WEEKLY" | "MONTHLY" | "QUARTERLY" | "CLAIM_ONLY";
export type HolderRewardTier = "MICRO" | "SMALL" | "SEED" | "SPROUT" | "CANOPY";

export type HolderRewardTierRule = {
  tier: HolderRewardTier;
  minimumRypBaseUnits: bigint;
  cadence: HolderRewardCadence;
  note: string;
};

export type HolderSnapshotEntry = {
  walletAddress: string;
  rypBalanceBaseUnits: bigint;
  excluded?: boolean;
  exclusionReason?: string;
};

export type HolderRewardEpochInput = {
  id: string;
  rewardMint: string;
  rewardPoolBaseUnits: bigint;
  snapshotTakenAt: string;
  scheduledCadences?: HolderRewardCadence[];
  estimatedDeliveryCostPerPayoutBaseUnits: bigint;
  minimumNetPayoutBaseUnits: bigint;
  entries: HolderSnapshotEntry[];
};

export type HolderRewardPayout = {
  walletAddress: string;
  holderTier: HolderRewardTier;
  payoutCadence: HolderRewardCadence;
  rypBalanceBaseUnits: bigint;
  grossAllocationBaseUnits: bigint;
  deliveryCostBaseUnits: bigint;
  netPayoutBaseUnits: bigint;
  rolledForwardBaseUnits: bigint;
  status: HolderRewardPayoutStatus;
  reason: string;
};

export type HolderRewardEpoch = {
  id: string;
  rewardMint: string;
  snapshotTakenAt: string;
  totalEligibleRypBaseUnits: bigint;
  rewardPoolBaseUnits: bigint;
  distributedNetBaseUnits: bigint;
  reservedDeliveryCostBaseUnits: bigint;
  rolledForwardBaseUnits: bigint;
  payouts: HolderRewardPayout[];
};

export const holderRewardPolicy = {
  label: "Passive Holder Rewards",
  cadence: "WEEKLY",
  fundingRule: "Holder allocations pay their own delivery costs before net payout.",
  dustRule: "Small allocations roll into less frequent payout windows or claim-only status until they clear costs.",
  custodyRule: "Holders keep RYP in self-custodial wallets; staking is not required for this bucket.",
};

export const holderRewardTierRules: HolderRewardTierRule[] = [
  {
    tier: "CANOPY",
    minimumRypBaseUnits: 100_000_000_000n,
    cadence: "WEEKLY",
    note: "Large holders are checked in every weekly payout run.",
  },
  {
    tier: "SPROUT",
    minimumRypBaseUnits: 20_000_000_000n,
    cadence: "WEEKLY",
    note: "Sprout-size holders can clear weekly if the net payout is not dust.",
  },
  {
    tier: "SEED",
    minimumRypBaseUnits: 5_000_000_000n,
    cadence: "MONTHLY",
    note: "Seed-size holders roll into monthly payout batches unless a later policy promotes them.",
  },
  {
    tier: "SMALL",
    minimumRypBaseUnits: 500_000_000n,
    cadence: "QUARTERLY",
    note: "Small holders roll into quarterly batches to avoid dust-heavy weekly transfers.",
  },
  {
    tier: "MICRO",
    minimumRypBaseUnits: 0n,
    cadence: "CLAIM_ONLY",
    note: "Very small balances roll forward until they are worth claiming or batching.",
  },
];

export function buildHolderRewardEpoch(input: HolderRewardEpochInput): HolderRewardEpoch {
  validateRewardEpochInput(input);
  const scheduledCadences = input.scheduledCadences ?? ["WEEKLY"];

  const eligibleEntries = input.entries.filter((entry) => !entry.excluded && entry.rypBalanceBaseUnits > 0n);
  const totalEligibleRypBaseUnits = eligibleEntries.reduce(
    (total, entry) => total + entry.rypBalanceBaseUnits,
    0n,
  );

  if (totalEligibleRypBaseUnits === 0n) {
    return {
      id: input.id,
      rewardMint: input.rewardMint,
      snapshotTakenAt: input.snapshotTakenAt,
      totalEligibleRypBaseUnits,
      rewardPoolBaseUnits: input.rewardPoolBaseUnits,
      distributedNetBaseUnits: 0n,
      reservedDeliveryCostBaseUnits: 0n,
      rolledForwardBaseUnits: input.rewardPoolBaseUnits,
      payouts: input.entries.map((entry) => excludedPayout(entry, "No eligible holder balance in epoch.")),
    };
  }

  let allocatedGross = 0n;
  let eligibleEntryIndex = 0;
  const payouts = input.entries.map((entry) => {
    if (entry.excluded) {
      return excludedPayout(entry, entry.exclusionReason ?? "Excluded from holder rewards.");
    }
    if (entry.rypBalanceBaseUnits <= 0n) {
      return excludedPayout(entry, "Wallet has no eligible RYP balance in the snapshot.");
    }

    const isLastEligibleEntry = eligibleEntryIndex === eligibleEntries.length - 1;
    const grossAllocationBaseUnits = isLastEligibleEntry
      ? input.rewardPoolBaseUnits - allocatedGross
      : (input.rewardPoolBaseUnits * entry.rypBalanceBaseUnits) / totalEligibleRypBaseUnits;

    allocatedGross += grossAllocationBaseUnits;
    eligibleEntryIndex += 1;

    return netCostPayout({
      entry,
      scheduledCadences,
      grossAllocationBaseUnits,
      estimatedDeliveryCostPerPayoutBaseUnits: input.estimatedDeliveryCostPerPayoutBaseUnits,
      minimumNetPayoutBaseUnits: input.minimumNetPayoutBaseUnits,
    });
  });

  const distributedNetBaseUnits = payouts.reduce((total, payout) => total + payout.netPayoutBaseUnits, 0n);
  const reservedDeliveryCostBaseUnits = payouts.reduce((total, payout) => total + payout.deliveryCostBaseUnits, 0n);
  const rolledForwardBaseUnits = input.rewardPoolBaseUnits - distributedNetBaseUnits - reservedDeliveryCostBaseUnits;

  return {
    id: input.id,
    rewardMint: input.rewardMint,
    snapshotTakenAt: input.snapshotTakenAt,
    totalEligibleRypBaseUnits,
    rewardPoolBaseUnits: input.rewardPoolBaseUnits,
    distributedNetBaseUnits,
    reservedDeliveryCostBaseUnits,
    rolledForwardBaseUnits,
    payouts,
  };
}

export function epochAccountingIsBalanced(epoch: HolderRewardEpoch) {
  return (
    epoch.distributedNetBaseUnits +
      epoch.reservedDeliveryCostBaseUnits +
      epoch.rolledForwardBaseUnits ===
    epoch.rewardPoolBaseUnits
  );
}

export function holderRewardTierForBalance(rypBalanceBaseUnits: bigint): HolderRewardTierRule {
  const rule = holderRewardTierRules.find((tierRule) => rypBalanceBaseUnits >= tierRule.minimumRypBaseUnits);
  return rule ?? holderRewardTierRules[holderRewardTierRules.length - 1];
}

function netCostPayout({
  entry,
  scheduledCadences,
  grossAllocationBaseUnits,
  estimatedDeliveryCostPerPayoutBaseUnits,
  minimumNetPayoutBaseUnits,
}: {
  entry: HolderSnapshotEntry;
  scheduledCadences: HolderRewardCadence[];
  grossAllocationBaseUnits: bigint;
  estimatedDeliveryCostPerPayoutBaseUnits: bigint;
  minimumNetPayoutBaseUnits: bigint;
}): HolderRewardPayout {
  const tierRule = holderRewardTierForBalance(entry.rypBalanceBaseUnits);
  if (!scheduledCadences.includes(tierRule.cadence)) {
    return {
      walletAddress: entry.walletAddress,
      holderTier: tierRule.tier,
      payoutCadence: tierRule.cadence,
      rypBalanceBaseUnits: entry.rypBalanceBaseUnits,
      grossAllocationBaseUnits,
      deliveryCostBaseUnits: 0n,
      netPayoutBaseUnits: 0n,
      rolledForwardBaseUnits: grossAllocationBaseUnits,
      status: "ROLL_FORWARD",
      reason: `${tierRule.tier} holder uses ${tierRule.cadence.toLowerCase().replace("_", " ")} payout cadence.`,
    };
  }

  if (grossAllocationBaseUnits <= estimatedDeliveryCostPerPayoutBaseUnits) {
    return {
      walletAddress: entry.walletAddress,
      holderTier: tierRule.tier,
      payoutCadence: tierRule.cadence,
      rypBalanceBaseUnits: entry.rypBalanceBaseUnits,
      grossAllocationBaseUnits,
      deliveryCostBaseUnits: 0n,
      netPayoutBaseUnits: 0n,
      rolledForwardBaseUnits: grossAllocationBaseUnits,
      status: "ROLL_FORWARD",
      reason: "Gross allocation does not clear estimated delivery cost.",
    };
  }

  const netPayoutBaseUnits = grossAllocationBaseUnits - estimatedDeliveryCostPerPayoutBaseUnits;
  if (netPayoutBaseUnits < minimumNetPayoutBaseUnits) {
    return {
      walletAddress: entry.walletAddress,
      holderTier: tierRule.tier,
      payoutCadence: tierRule.cadence,
      rypBalanceBaseUnits: entry.rypBalanceBaseUnits,
      grossAllocationBaseUnits,
      deliveryCostBaseUnits: 0n,
      netPayoutBaseUnits: 0n,
      rolledForwardBaseUnits: grossAllocationBaseUnits,
      status: "ROLL_FORWARD",
      reason: "Net payout is below the weekly minimum; allocation rolls forward.",
    };
  }

  return {
    walletAddress: entry.walletAddress,
    holderTier: tierRule.tier,
    payoutCadence: tierRule.cadence,
    rypBalanceBaseUnits: entry.rypBalanceBaseUnits,
    grossAllocationBaseUnits,
    deliveryCostBaseUnits: estimatedDeliveryCostPerPayoutBaseUnits,
    netPayoutBaseUnits,
    rolledForwardBaseUnits: 0n,
    status: "PAY_NOW",
    reason: "Net payout clears delivery cost and minimum threshold.",
  };
}

function excludedPayout(entry: HolderSnapshotEntry, reason: string): HolderRewardPayout {
  const tierRule = holderRewardTierForBalance(entry.rypBalanceBaseUnits);

  return {
    walletAddress: entry.walletAddress,
    holderTier: tierRule.tier,
    payoutCadence: tierRule.cadence,
    rypBalanceBaseUnits: entry.rypBalanceBaseUnits,
    grossAllocationBaseUnits: 0n,
    deliveryCostBaseUnits: 0n,
    netPayoutBaseUnits: 0n,
    rolledForwardBaseUnits: 0n,
    status: "EXCLUDED",
    reason,
  };
}

function validateRewardEpochInput(input: HolderRewardEpochInput) {
  if (input.rewardPoolBaseUnits < 0n) {
    throw new Error("Reward pool cannot be negative.");
  }
  if (input.estimatedDeliveryCostPerPayoutBaseUnits < 0n) {
    throw new Error("Delivery cost cannot be negative.");
  }
  if (input.minimumNetPayoutBaseUnits < 0n) {
    throw new Error("Minimum net payout cannot be negative.");
  }
  for (const entry of input.entries) {
    if (entry.rypBalanceBaseUnits < 0n) {
      throw new Error(`Snapshot balance cannot be negative for ${entry.walletAddress}.`);
    }
  }
}
