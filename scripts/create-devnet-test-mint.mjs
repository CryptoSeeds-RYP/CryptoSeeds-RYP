import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

process.on("unhandledRejection", (error) => fail(error));
process.on("uncaughtException", (error) => fail(error));

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MINT_SIZE = 82;
const MIN_MINT_SOL = 0.1;
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const envPath = path.resolve(repoRoot, options.envPath ?? ".env.devnet.example");
const env = { ...parseEnvFile(envPath), ...process.env };

const rpcUrl = env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const decimals = Number(env.VITE_RYP_DECIMALS ?? 6);
const expectedMintAddress = env.VITE_RYP_MINT_ADDRESS;
const expectedAuthorityAddress = env.VITE_ADMIN_AUTHORITY_ADDRESS;
const authorityPath = path.resolve(repoRoot, options.authorityPath ?? "target/devnet/devnet-authority.json");
const mintPath = path.resolve(repoRoot, options.mintPath ?? "target/devnet/ryp-test-mint-keypair.json");

if (env.VITE_SOLANA_CLUSTER !== "devnet") {
  throw new Error("Refusing to create a test mint unless VITE_SOLANA_CLUSTER=devnet.");
}
if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
  throw new Error("VITE_RYP_DECIMALS must be an integer between 0 and 18.");
}

const authority = readKeypair(authorityPath);
const mint = readKeypair(mintPath);
assertExpectedPublicKey("VITE_ADMIN_AUTHORITY_ADDRESS", authority.publicKey, expectedAuthorityAddress);
assertExpectedPublicKey("VITE_RYP_MINT_ADDRESS", mint.publicKey, expectedMintAddress);

const connection = new Connection(rpcUrl, "confirmed");
const existing = await connection.getParsedAccountInfo(mint.publicKey, "confirmed");
if (existing.value) {
  console.log(JSON.stringify({
    status: "EXISTS",
    envSource: path.relative(repoRoot, envPath),
    mint: mint.publicKey.toBase58(),
    authority: authority.publicKey.toBase58(),
    rpcUrl,
  }, null, 2));
  process.exit(0);
}

await ensureDevnetBalance(connection, authority.publicKey);

const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
const initializeMintData = Buffer.alloc(70);
initializeMintData.writeUInt8(0, 0);
initializeMintData.writeUInt8(decimals, 1);
authority.publicKey.toBuffer().copy(initializeMintData, 2);
initializeMintData.writeUInt32LE(0, 34);

const transaction = new Transaction().add(
  SystemProgram.createAccount({
    fromPubkey: authority.publicKey,
    lamports,
    newAccountPubkey: mint.publicKey,
    programId: TOKEN_PROGRAM_ID,
    space: MINT_SIZE,
  }),
  new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: mint.publicKey, isSigner: false, isWritable: true },
      { pubkey: new PublicKey("SysvarRent111111111111111111111111111111111"), isSigner: false, isWritable: false },
    ],
    data: initializeMintData,
  }),
);

const signature = await sendAndConfirmTransaction(connection, transaction, [authority, mint], {
  commitment: "confirmed",
  maxRetries: 5,
});

console.log(JSON.stringify({
  status: "CREATED",
  envSource: path.relative(repoRoot, envPath),
  mint: mint.publicKey.toBase58(),
  authority: authority.publicKey.toBase58(),
  decimals,
  signature,
  rpcUrl,
}, null, 2));

function parseArgs(args) {
  const parsed = {
    authorityPath: undefined,
    envPath: undefined,
    mintPath: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
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
      parsed.authorityPath = requireValue(args, index, "--authority");
      index += 1;
      continue;
    }
    if (arg?.startsWith("--authority=")) {
      parsed.authorityPath = arg.slice("--authority=".length);
      continue;
    }
    if (arg === "--mint") {
      parsed.mintPath = requireValue(args, index, "--mint");
      index += 1;
      continue;
    }
    if (arg?.startsWith("--mint=")) {
      parsed.mintPath = arg.slice("--mint=".length);
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

function readKeypair(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Keypair file not found: ${filePath}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(filePath, "utf8"))));
}

function assertExpectedPublicKey(label, actual, expected) {
  if (!expected) {
    throw new Error(`${label} must be configured.`);
  }
  if (actual.toBase58() !== expected) {
    throw new Error(`${label} mismatch: keypair is ${actual.toBase58()}, env expects ${expected}.`);
  }
}

async function ensureDevnetBalance(connection, publicKey) {
  const balance = await connection.getBalance(publicKey, "confirmed");
  if (balance >= MIN_MINT_SOL * LAMPORTS_PER_SOL) return;

  throw new Error(
    `Devnet authority needs at least ${MIN_MINT_SOL} SOL before mint creation. ` +
      `Current balance: ${balance / LAMPORTS_PER_SOL} SOL. ` +
      "Run npm run devnet:funding:packet -- --env .env.devnet.example for the funding handoff.",
  );
}

function fail(error) {
  console.error(JSON.stringify({
    status: "BLOCKED",
    reason: error instanceof Error ? error.message : "unknown error",
  }, null, 2));
  process.exitCode = 1;
}
