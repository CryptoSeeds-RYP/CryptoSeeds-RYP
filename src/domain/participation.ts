import type { Project, ProjectParticipation } from "./microverse";

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

