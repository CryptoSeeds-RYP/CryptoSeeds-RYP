import { Connection, PublicKey } from "@solana/web3.js";
import { appConfig, PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";
import {
  GOVERNANCE_PROPOSAL_SEED,
  GOVERNANCE_VOTE_SEED,
  PROJECT_PARTICIPATION_SEED,
  PROJECT_RECORD_SEED,
  STAKE_POSITION_SEED,
} from "./protocolTransactionPlan";
import protocolAccountLayoutsJson from "./protocolAccountLayouts.json";

type ProtocolStateLayoutName =
  | "GovernanceProposal"
  | "GovernanceVoteRecord"
  | "ProjectParticipationRecord"
  | "ProjectRecord"
  | "StakePosition";

type ProtocolStateFieldLayout = {
  name: string;
  type: string;
  offset: number;
  size: number;
};

type ProtocolStateLayout = {
  discriminatorHex: string;
  minimumLength: number;
  fields: ProtocolStateFieldLayout[];
};

export type ProtocolStateReadStatus = "PREVIEW_ONLY" | "MISSING" | "DECODED" | "DECODE_ERROR";
export type StakeTierName = "NONE" | "SEED" | "SPROUT" | "SAPLING" | "TREE" | "FRUIT" | "UNKNOWN";
export type GovernanceProposalCategory =
  | "PROJECT_APPROVAL"
  | "TREASURY_ALLOCATION"
  | "PROTOCOL_UPGRADE"
  | "DONATION_CAUSE"
  | "SEEDBOT_FEATURE"
  | "RISK_POLICY"
  | "UNKNOWN";
export type GovernanceProposalStatus = "OPEN" | "APPROVED" | "REJECTED" | "CANCELLED" | "UNKNOWN";
export type ProjectRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXPERIMENTAL" | "DONATION" | "UNKNOWN";
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
  | "REJECTED"
  | "CANCELLED"
  | "UNKNOWN";
export type ProjectFundingModel = "RECORD_ONLY" | "DIRECT_SETTLEMENT" | "PROGRAM_ESCROW" | "UNKNOWN";
export type ProjectParticipationStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "UNKNOWN";

export type StakePositionAccount = {
  owner: string;
  stakedAmount: string;
  tier: StakeTierName;
  stakingStartTs: string;
  votingRightsEligibleTs: string;
  lastRewardClaimTs: string;
  goldenKeyActive: boolean;
  votingRightsActive: boolean;
  voteCount: number;
  bump: number;
  goldenKeyIssuedAt: string;
  goldenKeyRevokedAt: string;
  votingRightsActivatedAt: string;
  votingRightsLevel: number;
};

export type GovernanceProposalAccount = {
  proposalId: string;
  authority: string;
  category: GovernanceProposalCategory;
  status: GovernanceProposalStatus;
  metadataHash: string;
  yesVotes: string;
  noVotes: string;
  createdAt: string;
  votingStartsAt: string;
  votingEndsAt: string;
  minimumVotes: string;
  closedAt: string;
  bump: number;
};

export type GovernanceVoteRecordAccount = {
  proposal: string;
  wallet: string;
  approve: boolean;
  votedAt: string;
  bump: number;
};

export type ProjectRecordAccount = {
  projectId: string;
  authority: string;
  requiredTier: StakeTierName;
  riskLevel: ProjectRiskLevel;
  status: ProjectLifecycleStatus;
  fundingModel: ProjectFundingModel;
  metadataHash: string;
  receivingAccount: string;
  governanceProposal: string;
  totalParticipants: string;
  minParticipationAmount: string;
  maxWalletParticipationAmount: string;
  maxTotalParticipationAmount: string;
  totalParticipationAmount: string;
  participationStartsAt: string;
  participationEndsAt: string;
  cancellationHash: string;
  cancelledAt: string;
  refundPoolAmount: string;
  totalRefundedAmount: string;
  participationPaused: boolean;
  currentDisclosureRevisionId: string;
  currentDisclosureHash: string;
  bump: number;
};

export type ProjectParticipationRecordAccount = {
  project: string;
  wallet: string;
  participationAmount: string;
  disclosureHash: string;
  joinedAt: string;
  status: ProjectParticipationStatus;
  bump: number;
};

export type StakePositionInspection = {
  programId: string;
  ownerAddress: string;
  positionAddress: string;
  status: ProtocolStateReadStatus;
  decoded?: StakePositionAccount;
  message: string;
  executionMode: "READ_ONLY";
  blockers: string[];
  warnings: string[];
};

export type GovernanceStateInspection = {
  programId: string;
  proposalId: string;
  proposalAddress: string;
  walletAddress?: string;
  voteRecordAddress?: string;
  proposalStatus: ProtocolStateReadStatus;
  proposal?: GovernanceProposalAccount;
  proposalMessage: string;
  voteRecordStatus: ProtocolStateReadStatus;
  voteRecord?: GovernanceVoteRecordAccount;
  voteRecordMessage: string;
  executionMode: "READ_ONLY";
  blockers: string[];
  warnings: string[];
};

export type ProjectStateInspection = {
  programId: string;
  projectId: string;
  projectAddress: string;
  walletAddress?: string;
  participationAddress?: string;
  projectStatus: ProtocolStateReadStatus;
  project?: ProjectRecordAccount;
  projectMessage: string;
  participationStatus: ProtocolStateReadStatus;
  participation?: ProjectParticipationRecordAccount;
  participationMessage: string;
  executionMode: "READ_ONLY";
  blockers: string[];
  warnings: string[];
};

export const PROTOCOL_STATE_LAYOUTS = protocolAccountLayoutsJson as Record<
  ProtocolStateLayoutName,
  ProtocolStateLayout
>;

const PROTOCOL_STATE_FIELD_OFFSETS = Object.fromEntries(
  Object.entries(PROTOCOL_STATE_LAYOUTS).map(([accountName, layout]) => [
    accountName,
    Object.fromEntries(layout.fields.map((field) => [field.name, field.offset])),
  ]),
) as Record<ProtocolStateLayoutName, Record<string, number>>;

export function deriveStakePositionInspectionAddress({
  ownerAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  ownerAddress: string;
  programIdAddress?: string;
}) {
  const programId = new PublicKey(programIdAddress);
  const owner = new PublicKey(ownerAddress);
  const [position] = PublicKey.findProgramAddressSync(
    [textSeed(STAKE_POSITION_SEED), owner.toBuffer()],
    programId,
  );

  return {
    ownerAddress: owner.toBase58(),
    positionAddress: position.toBase58(),
    programId: programId.toBase58(),
  };
}

export function deriveGovernanceInspectionAddresses({
  proposalId,
  walletAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  proposalId: bigint | number | string;
  walletAddress?: string;
  programIdAddress?: string;
}) {
  const programId = new PublicKey(programIdAddress);
  const proposalIdValue = toU64(proposalId);
  const [proposal] = PublicKey.findProgramAddressSync(
    [textSeed(GOVERNANCE_PROPOSAL_SEED), u64LeBytes(proposalIdValue)],
    programId,
  );
  const wallet = walletAddress ? new PublicKey(walletAddress) : undefined;
  const voteRecord = wallet
    ? PublicKey.findProgramAddressSync(
        [textSeed(GOVERNANCE_VOTE_SEED), proposal.toBuffer(), wallet.toBuffer()],
        programId,
      )[0]
    : undefined;

  return {
    programId: programId.toBase58(),
    proposalAddress: proposal.toBase58(),
    proposalId: proposalIdValue.toString(),
    voteRecordAddress: voteRecord?.toBase58(),
    walletAddress: wallet?.toBase58(),
  };
}

export function deriveProjectInspectionAddresses({
  projectId,
  walletAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  projectId: bigint | number | string;
  walletAddress?: string;
  programIdAddress?: string;
}) {
  const programId = new PublicKey(programIdAddress);
  const projectIdValue = toU64(projectId);
  const [project] = PublicKey.findProgramAddressSync(
    [textSeed(PROJECT_RECORD_SEED), u64LeBytes(projectIdValue)],
    programId,
  );
  const wallet = walletAddress ? new PublicKey(walletAddress) : undefined;
  const participation = wallet
    ? PublicKey.findProgramAddressSync(
        [textSeed(PROJECT_PARTICIPATION_SEED), project.toBuffer(), wallet.toBuffer()],
        programId,
      )[0]
    : undefined;

  return {
    participationAddress: participation?.toBase58(),
    programId: programId.toBase58(),
    projectAddress: project.toBase58(),
    projectId: projectIdValue.toString(),
    walletAddress: wallet?.toBase58(),
  };
}

export function buildStakePositionInspectionPreview({
  ownerAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  ownerAddress: string;
  programIdAddress?: string;
}): StakePositionInspection {
  const addresses = deriveStakePositionInspectionAddress({ ownerAddress, programIdAddress });
  const placeholderProgram = addresses.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID;

  return {
    ...addresses,
    status: "PREVIEW_ONLY",
    message: "Stake position account read has not been requested.",
    executionMode: "READ_ONLY",
    blockers: [],
    warnings: [
      "Stake position inspection is read-only.",
      "No staking, unstaking, Golden Key, or voting-rights action is exposed by this inspection.",
      ...(placeholderProgram ? ["Protocol program id is still the local development placeholder."] : []),
    ],
  };
}

export function buildGovernanceStateInspectionPreview({
  proposalId = appConfig.governanceInspectionProposalId,
  walletAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  proposalId?: bigint | number | string;
  walletAddress?: string;
  programIdAddress?: string;
} = {}): GovernanceStateInspection {
  const addresses = deriveGovernanceInspectionAddresses({ proposalId, walletAddress, programIdAddress });
  const placeholderProgram = addresses.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID;

  return {
    ...addresses,
    proposalStatus: "PREVIEW_ONLY",
    proposalMessage: "Governance proposal account read has not been requested.",
    voteRecordStatus: "PREVIEW_ONLY",
    voteRecordMessage: addresses.walletAddress
      ? "Governance vote record account read has not been requested."
      : "Connect a wallet to derive a vote record PDA.",
    executionMode: "READ_ONLY",
    blockers: [],
    warnings: [
      "Governance state inspection is read-only.",
      "No proposal creation, voting, closing, or authority action is exposed by this inspection.",
      ...(placeholderProgram ? ["Protocol program id is still the local development placeholder."] : []),
    ],
  };
}

export function buildProjectStateInspectionPreview({
  projectId = appConfig.projectInspectionId,
  walletAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  projectId?: bigint | number | string;
  walletAddress?: string;
  programIdAddress?: string;
} = {}): ProjectStateInspection {
  const addresses = deriveProjectInspectionAddresses({ projectId, walletAddress, programIdAddress });
  const placeholderProgram = addresses.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID;

  return {
    ...addresses,
    projectStatus: "PREVIEW_ONLY",
    projectMessage: "Project record account read has not been requested.",
    participationStatus: "PREVIEW_ONLY",
    participationMessage: addresses.walletAddress
      ? "Project participation account read has not been requested."
      : "Connect a wallet to derive a project participation PDA.",
    executionMode: "READ_ONLY",
    blockers: [],
    warnings: [
      "Project state inspection is read-only.",
      "No project registration, participation, funding, refund, or settlement action is exposed by this inspection.",
      ...(placeholderProgram ? ["Protocol program id is still the local development placeholder."] : []),
    ],
  };
}

export async function readStakePositionInspection({
  connection,
  ownerAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  connection: Connection;
  ownerAddress: string;
  programIdAddress?: string;
}): Promise<StakePositionInspection> {
  const preview = buildStakePositionInspectionPreview({ ownerAddress, programIdAddress });

  if (preview.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID) {
    return {
      ...preview,
      message: "Protocol program id is placeholder; RPC read skipped.",
      status: "PREVIEW_ONLY",
    };
  }

  const account = await connection.getAccountInfo(new PublicKey(preview.positionAddress), "confirmed");
  const decoded = decodeAccount(account?.data, decodeStakePositionAccount, "Stake position");

  return validateStakePositionInspection({
    ...preview,
    decoded: decoded.decoded,
    message: decoded.message,
    status: decoded.status,
  });
}

export async function readGovernanceStateInspection({
  connection,
  proposalId = appConfig.governanceInspectionProposalId,
  walletAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  connection: Connection;
  proposalId?: bigint | number | string;
  walletAddress?: string;
  programIdAddress?: string;
}): Promise<GovernanceStateInspection> {
  const preview = buildGovernanceStateInspectionPreview({ proposalId, walletAddress, programIdAddress });

  if (preview.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID) {
    return {
      ...preview,
      proposalMessage: "Protocol program id is placeholder; RPC read skipped.",
    };
  }

  const publicKeys = [
    new PublicKey(preview.proposalAddress),
    ...(preview.voteRecordAddress ? [new PublicKey(preview.voteRecordAddress)] : []),
  ];
  const accounts = await connection.getMultipleAccountsInfo(publicKeys, "confirmed");
  const proposal = decodeAccount(accounts[0]?.data, decodeGovernanceProposalAccount, "Governance proposal");
  const voteRecord = preview.voteRecordAddress
    ? decodeAccount(accounts[1]?.data, decodeGovernanceVoteRecordAccount, "Governance vote record")
    : {
        message: "Connect a wallet to derive a vote record PDA.",
        status: "PREVIEW_ONLY" as const,
      };

  return validateGovernanceStateInspection({
    ...preview,
    proposal: proposal.decoded,
    proposalMessage: proposal.message,
    proposalStatus: proposal.status,
    voteRecord: voteRecord.decoded,
    voteRecordMessage: voteRecord.message,
    voteRecordStatus: voteRecord.status,
  });
}

export async function readProjectStateInspection({
  connection,
  projectId = appConfig.projectInspectionId,
  walletAddress,
  programIdAddress = appConfig.protocolProgramId,
}: {
  connection: Connection;
  projectId?: bigint | number | string;
  walletAddress?: string;
  programIdAddress?: string;
}): Promise<ProjectStateInspection> {
  const preview = buildProjectStateInspectionPreview({ projectId, walletAddress, programIdAddress });

  if (preview.programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID) {
    return {
      ...preview,
      projectMessage: "Protocol program id is placeholder; RPC read skipped.",
    };
  }

  const publicKeys = [
    new PublicKey(preview.projectAddress),
    ...(preview.participationAddress ? [new PublicKey(preview.participationAddress)] : []),
  ];
  const accounts = await connection.getMultipleAccountsInfo(publicKeys, "confirmed");
  const project = decodeAccount(accounts[0]?.data, decodeProjectRecordAccount, "Project record");
  const participation = preview.participationAddress
    ? decodeAccount(accounts[1]?.data, decodeProjectParticipationRecordAccount, "Project participation")
    : {
        message: "Connect a wallet to derive a project participation PDA.",
        status: "PREVIEW_ONLY" as const,
      };

  return validateProjectStateInspection({
    ...preview,
    participation: participation.decoded,
    participationMessage: participation.message,
    participationStatus: participation.status,
    project: project.decoded,
    projectMessage: project.message,
    projectStatus: project.status,
  });
}

export function validateStakePositionInspection(inspection: StakePositionInspection): StakePositionInspection {
  const blockers = [...inspection.blockers];
  const warnings = [...inspection.warnings];

  if (inspection.executionMode !== "READ_ONLY") {
    blockers.push("Stake position inspection must remain read-only.");
  }

  if (inspection.status === "DECODED" && inspection.decoded) {
    if (inspection.decoded.owner !== inspection.ownerAddress) {
      blockers.push("Stake position owner does not match the inspected wallet.");
    }
    if (inspection.decoded.tier === "UNKNOWN") {
      blockers.push("Stake position tier is unknown.");
    }
    if (BigInt(inspection.decoded.stakedAmount) === 0n && inspection.decoded.tier !== "NONE") {
      blockers.push("Stake position has a tier but no staked amount.");
    }
    if (BigInt(inspection.decoded.stakedAmount) > 0n && inspection.decoded.tier === "NONE") {
      blockers.push("Stake position has staked amount but no active tier.");
    }
    if (inspection.decoded.goldenKeyActive && BigInt(inspection.decoded.goldenKeyIssuedAt) <= 0n) {
      blockers.push("Golden Key is active without an issued timestamp.");
    }
    if (inspection.decoded.votingRightsActive && BigInt(inspection.decoded.votingRightsActivatedAt) <= 0n) {
      blockers.push("Voting rights are active without an activation timestamp.");
    }
    if (
      inspection.decoded.votingRightsActive &&
      BigInt(inspection.decoded.votingRightsActivatedAt) < BigInt(inspection.decoded.votingRightsEligibleTs)
    ) {
      blockers.push("Voting rights activated before the eligibility timestamp.");
    }
    if (!inspection.decoded.goldenKeyActive && BigInt(inspection.decoded.goldenKeyRevokedAt) > 0n) {
      warnings.push("Golden Key has been revoked for this wallet.");
    }
  } else if (inspection.status === "MISSING") {
    warnings.push("No stake position exists for the inspected wallet.");
  } else if (inspection.status === "DECODE_ERROR") {
    blockers.push("Stake position account must decode before it can be inspected.");
  }

  return {
    ...inspection,
    blockers: uniqueMessages(blockers),
    warnings: uniqueMessages(warnings),
  };
}

export function validateGovernanceStateInspection(inspection: GovernanceStateInspection): GovernanceStateInspection {
  const blockers = [...inspection.blockers];
  const warnings = [...inspection.warnings];

  if (inspection.executionMode !== "READ_ONLY") {
    blockers.push("Governance state inspection must remain read-only.");
  }

  if (inspection.proposalStatus === "DECODED" && inspection.proposal) {
    if (inspection.proposal.proposalId !== inspection.proposalId) {
      blockers.push("Governance proposal id does not match the inspected PDA seed.");
    }
    if (inspection.proposal.category === "UNKNOWN") {
      blockers.push("Governance proposal category is unknown.");
    }
    if (inspection.proposal.status === "UNKNOWN") {
      blockers.push("Governance proposal status is unknown.");
    }
    if (isBlankHash(inspection.proposal.metadataHash)) {
      blockers.push("Governance proposal metadata hash must not be blank.");
    }
    if (BigInt(inspection.proposal.votingEndsAt) <= BigInt(inspection.proposal.votingStartsAt)) {
      blockers.push("Governance proposal voting window is invalid.");
    }
    if (inspection.proposal.status !== "OPEN" && BigInt(inspection.proposal.closedAt) <= 0n) {
      warnings.push("Governance proposal is closed by status but has no closed timestamp.");
    }
  } else if (inspection.proposalStatus === "MISSING") {
    warnings.push(`Governance proposal #${inspection.proposalId} does not exist on the selected cluster.`);
  } else if (inspection.proposalStatus === "DECODE_ERROR") {
    blockers.push("Governance proposal account must decode before it can be inspected.");
  }

  if (inspection.voteRecordStatus === "DECODED" && inspection.voteRecord) {
    if (inspection.voteRecord.proposal !== inspection.proposalAddress) {
      blockers.push("Governance vote record points to a different proposal.");
    }
    if (inspection.walletAddress && inspection.voteRecord.wallet !== inspection.walletAddress) {
      blockers.push("Governance vote record wallet does not match the inspected wallet.");
    }
    if (BigInt(inspection.voteRecord.votedAt) <= 0n) {
      blockers.push("Governance vote record has no vote timestamp.");
    }
  } else if (inspection.voteRecordStatus === "MISSING" && inspection.walletAddress) {
    warnings.push("No governance vote record exists for the inspected wallet and proposal.");
  } else if (inspection.voteRecordStatus === "DECODE_ERROR") {
    blockers.push("Governance vote record account must decode before it can be inspected.");
  }

  return {
    ...inspection,
    blockers: uniqueMessages(blockers),
    warnings: uniqueMessages(warnings),
  };
}

export function validateProjectStateInspection(inspection: ProjectStateInspection): ProjectStateInspection {
  const blockers = [...inspection.blockers];
  const warnings = [...inspection.warnings];

  if (inspection.executionMode !== "READ_ONLY") {
    blockers.push("Project state inspection must remain read-only.");
  }

  if (inspection.projectStatus === "DECODED" && inspection.project) {
    if (inspection.project.projectId !== inspection.projectId) {
      blockers.push("Project record id does not match the inspected PDA seed.");
    }
    if (inspection.project.requiredTier === "NONE" || inspection.project.requiredTier === "UNKNOWN") {
      blockers.push("Project record must require an active staking tier.");
    }
    if (inspection.project.riskLevel === "UNKNOWN") {
      blockers.push("Project risk level is unknown.");
    }
    if (inspection.project.status === "UNKNOWN") {
      blockers.push("Project lifecycle status is unknown.");
    }
    if (inspection.project.fundingModel !== "RECORD_ONLY") {
      blockers.push("Project funding model must remain RECORD_ONLY in the MVP.");
    }
    if (isBlankHash(inspection.project.metadataHash)) {
      blockers.push("Project metadata hash must not be blank.");
    }
    if (isBlankHash(inspection.project.currentDisclosureHash)) {
      blockers.push("Project current disclosure hash must not be blank.");
    }
    if (BigInt(inspection.project.maxTotalParticipationAmount) < BigInt(inspection.project.minParticipationAmount)) {
      blockers.push("Project max total participation amount is below the minimum participation amount.");
    }
    if (BigInt(inspection.project.maxWalletParticipationAmount) > BigInt(inspection.project.maxTotalParticipationAmount)) {
      blockers.push("Project max wallet participation amount exceeds max total participation amount.");
    }
    if (BigInt(inspection.project.totalParticipationAmount) > BigInt(inspection.project.maxTotalParticipationAmount)) {
      blockers.push("Project total participation amount exceeds the max total participation amount.");
    }
    if (BigInt(inspection.project.totalRefundedAmount) > BigInt(inspection.project.refundPoolAmount)) {
      blockers.push("Project refunded amount exceeds the refund pool amount.");
    }
    if (BigInt(inspection.project.participationEndsAt) <= BigInt(inspection.project.participationStartsAt)) {
      blockers.push("Project participation window is invalid.");
    }
    if (inspection.project.participationPaused) {
      warnings.push("Project participation is paused.");
    }
  } else if (inspection.projectStatus === "MISSING") {
    warnings.push(`Project #${inspection.projectId} does not exist on the selected cluster.`);
  } else if (inspection.projectStatus === "DECODE_ERROR") {
    blockers.push("Project record account must decode before it can be inspected.");
  }

  if (inspection.participationStatus === "DECODED" && inspection.participation) {
    if (inspection.participation.project !== inspection.projectAddress) {
      blockers.push("Project participation record points to a different project.");
    }
    if (inspection.walletAddress && inspection.participation.wallet !== inspection.walletAddress) {
      blockers.push("Project participation wallet does not match the inspected wallet.");
    }
    if (BigInt(inspection.participation.participationAmount) <= 0n) {
      blockers.push("Project participation amount must be greater than zero.");
    }
    if (isBlankHash(inspection.participation.disclosureHash)) {
      blockers.push("Project participation disclosure hash must not be blank.");
    }
    if (inspection.participation.status === "UNKNOWN") {
      blockers.push("Project participation status is unknown.");
    }
  } else if (inspection.participationStatus === "MISSING" && inspection.walletAddress) {
    warnings.push("No project participation record exists for the inspected wallet and project.");
  } else if (inspection.participationStatus === "DECODE_ERROR") {
    blockers.push("Project participation account must decode before it can be inspected.");
  }

  return {
    ...inspection,
    blockers: uniqueMessages(blockers),
    warnings: uniqueMessages(warnings),
  };
}

export function decodeStakePositionAccount(data: Uint8Array): StakePositionAccount {
  assertAccountLayout(data, "StakePosition");
  const offset = PROTOCOL_STATE_FIELD_OFFSETS.StakePosition;

  return {
    owner: readPubkey(data, offset.owner),
    stakedAmount: readU64(data, offset.staked_amount).toString(),
    tier: stakeTierFromVariant(data[offset.tier]),
    stakingStartTs: readI64(data, offset.staking_start_ts).toString(),
    votingRightsEligibleTs: readI64(data, offset.voting_rights_eligible_ts).toString(),
    lastRewardClaimTs: readI64(data, offset.last_reward_claim_ts).toString(),
    goldenKeyActive: readBool(data, offset.golden_key_active),
    votingRightsActive: readBool(data, offset.voting_rights_active),
    voteCount: readU32(data, offset.vote_count),
    bump: data[offset.bump],
    goldenKeyIssuedAt: readI64(data, offset.golden_key_issued_at).toString(),
    goldenKeyRevokedAt: readI64(data, offset.golden_key_revoked_at).toString(),
    votingRightsActivatedAt: readI64(data, offset.voting_rights_activated_at).toString(),
    votingRightsLevel: data[offset.voting_rights_level],
  };
}

export function decodeGovernanceProposalAccount(data: Uint8Array): GovernanceProposalAccount {
  assertAccountLayout(data, "GovernanceProposal");
  const offset = PROTOCOL_STATE_FIELD_OFFSETS.GovernanceProposal;

  return {
    proposalId: readU64(data, offset.proposal_id).toString(),
    authority: readPubkey(data, offset.authority),
    category: governanceCategoryFromVariant(data[offset.category]),
    status: governanceStatusFromVariant(data[offset.status]),
    metadataHash: bytesToHex(data.subarray(offset.metadata_hash, offset.metadata_hash + 32)),
    yesVotes: readU64(data, offset.yes_votes).toString(),
    noVotes: readU64(data, offset.no_votes).toString(),
    createdAt: readI64(data, offset.created_at).toString(),
    votingStartsAt: readI64(data, offset.voting_starts_at).toString(),
    votingEndsAt: readI64(data, offset.voting_ends_at).toString(),
    minimumVotes: readU64(data, offset.minimum_votes).toString(),
    closedAt: readI64(data, offset.closed_at).toString(),
    bump: data[offset.bump],
  };
}

export function decodeGovernanceVoteRecordAccount(data: Uint8Array): GovernanceVoteRecordAccount {
  assertAccountLayout(data, "GovernanceVoteRecord");
  const offset = PROTOCOL_STATE_FIELD_OFFSETS.GovernanceVoteRecord;

  return {
    proposal: readPubkey(data, offset.proposal),
    wallet: readPubkey(data, offset.wallet),
    approve: readBool(data, offset.approve),
    votedAt: readI64(data, offset.voted_at).toString(),
    bump: data[offset.bump],
  };
}

export function decodeProjectRecordAccount(data: Uint8Array): ProjectRecordAccount {
  assertAccountLayout(data, "ProjectRecord");
  const offset = PROTOCOL_STATE_FIELD_OFFSETS.ProjectRecord;

  return {
    projectId: readU64(data, offset.project_id).toString(),
    authority: readPubkey(data, offset.authority),
    requiredTier: stakeTierFromVariant(data[offset.required_tier]),
    riskLevel: projectRiskLevelFromVariant(data[offset.risk_level]),
    status: projectStatusFromVariant(data[offset.status]),
    fundingModel: projectFundingModelFromVariant(data[offset.funding_model]),
    metadataHash: bytesToHex(data.subarray(offset.metadata_hash, offset.metadata_hash + 32)),
    receivingAccount: readPubkey(data, offset.receiving_account),
    governanceProposal: readPubkey(data, offset.governance_proposal),
    totalParticipants: readU64(data, offset.total_participants).toString(),
    minParticipationAmount: readU64(data, offset.min_participation_amount).toString(),
    maxWalletParticipationAmount: readU64(data, offset.max_wallet_participation_amount).toString(),
    maxTotalParticipationAmount: readU64(data, offset.max_total_participation_amount).toString(),
    totalParticipationAmount: readU64(data, offset.total_participation_amount).toString(),
    participationStartsAt: readI64(data, offset.participation_starts_at).toString(),
    participationEndsAt: readI64(data, offset.participation_ends_at).toString(),
    cancellationHash: bytesToHex(data.subarray(offset.cancellation_hash, offset.cancellation_hash + 32)),
    cancelledAt: readI64(data, offset.cancelled_at).toString(),
    refundPoolAmount: readU64(data, offset.refund_pool_amount).toString(),
    totalRefundedAmount: readU64(data, offset.total_refunded_amount).toString(),
    participationPaused: readBool(data, offset.participation_paused),
    currentDisclosureRevisionId: readU64(data, offset.current_disclosure_revision_id).toString(),
    currentDisclosureHash: bytesToHex(
      data.subarray(offset.current_disclosure_hash, offset.current_disclosure_hash + 32),
    ),
    bump: data[offset.bump],
  };
}

export function decodeProjectParticipationRecordAccount(data: Uint8Array): ProjectParticipationRecordAccount {
  assertAccountLayout(data, "ProjectParticipationRecord");
  const offset = PROTOCOL_STATE_FIELD_OFFSETS.ProjectParticipationRecord;

  return {
    project: readPubkey(data, offset.project),
    wallet: readPubkey(data, offset.wallet),
    participationAmount: readU64(data, offset.participation_amount).toString(),
    disclosureHash: bytesToHex(data.subarray(offset.disclosure_hash, offset.disclosure_hash + 32)),
    joinedAt: readI64(data, offset.joined_at).toString(),
    status: projectParticipationStatusFromVariant(data[offset.status]),
    bump: data[offset.bump],
  };
}

function decodeAccount<T>(
  data: Uint8Array | undefined,
  decoder: (data: Uint8Array) => T,
  label: string,
): { decoded?: T; message: string; status: ProtocolStateReadStatus } {
  if (!data) {
    return {
      message: `${label} account not found on the selected cluster.`,
      status: "MISSING",
    };
  }

  try {
    return {
      decoded: decoder(data),
      message: `${label} account decoded from selected cluster.`,
      status: "DECODED",
    };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : `${label} account decode failed.`,
      status: "DECODE_ERROR",
    };
  }
}

