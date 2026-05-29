import type { StakingTier } from "./microverse";
import type { TransactionChain } from "./transactions";

export type SeedBotCapability = {
  id: string;
  label: string;
  mode: "DEMO" | "SIGNAL" | "WALLET_APPROVED" | "ANALYTICS" | "LOCKED";
  enabled: boolean;
  safetyNote: string;
};

export type SeedBotWalletRoute = "PHANTOM" | "METAMASK";

export type SeedBotStrategyAsset = {
  symbol: string;
  chain: TransactionChain;
  walletRoute: SeedBotWalletRoute;
  targetWeightPercent: number;
};

export type SeedBotPerformanceWindow = {
  window: "7D" | "30D" | "90D" | "180D" | "1Y";
  returnPercent: number;
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
  assets: SeedBotStrategyAsset[];
  feeModel: SeedBotFeeModel;
  allocationModes: Array<"BASKET" | "PER_ASSET">;
};

export const seedBotPerformanceDisclaimer = "Past performance does not guarantee future results.";

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
      { window: "7D", returnPercent: 1.2 },
      { window: "30D", returnPercent: 4.6 },
      { window: "90D", returnPercent: 9.8 },
      { window: "180D", returnPercent: 14.1 },
      { window: "1Y", returnPercent: 22.4 },
    ],
    feeModel: seedBotPerformanceFeeModel,
    allocationModes: ["BASKET", "PER_ASSET"],
    assets: [
      { symbol: "SOL", chain: "SOLANA", walletRoute: "PHANTOM", targetWeightPercent: 45 },
      { symbol: "RYP", chain: "SOLANA", walletRoute: "PHANTOM", targetWeightPercent: 30 },
      { symbol: "JUP", chain: "SOLANA", walletRoute: "PHANTOM", targetWeightPercent: 25 },
    ],
  },
  {
    id: "cross-chain-canopy",
    name: "Cross-Chain Canopy",
    summary: "Balanced exposure between Solana liquidity and major EVM assets.",
    risk: "MEDIUM",
    minimumAccess: "SPROUT",
    performance: [
      { window: "7D", returnPercent: -0.4 },
      { window: "30D", returnPercent: 2.8 },
      { window: "90D", returnPercent: 7.2 },
      { window: "180D", returnPercent: 11.9 },
      { window: "1Y", returnPercent: 18.6 },
    ],
    feeModel: seedBotPerformanceFeeModel,
    allocationModes: ["BASKET", "PER_ASSET"],
    assets: [
      { symbol: "SOL", chain: "SOLANA", walletRoute: "PHANTOM", targetWeightPercent: 35 },
      { symbol: "ETH", chain: "EVM", walletRoute: "METAMASK", targetWeightPercent: 35 },
      { symbol: "USDC", chain: "SOLANA", walletRoute: "PHANTOM", targetWeightPercent: 30 },
    ],
  },
  {
    id: "defensive-waterline",
    name: "Defensive Waterline",
    summary: "Lower-volatility allocation template built around stable liquidity and capped rotation.",
    risk: "LOW",
    minimumAccess: "SAPLING",
    performance: [
      { window: "7D", returnPercent: 0.3 },
      { window: "30D", returnPercent: 1.4 },
      { window: "90D", returnPercent: 3.9 },
      { window: "180D", returnPercent: 6.7 },
      { window: "1Y", returnPercent: 9.5 },
    ],
    feeModel: seedBotPerformanceFeeModel,
    allocationModes: ["BASKET", "PER_ASSET"],
    assets: [
      { symbol: "USDC", chain: "SOLANA", walletRoute: "PHANTOM", targetWeightPercent: 55 },
      { symbol: "SOL", chain: "SOLANA", walletRoute: "PHANTOM", targetWeightPercent: 25 },
      { symbol: "ETH", chain: "EVM", walletRoute: "METAMASK", targetWeightPercent: 20 },
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
  return `${feeModel.performanceFeeBps / 100}% performance fee on realized positive strategy PnL only, deducted from profit not principal, split ${feeModel.devSharePercent}% dev / ${feeModel.treasurySharePercent}% treasury.`;
}
