import { describe, expect, it } from "vitest";
import {
  agentSafetyRules,
  allAutomatedRunbookItemsAvoidSigning,
  approvalRequiredForSensitiveRunbookItems,
  blockedRunbookItemsRemainApprovalGated,
  buildMaintenanceRunbook,
  maintenanceRunbook,
} from "./operations";

describe("operations model", () => {
  it("keeps AI-assisted operations away from signing and key custody", () => {
    expect(agentSafetyRules.find((rule) => rule.id === "no-private-keys")?.allowed).toBe(false);
    expect(agentSafetyRules.find((rule) => rule.id === "no-wallet-signing")?.allowed).toBe(false);
    expect(agentSafetyRules.find((rule) => rule.id === "no-silent-broadcast")?.allowed).toBe(false);
  });

  it("keeps sensitive runbook items approval-gated", () => {
    expect(approvalRequiredForSensitiveRunbookItems()).toBe(true);
    expect(blockedRunbookItemsRemainApprovalGated()).toBe(true);
  });

  it("provides simple scripted checks for non-specialist operation", () => {
    const scripted = maintenanceRunbook.filter((item) => item.script);

    expect(scripted.map((item) => item.id)).toEqual([
      "ci-verification-gate",
      "local-verification-gate",
      "app-regression-check",
      "copy-visual-safety",
      "secret-material-audit",
      "ryp-mission-status",
      "ryp-token-health",
      "devnet-funding-packet",
      "devnet-protocol-state-inspection",
      "devnet-deployment-receipt",
      "public-readonly-testnet-gate",
      "devnet-broadcast-gate",
      "protocol-drift-gate",
      "protocol-lint-gate",
      "protocol-localnet-smoke-gate",
      "reward-epoch-admin-plan",
    ]);
    expect(allAutomatedRunbookItemsAvoidSigning()).toBe(true);
  });

  it("uses the selected ops env file for devnet runbook commands", () => {
    const runbook = buildMaintenanceRunbook({ opsEnvFile: ".env.devnet.staging" });

    expect(runbook.find((item) => item.id === "ryp-mission-status")?.script).toBe(
      "npm.cmd run mission:status -- --env .env.devnet.staging",
    );
    expect(runbook.find((item) => item.id === "devnet-funding-packet")?.script).toBe(
      "npm.cmd run devnet:funding:packet -- --env .env.devnet.staging",
    );
    expect(runbook.find((item) => item.id === "public-readonly-testnet-gate")?.script).toBe(
      "npm.cmd run testnet:readiness -- --profile read-only --env .env.devnet.staging",
    );
    expect(allAutomatedRunbookItemsAvoidSigning(runbook)).toBe(true);
  });

  it("falls back to the default env file for unsafe runbook env input", () => {
    const runbook = buildMaintenanceRunbook({ opsEnvFile: ".env.devnet.staging && bad" });

    expect(runbook.find((item) => item.id === "devnet-funding-packet")?.script).toBe(
      "npm.cmd run devnet:funding:packet -- --env .env.devnet.example",
    );
  });

  it("keeps the localnet smoke gate monitor-only and separate from deployment approval", () => {
    const smoke = maintenanceRunbook.find((item) => item.id === "protocol-localnet-smoke-gate");

    expect(smoke?.automationMode).toBe("MONITOR_ONLY");
    expect(smoke?.approvalRequired).toBe(false);
    expect(smoke?.script).toBe("npm.cmd run protocol:smoke:localnet:wsl");
    expect(smoke?.aiAgentBoundary).toContain("must not treat a localnet pass as devnet deployment approval");
  });

  it("keeps protocol lint monitor-only and review-bound", () => {
    const lint = maintenanceRunbook.find((item) => item.id === "protocol-lint-gate");

    expect(lint?.automationMode).toBe("MONITOR_ONLY");
    expect(lint?.approvalRequired).toBe(false);
    expect(lint?.script).toBe("npm.cmd run protocol:lint");
    expect(lint?.aiAgentBoundary).toContain("must not change protocol behavior");
  });

  it("provides a one-command full local verification gate", () => {
    const verification = maintenanceRunbook.find((item) => item.id === "local-verification-gate");

    expect(verification?.automationMode).toBe("MONITOR_ONLY");
    expect(verification?.approvalRequired).toBe(false);
    expect(verification?.script).toBe("npm.cmd run verify:local");
    expect(verification?.aiAgentBoundary).toContain("must not treat a local pass as devnet deployment");
  });

  it("provides a portable CI verification gate separate from local protocol smoke", () => {
    const verification = maintenanceRunbook.find((item) => item.id === "ci-verification-gate");

    expect(verification?.automationMode).toBe("MONITOR_ONLY");
    expect(verification?.approvalRequired).toBe(false);
    expect(verification?.script).toBe("npm.cmd run verify:ci");
    expect(verification?.aiAgentBoundary).toContain("stronger local protocol smoke gate");
  });

  it("keeps tracked secret material audit monitor-only", () => {
    const secretAudit = maintenanceRunbook.find((item) => item.id === "secret-material-audit");

    expect(secretAudit?.automationMode).toBe("MONITOR_ONLY");
    expect(secretAudit?.approvalRequired).toBe(false);
    expect(secretAudit?.script).toBe("npm.cmd run secrets:audit");
    expect(secretAudit?.aiAgentBoundary).toContain("must not print");
  });

  it("keeps the devnet deployment receipt read-only and approval-gated", () => {
    const receipt = maintenanceRunbook.find((item) => item.id === "devnet-deployment-receipt");

    expect(receipt?.automationMode).toBe("DRAFT_ONLY");
    expect(receipt?.approvalRequired).toBe(true);
    expect(receipt?.script).toContain("devnet:deployment:receipt");
    expect(receipt?.aiAgentBoundary).toContain("must not treat the receipt as launch approval");
    expect(receipt?.aiAgentBoundary).toContain("enable broadcast");
  });

  it("keeps reward epoch admin planning plan-only and approval-gated", () => {
    const rewardPlan = maintenanceRunbook.find((item) => item.id === "reward-epoch-admin-plan");

    expect(rewardPlan?.automationMode).toBe("DRAFT_ONLY");
    expect(rewardPlan?.approvalRequired).toBe(true);
    expect(rewardPlan?.script).toContain("rewards:epoch:admin-plan");
    expect(rewardPlan?.aiAgentBoundary).toContain("must not sign");
    expect(rewardPlan?.aiAgentBoundary).toContain("move reward tokens");
  });
});
