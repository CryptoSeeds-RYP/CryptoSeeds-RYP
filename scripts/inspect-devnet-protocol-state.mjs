#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const BPF_UPGRADEABLE_LOADER_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
const EXPECTED_BASE_FEE_BPS = 350;
const EXPECTED_REWARD_SPLIT_BPS = {
  holder: 3_334,
  staker: 3_333,
  treasury: 3_333,
};
const EXPECTED_REWARD_VAULT_ROLE_MASK = 31;
const PROTOCOL_MODULE_PAUSE_MASK = 31;
const DEFAULT_PUBLIC_KEY = PublicKey.default.toBase58();
const REWARD_ROLES = [
  { key: "holder", label: "HolderReward", seed: "holder-reward", variant: 0, custodyModel: 0, tokenAccount: "keypair" },
  { key: "staker", label: "StakerReward", seed: "staker-reward", variant: 1, custodyModel: 0, tokenAccount: "keypair" },
  { key: "treasury", label: "IndependentTreasury", seed: "independent-treasury", variant: 2, custodyModel: 1, tokenAccount: "ata" },
  { key: "delivery", label: "DeliveryCostReserve", seed: "delivery-cost-reserve", variant: 3, custodyModel: 0, tokenAccount: "keypair" },
  { key: "rollover", label: "Rollover", seed: "rollover", variant: 4, custodyModel: 0, tokenAccount: "keypair" },
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const layouts = JSON.parse(readFileSync(path.join(repoRoot, "src", "solana", "protocolAccountLayouts.json"), "utf8"));
const runningAsMain = isMain(import.meta.url);
const options = runningAsMain
  ? parseArgs(process.argv.slice(2))
  : { envPath: undefined, strict: false, vaultKeypairDir: undefined };

if (runningAsMain) {
  const envPath = path.resolve(repoRoot, options.envPath ?? ".env.devnet.example");
  const env = { ...parseEnvFile(envPath), ...process.env };
  const config = readDevnetConfig(env);
  const rewardVaultKeypairs = readRewardVaultKeypairs(
    path.resolve(repoRoot, options.vaultKeypairDir ?? "target/devnet/reward-vaults"),
  );
  const targets = buildProtocolTargets({ config, rewardVaultKeypairs });
  const accounts = targets
    ? await readDevnetAccounts({
        config,
        targets,
      })
    : null;
  const report = buildDevnetProtocolInspectionReport({
    accounts,
    config,
    envSource: path.relative(repoRoot, envPath),
    targets,
  });

  console.log(JSON.stringify(report, null, 2));

  if (options.strict && report.status !== "READY_FOR_READ_ONLY_PROTOCOL_REVIEW") {
    process.exit(1);
  }
}

export function buildProtocolTargets({ config, rewardVaultKeypairs = {} }) {
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
      const rewardVaultAddress =
        role.tokenAccount === "ata"
          ? treasuryVaultAddress.toBase58()
          : rewardVaultKeypairs[role.key]?.address ?? null;

      return {
        custodyModel: role.custodyModel,
        key: role.key,
        label: role.label,
        metadataHashHex: rewardVaultAddress
          ? rewardVaultMetadataHashHex({ config, rewardVaultAddress, role })
          : null,
        rewardVaultAddress,
        rewardVaultKeypairStatus: role.tokenAccount === "ata"
          ? "ATA"
          : rewardVaultAddress
            ? "READY"
            : "MISSING",
        rewardVaultStateAddress: rewardVaultStateAddress.toBase58(),
        seed: role.seed,
        tokenAccountKind: role.tokenAccount,
        variant: role.variant,
      };
    }),
  };
}

