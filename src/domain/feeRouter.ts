import type { StakingTier } from "./microverse";
import { tierFeeReduction } from "./tiering";

export const BPS_DENOMINATOR = 10_000;
export const PLATFORM_ACTION_BASE_FEE_BPS = 350;
export const RYP_TOKEN_TRANSFER_FEE_BPS = 100;

export type CoreFeeBucket = "HOLDERS" | "STAKERS" | "INDEPENDENT_TREASURY";
export type FeeBucket = CoreFeeBucket | "DEVELOPERS";
export type FeeScope = "TOKEN_TRANSFER" | "PLATFORM_ACTION" | "SEEDBOT_SUCCESS";
export type FeeSplitStatus = "CONFIGURABLE_NOT_FINAL" | "DRAFT_PREVIEW" | "FINALIZED";
export type FeeEnforcementLayer =
  | "APP_CONTROLLED_ACTION"
  | "PROGRAM_CONTROLLED_ACTION"
  | "TOKEN_EXTENSION_REQUIRED"
  | "WRAPPER_OR_MIGRATION_REQUIRED"
  | "REVIEW_GATED";

export type FeeRoutePolicy = {
  id: string;
  label: string;
  scope: FeeScope;
  baseFeeBps: number;
  splitBuckets: FeeBucket[];
  splitStatus: FeeSplitStatus;
  splitSourcePolicyId?: string;
  enforcementLayer: FeeEnforcementLayer;
  notes: string[];
};

export type FeeSplitEntry = {
  bucket: FeeBucket;
  shareBps: number;
};

export type FeeSplitValidation = {
  valid: boolean;
  totalShareBps: number;
  blockers: string[];
};

export type FeeQuote = {
  grossAmountBaseUnits: bigint;
  feeAmountBaseUnits: bigint;
  netAmountBaseUnits: bigint;
  feeBps: number;
};

export type FeeDistributionQuote = {
  bucket: FeeBucket;
  shareBps: number;
  amountBaseUnits: bigint;
};

export const coreFeeBuckets: CoreFeeBucket[] = ["HOLDERS", "STAKERS", "INDEPENDENT_TREASURY"];

export const platformActionFeeRoutePolicy: FeeRoutePolicy = {
  id: "platform-action-fee",
  label: "Platform Action Fee",
  scope: "PLATFORM_ACTION",
  baseFeeBps: PLATFORM_ACTION_BASE_FEE_BPS,
  splitBuckets: coreFeeBuckets,
  splitStatus: "CONFIGURABLE_NOT_FINAL",
  enforcementLayer: "PROGRAM_CONTROLLED_ACTION",
  notes: [
    "Applies to CryptoSeeds-controlled protocol actions only.",
    "Tier reductions lower the effective fee for staked users.",
    "Raw wallet-to-wallet transfers outside the protocol are not captured by this route.",
  ],
};

export const rypTokenTransferFeeRoutePolicy: FeeRoutePolicy = {
  id: "ryp-token-transfer-fee",
  label: "RYP Transfer Fee",
  scope: "TOKEN_TRANSFER",
  baseFeeBps: RYP_TOKEN_TRANSFER_FEE_BPS,
  splitBuckets: coreFeeBuckets,
  splitStatus: "CONFIGURABLE_NOT_FINAL",
  splitSourcePolicyId: platformActionFeeRoutePolicy.id,
  enforcementLayer: "WRAPPER_OR_MIGRATION_REQUIRED",
  notes: [
    "Target fee is 1% on RYP token transfers.",
    "Uses the same holder, staker, and independent treasury bucket model as the platform action fee.",
    "A legacy SPL mint cannot be retrofitted with transfer-fee enforcement; full transfer-level capture needs a reviewed wrapper, migration, or token-extension route.",
  ],
};

export const seedBotSuccessFeeRoutePolicy: FeeRoutePolicy = {
  id: "seedbot-success-fee",
  label: "SeedBot Success Fee",
  scope: "SEEDBOT_SUCCESS",
  baseFeeBps: 1_200,
  splitBuckets: ["DEVELOPERS", "INDEPENDENT_TREASURY"],
  splitStatus: "DRAFT_PREVIEW",
  enforcementLayer: "REVIEW_GATED",
  notes: [
    "Preview only: applies to realized positive strategy PnL, not principal.",
    "Disabled for live use until security, accounting, and jurisdictional review are complete.",
  ],
};

