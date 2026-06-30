import { sha256 } from "@noble/hashes/sha2";
import { PLACEHOLDER_PROTOCOL_PROGRAM_ID, type AppConfig } from "../config/env";
import { RYP_MINT_ADDRESS } from "./token";
import type { PreparedSolanaTransactionPlan } from "./transactions";
import {
  BPS_DENOMINATOR,
  PLATFORM_ACTION_BASE_FEE_BPS,
  RYP_TOKEN_TRANSFER_FEE_BPS,
  draftCoreFeeSplit,
} from "./feeRouter";
import { selectableTiers, tierFeeReduction, tierRequirements } from "./tiering";
import {
  buildInitializeConfigTransactionPlan,
  buildInitializeRewardConfigTransactionPlan,
  buildRegisterRewardVaultTransactionPlan,
  buildSetModulePauseTransactionPlan,
  buildUpdateFeeConfigTransactionPlan,
  buildVerifyRewardVaultTransactionPlan,
  deriveRypAssociatedTokenAddress,
  parseRypAmountToBaseUnits,
  PROTOCOL_PAUSE_MODULE_FLAGS,
  PROTOCOL_PAUSE_MODULE_MASK,
} from "../solana/protocolTransactionPlan";
import type { DevnetDeploymentInspection } from "../solana/devnetDeploymentInspection";

export type AdminAccessStatus =
  | "UNCONFIGURED"
  | "WALLET_REQUIRED"
  | "WRONG_WALLET"
  | "TEST_UNLOCKED"
  | "DEMO_BLOCKED"
  | "MAINNET_BLOCKED";

export type AdminAccessRole = "NONE" | "ADMIN_AUTHORITY" | "INDEPENDENT_TREASURY";

export type AdminActionStatus = "DRAFT_ONLY" | "LOCALNET_READY" | "DEVNET_READY" | "REVIEW_GATED" | "BLOCKED";

export type AdminAccess = {
  status: AdminAccessStatus;
  accessRole: AdminAccessRole;
  configuredAdminAddress?: string;
  configuredTreasuryAddress?: string;
  walletAddress?: string;
  walletMatches: boolean;
  walletMatchesAdmin: boolean;
  walletMatchesTreasury: boolean;
  canOpenDashboard: boolean;
  canDraftActions: boolean;
  canExecuteActions: false;
  blockers: string[];
  warnings: string[];
};

export type AdminActionPreview = {
  id: string;
  label: string;
  category:
    | "PROJECTS"
    | "TREASURY"
    | "FEES"
    | "VISUALS"
    | "SEEDBOT"
    | "PROTOCOL";
  status: AdminActionStatus;
  description: string;
  executionRule: string;
};

export type AdminProtocolPreviewStatus = "READY" | "BLOCKED";

export type AdminProtocolPreview = {
  id: string;
  label: string;
  status: AdminProtocolPreviewStatus;
  description: string;
  executionRule: string;
  plan?: PreparedSolanaTransactionPlan;
  blockers: string[];
  warnings: string[];
};

export type AdminReadinessGateStatus = "READY" | "REVIEW_REQUIRED" | "BLOCKED";
export type AdminMissionPhaseStatus =
  | "LOCAL_READY"
  | "READY_FOR_REVIEW"
  | "REVIEW_REQUIRED"
  | "WAITING_ON_DEVNET"
  | "BLOCKED";

export type AdminReadinessGate = {
  id: string;
  label: string;
  status: AdminReadinessGateStatus;
  summary: string;
  blockers: string[];
  warnings: string[];
};

export type AdminLaunchReadiness = {
  status: "BLOCKED" | "READY_FOR_REVIEW";
  gates: AdminReadinessGate[];
  readyCount: number;
  reviewCount: number;
  blockedCount: number;
  blockers: string[];
  warnings: string[];
};

export type AdminMissionPhase = {
  id: string;
  label: string;
  status: AdminMissionPhaseStatus;
  summary: string;
  command: string;
  blockers: string[];
};

export type AdminMissionControl = {
  status: "MISSION_BLOCKED" | "MISSION_READY_FOR_REVIEW";
  phases: AdminMissionPhase[];
  operatorHandoff: DevnetDeploymentInspection["operatorHandoff"] | null;
  localReadyCount: number;
  reviewCount: number;
  waitingOnDevnetCount: number;
  blockedCount: number;
  blockers: string[];
  nextActions: string[];
};

export type AdminProtocolReadinessInput = {
  status: string;
  blockers: string[];
  warnings: string[];
  activeModulePauses?: string[];
};

export type AdminRewardReadinessInput = {
  rewardConfigStatus: string;
  epochStatus: string;
  blockers: string[];
  warnings: string[];
};

