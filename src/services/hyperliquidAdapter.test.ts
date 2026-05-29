import { describe, expect, it } from "vitest";
import { buildHyperliquidUnsignedOrderDraft } from "./hyperliquidAdapter";

describe("hyperliquid adapter signed-order draft", () => {
  it("blocks signed order drafts when the execution flag is disabled", () => {
    const draft = buildHyperliquidUnsignedOrderDraft({
      asset: { symbol: "SOL", assetId: 0, tradable: true },
      side: "BUY",
      price: "100.50",
      size: "0.25",
      nonce: 1_000,
      expiresAfter: 2_000,
    });

    expect(draft).toMatchObject({
      status: "BLOCKED",
      blockedReasons: ["Signed execution feature flag is disabled."],
    });
    expect(draft.request).toBeUndefined();
  });

  it("builds a signable testnet order request when all gates pass", () => {
    const draft = buildHyperliquidUnsignedOrderDraft({
      asset: { symbol: "ETH", assetId: 4, tradable: true },
      side: "SELL",
      price: "2500.00",
      size: "0.10",
      nonce: 1_000,
      expiresAfter: 2_000,
      signedExecutionEnabled: true,
    });

    expect(draft).toMatchObject({
      status: "READY_FOR_SIGNATURE",
      network: "TESTNET",
      exchangeEndpoint: "https://api.hyperliquid-testnet.xyz/exchange",
      request: {
        action: {
          type: "order",
          orders: [
            {
              a: 4,
              b: false,
              p: "2500.00",
              s: "0.10",
              r: false,
              t: { limit: { tif: "Ioc" } },
            },
          ],
          grouping: "na",
        },
        nonce: 1_000,
        expiresAfter: 2_000,
        signature: "SIGNATURE_REQUIRED",
      },
    });
  });

  it("blocks invalid assets and unsafe order fields before a signature can exist", () => {
    const draft = buildHyperliquidUnsignedOrderDraft({
      asset: { symbol: "OLD", assetId: 2, tradable: false, blockedReason: "Asset is delisted on Hyperliquid." },
      side: "BUY",
      price: "0",
      size: "-1",
      nonce: 2_000,
      expiresAfter: 1_000,
      signedExecutionEnabled: true,
    });

    expect(draft.status).toBe("BLOCKED");
    expect(draft.blockedReasons).toEqual([
      "Asset is delisted on Hyperliquid.",
      "Order price must be a positive decimal string.",
      "Order size must be a positive decimal string.",
      "expiresAfter must be a millisecond timestamp after nonce.",
    ]);
  });
});
