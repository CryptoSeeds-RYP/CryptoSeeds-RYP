import type { StakingTier } from "./microverse";
import { venueById, type SeedBotVenueId } from "./seedbotVenues";
import type { TransactionChain } from "./transactions";

export type SeedBotCapability = {
  id: string;
  label: string;
  mode: "DEMO" | "SIGNAL" | "WALLET_APPROVED" | "ANALYTICS" | "LOCKED";
  enabled: boolean;
  safetyNote: string;
};

export type SeedBotWalletRoute = "PHANTOM" | "METAMASK";
export type SeedBotPerformanceWindowName = "7D" | "30D" | "90D" | "180D" | "1Y";

export type SeedBotStrategyAsset = {
  symbol: string;
  chain: TransactionChain;
  walletRoute: SeedBotWalletRoute;
  venueId: SeedBotVenueId;
  targetWeightPercent: number;
};

export type SeedBotPerformanceWindow = {
  window: SeedBotPerformanceWindowName;
  returnPercent: number;
  points: number[];
};

export type SeedBotFeeModel = {
  performanceFeeBps: number;
  devSharePercent: number;
  treasurySharePercent: number;
  chargedOn: "REALIZED_POSITIVE_PNL_ONLY";
  deductedFrom: "PROFIT_NOT_PRINCIPAL";
};

export type SeedBotStrategy = {
  id: string;
  name: string;
  summary: string;
  risk: "LOW" | "MEDIUM" | "HIGH";
  minimumAccess: "RYP_HOLDER" | Exclude<StakingTier, "NONE">;
  performance: SeedBotPerformanceWindow[];
  preferredVenueId: SeedBotVenueId;
  assets: SeedBotStrategyAsset[];
  feeModel: SeedBotFeeModel;
  allocationModes: Array<"BASKET" | "PER_ASSET">;
};

export type SeedBotStrategyValidation = {
  valid: boolean;
  blockers: string[];
};

export const seedBotPerformanceDisclaimer = "Past performance does not guarantee future results.";
export const seedBotPerformanceWindows: SeedBotPerformanceWindowName[] = ["7D", "30D", "90D", "180D", "1Y"];

export const seedBotPerformanceFeeModel: SeedBotFeeModel = {
  performanceFeeBps: 1200,
  devSharePercent: 40,
  treasurySharePercent: 60,
  chargedOn: "REALIZED_POSITIVE_PNL_ONLY",
  deductedFrom: "PROFIT_NOT_PRINCIPAL",
};

