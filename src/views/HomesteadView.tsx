import { lazy, Suspense, useMemo } from "react";
import { Bot, Coins, KeyRound, Leaf, LockKeyhole, Map, ScrollText, Sprout, Vote, Wheat } from "lucide-react";
import { buildProjectSlots } from "../domain/participation";
import type { FarmVisualState, LocationKey, Project, ProjectParticipation, StakingTier } from "../types";
import { formatLabel, formatRyp } from "../utils/format";
import { Metric } from "../components/Metric";
import { buildMicroVerseSceneState } from "../visual/microverseSceneState";

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

  return (
    <div className="homestead-view">
      <div className="microverse-map">
        <Suspense fallback={<div className="microverse-scene-fallback" aria-hidden="true" />}>
          <MicroVerseScene scene={scene} onPlotSelect={onProjectOpen} />
        </Suspense>
        <div className="map-overlay" />
        <div className="map-title">
          <span>{activeTier === "NONE" ? "Wild Fields" : `${activeTier} Homestead`}</span>
          <strong>{walletConnected ? "Protocol state active" : "Wallet not connected"}</strong>
        </div>
        <button className="map-marker homestead-marker" onClick={() => onLocation("homestead")} title="Homestead">
          <Sprout size={18} />
          <span>Homestead</span>
        </button>
        <button className="map-marker explorer-marker" onClick={() => onLocation("explorer")} title="Explorer's Map">
          <Map size={18} />
          <span>Explorer</span>
        </button>
        <button className="map-marker harvest-marker" onClick={() => onLocation("harvest")} title="Harvest Ledger">
          <Wheat size={18} />
          <span>Harvest</span>
        </button>
        <button className="map-marker governance-marker" onClick={() => onLocation("governance")} title="Governance Hall">
          <Vote size={18} />
          <span>Governance</span>
        </button>
        <button className={`map-marker seedbot-marker ${seedBotUnlocked ? "" : "locked"}`} onClick={() => onLocation("seedbot")} title="SeedBot Terminal">
          {seedBotUnlocked ? <Bot size={18} /> : <LockKeyhole size={18} />}
          <span>SeedBot</span>
        </button>
      </div>

      <div className="metric-row">
        <Metric icon={Coins} label="RYP balance" value={formatRyp(rypBalance)} />
        <Metric icon={Leaf} label="Staked" value={formatRyp(stakedAmount)} />
        <Metric icon={KeyRound} label="Golden Key" value={walletConnected && activeTier !== "NONE" ? "Active" : "Locked"} />
        <Metric icon={ScrollText} label="Voting NFT" value={votingActive ? "14d timer" : "Locked"} />
      </div>

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
