import type { AppConfig } from "../config/env";

export type AdminAccessStatus =
  | "UNCONFIGURED"
  | "WALLET_REQUIRED"
  | "WRONG_WALLET"
  | "TEST_UNLOCKED"
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
  if (demoMode) warnings.push("Demo mode is active; admin state is a local preview only.");

  let status: AdminAccessStatus = "TEST_UNLOCKED";
  if (!configuredAdminAddress) status = "UNCONFIGURED";
  else if (!walletAddress) status = "WALLET_REQUIRED";
  else if (!walletMatches) status = "WRONG_WALLET";
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