export type AdminMissionControlInput = {
  access: AdminAccess;
  config: Pick<
    AppConfig,
    | "cluster"
    | "opsEnvFile"
    | "protocolDeployment"
    | "protocolProgramId"
    | "rypMintAddress"
    | "solanaBroadcastEnabled"
  >;
  deployment?: Pick<
    DevnetDeploymentInspection,
    "authority" | "blockers" | "mint" | "nextActions" | "program"
  > & Partial<Pick<DevnetDeploymentInspection, "operatorHandoff">>;
  launchReadiness: AdminLaunchReadiness;
  protocol: AdminProtocolReadinessInput;
  reward: AdminRewardReadinessInput;
};

const DEFAULT_REWARD_EPOCH_CADENCE_SECONDS = 7 * 24 * 60 * 60;
const PROTOCOL_MODULE_PAUSE_PREVIEWS = [
  {
    id: "staking",
    label: "Staking",
    flag: PROTOCOL_PAUSE_MODULE_FLAGS.STAKING,
    description: "Pause staking and unstaking while leaving unrelated protocol modules available.",
  },
  {
    id: "governance",
    label: "Governance",
    flag: PROTOCOL_PAUSE_MODULE_FLAGS.GOVERNANCE,
    description: "Pause proposal, voting, and governance-close paths during a governance incident.",
  },
  {
    id: "projects",
    label: "Projects",
    flag: PROTOCOL_PAUSE_MODULE_FLAGS.PROJECTS,
    description: "Pause project registration, updates, and participation while preserving safety exits where possible.",
  },
  {
    id: "seedbot",
    label: "SeedBot",
    flag: PROTOCOL_PAUSE_MODULE_FLAGS.SEEDBOT,
    description: "Pause SeedBot permission and usage-record paths without affecting staking or rewards.",
  },
  {
    id: "fee-routing",
    label: "Fee Routing",
    flag: PROTOCOL_PAUSE_MODULE_FLAGS.FEE_ROUTING,
    description: "Pause platform fee routing and CryptoSeeds-routed RYP transfers during vault or route review.",
  },
] as const;

export const adminActionPreviews: AdminActionPreview[] = [
  {
    id: "project-registry-edit",
    label: "Project Registry",
    category: "PROJECTS",
    status: "DRAFT_ONLY",
    description: "Edit project summaries, operators, documents, milestones, receiving accounts, and disclosure notes.",
    executionRule: "Draft a registry change for review; no live listing changes without approval.",
  },
  {
    id: "charity-disclosure-edit",
    label: "Charity Accounts",
    category: "PROJECTS",
    status: "DRAFT_ONLY",
    description: "Maintain separated charity wallet labels, donation-only wording, and impact reporting notes.",
    executionRule: "Draft only until receiving-account verification is approved.",
  },
  {
    id: "treasury-label-update",
    label: "Treasury Labels",
    category: "TREASURY",
    status: "DRAFT_ONLY",
    description: "Manage independent treasury wallet labels, reporting cadence, and allocation notes.",
    executionRule: "Never move funds from the dashboard; prepare public label updates only.",
  },
  {
    id: "fee-split-proposal",
    label: "Fee Split Policy",
    category: "FEES",
    status: "REVIEW_GATED",
    description: "Prepare the 1% RYP transfer-fee route and holder, staker, treasury, and dev fee split proposals.",
    executionRule: "Requires governance, security, legal, and accounting review before any live parameter change.",
  },
  {
    id: "reward-epoch-draft",
    label: "Reward Epochs",
    category: "FEES",
    status: "DRAFT_ONLY",
    description: "Prepare holder snapshot, reward vault, rollover, and delivery-cost accounting drafts.",
    executionRule: "Draft/export only; no payout, claim, or vault movement from the admin UI.",
  },
  {
    id: "homestead-visual-config",
    label: "Homestead Config",
    category: "VISUALS",
    status: "LOCALNET_READY",
    description: "Tune RPG homestead sizes, decoration slots, project-slot visuals, and cosmetic unlock text.",
    executionRule: "Local/dev preview only; no protocol rights or fee changes.",
  },
  {
    id: "seedbot-config",
    label: "SeedBot Config",
    category: "SEEDBOT",
    status: "REVIEW_GATED",
    description: "Review strategy cards, venues, historical performance windows, and permission gates.",
    executionRule: "Live execution, guarded automation, and profit-fee paths remain disabled until review.",
  },
  {
    id: "emergency-pause",
    label: "Emergency Pause",
    category: "PROTOCOL",
    status: "DEVNET_READY",
    description: "Prepare a pause or unpause proposal for protocol safety incidents.",
    executionRule: "Testnet/devnet only until final authority policy is approved.",
  },
  {
    id: "program-authority-review",
    label: "Program Authority",
    category: "PROTOCOL",
    status: "BLOCKED",
    description: "Review program upgrade authority, admin address, and future multisig migration status.",
    executionRule: "No production authority transfer from this dashboard.",
  },
];

