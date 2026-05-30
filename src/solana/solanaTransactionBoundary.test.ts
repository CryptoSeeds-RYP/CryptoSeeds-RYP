import { describe, expect, it } from "vitest";
import { appConfig } from "../config/env";
import { buildStakeRypTransactionPlan } from "./protocolTransactionPlan";
import {
  buildSolanaWalletBoundaryPreview,
  createSolanaTransactionFromPlan,
} from "./solanaTransactionBoundary";

const ownerAddress = "11111111111111111111111111111111";
const otherWallet = "3bmqc6gEdUNmRrANE6w6CuW2ht5Vscy8SGXaLyTLQsy3";
const recentBlockhash = "11111111111111111111111111111111";

describe("solana transaction boundary", () => {
  it("builds an unsigned wallet-ready transaction from a prepared protocol plan", () => {
    const plan = buildStakeRypTransactionPlan({ ownerAddress, tier: "SEED" });
    const transaction = createSolanaTransactionFromPlan({
      plan,
      recentBlockhash,
      lastValidBlockHeight: 12345,
    });

    expect(transaction.feePayer?.toBase58()).toBe(ownerAddress);
    expect(transaction.recentBlockhash).toBe(recentBlockhash);
    expect(transaction.lastValidBlockHeight).toBe(12345);
    expect(transaction.instructions).toHaveLength(1);
    expect(transaction.instructions[0].programId.toBase58()).toBe(appConfig.protocolProgramId);
    expect(transaction.instructions[0].keys[0]).toMatchObject({
      isSigner: true,
      isWritable: true,
    });
    expect(transaction.instructions[0].data.toString("hex")).toBe("b746a41746842ce800f2052a01000000");
  });

  it("creates a boundary preview without requesting a signature or broadcast", () => {
    const plan = buildStakeRypTransactionPlan({ ownerAddress, tier: "SEED" });
    const preview = buildSolanaWalletBoundaryPreview({
      plan,
      walletCanSign: true,
      walletPublicKey: ownerAddress,
      recentBlockhash,
      lastValidBlockHeight: 12345,
    });

    expect(preview.status).toBe("READY_FOR_SIGNATURE");
    expect(preview.instructionCount).toBe(1);
    expect(preview.requiredSigners).toEqual([ownerAddress]);
    expect(preview.serializedMessageBase64).toBeTruthy();
    expect(preview.warnings.join(" ")).toContain("does not sign or broadcast");
  });

  it("blocks the boundary when the connected wallet does not match the fee payer", () => {
    const plan = buildStakeRypTransactionPlan({ ownerAddress, tier: "SEED" });
    const preview = buildSolanaWalletBoundaryPreview({
      plan,
      walletCanSign: true,
      walletPublicKey: otherWallet,
      recentBlockhash,
    });

    expect(preview.status).toBe("BLOCKED");
    expect(preview.serializedMessageBase64).toBeUndefined();
    expect(preview.warnings.join(" ")).toContain("does not match the prepared transaction fee payer");
  });

  it("blocks demo or disconnected mode before any wallet signature path", () => {
    const plan = buildStakeRypTransactionPlan({ ownerAddress, tier: "SEED" });
    const preview = buildSolanaWalletBoundaryPreview({
      plan,
      walletCanSign: false,
    });

    expect(preview.status).toBe("BLOCKED");
    expect(preview.message).toContain("Connect a real Solana wallet");
    expect(preview.warnings.join(" ")).toContain("No wallet signature is requested");
  });
});
