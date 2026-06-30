import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "check-ryp-mission-status.mjs");
const missionCli = await import(pathToFileURL(scriptPath).href);

const buildRypMissionStatusReport = missionCli.buildRypMissionStatusReport as (input: {
  commandResults?: Record<string, CommandResult>;
  devnetNextReport?: DevnetNextReport;
  envSource?: string;
  generatedAt?: string;
  opsReport?: OpsReport;
  readOnlyReadinessReport?: ReadOnlyReadinessReport;
}) => MissionStatusReport;
const parseLastJsonObject = missionCli.parseLastJsonObject as (output: string) => unknown;

type CommandResult = {
  exitCode: number;
};

type OpsReport = {
  status: string;
  requiredScripts: string[];
};

type DevnetNextReport = {
  status: string;
  recommendation: {
    command: string;
    id: string;
    manualAction?: string;
    risk: string;
  };
};

type ReadOnlyReadinessReport = {
  status: string;
  blockers?: string[];
  nextActions?: string[];
};

type MissionStatusReport = {
  status: string;
  sourceStatuses: {
    ops: string | null;
    devnetNext: string | null;
    readOnlyReadiness: string | null;
  };
  phaseSummary: {
    blocked: number;
    waitingOnDevnet: number;
  };
  phases: Array<{
    id: string;
    status: string;
    manualAction?: string | null;
  }>;
  blockers: string[];
  deferredBlockers: string[];
  nextActions: string[];
  safetyAttestation: {
    readOnly: boolean;
    noProtocolMutation: boolean;
  };
};

const envSource = ".env.devnet.example";

describe("RYP mission status CLI", () => {
  it("blocks the mission on the unfunded devnet authority without mutating anything", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      generatedAt: "2026-06-30T00:00:00.000Z",
      opsReport: readyOpsReport(),
      devnetNextReport: nextAction({
        id: "fund_devnet_authority",
        command: "npm run devnet:funding:packet -- --env .env.devnet.example",
        manualAction: "Fund Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe with at least 0.1 devnet SOL.",
        risk: "READ_ONLY",
      }),
      readOnlyReadinessReport: {
        status: "BLOCKED",
        blockers: ["Devnet authority has 0 SOL."],
        nextActions: ["Fund the devnet authority wallet."],
      },
    });

    expect(report.status).toBe("MISSION_BLOCKED");
    expect(report.phaseSummary.blocked).toBe(1);
    expect(report.phases.find((phase) => phase.id === "fund_devnet_authority")?.status).toBe("BLOCKED");
    expect(report.nextActions).toContain(
      "Fund Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe with at least 0.1 devnet SOL.",
    );
    expect(report.blockers).toEqual([
      "Fund Devnet Authority: Fund Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe with at least 0.1 devnet SOL.",
    ]);
    expect(report.deferredBlockers).toEqual([
      "Deferred until authority funding: Devnet authority has 0 SOL.",
    ]);
    expect(report.safetyAttestation).toMatchObject({
      readOnly: true,
      noProtocolMutation: true,
    });
  });

  it("moves deployment to review when authority funding is present and mint creation is next", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      opsReport: readyOpsReport(),
      devnetNextReport: nextAction({
        id: "create_devnet_test_mint",
        command: "npm run devnet:mint:test -- --env .env.devnet.example",
        risk: "DEVNET_MUTATION",
      }),
      readOnlyReadinessReport: {
        status: "BLOCKED",
        blockers: ["Devnet RYP test mint account does not exist."],
      },
    });

    expect(report.phases.find((phase) => phase.id === "fund_devnet_authority")?.status).toBe("LOCAL_READY");
    expect(report.phases.find((phase) => phase.id === "deploy_devnet_protocol")?.status).toBe("READY_FOR_REVIEW");
    expect(report.nextActions).toContain("npm run devnet:mint:test -- --env .env.devnet.example");
  });

  it("marks frontend and public product phases ready for review when read-only readiness passes", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      opsReport: readyOpsReport(),
      devnetNextReport: nextAction({
        id: "prepare_deployment_receipt",
        command: "npm run devnet:deployment:receipt -- --env .env.devnet.example",
        risk: "READ_ONLY",
      }),
      readOnlyReadinessReport: {
        status: "READY_FOR_READ_ONLY_TESTNET_PREVIEW",
        blockers: [],
        nextActions: ["Run a human release review before sharing the read-only devnet preview."],
      },
    });

    expect(report.phases.find((phase) => phase.id === "wire_frontend_devnet_state")?.status).toBe("READY_FOR_REVIEW");
    expect(report.phases.find((phase) => phase.id === "public_ready_product_layer")?.status).toBe("READY_FOR_REVIEW");
    expect(report.phaseSummary.waitingOnDevnet).toBe(0);
  });

  it("surfaces malformed child command output as mission blockers", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      commandResults: {
        ops: {
          exitCode: 0,
        },
      },
      opsReport: undefined,
      devnetNextReport: nextAction({
        id: "fund_devnet_authority",
        command: "npm run devnet:funding:packet -- --env .env.devnet.example",
        risk: "READ_ONLY",
      }),
      readOnlyReadinessReport: {
        status: "BLOCKED",
        blockers: [],
      },
    });

    expect(report.blockers).toContain("Ops readiness: command did not return parseable JSON.");
    expect(report.sourceStatuses.ops).toBeNull();
  });

  it("parses the final JSON object from noisy stdout", () => {
    expect(parseLastJsonObject('npm noise\n{"status":"READY"}\n')).toEqual({ status: "READY" });
  });
});

function readyOpsReport(): OpsReport {
  return {
    status: "READY",
    requiredScripts: [
      "test",
      "build",
      "protocol:idl:check",
      "devnet:next",
      "testnet:readiness",
      "rewards:claim-merkle",
      "rewards:holder-claim-packet",
    ],
  };
}

function nextAction(recommendation: DevnetNextReport["recommendation"]): DevnetNextReport {
  return {
    status: "NEXT_ACTION_READY",
    recommendation,
  };
}
