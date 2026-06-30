import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const MIN_MINT_SOL = 0.1;
const MIN_DEPLOY_SOL = 3;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const envPath = path.resolve(repoRoot, options.envPath ?? ".env.devnet.example");
const envSource = path.relative(repoRoot, envPath);
const env = { ...parseEnvFile(envPath), ...process.env };
const rpcUrl = env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const authorityAddress = options.authorityAddress ?? env.VITE_ADMIN_AUTHORITY_ADDRESS;
const amounts = options.amounts ?? [3, 1, 0.1];
const connection = new Connection(rpcUrl, "confirmed");
const blockers = [];
const warnings = [];
const attempts = [];

if (env.VITE_SOLANA_CLUSTER !== "devnet") blockers.push("VITE_SOLANA_CLUSTER must be devnet.");
if (!isValidPublicKey(authorityAddress)) blockers.push("A valid devnet authority address is required.");

let before = null;
let after = null;
if (blockers.length === 0) {
  const authority = new PublicKey(authorityAddress);
  before = await readBalance(authority);

  if (before.sol < MIN_DEPLOY_SOL && !options.checkOnly) {
    for (const amount of amounts) {
      if (after?.sol >= MIN_DEPLOY_SOL) break;
      if ((after ?? before).sol >= MIN_DEPLOY_SOL) break;

      attempts.push(await attemptAirdrop(authority, amount));
      after = await readBalance(authority);
      if (after.sol >= MIN_DEPLOY_SOL) break;
    }
  }

  after ??= await readBalance(authority);
  if (after.sol < MIN_MINT_SOL) {
    blockers.push(
      `Devnet authority has ${after.sol} SOL; fund ${authorityAddress} with at least ${MIN_MINT_SOL} SOL for mint creation.`,
    );
  } else if (after.sol < MIN_DEPLOY_SOL) {
    warnings.push(
      `Devnet authority has ${after.sol} SOL; ${MIN_DEPLOY_SOL} SOL is recommended before program deployment.`,
    );
  }

  if (!options.checkOnly && attempts.length > 0 && attempts.every((attempt) => attempt.status === "FAILED")) {
    warnings.push("All airdrop attempts failed, likely due to devnet faucet rate limits.");
  }
}

const status = blockers.length === 0
  ? after?.sol >= MIN_DEPLOY_SOL
    ? "FUNDED_FOR_DEPLOY"
    : "FUNDED_FOR_MINT"
  : "BLOCKED";

const report = {
  status,
  envSource: path.relative(repoRoot, envPath),
  authorityAddress: authorityAddress ?? null,
  rpcUrl,
  before,
  after,
  attempts,
  blockers,
  warnings,
  nextActions: nextActions(status, envSource),
};

console.log(JSON.stringify(report, null, 2));

if (options.strict && blockers.length > 0) {
  process.exit(1);
}

async function readBalance(publicKey) {
  const lamports = await connection.getBalance(publicKey, "confirmed");
  return {
    lamports,
    sol: lamports / LAMPORTS_PER_SOL,
    fundedForMint: lamports >= MIN_MINT_SOL * LAMPORTS_PER_SOL,
    fundedForDeploy: lamports >= MIN_DEPLOY_SOL * LAMPORTS_PER_SOL,
  };
}

async function attemptAirdrop(publicKey, amountSol) {
  try {
    const signature = await connection.requestAirdrop(publicKey, Math.round(amountSol * LAMPORTS_PER_SOL));
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction({ ...latestBlockhash, signature }, "confirmed");
    return {
      amountSol,
      signature,
      status: "CONFIRMED",
    };
  } catch (error) {
    return {
      amountSol,
      error: error instanceof Error ? error.message : "unknown error",
      status: "FAILED",
    };
  }
}

function nextActions(status, commandEnv) {
  if (status === "FUNDED_FOR_DEPLOY") {
    return [
      `Run npm run devnet:status -- --env ${commandEnv}.`,
      `Run npm run devnet:mint:test -- --env ${commandEnv} if the test mint is missing.`,
      `Run npm run devnet:bootstrap -- --env ${commandEnv} --deploy --init-plan after mint creation and final status review.`,
    ];
  }
  if (status === "FUNDED_FOR_MINT") {
    return [
      `Run npm run devnet:mint:test -- --env ${commandEnv}.`,
      `Top up ${authorityAddress} to about ${MIN_DEPLOY_SOL} devnet SOL before program deployment.`,
    ];
  }
  return [
    `Fund ${authorityAddress ?? "the devnet authority"} with at least ${MIN_MINT_SOL} devnet SOL; ${MIN_DEPLOY_SOL} SOL is recommended.`,
    "If public airdrops are rate-limited, use another devnet faucet or fund from another devnet wallet.",
    `Re-run npm run devnet:fund:authority -- --env ${commandEnv}.`,
  ];
}

function parseArgs(args) {
  const parsed = {
    authorityAddress: undefined,
    amounts: undefined,
    checkOnly: false,
    envPath: undefined,
    strict: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check-only") {
      parsed.checkOnly = true;
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
    if (arg === "--authority") {
      parsed.authorityAddress = requireValue(args, index, "--authority");
      index += 1;
      continue;
    }
    if (arg?.startsWith("--authority=")) {
      parsed.authorityAddress = arg.slice("--authority=".length);
      continue;
    }
    if (arg === "--amounts") {
      parsed.amounts = parseAmounts(requireValue(args, index, "--amounts"));
      index += 1;
      continue;
    }
    if (arg?.startsWith("--amounts=")) {
      parsed.amounts = parseAmounts(arg.slice("--amounts=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function parseAmounts(value) {
  const amounts = value.split(",").map((part) => Number(part.trim()));
  if (amounts.length === 0 || amounts.some((amount) => !Number.isFinite(amount) || amount <= 0)) {
    throw new Error("--amounts must be a comma-separated list of positive SOL amounts.");
  }
  return amounts;
}

function requireValue(args, index, name) {
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return args[index + 1];
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Environment file not found: ${filePath}`);
  }

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex), stripEnvValue(line.slice(separatorIndex + 1))];
      }),
  );
}

function stripEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isValidPublicKey(value) {
  try {
    return Boolean(value && new PublicKey(value));
  } catch {
    return false;
  }
}
