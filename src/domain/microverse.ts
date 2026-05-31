export type StakingTier =
  | "NONE"
  | "SEED"
  | "SPROUT"
  | "SAPLING"
  | "TREE"
  | "FRUIT";

export type LocationKey =
  | "homestead"
  | "explorer"
  | "harvest"
  | "governance"
  | "seedbot";

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

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXPERIMENTAL" | "DONATION";

export type ProjectDocumentType =
  | "PROPOSAL"
  | "RISK_DISCLOSURE"
  | "MILESTONE_PLAN"
  | "OPERATOR_PROFILE"
  | "TECHNICAL_SUMMARY"
  | "IMPACT_REPORT"
  | "DONATION_POLICY";

export type ProjectDocumentStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ARCHIVED";

export type ProjectDocument = {
  id: string;
  title: string;
  type: ProjectDocumentType;
  version: string;
  status: ProjectDocumentStatus;
  issuedAt: string;
  uri?: string;
  contentHash?: string;
  requiredForParticipation: boolean;
};

export type ProjectOperator = {
  name: string;
  jurisdiction?: string;
  verificationStatus: "PENDING" | "VERIFIED" | "COMMUNITY_REVIEW" | "REJECTED";
};

export type ProjectReceivingAccount = {
  label: string;
  chain: "SOLANA" | "EVM" | "OFF_CHAIN_REVIEW";
  address?: string;
  accountType: "PROJECT_OWNER" | "CHARITY" | "TREASURY" | "PROGRAM_CONTROLLED";
  custodyModel: "OWNER_CONTROLLED" | "CHARITY_CONTROLLED" | "PROGRAM_CONTROLLED" | "DISCLOSURE_PENDING";
  verificationStatus: "PENDING" | "VERIFIED" | "COMMUNITY_REVIEW" | "REJECTED";
  receivesUserFunds: boolean;
  notes: string;
};

export type ProjectDisclosure = {
  projectOwnerTokenHolding: "NONE_DISCLOSED" | "DISCLOSED" | "PENDING";
  founderOrOperatorConflict: boolean;
  treasuryIndependent: boolean;
  charitySeparated: boolean;
  legalReviewRequired: boolean;
  conflictNotes: string[];
};

export type GovernanceApproval = {
  status: "NOT_SUBMITTED" | "UNDER_REVIEW" | "VOTE_OPEN" | "APPROVED" | "REJECTED";
  proposalId?: string;
  approvedAt?: string;
  voteSummary?: string;
};

export type Project = {
  id: string;
  name: string;
  category: string;
  location: string;
  status: ProjectStatus;
  requiredTier: Exclude<StakingTier, "NONE">;
  riskLevel: RiskLevel;
  duration: string;
  progress: number;
  operator: ProjectOperator;
  receivingAccount: ProjectReceivingAccount;
  disclosure: ProjectDisclosure;
  governance: GovernanceApproval;
  updateCadence: string;
  summary: string;
  riskDisclosure: string;
  participationTerms: string;
  documents: ProjectDocument[];
  milestones: string[];
  impactMetrics: string[];
  participationOpen: boolean;
};

export type ProjectParticipationStatus =
  | "REVIEWED"
  | "PREPARED"
  | "ACTIVE"
  | "MILESTONE_REACHED"
  | "HARVEST_AVAILABLE"
  | "COMPLETED";

export type ProjectParticipation = {
  id: string;
  projectId: string;
  walletAddress: string;
  status: ProjectParticipationStatus;
  slotIndex: number;
  joinedAt: string;
  updatedAt: string;
  acknowledgedDisclosureRef: string;
  milestoneIndex: number;
};

export type Reward = {
  id: string;
  type: "STAKING" | "FEE_SHARE" | "PROJECT_UPDATE" | "NFT" | "GOVERNANCE";
  label: string;
  source: string;
  status: "READY" | "PENDING" | "LOCKED";
  amount?: string;
};

export type UserMicroVerseState = {
  walletConnected: boolean;
  walletAddress?: string;
  rypBalance: number;
  stakedAmount: number;
  stakingTier: StakingTier;
  stakingDays: number;
  goldenKeyNft: boolean;
  votingRightsNft: boolean;
  claimableRewards: Reward[];
};

export type FarmVisualState = {
  terrainLevel: number;
  buildingLevel: number;
  projectSlotsUnlocked: number;
  harvestAvailable: boolean;
  governanceActive: boolean;
  seedBotUnlocked: boolean;
  weatherState: "CLEAR" | "RAIN" | "GOLDEN_HARVEST" | "STORM" | "SEASONAL_EVENT";
};

export type SeedBotSignal = {
  token: string;
  signal: string;
  risk: "Low" | "Medium" | "High";
  change: string;
};

export type ProtocolSnapshot = {
  user: UserMicroVerseState;
  farm: FarmVisualState;
  projects: Project[];
  participations: ProjectParticipation[];
  rewards: Reward[];
  seedBotSignals: SeedBotSignal[];
};
