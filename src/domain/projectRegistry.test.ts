import { describe, expect, it } from "vitest";
import { projects } from "../fixtures/protocolFixtures";
import {
  approvedProjectDocuments,
  compareDocumentVersions,
  evaluateProjectEligibility,
  evaluateProjectDisclosures,
  latestRiskDisclosure,
  requiredProjectDocuments,
  validateProjectDocumentSet,
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
    expect(eligibility.reasons).toContain("Project status GOVERNANCE_VOTE is not open for participation");
    expect(eligibility.reasons).toContain("Receiving account is not disclosed");
    expect(eligibility.reasons).toContain("Legal review is required before public participation");
  });

  it("blocks projects when the user tier is too low", () => {
    const solar = projects.find((project) => project.id === "solar-water-node");
    const eligibility = evaluateProjectEligibility(solar!, "SEED");

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons).toContain("Requires SPROUT tier");
  });

  it("sorts risk disclosure versions numerically instead of lexicographically", () => {
    const solar = projects.find((project) => project.id === "solar-water-node")!;
    const withNewDisclosure = {
      ...solar,
      documents: [
        ...solar.documents,
        {
          ...solar.documents.find((document) => document.type === "RISK_DISCLOSURE")!,
          id: "solar-risk-v2",
          version: "v2.0",
        },
        {
          ...solar.documents.find((document) => document.type === "RISK_DISCLOSURE")!,
          id: "solar-risk-v10",
          version: "v10.0",
        },
      ],
    };

    expect(compareDocumentVersions("v10.0", "v2.0")).toBeGreaterThan(0);
    expect(latestRiskDisclosure(withNewDisclosure)?.id).toBe("solar-risk-v10");
  });

  it("blocks projects with missing approved risk disclosure or document proof", () => {
    const solar = projects.find((project) => project.id === "solar-water-node")!;
    const withoutRiskDisclosure = {
      ...solar,
      documents: solar.documents.filter((document) => document.type !== "RISK_DISCLOSURE"),
    };
    const missingDocumentProof = {
      ...solar,
      documents: solar.documents.map((document) =>
        document.id === "solar-risk" ? { ...document, contentHash: undefined } : document,
      ),
    };
    const rejectedOperator = {
      ...solar,
      operator: { ...solar.operator, verificationStatus: "REJECTED" as const },
    };

    expect(evaluateProjectEligibility(withoutRiskDisclosure, "SPROUT").reasons).toContain("Risk disclosure is missing");
    expect(evaluateProjectEligibility(missingDocumentProof, "SPROUT").reasons).toContain(
      "Required documents are missing URI or content hash",
    );
    expect(evaluateProjectEligibility(rejectedOperator, "SPROUT").reasons).toContain("Operator verification was rejected");
  });

  it("validates project document integrity before eligibility", () => {
    const solar = projects.find((project) => project.id === "solar-water-node")!;
    const brokenDocuments = {
      ...solar,
      documents: [
        ...solar.documents,
        {
          ...solar.documents[0],
          id: solar.documents[0].id.toUpperCase(),
          version: "",
          issuedAt: "not-a-date",
          contentHash: "missing-prefix",
        },
      ],
    };

    const documentSet = validateProjectDocumentSet(brokenDocuments);
    expect(documentSet.ready).toBe(false);
    expect(documentSet.warnings).toContain("Duplicate project document id: SOLAR-OPERATOR");
    expect(documentSet.warnings).toContain("Project document SOLAR-OPERATOR version is missing");
    expect(documentSet.warnings).toContain("Project document SOLAR-OPERATOR issuedAt is invalid");
    expect(documentSet.warnings).toContain(
      "Project document SOLAR-OPERATOR content hash should include an algorithm prefix",
    );
    expect(evaluateProjectEligibility(brokenDocuments, "SPROUT").eligible).toBe(false);
  });
});