export function buildDevnetProtocolInspectionReport({
  accounts,
  config,
  envSource,
  generatedAt = new Date().toISOString(),
  targets,
}) {
  const blockers = [];
  const warnings = [];
  validateStaticConfig(config, blockers, warnings);

  if (!targets) {
    blockers.push("Protocol targets could not be derived from the configured program, mint, and treasury addresses.");
  }
  if (!accounts) {
    blockers.push("Devnet accounts were not loaded.");
  }

  const program = inspectProgramAccount(accounts?.program, blockers);
  const protocolConfig = targets
    ? inspectProtocolConfigAccount({
        account: accounts?.protocolConfig,
        config,
        programId: config.programId,
        targets,
      })
    : null;
  const rewardConfig = targets
    ? inspectRewardConfigAccount({
        account: accounts?.rewardConfig,
        config,
        programId: config.programId,
        targets,
      })
    : null;
  const rewardVaults = targets
    ? targets.rewardVaultRoles.map((role) =>
        inspectRewardVaultStateAccount({
          account: accounts?.rewardVaultStates?.[role.key],
          config,
          programId: config.programId,
          role,
          targets,
        }),
      )
    : [];

  for (const inspection of [protocolConfig, rewardConfig, ...rewardVaults].filter(Boolean)) {
    blockers.push(...inspection.blockers);
    warnings.push(...inspection.warnings);
  }

  return {
    exportVersion: "devnet-protocol-state-inspection/v1",
    status: blockers.length === 0 ? "READY_FOR_READ_ONLY_PROTOCOL_REVIEW" : "BLOCKED",
    generatedAt,
    envSource,
    executionMode: "READ_ONLY",
    config: {
      adminAuthorityAddress: config.adminAuthorityAddress ?? null,
      cluster: config.cluster,
      deployment: config.deployment,
      demoMode: config.demoMode,
      independentTreasuryAddress: config.independentTreasuryAddress ?? null,
      programId: config.programId ?? null,
      rpcUrl: config.rpcUrl,
      rypMintAddress: config.rypMintAddress ?? null,
      treasuryAddress: config.treasuryAddress ?? null,
    },
    targets,
    program,
    protocolConfig,
    rewardConfig,
    rewardVaults,
    blockers: uniqueMessages(blockers),
    warnings: uniqueMessages(warnings),
    nextActions: blockers.length > 0
      ? [
          "Fund the devnet authority if needed.",
          "Create the configured devnet RYP test mint.",
          "Deploy the configured program to devnet.",
          `Run npm run devnet:init:protocol -- --env ${envSource} --execute after plan review.`,
          `Re-run npm run devnet:inspect:protocol -- --env ${envSource}.`,
        ]
      : [
          `Run npm run testnet:readiness -- --profile read-only --env ${envSource}.`,
          "Keep wallet execution blocked until the wallet-execution profile passes review.",
        ],
  };
}

async function readDevnetAccounts({ config, targets }) {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const programAccount = await connection.getAccountInfo(new PublicKey(config.programId), "confirmed");
  const stateAddresses = [
    targets.config,
    targets.rewardConfig,
    ...targets.rewardVaultRoles.map((role) => role.rewardVaultStateAddress),
  ];
  const stateAccounts = await connection.getMultipleAccountsInfo(
    stateAddresses.map((address) => new PublicKey(address)),
    "confirmed",
  );

  return {
    program: normalizeProgramAccount(programAccount),
    protocolConfig: normalizeStateAccount(stateAccounts[0]),
    rewardConfig: normalizeStateAccount(stateAccounts[1]),
    rewardVaultStates: Object.fromEntries(
      targets.rewardVaultRoles.map((role, index) => [
        role.key,
        normalizeStateAccount(stateAccounts[index + 2]),
      ]),
    ),
  };
}

function inspectProgramAccount(account, blockers) {
  if (!account?.exists) {
    blockers.push("Devnet program account is missing.");
    return { status: "MISSING" };
  }

  if (!account.executable) blockers.push("Devnet program account is not executable.");
  if (account.owner !== BPF_UPGRADEABLE_LOADER_ID) {
    blockers.push("Devnet program account is not owned by the upgradeable BPF loader.");
  }

  return {
    dataLength: account.dataLength,
    executable: account.executable,
    lamports: account.lamports,
    owner: account.owner,
    status: account.executable && account.owner === BPF_UPGRADEABLE_LOADER_ID ? "DEPLOYED" : "BLOCKED",
  };
}

