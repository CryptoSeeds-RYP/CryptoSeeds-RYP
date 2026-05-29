import { appConfig } from "../config/env";
import { DEMO_WALLET_ADDRESS, isDemoWalletAddress } from "../domain/demo";
import type { ProtocolSnapshot, Reward, StakingTier, UserMicroVerseState } from "../domain/microverse";
import { projectSlotsForTier, tierRequirements } from "../domain/tiering";
import {
  connectedUser,
  disconnectedUser,
  projectParticipations,
  projects,
  rewards,
  seedBotSignals,
} from "../fixtures/protocolFixtures";
import type { CryptoSeedsServices, WalletSession } from "./adapters";
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
    tokenBalances: {
      async getRypBalance(walletAddress) {
        if (isDemoWalletAddress(walletAddress)) {
          return connectedUser.rypBalance;
        }
        if (walletAddress && appConfig.rypMintAddress) {
          return readSplTokenBalance({ ownerAddress: walletAddress }).catch(() => 0);
        }
        return walletAddress ? connectedUser.rypBalance : 0;
      },
    },
    staking: {
      async getStakeState(walletAddress, simulatedTier = "SPROUT") {
        if (!walletAddress) return disconnectedUser;
        const baseUser = {
          ...connectedUser,
          walletAddress,
          rypBalance: await services.tokenBalances.getRypBalance(walletAddress),
        };
        return withTier(baseUser, simulatedTier);
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
      const participations = await services.participations.listParticipations(user.walletAddress);
      return {
        user,
        farm: {
          terrainLevel: user.stakingTier === "NONE" ? 0 : 1,
          buildingLevel: Math.max(0, projectSlotsForTier(user.stakingTier) - 1),
          projectSlotsUnlocked: projectSlotsForTier(user.stakingTier),
          harvestAvailable: user.walletConnected,
          governanceActive: user.walletConnected && user.stakingTier !== "NONE",
          seedBotUnlocked: user.walletConnected && user.stakingTier !== "NONE",
          weatherState: user.walletConnected ? "CLEAR" : "RAIN",
        },
        projects: await services.projects.listProjects(),
        participations,
        rewards: await services.rewards.listRewards(user.walletConnected),
        seedBotSignals: await services.seedBot.listSignals(),
      };
    },
  };

  return services;
}

export const cryptoSeedsServices = createMockServices();
