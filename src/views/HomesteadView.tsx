import { lazy, Suspense, useMemo, useState } from "react";
import {
  Bot,
  Coins,
  Footprints,
  KeyRound,
  Leaf,
  LockKeyhole,
  Map,
  MousePointer2,
  ScrollText,
  Sprout,
  Vote,
  Wheat,
} from "lucide-react";
import { buildProjectSlots } from "../domain/participation";
import type { FarmVisualState, LocationKey, Project, ProjectParticipation, StakingTier } from "../types";
import { formatLabel, formatRyp } from "../utils/format";
import { Metric } from "../components/Metric";
import { buildMicroVerseSceneState, summarizeMicroVersePlots } from "../visual/microverseSceneState";
import type { MicroVerseNavigationMode } from "../visual/microverseSceneState";
import { MICROVERSE_LANDMARKS, type MicroVerseLandmark } from "../visual/microverseAssets";

const MicroVerseScene = lazy(() =>
  import("../visual/MicroVerseScene").then((module) => ({ default: module.MicroVerseScene })),
);

export function HomesteadView({
  activeTier,
  walletConnected,
  rypBalance,
  stakedAmount,
  projectSlotsUnlocked,
  weatherState,
  projects,
  participations,
  votingActive,
  seedBotUnlocked,
  onLocation,
  onProjectOpen,
}: {
  activeTier: StakingTier;
  walletConnected: boolean;
  rypBalance: number;
  stakedAmount: number;
  projectSlotsUnlocked: number;
  weatherState: FarmVisualState["weatherState"];
  projects: Project[];
  participations: ProjectParticipation[];
  votingActive: boolean;
  seedBotUnlocked: boolean;
  onLocation: (location: LocationKey) => void;
  onProjectOpen: (projectId: string) => void;
}) {
  const [navigationMode, setNavigationMode] = useState<MicroVerseNavigationMode>("STRATEGY");
  const mapMarkers = useMemo(
    () =>
      MICROVERSE_LANDMARKS.filter(
        (landmark): landmark is MicroVerseLandmark & { destination: LocationKey } => Boolean(landmark.destination),
      ),
    [],
  );
  const projectSlots = buildProjectSlots({ slotCount: projectSlotsUnlocked, participations, projects });
  const scene = useMemo(
    () =>
      buildMicroVerseSceneState({
        tier: activeTier,
        walletConnected,
        weather: weatherState,
        projectSlotsUnlocked,
        projects,
        participations,
      }),
    [activeTier, walletConnected, weatherState, projectSlotsUnlocked, projects, participations],
  );
  const plotSummary = useMemo(() => summarizeMicroVersePlots(scene.plots), [scene]);
  const harvestReady = plotSummary.some((summary) => summary.lifecycle === "HARVEST");

  return (
    <div className="homestead-view">
      <div className={`microverse-map ${navigationMode.toLowerCase()}-navigation`}>
        <Suspense fallback={<div className="microverse-scene-fallback" aria-hidden="true" />}>
          <MicroVerseScene navigationMode={navigationMode} scene={scene} onPlotSelect={onProjectOpen} />
        </Suspense>
        <div className="map-overlay" />
        <div className="map-title">
          <span>{activeTier === "NONE" ? "Wild Fields" : `${activeTier} Homestead`}</span>
          <strong>{walletConnected ? "Protocol state active" : "Wallet not connected"}</strong>
        </div>
        <div className="map-mode-toggle" aria-label="MicroVerse navigation mode">
          <button
            className={navigationMode === "STRATEGY" ? "active" : ""}
            onClick={() => setNavigationMode("STRATEGY")}
            title="Use glowing strategy regions"
          >
            <MousePointer2 size={16} />
            Strategy
          </button>
          <button
            className={navigationMode === "CHARACTER" ? "active" : ""}
            onClick={() => setNavigationMode("CHARACTER")}
            title="Walk the personal farm"
          >
            <Footprints size={16} />
            Walk
          </button>
        </div>
        <div className="visual-legend" aria-label="MicroVerse plot states">
          <span><i className="legend-dot open" />Open field</span>
          <span><i className="legend-dot active" />Active</span>
          <span><i className="legend-dot milestone" />Milestone</span>
          <span><i className="legend-dot research" />R&D</span>
          <span><i className="legend-dot donation" />Donation</span>
        </div>
        {mapMarkers.map((landmark) => {
          const locked = landmark.destination === "seedbot" && !seedBotUnlocked;
          const Icon = iconForLandmark(landmark, locked);
          return (
            <button
              className={`map-marker ${landmark.destination}-marker ${locked ? "locked" : ""}`}
              key={landmark.id}
              onClick={() => onLocation(landmark.destination)}
              title={landmark.label}
            >
              <Icon size={18} />
              <span>{labelForDestination(landmark.destination)}</span>
            </button>
          );
        })}
      </div>

      <div className="metric-row">
        <Metric icon={Coins} label="RYP balance" value={formatRyp(rypBalance)} />
        <Metric icon={Leaf} label="Staked" value={formatRyp(stakedAmount)} />
        <Metric icon={KeyRound} label="Golden Key" value={walletConnected && activeTier !== "NONE" ? "Active" : "Locked"} />
        <Metric icon={ScrollText} label="Voting NFT" value={votingActive ? "14d timer" : "Locked"} />
      </div>

      <section className="visual-state-panel">
        <div className="view-header">
          <div>
            <Wheat size={20} />
            <strong>Field Signals</strong>
          </div>
          <button
            className={`secondary-action compact-action ${harvestReady ? "ready" : ""}`}
            onClick={() => onLocation("harvest")}
          >
            <Wheat size={16} />
            Harvest Ledger
          </button>
        </div>
        <div className="visual-state-grid">
          {plotSummary.map((summary) => (
            <article className={`visual-state-card ${summary.lifecycle.toLowerCase()}`} key={summary.lifecycle}>
              <span>{summary.label}</span>
              <strong>{summary.count}</strong>
              <em>{summary.projectIds.length > 0 ? `${summary.projectIds.length} linked projects` : "Unassigned slots"}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="project-slot-panel">
        <div className="view-header">
          <div>
            <Leaf size={20} />
            <strong>Project Fields</strong>
          </div>
          <span>{projectSlotsUnlocked} slots unlocked</span>
        </div>
        <div className="project-slot-grid">
          {projectSlots.map((slot) => (
            <button
              key={slot.slotIndex}
              className={`project-slot ${slot.participation ? "active" : ""}`}
              onClick={() => (slot.project ? onProjectOpen(slot.project.id) : onLocation("explorer"))}
            >
              <span>Slot {slot.slotIndex + 1}</span>
              <strong>{slot.project?.name ?? "Open field"}</strong>
              <em>{slot.participation ? formatLabel(slot.participation.status) : "Ready for vetted project"}</em>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function iconForLandmark(landmark: MicroVerseLandmark, locked: boolean) {
  if (locked) return LockKeyhole;
  if (landmark.destination === "homestead") return Sprout;
  if (landmark.destination === "explorer") return Map;
  if (landmark.destination === "harvest") return Wheat;
  if (landmark.destination === "governance") return Vote;
  return Bot;
}

function labelForDestination(destination: LocationKey) {
  const labels: Record<LocationKey, string> = {
    homestead: "Homestead",
    explorer: "Explorer",
    harvest: "Harvest",
    governance: "Governance",
    seedbot: "SeedBot",
  };

  return labels[destination];
}
