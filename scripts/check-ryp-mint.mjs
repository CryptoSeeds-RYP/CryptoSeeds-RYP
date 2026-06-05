import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, PublicKey } from "@solana/web3.js";

const MAINNET_RYP_MINT = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const defaultEnvPath = existsSync(path.join(repoRoot, ".env")) ? path.join(repoRoot, ".env") : undefined;
const envPath = options.envPath ? path.resolve(repoRoot, options.envPath) : defaultEnvPath;
const env = { ...(envPath ? parseEnvFile(envPath) : {}), ...process.env };

const rpcUrl = env.VITE_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const mintAddress = env.VITE_RYP_MINT_ADDRESS ?? MAINNET_RYP_MINT;
const expectedDecimals = Number(env.VITE_RYP_DECIMALS ?? 6);
const expectedOwnerProgram = env.VITE_RYP_OWNER_PROGRAM ?? TOKEN_PROGRAM_ID;
const expectedSupplyBaseUnits = env.VITE_RYP_EXPECTED_SUPPLY_BASE_UNITS;
const minimumSupplyBaseUnits = env.VITE_RYP_MIN_SUPPLY_BASE_UNITS;

const connection = new Connection(rpcUrl, "confirmed");
const account = await connection.getParsedAccountInfo(new PublicKey(mintAddress), "confirmed");

if (!account.value || !("parsed" in account.value.data)) {
  throw new Error(`RYP mint account could not be parsed: ${mintAddress}`);
}

const mint = account.value.data.parsed.info;
const decimals = Number(mint.decimals);
const supplyBaseUnits = String(mint.supply);
const divisor = 10 ** decimals;
const report = {
  address: mintAddress,
  envSource: envPath ? path.relative(repoRoot, envPath) : "process/defaults",
  ownerProgram: account.value.owner.toBase58(),
  decimals,
  supplyBaseUnits,
  supplyUiAmount: Number(supplyBaseUnits) / divisor,
  mintAuthority: mint.mintAuthority ?? null,
  freezeAuthority: mint.freezeAuthority ?? null,
};

console.log(JSON.stringify(report, null, 2));

if (report.ownerProgram !== expectedOwnerProgram) {
  throw new Error(`Unexpected RYP owner program: ${report.ownerProgram}. Expected ${expectedOwnerProgram}.`);
}

if (report.decimals !== expectedDecimals) {
  throw new Error(`Unexpected RYP decimals: ${report.decimals}. Expected ${expectedDecimals}.`);
}

if (report.mintAuthority !== null) {
  throw new Error(`RYP mint authority is not disabled: ${report.mintAuthority}`);
}

if (report.freezeAuthority !== null) {
  throw new Error(`RYP freeze authority is not disabled: ${report.freezeAuthority}`);
}

if (expectedSupplyBaseUnits && BigInt(report.supplyBaseUnits) !== BigInt(expectedSupplyBaseUnits)) {
  throw new Error(`Unexpected RYP supply: ${report.supplyBaseUnits}. Expected ${expectedSupplyBaseUnits}.`);
}

if (minimumSupplyBaseUnits && BigInt(report.supplyBaseUnits) < BigInt(minimumSupplyBaseUnits)) {
  throw new Error(`Unexpected RYP supply: ${report.supplyBaseUnits}. Minimum ${minimumSupplyBaseUnits}.`);
}

if (options.strict && mintAddress === MAINNET_RYP_MINT && !rpcUrl.includes("mainnet")) {
  throw new Error("Strict RYP mint check is using the mainnet RYP mint on a non-mainnet RPC.");
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
