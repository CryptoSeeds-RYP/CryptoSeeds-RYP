#!/usr/bin/env node
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha2";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const holderClaimPacketScript = path.join(repoRoot, "scripts", "prepare-holder-reward-claim-packet.mjs");
const MAX_CHILD_OUTPUT_BYTES = 64 * 1024 * 1024;
const MAX_REWARD_SECONDS = 366n * 24n * 60n * 60n;
const DEFAULT_CLAIM_WINDOW_SECONDS = MAX_REWARD_SECONDS;
const DEFAULT_EPOCH_CADENCE_SECONDS = 7n * 24n * 60n * 60n;
const ZERO_HASH = "00".repeat(32);

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.inputPath || !options.epochId || !options.authorityAddress) {
    throw new Error(
      "Usage: node scripts/prepare-reward-epoch-admin-plan.mjs <epoch-input.json> <epoch-id> --authority <pubkey> [--claim-window-seconds <seconds>] [--epoch-cadence-seconds <seconds>] [--now-unix <seconds>] [--program-id <pubkey>] [--reward-epoch-address <pubkey>]",
    );
  }

  const holderPacketResult = await runJsonScript(holderClaimPacketScript, [
    options.inputPath,
    options.epochId,
    ...options.holderPacketArgs,
  ]);
  const reviewPacket = buildRewardEpochAdminPlan({ holderPacketResult, options });

  console.log(JSON.stringify(reviewPacket, null, 2));

  if (!reviewPacket.validation.valid) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function buildRewardEpochAdminPlan({ holderPacketResult, options }) {
  const blockers = [];
  const warnings = [
    "This packet is plan-only. It does not sign, broadcast, create epochs, review epochs, cancel epochs, create claim records, or move tokens.",
    "Use the emitted planner inputs with the reviewed frontend transaction planners before any wallet-approved devnet execution.",
  ];
  const holderPacket = holderPacketResult.json;
  const authorityAddress = canonicalPublicKey(options.authorityAddress, "Authority");
  const epochId = parseU64(options.epochId, "Reward epoch id");
  const claimWindowSeconds = parseI64(options.claimWindowSeconds ?? DEFAULT_CLAIM_WINDOW_SECONDS, "Claim window seconds");
  const epochCadenceSeconds = parseI64(options.epochCadenceSeconds ?? DEFAULT_EPOCH_CADENCE_SECONDS, "Reward epoch cadence seconds");
  const nowUnix = options.nowUnix === undefined ? BigInt(Math.floor(Date.now() / 1000)) : parseI64(options.nowUnix, "Now timestamp");

  if (holderPacketResult.exitCode !== 0) {
    blockers.push("Holder reward claim packet did not pass validation.");
  }
  if (holderPacket?.exportVersion !== "holder-reward-claim-packet/v1") {
    blockers.push("Input pipeline did not emit holder-reward-claim-packet/v1.");
  }
  if (holderPacket?.status !== "READY_FOR_REVIEW") {
    blockers.push("Holder reward claim packet is not READY_FOR_REVIEW.");
  }
  if (holderPacket?.validation?.valid !== true) {
    blockers.push(...(holderPacket?.validation?.blockers ?? ["Holder reward claim packet validation failed."]));
  }
  if (holderPacket?.draft?.validation?.valid !== true) {
    blockers.push(...(holderPacket?.draft?.validation?.blockers ?? ["Holder reward draft validation failed."]));
  }
  if (holderPacket?.claimPacket?.validation?.valid !== true) {
    blockers.push(...(holderPacket?.claimPacket?.validation?.blockers ?? ["Claim Merkle packet validation failed."]));
  }

  const draft = holderPacket?.draft;
  const holderEpoch = draft?.holderEpoch;
  if (!holderEpoch) {
    blockers.push("Holder reward draft is missing holderEpoch.");
  }

  let snapshotTakenAtUnix = 0n;
  let rewardPoolAmount = 0n;
  let distributedNetAmount = 0n;
  let reservedDeliveryCostAmount = 0n;
  let rolledForwardAmount = 0n;
  let claimMerkleRoot = String(holderPacket?.claimMerkleRoot ?? "").trim().toLowerCase();
  let exclusionListHash = ZERO_HASH;

  if (holderEpoch) {
    snapshotTakenAtUnix = isoTimestampToUnix(holderEpoch.snapshotTakenAt, "Snapshot timestamp");
    rewardPoolAmount = parseU64(holderEpoch.rewardPoolBaseUnits, "Reward pool amount");
    distributedNetAmount = parseU64(holderEpoch.distributedNetBaseUnits, "Distributed net amount");
    reservedDeliveryCostAmount = parseU64(holderEpoch.reservedDeliveryCostBaseUnits, "Reserved delivery cost amount");
    rolledForwardAmount = parseU64(holderEpoch.rolledForwardBaseUnits, "Rolled-forward amount");
    exclusionListHash = buildExclusionListHash(draft);
  }

  if (!isBytes32Hex(claimMerkleRoot)) {
    blockers.push("Claim Merkle root must be a 32-byte hex string.");
    claimMerkleRoot = ZERO_HASH;
  } else if (claimMerkleRoot === ZERO_HASH) {
    blockers.push("Claim Merkle root cannot be the zero hash for a payable holder epoch.");
  }

  blockers.push(...rewardEpochDraftBlockers({
    claimWindowSeconds,
    distributedNetAmount,
    epochCadenceSeconds,
    nowUnix,
    reservedDeliveryCostAmount,
    rewardPoolAmount,
    rolledForwardAmount,
    snapshotTakenAtUnix,
  }));

  const draftPlannerInput = {
    authorityAddress,
    epochId: epochId.toString(),
    snapshotTakenAtUnix: snapshotTakenAtUnix.toString(),
    claimWindowSeconds: claimWindowSeconds.toString(),
    rewardPoolAmountBaseUnits: rewardPoolAmount.toString(),
    distributedNetAmountBaseUnits: distributedNetAmount.toString(),
    reservedDeliveryCostAmountBaseUnits: reservedDeliveryCostAmount.toString(),
    rolledForwardAmountBaseUnits: rolledForwardAmount.toString(),
    exclusionListHash,
    claimMerkleRoot,
    epochCadenceSeconds: epochCadenceSeconds.toString(),
    nowUnix: nowUnix.toString(),
  };
  const reviewPlannerInput = {
    authorityAddress,
    epochId: epochId.toString(),
  };
  const cancelPlannerInput = {
    authorityAddress,
    epochId: epochId.toString(),
  };

  return {
    exportVersion: "reward-epoch-admin-plan/v1",
    status: blockers.length === 0 ? "READY_FOR_REVIEW" : "BLOCKED",
    executionMode: "PLAN_ONLY",
    noTransactionsSubmitted: true,
    authorityAddress,
    epochId: epochId.toString(),
    rewardRole: holderPacket?.rewardRole ?? "HOLDER_REWARD",
    rewardMint: draft?.rewardMint ?? null,
    claimMerkleRoot,
    exclusionListHash,
    sourcePacket: {
      exportVersion: holderPacket?.exportVersion ?? null,
      status: holderPacket?.status ?? null,
      claimPacketExportVersion: holderPacket?.claimPacket?.exportVersion ?? null,
      claimRecordCount: holderPacket?.claimPacket?.records?.length ?? 0,
    },
    plannerInputs: {
      draftRewardEpoch: draftPlannerInput,
      reviewRewardEpoch: reviewPlannerInput,
      cancelRewardEpoch: cancelPlannerInput,
    },
    transactionPlannerMapping: [
      {
        action: "DRAFT_REWARD_EPOCH",
        instructionName: "draft_reward_epoch",
        use: "buildDraftRewardEpochTransactionPlan(plannerInputs.draftRewardEpoch)",
        precondition: "Reward config and every required reward vault state must be initialized and verified on-chain.",
      },
      {
        action: "REVIEW_REWARD_EPOCH",
        instructionName: "review_reward_epoch",
        use: "buildReviewRewardEpochTransactionPlan(plannerInputs.reviewRewardEpoch)",
        precondition: "Only review after the live RewardEpoch account matches the reviewed packet and has no recorded claims.",
      },
      {
        action: "CANCEL_REWARD_EPOCH",
        instructionName: "cancel_reward_epoch",
        use: "buildCancelRewardEpochTransactionPlan(plannerInputs.cancelRewardEpoch)",
        precondition: "Only cancel a drafted or reviewed epoch before claim records or net claims are recorded.",
      },
    ],
    validation: {
      valid: blockers.length === 0,
      blockers: [...new Set(blockers)],
      warnings,
    },
    holderPacket,
  };
}

