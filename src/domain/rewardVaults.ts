import type { HolderRewardEpoch, HolderRewardEpochInput } from "./holderRewards";
import {
  buildHolderRewardEpoch,
  epochAccountingIsBalanced,
  holderRewardPolicy,
} from "./holderRewards";

export type RewardVaultRole =
  | "HOLDER_REWARD"
  | "STAKER_REWARD"
  | "INDEPENDENT_TREASURY"
  | "DELIVERY_COST_RESERVE"
  | "ROLLOVER";

export type RewardVaultCustodyModel =
  | "PROGRAM_CONTROLLED"
  | "TREASURY_CONTROLLED"
  | "DISCLOSURE_PENDING";

export type RewardVaultStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "DISABLED";

export type RewardVaultConfig = {
  id: string;
  label: string;
  role: RewardVaultRole;
  rewardMint: string;
  address?: string;
  custodyModel: RewardVaultCustodyModel;
  status: RewardVaultStatus;
  receivesUserFunds: false;
  notes: string;
};

export type RewardEpochDraftStatus =
  | "DRAFT_ONLY"
  | "REVIEW_REQUIRED"
  | "READY_FOR_DEVNET"
  | "BLOCKED";

export type RewardEpochDraft = {
  id: string;
  label: string;
  status: RewardEpochDraftStatus;
  createdAt: string;
  holderPolicyLabel: string;
  rewardMint: string;
  holderEpoch: HolderRewardEpoch;
  vaults: RewardVaultConfig[];
  validation: RewardEpochValidation;
  executionBlocked: true;
  exportVersion: "reward-epoch-draft/v1";
};

export type RewardEpochValidation = {
  valid: boolean;
  blockers: string[];
  warnings: string[];
};

export type RewardEpochExport = {
  exportVersion: "reward-epoch-draft/v1";
  id: string;
  label: string;
  status: RewardEpochDraftStatus;
  createdAt: string;
  executionBlocked: true;
  rewardMint: string;
  holderPolicyLabel: string;
  holderEpoch: ReturnType<typeof serializeHolderEpoch>;
  vaults: RewardVaultConfig[];
  validation: RewardEpochValidation;
};

export const requiredRewardVaultRoles: RewardVaultRole[] = [
  "HOLDER_REWARD",
  "STAKER_REWARD",
  "INDEPENDENT_TREASURY",
  "DELIVERY_COST_RESERVE",
  "ROLLOVER",
];

export const rewardVaultAuthorityRules = [
  "Reward epochs are draft-only until reviewed and deployed through the protocol authority path.",
  "No reward vault may be controlled by a user's wallet.",
  "Holder payout delivery costs are reserved from holder allocations, not subsidized by dev or treasury funds.",
  "Rollover balances remain in reward accounting until a later payout or expiry policy moves them.",
  "Every epoch must balance before it can be exported for review.",
];

export function buildRewardEpochDraft({
  id,
  label,
  createdAt,
  holderEpochInput,
  vaults,
}: {
  id: string;
  label: string;
  createdAt: string;
  holderEpochInput: HolderRewardEpochInput;
  vaults: RewardVaultConfig[];
}): RewardEpochDraft {
  const holderEpoch = buildHolderRewardEpoch(holderEpochInput);
  const validation = validateRewardEpochDraft({ holderEpoch, vaults, rewardMint: holderEpochInput.rewardMint });

  return {
    id,
    label,
    status: validation.valid ? "REVIEW_REQUIRED" : "BLOCKED",
    createdAt,
    holderPolicyLabel: holderRewardPolicy.label,
    rewardMint: holderEpochInput.rewardMint,
    holderEpoch,
    vaults,
    validation,
    executionBlocked: true,
    exportVersion: "reward-epoch-draft/v1",
  };
}

export function validateRewardEpochDraft({
  holderEpoch,
  vaults,
  rewardMint,
}: {
  holderEpoch: HolderRewardEpoch;
  vaults: RewardVaultConfig[];
  rewardMint: string;
}): RewardEpochValidation {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const roles = new Map<RewardVaultRole, RewardVaultConfig[]>();
  const seenAddresses = new Set<string>();

  for (const vault of vaults) {
    roles.set(vault.role, [...(roles.get(vault.role) ?? []), vault]);

    if (vault.rewardMint !== rewardMint) {
      blockers.push(`${vault.label} reward mint does not match epoch mint.`);
    }
    if (vault.receivesUserFunds !== false) {
      blockers.push(`${vault.label} must not be marked as receiving user funds.`);
    }
    if (vault.status === "DISABLED") {
      blockers.push(`${vault.label} is disabled.`);
    }
    if (vault.status !== "VERIFIED" && vault.status !== "DISABLED") {
      warnings.push(`${vault.label} is not verified yet.`);
    }
    if (vault.custodyModel === "DISCLOSURE_PENDING") {
      warnings.push(`${vault.label} custody model needs verification.`);
    }
    if (!vault.address) {
      warnings.push(`${vault.label} address is not configured yet.`);
    } else if (seenAddresses.has(vault.address)) {
      blockers.push(`${vault.label} reuses a vault address already assigned in this draft.`);
    } else {
      seenAddresses.add(vault.address);
    }
  }

  for (const role of requiredRewardVaultRoles) {
    const matchingVaults = roles.get(role) ?? [];
    if (matchingVaults.length === 0) {
      blockers.push(`Missing reward vault role: ${role}.`);
    }
    if (matchingVaults.length > 1) {
      blockers.push(`Duplicate reward vault role: ${role}.`);
    }
  }

  if (!epochAccountingIsBalanced(holderEpoch)) {
    blockers.push("Holder epoch accounting is not balanced.");
  }

  if (holderEpoch.rewardPoolBaseUnits === 0n) {
    warnings.push("Holder epoch reward pool is zero.");
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  };
}

export function buildRewardEpochExport(draft: RewardEpochDraft): RewardEpochExport {
  return {
    exportVersion: draft.exportVersion,
    id: draft.id,
    label: draft.label,
    status: draft.status,
    createdAt: draft.createdAt,
    executionBlocked: true,
    rewardMint: draft.rewardMint,
    holderPolicyLabel: draft.holderPolicyLabel,
    holderEpoch: serializeHolderEpoch(draft.holderEpoch),
    vaults: draft.vaults,
    validation: draft.validation,
  };
}

export function stringifyRewardEpochExport(draft: RewardEpochDraft) {
  return JSON.stringify(buildRewardEpochExport(draft), null, 2);
}

function serializeHolderEpoch(epoch: HolderRewardEpoch) {
  return {
    ...epoch,
    totalEligibleRypBaseUnits: epoch.totalEligibleRypBaseUnits.toString(),
    rewardPoolBaseUnits: epoch.rewardPoolBaseUnits.toString(),
    distributedNetBaseUnits: epoch.distributedNetBaseUnits.toString(),
    reservedDeliveryCostBaseUnits: epoch.reservedDeliveryCostBaseUnits.toString(),
    rolledForwardBaseUnits: epoch.rolledForwardBaseUnits.toString(),
    payouts: epoch.payouts.map((payout) => ({
      ...payout,
      rypBalanceBaseUnits: payout.rypBalanceBaseUnits.toString(),
      grossAllocationBaseUnits: payout.grossAllocationBaseUnits.toString(),
      deliveryCostBaseUnits: payout.deliveryCostBaseUnits.toString(),
      netPayoutBaseUnits: payout.netPayoutBaseUnits.toString(),
      rolledForwardBaseUnits: payout.rolledForwardBaseUnits.toString(),
    })),
  };
}
