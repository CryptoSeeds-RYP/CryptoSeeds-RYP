import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  buildRewardAccountInspectionPreview,
  decodeRewardConfigAccount,
  decodeRewardEpochAccount,
  decodeRewardVaultStateAccount,
  deriveRewardAccountAddresses,
  REWARD_ACCOUNT_LAYOUTS,
  validateRewardAccountInspection,
  type RewardAccountInspection,
} from "./rewardAccountInspection";
import { PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";

describe("reward account inspection", () => {
  it("derives stable read-only reward account addresses", () => {
    const addresses = deriveRewardAccountAddresses({
      epochId: 3n,
      programIdAddress: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
    });

    expect(addresses.programId).toBe(PLACEHOLDER_PROTOCOL_PROGRAM_ID);
    expect(addresses.rewardConfigAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(addresses.epochPreviewAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(addresses.epochId).toBe("3");
    expect(addresses.vaults.map((vault) => vault.role)).toEqual([
      "HOLDER_REWARD",
      "STAKER_REWARD",
      "INDEPENDENT_TREASURY",
      "DELIVERY_COST_RESERVE",
      "ROLLOVER",
    ]);
  });

  it("builds a preview-only inspection model without executable actions", () => {
    const inspection = buildRewardAccountInspectionPreview();

    expect(inspection.executionMode).toBe("READ_ONLY");
    expect(inspection.rewardConfigStatus).toBe("PREVIEW_ONLY");
    expect(inspection.vaults.every((vault) => vault.status === "PREVIEW_ONLY")).toBe(true);
    expect(inspection.warnings.join(" ")).toContain("No reward setup");
  });

  it("decodes RewardConfig account bytes", () => {
    const authority = Keypair.generate().publicKey;
    const protocolConfig = Keypair.generate().publicKey;
    const rypMint = Keypair.generate().publicKey;
    const data = new Uint8Array(131);

    writeDiscriminator(data, "RewardConfig");
    writePubkey(data, 8, authority);
    writePubkey(data, 40, protocolConfig);
    writePubkey(data, 72, rypMint);
    view(data).setBigInt64(104, 604_800n, true);
    view(data).setUint16(112, 3_334, true);
    view(data).setUint16(114, 3_333, true);
    view(data).setUint16(116, 3_333, true);
    data[118] = 31;
    data[119] = 31;
    view(data).setBigUint64(120, 2n, true);
    data[128] = 0;
    data[129] = 1;
    data[130] = 255;

    expect(decodeRewardConfigAccount(data)).toEqual({
      authority: authority.toBase58(),
      protocolConfig: protocolConfig.toBase58(),
      rypMint: rypMint.toBase58(),
      epochCadenceSeconds: "604800",
      holderSplitBps: 3334,
      stakerSplitBps: 3333,
      treasurySplitBps: 3333,
      registeredVaultRolesMask: 31,
      verifiedVaultRolesMask: 31,
      totalEpochDrafts: "2",
      paused: false,
      draftOnly: true,
      bump: 255,
    });
  });

  it("decodes RewardVaultState account bytes", () => {
    const rewardConfig = Keypair.generate().publicKey;
    const rewardMint = Keypair.generate().publicKey;
    const vaultAddress = Keypair.generate().publicKey;
    const data = new Uint8Array(141);

    writeDiscriminator(data, "RewardVaultState");
    writePubkey(data, 8, rewardConfig);
    data[40] = 2;
    writePubkey(data, 41, rewardMint);
    writePubkey(data, 73, vaultAddress);
    data[105] = 1;
    data[106] = 2;
    data.fill(7, 107, 139);
    data[139] = 0;
    data[140] = 254;

    expect(decodeRewardVaultStateAccount(data)).toMatchObject({
      custodyModel: "TREASURY_CONTROLLED",
      metadataHash: "07".repeat(32),
      receivesUserFunds: false,
      rewardConfig: rewardConfig.toBase58(),
      rewardMint: rewardMint.toBase58(),
      role: "INDEPENDENT_TREASURY",
      vaultAddress: vaultAddress.toBase58(),
      verificationStatus: "VERIFIED",
      bump: 254,
    });
  });

  it("decodes RewardEpoch account bytes", () => {
    const rewardConfig = Keypair.generate().publicKey;
    const rewardMint = Keypair.generate().publicKey;
    const data = new Uint8Array(163);

    writeDiscriminator(data, "RewardEpoch");
    writePubkey(data, 8, rewardConfig);
    view(data).setBigUint64(40, 3n, true);
    view(data).setBigInt64(48, 1_800_000_000n, true);
    view(data).setBigInt64(56, 1_800_000_010n, true);
    writePubkey(data, 64, rewardMint);
    view(data).setBigUint64(96, 1_000n, true);
    view(data).setBigUint64(104, 700n, true);
    view(data).setBigUint64(112, 100n, true);
    view(data).setBigUint64(120, 200n, true);
    data.fill(9, 128, 160);
    data[160] = 0;
    data[161] = 1;
    data[162] = 253;

    expect(decodeRewardEpochAccount(data)).toMatchObject({
      createdAt: "1800000010",
      distributedNetAmount: "700",
      epochId: "3",
      executionBlocked: true,
      exclusionListHash: "09".repeat(32),
      reservedDeliveryCostAmount: "100",
      rewardConfig: rewardConfig.toBase58(),
      rewardMint: rewardMint.toBase58(),
      rewardPoolAmount: "1000",
      rolledForwardAmount: "200",
      snapshotTakenAt: "1800000000",
      status: "DRAFTED",
      bump: 253,
    });
  });

  it("rejects reward accounts with the wrong Anchor discriminator", () => {
    const data = new Uint8Array(131);

    expect(() => decodeRewardConfigAccount(data)).toThrow("RewardConfig discriminator mismatch");
  });

  it("validates decoded admin reward inspections", () => {
    const inspection = buildDecodedInspection();

    expect(validateRewardAccountInspection(inspection).blockers).toEqual([]);
  });

  it("blocks unsafe decoded admin reward inspections", () => {
    const inspection = buildDecodedInspection({
      rewardConfig: {
        holderSplitBps: 3_000,
        draftOnly: false,
      },
      epoch: {
        executionBlocked: false,
        rewardPoolAmount: "1000",
        distributedNetAmount: "900",
        reservedDeliveryCostAmount: "100",
        rolledForwardAmount: "100",
      },
      vault: {
        verificationStatus: "PENDING_VERIFICATION",
        receivesUserFunds: true,
      },
    });

    const blockers = validateRewardAccountInspection(inspection).blockers.join(" ");

    expect(blockers).toContain("splits must total 10000 bps");
    expect(blockers).toContain("draft-only");
    expect(blockers).toContain("is not verified");
    expect(blockers).toContain("must not be marked as receiving user funds");
    expect(blockers).toContain("execution must remain blocked");
    expect(blockers).toContain("accounting does not balance");
  });
});

function buildDecodedInspection(
  overrides: {
    rewardConfig?: Partial<NonNullable<RewardAccountInspection["rewardConfig"]>>;
    epoch?: Partial<NonNullable<RewardAccountInspection["epoch"]>>;
    vault?: Partial<NonNullable<RewardAccountInspection["vaults"][number]["decoded"]>>;
  } = {},
): RewardAccountInspection {
  const preview = buildRewardAccountInspectionPreview({ epochId: 3n });
  const authority = Keypair.generate().publicKey.toBase58();
  const protocolConfig = Keypair.generate().publicKey.toBase58();
  const mint = Keypair.generate().publicKey.toBase58();

  return {
    ...preview,
    rewardConfigStatus: "DECODED",
    rewardConfigMessage: "Account decoded from selected cluster.",
    rewardConfig: {
      authority,
      protocolConfig,
      rypMint: mint,
      epochCadenceSeconds: "604800",
      holderSplitBps: 3_334,
      stakerSplitBps: 3_333,
      treasurySplitBps: 3_333,
      registeredVaultRolesMask: 31,
      verifiedVaultRolesMask: 31,
      totalEpochDrafts: "1",
      paused: false,
      draftOnly: true,
      bump: 255,
      ...overrides.rewardConfig,
    },
    epochStatus: "DECODED",
    epochMessage: "Account decoded from selected cluster.",
    epoch: {
      rewardConfig: preview.rewardConfigAddress,
      epochId: "3",
      snapshotTakenAt: "1800000000",
      createdAt: "1800000010",
      rewardMint: mint,
      rewardPoolAmount: "1000",
      distributedNetAmount: "700",
      reservedDeliveryCostAmount: "100",
      rolledForwardAmount: "200",
      exclusionListHash: "09".repeat(32),
      status: "DRAFTED",
      executionBlocked: true,
      bump: 254,
      ...overrides.epoch,
    },
    vaults: preview.vaults.map((vault) => ({
      ...vault,
      status: "DECODED",
      message: "Account decoded from selected cluster.",
      decoded: {
        rewardConfig: preview.rewardConfigAddress,
        role: vault.role,
        rewardMint: mint,
        vaultAddress: Keypair.generate().publicKey.toBase58(),
        custodyModel: vault.role === "INDEPENDENT_TREASURY" ? "TREASURY_CONTROLLED" : "PROGRAM_CONTROLLED",
        verificationStatus: "VERIFIED",
        metadataHash: "07".repeat(32),
        receivesUserFunds: false,
        bump: 253,
        ...overrides.vault,
      },
    })),
  };
}

function writeDiscriminator(data: Uint8Array, accountName: keyof typeof REWARD_ACCOUNT_LAYOUTS) {
  const bytes = REWARD_ACCOUNT_LAYOUTS[accountName].discriminatorHex.match(/.{1,2}/g) ?? [];
  data.set(bytes.map((byte) => Number.parseInt(byte, 16)), 0);
}

function writePubkey(data: Uint8Array, offset: number, publicKey: PublicKey) {
  data.set(publicKey.toBytes(), offset);
}

function view(data: Uint8Array) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}
