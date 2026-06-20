import { describe, expect, it } from "vitest";
import {
  buildActivateVotingRightsTransactionPlan,
  buildCastGovernanceVoteTransactionPlan,
  buildClaimRewardRecordTransactionPlan,
  buildClaimRewardTokensTransactionPlan,
  buildCreateRewardClaimRecordTransactionPlan,
  buildCreateSeedBotPermissionTransactionPlan,
  buildProjectParticipationTransactionPlan,
  buildRevokeSeedBotPermissionTransactionPlan,
  buildStakeRypTransactionPlan,
  buildUnstakeRypTransactionPlan,
  buildUpdateFeeConfigTransactionPlan,
  deriveProtocolAddresses,
  deriveRewardClaimRecordAddress,
  parseRypAmountToBaseUnits,
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
  });

  it("builds governance vote and project participation plans", () => {
    const vote = buildCastGovernanceVoteTransactionPlan({ approve: true, ownerAddress, proposalId: 11n });
    const participation = buildProjectParticipationTransactionPlan({
      disclosureHash: "ab".repeat(32),
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

  it("builds SeedBot permission and fee config plans with bounded args", () => {
    const seedBot = buildCreateSeedBotPermissionTransactionPlan({
      expiresAtUnix: 1_800_000_000n,
      maxDailyTrades: 3,
      maxTradeAmountBaseUnits: 500n,
      ownerAddress,
      permissionHash: new Uint8Array(32).fill(7),
    });
    const revoke = buildRevokeSeedBotPermissionTransactionPlan({ ownerAddress });
    const feeConfig = buildUpdateFeeConfigTransactionPlan({
      authorityAddress: ownerAddress,
      baseFeeBps: 300,
      tierFeeReductionBps: [0, 30, 60, 90, 120],
    });

    expect(seedBot.action).toBe("CREATE_SEEDBOT_PERMISSION");
    expect(seedBot.instructions[0].dataHex).toBe(
      `7d65450eeaaec4de${"07".repeat(32)}00d2496b00000000f4010000000000000300`,
    );
    expect(revoke.action).toBe("REVOKE_PERMISSION");
    expect(revoke.instructions[0].dataHex).toBe("82d44235b9eb1617");
    expect(feeConfig.action).toBe("UPDATE_FEE_CONFIG");
    expect(feeConfig.instructions[0].dataHex).toBe("68b867f258976b142c0100001e003c005a007800");
    expect(() =>
      buildProjectParticipationTransactionPlan({
        disclosureHash: "00".repeat(32),
        ownerAddress,
        participationAmountBaseUnits: 1n,
        projectId: 1n,
      }),
    ).toThrow("all zeros");
  });
});