export const seedBotStrategies: SeedBotStrategy[] = [
  {
    id: "solana-market-roots",
    name: "Solana Market Roots",
    summary: "Momentum and liquidity rotation across core Solana ecosystem assets.",
    risk: "MEDIUM",
    minimumAccess: "RYP_HOLDER",
    performance: [
      { window: "7D", returnPercent: 1.2, points: [0, -0.4, 0.2, 0.9, 0.6, 1.4, 1.2] },
      { window: "30D", returnPercent: 4.6, points: [0, 0.7, 0.2, 1.6, 2.4, 2.1, 3.8, 4.6] },
      { window: "90D", returnPercent: 9.8, points: [0, 1.1, 2.8, 2.2, 4.7, 6.1, 7.4, 9.8] },
      { window: "180D", returnPercent: 14.1, points: [0, 2.4, 1.8, 5.6, 7.9, 8.7, 12.4, 14.1] },
      { window: "1Y", returnPercent: 22.4, points: [0, 3.2, 6.8, 5.1, 11.4, 15.6, 19.8, 22.4] },
    ],
    preferredVenueId: "JUPITER",
    feeModel: seedBotPerformanceFeeModel,
    allocationModes: ["BASKET", "PER_ASSET"],
    assets: [
      { symbol: "SOL", chain: "SOLANA", walletRoute: "PHANTOM", venueId: "JUPITER", targetWeightPercent: 45 },
      { symbol: "RYP", chain: "SOLANA", walletRoute: "PHANTOM", venueId: "JUPITER", targetWeightPercent: 30 },
      { symbol: "JUP", chain: "SOLANA", walletRoute: "PHANTOM", venueId: "JUPITER", targetWeightPercent: 25 },
    ],
  },
  {
    id: "cross-chain-canopy",
    name: "Cross-Chain Canopy",
    summary: "Balanced exposure between Solana liquidity and major EVM assets.",
    risk: "MEDIUM",
    minimumAccess: "SPROUT",
    performance: [
      { window: "7D", returnPercent: -0.4, points: [0, 0.6, -0.8, -0.2, -0.6, 0.1, -0.4] },
      { window: "30D", returnPercent: 2.8, points: [0, -0.5, 0.9, 1.4, 0.8, 2.2, 2.8] },
      { window: "90D", returnPercent: 7.2, points: [0, 1.6, 0.8, 3.7, 4.2, 6.4, 7.2] },
      { window: "180D", returnPercent: 11.9, points: [0, 1.2, 3.8, 3.1, 7.3, 9.8, 11.9] },
      { window: "1Y", returnPercent: 18.6, points: [0, 2.1, 5.3, 4.9, 10.4, 14.2, 18.6] },
    ],
    preferredVenueId: "HYPERLIQUID",
    feeModel: seedBotPerformanceFeeModel,
    allocationModes: ["BASKET", "PER_ASSET"],
    assets: [
      { symbol: "SOL", chain: "EVM", walletRoute: "METAMASK", venueId: "HYPERLIQUID", targetWeightPercent: 35 },
      { symbol: "ETH", chain: "EVM", walletRoute: "METAMASK", venueId: "HYPERLIQUID", targetWeightPercent: 35 },
      { symbol: "USDC", chain: "EVM", walletRoute: "METAMASK", venueId: "HYPERLIQUID", targetWeightPercent: 30 },
    ],
  },
  {
    id: "defensive-waterline",
    name: "Defensive Waterline",
    summary: "Lower-volatility allocation template built around stable liquidity and capped rotation.",
    risk: "LOW",
    minimumAccess: "SAPLING",
    performance: [
      { window: "7D", returnPercent: 0.3, points: [0, 0.1, 0.2, 0.1, 0.4, 0.2, 0.3] },
      { window: "30D", returnPercent: 1.4, points: [0, 0.3, 0.5, 0.4, 0.9, 1.1, 1.4] },
      { window: "90D", returnPercent: 3.9, points: [0, 0.8, 1.2, 1.1, 2.3, 3.2, 3.9] },
      { window: "180D", returnPercent: 6.7, points: [0, 1.1, 2.0, 2.7, 3.6, 5.4, 6.7] },
      { window: "1Y", returnPercent: 9.5, points: [0, 1.7, 2.9, 3.8, 5.4, 7.6, 9.5] },
    ],
    preferredVenueId: "GRVT",
    feeModel: seedBotPerformanceFeeModel,
    allocationModes: ["BASKET", "PER_ASSET"],
    assets: [
      { symbol: "USDC", chain: "EVM", walletRoute: "METAMASK", venueId: "GRVT", targetWeightPercent: 55 },
      { symbol: "SOL", chain: "EVM", walletRoute: "METAMASK", venueId: "GRVT", targetWeightPercent: 25 },
      { symbol: "ETH", chain: "EVM", walletRoute: "METAMASK", venueId: "GRVT", targetWeightPercent: 20 },
    ],
  },
];

const tierRank: Record<StakingTier, number> = {
  NONE: 0,
  SEED: 1,
  SPROUT: 2,
  SAPLING: 3,
  TREE: 4,
  FRUIT: 5,
};

export function buildSeedBotCapabilities({
  walletConnected,
  stakingTier,
  rypBalance = 0,
}: {
  walletConnected: boolean;
  stakingTier: StakingTier;
  rypBalance?: number;
}): SeedBotCapability[] {
  const rank = walletConnected ? tierRank[stakingTier] : 0;
  const rypHolder = walletConnected && rypBalance > 0;

  return [
    {
      id: "demo-terminal",
      label: "Demo terminal",
      mode: "DEMO",
      enabled: true,
      safetyNote: "Read-only market interface.",
    },
    {
      id: "strategy-collection",
      label: "Public strategy collection",
      mode: "ANALYTICS",
      enabled: rypHolder || rank >= tierRank.SEED,
      safetyNote: "RYP unlocks strategy access, not guaranteed returns.",
    },
    {
      id: "signal-only",
      label: "Signal-only agents",
      mode: "SIGNAL",
      enabled: rank >= tierRank.SEED,
      safetyNote: "Signals do not move funds.",
    },
    {
      id: "wallet-approved-swaps",
      label: "Wallet-approved swaps",
      mode: "WALLET_APPROVED",
      enabled: rank >= tierRank.SPROUT,
      safetyNote: "Every transaction requires wallet approval.",
    },
    {
      id: "strategy-templates",
      label: "Strategy templates",
      mode: "ANALYTICS",
      enabled: rank >= tierRank.SAPLING,
      safetyNote: "Templates are planning tools, not profit claims.",
    },
    {
      id: "guarded-automation",
      label: "Guarded automation",
      mode: "LOCKED",
      enabled: false,
      safetyNote: "Disabled in MVP pending security and legal review.",
    },
  ];
}

