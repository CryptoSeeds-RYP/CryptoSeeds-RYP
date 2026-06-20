import { PublicKey } from "@solana/web3.js";
import { keccak_256 } from "@noble/hashes/sha3";
import type { HolderRewardEpoch, HolderRewardPayout } from "../domain/holderRewards";
import { epochAccountingIsBalanced } from "../domain/holderRewards";
import {
  deriveRewardClaimRecordAddress,
  deriveRewardEpochAddress,
  MAX_REWARD_MERKLE_PROOF_NODES,
  type RewardClaimRole,
} from "./protocolTransactionPlan";

export type RewardClaimMerkleExportInput = {
  epochId: bigint | number | string;
  holderEpoch: HolderRewardEpoch;
  rewardRole?: RewardClaimRole;
  rewardEpochAddress?: string;
};

export type RewardClaimMerkleRecord = {
  walletAddress: string;
  claimRecordAddress: string;
  payoutStatus: HolderRewardPayout["status"];
  leafIndex: string;
  leafHash: string;
  proof: string[];
  grossAllocationBaseUnits: string;
  deliveryCostBaseUnits: string;
  netClaimBaseUnits: string;
  rolledForwardBaseUnits: string;
  walletAction: "CREATE_RECORD_FROM_PROOF_THEN_CLAIM_TOKENS" | "CREATE_RECORD_FROM_PROOF_THEN_MARK_ROLLOVER";
};

export type RewardClaimMerkleExport = {
  exportVersion: "reward-claim-merkle/v1";
  executionMode: "PROOF_ONLY";
  epochId: string;
  rewardEpochAddress: string;
  rewardMint: string;
  rewardRole: RewardClaimRole;
  claimMerkleRoot: string;
  records: RewardClaimMerkleRecord[];
  summary: {
    recordCount: number;
    payNowCount: number;
    rolloverCount: number;
    excludedCount: number;
    grossAllocationBaseUnits: string;
    deliveryCostBaseUnits: string;
    netClaimBaseUnits: string;
    rolledForwardBaseUnits: string;
    maxProofNodes: number;
  };
  validation: {
    valid: boolean;
    blockers: string[];
    warnings: string[];
  };
  warnings: string[];
};

const REWARD_ROLE_VARIANTS: Record<RewardClaimRole, number> = {
  HOLDER_REWARD: 0,
  STAKER_REWARD: 1,
};

const ZERO_ROOT = "00".repeat(32);

export function buildRewardClaimMerkleExport({
  epochId,
  holderEpoch,
  rewardEpochAddress = deriveRewardEpochAddress(epochId),
  rewardRole = "HOLDER_REWARD",
}: RewardClaimMerkleExportInput): RewardClaimMerkleExport {
  const rewardEpoch = new PublicKey(rewardEpochAddress);
  const includedPayouts = holderEpoch.payouts.filter(
    (payout) => payout.status !== "EXCLUDED" && payout.grossAllocationBaseUnits > 0n,
  );
  const leaves = includedPayouts.map((payout, index) =>
    rewardClaimLeafHash({
      deliveryCostAmountBaseUnits: payout.deliveryCostBaseUnits,
      grossAllocationAmountBaseUnits: payout.grossAllocationBaseUnits,
      leafIndex: BigInt(index),
      netClaimAmountBaseUnits: payout.netPayoutBaseUnits,
      rewardEpoch,
      rewardRole,
      rolledForwardAmountBaseUnits: payout.rolledForwardBaseUnits,
      walletAddress: payout.walletAddress,
    }),
  );
  const tree = buildIndexedMerkleTree(leaves);
  const records = includedPayouts.map((payout, index) => {
    const leafIndex = BigInt(index);
    return {
      walletAddress: payout.walletAddress,
      claimRecordAddress: deriveRewardClaimRecordAddress({
        epochId,
        rewardRole,
        walletAddress: payout.walletAddress,
      }),
      payoutStatus: payout.status,
      leafIndex: leafIndex.toString(),
      leafHash: bytesToHex(leaves[index]),
      proof: proofForLeaf(tree.levels, index).map(bytesToHex),
      grossAllocationBaseUnits: payout.grossAllocationBaseUnits.toString(),
      deliveryCostBaseUnits: payout.deliveryCostBaseUnits.toString(),
      netClaimBaseUnits: payout.netPayoutBaseUnits.toString(),
      rolledForwardBaseUnits: payout.rolledForwardBaseUnits.toString(),
      walletAction:
        payout.netPayoutBaseUnits > 0n
          ? "CREATE_RECORD_FROM_PROOF_THEN_CLAIM_TOKENS"
          : "CREATE_RECORD_FROM_PROOF_THEN_MARK_ROLLOVER",
    } satisfies RewardClaimMerkleRecord;
  });
  const summary = summarizeMerkleRecords(holderEpoch, records);
  const validation = validateMerkleExport({ holderEpoch, records, summary });

  return {
    exportVersion: "reward-claim-merkle/v1",
    executionMode: "PROOF_ONLY",
    epochId: epochId.toString(),
    rewardEpochAddress: rewardEpoch.toBase58(),
    rewardMint: holderEpoch.rewardMint,
    rewardRole,
    claimMerkleRoot: tree.root ? bytesToHex(tree.root) : ZERO_ROOT,
    records,
    summary,
    validation,
    warnings: [
      "Merkle exports are proof data only; no claim record or payout transaction is signed or broadcast here.",
      "The exported claimMerkleRoot must match the root passed into draft_reward_epoch for this epoch id.",
    ],
  };
}