function stakeTierFromVariant(variant: number): StakeTierName {
  if (variant === 0) return "NONE";
  if (variant === 1) return "SEED";
  if (variant === 2) return "SPROUT";
  if (variant === 3) return "SAPLING";
  if (variant === 4) return "TREE";
  if (variant === 5) return "FRUIT";
  return "UNKNOWN";
}

function governanceCategoryFromVariant(variant: number): GovernanceProposalCategory {
  if (variant === 0) return "PROJECT_APPROVAL";
  if (variant === 1) return "TREASURY_ALLOCATION";
  if (variant === 2) return "PROTOCOL_UPGRADE";
  if (variant === 3) return "DONATION_CAUSE";
  if (variant === 4) return "SEEDBOT_FEATURE";
  if (variant === 5) return "RISK_POLICY";
  return "UNKNOWN";
}

function governanceStatusFromVariant(variant: number): GovernanceProposalStatus {
  if (variant === 0) return "OPEN";
  if (variant === 1) return "APPROVED";
  if (variant === 2) return "REJECTED";
  if (variant === 3) return "CANCELLED";
  return "UNKNOWN";
}

function projectRiskLevelFromVariant(variant: number): ProjectRiskLevel {
  if (variant === 0) return "LOW";
  if (variant === 1) return "MEDIUM";
  if (variant === 2) return "HIGH";
  if (variant === 3) return "EXPERIMENTAL";
  if (variant === 4) return "DONATION";
  return "UNKNOWN";
}

