import { PublicKey, SystemProgram } from "@solana/web3.js";
import { appConfig } from "../config/env";
import type {
  PreparedInstructionAccount,
  PreparedInstructionPlan,
  PreparedSolanaTransactionPlan,
  TransactionAccountReference,
} from "../domain/transactions";
import type { StakingTier } from "../domain/microverse";
import { tierRequirements } from "../domain/tiering";
import protocolInstructionSpecsJson from "./protocolInstructionSpecs.json";

export const CONFIG_SEED = "config";
export const STAKE_POSITION_SEED = "stake-position";
export const REWARD_CONFIG_SEED = "reward-config";
export const REWARD_VAULT_STATE_SEED = "reward-vault";
export const REWARD_EPOCH_SEED = "reward-epoch";
export const REWARD_CLAIM_SEED = "reward-claim";
export const GOVERNANCE_PROPOSAL_SEED = "governance-proposal";
export const GOVERNANCE_VOTE_SEED = "governance-vote";
export const PROJECT_RECORD_SEED = "project-record";
export const PROJECT_PARTICIPATION_SEED = "project-participation";
export const SEEDBOT_PERMISSION_SEED = "seedbot-permission";
export const SPL_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

type ProtocolInstructionAccountSpec = {
  name: string;
  label: string;
  role: string;
  signer: boolean;
  writable: boolean;
};

type ProtocolInstructionSpec = {
  discriminatorHex: string;
  args: string[];
  accounts: ProtocolInstructionAccountSpec[];
};

type ProtocolAddressBook = ReturnType<typeof deriveProtocolAddresses> &
  Record<string, string | undefined> & {
    authority?: string;
    claimRecord?: string;
    holderRewardVault?: string;
    holderRewardVaultState?: string;
    independentTreasuryVault?: string;
    independentTreasuryVaultState?: string;
    ownerRewardAccount?: string;
    participation?: string;
    payer?: string;
    payerFeeAccount?: string;
    permission?: string;
    project?: string;
    proposal?: string;
    rewardEpoch?: string;
    rewardSourceVault?: string;
    rewardVaultState?: string;
    stakerRewardVault?: string;
    stakerRewardVaultState?: string;
    voteRecord?: string;
  };

export type RewardClaimRole = "HOLDER_REWARD" | "STAKER_REWARD";
export type RewardVaultRouteRole =
  | "HOLDER_REWARD"
  | "STAKER_REWARD"
  | "INDEPENDENT_TREASURY"
  | "DELIVERY_COST_RESERVE"
  | "ROLLOVER";
export type GovernanceProposalCategory =
  | "PROJECT_APPROVAL"
  | "TREASURY_ALLOCATION"
  | "PROTOCOL_UPGRADE"
  | "DONATION_CAUSE"
  | "SEEDBOT_FEATURE"
  | "RISK_POLICY";
export type ProjectRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXPERIMENTAL" | "DONATION";
export type ProjectLifecycleStatus =
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

export const PROTOCOL_INSTRUCTION_SPECS = protocolInstructionSpecsJson as Record<string, ProtocolInstructionSpec>;
const U16_MAX = 2n ** 16n - 1n;
const U32_MAX = 2n ** 32n - 1n;
const U64_MAX = 2n ** 64n - 1n;
const I64_MIN = -(2n ** 63n);
const I64_MAX = 2n ** 63n - 1n;
export const MAX_REWARD_MERKLE_PROOF_NODES = 32;

const REWARD_ROLE_VARIANTS: Record<RewardClaimRole, number> = {
  HOLDER_REWARD: 0,
  STAKER_REWARD: 1,
};

const REWARD_VAULT_ROLE_SEEDS: Record<RewardVaultRouteRole, string> = {
  HOLDER_REWARD: "holder-reward",
  STAKER_REWARD: "staker-reward",
  INDEPENDENT_TREASURY: "independent-treasury",
  DELIVERY_COST_RESERVE: "delivery-cost-reserve",
  ROLLOVER: "rollover",
};

const GOVERNANCE_CATEGORY_VARIANTS: Record<GovernanceProposalCategory, number> = {
  PROJECT_APPROVAL: 0,
  TREASURY_ALLOCATION: 1,
  PROTOCOL_UPGRADE: 2,
  DONATION_CAUSE: 3,
  SEEDBOT_FEATURE: 4,
  RISK_POLICY: 5,
};

const PROJECT_RISK_LEVEL_VARIANTS: Record<ProjectRiskLevel, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  EXPERIMENTAL: 3,
  DONATION: 4,
};

const PROJECT_STATUS_VARIANTS: Record<ProjectLifecycleStatus, number> = {
  PROPOSED: 0,
  UNDER_REVIEW: 1,
  GOVERNANCE_VOTE: 2,
  APPROVED: 3,
  OPEN: 4,
  ACTIVE: 5,
  MILESTONE_REACHED: 6,
  HARVEST_AVAILABLE: 7,
  COMPLETED: 8,
  PAUSED: 9,
  REJECTED: 10,
};

const STAKE_TIER_VARIANTS: Record<Exclude<StakingTier, "NONE">, number> = {
  SEED: 1,
  SPROUT: 2,
  SAPLING: 3,
  TREE: 4,
  FRUIT: 5,
};

export type StakePlanInput = {
  ownerAddress: string;
  tier: Exclude<StakingTier, "NONE">;
  amountUi?: number | string;
};

export type UnstakePlanInput = {
  ownerAddress: string;
  amountUi: number | string;
};

export type VotingRightsPlanInput = {
  ownerAddress: string;
};

