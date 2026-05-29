export type SeedBotVenueId = "HYPERLIQUID" | "GRVT" | "ANTARCTIC" | "JUPITER";

export type SeedBotVenueStatus = "RECOMMENDED_PILOT" | "SECONDARY_PILOT" | "DUE_DILIGENCE" | "SOLANA_SPOT";

export type SeedBotVenue = {
  id: SeedBotVenueId;
  name: string;
  status: SeedBotVenueStatus;
  apiReady: boolean;
  clientCustodyModel: string;
  walletRoutes: Array<"EVM" | "EIP_712" | "PHANTOM">;
  bestUse: string;
  caution: string;
  docsUrl?: string;
};

export const seedBotVenues: SeedBotVenue[] = [
  {
    id: "HYPERLIQUID",
    name: "Hyperliquid",
    status: "RECOMMENDED_PILOT",
    apiReady: true,
    clientCustodyModel: "Client-controlled account with signed API/agent execution; no platform-held user keys.",
    walletRoutes: ["EVM"],
    bestUse: "Primary active strategy venue for liquid perps/spot-style strategy execution.",
    caution: "Use strict risk caps, no withdrawals through automation, and explicit user authorization.",
    docsUrl: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api",
  },
  {
    id: "GRVT",
    name: "GRVT",
    status: "SECONDARY_PILOT",
    apiReady: true,
    clientCustodyModel: "Self-custodial account flow with EIP-712 wallet login and trading API sessions.",
    walletRoutes: ["EIP_712", "EVM"],
    bestUse: "Secondary pilot for orderbook/RFQ strategies and privacy-oriented execution research.",
    caution: "Integration complexity is higher; validate account, sub-account, API-key, and settlement flows first.",
    docsUrl: "https://api-docs.grvt.io/trading_api/",
  },
  {
    id: "ANTARCTIC",
    name: "Antarctic Exchange",
    status: "DUE_DILIGENCE",
    apiReady: false,
    clientCustodyModel: "Unverified until official API, custody, permission, and security documentation is confirmed.",
    walletRoutes: ["EVM"],
    bestUse: "Do not use for client execution until formal venue review is complete.",
    caution: "Blocked pending official API docs, security model, supported jurisdictions, and liquidity review.",
  },
  {
    id: "JUPITER",
    name: "Jupiter",
    status: "SOLANA_SPOT",
    apiReady: true,
    clientCustodyModel: "Phantom/Solana wallet-approved swap routing.",
    walletRoutes: ["PHANTOM"],
    bestUse: "RYP/Solana spot routing and non-custodial wallet-approved swaps.",
    caution: "Use for Solana spot routes, not as the main perps strategy venue.",
    docsUrl: "https://dev.jup.ag/docs/swap",
  },
];

export function recommendedSeedBotVenue() {
  return seedBotVenues.find((venue) => venue.status === "RECOMMENDED_PILOT")!;
}

export function publicClientExecutionVenues() {
  return seedBotVenues.filter((venue) => venue.status !== "DUE_DILIGENCE");
}

export function venueById(id: SeedBotVenueId) {
  return seedBotVenues.find((venue) => venue.id === id);
}
