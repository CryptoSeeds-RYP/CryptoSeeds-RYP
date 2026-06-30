#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (isMain(import.meta.url)) {
  const options = parseArgs(process.argv.slice(2));
  const envPath = options.envPath ?? ".env.devnet.example";
  const opsResult = runJsonCommand(["scripts/check-ops-readiness.mjs"]);
  const devnetNextResult = runJsonCommand(["scripts/recommend-devnet-next-action.mjs", "--env", envPath]);
  const readinessResult = runJsonCommand([
    "scripts/check-public-testnet-readiness.mjs",
    "--profile",
    "read-only",
    "--env",
    envPath,
  ]);

  const report = buildRypMissionStatusReport({
    envSource: normalizeEnvPath(envPath),
    generatedAt: new Date().toISOString(),
    opsReport: opsResult.parsed,
    devnetNextReport: devnetNextResult.parsed,
    readOnlyReadinessReport: readinessResult.parsed,
    commandResults: {
      ops: opsResult,
      devnetNext: devnetNextResult,
      readOnlyReadiness: readinessResult,
    },
  });

  console.log(JSON.stringify(report, null, 2));

  if (options.strict && report.status === "MISSION_BLOCKED") {
    process.exit(1);
  }
}

export function buildRypMissionStatusReport({
  commandResults = {},
  devnetNextReport,
  envSource = ".env.devnet.example",
  generatedAt = new Date().toISOString(),
  opsReport,
  readOnlyReadinessReport,
} = {}) {
  const opsReady = opsReport?.status === "READY";
  const nextRecommendation = devnetNextReport?.recommendation ?? null;
  const nextOperatorHandoff = devnetNextReport?.operatorHandoff ?? null;
  const nextActionId = nextRecommendation?.id ?? null;
  const readOnlyReady = readOnlyReadinessReport?.status === "READY_FOR_READ_ONLY_TESTNET_PREVIEW";
  const primaryFundingBlocker = nextActionId === "fund_devnet_authority";
  const devnetFundingCommand = `npm run devnet:funding:packet -- --env ${envSource}`;
  const devnetMintCommand = `npm run devnet:mint:test -- --env ${envSource}`;
  const devnetBootstrapCommand = `npm run devnet:bootstrap -- --env ${envSource} --deploy --init-plan`;
  const devnetProtocolInspectCommand = `npm run devnet:inspect:protocol -- --env ${envSource}`;
  const devnetProtocolInitCommand = `npm run devnet:init:protocol -- --env ${envSource}`;
  const testnetReadinessCommand = `npm run testnet:readiness -- --profile read-only --env ${envSource}`;
  const deploymentReceiptCommand = `npm run devnet:deployment:receipt -- --profile read-only --env ${envSource}`;
  const devnetNextCommand = `npm run devnet:next -- --env ${envSource}`;
  const childBlockers = collectChildBlockers(commandResults, {
    opsReport,
    devnetNextReport,
    readOnlyReadinessReport,
  }, {
    suppressReadOnlyReadinessBlockers: primaryFundingBlocker,
  });
  const deferredBlockers = primaryFundingBlocker && Array.isArray(readOnlyReadinessReport?.blockers)
    ? readOnlyReadinessReport.blockers.map((blocker) => `Deferred until authority funding: ${blocker}`)
    : [];

  const requiredScriptsReady = [
    "test",
    "build",
    "verify:local",
    "protocol:idl:check",
    "protocol:smoke:localnet:wsl",
    "devnet:next",
    "testnet:readiness",
    "rewards:claim-merkle",
    "rewards:epoch:admin-plan",
    "rewards:holder-claim-packet",
  ].every((scriptName) => hasRequiredScript(opsReport, scriptName));

  const phases = [
    phase({
      id: "rust_safety_slice",
      label: "Finish Current Rust Safety Slice",
      status: opsReady && requiredScriptsReady ? "LOCAL_READY" : "BLOCKED",
      summary: opsReady
        ? "Protocol safety and verification commands are registered for local review."
        : "Ops readiness must pass before the Rust safety slice is considered reviewable.",
      command: "npm run protocol:idl:check",
      blockers: opsReady ? [] : ["Ops readiness is not clean."],
    }),
    phase({
      id: "protocol_abi_lock",
      label: "Lock Protocol ABI",
      status: hasRequiredScript(opsReport, "protocol:idl:check") ? "LOCAL_READY" : "BLOCKED",
      summary: "IDL/layout drift is gated by the protocol IDL check.",
      command: "npm run protocol:idl:check",
      blockers: hasRequiredScript(opsReport, "protocol:idl:check")
        ? []
        : ["Missing protocol:idl:check package script."],
    }),
    phase({
      id: "full_local_verification",
      label: "Run Full Local Verification",
      status: opsReady ? "REVIEW_REQUIRED" : "BLOCKED",
      summary: "The status command does not run the full expensive suite; run the one-command local gate before release commits.",
      command: "npm run verify:local",
      blockers: opsReady ? [] : ["Ops readiness is not clean."],
    }),
    phase({
      id: "commit_and_push_clean_state",
      label: "Commit And Push Clean State",
      status: "REVIEW_REQUIRED",
      summary: "Confirm git cleanliness and push only after verification passes.",
      command: "git status --short --branch && git log --oneline -3",
    }),
    phase({
      id: "fund_devnet_authority",
      label: "Fund Devnet Authority",
      status: nextActionId === "fund_devnet_authority" ? "BLOCKED" : "LOCAL_READY",
      summary: nextActionId === "fund_devnet_authority"
        ? "Devnet cannot mutate until the authority wallet receives devnet SOL."
        : "Devnet authority funding is no longer the active next-action blocker.",
      command: nextActionId === "fund_devnet_authority"
        ? nextRecommendation?.command ?? devnetFundingCommand
        : devnetFundingCommand,
      manualAction: nextActionId === "fund_devnet_authority"
        ? nextRecommendation?.manualAction ?? null
        : null,
      blockers: nextActionId === "fund_devnet_authority"
        ? [nextRecommendation?.manualAction ?? "Fund the devnet authority wallet."]
        : [],
    }),
    phase({
      id: "create_devnet_test_mint",
      label: "Create Devnet Test Mint",
      status: devnetMintPhaseStatus(nextActionId),
      summary: devnetMintPhaseSummary(nextActionId),
      command: nextActionId === "create_devnet_test_mint"
        ? nextRecommendation?.command ?? devnetMintCommand
        : devnetMintCommand,
      blockers: nextActionId === "investigate_invalid_mint"
        ? ["Configured devnet RYP address exists but is not a valid SPL mint."]
        : [],
    }),
    phase({
      id: "deploy_devnet_program",
      label: "Deploy Devnet Program",
      status: devnetProgramPhaseStatus(nextActionId),
      summary: devnetProgramPhaseSummary(nextActionId),
      command: nextActionId === "deploy_program_and_plan_init" || nextActionId === "top_up_devnet_authority"
        ? nextRecommendation?.command ?? devnetBootstrapCommand
        : devnetBootstrapCommand,
      blockers: nextActionId === "top_up_devnet_authority"
        ? [nextRecommendation?.manualAction ?? "Top up the devnet authority before program deployment."]
        : [],
    }),
    phase({
      id: "initialize_devnet_protocol",
      label: "Initialize Devnet Protocol",
      status: devnetProtocolPhaseStatus(nextActionId),
      summary: devnetProtocolPhaseSummary(nextActionId),
      command: nextActionId === "inspect_protocol_state" || nextActionId === "review_protocol_inspection_blockers"
        ? nextRecommendation?.command ?? devnetProtocolInspectCommand
        : nextActionId === "plan_protocol_initialization"
          ? nextRecommendation?.command ?? devnetProtocolInitCommand
          : devnetProtocolInitCommand,
      blockers: nextActionId === "review_protocol_inspection_blockers"
        ? ["Protocol inspection blockers must be reviewed before initialization or public preview."]
        : [],
    }),
    phase({
      id: "wire_frontend_devnet_state",
      label: "Wire Frontend To Real Devnet State",
      status: readOnlyReady ? "READY_FOR_REVIEW" : "WAITING_ON_DEVNET",
      summary: readOnlyReady
        ? "Read-only public preview gates are clean enough for human release review."
        : "Frontend read-only mirrors are implemented locally, but live devnet account inspection is still blocked.",
      command: testnetReadinessCommand,
    }),
    phase({
      id: "fee_and_holder_rewards",
      label: "Complete RYP Fee And Holder Reward System",
      status: hasRequiredScript(opsReport, "rewards:holder-claim-packet") &&
        hasRequiredScript(opsReport, "rewards:epoch:admin-plan")
        ? "LOCAL_READY"
        : "BLOCKED",
      summary: "Platform fee routing, holder claim packets, and reward epoch admin plans are kept local/read-only until vaults are initialized.",
      command: "npm run rewards:epoch:admin-plan",
      blockers: hasRequiredScript(opsReport, "rewards:holder-claim-packet") &&
        hasRequiredScript(opsReport, "rewards:epoch:admin-plan")
        ? []
        : ["Missing holder reward claim packet or reward epoch admin plan script."],
    }),
    phase({
      id: "projects_and_seedbot",
      label: "Advance Project And SeedBot Modules",
      status: "LOCAL_READY",
      summary: "Project/SeedBot surfaces remain self-custodial and review-gated; no live automation is enabled.",
      command: "npm run test -- src/domain/projectRegistry.test.ts src/domain/seedbot.test.ts src/services/seedbotVenueRouter.test.ts",
    }),
    phase({
      id: "public_ready_product_layer",
      label: "Prepare Public-Ready Product Layer",
      status: readOnlyReady ? "READY_FOR_REVIEW" : "WAITING_ON_DEVNET",
      summary: readOnlyReady
        ? "Prepare the read-only deployment receipt and human release checklist."
        : "Admin cockpit, MicroVerse state mirrors, and locked future districts are local-ready; public preview waits on devnet.",
      command: readOnlyReady
        ? deploymentReceiptCommand
        : devnetNextCommand,
    }),
  ];

  const phaseBlockers = phases.flatMap((item) =>
    item.blockers.map((blocker) => `${item.label}: ${blocker}`),
  );
  const blockers = [...childBlockers, ...phaseBlockers];
  const readinessNextActions = primaryFundingBlocker
    ? []
    : Array.isArray(readOnlyReadinessReport?.nextActions)
      ? readOnlyReadinessReport.nextActions
      : [];
  const nextActions = dedupe([
    nextRecommendation?.manualAction,
    nextRecommendation?.command,
    ...readinessNextActions,
    ...phases
      .filter((item) => item.status === "BLOCKED" || item.status === "WAITING_ON_DEVNET")
      .map((item) => item.command),
  ]);

  return {
    exportVersion: "ryp-mission-status/v1",
    status: blockers.length > 0 ? "MISSION_BLOCKED" : "MISSION_READY_FOR_NEXT_ACTION",
    envSource,
    generatedAt,
    sourceStatuses: {
      ops: opsReport?.status ?? null,
      devnetNext: devnetNextReport?.status ?? null,
      readOnlyReadiness: readOnlyReadinessReport?.status ?? null,
    },
    nextRecommendation,
    nextOperatorHandoff,
    phaseSummary: {
      localReady: phases.filter((item) => item.status === "LOCAL_READY").length,
      readyForReview: phases.filter((item) => item.status === "READY_FOR_REVIEW").length,
      reviewRequired: phases.filter((item) => item.status === "REVIEW_REQUIRED").length,
      waitingOnDevnet: phases.filter((item) => item.status === "WAITING_ON_DEVNET").length,
      blocked: phases.filter((item) => item.status === "BLOCKED").length,
    },
    phases,
    blockers,
    deferredBlockers,
    nextActions,
    safetyAttestation: {
      readOnly: true,
      noTransactionsSubmitted: true,
      noWalletBroadcast: true,
      noLocalKeypairsCreated: true,
      noProtocolMutation: true,
    },
  };
}