export type ClaimRewardRecordPlanInput = {
  ownerAddress: string;
  epochId: bigint | number | string;
  rewardRole: RewardClaimRole;
};

export type ClaimRewardTokensPlanInput = ClaimRewardRecordPlanInput & {
  rewardSourceVaultAddress: string;
};

export type CreateRewardClaimRecordPlanInput = {
  authorityAddress: string;
  epochId: bigint | number | string;
  rewardRole: RewardClaimRole;
  walletAddress: string;
  grossAllocationAmountBaseUnits: bigint | number | string;
  deliveryCostAmountBaseUnits: bigint | number | string;
  netClaimAmountBaseUnits: bigint | number | string;
  rolledForwardAmountBaseUnits: bigint | number | string;
};

export type CreateRewardClaimRecordFromProofPlanInput = {
  ownerAddress: string;
  epochId: bigint | number | string;
  rewardRole: RewardClaimRole;
  grossAllocationAmountBaseUnits: bigint | number | string;
  deliveryCostAmountBaseUnits: bigint | number | string;
  netClaimAmountBaseUnits: bigint | number | string;
  rolledForwardAmountBaseUnits: bigint | number | string;
  leafIndex: bigint | number | string;
  proof: Array<string | Uint8Array | number[]>;
};

export type RoutePlatformFeePlanInput = {
  payerAddress: string;
  feeAmountBaseUnits: bigint | number | string;
  holderRewardVaultAddress: string;
  stakerRewardVaultAddress: string;
  treasuryVaultAddress: string;
};

export type GovernanceVotePlanInput = {
  ownerAddress: string;
  proposalId: bigint | number | string;
  approve: boolean;
};

export type CreateGovernanceProposalPlanInput = {
  authorityAddress: string;
  proposalId: bigint | number | string;
  category: GovernanceProposalCategory;
  metadataHash: string | Uint8Array | number[];
};

export type CloseGovernanceProposalPlanInput = {
  authorityAddress: string;
  proposalId: bigint | number | string;
  approved: boolean;
};

export type RegisterProjectPlanInput = {
  authorityAddress: string;
  projectId: bigint | number | string;
  requiredTier: Exclude<StakingTier, "NONE">;
  riskLevel: ProjectRiskLevel;
  status: ProjectLifecycleStatus;
  metadataHash: string | Uint8Array | number[];
  receivingAccountAddress: string;
  governanceProposalAddress: string;
};

export type UpdateProjectStatusPlanInput = {
  authorityAddress: string;
  projectId: bigint | number | string;
  status: ProjectLifecycleStatus;
};

export type ProjectParticipationPlanInput = {
  ownerAddress: string;
  projectId: bigint | number | string;
  participationAmountBaseUnits: bigint | number | string;
  disclosureHash: string | Uint8Array | number[];
};

export type SeedBotPermissionPlanInput = {
  ownerAddress: string;
  permissionHash: string | Uint8Array | number[];
  expiresAtUnix: bigint | number | string;
  maxTradeAmountBaseUnits: bigint | number | string;
  maxDailyVolumeAmountBaseUnits: bigint | number | string;
  maxDailyTrades: number;
  maxSlippageBps: number;
};

export type FeeConfigPlanInput = {
  authorityAddress: string;
  baseFeeBps: number;
  tierFeeReductionBps: [number, number, number, number, number];
};

export function buildStakeRypTransactionPlan({
  amountUi,
  ownerAddress,
  tier,
}: StakePlanInput): PreparedSolanaTransactionPlan {
  const amount = amountUi ?? tierRequirements[tier];
  const amountBaseUnits = parseRypAmountToBaseUnits(amount, appConfig.rypDecimals);
  const addresses = deriveProtocolAddresses(ownerAddress);
  const spec = instructionSpec("stake_ryp");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: u64LeHex(BigInt(amountBaseUnits)),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "stake_ryp",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "STAKE_RYP",
    addresses,
    amountBaseUnits,
    amountUi: amount.toString(),
    instruction,
    warnings: [
      "Requires initialized protocol config and RYP vault on the selected Solana cluster.",
      "No transaction is signed or broadcast until the connected Solana wallet approves it.",
    ],
  });
}

export function buildUnstakeRypTransactionPlan({
  amountUi,
  ownerAddress,
}: UnstakePlanInput): PreparedSolanaTransactionPlan {
  const amountBaseUnits = parseRypAmountToBaseUnits(amountUi, appConfig.rypDecimals);
  const addresses = deriveProtocolAddresses(ownerAddress);
  const spec = instructionSpec("unstake_ryp");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: u64LeHex(BigInt(amountBaseUnits)),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "unstake_ryp",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "UNSTAKE_RYP",
    addresses,
    amountBaseUnits,
    amountUi: amountUi.toString(),
    instruction,
    warnings: [
      "Unstaking may reduce tier access, Golden Key state, project slots, and fee reduction.",
      "No transaction is signed or broadcast until the connected Solana wallet approves it.",
    ],
  });
}

export function buildActivateVotingRightsTransactionPlan({
  ownerAddress,
}: VotingRightsPlanInput): PreparedSolanaTransactionPlan {
  const addresses = deriveProtocolAddresses(ownerAddress);
  const spec = instructionSpec("activate_voting_rights");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "activate_voting_rights",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "ACTIVATE_VOTING_RIGHTS",
    addresses,
    instruction,
    warnings: [
      "Voting rights only activate after the 14-day staking delay enforced by the Solana program.",
      "One-wallet voting remains a governance policy layer and still needs anti-sybil review before launch.",
    ],
  });
}

