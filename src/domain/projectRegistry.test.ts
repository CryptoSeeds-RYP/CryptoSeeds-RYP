import { describe, expect, it } from "vitest";
import { projects } from "../fixtures/protocolFixtures";
import {
  approvedProjectDocuments,
  evaluateProjectEligibility,
  evaluateProjectDisclosures,
  latestRiskDisclosure,
  requiredProjectDocuments,
} from "./projectRegistry";

describe("project registry", () => {
  it("requires approved documents for participation", () => {
    const chestnut = projects.find((project) => project.id === "chestnut-spain");

    expect(chestnut).toBeDefined();
    expect(requiredProjectDocuments(chestnut!).length).toBe(3);
    expect(approvedProjectDocuments(chestnut!).length).toBe(3);
    expect(latestRiskDisclosure(chestnut!)?.type).toBe("RISK_DISCLOSURE");
  });

  it("marks approved open projects as eligible when tier is sufficient", () => {
    const solar = projects.find((project) => project.id === "solar-water-node");
    const eligibility = evaluateProjectEligibility(solar!, "SPROUT");

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reasons).toEqual([]);
  });

  it("surfaces project-owner and charity account disclosures", () => {
    const chestnut = projects.find((project) => project.id === "chestnut-spain");
    const glade = projects.find((project) => project.id === "steward-glade");

    expect(chestnut?.receivingAccount.accountType).toBe("PROJECT_OWNER");
    expect(chestnut?.receivingAccount.custodyModel).toBe("OWNER_CONTROLLED");
    expect(evaluateProjectDisclosures(chestnut!).warnings).toContain(
      "Receiving account remains in community review",
    );

    expect(glade?.riskLevel).toBe("DONATION");
    expect(glade?.receivingAccount.accountType).toBe("CHARITY");
    expect(glade?.receivingAccount.custodyModel).toBe("CHARITY_CONTROLLED");
    expect(evaluateProjectDisclosures(glade!).ready).toBe(true);
  });

  it("blocks participation when governance is not approved", () => {
    const hemp = projects.find((project) => project.id === "hemp-greenhouse");
    const eligibility = evaluateProjectEligibility(hemp!, "FRUIT");

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain("Participation is not open");
    expect(eligibility.reasons).toContain("Governance approval is not complete");
    expect(eligibility.reasons).toContain("Receiving account is not disclosed");
    expect(eligibility.reasons).toContain("Legal review is required before public participation");
  });

  it("blocks projects when the user tier is too low", () => {
    const solar = projects.find((project) => project.id === "solar-water-node");
    const eligibility = evaluateProjectEligibility(solar!, "SEED");

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain("Requires SPROUT tier");
  });
});