export function buildAdminAccess({
  config,
  walletAddress,
  demoMode,
}: {
  config: Pick<
    AppConfig,
    | "adminAuthorityAddress"
    | "cluster"
    | "independentTreasuryAddress"
    | "protocolDeployment"
    | "solanaBroadcastEnabled"
  >;
  walletAddress?: string;
  demoMode: boolean;
}): AdminAccess {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const configuredAdminAddress = config.adminAuthorityAddress;
  const configuredTreasuryAddress = config.independentTreasuryAddress;
  const hasConfiguredOperatorWallet = Boolean(configuredAdminAddress || configuredTreasuryAddress);
  const walletMatchesAdmin = Boolean(configuredAdminAddress && walletAddress === configuredAdminAddress);
  const walletMatchesTreasury = Boolean(configuredTreasuryAddress && walletAddress === configuredTreasuryAddress);
  const walletMatches = walletMatchesAdmin || walletMatchesTreasury;
  const accessRole: AdminAccessRole = walletMatchesAdmin
    ? "ADMIN_AUTHORITY"
    : walletMatchesTreasury
      ? "INDEPENDENT_TREASURY"
      : "NONE";

  if (!hasConfiguredOperatorWallet) {
    blockers.push("Configure VITE_ADMIN_AUTHORITY_ADDRESS or VITE_INDEPENDENT_TREASURY_ADDRESS.");
  }
  if (!walletAddress) blockers.push("Connect the configured admin or treasury wallet to unlock this dashboard.");
  if (hasConfiguredOperatorWallet && walletAddress && !walletMatches) {
    blockers.push("Connected wallet is not the configured admin authority or independent treasury owner.");
  }
  if (!configuredAdminAddress) {
    warnings.push("Protocol transaction previews need VITE_ADMIN_AUTHORITY_ADDRESS before signing review.");
  }
  if (configuredAdminAddress && configuredTreasuryAddress && configuredAdminAddress === configuredTreasuryAddress) {
    warnings.push("Admin authority and independent treasury owner reuse the same wallet; separate them before public testing.");
  }
  if (config.cluster === "mainnet-beta" || config.protocolDeployment === "mainnet-beta") {
    blockers.push("Mainnet admin actions are blocked in the testing dashboard.");
  }
  if (config.solanaBroadcastEnabled) warnings.push("Broadcast is enabled; admin actions remain proposal-only in this UI.");
  if (demoMode) blockers.push("Demo mode must be disabled before the admin dashboard can unlock.");

  let status: AdminAccessStatus = "TEST_UNLOCKED";
  if (!hasConfiguredOperatorWallet) status = "UNCONFIGURED";
  else if (!walletAddress) status = "WALLET_REQUIRED";
  else if (!walletMatches) status = "WRONG_WALLET";
  else if (demoMode) status = "DEMO_BLOCKED";
  else if (config.cluster === "mainnet-beta" || config.protocolDeployment === "mainnet-beta") status = "MAINNET_BLOCKED";

  const canOpenDashboard = status === "TEST_UNLOCKED";

  return {
    status,
    accessRole,
    configuredAdminAddress,
    configuredTreasuryAddress,
    walletAddress,
    walletMatches,
    walletMatchesAdmin,
    walletMatchesTreasury,
    canOpenDashboard,
    canDraftActions: canOpenDashboard,
    canExecuteActions: false,
    blockers,
    warnings,
  };
}

export function adminActionsExecutableInMvp() {
  return adminActionPreviews.every((action) => action.status !== "LOCALNET_READY" || action.executionRule.includes("preview"));
}

export function buildAdminLaunchReadiness({
  access,
  config,
  protocol,
  reward,
}: {
  access: AdminAccess;
  config: Pick<
    AppConfig,
    | "adminAuthorityAddress"
    | "cluster"
    | "demoMode"
    | "independentTreasuryAddress"
    | "protocolDeployment"
    | "protocolProgramId"
    | "rypMintAddress"
    | "solanaBroadcastEnabled"
  >;
  protocol: AdminProtocolReadinessInput;
  reward: AdminRewardReadinessInput;
}): AdminLaunchReadiness {
  const gates: AdminReadinessGate[] = [
    buildEnvironmentGate(config),
    buildAdminAccessGate(access),
    buildProtocolInspectionGate(protocol),
    buildModulePauseGate(protocol.activeModulePauses ?? []),
    buildRewardInspectionGate(reward),
    buildBroadcastGate(config),
  ];
  const blockers = uniqueMessages(gates.flatMap((gate) => gate.blockers));
  const warnings = uniqueMessages(gates.flatMap((gate) => gate.warnings));
  const readyCount = gates.filter((gate) => gate.status === "READY").length;
  const reviewCount = gates.filter((gate) => gate.status === "REVIEW_REQUIRED").length;
  const blockedCount = gates.filter((gate) => gate.status === "BLOCKED").length;

  return {
    status: blockedCount > 0 ? "BLOCKED" : "READY_FOR_REVIEW",
    gates,
    readyCount,
    reviewCount,
    blockedCount,
    blockers,
    warnings,
  };
}

