#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const MIN_MINT_SOL = 0.1;
const RECOMMENDED_DEPLOY_SOL = 3;
const SOLANA_DEVNET_FAUCET_URL = "https://faucet.solana.com";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runningAsMain = isMain(import.meta.url);
const options = runningAsMain ? parseArgs(process.argv.slice(2)) : { envPath: undefined, strict: false };

if (runningAsMain) {
  const envPath = path.resolve(repoRoot, options.envPath ?? ".env.devnet.example");
  const env = { ...parseEnvFile(envPath), ...process.env };
  const config = {
    authorityAddress: env.VITE_ADMIN_AUTHORITY_ADDRESS,
    cluster: env.VITE_SOLANA_CLUSTER ?? "localnet",
    programId: env.VITE_CRYPTOSEEDS_PROGRAM_ID,
    rpcUrl: env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    rypMintAddress: env.VITE_RYP_MINT_ADDRESS,
  };
  const balance = await readAuthorityBalance(config);
  const packet = buildDevnetFundingPacket({
    balance,
    config,
    envSource: path.relative(repoRoot, envPath),
  });

  console.log(JSON.stringify(packet, null, 2));

  if (options.strict && packet.status === "FUNDING_REQUIRED") {
    process.exit(1);
  }
}

export function buildDevnetFundingPacket({
  balance,
  config,
  generatedAt = new Date().toISOString(),
  envSource,
}) {
  const blockers = [];
  const warnings = [];
  const currentSol = Number(balance?.sol ?? 0);
  const validAuthority = isValidPublicKey(config.authorityAddress);

  if (config.cluster !== "devnet") blockers.push("VITE_SOLANA_CLUSTER must be devnet.");
  if (!validAuthority) blockers.push("VITE_ADMIN_AUTHORITY_ADDRESS must be a valid Solana public key.");
  if (!isValidPublicKey(config.programId)) blockers.push("VITE_CRYPTOSEEDS_PROGRAM_ID must be a valid Solana public key.");
  if (!isValidPublicKey(config.rypMintAddress)) blockers.push("VITE_RYP_MINT_ADDRESS must be a valid Solana public key.");
  if (balance?.error) warnings.push(`Authority balance could not be read: ${balance.error}`);

  const fundedForMint = currentSol >= MIN_MINT_SOL;
  const fundedForDeploy = currentSol >= RECOMMENDED_DEPLOY_SOL;
  if (!fundedForMint) {
    blockers.push(
      `Devnet authority has ${formatSol(currentSol)} SOL; fund at least ${MIN_MINT_SOL} devnet SOL to create the test mint.`,
    );
  }
  if (fundedForMint && !fundedForDeploy) {
    warnings.push(
      `Devnet authority has ${formatSol(currentSol)} SOL; ${RECOMMENDED_DEPLOY_SOL} SOL is recommended before program deployment.`,
    );
  }

  return {
    exportVersion: "devnet-funding-packet/v1",
    status: blockers.length > 0
      ? "FUNDING_REQUIRED"
      : fundedForDeploy
        ? "FUNDED_FOR_DEPLOY"
        : "FUNDED_FOR_MINT",
    generatedAt,
    envSource,
    executionMode: "READ_ONLY",
    authority: {
      address: config.authorityAddress ?? null,
      currentLamports: balance?.lamports ?? null,
      currentSol,
      minimumMintSol: MIN_MINT_SOL,
      recommendedDeploySol: RECOMMENDED_DEPLOY_SOL,
      minimumTopUpSol: Math.max(0, roundSol(MIN_MINT_SOL - currentSol)),
      recommendedTopUpSol: Math.max(0, roundSol(RECOMMENDED_DEPLOY_SOL - currentSol)),
    },
    devnetOnlyWarning: "Use devnet SOL only. Do not send mainnet SOL to this deployment authority for devnet testing.",
    fundingOptions: [
      {
        id: "solana-devnet-faucet",
        label: "Solana devnet faucet",
        url: SOLANA_DEVNET_FAUCET_URL,
        address: config.authorityAddress ?? null,
        requestedAmountSol: RECOMMENDED_DEPLOY_SOL,
        fallbackAmountSol: MIN_MINT_SOL,
      },
      {
        id: "existing-devnet-wallet",
        label: "Transfer from an existing devnet wallet",
        address: config.authorityAddress ?? null,
        recommendedAmountSol: RECOMMENDED_DEPLOY_SOL,
        minimumAmountSol: MIN_MINT_SOL,
      },
    ],
    afterFundingCommands: [
      "npm run devnet:fund:authority -- --env .env.devnet.example --check-only",
      "npm run devnet:status -- --env .env.devnet.example",
      "npm run devnet:bootstrap -- --env .env.devnet.example --mint",
      "npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan",
      "npm run devnet:init:protocol -- --env .env.devnet.example --execute",
      "npm run devnet:inspect:protocol -- --env .env.devnet.example",
      "npm run testnet:readiness -- --profile read-only --env .env.devnet.example",
    ],
    blockers,
    warnings,
  };
}

async function readAuthorityBalance(config) {
  if (!isValidPublicKey(config.authorityAddress)) {
    return {
      error: "Authority address is invalid.",
      lamports: null,
      sol: 0,
    };
  }

  try {
    const connection = new Connection(config.rpcUrl, "confirmed");
    const lamports = await connection.getBalance(new PublicKey(config.authorityAddress), "confirmed");
    return {
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "unknown error",
      lamports: null,
      sol: 0,
    };
  }
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

  return parsed;
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

function roundSol(value) {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function formatSol(value) {
  return Number.isInteger(value) ? String(value) : String(roundSol(value));
}

function isMain(moduleUrl) {
  return fileURLToPath(moduleUrl) === process.argv[1];
}
