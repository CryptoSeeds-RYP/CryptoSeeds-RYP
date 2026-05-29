# State Model Draft

The MicroVerse should be a state-driven application. Visuals should respond to structured user, project, reward, governance, and SeedBot state.

```ts
export type StakingTier =
  | "NONE"
  | "SEED"
  | "SPROUT"
  | "SAPLING"
  | "TREE"
  | "FRUIT";

export type StewardPath =
  | "FUNDER"
  | "VOTER"
  | "DONOR"
  | "EXPLORER"
  | "BUILDER"
  | "CUSTOMIZER";

export type UserMicroVerseState = {
  walletConnected: boolean;
  walletAddress?: string;
  rypBalance: number;
  stakedAmount: number;
  stakingTier: StakingTier;
  stakingStartDate?: string;
  goldenKeyNft: boolean;
  votingRightsNft: boolean;
  activeProjects: ProjectParticipation[];
  completedProjects: ProjectParticipation[];
  claimableRewards: Reward[];
  achievements: Achievement[];
  stewardPath?: StewardPath;
};
```

```ts
export type ProjectStatus =
  | "PROPOSED"
  | "UNDER_REVIEW"
  | "GOVERNANCE_VOTE"
  | "APPROVED"
  | "OPEN"
  | "ACTIVE"
  | "MILESTONE_REACHED"
  | "HARVEST_AVAILABLE"
  | "COMPLETED"
  | "PAUSED"
  | "REJECTED";

export type RiskLevel =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "EXPERIMENTAL"
  | "DONATION";

export type Project = {
  id: string;
  name: string;
  category: string;
  location?: string;
  status: ProjectStatus;
  requiredTier: Exclude<StakingTier, "NONE">;
  riskLevel: RiskLevel;
  summary: string;
  documents: ProjectDocument[];
  milestones: ProjectMilestone[];
  participationOpen: boolean;
  userEligible: boolean;
};
```

```ts
export type FarmVisualState = {
  terrainLevel: number;
  buildingLevel: number;
  projectSlotsUnlocked: number;
  activeProjectVisuals: ProjectVisual[];
  weatherState?: "CLEAR" | "RAIN" | "GOLDEN_HARVEST" | "STORM" | "SEASONAL_EVENT";
  harvestAvailable: boolean;
  governanceActive: boolean;
  seedBotUnlocked: boolean;
};
```

## Protocol State Draft

Frontend state should mirror eventual on-chain and indexed protocol state. Early builds can use fixtures, but the shape should make future Solana integration straightforward.

```ts
export type RypStakeAccount = {
  owner: string;
  stakedAmount: number;
  tier: StakingTier;
  stakingStartTimestamp: number;
  lastRewardClaimTimestamp?: number;
  goldenKeyMint?: string;
  votingRightsMint?: string;
  paused: boolean;
};

export type RewardAccount = {
  owner: string;
  rewardMint: string;
  accruedAmount: number;
  claimableAmount: number;
  expiresAt?: number;
  rewardType: "STAKING" | "FEE_SHARE" | "AIRDROP" | "PROJECT" | "GOVERNANCE";
};

export type GovernanceAccount = {
  owner: string;
  votingRightsActive: boolean;
  voteCount: number;
  lastVoteTimestamp?: number;
};
```

## Transaction Intent Draft

Every wallet-approved action should be represented as a transaction intent before the user signs.

```ts
export type TransactionIntentType =
  | "STAKE_RYP"
  | "UNSTAKE_RYP"
  | "CLAIM_REWARD"
  | "PARTICIPATE_PROJECT"
  | "VOTE_PROPOSAL"
  | "CLAIM_NFT"
  | "SEEDBOT_SWAP"
  | "REVOKE_PERMISSION";

export type TransactionIntent = {
  id: string;
  type: TransactionIntentType;
  title: string;
  chain: "SOLANA" | "EVM";
  network: string;
  executionMode: "PREVIEW_ONLY" | "WALLET_APPROVED" | "GUARDED_AUTOMATION";
  signaturePolicy: string;
  walletAddress?: string;
  inputToken?: string;
  outputToken?: string;
  amount?: string;
  estimatedFees?: string;
  slippage?: string;
  programs: TransactionProgramReference[];
  accounts: TransactionAccountReference[];
  acknowledgement?: RiskAcknowledgement;
  lifecycle: TransactionLifecycleStep[];
  riskSummary: string;
  expectedResult: string;
  status: "DRAFT" | "READY" | "AWAITING_SIGNATURE" | "SIGNED" | "BROADCAST" | "CONFIRMED" | "FAILED";
};
```

## Tier Mapping

| Tier | Project Slots | Visual Identity |
| --- | ---: | --- |
| NONE | 0 | Wild landscape, distant locked structures |
| SEED | 1-2 | Small active plot, basic path, first structure |
| SPROUT | 2-3 | Expanded fields, workers, more project slots |
| SAPLING | 3-5 | Advanced farm, richer environment, more detail |
| TREE | 5-7 | Mature ecosystem, larger project areas |
| FRUIT | 7+ | Full estate, rare cosmetics, premium effects |

## Design Rule

Every major visual change should correspond to user state, project state, governance state, reward state, or ecosystem event state.