function phase({ blockers = [], command, id, label, manualAction = null, status, summary }) {
  return {
    id,
    label,
    status,
    summary,
    command,
    manualAction,
    blockers,
  };
}

function devnetProtocolPhaseStatus(nextActionId) {
  if (
    nextActionId === "fund_devnet_authority" ||
    nextActionId === "create_devnet_test_mint" ||
    nextActionId === "investigate_invalid_mint" ||
    nextActionId === "top_up_devnet_authority" ||
    nextActionId === "deploy_program_and_plan_init"
  ) return "WAITING_ON_DEVNET";
  if (nextActionId === "inspect_protocol_state") return "REVIEW_REQUIRED";
  if (nextActionId === "plan_protocol_initialization") return "REVIEW_REQUIRED";
  if (nextActionId === "review_protocol_inspection_blockers") return "BLOCKED";
  if (
    nextActionId === "run_read_only_testnet_readiness" ||
    nextActionId === "review_public_testnet_blockers" ||
    nextActionId === "prepare_deployment_receipt"
  ) return "READY_FOR_REVIEW";
  return "WAITING_ON_DEVNET";
}

function devnetProtocolPhaseSummary(nextActionId) {
  if (nextActionId === "plan_protocol_initialization") {
    return "Program exists; review the protocol initialization plan before executing it.";
  }
  if (nextActionId === "inspect_protocol_state") {
    return "Program exists; run read-only protocol state inspection before initialization.";
  }
  if (nextActionId === "review_protocol_inspection_blockers") {
    return "Protocol inspection found blockers that must be reviewed before initialization or preview.";
  }
  if (
    nextActionId === "run_read_only_testnet_readiness" ||
    nextActionId === "review_public_testnet_blockers" ||
    nextActionId === "prepare_deployment_receipt"
  ) {
    return "Protocol accounts are initialized enough for read-only readiness and receipt review.";
  }
  return "Protocol initialization waits on authority funding, test mint creation, and program deployment.";
}

