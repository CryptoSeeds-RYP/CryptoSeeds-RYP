import { describe, expect, it } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PLACEHOLDER_PROTOCOL_PROGRAM_ID } from "../config/env";
import {
  buildGovernanceStateInspectionPreview,
  buildProjectStateInspectionPreview,
  buildStakePositionInspectionPreview,
  decodeGovernanceProposalAccount,
  decodeGovernanceVoteRecordAccount,
  decodeProjectParticipationRecordAccount,
  decodeProjectRecordAccount,
  decodeStakePositionAccount,
  deriveGovernanceInspectionAddresses,
  deriveProjectInspectionAddresses,
  deriveStakePositionInspectionAddress,
  PROTOCOL_STATE_LAYOUTS,
  validateGovernanceStateInspection,
  validateProjectStateInspection,
  validateStakePositionInspection,
  type GovernanceStateInspection,
  type ProjectStateInspection,
  type StakePositionInspection,
} from "./protocolStateInspection";

describe("protocol state inspection", () => {
  it("derives read-only stake, governance, and project addresses", () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const stake = deriveStakePositionInspectionAddress({
      ownerAddress: wallet,
      programIdAddress: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
    });
    const governance = deriveGovernanceInspectionAddresses({
      proposalId: 3n,
      walletAddress: wallet,
      programIdAddress: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
    });
    const project = deriveProjectInspectionAddresses({
      projectId: 9n,
      walletAddress: wallet,
      programIdAddress: PLACEHOLDER_PROTOCOL_PROGRAM_ID,
    });

    expect(stake.positionAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(governance.proposalId).toBe("3");
    expect(governance.voteRecordAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(project.projectId).toBe("9");
    expect(project.participationAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
  });

  it("builds preview-only state inspections without executable actions", () => {
    const wallet = Keypair.generate().publicKey.toBase58();

    expect(buildStakePositionInspectionPreview({ ownerAddress: wallet }).executionMode).toBe("READ_ONLY");
    expect(buildGovernanceStateInspectionPreview({ proposalId: 1n, walletAddress: wallet }).proposalStatus).toBe(
      "PREVIEW_ONLY",
    );
    expect(buildProjectStateInspectionPreview({ projectId: 1n, walletAddress: wallet }).projectStatus).toBe(
      "PREVIEW_ONLY",
    );
  });

  it("decodes StakePosition account bytes", () => {
    const owner = Keypair.generate().publicKey;
    const data = new Uint8Array(PROTOCOL_STATE_LAYOUTS.StakePosition.minimumLength);
    const offset = offsets("StakePosition");

    writeDiscriminator(data, "StakePosition");
    writePubkey(data, offset.owner, owner);
    view(data).setBigUint64(offset.staked_amount, 5_000_000_000n, true);
    data[offset.tier] = 1;
    view(data).setBigInt64(offset.staking_start_ts, 1_800_000_000n, true);
    view(data).setBigInt64(offset.voting_rights_eligible_ts, 1_801_209_600n, true);
    view(data).setBigInt64(offset.last_reward_claim_ts, 0n, true);
    data[offset.golden_key_active] = 1;
    data[offset.voting_rights_active] = 1;
    view(data).setUint32(offset.vote_count, 12, true);
    data[offset.bump] = 255;
    view(data).setBigInt64(offset.golden_key_issued_at, 1_800_000_000n, true);
    view(data).setBigInt64(offset.golden_key_revoked_at, 0n, true);
    view(data).setBigInt64(offset.voting_rights_activated_at, 1_801_209_600n, true);
    data[offset.voting_rights_level] = 2;

    expect(decodeStakePositionAccount(data)).toEqual({
      owner: owner.toBase58(),
      stakedAmount: "5000000000",
      tier: "SEED",
      stakingStartTs: "1800000000",
      votingRightsEligibleTs: "1801209600",
      lastRewardClaimTs: "0",
      goldenKeyActive: true,
      votingRightsActive: true,
      voteCount: 12,
      bump: 255,
      goldenKeyIssuedAt: "1800000000",
      goldenKeyRevokedAt: "0",
      votingRightsActivatedAt: "1801209600",
      votingRightsLevel: 2,
    });
  });

  it("decodes governance proposal and vote record bytes", () => {
    const wallet = Keypair.generate().publicKey;
    const authority = Keypair.generate().publicKey;
    const addresses = deriveGovernanceInspectionAddresses({ proposalId: 3n, walletAddress: wallet.toBase58() });
    const proposalData = new Uint8Array(PROTOCOL_STATE_LAYOUTS.GovernanceProposal.minimumLength);
    const proposalOffset = offsets("GovernanceProposal");
    const voteData = new Uint8Array(PROTOCOL_STATE_LAYOUTS.GovernanceVoteRecord.minimumLength);
    const voteOffset = offsets("GovernanceVoteRecord");

    writeDiscriminator(proposalData, "GovernanceProposal");
    view(proposalData).setBigUint64(proposalOffset.proposal_id, 3n, true);
    writePubkey(proposalData, proposalOffset.authority, authority);
    proposalData[proposalOffset.category] = 0;
    proposalData[proposalOffset.status] = 0;
    proposalData.fill(7, proposalOffset.metadata_hash, proposalOffset.metadata_hash + 32);
    view(proposalData).setBigUint64(proposalOffset.yes_votes, 4n, true);
    view(proposalData).setBigUint64(proposalOffset.no_votes, 1n, true);
    view(proposalData).setBigInt64(proposalOffset.created_at, 1_800_000_000n, true);
    view(proposalData).setBigInt64(proposalOffset.voting_starts_at, 1_800_000_000n, true);
    view(proposalData).setBigInt64(proposalOffset.voting_ends_at, 1_800_086_400n, true);
    view(proposalData).setBigUint64(proposalOffset.minimum_votes, 3n, true);
    view(proposalData).setBigInt64(proposalOffset.closed_at, 0n, true);
    proposalData[proposalOffset.bump] = 254;

    writeDiscriminator(voteData, "GovernanceVoteRecord");
    writePubkey(voteData, voteOffset.proposal, new PublicKey(addresses.proposalAddress));
    writePubkey(voteData, voteOffset.wallet, wallet);
    voteData[voteOffset.approve] = 1;
    view(voteData).setBigInt64(voteOffset.voted_at, 1_800_000_111n, true);
    voteData[voteOffset.bump] = 253;

    expect(decodeGovernanceProposalAccount(proposalData)).toMatchObject({
      proposalId: "3",
      authority: authority.toBase58(),
      category: "PROJECT_APPROVAL",
      status: "OPEN",
      metadataHash: "07".repeat(32),
      yesVotes: "4",
      noVotes: "1",
      minimumVotes: "3",
      bump: 254,
    });
    expect(decodeGovernanceVoteRecordAccount(voteData)).toEqual({
      proposal: addresses.proposalAddress,
      wallet: wallet.toBase58(),
      approve: true,
      votedAt: "1800000111",
      bump: 253,
    });
  });

  it("decodes project and participation account bytes", () => {
    const wallet = Keypair.generate().publicKey;
    const authority = Keypair.generate().publicKey;
    const receivingAccount = Keypair.generate().publicKey;
    const governanceProposal = Keypair.generate().publicKey;
    const addresses = deriveProjectInspectionAddresses({ projectId: 9n, walletAddress: wallet.toBase58() });
    const projectData = new Uint8Array(PROTOCOL_STATE_LAYOUTS.ProjectRecord.minimumLength);
    const projectOffset = offsets("ProjectRecord");
    const participationData = new Uint8Array(PROTOCOL_STATE_LAYOUTS.ProjectParticipationRecord.minimumLength);
    const participationOffset = offsets("ProjectParticipationRecord");

    writeDiscriminator(projectData, "ProjectRecord");
    view(projectData).setBigUint64(projectOffset.project_id, 9n, true);
    writePubkey(projectData, projectOffset.authority, authority);
    projectData[projectOffset.required_tier] = 1;
    projectData[projectOffset.risk_level] = 2;
    projectData[projectOffset.status] = 4;
    projectData[projectOffset.funding_model] = 0;
    projectData.fill(8, projectOffset.metadata_hash, projectOffset.metadata_hash + 32);
    writePubkey(projectData, projectOffset.receiving_account, receivingAccount);
    writePubkey(projectData, projectOffset.governance_proposal, governanceProposal);
    view(projectData).setBigUint64(projectOffset.total_participants, 2n, true);
    view(projectData).setBigUint64(projectOffset.min_participation_amount, 100n, true);
    view(projectData).setBigUint64(projectOffset.max_wallet_participation_amount, 1_000n, true);
    view(projectData).setBigUint64(projectOffset.max_total_participation_amount, 5_000n, true);
    view(projectData).setBigUint64(projectOffset.total_participation_amount, 1_500n, true);
    view(projectData).setBigInt64(projectOffset.participation_starts_at, 1_800_000_000n, true);
    view(projectData).setBigInt64(projectOffset.participation_ends_at, 1_800_086_400n, true);
    projectData.fill(0, projectOffset.cancellation_hash, projectOffset.cancellation_hash + 32);
    view(projectData).setBigInt64(projectOffset.cancelled_at, 0n, true);
    view(projectData).setBigUint64(projectOffset.refund_pool_amount, 0n, true);
    view(projectData).setBigUint64(projectOffset.total_refunded_amount, 0n, true);
    projectData[projectOffset.participation_paused] = 0;
    view(projectData).setBigUint64(projectOffset.current_disclosure_revision_id, 1n, true);
    projectData.fill(9, projectOffset.current_disclosure_hash, projectOffset.current_disclosure_hash + 32);
    projectData[projectOffset.bump] = 252;

    writeDiscriminator(participationData, "ProjectParticipationRecord");
    writePubkey(participationData, participationOffset.project, new PublicKey(addresses.projectAddress));
    writePubkey(participationData, participationOffset.wallet, wallet);
    view(participationData).setBigUint64(participationOffset.participation_amount, 500n, true);
    participationData.fill(6, participationOffset.disclosure_hash, participationOffset.disclosure_hash + 32);
    view(participationData).setBigInt64(participationOffset.joined_at, 1_800_000_123n, true);
    participationData[participationOffset.status] = 0;
    participationData[participationOffset.bump] = 251;

    expect(decodeProjectRecordAccount(projectData)).toMatchObject({
      projectId: "9",
      authority: authority.toBase58(),
      requiredTier: "SEED",
      riskLevel: "HIGH",
      status: "OPEN",
      fundingModel: "RECORD_ONLY",
      metadataHash: "08".repeat(32),
      receivingAccount: receivingAccount.toBase58(),
      governanceProposal: governanceProposal.toBase58(),
      totalParticipationAmount: "1500",
      currentDisclosureHash: "09".repeat(32),
      bump: 252,
    });
    expect(decodeProjectParticipationRecordAccount(participationData)).toEqual({
      project: addresses.projectAddress,
      wallet: wallet.toBase58(),
      participationAmount: "500",
      disclosureHash: "06".repeat(32),
      joinedAt: "1800000123",
      status: "ACTIVE",
      bump: 251,
    });
  });

  it("rejects state accounts with the wrong Anchor discriminator", () => {
    const data = new Uint8Array(PROTOCOL_STATE_LAYOUTS.StakePosition.minimumLength);

    expect(() => decodeStakePositionAccount(data)).toThrow("StakePosition discriminator mismatch");
  });

  it("validates decoded state inspections", () => {
    expect(validateStakePositionInspection(buildDecodedStakeInspection()).blockers).toEqual([]);
    expect(validateGovernanceStateInspection(buildDecodedGovernanceInspection()).blockers).toEqual([]);
    expect(validateProjectStateInspection(buildDecodedProjectInspection()).blockers).toEqual([]);
  });

  it("blocks unsafe decoded state inspections", () => {
    const stakeBlockers = validateStakePositionInspection(
      buildDecodedStakeInspection({
        decoded: {
          goldenKeyActive: true,
          goldenKeyIssuedAt: "0",
          owner: Keypair.generate().publicKey.toBase58(),
          stakedAmount: "0",
          tier: "SEED",
        },
      }),
    ).blockers.join(" ");
    const governanceBlockers = validateGovernanceStateInspection(
      buildDecodedGovernanceInspection({
        proposal: {
          metadataHash: "00".repeat(32),
          proposalId: "4",
          votingEndsAt: "100",
          votingStartsAt: "100",
        },
        voteRecord: {
          proposal: Keypair.generate().publicKey.toBase58(),
          votedAt: "0",
        },
      }),
    ).blockers.join(" ");
    const projectBlockers = validateProjectStateInspection(
      buildDecodedProjectInspection({
        participation: {
          disclosureHash: "00".repeat(32),
          participationAmount: "0",
          project: Keypair.generate().publicKey.toBase58(),
        },
        project: {
          currentDisclosureHash: "00".repeat(32),
          fundingModel: "DIRECT_SETTLEMENT",
          maxTotalParticipationAmount: "100",
          maxWalletParticipationAmount: "200",
          metadataHash: "00".repeat(32),
          totalParticipationAmount: "101",
        },
      }),
    ).blockers.join(" ");

    expect(stakeBlockers).toContain("owner does not match");
    expect(stakeBlockers).toContain("tier but no staked amount");
    expect(stakeBlockers).toContain("Golden Key");
    expect(governanceBlockers).toContain("proposal id");
    expect(governanceBlockers).toContain("metadata hash");
    expect(governanceBlockers).toContain("voting window");
    expect(governanceBlockers).toContain("different proposal");
    expect(projectBlockers).toContain("RECORD_ONLY");
    expect(projectBlockers).toContain("metadata hash");
    expect(projectBlockers).toContain("disclosure hash");
    expect(projectBlockers).toContain("max wallet");
    expect(projectBlockers).toContain("total participation");
  });
});

function buildDecodedStakeInspection(
  overrides: {
    decoded?: Partial<NonNullable<StakePositionInspection["decoded"]>>;
  } = {},
): StakePositionInspection {
  const owner = Keypair.generate().publicKey.toBase58();
  const preview = buildStakePositionInspectionPreview({ ownerAddress: owner });

  return {
    ...preview,
    decoded: {
      owner,
      stakedAmount: "5000000000",
      tier: "SEED",
      stakingStartTs: "1800000000",
      votingRightsEligibleTs: "1801209600",
      lastRewardClaimTs: "0",
      goldenKeyActive: true,
      votingRightsActive: true,
      voteCount: 1,
      bump: 255,
      goldenKeyIssuedAt: "1800000000",
      goldenKeyRevokedAt: "0",
      votingRightsActivatedAt: "1801209600",
      votingRightsLevel: 1,
      ...overrides.decoded,
    },
    message: "Stake position account decoded from selected cluster.",
    status: "DECODED",
  };
}

function buildDecodedGovernanceInspection(
  overrides: {
    proposal?: Partial<NonNullable<GovernanceStateInspection["proposal"]>>;
    voteRecord?: Partial<NonNullable<GovernanceStateInspection["voteRecord"]>>;
  } = {},
): GovernanceStateInspection {
  const wallet = Keypair.generate().publicKey.toBase58();
  const preview = buildGovernanceStateInspectionPreview({ proposalId: 3n, walletAddress: wallet });

  return {
    ...preview,
    proposal: {
      proposalId: "3",
      authority: Keypair.generate().publicKey.toBase58(),
      category: "PROJECT_APPROVAL",
      status: "OPEN",
      metadataHash: "07".repeat(32),
      yesVotes: "4",
      noVotes: "1",
      createdAt: "1800000000",
      votingStartsAt: "1800000000",
      votingEndsAt: "1800086400",
      minimumVotes: "3",
      closedAt: "0",
      bump: 254,
      ...overrides.proposal,
    },
    proposalMessage: "Governance proposal account decoded from selected cluster.",
    proposalStatus: "DECODED",
    voteRecord: {
      proposal: preview.proposalAddress,
      wallet,
      approve: true,
      votedAt: "1800000111",
      bump: 253,
      ...overrides.voteRecord,
    },
    voteRecordMessage: "Governance vote record account decoded from selected cluster.",
    voteRecordStatus: "DECODED",
  };
}

function buildDecodedProjectInspection(
  overrides: {
    participation?: Partial<NonNullable<ProjectStateInspection["participation"]>>;
    project?: Partial<NonNullable<ProjectStateInspection["project"]>>;
  } = {},
): ProjectStateInspection {
  const wallet = Keypair.generate().publicKey.toBase58();
  const preview = buildProjectStateInspectionPreview({ projectId: 9n, walletAddress: wallet });

  return {
    ...preview,
    participation: {
      project: preview.projectAddress,
      wallet,
      participationAmount: "500",
      disclosureHash: "06".repeat(32),
      joinedAt: "1800000123",
      status: "ACTIVE",
      bump: 251,
      ...overrides.participation,
    },
    participationMessage: "Project participation account decoded from selected cluster.",
    participationStatus: "DECODED",
    project: {
      projectId: "9",
      authority: Keypair.generate().publicKey.toBase58(),
      requiredTier: "SEED",
      riskLevel: "HIGH",
      status: "OPEN",
      fundingModel: "RECORD_ONLY",
      metadataHash: "08".repeat(32),
      receivingAccount: Keypair.generate().publicKey.toBase58(),
      governanceProposal: Keypair.generate().publicKey.toBase58(),
      totalParticipants: "2",
      minParticipationAmount: "100",
      maxWalletParticipationAmount: "1000",
      maxTotalParticipationAmount: "5000",
      totalParticipationAmount: "1500",
      participationStartsAt: "1800000000",
      participationEndsAt: "1800086400",
      cancellationHash: "00".repeat(32),
      cancelledAt: "0",
      refundPoolAmount: "0",
      totalRefundedAmount: "0",
      participationPaused: false,
      currentDisclosureRevisionId: "1",
      currentDisclosureHash: "09".repeat(32),
      bump: 252,
      ...overrides.project,
    },
    projectMessage: "Project record account decoded from selected cluster.",
    projectStatus: "DECODED",
  };
}

function offsets(accountName: keyof typeof PROTOCOL_STATE_LAYOUTS) {
  return Object.fromEntries(
    PROTOCOL_STATE_LAYOUTS[accountName].fields.map((field) => [field.name, field.offset]),
  ) as Record<string, number>;
}

function writeDiscriminator(data: Uint8Array, accountName: keyof typeof PROTOCOL_STATE_LAYOUTS) {
  const bytes = PROTOCOL_STATE_LAYOUTS[accountName].discriminatorHex.match(/.{1,2}/g) ?? [];
  data.set(bytes.map((byte) => Number.parseInt(byte, 16)), 0);
}

function writePubkey(data: Uint8Array, offset: number, publicKey: PublicKey) {
  data.set(publicKey.toBytes(), offset);
}

function view(data: Uint8Array) {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}
