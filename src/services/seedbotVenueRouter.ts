import { appConfig } from "../config/env";
import type { SeedBotStrategy, SeedBotStrategyAsset } from "../domain/seedbot";
import type { SeedBotVenueId } from "../domain/seedbotVenues";
import { venueById } from "../domain/seedbotVenues";
import {
  buildHyperliquidAgentApprovalPreview,
  buildHyperliquidOrderPreviewPayload,
  hyperliquidConfig,
  hyperliquidExecutionSafeguards,
} from "./hyperliquidAdapter";

export type SeedBotExecutionMode = "DRY_RUN" | "WALLET_SIGNED";

export type SeedBotVenueRoute = {
  venueId: SeedBotVenueId;
  venueName: string;
  walletRoute: SeedBotStrategyAsset["walletRoute"];
  mode: SeedBotExecutionMode;
  endpoint?: string;
  executionEnvironment?: string;
  assets: SeedBotStrategyAsset[];
  orderPreview: SeedBotOrderPreview[];
  authorizationPreview?: Record<string, unknown>;
  safetyChecks: string[];
};

export type SeedBotOrderPreview = {
  symbol: string;
  targetWeightPercent: number;
  side: "BUY" | "SELL" | "REBALANCE";
  orderType: "MARKET_PREVIEW" | "LIMIT_PREVIEW" | "ROUTE_PREVIEW";
  payload: Record<string, unknown>;
};

export type SeedBotRoutePlan = {
  strategyId: string;
  strategyName: string;
  mode: SeedBotExecutionMode;
  routes: SeedBotVenueRoute[];
  blockedReasons: string[];
};

export function buildSeedBotRoutePlan({
  strategy,
  mode = "DRY_RUN",
}: {
  strategy: SeedBotStrategy;
  mode?: SeedBotExecutionMode;
}): SeedBotRoutePlan {
  const venueIds = Array.from(new Set(strategy.assets.map((asset) => asset.venueId)));
  const routes = venueIds
    .map((venueId) => buildVenueRoute({ strategy, venueId, mode }))
    .filter((route): route is SeedBotVenueRoute => Boolean(route));
  const blockedReasons = routes.flatMap((route) => {
    const venue = venueById(route.venueId);
    return venue?.apiReady ? [] : [`${route.venueName} is blocked pending venue due diligence.`];
  });

  return {
    strategyId: strategy.id,
    strategyName: strategy.name,
    mode,
    routes,
    blockedReasons,
  };
}

function buildVenueRoute({
  strategy,
  venueId,
  mode,
}: {
  strategy: SeedBotStrategy;
  venueId: SeedBotVenueId;
  mode: SeedBotExecutionMode;
}) {
  const venue = venueById(venueId);
  if (!venue) return undefined;

  const assets = strategy.assets.filter((asset) => asset.venueId === venueId);

  if (venueId === "HYPERLIQUID") {
    return buildHyperliquidRoute({ venueId, venueName: venue.name, assets, mode });
  }

  if (venueId === "JUPITER") {
    return buildJupiterRoute({ venueId, venueName: venue.name, assets, mode });
  }

  if (venueId === "GRVT") {
    return buildGrvtRoute({ venueId, venueName: venue.name, assets, mode });
  }

  return {
    venueId,
    venueName: venue.name,
    walletRoute: "METAMASK",
    mode,
    assets,
    orderPreview: [],
    safetyChecks: ["Venue adapter is blocked pending official API and security review."],
  } satisfies SeedBotVenueRoute;
}

function buildHyperliquidRoute({
  venueId,
  venueName,
  assets,
  mode,
}: {
  venueId: SeedBotVenueId;
  venueName: string;
  assets: SeedBotStrategyAsset[];
  mode: SeedBotExecutionMode;
}): SeedBotVenueRoute {
  const config = hyperliquidConfig(appConfig.seedBotHyperliquidNetwork);
  const routeMode = appConfig.seedBotSignedExecutionEnabled ? mode : "DRY_RUN";

  return {
    venueId,
    venueName,
    walletRoute: "METAMASK",
    mode: routeMode,
    endpoint: config.exchangeEndpoint,
    executionEnvironment: config.network,
    assets,
    orderPreview: assets.map((asset) => ({
      symbol: asset.symbol,
      targetWeightPercent: asset.targetWeightPercent,
      side: "REBALANCE",
      orderType: "LIMIT_PREVIEW",
      payload: buildHyperliquidOrderPreviewPayload({ asset, network: config.network }),
    })),
    authorizationPreview: buildHyperliquidAgentApprovalPreview({ network: config.network }) as unknown as Record<
      string,
      unknown
    >,
    safetyChecks: [
      ...hyperliquidExecutionSafeguards(config.network),
      ...(appConfig.seedBotSignedExecutionEnabled ? [] : ["Signed execution feature flag is disabled."]),
    ],
  };
}

function buildJupiterRoute({
  venueId,
  venueName,
  assets,
  mode,
}: {
  venueId: SeedBotVenueId;
  venueName: string;
  assets: SeedBotStrategyAsset[];
  mode: SeedBotExecutionMode;
}): SeedBotVenueRoute {
  return {
    venueId,
    venueName,
    walletRoute: "PHANTOM",
    mode,
    endpoint: "https://quote-api.jup.ag/v6/quote",
    assets,
    orderPreview: assets.map((asset) => ({
      symbol: asset.symbol,
      targetWeightPercent: asset.targetWeightPercent,
      side: "REBALANCE",
      orderType: "ROUTE_PREVIEW",
      payload: {
        route: "Jupiter quote and swap transaction preview",
        outputSymbol: asset.symbol,
        targetWeightPercent: asset.targetWeightPercent,
      },
    })),
    safetyChecks: [
      "No swap transaction is broadcast until Phantom signs.",
      "Use explicit slippage and route preview before signing.",
      "RYP spot routing remains separated from perps venue execution.",
    ],
  };
}

function buildGrvtRoute({
  venueId,
  venueName,
  assets,
  mode,
}: {
  venueId: SeedBotVenueId;
  venueName: string;
  assets: SeedBotStrategyAsset[];
  mode: SeedBotExecutionMode;
}): SeedBotVenueRoute {
  return {
    venueId,
    venueName,
    walletRoute: "METAMASK",
    mode,
    endpoint: "https://api-docs.grvt.io/trading_api/",
    assets,
    orderPreview: assets.map((asset) => ({
      symbol: asset.symbol,
      targetWeightPercent: asset.targetWeightPercent,
      side: "REBALANCE",
      orderType: "LIMIT_PREVIEW",
      payload: {
        venue: "GRVT",
        instrument: `${asset.symbol}_USDT_Perp`,
        targetWeightPercent: asset.targetWeightPercent,
        auth: "API key or EIP-712 wallet login required",
      },
    })),
    safetyChecks: [
      "Validate account, sub-account, and settlement flow before live mode.",
      "Use EIP-712 wallet login or tightly scoped API keys.",
      "Keep GRVT as secondary pilot until adapter is proven.",
    ],
  };
}
