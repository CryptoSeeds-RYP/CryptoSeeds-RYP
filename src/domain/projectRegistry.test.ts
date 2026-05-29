import { describe, expect, it } from "vitest";
import { projects } from "../fixtures/protocolFixtures";
import {
  approvedProjectDocuments,
  evaluateProjectEligibility,
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

  it("blocks participation when governance is not approved", () => {
    const hemp = projects.find((project) => project.id === "hemp-greenhouse");
    const eligibility = evaluateProjectEligibility(hemp!, "FRUIT");

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain("Participation is not open");
    expect(eligibility.reasons).toContain("Governance approval is not complete");
  });

  it("blocks projects when the user tier is too low", () => {
    const solar = projects.find((project) => project.id === "solar-water-node");
    const eligibility = evaluateProjectEligibility(solar!, "SEED");

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain("Requires SPROUT tier");
  });
});

