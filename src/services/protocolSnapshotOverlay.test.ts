import { describe, expect, it } from "vitest";
import { createProtocolServices } from "./mockServices";
import {
  applyStakePositionInspectionToSnapshot,
  baseUnitsToUiAmount,
  normalizeStakeTier,
} from "./protocolSnapshotOverlay";
import type { StakePositionInspection } from "../solana/protocolStateInspection";

const walletAddress = "11111111111111111111111111111111";

describe("protocol snapshot overlay", () => {
  it("applies clean decoded stake positions to real wallet snapshots", async () => {
    const services = createProtocolServices({
      tokenBalances: {
        async getRypBalance() {
          return 25_000;
        },
      },
    });
    const snapshot = await services.loadProtocolSnapshot(walletAddress, "FRUIT");
    const overlaid = applyStakePositionInspectionToSnapshot({
      inspection: decodedStakeInspection({ tier: "SPROUT", stakedAmount: "20000000000" }),
      nowMs: Date.parse("2027-02-01T00:00:00.000Z"),
      rypDecimals: 6,
      snapshot,
    });

    expect(overlaid.source).toBe("LIVE_PROTOCOL_ACCOUNT");
    expect(overlaid.user.stakingTier).toBe("SPROUT");
    expect(overlaid.user.stakedAmount).toBe(20_000);
    expect(overlaid.user.goldenKeyNft).toBe(true);
    expect(overlaid.user.votingRightsNft).toBe(true);
    expect(overlaid.user.stakingDays).toBeGreaterThan(0);
    expect(overlaid.farm.governanceActive).toBe(true);
    expect(overlaid.farm.harvestAvailable).toBe(true);
    expect(overlaid.farm.projectSlotsUnlocked).toBe(3);
  });

  it("keeps conservative live wallet state when inspection is missing or blocked", async () => {
    const services = createProtocolServices({
      tokenBalances: {
        async getRypBalance() {
          return 25_000;
        },
      },
    });
    const snapshot = await services.loadProtocolSnapshot(walletAddress, "FRUIT");
    const overlaid = applyStakePositionInspectionToSnapshot({
      inspection: {
        ...decodedStakeInspection({ tier: "SPROUT", stakedAmount: "20000000000" }),
        blockers: ["Stake position owner does not match the inspected wallet."],
      },
      rypDecimals: 6,
      snapshot,
    });

    expect(overlaid).toBe(snapshot);
    expect(overlaid.source).toBe("LIVE_WALLET_READ_ONLY");
    expect(overlaid.user.stakingTier).toBe("NONE");
  });

  it("rejects unknown stake tiers before applying protocol account state", async () => {
    const services = createProtocolServices();
    const snapshot = await services.loadProtocolSnapshot(walletAddress, "FRUIT");
    const overlaid = applyStakePositionInspectionToSnapshot({
      inspection: decodedStakeInspection({ tier: "UNKNOWN", stakedAmount: "20000000000" }),
      rypDecimals: 6,
      snapshot,
    });

    expect(normalizeStakeTier("UNKNOWN")).toBeUndefined();
    expect(overlaid).toBe(snapshot);
  });

  it("converts base-unit RYP amounts with configured decimals", () => {
    expect(baseUnitsToUiAmount("20000000000", 6)).toBe(20_000);
    expect(baseUnitsToUiAmount("1234567", 6)).toBe(1.234567);
    expect(baseUnitsToUiAmount("bad-value", 6)).toBe(0);
  });
});

function decodedStakeInspection(
  overrides: Partial<NonNullable<StakePositionInspection["decoded"]>> = {},
): StakePositionInspection {
  return {
    blockers: [],
    decoded: {
      owner: walletAddress,
      stakedAmount: "5000000000",
      tier: "SEED",
      stakingStartTs: "1800000000",
      votingRightsEligibleTs: "1801209600",
      lastRewardClaimTs: "0",
      goldenKeyActive: true,
      votingRightsActive: true,
      voteCount: 4,
      bump: 255,
      goldenKeyIssuedAt: "1800000000",
      goldenKeyRevokedAt: "0",
      votingRightsActivatedAt: "1801209600",
      votingRightsLevel: 1,
      ...overrides,
    },
    executionMode: "READ_ONLY",
    message: "Stake position account decoded from selected cluster.",
    ownerAddress: walletAddress,
    positionAddress: "stake-position",
    programId: "program",
    status: "DECODED",
    warnings: [],
  };
}