function inspectProtocolConfigAccount({ account, config, programId, targets }) {
  const inspection = inspectAnchorAccount({
    account,
    decoder: decodeProtocolConfigAccount,
    label: "ProtocolConfig",
    layoutName: "ProtocolConfig",
    programId,
    targetAddress: targets.config,
  });

  if (inspection.status === "DECODED") {
    const decoded = inspection.decoded;
    if (decoded.authority !== config.adminAuthorityAddress) {
      inspection.blockers.push("Protocol authority does not match VITE_ADMIN_AUTHORITY_ADDRESS.");
    }
    if (decoded.projectAuthority !== config.adminAuthorityAddress) {
      inspection.blockers.push("Project authority does not match VITE_ADMIN_AUTHORITY_ADDRESS.");
    }
    if (decoded.rypMint !== config.rypMintAddress) {
      inspection.blockers.push("Protocol config RYP mint does not match VITE_RYP_MINT_ADDRESS.");
    }
    if (decoded.rypVault !== targets.rypVault) {
      inspection.blockers.push("Protocol config RYP vault does not match the expected config-owned ATA.");
    }
    if (decoded.baseFeeBps > 1_000) {
      inspection.blockers.push("Protocol base fee exceeds the 1000 bps safety ceiling.");
    }
    if (decoded.baseFeeBps !== EXPECTED_BASE_FEE_BPS) {
      inspection.warnings.push(`Protocol base fee is ${decoded.baseFeeBps} bps; expected ${EXPECTED_BASE_FEE_BPS} bps.`);
    }
    if (!bigintStringsAreStrictlyIncreasing(decoded.tierThresholds)) {
      inspection.blockers.push("Protocol tier thresholds are not strictly increasing.");
    }
    if (!feeReductionsAreSafe(decoded.baseFeeBps, decoded.tierFeeReductionBps)) {
      inspection.blockers.push("Protocol tier fee reductions are unsafe.");
    }
    if (decoded.unknownModulePauseFlags !== 0) {
      inspection.blockers.push(`Protocol module pause flags include unknown bits: ${decoded.unknownModulePauseFlags}.`);
    }
    if (decoded.paused) inspection.warnings.push("Protocol config is globally paused.");
    if (decoded.modulePauseFlags !== 0) {
      inspection.warnings.push(`Protocol scoped module pause flags are active: ${decoded.modulePauseFlags}.`);
    }
    if (decoded.pendingAuthority !== DEFAULT_PUBLIC_KEY) {
      inspection.warnings.push("Protocol authority transfer is pending.");
    }
    if (decoded.pendingProjectAuthority !== DEFAULT_PUBLIC_KEY) {
      inspection.warnings.push("Project authority transfer is pending.");
    }
  }

  return inspection;
}

function inspectRewardConfigAccount({ account, config, programId, targets }) {
  const inspection = inspectAnchorAccount({
    account,
    decoder: decodeRewardConfigAccount,
    label: "RewardConfig",
    layoutName: "RewardConfig",
    programId,
    targetAddress: targets.rewardConfig,
  });

  if (inspection.status === "DECODED") {
    const decoded = inspection.decoded;
    const splitTotal = decoded.holderSplitBps + decoded.stakerSplitBps + decoded.treasurySplitBps;
    if (decoded.authority !== config.adminAuthorityAddress) {
      inspection.blockers.push("Reward authority does not match VITE_ADMIN_AUTHORITY_ADDRESS.");
    }
    if (decoded.protocolConfig !== targets.config) {
      inspection.blockers.push("Reward config points to a different protocol config.");
    }
    if (decoded.rypMint !== config.rypMintAddress) {
      inspection.blockers.push("Reward config RYP mint does not match VITE_RYP_MINT_ADDRESS.");
    }
    if (splitTotal !== 10_000) {
      inspection.blockers.push("Reward holder/staker/treasury splits do not total 10000 bps.");
    }
    if (
      decoded.holderSplitBps !== EXPECTED_REWARD_SPLIT_BPS.holder ||
      decoded.stakerSplitBps !== EXPECTED_REWARD_SPLIT_BPS.staker ||
      decoded.treasurySplitBps !== EXPECTED_REWARD_SPLIT_BPS.treasury
    ) {
      inspection.warnings.push("Reward split differs from the current devnet initialization policy.");
    }
    if ((decoded.registeredVaultRolesMask & EXPECTED_REWARD_VAULT_ROLE_MASK) !== EXPECTED_REWARD_VAULT_ROLE_MASK) {
      inspection.blockers.push("Reward config does not have all required vault roles registered.");
    }
    if ((decoded.verifiedVaultRolesMask & EXPECTED_REWARD_VAULT_ROLE_MASK) !== EXPECTED_REWARD_VAULT_ROLE_MASK) {
      inspection.blockers.push("Reward config does not have all required vault roles verified.");
    }
    if (!decoded.draftOnly) {
      inspection.blockers.push("Reward config must remain draft-only until payout execution is reviewed.");
    }
    if (decoded.paused) inspection.warnings.push("Reward config is paused.");
    if (decoded.pendingAuthority !== DEFAULT_PUBLIC_KEY) {
      inspection.warnings.push("Reward authority transfer is pending.");
    }
  }

  return inspection;
}

