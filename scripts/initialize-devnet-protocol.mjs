import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

process.on("unhandledRejection", (error) => fail(error));
process.on("uncaughtException", (error) => fail(error));

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const BPF_UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
const TOKEN_ACCOUNT_SIZE = 165;
const REWARD_EPOCH_CADENCE_SECONDS = 7n * 24n * 60n * 60n;
const BASE_FEE_BPS = 350;
const TIER_THRESHOLDS = [
  5_000_000_000n,
  20_000_000_000n,
  50_000_000_000n,
  100_000_000_000n,
  150_000_000_000n,
];
const TIER_FEE_REDUCTIONS = [0, 35, 70, 105, 140];
const REWARD_SPLIT_BPS = {
  holder: 3_334,
  staker: 3_333,
  treasury: 3_333,
};
const REWARD_ROLES = [
  { key: "holder", label: "HolderReward", seed: "holder-reward", variant: 0, custodyModel: 0, tokenAccount: "keypair" },
  { key: "staker", label: "StakerReward", seed: "staker-reward", variant: 1, custodyModel: 0, tokenAccount: "keypair" },
  { key: "treasury", label: "IndependentTreasury", seed: "independent-treasury", variant: 2, custodyModel: 1, tokenAccount: "ata" },
  { key: "delivery", label: "DeliveryCostReserve", seed: "delivery-cost-reserve", variant: 3, custodyModel: 0, tokenAccount: "keypair" },
  { key: "rollover", label: "Rollover", seed: "rollover", variant: 4, custodyModel: 0, tokenAccount: "keypair" },
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArgs(process.argv.slice(2));
const envPath = path.resolve(repoRoot, options.envPath ?? ".env.devnet.example");
const env = { ...parseEnvFile(envPath), ...process.env };
const instructionSpecs = JSON.parse(readFileSync(path.join(repoRoot, "src", "solana", "protocolInstructionSpecs.json"), "utf8"));

const config = {
  adminAuthorityAddress: env.VITE_ADMIN_AUTHORITY_ADDRESS,
  broadcastEnabled: env.VITE_SOLANA_BROADCAST_ENABLED === "true",
  cluster: env.VITE_SOLANA_CLUSTER ?? "localnet",
  demoMode: env.VITE_DEMO_MODE !== "false",
  deployment: env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT ?? "placeholder",
  programId: env.VITE_CRYPTOSEEDS_PROGRAM_ID,
  rpcUrl: env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  rypDecimals: Number(env.VITE_RYP_DECIMALS ?? 6),
  rypMintAddress: env.VITE_RYP_MINT_ADDRESS,
  treasuryAddress: env.VITE_INDEPENDENT_TREASURY_ADDRESS || env.VITE_ADMIN_AUTHORITY_ADDRESS,
};

const authorityPath = path.resolve(repoRoot, options.authorityPath ?? "target/devnet/devnet-authority.json");
const vaultKeypairDir = path.resolve(repoRoot, options.vaultKeypairDir ?? "target/devnet/reward-vaults");
const connection = new Connection(config.rpcUrl, "confirmed");
const blockers = [];
const warnings = [];
const signatures = [];

validateStaticConfig();

let authority = null;
let programId = null;
let rypMint = null;
let treasuryOwner = null;

if (blockers.length === 0) {
  authority = readKeypair(authorityPath);
  assertExpectedPublicKey("VITE_ADMIN_AUTHORITY_ADDRESS", authority.publicKey, config.adminAuthorityAddress);
  programId = new PublicKey(config.programId);
  rypMint = new PublicKey(config.rypMintAddress);
  treasuryOwner = new PublicKey(config.treasuryAddress);
  await validateDevnetAccounts();
}

let protocolPlan = null;
if (blockers.length === 0) {
  protocolPlan = await buildProtocolPlan();
}

if (blockers.length > 0) {
  const report = buildReport("BLOCKED", null);
  console.log(JSON.stringify(report, null, 2));
  if (options.strict || options.execute) process.exit(1);
  process.exit(0);
}

if (!options.execute) {
  console.log(JSON.stringify(buildReport("PLAN_ONLY", protocolPlan), null, 2));
  process.exit(0);
}

await executeProtocolPlan(protocolPlan);
console.log(JSON.stringify(buildReport("INITIALIZED", protocolPlan), null, 2));

function parseArgs(args) {
  const parsed = {
    authorityPath: undefined,
    envPath: undefined,
    execute: false,
    strict: false,
    vaultKeypairDir: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--execute") {
      parsed.execute = true;
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
      parsed.authorityPath = requireValue(args, index, "--authority");
      index += 1;
      continue;
    }
    if (arg?.startsWith("--authority=")) {
      parsed.authorityPath = arg.slice("--authority=".length);
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

function validateStaticConfig() {
  if (config.cluster !== "devnet") blockers.push("VITE_SOLANA_CLUSTER must be devnet for protocol initialization.");
  if (config.deployment !== "devnet") {
    blockers.push("VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT must be devnet for protocol initialization.");
  }
  if (config.demoMode) blockers.push("VITE_DEMO_MODE must be false for protocol initialization.");
  if (config.broadcastEnabled) {
    blockers.push("VITE_SOLANA_BROADCAST_ENABLED must remain false; this is an ops script, not app broadcast.");
  }
  if (!isValidPublicKey(config.programId)) blockers.push("VITE_CRYPTOSEEDS_PROGRAM_ID is not a valid public key.");
  if (!isValidPublicKey(config.rypMintAddress)) blockers.push("VITE_RYP_MINT_ADDRESS is not a valid public key.");
  if (!isValidPublicKey(config.adminAuthorityAddress)) blockers.push("VITE_ADMIN_AUTHORITY_ADDRESS is not a valid public key.");
  if (!isValidPublicKey(config.treasuryAddress)) blockers.push("Treasury address is not a valid public key.");
  if (!Number.isInteger(config.rypDecimals) || config.rypDecimals < 0 || config.rypDecimals > 18) {
    blockers.push("VITE_RYP_DECIMALS must be an integer between 0 and 18.");
  }
  if (config.treasuryAddress === config.adminAuthorityAddress) {
    warnings.push("VITE_INDEPENDENT_TREASURY_ADDRESS is not set; devnet treasury vault will use the admin authority wallet.");
  }
  if (!existsSync(authorityPath)) blockers.push(`Authority keypair file not found: ${path.relative(repoRoot, authorityPath)}`);
}

async function validateDevnetAccounts() {
  const programAccount = await connection.getAccountInfo(programId, "confirmed");
  if (!programAccount) {
    blockers.push("Devnet program account was not found. Deploy the Anchor program before initialization.");
  } else {
    if (!programAccount.executable) blockers.push("Devnet program account is not executable.");
    if (programAccount.owner.toBase58() !== BPF_UPGRADEABLE_LOADER_ID) {
      blockers.push("Devnet program account is not owned by the upgradeable BPF loader.");
    }
  }

  const mintAccount = await connection.getParsedAccountInfo(rypMint, "confirmed");
  if (!mintAccount.value) {
    blockers.push("Devnet RYP test mint account was not found. Create the devnet test mint before initialization.");
  } else if (!("parsed" in mintAccount.value.data) || mintAccount.value.data.parsed.type !== "mint") {
    blockers.push("Devnet RYP account is not a parsed SPL mint.");
  } else {
    const decimals = Number(mintAccount.value.data.parsed.info.decimals);
    if (decimals !== config.rypDecimals) {
      blockers.push(`Devnet RYP mint decimals are ${decimals}; expected ${config.rypDecimals}.`);
    }
  }

  const balance = await connection.getBalance(authority.publicKey, "confirmed");
  if (balance < 0.05 * LAMPORTS_PER_SOL) {
    blockers.push(`Devnet authority has ${balance / LAMPORTS_PER_SOL} SOL; fund it before initialization.`);
  }
}

async function buildProtocolPlan() {
  const configAddress = derivePda(["config"]);
  const rewardConfigAddress = derivePda(["reward-config"]);
  const rypVaultAddress = deriveAssociatedTokenAddress({ mint: rypMint, owner: configAddress });
  const treasuryVaultAddress = deriveAssociatedTokenAddress({ mint: rypMint, owner: treasuryOwner });
  const rolePlans = [];
  const generatedVaultKeypairFiles = [];

  for (const role of REWARD_ROLES) {
    const rewardVaultStateAddress = derivePda(["reward-vault", rewardConfigAddress, role.seed]);
    let rewardVaultAddress = treasuryVaultAddress;
    let vaultKeypairPath = null;
    let vaultKeypair = null;

    if (role.tokenAccount === "keypair") {
      vaultKeypairPath = path.join(vaultKeypairDir, `${role.key}-reward-vault.json`);
      const keypairResult = readOrCreateKeypair(vaultKeypairPath);
      vaultKeypair = keypairResult.keypair;
      rewardVaultAddress = vaultKeypair.publicKey;
      if (keypairResult.created) generatedVaultKeypairFiles.push(path.relative(repoRoot, vaultKeypairPath));
    }

    rolePlans.push({
      custodyModel: role.custodyModel,
      key: role.key,
      label: role.label,
      metadataHashHex: rewardVaultMetadataHashHex({ role, rewardVaultAddress }),
      rewardVaultAddress: rewardVaultAddress.toBase58(),
      rewardVaultStateAddress: rewardVaultStateAddress.toBase58(),
      seed: role.seed,
      tokenAccountKind: role.tokenAccount,
      variant: role.variant,
      vaultKeypair,
      vaultKeypairPath: vaultKeypairPath ? path.relative(repoRoot, vaultKeypairPath) : null,
    });
  }

  const plan = {
    authority: authority.publicKey.toBase58(),
    generatedVaultKeypairFiles,
    instructions: [],
    programId: programId.toBase58(),
    rewardConfig: rewardConfigAddress.toBase58(),
    rewardSplitBps: REWARD_SPLIT_BPS,
    rewardVaultRoles: rolePlans.map(({ vaultKeypair, ...role }) => role),
    rypMint: rypMint.toBase58(),
    rypVault: rypVaultAddress.toBase58(),
    treasuryOwner: treasuryOwner.toBase58(),
    config: configAddress.toBase58(),
  };

  await addAccountStep(plan, "initialize_config", configAddress, "Initialize ProtocolConfig and staking vault");
  await addAccountStep(plan, "initialize_reward_config", rewardConfigAddress, "Initialize RewardConfig");

  for (const role of rolePlans) {
    await addTokenAccountStep(plan, role);
    await addAccountStep(
      plan,
      `register_reward_vault:${role.key}`,
      new PublicKey(role.rewardVaultStateAddress),
      `Register ${role.label} reward vault state`,
    );
    plan.instructions.push({
      action: `verify_reward_vault:${role.key}`,
      status: "READY",
      target: role.rewardVaultStateAddress,
      title: `Verify ${role.label} reward vault metadata`,
    });
  }

  return plan;
}

async function addAccountStep(plan, action, address, title) {
  const account = await connection.getAccountInfo(address, "confirmed");
  plan.instructions.push({
    action,
    status: account ? "EXISTS" : "READY",
    target: address.toBase58(),
    title,
  });
}

async function addTokenAccountStep(plan, role) {
  const account = await connection.getParsedAccountInfo(new PublicKey(role.rewardVaultAddress), "confirmed");
  plan.instructions.push({
    action: `create_reward_token_account:${role.key}`,
    status: account.value ? "EXISTS" : "READY",
    target: role.rewardVaultAddress,
    title: `Create ${role.label} reward token account`,
  });
}

async function executeProtocolPlan(plan) {
  const configAddress = new PublicKey(plan.config);
  const rewardConfigAddress = new PublicKey(plan.rewardConfig);
  const rypVaultAddress = new PublicKey(plan.rypVault);

  if (await missingAccount(configAddress)) {
    await sendInstruction(
      "initialize_config",
      new TransactionInstruction({
        programId,
        keys: [
          accountMeta(authority.publicKey, true, true),
          accountMeta(rypMint, false, false),
          accountMeta(configAddress, false, true),
          accountMeta(rypVaultAddress, false, true),
          accountMeta(TOKEN_PROGRAM_ID, false, false),
          accountMeta(ASSOCIATED_TOKEN_PROGRAM_ID, false, false),
          accountMeta(SystemProgram.programId, false, false),
        ],
        data: initializeConfigData(),
      }),
      [authority],
    );
  }

  if (await missingAccount(rewardConfigAddress)) {
    await sendInstruction(
      "initialize_reward_config",
      new TransactionInstruction({
        programId,
        keys: [
          accountMeta(authority.publicKey, true, true),
          accountMeta(configAddress, false, false),
          accountMeta(rypMint, false, false),
          accountMeta(rewardConfigAddress, false, true),
          accountMeta(SystemProgram.programId, false, false),
        ],
        data: initializeRewardConfigData(),
      }),
      [authority],
    );
  }

  for (const role of await buildExecutableRolePlans(rewardConfigAddress)) {
    const rewardVaultAddress = new PublicKey(role.rewardVaultAddress);
    const rewardVaultStateAddress = new PublicKey(role.rewardVaultStateAddress);
    if (await missingAccount(rewardVaultAddress)) {
      if (role.tokenAccountKind === "ata") {
        await sendInstruction(
          `create_reward_token_account:${role.key}`,
          createAssociatedTokenAccountInstruction({
            mint: rypMint,
            owner: treasuryOwner,
            payer: authority.publicKey,
            tokenAccount: rewardVaultAddress,
          }),
          [authority],
        );
      } else {
        const createTokenAccountPlan = await createTokenAccountInstructions({
          mint: rypMint,
          owner: rewardConfigAddress,
          payer: authority.publicKey,
          tokenAccount: role.vaultKeypair.publicKey,
        });
        await sendInstruction(
          `create_reward_token_account:${role.key}`,
          createTokenAccountPlan,
          [authority, role.vaultKeypair],
        );
      }
    }

    if (await missingAccount(rewardVaultStateAddress)) {
      await sendInstruction(
        `register_reward_vault:${role.key}`,
        registerRewardVaultInstruction({
          configAddress,
          metadataHashHex: role.metadataHashHex,
          rewardConfigAddress,
          rewardVaultAddress,
          rewardVaultStateAddress,
          role,
        }),
        [authority],
      );
    }

    await sendInstruction(
      `verify_reward_vault:${role.key}`,
      verifyRewardVaultInstruction({
        configAddress,
        metadataHashHex: role.metadataHashHex,
        rewardConfigAddress,
        rewardVaultStateAddress,
        role,
      }),
      [authority],
    );
  }
}

async function buildExecutableRolePlans(rewardConfigAddress) {
  return Promise.all(
    REWARD_ROLES.map(async (role) => {
      const rewardVaultStateAddress = derivePda(["reward-vault", rewardConfigAddress, role.seed]);
      let rewardVaultAddress = deriveAssociatedTokenAddress({ mint: rypMint, owner: treasuryOwner });
      let vaultKeypair = null;
      if (role.tokenAccount === "keypair") {
        vaultKeypair = readKeypair(path.join(vaultKeypairDir, `${role.key}-reward-vault.json`));
        rewardVaultAddress = vaultKeypair.publicKey;
      }
      return {
        custodyModel: role.custodyModel,
        key: role.key,
        label: role.label,
        metadataHashHex: rewardVaultMetadataHashHex({ role, rewardVaultAddress }),
        rewardVaultAddress: rewardVaultAddress.toBase58(),
        rewardVaultStateAddress: rewardVaultStateAddress.toBase58(),
        tokenAccountKind: role.tokenAccount,
        variant: role.variant,
        vaultKeypair,
      };
    }),
  );
}

function initializeConfigData() {
  const data = Buffer.alloc(8 + 2 + 5 * 8 + 5 * 2);
  discriminator("initialize_config").copy(data, 0);
  data.writeUInt16LE(BASE_FEE_BPS, 8);
  let offset = 10;
  for (const threshold of TIER_THRESHOLDS) {
    data.writeBigUInt64LE(threshold, offset);
    offset += 8;
  }
  for (const reduction of TIER_FEE_REDUCTIONS) {
    data.writeUInt16LE(reduction, offset);
    offset += 2;
  }
  return data;
}

function initializeRewardConfigData() {
  const data = Buffer.alloc(8 + 8 + 2 + 2 + 2);
  discriminator("initialize_reward_config").copy(data, 0);
  data.writeBigInt64LE(REWARD_EPOCH_CADENCE_SECONDS, 8);
  data.writeUInt16LE(REWARD_SPLIT_BPS.holder, 16);
  data.writeUInt16LE(REWARD_SPLIT_BPS.staker, 18);
  data.writeUInt16LE(REWARD_SPLIT_BPS.treasury, 20);
  return data;
}

function registerRewardVaultInstruction({
  configAddress,
  metadataHashHex,
  rewardConfigAddress,
  rewardVaultAddress,
  rewardVaultStateAddress,
  role,
}) {
  const data = Buffer.alloc(8 + 1 + 32 + 1 + 32);
  discriminator("register_reward_vault").copy(data, 0);
  data.writeUInt8(role.variant, 8);
  new PublicKey(rewardVaultAddress).toBuffer().copy(data, 9);
  data.writeUInt8(role.custodyModel, 41);
  Buffer.from(metadataHashHex, "hex").copy(data, 42);

  return new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, true),
      accountMeta(configAddress, false, false),
      accountMeta(rewardConfigAddress, false, true),
      accountMeta(rewardVaultStateAddress, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });
}

function verifyRewardVaultInstruction({ configAddress, metadataHashHex, rewardConfigAddress, rewardVaultStateAddress, role }) {
  const data = Buffer.alloc(8 + 1 + 32);
  discriminator("verify_reward_vault").copy(data, 0);
  data.writeUInt8(role.variant, 8);
  Buffer.from(metadataHashHex, "hex").copy(data, 9);

  return new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(configAddress, false, false),
      accountMeta(rewardConfigAddress, false, true),
      accountMeta(rewardVaultStateAddress, false, true),
    ],
    data,
  });
}

