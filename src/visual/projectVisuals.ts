import type { Project, ProjectParticipation } from "../types";

export type ProjectVisualKind =
  | "OPEN_FIELD"
  | "GROVE"
  | "RESEARCH_GREENHOUSE"
  | "WATER_NODE"
  | "DONATION_GLADE"
  | "ECOSYSTEM_PLOT";

export type ProjectLifecycleVisualState =
  | "EMPTY"
  | "PREPARING"
  | "ACTIVE"
  | "MILESTONE"
  | "HARVEST"
  | "COMPLETED"
  | "PAUSED";

export function visualKindForProject(project?: Project): ProjectVisualKind {
  if (!project) return "OPEN_FIELD";
  if (project.riskLevel === "DONATION" || project.category === "Donation") return "DONATION_GLADE";
  if (project.category === "R&D") return "RESEARCH_GREENHOUSE";
  if (project.category === "Water systems") return "WATER_NODE";
  if (project.category === "Regenerative agriculture") return "GROVE";
  return "ECOSYSTEM_PLOT";
}

export function lifecycleForProjectPlot({
  project,
  participation,
}: {
  project?: Project;
  participation?: ProjectParticipation;
}): ProjectLifecycleVisualState {
  if (!project || !participation) return "EMPTY";
  if (project.status === "PAUSED") return "PAUSED";
  if (project.status === "COMPLETED" || participation.status === "COMPLETED") return "COMPLETED";
  if (participation.status === "HARVEST_AVAILABLE" || project.status === "HARVEST_AVAILABLE") return "HARVEST";
  if (participation.status === "MILESTONE_REACHED" || project.status === "MILESTONE_REACHED") {
    return "MILESTONE";
  }
  if (participation.status === "REVIEWED" || participation.status === "PREPARED") return "PREPARING";
  return "ACTIVE";
}
