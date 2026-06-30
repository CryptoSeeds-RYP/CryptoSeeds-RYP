import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const envPath = options.envPath ?? ".env.devnet.example";
const steps = [];

await runStep({
  args: ["scripts/fund-devnet-authority.mjs", "--env", envPath, ...(options.fund ? [] : ["--check-only"])],
  label: options.fund ? "fund_authority" : "check_authority_funding",
  required: false,
});

await runStep({
  args: ["scripts/check-devnet-status.mjs", "--env", envPath],
  label: "devnet_status",
  required: false,
});

if (options.mint) {
  await runStep({
    args: ["scripts/create-devnet-test-mint.mjs", "--env", envPath],
    label: "create_test_mint",
    required: true,
  });
}

await runStep({
  args: ["scripts/prepare-devnet-deployment.mjs", "--env", envPath],
  label: "deployment_prep",
  required: false,
});

if (options.deploy) {
  await runStep({
    command: "powershell",
    args: ["-ExecutionPolicy", "Bypass", "-File", "scripts/deploy-devnet-protocol-wsl.ps1", "-EnvPath", envPath],
    label: "deploy_program",
    required: true,
  });
}

await runStep({
  args: ["scripts/check-devnet-program.mjs", "--env", envPath],
  label: "program_check",
  required: false,
});

if (options.initPlan || options.executeInit) {
  await runStep({
    args: [
      "scripts/initialize-devnet-protocol.mjs",
      "--env",
      envPath,
      ...(options.executeInit ? ["--execute"] : []),
    ],
    label: options.executeInit ? "initialize_protocol" : "plan_protocol_initialization",
    required: options.executeInit,
  });
}

const blockers = steps.filter((step) => step.exitCode !== 0);
const report = {
  status: blockers.length === 0 ? "BOOTSTRAP_CHECK_COMPLETE" : "BOOTSTRAP_BLOCKED",
  envSource: path.relative(repoRoot, path.resolve(repoRoot, envPath)),
  mode: {
    deploy: options.deploy,
    executeInit: options.executeInit,
    fund: options.fund,
    initPlan: options.initPlan,
    mint: options.mint,
  },
  steps,
  blockers: blockers.map((step) => `${step.label} exited with code ${step.exitCode}.`),
  nextActions: nextActions(blockers),
};

console.log(JSON.stringify(report, null, 2));

if ((options.strict || options.deploy || options.executeInit || options.mint) && blockers.length > 0) {
  process.exit(1);
}

async function runStep({
  args,
  command = process.execPath,
  label,
  required,
}) {
  const startedAt = Date.now();
  const result = await runCommand(command, args);
  const parsedStatus = parseJsonStatus(result.stdout);
  const effectiveExitCode = result.exitCode || (parsedStatus?.includes("BLOCKED") ? 1 : 0);
  steps.push({
    durationMs: Date.now() - startedAt,
    exitCode: effectiveExitCode,
    label,
    reportedStatus: parsedStatus,
    required,
  });

  if (required && effectiveExitCode !== 0) {
    console.log(JSON.stringify({
      status: "STOPPED",
      failedStep: label,
      exitCode: effectiveExitCode,
    }, null, 2));
    process.exit(effectiveExitCode);
  }
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });
    child.on("close", (exitCode) => resolve({ exitCode: exitCode ?? 1, stderr, stdout }));
    child.on("error", (error) => {
      console.error(JSON.stringify({
        status: "COMMAND_ERROR",
        command,
        args,
        error: error instanceof Error ? error.message : "unknown error",
      }, null, 2));
      resolve({ exitCode: 1, stderr: "", stdout: "" });
    });
  });
}

function parseJsonStatus(output) {
  try {
    const parsed = JSON.parse(output);
    return typeof parsed.status === "string" ? parsed.status : undefined;
  } catch {
    return undefined;
  }
}

function nextActions(blockers) {
  if (blockers.some((step) => step.label === "check_authority_funding" || step.label === "fund_authority")) {
    return [
      "Fund the devnet authority externally if public airdrops are rate-limited.",
      "Re-run npm run devnet:bootstrap -- --env .env.devnet.example --fund.",
    ];
  }
  if (blockers.some((step) => step.label === "deployment_prep")) {
    return [
      "Create the devnet test mint after authority funding.",
      "Re-run npm run devnet:bootstrap -- --env .env.devnet.example --mint.",
    ];
  }
  if (blockers.some((step) => step.label === "program_check")) {
    return [
      "Deploy the program after funding and mint creation.",
      "Run npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan.",
    ];
  }
  if (blockers.length > 0) {
    return ["Review the failed step output above, fix the blocker, and rerun the bootstrap command."];
  }
  if (!options.mint && !options.deploy && !options.initPlan && !options.executeInit) {
    return [
      "When authority funding is available, run with --mint to create the devnet test mint.",
      "After mint/prep pass, run with --deploy --init-plan.",
      "Only after reviewing the initialization plan, run with --execute-init.",
    ];
  }
  return ["Continue with the next explicit bootstrap flag after reviewing the printed reports."];
}

function parseArgs(args) {
  const parsed = {
    deploy: false,
    envPath: undefined,
    executeInit: false,
    fund: false,
    initPlan: false,
    mint: false,
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--deploy") {
      parsed.deploy = true;
      continue;
    }
    if (arg === "--execute-init") {
      parsed.executeInit = true;
      parsed.initPlan = true;
      continue;
    }
    if (arg === "--fund") {
      parsed.fund = true;
      continue;
    }
    if (arg === "--init-plan") {
      parsed.initPlan = true;
      continue;
    }
    if (arg === "--mint") {
      parsed.mint = true;
      continue;
    }
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

  if (!existsSync(path.resolve(repoRoot, parsed.envPath ?? ".env.devnet.example"))) {
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
