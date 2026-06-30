import { describe, expect, it } from "vitest";
import {
  agentSafetyRules,
  allAutomatedRunbookItemsAvoidSigning,
  approvalRequiredForSensitiveRunbookItems,
  blockedRunbookItemsRemainApprovalGated,
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
      "local-verification-gate",
      "app-regression-check",
      "copy-visual-safety",
      "ryp-mission-status",
      "ryp-token-health",
      "devnet-funding-packet",
      "devnet-protocol-state-inspection",
      "devnet-deployment-receipt",
      "public-readonly-testnet-gate",
      "devnet-broadcast-gate",
      "protocol-drift-gate",
      "protocol-localnet-smoke-gate",
      "reward-epoch-admin-plan",
    ]);
    expect(allAutomatedRunbookItemsAvoidSigning()).toBe(true);
  });

  it("keeps the localnet smoke gate monitor-only and separate from deployment approval", () => {
    const smoke = maintenanceRunbook.find((item) => item.id === "protocol-localnet-smoke-gate");

    expect(smoke?.automationMode).toBe("MONITOR_ONLY");
    expect(smoke?.approvalRequired).toBe(false);
    expect(smoke?.script).toBe("npm.cmd run protocol:smoke:localnet:wsl");
    expect(smoke?.aiAgentBoundary).toContain("must not treat a localnet pass as devnet deployment approval");
  });

  it("provides a one-command full local verification gate", () => {
    const verification = maintenanceRunbook.find((item) => item.id === "local-verification-gate");

    expect(verification?.automationMode).toBe("MONITOR_ONLY");
    expect(verification?.approvalRequired).toBe(false);
    expect(verification?.script).toBe("npm.cmd run verify:local");
    expect(verification?.aiAgentBoundary).toContain("must not treat a local pass as devnet deployment");
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
