import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildHolderRewardEpoch, type HolderRewardEpoch } from "../domain/holderRewards";
import { buildCreateRewardClaimRecordFromProofTransactionPlan } from "./protocolTransactionPlan";
import {
  buildRewardClaimMerkleExport,
  rewardClaimLeafHash,
  rewardMerkleNodeHash,
} from "./rewardMerkleClaims";

const rewardEpochAddress = Keypair.generate().publicKey.toBase58();
const canopyHolder = Keypair.generate().publicKey.toBase58();
const sproutHolder = Keypair.generate().publicKey.toBase58();
const seedHolder = Keypair.generate().publicKey.toBase58();
const excludedTreasury = Keypair.generate().publicKey.toBase58();

describe("reward Merkle claims", () => {
  it("exports deterministic holder claim proofs that reconstruct the root", () => {
    const holderEpoch = fixtureHolderEpoch();
    const exportPacket = buildRewardClaimMerkleExport({
      epochId: 3n,
      holderEpoch,
      rewardEpochAddress,
      rewardRole: "HOLDER_REWARD",
    });

    expect(exportPacket.exportVersion).toBe("reward-claim-merkle/v1");
    expect(exportPacket.executionMode).toBe("PROOF_ONLY");
    expect(exportPacket.validation).toEqual({ valid: true, blockers: [], warnings: [] });
    expect(exportPacket.summary).toMatchObject({
      deliveryCostBaseUnits: "20000",
      excludedCount: 1,
      grossAllocationBaseUnits: "1000000000",
      maxProofNodes: 2,
      netClaimBaseUnits: "959980000",
      payNowCount: 2,
      recordCount: 3,
      rolledForwardBaseUnits: "40000000",
      rolloverCount: 1,
    });

    for (const record of exportPacket.records) {
      expect(reconstructRoot(record.leafHash, record.leafIndex, record.proof)).toBe(exportPacket.claimMerkleRoot);
      expect(record.claimRecordAddress).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
    }

    const rollover = exportPacket.records.find((record) => record.walletAddress === seedHolder);
    expect(rollover?.walletAction).toBe("CREATE_RECORD_FROM_PROOF_THEN_MARK_ROLLOVER");

    const plan = buildCreateRewardClaimRecordFromProofTransactionPlan({
      deliveryCostAmountBaseUnits: rollover?.deliveryCostBaseUnits ?? "0",
      epochId: exportPacket.epochId,
      grossAllocationAmountBaseUnits: rollover?.grossAllocationBaseUnits ?? "0",
      leafIndex: rollover?.leafIndex ?? "0",
      netClaimAmountBaseUnits: rollover?.netClaimBaseUnits ?? "0",
      ownerAddress: rollover?.walletAddress ?? seedHolder,
      proof: rollover?.proof ?? [],
      rewardRole: exportPacket.rewardRole,
      rolledForwardAmountBaseUnits: rollover?.rolledForwardBaseUnits ?? "0",
    });
    expect(plan.action).toBe("CREATE_REWARD_CLAIM_RECORD_FROM_PROOF");
    expect(plan.instructions[0].instructionName).toBe("create_reward_claim_record_from_proof");
  });

  it("uses the same single-leaf hash as the on-chain proof path", () => {
    const walletAddress = Keypair.generate().publicKey.toBase58();
    const singleHolderEpoch = buildHolderRewardEpoch({
      entries: [{ rypBalanceBaseUnits: 100_000_000_000n, walletAddress }],
      estimatedDeliveryCostPerPayoutBaseUnits: 0n,
      id: "holder-epoch-single",
      minimumNetPayoutBaseUnits: 1n,
      rewardMint: Keypair.generate().publicKey.toBase58(),
      rewardPoolBaseUnits: 700n,
      scheduledCadences: ["WEEKLY"],
      snapshotTakenAt: "2026-06-07T00:00:00.000Z",
    });
    const exportPacket = buildRewardClaimMerkleExport({
      epochId: 3n,
      holderEpoch: singleHolderEpoch,
      rewardEpochAddress,
      rewardRole: "HOLDER_REWARD",
    });
    const expectedLeaf = bytesToHex(
      rewardClaimLeafHash({
        deliveryCostAmountBaseUnits: 0n,
        grossAllocationAmountBaseUnits: 700n,
        leafIndex: 0n,
        netClaimAmountBaseUnits: 700n,
        rewardEpoch: new PublicKey(rewardEpochAddress),
        rewardRole: "HOLDER_REWARD",
        rolledForwardAmountBaseUnits: 0n,
        walletAddress,
      }),
    );

    expect(exportPacket.records).toHaveLength(1);
    expect(exportPacket.records[0].proof).toEqual([]);
    expect(exportPacket.records[0].leafHash).toBe(expectedLeaf);
    expect(exportPacket.claimMerkleRoot).toBe(expectedLeaf);
  });

  it("blocks empty proof exports", () => {
    const holderEpoch = {
      ...fixtureHolderEpoch(),
      payouts: fixtureHolderEpoch().payouts.map((payout) => ({
        ...payout,
        grossAllocationBaseUnits: 0n,
        deliveryCostBaseUnits: 0n,
        netPayoutBaseUnits: 0n,
        rolledForwardBaseUnits: 0n,
        status: "EXCLUDED" as const,
      })),
      rewardPoolBaseUnits: 0n,
      distributedNetBaseUnits: 0n,
      reservedDeliveryCostBaseUnits: 0n,
      rolledForwardBaseUnits: 0n,
    } satisfies HolderRewardEpoch;
    const exportPacket = buildRewardClaimMerkleExport({
      epochId: 3n,
      holderEpoch,
      rewardEpochAddress,
    });

    expect(exportPacket.validation.valid).toBe(false);
    expect(exportPacket.validation.blockers).toContain(
      "Merkle export requires at least one non-excluded, non-zero holder payout.",
    );
    expect(exportPacket.claimMerkleRoot).toBe("00".repeat(32));
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

function reconstructRoot(leafHash: string, leafIndex: string, proof: string[]) {
  let node: Uint8Array<ArrayBufferLike> = hexToBytes(leafHash);
  let index = BigInt(leafIndex);
  for (const proofNode of proof) {
    const sibling = hexToBytes(proofNode);
    node = index % 2n === 0n ? rewardMerkleNodeHash(node, sibling) : rewardMerkleNodeHash(sibling, node);
    index /= 2n;
  }
  return bytesToHex(node);
}

function hexToBytes(hex: string) {
  const normalized = hex.replace(/^0x/i, "");
  return Uint8Array.from(normalized.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []);
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
