import { readFile } from "node:fs/promises";
import { PublicKey } from "@solana/web3.js";

const tierRules = [
  { tier: "CANOPY", minimum: 100_000_000_000n, cadence: "WEEKLY" },
  { tier: "SPROUT", minimum: 20_000_000_000n, cadence: "WEEKLY" },
  { tier: "SEED", minimum: 5_000_000_000n, cadence: "MONTHLY" },
  { tier: "SMALL", minimum: 500_000_000n, cadence: "QUARTERLY" },
  { tier: "MICRO", minimum: 0n, cadence: "CLAIM_ONLY" },
];

const [, , inputPath] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/prepare-holder-reward-epoch.mjs <epoch-input.json>");
  process.exit(1);
}

const input = JSON.parse(await readFile(inputPath, "utf8"));
validateRawInput(input);
const draft = buildDraft(input);

console.log(JSON.stringify(draft, null, 2));

if (!draft.validation.valid) {
  process.exitCode = 1;
}

function buildDraft(input) {
  const holderEpoch = buildHolderEpoch(input);
  const validation = validateDraft(input, holderEpoch);

  return {
    exportVersion: "reward-epoch-draft/v1",
    id: input.id,
    label: input.label,
    status: validation.valid ? "REVIEW_REQUIRED" : "BLOCKED",
    createdAt: input.createdAt,
    executionBlocked: true,
    rewardMint: input.rewardMint,
    holderPolicyLabel: "Passive Holder Rewards",
    holderEpoch,
    vaults: input.vaults ?? [],
    validation,
  };
}

function buildHolderEpoch(input) {
  const rewardPool = BigInt(input.rewardPoolBaseUnits);
  const deliveryCost = BigInt(input.estimatedDeliveryCostPerPayoutBaseUnits);
  const minimumNet = BigInt(input.minimumNetPayoutBaseUnits);
  const scheduledCadences = input.scheduledCadences ?? ["WEEKLY"];
  const entries = input.entries ?? [];
  const eligible = entries.filter((entry) => !entry.excluded && BigInt(entry.rypBalanceBaseUnits) > 0n);
  const totalEligible = eligible.reduce((total, entry) => total + BigInt(entry.rypBalanceBaseUnits), 0n);

  if (totalEligible === 0n) {
    return serializeEpoch({
      id: input.id,
      rewardMint: input.rewardMint,
      snapshotTakenAt: input.snapshotTakenAt,
      totalEligibleRypBaseUnits: 0n,
      rewardPoolBaseUnits: rewardPool,
      distributedNetBaseUnits: 0n,
      reservedDeliveryCostBaseUnits: 0n,
      rolledForwardBaseUnits: rewardPool,
      payouts: entries.map((entry) => excludedPayout(entry, "No eligible holder balance in epoch.")),
    });
  }

  let allocatedGross = 0n;
  let eligibleIndex = 0;
  const payouts = entries.map((entry) => {
    const balance = BigInt(entry.rypBalanceBaseUnits);

    if (entry.excluded) {
      return excludedPayout(entry, entry.exclusionReason ?? "Excluded from holder rewards.");
    }
    if (balance <= 0n) {
      return excludedPayout(entry, "Wallet has no eligible RYP balance in the snapshot.");
    }

    const isLastEligible = eligibleIndex === eligible.length - 1;
    const gross = isLastEligible ? rewardPool - allocatedGross : (rewardPool * balance) / totalEligible;
    allocatedGross += gross;
    eligibleIndex += 1;

    return netCostPayout({
      walletAddress: entry.walletAddress,
      balance,
      gross,
      deliveryCost,
      minimumNet,
      scheduledCadences,
    });
  });

  const distributedNet = payouts.reduce((total, payout) => total + BigInt(payout.netPayoutBaseUnits), 0n);
  const reservedDeliveryCost = payouts.reduce((total, payout) => total + BigInt(payout.deliveryCostBaseUnits), 0n);
  const rolledForward = rewardPool - distributedNet - reservedDeliveryCost;

  return serializeEpoch({
    id: input.id,
    rewardMint: input.rewardMint,
    snapshotTakenAt: input.snapshotTakenAt,
    totalEligibleRypBaseUnits: totalEligible,
    rewardPoolBaseUnits: rewardPool,
    distributedNetBaseUnits: distributedNet,
    reservedDeliveryCostBaseUnits: reservedDeliveryCost,
    rolledForwardBaseUnits: rolledForward,
    payouts,
  });
}

