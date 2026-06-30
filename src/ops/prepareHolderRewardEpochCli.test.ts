import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scriptPath = path.join(repoRoot, "scripts", "prepare-holder-reward-epoch.mjs");

describe("prepare holder reward epoch CLI", () => {
  it("builds a review packet for valid holder reward input", async () => {
    const { stdout } = await runCliWithInput(validInput());
    const draft = JSON.parse(stdout);

    expect(draft.exportVersion).toBe("reward-epoch-draft/v1");
    expect(draft.status).toBe("REVIEW_REQUIRED");
    expect(draft.executionBlocked).toBe(true);
    expect(draft.validation.valid).toBe(true);
  });

  it("rejects duplicate holder snapshot wallets by canonical Solana address", async () => {
    await expect(
      runCliWithInput({
        ...validInput(),
        entries: [
          { walletAddress: "2L8cm6Vu5ebSfHnzu8F4fuSVY49Kp5dpsdApV5Rkkgpn", rypBalanceBaseUnits: "100000000000" },
          { walletAddress: " 2L8cm6Vu5ebSfHnzu8F4fuSVY49Kp5dpsdApV5Rkkgpn ", rypBalanceBaseUnits: "1" },
        ],
      }),
    ).rejects.toThrow("Duplicate snapshot wallet address");
  });

  it("rejects malformed wallet addresses and zero reward pools before payout math", async () => {
    await expect(
      runCliWithInput({
        ...validInput(),
        entries: [{ walletAddress: "not-a-wallet", rypBalanceBaseUnits: "100000000000" }],
      }),
    ).rejects.toThrow("Snapshot wallet 0 must be a valid Solana public key");

    await expect(
      runCliWithInput({
        ...validInput(),
        rewardPoolBaseUnits: "0",
      }),
    ).rejects.toThrow("Reward pool must be greater than zero");
  });

  it("blocks review packets when no holder is eligible for the epoch", async () => {
    await expect(
      runCliWithInput({
        ...validInput(),
        entries: [
          {
            walletAddress: "Ad7JtmEcbbzBevGuv8ZW9iEYNqBJrHaBK6q8tPSEHp1i",
            rypBalanceBaseUnits: "150000000000",
            excluded: true,
            exclusionReason: "Treasury wallet excluded from holder rewards.",
          },
          {
            walletAddress: "7aqVX7jLDuNenVj4ehsmsmKkDNdf4zFWTm7XauCxCm2i",
            rypBalanceBaseUnits: "0",
          },
        ],
      }),
    ).rejects.toMatchObject({
      stdout: expect.stringContaining(
        "Holder reward epoch requires at least one eligible non-excluded holder balance.",
      ),
    });
  });
});

async function runCliWithInput(input: unknown) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cryptoseeds-reward-cli-"));
  const inputPath = path.join(tempDir, "holder-reward-input.json");

  try {
    await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
    return await execFileAsync(process.execPath, [scriptPath, inputPath], {
      cwd: repoRoot,
      timeout: 10_000,
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function validInput() {
  const rewardMint = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";

  return {
    id: "holder-epoch-cli-test",
    label: "CLI holder reward test",
    createdAt: "2026-06-07T00:00:00.000Z",
    rewardMint,
    snapshotTakenAt: "2026-06-07T00:00:00.000Z",
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
      vault("holder-reward-vault", "Holder Reward Vault", "HOLDER_REWARD", rewardMint, "7FqWmxN6xDbBBiKcJ1i62uL6AdyeaA5vWeQNiwxnUEHa"),
      vault("staker-reward-vault", "Staker Reward Vault", "STAKER_REWARD", rewardMint, "A8T9YzcWUNp3527PxFRowGNLXNLruZJRxLZsT9JKCLTi"),
      vault(
        "independent-treasury-vault",
        "Independent Treasury Vault",
        "INDEPENDENT_TREASURY",
        rewardMint,
        "9e8Mqy7Y86oSRCyh9LfwfY364Tvkaa5h5RHr8ZFcG9tm",
        "TREASURY_CONTROLLED",
      ),
      vault("delivery-cost-reserve", "Delivery Cost Reserve", "DELIVERY_COST_RESERVE", rewardMint, "9s5o1WQzecri6vZ3hViK8SkpUcfkcphoqi9SWUaiG4J"),
      vault("rollover-vault", "Rollover Vault", "ROLLOVER", rewardMint, "HiY1b9iqxad4Am51fgLn9zjswmWc1SN4qmwGHDiVhGre"),
    ],
  };
}

function vault(
  id: string,
  label: string,
  role: string,
  rewardMint: string,
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
