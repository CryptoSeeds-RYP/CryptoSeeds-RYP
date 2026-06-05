import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicKey } from "@solana/web3.js";

const PLACEHOLDER_PROGRAM_ID = "FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL";
const MAINNET_RYP_MINT = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const defaultEnvPath = existsSync(path.join(repoRoot, ".env"))
  ? path.join(repoRoot, ".env")
  : path.join(repoRoot, ".env.example");
const envPath = path.resolve(repoRoot, options.envPath ?? defaultEnvPath);
const env = { ...parseEnvFile(envPath), ...process.env };
const anchorToml = readFileSync(path.join(repoRoot, "Anchor.toml"), "utf8");
const rustProgram = readFileSync(path.join(repoRoot, "programs", "cryptoseeds_protocol", "src", "lib.rs"), "utf8");

const config = {
  adminAuthorityAddress: env.VITE_ADMIN_AUTHORITY_ADDRESS,
  broadcastEnabled: env.VITE_SOLANA_BROADCAST_ENABLED === "true",
  cluster: env.VITE_SOLANA_CLUSTER ?? "localnet",
  demoMode: env.VITE_DEMO_MODE !== "false",
  deployment: env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT ?? "placeholder",
  programId: env.VITE_CRYPTOSEEDS_PROGRAM_ID ?? PLACEHOLDER_PROGRAM_ID,
  rpcUrl: env.VITE_SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
  rypDecimals: Number(env.VITE_RYP_DECIMALS ?? 6),
  rypMintAddress: env.VITE_RYP_MINT_ADDRESS ?? MAINNET_RYP_MINT,
};

const blockers = readinessBlockers(config);
const result = {
  status: blockers.length > 0 ? "BLOCKED" : "READY_FOR_DEVNET_REVIEW",
  envSource: path.relative(repoRoot, envPath),
  config: {
    broadcastEnabled: config.broadcastEnabled,
    cluster: config.cluster,
    demoMode: config.demoMode,
    deployment: config.deployment,
    programId: config.programId,
    rpcUrl: config.rpcUrl,
    rypMintAddress: config.rypMintAddress,
    rypDecimals: config.rypDecimals,
    adminAuthorityAddress: config.adminAuthorityAddress ?? null,
  },
  blockers,
  nextActions: blockers.length > 0
    ? [
        "Generate and approve a permanent program keypair outside git.",
        "Sync Anchor.toml, declare_id!, and VITE_CRYPTOSEEDS_PROGRAM_ID.",
        "Deploy to devnet and initialize protocol config/vault.",
        "Run protocol IDL, localnet, token, app, and copy/visual checks before enabling broadcast review.",
      ]
    : [
        "Run a devnet dry-run simulation with the approved program id.",
        "Review transaction copy and signer/account previews before adding a send boundary.",
      ],
};

console.log(JSON.stringify(result, null, 2));

if (options.strict && blockers.length > 0) {
  process.exit(1);
}

function readinessBlockers(current) {
  const reasons = [];
  if (!["localnet", "devnet", "mainnet-beta"].includes(current.cluster)) {
    reasons.push("VITE_SOLANA_CLUSTER must be localnet, devnet, or mainnet-beta.");
  }
  if (!["placeholder", "localnet", "devnet", "mainnet-beta"].includes(current.deployment)) {
    reasons.push("VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT must be placeholder, localnet, devnet, or mainnet-beta.");
  }
  if (!current.broadcastEnabled) reasons.push("VITE_SOLANA_BROADCAST_ENABLED is false.");
  if (current.demoMode) reasons.push("VITE_DEMO_MODE must be false for devnet broadcast review.");
  if (current.programId === PLACEHOLDER_PROGRAM_ID) reasons.push("Program id is still the development placeholder.");
  if (!isValidPublicKey(current.programId)) reasons.push("VITE_CRYPTOSEEDS_PROGRAM_ID is not a valid Solana public key.");
  if (current.deployment === "placeholder") reasons.push("Program deployment status is still placeholder.");
  if (current.deployment !== "placeholder" && current.deployment !== current.cluster) {
    reasons.push("Program deployment status does not match the selected Solana cluster.");
  }
  if (current.cluster === "mainnet-beta") reasons.push("Mainnet broadcast is blocked until a final launch review.");
  if (!isValidPublicKey(current.rypMintAddress)) reasons.push("VITE_RYP_MINT_ADDRESS is not a valid Solana public key.");
  if (current.cluster === "devnet" && current.rypMintAddress === MAINNET_RYP_MINT) {
    reasons.push("Devnet readiness must use a devnet test RYP mint, not the mainnet RYP mint.");
  }
  if (!Number.isInteger(current.rypDecimals) || current.rypDecimals < 0 || current.rypDecimals > 18) {
    reasons.push("VITE_RYP_DECIMALS must be an integer between 0 and 18.");
  }
  if (current.deployment !== "placeholder" && !current.adminAuthorityAddress) {
    reasons.push("VITE_ADMIN_AUTHORITY_ADDRESS must be configured before deployment review.");
  }
  if (current.adminAuthorityAddress && !isValidPublicKey(current.adminAuthorityAddress)) {
    reasons.push("VITE_ADMIN_AUTHORITY_ADDRESS is not a valid Solana public key.");
  }

  const anchorProgramId = findAnchorProgramId(anchorToml);
  const rustProgramId = findRustProgramId(rustProgram);
  if (!anchorProgramId) reasons.push("Anchor.toml is missing cryptoseeds_protocol program id.");
  if (!rustProgramId) reasons.push("declare_id! is missing from the Anchor program.");
  if (anchorProgramId && anchorProgramId !== current.programId) {
    reasons.push("Anchor.toml program id does not match VITE_CRYPTOSEEDS_PROGRAM_ID.");
  }
  if (rustProgramId && rustProgramId !== current.programId) {
    reasons.push("declare_id! program id does not match VITE_CRYPTOSEEDS_PROGRAM_ID.");
  }

  return reasons;
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
      if (!args[index + 1] || args[index + 1].startsWith("--")) {
        throw new Error("--env requires a file path.");
      }
      parsed.envPath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg?.startsWith("--env=")) {
      parsed.envPath = arg.slice("--env=".length);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.envPath === "") {
    throw new Error("--env requires a file path.");
  }

  return parsed;
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

function findAnchorProgramId(contents) {
  return contents.match(/cryptoseeds_protocol\s*=\s*"([^"]+)"/)?.[1];
}

function findRustProgramId(contents) {
  return contents.match(/declare_id!\("([^"]+)"\)/)?.[1];
}

function isValidPublicKey(value) {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}
