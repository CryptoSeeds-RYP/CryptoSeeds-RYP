import { readFile } from "node:fs/promises";
import { PublicKey } from "@solana/web3.js";
import { keccak_256 } from "@noble/hashes/sha3";

const PLACEHOLDER_PROGRAM_ID = "FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL";
const REWARD_CONFIG_SEED = "reward-config";
const REWARD_EPOCH_SEED = "reward-epoch";
const REWARD_CLAIM_SEED = "reward-claim";
const REWARD_ROLE_SPECS = {
  HOLDER_REWARD: { seed: "holder-reward", variant: 0 },
  STAKER_REWARD: { seed: "staker-reward", variant: 1 },
};
const ZERO_ROOT = "00".repeat(32);

const options = parseArgs(process.argv.slice(2));

if (!options.inputPath || !options.epochId) {
  console.error(
    "Usage: node scripts/prepare-reward-claim-merkle.mjs <reward-epoch-draft.json> <epoch-id> [--program-id <pubkey>] [--reward-role HOLDER_REWARD|STAKER_REWARD] [--reward-epoch-address <pubkey>]",
  );
  process.exit(1);
}

const draft = JSON.parse((await readFile(options.inputPath, "utf8")).replace(/^\uFEFF/, ""));
const rewardRole = options.rewardRole ?? "HOLDER_REWARD";
const roleSpec = REWARD_ROLE_SPECS[rewardRole];
if (!roleSpec) {
  throw new Error(`Unsupported reward role: ${rewardRole}`);
}

const programId = new PublicKey(options.programId ?? process.env.VITE_CRYPTOSEEDS_PROGRAM_ID ?? PLACEHOLDER_PROGRAM_ID);
const epochId = parseU64(options.epochId, "Reward epoch id");
const rewardEpoch = options.rewardEpochAddress
  ? new PublicKey(options.rewardEpochAddress)
  : deriveRewardEpochAddress({ epochId, programId });
const payoutRows = draft.holderEpoch?.payouts ?? [];
const included = payoutRows.filter((payout) => payout.status !== "EXCLUDED" && BigInt(payout.grossAllocationBaseUnits) > 0n);
const leaves = included.map((payout, index) =>
  rewardClaimLeafHash({
    deliveryCostAmount: BigInt(payout.deliveryCostBaseUnits),
    grossAllocationAmount: BigInt(payout.grossAllocationBaseUnits),
    leafIndex: BigInt(index),
    netClaimAmount: BigInt(payout.netPayoutBaseUnits),
    rewardEpoch,
    roleSpec,
    rolledForwardAmount: BigInt(payout.rolledForwardBaseUnits),
    wallet: new PublicKey(payout.walletAddress),
  }),
);
const tree = buildIndexedMerkleTree(leaves);
const records = included.map((payout, index) => ({
  walletAddress: payout.walletAddress,
  claimRecordAddress: deriveRewardClaimAddress({
    programId,
    rewardEpoch,
    roleSeed: roleSpec.seed,
    wallet: new PublicKey(payout.walletAddress),
  }).toBase58(),
  payoutStatus: payout.status,
  leafIndex: index.toString(),
  leafHash: bytesToHex(leaves[index]),
  proof: proofForLeaf(tree.levels, index).map(bytesToHex),
  grossAllocationBaseUnits: payout.grossAllocationBaseUnits,
  deliveryCostBaseUnits: payout.deliveryCostBaseUnits,
  netClaimBaseUnits: payout.netPayoutBaseUnits,
  rolledForwardBaseUnits: payout.rolledForwardBaseUnits,
  walletAction:
    BigInt(payout.netPayoutBaseUnits) > 0n
      ? "CREATE_RECORD_FROM_PROOF_THEN_CLAIM_TOKENS"
      : "CREATE_RECORD_FROM_PROOF_THEN_MARK_ROLLOVER",
}));
const summary = summarize({ draft, records });
const claimMerkleRoot = tree.root ? bytesToHex(tree.root) : ZERO_ROOT;
const validation = validate({ claimMerkleRoot, draft, records, summary });
const exportPacket = {
  exportVersion: "reward-claim-merkle/v1",
  executionMode: "PROOF_ONLY",
  epochId: epochId.toString(),
  programId: programId.toBase58(),
  rewardEpochAddress: rewardEpoch.toBase58(),
  rewardMint: draft.rewardMint,
  rewardRole,
  claimMerkleRoot,
  records,
  summary,
  validation,
  warnings: [
    "Merkle exports are proof data only; no claim record or payout transaction is signed or broadcast here.",
    "The exported claimMerkleRoot must match the root passed into draft_reward_epoch for this epoch id.",
  ],
};

