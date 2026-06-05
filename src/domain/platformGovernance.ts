import type { StakingTier } from "./microverse";
import {
  PLATFORM_ACTION_BASE_FEE_BPS,
  RYP_TOKEN_TRANSFER_FEE_BPS,
  coreFeeBuckets,
  effectivePlatformActionFeeBps,
  type CoreFeeBucket,
} from "./feeRouter";

export type PlatformBoundary = {
  id: string;
  label: string;
  status: string;
  detail: string;
};

export type AuthorityControl = {
  id: string;
  label: string;
  currentState: "MVP_LOCALNET" | "DISABLED" | "CONFIGURABLE" | "DISCLOSURE_REQUIRED";
  targetControl: string;
  userFundCustody: false;
  publicLogRequired: boolean;
};

export type ReviewGate = {
  id: string;
  label: string;
  status: "BLOCKED_UNTIL_REVIEW" | "DISCLOSURE_REQUIRED" | "DESIGN_ONLY";
  reason: string;
};

export type FeeSplitBucket = CoreFeeBucket;

export type PlatformFeePolicy = {
  baseFeeBps: number;
  tokenTransferFeeBps: number;
  splitBuckets: FeeSplitBucket[];
  exactSplitStatus: "CONFIGURABLE_NOT_FINAL";
  tierEffectiveFeesBps: Record<StakingTier, number>;
  tokenTransferFeeNotes: string[];
  seedBotSuccessFeePreviewBps: number;
  seedBotSuccessFeeSplit: {
    devSharePercent: number;
    treasurySharePercent: number;
  };
};

export type PlatformGovernanceValidation = {
  valid: boolean;
  blockers: string[];
};

export const platformBoundaries: PlatformBoundary[] = [
  {
    id: "user-custody",
    label: "User Assets",
    status: "Wallet Controlled",
    detail: "Users hold assets in their own wallets and approve transactions through Phantom, MetaMask, or another supported route.",
  },
  {
    id: "project-owner-accounts",
    label: "Project Owners",
    status: "Own Accounts",
    detail: "Project owners and charities should use disclosed receiving wallets or contracts; CryptoSeeds acts as the discovery and access layer.",
  },
  {
    id: "independent-treasury",
    label: "Treasury",
    status: "Independent",
    detail: "Treasury accounts should be separated from founder, operator, project-owner, and charity wallets with public labels.",
  },
  {
    id: "transparent-platform-fees",
    label: "Platform Fees",
    status: "Visible",
    detail: "Platform and tool fees must be previewed before wallet approval and recorded through transparent policy.",
  },
];

export const platformFeePolicy: PlatformFeePolicy = {
  baseFeeBps: PLATFORM_ACTION_BASE_FEE_BPS,
  tokenTransferFeeBps: RYP_TOKEN_TRANSFER_FEE_BPS,
  splitBuckets: coreFeeBuckets,
  exactSplitStatus: "CONFIGURABLE_NOT_FINAL",
  tierEffectiveFeesBps: {
    NONE: effectivePlatformActionFeeBps("NONE"),
    SEED: effectivePlatformActionFeeBps("SEED"),
    SPROUT: effectivePlatformActionFeeBps("SPROUT"),
    SAPLING: effectivePlatformActionFeeBps("SAPLING"),
    TREE: effectivePlatformActionFeeBps("TREE"),
    FRUIT: effectivePlatformActionFeeBps("FRUIT"),
  },
  tokenTransferFeeNotes: [
    "Target RYP transfer fee is 1% with the same holder, staker, and independent treasury buckets.",
    "App and protocol actions can preview and route this fee before wallet approval.",
    "Enforcement on every raw token transfer requires a reviewed wrapper, migration, or token-extension route.",
  ],
  seedBotSuccessFeePreviewBps: 1200,
  seedBotSuccessFeeSplit: {
    devSharePercent: 40,
    treasurySharePercent: 60,
  },
};