export function buildAdminMissionControl({
  access,
  config,
  deployment,
  launchReadiness,
  protocol,
  reward,
}: AdminMissionControlInput): AdminMissionControl {
  const devnetConfigured = config.cluster === "devnet" && config.protocolDeployment === "devnet";
  const protocolDecoded = protocol.status === "DECODED";
  const rewardDecoded = reward.rewardConfigStatus === "DECODED";
  const authorityFundedForMint = deployment?.authority.fundedForMint ?? protocolDecoded;
  const authorityFundedForDeploy = deployment?.authority.fundedForDeploy ?? protocolDecoded;
  const mintReady = deployment ? deployment.mint.status === "PRESENT" && deployment.mint.isMint === true : protocolDecoded;
  const programReady = deployment
    ? deployment.program.status === "PRESENT" && deployment.program.executable === true
    : protocolDecoded;
  const fundingBlocked = devnetConfigured && !authorityFundedForMint;
  const mintWaiting = devnetConfigured && authorityFundedForMint && !mintReady;
  const programWaiting = devnetConfigured && mintReady && !programReady;
  const protocolWaiting = devnetConfigured && programReady && !protocolDecoded;
  const missionBlocked = launchReadiness.status === "BLOCKED";
  const liveBroadcastReviewed = config.solanaBroadcastEnabled && launchReadiness.status === "READY_FOR_REVIEW";
  const commands = missionCommands(config.opsEnvFile);

  const phases: AdminMissionPhase[] = [
    missionPhase({
      id: "rust-safety",
      label: "Rust Safety",
      status: "LOCAL_READY",
      summary: "Scoped pause controls, authority boundaries, and protocol safety gates are represented locally.",
      command: "npm run protocol:lint && npm run protocol:idl:check",
    }),
    missionPhase({
      id: "abi-lock",
      label: "ABI Lock",
      status: "LOCAL_READY",
      summary: "Frontend transaction planners must continue to match the Anchor IDL and account layouts.",
      command: "npm run protocol:idl:check",
    }),
    missionPhase({
      id: "local-verification",
      label: "Local Verification",
      status: "REVIEW_REQUIRED",
      summary: "Run the full local suite before treating any deployment or public preview state as reviewable.",
      command: commands.verifyLocal,
    }),
    missionPhase({
      id: "devnet-funding",
      label: "Devnet Funding",
      status: fundingBlocked ? "BLOCKED" : "LOCAL_READY",
      summary: fundingBlocked
        ? "Authority needs devnet SOL before mint creation or deployment can proceed."
        : authorityFundedForDeploy
          ? "Authority has deployment headroom for the devnet sequence."
          : "Authority has mint funding; top-up is still recommended before deployment.",
      command: commands.fundingPacket,
      blockers: fundingBlocked ? ["Fund the devnet authority if mission:status reports fund_devnet_authority."] : [],
    }),
    missionPhase({
      id: "devnet-mint",
      label: "Devnet Test Mint",
      status: mintReady ? "READY_FOR_REVIEW" : fundingBlocked ? "WAITING_ON_DEVNET" : "REVIEW_REQUIRED",
      summary: mintReady
        ? "Configured devnet RYP test mint exists and can be reviewed."
        : fundingBlocked
          ? "Mint creation waits on authority funding."
          : "Authority funding exists; create and review the configured devnet RYP test mint.",
      command: commands.mintTest,
      blockers: mintReady || fundingBlocked ? [] : deployment?.mint.status === "DECODE_ERROR" ? [deployment.mint.message] : [],
    }),
    missionPhase({
      id: "devnet-program",
      label: "Devnet Program",
      status: programReady ? "READY_FOR_REVIEW" : mintReady ? "REVIEW_REQUIRED" : "WAITING_ON_DEVNET",
      summary: programReady
        ? "Program account exists, is executable, and can be inspected."
        : mintReady
          ? "Mint is ready; deploy the program and print the initialization plan."
          : "Program deployment waits on test mint readiness.",
      command: commands.bootstrapDeploy,
      blockers: programReady || !mintReady ? [] : deployment?.program.status === "DECODE_ERROR" ? [deployment.program.message] : [],
    }),
    missionPhase({
      id: "devnet-protocol",
      label: "Devnet Protocol",
      status: protocolDecoded ? "READY_FOR_REVIEW" : protocolWaiting ? "REVIEW_REQUIRED" : "WAITING_ON_DEVNET",
      summary: protocolDecoded
        ? "Protocol config decodes from the selected deployment and can be reviewed."
        : protocolWaiting
          ? "Program is deployed; initialize and inspect protocol accounts."
          : "Protocol initialization waits on funding, mint, and program deployment.",
      command: protocolWaiting
        ? commands.initProtocol
        : commands.inspectProtocol,
      blockers: protocol.blockers,
    }),
    missionPhase({
      id: "frontend-state",
      label: "Frontend State",
      status: launchReadiness.status === "READY_FOR_REVIEW" ? "READY_FOR_REVIEW" : "WAITING_ON_DEVNET",
      summary: launchReadiness.status === "READY_FOR_REVIEW"
        ? "Admin inspectors and read-only mirrors are ready for human release review."
        : "Read-only UI mirrors remain gated by decoded devnet protocol and reward state.",
      command: commands.readOnlyReadiness,
      blockers: launchReadiness.blockers,
    }),
    missionPhase({
      id: "fee-holder-rewards",
      label: "Fees & Holder Rewards",
      status: rewardDecoded ? "READY_FOR_REVIEW" : "WAITING_ON_DEVNET",
      summary: rewardDecoded
        ? "Reward config decodes and can be reviewed against holder/staker/treasury policy."
        : "Reward vaults and holder claim paths stay local/read-only until devnet reward state exists.",
      command: "npm run rewards:epoch:admin-plan",
      blockers: reward.blockers,
    }),
    missionPhase({
      id: "projects-seedbot",
      label: "Projects & SeedBot",
      status: "LOCAL_READY",
      summary: "Project participation and SeedBot remain self-custodial, review-gated, and non-live by default.",
      command: "npm run test -- src/domain/projectRegistry.test.ts src/domain/seedbot.test.ts",
    }),
    missionPhase({
      id: "public-product",
      label: "Public Product Layer",
      status: launchReadiness.status === "READY_FOR_REVIEW" ? "READY_FOR_REVIEW" : "WAITING_ON_DEVNET",
      summary: launchReadiness.status === "READY_FOR_REVIEW"
        ? "Prepare the read-only deployment receipt and human launch checklist."
        : "MicroVerse, Admin, and locked districts are local-ready; public testnet waits on clean devnet inspection.",
      command: commands.deploymentReceiptReadOnly,
      blockers: launchReadiness.blockers,
    }),
    missionPhase({
      id: "wallet-execution",
      label: "Wallet Execution",
      status: liveBroadcastReviewed ? "READY_FOR_REVIEW" : "REVIEW_REQUIRED",
      summary: liveBroadcastReviewed
        ? "Broadcast is enabled only in a reviewed devnet lane."
        : "Keep wallet-approved mutation paths disabled until read-only devnet review passes.",
      command: commands.walletExecutionReadiness,
      blockers: liveBroadcastReviewed ? [] : ["Wallet execution requires explicit review after read-only devnet readiness."],
    }),
  ];

  const blockers = uniqueMessages(phases.flatMap((phase) =>
    phase.status === "BLOCKED" ? phase.blockers.map((blocker) => `${phase.label}: ${blocker}`) : [],
  ));
  const nextActions = uniqueMessages([
    ...(deployment?.nextActions ?? []),
    ...phases
      .filter((phase) =>
        phase.status === "BLOCKED" ||
        phase.status === "WAITING_ON_DEVNET" ||
        (phase.id.startsWith("devnet-") && phase.status === "REVIEW_REQUIRED")
      )
      .map((phase) => phase.command),
    missionBlocked ? commands.missionStatus : undefined,
  ].filter((action): action is string => Boolean(action)));

  return {
    status: missionBlocked || blockers.length > 0 ? "MISSION_BLOCKED" : "MISSION_READY_FOR_REVIEW",
    phases,
    operatorHandoff: deployment?.operatorHandoff ?? null,
    localReadyCount: phases.filter((phase) => phase.status === "LOCAL_READY").length,
    reviewCount: phases.filter((phase) => phase.status === "READY_FOR_REVIEW" || phase.status === "REVIEW_REQUIRED").length,
    waitingOnDevnetCount: phases.filter((phase) => phase.status === "WAITING_ON_DEVNET").length,
    blockedCount: phases.filter((phase) => phase.status === "BLOCKED").length,
    blockers,
    nextActions,
  };
}

