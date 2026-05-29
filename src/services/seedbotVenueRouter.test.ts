import { describe, expect, it } from "vitest";
import { seedBotStrategies } from "../domain/seedbot";
import type { SeedBotStrategy } from "../domain/seedbot";
import { seedBotPerformanceFeeModel } from "../domain/seedbot";
import { buildSeedBotRoutePlan } from "./seedbotVenueRouter";

describe("seedbot venue router", () => {
  it("builds a dry-run Hyperliquid route for the cross-chain strategy", () => {
    const strategy = seedBotStrategies.find((item) => item.preferredVenueId === "HYPERLIQUID")!;
    const plan = buildSeedBotRoutePlan({ strategy });

    expect(plan.mode).toBe("DRY_RUN");
    expect(plan.blockedReasons).toEqual([]);
    expect(plan.routes).toHaveLength(1);
    expect(plan.routes[0]).toMatchObject({
      venueId: "HYPERLIQUID",
      endpoint: "https://api.hyperliquid.xyz/exchange",
      walletRoute: "METAMASK",
    });
    expect(plan.routes[0].orderPreview).toHaveLength(strategy.assets.length);
    expect(plan.routes[0].safetyChecks).toContain("No withdrawal action is generated.");
  });

  it("keeps Solana spot routes on Jupiter", () => {
    const strategy = seedBotStrategies.find((item) => item.preferredVenueId === "JUPITER")!;
    const plan = buildSeedBotRoutePlan({ strategy });

    expect(plan.routes.map((route) => route.venueId)).toEqual(["JUPITER"]);
    expect(plan.routes[0].walletRoute).toBe("PHANTOM");
  });

  it("blocks unknown or due-diligence venues from live client routing", () => {
    const strategy: SeedBotStrategy = {
      id: "antarctic-test",
      name: "Antarctic Test",
      summary: "Blocked venue test",
      risk: "HIGH",
      minimumAccess: "FRUIT",
      preferredVenueId: "ANTARCTIC",
      performance: [{ window: "7D", returnPercent: 0, points: [0, 0] }],
      feeModel: seedBotPerformanceFeeModel,
      allocationModes: ["BASKET"],
      assets: [
        {
          symbol: "BTC",
          chain: "EVM",
          walletRoute: "METAMASK",
          venueId: "ANTARCTIC",
          targetWeightPercent: 100,
        },
      ],
    };

    const plan = buildSeedBotRoutePlan({ strategy });

    expect(plan.blockedReasons).toEqual(["Antarctic Exchange is blocked pending venue due diligence."]);
    expect(plan.routes[0].orderPreview).toEqual([]);
  });
});
