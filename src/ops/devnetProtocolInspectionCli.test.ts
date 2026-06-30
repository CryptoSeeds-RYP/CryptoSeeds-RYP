import { Keypair, PublicKey } from "@solana/web3.js";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import protocolAccountLayouts from "../solana/protocolAccountLayouts.json";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "inspect-devnet-protocol-state.mjs");
const inspectionCli = await import(pathToFileURL(scriptPath).href);

const buildProtocolTargets = inspectionCli.buildProtocolTargets as (input: {
  config: DevnetInspectionConfig;
  rewardVaultKeypairs?: Record<string, { address: string | null }>;
}) => ProtocolTargets | null;
const buildDevnetProtocolInspectionReport = inspectionCli.buildDevnetProtocolInspectionReport as (input: {
  accounts: MockAccounts | null;
  config: DevnetInspectionConfig;
  envSource: string;
  generatedAt?: string;
  targets: ProtocolTargets | null;
}) => DevnetProtocolInspectionReport;

const upgradeableLoader = "BPFLoaderUpgradeab1e11111111111111111111111";
const defaultPublicKey = PublicKey.default.toBase58();

type DevnetInspectionConfig = {
  adminAuthorityAddress: string;
  broadcastEnabled: boolean;
  cluster: string;
  demoMode: boolean;
  deployment: string;
  independentTreasuryAddress: string;
  programId: string;
  rpcUrl: string;
  rypMintAddress: string;
  treasuryAddress: string;
};

type ProtocolTargets = {
  config: string;
  rewardConfig: string;
  rypVault: string;
  rewardVaultRoles: Array<{
    custodyModel: number;
    key: string;
    label: string;
    metadataHashHex: string | null;
    rewardVaultAddress: string | null;
    rewardVaultStateAddress: string;
    variant: number;
  }>;
};

type MockAccount = {
  data?: Uint8Array;
  dataLength?: number;
  executable?: boolean;
  exists: boolean;
  lamports?: number;
  owner?: string;
};

type MockAccounts = {
  program: MockAccount;
  protocolConfig: MockAccount;
  rewardConfig: MockAccount;
  rewardVaultStates: Record<string, MockAccount>;
};

type DevnetProtocolInspectionReport = {
  status: "READY_FOR_READ_ONLY_PROTOCOL_REVIEW" | "BLOCKED";
  blockers: string[];
  warnings: string[];
  protocolConfig?: { status: string };
  rewardConfig?: { status: string };
  rewardVaults: Array<{ label: string; status: string; blockers: string[] }>;
};