function projectStatusFromVariant(variant: number): ProjectLifecycleStatus {
  if (variant === 0) return "PROPOSED";
  if (variant === 1) return "UNDER_REVIEW";
  if (variant === 2) return "GOVERNANCE_VOTE";
  if (variant === 3) return "APPROVED";
  if (variant === 4) return "OPEN";
  if (variant === 5) return "ACTIVE";
  if (variant === 6) return "MILESTONE_REACHED";
  if (variant === 7) return "HARVEST_AVAILABLE";
  if (variant === 8) return "COMPLETED";
  if (variant === 9) return "PAUSED";
  if (variant === 10) return "REJECTED";
  if (variant === 11) return "CANCELLED";
  return "UNKNOWN";
}

function projectFundingModelFromVariant(variant: number): ProjectFundingModel {
  if (variant === 0) return "RECORD_ONLY";
  if (variant === 1) return "DIRECT_SETTLEMENT";
  if (variant === 2) return "PROGRAM_ESCROW";
  return "UNKNOWN";
}

function projectParticipationStatusFromVariant(variant: number): ProjectParticipationStatus {
  if (variant === 0) return "ACTIVE";
  if (variant === 1) return "COMPLETED";
  if (variant === 2) return "CANCELLED";
  return "UNKNOWN";
}