export function buildCreateRewardClaimRecordTransactionPlan({
  authorityAddress,
  deliveryCostAmountBaseUnits,
  epochId,
  grossAllocationAmountBaseUnits,
  netClaimAmountBaseUnits,
  rewardRole,
  rolledForwardAmountBaseUnits,
  walletAddress,
}: CreateRewardClaimRecordPlanInput): PreparedSolanaTransactionPlan {
  const epoch = toU64(epochId);
  const wallet = new PublicKey(walletAddress);
  const addresses = {
    ...deriveProtocolAddresses(authorityAddress),
    authority: new PublicKey(authorityAddress).toBase58(),
    claimRecord: deriveRewardClaimRecordAddress({ epochId: epoch, rewardRole, walletAddress }),
    rewardEpoch: deriveRewardEpochAddress(epoch),
  };
  const spec = instructionSpec("create_reward_claim_record");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: [
      u64LeHex(epoch),
      rewardRoleVariantHex(rewardRole),
      bytesToHex(wallet.toBytes()),
      u64LeHex(toU64(grossAllocationAmountBaseUnits)),
      u64LeHex(toU64(deliveryCostAmountBaseUnits)),
      u64LeHex(toU64(netClaimAmountBaseUnits)),
      u64LeHex(toU64(rolledForwardAmountBaseUnits)),
    ].join(""),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "create_reward_claim_record",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "CREATE_REWARD_CLAIM_RECORD",
    addresses,
    feePayer: addresses.authority,
    instruction,
    warnings: [
      "Admin-only reward record creation; the epoch must already be reviewed on-chain.",
      "Claim records are role-keyed so holder and staker buckets cannot overwrite each other.",
    ],
  });
}

export function buildCreateRewardClaimRecordFromProofTransactionPlan({
  deliveryCostAmountBaseUnits,
  epochId,
  grossAllocationAmountBaseUnits,
  leafIndex,
  netClaimAmountBaseUnits,
  ownerAddress,
  proof,
  rewardRole,
  rolledForwardAmountBaseUnits,
}: CreateRewardClaimRecordFromProofPlanInput): PreparedSolanaTransactionPlan {
  const epoch = toU64(epochId);
  const owner = new PublicKey(ownerAddress);
  const proofHex = proofVecHex(proof);
  const addresses = {
    ...deriveProtocolAddresses(ownerAddress),
    claimRecord: deriveRewardClaimRecordAddress({ epochId: epoch, rewardRole, walletAddress: ownerAddress }),
    owner: owner.toBase58(),
    rewardEpoch: deriveRewardEpochAddress(epoch),
  };
  const spec = instructionSpec("create_reward_claim_record_from_proof");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: [
      u64LeHex(epoch),
      rewardRoleVariantHex(rewardRole),
      u64LeHex(toU64(grossAllocationAmountBaseUnits)),
      u64LeHex(toU64(deliveryCostAmountBaseUnits)),
      u64LeHex(toU64(netClaimAmountBaseUnits)),
      u64LeHex(toU64(rolledForwardAmountBaseUnits)),
      u64LeHex(toU64(leafIndex)),
      proofHex,
    ].join(""),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "create_reward_claim_record_from_proof",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "CREATE_REWARD_CLAIM_RECORD_FROM_PROOF",
    addresses,
    feePayer: addresses.owner,
    instruction,
    warnings: [
      "Wallet-created reward record path; the epoch must already be reviewed and contain the matching Merkle root.",
      "The wallet signs the record creation itself; no admin key, backend key, or custody route is used.",
    ],
  });
}

export function buildClaimRewardRecordTransactionPlan({
  epochId,
  ownerAddress,
  rewardRole,
}: ClaimRewardRecordPlanInput): PreparedSolanaTransactionPlan {
  const epoch = toU64(epochId);
  const addresses = {
    ...deriveProtocolAddresses(ownerAddress),
    claimRecord: deriveRewardClaimRecordAddress({ epochId: epoch, rewardRole, walletAddress: ownerAddress }),
    rewardEpoch: deriveRewardEpochAddress(epoch),
  };
  const spec = instructionSpec("claim_reward_record");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: rewardRoleVariantHex(rewardRole),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "claim_reward_record",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "CLAIM_REWARD",
    addresses,
    instruction,
    warnings: [
      "This plan is only for zero-net rollover claim records.",
      "Positive reward payouts must use the token-transfer claim path.",
    ],
  });
}

export function buildClaimRewardTokensTransactionPlan({
  epochId,
  ownerAddress,
  rewardRole,
  rewardSourceVaultAddress,
}: ClaimRewardTokensPlanInput): PreparedSolanaTransactionPlan {
  const epoch = toU64(epochId);
  const addresses = {
    ...deriveProtocolAddresses(ownerAddress),
    claimRecord: deriveRewardClaimRecordAddress({ epochId: epoch, rewardRole, walletAddress: ownerAddress }),
    ownerRewardAccount: deriveProtocolAddresses(ownerAddress).ownerRypAccount,
    rewardEpoch: deriveRewardEpochAddress(epoch),
    rewardSourceVault: new PublicKey(rewardSourceVaultAddress).toBase58(),
    rewardVaultState: deriveRewardVaultStateAddress(rewardRole),
  };
  const spec = instructionSpec("claim_reward_tokens");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: `${u64LeHex(epoch)}${rewardRoleVariantHex(rewardRole)}`,
    discriminatorHex: spec.discriminatorHex,
    instructionName: "claim_reward_tokens",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "CLAIM_REWARD",
    addresses,
    instruction,
    warnings: [
      "Transfers only from a verified program-controlled reward vault.",
      "The wallet still signs explicitly; no backend key or custody route is used.",
    ],
  });
}

