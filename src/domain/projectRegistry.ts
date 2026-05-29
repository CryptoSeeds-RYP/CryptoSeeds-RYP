import type { Project, ProjectDocument } from "./microverse";
import type { StakingTier } from "./microverse";
import { canAccess } from "./tiering";

export type ProjectEligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

export function requiredProjectDocuments(project: Project): ProjectDocument[] {
  return project.documents.filter((document) => document.requiredForParticipation);
}

export function approvedProjectDocuments(project: Project): ProjectDocument[] {
  return project.documents.filter((document) => document.status === "APPROVED");
}

export function latestRiskDisclosure(project: Project): ProjectDocument | undefined {
  return project.documents
    .filter((document) => document.type === "RISK_DISCLOSURE")
    .sort((left, right) => right.version.localeCompare(left.version))[0];
}

export function evaluateProjectEligibility(project: Project, activeTier: StakingTier): ProjectEligibilityResult {
  const reasons: string[] = [];

  if (!canAccess(project.requiredTier, activeTier)) {
    reasons.push(`Requires ${project.requiredTier} tier`);
  }

  if (!project.participationOpen) {
    reasons.push("Participation is not open");
  }

  if (project.governance.status !== "APPROVED") {
    reasons.push("Governance approval is not complete");
  }

  const missingRequiredDocuments = requiredProjectDocuments(project).filter(
    (document) => document.status !== "APPROVED",
  );

  if (missingRequiredDocuments.length > 0) {
    reasons.push("Required documents are not approved");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

