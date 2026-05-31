import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { appConfig } from "../config/env";
import { buildStakeRypTransactionPlan } from "./protocolTransactionPlan";
import {
  buildSolanaWalletBoundaryPreview,
  createSolanaTransactionFromPlan,
  requestPreparedSolanaSignature,
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

  it("blocks malformed prepared plans before building a wallet boundary", () => {
    const plan = buildStakeRypTransactionPlan({ ownerAddress, tier: "SEED" });
    const preview = buildSolanaWalletBoundaryPreview({
      plan: {
        ...plan,
        instructions: [
          {
            ...plan.instructions[0],
            dataHex: "not-hex",
            accounts: [
              { ...plan.instructions[0].accounts[0], address: "not-a-public-key" },
              ...plan.instructions[0].accounts.slice(1),
            ],
          },
        ],
      },
      walletCanSign: true,
      walletPublicKey: ownerAddress,
      recentBlockhash,
    });

    expect(preview.status).toBe("BLOCKED");
    expect(preview.serializedMessageBase64).toBeUndefined();
    expect(preview.warnings.join(" ")).toContain("instruction data is not valid hex");
    expect(preview.warnings.join(" ")).toContain("account address is not a valid Solana public key");
  });

  it("collects a signature receipt without storing a signed transaction for broadcast", async () => {
    const signer = Keypair.generate();
    const walletAddress = signer.publicKey.toBase58();
    const plan = buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier: "SEED" });
    const boundary = {
      ...buildSolanaWalletBoundaryPreview({
        plan,
        walletCanSign: true,
        walletPublicKey: walletAddress,
        recentBlockhash,
        lastValidBlockHeight: 12345,
      }),
      status: "SIMULATION_PASSED" as const,
    };
    const receipt = await requestPreparedSolanaSignature({
      boundary,
      plan,
      walletPublicKey: walletAddress,
      signTransaction: async (transaction) => {
        transaction.partialSign(signer);
        return transaction;
      },
    });

    expect(receipt.status).toBe("SIGNED");
    expect(receipt.signatureVerified).toBe(true);
    expect(receipt.signatureBase64).toBeTruthy();
    expect(receipt.messageFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(receipt).not.toHaveProperty("messageBase64");
    expect(receipt).not.toHaveProperty("serializedTransactionBase64");
    expect(receipt.warnings.join(" ")).toContain("Broadcast remains disabled");
  });

  it("rejects signatures when the wallet returns a mutated transaction message", async () => {
    const signer = Keypair.generate();
    const walletAddress = signer.publicKey.toBase58();
    const plan = buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier: "SEED" });
    const boundary = {
      ...buildSolanaWalletBoundaryPreview({
        plan,
        walletCanSign: true,
        walletPublicKey: walletAddress,
        recentBlockhash,
        lastValidBlockHeight: 12345,
      }),
      status: "SIMULATION_PASSED" as const,
    };
    const receipt = await requestPreparedSolanaSignature({
      boundary,
      plan,
      walletPublicKey: walletAddress,
      signTransaction: async (transaction) => {
        transaction.recentBlockhash = Keypair.generate().publicKey.toBase58();
        transaction.partialSign(signer);
        return transaction;
      },
    });

    expect(receipt.status).toBe("FAILED");
    expect(receipt.signatureVerified).toBe(false);
    expect(receipt.signatureBase64).toBeUndefined();
    expect(receipt.message).toContain("different transaction message");
    expect(receipt.warnings.join(" ")).toContain("changed after simulation");
  });

  it("blocks signature requests until simulation has passed", async () => {
    const signer = Keypair.generate();
    const walletAddress = signer.publicKey.toBase58();
    const plan = buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier: "SEED" });
    const boundary = buildSolanaWalletBoundaryPreview({
      plan,
      walletCanSign: true,
      walletPublicKey: walletAddress,
      recentBlockhash,
      lastValidBlockHeight: 12345,
    });
    const receipt = await requestPreparedSolanaSignature({
      boundary,
      plan,
      walletPublicKey: walletAddress,
      signTransaction: async (transaction) => transaction,
    });

    expect(receipt.status).toBe("BLOCKED");
    expect(receipt.message).toContain("passed simulation");
    expect(receipt.signatureBase64).toBeUndefined();
  });

  it("blocks signature requests when the simulation boundary belongs to another wallet", async () => {
    const signer = Keypair.generate();
    const walletAddress = signer.publicKey.toBase58();
    const plan = buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier: "SEED" });
    const boundary = {
      ...buildSolanaWalletBoundaryPreview({
        plan,
        walletCanSign: true,
        walletPublicKey: walletAddress,
        recentBlockhash,
      }),
      status: "SIMULATION_PASSED" as const,
      walletAddress: otherWallet,
    };
    const receipt = await requestPreparedSolanaSignature({
      boundary,
      plan,
      walletPublicKey: walletAddress,
      signTransaction: async (transaction) => transaction,
    });

    expect(receipt.status).toBe("BLOCKED");
    expect(receipt.warnings).toContain("Simulation boundary wallet address does not match the connected wallet.");
  });
});
