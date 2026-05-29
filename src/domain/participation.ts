import type { Project, ProjectParticipation } from "./microverse";
import type { StakingTier } from "./microverse";
import { evaluateProjectEligibility, latestRiskDisclosure } from "./projectRegistry";

export type ProjectSlot = {
  slotIndex: number;
  participation?: ProjectParticipation;
  project?: Project;
};

export function buildProjectSlots({
  slotCount,
  participations,
  projects,
}: {
  slotCount: number;
  participations: ProjectParticipation[];
  projects: Project[];
}): ProjectSlot[] {
  return Array.from({ length: slotCount }, (_, index) => {
    const participation = participations.find((item) => item.slotIndex === index);
    return {
      slotIndex: index,
      participation,
      project: participation ? projects.find((project) => project.id === participation.projectId) : undefined,
    };
  });
}

export function activeParticipations(participations: ProjectParticipation[]) {
  return participations.filter((participation) => participation.status !== "COMPLETED");
}

export function hasProjectParticipation(participations: ProjectParticipation[], projectId: string) {
  return activeParticipations(participations).some((participation) => participation.projectId === projectId);
}

export function participationForProject(participations: ProjectParticipation[], projectId: string) {
  return activeParticipations(participations).find((participation) => participation.projectId === projectId);
}

export function nextAvailableProjectSlot(participations: ProjectParticipation[], slotCount: number) {
  const occupied = new Set(activeParticipations(participations).map((participation) => participation.slotIndex));

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    if (!occupied.has(slotIndex)) return slotIndex;
  }

  return undefined;
}

export function createPreparedParticipation({
  project,
  walletAddress,
  participations,
  slotCount,
  now = new Date().toISOString(),
}: {
  project: Project;
  walletAddress: string;
  participations: ProjectParticipation[];
  slotCount: number;
  now?: string;
}): ProjectParticipation | undefined {
  if (hasProjectParticipation(participations, project.id)) return undefined;

  const slotIndex = nextAvailableProjectSlot(participations, slotCount);
  const disclosure = latestRiskDisclosure(project);
  if (slotIndex === undefined || !disclosure) return undefined;

  return {
    id: `participation-${project.id}-${slotIndex}`,
    projectId: project.id,
    walletAddress,
    status: "PREPARED",
    slotIndex,
    joinedAt: now,
    updatedAt: now,
    acknowledgedDisclosureRef: `project:${project.id}:document:${disclosure.id}:${disclosure.version}`,
    milestoneIndex: 0,
  };
}

export function projectParticipationBlockingReasons({
  project,
  activeTier,
  participations,
  slotCount,
}: {
  project: Project;
  activeTier: StakingTier;
  participations: ProjectParticipation[];
  slotCount: number;
}) {
  const reasons = [...evaluateProjectEligibility(project, activeTier).reasons];

  if (hasProjectParticipation(participations, project.id)) {
    reasons.push("Project is already in your MicroVerse");
  }

  if (nextAvailableProjectSlot(participations, slotCount) === undefined) {
    reasons.push("No open project slot");
  }

  return reasons;
}
