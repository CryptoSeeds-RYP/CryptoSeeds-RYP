#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { parseJsonStdout } from "./check-public-testnet-readiness.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runningAsMain = isMain(import.meta.url);
const options = runningAsMain
  ? parseArgs(process.argv.slice(2))
  : { envPath: undefined, profile: "read-only", strict: false };

if (runningAsMain) {
  const envSource = options.envPath ?? ".env.devnet.example";
  const checkResults = [];

  for (const definition of buildDeploymentReceiptCheckDefinitions({
    envSource,
    profile: options.profile,
  })) {
    checkResults.push(await runCheck(definition));
  }

  const report = buildDevnetDeploymentReceipt({
    artifact: readLocalProgramArtifact(),
    checkResults,
    envSource,
    profile: options.profile,
  });

  console.log(JSON.stringify(report, null, 2));

  if (options.strict && report.status === "BLOCKED") {
    process.exit(1);
  }
}

export function buildDeploymentReceiptCheckDefinitions({
  envSource = ".env.devnet.example",
  profile = "read-only",
} = {}) {
  return [
    {
      id: "devnet-status",
      label: "Devnet status",
      script: "scripts/check-devnet-status.mjs",
      args: ["--env", envSource],
    },
    {
      id: "devnet-program",
      label: "Devnet program inspection",
      script: "scripts/check-devnet-program.mjs",
      args: ["--env", envSource],
    },
    {
      id: "devnet-protocol-state",
      label: "Devnet protocol state inspection",
      script: "scripts/inspect-devnet-protocol-state.mjs",
      args: ["--env", envSource],
    },
    {
      id: "public-testnet-readiness",
      label: `Public testnet readiness (${profile})`,
      script: "scripts/check-public-testnet-readiness.mjs",
      args: ["--profile", profile, "--env", envSource],
    },
  ];
}

export function buildDevnetDeploymentReceipt({
  artifact = null,
  checkResults,
  envSource,
  generatedAt = new Date().toISOString(),
  profile = "read-only",
}) {
  const normalizedChecks = checkResults.map(normalizeCheckResult);
  const topLevelChecks = normalizedChecks.filter(isTopLevelReceiptCheck);
  const blockers = topLevelChecks.flatMap((check) =>
    check.blockers.map((blocker) => `${check.label}: ${blocker}`),
  );
  const warnings = topLevelChecks.flatMap((check) =>
    check.warnings.map((warning) => `${check.label}: ${warning}`),
  );
  const nextActions = dedupe(topLevelChecks.flatMap((check) => check.nextActions));
  const devnetStatus = parsedCheck(checkResults, "devnet-status");
  const protocolState = parsedCheck(checkResults, "devnet-protocol-state");
  const readiness = parsedCheck(checkResults, "public-testnet-readiness");
  const allChecksReady = normalizedChecks.every((check) => check.status === "READY");

  return {
    exportVersion: "devnet-deployment-receipt/v1",
    status: allChecksReady ? readyStatusForProfile(profile) : "BLOCKED",
    generatedAt,
    envSource,
    profile,
    executionMode: "READ_ONLY",
    localArtifact: artifact,
    deployment: {
      authority: devnetStatus?.chain?.authority ?? null,
      config: devnetStatus?.config ?? protocolState?.config ?? null,
      mint: devnetStatus?.chain?.mint ?? null,
      program: devnetStatus?.chain?.program ?? protocolState?.program ?? null,
      protocolTargets: devnetStatus?.protocolTargets ?? protocolState?.targets ?? null,
    },
    readiness: readiness
      ? {
          profile: readiness.profile ?? profile,
          status: readiness.status ?? null,
          blockers: Array.isArray(readiness.blockers) ? readiness.blockers : [],
          warnings: Array.isArray(readiness.warnings) ? readiness.warnings : [],
        }
      : null,
    checks: normalizedChecks,
    blockers,
    warnings,
    nextActions: blockers.length > 0 ? nextActions : readyNextActionsForProfile(profile),
    safetyAttestation: {
      devnetOnly: true,
      noTransactionsSubmitted: true,
      noProtocolMutation: true,
      noWalletBroadcastEnabledByReceipt: true,
      receiptDoesNotAuthorizeLaunch: true,
    },
  };
}

async function runCheck(definition) {
  const scriptPath = path.join(repoRoot, definition.script);
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, ...definition.args],
      {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024 * 16,
        timeout: 120_000,
      },
    );

    return {
      ...definition,
      exitCode: 0,
      parsed: parseJsonStdout(stdout),
      stderr,
    };
  } catch (error) {
    return {
      ...definition,
      errorMessage: error instanceof Error ? error.message : "Unknown check failure.",
      exitCode: Number.isInteger(error?.code) ? error.code : 1,
      parsed: parseJsonStdout(error?.stdout),
      stderr: String(error?.stderr ?? ""),
    };
  }
}

