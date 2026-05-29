import type { Project, ProtocolSnapshot, Reward, SeedBotSignal, UserMicroVerseState } from "../domain/microverse";
import type { StakingTier } from "../domain/microverse";

export type WalletSession = {
  connected: boolean;
  address?: string;
};

export interface WalletAdapter {
  connect(): Promise<WalletSession>;
  disconnect(): Promise<WalletSession>;
}

export interface TokenBalanceService {
  getRypBalance(walletAddress?: string): Promise<number>;
}

export interface StakingService {
  getStakeState(walletAddress?: string, simulatedTier?: StakingTier): Promise<UserMicroVerseState>;
}

export interface ProjectRegistryService {
  listProjects(): Promise<Project[]>;
}

export interface RewardService {
  listRewards(walletConnected: boolean): Promise<Reward[]>;
}

export interface SeedBotService {
  listSignals(): Promise<SeedBotSignal[]>;
}

export type CryptoSeedsServices = {
  wallet: WalletAdapter;
  tokenBalances: TokenBalanceService;
  staking: StakingService;
  projects: ProjectRegistryService;
  rewards: RewardService;
  seedBot: SeedBotService;
  loadProtocolSnapshot(walletAddress?: string, simulatedTier?: StakingTier): Promise<ProtocolSnapshot>;
};

