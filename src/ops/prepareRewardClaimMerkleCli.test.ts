import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { verifyRewardClaimMerkleRecord } from "../solana/rewardMerkleClaims";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "prepare-reward-claim-merkle.mjs");
const rewardMint = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
const rewardEpochAddress = "6JkYUiZZMxVtqjmsv2uhk47HYj3QAYTsvT4M1WbNY7NK";

describe("prepare reward claim Merkle CLI", () => {
  it("exports proof records that locally reconstruct the root", async () => {
    const { stdout } = await runCliWithDraft(validDraft(), "7", "--reward-epoch-address", rewardEpochAddress);
    const packet = JSON.parse(stdout);

    expect(packet.exportVersion).toBe("reward-claim-merkle/v1");
    expect(packet.executionMode).toBe("PROOF_ONLY");
    expect(packet.validation.valid).toBe(true);
    expect(packet.records).toHaveLength(2);

    for (const record of packet.records) {
      const verification = verifyRewardClaimMerkleRecord({
        claimMerkleRoot: packet.claimMerkleRoot,
        record,
      });
      expect(verification.valid).toBe(true);
      expect(verification.blockers).toEqual([]);
    }
  });

  it("rejects invalid epoch ids and missing option values", async () => {
    await expect(runCliWithDraft(validDraft(), "not-an-epoch")).rejects.toThrow(
      "Reward epoch id must be a non-negative integer",
    );

    await expect(runCliWithDraft(validDraft(), "7", "--reward-role")).rejects.toThrow("--reward-role requires a value");
  });
});

async function runCliWithDraft(draft: unknown, ...args: string[]) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cryptoseeds-merkle-cli-"));
  const inputPath = path.join(tempDir, "reward-epoch-draft.json");

  try {
    await writeFile(inputPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");
    return await execFileAsync(process.execPath, [scriptPath, inputPath, ...args], {
      cwd: repoRoot,
      timeout: 10_000,
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function validDraft() {
  return {
    exportVersion: "reward-epoch-draft/v1",
    id: "holder-epoch-merkle-cli",
    label: "Merkle CLI holder reward test",
    status: "REVIEW_REQUIRED",
    createdAt: "2026-06-07T00:00:00.000Z",
    executionBlocked: true,
    rewardMint,
    holderPolicyLabel: "Passive Holder Rewards",
    holderEpoch: {
      id: "holder-epoch-merkle-cli",
      rewardMint,
      snapshotTakenAt: "2026-06-07T00:00:00.000Z",
      totalEligibleRypBaseUnits: "120000000000",
      rewardPoolBaseUnits: "1000000000",
      distributedNetBaseUnits: "999980000",
      reservedDeliveryCostBaseUnits: "20000",
      rolledForwardBaseUnits: "0",
      payouts: [
        payout("2L8cm6Vu5ebSfHnzu8F4fuSVY49Kp5dpsdApV5Rkkgpn", "833333333", "833323333"),
        payout("7aqVX7jLDuNenVj4ehsmsmKkDNdf4zFWTm7XauCxCm2i", "166666667", "166656667"),
      ],
    },
    validation: { valid: true, blockers: [], warnings: [] },
  };
}

function payout(walletAddress: string, grossAllocationBaseUnits: string, netPayoutBaseUnits: string) {
  return {
    walletAddress,
    holderTier: "SPROUT",
    payoutCadence: "WEEKLY",
    rypBalanceBaseUnits: "20000000000",
    grossAllocationBaseUnits,
    deliveryCostBaseUnits: "10000",
    netPayoutBaseUnits,
    rolledForwardBaseUnits: "0",
    status: "PAY_NOW",
    reason: "Net payout clears delivery cost and minimum threshold.",
  };
}
