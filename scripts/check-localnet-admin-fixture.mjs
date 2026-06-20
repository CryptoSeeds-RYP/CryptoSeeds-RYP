import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PublicKey } from "@solana/web3.js";

const repoRoot = process.cwd();
const fixturePath = path.resolve(process.argv[2] ?? path.join(repoRoot, "target", "localnet-admin-fixture.json"));
const requiredVaultRoles = new Set([
  "HOLDER_REWARD",
  "STAKER_REWARD",
  "INDEPENDENT_TREASURY",
  "DELIVERY_COST_RESERVE",
  "ROLLOVER",
]);

const blockers = [];

if (!existsSync(fixturePath)) {
  blockers.push(`Fixture file is missing: ${path.relative(repoRoot, fixturePath)}`);
} else {
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
  validateFixture(fixture);
}

const report = {
  status: blockers.length === 0 ? "READY" : "BLOCKED",
  fixture: path.relative(repoRoot, fixturePath),
  blockers,
};

console.log(JSON.stringify(report, null, 2));

if (blockers.length > 0) {
  process.exitCode = 1;
}

function validateFixture(fixture) {
  if (fixture.exportVersion !== "localnet-admin-fixture/v1") {
    blockers.push("Fixture exportVersion must be localnet-admin-fixture/v1.");
  }
  if (!Date.parse(fixture.generatedAt)) {
    blockers.push("Fixture generatedAt must be an ISO date.");
  }
  if (!fixture.rpcUrl?.startsWith("http://127.0.0.1:")) {
    blockers.push("Fixture rpcUrl must point at a local disposable validator.");
  }
  for (const [label, value] of Object.entries({
    programId: fixture.programId,
    mint: fixture.mint,
    config: fixture.accounts?.config,
    rewardConfig: fixture.accounts?.rewardConfig,
    position: fixture.accounts?.position,
    rypVault: fixture.accounts?.rypVault,
  })) {
    if (!isValidPublicKey(value)) blockers.push(`${label} must be a valid Solana public key.`);
  }

  const env = fixture.appEnv ?? {};
  if (env.VITE_SOLANA_CLUSTER !== "localnet") blockers.push("Fixture app env must use localnet.");
  if (env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT !== "localnet") {
    blockers.push("Fixture app env must mark the protocol deployment as localnet.");
  }
  if (env.VITE_CRYPTOSEEDS_PROGRAM_ID !== fixture.programId) {
    blockers.push("Fixture app env program id must match the smoke program id.");
  }
  if (env.VITE_RYP_MINT_ADDRESS !== fixture.mint) {
    blockers.push("Fixture app env RYP mint must match the generated smoke mint.");
  }
  if (env.VITE_SOLANA_BROADCAST_ENABLED !== "false") {
    blockers.push("Fixture app env must keep Solana broadcast disabled.");
  }

  const inspection = fixture.adminRewardInspection;
  if (!inspection) {
    blockers.push("Fixture is missing adminRewardInspection.");
    return;
  }

  if (inspection.executionMode !== "READ_ONLY") blockers.push("Admin reward inspection must be read-only.");
  if (inspection.rewardExecutionExposed !== false) blockers.push("Admin reward inspection must not expose reward execution.");

  const rewardConfig = inspection.rewardConfig;
  if (rewardConfig?.status !== "DECODED") blockers.push("Reward config must be decoded in the fixture.");
  if (rewardConfig?.address !== fixture.accounts?.rewardConfig) {
    blockers.push("Reward config address must match the fixture account map.");
  }

  const rewardConfigDecoded = rewardConfig?.decoded;
  if (rewardConfigDecoded) {
    const splitTotal =
      rewardConfigDecoded.holderSplitBps +
      rewardConfigDecoded.stakerSplitBps +
      rewardConfigDecoded.treasurySplitBps;
    if (splitTotal !== 10_000) blockers.push("Reward config splits must total 10000 bps.");
    if (rewardConfigDecoded.draftOnly !== true) blockers.push("Reward config must remain draft-only.");
  }

  const epoch = inspection.epoch;
  if (epoch?.status !== "DECODED") blockers.push("Reward epoch must be decoded in the fixture.");
  const epochDecoded = epoch?.decoded;
  if (epochDecoded) {
    const safeDraftInspection = epochDecoded.status === "DRAFTED" && epochDecoded.executionBlocked === true;
    const safeReviewedInspection =
      epochDecoded.status === "REVIEWED" &&
      epochDecoded.executionBlocked === false &&
      inspection.executionMode === "READ_ONLY" &&
      inspection.rewardExecutionExposed === false &&
      epochClaimTotalsAreBounded(epochDecoded);
    const safeExpiredInspection =
      epochDecoded.status === "EXPIRED" &&
      epochDecoded.executionBlocked === true &&
      inspection.executionMode === "READ_ONLY" &&
      inspection.rewardExecutionExposed === false &&
      epochClaimTotalsAreBounded(epochDecoded);
    if (!safeDraftInspection && !safeReviewedInspection && !safeExpiredInspection) {
      blockers.push("Reward epoch must be drafted/blocked, reviewed/read-only, or expired/blocked with bounded claim totals.");
    }
    if (!epochAccountingBalances(epochDecoded)) blockers.push("Reward epoch accounting must balance.");
    if (env.VITE_REWARD_INSPECTION_EPOCH_ID !== epochDecoded.epochId) {
      blockers.push("Fixture app env reward inspection epoch id must match the decoded localnet epoch.");
    }
  }

  const vaults = Array.isArray(inspection.vaults) ? inspection.vaults : [];
  if (vaults.length !== requiredVaultRoles.size) {
    blockers.push(`Fixture must contain ${requiredVaultRoles.size} reward vault inspections.`);
  }
  const seenRoles = new Set();
  for (const vault of vaults) {
    seenRoles.add(vault.role);
    if (!requiredVaultRoles.has(vault.role)) blockers.push(`Unexpected reward vault role: ${vault.role}.`);
    if (vault.status !== "DECODED") blockers.push(`${vault.label ?? vault.role} vault must be decoded.`);
    if (vault.verificationStatus !== "VERIFIED") blockers.push(`${vault.label ?? vault.role} vault must be verified.`);
    if (vault.receivesUserFunds !== false) {
      blockers.push(`${vault.label ?? vault.role} vault must not be marked as receiving user funds.`);
    }
    if (!isValidPublicKey(vault.address)) blockers.push(`${vault.label ?? vault.role} vault state address is invalid.`);
    if (!isValidPublicKey(vault.vaultAddress)) blockers.push(`${vault.label ?? vault.role} vault address is invalid.`);
  }
  for (const role of requiredVaultRoles) {
    if (!seenRoles.has(role)) blockers.push(`Fixture is missing reward vault role ${role}.`);
  }
}

