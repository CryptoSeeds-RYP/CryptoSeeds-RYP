import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (isMain(import.meta.url)) {
  await main();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envPath = options.envPath ?? ".env.devnet.example";
  const statusResult = runJsonCommand(["scripts/check-devnet-status.mjs", "--env", envPath]);
  const statusReport = statusResult.parsed;
  let protocolInspectionResult;
  let readinessResult;

  if (statusReport?.chain?.program?.exists) {
    protocolInspectionResult = runJsonCommand(["scripts/inspect-devnet-protocol-state.mjs", "--env", envPath]);
    if (protocolInspectionResult.parsed?.status === "READY_FOR_READ_ONLY_PROTOCOL_REVIEW") {
      readinessResult = runJsonCommand([
        "scripts/check-public-testnet-readiness.mjs",
        "--profile",
        "read-only",
        "--env",
        envPath,
      ]);
    }
  }

  const recommendation = recommendDevnetNextAction({
    envPath,
    protocolInspection: protocolInspectionResult?.parsed,
    readiness: readinessResult?.parsed,
    status: statusReport,
  });
  const blockers = [
    ...(!statusReport ? ["Could not parse devnet status report."] : []),
    ...(statusResult.exitCode !== 0 ? [`Devnet status command exited with ${statusResult.exitCode}.`] : []),
    ...(protocolInspectionResult && !protocolInspectionResult.parsed
      ? ["Could not parse devnet protocol inspection report."]
      : []),
    ...(readinessResult && !readinessResult.parsed ? ["Could not parse public testnet readiness report."] : []),
  ];

  const report = {
    status: blockers.length === 0 ? "NEXT_ACTION_READY" : "NEXT_ACTION_BLOCKED",
    envSource: normalizeEnvPath(envPath),
    generatedAt: new Date().toISOString(),
    sourceStatuses: {
      devnetStatus: statusReport?.status ?? null,
      protocolInspection: protocolInspectionResult?.parsed?.status ?? null,
      publicTestnetReadiness: readinessResult?.parsed?.status ?? null,
    },
    recommendation,
    blockers,
    safetyAttestation: {
      readOnly: true,
      noTransactionsSubmitted: true,
      noWalletBroadcast: true,
      noLocalKeypairsCreated: true,
      noProtocolMutation: true,
    },
  };

  console.log(JSON.stringify(report, null, 2));

  if (options.strict && blockers.length > 0) {
    process.exit(1);
  }
}

