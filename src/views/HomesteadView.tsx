import { Bot, Coins, KeyRound, Leaf, LockKeyhole, Map, ScrollText, Sprout, Vote, Wheat } from "lucide-react";
import { buildProjectSlots } from "../domain/participation";
import type { LocationKey, Project, ProjectParticipation, StakingTier } from "../types";
import { formatLabel, formatRyp } from "../utils/format";
import { Metric } from "../components/Metric";

export function HomesteadView({
  activeTier,
  walletConnected,
  rypBalance,
  stakedAmount,
  projectSlotsUnlocked,
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
  projects: Project[];
  participations: ProjectParticipation[];
  votingActive: boolean;
  seedBotUnlocked: boolean;
  onLocation: (location: LocationKey) => void;
  onProjectOpen: (projectId: string) => void;
}) {
  const projectSlots = buildProjectSlots({ slotCount: projectSlotsUnlocked, participations, projects });

  return (
    <div className="homestead-view">
      <div className="microverse-map">
        <img src="/assets/microverse-river-delta.jpg" alt="CryptoSeeds regenerative MicroVerse" />
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