function rewardEpochDraftBlockers({
  claimWindowSeconds,
  distributedNetAmount,
  epochCadenceSeconds,
  nowUnix,
  reservedDeliveryCostAmount,
  rewardPoolAmount,
  rolledForwardAmount,
  snapshotTakenAtUnix,
}) {
  const blockers = [];
  if (claimWindowSeconds <= 0n || claimWindowSeconds > MAX_REWARD_SECONDS) {
    blockers.push("Reward claim window is outside protocol bounds.");
  }
  if (epochCadenceSeconds <= 0n || epochCadenceSeconds > MAX_REWARD_SECONDS) {
    blockers.push("Reward epoch cadence is outside protocol bounds.");
  }
  if (rewardPoolAmount <= 0n) {
    blockers.push("Reward epoch pool amount must be greater than zero.");
  }
  if (distributedNetAmount + reservedDeliveryCostAmount + rolledForwardAmount !== rewardPoolAmount) {
    blockers.push("Reward epoch accounting must balance.");
  }
  if (snapshotTakenAtUnix > nowUnix) {
    blockers.push("Reward epoch snapshot cannot be in the future.");
  }
  if (nowUnix - snapshotTakenAtUnix > epochCadenceSeconds) {
    blockers.push("Reward epoch snapshot is older than the configured cadence.");
  }
  return blockers;
}

