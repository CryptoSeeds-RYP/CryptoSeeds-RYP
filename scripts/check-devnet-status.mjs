import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const BPF_UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
const PLACEHOLDER_PROGRAM_ID = "FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL";
const MAINNET_RYP_MINT = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
const MIN_MINT_SOL = 0.1;
const MIN_DEPLOY_SOL = 3;
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
const anchorToml = readText("Anchor.toml");
const rustProgram = readText(path.join("programs", "cryptoseeds_protocol", "src", "lib.rs"));
const connection = new Connection(env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com", "confirmed");

const keypairPaths = {
  authority: path.resolve(repoRoot, options.authorityPath ?? "target/devnet/devnet-authority.json"),
  mint: path.resolve(repoRoot, options.mintPath ?? "target/devnet/ryp-test-mint-keypair.json"),
  program: path.resolve(repoRoot, options.programPath ?? "target/devnet/cryptoseeds_protocol-keypair.json"),
};
const vaultKeypairDir = path.resolve(repoRoot, options.vaultKeypairDir ?? "target/devnet/reward-vaults");

const config = {
  adminAuthorityAddress: env.VITE_ADMIN_AUTHORITY_ADDRESS,
  broadcastEnabled: env.VITE_SOLANA_BROADCAST_ENABLED === "true",
  cluster: env.VITE_SOLANA_CLUSTER ?? "localnet",
  demoMode: env.VITE_DEMO_MODE !== "false",
  deployment: env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT ?? "placeholder",
  programId: env.VITE_CRYPTOSEEDS_PROGRAM_ID ?? PLACEHOLDER_PROGRAM_ID,
  rpcUrl: env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  rypDecimals: Number(env.VITE_RYP_DECIMALS ?? 6),
  rypMintAddress: env.VITE_RYP_MINT_ADDRESS ?? MAINNET_RYP_MINT,
  treasuryAddress: env.VITE_INDEPENDENT_TREASURY_ADDRESS || env.VITE_ADMIN_AUTHORITY_ADDRESS,
};

const blockers = [];
const warnings = [];
const local = {
  anchorProgramId: findAnchorProgramId(anchorToml),
  rustProgramId: findRustProgramId(rustProgram),
  idlExists: existsSync(path.join(repoRoot, "target", "idl", "cryptoseeds_protocol.json")),
  programSoExists: Boolean(resolveProgramSoPath()),
  keypairs: {
    authority: readKeypairStatus(keypairPaths.authority, config.adminAuthorityAddress),
    mint: readKeypairStatus(keypairPaths.mint, config.rypMintAddress),
    program: readKeypairStatus(keypairPaths.program, config.programId),
  },
  rewardVaultKeypairs: readRewardVaultKeypairStatuses(),
};

validateStaticConfig();

const protocolTargets = buildProtocolTargets();
const chain = await readDevnetChainStatus();
validateChainStatus(chain);

const report = {
  status: blockers.length === 0 ? "READY_FOR_DEPLOYMENT_STEPS" : "BLOCKED",
  envSource: path.relative(repoRoot, envPath),
  config: {
    adminAuthorityAddress: config.adminAuthorityAddress ?? null,
    broadcastEnabled: config.broadcastEnabled,
    cluster: config.cluster,
    demoMode: config.demoMode,
    deployment: config.deployment,
    programId: config.programId,
    rpcUrl: config.rpcUrl,
    rypDecimals: config.rypDecimals,
    rypMintAddress: config.rypMintAddress,
    treasuryAddress: config.treasuryAddress ?? null,
  },
  local,
  protocolTargets,
  chain,
  blockers,
  warnings,
  nextActions: nextActions(),
};

console.log(JSON.stringify(report, null, 2));

if (options.strict && blockers.length > 0) {
  process.exit(1);
}

async function readDevnetChainStatus() {
  const status = {
    authority: null,
    mint: null,
    program: null,
  };

  if (isValidPublicKey(config.adminAuthorityAddress)) {
    status.authority = await readWalletStatus(config.adminAuthorityAddress);
  }
  if (isValidPublicKey(config.rypMintAddress)) {
    status.mint = await readMintStatus(config.rypMintAddress);
  }
  if (isValidPublicKey(config.programId)) {
    status.program = await readProgramStatus(config.programId);
  }

  return status;
}

async function readWalletStatus(address) {
  try {
    const publicKey = new PublicKey(address);
    const lamports = await connection.getBalance(publicKey, "confirmed");
    return {
      address,
      exists: lamports > 0,
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
      minimumMintSolRequired: MIN_MINT_SOL,
      minimumDeploySolRecommended: MIN_DEPLOY_SOL,
      fundedForMint: lamports >= MIN_MINT_SOL * LAMPORTS_PER_SOL,
      fundedForDeploy: lamports >= MIN_DEPLOY_SOL * LAMPORTS_PER_SOL,
    };
  } catch (error) {
    return {
      address,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function readMintStatus(address) {
  try {
    const account = await connection.getParsedAccountInfo(new PublicKey(address), "confirmed");
    if (!account.value) {
      return {
        address,
        exists: false,
      };
    }
    if (!("parsed" in account.value.data) || account.value.data.parsed.type !== "mint") {
      return {
        address,
        exists: true,
        isMint: false,
        owner: account.value.owner.toBase58(),
      };
    }

    return {
      address,
      exists: true,
      isMint: true,
      decimals: Number(account.value.data.parsed.info.decimals),
      freezeAuthority: account.value.data.parsed.info.freezeAuthority ?? null,
      mintAuthority: account.value.data.parsed.info.mintAuthority ?? null,
      supply: account.value.data.parsed.info.supply,
    };
  } catch (error) {
    return {
      address,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

async function readProgramStatus(address) {
  try {
    const account = await connection.getAccountInfo(new PublicKey(address), "confirmed");
    if (!account) {
      return {
        address,
        exists: false,
      };
    }

    return {
      address,
      dataLength: account.data.length,
      executable: account.executable,
      exists: true,
      lamports: account.lamports,
      owner: account.owner.toBase58(),
      programDataAddress: parseProgramDataAddress(account.data),
    };
  } catch (error) {
    return {
      address,
      error: error instanceof Error ? error.message : "unknown error",
    };
  }
}

function validateStaticConfig() {
  if (config.cluster !== "devnet") blockers.push("VITE_SOLANA_CLUSTER must be devnet.");
  if (config.deployment !== "devnet") blockers.push("VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT must be devnet.");
  if (config.demoMode) blockers.push("VITE_DEMO_MODE must be false for devnet work.");
  if (config.broadcastEnabled) warnings.push("App broadcast is enabled; keep it false until after devnet review.");
  if (!isValidPublicKey(config.programId)) blockers.push("VITE_CRYPTOSEEDS_PROGRAM_ID is not a valid public key.");
  if (config.programId === PLACEHOLDER_PROGRAM_ID) blockers.push("Program id is still the development placeholder.");
  if (!isValidPublicKey(config.rypMintAddress)) blockers.push("VITE_RYP_MINT_ADDRESS is not a valid public key.");
  if (config.rypMintAddress === MAINNET_RYP_MINT) blockers.push("Devnet must use a devnet test RYP mint.");
  if (!isValidPublicKey(config.adminAuthorityAddress)) blockers.push("VITE_ADMIN_AUTHORITY_ADDRESS is not a valid public key.");
  if (!isValidPublicKey(config.treasuryAddress)) blockers.push("Treasury address is not a valid public key.");
  if (!Number.isInteger(config.rypDecimals) || config.rypDecimals < 0 || config.rypDecimals > 18) {
    blockers.push("VITE_RYP_DECIMALS must be an integer between 0 and 18.");
  }
  if (config.treasuryAddress === config.adminAuthorityAddress) {
    warnings.push("VITE_INDEPENDENT_TREASURY_ADDRESS is not set; devnet treasury target defaults to the admin authority wallet.");
  }
  if (!local.idlExists) blockers.push("Anchor IDL is missing; run npm run protocol:build:wsl.");
  if (!local.programSoExists) blockers.push("Compiled SBF program is missing; run npm run protocol:build:wsl.");
  if (!local.anchorProgramId) blockers.push("Anchor.toml is missing cryptoseeds_protocol program id.");
  if (!local.rustProgramId) blockers.push("declare_id! is missing from the Anchor program.");
  if (local.anchorProgramId && local.anchorProgramId !== config.programId) {
    blockers.push("Anchor.toml program id does not match VITE_CRYPTOSEEDS_PROGRAM_ID.");
  }
  if (local.rustProgramId && local.rustProgramId !== config.programId) {
    blockers.push("declare_id! program id does not match VITE_CRYPTOSEEDS_PROGRAM_ID.");
  }

  for (const [name, status] of Object.entries(local.keypairs)) {
    if (!status.exists) blockers.push(`Missing local ${name} keypair: ${status.path}`);
    if (status.exists && status.expectedAddress && status.address !== status.expectedAddress) {
      blockers.push(`${name} keypair address ${status.address} does not match expected ${status.expectedAddress}.`);
    }
  }
}

function validateChainStatus(chain) {
  if (chain.authority?.error) blockers.push(`Devnet authority could not be checked: ${chain.authority.error}.`);
  if (chain.authority && !chain.authority.fundedForMint) {
    blockers.push(
      `Devnet authority has ${chain.authority.sol} SOL; fund ${chain.authority.address} with at least ${MIN_MINT_SOL} SOL to create the test mint.`,
    );
  }

  if (chain.mint?.error) blockers.push(`Devnet RYP test mint could not be checked: ${chain.mint.error}.`);
  if (chain.mint && !chain.mint.exists) blockers.push("Devnet RYP test mint account does not exist.");
  if (chain.mint?.exists && !chain.mint.isMint) blockers.push("Devnet RYP account exists but is not a parsed SPL mint.");
  if (chain.mint?.isMint && chain.mint.decimals !== config.rypDecimals) {
    blockers.push(`Devnet RYP mint decimals are ${chain.mint.decimals}; expected ${config.rypDecimals}.`);
  }

  if (chain.program?.error) blockers.push(`Devnet program could not be checked: ${chain.program.error}.`);
  if (chain.program && !chain.program.exists) blockers.push("Devnet program account does not exist.");
  if (chain.program && !chain.program.exists && chain.authority && chain.authority.fundedForMint && !chain.authority.fundedForDeploy) {
    warnings.push(
      `Devnet authority has ${chain.authority.sol} SOL; ${MIN_DEPLOY_SOL} SOL is recommended before program deployment.`,
    );
  }
  if (chain.program?.exists && !chain.program.executable) blockers.push("Devnet program account is not executable.");
  if (chain.program?.exists && chain.program.owner !== BPF_UPGRADEABLE_LOADER_ID) {
    blockers.push("Devnet program account is not owned by the upgradeable BPF loader.");
  }
}

function nextActions() {
  if (!chain.authority?.fundedForMint) {
    return [
      `Fund devnet authority ${config.adminAuthorityAddress} with at least ${MIN_MINT_SOL} SOL for mint creation; ${MIN_DEPLOY_SOL} SOL is recommended before deployment.`,
      "Re-run npm run devnet:status -- --env .env.devnet.example.",
      "Then run npm run devnet:mint:test -- --env .env.devnet.example.",
    ];
  }
  if (!chain.mint?.exists) {
    return [
      "Run npm run devnet:mint:test -- --env .env.devnet.example.",
      "Run npm run devnet:prep -- --env .env.devnet.example.",
    ];
  }
  if (!chain.program?.exists) {
    return [
      "Run npm run devnet:prep -- --env .env.devnet.example.",
      "Run npm run devnet:deploy:wsl -- -EnvPath .env.devnet.example.",
      "Re-run npm run devnet:status -- --env .env.devnet.example.",
    ];
  }
  return [
    "Run npm run devnet:init:protocol -- --env .env.devnet.example.",
    "Review the plan, then run with --execute when approved.",
    "Run read-only reward inspection after initialization.",
  ];
}

function parseArgs(args) {
  const parsed = {
    authorityPath: undefined,
    envPath: undefined,
    mintPath: undefined,
    programPath: undefined,
    strict: false,
    vaultKeypairDir: undefined,
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
    if (arg === "--program") {
      parsed.programPath = requireValue(args, index, "--program");
      index += 1;
      continue;
    }
    if (arg?.startsWith("--program=")) {
      parsed.programPath = arg.slice("--program=".length);
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

function readText(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readKeypairStatus(filePath, expectedAddress) {
  const relativePath = path.relative(repoRoot, filePath);
  if (!existsSync(filePath)) {
    return {
      exists: false,
      expectedAddress: expectedAddress ?? null,
      path: relativePath,
    };
  }

  try {
    const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(filePath, "utf8"))));
    return {
      address: keypair.publicKey.toBase58(),
      exists: true,
      expectedAddress: expectedAddress ?? null,
      matchesExpected: expectedAddress ? keypair.publicKey.toBase58() === expectedAddress : null,
      path: relativePath,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "unknown error",
      exists: true,
      expectedAddress: expectedAddress ?? null,
      path: relativePath,
    };
  }
}

function readRewardVaultKeypairStatuses() {
  return Object.fromEntries(
    REWARD_ROLES.filter((role) => role.tokenAccount === "keypair").map((role) => {
      const filePath = path.join(vaultKeypairDir, `${role.key}-reward-vault.json`);
      return [role.key, readKeypairStatus(filePath, null)];
    }),
  );
}

function buildProtocolTargets() {
  if (
    !isValidPublicKey(config.programId) ||
    !isValidPublicKey(config.rypMintAddress) ||
    !isValidPublicKey(config.treasuryAddress)
  ) {
    return null;
  }

  const programId = new PublicKey(config.programId);
  const rypMint = new PublicKey(config.rypMintAddress);
  const treasuryOwner = new PublicKey(config.treasuryAddress);
  const configAddress = derivePda(programId, ["config"]);
  const rewardConfigAddress = derivePda(programId, ["reward-config"]);
  const rypVaultAddress = deriveAssociatedTokenAddress({ mint: rypMint, owner: configAddress });
  const treasuryVaultAddress = deriveAssociatedTokenAddress({ mint: rypMint, owner: treasuryOwner });

  return {
    config: configAddress.toBase58(),
    rewardConfig: rewardConfigAddress.toBase58(),
    rypVault: rypVaultAddress.toBase58(),
    treasuryOwner: treasuryOwner.toBase58(),
    treasuryRewardVault: treasuryVaultAddress.toBase58(),
    rewardVaultRoles: REWARD_ROLES.map((role) => {
      const rewardVaultStateAddress = derivePda(programId, ["reward-vault", rewardConfigAddress, role.seed]);
      const keypairStatus = role.tokenAccount === "keypair" ? local.rewardVaultKeypairs[role.key] : null;
      const rewardVaultAddress = role.tokenAccount === "ata" ? treasuryVaultAddress.toBase58() : keypairStatus?.address ?? null;

      return {
        custodyModel: role.custodyModel,
        key: role.key,
        label: role.label,
        metadataHashHex: rewardVaultAddress ? rewardVaultMetadataHashHex({ role, rewardVaultAddress }) : null,
        rewardVaultAddress,
        rewardVaultKeypairPath: keypairStatus?.path ?? null,
        rewardVaultKeypairStatus: keypairStatus ? (keypairStatus.address ? "READY" : "MISSING") : "ATA",
        rewardVaultStateAddress: rewardVaultStateAddress.toBase58(),
        seed: role.seed,
        tokenAccountKind: role.tokenAccount,
      };
    }),
  };
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
    .update(rewardVaultAddress)
    .update(config.rypMintAddress)
    .update(String(role.custodyModel))
    .digest("hex");
}

function findAnchorProgramId(contents) {
  return contents.match(/cryptoseeds_protocol\s*=\s*"([^"]+)"/)?.[1] ?? null;
}

function findRustProgramId(contents) {
  return contents.match(/declare_id!\("([^"]+)"\)/)?.[1] ?? null;
}

function resolveProgramSoPath() {
  return [
    path.join(repoRoot, "target", "deploy", "cryptoseeds_protocol.so"),
    path.join(repoRoot, "programs", "cryptoseeds_protocol", "target", "deploy", "cryptoseeds_protocol.so"),
  ].find((candidate) => existsSync(candidate));
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
