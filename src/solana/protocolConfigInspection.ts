import { Connection, PublicKey } from "@solana/web3.js";
import { appConfig, PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";
import { PLATFORM_ACTION_BASE_FEE_BPS } from "../domain/feeRouter";
import { selectableTiers, tierFeeReduction } from "../domain/tiering";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  CONFIG_SEED,
  SPL_TOKEN_PROGRAM_ID,
} from "./protocolTransactionPlan";
import protocolAccountLayoutsJson from "./protocolAccountLayouts.json";

type ProtocolConfigLayoutName = "ProtocolConfig";

type ProtocolConfigFieldLayout = {
  name: string;
  type: string;
  offset: number;
  size: number;
};

type ProtocolConfigLayout = {
  discriminatorHex: string;
  minimumLength: number;
  fields: ProtocolConfigFieldLayout[];
};

export type ProtocolConfigReadStatus = "PREVIEW_ONLY" | "MISSING" | "DECODED" | "DECODE_ERROR";

export type ProtocolConfigAccount = {
  authority: string;
  rypMint: string;
  rypVault: string;
  baseFeeBps: number;
  tierThresholds: string[];
  tierFeeReductionBps: number[];
  totalStaked: string;
  paused: boolean;
  bump: number;
  pendingAuthority: string;
  projectAuthority: string;
  pendingProjectAuthority: string;
};

export type ProtocolConfigInspection = {
  programId: string;
  configAddress: string;
  rypMintAddress: string;
  rypVaultAddress: string;
  status: ProtocolConfigReadStatus;
  decoded?: ProtocolConfigAccount;
  message: string;
  executionMode: "READ_ONLY";
  blockers: string[];
  warnings: string[];
};

export const PROTOCOL_CONFIG_LAYOUTS = protocolAccountLayoutsJson as Record<
  ProtocolConfigLayoutName,
  ProtocolConfigLayout
>;

const PROTOCOL_CONFIG_FIELD_OFFSETS = Object.fromEntries(
  PROTOCOL_CONFIG_LAYOUTS.ProtocolConfig.fields.map((field) => [field.name, field.offset]),
) as Record<string, number>;

const DEFAULT_PUBLIC_KEY = PublicKey.default.toBase58();

export function deriveProtocolConfigInspectionAddresses({
  programIdAddress = appConfig.protocolProgramId,
  rypMintAddress = appConfig.rypMintAddress,
}: {
  programIdAddress?: string;
  rypMintAddress?: string;
} = {}) {
  const programId = new PublicKey(programIdAddress);
  const rypMint = new PublicKey(rypMintAddress);
  const [config] = PublicKey.findProgramAddressSync([textSeed(CONFIG_SEED)], programId);
  const rypVault = deriveAssociatedTokenAddress({ mint: rypMint, owner: config });

  return {
    configAddress: config.toBase58(),
    programId: programId.toBase58(),
    rypMintAddress: rypMint.toBase58(),
    rypVaultAddress: rypVault.toBase58(),
  };
}

export function buildProtocolConfigInspectionPreview({
  programIdAddress = appConfig.protocolProgramId,
  rypMintAddress = appConfig.rypMintAddress,
}: {
  programIdAddress?: string;
  rypMintAddress?: string;
} = {}): ProtocolConfigInspection {
  const addresses = deriveProtocolConfigInspectionAddresses({ programIdAddress, rypMintAddress });
  const placeholderProgram = addresses.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID;

  return {
    ...addresses,
    status: "PREVIEW_ONLY",
    message: "Protocol config account read has not been requested.",
    executionMode: "READ_ONLY",
    blockers: [],
    warnings: [
      "Protocol config inspection is read-only.",
      "No staking, fee, reward, authority, or vault mutation is exposed by this inspection.",
      ...(placeholderProgram ? ["Protocol program id is still the local development placeholder."] : []),
    ],
  };
}

export async function readProtocolConfigInspection({
  connection,
  programIdAddress = appConfig.protocolProgramId,
  rypMintAddress = appConfig.rypMintAddress,
}: {
  connection: Connection;
  programIdAddress?: string;
  rypMintAddress?: string;
}): Promise<ProtocolConfigInspection> {
  const preview = buildProtocolConfigInspectionPreview({ programIdAddress, rypMintAddress });

  if (preview.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID) {
    return {
      ...preview,
      message: "Protocol program id is placeholder; RPC read skipped.",
      status: "PREVIEW_ONLY",
    };
  }

  const account = await connection.getAccountInfo(new PublicKey(preview.configAddress), "confirmed");
  const decoded = decodeAccount(account?.data, decodeProtocolConfigAccount);

  return validateProtocolConfigInspection({
    ...preview,
    decoded: decoded.decoded,
    message: decoded.message,
    status: decoded.status,
  });
}