export function rewardClaimLeafHash({
  deliveryCostAmountBaseUnits,
  grossAllocationAmountBaseUnits,
  leafIndex,
  netClaimAmountBaseUnits,
  rewardEpoch,
  rewardRole,
  rolledForwardAmountBaseUnits,
  walletAddress,
}: {
  deliveryCostAmountBaseUnits: bigint;
  grossAllocationAmountBaseUnits: bigint;
  leafIndex: bigint;
  netClaimAmountBaseUnits: bigint;
  rewardEpoch: PublicKey;
  rewardRole: RewardClaimRole;
  rolledForwardAmountBaseUnits: bigint;
  walletAddress: string;
}) {
  return keccakHash([
    textBytes("cryptoseeds-reward-claim-v1"),
    rewardEpoch.toBytes(),
    Uint8Array.of(REWARD_ROLE_VARIANTS[rewardRole]),
    new PublicKey(walletAddress).toBytes(),
    u64LeBytes(grossAllocationAmountBaseUnits),
    u64LeBytes(deliveryCostAmountBaseUnits),
    u64LeBytes(netClaimAmountBaseUnits),
    u64LeBytes(rolledForwardAmountBaseUnits),
    u64LeBytes(leafIndex),
  ]);
}

export function rewardMerkleNodeHash(left: Uint8Array, right: Uint8Array) {
  return keccakHash([textBytes("cryptoseeds-merkle-node-v1"), left, right]);
}

function buildIndexedMerkleTree(leaves: Uint8Array[]) {
  if (leaves.length === 0) {
    return {
      root: undefined,
      levels: [] as Uint8Array[][],
    };
  }

  const levels: Uint8Array[][] = [leaves];
  let currentLevel = leaves;

  while (currentLevel.length > 1) {
    const nextLevel: Uint8Array[] = [];
    for (let index = 0; index < currentLevel.length; index += 2) {
      const left = currentLevel[index];
      const right = currentLevel[index + 1] ?? left;
      nextLevel.push(rewardMerkleNodeHash(left, right));
    }
    levels.push(nextLevel);
    currentLevel = nextLevel;
  }

  return {
    root: currentLevel[0],
    levels,
  };
}

function proofForLeaf(levels: Uint8Array[][], leafIndex: number) {
  const proof: Uint8Array[] = [];
  let index = leafIndex;

  for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex += 1) {
    const level = levels[levelIndex];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(level[siblingIndex] ?? level[index]);
    index = Math.floor(index / 2);
  }

  return proof;
}

function summarizeMerkleRecords(
  holderEpoch: HolderRewardEpoch,
  records: RewardClaimMerkleRecord[],
): RewardClaimMerkleExport["summary"] {
  const totals = records.reduce(
    (total, record) => ({
      delivery: total.delivery + BigInt(record.deliveryCostBaseUnits),
      gross: total.gross + BigInt(record.grossAllocationBaseUnits),
      net: total.net + BigInt(record.netClaimBaseUnits),
      rollover: total.rollover + BigInt(record.rolledForwardBaseUnits),
    }),
    { delivery: 0n, gross: 0n, net: 0n, rollover: 0n },
  );

  return {
    recordCount: records.length,
    payNowCount: records.filter((record) => BigInt(record.netClaimBaseUnits) > 0n).length,
    rolloverCount: records.filter((record) => BigInt(record.netClaimBaseUnits) === 0n).length,
    excludedCount: holderEpoch.payouts.filter((payout) => payout.status === "EXCLUDED").length,
    grossAllocationBaseUnits: totals.gross.toString(),
    deliveryCostBaseUnits: totals.delivery.toString(),
    netClaimBaseUnits: totals.net.toString(),
    rolledForwardBaseUnits: totals.rollover.toString(),
    maxProofNodes: records.reduce((max, record) => Math.max(max, record.proof.length), 0),
  };
}

function validateMerkleExport({
  holderEpoch,
  records,
  summary,
}: {
  holderEpoch: HolderRewardEpoch;
  records: RewardClaimMerkleRecord[];
  summary: RewardClaimMerkleExport["summary"];
}): RewardClaimMerkleExport["validation"] {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (records.length === 0) {
    blockers.push("Merkle export requires at least one non-excluded, non-zero holder payout.");
  }
  if (!epochAccountingIsBalanced(holderEpoch)) {
    blockers.push("Holder reward epoch accounting is not balanced.");
  }
  if (BigInt(summary.grossAllocationBaseUnits) !== holderEpoch.rewardPoolBaseUnits) {
    blockers.push("Merkle gross allocations must equal the holder reward pool.");
  }
  if (BigInt(summary.deliveryCostBaseUnits) !== holderEpoch.reservedDeliveryCostBaseUnits) {
    blockers.push("Merkle delivery costs must equal the holder epoch delivery reserve.");
  }
  if (BigInt(summary.netClaimBaseUnits) !== holderEpoch.distributedNetBaseUnits) {
    blockers.push("Merkle net claims must equal the holder epoch distributed net amount.");
  }
  if (BigInt(summary.rolledForwardBaseUnits) !== holderEpoch.rolledForwardBaseUnits) {
    blockers.push("Merkle rollover amounts must equal the holder epoch rollover amount.");
  }
  if (summary.maxProofNodes > MAX_REWARD_MERKLE_PROOF_NODES) {
    blockers.push(`Merkle proofs cannot exceed ${MAX_REWARD_MERKLE_PROOF_NODES} nodes.`);
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  };
}

function keccakHash(chunks: Uint8Array[]) {
  const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const concatenated = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.length;
  }
  return keccak_256(concatenated);
}

function u64LeBytes(value: bigint) {
  if (value < 0n || value > 2n ** 64n - 1n) {
    throw new Error("Reward claim Merkle value is outside u64 range.");
  }
  const bytes = new Uint8Array(8);
  let cursor = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(cursor & 0xffn);
    cursor >>= 8n;
  }
  return bytes;
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