export function buildAdminProtocolPreviews({
  authorityAddress,
  independentTreasuryAddress,
  rypMintAddress,
  rypDecimals,
}: {
  authorityAddress?: string;
  independentTreasuryAddress?: string;
  rypMintAddress: string;
  rypDecimals: number;
}): AdminProtocolPreview[] {
  const tierThresholdsBaseUnits = selectableTiers.map((tier) =>
    parseRypAmountToBaseUnits(tierRequirements[tier], rypDecimals),
  ) as [string, string, string, string, string];
  const tierFeeReductionBps = selectableTiers.map((tier) =>
    Math.round((PLATFORM_ACTION_BASE_FEE_BPS * tierFeeReduction[tier]) / 100),
  ) as [number, number, number, number, number];
  const holderSplitBps = splitBps("HOLDERS");
  const stakerSplitBps = splitBps("STAKERS");
  const treasurySplitBps = splitBps("INDEPENDENT_TREASURY");
  const treasuryOwnerAddress = independentTreasuryAddress;
  const treasuryVaultAddress = treasuryOwnerAddress ? deriveRypAssociatedTokenAddress(treasuryOwnerAddress) : undefined;
  const treasuryMetadataHash = treasuryVaultAddress
    ? rewardVaultMetadataHashHex({
        custodyModelVariant: 1,
        rewardVaultAddress: treasuryVaultAddress,
        roleSeed: "independent-treasury",
        rypMintAddress,
      })
    : undefined;

  return [
    safeProtocolPreview({
      authorityAddress,
      build: (address) =>
        buildInitializeConfigTransactionPlan({
          authorityAddress: address,
          baseFeeBps: PLATFORM_ACTION_BASE_FEE_BPS,
          tierFeeReductionBps,
          tierThresholdsBaseUnits,
        }),
      description: "Initialize protocol config, staking vault, tier thresholds, and platform action fee policy.",
      executionRule: "Devnet/localnet only until deployment authority and production policy are reviewed.",
      id: "initialize-config",
      label: "Initialize Protocol Config",
    }),
    safeProtocolPreview({
      authorityAddress,
      build: (address) =>
        buildInitializeRewardConfigTransactionPlan({
          authorityAddress: address,
          epochCadenceSeconds: DEFAULT_REWARD_EPOCH_CADENCE_SECONDS,
          holderSplitBps,
          stakerSplitBps,
          treasurySplitBps,
        }),
      description: "Initialize draft-only holder, staker, and independent treasury reward routing config.",
      executionRule: "Creates routing config only; reward epochs and payouts remain separately reviewed.",
      id: "initialize-reward-config",
      label: "Initialize Reward Config",
    }),
    safeProtocolPreview({
      authorityAddress,
      build: (address) => {
        if (!treasuryVaultAddress || !treasuryMetadataHash) {
          throw new Error("Independent treasury address is required for treasury vault previews.");
        }
        return buildRegisterRewardVaultTransactionPlan({
          authorityAddress: address,
          custodyModel: "TREASURY_CONTROLLED",
          metadataHash: treasuryMetadataHash,
          rewardRole: "INDEPENDENT_TREASURY",
          vaultAddress: treasuryVaultAddress,
        });
      },
      description: "Register the independent treasury reward vault state and reviewed metadata hash.",
      executionRule: "Preview-only; sign only after treasury owner, ATA, and custody disclosure are reviewed.",
      id: "register-independent-treasury-vault",
      label: "Register Treasury Reward Vault",
    }),
    safeProtocolPreview({
      authorityAddress,
      build: (address) => {
        if (!treasuryMetadataHash) {
          throw new Error("Independent treasury address is required for treasury vault previews.");
        }
        return buildVerifyRewardVaultTransactionPlan({
          authorityAddress: address,
          expectedMetadataHash: treasuryMetadataHash,
          rewardRole: "INDEPENDENT_TREASURY",
        });
      },
      description: "Verify the independent treasury reward vault metadata before fee routing can use it.",
      executionRule: "Requires the matching register_reward_vault transaction and external custody review first.",
      id: "verify-independent-treasury-vault",
      label: "Verify Treasury Reward Vault",
    }),
    safeProtocolPreview({
      authorityAddress,
      build: (address) =>
        buildUpdateFeeConfigTransactionPlan({
          authorityAddress: address,
          baseFeeBps: PLATFORM_ACTION_BASE_FEE_BPS,
          tierFeeReductionBps,
        }),
      description: "Prepare the platform/action fee update with staking-tier reductions.",
      executionRule: "Admin-only protocol config update; no arbitrary wallet transfer tax is enforced here.",
      id: "update-fee-config",
      label: "Update Platform Fee Config",
    }),
    ...PROTOCOL_MODULE_PAUSE_PREVIEWS.map((module) =>
      safeProtocolPreview({
        authorityAddress,
        build: (address) =>
          buildSetModulePauseTransactionPlan({
            authorityAddress: address,
            moduleFlags: module.flag,
            paused: true,
          }),
        description: module.description,
        executionRule: "Preview-only scoped emergency control; sign only after incident review and public ops logging.",
        id: `pause-${module.id}-module`,
        label: `Pause ${module.label} Module`,
      }),
    ),
    safeProtocolPreview({
      authorityAddress,
      build: (address) =>
        buildSetModulePauseTransactionPlan({
          authorityAddress: address,
          moduleFlags: PROTOCOL_PAUSE_MODULE_MASK,
          paused: false,
        }),
      description: "Clear all scoped module pause flags after incident review confirms normal operation can resume.",
      executionRule: "Preview-only recovery control; do not clear broad incidents without authority and ops review.",
      id: "clear-module-pauses",
      label: "Clear Module Pauses",
    }),
    {
      blockers: [
        "The live RYP mint uses the legacy SPL Token program, so universal transfer-fee enforcement needs a reviewed wrapper, migration, or token-extension route.",
      ],
      description: `Track the ${RYP_TOKEN_TRANSFER_FEE_BPS / 100}% RYP token-transfer fee target using the same core split policy.`,
      executionRule: "Blocked for direct legacy SPL mint enforcement; app-controlled routes remain previewable.",
      id: "ryp-transfer-fee-route",
      label: "RYP Transfer Fee Route",
      status: "BLOCKED",
      warnings: [`Core split total: ${BPS_DENOMINATOR} bps across holders, stakers, and independent treasury.`],
    },
  ];
}