function createAssociatedTokenAccountInstruction({ mint, owner, payer, tokenAccount }) {
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      accountMeta(payer, true, true),
      accountMeta(tokenAccount, false, true),
      accountMeta(owner, false, false),
      accountMeta(mint, false, false),
      accountMeta(SystemProgram.programId, false, false),
      accountMeta(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.alloc(0),
  });
}

async function createTokenAccountInstructions({ mint, owner, payer, tokenAccount }) {
  const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);
  return [
    SystemProgram.createAccount({
      fromPubkey: payer,
      lamports,
      newAccountPubkey: tokenAccount,
      programId: TOKEN_PROGRAM_ID,
      space: TOKEN_ACCOUNT_SIZE,
    }),
    new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        accountMeta(tokenAccount, false, true),
        accountMeta(mint, false, false),
        accountMeta(owner, false, false),
        accountMeta(SYSVAR_RENT_PUBKEY, false, false),
      ],
      data: Buffer.from([1]),
    }),
  ];
}

async function sendInstruction(action, instructionOrInstructions, signers) {
  const instructions = Array.isArray(instructionOrInstructions) ? instructionOrInstructions : [instructionOrInstructions];
  const transaction = new Transaction();
  for (const instruction of instructions) {
    transaction.add(instruction);
  }
  const signature = await sendAndConfirmTransaction(connection, transaction, signers, {
    commitment: "confirmed",
    maxRetries: 5,
  });
  signatures.push({ action, signature });
}

