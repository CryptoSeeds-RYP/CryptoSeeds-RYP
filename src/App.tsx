import { Activity, Bot, FileCog, Gauge, Map, ShieldCheck, Signal, Sprout, Vote, Wheat } from "lucide-react";
import { LoadingShell } from "./components/LoadingShell";
import { ProjectSnapshot } from "./components/ProjectSnapshot";
import { ProtocolPanel } from "./components/ProtocolPanel";
import { TransactionPanel } from "./components/TransactionPanel";
import { WalletDock } from "./components/WalletDock";
import { appConfig } from "./config/env";
import { basisPointsToPercent, RYP_TOKEN_TRANSFER_FEE_BPS } from "./domain/feeRouter";
import { protocolSnapshotSourceLabel } from "./domain/microverse";
import { activeParticipations } from "./domain/participation";
import { effectiveFee, canAccess } from "./domain/tiering";
import { useMetaMaskWallet } from "./evm/useMetaMaskWallet";
import { useMicroVerseState } from "./state/useMicroVerseState";
import type { LocationKey } from "./types";
import { ExplorerView } from "./views/ExplorerView";
import { AdminView } from "./views/AdminView";
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
  { key: "admin", label: "Admin Dashboard", icon: FileCog },
];

export default function App() {
  const metaMask = useMetaMaskWallet();
  const {
    activeLocation,
    selectedTier,
    selectedProject,
    selectedProjectId,
    governanceInspection,
    intent,
    loading,
    projectInspection,
    seedBotPermissionInspection,
    snapshot,
    demoMode,
    setSelectedTier,
    setDemoMode,
    openLocation,
    selectProject,
    openProject,
    prepareProjectIntent,
    prepareSeedBotAllocation,
    prepareSolanaTransactionBoundary,
    prepareUnstakeIntent,
    requestSolanaTransactionSignature,
    transactionBoundaryLoading,
    transactionSignatureLoading,
    advanceIntent,
    resetIntent,
  } = useMicroVerseState();

  if (!snapshot) return <LoadingShell />;

  const { user, farm, projects, participations, rewards, seedBotSignals } = snapshot;
  const stateSourceLabel = protocolSnapshotSourceLabel(snapshot.source);
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
          <span><Gauge size={15} /> Platform {effectiveFee(activeTier)}</span>
          <span><Gauge size={15} /> RYP transfer {basisPointsToPercent(RYP_TOKEN_TRANSFER_FEE_BPS)}</span>
          <span><Activity size={15} /> {stateSourceLabel}</span>
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

        <section className={`content-grid ${activeLocation === "homestead" ? "homestead-layout" : ""}`}>
          <section className="primary-surface">
            {activeLocation === "homestead" && (
              <HomesteadView
                activeTier={activeTier}
                walletConnected={user.walletConnected}
                rypBalance={user.rypBalance}
                stakedAmount={user.stakedAmount}
                projectSlotsUnlocked={farm.projectSlotsUnlocked}
                weatherState={farm.weatherState}
                projects={projects}
                participations={participations}
                votingActive={farm.governanceActive}
                seedBotUnlocked={farm.seedBotUnlocked}
                stateSourceLabel={stateSourceLabel}
                onLocation={openLocation}
                onProjectOpen={openProject}
              />
            )}
            {activeLocation === "explorer" && (
              <ExplorerView
                activeTier={activeTier}
                projectInspection={projectInspection}
                projects={projects}
                participations={participations}
                projectSlotsUnlocked={farm.projectSlotsUnlocked}
                selectedProject={selectedProject}
                selectedProjectId={selectedProjectId}
                onProjectSelect={selectProject}
                onPrepareProject={prepareProjectIntent}
              />
            )}
            {activeLocation === "harvest" && <HarvestView rewards={rewards} />}
            {activeLocation === "governance" && (
              <GovernanceView governanceInspection={governanceInspection} votingActive={farm.governanceActive} />
            )}
            {activeLocation === "admin" && <AdminView walletAddress={user.walletAddress} demoMode={demoMode} />}
            {activeLocation === "seedbot" && (
              <SeedBotView
                unlocked={farm.seedBotUnlocked}
                walletConnected={user.walletConnected}
                activeTier={activeTier}
                rypBalance={user.rypBalance}
                evmWalletAddress={metaMask.address}
                evmChainId={metaMask.chainId}
                seedBotPermissionInspection={seedBotPermissionInspection}
                signals={seedBotSignals}
                onPrepareAllocation={prepareSeedBotAllocation}
              />
            )}
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
              onUnstakePreview={prepareUnstakeIntent}
            />
            <TransactionPanel
              intent={intent}
              onAdvance={advanceIntent}
              onPrepareSolana={prepareSolanaTransactionBoundary}
              onReset={resetIntent}
              onSignSolana={requestSolanaTransactionSignature}
              preparingSolana={transactionBoundaryLoading}
              signingSolana={transactionSignatureLoading}
            />
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
