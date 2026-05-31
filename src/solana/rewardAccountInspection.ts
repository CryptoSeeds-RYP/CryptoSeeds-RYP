import { Connection, PublicKey } from "@solana/web3.js";
import { appConfig, PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";

export const REWARD_CONFIG_SEED = "reward-config";
export const REWARD_VAULT_STATE_SEED = "reward-vault";
export const REWARD_EPOCH_SEED = "reward-epoch";

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
  paused: boolean;
  draftOnly: boolean;
  bump: number;
};

export type RewardVaultStateAccount = {
  rewardConfig: string;
  role: RewardVaultRole;
  rewardMint: string;
  vaultAddress: string;
  custodyModel: RewardVaultCustodyModel;
  verificationStatus: RewardVaultVerificationStatus;
  metadataHash: string;
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
  exclusionListHash: string;
  status: RewardEpochStatus;
  executionBlocked: boolean;
  bump: number;
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

  return {
    ...preview,
    rewardConfig: rewardConfig.decoded,
    rewardConfigMessage: rewardConfig.message,
    rewardConfigStatus: rewardConfig.status,
    epoch: epoch.decoded,
    epochMessage: epoch.message,
    epochStatus: epoch.status,
    vaults,
  };
}

export function decodeRewardConfigAccount(data: Uint8Array): RewardConfigAccount {
  assertLength(data, 131, "RewardConfig");

  return {
    authority: readPubkey(data, 8),
    protocolConfig: readPubkey(data, 40),
    rypMint: readPubkey(data, 72),
    epochCadenceSeconds: readI64(data, 104).toString(),
    holderSplitBps: readU16(data, 112),
    stakerSplitBps: readU16(data, 114),
    treasurySplitBps: readU16(data, 116),
    registeredVaultRolesMask: data[118],
    verifiedVaultRolesMask: data[119],
    totalEpochDrafts: readU64(data, 120).toString(),
    paused: readBool(data, 128),
    draftOnly: readBool(data, 129),
    bump: data[130],
  };
}

export function decodeRewardVaultStateAccount(data: Uint8Array): RewardVaultStateAccount {
  assertLength(data, 141, "RewardVaultState");

  return {
    rewardConfig: readPubkey(data, 8),
    role: rewardVaultRoleFromVariant(data[40]),
    rewardMint: readPubkey(data, 41),
    vaultAddress: readPubkey(data, 73),
    custodyModel: custodyModelFromVariant(data[105]),
    verificationStatus: verificationStatusFromVariant(data[106]),
    metadataHash: bytesToHex(data.subarray(107, 139)),
    receivesUserFunds: readBool(data, 139),
    bump: data[140],
  };
}

export function decodeRewardEpochAccount(data: Uint8Array): RewardEpochAccount {
  assertLength(data, 163, "RewardEpoch");

  return {
    rewardConfig: readPubkey(data, 8),
    epochId: readU64(data, 40).toString(),
    snapshotTakenAt: readI64(data, 48).toString(),
    createdAt: readI64(data, 56).toString(),
    rewardMint: readPubkey(data, 64),
    rewardPoolAmount: readU64(data, 96).toString(),
    distributedNetAmount: readU64(data, 104).toString(),
    reservedDeliveryCostAmount: readU64(data, 112).toString(),
    rolledForwardAmount: readU64(data, 120).toString(),
    exclusionListHash: bytesToHex(data.subarray(128, 160)),
    status: epochStatusFromVariant(data[160]),
    executionBlocked: readBool(data, 161),
    bump: data[162],
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

function assertLength(data: Uint8Array, minimumLength: number, accountName: string) {
  if (data.length < minimumLength) {
    throw new Error(`${accountName} account is too small: expected at least ${minimumLength} bytes.`);
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