function buildEnvironmentGate(
  config: Pick<
    AppConfig,
    | "adminAuthorityAddress"
    | "cluster"
    | "demoMode"
    | "independentTreasuryAddress"
    | "protocolDeployment"
    | "protocolProgramId"
    | "rypMintAddress"
  >,
): AdminReadinessGate {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!config.adminAuthorityAddress) blockers.push("Public testnet readiness requires VITE_ADMIN_AUTHORITY_ADDRESS.");
  if (!config.independentTreasuryAddress) {
    blockers.push("Public testnet readiness requires VITE_INDEPENDENT_TREASURY_ADDRESS.");
  }
  if (
    config.adminAuthorityAddress &&
    config.independentTreasuryAddress &&
    config.adminAuthorityAddress === config.independentTreasuryAddress
  ) {
    blockers.push("Independent treasury address must be distinct from the admin authority wallet.");
  }
  if (config.cluster !== "devnet") blockers.push("Public testnet readiness requires VITE_SOLANA_CLUSTER=devnet.");
  if (config.protocolDeployment !== "devnet") {
    blockers.push("Public testnet readiness requires VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT=devnet.");
  }
  if (config.protocolProgramId === PLACEHOLDER_PROTOCOL_PROGRAM_ID) {
    blockers.push("Protocol program id is still the placeholder.");
  }
  if (config.demoMode) blockers.push("Demo mode must be disabled for public testnet review.");
  if (config.cluster === "devnet" && config.rypMintAddress === RYP_MINT_ADDRESS) {
    blockers.push("Devnet must use the configured devnet RYP test mint, not the mainnet RYP mint.");
  }
  if (config.cluster === "mainnet-beta" || config.protocolDeployment === "mainnet-beta") {
    blockers.push("Mainnet is blocked until final launch review.");
  }
  if (config.cluster === "localnet") {
    warnings.push("Localnet is valid for development smoke tests, not public testnet launch review.");
  }

  return readinessGate({
    blockers,
    id: "environment",
    label: "Environment",
    readySummary: "Devnet environment is selected with a reviewed program id and test mint.",
    summary: "Cluster, deployment mode, program id, demo mode, and RYP mint must match the public testnet lane.",
    warnings,
  });
}

