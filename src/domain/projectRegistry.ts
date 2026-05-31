import type { Project, ProjectDocument } from "./microverse";
import type { StakingTier } from "./microverse";
import { canAccess } from "./tiering";

export type ProjectEligibilityResult = {
  eligible: boolean;
  reasons: string[];
};

export type ProjectDisclosureResult = {
  ready: boolean;
  warnings: string[];
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

export function evaluateProjectDisclosures(project: Project): ProjectDisclosureResult {
  const warnings: string[] = [];

  if (!project.receivingAccount.address) {
    warnings.push("Receiving account is not disclosed");
  }

  if (project.receivingAccount.verificationStatus === "REJECTED") {
    warnings.push("Receiving account verification was rejected");
  }

  if (project.receivingAccount.verificationStatus === "PENDING") {
    warnings.push("Receiving account verification is pending");
  }

  if (project.receivingAccount.verificationStatus === "COMMUNITY_REVIEW") {
    warnings.push("Receiving account remains in community review");
  }

  if (project.riskLevel === "DONATION" && project.receivingAccount.accountType !== "CHARITY") {
    warnings.push("Donation project must use a separated charity account");
  }

  if (project.riskLevel !== "DONATION" && project.receivingAccount.accountType === "CHARITY") {
    warnings.push("Reward-bearing or participation projects must not use charity accounts");
  }

  if (!project.disclosure.treasuryIndependent) {
    warnings.push("Treasury independence disclosure is missing");
  }

  if (project.disclosure.projectOwnerTokenHolding === "PENDING") {
    warnings.push("Project-owner token holding disclosure is pending");
  }

  if (project.disclosure.founderOrOperatorConflict) {
    warnings.push("Founder/operator conflict disclosure requires review");
  }

  if (project.disclosure.legalReviewRequired) {
    warnings.push("Legal review is required before public participation");
  }

  return {
    ready: warnings.length === 0,
    warnings,
  };
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

  const disclosureResult = evaluateProjectDisclosures(project);
  const blockingDisclosureWarnings = disclosureResult.warnings.filter(
    (warning) =>
      warning.includes("not disclosed") ||
      warning.includes("rejected") ||
      warning.includes("must use a separated charity account") ||
      warning.includes("must not use charity accounts") ||
      warning.includes("Legal review is required"),
  );

  reasons.push(...blockingDisclosureWarnings);

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
