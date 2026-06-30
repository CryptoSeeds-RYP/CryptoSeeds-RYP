import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "prepare-reward-epoch-admin-plan.mjs");
const authorityAddress = "Hqt69SbbvfkTbdC23ysWAxCZrTf9mYCMe8uuVDPdjPHe";
const rewardMint = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";

describe("prepare reward epoch admin plan CLI", () => {
  it("builds plan-only admin planner inputs from holder reward input", async () => {
    const nowUnix = 1_800_000_000;
    const { stdout } = await runCliWithInput(validInput(nowUnix - 1_000), "7", "--now-unix", String(nowUnix));
    const plan = JSON.parse(stdout);

    expect(plan.exportVersion).toBe("reward-epoch-admin-plan/v1");
    expect(plan.status).toBe("READY_FOR_REVIEW");
    expect(plan.executionMode).toBe("PLAN_ONLY");
    expect(plan.noTransactionsSubmitted).toBe(true);
    expect(plan.validation.valid).toBe(true);
    expect(plan.plannerInputs.draftRewardEpoch).toMatchObject({
      authorityAddress,
      epochId: "7",
      rewardPoolAmountBaseUnits: "1000000000",
      distributedNetAmountBaseUnits: "999980000",
      reservedDeliveryCostAmountBaseUnits: "20000",
      rolledForwardAmountBaseUnits: "0",
      nowUnix: String(nowUnix),
    });
    expect(plan.plannerInputs.draftRewardEpoch.claimMerkleRoot).toBe(plan.claimMerkleRoot);
    expect(plan.plannerInputs.reviewRewardEpoch).toEqual({ authorityAddress, epochId: "7" });
    expect(plan.transactionPlannerMapping.map((item: { instructionName: string }) => item.instructionName)).toEqual([
      "draft_reward_epoch",
      "review_reward_epoch",
      "cancel_reward_epoch",
    ]);
    expect(plan.exclusionListHash).not.toBe("00".repeat(32));
  });

  it("requires the configured authority address", async () => {
    await expect(runCliWithInput(validInput(1_800_000_000), "7", "--now-unix", "1800001000", "--authority", "bad"))
      .rejects.toThrow("Authority must be a valid Solana public key");
  });

  it("blocks stale snapshots before emitting admin epoch transaction inputs as ready", async () => {
    const nowUnix = 1_800_000_000;

    await expect(
      runCliWithInput(
        validInput(nowUnix - 8 * 24 * 60 * 60),
        "7",
        "--now-unix",
        String(nowUnix),
        "--epoch-cadence-seconds",
        String(7 * 24 * 60 * 60),
      ),
    ).rejects.toMatchObject({
      stdout: expect.stringContaining("Reward epoch snapshot is older than the configured cadence."),
    });
  });
});

async function runCliWithInput(input: unknown, epochId: string, ...args: string[]) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cryptoseeds-admin-plan-cli-"));
  const inputPath = path.join(tempDir, "holder-reward-input.json");

  try {
    await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
    return await execFileAsync(
      process.execPath,
      [scriptPath, inputPath, epochId, "--authority", authorityAddress, ...args],
      {
        cwd: repoRoot,
        maxBuffer: 64 * 1024 * 1024,
        timeout: 20_000,
      },
    );
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function validInput(snapshotUnix: number) {
  return {
    id: "holder-epoch-admin-plan-cli-test",
    label: "CLI reward epoch admin plan test",
    createdAt: new Date(snapshotUnix * 1_000).toISOString(),
    rewardMint,
    snapshotTakenAt: new Date(snapshotUnix * 1_000).toISOString(),
    scheduledCadences: ["WEEKLY"],
    rewardPoolBaseUnits: "1000000000",
    estimatedDeliveryCostPerPayoutBaseUnits: "10000",
    minimumNetPayoutBaseUnits: "20000",
    entries: [
      {
        walletAddress: "2L8cm6Vu5ebSfHnzu8F4fuSVY49Kp5dpsdApV5Rkkgpn",
        rypBalanceBaseUnits: "100000000000",
      },
      {
        walletAddress: "7aqVX7jLDuNenVj4ehsmsmKkDNdf4zFWTm7XauCxCm2i",
        rypBalanceBaseUnits: "20000000000",
      },
      {
        walletAddress: "Ad7JtmEcbbzBevGuv8ZW9iEYNqBJrHaBK6q8tPSEHp1i",
        rypBalanceBaseUnits: "150000000000",
        excluded: true,
        exclusionReason: "Treasury wallet excluded from holder rewards.",
      },
    ],
    vaults: [
      vault("holder-reward-vault", "Holder Reward Vault", "HOLDER_REWARD", "7FqWmxN6xDbBBiKcJ1i62uL6AdyeaA5vWeQNiwxnUEHa"),
      vault("staker-reward-vault", "Staker Reward Vault", "STAKER_REWARD", "A8T9YzcWUNp3527PxFRowGNLXNLruZJRxLZsT9JKCLTi"),
      vault(
        "independent-treasury-vault",
        "Independent Treasury Vault",
        "INDEPENDENT_TREASURY",
        "9e8Mqy7Y86oSRCyh9LfwfY364Tvkaa5h5RHr8ZFcG9tm",
        "TREASURY_CONTROLLED",
      ),
      vault("delivery-cost-reserve", "Delivery Cost Reserve", "DELIVERY_COST_RESERVE", "9s5o1WQzecri6vZ3hViK8SkpUcfkcphoqi9SWUaiG4J"),
      vault("rollover-vault", "Rollover Vault", "ROLLOVER", "HiY1b9iqxad4Am51fgLn9zjswmWc1SN4qmwGHDiVhGre"),
    ],
  };
}

function vault(
  id: string,
  label: string,
  role: string,
  address: string,
  custodyModel = "PROGRAM_CONTROLLED",
) {
  return {
    id,
    label,
    role,
    rewardMint,
    address,
    custodyModel,
    status: "VERIFIED",
    receivesUserFunds: false,
    notes: "CLI test vault.",
  };
}
