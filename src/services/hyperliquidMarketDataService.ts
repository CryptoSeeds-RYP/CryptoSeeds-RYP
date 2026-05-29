import type { SeedBotStrategyAsset } from "../domain/seedbot";
import { DEFAULT_HYPERLIQUID_NETWORK, hyperliquidConfig, type HyperliquidNetwork } from "./hyperliquidAdapter";

export type HyperliquidMetaAsset = {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  marginTableId: number;
  isDelisted?: boolean;
  onlyIsolated?: boolean;
  marginMode?: string;
};

export type HyperliquidMetaResponse = {
  universe: HyperliquidMetaAsset[];
};

export type HyperliquidAssetResolution = {
  symbol: string;
  assetId?: number;
  name?: string;
  szDecimals?: number;
  maxLeverage?: number;
  tradable: boolean;
  blockedReason?: string;
};

type HyperliquidFetch = (
  input: string,
  init: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export async function fetchHyperliquidMeta({
  network = DEFAULT_HYPERLIQUID_NETWORK,
  fetcher = globalThis.fetch as HyperliquidFetch,
}: {
  network?: HyperliquidNetwork;
  fetcher?: HyperliquidFetch;
} = {}): Promise<HyperliquidMetaResponse> {
  const config = hyperliquidConfig(network);
  const response = await fetcher(config.infoEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "meta" }),
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid meta request failed with status ${response.status}`);
  }

  return parseHyperliquidMeta(await response.json());
}

export function parseHyperliquidMeta(value: unknown): HyperliquidMetaResponse {
  if (!value || typeof value !== "object" || !Array.isArray((value as HyperliquidMetaResponse).universe)) {
    throw new Error("Invalid Hyperliquid meta response");
  }

  return {
    universe: (value as HyperliquidMetaResponse).universe.filter(isHyperliquidMetaAsset),
  };
}

export function resolveHyperliquidAsset(meta: HyperliquidMetaResponse, symbol: string): HyperliquidAssetResolution {
  const normalized = symbol.toUpperCase();
  const assetId = meta.universe.findIndex((asset) => asset.name.toUpperCase() === normalized);

  if (assetId < 0) {
    return {
      symbol,
      tradable: false,
      blockedReason: "Asset is missing from Hyperliquid meta universe.",
    };
  }

  const asset = meta.universe[assetId];
  const blockedReason = asset.isDelisted ? "Asset is delisted on Hyperliquid." : undefined;

  return {
    symbol,
    assetId,
    name: asset.name,
    szDecimals: asset.szDecimals,
    maxLeverage: asset.maxLeverage,
    tradable: !asset.isDelisted,
    blockedReason,
  };
}

export function resolveHyperliquidStrategyAssets(
  meta: HyperliquidMetaResponse,
  assets: SeedBotStrategyAsset[],
): HyperliquidAssetResolution[] {
  return assets.map((asset) => resolveHyperliquidAsset(meta, asset.symbol));
}

function isHyperliquidMetaAsset(value: unknown): value is HyperliquidMetaAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<HyperliquidMetaAsset>;
  return (
    typeof asset.name === "string" &&
    typeof asset.szDecimals === "number" &&
    typeof asset.maxLeverage === "number" &&
    typeof asset.marginTableId === "number"
  );
}
