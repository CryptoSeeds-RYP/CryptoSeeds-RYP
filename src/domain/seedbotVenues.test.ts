import { describe, expect, it } from "vitest";
import { publicClientExecutionVenues, recommendedSeedBotVenue, venueById } from "./seedbotVenues";

describe("seedbot venues", () => {
  it("recommends Hyperliquid as the first pilot venue", () => {
    expect(recommendedSeedBotVenue()).toMatchObject({
      id: "HYPERLIQUID",
      apiReady: true,
      status: "RECOMMENDED_PILOT",
    });
  });

  it("keeps Antarctic blocked until due diligence is complete", () => {
    expect(venueById("ANTARCTIC")).toMatchObject({
      apiReady: false,
      status: "DUE_DILIGENCE",
    });
    expect(publicClientExecutionVenues().map((venue) => venue.id)).not.toContain("ANTARCTIC");
  });
});
