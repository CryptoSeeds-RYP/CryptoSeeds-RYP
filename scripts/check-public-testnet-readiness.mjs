#!/usr/bin/env node
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runningAsMain = isMain(import.meta.url);

const options = runningAsMain
  ? parseArgs(process.argv.slice(2))
  : { envPath: undefined, profile: "wallet-execution", strict: false };
const envSource = options.envPath ?? ".env.devnet.example";
const readinessProfile = options.profile;
const checkDefinitions = buildCheckDefinitions({ envSource, profile: readinessProfile });

if (runningAsMain) {
  const checkResults = [];

  for (const definition of checkDefinitions) {
    checkResults.push(await runCheck(definition));
  }

  const report = buildPublicTestnetReadinessReport({
    checkResults,
    envSource,
    profile: readinessProfile,
  });

  console.log(JSON.stringify(report, null, 2));

  if (options.strict && !report.status.startsWith("READY_")) {
    process.exit(1);
  }
}

export function buildPublicTestnetReadinessReport({
  checkResults,
  envSource,
  generatedAt = new Date().toISOString(),
  profile = "wallet-execution",
}) {
  const normalizedChecks = checkResults.map(normalizeCheckResult);
  const blockers = normalizedChecks.flatMap((check) =>
    check.blockers.map((blocker) => `${check.label}: ${blocker}`),
  );
  const warnings = normalizedChecks.flatMap((check) =>
    check.warnings.map((warning) => `${check.label}: ${warning}`),
  );
  const nextActions = dedupe(
    normalizedChecks.flatMap((check) => check.nextActions),
  );
  const operatorHandoff = normalizedChecks.find((check) => check.operatorHandoff)?.operatorHandoff ?? null;

  return {
    exportVersion: "public-testnet-readiness/v1",
    status: blockers.length === 0 ? readyStatusForProfile(profile) : "BLOCKED",
    generatedAt,
    envSource,
    profile,
    checks: normalizedChecks,
    blockers,
    warnings,
    operatorHandoff,
    nextActions: blockers.length > 0
      ? nextActions
      : readyNextActionsForProfile(profile),
  };
}

export function buildCheckDefinitions({ envSource = ".env.devnet.example", profile = "wallet-execution" } = {}) {
  const definitions = [
    {
      id: "ops",
      label: "Ops readiness",
      script: "scripts/check-ops-readiness.mjs",
      args: [],
    },
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
  ];

  if (profile === "wallet-execution") {
    definitions.push({
      id: "devnet-readiness",
      label: "Devnet broadcast readiness",
      script: "scripts/check-devnet-readiness.mjs",
      args: ["--env", envSource],
    });
  }

  return definitions;
}

export function parseJsonStdout(stdout) {
  const trimmed = String(stdout ?? "").trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

async function runCheck(definition) {
  const scriptPath = path.join(repoRoot, definition.script);
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath, ...definition.args],
      {
        cwd: repoRoot,
        maxBuffer: 1024 * 1024 * 8,
        timeout: 90_000,
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
      exitCode: Number.isInteger(error?.code) ? error.code : 1,
      parsed: parseJsonStdout(error?.stdout),
      stderr: String(error?.stderr ?? ""),
      errorMessage: error instanceof Error ? error.message : "Unknown check failure.",
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
  const parsedOperatorHandoff = isRecord(parsed?.operatorHandoff) ? parsed.operatorHandoff : null;

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
    operatorHandoff: parsedOperatorHandoff,
  };
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseArgs(args) {
  const parsed = {
    envPath: undefined,
    profile: "wallet-execution",
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
    throw new Error(`${name} requires a file path.`);
  }
  return args[index + 1];
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function parseProfile(value) {
  if (value === "read-only" || value === "wallet-execution") return value;
  throw new Error("--profile must be read-only or wallet-execution.");
}

function readyStatusForProfile(profile) {
  return profile === "read-only"
    ? "READY_FOR_READ_ONLY_TESTNET_PREVIEW"
    : "READY_FOR_PUBLIC_TESTNET_REVIEW";
}

function readyNextActionsForProfile(profile) {
  if (profile === "read-only") {
    return [
      "Run a human release review before sharing the read-only devnet preview.",
      "Keep VITE_SOLANA_BROADCAST_ENABLED=false until the wallet-execution profile passes.",
    ];
  }

  return [
    "Run a final public testnet release review with broadcast still disabled.",
    "Enable wallet-approved transaction categories one at a time after decoded devnet inspection.",
  ];
}

function isMain(moduleUrl) {
  return fileURLToPath(moduleUrl) === process.argv[1];
}