function buildAdminAccessGate(access: AdminAccess): AdminReadinessGate {
  return readinessGate({
    blockers: access.blockers,
    id: "admin-access",
    label: "Admin Access",
    readySummary: `${formatAdminAccessRole(access.accessRole)} is connected and dashboard drafting is unlocked.`,
    summary: "A configured admin authority or independent treasury operator wallet must be connected before launch review actions can be prepared.",
    warnings: access.warnings,
  });
}

function formatAdminAccessRole(role: AdminAccessRole) {
  if (role === "ADMIN_AUTHORITY") return "Configured admin authority";
  if (role === "INDEPENDENT_TREASURY") return "Independent treasury owner";
  return "Configured operator wallet";
}

function buildProtocolInspectionGate(protocol: AdminProtocolReadinessInput): AdminReadinessGate {
  const blockers = [...protocol.blockers];
  const warnings = [...protocol.warnings];
  if (protocol.status !== "DECODED") {
    blockers.push("Protocol config must decode from the selected devnet program before public testnet review.");
  }

  return readinessGate({
    blockers,
    id: "protocol-inspection",
    label: "Protocol Inspection",
    readySummary: "Protocol config decodes cleanly and has no inspection blockers.",
    summary: "Protocol config, tier policy, authorities, and vault address must be readable from devnet.",
    warnings,
  });
}

function buildModulePauseGate(activeModulePauses: string[]): AdminReadinessGate {
  const blockers = activeModulePauses.map((module) => `${module} module pause is active.`);

  return readinessGate({
    blockers,
    id: "module-pauses",
    label: "Module Pauses",
    readySummary: "No scoped protocol module pause is active.",
    summary: "Public testnet review should not start while staking, governance, projects, SeedBot, or fee routing is paused.",
    warnings: [],
  });
}

function buildRewardInspectionGate(reward: AdminRewardReadinessInput): AdminReadinessGate {
  const blockers = [...reward.blockers];
  const warnings = [...reward.warnings];
  if (reward.rewardConfigStatus !== "DECODED") {
    blockers.push("Reward config must decode from devnet before public reward inspection review.");
  }
  if (reward.epochStatus !== "DECODED" && reward.epochStatus !== "PREVIEW_ONLY") {
    blockers.push("Reward epoch inspection must be decoded or preview-only before public testnet review.");
  }

  return readinessGate({
    blockers,
    id: "reward-inspection",
    label: "Reward Inspection",
    readySummary: "Reward config, vault states, and epoch inspection pass read-only validation.",
    summary: "Holder/staker/treasury reward state must stay read-only and decode without unsafe vault or epoch blockers.",
    warnings,
  });
}

