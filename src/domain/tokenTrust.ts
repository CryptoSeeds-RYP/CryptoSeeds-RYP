import { RYP_CONFIRMED_SUPPLY, RYP_DECIMALS, RYP_MINT_ADDRESS } from "./token";

export type TokenTrustStatus = "VERIFIED" | "REVIEW_REQUIRED" | "BLOCKED";

export type TokenTrustCheck = {
  id: string;
  label: string;
  status: TokenTrustStatus;
  detail: string;
};

export type TokenTrustProfile = {
  mintAddress: string;
  decimals: number;
  confirmedSupply: string;
  ownerProgram: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  custodyModel: "SELF_CUSTODIAL";
  transferFeeRoute: "PROTOCOL_ROUTE_OR_WRAPPER_REQUIRED";
};

export const RYP_TRUST_PROFILE: TokenTrustProfile = {
  mintAddress: RYP_MINT_ADDRESS,
  decimals: RYP_DECIMALS,
  confirmedSupply: RYP_CONFIRMED_SUPPLY,
  ownerProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  mintAuthority: null,
  freezeAuthority: null,
  custodyModel: "SELF_CUSTODIAL",
  transferFeeRoute: "PROTOCOL_ROUTE_OR_WRAPPER_REQUIRED",
};

export function buildTokenTrustChecks(profile: TokenTrustProfile = RYP_TRUST_PROFILE): TokenTrustCheck[] {
  return [
    {
      id: "fixed-supply",
      label: "Fixed Supply",
      status: profile.mintAuthority === null ? "VERIFIED" : "BLOCKED",
      detail: profile.mintAuthority === null
        ? `Mint authority disabled; current confirmed supply is ${profile.confirmedSupply} RYP.`
        : "Mint authority is still active.",
    },
    {
      id: "freeze-disabled",
      label: "Freeze Disabled",
      status: profile.freezeAuthority === null ? "VERIFIED" : "BLOCKED",
      detail: profile.freezeAuthority === null
        ? "Freeze authority disabled; the mint cannot freeze token accounts through this authority."
        : "Freeze authority is still active.",
    },
    {
      id: "self-custody",
      label: "Self Custody",
      status: profile.custodyModel === "SELF_CUSTODIAL" ? "VERIFIED" : "BLOCKED",
      detail: "Users keep wallet custody; the app must never request seed phrases or private keys.",
    },
    {
      id: "transfer-fee-route",
      label: "1% Fee Route",
      status: profile.transferFeeRoute === "PROTOCOL_ROUTE_OR_WRAPPER_REQUIRED" ? "REVIEW_REQUIRED" : "BLOCKED",
      detail:
        "Legacy SPL transfer-level fees need a reviewed protocol route, wrapper, migration, or token-extension path.",
    },
  ];
}

export function tokenTrustSummary(checks = buildTokenTrustChecks()) {
  const blocked = checks.filter((check) => check.status === "BLOCKED").length;
  const reviewRequired = checks.filter((check) => check.status === "REVIEW_REQUIRED").length;
  const verified = checks.filter((check) => check.status === "VERIFIED").length;

  return {
    status: blocked > 0 ? "BLOCKED" : reviewRequired > 0 ? "REVIEW_REQUIRED" : "VERIFIED",
    blocked,
    reviewRequired,
    verified,
    total: checks.length,
  };
}
