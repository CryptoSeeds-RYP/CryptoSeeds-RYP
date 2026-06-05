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

const participationReadyStatuses = new Set(["OPEN", "ACTIVE", "MILESTONE_REACHED", "HARVEST_AVAILABLE"]);

export function requiredProjectDocuments(project: Project): ProjectDocument[] {
  return project.documents.filter((document) => document.requiredForParticipation);
}

export function approvedProjectDocuments(project: Project): ProjectDocument[] {
  return project.documents.filter((document) => document.status === "APPROVED");
}

export function latestRiskDisclosure(project: Project): ProjectDocument | undefined {
  return project.documents
    .filter((document) => document.type === "RISK_DISCLOSURE")
    .sort((left, right) => compareDocumentVersions(right.version, left.version))[0];
}

export function validateProjectDocumentSet(project: Project): ProjectDisclosureResult {
  const warnings: string[] = [];
  const seenDocumentIds = new Set<string>();

  for (const document of project.documents) {
    const documentId = document.id.trim().toLowerCase();
    if (!documentId) {
      warnings.push("Project document id is missing");
    } else if (seenDocumentIds.has(documentId)) {
      warnings.push(`Duplicate project document id: ${document.id}`);
    }
    seenDocumentIds.add(documentId);

    if (!document.title.trim()) {
      warnings.push(`Project document ${document.id} title is missing`);
    }
    if (!document.version.trim()) {
      warnings.push(`Project document ${document.id} version is missing`);
    }
    if (Number.isNaN(Date.parse(document.issuedAt))) {
      warnings.push(`Project document ${document.id} issuedAt is invalid`);
    }
    if (document.requiredForParticipation && (!document.uri || !document.contentHash)) {
      warnings.push("Required documents are missing URI or content hash");
    }
    if (document.contentHash && !document.contentHash.includes(":")) {
      warnings.push(`Project document ${document.id} content hash should include an algorithm prefix`);
    }
  }

  return {
    ready: warnings.length === 0,
    warnings: [...new Set(warnings)],
  };
}

export function evaluateProjectDisclosures(project: Project): ProjectDisclosureResult {
  const warnings: string[] = [];
  const riskDisclosure = latestRiskDisclosure(project);
  const documentSet = validateProjectDocumentSet(project);

  warnings.push(...documentSet.warnings);

  if (!riskDisclosure) {
    warnings.push("Risk disclosure is missing");
  } else if (riskDisclosure.status !== "APPROVED") {
    warnings.push("Risk disclosure is not approved");
  }

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

  if (project.operator.verificationStatus === "REJECTED") {
    warnings.push("Operator verification was rejected");
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

  if (!participationReadyStatuses.has(project.status)) {
    reasons.push(`Project status ${project.status} is not open for participation`);
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
      warning.includes("Risk disclosure is missing") ||
      warning.includes("Risk disclosure is not approved") ||
      warning.includes("Required documents are missing URI or content hash") ||
      warning.includes("Duplicate project document id") ||
      warning.includes("Project document id is missing") ||
      warning.includes("version is missing") ||
      warning.includes("issuedAt is invalid") ||
      warning.includes("content hash should include an algorithm prefix") ||
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

export function compareDocumentVersions(right: string, left: string) {
  const rightParts = versionParts(right);
  const leftParts = versionParts(left);
  const partCount = Math.max(rightParts.length, leftParts.length);
  for (let index = 0; index < partCount; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return right.localeCompare(left);
}

function versionParts(version: string) {
  return version
    .replace(/^v/i, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}
