import { describe, expect, it } from "vitest";
import {
  buildActivateVotingRightsTransactionPlan,
  buildAcceptProjectAuthorityTransactionPlan,
  buildCancelProjectTransactionPlan,
  buildCastGovernanceVoteTransactionPlan,
  buildClaimRewardRecordTransactionPlan,
  buildClaimRewardTokensTransactionPlan,
  buildCloseGovernanceProposalTransactionPlan,
  buildCreateGovernanceProposalTransactionPlan,
  buildCreateProjectDisclosureRevisionTransactionPlan,
  buildCreateRewardClaimRecordFromProofTransactionPlan,
  buildCreateRewardClaimRecordTransactionPlan,
  buildCreateSeedBotPermissionTransactionPlan,
  buildExpireRewardEpochClaimsTransactionPlan,
  buildGrantProjectOperatorTransactionPlan,
  buildOperatorSetProjectPauseTransactionPlan,
  buildOperatorUpdateProjectStatusTransactionPlan,
  buildProjectParticipationTransactionPlan,
  buildRegisterProjectTransactionPlan,
  buildRecordProjectRefundTransactionPlan,
  buildRevokeProjectOperatorTransactionPlan,
  buildRecordSeedBotUsageTransactionPlan,
  buildRevokeSeedBotPermissionTransactionPlan,
  buildRoutePlatformFeeTransactionPlan,
  buildSetProjectPauseTransactionPlan,
  buildStakeRypTransactionPlan,
  buildTransferProjectAuthorityTransactionPlan,
  buildUnstakeRypTransactionPlan,
  buildUpdateFeeConfigTransactionPlan,
  buildUpdateProjectStatusTransactionPlan,
  buildUpdateSeedBotPermissionTransactionPlan,
  deriveProtocolAddresses,
  deriveProjectDisclosureRevisionAddress,
  deriveProjectOperatorAddress,
  deriveRewardClaimRecordAddress,
  parseRypAmountToBaseUnits,
  PROJECT_OPERATOR_PERMISSION_PAUSE,
  PROJECT_OPERATOR_PERMISSION_STATUS,
  PROTOCOL_INSTRUCTION_SPECS,
} from "./protocolTransactionPlan";
import { appConfig } from "../config/env";

const ownerAddress = "11111111111111111111111111111111";

