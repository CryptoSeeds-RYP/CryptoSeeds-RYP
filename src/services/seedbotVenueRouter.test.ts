import { describe, expect, it } from "vitest";
import { seedBotStrategies } from "../domain/seedbot";
import type { SeedBotStrategy } from "../domain/seedbot";
import { seedBotPerformanceFeeModel } from "../domain/seedbot";
import { buildHyperliquidAgentApprovalPreview, hyperliquidConfig } from "./hyperliquidAdapter";
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
      endpoint: "https://api.hyperliquid-testnet.xyz/exchange",
      executionEnvironment: "TESTNET",
      walletRoute: "METAMASK",
    });
    expect(plan.routes[0].orderPreview).toHaveLength(strategy.assets.length);
    expect(plan.routes[0].safetyChecks).toContain("No withdrawal action is generated.");
    expect(plan.routes[0].authorizationPreview).toMatchObject({
      network: "TESTNET",
      actionDraft: { type: "approveAgent", hyperliquidChain: "Testnet" },
    });
    expect(plan.routes[0].orderPreview[0].payload).toMatchObject({
      network: "TESTNET",
      actionDraft: {
        type: "order",
        orders: [{ officialFields: { a: "PENDING_META_ASSET_ID" } }],
      },
    });
  });

  it("keeps Hyperliquid mainnet and testnet endpoint config explicit", () => {
    expect(hyperliquidConfig("TESTNET")).toMatchObject({
      exchangeEndpoint: "https://api.hyperliquid-testnet.xyz/exchange",
      hyperliquidChain: "Testnet",
    });
    expect(hyperliquidConfig("MAINNET")).toMatchObject({
      exchangeEndpoint: "https://api.hyperliquid.xyz/exchange",
      hyperliquidChain: "Mainnet",
    });
  });

  it("builds a wallet-owned Hyperliquid agent approval preview", () => {
    const approval = buildHyperliquidAgentApprovalPreview({
      agentAddress: "0x1111111111111111111111111111111111111111",
    });

    expect(approval.actionDraft).toMatchObject({
      type: "approveAgent",
      hyperliquidChain: "Testnet",
      agentAddress: "0x1111111111111111111111111111111111111111",
    });
    expect(approval.signature).toBe("master-wallet-signature-required");
    expect(approval.safetyChecks).toContain("Agent approval must be initiated by the user's own wallet.");
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
      performance: seedBotStrategies[0].performance,
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

  it("fails closed when strategy metadata does not pass domain validation", () => {
    const strategy: SeedBotStrategy = {
      ...seedBotStrategies[0],
      id: "missing-history",
      performance: seedBotStrategies[0].performance.filter((item) => item.window !== "1Y"),
    };

    const plan = buildSeedBotRoutePlan({ strategy });

    expect(plan.routes).toEqual([]);
    expect(plan.blockedReasons).toContain("SeedBot strategy missing-history is missing 1Y performance.");
  });

  it("downgrades signed execution requests while the feature flag is disabled", () => {
    const strategy = seedBotStrategies.find((item) => item.preferredVenueId === "HYPERLIQUID")!;
    const plan = buildSeedBotRoutePlan({ strategy, mode: "WALLET_SIGNED" });

    expect(plan.mode).toBe("DRY_RUN");
    expect(plan.routes[0].mode).toBe("DRY_RUN");
    expect(plan.blockedReasons).toContain("SeedBot signed execution feature flag is disabled.");
  });

  it("blocks malformed allocation weights before route execution", () => {
    const strategy: SeedBotStrategy = {
      id: "bad-weights",
      name: "Bad Weights",
      summary: "Bad weight test",
      risk: "HIGH",
      minimumAccess: "FRUIT",
      preferredVenueId: "JUPITER",
      performance: seedBotStrategies[0].performance,
      feeModel: seedBotPerformanceFeeModel,
      allocationModes: ["BASKET"],
      assets: [
        {
          symbol: "SOL",
          chain: "SOLANA",
          walletRoute: "PHANTOM",
          venueId: "JUPITER",
          targetWeightPercent: 80,
        },
        {
          symbol: "RYP",
          chain: "SOLANA",
          walletRoute: "PHANTOM",
          venueId: "JUPITER",
          targetWeightPercent: 10,
        },
      ],
    };

    const plan = buildSeedBotRoutePlan({ strategy });

    expect(plan.routes).toEqual([]);
    expect(plan.blockedReasons).toContain("SeedBot strategy bad-weights target weights must total 100%.");
  });
});
