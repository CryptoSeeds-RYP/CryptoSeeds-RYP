import type { Project, ProjectParticipation, StakingTier } from "../types";

export type MicroVersePlot = {
  id: string;
  projectId?: string;
  slotIndex: number;
  label: string;
  category: string;
  status: "EMPTY" | ProjectParticipation["status"];
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

const plotPositions = [
  { x: 0.25, y: 0.66 },
  { x: 0.45, y: 0.54 },
  { x: 0.65, y: 0.63 },
  { x: 0.76, y: 0.41 },
  { x: 0.34, y: 0.38 },
  { x: 0.56, y: 0.32 },
  { x: 0.18, y: 0.45 },
  { x: 0.84, y: 0.58 },
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
      const position = plotPositions[index] ?? plotPositions[plotPositions.length - 1];

      return {
        id: participation?.projectId ?? `empty-${index}`,
        projectId: project?.id,
        slotIndex: index,
        label: project?.name ?? "Open field",
        category: project?.category ?? "Unassigned",
        status: participation?.status ?? "EMPTY",
        progress: project?.progress ?? 0,
        x: position.x,
        y: position.y,
      };
    }),
  };
}