export function buildRoutePlatformFeeTransactionPlan({
  feeAmountBaseUnits,
  holderRewardVaultAddress,
  payerAddress,
  stakerRewardVaultAddress,
  treasuryVaultAddress,
}: RoutePlatformFeePlanInput): PreparedSolanaTransactionPlan {
  const feeAmount = toU64(feeAmountBaseUnits);
  const payer = new PublicKey(payerAddress);
  const addresses = {
    ...deriveProtocolAddresses(payerAddress),
    holderRewardVault: new PublicKey(holderRewardVaultAddress).toBase58(),
    holderRewardVaultState: deriveRewardVaultStateAddress("HOLDER_REWARD"),
    independentTreasuryVault: new PublicKey(treasuryVaultAddress).toBase58(),
    independentTreasuryVaultState: deriveRewardVaultStateAddress("INDEPENDENT_TREASURY"),
    payer: payer.toBase58(),
    payerFeeAccount: deriveAssociatedTokenAddress({
      mint: new PublicKey(appConfig.rypMintAddress),
      owner: payer,
    }).toBase58(),
    stakerRewardVault: new PublicKey(stakerRewardVaultAddress).toBase58(),
    stakerRewardVaultState: deriveRewardVaultStateAddress("STAKER_REWARD"),
  };
  const spec = instructionSpec("route_platform_fee");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: u64LeHex(feeAmount),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "route_platform_fee",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "ROUTE_PLATFORM_FEE",
    addresses,
    amountBaseUnits: feeAmount.toString(),
    feePayer: addresses.payer,
    instruction,
    warnings: [
      "Routes a wallet-approved RYP platform fee into verified holder, staker, and treasury vaults.",
      "Vault token accounts must match reviewed RewardVaultState records before signing.",
      "This does not enforce a global wallet-to-wallet transfer tax on the existing SPL token.",
    ],
  });
}

export function buildCastGovernanceVoteTransactionPlan({
  approve,
  ownerAddress,
  proposalId,
}: GovernanceVotePlanInput): PreparedSolanaTransactionPlan {
  const proposal = toU64(proposalId);
  const addresses = {
    ...deriveProtocolAddresses(ownerAddress),
    proposal: deriveGovernanceProposalAddress(proposal),
    voteRecord: deriveGovernanceVoteRecordAddress({ proposalId: proposal, walletAddress: ownerAddress }),
  };
  const spec = instructionSpec("cast_governance_vote");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: `${u64LeHex(proposal)}${approve ? "01" : "00"}`,
    discriminatorHex: spec.discriminatorHex,
    instructionName: "cast_governance_vote",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "VOTE_PROPOSAL",
    addresses,
    instruction,
    warnings: [
      "Voting requires active on-chain voting rights after the staking delay.",
      "One wallet can create only one vote record per proposal.",
    ],
  });
}

export function buildCreateGovernanceProposalTransactionPlan({
  authorityAddress,
  category,
  metadataHash,
  proposalId,
}: CreateGovernanceProposalPlanInput): PreparedSolanaTransactionPlan {
  const proposal = toU64(proposalId);
  const addresses = {
    ...deriveProtocolAddresses(authorityAddress),
    authority: new PublicKey(authorityAddress).toBase58(),
    proposal: deriveGovernanceProposalAddress(proposal),
  };
  const spec = instructionSpec("create_governance_proposal");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: `${u64LeHex(proposal)}${enumVariantHex(category, GOVERNANCE_CATEGORY_VARIANTS)}${fixedHashHex(metadataHash)}`,
    discriminatorHex: spec.discriminatorHex,
    instructionName: "create_governance_proposal",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "CREATE_GOVERNANCE_PROPOSAL",
    addresses,
    feePayer: addresses.authority,
    instruction,
    warnings: [
      "Admin-only governance proposal creation; metadata must point to reviewed off-chain proposal content.",
      "No proposal is created until the configured protocol authority signs.",
    ],
  });
}

export function buildCloseGovernanceProposalTransactionPlan({
  approved,
  authorityAddress,
  proposalId,
}: CloseGovernanceProposalPlanInput): PreparedSolanaTransactionPlan {
  const proposal = toU64(proposalId);
  const addresses = {
    ...deriveProtocolAddresses(authorityAddress),
    authority: new PublicKey(authorityAddress).toBase58(),
    proposal: deriveGovernanceProposalAddress(proposal),
  };
  const spec = instructionSpec("close_governance_proposal");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: `${u64LeHex(proposal)}${approved ? "01" : "00"}`,
    discriminatorHex: spec.discriminatorHex,
    instructionName: "close_governance_proposal",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "CLOSE_GOVERNANCE_PROPOSAL",
    addresses,
    feePayer: addresses.authority,
    instruction,
    warnings: [
      "Admin-only proposal close; the on-chain proposal must still be open.",
      "Closing a proposal only records the approval result; execution remains separate.",
    ],
  });
}

