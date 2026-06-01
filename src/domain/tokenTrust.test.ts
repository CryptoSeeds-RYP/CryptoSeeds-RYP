import { describe, expect, it } from "vitest";
import { buildTokenTrustChecks, RYP_TRUST_PROFILE, tokenTrustSummary } from "./tokenTrust";

describe("token trust profile", () => {
  it("marks the current RYP mint authority posture as verified", () => {
    const checks = buildTokenTrustChecks();

    expect(checks.find((check) => check.id === "fixed-supply")?.status).toBe("VERIFIED");
    expect(checks.find((check) => check.id === "freeze-disabled")?.status).toBe("VERIFIED");
    expect(checks.find((check) => check.id === "self-custody")?.status).toBe("VERIFIED");
  });

  it("keeps transfer-level fees behind review for a legacy SPL route", () => {
    const checks = buildTokenTrustChecks();

    expect(checks.find((check) => check.id === "transfer-fee-route")).toMatchObject({
      status: "REVIEW_REQUIRED",
    });
    expect(tokenTrustSummary(checks)).toMatchObject({
      status: "REVIEW_REQUIRED",
      reviewRequired: 1,
      verified: 3,
    });
  });

  it("blocks trust summary when mint authority is active", () => {
    const checks = buildTokenTrustChecks({
      ...RYP_TRUST_PROFILE,
      mintAuthority: "Authority111111111111111111111111111111111",
    });

    expect(tokenTrustSummary(checks).status).toBe("BLOCKED");
  });
});