function derivePda(seeds) {
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

function discriminator(name) {
  const spec = instructionSpecs[name];
  if (!spec?.discriminatorHex) {
    throw new Error(`Missing instruction discriminator for ${name}.`);
  }
  return Buffer.from(spec.discriminatorHex, "hex");
}

function readKeypair(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Keypair file not found: ${filePath}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(filePath, "utf8"))));
}

function readOrCreateKeypair(filePath) {
  if (existsSync(filePath)) {
    return { created: false, keypair: readKeypair(filePath) };
  }
  mkdirSync(path.dirname(filePath), { recursive: true });
  const keypair = Keypair.generate();
  writeFileSync(filePath, JSON.stringify([...keypair.secretKey]));
  return { created: true, keypair };
}

function assertExpectedPublicKey(label, actual, expected) {
  if (!expected) {
    throw new Error(`${label} must be configured.`);
  }
  if (actual.toBase58() !== expected) {
    throw new Error(`${label} mismatch: keypair is ${actual.toBase58()}, env expects ${expected}.`);
  }
}

async function missingAccount(address) {
  return !(await connection.getAccountInfo(address, "confirmed"));
}

function accountMeta(pubkey, isSigner, isWritable) {
  return { pubkey, isSigner, isWritable };
}

function buildReport(status, plan) {
  return {
    status,
    envSource: path.relative(repoRoot, envPath),
    execute: options.execute,
    config: {
      adminAuthorityAddress: config.adminAuthorityAddress,
      appBroadcastEnabled: config.broadcastEnabled,
      cluster: config.cluster,
      demoMode: config.demoMode,
      deployment: config.deployment,
      programId: config.programId,
      rewardEpochCadenceSeconds: REWARD_EPOCH_CADENCE_SECONDS.toString(),
      rewardSplitBps: REWARD_SPLIT_BPS,
      rpcUrl: config.rpcUrl,
      rypMintAddress: config.rypMintAddress,
      rypDecimals: config.rypDecimals,
      treasuryAddress: config.treasuryAddress,
    },
    blockers,
    warnings,
    plan,
    signatures,
    nextActions: status === "BLOCKED"
      ? [
          "Fund the devnet authority wallet.",
          "Create the configured devnet test mint.",
          "Deploy the configured program to devnet.",
          "Re-run npm run devnet:init:protocol -- --env .env.devnet.example.",
        ]
      : status === "PLAN_ONLY"
        ? [
            "Review the derived config, reward vault, and treasury addresses.",
            "Run npm run devnet:init:protocol -- --env .env.devnet.example --execute after review.",
            "Run read-only reward account inspection after initialization.",
          ]
        : [
            "Run npm run devnet:program:check -- --env .env.devnet.example.",
            "Run read-only reward account inspection and devnet readiness checks.",
          ],
  };
}

function isValidPublicKey(value) {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

function fail(error) {
  console.error(JSON.stringify({
    status: "FAILED",
    reason: error instanceof Error ? error.message : "unknown error",
  }, null, 2));
  process.exit(1);
}
