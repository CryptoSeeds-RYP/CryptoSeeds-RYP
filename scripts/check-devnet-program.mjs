import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, PublicKey } from "@solana/web3.js";

const BPF_UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const defaultEnvPath = existsSync(path.join(repoRoot, ".env.devnet.example"))
  ? path.join(repoRoot, ".env.devnet.example")
  : path.join(repoRoot, ".env");
const envPath = path.resolve(repoRoot, options.envPath ?? defaultEnvPath);
const env = { ...parseEnvFile(envPath), ...process.env };

const config = {
  cluster: env.VITE_SOLANA_CLUSTER ?? "localnet",
  deployment: env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT ?? "placeholder",
  programId: env.VITE_CRYPTOSEEDS_PROGRAM_ID,
  rpcUrl: env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
};

const blockers = [];
const warnings = [];

if (config.cluster !== "devnet") blockers.push("VITE_SOLANA_CLUSTER must be devnet for devnet program inspection.");
if (config.deployment !== "devnet") {
  blockers.push("VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT must be devnet for devnet program inspection.");
}
if (!isValidPublicKey(config.programId)) blockers.push("VITE_CRYPTOSEEDS_PROGRAM_ID is not a valid Solana public key.");

let program = null;
let programDataAddress = null;

if (blockers.length === 0) {
  try {
    const connection = new Connection(config.rpcUrl, "confirmed");
    const programAddress = new PublicKey(config.programId);
    const account = await connection.getAccountInfo(programAddress, "confirmed");

    if (!account) {
      blockers.push("Devnet program account was not found on the selected RPC.");
    } else {
      program = {
        executable: account.executable,
        lamports: account.lamports,
        owner: account.owner.toBase58(),
        dataLength: account.data.length,
      };

      if (!account.executable) blockers.push("Devnet program account is not executable.");
      if (account.owner.toBase58() !== BPF_UPGRADEABLE_LOADER_ID) {
        blockers.push("Devnet program account is not owned by the upgradeable BPF loader.");
      }

      programDataAddress = parseProgramDataAddress(account.data);
      if (!programDataAddress) {
        warnings.push("ProgramData address could not be decoded from the program account.");
      }
    }
  } catch (error) {
    blockers.push(`Devnet program account could not be checked: ${error instanceof Error ? error.message : "unknown error"}.`);
  }
}

const report = {
  status: blockers.length === 0 ? "DEPLOYED" : "BLOCKED",
  envSource: path.relative(repoRoot, envPath),
  config,
  program,
  programDataAddress,
  blockers,
  warnings,
  nextActions: blockers.length > 0
    ? [
        "Fund the devnet authority wallet.",
        "Create the configured devnet RYP test mint.",
        "Run npm run devnet:deploy:wsl -- -EnvPath .env.devnet.example.",
        "Re-run this program inspection after deployment.",
      ]
    : [
        "Initialize protocol config, reward config, and verified reward vault states on devnet.",
        "Run read-only devnet account inspection before reviewing any public broadcast path.",
      ],
};

console.log(JSON.stringify(report, null, 2));

if (options.strict && blockers.length > 0) {
  process.exit(1);
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
    throw new Error(`${name} requires a file path.`);
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

function parseProgramDataAddress(data) {
  if (data.length < 36) return null;
  const tag = data.readUInt32LE(0);
  if (tag !== 2) return null;
  return new PublicKey(data.subarray(4, 36)).toBase58();
}

function isValidPublicKey(value) {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}
