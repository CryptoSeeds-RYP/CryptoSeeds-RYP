import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";
import {
  buildProtocolConfigInspectionPreview,
  decodeProtocolConfigAccount,
  deriveProtocolConfigInspectionAddresses,
  PROTOCOL_CONFIG_LAYOUTS,
  validateProtocolConfigInspection,
  type ProtocolConfigInspection,
} from "./protocolConfigInspection";

describe("protocol config inspection", () => {
  it("derives stable read-only protocol config addresses", () => {
    const addresses = deriveProtocolConfigInspectionAddresses({
      programIdAddress: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
    });

    expect(addresses.programId).toBe(PLACEHOLDER_PROTOCOL_PROGRAM_ID);
    expect(addresses.configAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(addresses.rypVaultAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("builds a preview-only inspection model without executable actions", () => {
    const inspection = buildProtocolConfigInspectionPreview();

    expect(inspection.executionMode).toBe("READ_ONLY");
    expect(inspection.status).toBe("PREVIEW_ONLY");
    expect(inspection.warnings.join(" ")).toContain("No staking");
  });

  it("decodes ProtocolConfig account bytes", () => {
    const addresses = deriveProtocolConfigInspectionAddresses();
    const authority = Keypair.generate().publicKey;
    const projectAuthority = Keypair.generate().publicKey;
    const pendingAuthority = Keypair.generate().publicKey;
    const pendingProjectAuthority = Keypair.generate().publicKey;
    const data = new Uint8Array(PROTOCOL_CONFIG_LAYOUTS.ProtocolConfig.minimumLength);
    const offset = protocolConfigOffsets();

    writeDiscriminator(data);
    writePubkey(data, offset.authority, authority);
    writePubkey(data, offset.ryp_mint, new PublicKey(addresses.rypMintAddress));
    writePubkey(data, offset.ryp_vault, new PublicKey(addresses.rypVaultAddress));
    view(data).setUint16(offset.base_fee_bps, 350, true);
    writeU64Array(data, offset.tier_thresholds, [
      5_000_000_000n,
      20_000_000_000n,
      50_000_000_000n,
      100_000_000_000n,
      150_000_000_000n,
    ]);
    writeU16Array(data, offset.tier_fee_reduction_bps, [0, 35, 70, 105, 140]);
    view(data).setBigUint64(offset.total_staked, 7_500_000_000n, true);
    data[offset.paused] = 1;
    view(data).setUint16(offset.module_pause_flags, 17, true);
    data[offset.bump] = 255;
    writePubkey(data, offset.pending_authority, pendingAuthority);
    writePubkey(data, offset.project_authority, projectAuthority);
    writePubkey(data, offset.pending_project_authority, pendingProjectAuthority);

    expect(decodeProtocolConfigAccount(data)).toEqual({
      authority: authority.toBase58(),
      rypMint: addresses.rypMintAddress,
      rypVault: addresses.rypVaultAddress,
      baseFeeBps: 350,
      tierThresholds: [
        "5000000000",
        "20000000000",
        "50000000000",
        "100000000000",
        "150000000000",
      ],
      tierFeeReductionBps: [0, 35, 70, 105, 140],
      totalStaked: "7500000000",
      paused: true,
      modulePauseFlags: 17,
      activeModulePauses: ["STAKING", "FEE_ROUTING"],
      unknownModulePauseFlags: 0,
      bump: 255,
      pendingAuthority: pendingAuthority.toBase58(),
      projectAuthority: projectAuthority.toBase58(),
      pendingProjectAuthority: pendingProjectAuthority.toBase58(),
    });
  });

  it("rejects ProtocolConfig with the wrong Anchor discriminator", () => {
    const data = new Uint8Array(PROTOCOL_CONFIG_LAYOUTS.ProtocolConfig.minimumLength);

    expect(() => decodeProtocolConfigAccount(data)).toThrow("ProtocolConfig discriminator mismatch");
  });

  it("validates decoded protocol config inspections", () => {
    const validated = validateProtocolConfigInspection(buildDecodedProtocolInspection());

    expect(validated.blockers).toEqual([]);
  });

  it("surfaces named scoped module pause warnings", () => {
    const validated = validateProtocolConfigInspection(
      buildDecodedProtocolInspection({
        decoded: {
          activeModulePauses: ["STAKING", "FEE_ROUTING"],
          modulePauseFlags: 17,
        },
      }),
    );

    expect(validated.warnings.join(" ")).toContain("STAKING, FEE_ROUTING");
  });

  it("blocks unknown scoped module pause bits", () => {
    const validated = validateProtocolConfigInspection(
      buildDecodedProtocolInspection({
        decoded: {
          activeModulePauses: [],
          modulePauseFlags: 32,
          unknownModulePauseFlags: 32,
        },
      }),
    );

    expect(validated.blockers.join(" ")).toContain("unknown bits: 32");
  });

  it("blocks unsafe or mismatched decoded protocol config inspections", () => {
    const validated = validateProtocolConfigInspection(
      buildDecodedProtocolInspection({
        decoded: {
          baseFeeBps: 1_001,
          rypMint: Keypair.generate().publicKey.toBase58(),
          rypVault: Keypair.generate().publicKey.toBase58(),
          tierFeeReductionBps: [0, 60, 40, 100, 1_001],
          tierThresholds: ["5000000000", "5000000000", "20000000000", "10000000000", "150000000000"],
        },
      }),
    );

    const blockers = validated.blockers.join(" ");

    expect(blockers).toContain("RYP mint does not match");
    expect(blockers).toContain("RYP vault does not match");
    expect(blockers).toContain("base fee exceeds");
    expect(blockers).toContain("tier thresholds");
    expect(blockers).toContain("tier fee reductions");
  });
});

function buildDecodedProtocolInspection(
  overrides: {
    decoded?: Partial<NonNullable<ProtocolConfigInspection["decoded"]>>;
  } = {},
): ProtocolConfigInspection {
  const preview = buildProtocolConfigInspectionPreview();
  return {
    ...preview,
    decoded: {
      authority: Keypair.generate().publicKey.toBase58(),
      rypMint: preview.rypMintAddress,
      rypVault: preview.rypVaultAddress,
      baseFeeBps: 350,
      tierThresholds: [
        "5000000000",
        "20000000000",
        "50000000000",
        "100000000000",
        "150000000000",
      ],
      tierFeeReductionBps: [0, 35, 70, 105, 140],
      totalStaked: "0",
      paused: false,
      modulePauseFlags: 0,
      activeModulePauses: [],
      unknownModulePauseFlags: 0,
      bump: 255,
      pendingAuthority: PublicKey.default.toBase58(),
      projectAuthority: Keypair.generate().publicKey.toBase58(),
      pendingProjectAuthority: PublicKey.default.toBase58(),
      ...overrides.decoded,
    },
    message: "Protocol config decoded from selected cluster.",
    status: "DECODED",
  };
}

function protocolConfigOffsets() {
  return Object.fromEntries(
    PROTOCOL_CONFIG_LAYOUTS.ProtocolConfig.fields.map((field) => [field.name, field.offset]),
  ) as Record<string, number>;
}

function writeDiscriminator(data: Uint8Array) {
  const bytes = PROTOCOL_CONFIG_LAYOUTS.ProtocolConfig.discriminatorHex.match(/.{1,2}/g) ?? [];
  data.set(bytes.map((byte) => Number.parseInt(byte, 16)), 0);
}

function writePubkey(data: Uint8Array, offset: number, publicKey: PublicKey) {
  data.set(publicKey.toBytes(), offset);
}

function writeU16Array(data: Uint8Array, offset: number, values: number[]) {
  values.forEach((value, index) => view(data).setUint16(offset + index * 2, value, true));
}

function writeU64Array(data: Uint8Array, offset: number, values: bigint[]) {
  values.forEach((value, index) => view(data).setBigUint64(offset + index * 8, value, true));
}

function view(data: Uint8Array) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}
