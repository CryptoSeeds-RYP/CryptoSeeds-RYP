import { appConfig } from "../config/env";
import { DEMO_WALLET_ADDRESS, isDemoWalletAddress } from "../domain/demo";
import type {
  ProtocolSnapshot,
  ProtocolSnapshotSource,
  Reward,
  StakingTier,
  UserMicroVerseState,
} from "../domain/microverse";
import { projectSlotsForTier, tierRequirements } from "../domain/tiering";
import {
  connectedUser,
  disconnectedUser,
  projectParticipations,
  projects,
  rewards,
  seedBotSignals,
} from "../fixtures/protocolFixtures";
import type { CryptoSeedsServices, TokenBalanceService, WalletSession } from "./adapters";
import { createFixtureProjectRegistryService } from "./projectRegistryService";
import { readSplTokenBalance } from "./solanaTokenBalanceService";

function withTier(user: UserMicroVerseState, tier: StakingTier): UserMicroVerseState {
  if (!user.walletConnected || tier === "NONE") return user;
  return {
    ...user,
    stakedAmount: tierRequirements[tier],
    stakingTier: tier,
    goldenKeyNft: true,
    votingRightsNft: user.stakingDays >= 14,
  };
}

function lockedRewards(): Reward[] {
  return rewards.map((reward) => ({ ...reward, status: "LOCKED" }));
}

export function createMockServices(): CryptoSeedsServices {
  return createProtocolServices();
}

export function createProtocolServices({
  tokenBalances = defaultTokenBalanceService(),
}: {
  tokenBalances?: TokenBalanceService;
} = {}): CryptoSeedsServices {
  let walletSession: WalletSession = { connected: false };
  const projectRegistry = createFixtureProjectRegistryService(projects);

  const services: CryptoSeedsServices = {
    wallet: {
      async connect() {
        walletSession = { connected: true, address: DEMO_WALLET_ADDRESS };
        return walletSession;
      },
      async disconnect() {
        walletSession = { connected: false };
        return walletSession;
      },
    },
    tokenBalances,
    staking: {
      async getStakeState(walletAddress, simulatedTier = "SPROUT") {
        if (!walletAddress) return disconnectedUser;
        if (isDemoWalletAddress(walletAddress)) {
          return withTier({
            ...connectedUser,
            walletAddress,
            rypBalance: await services.tokenBalances.getRypBalance(walletAddress),
          }, simulatedTier);
        }

        return {
          ...disconnectedUser,
          walletConnected: true,
          walletAddress,
          rypBalance: await services.tokenBalances.getRypBalance(walletAddress),
        };
      },
    },
    projects: projectRegistry,
    participations: {
      async listParticipations(walletAddress) {
        if (!walletAddress) return [];
        return projectParticipations.filter((participation) => participation.walletAddress === walletAddress);
      },
    },
    rewards: {
      async listRewards(walletConnected) {
        return walletConnected ? rewards : lockedRewards();
      },
    },
    seedBot: {
      async listSignals() {
        return seedBotSignals;
      },
    },
    async loadProtocolSnapshot(walletAddress, simulatedTier = "SPROUT"): Promise<ProtocolSnapshot> {
      const user = await services.staking.getStakeState(walletAddress, simulatedTier);
      const stakingActive = user.walletConnected && user.stakingTier !== "NONE";
      const rypHolder = user.walletConnected && user.rypBalance > 0;
      const participations = await services.participations.listParticipations(user.walletAddress);
      return {
        source: snapshotSourceFor(user),
        user,
        farm: {
          terrainLevel: user.stakingTier === "NONE" ? 0 : 1,
          buildingLevel: Math.max(0, projectSlotsForTier(user.stakingTier) - 1),
          projectSlotsUnlocked: projectSlotsForTier(user.stakingTier),
          harvestAvailable: stakingActive,
          governanceActive: stakingActive,
          seedBotUnlocked: stakingActive || rypHolder,
          weatherState: user.walletConnected ? "CLEAR" : "RAIN",
        },
        projects: await services.projects.listProjects(),
        participations,
        rewards: await services.rewards.listRewards(stakingActive),
        seedBotSignals: await services.seedBot.listSignals(),
      };
    },
  };

  return services;
}

function snapshotSourceFor(user: UserMicroVerseState): ProtocolSnapshotSource {
  if (!user.walletConnected) return "DISCONNECTED_PREVIEW";
  if (isDemoWalletAddress(user.walletAddress)) return "DEMO_SIMULATION";
  return "LIVE_WALLET_READ_ONLY";
}

function defaultTokenBalanceService(): TokenBalanceService {
  return {
    async getRypBalance(walletAddress) {
      if (isDemoWalletAddress(walletAddress)) {
        return connectedUser.rypBalance;
      }
      if (walletAddress && appConfig.rypMintAddress) {
        return readSplTokenBalance({ ownerAddress: walletAddress }).catch(() => 0);
      }
      return 0;
    },
  };
}

export const cryptoSeedsServices = createMockServices();
