import { Connection, PublicKey } from "@solana/web3.js";
import { appConfig, PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";
import protocolAccountLayoutsJson from "./protocolAccountLayouts.json";

export const REWARD_CONFIG_SEED = "reward-config";
export const REWARD_VAULT_STATE_SEED = "reward-vault";
export const REWARD_EPOCH_SEED = "reward-epoch";
export const SEEDBOT_PERMISSION_SEED = "seedbot-permission";
export const MAX_SEEDBOT_DAILY_TRADES = 50;
export const MAX_SEEDBOT_SLIPPAGE_BPS = 500;

type RewardAccountLayoutName = "RewardConfig" | "RewardVaultState" | "RewardEpoch" | "SeedBotPermission";

type RewardAccountFieldLayout = {
  name: string;
  type: string;
  offset: number;
  size: number;
};

type RewardAccountLayout = {
  discriminatorHex: string;
  minimumLength: number;
  fields: RewardAccountFieldLayout[];
};

export const REWARD_ACCOUNT_LAYOUTS = protocolAccountLayoutsJson as Record<
  RewardAccountLayoutName,
  RewardAccountLayout
>;

const REWARD_ACCOUNT_FIELD_OFFSETS = Object.fromEntries(
  Object.entries(REWARD_ACCOUNT_LAYOUTS).map(([accountName, layout]) => [
    accountName,
    Object.fromEntries(layout.fields.map((field) => [field.name, field.offset])),
  ]),
) as Record<RewardAccountLayoutName, Record<string, number>>;

const REQUIRED_REWARD_VAULT_ROLES: Array<Exclude<RewardVaultRole, "UNKNOWN">> = [
  "HOLDER_REWARD",
  "STAKER_REWARD",
  "INDEPENDENT_TREASURY",
  "DELIVERY_COST_RESERVE",
  "ROLLOVER",
];

export type RewardVaultRole =
  | "HOLDER_REWARD"
  | "STAKER_REWARD"
  | "INDEPENDENT_TREASURY"
  | "DELIVERY_COST_RESERVE"
  | "ROLLOVER"
  | "UNKNOWN";

export type RewardVaultCustodyModel =
  | "PROGRAM_CONTROLLED"
  | "TREASURY_CONTROLLED"
  | "DISCLOSURE_PENDING"
  | "UNKNOWN";

export type RewardVaultVerificationStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "DISABLED"
  | "UNKNOWN";

export type RewardEpochStatus = "DRAFTED" | "REVIEWED" | "CANCELLED" | "UNKNOWN";
export type RewardAccountReadStatus = "PREVIEW_ONLY" | "MISSING" | "DECODED" | "DECODE_ERROR";
export type StakeTierName = "NONE" | "SEED" | "SPROUT" | "SAPLING" | "TREE" | "FRUIT" | "UNKNOWN";
export type SeedBotPermissionLifecycleStatus =
  | "PREVIEW_ONLY"
  | "MISSING"
  | "ACTIVE"
  | "REVOKED"
  | "EXPIRED"
  | "DECODE_ERROR";

export type RewardVaultRoleSpec = {
  role: Exclude<RewardVaultRole, "UNKNOWN">;
  label: string;
  seed: string;
  variant: number;
};

export type RewardConfigAccount = {
  authority: string;
  protocolConfig: string;
  rypMint: string;
  epochCadenceSeconds: string;
  holderSplitBps: number;
  stakerSplitBps: number;
  treasurySplitBps: number;
  registeredVaultRolesMask: number;
  verifiedVaultRolesMask: number;
  totalEpochDrafts: string;
  totalRoutedFeeAmount: string;
  paused: boolean;
  draftOnly: boolean;
  bump: number;
  pendingAuthority: string;
};

export type RewardVaultStateAccount = {
  rewardConfig: string;
  role: RewardVaultRole;
  rewardMint: string;
  vaultAddress: string;
  custodyModel: RewardVaultCustodyModel;
  verificationStatus: RewardVaultVerificationStatus;
  metadataHash: string;
  totalFundedAmount: string;
  receivesUserFunds: boolean;
  bump: number;
};

export type RewardEpochAccount = {
  rewardConfig: string;
  epochId: string;
  snapshotTakenAt: string;
  createdAt: string;
  rewardMint: string;
  rewardPoolAmount: string;
  distributedNetAmount: string;
  reservedDeliveryCostAmount: string;
  rolledForwardAmount: string;
  recordedGrossAllocationAmount: string;
  recordedNetClaimAmount: string;
  claimedNetAmount: string;
  exclusionListHash: string;
  claimMerkleRoot: string;
  status: RewardEpochStatus;
  executionBlocked: boolean;
  bump: number;
};

export type SeedBotPermissionAccount = {
  owner: string;
  position: string;
  permissionHash: string;
  createdAt: string;
  expiresAt: string;
  maxTradeAmount: string;
  maxDailyVolumeAmount: string;
  maxDailyTrades: number;
  maxSlippageBps: number;
  tierAtCreation: StakeTierName;
  stakedAmountAtCreation: string;
  stakingStartTsAtCreation: string;
  revoked: boolean;
  bump: number;
  usageDayStartTs: string;
  dailyVolumeUsedAmount: string;
  dailyTradesUsed: number;
  totalVolumeUsedAmount: string;
  totalTradesUsed: string;
  lastExecutionTs: string;
};

export type SeedBotPermissionInspection = {
  programId: string;
  ownerAddress: string;
  permissionAddress: string;
  status: RewardAccountReadStatus;
  lifecycleStatus: SeedBotPermissionLifecycleStatus;
  decoded?: SeedBotPermissionAccount;
  message?: string;
  executionMode: "READ_ONLY";
  blockers: string[];
  warnings: string[];
};

export type RewardVaultInspection = {
  role: RewardVaultRole;
  label: string;
  address: string;
  status: RewardAccountReadStatus;
  decoded?: RewardVaultStateAccount;
  message?: string;
};

export type RewardAccountInspection = {
  programId: string;
  rewardConfigAddress: string;
  rewardConfigStatus: RewardAccountReadStatus;
  rewardConfig?: RewardConfigAccount;
  rewardConfigMessage?: string;
  epochId: string;
  epochPreviewAddress: string;
  epochStatus: RewardAccountReadStatus;
  epoch?: RewardEpochAccount;
  epochMessage?: string;
  vaults: RewardVaultInspection[];
  executionMode: "READ_ONLY";
  blockers: string[];
  warnings: string[];
};

export const rewardVaultRoleSpecs: RewardVaultRoleSpec[] = [
  { role: "HOLDER_REWARD", label: "Holder Reward", seed: "holder-reward", variant: 0 },
  { role: "STAKER_REWARD", label: "Staker Reward", seed: "staker-reward", variant: 1 },
  { role: "INDEPENDENT_TREASURY", label: "Independent Treasury", seed: "independent-treasury", variant: 2 },
  { role: "DELIVERY_COST_RESERVE", label: "Delivery Cost Reserve", seed: "delivery-cost-reserve", variant: 3 },
  { role: "ROLLOVER", label: "Rollover", seed: "rollover", variant: 4 },
];

export function deriveRewardAccountAddresses({
  epochId = 0n,
  programIdAddress = appConfig.protocolProgramId,
}: {
  epochId?: bigint;
  programIdAddress?: string;
} = {}) {
  const programId = new PublicKey(programIdAddress);
  const [rewardConfig] = PublicKey.findProgramAddressSync([textSeed(REWARD_CONFIG_SEED)], programId);
  const vaults = rewardVaultRoleSpecs.map((role) => {
    const [address] = PublicKey.findProgramAddressSync(
      [textSeed(REWARD_VAULT_STATE_SEED), rewardConfig.toBuffer(), textSeed(role.seed)],
      programId,
    );

    return {
      ...role,
      address: address.toBase58(),
    };
  });
  const [epochPreview] = PublicKey.findProgramAddressSync(
    [textSeed(REWARD_EPOCH_SEED), rewardConfig.toBuffer(), u64LeBytes(epochId)],
    programId,
  );

  return {
    epochId: epochId.toString(),
    epochPreviewAddress: epochPreview.toBase58(),
    programId: programId.toBase58(),
    rewardConfigAddress: rewardConfig.toBase58(),
    vaults,
  };
}

export function deriveSeedBotPermissionInspectionAddress({
  ownerAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  ownerAddress: string;
  programIdAddress?: string;
}) {
  const owner = new PublicKey(ownerAddress);
  const programId = new PublicKey(programIdAddress);
  const [permission] = PublicKey.findProgramAddressSync(
    [textSeed(SEEDBOT_PERMISSION_SEED), owner.toBuffer()],
    programId,
  );

  return {
    ownerAddress: owner.toBase58(),
    permissionAddress: permission.toBase58(),
    programId: programId.toBase58(),
  };
}

export function buildRewardAccountInspectionPreview({
  epochId = 0n,
  programIdAddress = appConfig.protocolProgramId,
}: {
  epochId?: bigint;
  programIdAddress?: string;
} = {}): RewardAccountInspection {
  const addresses = deriveRewardAccountAddresses({ epochId, programIdAddress });
  const placeholderProgram = addresses.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID;

  return {
    programId: addresses.programId,
    rewardConfigAddress: addresses.rewardConfigAddress,
    rewardConfigStatus: "PREVIEW_ONLY",
    rewardConfigMessage: "Reward config account read has not been requested.",
    epochId: addresses.epochId,
    epochPreviewAddress: addresses.epochPreviewAddress,
    epochStatus: "PREVIEW_ONLY",
    epochMessage: "Epoch PDA preview only; no reward transaction builder is exposed.",
    vaults: addresses.vaults.map((vault) => ({
      address: vault.address,
      label: vault.label,
      role: vault.role,
      status: "PREVIEW_ONLY",
      message: "Derived PDA preview only.",
    })),
    executionMode: "READ_ONLY",
    blockers: [],
    warnings: [
      "Reward account inspection is read-only.",
      "No reward setup, claim, payout, or vault movement action is exposed in the Admin Dashboard.",
      ...(placeholderProgram ? ["Protocol program id is still the local development placeholder."] : []),
    ],
  };
}

export function buildSeedBotPermissionInspectionPreview({
  ownerAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  ownerAddress: string;
  programIdAddress?: string;
}): SeedBotPermissionInspection {
  const addresses = deriveSeedBotPermissionInspectionAddress({ ownerAddress, programIdAddress });
  const placeholderProgram = addresses.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID;

  return {
    ...addresses,
    status: "PREVIEW_ONLY",
    lifecycleStatus: "PREVIEW_ONLY",
    message: "SeedBot permission account read has not been requested.",
    executionMode: "READ_ONLY",
    blockers: [],
    warnings: [
      "SeedBot permission inspection is read-only.",
      "No SeedBot trade signing, custody, or broadcast action is exposed by this inspection.",
      ...(placeholderProgram ? ["Protocol program id is still the local development placeholder."] : []),
    ],
  };
}

export async function readRewardAccountInspection({
  connection,
  epochId = 0n,
  programIdAddress = appConfig.protocolProgramId,
}: {
  connection: Connection;
  epochId?: bigint;
  programIdAddress?: string;
}): Promise<RewardAccountInspection> {
  const preview = buildRewardAccountInspectionPreview({ epochId, programIdAddress });
  const publicKeys = [
    new PublicKey(preview.rewardConfigAddress),
    ...preview.vaults.map((vault) => new PublicKey(vault.address)),
    new PublicKey(preview.epochPreviewAddress),
  ];
  const accounts = await connection.getMultipleAccountsInfo(publicKeys, "confirmed");
  const rewardConfig = decodeAccount(accounts[0]?.data, decodeRewardConfigAccount);
  const vaults = preview.vaults.map((vault, index) => ({
    ...vault,
    ...decodeAccount(accounts[index + 1]?.data, decodeRewardVaultStateAccount),
  }));
  const epoch = decodeAccount(accounts[accounts.length - 1]?.data, decodeRewardEpochAccount);

  return validateRewardAccountInspection({
    ...preview,
    rewardConfig: rewardConfig.decoded,
    rewardConfigMessage: rewardConfig.message,
    rewardConfigStatus: rewardConfig.status,
    epoch: epoch.decoded,
    epochMessage: epoch.message,
    epochStatus: epoch.status,
    vaults,
  });
}

export async function readSeedBotPermissionInspection({
  connection,
  nowUnix,
  ownerAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  connection: Connection;
  nowUnix?: bigint | number | string;
  ownerAddress: string;
  programIdAddress?: string;
}): Promise<SeedBotPermissionInspection> {
  const preview = buildSeedBotPermissionInspectionPreview({ ownerAddress, programIdAddress });
  const account = await connection.getAccountInfo(new PublicKey(preview.permissionAddress), "confirmed");
  const decoded = decodeAccount(account?.data, decodeSeedBotPermissionAccount);

  return validateSeedBotPermissionInspection({
    ...preview,
    decoded: decoded.decoded,
    lifecycleStatus: seedBotLifecycleStatus(decoded.status, decoded.decoded, nowUnix),
    message: decoded.message,
    status: decoded.status,
  });
}

export function validateRewardAccountInspection(inspection: RewardAccountInspection): RewardAccountInspection {
  const blockers = [...inspection.blockers];
  const warnings = [...inspection.warnings];

  if (inspection.executionMode !== "READ_ONLY") {
    blockers.push("Reward account inspection must remain read-only.");
  }

  if (inspection.rewardConfigStatus === "DECODED" && inspection.rewardConfig) {
    const splitTotal =
      inspection.rewardConfig.holderSplitBps +
      inspection.rewardConfig.stakerSplitBps +
      inspection.rewardConfig.treasurySplitBps;
    if (splitTotal !== 10_000) {
      blockers.push("Reward config holder/staker/treasury splits must total 10000 bps.");
    }
    if (!inspection.rewardConfig.draftOnly) {
      blockers.push("Reward config must remain draft-only until payout instructions pass review.");
    }
    if (inspection.rewardConfig.paused) {
      warnings.push("Reward config is paused on the selected cluster.");
    }
  } else if (inspection.rewardConfigStatus !== "PREVIEW_ONLY") {
    blockers.push("Reward config account must decode before admin reward inspection is considered ready.");
  }

  const decodedRoles = new Set<RewardVaultRole>();
  for (const vault of inspection.vaults) {
    if (vault.status !== "DECODED" || !vault.decoded) {
      if (vault.status !== "PREVIEW_ONLY") {
        blockers.push(`${vault.label} vault state must decode before reward inspection is considered ready.`);
      }
      continue;
    }

    decodedRoles.add(vault.decoded.role);
    if (vault.decoded.rewardConfig !== inspection.rewardConfigAddress) {
      blockers.push(`${vault.label} vault points to a different reward config.`);
    }
    if (vault.decoded.verificationStatus !== "VERIFIED") {
      blockers.push(`${vault.label} vault is not verified.`);
    }
    if (vault.decoded.receivesUserFunds) {
      blockers.push(`${vault.label} vault must not be marked as receiving user funds.`);
    }
    if (vault.decoded.custodyModel === "UNKNOWN" || vault.decoded.custodyModel === "DISCLOSURE_PENDING") {
      blockers.push(`${vault.label} vault custody model is not deployment-ready.`);
    }
  }

  for (const role of REQUIRED_REWARD_VAULT_ROLES) {
    if (!decodedRoles.has(role) && inspection.vaults.some((vault) => vault.status === "DECODED")) {
      blockers.push(`${role} vault role is missing from decoded reward vault state.`);
    }
  }

  if (inspection.epochStatus === "DECODED" && inspection.epoch) {
    if (inspection.epoch.rewardConfig !== inspection.rewardConfigAddress) {
      blockers.push("Reward epoch points to a different reward config.");
    }
    const safeDraftInspection = inspection.epoch.status === "DRAFTED" && inspection.epoch.executionBlocked;
    const safeReviewedInspection =
      inspection.epoch.status === "REVIEWED" &&
      !inspection.epoch.executionBlocked &&
      inspection.executionMode === "READ_ONLY" &&
      rewardEpochClaimTotalsAreBounded(inspection.epoch);
    if (!safeDraftInspection && !safeReviewedInspection) {
      blockers.push("Reward epoch must be drafted/blocked or reviewed/read-only with bounded claim totals.");
    }
    if (!rewardEpochAccountingBalances(inspection.epoch)) {
      blockers.push("Reward epoch accounting does not balance.");
    }
  } else if (inspection.epochStatus !== "PREVIEW_ONLY") {
    blockers.push("Reward epoch account must decode before admin reward inspection is considered ready.");
  }

  return {
    ...inspection,
    blockers: uniqueMessages(blockers),
    warnings: uniqueMessages(warnings),
  };
}

export function validateSeedBotPermissionInspection(
  inspection: SeedBotPermissionInspection,
  { nowUnix }: { nowUnix?: bigint | number | string } = {},
): SeedBotPermissionInspection {
  const blockers = [...inspection.blockers];
  const warnings = [...inspection.warnings];
  const lifecycleStatus =
    inspection.status === "DECODED"
      ? seedBotLifecycleStatus(inspection.status, inspection.decoded, nowUnix)
      : inspection.lifecycleStatus;

  if (inspection.executionMode !== "READ_ONLY") {
    blockers.push("SeedBot permission inspection must remain read-only.");
  }

  if (inspection.status === "DECODED" && inspection.decoded) {
    if (inspection.decoded.owner !== inspection.ownerAddress) {
      blockers.push("SeedBot permission owner does not match the inspected wallet.");
    }
    if (inspection.decoded.permissionHash === "00".repeat(32)) {
      blockers.push("SeedBot permission hash must not be blank.");
    }
    if (inspection.decoded.tierAtCreation === "NONE" || inspection.decoded.tierAtCreation === "UNKNOWN") {
      blockers.push("SeedBot permission was not created from an active staking tier.");
    }
    if (BigInt(inspection.decoded.stakedAmountAtCreation) <= 0n) {
      blockers.push("SeedBot permission stake snapshot must be greater than zero.");
    }
    if (BigInt(inspection.decoded.maxTradeAmount) <= 0n) {
      blockers.push("SeedBot permission max trade amount must be greater than zero.");
    }
    if (BigInt(inspection.decoded.maxDailyVolumeAmount) < BigInt(inspection.decoded.maxTradeAmount)) {
      blockers.push("SeedBot permission daily volume must be at least the max trade amount.");
    }
    if (
      inspection.decoded.maxDailyTrades <= 0 ||
      inspection.decoded.maxDailyTrades > MAX_SEEDBOT_DAILY_TRADES
    ) {
      blockers.push(`SeedBot permission daily trades must be between 1 and ${MAX_SEEDBOT_DAILY_TRADES}.`);
    }
    if (inspection.decoded.maxSlippageBps > MAX_SEEDBOT_SLIPPAGE_BPS) {
      blockers.push(`SeedBot permission slippage must not exceed ${MAX_SEEDBOT_SLIPPAGE_BPS} bps.`);
    }
    if (BigInt(inspection.decoded.dailyVolumeUsedAmount) > BigInt(inspection.decoded.maxDailyVolumeAmount)) {
      blockers.push("SeedBot permission daily usage exceeds the wallet-approved volume cap.");
    }
    if (inspection.decoded.dailyTradesUsed > inspection.decoded.maxDailyTrades) {
      blockers.push("SeedBot permission daily usage exceeds the wallet-approved trade count.");
    }
    if (BigInt(inspection.decoded.totalVolumeUsedAmount) < BigInt(inspection.decoded.dailyVolumeUsedAmount)) {
      blockers.push("SeedBot permission total usage cannot be lower than current daily usage.");
    }
    if (BigInt(inspection.decoded.totalTradesUsed) < BigInt(inspection.decoded.dailyTradesUsed)) {
      blockers.push("SeedBot permission total trade count cannot be lower than current daily trade count.");
    }
    if (lifecycleStatus === "REVOKED") {
      warnings.push("SeedBot permission is revoked and cannot be used for guarded automation.");
    }
    if (lifecycleStatus === "EXPIRED") {
      warnings.push("SeedBot permission is expired and must be renewed before guarded automation.");
    }
  } else if (inspection.status === "MISSING") {
    warnings.push("No SeedBot permission exists for this wallet.");
  } else if (inspection.status === "DECODE_ERROR") {
    blockers.push("SeedBot permission account must decode before it can be inspected.");
  }

  return {
    ...inspection,
    blockers: uniqueMessages(blockers),
    lifecycleStatus,
    warnings: uniqueMessages(warnings),
  };
}

export function decodeRewardConfigAccount(data: Uint8Array): RewardConfigAccount {
  assertAccountLayout(data, "RewardConfig");
  const offset = REWARD_ACCOUNT_FIELD_OFFSETS.RewardConfig;

  return {
    authority: readPubkey(data, offset.authority),
    protocolConfig: readPubkey(data, offset.protocol_config),
    rypMint: readPubkey(data, offset.ryp_mint),
    epochCadenceSeconds: readI64(data, offset.epoch_cadence_seconds).toString(),
    holderSplitBps: readU16(data, offset.holder_split_bps),
    stakerSplitBps: readU16(data, offset.staker_split_bps),
    treasurySplitBps: readU16(data, offset.treasury_split_bps),
    registeredVaultRolesMask: data[offset.registered_vault_roles_mask],
    verifiedVaultRolesMask: data[offset.verified_vault_roles_mask],
    totalEpochDrafts: readU64(data, offset.total_epoch_drafts).toString(),
    totalRoutedFeeAmount: readU64(data, offset.total_routed_fee_amount).toString(),
    paused: readBool(data, offset.paused),
    draftOnly: readBool(data, offset.draft_only),
    bump: data[offset.bump],
    pendingAuthority: readPubkey(data, offset.pending_authority),
  };
}

export function decodeRewardVaultStateAccount(data: Uint8Array): RewardVaultStateAccount {
  assertAccountLayout(data, "RewardVaultState");
  const offset = REWARD_ACCOUNT_FIELD_OFFSETS.RewardVaultState;

  return {
    rewardConfig: readPubkey(data, offset.reward_config),
    role: rewardVaultRoleFromVariant(data[offset.role]),
    rewardMint: readPubkey(data, offset.reward_mint),
    vaultAddress: readPubkey(data, offset.vault_address),
    custodyModel: custodyModelFromVariant(data[offset.custody_model]),
    verificationStatus: verificationStatusFromVariant(data[offset.verification_status]),
    metadataHash: bytesToHex(data.subarray(offset.metadata_hash, offset.metadata_hash + 32)),
    totalFundedAmount: readU64(data, offset.total_funded_amount).toString(),
    receivesUserFunds: readBool(data, offset.receives_user_funds),
    bump: data[offset.bump],
  };
}

export function decodeRewardEpochAccount(data: Uint8Array): RewardEpochAccount {
  assertAccountLayout(data, "RewardEpoch");
  const offset = REWARD_ACCOUNT_FIELD_OFFSETS.RewardEpoch;

  return {
    rewardConfig: readPubkey(data, offset.reward_config),
    epochId: readU64(data, offset.epoch_id).toString(),
    snapshotTakenAt: readI64(data, offset.snapshot_taken_at).toString(),
    createdAt: readI64(data, offset.created_at).toString(),
    rewardMint: readPubkey(data, offset.reward_mint),
    rewardPoolAmount: readU64(data, offset.reward_pool_amount).toString(),
    distributedNetAmount: readU64(data, offset.distributed_net_amount).toString(),
    reservedDeliveryCostAmount: readU64(data, offset.reserved_delivery_cost_amount).toString(),
    rolledForwardAmount: readU64(data, offset.rolled_forward_amount).toString(),
    recordedGrossAllocationAmount: readU64(data, offset.recorded_gross_allocation_amount).toString(),
    recordedNetClaimAmount: readU64(data, offset.recorded_net_claim_amount).toString(),
    claimedNetAmount: readU64(data, offset.claimed_net_amount).toString(),
    exclusionListHash: bytesToHex(data.subarray(offset.exclusion_list_hash, offset.exclusion_list_hash + 32)),
    claimMerkleRoot: bytesToHex(data.subarray(offset.claim_merkle_root, offset.claim_merkle_root + 32)),
    status: epochStatusFromVariant(data[offset.status]),
    executionBlocked: readBool(data, offset.execution_blocked),
    bump: data[offset.bump],
  };
}

export function decodeSeedBotPermissionAccount(data: Uint8Array): SeedBotPermissionAccount {
  assertAccountLayout(data, "SeedBotPermission");
  const offset = REWARD_ACCOUNT_FIELD_OFFSETS.SeedBotPermission;

  return {
    owner: readPubkey(data, offset.owner),
    position: readPubkey(data, offset.position),
    permissionHash: bytesToHex(data.subarray(offset.permission_hash, offset.permission_hash + 32)),
    createdAt: readI64(data, offset.created_at).toString(),
    expiresAt: readI64(data, offset.expires_at).toString(),
    maxTradeAmount: readU64(data, offset.max_trade_amount).toString(),
    maxDailyVolumeAmount: readU64(data, offset.max_daily_volume_amount).toString(),
    maxDailyTrades: readU16(data, offset.max_daily_trades),
    maxSlippageBps: readU16(data, offset.max_slippage_bps),
    tierAtCreation: stakeTierFromVariant(data[offset.tier_at_creation]),
    stakedAmountAtCreation: readU64(data, offset.staked_amount_at_creation).toString(),
    stakingStartTsAtCreation: readI64(data, offset.staking_start_ts_at_creation).toString(),
    revoked: readBool(data, offset.revoked),
    bump: data[offset.bump],
    usageDayStartTs: readI64(data, offset.usage_day_start_ts).toString(),
    dailyVolumeUsedAmount: readU64(data, offset.daily_volume_used_amount).toString(),
    dailyTradesUsed: readU16(data, offset.daily_trades_used),
    totalVolumeUsedAmount: readU64(data, offset.total_volume_used_amount).toString(),
    totalTradesUsed: readU64(data, offset.total_trades_used).toString(),
    lastExecutionTs: readI64(data, offset.last_execution_ts).toString(),
  };
}

function decodeAccount<T>(
  data: Uint8Array | undefined,
  decoder: (data: Uint8Array) => T,
): { decoded?: T; message: string; status: RewardAccountReadStatus } {
  if (!data) {
    return {
      message: "Account not found on the selected cluster.",
      status: "MISSING",
    };
  }

  try {
    return {
      decoded: decoder(data),
      message: "Account decoded from selected cluster.",
      status: "DECODED",
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Account decode failed.",
      status: "DECODE_ERROR",
    };
  }
}

function rewardVaultRoleFromVariant(variant: number): RewardVaultRole {
  return rewardVaultRoleSpecs.find((role) => role.variant === variant)?.role ?? "UNKNOWN";
}

function custodyModelFromVariant(variant: number): RewardVaultCustodyModel {
  if (variant === 0) return "PROGRAM_CONTROLLED";
  if (variant === 1) return "TREASURY_CONTROLLED";
  if (variant === 2) return "DISCLOSURE_PENDING";
  return "UNKNOWN";
}

function verificationStatusFromVariant(variant: number): RewardVaultVerificationStatus {
  if (variant === 0) return "DRAFT";
  if (variant === 1) return "PENDING_VERIFICATION";
  if (variant === 2) return "VERIFIED";
  if (variant === 3) return "DISABLED";
  return "UNKNOWN";
}

function epochStatusFromVariant(variant: number): RewardEpochStatus {
  if (variant === 0) return "DRAFTED";
  if (variant === 1) return "REVIEWED";
  if (variant === 2) return "CANCELLED";
  return "UNKNOWN";
}

function stakeTierFromVariant(variant: number): StakeTierName {
  if (variant === 0) return "NONE";
  if (variant === 1) return "SEED";
  if (variant === 2) return "SPROUT";
  if (variant === 3) return "SAPLING";
  if (variant === 4) return "TREE";
  if (variant === 5) return "FRUIT";
  return "UNKNOWN";
}

function seedBotLifecycleStatus(
  status: RewardAccountReadStatus,
  decoded: SeedBotPermissionAccount | undefined,
  nowUnix?: bigint | number | string,
): SeedBotPermissionLifecycleStatus {
  if (status === "PREVIEW_ONLY") return "PREVIEW_ONLY";
  if (status === "MISSING") return "MISSING";
  if (status === "DECODE_ERROR" || !decoded) return "DECODE_ERROR";
  if (decoded.revoked) return "REVOKED";
  if (nowUnix !== undefined && BigInt(decoded.expiresAt) <= BigInt(nowUnix)) return "EXPIRED";
  return "ACTIVE";
}

function rewardEpochAccountingBalances(epoch: RewardEpochAccount) {
  try {
    const pool = BigInt(epoch.rewardPoolAmount);
    const distributed = BigInt(epoch.distributedNetAmount);
    const delivery = BigInt(epoch.reservedDeliveryCostAmount);
    const rollover = BigInt(epoch.rolledForwardAmount);
    return pool === distributed + delivery + rollover;
  } catch {
    return false;
  }
}

function rewardEpochClaimTotalsAreBounded(epoch: RewardEpochAccount) {
  try {
    const rewardPool = BigInt(epoch.rewardPoolAmount);
    const distributed = BigInt(epoch.distributedNetAmount);
    const recordedGross = BigInt(epoch.recordedGrossAllocationAmount);
    const recordedNet = BigInt(epoch.recordedNetClaimAmount);
    const claimedNet = BigInt(epoch.claimedNetAmount);

    return recordedGross <= rewardPool && recordedNet <= distributed && claimedNet <= recordedNet;
  } catch {
    return false;
  }
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}

function readPubkey(data: Uint8Array, offset: number) {
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58();
}

function readU16(data: Uint8Array, offset: number) {
  return dataView(data).getUint16(offset, true);
}

function readU64(data: Uint8Array, offset: number) {
  return dataView(data).getBigUint64(offset, true);
}

function readI64(data: Uint8Array, offset: number) {
  return dataView(data).getBigInt64(offset, true);
}

function readBool(data: Uint8Array, offset: number) {
  return data[offset] === 1;
}

function assertAccountLayout(data: Uint8Array, accountName: RewardAccountLayoutName) {
  const layout = REWARD_ACCOUNT_LAYOUTS[accountName];
  if (data.length < layout.minimumLength) {
    throw new Error(`${accountName} account is too small: expected at least ${layout.minimumLength} bytes.`);
  }

  const actualDiscriminator = bytesToHex(data.subarray(0, 8));
  if (actualDiscriminator !== layout.discriminatorHex) {
    throw new Error(`${accountName} discriminator mismatch: expected ${layout.discriminatorHex}.`);
  }
}

function dataView(data: Uint8Array) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function textSeed(seed: string) {
  return new TextEncoder().encode(seed);
}

function u64LeBytes(value: bigint) {
  const bytes = new Uint8Array(8);
  dataView(bytes).setBigUint64(0, value, true);
  return bytes;
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
