import { sha256 } from "@noble/hashes/sha2";
import type { AppConfig } from "../config/env";
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
  buildUpdateFeeConfigTransactionPlan,
  buildVerifyRewardVaultTransactionPlan,
  deriveRypAssociatedTokenAddress,
  parseRypAmountToBaseUnits,
} from "../solana/protocolTransactionPlan";

export type AdminAccessStatus =
  | "UNCONFIGURED"
  | "WALLET_REQUIRED"
  | "WRONG_WALLET"
  | "TEST_UNLOCKED"
  | "DEMO_BLOCKED"
  | "MAINNET_BLOCKED";

export type AdminActionStatus = "DRAFT_ONLY" | "LOCALNET_READY" | "DEVNET_READY" | "REVIEW_GATED" | "BLOCKED";

export type AdminAccess = {
  status: AdminAccessStatus;
  configuredAdminAddress?: string;
  walletAddress?: string;
  walletMatches: boolean;
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

const DEFAULT_REWARD_EPOCH_CADENCE_SECONDS = 7 * 24 * 60 * 60;

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
    "adminAuthorityAddress" | "cluster" | "protocolDeployment" | "solanaBroadcastEnabled"
  >;
  walletAddress?: string;
  demoMode: boolean;
}): AdminAccess {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const configuredAdminAddress = config.adminAuthorityAddress;
  const walletMatches = Boolean(configuredAdminAddress && walletAddress === configuredAdminAddress);

  if (!configuredAdminAddress) blockers.push("VITE_ADMIN_AUTHORITY_ADDRESS is not configured.");
  if (!walletAddress) blockers.push("Connect the configured admin wallet to unlock this dashboard.");
  if (configuredAdminAddress && walletAddress && !walletMatches) blockers.push("Connected wallet is not the configured admin authority.");
  if (config.cluster === "mainnet-beta" || config.protocolDeployment === "mainnet-beta") {
    blockers.push("Mainnet admin actions are blocked in the testing dashboard.");
  }
  if (config.solanaBroadcastEnabled) warnings.push("Broadcast is enabled; admin actions remain proposal-only in this UI.");
  if (demoMode) blockers.push("Demo mode must be disabled before the admin dashboard can unlock.");

  let status: AdminAccessStatus = "TEST_UNLOCKED";
  if (!configuredAdminAddress) status = "UNCONFIGURED";
  else if (!walletAddress) status = "WALLET_REQUIRED";
  else if (!walletMatches) status = "WRONG_WALLET";
  else if (demoMode) status = "DEMO_BLOCKED";
  else if (config.cluster === "mainnet-beta" || config.protocolDeployment === "mainnet-beta") status = "MAINNET_BLOCKED";

  const canOpenDashboard = status === "TEST_UNLOCKED";

  return {
    status,
    configuredAdminAddress,
    walletAddress,
    walletMatches,
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
  const treasuryOwnerAddress = independentTreasuryAddress ?? authorityAddress;
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
          throw new Error("Independent treasury vault address could not be derived.");
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
          throw new Error("Independent treasury metadata hash could not be derived.");
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