function assertAccountLayout(data: Uint8Array, accountName: ProtocolStateLayoutName) {
  const layout = PROTOCOL_STATE_LAYOUTS[accountName];
  if (data.length < layout.minimumLength) {
    throw new Error(`${accountName} account is too small: expected at least ${layout.minimumLength} bytes.`);
  }

  const actualDiscriminator = bytesToHex(data.subarray(0, 8));
  if (actualDiscriminator !== layout.discriminatorHex) {
    throw new Error(`${accountName} discriminator mismatch: expected ${layout.discriminatorHex}.`);
  }
}

function isBlankHash(hash: string) {
  return /^0+$/.test(hash);
}

function uniqueMessages(messages: string[]) {
  return [...new Set(messages)];
}

function readPubkey(data: Uint8Array, offset: number) {
  return new PublicKey(data.subarray(offset, offset + 32)).toBase58();
}

function readU32(data: Uint8Array, offset: number) {
  return dataView(data).getUint32(offset, true);
}

function readU64(data: Uint8Array, offset: number) {
  return dataView(data).getBigUint64(offset, true);
}

function readI64(data: Uint8Array, offset: number) {
  return dataView(data).getBigInt64(offset, true);
}

function readBool(data: Uint8Array, offset: number) {
  return data[offset] === 1;
}

function toU64(value: bigint | number | string) {
  const parsed = typeof value === "bigint" ? value : BigInt(value.toString().trim());
  if (parsed < 0n || parsed > 2n ** 64n - 1n) {
    throw new Error("Inspection id exceeds Solana u64 bounds.");
  }
  return parsed;
}

function u64LeBytes(value: bigint) {
  const bytes = new Uint8Array(8);
  dataView(bytes).setBigUint64(0, value, true);
  return bytes;
}

function dataView(data: Uint8Array) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function textSeed(seed: string) {
  return new TextEncoder().encode(seed);
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