describe("protocol transaction plan", () => {
  it("derives stable staking account addresses for a wallet", () => {
    const addresses = deriveProtocolAddresses(ownerAddress);

    expect(addresses.owner).toBe(ownerAddress);
    expect(addresses.programId).toBe(appConfig.protocolProgramId);
    expect(addresses.rypMint).toBe(appConfig.rypMintAddress);
    expect(addresses.config).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(addresses.position).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(addresses.ownerRypAccount).not.toBe(addresses.rypVault);
  });

  it("converts RYP UI amounts to base units", () => {
    expect(parseRypAmountToBaseUnits("5,000", 6)).toBe("5000000000");
    expect(parseRypAmountToBaseUnits("1.25", 6)).toBe("1250000");
    expect(() => parseRypAmountToBaseUnits("0", 6)).toThrow("greater than zero");
    expect(() => parseRypAmountToBaseUnits("1", Number.NaN)).toThrow("decimals");
    expect(() => parseRypAmountToBaseUnits("1", 19)).toThrow("decimals");
    expect(() => parseRypAmountToBaseUnits("1.1234567", 6)).toThrow("more than 6 decimal");
    expect(() => parseRypAmountToBaseUnits("18446744073709.551615", 6)).not.toThrow();
    expect(() => parseRypAmountToBaseUnits("18446744073709.551616", 6)).toThrow("u64");
  });

  it("builds an Anchor-compatible stake instruction plan", () => {
    const plan = buildStakeRypTransactionPlan({ ownerAddress, tier: "SEED" });
    const instruction = plan.instructions[0];

    expect(plan.action).toBe("STAKE_RYP");
    expect(plan.amountBaseUnits).toBe("5000000000");
    expect(instruction.instructionName).toBe("stake_ryp");
    expect(instruction.discriminatorHex).toBe("b746a41746842ce8");
    expect(instruction.dataHex).toBe("b746a41746842ce800f2052a01000000");
    expect(instruction.accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.stake_ryp.accounts.map((account) => account.name),
    );
    expect(instruction.accounts.map((account) => account.label)).toEqual([
      "Owner",
      "Protocol config",
      "RYP mint",
      "Owner RYP account",
      "RYP vault",
      "Stake position",
      "Token program",
      "Associated token program",
      "System program",
    ]);
  });

  it("builds unstake and voting-rights plans without hidden broadcast assumptions", () => {
    const unstake = buildUnstakeRypTransactionPlan({ ownerAddress, amountUi: "1250.5" });
    const voting = buildActivateVotingRightsTransactionPlan({ ownerAddress });

    expect(unstake.action).toBe("UNSTAKE_RYP");
    expect(unstake.amountBaseUnits).toBe("1250500000");
    expect(unstake.instructions[0].discriminatorHex).toBe("ae0b5ccc93d66cdd");
    expect(voting.action).toBe("ACTIVATE_VOTING_RIGHTS");
    expect(voting.instructions[0].dataHex).toBe("463cc3194dbcfb73");
    expect(voting.warnings.join(" ")).toContain("14-day staking delay");
  });

  it("derives role-keyed reward claim records", () => {
    const holderClaim = deriveRewardClaimRecordAddress({
      epochId: 3n,
      rewardRole: "HOLDER_REWARD",
      walletAddress: ownerAddress,
    });
    const stakerClaim = deriveRewardClaimRecordAddress({
      epochId: 3n,
      rewardRole: "STAKER_REWARD",
      walletAddress: ownerAddress,
    });

    expect(holderClaim).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(stakerClaim).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    expect(holderClaim).not.toBe(stakerClaim);
  });

  it("builds reward claim record and token claim plans", () => {
    const rewardSourceVault = "So11111111111111111111111111111111111111112";
    const createRecord = buildCreateRewardClaimRecordTransactionPlan({
      authorityAddress: ownerAddress,
      deliveryCostAmountBaseUnits: 0n,
      epochId: 3n,
      grossAllocationAmountBaseUnits: 700n,
      netClaimAmountBaseUnits: 700n,
      rewardRole: "HOLDER_REWARD",
      rolledForwardAmountBaseUnits: 0n,
      walletAddress: ownerAddress,
    });
    const tokenClaim = buildClaimRewardTokensTransactionPlan({
      epochId: 3n,
      ownerAddress,
      rewardRole: "HOLDER_REWARD",
      rewardSourceVaultAddress: rewardSourceVault,
    });
    const rolloverClaim = buildClaimRewardRecordTransactionPlan({
      epochId: 3n,
      ownerAddress,
      rewardRole: "STAKER_REWARD",
    });
    const expireEpoch = buildExpireRewardEpochClaimsTransactionPlan({
      authorityAddress: ownerAddress,
      epochId: 3n,
    });

    expect(createRecord.action).toBe("CREATE_REWARD_CLAIM_RECORD");
    expect(createRecord.instructions[0].instructionName).toBe("create_reward_claim_record");
    expect(createRecord.instructions[0].dataHex).toContain("957279d551758059030000000000000000");
    expect(createRecord.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.create_reward_claim_record.accounts.map((account) => account.name),
    );
    expect(tokenClaim.action).toBe("CLAIM_REWARD");
    expect(tokenClaim.instructions[0].dataHex).toBe("254378326c1751c9030000000000000000");
    expect(tokenClaim.instructions[0].accounts.find((account) => account.anchorName === "reward_source_vault")?.address).toBe(
      rewardSourceVault,
    );
    expect(rolloverClaim.instructions[0].dataHex).toBe("bad5cb11c7fba2e101");
    expect(expireEpoch.action).toBe("EXPIRE_REWARD_EPOCH_CLAIMS");
    expect(expireEpoch.instructions[0].dataHex).toBe("b450565ce6f8ad7e0300000000000000");
    expect(expireEpoch.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.expire_reward_epoch_claims.accounts.map((account) => account.name),
    );
  });

  it("builds wallet proof-backed reward claim record plans", () => {
    const plan = buildCreateRewardClaimRecordFromProofTransactionPlan({
      deliveryCostAmountBaseUnits: 0n,
      epochId: 3n,
      grossAllocationAmountBaseUnits: 200n,
      leafIndex: 1n,
      netClaimAmountBaseUnits: 0n,
      ownerAddress,
      proof: ["ab".repeat(32)],
      rewardRole: "STAKER_REWARD",
      rolledForwardAmountBaseUnits: 200n,
    });

    expect(plan.action).toBe("CREATE_REWARD_CLAIM_RECORD_FROM_PROOF");
    expect(plan.feePayer).toBe(ownerAddress);
    expect(plan.instructions[0].instructionName).toBe("create_reward_claim_record_from_proof");
    expect(plan.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.create_reward_claim_record_from_proof.accounts.map((account) => account.name),
    );
    expect(plan.instructions[0].dataHex).toBe(
      `3260ecd7ed5d2463030000000000000001c80000000000000000000000000000000000000000000000c800000000000000010000000000000001000000${"ab".repeat(32)}`,
    );
    expect(() =>
      buildCreateRewardClaimRecordFromProofTransactionPlan({
        deliveryCostAmountBaseUnits: 0n,
        epochId: 3n,
        grossAllocationAmountBaseUnits: 200n,
        leafIndex: 0n,
        netClaimAmountBaseUnits: 0n,
        ownerAddress,
        proof: Array.from({ length: 33 }, () => "ab".repeat(32)),
        rewardRole: "STAKER_REWARD",
        rolledForwardAmountBaseUnits: 200n,
      }),
    ).toThrow("cannot exceed 32 nodes");
  });

  it("builds platform fee route plans into reviewed reward vaults", () => {
    const holderRewardVault = "So11111111111111111111111111111111111111112";
    const stakerRewardVault = "11111111111111111111111111111111";
    const treasuryVault = "SysvarC1ock11111111111111111111111111111111";
    const plan = buildRoutePlatformFeeTransactionPlan({
      feeAmountBaseUnits: 30_000n,
      holderRewardVaultAddress: holderRewardVault,
      payerAddress: ownerAddress,
      stakerRewardVaultAddress: stakerRewardVault,
      treasuryVaultAddress: treasuryVault,
    });

    expect(plan.action).toBe("ROUTE_PLATFORM_FEE");
    expect(plan.amountBaseUnits).toBe("30000");
    expect(plan.feePayer).toBe(ownerAddress);
    expect(plan.instructions[0].dataHex).toBe("a9cd82f56dd705813075000000000000");
    expect(plan.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.route_platform_fee.accounts.map((account) => account.name),
    );
    expect(plan.instructions[0].accounts.find((account) => account.anchorName === "holder_reward_vault")?.address).toBe(
      holderRewardVault,
    );
    expect(plan.instructions[0].accounts.find((account) => account.anchorName === "staker_reward_vault")?.address).toBe(
      stakerRewardVault,
    );
    expect(plan.instructions[0].accounts.find((account) => account.anchorName === "independent_treasury_vault")?.address).toBe(
      treasuryVault,
    );
    expect(plan.warnings.join(" ")).toContain("does not enforce a global wallet-to-wallet transfer tax");
  });

  it("builds governance vote and project participation plans", () => {
    const vote = buildCastGovernanceVoteTransactionPlan({ approve: true, ownerAddress, proposalId: 11n });
    const participation = buildProjectParticipationTransactionPlan({
      disclosureHash: "ab".repeat(32),
      disclosureRevisionId: 1n,
      ownerAddress,
      participationAmountBaseUnits: 1_000n,
      projectId: 9n,
    });

    expect(vote.action).toBe("VOTE_PROPOSAL");
    expect(vote.instructions[0].dataHex).toBe("9d64dbf71b2dbc290b0000000000000001");
    expect(vote.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.cast_governance_vote.accounts.map((account) => account.name),
    );
    expect(participation.action).toBe("PARTICIPATE_PROJECT");
    expect(participation.amountBaseUnits).toBe("1000");
    expect(participation.instructions[0].dataHex).toBe(
      `b8bfbc29229bc6240900000000000000e803000000000000${"ab".repeat(32)}`,
    );
  });

  it("builds governance proposal admin lifecycle plans", () => {
    const createProposal = buildCreateGovernanceProposalTransactionPlan({
      authorityAddress: ownerAddress,
      category: "PROJECT_APPROVAL",
      metadataHash: "cd".repeat(32),
      minimumVotes: 3n,
      proposalId: 42n,
      votingWindowSeconds: 604_800n,
    });
    const closeProposal = buildCloseGovernanceProposalTransactionPlan({
      approved: false,
      authorityAddress: ownerAddress,
      proposalId: 42n,
    });

    expect(createProposal.action).toBe("CREATE_GOVERNANCE_PROPOSAL");
    expect(createProposal.feePayer).toBe(ownerAddress);
    expect(createProposal.instructions[0].dataHex).toBe(
      `665a7285933f71a82a0000000000000000${"cd".repeat(32)}803a0900000000000300000000000000`,
    );
    expect(createProposal.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.create_governance_proposal.accounts.map((account) => account.name),
    );
    expect(closeProposal.action).toBe("CLOSE_GOVERNANCE_PROPOSAL");
    expect(closeProposal.instructions[0].dataHex).toBe("b91c8c08c270de112a0000000000000000");
  });

  it("builds project registry admin lifecycle plans", () => {
    const receivingAccount = "So11111111111111111111111111111111111111112";
    const governanceProposalAddress = "11111111111111111111111111111111";
    const newProjectAuthorityAddress = "So11111111111111111111111111111111111111112";
    const operatorAddress = "SysvarC1ock11111111111111111111111111111111";
    const transferProjectAuthority = buildTransferProjectAuthorityTransactionPlan({
      authorityAddress: ownerAddress,
      newAuthorityAddress: newProjectAuthorityAddress,
    });
    const acceptProjectAuthority = buildAcceptProjectAuthorityTransactionPlan({
      pendingAuthorityAddress: newProjectAuthorityAddress,
    });
    const registerProject = buildRegisterProjectTransactionPlan({
      authorityAddress: ownerAddress,
      governanceProposalAddress,
      maxWalletParticipationAmountBaseUnits: 600n,
      maxTotalParticipationAmountBaseUnits: 1_000n,
      metadataHash: "ef".repeat(32),
      minParticipationAmountBaseUnits: 100n,
      participationEndsAtUnix: 1_700_604_800n,
      participationStartsAtUnix: 1_700_000_000n,
      projectId: 9n,
      receivingAccountAddress: receivingAccount,
      requiredTier: "SPROUT",
      riskLevel: "MEDIUM",
      status: "OPEN",
    });
    const disclosureRevisionAddress = deriveProjectDisclosureRevisionAddress({ projectId: 9n, revisionId: 1n });
    const createDisclosureRevision = buildCreateProjectDisclosureRevisionTransactionPlan({
      authorityAddress: ownerAddress,
      metadataHash: "11".repeat(32),
      projectId: 9n,
      revisionId: 1n,
      riskDisclosureHash: "22".repeat(32),
      termsHash: "33".repeat(32),
    });
    const updateStatus = buildUpdateProjectStatusTransactionPlan({
      authorityAddress: ownerAddress,
      governanceProposalAddress,
      projectId: 9n,
      status: "HARVEST_AVAILABLE",
    });
    const pauseProject = buildSetProjectPauseTransactionPlan({
      authorityAddress: ownerAddress,
      paused: true,
      projectId: 9n,
    });
    const operatorPermissions = PROJECT_OPERATOR_PERMISSION_STATUS | PROJECT_OPERATOR_PERMISSION_PAUSE;
    const operatorExpiresAtUnix = 1_800_000_000n;
    const operatorRecord = deriveProjectOperatorAddress({ operatorAddress, projectId: 9n });
    const grantOperator = buildGrantProjectOperatorTransactionPlan({
      authorityAddress: ownerAddress,
      expiresAtUnix: operatorExpiresAtUnix,
      operatorAddress,
      permissions: operatorPermissions,
      projectId: 9n,
    });
    const operatorUpdateStatus = buildOperatorUpdateProjectStatusTransactionPlan({
      governanceProposalAddress,
      operatorAddress,
      projectId: 9n,
      status: "PAUSED",
    });
    const operatorPauseProject = buildOperatorSetProjectPauseTransactionPlan({
      operatorAddress,
      paused: true,
      projectId: 9n,
    });
    const revokeOperator = buildRevokeProjectOperatorTransactionPlan({
      authorityAddress: ownerAddress,
      operatorAddress,
      projectId: 9n,
    });
    const cancelProject = buildCancelProjectTransactionPlan({
      authorityAddress: ownerAddress,
      cancellationHash: "aa".repeat(32),
      projectId: 9n,
      refundPoolAmountBaseUnits: 800n,
    });
    const recordRefund = buildRecordProjectRefundTransactionPlan({
      authorityAddress: ownerAddress,
      projectId: 9n,
      refundAmountBaseUnits: 300n,
      refundMetadataHash: "bb".repeat(32),
    });

    expect(transferProjectAuthority.action).toBe("TRANSFER_PROJECT_AUTHORITY");
    expect(transferProjectAuthority.instructions[0].dataHex).toMatch(/^1421786cd3d4cff7/);
    expect(transferProjectAuthority.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.transfer_project_authority.accounts.map((account) => account.name),
    );
    expect(acceptProjectAuthority.action).toBe("ACCEPT_PROJECT_AUTHORITY");
    expect(acceptProjectAuthority.instructions[0].dataHex).toBe("202193b59bdce543");
    expect(acceptProjectAuthority.feePayer).toBe(newProjectAuthorityAddress);
    expect(acceptProjectAuthority.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.accept_project_authority.accounts.map((account) => account.name),
    );
    expect(registerProject.action).toBe("REGISTER_PROJECT");
    expect(registerProject.instructions[0].dataHex).toMatch(/^829679d8b7e1f3c00900000000000000020104/);
    expect(registerProject.instructions[0].dataHex).toContain("ef".repeat(32));
    expect(registerProject.instructions[0].dataHex.endsWith("64000000000000005802000000000000e80300000000000000f1536500000000802b5d6500000000")).toBe(
      true,
    );
    expect(registerProject.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.register_project.accounts.map((account) => account.name),
    );
    expect(
      registerProject.instructions[0].accounts.find((account) => account.anchorName === "governance_proposal_account")
        ?.address,
    ).toBe(governanceProposalAddress);
    expect(createDisclosureRevision.action).toBe("CREATE_PROJECT_DISCLOSURE_REVISION");
    expect(createDisclosureRevision.instructions[0].dataHex).toBe(
      `c6e5153371e7495d09000000000000000100000000000000${"11".repeat(32)}${"22".repeat(32)}${"33".repeat(32)}`,
    );
    expect(createDisclosureRevision.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.create_project_disclosure_revision.accounts.map((account) => account.name),
    );
    expect(
      createDisclosureRevision.instructions[0].accounts.find((account) => account.anchorName === "disclosure_revision")
        ?.address,
    ).toBe(disclosureRevisionAddress);
    expect(updateStatus.action).toBe("UPDATE_PROJECT_STATUS");
    expect(updateStatus.instructions[0].dataHex).toBe("322efca04fdd0544090000000000000007");
    expect(updateStatus.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.update_project_status.accounts.map((account) => account.name),
    );
    expect(
      updateStatus.instructions[0].accounts.find((account) => account.anchorName === "governance_proposal_account")
        ?.address,
    ).toBe(governanceProposalAddress);
    expect(pauseProject.action).toBe("SET_PROJECT_PAUSE");
    expect(pauseProject.instructions[0].dataHex).toBe("d385f9aa156f8307090000000000000001");
    expect(pauseProject.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.set_project_pause.accounts.map((account) => account.name),
    );
    expect(grantOperator.action).toBe("GRANT_PROJECT_OPERATOR");
    expect(grantOperator.instructions[0].dataHex).toMatch(/^1dce004acb6699280900000000000000/);
    expect(grantOperator.instructions[0].dataHex.endsWith("030000d2496b00000000")).toBe(true);
    expect(grantOperator.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.grant_project_operator.accounts.map((account) => account.name),
    );
    expect(grantOperator.instructions[0].accounts.find((account) => account.anchorName === "operator_record")?.address).toBe(
      operatorRecord,
    );
    expect(operatorUpdateStatus.action).toBe("OPERATOR_UPDATE_PROJECT_STATUS");
    expect(operatorUpdateStatus.feePayer).toBe(operatorAddress);
    expect(operatorUpdateStatus.instructions[0].dataHex).toBe("f709b629419ed37f090000000000000009");
    expect(operatorUpdateStatus.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.operator_update_project_status.accounts.map((account) => account.name),
    );
    expect(operatorPauseProject.action).toBe("OPERATOR_SET_PROJECT_PAUSE");
    expect(operatorPauseProject.instructions[0].dataHex).toBe("28c2fd03db3d2c1e090000000000000001");
    expect(operatorPauseProject.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.operator_set_project_pause.accounts.map((account) => account.name),
    );
    expect(revokeOperator.action).toBe("REVOKE_PROJECT_OPERATOR");
    expect(revokeOperator.instructions[0].dataHex).toMatch(/^873ef785e1dfcd190900000000000000/);
    expect(revokeOperator.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.revoke_project_operator.accounts.map((account) => account.name),
    );
    expect(() =>
      buildGrantProjectOperatorTransactionPlan({
        authorityAddress: ownerAddress,
        expiresAtUnix: operatorExpiresAtUnix,
        operatorAddress,
        permissions: operatorPermissions | 4,
        projectId: 9n,
      }),
    ).toThrow("Project operator permissions are invalid");
    expect(cancelProject.action).toBe("CANCEL_PROJECT");
    expect(cancelProject.instructions[0].dataHex).toBe(
      `68950388a0030d840900000000000000${"aa".repeat(32)}2003000000000000`,
    );
    expect(cancelProject.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.cancel_project.accounts.map((account) => account.name),
    );
    expect(recordRefund.action).toBe("RECORD_PROJECT_REFUND");
    expect(recordRefund.amountBaseUnits).toBe("300");
    expect(recordRefund.instructions[0].dataHex).toBe(
      `3b36ddd8bef52b1b09000000000000002c01000000000000${"bb".repeat(32)}`,
    );
    expect(recordRefund.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.record_project_refund.accounts.map((account) => account.name),
    );
  });

  it("builds SeedBot permission and fee config plans with bounded args", () => {
    const seedBot = buildCreateSeedBotPermissionTransactionPlan({
      expiresAtUnix: 1_800_000_000n,
      maxDailyVolumeAmountBaseUnits: 1_500n,
      maxDailyTrades: 3,
      maxSlippageBps: 100,
      maxTradeAmountBaseUnits: 500n,
      ownerAddress,
      permissionHash: new Uint8Array(32).fill(7),
    });
    const revoke = buildRevokeSeedBotPermissionTransactionPlan({ ownerAddress });
    const updateSeedBot = buildUpdateSeedBotPermissionTransactionPlan({
      expiresAtUnix: 1_800_000_060n,
      maxDailyVolumeAmountBaseUnits: 2_500n,
      maxDailyTrades: 4,
      maxSlippageBps: 125,
      maxTradeAmountBaseUnits: 600n,
      ownerAddress,
      permissionHash: new Uint8Array(32).fill(8),
    });
    const seedBotUsage = buildRecordSeedBotUsageTransactionPlan({
      executionHash: new Uint8Array(32).fill(9),
      ownerAddress,
      slippageBps: 42,
      tradeAmountBaseUnits: 1_234n,
    });
    const feeConfig = buildUpdateFeeConfigTransactionPlan({
      authorityAddress: ownerAddress,
      baseFeeBps: 300,
      tierFeeReductionBps: [0, 30, 60, 90, 120],
    });

    expect(seedBot.action).toBe("CREATE_SEEDBOT_PERMISSION");
    expect(seedBot.instructions[0].dataHex).toBe(
      `7d65450eeaaec4de${"07".repeat(32)}00d2496b00000000f401000000000000dc0500000000000003006400`,
    );
    expect(revoke.action).toBe("REVOKE_PERMISSION");
    expect(revoke.instructions[0].dataHex).toBe("82d44235b9eb1617");
    expect(updateSeedBot.action).toBe("UPDATE_SEEDBOT_PERMISSION");
    expect(updateSeedBot.instructions[0].dataHex).toBe(
      `3a3e043c5fb0e827${"08".repeat(32)}3cd2496b000000005802000000000000c40900000000000004007d00`,
    );
    expect(updateSeedBot.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.update_seedbot_permission.accounts.map((account) => account.name),
    );
    expect(seedBotUsage.action).toBe("RECORD_SEEDBOT_USAGE");
    expect(seedBotUsage.instructions[0].dataHex).toBe(`84fd757eb644c95d${"09".repeat(32)}d2040000000000002a00`);
    expect(seedBotUsage.instructions[0].accounts.map((account) => account.anchorName)).toEqual(
      PROTOCOL_INSTRUCTION_SPECS.record_seedbot_usage.accounts.map((account) => account.name),
    );
    expect(feeConfig.action).toBe("UPDATE_FEE_CONFIG");
    expect(feeConfig.instructions[0].dataHex).toBe("68b867f258976b142c0100001e003c005a007800");
    expect(() =>
      buildProjectParticipationTransactionPlan({
        disclosureHash: "00".repeat(32),
        disclosureRevisionId: 1n,
        ownerAddress,
        participationAmountBaseUnits: 1n,
        projectId: 1n,
      }),
    ).toThrow("all zeros");
  });
});
