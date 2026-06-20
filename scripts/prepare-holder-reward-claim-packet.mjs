import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const holderEpochScript = path.join(repoRoot, "scripts", "prepare-holder-reward-epoch.mjs");
const claimMerkleScript = path.join(repoRoot, "scripts", "prepare-reward-claim-merkle.mjs");
const MAX_CHILD_OUTPUT_BYTES = 64 * 1024 * 1024;

let options;

try {
  options = parseArgs(process.argv.slice(2));
  if (!options.inputPath || !options.epochId) {
    throw new Error(
      "Usage: node scripts/prepare-holder-reward-claim-packet.mjs <epoch-input.json> <epoch-id> [--program-id <pubkey>] [--reward-role HOLDER_REWARD|STAKER_REWARD] [--reward-epoch-address <pubkey>]",
    );
  }

  const draftResult = await runJsonScript(holderEpochScript, [options.inputPath]);
  const draft = draftResult.json;

  if (draftResult.exitCode !== 0 || draft?.validation?.valid !== true) {
    emitPacket({
      claimPacket: null,
      draft,
      status: "BLOCKED",
      validation: {
        valid: false,
        blockers: [
          "Holder reward epoch draft did not pass validation.",
          ...(draft?.validation?.blockers ?? []),
        ],
        warnings: draft?.validation?.warnings ?? [],
      },
    });
    process.exit(1);
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cryptoseeds-holder-claim-packet-"));
  try {
    const draftPath = path.join(tempDir, "reward-epoch-draft.json");
    await writeFile(draftPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

    const merkleArgs = [draftPath, options.epochId, ...options.merkleArgs];
    const merkleResult = await runJsonScript(claimMerkleScript, merkleArgs);
    const claimPacket = merkleResult.json;
    const validation = validatePipelinePacket({ claimPacket, draft, merkleExitCode: merkleResult.exitCode });

    emitPacket({
      claimPacket,
      draft,
      status: validation.valid ? "READY_FOR_REVIEW" : "BLOCKED",
      validation,
    });

    if (!validation.valid) {
      process.exit(1);
    }
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function parseArgs(args) {
  const positional = [];
  const merkleArgs = [];
  const passthroughOptions = new Set(["--program-id", "--reward-role", "--reward-epoch-address"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (passthroughOptions.has(arg)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${arg} requires a value`);
      }
      merkleArgs.push(arg, value);
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Unsupported option: ${arg}`);
    }
    positional.push(arg);
  }

  return {
    inputPath: positional[0],
    epochId: positional[1],
    merkleArgs,
  };
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
  } catch (error) {
    throw new Error(`${path.basename(scriptPath)} did not emit valid JSON.`);
  }
}

function validatePipelinePacket({ claimPacket, draft, merkleExitCode }) {
  const blockers = [];
  const warnings = [
    "This packet is proof-only. It does not sign, broadcast, create claim records, or transfer tokens.",
    "Review the holder epoch draft and claimMerkleRoot before passing the root into draft_reward_epoch.",
  ];

  if (draft?.validation?.valid !== true) {
    blockers.push("Holder reward epoch draft is not valid.");
  }
  if (!claimPacket) {
    blockers.push("Claim Merkle packet is missing.");
  }
  if (claimPacket?.validation?.valid !== true || merkleExitCode !== 0) {
    blockers.push("Claim Merkle packet did not pass validation.");
    blockers.push(...(claimPacket?.validation?.blockers ?? []));
  }
  if (draft?.rewardMint && claimPacket?.rewardMint && draft.rewardMint !== claimPacket.rewardMint) {
    blockers.push("Draft reward mint does not match claim packet reward mint.");
  }
  if (claimPacket?.summary?.grossAllocationBaseUnits && draft?.holderEpoch?.rewardPoolBaseUnits) {
    if (BigInt(claimPacket.summary.grossAllocationBaseUnits) !== BigInt(draft.holderEpoch.rewardPoolBaseUnits)) {
      blockers.push("Claim packet gross allocations do not match the holder reward pool.");
    }
  }
  if (claimPacket?.claimMerkleRoot === "00".repeat(32)) {
    blockers.push("Claim Merkle root cannot be the zero root for a payable holder epoch.");
  }

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  };
}

function emitPacket({ claimPacket, draft, status, validation }) {
  console.log(
    JSON.stringify(
      {
        exportVersion: "holder-reward-claim-packet/v1",
        status,
        executionMode: "PROOF_ONLY",
        epochId: claimPacket?.epochId ?? options.epochId,
        rewardRole: claimPacket?.rewardRole ?? "HOLDER_REWARD",
        claimMerkleRoot: claimPacket?.claimMerkleRoot ?? null,
        draft,
        claimPacket,
        validation,
      },
      null,
      2,
    ),
  );
}
