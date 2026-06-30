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
  operatorHandoff?: {
    activeStep: string;
    afterCompletionCommand: string;
    command: string;
    operatorRule: string;
    requiresExplicitApproval: boolean;
    requiresExternalAction: boolean;
    resumeCommand: string;
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
    command: string;
    id: string;
    status: string;
    manualAction?: string | null;
  }>;
  blockers: string[];
  deferredBlockers: string[];
  nextActions: string[];
  nextOperatorHandoff: DevnetNextReport["operatorHandoff"] | null;
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
    expect(report.phases.find((phase) => phase.id === "create_devnet_test_mint")?.status).toBe("WAITING_ON_DEVNET");
    expect(report.phases.find((phase) => phase.id === "deploy_devnet_program")?.status).toBe("WAITING_ON_DEVNET");
    expect(report.phases.find((phase) => phase.id === "initialize_devnet_protocol")?.status).toBe("WAITING_ON_DEVNET");
    expect(report.phases.find((phase) => phase.id === "full_local_verification")?.command).toBe(
      "npm run verify:local",
    );
    expect(report.nextActions).toContain(
      "Fund Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe with at least 0.1 devnet SOL.",
    );
    expect(report.nextOperatorHandoff).toMatchObject({
      activeStep: "fund_devnet_authority",
      requiresExplicitApproval: false,
      requiresExternalAction: true,
      risk: "READ_ONLY",
    });
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
    expect(report.phases.find((phase) => phase.id === "create_devnet_test_mint")?.status).toBe("REVIEW_REQUIRED");
    expect(report.phases.find((phase) => phase.id === "deploy_devnet_program")?.status).toBe("WAITING_ON_DEVNET");
    expect(report.phases.find((phase) => phase.id === "initialize_devnet_protocol")?.status).toBe("WAITING_ON_DEVNET");
    expect(report.nextActions).toContain("npm run devnet:mint:test -- --env .env.devnet.example");
    expect(report.nextOperatorHandoff).toMatchObject({
      activeStep: "create_devnet_test_mint",
      requiresExplicitApproval: true,
      requiresExternalAction: false,
      risk: "DEVNET_MUTATION",
    });
  });

  it("moves program deployment to review after the test mint exists", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      opsReport: readyOpsReport(),
      devnetNextReport: nextAction({
        id: "deploy_program_and_plan_init",
        command: "npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan",
        risk: "DEVNET_MUTATION",
      }),
      readOnlyReadinessReport: {
        status: "BLOCKED",
        blockers: ["Devnet program account does not exist."],
      },
    });

    expect(report.phases.find((phase) => phase.id === "create_devnet_test_mint")?.status).toBe("READY_FOR_REVIEW");
    expect(report.phases.find((phase) => phase.id === "deploy_devnet_program")?.status).toBe("REVIEW_REQUIRED");
    expect(report.phases.find((phase) => phase.id === "initialize_devnet_protocol")?.status).toBe("WAITING_ON_DEVNET");
    expect(report.nextActions).toContain(
      "npm run devnet:bootstrap -- --env .env.devnet.example --deploy --init-plan",
    );
  });

  it("keeps funding phase command scoped when deployment needs a top-up", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      opsReport: readyOpsReport(),
      devnetNextReport: nextAction({
        id: "top_up_devnet_authority",
        command: "npm run devnet:funding:packet -- --env .env.devnet.example",
        manualAction: "Top up authority toward 3 devnet SOL before deployment.",
        risk: "READ_ONLY",
      }),
      readOnlyReadinessReport: {
        status: "BLOCKED",
        blockers: ["Devnet program account does not exist."],
      },
    });

    const fundingPhase = report.phases.find((phase) => phase.id === "fund_devnet_authority");
    const programPhase = report.phases.find((phase) => phase.id === "deploy_devnet_program");

    expect(fundingPhase?.status).toBe("LOCAL_READY");
    expect(fundingPhase?.manualAction).toBeNull();
    expect(fundingPhase?.command).toBe("npm run devnet:funding:packet -- --env .env.devnet.example");
    expect(programPhase?.status).toBe("BLOCKED");
    expect(programPhase?.command).toBe("npm run devnet:funding:packet -- --env .env.devnet.example");
    expect(report.blockers).toContain(
      "Deploy Devnet Program: Top up authority toward 3 devnet SOL before deployment.",
    );
  });

  it("routes protocol phase to inspection before initialization planning", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      opsReport: readyOpsReport(),
      devnetNextReport: nextAction({
        id: "inspect_protocol_state",
        command: "npm run devnet:inspect:protocol -- --env .env.devnet.example",
        risk: "READ_ONLY",
      }),
      readOnlyReadinessReport: {
        status: "BLOCKED",
        blockers: ["Protocol state has not been inspected."],
      },
    });

    const protocolPhase = report.phases.find((phase) => phase.id === "initialize_devnet_protocol");

    expect(report.phases.find((phase) => phase.id === "create_devnet_test_mint")?.status).toBe("READY_FOR_REVIEW");
    expect(report.phases.find((phase) => phase.id === "deploy_devnet_program")?.status).toBe("READY_FOR_REVIEW");
    expect(protocolPhase?.status).toBe("REVIEW_REQUIRED");
    expect(protocolPhase?.command).toBe("npm run devnet:inspect:protocol -- --env .env.devnet.example");
  });

  it("moves protocol initialization to review after program deployment", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      opsReport: readyOpsReport(),
      devnetNextReport: nextAction({
        id: "plan_protocol_initialization",
        command: "npm run devnet:init:protocol -- --env .env.devnet.example",
        risk: "READ_ONLY",
      }),
      readOnlyReadinessReport: {
        status: "BLOCKED",
        blockers: ["ProtocolConfig account is missing."],
      },
    });

    expect(report.phases.find((phase) => phase.id === "create_devnet_test_mint")?.status).toBe("READY_FOR_REVIEW");
    expect(report.phases.find((phase) => phase.id === "deploy_devnet_program")?.status).toBe("READY_FOR_REVIEW");
    expect(report.phases.find((phase) => phase.id === "initialize_devnet_protocol")?.status).toBe("REVIEW_REQUIRED");
    expect(report.nextActions).toContain("npm run devnet:init:protocol -- --env .env.devnet.example");
  });

  it("marks frontend and public product phases ready for review when read-only readiness passes", () => {
    const report = buildRypMissionStatusReport({
      envSource,
      opsReport: readyOpsReport(),
      devnetNextReport: nextAction({
        id: "prepare_deployment_receipt",
        command: "npm run devnet:deployment:receipt -- --profile read-only --env .env.devnet.example",
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
    expect(report.nextActions).toContain(
      "npm run devnet:deployment:receipt -- --profile read-only --env .env.devnet.example",
    );
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
      "verify:local",
      "protocol:idl:check",
      "protocol:smoke:localnet:wsl",
      "devnet:next",
      "testnet:readiness",
      "rewards:claim-merkle",
      "rewards:epoch:admin-plan",
      "rewards:holder-claim-packet",
    ],
  };
}

function nextAction(recommendation: DevnetNextReport["recommendation"]): DevnetNextReport {
  const requiresExplicitApproval = recommendation.risk === "DEVNET_MUTATION";
  const requiresExternalAction = Boolean(recommendation.manualAction);

  return {
    status: "NEXT_ACTION_READY",
    recommendation,
    operatorHandoff: {
      activeStep: recommendation.id,
      afterCompletionCommand: "npm run devnet:next -- --env .env.devnet.example",
      command: recommendation.command,
      operatorRule: operatorRule({
        requiresExplicitApproval,
        requiresExternalAction,
        risk: recommendation.risk,
      }),
      requiresExplicitApproval,
      requiresExternalAction,
      resumeCommand: "npm run devnet:next -- --env .env.devnet.example",
      risk: recommendation.risk,
    },
  };
}

function operatorRule({
  requiresExplicitApproval,
  requiresExternalAction,
  risk,
}: {
  requiresExplicitApproval: boolean;
  requiresExternalAction: boolean;
  risk: string;
}) {
  if (requiresExternalAction) {
    return "External action required first; run the command only for the funding/status handoff, then rerun devnet:next.";
  }
  if (requiresExplicitApproval) {
    return "Review the printed report and approve this step before running because it mutates devnet or ignored local key material.";
  }
  if (risk === "READ_ONLY") {
    return "Safe to run as a read-only inspection or report command; rerun devnet:next afterward.";
  }
  return "Review before running the next action; the risk level is not recognized.";
}
