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
    ]);
    expect(allAutomatedRunbookItemsAvoidSigning()).toBe(true);
  });

  it("keeps the devnet deployment receipt read-only and approval-gated", () => {
    const receipt = maintenanceRunbook.find((item) => item.id === "devnet-deployment-receipt");

    expect(receipt?.automationMode).toBe("DRAFT_ONLY");
    expect(receipt?.approvalRequired).toBe(true);
    expect(receipt?.script).toContain("devnet:deployment:receipt");
    expect(receipt?.aiAgentBoundary).toContain("must not treat the receipt as launch approval");
    expect(receipt?.aiAgentBoundary).toContain("enable broadcast");
  });
});
