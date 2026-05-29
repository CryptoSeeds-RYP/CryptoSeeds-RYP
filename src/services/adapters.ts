import type {
  Project,
  ProjectParticipation,
  ProtocolSnapshot,
  Reward,
  SeedBotSignal,
  UserMicroVerseState,
} from "../domain/microverse";
import type { StakingTier } from "../domain/microverse";
import type { ProjectEligibilityResult } from "../domain/projectRegistry";

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
  getProject(projectId: string): Promise<Project | undefined>;
  evaluateProject(projectId: string, activeTier: StakingTier): Promise<ProjectEligibilityResult | undefined>;
}

export interface RewardService {
  listRewards(walletConnected: boolean): Promise<Reward[]>;
}

export interface ProjectParticipationService {
  listParticipations(walletAddress?: string): Promise<ProjectParticipation[]>;
}

export interface SeedBotService {
  listSignals(): Promise<SeedBotSignal[]>;
}

export type CryptoSeedsServices = {
  wallet: WalletAdapter;
  tokenBalances: TokenBalanceService;
  staking: StakingService;
  projects: ProjectRegistryService;
  participations: ProjectParticipationService;
  rewards: RewardService;
  seedBot: SeedBotService;
  loadProtocolSnapshot(walletAddress?: string, simulatedTier?: StakingTier): Promise<ProtocolSnapshot>;
};