function devnetMintPhaseStatus(nextActionId) {
  if (nextActionId === "fund_devnet_authority") return "WAITING_ON_DEVNET";
  if (nextActionId === "create_devnet_test_mint") return "REVIEW_REQUIRED";
  if (nextActionId === "investigate_invalid_mint") return "BLOCKED";
  return "READY_FOR_REVIEW";
}

function devnetMintPhaseSummary(nextActionId) {
  if (nextActionId === "fund_devnet_authority") {
    return "Test mint creation waits on devnet authority funding.";
  }
  if (nextActionId === "create_devnet_test_mint") {
    return "Authority funding is present; review and create the configured devnet RYP test mint.";
  }
  if (nextActionId === "investigate_invalid_mint") {
    return "Configured devnet RYP address exists but is not a parsed SPL mint.";
  }
  return "Configured devnet RYP test mint is no longer the active blocker.";
}

function devnetProgramPhaseStatus(nextActionId) {
  if (
    nextActionId === "fund_devnet_authority" ||
    nextActionId === "create_devnet_test_mint" ||
    nextActionId === "investigate_invalid_mint"
  ) return "WAITING_ON_DEVNET";
  if (nextActionId === "top_up_devnet_authority") return "BLOCKED";
  if (nextActionId === "deploy_program_and_plan_init") return "REVIEW_REQUIRED";
  return "READY_FOR_REVIEW";
}

