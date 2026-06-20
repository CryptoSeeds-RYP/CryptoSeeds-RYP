import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildHolderRewardEpoch, type HolderRewardEpoch } from "../domain/holderRewards";
import { buildRewardClaimBatchPlan } from "./rewardClaimBatchPlan";

const authorityAddress = Keypair.generate().publicKey.toBase58();
const rewardSourceVaultAddress = Keypair.generate().publicKey.toBase58();
const canopyHolder = Keypair.generate().publicKey.toBase58();
const sproutHolder = Keypair.generate().publicKey.toBase58();
const seedHolder = Keypair.generate().publicKey.toBase58();
const excludedTreasury = Keypair.generate().publicKey.toBase58();

describe("reward claim batch plan", () => {
  it("builds role-keyed claim record and wallet claim plans from a holder epoch", () => {
    const holderEpoch = fixtureHolderEpoch();
    const batch = buildRewardClaimBatchPlan({
      authorityAddress,
      epochId: 3n,
      holderEpoch,
      rewardSourceVaultAddress,
    });

    expect(batch.exportVersion).toBe("reward-claim-batch/v1");
    expect(batch.executionMode).toBe("PREVIEW_ONLY");
    expect(batch.rewardRole).toBe("HOLDER_REWARD");
    expect(batch.validation).toEqual({ valid: true, blockers: [], warnings: [] });
    expect(batch.summary).toMatchObject({
      deliveryCostBaseUnits: "20000",
      excludedCount: 1,
      grossAllocationBaseUnits: "1000000000",
      netClaimBaseUnits: "959980000",
      payNowCount: 2,
      recordCount: 3,
      rolledForwardBaseUnits: "40000000",
      rolloverCount: 1,
      totalPayouts: 4,
    });

    const payNowRecord = batch.records.find((record) => record.walletAddress === canopyHolder);
    expect(payNowRecord?.recordStatus).toBe("READY_FOR_RECORD_CREATION");
    expect(payNowRecord?.walletActionStatus).toBe("READY_FOR_TOKEN_CLAIM");
    expect(payNowRecord?.createRecordPlan?.action).toBe("CREATE_REWARD_CLAIM_RECORD");
    expect(payNowRecord?.createRecordPlan?.instructions[0].instructionName).toBe("create_reward_claim_record");
    expect(payNowRecord?.walletClaimPlan?.instructions[0].instructionName).toBe("claim_reward_tokens");
    expect(
      payNowRecord?.walletClaimPlan?.instructions[0].accounts.find(
        (account) => account.anchorName === "reward_source_vault",
      )?.address,
    ).toBe(rewardSourceVaultAddress);

    const rolloverRecord = batch.records.find((record) => record.walletAddress === seedHolder);
    expect(rolloverRecord?.recordStatus).toBe("READY_FOR_RECORD_CREATION");
    expect(rolloverRecord?.walletActionStatus).toBe("READY_FOR_ROLLOVER_MARK");
    expect(rolloverRecord?.walletClaimPlan?.instructions[0].instructionName).toBe("claim_reward_record");

    const excludedRecord = batch.records.find((record) => record.walletAddress === excludedTreasury);
    expect(excludedRecord?.recordStatus).toBe("SKIPPED_EXCLUDED");
    expect(excludedRecord?.createRecordPlan).toBeUndefined();
    expect(excludedRecord?.walletClaimPlan).toBeUndefined();
  });

  it("keeps positive payout wallet claims blocked until a source vault is supplied", () => {
    const batch = buildRewardClaimBatchPlan({
      authorityAddress,
      epochId: 3n,
      holderEpoch: fixtureHolderEpoch(),
    });

    expect(batch.validation.valid).toBe(true);
    expect(batch.validation.warnings).toContain(
      "Pay-now wallet token claim plans require a verified reward source vault address.",
    );
    expect(batch.records.find((record) => record.walletAddress === canopyHolder)?.walletActionStatus).toBe(
      "SOURCE_VAULT_REQUIRED",
    );
  });

  it("blocks batches when epoch totals no longer match payout records", () => {
    const holderEpoch = {
      ...fixtureHolderEpoch(),
      distributedNetBaseUnits: 959_980_001n,
    } satisfies HolderRewardEpoch;
    const batch = buildRewardClaimBatchPlan({
      authorityAddress,
      epochId: 3n,
      holderEpoch,
      rewardSourceVaultAddress,
    });

    expect(batch.validation.valid).toBe(false);
    expect(batch.validation.blockers).toContain("Holder reward epoch accounting is not balanced.");
    expect(batch.validation.blockers).toContain(
      "Claim record net totals must equal the holder epoch distributed net amount.",
    );
  });
});

function fixtureHolderEpoch() {
  return buildHolderRewardEpoch({
    entries: [
      {
        rypBalanceBaseUnits: 100_000_000_000n,
        walletAddress: canopyHolder,
      },
      {
        rypBalanceBaseUnits: 20_000_000_000n,
        walletAddress: sproutHolder,
      },
      {
        rypBalanceBaseUnits: 5_000_000_000n,
        walletAddress: seedHolder,
      },
      {
        excluded: true,
        exclusionReason: "Treasury wallet excluded from holder rewards.",
        rypBalanceBaseUnits: 150_000_000_000n,
        walletAddress: excludedTreasury,
      },
    ],
    estimatedDeliveryCostPerPayoutBaseUnits: 10_000n,
    id: "holder-epoch-test-001",
    minimumNetPayoutBaseUnits: 20_000n,
    rewardMint: Keypair.generate().publicKey.toBase58(),
    rewardPoolBaseUnits: 1_000_000_000n,
    scheduledCadences: ["WEEKLY"],
    snapshotTakenAt: "2026-06-07T00:00:00.000Z",
  });
}
