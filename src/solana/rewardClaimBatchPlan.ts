import type { HolderRewardEpoch, HolderRewardPayout } from "../domain/holderRewards";
import { epochAccountingIsBalanced } from "../domain/holderRewards";
import type { PreparedSolanaTransactionPlan } from "../domain/transactions";
import {
  buildClaimRewardRecordTransactionPlan,
  buildClaimRewardTokensTransactionPlan,
  buildCreateRewardClaimRecordTransactionPlan,
  type RewardClaimRole,
} from "./protocolTransactionPlan";

export type RewardClaimBatchRecordStatus =
  | "READY_FOR_RECORD_CREATION"
  | "SKIPPED_EXCLUDED"
  | "SKIPPED_ZERO_ALLOCATION";

export type RewardClaimWalletActionStatus =
  | "READY_FOR_TOKEN_CLAIM"
  | "READY_FOR_ROLLOVER_MARK"
  | "SOURCE_VAULT_REQUIRED"
  | "NOT_APPLICABLE";

export type RewardClaimBatchPlanInput = {
  authorityAddress: string;
  epochId: bigint | number | string;
  holderEpoch: HolderRewardEpoch;
  rewardRole?: RewardClaimRole;
  rewardSourceVaultAddress?: string;
};

export type RewardClaimBatchRecord = {
  walletAddress: string;
  payoutStatus: HolderRewardPayout["status"];
  recordStatus: RewardClaimBatchRecordStatus;
  walletActionStatus: RewardClaimWalletActionStatus;
  reason: string;
  grossAllocationBaseUnits: string;
  deliveryCostBaseUnits: string;
  netClaimBaseUnits: string;
  rolledForwardBaseUnits: string;
  createRecordPlan?: PreparedSolanaTransactionPlan;
  walletClaimPlan?: PreparedSolanaTransactionPlan;
};

export type RewardClaimBatchPlan = {
  exportVersion: "reward-claim-batch/v1";
  executionMode: "PREVIEW_ONLY";
  authorityAddress: string;
  epochId: string;
  rewardMint: string;
  rewardRole: RewardClaimRole;
  sourceVaultAddress?: string;
  records: RewardClaimBatchRecord[];
  summary: {
    totalPayouts: number;
    recordCount: number;
    payNowCount: number;
    rolloverCount: number;
    excludedCount: number;
    skippedZeroAllocationCount: number;
    grossAllocationBaseUnits: string;
    deliveryCostBaseUnits: string;
    netClaimBaseUnits: string;
    rolledForwardBaseUnits: string;
  };
  validation: {
    valid: boolean;
    blockers: string[];
    warnings: string[];
  };
  warnings: string[];
};

export function buildRewardClaimBatchPlan({
  authorityAddress,
  epochId,
  holderEpoch,
  rewardRole = "HOLDER_REWARD",
  rewardSourceVaultAddress,
}: RewardClaimBatchPlanInput): RewardClaimBatchPlan {
  const records = holderEpoch.payouts.map((payout) =>
    buildRewardClaimBatchRecord({
      authorityAddress,
      epochId,
      payout,
      rewardRole,
      rewardSourceVaultAddress,
    }),
  );
  const validation = validateRewardClaimBatch({ holderEpoch, records, rewardSourceVaultAddress });
  const summary = summarizeRewardClaimBatch(records);

  return {
    exportVersion: "reward-claim-batch/v1",
    executionMode: "PREVIEW_ONLY",
    authorityAddress,
    epochId: epochId.toString(),
    rewardMint: holderEpoch.rewardMint,
    rewardRole,
    sourceVaultAddress: rewardSourceVaultAddress,
    records,
    summary,
    validation,
    warnings: [
      "Batch plans prepare transaction previews only; no claim records or payouts are broadcast here.",
      "Admin record creation and wallet reward claiming remain separate signing paths.",
    ],
  };
}

function buildRewardClaimBatchRecord({
  authorityAddress,
  epochId,
  payout,
  rewardRole,
  rewardSourceVaultAddress,
}: {
  authorityAddress: string;
  epochId: bigint | number | string;
  payout: HolderRewardPayout;
  rewardRole: RewardClaimRole;
  rewardSourceVaultAddress?: string;
}): RewardClaimBatchRecord {
  if (payout.status === "EXCLUDED") {
    return serializeSkippedRecord(payout, "SKIPPED_EXCLUDED", "NOT_APPLICABLE");
  }

  if (payout.grossAllocationBaseUnits === 0n) {
    return serializeSkippedRecord(payout, "SKIPPED_ZERO_ALLOCATION", "NOT_APPLICABLE");
  }

  const createRecordPlan = buildCreateRewardClaimRecordTransactionPlan({
    authorityAddress,
    deliveryCostAmountBaseUnits: payout.deliveryCostBaseUnits,
    epochId,
    grossAllocationAmountBaseUnits: payout.grossAllocationBaseUnits,
    netClaimAmountBaseUnits: payout.netPayoutBaseUnits,
    rewardRole,
    rolledForwardAmountBaseUnits: payout.rolledForwardBaseUnits,
    walletAddress: payout.walletAddress,
  });

  if (payout.netPayoutBaseUnits > 0n) {
    return {
      ...serializePayoutAmounts(payout),
      createRecordPlan,
      payoutStatus: payout.status,
      reason: payout.reason,
      recordStatus: "READY_FOR_RECORD_CREATION",
      walletActionStatus: rewardSourceVaultAddress ? "READY_FOR_TOKEN_CLAIM" : "SOURCE_VAULT_REQUIRED",
      walletAddress: payout.walletAddress,
      walletClaimPlan: rewardSourceVaultAddress
        ? buildClaimRewardTokensTransactionPlan({
            epochId,
            ownerAddress: payout.walletAddress,
            rewardRole,
            rewardSourceVaultAddress,
          })
        : undefined,
    };
  }

  return {
    ...serializePayoutAmounts(payout),
    createRecordPlan,
    payoutStatus: payout.status,
    reason: payout.reason,
    recordStatus: "READY_FOR_RECORD_CREATION",
    walletActionStatus: "READY_FOR_ROLLOVER_MARK",
    walletAddress: payout.walletAddress,
    walletClaimPlan: buildClaimRewardRecordTransactionPlan({
      epochId,
      ownerAddress: payout.walletAddress,
      rewardRole,
    }),
  };
}