export const authorityControls: AuthorityControl[] = [
  {
    id: "protocol-pause",
    label: "Emergency Pause",
    currentState: "MVP_LOCALNET",
    targetControl: "Multisig authority with public incident log; emergency path only.",
    userFundCustody: false,
    publicLogRequired: true,
  },
  {
    id: "fee-parameters",
    label: "Fee Parameters",
    currentState: "CONFIGURABLE",
    targetControl: "Multisig plus timelock before non-emergency fee or split changes.",
    userFundCustody: false,
    publicLogRequired: true,
  },
  {
    id: "project-registry",
    label: "Project Registry",
    currentState: "DISCLOSURE_REQUIRED",
    targetControl: "Operator disclosure, document hashes, risk labels, and governance approval.",
    userFundCustody: false,
    publicLogRequired: true,
  },
  {
    id: "treasury-wallets",
    label: "Treasury Wallets",
    currentState: "DISCLOSURE_REQUIRED",
    targetControl: "Independent multisig wallets with labels, allocation policy, and reporting cadence.",
    userFundCustody: false,
    publicLogRequired: true,
  },
  {
    id: "seedbot-permissions",
    label: "SeedBot Permissions",
    currentState: "DISABLED",
    targetControl: "Revocable permission registry before guarded automation or live execution.",
    userFundCustody: false,
    publicLogRequired: true,
  },
];

export const reviewGates: ReviewGate[] = [
  {
    id: "seedbot-success-fee",
    label: "SeedBot Success Fee",
    status: "BLOCKED_UNTIL_REVIEW",
    reason: "Profit-based fees, strategy access, and automation require legal and security review before live use.",
  },
  {
    id: "project-financial-rights",
    label: "Project Financial Rights",
    status: "BLOCKED_UNTIL_REVIEW",
    reason: "Any revenue entitlement, SPV, equity, debt, or tokenized real-world rights must be separately reviewed.",
  },
  {
    id: "founder-token-disclosure",
    label: "Founder Token Holdings",
    status: "DISCLOSURE_REQUIRED",
    reason: "Founder, operator, advisor, project-owner, treasury, and community allocations need public labels and lockup policy.",
  },
  {
    id: "guarded-automation",
    label: "Guarded Automation",
    status: "DESIGN_ONLY",
    reason: "Automation remains capped, revocable, and disabled until the permission model is implemented and reviewed.",
  },
];

export function allControlsAvoidUserFundCustody() {
  return authorityControls.every((control) => control.userFundCustody === false);
}

export function materialControlsRequirePublicLogs() {
  return authorityControls.every((control) => control.publicLogRequired);
}

export function validatePlatformGovernancePosture({
  boundaries = platformBoundaries,
  controls = authorityControls,
  gates = reviewGates,
}: {
  boundaries?: PlatformBoundary[];
  controls?: AuthorityControl[];
  gates?: ReviewGate[];
} = {}): PlatformGovernanceValidation {
  const blockers = [
    ...duplicateIdBlockers("platform boundary", boundaries),
    ...duplicateIdBlockers("authority control", controls),
    ...duplicateIdBlockers("review gate", gates),
  ];

  if (!controls.every((control) => control.userFundCustody === false)) {
    blockers.push("Authority controls must not custody user funds.");
  }
  if (!controls.every((control) => control.publicLogRequired)) {
    blockers.push("Authority controls must require public logs.");
  }

  return {
    valid: blockers.length === 0,
    blockers,
  };
}

function duplicateIdBlockers(label: string, items: Array<{ id: string }>) {
  const blockers: string[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    const id = item.id.trim().toLowerCase();
    if (!id) {
      blockers.push(`${label} id cannot be empty.`);
      continue;
    }
    if (seenIds.has(id)) {
      blockers.push(`Duplicate ${label} id: ${item.id}.`);
    }
    seenIds.add(id);
  }

  return blockers;
}
