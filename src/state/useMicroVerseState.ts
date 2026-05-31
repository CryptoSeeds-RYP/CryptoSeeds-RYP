import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { appConfig } from "../config/env";
import { DEMO_WALLET_ADDRESS } from "../domain/demo";
import type { LocationKey, Project, ProtocolSnapshot, StakingTier } from "../domain/microverse";
import { createPreparedParticipation } from "../domain/participation";
import type { SeedBotStrategy } from "../domain/seedbot";
import type { TransactionIntent } from "../domain/transactions";
import { projects as projectFixtures } from "../fixtures/protocolFixtures";
import { cryptoSeedsServices } from "../services/mockServices";
import {
  advanceTransactionIntent,
  buildProjectParticipationIntent,
  buildProjectReviewIntent,
  buildSeedBotAllocationIntent,
  buildSeedBotSwapIntent,
  buildStakePreviewIntent,
  markSignedBroadcastDisabled,
  resetTransactionIntent,
} from "../services/transactionIntentService";
import {
  requestPreparedSolanaSignature,
  simulatePreparedSolanaTransaction,
} from "../solana/solanaTransactionBoundary";
import { buildSolanaBroadcastReadiness } from "../solana/solanaBroadcastReadiness";

export function useMicroVerseState() {
  const { connection } = useConnection();
  const { connected, publicKey, signTransaction } = useWallet();
  const [activeLocation, setActiveLocation] = useState<LocationKey>("homestead");
  const [selectedTier, setSelectedTier] = useState<StakingTier>("SPROUT");
  const [demoMode, setDemoMode] = useState(appConfig.demoMode);
  const [walletAddress, setWalletAddress] = useState<string | undefined>();
  const [selectedProjectId, setSelectedProjectId] = useState(projectFixtures[0].id);
  const [intent, setIntent] = useState<TransactionIntent>(
    buildStakePreviewIntent(appConfig.demoMode ? DEMO_WALLET_ADDRESS : undefined),
  );
  const [snapshot, setSnapshot] = useState<ProtocolSnapshot | undefined>();
  const [loading, setLoading] = useState(true);
  const [transactionBoundaryLoading, setTransactionBoundaryLoading] = useState(false);
  const [transactionSignatureLoading, setTransactionSignatureLoading] = useState(false);

  useEffect(() => {
    setWalletAddress(connected && publicKey ? publicKey.toBase58() : undefined);
  }, [connected, publicKey]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const effectiveWalletAddress = walletAddress ?? (demoMode ? DEMO_WALLET_ADDRESS : undefined);
    cryptoSeedsServices
      .loadProtocolSnapshot(effectiveWalletAddress, selectedTier)
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [demoMode, selectedTier, walletAddress]);

  const selectedProject = useMemo(() => {
    return snapshot?.projects.find((project) => project.id === selectedProjectId) ?? projectFixtures[0];
  }, [selectedProjectId, snapshot?.projects]);

  function openLocation(location: LocationKey) {
    setActiveLocation(location);
    if (location === "seedbot") setIntent(buildSeedBotSwapIntent(effectiveIntentWalletAddress()));
  }

  function chooseTier(tier: StakingTier) {
    setSelectedTier(tier);
    if (tier !== "NONE") {
      setIntent(buildStakePreviewIntent(effectiveIntentWalletAddress(), tier));
    }
  }

  function selectProject(project: Project) {
    setSelectedProjectId(project.id);
    setIntent(buildProjectReviewIntent(project, effectiveIntentWalletAddress()));
  }

  function openProject(projectId: string) {
    const project = snapshot?.projects.find((candidate) => candidate.id === projectId);
    if (!project) return;

    setActiveLocation("explorer");
    selectProject(project);
  }

  function prepareProjectIntent(project: Project) {
    const effectiveWallet = effectiveIntentWalletAddress();
    setSelectedProjectId(project.id);
    setIntent(buildProjectParticipationIntent(project, effectiveWallet));
    if (!effectiveWallet) return;

    setSnapshot((current) => {
      if (!current) return current;

      const participation = createPreparedParticipation({
        project,
        walletAddress: effectiveWallet,
        participations: current.participations,
        slotCount: current.farm.projectSlotsUnlocked,
      });

      if (!participation) return current;

      return {
        ...current,
        participations: [...current.participations, participation],
      };
    });
  }

  function prepareSeedBotAllocation(strategy: SeedBotStrategy, mode: "BASKET" | "PER_ASSET") {
    setActiveLocation("seedbot");
    setIntent(
      buildSeedBotAllocationIntent({
        strategy,
        mode,
        walletAddress: effectiveIntentWalletAddress(),
      }),
    );
  }

  function advanceIntent() {
    setIntent((current) => advanceTransactionIntent(current));
  }

  function resetIntent() {
    setIntent((current) => resetTransactionIntent(current));
  }

  async function prepareSolanaTransactionBoundary() {
    const intentAtRequest = intent;
    setTransactionBoundaryLoading(true);

    try {
      const boundary = await simulatePreparedSolanaTransaction({
        connection,
        plan: intentAtRequest.preparedSolanaTransaction,
        walletCanSign: Boolean(signTransaction),
        walletPublicKey: publicKey?.toBase58(),
      });

      setIntent((current) => {
        if (current.id !== intentAtRequest.id) return current;
        return {
          ...current,
          solanaBoundary: boundary,
        };
      });
    } finally {
      setTransactionBoundaryLoading(false);
    }
  }

  async function requestSolanaTransactionSignature() {
    const intentAtRequest = intent;
    setTransactionSignatureLoading(true);

    try {
      const signature = await requestPreparedSolanaSignature({
        boundary: intentAtRequest.solanaBoundary,
        plan: intentAtRequest.preparedSolanaTransaction,
        signTransaction,
        walletPublicKey: publicKey?.toBase58(),
      });

      setIntent((current) => {
        if (current.id !== intentAtRequest.id) return current;
        const signedIntent = markSignedBroadcastDisabled(current);
        const solanaBroadcastReadiness = buildSolanaBroadcastReadiness({
          plan: intentAtRequest.preparedSolanaTransaction,
          signature,
        });
        return {
          ...current,
          solanaBroadcastReadiness,
          solanaSignature: signature,
          status: signature.status === "SIGNED" ? signedIntent.status : current.status,
          lifecycle: signature.status === "SIGNED" ? signedIntent.lifecycle : current.lifecycle,
        };
      });
    } finally {
      setTransactionSignatureLoading(false);
    }
  }

  function effectiveIntentWalletAddress() {
    return walletAddress ?? (demoMode ? DEMO_WALLET_ADDRESS : undefined);
  }

  return {
    activeLocation,
    selectedTier,
    selectedProject,
    selectedProjectId,
    intent,
    loading,
    snapshot,
    demoMode,
    setSelectedTier: chooseTier,
    setDemoMode,
    openLocation,
    selectProject,
    openProject,
    prepareProjectIntent,
    prepareSeedBotAllocation,
    prepareSolanaTransactionBoundary,
    requestSolanaTransactionSignature,
    transactionBoundaryLoading,
    transactionSignatureLoading,
    advanceIntent,
    resetIntent,
  };
}