function inspectRewardVaultStateAccount({ account, config, programId, role, targets }) {
  const inspection = inspectAnchorAccount({
    account,
    decoder: decodeRewardVaultStateAccount,
    label: `${role.label} RewardVaultState`,
    layoutName: "RewardVaultState",
    programId,
    targetAddress: role.rewardVaultStateAddress,
  });

  if (!role.rewardVaultAddress) {
    inspection.blockers.push(`${role.label} reward vault keypair address is missing from local devnet targets.`);
  }

  if (inspection.status === "DECODED") {
    const decoded = inspection.decoded;
    if (decoded.rewardConfig !== targets.rewardConfig) {
      inspection.blockers.push(`${role.label} vault points to a different reward config.`);
    }
    if (decoded.role !== role.variant) {
      inspection.blockers.push(`${role.label} vault role variant does not match the expected role.`);
    }
    if (decoded.rewardMint !== config.rypMintAddress) {
      inspection.blockers.push(`${role.label} vault reward mint does not match VITE_RYP_MINT_ADDRESS.`);
    }
    if (role.rewardVaultAddress && decoded.vaultAddress !== role.rewardVaultAddress) {
      inspection.blockers.push(`${role.label} vault token account does not match the derived target.`);
    }
    if (decoded.custodyModel !== role.custodyModel) {
      inspection.blockers.push(`${role.label} custody model does not match the devnet policy.`);
    }
    if (decoded.verificationStatus !== 2) {
      inspection.blockers.push(`${role.label} vault is not verified.`);
    }
    if (role.metadataHashHex && decoded.metadataHash !== role.metadataHashHex) {
      inspection.blockers.push(`${role.label} vault metadata hash does not match the planned metadata hash.`);
    }
    if (decoded.receivesUserFunds) {
      inspection.blockers.push(`${role.label} vault must not be marked as receiving user funds.`);
    }
  }

  return inspection;
}

function inspectAnchorAccount({ account, decoder, label, layoutName, programId, targetAddress }) {
  const blockers = [];
  const warnings = [];

  if (!account?.exists) {
    return {
      address: targetAddress,
      blockers: [`${label} account is missing.`],
      decoded: null,
      label,
      message: "Account not found on the selected devnet RPC.",
      status: "MISSING",
      warnings,
    };
  }

  if (account.owner !== programId) {
    blockers.push(`${label} account owner does not match the configured program id.`);
  }

  try {
    assertAnchorLayout(account.data, layoutName);
    const decoded = decoder(account.data);
    return {
      address: targetAddress,
      blockers,
      decoded,
      label,
      message: "Account decoded from devnet.",
      owner: account.owner,
      status: blockers.length > 0 ? "BLOCKED" : "DECODED",
      warnings,
    };
  } catch (error) {
    return {
      address: targetAddress,
      blockers: [...blockers, error instanceof Error ? error.message : `${label} decode failed.`],
      decoded: null,
      label,
      message: "Account decode failed.",
      owner: account.owner,
      status: "DECODE_ERROR",
      warnings,
    };
  }
}

