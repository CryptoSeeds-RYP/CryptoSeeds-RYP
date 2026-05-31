import { describe, expect, it } from "vitest";
import {
  buildActivateVotingRightsTransactionPlan,
  buildStakeRypTransactionPlan,
  buildUnstakeRypTransactionPlan,
  deriveProtocolAddresses,
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
});
