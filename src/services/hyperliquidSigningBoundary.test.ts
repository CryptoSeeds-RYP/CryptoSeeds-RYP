import { describe, expect, it } from "vitest";
import {
  buildHyperliquidAgentApprovalPreview,
  buildHyperliquidCancelOrderDraft,
  buildHyperliquidOrderStatusQuery,
  buildHyperliquidUnsignedOrderDraft,
} from "./hyperliquidAdapter";
import {
  buildHyperliquidAgentApprovalSigningIntent,
  buildHyperliquidL1SigningIntent,
  buildHyperliquidReadOnlyStatusIntent,
} from "./hyperliquidSigningBoundary";

const wallet = "0x1111111111111111111111111111111111111111";
const agent = "0x2222222222222222222222222222222222222222";

describe("hyperliquid signing boundary", () => {
  it("blocks L1 signing intents until the unsigned draft is ready", () => {
    const draft = buildHyperliquidCancelOrderDraft({
      assetId: 0,
      oid: 123,
      nonce: 1_000,
      expiresAfter: 2_000,
    });

    const intent = buildHyperliquidL1SigningIntent({
      draft,
      signerAddress: agent,
      accountAddress: wallet,
    });

    expect(intent).toMatchObject({
      status: "BLOCKED",
      scheme: "L1_ACTION",
      sdkRequired: true,
      sdkMethod: "sign_l1_action",
      blockedReasons: [
        "Signed execution feature flag is disabled.",
        "Draft is not ready for signature.",
        "Unsigned request payload is missing.",
      ],
    });
    expect(intent.broadcastEndpoint).toBeUndefined();
  });

  it("builds a testnet approved-agent signing intent for a ready order draft", () => {
    const draft = buildHyperliquidUnsignedOrderDraft({
      asset: { symbol: "SOL", assetId: 0, tradable: true },
      side: "BUY",
      price: "100",
      size: "0.5",
      nonce: 1_000,
      expiresAfter: 2_000,
      signedExecutionEnabled: true,
    });

    const intent = buildHyperliquidL1SigningIntent({
      draft,
      signerAddress: agent,
      accountAddress: wallet,
    });

    expect(intent).toMatchObject({
      status: "READY_FOR_AGENT",
      network: "TESTNET",
      route: "APPROVED_AGENT",
      signerAddress: agent,
      accountAddress: wallet,
      broadcastEndpoint: "https://api.hyperliquid-testnet.xyz/exchange",
      sdkMethod: "sign_l1_action",
    });
    expect(intent.safetyChecklist).toContain(
      "Use the official Hyperliquid SDK signing path; do not hand-roll msgpack/EIP-712 serialization.",
    );
  });

  it("blocks mainnet L1 signing unless explicitly allowed", () => {
    const draft = buildHyperliquidUnsignedOrderDraft({
      asset: { symbol: "ETH", assetId: 4, tradable: true },
      side: "SELL",
      price: "2500",
      size: "0.1",
      nonce: 1_000,
      expiresAfter: 2_000,
      network: "MAINNET",
      signedExecutionEnabled: true,
    });

    const blocked = buildHyperliquidL1SigningIntent({
      draft,
      signerAddress: agent,
      accountAddress: wallet,
    });
    const allowed = buildHyperliquidL1SigningIntent({
      draft,
      signerAddress: agent,
      accountAddress: wallet,
      allowMainnet: true,
    });

    expect(blocked.blockedReasons).toContain("Mainnet signing is disabled for this integration stage.");
    expect(allowed.status).toBe("READY_FOR_AGENT");
  });

  it("models master-wallet approval for a named agent without storing keys", () => {
    const approval = buildHyperliquidAgentApprovalPreview({
      agentAddress: agent,
      agentName: "CryptoSeeds Test Agent",
    });

    const intent = buildHyperliquidAgentApprovalSigningIntent({
      approval,
      masterWalletAddress: wallet,
    });

    expect(intent).toMatchObject({
      status: "READY_FOR_WALLET",
      scheme: "AGENT_APPROVAL",
      route: "MASTER_WALLET",
      sdkMethod: "approve_agent",
      signerAddress: wallet,
      accountAddress: wallet,
    });
    expect(intent.safetyChecklist).toContain(
      "Generate agent credentials outside the browser UI and never persist private keys in CryptoSeeds.",
    );
  });

  it("blocks placeholder agent approval addresses", () => {
    const approval = buildHyperliquidAgentApprovalPreview();

    const intent = buildHyperliquidAgentApprovalSigningIntent({
      approval,
      masterWalletAddress: wallet,
    });

    expect(intent.status).toBe("BLOCKED");
    expect(intent.blockedReasons).toContain("Agent address must be generated outside the UI before approval.");
  });

  it("keeps order-status queries read-only", () => {
    const query = buildHyperliquidOrderStatusQuery({ user: wallet, oid: 123 });
    const intent = buildHyperliquidReadOnlyStatusIntent({ query });

    expect(intent).toMatchObject({
      status: "READY",
      signatureRequired: false,
      unsignedPayload: { type: "orderStatus", user: wallet, oid: 123 },
    });
    expect(intent.safetyChecklist).toContain("Read-only status queries must not request a signature.");
  });
});