function netCostPayout({ walletAddress, balance, gross, deliveryCost, minimumNet, scheduledCadences }) {
  const tier = tierForBalance(balance);
  if (!scheduledCadences.includes(tier.cadence)) {
    return serializePayout({
      walletAddress,
      holderTier: tier.tier,
      payoutCadence: tier.cadence,
      rypBalanceBaseUnits: balance,
      grossAllocationBaseUnits: gross,
      deliveryCostBaseUnits: 0n,
      netPayoutBaseUnits: 0n,
      rolledForwardBaseUnits: gross,
      status: "ROLL_FORWARD",
      reason: `${tier.tier} holder uses ${tier.cadence.toLowerCase().replace("_", " ")} payout cadence.`,
    });
  }

  if (gross <= deliveryCost) {
    return serializePayout({
      walletAddress,
      holderTier: tier.tier,
      payoutCadence: tier.cadence,
      rypBalanceBaseUnits: balance,
      grossAllocationBaseUnits: gross,
      deliveryCostBaseUnits: 0n,
      netPayoutBaseUnits: 0n,
      rolledForwardBaseUnits: gross,
      status: "ROLL_FORWARD",
      reason: "Gross allocation does not clear estimated delivery cost.",
    });
  }

  const net = gross - deliveryCost;
  if (net < minimumNet) {
    return serializePayout({
      walletAddress,
      holderTier: tier.tier,
      payoutCadence: tier.cadence,
      rypBalanceBaseUnits: balance,
      grossAllocationBaseUnits: gross,
      deliveryCostBaseUnits: 0n,
      netPayoutBaseUnits: 0n,
      rolledForwardBaseUnits: gross,
      status: "ROLL_FORWARD",
      reason: "Net payout is below the minimum; allocation rolls forward.",
    });
  }

  return serializePayout({
    walletAddress,
    holderTier: tier.tier,
    payoutCadence: tier.cadence,
    rypBalanceBaseUnits: balance,
    grossAllocationBaseUnits: gross,
    deliveryCostBaseUnits: deliveryCost,
    netPayoutBaseUnits: net,
    rolledForwardBaseUnits: 0n,
    status: "PAY_NOW",
    reason: "Net payout clears delivery cost and minimum threshold.",
  });
}

function excludedPayout(entry, reason) {
  const balance = BigInt(entry.rypBalanceBaseUnits);
  const tier = tierForBalance(balance);

  return serializePayout({
    walletAddress: entry.walletAddress,
    holderTier: tier.tier,
    payoutCadence: tier.cadence,
    rypBalanceBaseUnits: balance,
    grossAllocationBaseUnits: 0n,
    deliveryCostBaseUnits: 0n,
    netPayoutBaseUnits: 0n,
    rolledForwardBaseUnits: 0n,
    status: "EXCLUDED",
    reason,
  });
}

function validateDraft(input, holderEpoch) {
  const blockers = [];
  const warnings = [];
  const roles = new Map();
  const addresses = new Set();
  const requiredRoles = [
    "HOLDER_REWARD",
    "STAKER_REWARD",
    "INDEPENDENT_TREASURY",
    "DELIVERY_COST_RESERVE",
    "ROLLOVER",
  ];

  for (const vault of input.vaults ?? []) {
    roles.set(vault.role, (roles.get(vault.role) ?? 0) + 1);
    if (vault.rewardMint !== input.rewardMint) blockers.push(`${vault.label} reward mint does not match epoch mint.`);
    if (vault.receivesUserFunds !== false) blockers.push(`${vault.label} must not be marked as receiving user funds.`);
    if (vault.status === "DISABLED") blockers.push(`${vault.label} is disabled.`);
    if (vault.status !== "VERIFIED" && vault.status !== "DISABLED") warnings.push(`${vault.label} is not verified yet.`);
    if (vault.custodyModel === "DISCLOSURE_PENDING") warnings.push(`${vault.label} custody model needs verification.`);
    if (!vault.address) warnings.push(`${vault.label} address is not configured yet.`);
    if (vault.address && addresses.has(vault.address)) blockers.push(`${vault.label} reuses a vault address already assigned in this draft.`);
    if (vault.address) addresses.add(vault.address);
  }

  for (const role of requiredRoles) {
    const count = roles.get(role) ?? 0;
    if (count === 0) blockers.push(`Missing reward vault role: ${role}.`);
    if (count > 1) blockers.push(`Duplicate reward vault role: ${role}.`);
  }

  const balanced =
    BigInt(holderEpoch.distributedNetBaseUnits) +
      BigInt(holderEpoch.reservedDeliveryCostBaseUnits) +
      BigInt(holderEpoch.rolledForwardBaseUnits) ===
    BigInt(holderEpoch.rewardPoolBaseUnits);
  if (!balanced) blockers.push("Holder epoch accounting is not balanced.");

  return {
    valid: blockers.length === 0,
    blockers,
    warnings,
  };
}

function validateRawInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Reward epoch input must be a JSON object.");
  }
  if (!String(input.id ?? "").trim()) {
    throw new Error("Reward epoch id cannot be empty.");
  }
  canonicalPublicKey(input.rewardMint, "Reward mint");
  validateIsoDate(input.createdAt, "Created timestamp");
  validateIsoDate(input.snapshotTakenAt, "Snapshot timestamp");
  parseBaseUnits(input.rewardPoolBaseUnits, "Reward pool", { allowZero: false });
  parseBaseUnits(input.estimatedDeliveryCostPerPayoutBaseUnits, "Estimated delivery cost", { allowZero: true });
  parseBaseUnits(input.minimumNetPayoutBaseUnits, "Minimum net payout", { allowZero: true });
  validateScheduledCadences(input.scheduledCadences ?? ["WEEKLY"]);
  validateSnapshotEntries(input.entries ?? []);
  validateVaultPublicKeys(input.vaults ?? []);
}

function validateSnapshotEntries(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("Snapshot entries must be an array.");
  }

  const seenWallets = new Set();
  for (const [index, entry] of entries.entries()) {
    const wallet = canonicalPublicKey(entry?.walletAddress, `Snapshot wallet ${index}`);
    if (seenWallets.has(wallet)) {
      throw new Error(`Duplicate snapshot wallet address: ${wallet}.`);
    }
    seenWallets.add(wallet);
    parseBaseUnits(entry?.rypBalanceBaseUnits, `Snapshot balance for ${wallet}`, { allowZero: true });
    if (entry?.excluded && !String(entry.exclusionReason ?? "").trim()) {
      throw new Error(`Excluded snapshot wallet ${wallet} must include an exclusion reason.`);
    }
  }
}

function validateVaultPublicKeys(vaults) {
  if (!Array.isArray(vaults)) {
    throw new Error("Reward vaults must be an array.");
  }

  const seenVaultAddresses = new Set();
  for (const vault of vaults) {
    if (vault?.rewardMint !== undefined) canonicalPublicKey(vault.rewardMint, `${vault.label ?? vault.role ?? "Vault"} reward mint`);
    if (vault?.address) {
      const address = canonicalPublicKey(vault.address, `${vault.label ?? vault.role ?? "Vault"} address`);
      if (seenVaultAddresses.has(address)) {
        throw new Error(`Duplicate reward vault address: ${address}.`);
      }
      seenVaultAddresses.add(address);
    }
  }
}

function validateScheduledCadences(cadences) {
  if (!Array.isArray(cadences) || cadences.length === 0) {
    throw new Error("Scheduled cadences must be a non-empty array.");
  }

  const allowed = new Set(["WEEKLY", "MONTHLY", "QUARTERLY", "CLAIM_ONLY"]);
  const seen = new Set();
  for (const cadence of cadences) {
    if (!allowed.has(cadence)) {
      throw new Error(`Unsupported holder reward cadence: ${cadence}.`);
    }
    if (seen.has(cadence)) {
      throw new Error(`Duplicate holder reward cadence: ${cadence}.`);
    }
    seen.add(cadence);
  }
}

function validateIsoDate(value, label) {
  const date = String(value ?? "").trim();
  if (!date || Number.isNaN(Date.parse(date))) {
    throw new Error(`${label} must be a valid ISO date.`);
  }
}

function parseBaseUnits(value, label, { allowZero }) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be a non-negative integer base-unit amount.`);
  }
  const amount = BigInt(text);
  if (!allowZero && amount === 0n) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return amount;
}

function canonicalPublicKey(value, label) {
  try {
    return new PublicKey(String(value ?? "").trim()).toBase58();
  } catch {
    throw new Error(`${label} must be a valid Solana public key.`);
  }
}

function tierForBalance(balance) {
  return tierRules.find((rule) => balance >= rule.minimum) ?? tierRules[tierRules.length - 1];
}

function serializeEpoch(epoch) {
  return {
    ...epoch,
    totalEligibleRypBaseUnits: epoch.totalEligibleRypBaseUnits.toString(),
    rewardPoolBaseUnits: epoch.rewardPoolBaseUnits.toString(),
    distributedNetBaseUnits: epoch.distributedNetBaseUnits.toString(),
    reservedDeliveryCostBaseUnits: epoch.reservedDeliveryCostBaseUnits.toString(),
    rolledForwardBaseUnits: epoch.rolledForwardBaseUnits.toString(),
  };
}

function serializePayout(payout) {
  return {
    ...payout,
    rypBalanceBaseUnits: payout.rypBalanceBaseUnits.toString(),
    grossAllocationBaseUnits: payout.grossAllocationBaseUnits.toString(),
    deliveryCostBaseUnits: payout.deliveryCostBaseUnits.toString(),
    netPayoutBaseUnits: payout.netPayoutBaseUnits.toString(),
    rolledForwardBaseUnits: payout.rolledForwardBaseUnits.toString(),
  };
}
