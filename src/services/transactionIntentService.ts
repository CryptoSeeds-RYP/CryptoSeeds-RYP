import { appConfig } from "../config/env";
import type { Project, StakingTier } from "../domain/microverse";
import { latestRiskDisclosure } from "../domain/projectRegistry";
import { seedBotFeeDisclosure, type SeedBotStrategy } from "../domain/seedbot";
import { venueById } from "../domain/seedbotVenues";
import { effectiveFee, tierRequirements } from "../domain/tiering";
import { buildStakeRypTransactionPlan, buildUnstakeRypTransactionPlan } from "../solana/protocolTransactionPlan";
import { buildSeedBotRoutePlan } from "./seedbotVenueRouter";
import type {
  RiskAcknowledgement,
  TransactionAccountReference,
  TransactionChain,
  TransactionIntent,
  TransactionIntentStatus,
  TransactionLifecycleStep,
  TransactionProgramReference,
} from "../domain/transactions";

const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const JUPITER_ROUTER_REFERENCE = "Jupiter route quote pending";

export function buildStakePreviewIntent(
  walletAddress?: string,
  tier: Exclude<StakingTier, "NONE"> = "SPROUT",
): TransactionIntent {
  const preparedSolanaTransaction = maybeBuildPlan(() =>
    walletAddress ? buildStakeRypTransactionPlan({ ownerAddress: walletAddress, tier }) : undefined,
  );

  return buildIntent({
    id: `stake-${tier.toLowerCase()}-preview`,
    type: "STAKE_RYP",
    title: `Stake RYP for ${tier}`,
    walletAddress,
    inputToken: "RYP",
    amount: tierRequirements[tier].toLocaleString(),
    estimatedFees: `${effectiveFee(tier)} effective network fee after tier reduction`,
    status: "READY",
    executionMode: "WALLET_APPROVED",
    signaturePolicy: "Manual Solana wallet signature required before staking can be submitted.",
    programs: cryptoSeedsPrograms("Stake state and Golden Key receipt"),
    accounts: preparedSolanaTransaction?.instructions[0].accounts ?? walletAccounts(walletAddress),
    preparedSolanaTransaction,
    riskSummary: "Wallet approval required. Staking changes access, fee tier, and NFT eligibility.",
    expectedResult: `${tier} tier, Golden Key active, Voting Rights timer started.`,
  });
}

export function buildUnstakePreviewIntent(walletAddress?: string, amount = 5000): TransactionIntent {
  const preparedSolanaTransaction = maybeBuildPlan(() =>
    walletAddress ? buildUnstakeRypTransactionPlan({ ownerAddress: walletAddress, amountUi: amount }) : undefined,
  );

  return buildIntent({
    id: `unstake-${amount}-preview`,
    type: "UNSTAKE_RYP",
    title: "Unstake RYP",
    walletAddress,
    inputToken: "RYP",
    amount: amount.toLocaleString(),
    estimatedFees: "Network fee only; no protocol fee previewed for unstaking",
    status: "READY",
    executionMode: "WALLET_APPROVED",
    signaturePolicy: "Manual Solana wallet signature required before unstaking can be submitted.",
    programs: cryptoSeedsPrograms("Stake withdrawal and tier recalculation"),
    accounts: preparedSolanaTransaction?.instructions[0].accounts ?? walletAccounts(walletAddress),
    preparedSolanaTransaction,
    riskSummary: "Unstaking can reduce tier access, project slots, Golden Key state, and fee reduction.",
    expectedResult: "RYP returns to the wallet after the Solana program confirms the withdrawal.",
  });
}

export function buildProjectReviewIntent(project: Project, walletAddress?: string): TransactionIntent {
  return buildIntent({
    id: `project-review-${project.id}`,
    type: "PARTICIPATE_PROJECT",
    title: `Review ${project.name}`,
    walletAddress,
    inputToken: "RYP",
    amount: "No transaction prepared",
    estimatedFees: "Shown after risk acknowledgment",
    status: "DRAFT",
    executionMode: "PREVIEW_ONLY",
    signaturePolicy: "No wallet signature is available until project risk is acknowledged.",
    programs: cryptoSeedsPrograms("Project registry preview"),
    accounts: projectAccounts(project, walletAddress),
    acknowledgement: projectAcknowledgement(project, false),
    riskSummary: `${project.riskLevel} risk label. Review disclosure and eligibility before preparing a wallet action.`,
    expectedResult: "No on-chain action is created until the participation preview is prepared.",
  });
}

export function buildProjectParticipationIntent(project: Project, walletAddress?: string): TransactionIntent {
  return buildIntent({
    id: `project-${project.id}`,
    type: "PARTICIPATE_PROJECT",
    title: `Participate in ${project.name}`,
    walletAddress,
    inputToken: "RYP",
    amount: project.requiredTier === "SEED" ? "5,000+" : `${tierRequirements[project.requiredTier].toLocaleString()}+`,
    estimatedFees: "3.5% base network fee before tier reduction",
    status: "READY",
    executionMode: "WALLET_APPROVED",
    signaturePolicy: "Manual Solana wallet signature required. No hidden execution or custody.",
    programs: cryptoSeedsPrograms("Project participation state"),
    accounts: projectAccounts(project, walletAddress),
    acknowledgement: projectAcknowledgement(project, true),
    riskSummary: `${project.riskLevel} risk label. Wallet approval required before participation.`,
    expectedResult: "Project slot links to your MicroVerse state and milestone feed.",
  });
}

