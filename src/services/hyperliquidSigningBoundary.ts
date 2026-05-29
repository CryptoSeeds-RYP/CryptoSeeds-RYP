import {
  type HyperliquidAgentApprovalPreview,
  type HyperliquidCancelOrderDraft,
  type HyperliquidOrderStatusQuery,
  type HyperliquidScheduleCancelDraft,
  type HyperliquidUnsignedOrderDraft,
} from "./hyperliquidAdapter";

export type HyperliquidSigningScheme = "L1_ACTION" | "AGENT_APPROVAL";
export type HyperliquidSignerRoute = "MASTER_WALLET" | "APPROVED_AGENT";
export type HyperliquidSigningIntentStatus = "BLOCKED" | "READY_FOR_WALLET" | "READY_FOR_AGENT";

export type HyperliquidSigningIntent = {
  status: HyperliquidSigningIntentStatus;
  scheme: HyperliquidSigningScheme;
  route: HyperliquidSignerRoute;
  signerAddress?: string;
  accountAddress?: string;
  network: "MAINNET" | "TESTNET";
  blockedReasons: string[];
  sdkRequired: true;
  sdkMethod: "sign_l1_action" | "approve_agent";
  broadcastEndpoint?: string;
  unsignedPayload?: unknown;
  safetyChecklist: string[];
};

export type HyperliquidReadOnlyIntent = {
  status: "BLOCKED" | "READY";
  blockedReasons: string[];
  signatureRequired: false;
  unsignedPayload?: unknown;
  safetyChecklist: string[];
};

export type HyperliquidSignableDraft =
  | HyperliquidUnsignedOrderDraft
  | HyperliquidCancelOrderDraft
  | HyperliquidScheduleCancelDraft;

export function buildHyperliquidL1SigningIntent({
  draft,
  route = "APPROVED_AGENT",
  signerAddress,
  accountAddress,
  allowMainnet = false,
}: {
  draft: HyperliquidSignableDraft;
  route?: HyperliquidSignerRoute;
  signerAddress?: string;
  accountAddress?: string;
  allowMainnet?: boolean;
}): HyperliquidSigningIntent {
  const blockedReasons = [
    ...draft.blockedReasons,
    ...(draft.status === "READY_FOR_SIGNATURE" ? [] : ["Draft is not ready for signature."]),
    ...validateEvmAddress("signerAddress", signerAddress),
    ...validateEvmAddress("accountAddress", accountAddress),
    ...(draft.network === "MAINNET" && !allowMainnet ? ["Mainnet signing is disabled for this integration stage."] : []),
    ...(draft.request ? [] : ["Unsigned request payload is missing."]),
  ];

  return {
    status: blockedReasons.length > 0 ? "BLOCKED" : route === "APPROVED_AGENT" ? "READY_FOR_AGENT" : "READY_FOR_WALLET",
    scheme: "L1_ACTION",
    route,
    signerAddress: normalizeAddress(signerAddress),
    accountAddress: normalizeAddress(accountAddress),
    network: draft.network,
    blockedReasons,
    sdkRequired: true,
    sdkMethod: "sign_l1_action",
    broadcastEndpoint: blockedReasons.length > 0 ? undefined : draft.exchangeEndpoint,
    unsignedPayload: draft.request,
    safetyChecklist: [
      "Use the official Hyperliquid SDK signing path; do not hand-roll msgpack/EIP-712 serialization.",
      "Never store private keys, seed phrases, or raw signing material in the CryptoSeeds app.",
      "Lowercase addresses before signing or sending.",
      "Use a fresh nonce from the signer route immediately before signing.",
      "Keep testnet as the default until order placement, status polling, and cancel flows are proven.",
    ],
  };
}

export function buildHyperliquidAgentApprovalSigningIntent({
  approval,
  masterWalletAddress,
  allowMainnet = false,
}: {
  approval: HyperliquidAgentApprovalPreview;
  masterWalletAddress?: string;
  allowMainnet?: boolean;
}): HyperliquidSigningIntent {
  const agentAddress = approval.actionDraft.agentAddress;
  const blockedReasons = [
    ...validateEvmAddress("masterWalletAddress", masterWalletAddress),
    ...validateEvmAddress("agentAddress", agentAddress),
    ...(isZeroAddress(agentAddress) ? ["Agent address must be generated outside the UI before approval."] : []),
    ...(approval.network === "MAINNET" && !allowMainnet
      ? ["Mainnet agent approval is disabled for this integration stage."]
      : []),
  ];

  return {
    status: blockedReasons.length > 0 ? "BLOCKED" : "READY_FOR_WALLET",
    scheme: "AGENT_APPROVAL",
    route: "MASTER_WALLET",
    signerAddress: normalizeAddress(masterWalletAddress),
    accountAddress: normalizeAddress(masterWalletAddress),
    network: approval.network,
    blockedReasons,
    sdkRequired: true,
    sdkMethod: "approve_agent",
    broadcastEndpoint: blockedReasons.length > 0 ? undefined : approval.exchangeEndpoint,
    unsignedPayload: approval.actionDraft,
    safetyChecklist: [
      "Master wallet approval must be an explicit user action.",
      "Generate agent credentials outside the browser UI and never persist private keys in CryptoSeeds.",
      "Use named agents so the user can understand and revoke permissions.",
      "Treat agent approval as trading authority only, never withdrawal authority.",
    ],
  };
}

export function buildHyperliquidReadOnlyStatusIntent({
  query,
}: {
  query: HyperliquidOrderStatusQuery;
}): HyperliquidReadOnlyIntent {
  return {
    status: query.status,
    blockedReasons: query.blockedReasons,
    signatureRequired: false,
    unsignedPayload: query.body,
    safetyChecklist: [
      "Read-only status queries must not request a signature.",
      "Use the master account address for status queries, not the agent wallet address.",
    ],
  };
}

function validateEvmAddress(label: string, value?: string) {
  if (value && /^0x[0-9a-fA-F]{40}$/.test(value)) return [];
  return [`${label} must be a 42-character EVM address.`];
}

function normalizeAddress(value?: string) {
  return value?.toLowerCase();
}

function isZeroAddress(value: string) {
  return /^0x0{40}$/i.test(value);
}