function epochAccountingBalances(epoch) {
  try {
    return (
      BigInt(epoch.rewardPoolAmount) ===
      BigInt(epoch.distributedNetAmount) + BigInt(epoch.reservedDeliveryCostAmount ?? 0) + BigInt(epoch.rolledForwardAmount)
    );
  } catch {
    return false;
  }
}

function epochClaimTotalsAreBounded(epoch) {
  try {
    const rewardPool = BigInt(epoch.rewardPoolAmount);
    const distributedNet = BigInt(epoch.distributedNetAmount);
    const recordedGross = BigInt(epoch.recordedGrossAllocationAmount ?? 0);
    const recordedNet = BigInt(epoch.recordedNetClaimAmount ?? 0);
    const claimedNet = BigInt(epoch.claimedNetAmount ?? 0);
    const expiredUnclaimedNet = BigInt(epoch.expiredUnclaimedNetAmount ?? 0);

    return (
      recordedGross <= rewardPool &&
      recordedNet <= distributedNet &&
      claimedNet <= recordedNet &&
      expiredUnclaimedNet <= distributedNet - claimedNet
    );
  } catch {
    return false;
  }
}

function isValidPublicKey(value) {
  if (typeof value !== "string") return false;
  try {
    return new PublicKey(value).toBase58() === value;
  } catch {
    return false;
  }
}
