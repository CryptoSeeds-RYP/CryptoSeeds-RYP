import { describe, expect, it } from "vitest";
import { projects } from "../fixtures/protocolFixtures";
import {
  advanceTransactionIntent,
  buildProjectParticipationIntent,
  buildProjectReviewIntent,
  buildSeedBotSwapIntent,
  buildStakePreviewIntent,
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
    const intent = buildProjectParticipationIntent(project, walletAddress);

    expect(intent.status).toBe("READY");
    expect(intent.executionMode).toBe("WALLET_APPROVED");
    expect(intent.acknowledgement?.accepted).toBe(true);
    expect(intent.acknowledgement?.acceptedAt).toBeDefined();
    expect(intent.accounts.some((account) => account.label === "Risk acknowledgement")).toBe(true);
  });

  it("keeps SeedBot in preview-only mode before route creation", () => {
    const intent = buildSeedBotSwapIntent(walletAddress);

    expect(intent.type).toBe("SEEDBOT_SWAP");
    expect(intent.status).toBe("DRAFT");
    expect(intent.executionMode).toBe("PREVIEW_ONLY");
    expect(intent.signaturePolicy).toContain("Signal-only");
  });

  it("advances and resets local lifecycle state without creating real execution", () => {
    const readyIntent = buildStakePreviewIntent(walletAddress, "SPROUT");
    const awaitingSignature = advanceTransactionIntent(readyIntent);
    const signed = advanceTransactionIntent(awaitingSignature);
    const broadcast = advanceTransactionIntent(signed);
    const confirmed = advanceTransactionIntent(broadcast);

    expect(awaitingSignature.status).toBe("AWAITING_SIGNATURE");
    expect(signed.status).toBe("SIGNED");
    expect(broadcast.status).toBe("BROADCAST");
    expect(confirmed.status).toBe("CONFIRMED");
    expect(resetTransactionIntent(confirmed).status).toBe("READY");
  });
});
