import type { Project, ProjectParticipation } from "./microverse";

export type ProjectMilestoneView = {
  label: string;
  index: number;
  state: "COMPLETED" | "CURRENT" | "UPCOMING";
};

export function buildProjectMilestoneViews({
  project,
  participation,
}: {
  project: Project;
  participation?: ProjectParticipation;
}): ProjectMilestoneView[] {
  const currentIndex = participation?.milestoneIndex ?? -1;

  return project.milestones.map((label, index) => {
    if (currentIndex < 0) return { label, index, state: "UPCOMING" };
    if (index < currentIndex) return { label, index, state: "COMPLETED" };
    if (index === currentIndex) return { label, index, state: "CURRENT" };
    return { label, index, state: "UPCOMING" };
  });
}
