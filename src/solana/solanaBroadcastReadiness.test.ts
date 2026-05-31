import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import type { AppConfig } from "../config/env";
import { PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";
import type { SolanaWalletSignatureReceipt } from "../domain/transactions";
import { buildStakeRypTransactionPlan } from "./protocolTransactionPlan";
import { buildSolanaBroadcastReadiness } from "./solanaBroadcastReadiness";

const walletAddress = "11111111111111111111111111111111";

describe("solana broadcast readiness", () => {
  it("blocks the default placeholder and demo configuration", () => {
    const plan = buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier: "SEED" });
    const readiness = buildSolanaBroadcastReadiness({
      config: {
        cluster: "localnet",
        demoMode: true,
        protocolDeployment: "placeholder",
        protocolProgramId: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
        solanaBroadcastEnabled: false,
      },
      plan,
      signature: signedReceipt({ feePayer: plan.feePayer }),
    });

    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockers.join(" ")).toContain("broadcast is disabled");
    expect(readiness.blockers.join(" ")).toContain("Demo mode");
    expect(readiness.blockers.join(" ")).toContain("development placeholder");
  });

  it("marks a matching devnet configuration ready for review without adding broadcast", () => {
    const devnetProgramId = Keypair.generate().publicKey.toBase58();
    const plan = withProgramId(
      buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier: "SEED" }),
      devnetProgramId,
    );
    const readiness = buildSolanaBroadcastReadiness({
      config: readyConfig({ cluster: "devnet", protocolDeployment: "devnet", protocolProgramId: devnetProgramId }),
      plan,
      signature: signedReceipt({ feePayer: plan.feePayer }),
    });

    expect(readiness.status).toBe("READY_FOR_REVIEW");
    expect(readiness.blockers).toEqual([]);
    expect(readiness.warnings.join(" ")).toContain("No broadcast function is implemented");
  });

  it("blocks mismatched program ids even when broadcast is enabled", () => {
    const plan = buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier: "SEED" });
    const readiness = buildSolanaBroadcastReadiness({
      config: readyConfig({
        cluster: "devnet",
        protocolDeployment: "devnet",
        protocolProgramId: Keypair.generate().publicKey.toBase58(),
      }),
      plan,
      signature: signedReceipt({ feePayer: plan.feePayer }),
    });

    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockers.join(" ")).toContain("program id does not match");
  });

  it("blocks mainnet until a later launch review replaces this gate", () => {
    const mainnetProgramId = Keypair.generate().publicKey.toBase58();
    const plan = withProgramId(
      buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier: "SEED" }),
      mainnetProgramId,
    );
    const readiness = buildSolanaBroadcastReadiness({
      config: readyConfig({
        cluster: "mainnet-beta",
        protocolDeployment: "mainnet-beta",
        protocolProgramId: mainnetProgramId,
      }),
      plan,
      signature: signedReceipt({ feePayer: plan.feePayer }),
    });

    expect(readiness.status).toBe("BLOCKED");
    expect(readiness.blockers.join(" ")).toContain("Mainnet broadcast is blocked");
  });
});

function readyConfig(
  overrides: Pick<AppConfig, "cluster" | "protocolDeployment" | "protocolProgramId">,
): Pick<AppConfig, "cluster" | "demoMode" | "protocolDeployment" | "protocolProgramId" | "solanaBroadcastEnabled"> {
  return {
    ...overrides,
    demoMode: false,
    solanaBroadcastEnabled: true,
  };
}

function signedReceipt({ feePayer }: { feePayer: string }): SolanaWalletSignatureReceipt {
  return {
    feePayer,
    message: "Signed",
    messageFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    signatureBase64: "signed",
    signatureVerified: true,
    signedAt: "2026-05-31T00:00:00.000Z",
    status: "SIGNED",
    walletAddress: feePayer,
    warnings: [],
  };
}

function withProgramId(plan: ReturnType<typeof buildStakeRypTransactionPlan>, programId: string) {
  return {
    ...plan,
    instructions: plan.instructions.map((instruction) => ({ ...instruction, programId })),
  };
}
