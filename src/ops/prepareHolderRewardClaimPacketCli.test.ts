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
const scriptPath = path.join(repoRoot, "scripts", "prepare-holder-reward-claim-packet.mjs");
const rewardMint = "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD";
const rewardEpochAddress = "6JkYUiZZMxVtqjmsv2uhk47HYj3QAYTsvT4M1WbNY7NK";

describe("prepare holder reward claim packet CLI", () => {
  it("builds the holder epoch draft and claim Merkle packet in one command", async () => {
    const { stdout } = await runCliWithInput(validInput(), "7", "--reward-epoch-address", rewardEpochAddress);
    const packet = JSON.parse(stdout);

    expect(packet.exportVersion).toBe("holder-reward-claim-packet/v1");
    expect(packet.status).toBe("READY_FOR_REVIEW");
    expect(packet.executionMode).toBe("PROOF_ONLY");
    expect(packet.validation.valid).toBe(true);
    expect(packet.draft.validation.valid).toBe(true);
    expect(packet.claimPacket.validation.valid).toBe(true);
    expect(packet.claimPacket.records).toHaveLength(2);
    expect(packet.claimMerkleRoot).toBe(packet.claimPacket.claimMerkleRoot);

    for (const record of packet.claimPacket.records) {
      const verification = verifyRewardClaimMerkleRecord({
        claimMerkleRoot: packet.claimMerkleRoot,
        record,
      });
      expect(verification.valid).toBe(true);
    }
  });

  it("rejects duplicate holder snapshot rows before writing a claim packet", async () => {
    await expect(
      runCliWithInput(
        {
          ...validInput(),
          entries: [
            { walletAddress: "2L8cm6Vu5ebSfHnzu8F4fuSVY49Kp5dpsdApV5Rkkgpn", rypBalanceBaseUnits: "100000000000" },
            { walletAddress: " 2L8cm6Vu5ebSfHnzu8F4fuSVY49Kp5dpsdApV5Rkkgpn ", rypBalanceBaseUnits: "1" },
          ],
        },
        "7",
      ),
    ).rejects.toThrow("Duplicate snapshot wallet address");
  });

  it("requires an epoch id", async () => {
    await expect(runCliWithInput(validInput())).rejects.toThrow("Usage:");
  });
});

async function runCliWithInput(input: unknown, ...args: string[]) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cryptoseeds-holder-packet-cli-"));
  const inputPath = path.join(tempDir, "holder-reward-input.json");

  try {
    await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`, "utf8");
    return await execFileAsync(process.execPath, [scriptPath, inputPath, ...args], {
      cwd: repoRoot,
      maxBuffer: 64 * 1024 * 1024,
      timeout: 20_000,
    });
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function validInput() {
  return {
    id: "holder-epoch-claim-packet-cli-test",
    label: "CLI holder reward claim packet test",
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