console.log(JSON.stringify(exportPacket, null, 2));

if (!validation.valid) {
  process.exitCode = 1;
}

function buildIndexedMerkleTree(leaves) {
  if (leaves.length === 0) {
    return { levels: [], root: undefined };
  }

  const levels = [leaves];
  let current = leaves;
  while (current.length > 1) {
    const next = [];
    for (let index = 0; index < current.length; index += 2) {
      const left = current[index];
      const right = current[index + 1] ?? left;
      next.push(rewardMerkleNodeHash(left, right));
    }
    levels.push(next);
    current = next;
  }

  return { levels, root: current[0] };
}

function proofForLeaf(levels, leafIndex) {
  const proof = [];
  let index = leafIndex;
  for (let levelIndex = 0; levelIndex < levels.length - 1; levelIndex += 1) {
    const level = levels[levelIndex];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(level[siblingIndex] ?? level[index]);
    index = Math.floor(index / 2);
  }
  return proof;
}

function rewardClaimLeafHash({
  deliveryCostAmount,
  grossAllocationAmount,
  leafIndex,
  netClaimAmount,
  rewardEpoch,
  roleSpec,
  rolledForwardAmount,
  wallet,
}) {
  return keccakHash([
    Buffer.from("cryptoseeds-reward-claim-v1"),
    rewardEpoch.toBuffer(),
    Buffer.from([roleSpec.variant]),
    wallet.toBuffer(),
    u64Buffer(grossAllocationAmount),
    u64Buffer(deliveryCostAmount),
    u64Buffer(netClaimAmount),
    u64Buffer(rolledForwardAmount),
    u64Buffer(leafIndex),
  ]);
}

function rewardMerkleNodeHash(left, right) {
  return keccakHash([Buffer.from("cryptoseeds-merkle-node-v1"), left, right]);
}

function keccakHash(buffers) {
  return Buffer.from(keccak_256(Buffer.concat(buffers)));
}

function summarize({ draft, records }) {
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
    excludedCount: (draft.holderEpoch?.payouts ?? []).filter((payout) => payout.status === "EXCLUDED").length,
    grossAllocationBaseUnits: totals.gross.toString(),
    deliveryCostBaseUnits: totals.delivery.toString(),
    netClaimBaseUnits: totals.net.toString(),
    rolledForwardBaseUnits: totals.rollover.toString(),
    maxProofNodes: records.reduce((max, record) => Math.max(max, record.proof.length), 0),
  };
}