function normalizeCheckResult(check) {
  const parsed = check.parsed;
  const parsedBlockers = Array.isArray(parsed?.blockers) ? parsed.blockers.map(String) : [];
  const parsedWarnings = Array.isArray(parsed?.warnings) ? parsed.warnings.map(String) : [];
  const parsedNextActions = Array.isArray(parsed?.nextActions)
    ? parsed.nextActions.map(String)
    : [];

  const commandBlockers = [];
  if (!parsed) {
    commandBlockers.push("Check did not return a parseable JSON report.");
  }
  if (
    parsed &&
    parsedBlockers.length === 0 &&
    typeof parsed.status === "string" &&
    parsed.status.includes("BLOCKED")
  ) {
    commandBlockers.push(`Check reported ${parsed.status} without blockers.`);
  }
  if (check.exitCode !== 0 && parsedBlockers.length === 0) {
    commandBlockers.push(check.errorMessage ?? `Check exited with code ${check.exitCode}.`);
  }

  const blockers = [...parsedBlockers, ...commandBlockers];

  return {
    id: check.id,
    label: check.label,
    status: blockers.length === 0 ? "READY" : "BLOCKED",
    sourceStatus: typeof parsed?.status === "string" ? parsed.status : null,
    exitCode: check.exitCode,
    blockers,
    warnings: parsedWarnings,
    nextActions: parsedNextActions,
  };
}

function parsedCheck(checkResults, id) {
  return checkResults.find((check) => check.id === id)?.parsed ?? null;
}

function isTopLevelReceiptCheck(check) {
  if (check.id !== "public-testnet-readiness") return true;

  // Public readiness is an aggregate of the same underlying devnet checks.
  // Surface only command/parsing failures here; otherwise the receipt would
  // duplicate every child blocker under two labels.
  return check.blockers.some((blocker) =>
    blocker.startsWith("Check did not return") ||
    blocker.startsWith("Check reported") ||
    blocker.includes("exited with code"),
  );
}

function readLocalProgramArtifact() {
  const artifactPath = [
    path.join(repoRoot, "target", "deploy", "cryptoseeds_protocol.so"),
    path.join(repoRoot, "programs", "cryptoseeds_protocol", "target", "deploy", "cryptoseeds_protocol.so"),
  ].find((candidate) => existsSync(candidate));

  if (!artifactPath) {
    return {
      exists: false,
      path: null,
      sha256: null,
      sizeBytes: 0,
    };
  }

  const artifactBytes = readFileSync(artifactPath);
  return {
    exists: true,
    path: path.relative(repoRoot, artifactPath),
    sha256: createHash("sha256").update(artifactBytes).digest("hex"),
    sizeBytes: artifactBytes.length,
  };
}

function parseArgs(args) {
  const parsed = {
    envPath: undefined,
    profile: "read-only",
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--strict") {
      parsed.strict = true;
      continue;
    }
    if (arg === "--env") {
      parsed.envPath = requireValue(args, index, "--env");
      index += 1;
      continue;
    }
    if (arg?.startsWith("--env=")) {
      parsed.envPath = arg.slice("--env=".length);
      continue;
    }
    if (arg === "--profile") {
      parsed.profile = parseProfile(requireValue(args, index, "--profile"));
      index += 1;
      continue;
    }
    if (arg?.startsWith("--profile=")) {
      parsed.profile = parseProfile(arg.slice("--profile=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function requireValue(args, index, name) {
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return args[index + 1];
}

function parseProfile(value) {
  if (value === "read-only" || value === "wallet-execution") return value;
  throw new Error("--profile must be read-only or wallet-execution.");
}

function readyStatusForProfile(profile) {
  return profile === "read-only"
    ? "READY_FOR_READ_ONLY_DEVNET_HANDOFF"
    : "READY_FOR_WALLET_EXECUTION_REVIEW";
}

function readyNextActionsForProfile(profile) {
  if (profile === "read-only") {
    return [
      "Archive this receipt with the program artifact hash before sharing the read-only preview.",
      "Keep VITE_SOLANA_BROADCAST_ENABLED=false until the wallet-execution receipt passes.",
    ];
  }

  return [
    "Run final human release review before enabling wallet-approved public testnet flows.",
    "Enable wallet-approved transaction categories one at a time after signer/account preview review.",
  ];
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function isMain(moduleUrl) {
  return fileURLToPath(moduleUrl) === process.argv[1];
}
