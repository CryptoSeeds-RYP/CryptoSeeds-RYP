import { describe, expect, it } from "vitest";
import {
  buildHolderRewardEpoch,
  epochAccountingIsBalanced,
  holderRewardTierForBalance,
  holderRewardTierRules,
} from "./holderRewards";

const RYP = 1_000_000n;

describe("holder rewards", () => {
  it("deducts delivery costs from holder allocations instead of platform funds", () => {
    const epoch = buildHolderRewardEpoch({
      id: "epoch-001",
      rewardMint: "RYP",
      rewardPoolBaseUnits: 1_000_000n,
      snapshotTakenAt: "2026-06-07T00:00:00.000Z",
      estimatedDeliveryCostPerPayoutBaseUnits: 10_000n,
      minimumNetPayoutBaseUnits: 20_000n,
      entries: [
        { walletAddress: "canopy-holder", rypBalanceBaseUnits: 100_000n * RYP },
        { walletAddress: "sprout-holder", rypBalanceBaseUnits: 20_000n * RYP },
      ],
    });

    expect(epochAccountingIsBalanced(epoch)).toBe(true);
    expect(epoch.payouts.map((payout) => payout.status)).toEqual(["PAY_NOW", "PAY_NOW"]);
    expect(epoch.reservedDeliveryCostBaseUnits).toBe(20_000n);
    expect(epoch.distributedNetBaseUnits + epoch.reservedDeliveryCostBaseUnits).toBe(1_000_000n);
  });

  it("rolls small holders into less frequent scheduled batches", () => {
    const epoch = buildHolderRewardEpoch({
      id: "epoch-002",
      rewardMint: "RYP",
      rewardPoolBaseUnits: 900_000n,
      snapshotTakenAt: "2026-06-07T00:00:00.000Z",
      scheduledCadences: ["WEEKLY"],
      estimatedDeliveryCostPerPayoutBaseUnits: 10_000n,
      minimumNetPayoutBaseUnits: 20_000n,
      entries: [
        { walletAddress: "sprout-holder", rypBalanceBaseUnits: 20_000n * RYP },
        { walletAddress: "seed-holder", rypBalanceBaseUnits: 5_000n * RYP },
        { walletAddress: "small-holder", rypBalanceBaseUnits: 500n * RYP },
      ],
    });

    expect(epochAccountingIsBalanced(epoch)).toBe(true);
    expect(epoch.payouts[0]?.status).toBe("PAY_NOW");
    expect(epoch.payouts[1]?.holderTier).toBe("SEED");
    expect(epoch.payouts[1]?.payoutCadence).toBe("MONTHLY");
    expect(epoch.payouts[1]?.status).toBe("ROLL_FORWARD");
    expect(epoch.payouts[2]?.holderTier).toBe("SMALL");
    expect(epoch.payouts[2]?.payoutCadence).toBe("QUARTERLY");
    expect(epoch.payouts[2]?.status).toBe("ROLL_FORWARD");
  });

  it("allows monthly payout runs to include seed-size holders", () => {
    const epoch = buildHolderRewardEpoch({
      id: "epoch-003",
      rewardMint: "RYP",
      rewardPoolBaseUnits: 500_000n,
      snapshotTakenAt: "2026-06-30T00:00:00.000Z",
      scheduledCadences: ["WEEKLY", "MONTHLY"],
      estimatedDeliveryCostPerPayoutBaseUnits: 10_000n,
      minimumNetPayoutBaseUnits: 20_000n,
      entries: [{ walletAddress: "seed-holder", rypBalanceBaseUnits: 5_000n * RYP }],
    });

    expect(epochAccountingIsBalanced(epoch)).toBe(true);
    expect(epoch.payouts[0]?.status).toBe("PAY_NOW");
    expect(epoch.payouts[0]?.netPayoutBaseUnits).toBe(490_000n);
  });

  it("rolls allocations forward when delivery costs would consume the payout", () => {
    const epoch = buildHolderRewardEpoch({
      id: "epoch-004",
      rewardMint: "RYP",
      rewardPoolBaseUnits: 25_000n,
      snapshotTakenAt: "2026-06-07T00:00:00.000Z",
      estimatedDeliveryCostPerPayoutBaseUnits: 30_000n,
      minimumNetPayoutBaseUnits: 20_000n,
      entries: [{ walletAddress: "sprout-holder", rypBalanceBaseUnits: 20_000n * RYP }],
    });

    expect(epochAccountingIsBalanced(epoch)).toBe(true);
    expect(epoch.payouts[0]?.status).toBe("ROLL_FORWARD");
    expect(epoch.payouts[0]?.rolledForwardBaseUnits).toBe(25_000n);
    expect(epoch.reservedDeliveryCostBaseUnits).toBe(0n);
  });

  it("keeps treasury and system wallets excludable from holder rewards", () => {
    const epoch = buildHolderRewardEpoch({
      id: "epoch-005",
      rewardMint: "RYP",
      rewardPoolBaseUnits: 100_000n,
      snapshotTakenAt: "2026-06-07T00:00:00.000Z",
      estimatedDeliveryCostPerPayoutBaseUnits: 1_000n,
      minimumNetPayoutBaseUnits: 2_000n,
      entries: [
        { walletAddress: "holder", rypBalanceBaseUnits: 20_000n * RYP },
        {
          walletAddress: "treasury",
          rypBalanceBaseUnits: 100_000n * RYP,
          excluded: true,
          exclusionReason: "Treasury wallet.",
        },
      ],
    });

    expect(epochAccountingIsBalanced(epoch)).toBe(true);
    expect(epoch.payouts[0]?.status).toBe("PAY_NOW");
    expect(epoch.payouts[1]?.status).toBe("EXCLUDED");
  });

  it("keeps holder tier rules ordered from largest to smallest", () => {
    expect(holderRewardTierRules.map((rule) => rule.tier)).toEqual([
      "CANOPY",
      "SPROUT",
      "SEED",
      "SMALL",
      "MICRO",
    ]);
    expect(holderRewardTierForBalance(100_000n * RYP).tier).toBe("CANOPY");
    expect(holderRewardTierForBalance(20_000n * RYP).tier).toBe("SPROUT");
    expect(holderRewardTierForBalance(5_000n * RYP).tier).toBe("SEED");
    expect(holderRewardTierForBalance(500n * RYP).tier).toBe("SMALL");
    expect(holderRewardTierForBalance(1n).tier).toBe("MICRO");
  });
});