export function buildSeedBotSwapIntent(walletAddress?: string): TransactionIntent {
  return buildIntent({
    id: "seedbot-swap",
    type: "SEEDBOT_SWAP",
    title: "Prepare wallet-approved swap",
    walletAddress,
    inputToken: "SOL",
    outputToken: "RYP",
    amount: "0.75",
    estimatedFees: "Network fee and route fee shown before signing",
    slippage: "0.5%",
    status: "DRAFT",
    executionMode: "PREVIEW_ONLY",
    signaturePolicy: "Signal-only until a route quote and wallet-approved transaction are created.",
    programs: [
      {
        label: "SeedBot route adapter",
        address: JUPITER_ROUTER_REFERENCE,
        role: "Swap route preview",
      },
    ],
    accounts: walletAccounts(walletAddress),
    riskSummary: "Self-custodial execution. No private keys, no hidden transaction, no profit claim.",
    expectedResult: "Wallet-approved swap route is prepared; broadcast remains a later reviewed boundary.",
  });
}

export function buildSeedBotAllocationIntent({
  strategy,
  walletAddress,
  mode = "BASKET",
}: {
  strategy: SeedBotStrategy;
  walletAddress?: string;
  mode?: "BASKET" | "PER_ASSET";
}): TransactionIntent {
  const venue = venueById(strategy.preferredVenueId);
  const routePlan = buildSeedBotRoutePlan({ strategy });
  const routeSummary = routePlan.routes
    .map((route) => `${route.venueName}: ${route.assets.map((asset) => asset.symbol).join("/")}`)
    .join("; ");

  return buildIntent({
    id: `seedbot-allocation-${strategy.id}-${mode.toLowerCase()}`,
    type: "SEEDBOT_ALLOCATE",
    title: `Allocate to ${strategy.name}`,
    walletAddress,
    inputToken: routeSummary || strategy.assets.map((asset) => asset.symbol).join(" / "),
    amount: mode === "BASKET" ? "Strategy basket preview" : "Per-asset preview",
    chain: chainForSeedBotRoutePlan(routePlan),
    estimatedFees: seedBotFeeDisclosure(strategy.feeModel),
    slippage: "User-controlled per route",
    status: "DRAFT",
    executionMode: "PREVIEW_ONLY",
    signaturePolicy: "Self-custodial allocation preview. Phantom or MetaMask approval is required per route.",
    programs: [
      {
        label: "SeedBot strategy adapter",
        address: `${strategy.preferredVenueId}:strategy:${strategy.id}`,
        role: `${venue?.name ?? strategy.preferredVenueId} allocation preview only`,
      },
    ],
    accounts: [
      ...walletAccounts(walletAddress),
      ...routePlan.routes.flatMap((route) => route.assets.map((asset) => ({
        label: `${route.venueName} ${asset.walletRoute} route for ${asset.symbol}`,
        address: `${route.venueId}:${asset.chain}:${asset.symbol}`,
        role: `${asset.targetWeightPercent}% target allocation via ${route.mode}`,
        signer: false,
        writable: false,
      }))),
    ],
    riskSummary: `Historical strategy performance only. Past performance does not guarantee future results. Preferred venue: ${venue?.name ?? strategy.preferredVenueId}. Route mode: ${routePlan.mode}.`,
    expectedResult: "Wallet-approved allocation route is prepared; no funds move until the user signs.",
  });
}

export function advanceTransactionIntent(intent: TransactionIntent): TransactionIntent {
  const nextStatus = nextLifecycleStatus(intent.status);

  return {
    ...intent,
    status: nextStatus,
    lifecycle: buildLifecycle(nextStatus),
  };
}

export function markSignedBroadcastDisabled(intent: TransactionIntent): TransactionIntent {
  const signedIntent = advanceTransactionIntent({ ...intent, status: "AWAITING_SIGNATURE" });

  return {
    ...signedIntent,
    lifecycle: signedIntent.lifecycle.map((step) => {
      if (step.id === "broadcast" || step.id === "confirmation") {
        return { ...step, status: "BLOCKED" as const };
      }
      return step;
    }),
  };
}

export function resetTransactionIntent(intent: TransactionIntent): TransactionIntent {
  const resetStatus =
    intent.executionMode === "WALLET_APPROVED" && intent.acknowledgement?.accepted !== false
      ? "READY"
      : "DRAFT";

  return {
    ...intent,
    solanaBoundary: undefined,
    solanaBroadcastReadiness: undefined,
    solanaSignature: undefined,
    status: resetStatus,
    lifecycle: buildLifecycle(resetStatus),
  };
}