export function canAccessSeedBotStrategy({
  walletConnected,
  stakingTier,
  rypBalance,
  strategy,
}: {
  walletConnected: boolean;
  stakingTier: StakingTier;
  rypBalance: number;
  strategy: SeedBotStrategy;
}) {
  if (!walletConnected) return false;
  if (strategy.minimumAccess === "RYP_HOLDER") return rypBalance > 0 || tierRank[stakingTier] >= tierRank.SEED;
  return tierRank[stakingTier] >= tierRank[strategy.minimumAccess];
}

export function seedBotFeeDisclosure(feeModel: SeedBotFeeModel) {
  const validation = validateSeedBotFeeModel(feeModel);
  if (!validation.valid) {
    return `Review-gated fee preview is invalid: ${validation.blockers.join(" ")}`;
  }
  return `Review-gated fee preview: ${feeModel.performanceFeeBps / 100}% success fee on realized positive strategy PnL only, deducted from profit not principal, split ${feeModel.devSharePercent}% dev / ${feeModel.treasurySharePercent}% treasury. Disabled for live use until security and legal review are complete.`;
}

export function performanceForWindow(strategy: SeedBotStrategy, window: SeedBotPerformanceWindowName) {
  return strategy.performance.find((item) => item.window === window) ?? strategy.performance[0];
}

export function validateSeedBotFeeModel(feeModel: SeedBotFeeModel) {
  const blockers: string[] = [];
  if (!Number.isInteger(feeModel.performanceFeeBps) || feeModel.performanceFeeBps < 0 || feeModel.performanceFeeBps > 10_000) {
    blockers.push("SeedBot performance fee must be between 0 and 10000 bps.");
  }
  if (feeModel.devSharePercent + feeModel.treasurySharePercent !== 100) {
    blockers.push("SeedBot dev and treasury fee shares must total 100%.");
  }
  if (feeModel.chargedOn !== "REALIZED_POSITIVE_PNL_ONLY") {
    blockers.push("SeedBot fee must only be charged on realized positive PnL.");
  }
  if (feeModel.deductedFrom !== "PROFIT_NOT_PRINCIPAL") {
    blockers.push("SeedBot fee must be deducted from profit, not principal.");
  }

  return {
    valid: blockers.length === 0,
    blockers,
  };
}

export function validateSeedBotStrategy(strategy: SeedBotStrategy): SeedBotStrategyValidation {
  const blockers: string[] = [];

  if (!strategy.id.trim()) blockers.push("SeedBot strategy id is required.");
  if (!strategy.name.trim()) blockers.push(`SeedBot strategy ${strategy.id || "unknown"} name is required.`);
  if (!strategy.summary.trim()) blockers.push(`SeedBot strategy ${strategy.id || "unknown"} summary is required.`);
  if (strategy.allocationModes.length === 0) {
    blockers.push(`SeedBot strategy ${strategy.id} must expose at least one allocation mode.`);
  }
  if (strategy.assets.length === 0) {
    blockers.push(`SeedBot strategy ${strategy.id} must include at least one target asset.`);
  }

  const preferredVenue = venueById(strategy.preferredVenueId);
  if (!preferredVenue) {
    blockers.push(`SeedBot strategy ${strategy.id} references unknown preferred venue ${strategy.preferredVenueId}.`);
  }

  validatePerformanceWindows(strategy, blockers);
  validateStrategyAssets(strategy, blockers);
  blockers.push(...validateSeedBotFeeModel(strategy.feeModel).blockers);

  return {
    valid: blockers.length === 0,
    blockers,
  };
}

