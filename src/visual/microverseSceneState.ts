import type { LocationKey, Project, ProjectParticipation, StakingTier } from "../types";
import {
  lifecycleForProjectPlot,
  visualKindForProject,
  type ProjectLifecycleVisualState,
  type ProjectVisualKind,
} from "./projectVisuals";

export type MicroVersePlot = {
  id: string;
  projectId?: string;
  slotIndex: number;
  label: string;
  category: string;
  riskLevel?: Project["riskLevel"];
  projectStatus?: Project["status"];
  status: "EMPTY" | ProjectParticipation["status"];
  lifecycle: ProjectLifecycleVisualState;
  visualKind: ProjectVisualKind;
  progress: number;
  x: number;
  y: number;
};

export type MicroVerseSceneState = {
  tier: StakingTier;
  walletConnected: boolean;
  weather: "CLEAR" | "RAIN" | "GOLDEN_HARVEST" | "STORM" | "SEASONAL_EVENT";
  plots: MicroVersePlot[];
};

export type MicroVerseNavigationMode = "STRATEGY" | "CHARACTER";

export type MicroVerseCameraFocus = "home" | LocationKey | `landmark:${string}`;

export type MicroVerseCameraFocusRequest = {
  target: MicroVerseCameraFocus;
  nonce: number;
};

export type MicroVersePlotSummary = {
  lifecycle: ProjectLifecycleVisualState;
  label: string;
  count: number;
  projectIds: string[];
};

export const MICROVERSE_PLOT_POSITIONS = [
  { x: 0.31, y: 0.66 },
  { x: 0.47, y: 0.52 },
  { x: 0.61, y: 0.63 },
  { x: 0.68, y: 0.42 },
  { x: 0.38, y: 0.38 },
  { x: 0.57, y: 0.32 },
  { x: 0.22, y: 0.53 },
  { x: 0.75, y: 0.58 },
];

export function buildMicroVerseSceneState({
  tier,
  walletConnected,
  weather,
  projectSlotsUnlocked,
  projects,
  participations,
}: {
  tier: StakingTier;
  walletConnected: boolean;
  weather: MicroVerseSceneState["weather"];
  projectSlotsUnlocked: number;
  projects: Project[];
  participations: ProjectParticipation[];
}): MicroVerseSceneState {
  return {
    tier,
    walletConnected,
    weather,
    plots: Array.from({ length: projectSlotsUnlocked }, (_, index) => {
      const participation = participations.find((item) => item.slotIndex === index);
      const project = participation
        ? projects.find((candidate) => candidate.id === participation.projectId)
        : undefined;
      const position = MICROVERSE_PLOT_POSITIONS[index] ?? MICROVERSE_PLOT_POSITIONS[MICROVERSE_PLOT_POSITIONS.length - 1];

      return {
        id: participation?.projectId ?? `empty-${index}`,
        projectId: project?.id,
        slotIndex: index,
        label: project?.name ?? "Open field",
        category: project?.category ?? "Unassigned",
        riskLevel: project?.riskLevel,
        projectStatus: project?.status,
        status: participation?.status ?? "EMPTY",
        lifecycle: lifecycleForProjectPlot({ project, participation }),
        visualKind: visualKindForProject(project),
        progress: project?.progress ?? 0,
        x: position.x,
        y: position.y,
      };
    }),
  };
}

const lifecycleSummaryLabels: Record<ProjectLifecycleVisualState, string> = {
  EMPTY: "Open fields",
  PREPARING: "Preparing",
  ACTIVE: "Active",
  MILESTONE: "Milestones",
  HARVEST: "Harvest ready",
  COMPLETED: "Completed",
  PAUSED: "Paused",
};

const lifecycleSummaryOrder: ProjectLifecycleVisualState[] = [
  "HARVEST",
  "MILESTONE",
  "ACTIVE",
  "PREPARING",
  "COMPLETED",
  "PAUSED",
  "EMPTY",
];

export function summarizeMicroVersePlots(plots: MicroVersePlot[]): MicroVersePlotSummary[] {
  return lifecycleSummaryOrder
    .map((lifecycle) => {
      const matchingPlots = plots.filter((plot) => plot.lifecycle === lifecycle);
      return {
        lifecycle,
        label: lifecycleSummaryLabels[lifecycle],
        count: matchingPlots.length,
        projectIds: matchingPlots.flatMap((plot) => (plot.projectId ? [plot.projectId] : [])),
      };
    })
    .filter((summary) => summary.count > 0);
}