function buildExclusionListHash(draft) {
  const holderEpoch = draft?.holderEpoch;
  const excluded = (holderEpoch?.payouts ?? [])
    .filter((payout) => payout.status === "EXCLUDED")
    .map((payout) => ({
      walletAddress: canonicalPublicKey(payout.walletAddress, "Excluded wallet"),
      reason: String(payout.reason ?? "").trim(),
    }))
    .sort((left, right) => left.walletAddress.localeCompare(right.walletAddress));

  if (excluded.length === 0) {
    return ZERO_HASH;
  }

  const payload = JSON.stringify({
    exportVersion: "reward-exclusion-list-hash/v1",
    holderEpochId: draft?.id ?? null,
    rewardMint: draft?.rewardMint ?? null,
    snapshotTakenAt: holderEpoch?.snapshotTakenAt ?? null,
    excluded,
  });
  return bytesToHex(sha256(Buffer.from(payload, "utf8")));
}

async function runJsonScript(scriptPath, args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: repoRoot,
      maxBuffer: MAX_CHILD_OUTPUT_BYTES,
      timeout: 30_000,
    });
    return { exitCode: 0, json: parseJsonStdout(stdout, scriptPath), stderr };
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout : "";
    if (stdout.trim()) {
      return {
        exitCode: typeof error?.code === "number" ? error.code : 1,
        json: parseJsonStdout(stdout, scriptPath),
        stderr: typeof error?.stderr === "string" ? error.stderr : "",
      };
    }
    const stderr = typeof error?.stderr === "string" ? error.stderr.trim() : "";
    throw new Error(stderr || error?.message || `Failed to run ${path.basename(scriptPath)}`);
  }
}

function parseJsonStdout(stdout, scriptPath) {
  try {
    return JSON.parse(stdout.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(`${path.basename(scriptPath)} did not emit valid JSON.`);
  }
}

function parseArgs(args) {
  const positional = [];
  const holderPacketArgs = [];
  const parsed = {
    authorityAddress: undefined,
    claimWindowSeconds: undefined,
    epochCadenceSeconds: undefined,
    holderPacketArgs,
    inputPath: undefined,
    nowUnix: undefined,
    epochId: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--authority") {
      parsed.authorityAddress = requireValue(args[index + 1], arg);
      index += 1;
      continue;
    }
    if (arg === "--claim-window-seconds") {
      parsed.claimWindowSeconds = requireValue(args[index + 1], arg);
      index += 1;
      continue;
    }
    if (arg === "--epoch-cadence-seconds") {
      parsed.epochCadenceSeconds = requireValue(args[index + 1], arg);
      index += 1;
      continue;
    }
    if (arg === "--now-unix") {
      parsed.nowUnix = requireValue(args[index + 1], arg);
      index += 1;
      continue;
    }
    if (arg === "--program-id" || arg === "--reward-epoch-address") {
      const value = requireValue(args[index + 1], arg);
      holderPacketArgs.push(arg, value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unsupported option: ${arg}`);
    }
    positional.push(arg);
  }

  parsed.inputPath = positional[0];
  parsed.epochId = positional[1];
  return parsed;
}

function requireValue(value, arg) {
  if (!value || value.startsWith("--")) {
    throw new Error(`${arg} requires a value.`);
  }
  return value;
}

function isoTimestampToUnix(value, label) {
  const date = Date.parse(String(value ?? ""));
  if (Number.isNaN(date)) {
    throw new Error(`${label} must be a valid ISO date.`);
  }
  return BigInt(Math.floor(date / 1000));
}

function parseU64(value, label) {
  const parsed = parseUnsignedBigInt(value, label);
  if (parsed > 2n ** 64n - 1n) {
    throw new Error(`${label} is outside u64 range.`);
  }
  return parsed;
}

function parseI64(value, label) {
  const parsed = parseUnsignedBigInt(value, label);
  if (parsed > 2n ** 63n - 1n) {
    throw new Error(`${label} is outside i64 range.`);
  }
  return parsed;
}

function parseUnsignedBigInt(value, label) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return BigInt(text);
}

function canonicalPublicKey(value, label) {
  try {
    return new PublicKey(String(value ?? "").trim()).toBase58();
  } catch {
    throw new Error(`${label} must be a valid Solana public key.`);
  }
}

function isBytes32Hex(value) {
  return /^[0-9a-f]{64}$/.test(value);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
