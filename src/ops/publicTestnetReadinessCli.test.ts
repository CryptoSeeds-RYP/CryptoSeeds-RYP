import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "check-public-testnet-readiness.mjs");
const readinessCli = await import(pathToFileURL(scriptPath).href);

const buildPublicTestnetReadinessReport = readinessCli.buildPublicTestnetReadinessReport as (input: {
  checkResults: CheckResult[];
  envSource: string;
  generatedAt?: string;
}) => PublicTestnetReadinessReport;
const parseJsonStdout = readinessCli.parseJsonStdout as (stdout: string) => unknown;

type CheckResult = {
  id: string;
  label: string;
  exitCode: number;
  parsed: {
    status?: string;
    blockers?: string[];
    warnings?: string[];
    nextActions?: string[];
  } | null;
  errorMessage?: string;
};

type PublicTestnetReadinessReport = {
  exportVersion: string;
  status: "READY_FOR_PUBLIC_TESTNET_REVIEW" | "BLOCKED";
  blockers: string[];
  warnings: string[];
  nextActions: string[];
  checks: Array<{
    id: string;
    status: "READY" | "BLOCKED";
    sourceStatus: string | null;
    blockers: string[];
  }>;
};

describe("public testnet readiness CLI", () => {
  it("aggregates clean child checks into a public testnet ready report", () => {
    const report = buildPublicTestnetReadinessReport({
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      checkResults: [
        readyCheck("ops", "Ops readiness"),
        readyCheck("devnet-status", "Devnet status"),
        readyCheck("devnet-readiness", "Devnet broadcast readiness"),
        readyCheck("devnet-program", "Devnet program inspection"),
      ],
    });

    expect(report.exportVersion).toBe("public-testnet-readiness/v1");
    expect(report.status).toBe("READY_FOR_PUBLIC_TESTNET_REVIEW");
    expect(report.blockers).toEqual([]);
    expect(report.nextActions).toContain(
      "Enable wallet-approved transaction categories one at a time after decoded devnet inspection.",
    );
  });

  it("keeps child blockers sourced to the failing readiness gate", () => {
    const report = buildPublicTestnetReadinessReport({
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      checkResults: [
        readyCheck("ops", "Ops readiness"),
        {
          ...readyCheck("devnet-status", "Devnet status"),
          parsed: {
            status: "BLOCKED",
            blockers: ["Authority wallet has 0 SOL."],
            warnings: ["Treasury defaults to admin authority on devnet."],
            nextActions: ["Fund the devnet authority wallet."],
          },
        },
      ],
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers).toEqual(["Devnet status: Authority wallet has 0 SOL."]);
    expect(report.warnings).toEqual([
      "Devnet status: Treasury defaults to admin authority on devnet.",
    ]);
    expect(report.nextActions).toEqual(["Fund the devnet authority wallet."]);
  });

  it("blocks when a child check fails without parseable JSON", () => {
    const report = buildPublicTestnetReadinessReport({
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      checkResults: [
        {
          id: "devnet-status",
          label: "Devnet status",
          exitCode: 1,
          parsed: null,
          errorMessage: "RPC timeout.",
        },
      ],
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.checks[0].blockers).toContain("Check did not return a parseable JSON report.");
    expect(report.checks[0].blockers).toContain("RPC timeout.");
  });

  it("blocks when a child check reports blocked status without blocker details", () => {
    const report = buildPublicTestnetReadinessReport({
      envSource: ".env.devnet.example",
      generatedAt: "2026-06-30T00:00:00.000Z",
      checkResults: [
        {
          id: "devnet-program",
          label: "Devnet program inspection",
          exitCode: 0,
          parsed: {
            status: "BLOCKED",
            blockers: [],
          },
        },
      ],
    });

    expect(report.status).toBe("BLOCKED");
    expect(report.blockers).toEqual([
      "Devnet program inspection: Check reported BLOCKED without blockers.",
    ]);
  });

  it("parses JSON reports from noisy command stdout", () => {
    expect(parseJsonStdout('before\n{"status":"READY","blockers":[]}\nafter')).toEqual({
      status: "READY",
      blockers: [],
    });
  });
});

function readyCheck(id: string, label: string): CheckResult {
  return {
    id,
    label,
    exitCode: 0,
    parsed: {
      status: "READY",
      blockers: [],
      warnings: [],
      nextActions: [],
    },
  };
}