export function buildRegisterProjectTransactionPlan({
  authorityAddress,
  governanceProposalAddress,
  metadataHash,
  projectId,
  receivingAccountAddress,
  requiredTier,
  riskLevel,
  status,
}: RegisterProjectPlanInput): PreparedSolanaTransactionPlan {
  const project = toU64(projectId);
  const receivingAccount = new PublicKey(receivingAccountAddress);
  const governanceProposal = new PublicKey(governanceProposalAddress);
  const addresses = {
    ...deriveProtocolAddresses(authorityAddress),
    authority: new PublicKey(authorityAddress).toBase58(),
    project: deriveProjectRecordAddress(project),
  };
  const spec = instructionSpec("register_project");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: [
      u64LeHex(project),
      enumVariantHex(requiredTier, STAKE_TIER_VARIANTS),
      enumVariantHex(riskLevel, PROJECT_RISK_LEVEL_VARIANTS),
      enumVariantHex(status, PROJECT_STATUS_VARIANTS),
      fixedHashHex(metadataHash),
      pubkeyHex(receivingAccount),
      pubkeyHex(governanceProposal),
    ].join(""),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "register_project",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "REGISTER_PROJECT",
    addresses,
    feePayer: addresses.authority,
    instruction,
    warnings: [
      "Admin-only project registration; project metadata and receiving account must be reviewed before signing.",
      "The receiving account is recorded only; project fund custody remains outside this instruction.",
    ],
  });
}

export function buildUpdateProjectStatusTransactionPlan({
  authorityAddress,
  projectId,
  status,
}: UpdateProjectStatusPlanInput): PreparedSolanaTransactionPlan {
  const project = toU64(projectId);
  const addresses = {
    ...deriveProtocolAddresses(authorityAddress),
    authority: new PublicKey(authorityAddress).toBase58(),
    project: deriveProjectRecordAddress(project),
  };
  const spec = instructionSpec("update_project_status");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: `${u64LeHex(project)}${enumVariantHex(status, PROJECT_STATUS_VARIANTS)}`,
    discriminatorHex: spec.discriminatorHex,
    instructionName: "update_project_status",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "UPDATE_PROJECT_STATUS",
    addresses,
    feePayer: addresses.authority,
    instruction,
    warnings: [
      "Admin-only project lifecycle update.",
      "Status changes should match reviewed milestone, disclosure, or governance evidence.",
    ],
  });
}

export function buildProjectParticipationTransactionPlan({
  disclosureHash,
  ownerAddress,
  participationAmountBaseUnits,
  projectId,
}: ProjectParticipationPlanInput): PreparedSolanaTransactionPlan {
  const project = toU64(projectId);
  const amount = toU64(participationAmountBaseUnits);
  const addresses = {
    ...deriveProtocolAddresses(ownerAddress),
    participation: deriveProjectParticipationAddress({ projectId: project, walletAddress: ownerAddress }),
    project: deriveProjectRecordAddress(project),
  };
  const spec = instructionSpec("participate_project");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: `${u64LeHex(project)}${u64LeHex(amount)}${fixedHashHex(disclosureHash)}`,
    discriminatorHex: spec.discriminatorHex,
    instructionName: "participate_project",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "PARTICIPATE_PROJECT",
    addresses,
    amountBaseUnits: amount.toString(),
    instruction,
    warnings: [
      "Project participation requires the wallet to satisfy the project tier gate.",
      "The disclosure hash must match the reviewed project risk packet.",
    ],
  });
}

export function buildCreateSeedBotPermissionTransactionPlan({
  expiresAtUnix,
  maxDailyVolumeAmountBaseUnits,
  maxDailyTrades,
  maxSlippageBps,
  maxTradeAmountBaseUnits,
  ownerAddress,
  permissionHash,
}: SeedBotPermissionPlanInput): PreparedSolanaTransactionPlan {
  const addresses = {
    ...deriveProtocolAddresses(ownerAddress),
    permission: deriveSeedBotPermissionAddress(ownerAddress),
  };
  const spec = instructionSpec("create_seedbot_permission");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: [
      fixedHashHex(permissionHash),
      i64LeHex(toI64(expiresAtUnix)),
      u64LeHex(toU64(maxTradeAmountBaseUnits)),
      u64LeHex(toU64(maxDailyVolumeAmountBaseUnits)),
      u16LeHex(maxDailyTrades),
      u16LeHex(maxSlippageBps),
    ].join(""),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "create_seedbot_permission",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "CREATE_SEEDBOT_PERMISSION",
    addresses,
    instruction,
    warnings: [
      "SeedBot permissions are bounded by on-chain expiry, max trade amount, max daily volume, daily trade count, and slippage.",
      "This does not grant custody of the wallet or seed phrase.",
    ],
  });
}

export function buildRevokeSeedBotPermissionTransactionPlan({
  ownerAddress,
}: VotingRightsPlanInput): PreparedSolanaTransactionPlan {
  const addresses = {
    ...deriveProtocolAddresses(ownerAddress),
    permission: deriveSeedBotPermissionAddress(ownerAddress),
  };
  const spec = instructionSpec("revoke_seedbot_permission");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    discriminatorHex: spec.discriminatorHex,
    instructionName: "revoke_seedbot_permission",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "REVOKE_PERMISSION",
    addresses,
    instruction,
    warnings: ["Revokes the wallet's SeedBot permission record on-chain."],
  });
}

export function buildUpdateFeeConfigTransactionPlan({
  authorityAddress,
  baseFeeBps,
  tierFeeReductionBps,
}: FeeConfigPlanInput): PreparedSolanaTransactionPlan {
  const addresses = {
    ...deriveProtocolAddresses(authorityAddress),
    authority: new PublicKey(authorityAddress).toBase58(),
  };
  const spec = instructionSpec("update_fee_config");
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    argDataHex: `${u16LeHex(baseFeeBps)}${tierFeeReductionBps.map(u16LeHex).join("")}`,
    discriminatorHex: spec.discriminatorHex,
    instructionName: "update_fee_config",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "UPDATE_FEE_CONFIG",
    addresses,
    feePayer: addresses.authority,
    instruction,
    warnings: ["Admin-only fee config update. The protocol authority must sign."],
  });
}