describe("devnet protocol inspection CLI", () => {
  it("marks decoded initialized protocol state ready for read-only review", () => {
    const fixture = readyFixture();
    const report = buildDevnetProtocolInspectionReport({
      accounts: fixture.accounts,
      config: fixture.config,
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      targets: fixture.targets,
    });

    expect(report.status).toBe("READY_FOR_READ_ONLY_PROTOCOL_REVIEW");
    expect(report.blockers).toEqual([]);
    expect(report.protocolConfig?.status).toBe("DECODED");
    expect(report.rewardConfig?.status).toBe("DECODED");
    expect(report.rewardVaults.every((vault) => vault.status === "DECODED")).toBe(true);
  });

  it("blocks unsafe reward vault state before read-only public preview", () => {
    const fixture = readyFixture();
    const holderVault = fixture.accounts.rewardVaultStates.holder.data;
    if (!holderVault) throw new Error("holder vault fixture missing");
    const holderOffsets = offsets("RewardVaultState");
    holderVault[holderOffsets.verification_status] = 1;
    holderVault[holderOffsets.receives_user_funds] = 1;

    const report = buildDevnetProtocolInspectionReport({
      accounts: fixture.accounts,
      config: fixture.config,
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      targets: fixture.targets,
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers.join(" ")).toContain("HolderReward vault is not verified");
    expect(report.blockers.join(" ")).toContain("HolderReward vault must not be marked as receiving user funds");
  });

  it("blocks missing devnet program and state accounts", () => {
    const fixture = readyFixture();
    const report = buildDevnetProtocolInspectionReport({
      accounts: {
        program: { exists: false },
        protocolConfig: { exists: false },
        rewardConfig: { exists: false },
        rewardVaultStates: Object.fromEntries(
          fixture.targets.rewardVaultRoles.map((role) => [role.key, { exists: false }]),
        ),
      },
      config: fixture.config,
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      targets: fixture.targets,
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers).toContain("Devnet program account is missing.");
    expect(report.blockers).toContain("ProtocolConfig account is missing.");
    expect(report.blockers).toContain("RewardConfig account is missing.");
  });

  it("blocks admin authority reuse as the independent treasury owner", () => {
    const fixture = readyFixture();
    const report = buildDevnetProtocolInspectionReport({
      accounts: fixture.accounts,
      config: {
        ...fixture.config,
        independentTreasuryAddress: fixture.config.adminAuthorityAddress,
        treasuryAddress: fixture.config.adminAuthorityAddress,
      },
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      targets: fixture.targets,
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers).toContain("Independent treasury address must be distinct from the admin authority wallet.");
  });
});

function readyFixture() {
  const programId = Keypair.generate().publicKey.toBase58();
  const adminAuthorityAddress = Keypair.generate().publicKey.toBase58();
  const independentTreasuryAddress = Keypair.generate().publicKey.toBase58();
  const rypMintAddress = Keypair.generate().publicKey.toBase58();
  const config: DevnetInspectionConfig = {
    adminAuthorityAddress,
    broadcastEnabled: false,
    cluster: "devnet",
    demoMode: false,
    deployment: "devnet",
    independentTreasuryAddress,
    programId,
    rpcUrl: "https://api.devnet.solana.com",
    rypMintAddress,
    treasuryAddress: independentTreasuryAddress,
  };
  const rewardVaultKeypairs = {
    delivery: { address: Keypair.generate().publicKey.toBase58() },
    holder: { address: Keypair.generate().publicKey.toBase58() },
    rollover: { address: Keypair.generate().publicKey.toBase58() },
    staker: { address: Keypair.generate().publicKey.toBase58() },
  };
  const targets = buildProtocolTargets({ config, rewardVaultKeypairs });
  if (!targets) throw new Error("targets did not derive");

  const accounts: MockAccounts = {
    program: {
      dataLength: 1_005_368,
      executable: true,
      exists: true,
      lamports: 1,
      owner: upgradeableLoader,
    },
    protocolConfig: account(protocolConfigData({ config, targets }), programId),
    rewardConfig: account(rewardConfigData({ config, targets }), programId),
    rewardVaultStates: Object.fromEntries(
      targets.rewardVaultRoles.map((role) => [
        role.key,
        account(rewardVaultStateData({ config, role, targets }), programId),
      ]),
    ),
  };

  return { accounts, config, targets };
}

function account(data: Uint8Array, owner: string): MockAccount {
  return {
    data,
    exists: true,
    lamports: 1,
    owner,
  };
}

function protocolConfigData({ config, targets }: { config: DevnetInspectionConfig; targets: ProtocolTargets }) {
  const data = baseAccountData("ProtocolConfig");
  const offset = offsets("ProtocolConfig");
  writePubkey(data, offset.authority, config.adminAuthorityAddress);
  writePubkey(data, offset.ryp_mint, config.rypMintAddress);
  writePubkey(data, offset.ryp_vault, targets.rypVault);
  view(data).setUint16(offset.base_fee_bps, 350, true);
  [5_000_000_000n, 20_000_000_000n, 50_000_000_000n, 100_000_000_000n, 150_000_000_000n].forEach(
    (value, index) => view(data).setBigUint64(offset.tier_thresholds + index * 8, value, true),
  );
  [0, 35, 70, 105, 140].forEach((value, index) =>
    view(data).setUint16(offset.tier_fee_reduction_bps + index * 2, value, true),
  );
  view(data).setBigUint64(offset.total_staked, 0n, true);
  data[offset.paused] = 0;
  view(data).setUint16(offset.module_pause_flags, 0, true);
  data[offset.bump] = 255;
  writePubkey(data, offset.pending_authority, defaultPublicKey);
  writePubkey(data, offset.project_authority, config.adminAuthorityAddress);
  writePubkey(data, offset.pending_project_authority, defaultPublicKey);
  return data;
}

function rewardConfigData({ config, targets }: { config: DevnetInspectionConfig; targets: ProtocolTargets }) {
  const data = baseAccountData("RewardConfig");
  const offset = offsets("RewardConfig");
  writePubkey(data, offset.authority, config.adminAuthorityAddress);
  writePubkey(data, offset.protocol_config, targets.config);
  writePubkey(data, offset.ryp_mint, config.rypMintAddress);
  view(data).setBigInt64(offset.epoch_cadence_seconds, 604_800n, true);
  view(data).setUint16(offset.holder_split_bps, 3_334, true);
  view(data).setUint16(offset.staker_split_bps, 3_333, true);
  view(data).setUint16(offset.treasury_split_bps, 3_333, true);
  data[offset.registered_vault_roles_mask] = 31;
  data[offset.verified_vault_roles_mask] = 31;
  view(data).setBigUint64(offset.total_epoch_drafts, 0n, true);
  view(data).setBigUint64(offset.total_routed_fee_amount, 0n, true);
  data[offset.paused] = 0;
  data[offset.draft_only] = 1;
  data[offset.bump] = 254;
  writePubkey(data, offset.pending_authority, defaultPublicKey);
  return data;
}

function rewardVaultStateData({
  config,
  role,
  targets,
}: {
  config: DevnetInspectionConfig;
  role: ProtocolTargets["rewardVaultRoles"][number];
  targets: ProtocolTargets;
}) {
  const data = baseAccountData("RewardVaultState");
  const offset = offsets("RewardVaultState");
  if (!role.rewardVaultAddress || !role.metadataHashHex) throw new Error("role target incomplete");
  writePubkey(data, offset.reward_config, targets.rewardConfig);
  data[offset.role] = role.variant;
  writePubkey(data, offset.reward_mint, config.rypMintAddress);
  writePubkey(data, offset.vault_address, role.rewardVaultAddress);
  data[offset.custody_model] = role.custodyModel;
  data[offset.verification_status] = 2;
  writeHex(data, offset.metadata_hash, role.metadataHashHex);
  view(data).setBigUint64(offset.total_funded_amount, 0n, true);
  data[offset.receives_user_funds] = 0;
  data[offset.bump] = 253;
  return data;
}

function baseAccountData(layoutName: keyof typeof protocolAccountLayouts) {
  const layout = protocolAccountLayouts[layoutName];
  const data = new Uint8Array(layout.minimumLength);
  writeHex(data, 0, layout.discriminatorHex);
  return data;
}

function offsets(layoutName: keyof typeof protocolAccountLayouts) {
  return Object.fromEntries(
    protocolAccountLayouts[layoutName].fields.map((field) => [field.name, field.offset]),
  ) as Record<string, number>;
}

function writePubkey(data: Uint8Array, offset: number, publicKey: string) {
  data.set(new PublicKey(publicKey).toBytes(), offset);
}

function writeHex(data: Uint8Array, offset: number, hex: string) {
  const bytes = hex.match(/.{1,2}/g) ?? [];
  data.set(bytes.map((byte) => Number.parseInt(byte, 16)), offset);
}

function view(data: Uint8Array) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}
