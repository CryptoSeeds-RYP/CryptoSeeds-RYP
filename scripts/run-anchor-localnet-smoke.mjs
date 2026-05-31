import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { rm, readFile } from "node:fs/promises";
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

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const MINT_SIZE = 82;
const RYP_DECIMALS = 6;
const SEED_STAKE_AMOUNT = 5_000_000_000n;
const ADD_TO_SPROUT_AMOUNT = 15_000_000_000n;
const SPROUT_STAKE_AMOUNT = 20_000_000_000n;
const VOTING_RIGHTS_DELAY_SECONDS = 14n * 24n * 60n * 60n;
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
const REWARD_ROLES = [
  { key: "holder", name: "HolderReward", seed: "holder-reward", variant: 0, custodyModel: 0 },
  { key: "staker", name: "StakerReward", seed: "staker-reward", variant: 1, custodyModel: 0 },
  { key: "treasury", name: "IndependentTreasury", seed: "independent-treasury", variant: 2, custodyModel: 1 },
  { key: "delivery", name: "DeliveryCostReserve", seed: "delivery-cost-reserve", variant: 3, custodyModel: 0 },
  { key: "rollover", name: "Rollover", seed: "rollover", variant: 4, custodyModel: 0 },
];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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
  console.log(JSON.stringify(result, null, 2));
} finally {
  closeConnection();
  await stopValidator();
}

process.exit(0);