function validateStaticConfig(config, blockers, warnings) {
  if (config.cluster !== "devnet") blockers.push("VITE_SOLANA_CLUSTER must be devnet for protocol inspection.");
  if (config.deployment !== "devnet") {
    blockers.push("VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT must be devnet for protocol inspection.");
  }
  if (config.demoMode) blockers.push("VITE_DEMO_MODE must be false for protocol inspection.");
  if (config.broadcastEnabled) {
    warnings.push("VITE_SOLANA_BROADCAST_ENABLED is true; read-only protocol inspection does not require broadcast.");
  }
  if (!isValidPublicKey(config.programId)) blockers.push("VITE_CRYPTOSEEDS_PROGRAM_ID is not a valid public key.");
  if (!isValidPublicKey(config.rypMintAddress)) blockers.push("VITE_RYP_MINT_ADDRESS is not a valid public key.");
  if (!isValidPublicKey(config.adminAuthorityAddress)) blockers.push("VITE_ADMIN_AUTHORITY_ADDRESS is not a valid public key.");
  if (!config.independentTreasuryAddress) {
    blockers.push("VITE_INDEPENDENT_TREASURY_ADDRESS must be set for protocol inspection.");
  }
  if (!isValidPublicKey(config.treasuryAddress)) blockers.push("Treasury address is not a valid public key.");
  if (config.treasuryAddress === config.adminAuthorityAddress) {
    blockers.push("Independent treasury address must be distinct from the admin authority wallet.");
  }
}

function readDevnetConfig(env) {
  return {
    adminAuthorityAddress: env.VITE_ADMIN_AUTHORITY_ADDRESS,
    broadcastEnabled: env.VITE_SOLANA_BROADCAST_ENABLED === "true",
    cluster: env.VITE_SOLANA_CLUSTER ?? "localnet",
    demoMode: env.VITE_DEMO_MODE !== "false",
    deployment: env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT ?? "placeholder",
    programId: env.VITE_CRYPTOSEEDS_PROGRAM_ID,
    rpcUrl: env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    rypMintAddress: env.VITE_RYP_MINT_ADDRESS,
    independentTreasuryAddress: env.VITE_INDEPENDENT_TREASURY_ADDRESS,
    treasuryAddress: env.VITE_INDEPENDENT_TREASURY_ADDRESS,
  };
}

function readRewardVaultKeypairs(vaultKeypairDir) {
  return Object.fromEntries(
    REWARD_ROLES.filter((role) => role.tokenAccount === "keypair").map((role) => {
      const filePath = path.join(vaultKeypairDir, `${role.key}-reward-vault.json`);
      if (!existsSync(filePath)) {
        return [role.key, { address: null, exists: false, path: filePath }];
      }
      const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(filePath, "utf8"))));
      return [role.key, { address: keypair.publicKey.toBase58(), exists: true, path: filePath }];
    }),
  );
}

function parseArgs(args) {
  const parsed = {
    envPath: undefined,
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

function requireValue(args, index, name) {
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`${name} requires a value.`);
  }
  return args[index + 1];
}

function normalizeProgramAccount(account) {
  if (!account) return { exists: false };
  return {
    dataLength: account.data.length,
    executable: account.executable,
    exists: true,
    lamports: account.lamports,
    owner: account.owner.toBase58(),
  };
}

function normalizeStateAccount(account) {
  if (!account) return { exists: false };
  return {
    data: account.data,
    exists: true,
    lamports: account.lamports,
    owner: account.owner.toBase58(),
  };
}

function decodeProtocolConfigAccount(data) {
  const offset = fieldOffsets("ProtocolConfig");
  const modulePauseFlags = readU16(data, offset.module_pause_flags);
  return {
    authority: readPubkey(data, offset.authority),
    baseFeeBps: readU16(data, offset.base_fee_bps),
    modulePauseFlags,
    pendingAuthority: readPubkey(data, offset.pending_authority),
    pendingProjectAuthority: readPubkey(data, offset.pending_project_authority),
    paused: readBool(data, offset.paused),
    projectAuthority: readPubkey(data, offset.project_authority),
    rypMint: readPubkey(data, offset.ryp_mint),
    rypVault: readPubkey(data, offset.ryp_vault),
    tierFeeReductionBps: readU16Array(data, offset.tier_fee_reduction_bps, 5),
    tierThresholds: readU64Array(data, offset.tier_thresholds, 5),
    totalStaked: readU64(data, offset.total_staked).toString(),
    unknownModulePauseFlags: modulePauseFlags & ~PROTOCOL_MODULE_PAUSE_MASK,
  };
}