export function recommendDevnetNextAction({
  envPath = ".env.devnet.example",
  protocolInspection,
  readiness,
  status,
}) {
  if (!status) {
    return commandRecommendation({
      id: "rerun_status",
      command: `npm run devnet:status -- --env ${envPath}`,
      reason: "The devnet status report could not be parsed.",
      risk: "READ_ONLY",
    });
  }

  if (missingRewardVaultKeypairs(status)) {
    return commandRecommendation({
      id: "prepare_reward_vault_keypairs",
      command: `npm run devnet:vaults:prep -- --env ${envPath}`,
      reason: "One or more program-controlled reward-vault token-account keypairs are missing locally.",
      risk: "LOCAL_IGNORED_FILES_ONLY",
    });
  }

  const authority = status.chain?.authority;
  if (!authority?.fundedForMint) {
    return {
      ...commandRecommendation({
        id: "fund_devnet_authority",
        command: `npm run devnet:funding:packet -- --env ${envPath}`,
        reason: "The devnet authority does not have enough SOL to create the test mint.",
        risk: "READ_ONLY",
      }),
      manualAction: `Fund ${status.config.adminAuthorityAddress} with at least ${authority?.minimumMintSolRequired ?? 0.1} devnet SOL; ${authority?.minimumDeploySolRecommended ?? 3} SOL is recommended before deployment.`,
    };
  }

  if (!status.chain?.mint?.exists) {
    return commandRecommendation({
      id: "create_devnet_test_mint",
      command: `npm run devnet:mint:test -- --env ${envPath}`,
      reason: "Authority funding is present but the configured devnet RYP test mint does not exist.",
      risk: "DEVNET_MUTATION",
      reviewNote: "Creates the configured devnet test mint from ignored local keypairs.",
    });
  }

  if (status.chain.mint.exists && !status.chain.mint.isMint) {
    return commandRecommendation({
      id: "investigate_invalid_mint",
      command: `npm run devnet:status -- --env ${envPath}`,
      reason: "The configured devnet RYP address exists but is not reported as an SPL mint.",
      risk: "READ_ONLY",
    });
  }

  if (!status.chain?.program?.exists) {
    if (!authority?.fundedForDeploy) {
      return {
        ...commandRecommendation({
          id: "top_up_devnet_authority",
          command: `npm run devnet:funding:packet -- --env ${envPath}`,
          reason: "The mint exists, but the authority is below the recommended program deployment balance.",
          risk: "READ_ONLY",
        }),
        manualAction: `Top up ${status.config.adminAuthorityAddress} toward ${authority?.minimumDeploySolRecommended ?? 3} devnet SOL before deployment.`,
      };
    }

    return commandRecommendation({
      id: "deploy_program_and_plan_init",
      command: `npm run devnet:bootstrap -- --env ${envPath} --deploy --init-plan`,
      reason: "The devnet mint exists and deploy funding is available, but the program is not deployed.",
      risk: "DEVNET_MUTATION",
      reviewNote: "Builds, runs prep, deploys through WSL, then prints the protocol initialization plan without executing it.",
    });
  }

  if (!protocolInspection) {
    return commandRecommendation({
      id: "inspect_protocol_state",
      command: `npm run devnet:inspect:protocol -- --env ${envPath}`,
      reason: "The program exists; protocol state should be inspected before any initialization or public preview.",
      risk: "READ_ONLY",
    });
  }

  if (protocolInspection.status !== "READY_FOR_READ_ONLY_PROTOCOL_REVIEW") {
    if (protocolInspection.blockers?.some((blocker) => blocker.includes("ProtocolConfig account is missing"))) {
      return commandRecommendation({
        id: "plan_protocol_initialization",
        command: `npm run devnet:init:protocol -- --env ${envPath}`,
        reason: "The program is deployed but protocol config is not initialized.",
        risk: "READ_ONLY",
        reviewNote: "This prints the initialization plan only. Execute separately with --execute after reviewing derived accounts and vault custody.",
      });
    }

    return commandRecommendation({
      id: "review_protocol_inspection_blockers",
      command: `npm run devnet:inspect:protocol -- --env ${envPath}`,
      reason: "Protocol inspection is blocked by issues that need review before initialization or launch.",
      risk: "READ_ONLY",
    });
  }

  if (!readiness) {
    return commandRecommendation({
      id: "run_read_only_testnet_readiness",
      command: `npm run testnet:readiness -- --profile read-only --env ${envPath}`,
      reason: "Protocol inspection passed; run the read-only public testnet readiness gate.",
      risk: "READ_ONLY",
    });
  }

  if (readiness.status !== "READY_FOR_PUBLIC_TESTNET_REVIEW") {
    return commandRecommendation({
      id: "review_public_testnet_blockers",
      command: `npm run testnet:readiness -- --profile read-only --env ${envPath}`,
      reason: "The public testnet readiness gate is still blocked.",
      risk: "READ_ONLY",
    });
  }

  return commandRecommendation({
    id: "prepare_deployment_receipt",
    command: `npm run devnet:deployment:receipt -- --env ${envPath}`,
    reason: "Devnet protocol and read-only readiness gates are clean; prepare the deployment receipt for review.",
    risk: "READ_ONLY",
  });
}

function commandRecommendation({ command, id, reason, reviewNote, risk }) {
  return {
    command,
    id,
    reason,
    reviewNote: reviewNote ?? null,
    risk,
  };
}

function missingRewardVaultKeypairs(status) {
  return Object.values(status.local?.rewardVaultKeypairs ?? {}).some((keypair) => !keypair.address);
}

function runJsonCommand(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  });

  return {
    exitCode: result.status ?? 1,
    parsed: parseLastJsonObject(result.stdout),
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

function parseLastJsonObject(output) {
  for (const candidate of jsonObjectCandidates(output).reverse()) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Child output can include progress before the final JSON report.
    }
  }
  return undefined;
}

function jsonObjectCandidates(output) {
  const text = String(output ?? "");
  const candidates = [];
  const stack = [];
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (stack.length === 0) start = index;
      stack.push(char);
      continue;
    }
    if (char === "}" && stack.length > 0) {
      stack.pop();
      if (stack.length === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

function parseArgs(args) {
  const parsed = {
    envPath: undefined,
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
    throw new Error(`Unknown argument: ${arg}`);
  }

  const resolvedEnvPath = path.resolve(repoRoot, parsed.envPath ?? ".env.devnet.example");
  if (!existsSync(resolvedEnvPath)) {
    throw new Error(`Environment file not found: ${parsed.envPath ?? ".env.devnet.example"}`);
  }

  return parsed;
}

function requireValue(args, index, name) {
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`${name} requires a file path.`);
  }
  return args[index + 1];
}

function normalizeEnvPath(value) {
  return path.relative(repoRoot, path.resolve(repoRoot, value));
}

function isMain(moduleUrl) {
  return fileURLToPath(moduleUrl) === process.argv[1];
}
