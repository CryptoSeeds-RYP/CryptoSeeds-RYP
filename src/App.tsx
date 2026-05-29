import { Activity, Bot, Gauge, Map, ShieldCheck, Signal, Sprout, Vote, Wheat } from "lucide-react";
import { LoadingShell } from "./components/LoadingShell";
import { ProjectSnapshot } from "./components/ProjectSnapshot";
import { ProtocolPanel } from "./components/ProtocolPanel";
import { TransactionPanel } from "./components/TransactionPanel";
import { WalletDock } from "./components/WalletDock";
import { appConfig } from "./config/env";
import { activeParticipations } from "./domain/participation";
import { effectiveFee, canAccess } from "./domain/tiering";
import { useMetaMaskWallet } from "./evm/useMetaMaskWallet";
import { useMicroVerseState } from "./state/useMicroVerseState";
import type { LocationKey } from "./types";
import { ExplorerView } from "./views/ExplorerView";
import { GovernanceView } from "./views/GovernanceView";
import { HarvestView } from "./views/HarvestView";
import { HomesteadView } from "./views/HomesteadView";
import { SeedBotView } from "./views/SeedBotView";

const navItems: Array<{
  key: LocationKey;
  label: string;
  icon: typeof Sprout;
}> = [
  { key: "homestead", label: "Homestead", icon: Sprout },
  { key: "explorer", label: "Explorer's Map", icon: Map },
  { key: "harvest", label: "Harvest Ledger", icon: Wheat },
  { key: "governance", label: "Governance Hall", icon: Vote },
  { key: "seedbot", label: "SeedBot Terminal", icon: Bot },
];

export default function App() {
  const metaMask = useMetaMaskWallet();
  const {
    activeLocation,
    selectedTier,
    selectedProject,
    selectedProjectId,
    intent,
    loading,
    snapshot,
    demoMode,
    setSelectedTier,
    setDemoMode,
    openLocation,
    selectProject,
    openProject,
    prepareProjectIntent,
    advanceIntent,
    resetIntent,
  } = useMicroVerseState();

  if (!snapshot) return <LoadingShell />;

  const { user, farm, projects, participations, rewards, seedBotSignals } = snapshot;
  const activeTier = user.stakingTier;
  const eligibleProjects = projects.filter((project) => canAccess(project.requiredTier, activeTier));
  const openProjectSlots = Math.max(0, farm.projectSlotsUnlocked - activeParticipations(participations).length);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <img src="/assets/cryptoseeds-logo.png" alt="CryptoSeeds logo" />
          <div>
            <strong>CryptoSeeds</strong>
            <span>MicroVerse dApp</span>
          </div>
        </div>
        <div className="network-strip" aria-label="Network status">
          <span><Signal size={15} /> Solana {appConfig.cluster}</span>
          <span><ShieldCheck size={15} /> Self-custodial</span>
          <span><Gauge size={15} /> Fee {effectiveFee(activeTier)}</span>
          <span><Activity size={15} /> {demoMode ? "Demo state" : "Live state"}</span>
          {loading && <span><Activity size={15} /> Syncing</span>}
        </div>
        <WalletDock metaMask={metaMask} demoMode={demoMode} onDemoModeChange={setDemoMode} />
      </header>

      <section className="workspace">
        <aside className="nav-rail" aria-label="MicroVerse locations">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={activeLocation === item.key ? "active" : ""}
                onClick={() => openLocation(item.key)}
                title={item.label}
                aria-label={item.label}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </aside>

        <section className="content-grid">
          <section className="primary-surface">
            {activeLocation === "homestead" && (
              <HomesteadView
                activeTier={activeTier}
                walletConnected={user.walletConnected}
                rypBalance={user.rypBalance}
                stakedAmount={user.stakedAmount}
                projectSlotsUnlocked={farm.projectSlotsUnlocked}
                projects={projects}
                participations={participations}
                votingActive={farm.governanceActive}
                seedBotUnlocked={farm.seedBotUnlocked}
                onLocation={openLocation}
                onProjectOpen={openProject}
              />
            )}
            {activeLocation === "explorer" && (
              <ExplorerView
                activeTier={activeTier}
                projects={projects}
                participations={participations}
                selectedProject={selectedProject}
                selectedProjectId={selectedProjectId}
                onProjectSelect={selectProject}
                onPrepareProject={prepareProjectIntent}
              />
            )}
            {activeLocation === "harvest" && <HarvestView rewards={rewards} />}
            {activeLocation === "governance" && <GovernanceView votingActive={farm.governanceActive} />}
            {activeLocation === "seedbot" && <SeedBotView unlocked={farm.seedBotUnlocked} signals={seedBotSignals} />}
          </section>

          <aside className="side-stack">
            <ProtocolPanel
              walletConnected={user.walletConnected}
              activeTier={activeTier}
              selectedTier={selectedTier}
              rypBalance={user.rypBalance}
              stakedAmount={user.stakedAmount}
              stakingDays={user.stakingDays}
              goldenKeyNft={user.goldenKeyNft}
              votingRightsNft={user.votingRightsNft}
              onTierChange={setSelectedTier}
            />
            <TransactionPanel intent={intent} onAdvance={advanceIntent} onReset={resetIntent} />
            <ProjectSnapshot
              project={selectedProject}
              participation={participations.find((participation) => participation.projectId === selectedProject.id)}
              activeTier={activeTier}
              eligibleProjects={eligibleProjects.length}
              openProjectSlots={openProjectSlots}
            />
          </aside>
        </section>
      </section>
    </main>
  );
}
