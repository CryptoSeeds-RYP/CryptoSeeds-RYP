import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { keccak_256 } from "@noble/hashes/sha3";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MINT_SIZE = 82;
const TOKEN_ACCOUNT_SIZE = 165;
const RYP_DECIMALS = 6;
const SEED_STAKE_AMOUNT = 5_000_000_000n;
const ADD_TO_SPROUT_AMOUNT = 15_000_000_000n;
const SPROUT_STAKE_AMOUNT = 20_000_000_000n;
const HOLDER_REWARD_CLAIM_AMOUNT = 700n;
const PLATFORM_FEE_ROUTE_AMOUNT = 30_000n;
const PROJECT_MIN_PARTICIPATION_AMOUNT = 100n;
const PROJECT_MAX_WALLET_PARTICIPATION_AMOUNT = 600n;
const PROJECT_MAX_TOTAL_PARTICIPATION_AMOUNT = 1_000n;
const PROJECT_PARTICIPATION_START_TS = 0n;
const PROJECT_PARTICIPATION_END_TS = 4_102_444_800n;
const SEEDBOT_MAX_TRADE_AMOUNT = 500n;
const SEEDBOT_MAX_DAILY_VOLUME_AMOUNT = 1_500n;
const SEEDBOT_MAX_DAILY_TRADES = 3;
const SEEDBOT_MAX_SLIPPAGE_BPS = 100;
const REWARD_CLAIM_WINDOW_SECONDS = 366n * 24n * 60n * 60n;
const PLATFORM_FEE_ROUTE_SPLIT = {
  holder: 10_002n,
  staker: 9_999n,
  treasury: 9_999n,
};
const VOTING_RIGHTS_DELAY_SECONDS = 14n * 24n * 60n * 60n;
const GOVERNANCE_VOTING_WINDOW_SECONDS = 1n;
const GOVERNANCE_MINIMUM_VOTES = 1n;
const REWARD_EPOCH_CADENCE_SECONDS = 7n * 24n * 60n * 60n;
const REWARD_METADATA_HASH = Buffer.alloc(32, 7);
const ZERO_METADATA_HASH = Buffer.alloc(32, 0);
const TIER_THRESHOLDS = [5_000_000_000n, 20_000_000_000n, 50_000_000_000n, 100_000_000_000n, 150_000_000_000n];
const TIER_FEE_REDUCTIONS = [0, 35, 70, 105, 140];
const BASE_FEE_BPS = 350;
const REWARD_SPLIT_BPS = {
  holder: 3_334,
  staker: 3_333,
  treasury: 3_333,
};
const DEMO_WALLET_ADDRESS = "3bmqc6gEdUNmRrANE6w6CuW2ht5Vscy8SGXaLyTLQsy3";
const REWARD_ROLES = [
  { key: "holder", name: "HolderReward", seed: "holder-reward", variant: 0, custodyModel: 0 },
  { key: "staker", name: "StakerReward", seed: "staker-reward", variant: 1, custodyModel: 0 },
  { key: "treasury", name: "IndependentTreasury", seed: "independent-treasury", variant: 2, custodyModel: 1 },
  { key: "delivery", name: "DeliveryCostReserve", seed: "delivery-cost-reserve", variant: 3, custodyModel: 0 },
  { key: "rollover", name: "Rollover", seed: "rollover", variant: 4, custodyModel: 0 },
];

const options = parseOptions(process.argv.slice(2));
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rewardAccountLayouts = JSON.parse(
  await readFile(path.join(repoRoot, "src", "solana", "protocolAccountLayouts.json"), "utf8"),
);
const rewardAccountOffsets = Object.fromEntries(
  Object.entries(rewardAccountLayouts).map(([accountName, layout]) => [
    accountName,
    Object.fromEntries(layout.fields.map((field) => [field.name, field.offset])),
  ]),
);
const programId = new PublicKey(await readProgramId());
const programSoPath = resolveProgramSoPath();
const ledgerPath = path.join(repoRoot, "target", "localnet-smoke-ledger");

let validator;
let validatorStderr = "";
let activeConnection;

try {
  await rm(ledgerPath, { force: true, recursive: true });
  const { rpcPort, faucetPort } = await getFreeValidatorPorts();
  const rpcUrl = `http://127.0.0.1:${rpcPort}`;

  log(`starting local validator on ${rpcUrl}`);
  validator = spawnValidator({ faucetPort, rpcPort });
  activeConnection = new Connection(rpcUrl, "confirmed");
  await waitForValidator(activeConnection);

  log("validator ready; running protocol smoke flow");
  const result = await runSmoke(activeConnection);
  if (options.adminFixturePath) {
    await writeAdminFixture(options.adminFixturePath, buildLocalnetAdminFixture({ result, rpcUrl }));
    log(`wrote localnet admin fixture to ${path.relative(repoRoot, path.resolve(options.adminFixturePath))}`);
  }
  console.log(JSON.stringify(result, null, 2));
  if (options.keepAliveMs > 0) {
    log(`keeping local validator alive for ${options.keepAliveMs}ms`);
    await sleep(options.keepAliveMs);
  }
} finally {
  closeConnection();
  await stopValidator();
}

process.exit(0);