export function validateSeedBotStrategyCatalog(strategies: SeedBotStrategy[]): SeedBotStrategyValidation {
  const blockers: string[] = [];
  const seenStrategyIds = new Set<string>();

  for (const strategy of strategies) {
    const strategyId = strategy.id.trim().toLowerCase();
    if (seenStrategyIds.has(strategyId)) {
      blockers.push(`Duplicate SeedBot strategy id: ${strategy.id}.`);
    }
    seenStrategyIds.add(strategyId);
    blockers.push(...validateSeedBotStrategy(strategy).blockers);
  }

  return {
    valid: blockers.length === 0,
    blockers,
  };
}

function validatePerformanceWindows(strategy: SeedBotStrategy, blockers: string[]) {
  const seenWindows = new Set<SeedBotPerformanceWindowName>();
  const windows = new Set(strategy.performance.map((item) => item.window));

  for (const requiredWindow of seedBotPerformanceWindows) {
    if (!windows.has(requiredWindow)) {
      blockers.push(`SeedBot strategy ${strategy.id} is missing ${requiredWindow} performance.`);
    }
  }

  for (const performance of strategy.performance) {
    if (seenWindows.has(performance.window)) {
      blockers.push(`SeedBot strategy ${strategy.id} has duplicate ${performance.window} performance.`);
    }
    seenWindows.add(performance.window);

    if (!Number.isFinite(performance.returnPercent)) {
      blockers.push(`SeedBot strategy ${strategy.id} has invalid ${performance.window} return percent.`);
    }
    if (performance.points.length < 2) {
      blockers.push(`SeedBot strategy ${strategy.id} needs at least two ${performance.window} graph points.`);
      continue;
    }
    if (!performance.points.every((point) => Number.isFinite(point))) {
      blockers.push(`SeedBot strategy ${strategy.id} has invalid ${performance.window} graph points.`);
    }

    const finalPoint = performance.points[performance.points.length - 1];
    if (Math.abs(finalPoint - performance.returnPercent) > 0.000_001) {
      blockers.push(`SeedBot strategy ${strategy.id} ${performance.window} final graph point must equal returnPercent.`);
    }
  }
}

function validateStrategyAssets(strategy: SeedBotStrategy, blockers: string[]) {
  const totalWeight = strategy.assets.reduce((total, asset) => total + asset.targetWeightPercent, 0);
  if (Math.abs(totalWeight - 100) > 0.000_001) {
    blockers.push(`SeedBot strategy ${strategy.id} target weights must total 100%.`);
  }

  const seenAssets = new Set<string>();
  for (const asset of strategy.assets) {
    if (!asset.symbol.trim()) {
      blockers.push(`SeedBot strategy ${strategy.id} has an asset with missing symbol.`);
    }
    if (!Number.isFinite(asset.targetWeightPercent) || asset.targetWeightPercent <= 0) {
      blockers.push(`SeedBot strategy ${strategy.id} asset ${asset.symbol} has invalid target weight.`);
    }

    const assetKey = `${asset.symbol.trim().toUpperCase()}:${asset.chain}:${asset.venueId}`;
    if (seenAssets.has(assetKey)) {
      blockers.push(`SeedBot strategy ${strategy.id} has duplicate asset route ${assetKey}.`);
    }
    seenAssets.add(assetKey);

    const venue = venueById(asset.venueId);
    if (!venue) {
      blockers.push(`SeedBot strategy ${strategy.id} asset ${asset.symbol} references unknown venue ${asset.venueId}.`);
      continue;
    }

    const requiredWalletRoute = walletRouteForChain(asset.chain);
    if (requiredWalletRoute && asset.walletRoute !== requiredWalletRoute) {
      blockers.push(`SeedBot strategy ${strategy.id} asset ${asset.symbol} must use ${requiredWalletRoute} for ${asset.chain}.`);
    }

    const venueRoute = asset.walletRoute === "PHANTOM" ? "PHANTOM" : "EVM";
    if (!venue.walletRoutes.includes(venueRoute)) {
      blockers.push(`SeedBot strategy ${strategy.id} venue ${asset.venueId} does not support ${asset.walletRoute}.`);
    }
  }
}

function walletRouteForChain(chain: TransactionChain): SeedBotWalletRoute | undefined {
  if (chain === "SOLANA") return "PHANTOM";
  if (chain === "EVM") return "METAMASK";
  return undefined;
}
