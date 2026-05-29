import type { SeedBotStrategyAsset } from "../domain/seedbot";

export type HyperliquidNetwork = "MAINNET" | "TESTNET";
export type HyperliquidChainName = "Mainnet" | "Testnet";
export type HyperliquidTif = "Alo" | "Ioc" | "Gtc";

export type HyperliquidEndpointConfig = {
  network: HyperliquidNetwork;
  apiBaseUrl: string;
  exchangeEndpoint: string;
  infoEndpoint: string;
  hyperliquidChain: HyperliquidChainName;
  signatureChainId: string;
};

export type HyperliquidOrderPreviewPayload = {
  network: HyperliquidNetwork;
  hyperliquidChain: HyperliquidChainName;
  exchangeEndpoint: string;
  actionDraft: {
    type: "order";
    grouping: "na";
    orders: Array<{
      assetSymbol: string;
      targetWeightPercent: number;
      officialFields: {
        a: "PENDING_META_ASSET_ID";
        b: boolean;
        p: "PENDING_LIMIT_PRICE";
        s: string;
        r: false;
        t: { limit: { tif: HyperliquidTif } };
      };
      resolution: {
        assetIdSource: "info.meta universe";
        priceSource: "venue quote or user limit";
        sizeSource: "strategy allocation and account equity";
      };
    }>;
  };
  nonce: "timestamp-ms-at-signing";
  expiresAfter: "timestamp-ms-at-signing-plus-user-configured-ttl";
  signature: "wallet-or-approved-agent-signature-required";
  requiredBeforeSigning: string[];
};

export type HyperliquidAgentApprovalPreview = {
  network: HyperliquidNetwork;
  exchangeEndpoint: string;
  actionDraft: {
    type: "approveAgent";
    hyperliquidChain: HyperliquidChainName;
    signatureChainId: string;
    agentAddress: string;
    agentName: string;
    nonce: "timestamp-ms-at-signing";
  };
  nonce: "must-match-action-nonce";
  signature: "master-wallet-signature-required";
  safetyChecks: string[];
};

export const DEFAULT_HYPERLIQUID_NETWORK: HyperliquidNetwork = "TESTNET";

export const hyperliquidEndpointConfigs: Record<HyperliquidNetwork, HyperliquidEndpointConfig> = {
  MAINNET: {
    network: "MAINNET",
    apiBaseUrl: "https://api.hyperliquid.xyz",
    exchangeEndpoint: "https://api.hyperliquid.xyz/exchange",
    infoEndpoint: "https://api.hyperliquid.xyz/info",
    hyperliquidChain: "Mainnet",
    signatureChainId: "0xa4b1",
  },
  TESTNET: {
    network: "TESTNET",
    apiBaseUrl: "https://api.hyperliquid-testnet.xyz",
    exchangeEndpoint: "https://api.hyperliquid-testnet.xyz/exchange",
    infoEndpoint: "https://api.hyperliquid-testnet.xyz/info",
    hyperliquidChain: "Testnet",
    signatureChainId: "0xa4b1",
  },
};

export function hyperliquidConfig(network: HyperliquidNetwork = DEFAULT_HYPERLIQUID_NETWORK) {
  return hyperliquidEndpointConfigs[network];
}

export function buildHyperliquidOrderPreviewPayload({
  asset,
  network = DEFAULT_HYPERLIQUID_NETWORK,
  tif = "Ioc",
}: {
  asset: SeedBotStrategyAsset;
  network?: HyperliquidNetwork;
  tif?: HyperliquidTif;
}): HyperliquidOrderPreviewPayload {
  const config = hyperliquidConfig(network);

  return {
    network: config.network,
    hyperliquidChain: config.hyperliquidChain,
    exchangeEndpoint: config.exchangeEndpoint,
    actionDraft: {
      type: "order",
      grouping: "na",
      orders: [
        {
          assetSymbol: asset.symbol,
          targetWeightPercent: asset.targetWeightPercent,
          officialFields: {
            a: "PENDING_META_ASSET_ID",
            b: true,
            p: "PENDING_LIMIT_PRICE",
            s: `${asset.targetWeightPercent}% allocation`,
            r: false,
            t: { limit: { tif } },
          },
          resolution: {
            assetIdSource: "info.meta universe",
            priceSource: "venue quote or user limit",
            sizeSource: "strategy allocation and account equity",
          },
        },
      ],
    },
    nonce: "timestamp-ms-at-signing",
    expiresAfter: "timestamp-ms-at-signing-plus-user-configured-ttl",
    signature: "wallet-or-approved-agent-signature-required",
    requiredBeforeSigning: [
      "Resolve numeric asset id from Hyperliquid info/meta before signing.",
      "Resolve limit price from live venue quote or explicit user limit.",
      "Convert strategy allocation into capped order size from account equity.",
      "Attach wallet or approved-agent signature only after user authorization.",
    ],
  };
}

export function buildHyperliquidAgentApprovalPreview({
  network = DEFAULT_HYPERLIQUID_NETWORK,
  agentAddress = "0x0000000000000000000000000000000000000000",
  agentName = "CryptoSeeds SeedBot",
}: {
  network?: HyperliquidNetwork;
  agentAddress?: string;
  agentName?: string;
} = {}): HyperliquidAgentApprovalPreview {
  const config = hyperliquidConfig(network);

  return {
    network: config.network,
    exchangeEndpoint: config.exchangeEndpoint,
    actionDraft: {
      type: "approveAgent",
      hyperliquidChain: config.hyperliquidChain,
      signatureChainId: config.signatureChainId,
      agentAddress,
      agentName,
      nonce: "timestamp-ms-at-signing",
    },
    nonce: "must-match-action-nonce",
    signature: "master-wallet-signature-required",
    safetyChecks: [
      "Agent approval must be initiated by the user's own wallet.",
      "Agent keys must never be treated as withdrawal authority.",
      "Use named agents and revocation UX before live automation.",
      "Keep testnet as the default environment until signed-order QA is complete.",
    ],
  };
}

export function hyperliquidExecutionSafeguards(network: HyperliquidNetwork = DEFAULT_HYPERLIQUID_NETWORK) {
  return [
    `Default execution environment is ${network}.`,
    "No withdrawal action is generated.",
    "Order payload is preview-only until wallet or approved agent signature is present.",
    "Use expiresAfter on signed actions to limit stale execution.",
    "Use per-strategy max allocation, max slippage, and position limits before live mode.",
    "Resolve numeric asset ids from the info endpoint before signing.",
  ];
}