function parseOptions(args) {
  const parsed = {
    adminFixturePath: undefined,
    keepAliveMs: 0,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--admin-fixture") {
      parsed.adminFixturePath = args[index + 1];
      index += 1;
      continue;
    }
    if (arg?.startsWith("--admin-fixture=")) {
      parsed.adminFixturePath = arg.slice("--admin-fixture=".length);
      continue;
    }
    if (arg === "--keep-alive-ms") {
      parsed.keepAliveMs = parseKeepAliveMs(args[index + 1]);
      index += 1;
      continue;
    }
    if (arg?.startsWith("--keep-alive-ms=")) {
      parsed.keepAliveMs = parseKeepAliveMs(arg.slice("--keep-alive-ms=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (parsed.adminFixturePath === "") {
    throw new Error("--admin-fixture requires a file path.");
  }

  return parsed;
}

function parseKeepAliveMs(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10 * 60 * 1000) {
    throw new Error("--keep-alive-ms must be an integer between 0 and 600000.");
  }
  return parsed;
}

function buildLocalnetAdminFixture({ result, rpcUrl }) {
  return {
    exportVersion: "localnet-admin-fixture/v1",
    generatedAt: new Date().toISOString(),
    rpcUrl,
    programId: result.programId,
    mint: result.mint,
    accounts: {
      config: result.config,
      rewardConfig: result.rewardConfig,
      position: result.position,
      rypVault: result.rypVault,
    },
    appEnv: {
      VITE_SOLANA_CLUSTER: "localnet",
      VITE_SOLANA_RPC_URL: rpcUrl,
      VITE_RYP_MINT_ADDRESS: result.mint,
      VITE_RYP_DECIMALS: RYP_DECIMALS.toString(),
      VITE_CRYPTOSEEDS_PROGRAM_ID: result.programId,
      VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT: "localnet",
      VITE_DEMO_MODE: "true",
      VITE_SOLANA_BROADCAST_ENABLED: "false",
      VITE_ADMIN_AUTHORITY_ADDRESS: DEMO_WALLET_ADDRESS,
      VITE_REWARD_INSPECTION_EPOCH_ID: result.adminRewardInspection.epoch.decoded.epochId,
    },
    adminRewardInspection: result.adminRewardInspection,
    checked: result.checked,
  };
}

async function writeAdminFixture(filePath, fixture) {
  const outputPath = path.resolve(filePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
}

async function runSmoke(connection) {
  const authority = Keypair.generate();
  const owner = Keypair.generate();
  const intruder = Keypair.generate();
  const newAuthority = Keypair.generate();
  const projectAuthority = Keypair.generate();
  const mint = Keypair.generate();
  log("funding authority and owner wallets");
  await fund(connection, authority.publicKey, 10);
  await fund(connection, owner.publicKey, 10);
  await fund(connection, intruder.publicKey, 10);
  await fund(connection, newAuthority.publicKey, 10);
  await fund(connection, projectAuthority.publicKey, 10);

  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  const [rewardConfig] = PublicKey.findProgramAddressSync([Buffer.from("reward-config")], programId);
  const rewardVaultStates = Object.fromEntries(
    REWARD_ROLES.map((role) => [
      role.key,
      PublicKey.findProgramAddressSync(
        [Buffer.from("reward-vault"), rewardConfig.toBuffer(), Buffer.from(role.seed)],
        programId,
      )[0],
    ]),
  );
  const rewardVaultTokenAccounts = Object.fromEntries(REWARD_ROLES.map((role) => [role.key, Keypair.generate()]));
  const rewardVaultAddresses = Object.fromEntries(
    REWARD_ROLES.map((role) => [role.key, rewardVaultTokenAccounts[role.key].publicKey]),
  );
  const [position] = PublicKey.findProgramAddressSync([Buffer.from("stake-position"), owner.publicKey.toBuffer()], programId);
  const ownerRypAccount = deriveAssociatedTokenAddress({ mint: mint.publicKey, owner: owner.publicKey });
  const intruderRypAccount = deriveAssociatedTokenAddress({ mint: mint.publicKey, owner: intruder.publicKey });
  const rypVault = deriveAssociatedTokenAddress({ mint: mint.publicKey, owner: config });

  log("creating test mint and token accounts");
  await createMint(connection, { authority, mint });
  await createAssociatedTokenAccount(connection, {
    mint: mint.publicKey,
    owner: owner.publicKey,
    payer: authority,
    tokenAccount: ownerRypAccount,
  });
  await createAssociatedTokenAccount(connection, {
    mint: mint.publicKey,
    owner: intruder.publicKey,
    payer: authority,
    tokenAccount: intruderRypAccount,
  });
  await mintTo(connection, {
    amount: SEED_STAKE_AMOUNT + PLATFORM_FEE_ROUTE_AMOUNT,
    authority,
    destination: ownerRypAccount,
    mint: mint.publicKey,
  });
  for (const role of REWARD_ROLES) {
    await createTokenAccount(connection, {
      mint: mint.publicKey,
      owner: rewardConfig,
      payer: authority,
      tokenAccount: rewardVaultTokenAccounts[role.key],
    });
  }
  await mintTo(connection, {
    amount: HOLDER_REWARD_CLAIM_AMOUNT,
    authority,
    destination: rewardVaultAddresses.holder,
    mint: mint.publicKey,
  });

  log("asserting invalid config thresholds are rejected");
  await expectFailure(
    "initialize_config rejects duplicate tier thresholds",
    () =>
      initializeConfig(connection, {
        authority,
        config,
        mint: mint.publicKey,
        rypVault,
        tierThresholds: [5n, 20n, 20n, 100n, 150n],
      }),
    "custom program error: 0x1774",
  );
  await assertMissingAccount(connection, config, "config after rejected initialize_config");

  log("calling initialize_config");
  await initializeConfig(connection, {
    authority,
    config,
    mint: mint.publicKey,
    rypVault,
  });

  const initializedConfig = parseProtocolConfig(await getAccountData(connection, config));
  assertPublicKey("config authority", initializedConfig.authority, authority.publicKey);
  assertPublicKey("initial project authority", initializedConfig.projectAuthority, authority.publicKey);
  assertPublicKey("initial pending project authority", initializedConfig.pendingProjectAuthority, PublicKey.default);
  assertPublicKey("config mint", initializedConfig.rypMint, mint.publicKey);
  assertPublicKey("config vault", initializedConfig.rypVault, rypVault);
  assertEqual("base fee bps", initializedConfig.baseFeeBps, BASE_FEE_BPS);
  assertEqual("initial total staked", initializedConfig.totalStaked, 0n);
  assertEqual("initial pause state", initializedConfig.paused, false);

  log("calling update_fee_config");
  await updateFeeConfig(connection, {
    authority,
    baseFeeBps: 300,
    config,
    tierFeeReductions: [0, 30, 60, 90, 120],
  });
  const feeUpdatedConfig = parseProtocolConfig(await getAccountData(connection, config));
  assertEqual("updated base fee bps", feeUpdatedConfig.baseFeeBps, 300);

  const adminRewardInspection = await runRewardSmoke(connection, {
    authority,
    config,
    intruder,
    mint: mint.publicKey,
    owner,
    ownerRypAccount,
    rewardConfig,
    rewardVaultAddresses,
    rewardVaultStates,
  });

  log("asserting below-tier stake is rejected");
  await expectFailure(
    "stake_ryp rejects below Seed tier amount",
    () =>
      stakeRyp(connection, {
        amount: 1n,
        config,
        mint: mint.publicKey,
        owner,
        ownerRypAccount,
        position,
        rypVault,
      }),
    "custom program error: 0x1776",
  );
  await assertMissingAccount(connection, position, "position after below-tier stake");
  assertEqual("vault balance after rejected below-tier stake", await readTokenBalance(connection, rypVault), 0n);

  log("calling stake_ryp");
  await stakeRyp(connection, {
    amount: SEED_STAKE_AMOUNT,
    config,
    mint: mint.publicKey,
    owner,
    ownerRypAccount,
    position,
    rypVault,
  });

  const stakedConfig = parseProtocolConfig(await getAccountData(connection, config));
  const stakedPosition = parseStakePosition(await getAccountData(connection, position));
  const stakedVaultBalance = await readTokenBalance(connection, rypVault);
  assertEqual("staked config total", stakedConfig.totalStaked, SEED_STAKE_AMOUNT);
  assertPublicKey("position owner", stakedPosition.owner, owner.publicKey);
  assertEqual("position staked amount", stakedPosition.stakedAmount, SEED_STAKE_AMOUNT);
  assertEqual("position tier", stakedPosition.tier, 1);
  assertEqual("golden key active", stakedPosition.goldenKeyActive, true);
  assertEqual("golden key issued timestamp recorded", stakedPosition.goldenKeyIssuedAt > 0n, true);
  assertEqual("golden key revoke timestamp inactive", stakedPosition.goldenKeyRevokedAt, 0n);
  assertEqual("voting rights initially inactive", stakedPosition.votingRightsActive, false);
  assertEqual("voting rights activation timestamp inactive", stakedPosition.votingRightsActivatedAt, 0n);
  assertEqual("voting rights level inactive", stakedPosition.votingRightsLevel, 0);
  assertEqual(
    "voting rights delay seconds",
    stakedPosition.votingRightsEligibleTs - stakedPosition.stakingStartTs,
    VOTING_RIGHTS_DELAY_SECONDS,
  );
  assertEqual("vault balance after stake", stakedVaultBalance, SEED_STAKE_AMOUNT);

  const proposalId = 11n;
  const proposal = deriveGovernanceProposalAddress(proposalId);
  const voteRecord = deriveGovernanceVoteAddress({ proposal, wallet: owner.publicKey });
  log("calling create_governance_proposal");
  await createGovernanceProposal(connection, { authority, config, proposal, proposalId });
  const createdProposal = parseGovernanceProposal(await getAccountData(connection, proposal));
  assertEqual("proposal id", createdProposal.proposalId, proposalId);
  assertEqual("proposal open status", createdProposal.status, 0);
  assertEqual("proposal voting window starts", createdProposal.votingStartsAt > 0n, true);
  assertEqual(
    "proposal voting window seconds",
    createdProposal.votingEndsAt - createdProposal.votingStartsAt,
    GOVERNANCE_VOTING_WINDOW_SECONDS,
  );
  assertEqual("proposal minimum votes", createdProposal.minimumVotes, GOVERNANCE_MINIMUM_VOTES);

  await expectFailure(
    "cast_governance_vote rejects inactive voting rights",
    () => castGovernanceVote(connection, { approve: true, config, owner, position, proposal, proposalId, voteRecord }),
    "custom program error",
  );
  await assertMissingAccount(connection, voteRecord, "vote record after inactive voting rejection");

  await expectFailure(
    "close_governance_proposal rejects active voting window",
    () => closeGovernanceProposal(connection, { approved: false, authority, config, proposal, proposalId }),
    "custom program error",
  );

  log("calling close_governance_proposal after voting window");
  await waitForGovernanceWindowClose(connection, { approved: false, authority, config, proposal, proposalId });
  const closedProposal = parseGovernanceProposal(await getAccountData(connection, proposal));
  assertEqual("closed proposal rejected status", closedProposal.status, 2);

  log("calling transfer_project_authority");
  await transferProjectAuthority(connection, { authority, config, newAuthority: projectAuthority.publicKey });
  const pendingProjectAuthorityConfig = parseProtocolConfig(await getAccountData(connection, config));
  assertPublicKey("pending project authority", pendingProjectAuthorityConfig.pendingProjectAuthority, projectAuthority.publicKey);
  log("calling accept_project_authority");
  await acceptProjectAuthority(connection, { config, pendingAuthority: projectAuthority });
  const transferredProjectAuthorityConfig = parseProtocolConfig(await getAccountData(connection, config));
  assertPublicKey("project authority transferred", transferredProjectAuthorityConfig.projectAuthority, projectAuthority.publicKey);
  assertPublicKey(
    "cleared project pending authority",
    transferredProjectAuthorityConfig.pendingProjectAuthority,
    PublicKey.default,
  );

  const staleProjectAuthorityProjectId = 19n;
  const staleProjectAuthorityProject = deriveProjectAddress(staleProjectAuthorityProjectId);
  await expectFailure(
    "register_project rejects stale project authority",
    () =>
      registerProject(connection, {
        authority,
        config,
        governanceProposal: proposal,
        project: staleProjectAuthorityProject,
        projectId: staleProjectAuthorityProjectId,
        receivingAccount: Keypair.generate().publicKey,
        statusVariant: 2,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, staleProjectAuthorityProject, "project after stale project authority rejection");

  const rejectedOpenProjectId = 20n;
  const rejectedOpenProject = deriveProjectAddress(rejectedOpenProjectId);
  await expectFailure(
    "register_project rejects open project before approved governance",
    () =>
      registerProject(connection, {
        authority: projectAuthority,
        config,
        governanceProposal: proposal,
        project: rejectedOpenProject,
        projectId: rejectedOpenProjectId,
        receivingAccount: Keypair.generate().publicKey,
        statusVariant: 4,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, rejectedOpenProject, "open project after unapproved governance rejection");

  const draftProposalId = 12n;
  const draftProposal = deriveGovernanceProposalAddress(draftProposalId);
  log("calling create_governance_proposal for draft project");
  await createGovernanceProposal(connection, { authority, config, proposal: draftProposal, proposalId: draftProposalId });
  const createdDraftProposal = parseGovernanceProposal(await getAccountData(connection, draftProposal));
  assertEqual("draft project proposal open status", createdDraftProposal.status, 0);

  const invalidBoundsProjectId = 22n;
  const invalidBoundsProject = deriveProjectAddress(invalidBoundsProjectId);
  await expectFailure(
    "register_project rejects invalid participation bounds",
    () =>
      registerProject(connection, {
        authority: projectAuthority,
        config,
        governanceProposal: draftProposal,
        maxTotalParticipationAmount: 99n,
        minParticipationAmount: PROJECT_MIN_PARTICIPATION_AMOUNT,
        project: invalidBoundsProject,
        projectId: invalidBoundsProjectId,
        receivingAccount: Keypair.generate().publicKey,
        statusVariant: 2,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, invalidBoundsProject, "project after invalid bounds rejection");

  const invalidWindowProjectId = 23n;
  const invalidWindowProject = deriveProjectAddress(invalidWindowProjectId);
  await expectFailure(
    "register_project rejects invalid participation window",
    () =>
      registerProject(connection, {
        authority: projectAuthority,
        config,
        governanceProposal: draftProposal,
        participationEndsAt: 1_000n,
        participationStartsAt: 1_000n,
        project: invalidWindowProject,
        projectId: invalidWindowProjectId,
        receivingAccount: Keypair.generate().publicKey,
        statusVariant: 2,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, invalidWindowProject, "project after invalid window rejection");

  const projectId = 21n;
  const project = deriveProjectAddress(projectId);
  const projectParticipation = deriveProjectParticipationAddress({ project, wallet: owner.publicKey });
  log("calling register_project for governance-vote draft project");
  await registerProject(connection, {
    authority: projectAuthority,
    config,
    governanceProposal: draftProposal,
    project,
    projectId,
    receivingAccount: Keypair.generate().publicKey,
    statusVariant: 2,
  });
  const registeredProject = parseProjectRecord(await getAccountData(connection, project));
  assertEqual("registered project required tier", registeredProject.requiredTier, 1);
  assertEqual("registered project status", registeredProject.status, 2);
  assertPublicKey("registered project governance proposal", registeredProject.governanceProposal, draftProposal);
  assertEqual("registered project min participation", registeredProject.minParticipationAmount, PROJECT_MIN_PARTICIPATION_AMOUNT);
  assertEqual(
    "registered project max wallet participation",
    registeredProject.maxWalletParticipationAmount,
    PROJECT_MAX_WALLET_PARTICIPATION_AMOUNT,
  );
  assertEqual(
    "registered project max participation",
    registeredProject.maxTotalParticipationAmount,
    PROJECT_MAX_TOTAL_PARTICIPATION_AMOUNT,
  );
  assertEqual("registered project total participation", registeredProject.totalParticipationAmount, 0n);
  assertEqual("registered project total participants", registeredProject.totalParticipants, 0n);
  assertEqual("registered project participation start", registeredProject.participationStartsAt, PROJECT_PARTICIPATION_START_TS);
  assertEqual("registered project participation end", registeredProject.participationEndsAt, PROJECT_PARTICIPATION_END_TS);
  assertEqual("registered project cancelled at", registeredProject.cancelledAt, 0n);
  assertEqual("registered project refund pool", registeredProject.refundPoolAmount, 0n);
  assertEqual("registered project total refunded", registeredProject.totalRefundedAmount, 0n);
  assertEqual("registered project pause flag", registeredProject.participationPaused, false);

  await expectFailure(
    "set_project_pause rejects non-authority signer",
    () => setProjectPause(connection, { authority: owner, config, paused: true, project, projectId }),
    "custom program error",
  );
  log("calling set_project_pause for draft project");
  await setProjectPause(connection, { authority: projectAuthority, config, paused: true, project, projectId });
  const pausedProject = parseProjectRecord(await getAccountData(connection, project));
  assertEqual("project pause flag set", pausedProject.participationPaused, true);
  await setProjectPause(connection, { authority: projectAuthority, config, paused: false, project, projectId });
  const unpausedProject = parseProjectRecord(await getAccountData(connection, project));
  assertEqual("project pause flag cleared", unpausedProject.participationPaused, false);

  await expectFailure(
    "update_project_status rejects open project before approved governance",
    () =>
      updateProjectStatus(connection, {
        authority: projectAuthority,
        config,
        governanceProposal: draftProposal,
        project,
        projectId,
        statusVariant: 4,
      }),
    "custom program error",
  );

  await expectFailure(
    "participate_project rejects project before open status",
    () =>
      participateProject(connection, {
        config,
        owner,
        participation: projectParticipation,
        position,
        project,
        projectId,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, projectParticipation, "project participation after non-open rejection");

  await expectFailure(
    "cancel_project rejects refund pool above recorded participation",
    () =>
      cancelProject(connection, {
        authority: projectAuthority,
        config,
        project,
        projectId,
        refundPoolAmount: 1n,
      }),
    "custom program error",
  );

  log("calling cancel_project for draft project accounting");
  await cancelProject(connection, { authority: projectAuthority, config, project, projectId, refundPoolAmount: 0n });
  const cancelledProject = parseProjectRecord(await getAccountData(connection, project));
  assertEqual("cancelled project status", cancelledProject.status, 11);
  assertEqual("cancelled project refund pool", cancelledProject.refundPoolAmount, 0n);
  assertEqual("cancelled project total refunded", cancelledProject.totalRefundedAmount, 0n);
  assertEqual("cancelled project timestamp set", cancelledProject.cancelledAt > 0n, true);

  await expectFailure(
    "record_project_refund rejects zero amount",
    () => recordProjectRefund(connection, { authority: projectAuthority, config, project, projectId, refundAmount: 0n }),
    "custom program error",
  );
  await expectFailure(
    "record_project_refund rejects refund above pool",
    () => recordProjectRefund(connection, { authority: projectAuthority, config, project, projectId, refundAmount: 1n }),
    "custom program error",
  );

  const seedBotPermission = deriveSeedBotPermissionAddress(owner.publicKey);
  const permissionExpiresAt = (await recentRewardSnapshotTime(connection)) + 60n * 60n;
  log("calling create_seedbot_permission");
  await createSeedBotPermission(connection, {
    config,
    expiresAt: permissionExpiresAt,
    owner,
    permission: seedBotPermission,
    position,
  });
  const permissionRecord = parseSeedBotPermission(await getAccountData(connection, seedBotPermission));
  assertPublicKey("SeedBot permission owner", permissionRecord.owner, owner.publicKey);
  assertEqual("SeedBot permission max trade amount", permissionRecord.maxTradeAmount, SEEDBOT_MAX_TRADE_AMOUNT);
  assertEqual("SeedBot permission max daily volume", permissionRecord.maxDailyVolumeAmount, SEEDBOT_MAX_DAILY_VOLUME_AMOUNT);
  assertEqual("SeedBot permission max daily trades", permissionRecord.maxDailyTrades, SEEDBOT_MAX_DAILY_TRADES);
  assertEqual("SeedBot permission max slippage bps", permissionRecord.maxSlippageBps, SEEDBOT_MAX_SLIPPAGE_BPS);
  assertEqual("SeedBot permission tier snapshot", permissionRecord.tierAtCreation, 1);
  assertEqual("SeedBot permission stake snapshot", permissionRecord.stakedAmountAtCreation, SEED_STAKE_AMOUNT);
  assertEqual(
    "SeedBot permission staking start snapshot",
    permissionRecord.stakingStartTsAtCreation,
    stakedPosition.stakingStartTs,
  );
  assertEqual("SeedBot permission revoked", permissionRecord.revoked, false);

  log("calling revoke_seedbot_permission");
  await revokeSeedBotPermission(connection, { owner, permission: seedBotPermission });
  const revokedPermission = parseSeedBotPermission(await getAccountData(connection, seedBotPermission));
  assertEqual("SeedBot permission revoked state", revokedPermission.revoked, true);

  log("calling update_seedbot_permission to renew revoked permission");
  await updateSeedBotPermission(connection, {
    config,
    expiresAt: permissionExpiresAt + 60n,
    owner,
    permission: seedBotPermission,
    position,
  });
  const renewedPermission = parseSeedBotPermission(await getAccountData(connection, seedBotPermission));
  assertEqual("SeedBot permission renewed revoked state", renewedPermission.revoked, false);
  assertEqual("SeedBot permission renewed tier snapshot", renewedPermission.tierAtCreation, 1);
  assertEqual("SeedBot permission renewed stake snapshot", renewedPermission.stakedAmountAtCreation, SEED_STAKE_AMOUNT);
  assertEqual("SeedBot permission renewed expiry", renewedPermission.expiresAt, permissionExpiresAt + 60n);
  assertEqual("SeedBot permission renewed daily volume", renewedPermission.dailyVolumeUsedAmount, 0n);
  assertEqual("SeedBot permission renewed daily trades", renewedPermission.dailyTradesUsed, 0);
  assertEqual("SeedBot permission renewed total volume", renewedPermission.totalVolumeUsedAmount, 0n);
  assertEqual("SeedBot permission renewed total trades", renewedPermission.totalTradesUsed, 0n);

  log("calling record_seedbot_usage");
  await recordSeedBotUsage(connection, {
    config,
    owner,
    permission: seedBotPermission,
    position,
    slippageBps: 50,
    tradeAmount: 500n,
  });
  await recordSeedBotUsage(connection, {
    config,
    owner,
    permission: seedBotPermission,
    position,
    slippageBps: 75,
    tradeAmount: 500n,
  });
  await recordSeedBotUsage(connection, {
    config,
    owner,
    permission: seedBotPermission,
    position,
    slippageBps: 100,
    tradeAmount: 500n,
  });
  const usedPermission = parseSeedBotPermission(await getAccountData(connection, seedBotPermission));
  assertEqual("SeedBot permission used daily volume", usedPermission.dailyVolumeUsedAmount, 1_500n);
  assertEqual("SeedBot permission used daily trades", usedPermission.dailyTradesUsed, 3);
  assertEqual("SeedBot permission used total volume", usedPermission.totalVolumeUsedAmount, 1_500n);
  assertEqual("SeedBot permission used total trades", usedPermission.totalTradesUsed, 3n);
  assertEqual("SeedBot permission last execution recorded", usedPermission.lastExecutionTs > 0n, true);

  await expectFailure(
    "record_seedbot_usage rejects daily cap breach",
    () =>
      recordSeedBotUsage(connection, {
        config,
        owner,
        permission: seedBotPermission,
        position,
        slippageBps: 50,
        tradeAmount: 1n,
      }),
    "custom program error",
  );

  log("asserting voting rights are locked before the 14-day delay");
  await expectFailure(
    "activate_voting_rights rejects early activation",
    () => activateVotingRights(connection, { config, owner, position }),
    "custom program error: 0x1778",
  );
  assertEqual(
    "voting rights after rejected early activation",
    parseStakePosition(await getAccountData(connection, position)).votingRightsActive,
    false,
  );

  log("asserting unauthorized unstake is rejected");
  await expectFailure(
    "unstake_ryp rejects mismatched owner/position",
    () =>
      unstakeRyp(connection, {
        amount: 1n,
        config,
        mint: mint.publicKey,
        owner: intruder,
        ownerRypAccount: intruderRypAccount,
        position,
        rypVault,
      }),
    "A seeds constraint was violated",
  );
  assertEqual("vault balance after rejected unauthorized unstake", await readTokenBalance(connection, rypVault), SEED_STAKE_AMOUNT);

  log("asserting unstake cannot exceed position amount");
  await expectFailure(
    "unstake_ryp rejects insufficient stake",
    () =>
      unstakeRyp(connection, {
        amount: SEED_STAKE_AMOUNT + 1n,
        config,
        mint: mint.publicKey,
        owner,
        ownerRypAccount,
        position,
        rypVault,
      }),
    "custom program error: 0x1777",
  );
  assertEqual("vault balance after rejected oversized unstake", await readTokenBalance(connection, rypVault), SEED_STAKE_AMOUNT);

  log("calling stake_ryp again to test tier upgrade state");
  await mintTo(connection, {
    amount: ADD_TO_SPROUT_AMOUNT,
    authority,
    destination: ownerRypAccount,
    mint: mint.publicKey,
  });
  await stakeRyp(connection, {
    amount: ADD_TO_SPROUT_AMOUNT,
    config,
    mint: mint.publicKey,
    owner,
    ownerRypAccount,
    position,
    rypVault,
  });

  const upgradedConfig = parseProtocolConfig(await getAccountData(connection, config));
  const upgradedPosition = parseStakePosition(await getAccountData(connection, position));
  assertEqual("upgraded config total", upgradedConfig.totalStaked, SPROUT_STAKE_AMOUNT);
  assertEqual("upgraded position amount", upgradedPosition.stakedAmount, SPROUT_STAKE_AMOUNT);
  assertEqual("upgraded position tier", upgradedPosition.tier, 2);
  assertEqual("upgraded golden key state", upgradedPosition.goldenKeyActive, true);
  assertEqual("upgraded voting rights state", upgradedPosition.votingRightsActive, false);
  assertEqual("staking start preserved on top-up", upgradedPosition.stakingStartTs, stakedPosition.stakingStartTs);
  assertEqual("voting eligibility preserved on top-up", upgradedPosition.votingRightsEligibleTs, stakedPosition.votingRightsEligibleTs);
  assertEqual("vault balance after tier upgrade", await readTokenBalance(connection, rypVault), SPROUT_STAKE_AMOUNT);

  log("calling partial unstake to test tier downgrade state");
  await unstakeRyp(connection, {
    amount: ADD_TO_SPROUT_AMOUNT,
    config,
    mint: mint.publicKey,
    owner,
    ownerRypAccount,
    position,
    rypVault,
  });

  const downgradedConfig = parseProtocolConfig(await getAccountData(connection, config));
  const downgradedPosition = parseStakePosition(await getAccountData(connection, position));
  assertEqual("downgraded config total", downgradedConfig.totalStaked, SEED_STAKE_AMOUNT);
  assertEqual("downgraded position amount", downgradedPosition.stakedAmount, SEED_STAKE_AMOUNT);
  assertEqual("downgraded position tier", downgradedPosition.tier, 1);
  assertEqual("downgraded golden key state", downgradedPosition.goldenKeyActive, true);
  assertEqual("downgraded voting rights state", downgradedPosition.votingRightsActive, false);
  assertEqual("staking start preserved on partial unstake", downgradedPosition.stakingStartTs, stakedPosition.stakingStartTs);
  assertEqual("voting eligibility preserved on partial unstake", downgradedPosition.votingRightsEligibleTs, stakedPosition.votingRightsEligibleTs);
  assertEqual("vault balance after partial unstake", await readTokenBalance(connection, rypVault), SEED_STAKE_AMOUNT);

  log("asserting unauthorized pause is rejected");
  await expectFailure(
    "set_pause rejects non-authority signer",
    () => setPause(connection, { authority: intruder, config, paused: true }),
    "custom program error: 0x1772",
  );
  assertEqual("pause state after unauthorized set_pause", parseProtocolConfig(await getAccountData(connection, config)).paused, false);

  log("asserting pause blocks staking and unstaking");
  await setPause(connection, { authority, config, paused: true });
  assertEqual("pause state after authority pause", parseProtocolConfig(await getAccountData(connection, config)).paused, true);
  await expectFailure(
    "stake_ryp rejects while paused",
    () =>
      stakeRyp(connection, {
        amount: SEED_STAKE_AMOUNT,
        config,
        mint: mint.publicKey,
        owner,
        ownerRypAccount,
        position,
        rypVault,
      }),
    "custom program error: 0x1771",
  );
  await expectFailure(
    "unstake_ryp rejects while paused",
    () =>
      unstakeRyp(connection, {
        amount: 1n,
        config,
        mint: mint.publicKey,
        owner,
        ownerRypAccount,
        position,
        rypVault,
      }),
    "custom program error: 0x1771",
  );
  await expectFailure(
    "activate_voting_rights rejects while paused",
    () => activateVotingRights(connection, { config, owner, position }),
    "custom program error: 0x1771",
  );
  assertEqual("vault balance after paused attempts", await readTokenBalance(connection, rypVault), SEED_STAKE_AMOUNT);
  await setPause(connection, { authority, config, paused: false });
  assertEqual("pause state after authority unpause", parseProtocolConfig(await getAccountData(connection, config)).paused, false);

  log("calling unstake_ryp");
  await unstakeRyp(connection, {
    amount: SEED_STAKE_AMOUNT,
    config,
    mint: mint.publicKey,
    owner,
    ownerRypAccount,
    position,
    rypVault,
  });

  const finalConfig = parseProtocolConfig(await getAccountData(connection, config));
  const finalPosition = parseStakePosition(await getAccountData(connection, position));
  const finalVaultBalance = await readTokenBalance(connection, rypVault);
  const finalOwnerBalance = await readTokenBalance(connection, ownerRypAccount);
  assertEqual("final config total", finalConfig.totalStaked, 0n);
  assertEqual("final position amount", finalPosition.stakedAmount, 0n);
  assertEqual("final position tier", finalPosition.tier, 0);
  assertEqual("final golden key state", finalPosition.goldenKeyActive, false);
  assertEqual("final golden key issued timestamp preserved", finalPosition.goldenKeyIssuedAt, stakedPosition.goldenKeyIssuedAt);
  assertEqual("final golden key revoked timestamp recorded", finalPosition.goldenKeyRevokedAt > 0n, true);
  assertEqual("final voting rights state", finalPosition.votingRightsActive, false);
  assertEqual("final voting rights activation timestamp reset", finalPosition.votingRightsActivatedAt, 0n);
  assertEqual("final voting rights level reset", finalPosition.votingRightsLevel, 0);
  assertEqual("final vault balance", finalVaultBalance, 0n);
  assertEqual("final owner balance", finalOwnerBalance, SPROUT_STAKE_AMOUNT + HOLDER_REWARD_CLAIM_AMOUNT);

  await expectFailure(
    "accept_protocol_authority rejects missing nomination",
    () => acceptProtocolAuthority(connection, { config, pendingAuthority: newAuthority }),
  );
  log("calling transfer_reward_authority");
  await transferRewardAuthority(connection, { authority, config, newAuthority: newAuthority.publicKey, rewardConfig });
  const pendingRewardConfig = parseRewardConfig(await getAccountData(connection, rewardConfig));
  assertPublicKey("pending reward authority", pendingRewardConfig.pendingAuthority, newAuthority.publicKey);

  log("calling transfer_protocol_authority");
  await transferProtocolAuthority(connection, { authority, config, newAuthority: newAuthority.publicKey });
  const pendingConfig = parseProtocolConfig(await getAccountData(connection, config));
  assertPublicKey("pending protocol authority", pendingConfig.pendingAuthority, newAuthority.publicKey);

  log("calling accept_protocol_authority");
  await acceptProtocolAuthority(connection, { config, pendingAuthority: newAuthority });
  const transferredConfig = parseProtocolConfig(await getAccountData(connection, config));
  assertPublicKey("transferred protocol authority", transferredConfig.authority, newAuthority.publicKey);
  assertPublicKey("cleared protocol pending authority", transferredConfig.pendingAuthority, PublicKey.default);
  assertPublicKey("project authority preserved after protocol transfer", transferredConfig.projectAuthority, projectAuthority.publicKey);

  log("calling accept_reward_authority");
  await acceptRewardAuthority(connection, { config, pendingAuthority: newAuthority, rewardConfig });
  const transferredRewardConfig = parseRewardConfig(await getAccountData(connection, rewardConfig));
  assertPublicKey("transferred reward authority", transferredRewardConfig.authority, newAuthority.publicKey);
  assertPublicKey("cleared reward pending authority", transferredRewardConfig.pendingAuthority, PublicKey.default);
  await expectFailure(
    "set_pause rejects stale authority after transfer",
    () => setPause(connection, { authority, config, paused: true }),
  );

  return {
    status: "passed",
    programId: programId.toBase58(),
    mint: mint.publicKey.toBase58(),
    config: config.toBase58(),
    rewardConfig: rewardConfig.toBase58(),
    adminRewardInspection,
    position: position.toBase58(),
    rypVault: rypVault.toBase58(),
    checked: [
	      "initialize_config",
	      "update_fee_config",
	      "reject_invalid_thresholds",
	      "reject_invalid_reward_split",
	      "initialize_reward_config",
      "reject_blank_reward_metadata",
      "register_reward_vaults",
      "reject_reward_epoch_before_vault_verification",
      "reject_reward_vault_metadata_mismatch",
	      "verify_reward_vaults",
	      "route_platform_fee",
      "reject_non_authority_reward_verify",
	      "reject_unbalanced_reward_epoch",
	      "draft_reward_epoch",
	      "reject_claim_before_reward_epoch_review",
	      "review_reward_epoch",
	      "create_reward_claim_record",
	      "claim_reward_tokens",
	      "create_reward_claim_record_from_proof",
	      "claim_reward_record_rollover",
	      "expire_reward_epoch_claims",
	      "reject_duplicate_reward_claim",
	      "admin_reward_inspection_report",
	      "reject_below_tier_stake",
	      "stake_ryp",
	      "stake_receipt_lifecycle",
	      "create_governance_proposal",
	      "governance_proposal_window_and_thresholds",
	      "reject_vote_without_active_voting_rights",
	      "reject_governance_close_before_window_end",
	      "close_governance_proposal_after_window",
	      "transfer_project_authority",
	      "accept_project_authority",
	      "reject_stale_project_authority",
	      "reject_open_project_before_approved_governance",
	      "reject_invalid_project_participation_bounds",
	      "reject_invalid_project_participation_window",
	      "register_governance_vote_project",
	      "project_participation_bounds_accounting",
	      "reject_non_authority_project_pause",
	      "project_pause_toggle",
	      "reject_project_status_open_before_approved_governance",
	      "reject_participation_before_project_open",
	      "reject_project_refund_pool_above_participation",
	      "cancel_project_accounting",
	      "reject_invalid_project_refund_accounting",
	      "create_seedbot_permission",
	      "revoke_seedbot_permission",
	      "update_seedbot_permission",
	      "record_seedbot_usage",
	      "reject_seedbot_usage_limit",
	      "reject_early_voting_activation",
      "reject_unauthorized_unstake",
      "reject_insufficient_unstake",
      "stake_top_up_to_sprout",
      "partial_unstake_back_to_seed",
      "reject_unauthorized_pause",
      "pause_blocks_stake_and_unstake",
      "pause_blocks_voting_activation",
      "unstake_ryp",
      "reject_authority_accept_without_nomination",
      "transfer_reward_authority",
      "transfer_protocol_authority",
      "accept_protocol_authority",
      "accept_reward_authority",
      "reject_stale_authority_after_transfer",
    ],
  };
}

async function runRewardSmoke(
  connection,
  { authority, config, intruder, mint, owner, ownerRypAccount, rewardConfig, rewardVaultAddresses, rewardVaultStates },
) {
  log("asserting invalid reward split is rejected");
  await expectFailure(
    "initialize_reward_config rejects unbalanced split",
    () =>
      initializeRewardConfig(connection, {
        authority,
        config,
        mint,
        rewardConfig,
        splitBps: { holder: 3_334, staker: 3_333, treasury: 3_334 },
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, rewardConfig, "reward config after rejected initialize_reward_config");

  log("calling initialize_reward_config");
  await initializeRewardConfig(connection, { authority, config, mint, rewardConfig });
  const initializedRewardConfig = parseRewardConfig(await getAccountData(connection, rewardConfig));
  assertPublicKey("reward config authority", initializedRewardConfig.authority, authority.publicKey);
  assertPublicKey("reward config mint", initializedRewardConfig.rypMint, mint);
  assertPublicKey("reward config protocol config", initializedRewardConfig.protocolConfig, config);
  assertEqual("reward config holder split", initializedRewardConfig.holderSplitBps, REWARD_SPLIT_BPS.holder);
  assertEqual("reward config staker split", initializedRewardConfig.stakerSplitBps, REWARD_SPLIT_BPS.staker);
  assertEqual("reward config treasury split", initializedRewardConfig.treasurySplitBps, REWARD_SPLIT_BPS.treasury);
  assertEqual("reward config draft only", initializedRewardConfig.draftOnly, true);

  log("asserting blank reward metadata is rejected");
  await expectFailure(
    "register_reward_vault rejects blank metadata hash",
    () =>
      registerRewardVault(connection, {
        authority,
        config,
        rewardConfig,
        rewardVaultAddress: rewardVaultAddresses.holder,
        rewardVaultState: rewardVaultStates.holder,
        role: REWARD_ROLES[0],
        metadataHash: ZERO_METADATA_HASH,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, rewardVaultStates.holder, "holder reward vault after blank metadata rejection");

  log("registering reward vault states");
  for (const role of REWARD_ROLES) {
    await registerRewardVault(connection, {
      authority,
      config,
      rewardConfig,
      rewardVaultAddress: rewardVaultAddresses[role.key],
      rewardVaultState: rewardVaultStates[role.key],
      role,
    });
  }

  const holderVaultState = parseRewardVaultState(await getAccountData(connection, rewardVaultStates.holder));
  assertEqual("holder reward vault role", holderVaultState.role, 0);
  assertEqual("holder reward vault pending verification", holderVaultState.verificationStatus, 1);
  assertEqual("holder reward vault receives user funds", holderVaultState.receivesUserFunds, false);

  const pendingEpoch = deriveRewardEpochAddress({ epochId: 1n, rewardConfig });
  log("asserting reward epochs require verified vault states");
  await expectFailure(
    "draft_reward_epoch rejects pending vault verification",
    () =>
      draftRewardEpoch(connection, {
        authority,
        config,
        epochId: 1n,
        rewardConfig,
        rewardEpoch: pendingEpoch,
        rewardVaultStates,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, pendingEpoch, "reward epoch after pending-vault rejection");

  log("asserting reward vault verification requires reviewed metadata");
  await expectFailure(
    "verify_reward_vault rejects metadata mismatch",
    () =>
      verifyRewardVault(connection, {
        authority,
        config,
        metadataHash: Buffer.alloc(32, 8),
        rewardConfig,
        rewardVaultState: rewardVaultStates.holder,
        role: REWARD_ROLES[0],
      }),
    "custom program error",
  );

  log("verifying reward vault states");
  for (const role of REWARD_ROLES) {
    await verifyRewardVault(connection, {
      authority,
      config,
      rewardConfig,
      rewardVaultState: rewardVaultStates[role.key],
      role,
    });
  }

  const verifiedRewardConfig = parseRewardConfig(await getAccountData(connection, rewardConfig));
  assertEqual("reward config registered vault mask", verifiedRewardConfig.registeredVaultRolesMask, 31);
  assertEqual("reward config verified vault mask", verifiedRewardConfig.verifiedVaultRolesMask, 31);

  log("calling route_platform_fee");
  const ownerBalanceBeforeFeeRoute = await readTokenBalance(connection, ownerRypAccount);
  await routePlatformFee(connection, {
    config,
    feeAmount: PLATFORM_FEE_ROUTE_AMOUNT,
    holderRewardVault: rewardVaultAddresses.holder,
    holderRewardVaultState: rewardVaultStates.holder,
    mint,
    payer: owner,
    payerFeeAccount: ownerRypAccount,
    rewardConfig,
    stakerRewardVault: rewardVaultAddresses.staker,
    stakerRewardVaultState: rewardVaultStates.staker,
    treasuryVault: rewardVaultAddresses.treasury,
    treasuryVaultState: rewardVaultStates.treasury,
  });
  const routedRewardConfig = parseRewardConfig(await getAccountData(connection, rewardConfig));
  const routedHolderVaultState = parseRewardVaultState(await getAccountData(connection, rewardVaultStates.holder));
  const routedStakerVaultState = parseRewardVaultState(await getAccountData(connection, rewardVaultStates.staker));
  const routedTreasuryVaultState = parseRewardVaultState(await getAccountData(connection, rewardVaultStates.treasury));
  assertEqual("owner balance after fee route", await readTokenBalance(connection, ownerRypAccount), ownerBalanceBeforeFeeRoute - PLATFORM_FEE_ROUTE_AMOUNT);
  assertEqual("reward config routed fee total", routedRewardConfig.totalRoutedFeeAmount, PLATFORM_FEE_ROUTE_AMOUNT);
  assertEqual("holder reward funded total", routedHolderVaultState.totalFundedAmount, PLATFORM_FEE_ROUTE_SPLIT.holder);
  assertEqual("staker reward funded total", routedStakerVaultState.totalFundedAmount, PLATFORM_FEE_ROUTE_SPLIT.staker);
  assertEqual("treasury funded total", routedTreasuryVaultState.totalFundedAmount, PLATFORM_FEE_ROUTE_SPLIT.treasury);
  assertEqual("holder reward vault after fee route", await readTokenBalance(connection, rewardVaultAddresses.holder), HOLDER_REWARD_CLAIM_AMOUNT + PLATFORM_FEE_ROUTE_SPLIT.holder);
  assertEqual("staker reward vault after fee route", await readTokenBalance(connection, rewardVaultAddresses.staker), PLATFORM_FEE_ROUTE_SPLIT.staker);
  assertEqual("treasury vault after fee route", await readTokenBalance(connection, rewardVaultAddresses.treasury), PLATFORM_FEE_ROUTE_SPLIT.treasury);

  const unbalancedEpoch = deriveRewardEpochAddress({ epochId: 2n, rewardConfig });
  log("asserting unbalanced reward epochs are rejected");
  await expectFailure(
    "draft_reward_epoch rejects unbalanced accounting",
    () =>
      draftRewardEpoch(connection, {
        authority,
        config,
        distributedNetAmount: 700n,
        epochId: 2n,
        reservedDeliveryCostAmount: 100n,
        rewardConfig,
        rewardEpoch: unbalancedEpoch,
        rewardPoolAmount: 1_000n,
        rewardVaultStates,
        rolledForwardAmount: 199n,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, unbalancedEpoch, "reward epoch after unbalanced rejection");

  const rewardEpoch = deriveRewardEpochAddress({ epochId: 3n, rewardConfig });
  const stakerRolloverLeafIndex = 0n;
  const stakerRolloverMerkleRoot = rewardClaimLeafHash({
    deliveryCostAmount: 0n,
    grossAllocationAmount: 200n,
    leafIndex: stakerRolloverLeafIndex,
    netClaimAmount: 0n,
    rewardEpoch,
    role: REWARD_ROLES[1],
    rolledForwardAmount: 200n,
    wallet: owner.publicKey,
  });
  log("calling draft_reward_epoch");
  await draftRewardEpoch(connection, {
    authority,
    claimMerkleRoot: stakerRolloverMerkleRoot,
    config,
    distributedNetAmount: 700n,
    epochId: 3n,
    reservedDeliveryCostAmount: 100n,
    rewardConfig,
    rewardEpoch,
    rewardPoolAmount: 1_000n,
    rewardVaultStates,
    rolledForwardAmount: 200n,
  });
  const draftedRewardEpoch = parseRewardEpoch(await getAccountData(connection, rewardEpoch));
  assertEqual("drafted reward epoch id", draftedRewardEpoch.epochId, 3n);
  assertEqual("drafted reward epoch pool", draftedRewardEpoch.rewardPoolAmount, 1_000n);
  assertEqual("drafted reward epoch status", draftedRewardEpoch.status, 0);
  assertEqual("drafted reward epoch execution blocked", draftedRewardEpoch.executionBlocked, true);
  assertEqual("drafted reward epoch claim expiry set", draftedRewardEpoch.claimExpiresAt > draftedRewardEpoch.createdAt, true);
  assertEqual("drafted reward epoch expired unclaimed starts zero", draftedRewardEpoch.expiredUnclaimedNetAmount, 0n);
  assertEqual(
    "drafted reward epoch claim Merkle root",
    draftedRewardEpoch.claimMerkleRoot.toString("hex"),
    stakerRolloverMerkleRoot.toString("hex"),
  );

  const holderRewardClaimRecord = deriveRewardClaimAddress({
    rewardEpoch,
    role: REWARD_ROLES[0],
    wallet: owner.publicKey,
  });
  const stakerRewardClaimRecord = deriveRewardClaimAddress({
    rewardEpoch,
    role: REWARD_ROLES[1],
    wallet: owner.publicKey,
  });
  log("asserting reward claim records require reviewed epochs");
  await expectFailure(
    "create_reward_claim_record rejects drafted epoch",
    () =>
      createRewardClaimRecord(connection, {
        authority,
        config,
        rewardConfig,
        rewardEpoch,
        rewardClaimRecord: holderRewardClaimRecord,
        role: REWARD_ROLES[0],
        wallet: owner.publicKey,
      }),
    "custom program error",
  );
  await assertMissingAccount(connection, holderRewardClaimRecord, "claim record after drafted epoch rejection");

  log("calling review_reward_epoch");
  await reviewRewardEpoch(connection, { authority, config, epochId: 3n, rewardConfig, rewardEpoch });
  const reviewedRewardEpoch = parseRewardEpoch(await getAccountData(connection, rewardEpoch));
  assertEqual("reviewed reward epoch status", reviewedRewardEpoch.status, 1);
  assertEqual("reviewed reward epoch execution", reviewedRewardEpoch.executionBlocked, false);

  log("calling create_reward_claim_record");
  await createRewardClaimRecord(connection, {
    authority,
    config,
    deliveryCostAmount: 0n,
    grossAllocationAmount: HOLDER_REWARD_CLAIM_AMOUNT,
    netClaimAmount: HOLDER_REWARD_CLAIM_AMOUNT,
    rewardConfig,
    rewardEpoch,
    rewardClaimRecord: holderRewardClaimRecord,
    role: REWARD_ROLES[0],
    rolledForwardAmount: 0n,
    wallet: owner.publicKey,
  });
  const createdClaim = parseRewardClaimRecord(await getAccountData(connection, holderRewardClaimRecord));
  assertEqual("claim record role", createdClaim.rewardRole, 0);
  assertPublicKey("claim record wallet", createdClaim.wallet, owner.publicKey);
  assertEqual("claim record net claim", createdClaim.netClaimAmount, HOLDER_REWARD_CLAIM_AMOUNT);
  assertEqual("claim record initially unclaimed", createdClaim.claimed, false);

  log("calling claim_reward_tokens");
  const ownerBalanceBeforeRewardClaim = await readTokenBalance(connection, ownerRypAccount);
  const holderRewardVaultBeforeClaim = await readTokenBalance(connection, rewardVaultAddresses.holder);
  await claimRewardTokens(connection, {
    epochId: 3n,
    mint,
    owner,
    ownerRewardAccount: ownerRypAccount,
    rewardClaimRecord: holderRewardClaimRecord,
    rewardConfig,
    rewardEpoch,
    rewardSourceVault: rewardVaultAddresses.holder,
    rewardVaultState: rewardVaultStates.holder,
    role: REWARD_ROLES[0],
  });
  const claimedRecord = parseRewardClaimRecord(await getAccountData(connection, holderRewardClaimRecord));
  assertEqual("claim record claimed", claimedRecord.claimed, true);
  assertEqual(
    "owner reward balance after token claim",
    await readTokenBalance(connection, ownerRypAccount),
    ownerBalanceBeforeRewardClaim + HOLDER_REWARD_CLAIM_AMOUNT,
  );
  assertEqual(
    "holder reward vault after token claim",
    await readTokenBalance(connection, rewardVaultAddresses.holder),
    holderRewardVaultBeforeClaim - HOLDER_REWARD_CLAIM_AMOUNT,
  );

  await expectFailure(
    "claim_reward_tokens rejects duplicate claim",
    () =>
      claimRewardTokens(connection, {
        epochId: 3n,
        mint,
        owner,
        ownerRewardAccount: ownerRypAccount,
        rewardClaimRecord: holderRewardClaimRecord,
        rewardConfig,
        rewardEpoch,
        rewardSourceVault: rewardVaultAddresses.holder,
        rewardVaultState: rewardVaultStates.holder,
        role: REWARD_ROLES[0],
      }),
    "custom program error",
  );

  log("calling create_reward_claim_record_from_proof for staker rollover");
  await createRewardClaimRecordFromProof(connection, {
    deliveryCostAmount: 0n,
    epochId: 3n,
    grossAllocationAmount: 200n,
    leafIndex: stakerRolloverLeafIndex,
    netClaimAmount: 0n,
    owner,
    rewardClaimRecord: stakerRewardClaimRecord,
    rewardConfig,
    rewardEpoch,
    role: REWARD_ROLES[1],
    rolledForwardAmount: 200n,
  });
  log("calling claim_reward_record for staker rollover");
  await claimRewardRecord(connection, {
    owner,
    rewardClaimRecord: stakerRewardClaimRecord,
    rewardEpoch,
    role: REWARD_ROLES[1],
  });
  const claimedRolloverRecord = parseRewardClaimRecord(await getAccountData(connection, stakerRewardClaimRecord));
  assertEqual("rollover claim record claimed", claimedRolloverRecord.claimed, true);
  const rewardEpochAfterClaims = parseRewardEpoch(await getAccountData(connection, rewardEpoch));
  assertEqual("reward epoch recorded gross claims", rewardEpochAfterClaims.recordedGrossAllocationAmount, 900n);
  assertEqual("reward epoch recorded net claims", rewardEpochAfterClaims.recordedNetClaimAmount, 700n);
  assertEqual("reward epoch claimed net", rewardEpochAfterClaims.claimedNetAmount, 700n);

  const expiringEpochId = 4n;
  const expiringEpoch = deriveRewardEpochAddress({ epochId: expiringEpochId, rewardConfig });
  log("calling draft_reward_epoch for short claim window");
  await draftRewardEpoch(connection, {
    authority,
    claimWindowSeconds: 1n,
    config,
    epochId: expiringEpochId,
    rewardConfig,
    rewardEpoch: expiringEpoch,
    rewardVaultStates,
  });
  await reviewRewardEpoch(connection, { authority, config, epochId: expiringEpochId, rewardConfig, rewardEpoch: expiringEpoch });
  await waitForRewardEpochExpiry(connection, { authority, config, epochId: expiringEpochId, rewardConfig, rewardEpoch: expiringEpoch });
  const expiredEpoch = parseRewardEpoch(await getAccountData(connection, expiringEpoch));
  assertEqual("expired reward epoch status", expiredEpoch.status, 3);
  assertEqual("expired reward epoch execution blocked", expiredEpoch.executionBlocked, true);
  assertEqual("expired reward epoch unclaimed net", expiredEpoch.expiredUnclaimedNetAmount, 700n);
  assertEqual("expired reward epoch recorded timestamp", expiredEpoch.expiredRecordedAt > 0n, true);

  await expectFailure(
    "verify_reward_vault rejects non-authority signer",
    () =>
      verifyRewardVault(connection, {
        authority: intruder,
        config,
        rewardConfig,
        rewardVaultState: rewardVaultStates.holder,
        role: REWARD_ROLES[0],
      }),
    "custom program error",
  );

  const adminRewardInspection = await buildAdminRewardInspectionReport(connection, {
    rewardConfig,
    rewardEpoch,
    rewardVaultStates,
  });
  assertEqual("admin reward inspector config status", adminRewardInspection.rewardConfig.status, "DECODED");
  assertEqual("admin reward inspector epoch status", adminRewardInspection.epoch.status, "DECODED");
  assertEqual("admin reward inspector decoded vault count", adminRewardInspection.vaults.length, REWARD_ROLES.length);
  assertEqual("admin reward inspector execution mode", adminRewardInspection.executionMode, "READ_ONLY");
  assertEqual("admin reward inspector no reward execution", adminRewardInspection.rewardExecutionExposed, false);

  return adminRewardInspection;
}

async function buildAdminRewardInspectionReport(connection, { rewardConfig, rewardEpoch, rewardVaultStates }) {
  const decodedRewardConfig = parseRewardConfig(await getAccountData(connection, rewardConfig));
  const decodedRewardEpoch = parseRewardEpoch(await getAccountData(connection, rewardEpoch));
  const vaults = [];

  for (const role of REWARD_ROLES) {
    const decoded = parseRewardVaultState(await getAccountData(connection, rewardVaultStates[role.key]));
    vaults.push({
      address: rewardVaultStates[role.key].toBase58(),
      custodyModel: rewardVaultCustodyModelLabel(decoded.custodyModel),
      label: role.name,
      receivesUserFunds: decoded.receivesUserFunds,
      role: rewardVaultRoleLabel(decoded.role),
      status: "DECODED",
      totalFundedAmount: decoded.totalFundedAmount.toString(),
      vaultAddress: decoded.vaultAddress.toBase58(),
      verificationStatus: rewardVaultVerificationStatusLabel(decoded.verificationStatus),
    });
  }

  const unverifiedVaults = vaults.filter((vault) => vault.verificationStatus !== "VERIFIED");
  const userFundVaults = vaults.filter((vault) => vault.receivesUserFunds);
  if (unverifiedVaults.length > 0) {
    throw new Error(`Admin reward inspector found unverified vaults: ${unverifiedVaults.map((vault) => vault.label).join(", ")}`);
  }
  if (userFundVaults.length > 0) {
    throw new Error(`Admin reward inspector found vaults marked as user-fund receivers: ${userFundVaults.map((vault) => vault.label).join(", ")}`);
  }

  return {
    executionMode: "READ_ONLY",
    rewardExecutionExposed: false,
    warnings: [
      "Reward account inspection is read-only.",
      "No reward setup, claim, payout, or vault movement action is exposed in the Admin Dashboard.",
    ],
    rewardConfig: {
      address: rewardConfig.toBase58(),
      decoded: {
        draftOnly: decodedRewardConfig.draftOnly,
        holderSplitBps: decodedRewardConfig.holderSplitBps,
        registeredVaultRolesMask: decodedRewardConfig.registeredVaultRolesMask,
        stakerSplitBps: decodedRewardConfig.stakerSplitBps,
        treasurySplitBps: decodedRewardConfig.treasurySplitBps,
        totalRoutedFeeAmount: decodedRewardConfig.totalRoutedFeeAmount.toString(),
        verifiedVaultRolesMask: decodedRewardConfig.verifiedVaultRolesMask,
      },
      status: "DECODED",
    },
    epoch: {
      address: rewardEpoch.toBase58(),
      decoded: {
        distributedNetAmount: decodedRewardEpoch.distributedNetAmount.toString(),
        epochId: decodedRewardEpoch.epochId.toString(),
        executionBlocked: decodedRewardEpoch.executionBlocked,
        claimMerkleRoot: decodedRewardEpoch.claimMerkleRoot.toString("hex"),
        claimExpiresAt: decodedRewardEpoch.claimExpiresAt.toString(),
        claimedNetAmount: decodedRewardEpoch.claimedNetAmount.toString(),
        expiredRecordedAt: decodedRewardEpoch.expiredRecordedAt.toString(),
        expiredUnclaimedNetAmount: decodedRewardEpoch.expiredUnclaimedNetAmount.toString(),
        recordedGrossAllocationAmount: decodedRewardEpoch.recordedGrossAllocationAmount.toString(),
        recordedNetClaimAmount: decodedRewardEpoch.recordedNetClaimAmount.toString(),
        reservedDeliveryCostAmount: decodedRewardEpoch.reservedDeliveryCostAmount.toString(),
        rewardPoolAmount: decodedRewardEpoch.rewardPoolAmount.toString(),
        rolledForwardAmount: decodedRewardEpoch.rolledForwardAmount.toString(),
        status: rewardEpochStatusLabel(decodedRewardEpoch.status),
      },
      status: "DECODED",
    },
    vaults,
  };
}

async function initializeRewardConfig(
  connection,
  {
    authority,
    config,
    epochCadenceSeconds = REWARD_EPOCH_CADENCE_SECONDS,
    mint,
    rewardConfig,
    splitBps = REWARD_SPLIT_BPS,
  },
) {
  const data = Buffer.alloc(8 + 8 + 2 + 2 + 2);
  discriminator("initialize_reward_config").copy(data, 0);
  data.writeBigInt64LE(epochCadenceSeconds, 8);
  data.writeUInt16LE(splitBps.holder, 16);
  data.writeUInt16LE(splitBps.staker, 18);
  data.writeUInt16LE(splitBps.treasury, 20);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(mint, false, false),
      accountMeta(rewardConfig, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function registerRewardVault(
  connection,
  {
    authority,
    config,
    custodyModel = undefined,
    metadataHash = REWARD_METADATA_HASH,
    rewardConfig,
    rewardVaultAddress,
    rewardVaultState,
    role,
  },
) {
  const data = Buffer.alloc(8 + 1 + 32 + 1 + 32);
  discriminator("register_reward_vault").copy(data, 0);
  data.writeUInt8(role.variant, 8);
  rewardVaultAddress.toBuffer().copy(data, 9);
  data.writeUInt8(custodyModel ?? role.custodyModel, 41);
  metadataHash.copy(data, 42);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, true),
      accountMeta(rewardVaultState, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function verifyRewardVault(
  connection,
  { authority, config, metadataHash = REWARD_METADATA_HASH, rewardConfig, rewardVaultState, role },
) {
  const data = Buffer.alloc(8 + 1 + 32);
  discriminator("verify_reward_vault").copy(data, 0);
  data.writeUInt8(role.variant, 8);
  metadataHash.copy(data, 9);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, true),
      accountMeta(rewardVaultState, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function routePlatformFee(
  connection,
  {
    config,
    feeAmount,
    holderRewardVault,
    holderRewardVaultState,
    mint,
    payer,
    payerFeeAccount,
    rewardConfig,
    stakerRewardVault,
    stakerRewardVaultState,
    treasuryVault,
    treasuryVaultState,
  },
) {
  const data = Buffer.alloc(16);
  discriminator("route_platform_fee").copy(data, 0);
  data.writeBigUInt64LE(feeAmount, 8);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(payer.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, true),
      accountMeta(holderRewardVaultState, false, true),
      accountMeta(stakerRewardVaultState, false, true),
      accountMeta(treasuryVaultState, false, true),
      accountMeta(payerFeeAccount, false, true),
      accountMeta(holderRewardVault, false, true),
      accountMeta(stakerRewardVault, false, true),
      accountMeta(treasuryVault, false, true),
      accountMeta(mint, false, false),
      accountMeta(TOKEN_PROGRAM_ID, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [payer]);
}

async function draftRewardEpoch(
  connection,
  {
    authority,
    claimWindowSeconds = REWARD_CLAIM_WINDOW_SECONDS,
    claimMerkleRoot = REWARD_METADATA_HASH,
    config,
    distributedNetAmount = 700n,
    epochId,
    exclusionListHash = REWARD_METADATA_HASH,
    reservedDeliveryCostAmount = 100n,
    rewardConfig,
    rewardEpoch,
    rewardPoolAmount = 1_000n,
    rewardVaultStates,
    rolledForwardAmount = 200n,
    snapshotTakenAt,
  },
) {
  const effectiveSnapshotTakenAt = snapshotTakenAt ?? await recentRewardSnapshotTime(connection);
  const data = Buffer.alloc(8 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 32 + 32);
  discriminator("draft_reward_epoch").copy(data, 0);
  data.writeBigUInt64LE(epochId, 8);
  data.writeBigInt64LE(effectiveSnapshotTakenAt, 16);
  data.writeBigInt64LE(claimWindowSeconds, 24);
  data.writeBigUInt64LE(rewardPoolAmount, 32);
  data.writeBigUInt64LE(distributedNetAmount, 40);
  data.writeBigUInt64LE(reservedDeliveryCostAmount, 48);
  data.writeBigUInt64LE(rolledForwardAmount, 56);
  exclusionListHash.copy(data, 64);
  claimMerkleRoot.copy(data, 96);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, true),
      accountMeta(rewardVaultStates.holder, false, false),
      accountMeta(rewardVaultStates.staker, false, false),
      accountMeta(rewardVaultStates.treasury, false, false),
      accountMeta(rewardVaultStates.delivery, false, false),
      accountMeta(rewardVaultStates.rollover, false, false),
      accountMeta(rewardEpoch, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function reviewRewardEpoch(connection, { authority, config, epochId, rewardConfig, rewardEpoch }) {
  const data = Buffer.alloc(16);
  discriminator("review_reward_epoch").copy(data, 0);
  data.writeBigUInt64LE(epochId, 8);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, true),
      accountMeta(rewardEpoch, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function expireRewardEpochClaims(connection, { authority, config, epochId, rewardConfig, rewardEpoch }) {
  const data = Buffer.alloc(16);
  discriminator("expire_reward_epoch_claims").copy(data, 0);
  data.writeBigUInt64LE(epochId, 8);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, false),
      accountMeta(rewardEpoch, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function waitForRewardEpochExpiry(connection, args) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await expireRewardEpochClaims(connection, args);
      return;
    } catch (error) {
      lastError = error;
      await sleep(1_000);
    }
  }

  throw lastError;
}

async function createRewardClaimRecord(
  connection,
  {
    authority,
    config,
    deliveryCostAmount = 100n,
    epochId = 3n,
    grossAllocationAmount = 1_000n,
    netClaimAmount = 700n,
    rewardClaimRecord,
    rewardConfig,
    rewardEpoch,
    role,
    rolledForwardAmount = 200n,
    wallet,
  },
) {
  const data = Buffer.alloc(8 + 8 + 1 + 32 + 8 + 8 + 8 + 8);
  discriminator("create_reward_claim_record").copy(data, 0);
  data.writeBigUInt64LE(epochId, 8);
  data.writeUInt8(role.variant, 16);
  wallet.toBuffer().copy(data, 17);
  data.writeBigUInt64LE(grossAllocationAmount, 49);
  data.writeBigUInt64LE(deliveryCostAmount, 57);
  data.writeBigUInt64LE(netClaimAmount, 65);
  data.writeBigUInt64LE(rolledForwardAmount, 73);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, false),
      accountMeta(rewardEpoch, false, true),
      accountMeta(rewardClaimRecord, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function createRewardClaimRecordFromProof(
  connection,
  {
    deliveryCostAmount = 100n,
    epochId = 3n,
    grossAllocationAmount = 1_000n,
    leafIndex = 0n,
    netClaimAmount = 700n,
    owner,
    proof = [],
    rewardClaimRecord,
    rewardConfig,
    rewardEpoch,
    role,
    rolledForwardAmount = 200n,
  },
) {
  const data = Buffer.alloc(8 + 8 + 1 + 8 + 8 + 8 + 8 + 8 + 4 + proof.length * 32);
  discriminator("create_reward_claim_record_from_proof").copy(data, 0);
  data.writeBigUInt64LE(epochId, 8);
  data.writeUInt8(role.variant, 16);
  data.writeBigUInt64LE(grossAllocationAmount, 17);
  data.writeBigUInt64LE(deliveryCostAmount, 25);
  data.writeBigUInt64LE(netClaimAmount, 33);
  data.writeBigUInt64LE(rolledForwardAmount, 41);
  data.writeBigUInt64LE(leafIndex, 49);
  data.writeUInt32LE(proof.length, 57);
  let offset = 61;
  for (const node of proof) {
    Buffer.from(node).copy(data, offset);
    offset += 32;
  }
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(owner.publicKey, true, true),
      accountMeta(rewardConfig, false, false),
      accountMeta(rewardEpoch, false, true),
      accountMeta(rewardClaimRecord, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function claimRewardRecord(connection, { owner, rewardEpoch, rewardClaimRecord, role }) {
  const data = Buffer.alloc(9);
  discriminator("claim_reward_record").copy(data, 0);
  data.writeUInt8(role.variant, 8);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(owner.publicKey, true, false),
      accountMeta(rewardEpoch, false, false),
      accountMeta(rewardClaimRecord, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function claimRewardTokens(
  connection,
  {
    epochId,
    mint,
    owner,
    ownerRewardAccount,
    rewardClaimRecord,
    rewardConfig,
    rewardEpoch,
    rewardSourceVault,
    rewardVaultState,
    role,
  },
) {
  const data = Buffer.alloc(17);
  discriminator("claim_reward_tokens").copy(data, 0);
  data.writeBigUInt64LE(epochId, 8);
  data.writeUInt8(role.variant, 16);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(owner.publicKey, true, true),
      accountMeta(rewardConfig, false, false),
      accountMeta(rewardEpoch, false, true),
      accountMeta(rewardClaimRecord, false, true),
      accountMeta(rewardVaultState, false, false),
      accountMeta(rewardSourceVault, false, true),
      accountMeta(ownerRewardAccount, false, true),
      accountMeta(mint, false, false),
      accountMeta(TOKEN_PROGRAM_ID, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function updateFeeConfig(connection, { authority, baseFeeBps, config, tierFeeReductions }) {
  const data = Buffer.alloc(8 + 2 + 5 * 2);
  discriminator("update_fee_config").copy(data, 0);
  data.writeUInt16LE(baseFeeBps, 8);
  let offset = 10;
  for (const reduction of tierFeeReductions) {
    data.writeUInt16LE(reduction, offset);
    offset += 2;
  }
  const instruction = new TransactionInstruction({
    programId,
    keys: [accountMeta(authority.publicKey, true, false), accountMeta(config, false, true)],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function transferProtocolAuthority(connection, { authority, config, newAuthority }) {
  const data = Buffer.alloc(8 + 32);
  discriminator("transfer_protocol_authority").copy(data, 0);
  newAuthority.toBuffer().copy(data, 8);
  const instruction = new TransactionInstruction({
    programId,
    keys: [accountMeta(authority.publicKey, true, false), accountMeta(config, false, true)],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function acceptProtocolAuthority(connection, { config, pendingAuthority }) {
  const instruction = new TransactionInstruction({
    programId,
    keys: [accountMeta(pendingAuthority.publicKey, true, false), accountMeta(config, false, true)],
    data: discriminator("accept_protocol_authority"),
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [pendingAuthority]);
}

async function transferProjectAuthority(connection, { authority, config, newAuthority }) {
  const data = Buffer.alloc(8 + 32);
  discriminator("transfer_project_authority").copy(data, 0);
  newAuthority.toBuffer().copy(data, 8);
  const instruction = new TransactionInstruction({
    programId,
    keys: [accountMeta(authority.publicKey, true, false), accountMeta(config, false, true)],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function acceptProjectAuthority(connection, { config, pendingAuthority }) {
  const instruction = new TransactionInstruction({
    programId,
    keys: [accountMeta(pendingAuthority.publicKey, true, false), accountMeta(config, false, true)],
    data: discriminator("accept_project_authority"),
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [pendingAuthority]);
}

async function transferRewardAuthority(connection, { authority, config, newAuthority, rewardConfig }) {
  const data = Buffer.alloc(8 + 32);
  discriminator("transfer_reward_authority").copy(data, 0);
  newAuthority.toBuffer().copy(data, 8);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function acceptRewardAuthority(connection, { config, pendingAuthority, rewardConfig }) {
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(pendingAuthority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(rewardConfig, false, true),
    ],
    data: discriminator("accept_reward_authority"),
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [pendingAuthority]);
}

async function createGovernanceProposal(
  connection,
  {
    authority,
    config,
    minimumVotes = GOVERNANCE_MINIMUM_VOTES,
    proposal,
    proposalId,
    votingWindowSeconds = GOVERNANCE_VOTING_WINDOW_SECONDS,
  },
) {
  const data = Buffer.alloc(8 + 8 + 1 + 32 + 8 + 8);
  discriminator("create_governance_proposal").copy(data, 0);
  data.writeBigUInt64LE(proposalId, 8);
  data.writeUInt8(0, 16);
  REWARD_METADATA_HASH.copy(data, 17);
  data.writeBigInt64LE(votingWindowSeconds, 49);
  data.writeBigUInt64LE(minimumVotes, 57);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(proposal, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function waitForGovernanceWindowClose(connection, args) {
  let lastError;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await closeGovernanceProposal(connection, args);
      return;
    } catch (error) {
      lastError = error;
      await sleep(1_000);
    }
  }

  throw lastError;
}

async function castGovernanceVote(connection, { approve, config, owner, position, proposal, proposalId, voteRecord }) {
  const data = Buffer.alloc(8 + 8 + 1);
  discriminator("cast_governance_vote").copy(data, 0);
  data.writeBigUInt64LE(proposalId, 8);
  data.writeUInt8(approve ? 1 : 0, 16);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(owner.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(position, false, true),
      accountMeta(proposal, false, true),
      accountMeta(voteRecord, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function closeGovernanceProposal(connection, { approved, authority, config, proposal, proposalId }) {
  const data = Buffer.alloc(8 + 8 + 1);
  discriminator("close_governance_proposal").copy(data, 0);
  data.writeBigUInt64LE(proposalId, 8);
  data.writeUInt8(approved ? 1 : 0, 16);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(proposal, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function registerProject(
  connection,
  {
    authority,
    config,
    governanceProposal,
    maxWalletParticipationAmount = PROJECT_MAX_WALLET_PARTICIPATION_AMOUNT,
    maxTotalParticipationAmount = PROJECT_MAX_TOTAL_PARTICIPATION_AMOUNT,
    minParticipationAmount = PROJECT_MIN_PARTICIPATION_AMOUNT,
    participationEndsAt = PROJECT_PARTICIPATION_END_TS,
    participationStartsAt = PROJECT_PARTICIPATION_START_TS,
    project,
    projectId,
    receivingAccount,
    statusVariant = 2,
  },
) {
  const data = Buffer.alloc(8 + 8 + 1 + 1 + 1 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8);
  discriminator("register_project").copy(data, 0);
  data.writeBigUInt64LE(projectId, 8);
  data.writeUInt8(1, 16);
  data.writeUInt8(1, 17);
  data.writeUInt8(statusVariant, 18);
  REWARD_METADATA_HASH.copy(data, 19);
  receivingAccount.toBuffer().copy(data, 51);
  governanceProposal.toBuffer().copy(data, 83);
  data.writeBigUInt64LE(minParticipationAmount, 115);
  data.writeBigUInt64LE(maxWalletParticipationAmount, 123);
  data.writeBigUInt64LE(maxTotalParticipationAmount, 131);
  data.writeBigInt64LE(participationStartsAt, 139);
  data.writeBigInt64LE(participationEndsAt, 147);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(governanceProposal, false, false),
      accountMeta(project, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function updateProjectStatus(
  connection,
  { authority, config, governanceProposal, project, projectId, statusVariant },
) {
  const data = Buffer.alloc(8 + 8 + 1);
  discriminator("update_project_status").copy(data, 0);
  data.writeBigUInt64LE(projectId, 8);
  data.writeUInt8(statusVariant, 16);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(governanceProposal, false, false),
      accountMeta(project, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function setProjectPause(connection, { authority, config, paused, project, projectId }) {
  const data = Buffer.alloc(8 + 8 + 1);
  discriminator("set_project_pause").copy(data, 0);
  data.writeBigUInt64LE(projectId, 8);
  data.writeUInt8(paused ? 1 : 0, 16);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(project, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function cancelProject(connection, { authority, config, project, projectId, refundPoolAmount }) {
  const data = Buffer.alloc(8 + 8 + 32 + 8);
  discriminator("cancel_project").copy(data, 0);
  data.writeBigUInt64LE(projectId, 8);
  REWARD_METADATA_HASH.copy(data, 16);
  data.writeBigUInt64LE(refundPoolAmount, 48);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(project, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function recordProjectRefund(connection, { authority, config, project, projectId, refundAmount }) {
  const data = Buffer.alloc(8 + 8 + 8 + 32);
  discriminator("record_project_refund").copy(data, 0);
  data.writeBigUInt64LE(projectId, 8);
  data.writeBigUInt64LE(refundAmount, 16);
  REWARD_METADATA_HASH.copy(data, 24);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(project, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function participateProject(
  connection,
  { amount = PROJECT_MIN_PARTICIPATION_AMOUNT, config, owner, participation, position, project, projectId },
) {
  const data = Buffer.alloc(8 + 8 + 8 + 32);
  discriminator("participate_project").copy(data, 0);
  data.writeBigUInt64LE(projectId, 8);
  data.writeBigUInt64LE(amount, 16);
  REWARD_METADATA_HASH.copy(data, 24);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(owner.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(position, false, false),
      accountMeta(project, false, true),
      accountMeta(participation, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function createSeedBotPermission(connection, { config, expiresAt, owner, permission, position }) {
  const data = Buffer.alloc(8 + 32 + 8 + 8 + 8 + 2 + 2);
  discriminator("create_seedbot_permission").copy(data, 0);
  REWARD_METADATA_HASH.copy(data, 8);
  data.writeBigInt64LE(expiresAt, 40);
  data.writeBigUInt64LE(SEEDBOT_MAX_TRADE_AMOUNT, 48);
  data.writeBigUInt64LE(SEEDBOT_MAX_DAILY_VOLUME_AMOUNT, 56);
  data.writeUInt16LE(SEEDBOT_MAX_DAILY_TRADES, 64);
  data.writeUInt16LE(SEEDBOT_MAX_SLIPPAGE_BPS, 66);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(owner.publicKey, true, true),
      accountMeta(config, false, false),
      accountMeta(position, false, false),
      accountMeta(permission, false, true),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function revokeSeedBotPermission(connection, { owner, permission }) {
  const instruction = new TransactionInstruction({
    programId,
    keys: [accountMeta(owner.publicKey, true, false), accountMeta(permission, false, true)],
    data: discriminator("revoke_seedbot_permission"),
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function updateSeedBotPermission(connection, { config, expiresAt, owner, permission, position }) {
  const data = Buffer.alloc(8 + 32 + 8 + 8 + 8 + 2 + 2);
  discriminator("update_seedbot_permission").copy(data, 0);
  REWARD_METADATA_HASH.copy(data, 8);
  data.writeBigInt64LE(expiresAt, 40);
  data.writeBigUInt64LE(SEEDBOT_MAX_TRADE_AMOUNT, 48);
  data.writeBigUInt64LE(SEEDBOT_MAX_DAILY_VOLUME_AMOUNT, 56);
  data.writeUInt16LE(SEEDBOT_MAX_DAILY_TRADES, 64);
  data.writeUInt16LE(SEEDBOT_MAX_SLIPPAGE_BPS, 66);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(owner.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(position, false, false),
      accountMeta(permission, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function recordSeedBotUsage(connection, { config, owner, permission, position, slippageBps, tradeAmount }) {
  const data = Buffer.alloc(8 + 32 + 8 + 2);
  discriminator("record_seedbot_usage").copy(data, 0);
  REWARD_METADATA_HASH.copy(data, 8);
  data.writeBigUInt64LE(tradeAmount, 40);
  data.writeUInt16LE(slippageBps, 48);
  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(owner.publicKey, true, false),
      accountMeta(config, false, false),
      accountMeta(position, false, false),
      accountMeta(permission, false, true),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function recentRewardSnapshotTime(connection) {
  const slot = await connection.getSlot("confirmed");
  const blockTime = await connection.getBlockTime(slot);
  const currentUnixTime = BigInt(blockTime ?? Math.floor(Date.now() / 1000));
  return currentUnixTime > 5n ? currentUnixTime - 5n : currentUnixTime;
}

function deriveRewardEpochAddress({ epochId, rewardConfig }) {
  const epochSeed = Buffer.alloc(8);
  epochSeed.writeBigUInt64LE(epochId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reward-epoch"), rewardConfig.toBuffer(), epochSeed],
    programId,
  )[0];
}

function deriveRewardClaimAddress({ rewardEpoch, role, wallet }) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reward-claim"), rewardEpoch.toBuffer(), Buffer.from(role.seed), wallet.toBuffer()],
    programId,
  )[0];
}

function rewardClaimLeafHash({
  deliveryCostAmount,
  grossAllocationAmount,
  leafIndex,
  netClaimAmount,
  rewardEpoch,
  role,
  rolledForwardAmount,
  wallet,
}) {
  return keccakHash([
    Buffer.from("cryptoseeds-reward-claim-v1"),
    rewardEpoch.toBuffer(),
    Buffer.from([role.variant]),
    wallet.toBuffer(),
    u64Buffer(grossAllocationAmount),
    u64Buffer(deliveryCostAmount),
    u64Buffer(netClaimAmount),
    u64Buffer(rolledForwardAmount),
    u64Buffer(leafIndex),
  ]);
}

function rewardClaimNodeHash(left, right) {
  return keccakHash([Buffer.from("cryptoseeds-merkle-node-v1"), left, right]);
}

function keccakHash(buffers) {
  return Buffer.from(keccak_256(Buffer.concat(buffers)));
}

function deriveGovernanceProposalAddress(proposalId) {
  const proposalSeed = Buffer.alloc(8);
  proposalSeed.writeBigUInt64LE(proposalId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("governance-proposal"), proposalSeed],
    programId,
  )[0];
}

function deriveGovernanceVoteAddress({ proposal, wallet }) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("governance-vote"), proposal.toBuffer(), wallet.toBuffer()],
    programId,
  )[0];
}

function deriveProjectAddress(projectId) {
  const projectSeed = Buffer.alloc(8);
  projectSeed.writeBigUInt64LE(projectId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("project-record"), projectSeed],
    programId,
  )[0];
}

function deriveProjectParticipationAddress({ project, wallet }) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("project-participation"), project.toBuffer(), wallet.toBuffer()],
    programId,
  )[0];
}

function deriveSeedBotPermissionAddress(wallet) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("seedbot-permission"), wallet.toBuffer()],
    programId,
  )[0];
}

function u64Buffer(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

async function initializeConfig(
  connection,
  {
    authority,
    baseFeeBps = BASE_FEE_BPS,
    config,
    mint,
    rypVault,
    tierFeeReductions = TIER_FEE_REDUCTIONS,
    tierThresholds = TIER_THRESHOLDS,
  },
) {
  const data = Buffer.alloc(8 + 2 + 5 * 8 + 5 * 2);
  discriminator("initialize_config").copy(data, 0);
  data.writeUInt16LE(baseFeeBps, 8);
  let offset = 10;
  for (const threshold of tierThresholds) {
    data.writeBigUInt64LE(threshold, offset);
    offset += 8;
  }
  for (const reduction of tierFeeReductions) {
    data.writeUInt16LE(reduction, offset);
    offset += 2;
  }

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      accountMeta(authority.publicKey, true, true),
      accountMeta(mint, false, false),
      accountMeta(config, false, true),
      accountMeta(rypVault, false, true),
      accountMeta(TOKEN_PROGRAM_ID, false, false),
      accountMeta(ASSOCIATED_TOKEN_PROGRAM_ID, false, false),
      accountMeta(SystemProgram.programId, false, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function setPause(connection, { authority, config, paused }) {
  const data = Buffer.alloc(9);
  discriminator("set_pause").copy(data, 0);
  data.writeUInt8(paused ? 1 : 0, 8);
  const instruction = new TransactionInstruction({
    programId,
    keys: [accountMeta(authority.publicKey, true, false), accountMeta(config, false, true)],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function stakeRyp(connection, { amount, config, mint, owner, ownerRypAccount, position, rypVault }) {
  const instruction = programAmountInstruction("stake_ryp", amount, [
    accountMeta(owner.publicKey, true, true),
    accountMeta(config, false, true),
    accountMeta(mint, false, false),
    accountMeta(ownerRypAccount, false, true),
    accountMeta(rypVault, false, true),
    accountMeta(position, false, true),
    accountMeta(TOKEN_PROGRAM_ID, false, false),
    accountMeta(ASSOCIATED_TOKEN_PROGRAM_ID, false, false),
    accountMeta(SystemProgram.programId, false, false),
  ]);

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function unstakeRyp(connection, { amount, config, mint, owner, ownerRypAccount, position, rypVault }) {
  const instruction = programAmountInstruction("unstake_ryp", amount, [
    accountMeta(owner.publicKey, true, true),
    accountMeta(config, false, true),
    accountMeta(mint, false, false),
    accountMeta(ownerRypAccount, false, true),
    accountMeta(rypVault, false, true),
    accountMeta(position, false, true),
    accountMeta(TOKEN_PROGRAM_ID, false, false),
  ]);

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

async function activateVotingRights(connection, { config, owner, position }) {
  const instruction = new TransactionInstruction({
    programId,
    keys: [accountMeta(owner.publicKey, true, false), accountMeta(config, false, false), accountMeta(position, false, true)],
    data: discriminator("activate_voting_rights"),
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [owner]);
}

function programAmountInstruction(name, amount, keys) {
  const data = Buffer.alloc(16);
  discriminator(name).copy(data, 0);
  data.writeBigUInt64LE(amount, 8);
  return new TransactionInstruction({ programId, keys, data });
}

async function createMint(connection, { authority, mint }) {
  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const data = Buffer.alloc(70);
  data.writeUInt8(0, 0);
  data.writeUInt8(RYP_DECIMALS, 1);
  authority.publicKey.toBuffer().copy(data, 2);
  data.writeUInt32LE(0, 34);

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: authority.publicKey,
      lamports,
      newAccountPubkey: mint.publicKey,
      programId: TOKEN_PROGRAM_ID,
      space: MINT_SIZE,
    }),
    new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [accountMeta(mint.publicKey, false, true), accountMeta(SYSVAR_RENT_PUBKEY, false, false)],
      data,
    }),
  );

  await sendAndConfirm(connection, transaction, [authority, mint]);
}

async function createAssociatedTokenAccount(connection, { mint, owner, payer, tokenAccount }) {
  const instruction = new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      accountMeta(payer.publicKey, true, true),
      accountMeta(tokenAccount, false, true),
      accountMeta(owner, false, false),
      accountMeta(mint, false, false),
      accountMeta(SystemProgram.programId, false, false),
      accountMeta(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.alloc(0),
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [payer]);
}

async function createTokenAccount(connection, { mint, owner, payer, tokenAccount }) {
  const lamports = await connection.getMinimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);
  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      lamports,
      newAccountPubkey: tokenAccount.publicKey,
      programId: TOKEN_PROGRAM_ID,
      space: TOKEN_ACCOUNT_SIZE,
    }),
    new TransactionInstruction({
      programId: TOKEN_PROGRAM_ID,
      keys: [
        accountMeta(tokenAccount.publicKey, false, true),
        accountMeta(mint, false, false),
        accountMeta(owner, false, false),
        accountMeta(SYSVAR_RENT_PUBKEY, false, false),
      ],
      data: Buffer.from([1]),
    }),
  );

  await sendAndConfirm(connection, transaction, [payer, tokenAccount]);
}

async function mintTo(connection, { amount, authority, destination, mint }) {
  const data = Buffer.alloc(9);
  data.writeUInt8(7, 0);
  data.writeBigUInt64LE(amount, 1);
  const instruction = new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      accountMeta(mint, false, true),
      accountMeta(destination, false, true),
      accountMeta(authority.publicKey, true, false),
    ],
    data,
  });

  await sendAndConfirm(connection, new Transaction().add(instruction), [authority]);
}

async function fund(connection, publicKey, sol) {
  const signature = await withTimeout(
    `airdrop ${publicKey.toBase58()}`,
    connection.requestAirdrop(publicKey, sol * LAMPORTS_PER_SOL),
    20_000,
  );
  await confirmSignature(connection, signature);
}

async function sendAndConfirm(connection, transaction, signers) {
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  transaction.feePayer = signers[0].publicKey;
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.sign(...signers);
  const signature = await withTimeout(
    "send transaction",
    connection.sendRawTransaction(transaction.serialize(), { maxRetries: 5, skipPreflight: false }),
    20_000,
  );
  await confirmSignature(connection, signature, latestBlockhash);
  return signature;
}

async function confirmSignature(connection, signature, latestBlockhash) {
  const blockhash = latestBlockhash ?? (await connection.getLatestBlockhash("confirmed"));
  await withTimeout(
    `confirm transaction ${signature}`,
    connection.confirmTransaction({ ...blockhash, signature }, "confirmed"),
    30_000,
  );
}

async function readTokenBalance(connection, tokenAccount) {
  const balance = await connection.getTokenAccountBalance(tokenAccount, "confirmed");
  return BigInt(balance.value.amount);
}

async function getAccountData(connection, publicKey) {
  const accountInfo = await connection.getAccountInfo(publicKey, "confirmed");
  if (!accountInfo) {
    throw new Error(`Missing account: ${publicKey.toBase58()}`);
  }
  return accountInfo.data;
}

async function assertMissingAccount(connection, publicKey, label) {
  const accountInfo = await connection.getAccountInfo(publicKey, "confirmed");
  if (accountInfo) {
    throw new Error(`${label}: expected account to be missing`);
  }
}

function parseProtocolConfig(data) {
  assertRewardAccountLayout(data, "ProtocolConfig");
  const offset = rewardAccountOffsets.ProtocolConfig;

  return {
    authority: new PublicKey(data.subarray(offset.authority, offset.authority + 32)),
    rypMint: new PublicKey(data.subarray(offset.ryp_mint, offset.ryp_mint + 32)),
    rypVault: new PublicKey(data.subarray(offset.ryp_vault, offset.ryp_vault + 32)),
    baseFeeBps: data.readUInt16LE(offset.base_fee_bps),
    totalStaked: data.readBigUInt64LE(offset.total_staked),
    paused: data.readUInt8(offset.paused) === 1,
    pendingAuthority: new PublicKey(data.subarray(offset.pending_authority, offset.pending_authority + 32)),
    projectAuthority: new PublicKey(data.subarray(offset.project_authority, offset.project_authority + 32)),
    pendingProjectAuthority: new PublicKey(
      data.subarray(offset.pending_project_authority, offset.pending_project_authority + 32),
    ),
  };
}

function parseStakePosition(data) {
  return {
    owner: new PublicKey(data.subarray(8, 40)),
    stakedAmount: data.readBigUInt64LE(40),
    tier: data.readUInt8(48),
    stakingStartTs: data.readBigInt64LE(49),
    votingRightsEligibleTs: data.readBigInt64LE(57),
    lastRewardClaimTs: data.readBigInt64LE(65),
    goldenKeyActive: data.readUInt8(73) === 1,
    votingRightsActive: data.readUInt8(74) === 1,
    voteCount: data.readUInt32LE(75),
    bump: data.readUInt8(79),
    goldenKeyIssuedAt: data.readBigInt64LE(80),
    goldenKeyRevokedAt: data.readBigInt64LE(88),
    votingRightsActivatedAt: data.readBigInt64LE(96),
    votingRightsLevel: data.readUInt8(104),
  };
}

function parseRewardConfig(data) {
  assertRewardAccountLayout(data, "RewardConfig");
  const offset = rewardAccountOffsets.RewardConfig;

  return {
    authority: new PublicKey(data.subarray(offset.authority, offset.authority + 32)),
    protocolConfig: new PublicKey(data.subarray(offset.protocol_config, offset.protocol_config + 32)),
    rypMint: new PublicKey(data.subarray(offset.ryp_mint, offset.ryp_mint + 32)),
    epochCadenceSeconds: data.readBigInt64LE(offset.epoch_cadence_seconds),
    holderSplitBps: data.readUInt16LE(offset.holder_split_bps),
    stakerSplitBps: data.readUInt16LE(offset.staker_split_bps),
    treasurySplitBps: data.readUInt16LE(offset.treasury_split_bps),
    registeredVaultRolesMask: data.readUInt8(offset.registered_vault_roles_mask),
    verifiedVaultRolesMask: data.readUInt8(offset.verified_vault_roles_mask),
    totalEpochDrafts: data.readBigUInt64LE(offset.total_epoch_drafts),
    totalRoutedFeeAmount: data.readBigUInt64LE(offset.total_routed_fee_amount),
    paused: data.readUInt8(offset.paused) === 1,
    draftOnly: data.readUInt8(offset.draft_only) === 1,
    bump: data.readUInt8(offset.bump),
    pendingAuthority: new PublicKey(data.subarray(offset.pending_authority, offset.pending_authority + 32)),
  };
}

function parseRewardVaultState(data) {
  assertRewardAccountLayout(data, "RewardVaultState");
  const offset = rewardAccountOffsets.RewardVaultState;

  return {
    rewardConfig: new PublicKey(data.subarray(offset.reward_config, offset.reward_config + 32)),
    role: data.readUInt8(offset.role),
    rewardMint: new PublicKey(data.subarray(offset.reward_mint, offset.reward_mint + 32)),
    vaultAddress: new PublicKey(data.subarray(offset.vault_address, offset.vault_address + 32)),
    custodyModel: data.readUInt8(offset.custody_model),
    verificationStatus: data.readUInt8(offset.verification_status),
    metadataHash: data.subarray(offset.metadata_hash, offset.metadata_hash + 32),
    totalFundedAmount: data.readBigUInt64LE(offset.total_funded_amount),
    receivesUserFunds: data.readUInt8(offset.receives_user_funds) === 1,
    bump: data.readUInt8(offset.bump),
  };
}

function parseRewardEpoch(data) {
  assertRewardAccountLayout(data, "RewardEpoch");
  const offset = rewardAccountOffsets.RewardEpoch;

  return {
    rewardConfig: new PublicKey(data.subarray(offset.reward_config, offset.reward_config + 32)),
    epochId: data.readBigUInt64LE(offset.epoch_id),
    snapshotTakenAt: data.readBigInt64LE(offset.snapshot_taken_at),
    createdAt: data.readBigInt64LE(offset.created_at),
    rewardMint: new PublicKey(data.subarray(offset.reward_mint, offset.reward_mint + 32)),
    rewardPoolAmount: data.readBigUInt64LE(offset.reward_pool_amount),
    distributedNetAmount: data.readBigUInt64LE(offset.distributed_net_amount),
    reservedDeliveryCostAmount: data.readBigUInt64LE(offset.reserved_delivery_cost_amount),
    rolledForwardAmount: data.readBigUInt64LE(offset.rolled_forward_amount),
    recordedGrossAllocationAmount: data.readBigUInt64LE(offset.recorded_gross_allocation_amount),
    recordedNetClaimAmount: data.readBigUInt64LE(offset.recorded_net_claim_amount),
    claimedNetAmount: data.readBigUInt64LE(offset.claimed_net_amount),
    claimExpiresAt: data.readBigInt64LE(offset.claim_expires_at),
    expiredUnclaimedNetAmount: data.readBigUInt64LE(offset.expired_unclaimed_net_amount),
    expiredRecordedAt: data.readBigInt64LE(offset.expired_recorded_at),
    exclusionListHash: data.subarray(offset.exclusion_list_hash, offset.exclusion_list_hash + 32),
    claimMerkleRoot: data.subarray(offset.claim_merkle_root, offset.claim_merkle_root + 32),
    status: data.readUInt8(offset.status),
    executionBlocked: data.readUInt8(offset.execution_blocked) === 1,
    bump: data.readUInt8(offset.bump),
  };
}

function parseRewardClaimRecord(data) {
  assertRewardAccountLayout(data, "RewardClaimRecord");
  const offset = rewardAccountOffsets.RewardClaimRecord;

  return {
    rewardEpoch: new PublicKey(data.subarray(offset.reward_epoch, offset.reward_epoch + 32)),
    rewardRole: data.readUInt8(offset.reward_role),
    wallet: new PublicKey(data.subarray(offset.wallet, offset.wallet + 32)),
    grossAllocationAmount: data.readBigUInt64LE(offset.gross_allocation_amount),
    deliveryCostAmount: data.readBigUInt64LE(offset.delivery_cost_amount),
    netClaimAmount: data.readBigUInt64LE(offset.net_claim_amount),
    rolledForwardAmount: data.readBigUInt64LE(offset.rolled_forward_amount),
    claimed: data.readUInt8(offset.claimed) === 1,
    bump: data.readUInt8(offset.bump),
  };
}

function parseGovernanceProposal(data) {
  assertRewardAccountLayout(data, "GovernanceProposal");
  const offset = rewardAccountOffsets.GovernanceProposal;

  return {
    proposalId: data.readBigUInt64LE(offset.proposal_id),
    authority: new PublicKey(data.subarray(offset.authority, offset.authority + 32)),
    category: data.readUInt8(offset.category),
    status: data.readUInt8(offset.status),
    yesVotes: data.readBigUInt64LE(offset.yes_votes),
    noVotes: data.readBigUInt64LE(offset.no_votes),
    createdAt: data.readBigInt64LE(offset.created_at),
    votingStartsAt: data.readBigInt64LE(offset.voting_starts_at),
    votingEndsAt: data.readBigInt64LE(offset.voting_ends_at),
    minimumVotes: data.readBigUInt64LE(offset.minimum_votes),
    closedAt: data.readBigInt64LE(offset.closed_at),
    bump: data.readUInt8(offset.bump),
  };
}

function parseProjectRecord(data) {
  assertRewardAccountLayout(data, "ProjectRecord");
  const offset = rewardAccountOffsets.ProjectRecord;

  return {
    projectId: data.readBigUInt64LE(offset.project_id),
    authority: new PublicKey(data.subarray(offset.authority, offset.authority + 32)),
    requiredTier: data.readUInt8(offset.required_tier),
    riskLevel: data.readUInt8(offset.risk_level),
    status: data.readUInt8(offset.status),
    receivingAccount: new PublicKey(data.subarray(offset.receiving_account, offset.receiving_account + 32)),
    governanceProposal: new PublicKey(data.subarray(offset.governance_proposal, offset.governance_proposal + 32)),
    totalParticipants: data.readBigUInt64LE(offset.total_participants),
    minParticipationAmount: data.readBigUInt64LE(offset.min_participation_amount),
    maxWalletParticipationAmount: data.readBigUInt64LE(offset.max_wallet_participation_amount),
    maxTotalParticipationAmount: data.readBigUInt64LE(offset.max_total_participation_amount),
    totalParticipationAmount: data.readBigUInt64LE(offset.total_participation_amount),
    participationStartsAt: data.readBigInt64LE(offset.participation_starts_at),
    participationEndsAt: data.readBigInt64LE(offset.participation_ends_at),
    cancelledAt: data.readBigInt64LE(offset.cancelled_at),
    refundPoolAmount: data.readBigUInt64LE(offset.refund_pool_amount),
    totalRefundedAmount: data.readBigUInt64LE(offset.total_refunded_amount),
    participationPaused: data.readUInt8(offset.participation_paused) === 1,
    bump: data.readUInt8(offset.bump),
  };
}

function parseProjectParticipationRecord(data) {
  assertRewardAccountLayout(data, "ProjectParticipationRecord");
  const offset = rewardAccountOffsets.ProjectParticipationRecord;

  return {
    project: new PublicKey(data.subarray(offset.project, offset.project + 32)),
    wallet: new PublicKey(data.subarray(offset.wallet, offset.wallet + 32)),
    participationAmount: data.readBigUInt64LE(offset.participation_amount),
    joinedAt: data.readBigInt64LE(offset.joined_at),
    status: data.readUInt8(offset.status),
    bump: data.readUInt8(offset.bump),
  };
}

function parseSeedBotPermission(data) {
  assertRewardAccountLayout(data, "SeedBotPermission");
  const offset = rewardAccountOffsets.SeedBotPermission;

  return {
    owner: new PublicKey(data.subarray(offset.owner, offset.owner + 32)),
    position: new PublicKey(data.subarray(offset.position, offset.position + 32)),
    createdAt: data.readBigInt64LE(offset.created_at),
    expiresAt: data.readBigInt64LE(offset.expires_at),
    maxTradeAmount: data.readBigUInt64LE(offset.max_trade_amount),
    maxDailyVolumeAmount: data.readBigUInt64LE(offset.max_daily_volume_amount),
    maxDailyTrades: data.readUInt16LE(offset.max_daily_trades),
    maxSlippageBps: data.readUInt16LE(offset.max_slippage_bps),
    tierAtCreation: data.readUInt8(offset.tier_at_creation),
    stakedAmountAtCreation: data.readBigUInt64LE(offset.staked_amount_at_creation),
    stakingStartTsAtCreation: data.readBigInt64LE(offset.staking_start_ts_at_creation),
    revoked: data.readUInt8(offset.revoked) === 1,
    bump: data.readUInt8(offset.bump),
    usageDayStartTs: data.readBigInt64LE(offset.usage_day_start_ts),
    dailyVolumeUsedAmount: data.readBigUInt64LE(offset.daily_volume_used_amount),
    dailyTradesUsed: data.readUInt16LE(offset.daily_trades_used),
    totalVolumeUsedAmount: data.readBigUInt64LE(offset.total_volume_used_amount),
    totalTradesUsed: data.readBigUInt64LE(offset.total_trades_used),
    lastExecutionTs: data.readBigInt64LE(offset.last_execution_ts),
  };
}

function rewardVaultRoleLabel(variant) {
  if (variant === 0) return "HOLDER_REWARD";
  if (variant === 1) return "STAKER_REWARD";
  if (variant === 2) return "INDEPENDENT_TREASURY";
  if (variant === 3) return "DELIVERY_COST_RESERVE";
  if (variant === 4) return "ROLLOVER";
  return "UNKNOWN";
}

function rewardVaultCustodyModelLabel(variant) {
  if (variant === 0) return "PROGRAM_CONTROLLED";
  if (variant === 1) return "TREASURY_CONTROLLED";
  if (variant === 2) return "DISCLOSURE_PENDING";
  return "UNKNOWN";
}

function rewardVaultVerificationStatusLabel(variant) {
  if (variant === 0) return "DRAFT";
  if (variant === 1) return "PENDING_VERIFICATION";
  if (variant === 2) return "VERIFIED";
  if (variant === 3) return "DISABLED";
  return "UNKNOWN";
}

function rewardEpochStatusLabel(variant) {
  if (variant === 0) return "DRAFTED";
  if (variant === 1) return "REVIEWED";
  if (variant === 2) return "CANCELLED";
  if (variant === 3) return "EXPIRED";
  return "UNKNOWN";
}

function assertRewardAccountLayout(data, accountName) {
  const layout = rewardAccountLayouts[accountName];
  if (data.length < layout.minimumLength) {
    throw new Error(`${accountName} localnet account is too small: expected at least ${layout.minimumLength} bytes.`);
  }

  const actualDiscriminator = bytesToHex([...data.subarray(0, 8)]);
  if (actualDiscriminator !== layout.discriminatorHex) {
    throw new Error(`${accountName} localnet discriminator mismatch: expected ${layout.discriminatorHex}.`);
  }
}

function bytesToHex(bytes) {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function discriminator(name) {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function deriveAssociatedTokenAddress({ mint, owner }) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

function accountMeta(pubkey, isSigner, isWritable) {
  return { pubkey, isSigner, isWritable };
}

function assertPublicKey(label, actual, expected) {
  if (!actual.equals(expected)) {
    throw new Error(`${label}: expected ${expected.toBase58()}, received ${actual.toBase58()}`);
  }
}

function assertEqual(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected.toString()}, received ${actual.toString()}`);
  }
}

async function expectFailure(label, action, expectedMessage) {
  try {
    await action();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (expectedMessage && !message.includes(expectedMessage)) {
      throw new Error(`${label}: expected failure including "${expectedMessage}", received "${message}"`);
    }
    log(`${label}: rejected as expected`);
    return;
  }

  throw new Error(`${label}: expected transaction failure`);
}

async function readProgramId() {
  const anchorToml = await readFile(path.join(repoRoot, "Anchor.toml"), "utf8");
  const match = anchorToml.match(/cryptoseeds_protocol\s*=\s*"([^"]+)"/);
  if (!match) {
    throw new Error("Could not read cryptoseeds_protocol program id from Anchor.toml");
  }
  return match[1];
}

function resolveProgramSoPath() {
  const candidates = [
    path.join(repoRoot, "target", "deploy", "cryptoseeds_protocol.so"),
    path.join(repoRoot, "programs", "cryptoseeds_protocol", "target", "deploy", "cryptoseeds_protocol.so"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(`Missing compiled program. Tried: ${candidates.join(", ")}`);
  }
  return found;
}

function spawnValidator({ faucetPort, rpcPort }) {
  const args = [
    "--reset",
    "--quiet",
    "--ledger",
    ledgerPath,
    "--bind-address",
    "127.0.0.1",
    "--rpc-port",
    rpcPort.toString(),
    "--faucet-port",
    faucetPort.toString(),
    "--bpf-program",
    programId.toBase58(),
    programSoPath,
  ];
  const child = spawn("solana-test-validator", args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.on("data", (chunk) => {
    validatorStderr = `${validatorStderr}${chunk.toString()}`.slice(-8_000);
  });
  child.stdout.on("data", () => undefined);
  child.once("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(validatorStderr);
    }
  });
  return child;
}

async function waitForValidator(connection) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (validator?.exitCode !== null) {
      throw new Error(`solana-test-validator exited early with code ${validator.exitCode}`);
    }

    try {
      await connection.getVersion();
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(`Timed out waiting for solana-test-validator RPC\n${validatorStderr}`);
}

async function getFreeValidatorPorts() {
  for (let port = 20_000; port < 40_000; port += 3) {
    if ((await canUsePort(port)) && (await canUsePort(port + 1)) && (await canUsePort(port + 2))) {
      return { rpcPort: port, faucetPort: port + 2 };
    }
  }
  throw new Error("Could not find free local validator ports");
}

function canUsePort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function closeConnection() {
  const websocket = activeConnection?._rpcWebSocket;
  websocket?.close?.();
  websocket?.removeAllListeners?.();
}

async function stopValidator() {
  if (!validator || validator.exitCode !== null) return;

  validator.kill("SIGINT");
  const closed = new Promise((resolve) => validator.once("close", resolve));
  const stopped = await Promise.race([closed.then(() => true), sleep(5_000).then(() => false)]);
  if (!stopped && validator.exitCode === null) {
    validator.kill("SIGKILL");
    await Promise.race([closed, sleep(2_000)]);
  }
}

function withTimeout(label, promise, ms) {
  return Promise.race([
    promise,
    sleep(ms).then(() => {
      throw new Error(`${label} timed out after ${ms}ms\n${validatorStderr}`);
    }),
  ]);
}

function log(message) {
  console.log(`[localnet-smoke] ${message}`);
}