function validate({ claimMerkleRoot, draft, records, summary }) {
  const blockers = [];
  const warnings = [];
  const holderEpoch = draft.holderEpoch;

  if (!holderEpoch) {
    blockers.push("Reward epoch draft is missing holderEpoch.");
  }
  if (records.length === 0) {
    blockers.push("Merkle export requires at least one non-excluded, non-zero holder payout.");
  }
  if (holderEpoch) {
    const balanced =
      BigInt(holderEpoch.distributedNetBaseUnits) +
        BigInt(holderEpoch.reservedDeliveryCostBaseUnits) +
        BigInt(holderEpoch.rolledForwardBaseUnits) ===
      BigInt(holderEpoch.rewardPoolBaseUnits);
    if (!balanced) blockers.push("Holder reward epoch accounting is not balanced.");
    if (BigInt(summary.grossAllocationBaseUnits) !== BigInt(holderEpoch.rewardPoolBaseUnits)) {
      blockers.push("Merkle gross allocations must equal the holder reward pool.");
    }
    if (BigInt(summary.deliveryCostBaseUnits) !== BigInt(holderEpoch.reservedDeliveryCostBaseUnits)) {
      blockers.push("Merkle delivery costs must equal the holder epoch delivery reserve.");
    }
    if (BigInt(summary.netClaimBaseUnits) !== BigInt(holderEpoch.distributedNetBaseUnits)) {
      blockers.push("Merkle net claims must equal the holder epoch distributed net amount.");
    }
    if (BigInt(summary.rolledForwardBaseUnits) !== BigInt(holderEpoch.rolledForwardBaseUnits)) {
      blockers.push("Merkle rollover amounts must equal the holder epoch rollover amount.");
    }
  }
  for (const record of records) {
    const verification = verifyRecordProof({ claimMerkleRoot, record });
    if (!verification.valid) {
      blockers.push(`Merkle proof invalid for ${record.walletAddress}: ${verification.blockers.join(" ")}`);
    }
  }

  return { valid: blockers.length === 0, blockers, warnings };
}

function verifyRecordProof({ claimMerkleRoot, record }) {
  const blockers = [];
  let node;
  let index;
  try {
    node = hexToBytes32(record.leafHash, "Reward claim leaf hash");
    index = parseU64(record.leafIndex, "Reward claim leaf index");
  } catch (error) {
    blockers.push(error instanceof Error ? error.message : "Reward claim proof input is invalid.");
    return { valid: false, blockers };
  }

  for (const [proofIndex, proofNode] of record.proof.entries()) {
    let sibling;
    try {
      sibling = hexToBytes32(proofNode, `Reward claim proof node ${proofIndex}`);
    } catch (error) {
      blockers.push(error instanceof Error ? error.message : `Reward claim proof node ${proofIndex} is invalid.`);
      continue;
    }
    node = index % 2n === 0n ? rewardMerkleNodeHash(node, sibling) : rewardMerkleNodeHash(sibling, node);
    index /= 2n;
  }

  const calculatedRoot = bytesToHex(node);
  if (calculatedRoot !== claimMerkleRoot) {
    blockers.push("record proof does not reconstruct the exported claim root.");
  }

  return { valid: blockers.length === 0, blockers };
}

function hexToBytes32(value, label) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(text)) {
    throw new Error(`${label} must be a 32-byte hex string.`);
  }
  return Buffer.from(text, "hex");
}

function deriveRewardEpochAddress({ epochId, programId }) {
  const rewardConfig = PublicKey.findProgramAddressSync([Buffer.from(REWARD_CONFIG_SEED)], programId)[0];
  return PublicKey.findProgramAddressSync(
    [Buffer.from(REWARD_EPOCH_SEED), rewardConfig.toBuffer(), u64Buffer(epochId)],
    programId,
  )[0];
}

function deriveRewardClaimAddress({ programId, rewardEpoch, roleSeed, wallet }) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(REWARD_CLAIM_SEED), rewardEpoch.toBuffer(), Buffer.from(roleSeed), wallet.toBuffer()],
    programId,
  )[0];
}

function u64Buffer(value) {
  if (value < 0n || value > 2n ** 64n - 1n) {
    throw new Error("Value is outside u64 range.");
  }
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

function parseU64(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  const parsed = BigInt(text);
  if (parsed > 2n ** 64n - 1n) {
    throw new Error(`${label} is outside u64 range.`);
  }
  return parsed;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseArgs(args) {
  const parsed = {
    inputPath: args[0],
    epochId: args[1],
    programId: undefined,
    rewardEpochAddress: undefined,
    rewardRole: undefined,
  };

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];
    const value = args[index + 1];
    if (arg === "--program-id") {
      requireValue(value, arg);
      parsed.programId = value;
      index += 1;
    } else if (arg === "--reward-epoch-address") {
      requireValue(value, arg);
      parsed.rewardEpochAddress = value;
      index += 1;
    } else if (arg === "--reward-role") {
      requireValue(value, arg);
      parsed.rewardRole = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function requireValue(value, arg) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${arg} requires a value.`);
  }
}
