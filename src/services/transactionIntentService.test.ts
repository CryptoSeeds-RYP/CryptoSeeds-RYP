import { describe, expect, it } from "vitest";
import { seedBotPerformanceFeeModel, seedBotStrategies } from "../domain/seedbot";
import { projects } from "../fixtures/protocolFixtures";
import type { ProjectParticipation } from "../domain/microverse";
import {
  advanceTransactionIntent,
  buildProjectParticipationIntent,
  buildProjectReviewIntent,
  buildSeedBotAllocationIntent,
  buildSeedBotSwapIntent,
  buildStakePreviewIntent,
  buildUnstakePreviewIntent,
  markSignedBroadcastDisabled,
  resetTransactionIntent,
} from "./transactionIntentService";

const walletAddress = "11111111111111111111111111111111";

describe("transaction intents", () => {
  it("builds wallet-approved staking previews for the selected tier", () => {
    const intent = buildStakePreviewIntent(walletAddress, "TREE");

    expect(intent.type).toBe("STAKE_RYP");
    expect(intent.status).toBe("READY");
    expect(intent.executionMode).toBe("WALLET_APPROVED");
    expect(intent.amount).toBe("100,000");
    expect(intent.estimatedFees).toContain("2.45%");
    expect(intent.accounts.some((account) => account.signer && account.address === walletAddress)).toBe(true);
    expect(intent.preparedSolanaTransaction?.action).toBe("STAKE_RYP");
    expect(intent.preparedSolanaTransaction?.amountBaseUnits).toBe("100000000000");
    expect(intent.preparedSolanaTransaction?.instructions[0].instructionName).toBe("stake_ryp");
    expect(intent.preparedSolanaTransaction?.instructions[0].accounts).toHaveLength(9);
  });

  it("builds wallet-approved unstaking previews with derived protocol accounts", () => {
    const intent = buildUnstakePreviewIntent(walletAddress, 5000);

    expect(intent.type).toBe("UNSTAKE_RYP");
    expect(intent.status).toBe("READY");
    expect(intent.preparedSolanaTransaction?.action).toBe("UNSTAKE_RYP");
    expect(intent.preparedSolanaTransaction?.amountBaseUnits).toBe("5000000000");
    expect(intent.preparedSolanaTransaction?.warnings.join(" ")).toContain("Golden Key");
  });

  it("blocks unstaking previews that would leave below-Seed stake dust", () => {
    const intent = buildUnstakePreviewIntent(walletAddress, 16000, 20000);

    expect(intent.type).toBe("UNSTAKE_RYP");
    expect(intent.status).toBe("FAILED");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.preparedSolanaTransaction).toBeUndefined();
    expect(intent.signaturePolicy).toContain("Seed minimum");
    expect(intent.expectedResult).toContain("Seed minimum");
  });

  it("allows unstaking previews that fully exit or leave an active tier", () => {
    const partial = buildUnstakePreviewIntent(walletAddress, 15000, 20000);
    const full = buildUnstakePreviewIntent(walletAddress, 5000, 5000);

    expect(partial.status).toBe("READY");
    expect(partial.preparedSolanaTransaction?.amountBaseUnits).toBe("15000000000");
    expect(partial.expectedResult).toContain("SEED tier");
    expect(full.status).toBe("READY");
    expect(full.expectedResult).toContain("exits to zero");
  });

  it("keeps project review intents preview-only until risk is acknowledged", () => {
    const project = projects[0];
    const intent = buildProjectReviewIntent(project, walletAddress);

    expect(intent.status).toBe("DRAFT");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.acknowledgement?.accepted).toBe(false);
    expect(intent.lifecycle.find((step) => step.id === "wallet_signature")?.status).toBe("BLOCKED");
  });

  it("marks project participation intents as wallet-ready after acknowledgement", () => {
    const project = projects[0];
    const intent = buildProjectParticipationIntent(project, walletAddress, "SEED");

    expect(intent.status).toBe("READY");
    expect(intent.executionMode).toBe("WALLET_APPROVED");
    expect(intent.acknowledgement?.accepted).toBe(true);
    expect(intent.acknowledgement?.acceptedAt).toBeDefined();
    expect(intent.acknowledgement?.disclosureRef).toContain("chestnut-risk:v1.0");
    expect(intent.accounts.some((account) => account.label === "Risk acknowledgement")).toBe(true);
  });

  it("blocks project participation intents until the active tier is supplied", () => {
    const project = projects[0];
    const intent = buildProjectParticipationIntent(project, walletAddress);

    expect(intent.status).toBe("BLOCKED");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.acknowledgement?.accepted).toBe(false);
    expect(intent.riskSummary).toContain("Requires SEED tier");
    expect(intent.lifecycle.find((step) => step.id === "wallet_signature")?.status).toBe("BLOCKED");
  });

  it("blocks project participation intents for duplicate active participation", () => {
    const project = projects[0];
    const intent = buildProjectParticipationIntent(project, walletAddress, {
      activeTier: "SEED",
      participations: [preparedParticipation({ projectId: project.id, slotIndex: 0 })],
      slotCount: 2,
    });

    expect(intent.status).toBe("BLOCKED");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.riskSummary).toContain("Project is already in your MicroVerse");
  });

  it("blocks project participation intents when no farm slot is open", () => {
    const project = projects[0];
    const intent = buildProjectParticipationIntent(project, walletAddress, {
      activeTier: "SEED",
      participations: [],
      slotCount: 0,
    });

    expect(intent.status).toBe("BLOCKED");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.riskSummary).toContain("No open project slot");
  });

  it("blocks project participation intents when project registry checks fail", () => {
    const project = projects.find((item) => item.id === "hemp-greenhouse")!;
    const intent = buildProjectParticipationIntent(project, walletAddress, "SAPLING");

    expect(intent.status).toBe("BLOCKED");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.acknowledgement?.accepted).toBe(false);
    expect(intent.signaturePolicy).toContain("project registry safety checks");
    expect(intent.riskSummary).toContain("Governance approval is not complete");
    expect(intent.riskSummary).toContain("Receiving account is not disclosed");
    expect(intent.lifecycle.find((step) => step.id === "wallet_signature")?.status).toBe("BLOCKED");
  });

  it("keeps SeedBot in preview-only mode before route creation", () => {
    const intent = buildSeedBotSwapIntent(walletAddress);

    expect(intent.type).toBe("SEEDBOT_SWAP");
    expect(intent.status).toBe("DRAFT");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.signaturePolicy).toContain("Signal-only");
  });

  it("builds SeedBot allocation previews without custody or guaranteed returns", () => {
    const intent = buildSeedBotAllocationIntent({
      access: {
        rypBalance: 5000,
        stakingTier: "SEED",
        walletConnected: true,
      },
      strategy: {
        id: "test-strategy",
        name: "Test Strategy",
        summary: "Test",
        risk: "MEDIUM",
        minimumAccess: "RYP_HOLDER",
        preferredVenueId: "HYPERLIQUID",
        performance: [
          { window: "7D", returnPercent: 1, points: [0, 1] },
          { window: "30D", returnPercent: 2, points: [0, 2] },
          { window: "90D", returnPercent: 3, points: [0, 3] },
          { window: "180D", returnPercent: 4, points: [0, 4] },
          { window: "1Y", returnPercent: 5, points: [0, 5] },
        ],
        feeModel: {
          performanceFeeBps: 1200,
          devSharePercent: 40,
          treasurySharePercent: 60,
          chargedOn: "REALIZED_POSITIVE_PNL_ONLY",
          deductedFrom: "PROFIT_NOT_PRINCIPAL",
        },
        allocationModes: ["BASKET", "PER_ASSET"],
        assets: [
          { symbol: "SOL", chain: "SOLANA", walletRoute: "PHANTOM", venueId: "JUPITER", targetWeightPercent: 60 },
          { symbol: "ETH", chain: "EVM", walletRoute: "METAMASK", venueId: "HYPERLIQUID", targetWeightPercent: 40 },
        ],
      },
      walletAddress,
    });

    expect(intent.type).toBe("SEEDBOT_ALLOCATE");
    expect(intent.chain).toBe("MULTICHAIN");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.signaturePolicy).toContain("Phantom or MetaMask approval");
    expect(intent.riskSummary).toContain("Past performance does not guarantee future results");
    expect(intent.riskSummary).toContain("Route mode: DRY_RUN");
    expect(intent.estimatedFees).toContain("deducted from profit not principal");
    expect(intent.estimatedFees).toContain("Disabled for live use");
    expect(intent.riskSummary).toContain("legal review");
    expect(intent.accounts.some((account) => account.label.includes("Hyperliquid"))).toBe(true);
  });

  it("blocks SeedBot allocation previews until wallet access context is supplied", () => {
    const intent = buildSeedBotAllocationIntent({
      strategy: seedBotStrategies[0],
      walletAddress,
    });

    expect(intent.status).toBe("BLOCKED");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.signaturePolicy).toContain("access");
    expect(intent.riskSummary).toContain("RYP holder access is required");
  });

  it("blocks SeedBot allocation previews below the strategy tier", () => {
    const intent = buildSeedBotAllocationIntent({
      access: {
        rypBalance: 0,
        stakingTier: "SEED",
        walletConnected: true,
      },
      strategy: seedBotStrategies.find((strategy) => strategy.minimumAccess === "SAPLING")!,
      walletAddress,
    });

    expect(intent.status).toBe("BLOCKED");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.riskSummary).toContain("SAPLING tier access is required");
  });

  it("blocks SeedBot allocation previews when strategy validation fails", () => {
    const intent = buildSeedBotAllocationIntent({
      access: {
        rypBalance: 5000,
        stakingTier: "SEED",
        walletConnected: true,
      },
      strategy: {
        ...seedBotStrategies[0],
        id: "bad-seedbot-preview",
        performance: seedBotStrategies[0].performance.filter((item) => item.window !== "1Y"),
        feeModel: seedBotPerformanceFeeModel,
      },
      walletAddress,
    });

    expect(intent.type).toBe("SEEDBOT_ALLOCATE");
    expect(intent.status).toBe("BLOCKED");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.signaturePolicy).toContain("access");
    expect(intent.signaturePolicy).toContain("strategy metadata");
    expect(intent.riskSummary).toContain("SeedBot route blocked");
    expect(intent.riskSummary).toContain("missing 1Y performance");
    expect(intent.accounts.some((account) => account.label.includes("route for"))).toBe(false);
    expect(intent.lifecycle.find((step) => step.id === "wallet_signature")?.status).toBe("BLOCKED");
  });

  it("advances local lifecycle state only up to signature collection", () => {
    const readyIntent = buildStakePreviewIntent(walletAddress, "SPROUT");
    const awaitingSignature = advanceTransactionIntent(readyIntent);
    const signed = advanceTransactionIntent(awaitingSignature);
    const broadcast = advanceTransactionIntent(signed);

    expect(awaitingSignature.status).toBe("AWAITING_SIGNATURE");
    expect(signed.status).toBe("SIGNED");
    expect(broadcast.status).toBe("SIGNED");
    expect(broadcast.lifecycle.find((step) => step.id === "broadcast")?.status).toBe("CURRENT");
    expect(resetTransactionIntent(broadcast).status).toBe("READY");
  });

  it("marks real signature receipts as signed while keeping broadcast blocked", () => {
    const readyIntent = buildStakePreviewIntent(walletAddress, "SPROUT");
    const signed = markSignedBroadcastDisabled(readyIntent);

    expect(signed.status).toBe("SIGNED");
    expect(signed.lifecycle.find((step) => step.id === "wallet_signature")?.status).toBe("COMPLETE");
    expect(signed.lifecycle.find((step) => step.id === "broadcast")?.status).toBe("BLOCKED");
    expect(signed.lifecycle.find((step) => step.id === "confirmation")?.status).toBe("BLOCKED");
  });
});

function preparedParticipation({
  projectId,
  slotIndex,
}: {
  projectId: string;
  slotIndex: number;
}): ProjectParticipation {
  return {
    acknowledgedDisclosureRef: `project:${projectId}:document:test:v1.0`,
    id: `participation-${projectId}-${slotIndex}`,
    joinedAt: "2026-06-30T00:00:00.000Z",
    milestoneIndex: 0,
    projectId,
    slotIndex,
    status: "PREPARED",
    updatedAt: "2026-06-30T00:00:00.000Z",
    walletAddress,
  };
}