async function runSmoke(connection) {
  const authority = Keypair.generate();
  const owner = Keypair.generate();
  const intruder = Keypair.generate();
  const mint = Keypair.generate();
  log("funding authority and owner wallets");
  await fund(connection, authority.publicKey, 10);
  await fund(connection, owner.publicKey, 10);
  await fund(connection, intruder.publicKey, 10);

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
  const rewardVaultAddresses = Object.fromEntries(
    REWARD_ROLES.map((role) => [role.key, Keypair.generate().publicKey]),
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
    amount: SEED_STAKE_AMOUNT,
    authority,
    destination: ownerRypAccount,
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
  assertPublicKey("config mint", initializedConfig.rypMint, mint.publicKey);
  assertPublicKey("config vault", initializedConfig.rypVault, rypVault);
  assertEqual("base fee bps", initializedConfig.baseFeeBps, BASE_FEE_BPS);
  assertEqual("initial total staked", initializedConfig.totalStaked, 0n);
  assertEqual("initial pause state", initializedConfig.paused, false);

  await runRewardSmoke(connection, {
    authority,
    config,
    intruder,
    mint: mint.publicKey,
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
  assertEqual("voting rights initially inactive", stakedPosition.votingRightsActive, false);
  assertEqual(
    "voting rights delay seconds",
    stakedPosition.votingRightsEligibleTs - stakedPosition.stakingStartTs,
    VOTING_RIGHTS_DELAY_SECONDS,
  );
  assertEqual("vault balance after stake", stakedVaultBalance, SEED_STAKE_AMOUNT);

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
  assertEqual("final voting rights state", finalPosition.votingRightsActive, false);
  assertEqual("final vault balance", finalVaultBalance, 0n);
  assertEqual("final owner balance", finalOwnerBalance, SPROUT_STAKE_AMOUNT);

  return {
    status: "passed",
    programId: programId.toBase58(),
    mint: mint.publicKey.toBase58(),
    config: config.toBase58(),
    rewardConfig: rewardConfig.toBase58(),
    position: position.toBase58(),
    rypVault: rypVault.toBase58(),
    checked: [
      "initialize_config",
      "reject_invalid_thresholds",
      "reject_invalid_reward_split",
      "initialize_reward_config",
      "reject_blank_reward_metadata",
      "register_reward_vaults",
      "reject_reward_epoch_before_vault_verification",
      "reject_reward_vault_metadata_mismatch",
      "verify_reward_vaults",
      "reject_non_authority_reward_verify",
      "reject_unbalanced_reward_epoch",
      "draft_reward_epoch",
      "reject_below_tier_stake",
      "stake_ryp",
      "reject_early_voting_activation",
      "reject_unauthorized_unstake",
      "reject_insufficient_unstake",
      "stake_top_up_to_sprout",
      "partial_unstake_back_to_seed",
      "reject_unauthorized_pause",
      "pause_blocks_stake_and_unstake",
      "pause_blocks_voting_activation",
      "unstake_ryp",
    ],
  };
}

async function runRewardSmoke(
  connection,
  { authority, config, intruder, mint, rewardConfig, rewardVaultAddresses, rewardVaultStates },
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
  log("calling draft_reward_epoch");
  await draftRewardEpoch(connection, {
    authority,
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

async function draftRewardEpoch(
  connection,
  {
    authority,
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
    snapshotTakenAt = 1_800_000_000n,
  },
) {
  const data = Buffer.alloc(8 + 8 + 8 + 8 + 8 + 8 + 8 + 32);
  discriminator("draft_reward_epoch").copy(data, 0);
  data.writeBigUInt64LE(epochId, 8);
  data.writeBigInt64LE(snapshotTakenAt, 16);
  data.writeBigUInt64LE(rewardPoolAmount, 24);
  data.writeBigUInt64LE(distributedNetAmount, 32);
  data.writeBigUInt64LE(reservedDeliveryCostAmount, 40);
  data.writeBigUInt64LE(rolledForwardAmount, 48);
  exclusionListHash.copy(data, 56);

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

function deriveRewardEpochAddress({ epochId, rewardConfig }) {
  const epochSeed = Buffer.alloc(8);
  epochSeed.writeBigUInt64LE(epochId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("reward-epoch"), rewardConfig.toBuffer(), epochSeed],
    programId,
  )[0];
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
  return {
    authority: new PublicKey(data.subarray(8, 40)),
    rypMint: new PublicKey(data.subarray(40, 72)),
    rypVault: new PublicKey(data.subarray(72, 104)),
    baseFeeBps: data.readUInt16LE(104),
    totalStaked: data.readBigUInt64LE(156),
    paused: data.readUInt8(164) === 1,
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
  };
}

function parseRewardConfig(data) {
  return {
    authority: new PublicKey(data.subarray(8, 40)),
    protocolConfig: new PublicKey(data.subarray(40, 72)),
    rypMint: new PublicKey(data.subarray(72, 104)),
    epochCadenceSeconds: data.readBigInt64LE(104),
    holderSplitBps: data.readUInt16LE(112),
    stakerSplitBps: data.readUInt16LE(114),
    treasurySplitBps: data.readUInt16LE(116),
    registeredVaultRolesMask: data.readUInt8(118),
    verifiedVaultRolesMask: data.readUInt8(119),
    totalEpochDrafts: data.readBigUInt64LE(120),
    paused: data.readUInt8(128) === 1,
    draftOnly: data.readUInt8(129) === 1,
    bump: data.readUInt8(130),
  };
}

function parseRewardVaultState(data) {
  return {
    rewardConfig: new PublicKey(data.subarray(8, 40)),
    role: data.readUInt8(40),
    rewardMint: new PublicKey(data.subarray(41, 73)),
    vaultAddress: new PublicKey(data.subarray(73, 105)),
    custodyModel: data.readUInt8(105),
    verificationStatus: data.readUInt8(106),
    metadataHash: data.subarray(107, 139),
    receivesUserFunds: data.readUInt8(139) === 1,
    bump: data.readUInt8(140),
  };
}

function parseRewardEpoch(data) {
  return {
    rewardConfig: new PublicKey(data.subarray(8, 40)),
    epochId: data.readBigUInt64LE(40),
    snapshotTakenAt: data.readBigInt64LE(48),
    createdAt: data.readBigInt64LE(56),
    rewardMint: new PublicKey(data.subarray(64, 96)),
    rewardPoolAmount: data.readBigUInt64LE(96),
    distributedNetAmount: data.readBigUInt64LE(104),
    reservedDeliveryCostAmount: data.readBigUInt64LE(112),
    rolledForwardAmount: data.readBigUInt64LE(120),
    exclusionListHash: data.subarray(128, 160),
    status: data.readUInt8(160),
    executionBlocked: data.readUInt8(161) === 1,
    bump: data.readUInt8(162),
  };
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
