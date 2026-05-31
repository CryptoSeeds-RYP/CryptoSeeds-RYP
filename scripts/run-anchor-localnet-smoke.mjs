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
const TIER_THRESHOLDS = [5_000_000_000n, 20_000_000_000n, 50_000_000_000n, 100_000_000_000n, 150_000_000_000n];
const TIER_FEE_REDUCTIONS = [0, 35, 70, 105, 140];
const BASE_FEE_BPS = 350;

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

  log("validator ready; running initialize/stake/unstake smoke flow");
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
  const mint = Keypair.generate();
  log("funding authority and owner wallets");
  await fund(connection, authority.publicKey, 10);
  await fund(connection, owner.publicKey, 10);

  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  const [position] = PublicKey.findProgramAddressSync([Buffer.from("stake-position"), owner.publicKey.toBuffer()], programId);
  const ownerRypAccount = deriveAssociatedTokenAddress({ mint: mint.publicKey, owner: owner.publicKey });
  const rypVault = deriveAssociatedTokenAddress({ mint: mint.publicKey, owner: config });

  log("creating test mint and owner token account");
  await createMint(connection, { authority, mint });
  await createAssociatedTokenAccount(connection, {
    mint: mint.publicKey,
    owner: owner.publicKey,
    payer: authority,
    tokenAccount: ownerRypAccount,
  });
  await mintTo(connection, {
    amount: SEED_STAKE_AMOUNT,
    authority,
    destination: ownerRypAccount,
    mint: mint.publicKey,
  });

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
  assertEqual("vault balance after stake", stakedVaultBalance, SEED_STAKE_AMOUNT);

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
  assertEqual("final owner balance", finalOwnerBalance, SEED_STAKE_AMOUNT);

  return {
    status: "passed",
    programId: programId.toBase58(),
    mint: mint.publicKey.toBase58(),
    config: config.toBase58(),
    position: position.toBase58(),
    rypVault: rypVault.toBase58(),
    checked: ["initialize_config", "stake_ryp", "unstake_ryp"],
  };
}

async function initializeConfig(connection, { authority, config, mint, rypVault }) {
  const data = Buffer.alloc(8 + 2 + 5 * 8 + 5 * 2);
  discriminator("initialize_config").copy(data, 0);
  data.writeUInt16LE(BASE_FEE_BPS, 8);
  let offset = 10;
  for (const threshold of TIER_THRESHOLDS) {
    data.writeBigUInt64LE(threshold, offset);
    offset += 8;
  }
  for (const reduction of TIER_FEE_REDUCTIONS) {
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
    goldenKeyActive: data.readUInt8(73) === 1,
    votingRightsActive: data.readUInt8(74) === 1,
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
