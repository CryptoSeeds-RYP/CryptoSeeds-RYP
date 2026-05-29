import type { StakingTier } from "./microverse";

export type SeedBotCapability = {
  id: string;
  label: string;
  mode: "DEMO" | "SIGNAL" | "WALLET_APPROVED" | "ANALYTICS" | "LOCKED";
  enabled: boolean;
  safetyNote: string;
};

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
}: {
  walletConnected: boolean;
  stakingTier: StakingTier;
}): SeedBotCapability[] {
  const rank = walletConnected ? tierRank[stakingTier] : 0;

  return [
    {
      id: "demo-terminal",
      label: "Demo terminal",
      mode: "DEMO",
      enabled: true,
      safetyNote: "Read-only market interface.",
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