export function deriveProtocolAddresses(ownerAddress: string) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const owner = new PublicKey(ownerAddress);
  const rypMint = new PublicKey(appConfig.rypMintAddress);
  const [config] = PublicKey.findProgramAddressSync([textSeed(CONFIG_SEED)], programId);
  const [rewardConfig] = PublicKey.findProgramAddressSync([textSeed(REWARD_CONFIG_SEED)], programId);
  const [position] = PublicKey.findProgramAddressSync([textSeed(STAKE_POSITION_SEED), owner.toBuffer()], programId);
  const ownerRypAccount = deriveAssociatedTokenAddress({ mint: rypMint, owner });
  const rypVault = deriveAssociatedTokenAddress({ mint: rypMint, owner: config });

  return {
    associatedTokenProgramId: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
    config: config.toBase58(),
    owner: owner.toBase58(),
    ownerRypAccount: ownerRypAccount.toBase58(),
    position: position.toBase58(),
    programId: programId.toBase58(),
    rewardConfig: rewardConfig.toBase58(),
    rewardMint: rypMint.toBase58(),
    rypMint: rypMint.toBase58(),
    rypVault: rypVault.toBase58(),
    systemProgramId: SystemProgram.programId.toBase58(),
    tokenProgramId: SPL_TOKEN_PROGRAM_ID.toBase58(),
  };
}

export function deriveRewardEpochAddress(epochId: bigint | number | string) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const rewardConfig = new PublicKey(deriveProtocolAddresses(SystemProgram.programId.toBase58()).rewardConfig);
  const [address] = PublicKey.findProgramAddressSync(
    [textSeed(REWARD_EPOCH_SEED), rewardConfig.toBuffer(), u64LeBytes(toU64(epochId))],
    programId,
  );
  return address.toBase58();
}

export function deriveRewardClaimRecordAddress({
  epochId,
  rewardRole,
  walletAddress,
}: {
  epochId: bigint | number | string;
  rewardRole: RewardClaimRole;
  walletAddress: string;
}) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const rewardEpoch = new PublicKey(deriveRewardEpochAddress(epochId));
  const wallet = new PublicKey(walletAddress);
  const [address] = PublicKey.findProgramAddressSync(
    [textSeed(REWARD_CLAIM_SEED), rewardEpoch.toBuffer(), textSeed(REWARD_VAULT_ROLE_SEEDS[rewardRole]), wallet.toBuffer()],
    programId,
  );
  return address.toBase58();
}

export function deriveRewardVaultStateAddress(rewardRole: RewardVaultRouteRole) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const rewardConfig = new PublicKey(deriveProtocolAddresses(SystemProgram.programId.toBase58()).rewardConfig);
  const [address] = PublicKey.findProgramAddressSync(
    [textSeed(REWARD_VAULT_STATE_SEED), rewardConfig.toBuffer(), textSeed(REWARD_VAULT_ROLE_SEEDS[rewardRole])],
    programId,
  );
  return address.toBase58();
}

export function deriveGovernanceProposalAddress(proposalId: bigint | number | string) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const [address] = PublicKey.findProgramAddressSync(
    [textSeed(GOVERNANCE_PROPOSAL_SEED), u64LeBytes(toU64(proposalId))],
    programId,
  );
  return address.toBase58();
}

export function deriveGovernanceVoteRecordAddress({
  proposalId,
  walletAddress,
}: {
  proposalId: bigint | number | string;
  walletAddress: string;
}) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const proposal = new PublicKey(deriveGovernanceProposalAddress(proposalId));
  const wallet = new PublicKey(walletAddress);
  const [address] = PublicKey.findProgramAddressSync(
    [textSeed(GOVERNANCE_VOTE_SEED), proposal.toBuffer(), wallet.toBuffer()],
    programId,
  );
  return address.toBase58();
}

export function deriveProjectRecordAddress(projectId: bigint | number | string) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const [address] = PublicKey.findProgramAddressSync(
    [textSeed(PROJECT_RECORD_SEED), u64LeBytes(toU64(projectId))],
    programId,
  );
  return address.toBase58();
}

export function deriveProjectParticipationAddress({
  projectId,
  walletAddress,
}: {
  projectId: bigint | number | string;
  walletAddress: string;
}) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const project = new PublicKey(deriveProjectRecordAddress(projectId));
  const wallet = new PublicKey(walletAddress);
  const [address] = PublicKey.findProgramAddressSync(
    [textSeed(PROJECT_PARTICIPATION_SEED), project.toBuffer(), wallet.toBuffer()],
    programId,
  );
  return address.toBase58();
}

export function deriveSeedBotPermissionAddress(ownerAddress: string) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const owner = new PublicKey(ownerAddress);
  const [address] = PublicKey.findProgramAddressSync(
    [textSeed(SEEDBOT_PERMISSION_SEED), owner.toBuffer()],
    programId,
  );
  return address.toBase58();
}

