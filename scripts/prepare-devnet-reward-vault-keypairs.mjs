import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair, PublicKey } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const PLACEHOLDER_PROGRAM_ID = "FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL";
const MAINNET_RYP_MINT = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
const REWARD_ROLES = [
  { key: "holder", label: "HolderReward", seed: "holder-reward", custodyModel: 0, tokenAccount: "keypair" },
  { key: "staker", label: "StakerReward", seed: "staker-reward", custodyModel: 0, tokenAccount: "keypair" },
  { key: "treasury", label: "IndependentTreasury", seed: "independent-treasury", custodyModel: 1, tokenAccount: "ata" },
  { key: "delivery", label: "DeliveryCostReserve", seed: "delivery-cost-reserve", custodyModel: 0, tokenAccount: "keypair" },
  { key: "rollover", label: "Rollover", seed: "rollover", custodyModel: 0, tokenAccount: "keypair" },
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const envPath = path.resolve(repoRoot, options.envPath ?? ".env.devnet.example");
const env = { ...parseEnvFile(envPath), ...process.env };
const treasuryPath = path.resolve(repoRoot, options.treasuryPath ?? "target/devnet/independent-treasury.json");
const vaultKeypairDir = path.resolve(repoRoot, options.vaultKeypairDir ?? "target/devnet/reward-vaults");

const config = {
  adminAuthorityAddress: env.VITE_ADMIN_AUTHORITY_ADDRESS,
  cluster: env.VITE_SOLANA_CLUSTER ?? "localnet",
  deployment: env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT ?? "placeholder",
  programId: env.VITE_CRYPTOSEEDS_PROGRAM_ID ?? PLACEHOLDER_PROGRAM_ID,
  rypMintAddress: env.VITE_RYP_MINT_ADDRESS ?? MAINNET_RYP_MINT,
  independentTreasuryAddress: env.VITE_INDEPENDENT_TREASURY_ADDRESS,
  treasuryAddress: env.VITE_INDEPENDENT_TREASURY_ADDRESS || env.VITE_ADMIN_AUTHORITY_ADDRESS,
};
const blockers = [];
const warnings = [
  "Reward vault keypair secret files are local-only and ignored by git.",
  "Do not paste, upload, or share files under target/devnet/reward-vaults.",
];

validateConfig();

let report;
if (blockers.length === 0) {
  report = buildReport("READY", prepareRewardVaultKeypairs());
} else {
  report = buildReport("BLOCKED", null);
}

console.log(JSON.stringify(report, null, 2));

if (blockers.length > 0) {
  process.exit(1);
}

function prepareRewardVaultKeypairs() {
  const programId = new PublicKey(config.programId);
  const rypMint = new PublicKey(config.rypMintAddress);
  const treasuryOwner = readKeypair(treasuryPath, "independent treasury keypair").publicKey;
  const rewardConfig = derivePda(programId, ["reward-config"]);
  const treasuryRewardVault = deriveAssociatedTokenAddress({ mint: rypMint, owner: treasuryOwner });
  const roles = [];
  const createdFiles = [];

  for (const role of REWARD_ROLES) {
    const rewardVaultState = derivePda(programId, ["reward-vault", rewardConfig, role.seed]);
    let rewardVaultAddress = treasuryRewardVault;
    let keypairPath = null;
    let keypairStatus = "ATA";

    if (role.tokenAccount === "keypair") {
      keypairPath = path.join(vaultKeypairDir, `${role.key}-reward-vault.json`);
      const keypairResult = readOrCreateKeypair(keypairPath);
      rewardVaultAddress = keypairResult.keypair.publicKey;
      keypairStatus = keypairResult.created ? "CREATED" : "EXISTS";
      if (keypairResult.created) createdFiles.push(path.relative(repoRoot, keypairPath));
    }

    roles.push({
      custodyModel: role.custodyModel,
      key: role.key,
      label: role.label,
      metadataHashHex: rewardVaultMetadataHashHex({ role, rewardVaultAddress }),
      rewardVaultAddress: rewardVaultAddress.toBase58(),
      rewardVaultKeypairPath: keypairPath ? path.relative(repoRoot, keypairPath) : null,
      rewardVaultKeypairStatus: keypairStatus,
      rewardVaultStateAddress: rewardVaultState.toBase58(),
      seed: role.seed,
      tokenAccountKind: role.tokenAccount,
    });
  }

  return {
    createdFiles,
    rewardConfig: rewardConfig.toBase58(),
    rewardVaultRoles: roles,
    treasuryOwner: treasuryOwner.toBase58(),
    treasuryRewardVault: treasuryRewardVault.toBase58(),
    vaultKeypairDir: path.relative(repoRoot, vaultKeypairDir),
  };
}

function validateConfig() {
  if (config.cluster !== "devnet") blockers.push("VITE_SOLANA_CLUSTER must be devnet.");
  if (config.deployment !== "devnet") blockers.push("VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT must be devnet.");
  if (!isValidPublicKey(config.programId)) blockers.push("VITE_CRYPTOSEEDS_PROGRAM_ID is not a valid public key.");
  if (config.programId === PLACEHOLDER_PROGRAM_ID) blockers.push("Program id is still the development placeholder.");
  if (!isValidPublicKey(config.rypMintAddress)) blockers.push("VITE_RYP_MINT_ADDRESS is not a valid public key.");
  if (config.rypMintAddress === MAINNET_RYP_MINT) blockers.push("Devnet reward vault prep must use a devnet test RYP mint.");
  if (!isValidPublicKey(config.adminAuthorityAddress)) blockers.push("VITE_ADMIN_AUTHORITY_ADDRESS is not a valid public key.");
  if (!config.independentTreasuryAddress) blockers.push("VITE_INDEPENDENT_TREASURY_ADDRESS must be set for reward vault prep.");
  if (!isValidPublicKey(config.treasuryAddress)) blockers.push("Treasury address is not a valid public key.");
  if (config.treasuryAddress === config.adminAuthorityAddress) {
    blockers.push("Independent treasury address must be distinct from the admin authority wallet.");
  }
  if (!existsSync(treasuryPath)) {
    blockers.push(`Independent treasury keypair file not found: ${path.relative(repoRoot, treasuryPath)}`);
  } else if (config.independentTreasuryAddress) {
    const treasuryKeypair = readKeypair(treasuryPath, "independent treasury keypair");
    if (treasuryKeypair.publicKey.toBase58() !== config.independentTreasuryAddress) {
      blockers.push(
        `Independent treasury keypair address ${treasuryKeypair.publicKey.toBase58()} does not match VITE_INDEPENDENT_TREASURY_ADDRESS ${config.independentTreasuryAddress}.`,
      );
    }
  }
}

function buildReport(status, plan) {
  return {
    status,
    envSource: path.relative(repoRoot, envPath),
    config: {
      adminAuthorityAddress: config.adminAuthorityAddress ?? null,
      cluster: config.cluster,
      deployment: config.deployment,
      independentTreasuryAddress: config.independentTreasuryAddress ?? null,
      programId: config.programId,
      rypMintAddress: config.rypMintAddress,
      treasuryAddress: config.treasuryAddress ?? null,
      treasuryKeypairPath: path.relative(repoRoot, treasuryPath),
    },
    blockers,
    warnings,
    plan,
    nextActions:
      status === "READY"
        ? [
            "Run npm run devnet:status -- --env .env.devnet.example to confirm reward vault keypair readiness.",
            "Review reward vault public addresses and metadata hashes before protocol initialization.",
            "Fund devnet authority, create mint, deploy program, then run npm run devnet:init:protocol -- --env .env.devnet.example.",
          ]
        : [
            "Fix devnet environment values.",
            "Re-run npm run devnet:vaults:prep -- --env .env.devnet.example.",
          ],
  };
}

function readOrCreateKeypair(filePath) {
  if (existsSync(filePath)) {
    return { created: false, keypair: readKeypair(filePath, "reward vault keypair") };
  }

  mkdirSync(path.dirname(filePath), { recursive: true });
  const keypair = Keypair.generate();
  writeFileSync(filePath, JSON.stringify([...keypair.secretKey]));
  return { created: true, keypair };
}

function readKeypair(filePath, label = "keypair") {
  try {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(filePath, "utf8"))));
  } catch (error) {
    throw new Error(`Could not read ${label} ${path.relative(repoRoot, filePath)}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

function parseArgs(args) {
  const parsed = {
    envPath: undefined,
    treasuryPath: undefined,
    vaultKeypairDir: undefined,
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
    if (arg === "--treasury") {
      parsed.treasuryPath = requireValue(args, index, "--treasury");
      index += 1;
      continue;
    }
    if (arg?.startsWith("--treasury=")) {
      parsed.treasuryPath = arg.slice("--treasury=".length);
      continue;
    }
    if (arg === "--vault-keypair-dir") {
      parsed.vaultKeypairDir = requireValue(args, index, "--vault-keypair-dir");
      index += 1;
      continue;
    }
    if (arg?.startsWith("--vault-keypair-dir=")) {
      parsed.vaultKeypairDir = arg.slice("--vault-keypair-dir=".length);
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

function derivePda(programId, seeds) {
  const preparedSeeds = seeds.map((seed) => {
    if (seed instanceof PublicKey) return seed.toBuffer();
    if (typeof seed === "string") return Buffer.from(seed);
    return seed;
  });
  return PublicKey.findProgramAddressSync(preparedSeeds, programId)[0];
}

function deriveAssociatedTokenAddress({ mint, owner }) {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

function rewardVaultMetadataHashHex({ role, rewardVaultAddress }) {
  return createHash("sha256")
    .update("cryptoseeds-devnet-reward-vault-v1")
    .update(role.seed)
    .update(rewardVaultAddress.toBase58())
    .update(config.rypMintAddress)
    .update(String(role.custodyModel))
    .digest("hex");
}

function isValidPublicKey(value) {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}