function buildBroadcastGate(
  config: Pick<AppConfig, "protocolDeployment" | "solanaBroadcastEnabled">,
): AdminReadinessGate {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (config.solanaBroadcastEnabled && config.protocolDeployment !== "devnet") {
    blockers.push("Broadcast cannot be enabled outside the reviewed devnet deployment lane.");
  }
  if (!config.solanaBroadcastEnabled) {
    warnings.push("Broadcast remains disabled until devnet account inspection and wallet simulation review pass.");
  }

  return {
    blockers,
    id: "broadcast-boundary",
    label: "Broadcast Boundary",
    status: blockers.length > 0 ? "BLOCKED" : config.solanaBroadcastEnabled ? "READY" : "REVIEW_REQUIRED",
    summary: config.solanaBroadcastEnabled
      ? "Broadcast flag is enabled for reviewed devnet testing."
      : "Broadcast is intentionally disabled pending final devnet review.",
    warnings,
  };
}

function readinessGate({
  blockers,
  id,
  label,
  readySummary,
  summary,
  warnings,
}: {
  blockers: string[];
  id: string;
  label: string;
  readySummary: string;
  summary: string;
  warnings: string[];
}): AdminReadinessGate {
  return {
    blockers: uniqueMessages(blockers),
    id,
    label,
    status: blockers.length > 0 ? "BLOCKED" : "READY",
    summary: blockers.length > 0 ? summary : readySummary,
    warnings: uniqueMessages(warnings),
  };
}

function missionPhase({
  blockers = [],
  command,
  id,
  label,
  status,
  summary,
}: Omit<AdminMissionPhase, "blockers"> & { blockers?: string[] }) {
  return {
    blockers: uniqueMessages(blockers),
    command,
    id,
    label,
    status,
    summary,
  };
}

function safeProtocolPreview({
  authorityAddress,
  build,
  description,
  executionRule,
  id,
  label,
}: {
  authorityAddress?: string;
  build: (authorityAddress: string) => PreparedSolanaTransactionPlan;
  description: string;
  executionRule: string;
  id: string;
  label: string;
}): AdminProtocolPreview {
  if (!authorityAddress) {
    return {
      blockers: ["Configured admin authority is required before this transaction can be previewed."],
      description,
      executionRule,
      id,
      label,
      status: "BLOCKED",
      warnings: [],
    };
  }

  try {
    const plan = build(authorityAddress);
    return {
      blockers: [],
      description,
      executionRule,
      id,
      label,
      plan,
      status: "READY",
      warnings: plan.warnings,
    };
  } catch (error) {
    return {
      blockers: [`Transaction preview failed: ${error instanceof Error ? error.message : "unknown error"}.`],
      description,
      executionRule,
      id,
      label,
      status: "BLOCKED",
      warnings: [],
    };
  }
}

function splitBps(bucket: "HOLDERS" | "STAKERS" | "INDEPENDENT_TREASURY") {
  const entry = draftCoreFeeSplit.find((candidate) => candidate.bucket === bucket);
  if (!entry) throw new Error(`Missing fee split bucket: ${bucket}`);
  return entry.shareBps;
}

function missionCommands(opsEnvFile: string) {
  const envArg = `--env ${opsEnvFile}`;
  return {
    bootstrapDeploy: `npm run devnet:bootstrap -- ${envArg} --deploy --init-plan`,
    deploymentReceiptReadOnly: `npm run devnet:deployment:receipt -- --profile read-only ${envArg}`,
    fundingPacket: `npm run devnet:funding:packet -- ${envArg}`,
    initProtocol: `npm run devnet:init:protocol -- ${envArg}`,
    inspectProtocol: `npm run devnet:inspect:protocol -- ${envArg}`,
    mintTest: `npm run devnet:mint:test -- ${envArg}`,
    missionStatus: `npm run mission:status -- ${envArg}`,
    readOnlyReadiness: `npm run testnet:readiness -- --profile read-only ${envArg}`,
    verifyLocal: "npm run verify:local",
    walletExecutionReadiness: `npm run testnet:readiness -- --profile wallet-execution ${envArg}`,
  };
}

function rewardVaultMetadataHashHex({
  custodyModelVariant,
  rewardVaultAddress,
  roleSeed,
  rypMintAddress,
}: {
  custodyModelVariant: number;
  rewardVaultAddress: string;
  roleSeed: string;
  rypMintAddress: string;
}) {
  const encoder = new TextEncoder();
  const digest = sha256(
    concatBytes(
      encoder.encode("cryptoseeds-devnet-reward-vault-v1"),
      encoder.encode(roleSeed),
      encoder.encode(rewardVaultAddress),
      encoder.encode(rypMintAddress),
      encoder.encode(String(custodyModelVariant)),
    ),
  );
  return bytesToHex(digest);
}

function concatBytes(...chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}