function serializeSkippedRecord(
  payout: HolderRewardPayout,
  recordStatus: RewardClaimBatchRecordStatus,
  walletActionStatus: RewardClaimWalletActionStatus,
): RewardClaimBatchRecord {
  return {
    ...serializePayoutAmounts(payout),
    payoutStatus: payout.status,
    reason: payout.reason,
    recordStatus,
    walletActionStatus,
    walletAddress: payout.walletAddress,
  };
}

function serializePayoutAmounts(payout: HolderRewardPayout) {
  return {
    deliveryCostBaseUnits: payout.deliveryCostBaseUnits.toString(),
    grossAllocationBaseUnits: payout.grossAllocationBaseUnits.toString(),
    netClaimBaseUnits: payout.netPayoutBaseUnits.toString(),
    rolledForwardBaseUnits: payout.rolledForwardBaseUnits.toString(),
  };
}

function summarizeRewardClaimBatch(records: RewardClaimBatchRecord[]): RewardClaimBatchPlan["summary"] {
  const included = records.filter((record) => record.recordStatus === "READY_FOR_RECORD_CREATION");
  const total = sumRecords(included);

  return {
    totalPayouts: records.length,
    recordCount: included.length,
    payNowCount: included.filter((record) => BigInt(record.netClaimBaseUnits) > 0n).length,
    rolloverCount: included.filter((record) => BigInt(record.netClaimBaseUnits) === 0n).length,
    excludedCount: records.filter((record) => record.recordStatus === "SKIPPED_EXCLUDED").length,
    skippedZeroAllocationCount: records.filter((record) => record.recordStatus === "SKIPPED_ZERO_ALLOCATION").length,
    grossAllocationBaseUnits: total.gross.toString(),
    deliveryCostBaseUnits: total.delivery.toString(),
    netClaimBaseUnits: total.net.toString(),
    rolledForwardBaseUnits: total.rollover.toString(),
  };
}

function validateRewardClaimBatch({
  holderEpoch,
  records,
  rewardSourceVaultAddress,
}: {
  holderEpoch: HolderRewardEpoch;
  records: RewardClaimBatchRecord[];
  rewardSourceVaultAddress?: string;
}): RewardClaimBatchPlan["validation"] {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!epochAccountingIsBalanced(holderEpoch)) {
    blockers.push("Holder reward epoch accounting is not balanced.");
  }

  const included = records.filter((record) => record.recordStatus === "READY_FOR_RECORD_CREATION");
  const totals = sumRecords(included);
  if (totals.gross !== holderEpoch.rewardPoolBaseUnits) {
    blockers.push("Claim record gross allocations must equal the holder reward pool.");
  }
  if (totals.net !== holderEpoch.distributedNetBaseUnits) {
    blockers.push("Claim record net totals must equal the holder epoch distributed net amount.");
  }
  if (totals.delivery !== holderEpoch.reservedDeliveryCostBaseUnits) {
    blockers.push("Claim record delivery costs must equal the holder epoch reserved delivery costs.");
  }
  if (totals.rollover !== holderEpoch.rolledForwardBaseUnits) {
    blockers.push("Claim record rollover totals must equal the holder epoch rollover amount.");
  }

  const payableRecords = included.filter((record) => BigInt(record.netClaimBaseUnits) > 0n);
  if (payableRecords.length > 0 && !rewardSourceVaultAddress) {
    warnings.push("Pay-now wallet token claim plans require a verified reward source vault address.");
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  };
}

function sumRecords(records: RewardClaimBatchRecord[]) {
  return records.reduce(
    (total, record) => ({
      delivery: total.delivery + BigInt(record.deliveryCostBaseUnits),
      gross: total.gross + BigInt(record.grossAllocationBaseUnits),
      net: total.net + BigInt(record.netClaimBaseUnits),
      rollover: total.rollover + BigInt(record.rolledForwardBaseUnits),
    }),
    { delivery: 0n, gross: 0n, net: 0n, rollover: 0n },
  );
}
