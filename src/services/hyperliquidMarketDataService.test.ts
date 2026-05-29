import { describe, expect, it } from "vitest";
import {
  fetchHyperliquidMeta,
  parseHyperliquidMeta,
  resolveHyperliquidAsset,
  resolveHyperliquidStrategyAssets,
} from "./hyperliquidMarketDataService";

const metaFixture = {
  universe: [
    { name: "SOL", szDecimals: 2, maxLeverage: 10, marginTableId: 10 },
    { name: "ETH", szDecimals: 4, maxLeverage: 25, marginTableId: 53 },
    { name: "OLD", szDecimals: 1, maxLeverage: 3, marginTableId: 3, isDelisted: true },
  ],
};

describe("hyperliquid market data service", () => {
  it("parses the meta universe and resolves perp asset ids by index", () => {
    const meta = parseHyperliquidMeta(metaFixture);

    expect(resolveHyperliquidAsset(meta, "SOL")).toMatchObject({
      assetId: 0,
      tradable: true,
      szDecimals: 2,
      maxLeverage: 10,
    });
    expect(resolveHyperliquidAsset(meta, "ETH")).toMatchObject({ assetId: 1, tradable: true });
  });

  it("blocks missing and delisted assets before signing", () => {
    const meta = parseHyperliquidMeta(metaFixture);

    expect(resolveHyperliquidAsset(meta, "BTC")).toMatchObject({
      tradable: false,
      blockedReason: "Asset is missing from Hyperliquid meta universe.",
    });
    expect(resolveHyperliquidAsset(meta, "OLD")).toMatchObject({
      assetId: 2,
      tradable: false,
      blockedReason: "Asset is delisted on Hyperliquid.",
    });
  });

  it("resolves strategy assets without mutating route assets", () => {
    const meta = parseHyperliquidMeta(metaFixture);
    const result = resolveHyperliquidStrategyAssets(meta, [
      { symbol: "SOL", chain: "EVM", walletRoute: "METAMASK", venueId: "HYPERLIQUID", targetWeightPercent: 60 },
      { symbol: "ETH", chain: "EVM", walletRoute: "METAMASK", venueId: "HYPERLIQUID", targetWeightPercent: 40 },
    ]);

    expect(result.map((item) => item.assetId)).toEqual([0, 1]);
  });

  it("fetches Hyperliquid meta from the selected info endpoint", async () => {
    const calls: Array<{ input: string; init: RequestInit }> = [];
    const fetcher = async (input: string, init: RequestInit) => {
      calls.push({ input, init });
      return {
        ok: true,
        status: 200,
        json: async () => metaFixture,
      };
    };

    const meta = await fetchHyperliquidMeta({ network: "TESTNET", fetcher });

    expect(calls[0]).toMatchObject({
      input: "https://api.hyperliquid-testnet.xyz/info",
      init: {
        method: "POST",
        body: JSON.stringify({ type: "meta" }),
      },
    });
    expect(meta.universe).toHaveLength(3);
  });
});