function devnetProgramPhaseSummary(nextActionId) {
  if (nextActionId === "fund_devnet_authority") {
    return "Program deployment waits on authority funding.";
  }
  if (nextActionId === "create_devnet_test_mint" || nextActionId === "investigate_invalid_mint") {
    return "Program deployment waits on a valid devnet RYP test mint.";
  }
  if (nextActionId === "top_up_devnet_authority") {
    return "Test mint exists, but deployment should wait for authority top-up.";
  }
  if (nextActionId === "deploy_program_and_plan_init") {
    return "Mint exists and deploy funding is ready; deploy the program and print the initialization plan.";
  }
  return "Devnet program is deployed enough for protocol initialization review.";
}

function collectChildBlockers(commandResults, reports, options = {}) {
  return [
    ...childCommandBlockers("Ops readiness", commandResults.ops, reports.opsReport),
    ...childCommandBlockers("Devnet next action", commandResults.devnetNext, reports.devnetNextReport),
    ...(options.suppressReadOnlyReadinessBlockers
      ? []
      : childCommandBlockers(
        "Read-only testnet readiness",
        commandResults.readOnlyReadiness,
        reports.readOnlyReadinessReport,
      )),
  ];
}

function childCommandBlockers(label, commandResult, parsedReport) {
  const blockers = [];
  if (commandResult && commandResult.exitCode !== 0) {
    blockers.push(`${label}: command exited with ${commandResult.exitCode}.`);
  }
  if (commandResult && !parsedReport) {
    blockers.push(`${label}: command did not return parseable JSON.`);
  }
  if (parsedReport?.status === "BLOCKED" && Array.isArray(parsedReport.blockers)) {
    blockers.push(...parsedReport.blockers.map((blocker) => `${label}: ${blocker}`));
  }
  return blockers;
}

function hasRequiredScript(opsReport, scriptName) {
  return Array.isArray(opsReport?.requiredScripts) && opsReport.requiredScripts.includes(scriptName);
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

export function parseLastJsonObject(output) {
  for (const candidate of jsonObjectCandidates(output).reverse()) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Child command output may include package-manager noise before JSON.
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

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeEnvPath(value) {
  return path.relative(repoRoot, path.resolve(repoRoot, value));
}

function isMain(moduleUrl) {
  return fileURLToPath(moduleUrl) === process.argv[1];
}
