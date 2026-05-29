import { describe, expect, it } from "vitest";
import {
  buildHyperliquidCancelOrderDraft,
  buildHyperliquidOrderStatusQuery,
  buildHyperliquidScheduleCancelDraft,
  buildHyperliquidUnsignedOrderDraft,
} from "./hyperliquidAdapter";

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

  it("builds order-status queries for wallet-owned order review", () => {
    const query = buildHyperliquidOrderStatusQuery({
      user: "0x1111111111111111111111111111111111111111",
      oid: 123,
    });

    expect(query).toMatchObject({
      status: "READY",
      infoEndpoint: "https://api.hyperliquid-testnet.xyz/info",
      body: {
        type: "orderStatus",
        user: "0x1111111111111111111111111111111111111111",
        oid: 123,
      },
    });
  });

  it("blocks malformed order-status queries", () => {
    const query = buildHyperliquidOrderStatusQuery({
      user: "not-a-wallet",
      oid: "bad-oid",
    });

    expect(query).toMatchObject({
      status: "BLOCKED",
      blockedReasons: [
        "user must be a 42-character EVM address.",
        "Order id must be a positive integer or 16-byte client order id hex string.",
      ],
    });
  });

  it("blocks unsafe numeric identifiers before previewing controls", () => {
    const query = buildHyperliquidOrderStatusQuery({
      user: "0x1111111111111111111111111111111111111111",
      oid: Number.MAX_SAFE_INTEGER + 1,
    });
    const cancel = buildHyperliquidCancelOrderDraft({
      assetId: Number.MAX_SAFE_INTEGER + 1,
      oid: 123,
      nonce: 1_000,
      expiresAfter: 2_000,
      signedExecutionEnabled: true,
    });

    expect(query.blockedReasons).toEqual(["oid must be a positive safe integer."]);
    expect(cancel.blockedReasons).toEqual(["assetId must be a non-negative safe integer."]);
  });

  it("builds cancel drafts only when signed requests are enabled", () => {
    const blocked = buildHyperliquidCancelOrderDraft({
      assetId: 0,
      oid: 123,
      nonce: 1_000,
      expiresAfter: 2_000,
    });

    expect(blocked.status).toBe("BLOCKED");

    const ready = buildHyperliquidCancelOrderDraft({
      assetId: 0,
      oid: 123,
      nonce: 1_000,
      expiresAfter: 2_000,
      signedExecutionEnabled: true,
    });

    expect(ready).toMatchObject({
      status: "READY_FOR_SIGNATURE",
      request: {
        action: {
          type: "cancel",
          cancels: [{ a: 0, o: 123 }],
        },
        signature: "SIGNATURE_REQUIRED",
      },
    });
  });

  it("builds schedule-cancel drafts with the five-second venue guard", () => {
    const blocked = buildHyperliquidScheduleCancelDraft({
      time: 2_000,
      nonce: 1_000,
      expiresAfter: 7_000,
      signedExecutionEnabled: true,
    });

    expect(blocked).toMatchObject({
      status: "BLOCKED",
      blockedReasons: ["scheduleCancel time must be at least 5 seconds after nonce."],
    });

    const ready = buildHyperliquidScheduleCancelDraft({
      time: 7_000,
      nonce: 1_000,
      expiresAfter: 8_000,
      signedExecutionEnabled: true,
    });

    expect(ready).toMatchObject({
      status: "READY_FOR_SIGNATURE",
      request: {
        action: {
          type: "scheduleCancel",
          time: 7_000,
        },
      },
    });
  });
});
