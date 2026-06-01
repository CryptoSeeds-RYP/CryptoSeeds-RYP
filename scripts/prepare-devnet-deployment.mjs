import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PublicKey } from "@solana/web3.js";

const PLACEHOLDER_PROGRAM_ID = "FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL";
const MAINNET_RYP_MINT = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = existsSync(path.join(repoRoot, ".env"))
  ? path.join(repoRoot, ".env")
  : path.join(repoRoot, ".env.example");
const env = { ...parseEnvFile(envPath), ...process.env };
const anchorToml = readText("Anchor.toml");
const rustProgram = readText(path.join("programs", "cryptoseeds_protocol", "src", "lib.rs"));

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

const blockers = [];
const warnings = [];
const anchorProgramId = findAnchorProgramId(anchorToml);
const rustProgramId = findRustProgramId(rustProgram);

if (config.cluster !== "devnet") blockers.push("VITE_SOLANA_CLUSTER must be devnet for devnet deployment prep.");
if (config.deployment !== "devnet") {
  blockers.push("VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT must be devnet for devnet deployment prep.");
}
if (config.demoMode) blockers.push("VITE_DEMO_MODE must be false for devnet deployment prep.");
if (config.broadcastEnabled) {
  blockers.push("VITE_SOLANA_BROADCAST_ENABLED must remain false during deployment prep.");
}
if (!config.rpcUrl.includes("devnet")) {
  warnings.push("VITE_SOLANA_RPC_URL does not look like a devnet endpoint; verify the RPC target before deploy.");
}
if (!isValidPublicKey(config.programId)) blockers.push("VITE_CRYPTOSEEDS_PROGRAM_ID is not a valid Solana public key.");
if (config.programId === PLACEHOLDER_PROGRAM_ID) {
  blockers.push("Generate and approve a permanent devnet program keypair outside git.");
}
if (!anchorProgramId) blockers.push("Anchor.toml is missing the cryptoseeds_protocol program id.");
if (!rustProgramId) blockers.push("declare_id! is missing from the Anchor program.");
if (anchorProgramId && anchorProgramId !== config.programId) {
  blockers.push("Anchor.toml program id must match VITE_CRYPTOSEEDS_PROGRAM_ID.");
}
if (rustProgramId && rustProgramId !== config.programId) {
  blockers.push("declare_id! program id must match VITE_CRYPTOSEEDS_PROGRAM_ID.");
}
if (!isValidPublicKey(config.rypMintAddress)) blockers.push("VITE_RYP_MINT_ADDRESS is not a valid Solana public key.");
if (config.cluster === "devnet" && config.rypMintAddress === MAINNET_RYP_MINT) {
  blockers.push("Devnet must use a devnet test RYP mint; the mainnet RYP mint cannot be initialized on devnet.");
}
if (!Number.isInteger(config.rypDecimals) || config.rypDecimals < 0 || config.rypDecimals > 18) {
  blockers.push("VITE_RYP_DECIMALS must be an integer between 0 and 18.");
}
if (!config.adminAuthorityAddress) {
  blockers.push("VITE_ADMIN_AUTHORITY_ADDRESS must be configured for devnet admin testing.");
} else if (!isValidPublicKey(config.adminAuthorityAddress)) {
  blockers.push("VITE_ADMIN_AUTHORITY_ADDRESS is not a valid Solana public key.");
}
if (!existsSync(path.join(repoRoot, "target", "idl", "cryptoseeds_protocol.json"))) {
  blockers.push("Anchor IDL is missing; run npm run protocol:build:wsl before devnet prep.");
}
if (!resolveProgramSoPath()) {
  blockers.push("Compiled SBF program is missing; run npm run protocol:build:wsl before devnet prep.");
}

const report = {
  status: blockers.length === 0 ? "READY_TO_DEPLOY_DEVNET" : "BLOCKED",
  envSource: path.relative(repoRoot, envPath),
  config: {
    cluster: config.cluster,
    deployment: config.deployment,
    programId: config.programId,
    rpcUrl: config.rpcUrl,
    rypMintAddress: config.rypMintAddress,
    rypDecimals: config.rypDecimals,
    demoMode: config.demoMode,
    broadcastEnabled: config.broadcastEnabled,
    adminAuthorityAddress: config.adminAuthorityAddress ?? null,
    anchorProgramId,
    rustProgramId,
  },
  blockers,
  warnings,
  nextActions: blockers.length > 0
    ? [
        "Generate a permanent devnet program keypair outside git.",
        "Create a devnet test RYP mint with 6 decimals for protocol testing.",
        "Sync Anchor.toml, declare_id!, and VITE_CRYPTOSEEDS_PROGRAM_ID.",
        "Set devnet env values while keeping broadcast disabled.",
        "Run protocol build, IDL, localnet smoke, app tests, and this prep check again.",
      ]
    : [
        "Deploy cryptoseeds_protocol to devnet with the approved program keypair.",
        "Initialize protocol config, staking vault, reward config, and verified reward vault states.",
        "Run devnet read-only inspectors before reviewing any broadcast path.",
      ],
};

console.log(JSON.stringify(report, null, 2));

if (process.argv.includes("--strict") && blockers.length > 0) {
  process.exit(1);
}

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function parseEnvFile(filePath) {
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)];
      }),
  );
}

function findAnchorProgramId(contents) {
  return contents.match(/cryptoseeds_protocol\s*=\s*"([^"]+)"/)?.[1];
}

function findRustProgramId(contents) {
  return contents.match(/declare_id!\("([^"]+)"\)/)?.[1];
}

function resolveProgramSoPath() {
  return [
    path.join(repoRoot, "target", "deploy", "cryptoseeds_protocol.so"),
    path.join(repoRoot, "programs", "cryptoseeds_protocol", "target", "deploy", "cryptoseeds_protocol.so"),
  ].find((candidate) => existsSync(candidate));
}

function isValidPublicKey(value) {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}