export function parseRypAmountToBaseUnits(amountUi: number | string, decimals: number) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error("RYP decimals must be an integer between 0 and 18");
  }
  const normalized = amountUi.toString().replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid RYP amount: ${amountUi}`);
  }

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    throw new Error(`RYP amount has more than ${decimals} decimal places`);
  }

  const paddedFraction = fraction.padEnd(decimals, "0");
  const baseUnits = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");
  if (baseUnits === 0n) {
    throw new Error("RYP amount must be greater than zero");
  }
  assertU64(baseUnits);
  return baseUnits.toString();
}

function deriveAssociatedTokenAddress({ mint, owner }: { mint: PublicKey; owner: PublicKey }) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

function transactionPlan({
  action,
  addresses,
  amountBaseUnits,
  amountUi,
  feePayer,
  instruction,
  warnings,
}: {
  action: PreparedSolanaTransactionPlan["action"];
  addresses: ProtocolAddressBook;
  amountBaseUnits?: string;
  amountUi?: string;
  feePayer?: string;
  instruction: PreparedInstructionPlan;
  warnings: string[];
}): PreparedSolanaTransactionPlan {
  return {
    action,
    amountBaseUnits,
    amountUi,
    derivedAccounts: derivedAccountReferences(addresses),
    feePayer: feePayer ?? addresses.owner,
    instructions: [instruction],
    warnings,
  };
}

function instructionPlan({
  accounts,
  argDataHex = "",
  discriminatorHex,
  instructionName,
  programId,
}: {
  accounts: PreparedInstructionAccount[];
  argDataHex?: string;
  discriminatorHex: string;
  instructionName: string;
  programId: string;
}): PreparedInstructionPlan {
  return {
    accounts,
    dataHex: `${discriminatorHex}${argDataHex}`,
    discriminatorHex,
    instructionName,
    programId,
  };
}

function accountsFromSpec(spec: ProtocolInstructionSpec, addresses: ProtocolAddressBook): PreparedInstructionAccount[] {
  return orderedAccounts(
    spec.accounts.map((accountSpec) =>
      account(
        accountSpec.name,
        accountSpec.label,
        addressForProtocolAccount(addresses, accountSpec.name),
        accountSpec.role,
        accountSpec.signer,
        accountSpec.writable,
      ),
    ),
  );
}

function derivedAccountReferences(addresses: ProtocolAddressBook): TransactionAccountReference[] {
  const references = [
    account("config", "Protocol config", addresses.config, "Derived from seed: config", false, true),
    account("position", "Stake position", addresses.position, "Derived from stake-position + wallet", false, true),
    account("owner_ryp_account", "Owner RYP account", addresses.ownerRypAccount, "Associated token account for RYP", false, true),
    account("ryp_vault", "RYP vault", addresses.rypVault, "Associated token account owned by config PDA", false, true),
    account("reward_config", "Reward config", addresses.rewardConfig, "Derived from seed: reward-config", false, false),
  ];

  for (const [anchorName, label] of [
    ["holder_reward_vault_state", "Holder reward vault state"],
    ["staker_reward_vault_state", "Staker reward vault state"],
    ["independent_treasury_vault_state", "Independent treasury vault state"],
    ["holder_reward_vault", "Holder reward vault"],
    ["staker_reward_vault", "Staker reward vault"],
    ["independent_treasury_vault", "Independent treasury vault"],
    ["payer_fee_account", "Payer fee account"],
    ["reward_epoch", "Reward epoch"],
    ["claim_record", "Reward claim record"],
    ["proposal", "Governance proposal"],
    ["vote_record", "Governance vote record"],
    ["project", "Project record"],
    ["participation", "Project participation"],
    ["permission", "SeedBot permission"],
  ] as const) {
    const address = addressForProtocolAccountIfPresent(addresses, anchorName);
    if (address) references.push(account(anchorName, label, address, "Derived PDA", false, true));
  }

  return references;
}

function addressForProtocolAccount(addresses: ProtocolAddressBook, name: string) {
  const address = addressForProtocolAccountIfPresent(addresses, name);
  if (!address) {
    throw new Error(`Missing protocol account address for ${name}`);
  }
  return address;
}

function addressForProtocolAccountIfPresent(addresses: ProtocolAddressBook, name: string) {
  switch (name) {
    case "associated_token_program":
      return addresses.associatedTokenProgramId;
    case "authority":
      return addresses.authority;
    case "claim_record":
      return addresses.claimRecord;
    case "config":
      return addresses.config;
    case "holder_reward_vault":
      return addresses.holderRewardVault;
    case "holder_reward_vault_state":
      return addresses.holderRewardVaultState;
    case "independent_treasury_vault":
      return addresses.independentTreasuryVault;
    case "independent_treasury_vault_state":
      return addresses.independentTreasuryVaultState;
    case "owner":
      return addresses.owner;
    case "owner_reward_account":
      return addresses.ownerRewardAccount ?? addresses.ownerRypAccount;
    case "owner_ryp_account":
      return addresses.ownerRypAccount;
    case "participation":
      return addresses.participation;
    case "payer":
      return addresses.payer;
    case "payer_fee_account":
      return addresses.payerFeeAccount;
    case "permission":
      return addresses.permission;
    case "position":
      return addresses.position;
    case "project":
      return addresses.project;
    case "proposal":
      return addresses.proposal;
    case "reward_config":
      return addresses.rewardConfig;
    case "reward_epoch":
      return addresses.rewardEpoch;
    case "reward_mint":
      return addresses.rewardMint;
    case "reward_source_vault":
      return addresses.rewardSourceVault;
    case "reward_vault_state":
      return addresses.rewardVaultState;
    case "ryp_mint":
      return addresses.rypMint;
    case "ryp_vault":
      return addresses.rypVault;
    case "staker_reward_vault":
      return addresses.stakerRewardVault;
    case "staker_reward_vault_state":
      return addresses.stakerRewardVaultState;
    case "system_program":
      return addresses.systemProgramId;
    case "token_program":
      return addresses.tokenProgramId;
    case "vote_record":
      return addresses.voteRecord;
  }
  return addresses[name];
}

function orderedAccounts(accounts: TransactionAccountReference[]): PreparedInstructionAccount[] {
  return accounts.map((accountReference, index) => ({ ...accountReference, order: index }));
}

function account(
  anchorName: string,
  label: string,
  address: string,
  role: string,
  signer: boolean,
  writable: boolean,
): TransactionAccountReference {
  return {
    anchorName,
    address,
    label,
    role,
    signer,
    writable,
  };
}

function instructionSpec(name: string) {
  const spec = PROTOCOL_INSTRUCTION_SPECS[name];
  if (!spec) {
    throw new Error(`Missing protocol instruction spec for ${name}`);
  }
  return spec;
}

function textSeed(seed: string) {
  return new TextEncoder().encode(seed);
}

function fixedHashHex(hash: string | Uint8Array | number[]) {
  if (typeof hash === "string") {
    const normalized = hash.replace(/^0x/i, "").trim();
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
      throw new Error("Hash must be exactly 32 bytes encoded as 64 hex characters");
    }
    if (/^0+$/.test(normalized)) {
      throw new Error("Hash cannot be all zeros");
    }
    return normalized.toLowerCase();
  }

  const bytes = hash instanceof Uint8Array ? hash : Uint8Array.from(hash);
  if (bytes.length !== 32) {
    throw new Error("Hash must be exactly 32 bytes");
  }
  if (bytes.every((byte) => byte === 0)) {
    throw new Error("Hash cannot be all zeros");
  }
  return bytesToHex(bytes);
}

function fixedBytes32Hex(bytesLike: string | Uint8Array | number[], label: string) {
  if (typeof bytesLike === "string") {
    const normalized = bytesLike.replace(/^0x/i, "").trim();
    if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
      throw new Error(`${label} must be exactly 32 bytes encoded as 64 hex characters`);
    }
    return normalized.toLowerCase();
  }

  const bytes = bytesLike instanceof Uint8Array ? bytesLike : Uint8Array.from(bytesLike);
  if (bytes.length !== 32) {
    throw new Error(`${label} must be exactly 32 bytes`);
  }
  return bytesToHex(bytes);
}

function proofVecHex(proof: Array<string | Uint8Array | number[]>) {
  if (proof.length > MAX_REWARD_MERKLE_PROOF_NODES) {
    throw new Error(`Reward Merkle proof cannot exceed ${MAX_REWARD_MERKLE_PROOF_NODES} nodes`);
  }
  return `${u32LeHex(proof.length)}${proof
    .map((node, index) => fixedBytes32Hex(node, `Reward Merkle proof node ${index}`))
    .join("")}`;
}

function rewardRoleVariantHex(rewardRole: RewardClaimRole) {
  const variant = REWARD_ROLE_VARIANTS[rewardRole];
  if (variant === undefined) {
    throw new Error(`Unsupported reward claim role: ${rewardRole}`);
  }
  return u8Hex(variant);
}

function enumVariantHex<T extends string>(value: T, variants: Record<T, number>) {
  const variant = variants[value];
  if (variant === undefined) {
    throw new Error(`Unsupported enum variant: ${value}`);
  }
  return u8Hex(variant);
}

function pubkeyHex(publicKey: PublicKey) {
  return bytesToHex(publicKey.toBytes());
}

function u8Hex(value: number) {
  assertU8(value);
  return value.toString(16).padStart(2, "0");
}

function u16LeHex(value: number) {
  assertU16(value);
  return bytesToHex(new Uint8Array([value & 0xff, (value >> 8) & 0xff]));
}

function u32LeHex(value: number) {
  if (!Number.isInteger(value) || value < 0 || BigInt(value) > U32_MAX) {
    throw new Error("u32 value is out of range");
  }
  return bytesToHex(new Uint8Array([
    value & 0xff,
    (value >> 8) & 0xff,
    (value >> 16) & 0xff,
    (value >> 24) & 0xff,
  ]));
}

function u64LeBytes(value: bigint) {
  assertU64(value);
  const bytes = new Uint8Array(8);
  let cursor = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(cursor & 0xffn);
    cursor >>= 8n;
  }
  return bytes;
}

function u64LeHex(value: bigint) {
  return bytesToHex(u64LeBytes(value));
}

function i64LeHex(value: bigint) {
  assertI64(value);
  const twosComplement = value < 0 ? 2n ** 64n + value : value;
  return u64LeHex(twosComplement);
}

function toU64(value: bigint | number | string) {
  const parsed = toIntegerBigInt(value, "u64");
  assertU64(parsed);
  return parsed;
}

function toI64(value: bigint | number | string) {
  const parsed = toIntegerBigInt(value, "i64");
  assertI64(parsed);
  return parsed;
}

function toIntegerBigInt(value: bigint | number | string, label: string) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error(`${label} value must be an integer`);
    return BigInt(value);
  }
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) throw new Error(`${label} value must be an integer`);
  return BigInt(normalized);
}

function assertU16(value: number) {
  if (!Number.isInteger(value) || value < 0 || BigInt(value) > U16_MAX) {
    throw new Error("Value exceeds Solana u16 bounds");
  }
}

function assertU8(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error("Value exceeds Solana u8 bounds");
  }
}

function assertU64(value: bigint) {
  if (value < 0 || value > U64_MAX) {
    throw new Error("Value exceeds Solana u64 bounds");
  }
}

function assertI64(value: bigint) {
  if (value < I64_MIN || value > I64_MAX) {
    throw new Error("Value exceeds Solana i64 bounds");
  }
}

function bytesToHex(bytes: Uint8Array | number[]) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
