import { describe, expect, it } from "vitest";
import {
  allControlsAvoidUserFundCustody,
  authorityControls,
  materialControlsRequirePublicLogs,
  platformBoundaries,
  platformFeePolicy,
  reviewGates,
  validatePlatformGovernancePosture,
} from "./platformGovernance";

describe("platform governance posture", () => {
  it("keeps platform boundaries non-custodial", () => {
    expect(platformBoundaries.map((boundary) => boundary.id)).toEqual([
      "user-custody",
      "project-owner-accounts",
      "independent-treasury",
      "transparent-platform-fees",
    ]);
    expect(allControlsAvoidUserFundCustody()).toBe(true);
  });

  it("keeps fee memory explicit and configurable", () => {
    expect(platformFeePolicy.baseFeeBps).toBe(350);
    expect(platformFeePolicy.tokenTransferFeeBps).toBe(100);
    expect(platformFeePolicy.tierEffectiveFeesBps.SEED).toBe(350);
    expect(platformFeePolicy.tierEffectiveFeesBps.FRUIT).toBe(210);
    expect(platformFeePolicy.splitBuckets).toEqual(["HOLDERS", "STAKERS", "INDEPENDENT_TREASURY"]);
    expect(platformFeePolicy.exactSplitStatus).toBe("CONFIGURABLE_NOT_FINAL");
    expect(platformFeePolicy.tokenTransferFeeNotes.join(" ")).toContain("1%");
  });

  it("requires public logs for material authority controls", () => {
    expect(materialControlsRequirePublicLogs()).toBe(true);
    expect(authorityControls.find((control) => control.id === "fee-parameters")?.targetControl).toContain("timelock");
    expect(authorityControls.find((control) => control.id === "seedbot-permissions")?.currentState).toBe("DISABLED");
  });

  it("keeps sensitive features review-gated", () => {
    expect(reviewGates.find((gate) => gate.id === "seedbot-success-fee")?.status).toBe("BLOCKED_UNTIL_REVIEW");
    expect(reviewGates.find((gate) => gate.id === "project-financial-rights")?.status).toBe("BLOCKED_UNTIL_REVIEW");
    expect(reviewGates.find((gate) => gate.id === "founder-token-disclosure")?.status).toBe("DISCLOSURE_REQUIRED");
  });

  it("validates governance ids and public-log posture", () => {
    expect(validatePlatformGovernancePosture()).toEqual({
      valid: true,
      blockers: [],
    });

    const duplicateControls = [
      ...authorityControls,
      { ...authorityControls[0], id: authorityControls[0].id.toUpperCase(), publicLogRequired: false },
    ];

    expect(validatePlatformGovernancePosture({ controls: duplicateControls }).blockers).toEqual([
      "Duplicate authority control id: PROTOCOL-PAUSE.",
      "Authority controls must require public logs.",
    ]);
  });
});