export function validateProtocolConfigInspection(
  inspection: ProtocolConfigInspection,
): ProtocolConfigInspection {
  const blockers = [...inspection.blockers];
  const warnings = [...inspection.warnings];

  if (inspection.executionMode !== "READ_ONLY") {
    blockers.push("Protocol config inspection must remain read-only.");
  }

  if (inspection.status === "DECODED" && inspection.decoded) {
    if (inspection.decoded.rypMint !== inspection.rypMintAddress) {
      blockers.push("Protocol config RYP mint does not match the configured RYP mint.");
    }
    if (inspection.decoded.rypVault !== inspection.rypVaultAddress) {
      blockers.push("Protocol config RYP vault does not match the expected config-owned ATA.");
    }
    if (inspection.decoded.baseFeeBps > 1_000) {
      blockers.push("Protocol base fee exceeds the on-chain 1000 bps safety ceiling.");
    }
    if (inspection.decoded.baseFeeBps !== PLATFORM_ACTION_BASE_FEE_BPS) {
      warnings.push(
        `Protocol base fee is ${inspection.decoded.baseFeeBps} bps; current app policy is ${PLATFORM_ACTION_BASE_FEE_BPS} bps.`,
      );
    }
    if (!thresholdsAreIncreasing(inspection.decoded.tierThresholds)) {
      blockers.push("Protocol tier thresholds must be strictly increasing.");
    }
    if (!feeReductionsAreSafe(inspection.decoded.baseFeeBps, inspection.decoded.tierFeeReductionBps)) {
      blockers.push("Protocol tier fee reductions must be monotonic and no greater than the base fee.");
    }
    if (!feeReductionsMatchPolicy(inspection.decoded.baseFeeBps, inspection.decoded.tierFeeReductionBps)) {
      warnings.push("Protocol tier fee reductions differ from the current app tier policy.");
    }
    if (inspection.decoded.paused) {
      warnings.push("Protocol config is paused on the selected cluster.");
    }
    if (inspection.decoded.pendingAuthority !== DEFAULT_PUBLIC_KEY) {
      warnings.push("Protocol authority transfer is pending.");
    }
    if (inspection.decoded.pendingProjectAuthority !== DEFAULT_PUBLIC_KEY) {
      warnings.push("Project authority transfer is pending.");
    }
  } else if (inspection.status === "MISSING") {
    blockers.push("Protocol config account is missing on the selected cluster.");
  } else if (inspection.status === "DECODE_ERROR") {
    blockers.push("Protocol config account must decode before admin inspection is considered ready.");
  }

  return {
    ...inspection,
    blockers: uniqueMessages(blockers),
    warnings: uniqueMessages(warnings),
  };
}

export function decodeProtocolConfigAccount(data: Uint8Array): ProtocolConfigAccount {
  assertProtocolConfigLayout(data);
  const offset = PROTOCOL_CONFIG_FIELD_OFFSETS;

  return {
    authority: readPubkey(data, offset.authority),
    rypMint: readPubkey(data, offset.ryp_mint),
    rypVault: readPubkey(data, offset.ryp_vault),
    baseFeeBps: readU16(data, offset.base_fee_bps),
    tierThresholds: readU64Array(data, offset.tier_thresholds, 5),
    tierFeeReductionBps: readU16Array(data, offset.tier_fee_reduction_bps, 5),
    totalStaked: readU64(data, offset.total_staked).toString(),
    paused: readBool(data, offset.paused),
    bump: data[offset.bump],
    pendingAuthority: readPubkey(data, offset.pending_authority),
    projectAuthority: readPubkey(data, offset.project_authority),
    pendingProjectAuthority: readPubkey(data, offset.pending_project_authority),
  };
}

function decodeAccount<T>(
  data: Uint8Array | undefined,
  decoder: (data: Uint8Array) => T,
): { decoded?: T; message: string; status: ProtocolConfigReadStatus } {
  if (!data) {
    return {
      message: "Account not found on the selected cluster.",
      status: "MISSING",
    };
  }

  try {
    return {
      decoded: decoder(data),
      message: "Protocol config decoded from selected cluster.",
      status: "DECODED",
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : "Protocol config decode failed.",
      status: "DECODE_ERROR",
    };
  }
}

function thresholdsAreIncreasing(thresholds: string[]) {
  try {
    return thresholds.every((threshold, index) => index === 0 || BigInt(threshold) > BigInt(thresholds[index - 1]));
  } catch {
    return false;
  }
}

function feeReductionsAreSafe(baseFeeBps: number, reductions: number[]) {
  return reductions.every(
    (reduction, index) =>
      Number.isInteger(reduction) &&
      reduction >= 0 &&
      reduction <= baseFeeBps &&
      (index === 0 || reduction >= reductions[index - 1]),
  );
}

function feeReductionsMatchPolicy(baseFeeBps: number, reductions: number[]) {
  const expected = selectableTiers.map((tier) =>
    Math.round((baseFeeBps * tierFeeReduction[tier]) / 100),
  );
  return reductions.length === expected.length && reductions.every((reduction, index) => reduction === expected[index]);
}

function deriveAssociatedTokenAddress({ mint, owner }: { mint: PublicKey; owner: PublicKey }) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

function assertProtocolConfigLayout(data: Uint8Array) {
  const layout = PROTOCOL_CONFIG_LAYOUTS.ProtocolConfig;
  if (data.length < layout.minimumLength) {
    throw new Error(`ProtocolConfig account is too small: expected at least ${layout.minimumLength} bytes.`);
  }

  const actualDiscriminator = bytesToHex(data.subarray(0, 8));
  if (actualDiscriminator !== layout.discriminatorHex) {
    throw new Error(`ProtocolConfig discriminator mismatch: expected ${layout.discriminatorHex}.`);
  }
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

function readU16Array(data: Uint8Array, offset: number, length: number) {
  return Array.from({ length }, (_, index) => readU16(data, offset + index * 2));
}

function readU64Array(data: Uint8Array, offset: number, length: number) {
  return Array.from({ length }, (_, index) => readU64(data, offset + index * 8).toString());
}

function readBool(data: Uint8Array, offset: number) {
  return data[offset] === 1;
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}

function dataView(data: Uint8Array) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function textSeed(seed: string) {
  return new TextEncoder().encode(seed);
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
