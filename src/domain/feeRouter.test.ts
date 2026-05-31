import { describe, expect, it } from "vitest";
import {
  basisPointsToPercent,
  distributeFeeAmount,
  draftCoreFeeSplit,
  effectivePlatformActionFeeBps,
  quoteTokenTransferFee,
  RYP_TOKEN_TRANSFER_FEE_BPS,
  tokenTransferFeeUsesCoreSplit,
  validateFeeSplit,
} from "./feeRouter";

describe("fee router", () => {
  it("models the RYP token transfer fee as one percent", () => {
    expect(RYP_TOKEN_TRANSFER_FEE_BPS).toBe(100);
    expect(basisPointsToPercent(RYP_TOKEN_TRANSFER_FEE_BPS)).toBe("1%");
    expect(tokenTransferFeeUsesCoreSplit()).toBe(true);
  });

  it("quotes gross fee and net transfer amounts in base units", () => {
    const quote = quoteTokenTransferFee(1_000_000_000n);

    expect(quote.feeAmountBaseUnits).toBe(10_000_000n);
    expect(quote.netAmountBaseUnits).toBe(990_000_000n);
  });

  it("keeps platform action fee tier reductions separate from token transfer fees", () => {
    expect(effectivePlatformActionFeeBps("SEED")).toBe(350);
    expect(effectivePlatformActionFeeBps("SPROUT")).toBe(315);
    expect(effectivePlatformActionFeeBps("SAPLING")).toBe(280);
    expect(effectivePlatformActionFeeBps("TREE")).toBe(245);
    expect(effectivePlatformActionFeeBps("FRUIT")).toBe(210);
  });

  it("validates same-bucket holder staker treasury fee splits", () => {
    const validation = validateFeeSplit(draftCoreFeeSplit);

    expect(validation.valid).toBe(true);
    expect(validation.totalShareBps).toBe(10_000);
  });

  it("distributes rounding remainder into the final bucket", () => {
    const distribution = distributeFeeAmount(100n, draftCoreFeeSplit);

    expect(distribution.map((entry) => entry.bucket)).toEqual([
      "HOLDERS",
      "STAKERS",
      "INDEPENDENT_TREASURY",
    ]);
    expect(distribution.reduce((total, entry) => total + entry.amountBaseUnits, 0n)).toBe(100n);
    expect(distribution[distribution.length - 1]?.amountBaseUnits).toBe(34n);
  });

  it("blocks invalid or incomplete fee splits", () => {
    const validation = validateFeeSplit([
      { bucket: "HOLDERS", shareBps: 5_000 },
      { bucket: "STAKERS", shareBps: 4_000 },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.blockers.join(" ")).toContain("10000");
  });
});