function buildIntent(intent: Omit<TransactionIntent, "chain" | "network" | "lifecycle"> & { chain?: TransactionChain }): TransactionIntent {
  return {
    ...intent,
    chain: intent.chain ?? "SOLANA",
    network: appConfig.cluster,
    lifecycle: buildLifecycle(intent.status),
  };
}

function chainForSeedBotRoutePlan(routePlan: ReturnType<typeof buildSeedBotRoutePlan>): TransactionChain {
  const chains = new Set(routePlan.routes.flatMap((route) => route.assets.map((asset) => asset.chain)));
  if (chains.size > 1) return "MULTICHAIN";
  if (chains.has("EVM")) return "EVM";
  return "SOLANA";
}

function buildLifecycle(status: TransactionIntentStatus): TransactionLifecycleStep[] {
  if (status === "FAILED") {
    return [
      { id: "review", label: "Review", status: "COMPLETE" },
      { id: "wallet_signature", label: "Wallet Signature", status: "FAILED" },
      { id: "broadcast", label: "Broadcast", status: "BLOCKED" },
      { id: "confirmation", label: "Confirmation", status: "BLOCKED" },
    ];
  }

  if (status === "CONFIRMED") {
    return [
      { id: "review", label: "Review", status: "COMPLETE" },
      { id: "wallet_signature", label: "Wallet Signature", status: "COMPLETE" },
      { id: "broadcast", label: "Broadcast", status: "COMPLETE" },
      { id: "confirmation", label: "Confirmation", status: "COMPLETE" },
    ];
  }

  if (status === "BROADCAST") {
    return [
      { id: "review", label: "Review", status: "COMPLETE" },
      { id: "wallet_signature", label: "Wallet Signature", status: "COMPLETE" },
      { id: "broadcast", label: "Broadcast", status: "COMPLETE" },
      { id: "confirmation", label: "Confirmation", status: "CURRENT" },
    ];
  }

  if (status === "SIGNED") {
    return [
      { id: "review", label: "Review", status: "COMPLETE" },
      { id: "wallet_signature", label: "Wallet Signature", status: "COMPLETE" },
      { id: "broadcast", label: "Broadcast", status: "CURRENT" },
      { id: "confirmation", label: "Confirmation", status: "WAITING" },
    ];
  }

  const signatureReady = status === "READY" || status === "AWAITING_SIGNATURE";
  return [
    { id: "review", label: "Review", status: signatureReady ? "COMPLETE" : "CURRENT" },
    { id: "wallet_signature", label: "Wallet Signature", status: signatureReady ? "CURRENT" : "BLOCKED" },
    { id: "broadcast", label: "Broadcast", status: "WAITING" },
    { id: "confirmation", label: "Confirmation", status: "WAITING" },
  ];
}

function nextLifecycleStatus(status: TransactionIntentStatus): TransactionIntentStatus {
  if (status === "DRAFT") return "DRAFT";
  if (status === "READY") return "AWAITING_SIGNATURE";
  if (status === "AWAITING_SIGNATURE") return "SIGNED";
  if (status === "SIGNED") return "BROADCAST";
  if (status === "BROADCAST") return "CONFIRMED";
  return status;
}

function cryptoSeedsPrograms(role: string): TransactionProgramReference[] {
  return [
    {
      label: "CryptoSeeds protocol",
      address: appConfig.protocolProgramId,
      role,
    },
    {
      label: "SPL Token program",
      address: SPL_TOKEN_PROGRAM_ID,
      role: "RYP token movement",
    },
  ];
}

function walletAccounts(walletAddress?: string): TransactionAccountReference[] {
  return [
    {
      label: "Connected wallet",
      address: walletAddress,
      role: "Signer and fee payer",
      signer: true,
      writable: true,
    },
    {
      label: "RYP mint",
      address: appConfig.rypMintAddress,
      role: "Token mint reference",
      signer: false,
      writable: false,
    },
  ];
}

function projectAccounts(project: Project, walletAddress?: string): TransactionAccountReference[] {
  return [
    ...walletAccounts(walletAddress),
    {
      label: "Project registry",
      address: `project:${project.id}`,
      role: "Project participation state",
      signer: false,
      writable: true,
    },
    {
      label: "Risk acknowledgement",
      address: `ack:${project.id}`,
      role: "Disclosure acceptance record",
      signer: false,
      writable: true,
    },
  ];
}

function projectAcknowledgement(project: Project, accepted: boolean): RiskAcknowledgement {
  const disclosure = latestRiskDisclosure(project);

  return {
    id: `risk-${project.id}`,
    label: `Risk disclosure for ${project.name}`,
    accepted,
    acceptedAt: accepted ? new Date().toISOString() : undefined,
    disclosureRef: disclosure
      ? `project:${project.id}:document:${disclosure.id}:${disclosure.version}`
      : `project:${project.id}:risk-disclosure:missing`,
  };
}

function maybeBuildPlan<T>(factory: () => T): T | undefined {
  try {
    return factory();
  } catch {
    return undefined;
  }
}