function decodeRewardConfigAccount(data) {
  const offset = fieldOffsets("RewardConfig");
  return {
    authority: readPubkey(data, offset.authority),
    draftOnly: readBool(data, offset.draft_only),
    holderSplitBps: readU16(data, offset.holder_split_bps),
    paused: readBool(data, offset.paused),
    pendingAuthority: readPubkey(data, offset.pending_authority),
    protocolConfig: readPubkey(data, offset.protocol_config),
    registeredVaultRolesMask: data[offset.registered_vault_roles_mask],
    rypMint: readPubkey(data, offset.ryp_mint),
    stakerSplitBps: readU16(data, offset.staker_split_bps),
    treasurySplitBps: readU16(data, offset.treasury_split_bps),
    verifiedVaultRolesMask: data[offset.verified_vault_roles_mask],
  };
}

function decodeRewardVaultStateAccount(data) {
  const offset = fieldOffsets("RewardVaultState");
  return {
    custodyModel: data[offset.custody_model],
    metadataHash: bytesToHex(data.subarray(offset.metadata_hash, offset.metadata_hash + 32)),
    receivesUserFunds: readBool(data, offset.receives_user_funds),
    rewardConfig: readPubkey(data, offset.reward_config),
    rewardMint: readPubkey(data, offset.reward_mint),
    role: data[offset.role],
    totalFundedAmount: readU64(data, offset.total_funded_amount).toString(),
    vaultAddress: readPubkey(data, offset.vault_address),
    verificationStatus: data[offset.verification_status],
  };
}

function assertAnchorLayout(data, layoutName) {
  const layout = layouts[layoutName];
  if (!layout) throw new Error(`Unknown account layout: ${layoutName}.`);
  if (!data || data.length < layout.minimumLength) {
    throw new Error(`${layoutName} account is too small: expected at least ${layout.minimumLength} bytes.`);
  }
  const actualDiscriminator = bytesToHex(data.subarray(0, 8));
  if (actualDiscriminator !== layout.discriminatorHex) {
    throw new Error(`${layoutName} discriminator mismatch: expected ${layout.discriminatorHex}.`);
  }
}

function fieldOffsets(layoutName) {
  return Object.fromEntries(layouts[layoutName].fields.map((field) => [field.name, field.offset]));
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

function rewardVaultMetadataHashHex({ config, role, rewardVaultAddress }) {
  return createHash("sha256")
    .update("cryptoseeds-devnet-reward-vault-v1")
    .update(role.seed)
    .update(rewardVaultAddress)
    .update(config.rypMintAddress)
    .update(String(role.custodyModel))
    .digest("hex");
}

function bigintStringsAreStrictlyIncreasing(values) {
  try {
    return values.every((value, index) => index === 0 || BigInt(value) > BigInt(values[index - 1]));
  } catch {
    return false;
  }
}

function feeReductionsAreSafe(baseFeeBps, reductions) {
  return reductions.every(
    (reduction, index) =>
      Number.isInteger(reduction) &&
      reduction >= 0 &&
      reduction <= baseFeeBps &&
      (index === 0 || reduction >= reductions[index - 1]),
  );
}

function isValidPublicKey(value) {
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}

function readPubkey(data, offset) {
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58();
}

function readU16(data, offset) {
  return dataView(data).getUint16(offset, true);
}

function readU64(data, offset) {
  return dataView(data).getBigUint64(offset, true);
}

function readU64Array(data, offset, length) {
  return Array.from({ length }, (_, index) => readU64(data, offset + index * 8).toString());
}

function readU16Array(data, offset, length) {
  return Array.from({ length }, (_, index) => readU16(data, offset + index * 2));
}

function readBool(data, offset) {
  return data[offset] === 1;
}

function dataView(data) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function uniqueMessages(messages) {
  return [...new Set(messages)];
}

function isMain(moduleUrl) {
  return fileURLToPath(moduleUrl) === process.argv[1];
}
