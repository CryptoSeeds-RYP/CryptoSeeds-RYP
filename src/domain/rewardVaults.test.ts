import { describe, expect, it } from "vitest";
import {
  buildRewardEpochDraft,
  buildRewardEpochExport,
  requiredRewardVaultRoles,
  stringifyRewardEpochExport,
  type RewardVaultConfig,
} from "./rewardVaults";

const RYP = 1_000_000n;
const rewardMint = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";

function vaults(overrides: Partial<RewardVaultConfig>[] = []): RewardVaultConfig[] {
  const baseVaults: RewardVaultConfig[] = requiredRewardVaultRoles.map((role) => ({
    id: role.toLowerCase(),
    label: role.replace(/_/g, " "),
    role,
    rewardMint,
    address: `${role}111111111111111111111111111111111`,
    custodyModel: role === "INDEPENDENT_TREASURY" ? "TREASURY_CONTROLLED" : "PROGRAM_CONTROLLED",
    status: "VERIFIED",
    receivesUserFunds: false,
    notes: "Draft test vault.",
  }));

  return baseVaults.map((vault, index) => ({
    ...vault,
    ...(overrides[index] ?? {}),
  }));
}

describe("reward vault epoch drafts", () => {
  it("builds a review-gated epoch draft from holder reward inputs", () => {
    const draft = buildRewardEpochDraft({
      id: "reward-epoch-001",
      label: "Weekly holder rewards",
      createdAt: "2026-06-07T00:00:00.000Z",
      vaults: vaults(),
      holderEpochInput: {
        id: "holder-epoch-001",
        rewardMint,
        rewardPoolBaseUnits: 1_000_000n,
        snapshotTakenAt: "2026-06-07T00:00:00.000Z",
        estimatedDeliveryCostPerPayoutBaseUnits: 10_000n,
        minimumNetPayoutBaseUnits: 20_000n,
        entries: [
          { walletAddress: "canopy-holder", rypBalanceBaseUnits: 100_000n * RYP },
          { walletAddress: "sprout-holder", rypBalanceBaseUnits: 20_000n * RYP },
        ],
      },
    });

    expect(draft.status).toBe("REVIEW_REQUIRED");
    expect(draft.executionBlocked).toBe(true);
    expect(draft.validation.valid).toBe(true);
    expect(draft.holderEpoch.distributedNetBaseUnits + draft.holderEpoch.reservedDeliveryCostBaseUnits).toBe(1_000_000n);
  });

  it("blocks drafts with missing required vault roles", () => {
    const draft = buildRewardEpochDraft({
      id: "reward-epoch-002",
      label: "Bad reward epoch",
      createdAt: "2026-06-07T00:00:00.000Z",
      vaults: vaults().filter((vault) => vault.role !== "ROLLOVER"),
      holderEpochInput: {
        id: "holder-epoch-002",
        rewardMint,
        rewardPoolBaseUnits: 100_000n,
        snapshotTakenAt: "2026-06-07T00:00:00.000Z",
        estimatedDeliveryCostPerPayoutBaseUnits: 1_000n,
        minimumNetPayoutBaseUnits: 2_000n,
        entries: [{ walletAddress: "holder", rypBalanceBaseUnits: 20_000n * RYP }],
      },
    });

    expect(draft.status).toBe("BLOCKED");
    expect(draft.validation.valid).toBe(false);
    expect(draft.validation.blockers.join(" ")).toContain("ROLLOVER");
  });

  it("blocks duplicate vault addresses", () => {
    const duplicateAddress = "DuplicateVault11111111111111111111111111111";
    const draft = buildRewardEpochDraft({
      id: "reward-epoch-003",
      label: "Duplicate vault epoch",
      createdAt: "2026-06-07T00:00:00.000Z",
      vaults: vaults([
        { address: duplicateAddress },
        { address: duplicateAddress },
      ]),
      holderEpochInput: {
        id: "holder-epoch-003",
        rewardMint,
        rewardPoolBaseUnits: 100_000n,
        snapshotTakenAt: "2026-06-07T00:00:00.000Z",
        estimatedDeliveryCostPerPayoutBaseUnits: 1_000n,
        minimumNetPayoutBaseUnits: 2_000n,
        entries: [{ walletAddress: "holder", rypBalanceBaseUnits: 20_000n * RYP }],
      },
    });

    expect(draft.status).toBe("BLOCKED");
    expect(draft.validation.blockers.join(" ")).toContain("reuses a vault address");
  });

  it("warns when vaults are still pending verification", () => {
    const draft = buildRewardEpochDraft({
      id: "reward-epoch-verify",
      label: "Pending verification epoch",
      createdAt: "2026-06-07T00:00:00.000Z",
      vaults: vaults([{ status: "PENDING_VERIFICATION" }]),
      holderEpochInput: {
        id: "holder-epoch-verify",
        rewardMint,
        rewardPoolBaseUnits: 100_000n,
        snapshotTakenAt: "2026-06-07T00:00:00.000Z",
        estimatedDeliveryCostPerPayoutBaseUnits: 1_000n,
        minimumNetPayoutBaseUnits: 2_000n,
        entries: [{ walletAddress: "holder", rypBalanceBaseUnits: 20_000n * RYP }],
      },
    });

    expect(draft.status).toBe("REVIEW_REQUIRED");
    expect(draft.validation.valid).toBe(true);
    expect(draft.validation.warnings.join(" ")).toContain("not verified yet");
  });

  it("blocks zero reward pools before review", () => {
    const draft = buildRewardEpochDraft({
      id: "reward-epoch-zero",
      label: "Zero reward epoch",
      createdAt: "2026-06-07T00:00:00.000Z",
      vaults: vaults(),
      holderEpochInput: {
        id: "holder-epoch-zero",
        rewardMint,
        rewardPoolBaseUnits: 0n,
        snapshotTakenAt: "2026-06-07T00:00:00.000Z",
        estimatedDeliveryCostPerPayoutBaseUnits: 1_000n,
        minimumNetPayoutBaseUnits: 2_000n,
        entries: [{ walletAddress: "holder", rypBalanceBaseUnits: 20_000n * RYP }],
      },
    });

    expect(draft.status).toBe("BLOCKED");
    expect(draft.validation.blockers.join(" ")).toContain("reward pool must be greater than zero");
  });

  it("serializes bigint accounting into reviewable JSON strings", () => {
    const draft = buildRewardEpochDraft({
      id: "reward-epoch-004",
      label: "Exportable reward epoch",
      createdAt: "2026-06-07T00:00:00.000Z",
      vaults: vaults(),
      holderEpochInput: {
        id: "holder-epoch-004",
        rewardMint,
        rewardPoolBaseUnits: 100_000n,
        snapshotTakenAt: "2026-06-07T00:00:00.000Z",
        estimatedDeliveryCostPerPayoutBaseUnits: 1_000n,
        minimumNetPayoutBaseUnits: 2_000n,
        entries: [{ walletAddress: "holder", rypBalanceBaseUnits: 20_000n * RYP }],
      },
    });

    const exportPayload = buildRewardEpochExport(draft);
    const json = stringifyRewardEpochExport(draft);

    expect(exportPayload.holderEpoch.rewardPoolBaseUnits).toBe("100000");
    expect(json).toContain("\"executionBlocked\": true");
    expect(json).toContain("\"rewardPoolBaseUnits\": \"100000\"");
  });
});
