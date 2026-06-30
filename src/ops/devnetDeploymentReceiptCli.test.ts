import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "prepare-devnet-deployment-receipt.mjs");
const receiptCli = await import(pathToFileURL(scriptPath).href);

const buildDeploymentReceiptCheckDefinitions = receiptCli.buildDeploymentReceiptCheckDefinitions as (input?: {
  envSource?: string;
  profile?: ReceiptProfile;
}) => CheckDefinition[];
const buildDevnetDeploymentReceipt = receiptCli.buildDevnetDeploymentReceipt as (input: {
  artifact?: ProgramArtifact | null;
  checkResults: CheckResult[];
  envSource: string;
  generatedAt?: string;
  profile?: ReceiptProfile;
}) => DevnetDeploymentReceipt;

type ReceiptProfile = "read-only" | "wallet-execution";

type CheckDefinition = {
  id: string;
  label: string;
  script: string;
  args: string[];
};

type CheckResult = {
  id: string;
  label: string;
  exitCode: number;
  parsed: Record<string, unknown> | null;
  errorMessage?: string;
};

type ProgramArtifact = {
  exists: boolean;
  path: string | null;
  sha256: string | null;
  sizeBytes: number;
};

type DevnetDeploymentReceipt = {
  exportVersion: string;
  status: "READY_FOR_READ_ONLY_DEVNET_HANDOFF" | "READY_FOR_WALLET_EXECUTION_REVIEW" | "BLOCKED";
  profile: ReceiptProfile;
  executionMode: "READ_ONLY";
  localArtifact: ProgramArtifact | null;
  deployment: {
    authority: unknown;
    mint: unknown;
    program: unknown;
    protocolTargets: unknown;
  };
  readiness: {
    profile: ReceiptProfile;
    status: string;
    blockers: string[];
    warnings: string[];
  } | null;
  blockers: string[];
  safetyAttestation: {
    devnetOnly: boolean;
    noTransactionsSubmitted: boolean;
    noProtocolMutation: boolean;
    noWalletBroadcastEnabledByReceipt: boolean;
    receiptDoesNotAuthorizeLaunch: boolean;
  };
};

describe("devnet deployment receipt CLI", () => {
  it("uses existing read-only devnet checks as receipt inputs", () => {
    expect(
      buildDeploymentReceiptCheckDefinitions({
        envSource: ".env.devnet.example",
        profile: "read-only",
      }).map((definition) => [definition.id, definition.args]),
    ).toEqual([
      ["devnet-status", ["--env", ".env.devnet.example"]],
      ["devnet-program", ["--env", ".env.devnet.example"]],
      ["devnet-protocol-state", ["--env", ".env.devnet.example"]],
      ["public-testnet-readiness", ["--profile", "read-only", "--env", ".env.devnet.example"]],
    ]);
  });

  it("emits a read-only handoff receipt when all checks are clean", () => {
    const report = buildDevnetDeploymentReceipt({
      artifact: programArtifact(),
      checkResults: [
        readyCheck("devnet-status", "Devnet status", {
          chain: {
            authority: { address: "authority", fundedForDeploy: true },
            mint: { address: "mint", exists: true },
            program: { address: "program", exists: true, executable: true },
          },
          config: { cluster: "devnet", broadcastEnabled: false },
          protocolTargets: { config: "config-pda" },
        }),
        readyCheck("devnet-program", "Devnet program inspection"),
        readyCheck("devnet-protocol-state", "Devnet protocol state inspection"),
        readyCheck("public-testnet-readiness", "Public testnet readiness (read-only)", {
          profile: "read-only",
          status: "READY_FOR_READ_ONLY_TESTNET_PREVIEW",
        }),
      ],
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      profile: "read-only",
    });

    expect(report.exportVersion).toBe("devnet-deployment-receipt/v1");
    expect(report.status).toBe("READY_FOR_READ_ONLY_DEVNET_HANDOFF");
    expect(report.executionMode).toBe("READ_ONLY");
    expect(report.localArtifact?.sha256).toBe("abc123");
    expect(report.deployment.protocolTargets).toEqual({ config: "config-pda" });
    expect(report.readiness?.status).toBe("READY_FOR_READ_ONLY_TESTNET_PREVIEW");
    expect(report.safetyAttestation).toMatchObject({
      devnetOnly: true,
      noTransactionsSubmitted: true,
      noProtocolMutation: true,
      noWalletBroadcastEnabledByReceipt: true,
      receiptDoesNotAuthorizeLaunch: true,
    });
  });

  it("keeps deployment blockers tied to the failing source check", () => {
    const report = buildDevnetDeploymentReceipt({
      artifact: programArtifact(),
      checkResults: [
        readyCheck("devnet-status", "Devnet status", {
          status: "BLOCKED",
          blockers: ["Devnet authority has 0 SOL."],
          nextActions: ["Fund the devnet authority wallet."],
        }),
      ],
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers).toEqual(["Devnet status: Devnet authority has 0 SOL."]);
  });

  it("does not duplicate child blockers through the aggregate readiness check", () => {
    const report = buildDevnetDeploymentReceipt({
      artifact: programArtifact(),
      checkResults: [
        readyCheck("devnet-status", "Devnet status", {
          status: "BLOCKED",
          blockers: ["Devnet authority has 0 SOL."],
        }),
        readyCheck("public-testnet-readiness", "Public testnet readiness (read-only)", {
          status: "BLOCKED",
          blockers: ["Devnet status: Devnet authority has 0 SOL."],
        }),
      ],
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers).toEqual(["Devnet status: Devnet authority has 0 SOL."]);
    expect(report.readiness?.blockers).toEqual(["Devnet status: Devnet authority has 0 SOL."]);
  });

  it("separates wallet execution review from read-only handoff", () => {
    const report = buildDevnetDeploymentReceipt({
      artifact: programArtifact(),
      checkResults: [
        readyCheck("devnet-status", "Devnet status"),
        readyCheck("devnet-program", "Devnet program inspection"),
        readyCheck("devnet-protocol-state", "Devnet protocol state inspection"),
        readyCheck("public-testnet-readiness", "Public testnet readiness (wallet-execution)", {
          profile: "wallet-execution",
          status: "READY_FOR_PUBLIC_TESTNET_REVIEW",
        }),
      ],
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      profile: "wallet-execution",
    });

    expect(report.status).toBe("READY_FOR_WALLET_EXECUTION_REVIEW");
    expect(report.profile).toBe("wallet-execution");
  });
});

function readyCheck(id: string, label: string, extra: Record<string, unknown> = {}): CheckResult {
  return {
    id,
    label,
    exitCode: 0,
    parsed: {
      status: "READY",
      blockers: [],
      warnings: [],
      nextActions: [],
      ...extra,
    },
  };
}

function programArtifact(): ProgramArtifact {
  return {
    exists: true,
    path: "programs/cryptoseeds_protocol/target/deploy/cryptoseeds_protocol.so",
    sha256: "abc123",
    sizeBytes: 100,
  };
}