export const feeRoutePolicies: FeeRoutePolicy[] = [
  platformActionFeeRoutePolicy,
  rypTokenTransferFeeRoutePolicy,
  seedBotSuccessFeeRoutePolicy,
];

export const draftCoreFeeSplit: FeeSplitEntry[] = [
  { bucket: "HOLDERS", shareBps: 3_334 },
  { bucket: "STAKERS", shareBps: 3_333 },
  { bucket: "INDEPENDENT_TREASURY", shareBps: 3_333 },
];

export function basisPointsToPercent(bps: number) {
  return `${trimTrailingZeros((bps / 100).toFixed(2))}%`;
}

export function effectivePlatformActionFeeBps(tier: StakingTier) {
  const reductionPercent = tierFeeReduction[tier];
  return Math.round(PLATFORM_ACTION_BASE_FEE_BPS * (1 - reductionPercent / 100));
}

export function quoteTokenTransferFee(
  amountBaseUnits: bigint,
  feeBps = RYP_TOKEN_TRANSFER_FEE_BPS,
): FeeQuote {
  validateFeeBps(feeBps);
  if (amountBaseUnits < 0n) {
    throw new Error("Transfer amount cannot be negative.");
  }

  const feeAmountBaseUnits = (amountBaseUnits * BigInt(feeBps)) / BigInt(BPS_DENOMINATOR);

  return {
    grossAmountBaseUnits: amountBaseUnits,
    feeAmountBaseUnits,
    netAmountBaseUnits: amountBaseUnits - feeAmountBaseUnits,
    feeBps,
  };
}

export function validateFeeSplit(
  split: FeeSplitEntry[],
  allowedBuckets: FeeBucket[] = [...coreFeeBuckets, "DEVELOPERS"],
): FeeSplitValidation {
  const blockers: string[] = [];
  const seenBuckets = new Set<FeeBucket>();
  const totalShareBps = split.reduce((total, entry) => total + entry.shareBps, 0);

  for (const entry of split) {
    if (!allowedBuckets.includes(entry.bucket)) {
      blockers.push(`Bucket ${entry.bucket} is not allowed for this fee route.`);
    }
    if (seenBuckets.has(entry.bucket)) {
      blockers.push(`Bucket ${entry.bucket} is duplicated.`);
    }
    if (!Number.isInteger(entry.shareBps) || entry.shareBps < 0) {
      blockers.push(`Bucket ${entry.bucket} has an invalid share.`);
    }
    seenBuckets.add(entry.bucket);
  }

  if (totalShareBps !== BPS_DENOMINATOR) {
    blockers.push("Fee split must total 10000 basis points.");
  }

  return {
    valid: blockers.length === 0,
    totalShareBps,
    blockers,
  };
}

export function distributeFeeAmount(
  feeAmountBaseUnits: bigint,
  split: FeeSplitEntry[],
): FeeDistributionQuote[] {
  const validation = validateFeeSplit(split);
  if (!validation.valid) {
    throw new Error(validation.blockers.join(" "));
  }
  if (feeAmountBaseUnits < 0n) {
    throw new Error("Fee amount cannot be negative.");
  }

  let allocated = 0n;

  return split.map((entry, index) => {
    const amountBaseUnits =
      index === split.length - 1
        ? feeAmountBaseUnits - allocated
        : (feeAmountBaseUnits * BigInt(entry.shareBps)) / BigInt(BPS_DENOMINATOR);

    allocated += amountBaseUnits;

    return {
      bucket: entry.bucket,
      shareBps: entry.shareBps,
      amountBaseUnits,
    };
  });
}

export function tokenTransferFeeUsesCoreSplit(policy = rypTokenTransferFeeRoutePolicy) {
  return (
    policy.baseFeeBps === RYP_TOKEN_TRANSFER_FEE_BPS &&
    policy.splitBuckets.length === coreFeeBuckets.length &&
    coreFeeBuckets.every((bucket) => policy.splitBuckets.includes(bucket)) &&
    policy.splitSourcePolicyId === platformActionFeeRoutePolicy.id
  );
}

function validateFeeBps(feeBps: number) {
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > BPS_DENOMINATOR) {
    throw new Error("Fee basis points must be an integer between 0 and 10000.");
  }
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}
