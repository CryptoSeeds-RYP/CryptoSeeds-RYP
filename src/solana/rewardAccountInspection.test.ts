import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  buildRewardAccountInspectionPreview,
  buildSeedBotPermissionInspectionPreview,
  decodeRewardConfigAccount,
  decodeRewardEpochAccount,
  decodeRewardVaultStateAccount,
  decodeSeedBotPermissionAccount,
  deriveSeedBotPermissionInspectionAddress,
  deriveRewardAccountAddresses,
  REWARD_ACCOUNT_LAYOUTS,
  validateRewardAccountInspection,
  validateSeedBotPermissionInspection,
  type RewardAccountInspection,
  type SeedBotPermissionInspection,
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

  it("derives and previews read-only SeedBot permission inspection", () => {
    const owner = Keypair.generate().publicKey.toBase58();
    const addresses = deriveSeedBotPermissionInspectionAddress({
      ownerAddress: owner,
      programIdAddress: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
    });
    const inspection = buildSeedBotPermissionInspectionPreview({
      ownerAddress: owner,
      programIdAddress: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
    });

    expect(addresses.permissionAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(inspection.executionMode).toBe("READ_ONLY");
    expect(inspection.lifecycleStatus).toBe("PREVIEW_ONLY");
    expect(inspection.warnings.join(" ")).toContain("No SeedBot trade signing");
  });

  it("decodes RewardConfig account bytes", () => {
    const authority = Keypair.generate().publicKey;
    const protocolConfig = Keypair.generate().publicKey;
    const rypMint = Keypair.generate().publicKey;
    const pendingAuthority = Keypair.generate().publicKey;
    const data = new Uint8Array(REWARD_ACCOUNT_LAYOUTS.RewardConfig.minimumLength);

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
    view(data).setBigUint64(128, 30_000n, true);
    data[136] = 0;
    data[137] = 1;
    data[138] = 255;
    writePubkey(data, 139, pendingAuthority);

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
      totalRoutedFeeAmount: "30000",
      paused: false,
      draftOnly: true,
      bump: 255,
      pendingAuthority: pendingAuthority.toBase58(),
    });
  });

  it("decodes RewardVaultState account bytes", () => {
    const rewardConfig = Keypair.generate().publicKey;
    const rewardMint = Keypair.generate().publicKey;
    const vaultAddress = Keypair.generate().publicKey;
    const data = new Uint8Array(149);

    writeDiscriminator(data, "RewardVaultState");
    writePubkey(data, 8, rewardConfig);
    data[40] = 2;
    writePubkey(data, 41, rewardMint);
    writePubkey(data, 73, vaultAddress);
    data[105] = 1;
    data[106] = 2;
    data.fill(7, 107, 139);
    view(data).setBigUint64(139, 9_999n, true);
    data[147] = 0;
    data[148] = 254;

    expect(decodeRewardVaultStateAccount(data)).toMatchObject({
      custodyModel: "TREASURY_CONTROLLED",
      metadataHash: "07".repeat(32),
      totalFundedAmount: "9999",
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
    const data = new Uint8Array(REWARD_ACCOUNT_LAYOUTS.RewardEpoch.minimumLength);
    const offset = Object.fromEntries(
      REWARD_ACCOUNT_LAYOUTS.RewardEpoch.fields.map((field) => [field.name, field.offset]),
    ) as Record<string, number>;

    writeDiscriminator(data, "RewardEpoch");
    writePubkey(data, offset.reward_config, rewardConfig);
    view(data).setBigUint64(offset.epoch_id, 3n, true);
    view(data).setBigInt64(offset.snapshot_taken_at, 1_800_000_000n, true);
    view(data).setBigInt64(offset.created_at, 1_800_000_010n, true);
    writePubkey(data, offset.reward_mint, rewardMint);
    view(data).setBigUint64(offset.reward_pool_amount, 1_000n, true);
    view(data).setBigUint64(offset.distributed_net_amount, 700n, true);
    view(data).setBigUint64(offset.reserved_delivery_cost_amount, 100n, true);
    view(data).setBigUint64(offset.rolled_forward_amount, 200n, true);
    view(data).setBigUint64(offset.recorded_gross_allocation_amount, 900n, true);
    view(data).setBigUint64(offset.recorded_net_claim_amount, 700n, true);
    view(data).setBigUint64(offset.claimed_net_amount, 700n, true);
    data.fill(9, offset.exclusion_list_hash, offset.exclusion_list_hash + 32);
    data.fill(8, offset.claim_merkle_root, offset.claim_merkle_root + 32);
    data[offset.status] = 0;
    data[offset.execution_blocked] = 1;
    data[offset.bump] = 253;

    expect(decodeRewardEpochAccount(data)).toMatchObject({
      createdAt: "1800000010",
      distributedNetAmount: "700",
      epochId: "3",
      executionBlocked: true,
      exclusionListHash: "09".repeat(32),
      claimMerkleRoot: "08".repeat(32),
      claimedNetAmount: "700",
      recordedGrossAllocationAmount: "900",
      recordedNetClaimAmount: "700",
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

  it("decodes SeedBotPermission account bytes", () => {
    const owner = Keypair.generate().publicKey;
    const position = Keypair.generate().publicKey;
    const data = new Uint8Array(REWARD_ACCOUNT_LAYOUTS.SeedBotPermission.minimumLength);
    const offset = Object.fromEntries(
      REWARD_ACCOUNT_LAYOUTS.SeedBotPermission.fields.map((field) => [field.name, field.offset]),
    ) as Record<string, number>;

    writeDiscriminator(data, "SeedBotPermission");
    writePubkey(data, offset.owner, owner);
    writePubkey(data, offset.position, position);
    data.fill(7, offset.permission_hash, offset.permission_hash + 32);
    view(data).setBigInt64(offset.created_at, 1_800_000_000n, true);
    view(data).setBigInt64(offset.expires_at, 1_800_086_400n, true);
    view(data).setBigUint64(offset.max_trade_amount, 500n, true);
    view(data).setBigUint64(offset.max_daily_volume_amount, 1_500n, true);
    view(data).setUint16(offset.max_daily_trades, 3, true);
    view(data).setUint16(offset.max_slippage_bps, 100, true);
    data[offset.tier_at_creation] = 1;
    view(data).setBigUint64(offset.staked_amount_at_creation, 5_000_000_000n, true);
    view(data).setBigInt64(offset.staking_start_ts_at_creation, 1_799_999_000n, true);
    data[offset.revoked] = 0;
    data[offset.bump] = 252;
    view(data).setBigInt64(offset.usage_day_start_ts, 1_800_000_100n, true);
    view(data).setBigUint64(offset.daily_volume_used_amount, 700n, true);
    view(data).setUint16(offset.daily_trades_used, 2, true);
    view(data).setBigUint64(offset.total_volume_used_amount, 1_700n, true);
    view(data).setBigUint64(offset.total_trades_used, 4n, true);
    view(data).setBigInt64(offset.last_execution_ts, 1_800_000_300n, true);

    expect(decodeSeedBotPermissionAccount(data)).toEqual({
      owner: owner.toBase58(),
      position: position.toBase58(),
      permissionHash: "07".repeat(32),
      createdAt: "1800000000",
      expiresAt: "1800086400",
      maxTradeAmount: "500",
      maxDailyVolumeAmount: "1500",
      maxDailyTrades: 3,
      maxSlippageBps: 100,
      tierAtCreation: "SEED",
      stakedAmountAtCreation: "5000000000",
      stakingStartTsAtCreation: "1799999000",
      revoked: false,
      bump: 252,
      usageDayStartTs: "1800000100",
      dailyVolumeUsedAmount: "700",
      dailyTradesUsed: 2,
      totalVolumeUsedAmount: "1700",
      totalTradesUsed: "4",
      lastExecutionTs: "1800000300",
    });
  });

  it("rejects reward accounts with the wrong Anchor discriminator", () => {
    const data = new Uint8Array(REWARD_ACCOUNT_LAYOUTS.RewardConfig.minimumLength);

    expect(() => decodeRewardConfigAccount(data)).toThrow("RewardConfig discriminator mismatch");
  });

  it("validates decoded admin reward inspections", () => {
    const inspection = buildDecodedInspection();

    expect(validateRewardAccountInspection(inspection).blockers).toEqual([]);
  });

  it("allows reviewed read-only reward inspections when claim totals are bounded", () => {
    const inspection = buildDecodedInspection({
      epoch: {
        status: "REVIEWED",
        executionBlocked: false,
        recordedGrossAllocationAmount: "900",
        recordedNetClaimAmount: "700",
        claimedNetAmount: "700",
      },
    });

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
    expect(blockers).toContain("drafted/blocked or reviewed/read-only");
    expect(blockers).toContain("accounting does not balance");
  });

  it("blocks reviewed reward inspections when claim totals exceed reviewed bounds", () => {
    const inspection = buildDecodedInspection({
      epoch: {
        status: "REVIEWED",
        executionBlocked: false,
        claimedNetAmount: "701",
        recordedNetClaimAmount: "700",
      },
    });

    expect(validateRewardAccountInspection(inspection).blockers).toContain(
      "Reward epoch must be drafted/blocked or reviewed/read-only with bounded claim totals.",
    );
  });

  it("validates SeedBot permission lifecycle states", () => {
    const active = buildDecodedSeedBotPermissionInspection();

    expect(validateSeedBotPermissionInspection(active, { nowUnix: 1_800_000_001n })).toMatchObject({
      blockers: [],
      lifecycleStatus: "ACTIVE",
    });

    const revoked = validateSeedBotPermissionInspection(
      buildDecodedSeedBotPermissionInspection({ decoded: { revoked: true } }),
      { nowUnix: 1_800_000_001n },
    );
    expect(revoked.lifecycleStatus).toBe("REVOKED");
    expect(revoked.warnings.join(" ")).toContain("revoked");

    const expired = validateSeedBotPermissionInspection(
      buildDecodedSeedBotPermissionInspection({ decoded: { expiresAt: "1800000000" } }),
      { nowUnix: 1_800_000_001n },
    );
    expect(expired.lifecycleStatus).toBe("EXPIRED");
    expect(expired.warnings.join(" ")).toContain("expired");
  });

  it("blocks unsafe SeedBot permission inspections", () => {
    const inspection = buildDecodedSeedBotPermissionInspection({
      decoded: {
        maxDailyTrades: 0,
        maxDailyVolumeAmount: "499",
        maxSlippageBps: 501,
        permissionHash: "00".repeat(32),
        stakedAmountAtCreation: "0",
        tierAtCreation: "NONE",
        dailyVolumeUsedAmount: "2000",
        dailyTradesUsed: 4,
        totalVolumeUsedAmount: "100",
        totalTradesUsed: "1",
      },
    });

    const blockers = validateSeedBotPermissionInspection(inspection, { nowUnix: 1_800_000_001n }).blockers.join(" ");

    expect(blockers).toContain("hash must not be blank");
    expect(blockers).toContain("active staking tier");
    expect(blockers).toContain("stake snapshot");
    expect(blockers).toContain("daily volume");
    expect(blockers).toContain("daily trades");
    expect(blockers).toContain("slippage");
    expect(blockers).toContain("daily usage exceeds");
    expect(blockers).toContain("total usage");
    expect(blockers).toContain("total trade count");
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
      totalRoutedFeeAmount: "30000",
      paused: false,
      draftOnly: true,
      bump: 255,
      pendingAuthority: PublicKey.default.toBase58(),
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
      recordedGrossAllocationAmount: "900",
      recordedNetClaimAmount: "700",
      claimedNetAmount: "700",
      exclusionListHash: "09".repeat(32),
      claimMerkleRoot: "08".repeat(32),
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
        totalFundedAmount: "0",
        receivesUserFunds: false,
        bump: 253,
        ...overrides.vault,
      },
    })),
  };
}

function buildDecodedSeedBotPermissionInspection(
  overrides: {
    decoded?: Partial<NonNullable<SeedBotPermissionInspection["decoded"]>>;
  } = {},
): SeedBotPermissionInspection {
  const owner = Keypair.generate().publicKey.toBase58();
  const preview = buildSeedBotPermissionInspectionPreview({ ownerAddress: owner });

  return {
    ...preview,
    decoded: {
      owner,
      position: Keypair.generate().publicKey.toBase58(),
      permissionHash: "07".repeat(32),
      createdAt: "1800000000",
      expiresAt: "1800086400",
      maxTradeAmount: "500",
      maxDailyVolumeAmount: "1500",
      maxDailyTrades: 3,
      maxSlippageBps: 100,
      tierAtCreation: "SEED",
      stakedAmountAtCreation: "5000000000",
      stakingStartTsAtCreation: "1799999000",
      revoked: false,
      bump: 252,
      usageDayStartTs: "1800000100",
      dailyVolumeUsedAmount: "700",
      dailyTradesUsed: 2,
      totalVolumeUsedAmount: "1700",
      totalTradesUsed: "4",
      lastExecutionTs: "1800000300",
      ...overrides.decoded,
    },
    lifecycleStatus: "ACTIVE",
    message: "Account decoded from selected cluster.",
    status: "DECODED",
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
