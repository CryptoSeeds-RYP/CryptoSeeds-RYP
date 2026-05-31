import { lazy, Suspense, useMemo, useState } from "react";
import {
  Bot,
  Coins,
  Footprints,
  Home,
  KeyRound,
  Leaf,
  LockKeyhole,
  Map,
  MousePointer2,
  Palette,
  ScrollText,
  Vote,
  Wheat,
} from "lucide-react";
import { homesteadProfileForTier } from "../domain/homesteadCustomization";
import { buildProjectSlots } from "../domain/participation";
import type { FarmVisualState, LocationKey, Project, ProjectParticipation, StakingTier } from "../types";
import { formatLabel, formatRyp } from "../utils/format";
import { Metric } from "../components/Metric";
import { buildMicroVerseSceneState, summarizeMicroVersePlots } from "../visual/microverseSceneState";
import type {
  MicroVerseCameraFocus,
  MicroVerseCameraFocusRequest,
  MicroVerseNavigationMode,
} from "../visual/microverseSceneState";
import { MICROVERSE_LANDMARKS, type MicroVerseLandmark } from "../visual/microverseAssets";

const MicroVerseScene = lazy(() =>
  import("../visual/MicroVerseScene").then((module) => ({ default: module.MicroVerseScene })),
);

type WorldFocusTarget =
  | { kind: "landmark"; id: string }
  | { kind: "plot"; id: string };

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
  const [focusedTarget, setFocusedTarget] = useState<WorldFocusTarget | null>(null);
  const [cameraFocus, setCameraFocus] = useState<MicroVerseCameraFocusRequest>({ target: "home", nonce: 0 });
  const homesteadProfile = homesteadProfileForTier(activeTier);
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
  const focusedLandmark =
    focusedTarget?.kind === "landmark" ? MICROVERSE_LANDMARKS.find((landmark) => landmark.id === focusedTarget.id) : undefined;
  const focusedPlot = focusedTarget?.kind === "plot" ? scene.plots.find((plot) => plot.id === focusedTarget.id) : undefined;
  const focusDetails = worldFocusDetails({
    activeTier,
    focusedLandmark,
    focusedPlot,
    projectSlotsUnlocked,
    seedBotUnlocked,
    walletConnected,
  });

  function focusCamera(target: MicroVerseCameraFocus) {
    setCameraFocus((current) => ({ target, nonce: current.nonce + 1 }));
  }

  function focusLandmark(landmark: MicroVerseLandmark & { destination: LocationKey }) {
    setFocusedTarget({ kind: "landmark", id: landmark.id });
    focusCamera(landmark.destination);
  }

  function focusDestination(destination: LocationKey | null) {
    if (!destination) {
      setFocusedTarget(null);
      return;
    }
    const landmark = mapMarkers.find((candidate) => candidate.destination === destination);
    if (landmark) setFocusedTarget({ kind: "landmark", id: landmark.id });
  }

  return (
    <div className="homestead-view">
      <div className={`microverse-map ${navigationMode.toLowerCase()}-navigation`}>
        <Suspense fallback={<div className="microverse-scene-fallback" aria-hidden="true" />}>
          <MicroVerseScene
            cameraFocus={cameraFocus}
            navigationMode={navigationMode}
            scene={scene}
            onPlotFocus={(plotId) => setFocusedTarget(plotId ? { kind: "plot", id: plotId } : null)}
            onPlotSelect={onProjectOpen}
            onLandmarkFocus={focusDestination}
            onLandmarkSelect={(destination) => {
              const landmark = mapMarkers.find((candidate) => candidate.destination === destination);
              if (landmark) focusLandmark(landmark);
            }}
          />
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
        <div className="map-district-dock" aria-label="MicroVerse district focus">
          {mapMarkers.map((landmark) => {
            const locked = landmark.destination === "seedbot" && !seedBotUnlocked;
            const Icon = iconForLandmark(landmark, locked);
            const active = focusedTarget?.kind === "landmark" && focusedTarget.id === landmark.id;
            return (
              <button
                className={active ? "active" : ""}
                key={`district-${landmark.id}`}
                onClick={() => focusLandmark(landmark)}
                title={landmark.label}
              >
                <Icon size={16} />
                <span>{labelForDestination(landmark.destination)}</span>
              </button>
            );
          })}
        </div>
        <div className="visual-legend" aria-label="MicroVerse plot states">
          <span><i className="legend-dot open" />Open field</span>
          <span><i className="legend-dot active" />Active</span>
          <span><i className="legend-dot milestone" />Milestone</span>
          <span><i className="legend-dot research" />R&D</span>
          <span><i className="legend-dot donation" />Donation</span>
        </div>
        <WorldFocusPanel
          details={focusDetails}
          onAction={() => {
            if (focusDetails.kind === "plot") {
              if (focusDetails.projectId) {
                onProjectOpen(focusDetails.projectId);
              } else {
                onLocation("explorer");
              }
              return;
            }
            if (focusDetails.destination) onLocation(focusDetails.destination);
          }}
        />
      </div>

      <div className="metric-row">
        <Metric icon={Coins} label="RYP balance" value={formatRyp(rypBalance)} />
        <Metric icon={Leaf} label="Staked" value={formatRyp(stakedAmount)} />
        <Metric icon={KeyRound} label="Golden Key" value={walletConnected && activeTier !== "NONE" ? "Active" : "Locked"} />
        <Metric icon={ScrollText} label="Voting NFT" value={votingActive ? "14d timer" : "Locked"} />
        <Metric icon={Palette} label="Homestead" value={homesteadProfile.name} />
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
          <span>{projectSlotsUnlocked} fields / {homesteadProfile.decorationSlots} decor slots</span>
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

function WorldFocusPanel({
  details,
  onAction,
}: {
  details: ReturnType<typeof worldFocusDetails>;
  onAction: () => void;
}) {
  return (
    <aside className={`world-focus-panel ${details.kind} ${details.locked ? "locked" : ""}`} aria-live="polite">
      <span>{details.eyebrow}</span>
      <strong>{details.title}</strong>
      <p>{details.detail}</p>
      <div>
        <em>{details.status}</em>
        <button onClick={onAction}>{details.actionLabel}</button>
      </div>
    </aside>
  );
}

function worldFocusDetails({
  activeTier,
  focusedLandmark,
  focusedPlot,
  projectSlotsUnlocked,
  seedBotUnlocked,
  walletConnected,
}: {
  activeTier: StakingTier;
  focusedLandmark?: MicroVerseLandmark;
  focusedPlot?: ReturnType<typeof buildMicroVerseSceneState>["plots"][number];
  projectSlotsUnlocked: number;
  seedBotUnlocked: boolean;
  walletConnected: boolean;
}) {
  if (focusedPlot) {
    const hasProject = Boolean(focusedPlot.projectId);
    const lifecycle = formatLabel(focusedPlot.lifecycle);
    const risk = focusedPlot.riskLevel ? `${formatLabel(focusedPlot.riskLevel)} risk` : "Open slot";
    return {
      kind: "plot" as const,
      actionLabel: hasProject ? "Review Project" : "Browse Projects",
      detail: hasProject
        ? `${focusedPlot.category}, ${focusedPlot.progress}% progress, ${risk}`
        : "Ready for vetted project discovery",
      eyebrow: `Field ${focusedPlot.slotIndex + 1}`,
      projectId: focusedPlot.projectId,
      status: hasProject ? lifecycle : "Available",
      title: focusedPlot.label,
    };
  }

  if (focusedLandmark) {
    const destination = focusedLandmark.destination;
    const locked = destination === "seedbot" && !seedBotUnlocked;
    return {
      kind: "landmark" as const,
      actionLabel: locked ? "View Access" : "Enter",
      destination,
      detail: landmarkDetail(focusedLandmark),
      eyebrow: "MicroVerse Landmark",
      locked,
      status: locked ? "Locked" : "Ready",
      title: focusedLandmark.label,
    };
  }

  return {
    kind: "world" as const,
    actionLabel: walletConnected ? "Open Explorer" : "Browse Projects",
    destination: "explorer" as LocationKey,
    detail: `${projectSlotsUnlocked} project fields unlocked, ${walletConnected ? "wallet connected" : "wallet offline"}`,
    eyebrow: activeTier === "NONE" ? "Wild Fields" : `${formatLabel(activeTier)} Homestead`,
    locked: false,
    status: walletConnected ? "Protocol State Active" : "Wallet Not Connected",
    title: "CryptoSeeds MicroVerse",
  };
}

function landmarkDetail(landmark: MicroVerseLandmark) {
  if (landmark.destination === "homestead") return "Staking state, Golden Key, field signals";
  if (landmark.destination === "explorer") return "Vetted project discovery and participation review";
  if (landmark.destination === "governance") return "Proposals, project approvals, one-wallet voting";
  if (landmark.destination === "harvest") return "Rewards, reports, claims, and history";
  if (landmark.destination === "seedbot") return "Self-custodial strategy tools and route previews";
  if (landmark.kind === "STEWARD_GLADE") return "Donation and impact participation";
  if (landmark.kind === "LOREHOUSE") return "Education, documents, protocol context";
  if (landmark.kind === "TREASURY_GROVE") return "Treasury transparency and allocation signals";
  return "MicroVerse district";
}

function iconForLandmark(landmark: MicroVerseLandmark, locked: boolean) {
  if (locked) return LockKeyhole;
  if (landmark.destination === "homestead") return Home;
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
    admin: "Admin",
  };

  return labels[destination];
}
