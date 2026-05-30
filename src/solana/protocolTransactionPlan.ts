import { PublicKey, SystemProgram } from "@solana/web3.js";
import { appConfig } from "../config/env";
import type {
  PreparedInstructionAccount,
  PreparedInstructionPlan,
  PreparedSolanaTransactionPlan,
  TransactionAccountReference,
} from "../domain/transactions";
import type { StakingTier } from "../domain/microverse";
import { tierRequirements } from "../domain/tiering";

export const CONFIG_SEED = "config";
export const STAKE_POSITION_SEED = "stake-position";
export const SPL_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const INSTRUCTION_DISCRIMINATORS = {
  stakeRyp: "b746a41746842ce8",
  unstakeRyp: "ae0b5ccc93d66cdd",
  activateVotingRights: "463cc3194dbcfb73",
} as const;

export type StakePlanInput = {
  ownerAddress: string;
  tier: Exclude<StakingTier, "NONE">;
  amountUi?: number | string;
};

export type UnstakePlanInput = {
  ownerAddress: string;
  amountUi: number | string;
};

export type VotingRightsPlanInput = {
  ownerAddress: string;
};

export function buildStakeRypTransactionPlan({
  amountUi,
  ownerAddress,
  tier,
}: StakePlanInput): PreparedSolanaTransactionPlan {
  const amount = amountUi ?? tierRequirements[tier];
  const amountBaseUnits = parseRypAmountToBaseUnits(amount, appConfig.rypDecimals);
  const addresses = deriveProtocolAddresses(ownerAddress);
  const instruction = instructionPlan({
    accounts: stakeAccounts(addresses),
    amountBaseUnits,
    discriminatorHex: INSTRUCTION_DISCRIMINATORS.stakeRyp,
    instructionName: "stake_ryp",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "STAKE_RYP",
    addresses,
    amountBaseUnits,
    amountUi: amount.toString(),
    instruction,
    warnings: [
      "Requires initialized protocol config and RYP vault on the selected Solana cluster.",
      "No transaction is signed or broadcast until the connected Solana wallet approves it.",
    ],
  });
}

export function buildUnstakeRypTransactionPlan({
  amountUi,
  ownerAddress,
}: UnstakePlanInput): PreparedSolanaTransactionPlan {
  const amountBaseUnits = parseRypAmountToBaseUnits(amountUi, appConfig.rypDecimals);
  const addresses = deriveProtocolAddresses(ownerAddress);
  const instruction = instructionPlan({
    accounts: unstakeAccounts(addresses),
    amountBaseUnits,
    discriminatorHex: INSTRUCTION_DISCRIMINATORS.unstakeRyp,
    instructionName: "unstake_ryp",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "UNSTAKE_RYP",
    addresses,
    amountBaseUnits,
    amountUi: amountUi.toString(),
    instruction,
    warnings: [
      "Unstaking may reduce tier access, Golden Key state, project slots, and fee reduction.",
      "No transaction is signed or broadcast until the connected Solana wallet approves it.",
    ],
  });
}

export function buildActivateVotingRightsTransactionPlan({
  ownerAddress,
}: VotingRightsPlanInput): PreparedSolanaTransactionPlan {
  const addresses = deriveProtocolAddresses(ownerAddress);
  const instruction = instructionPlan({
    accounts: votingRightsAccounts(addresses),
    discriminatorHex: INSTRUCTION_DISCRIMINATORS.activateVotingRights,
    instructionName: "activate_voting_rights",
    programId: addresses.programId,
  });

  return transactionPlan({
    action: "ACTIVATE_VOTING_RIGHTS",
    addresses,
    instruction,
    warnings: [
      "Voting rights only activate after the 14-day staking delay enforced by the Solana program.",
      "One-wallet voting remains a governance policy layer and still needs anti-sybil review before launch.",
    ],
  });
}

export function deriveProtocolAddresses(ownerAddress: string) {
  const programId = new PublicKey(appConfig.protocolProgramId);
  const owner = new PublicKey(ownerAddress);
  const rypMint = new PublicKey(appConfig.rypMintAddress);
  const [config] = PublicKey.findProgramAddressSync([textSeed(CONFIG_SEED)], programId);
  const [position] = PublicKey.findProgramAddressSync([textSeed(STAKE_POSITION_SEED), owner.toBuffer()], programId);
  const ownerRypAccount = deriveAssociatedTokenAddress({ mint: rypMint, owner });
  const rypVault = deriveAssociatedTokenAddress({ mint: rypMint, owner: config });

  return {
    associatedTokenProgramId: ASSOCIATED_TOKEN_PROGRAM_ID.toBase58(),
    config: config.toBase58(),
    owner: owner.toBase58(),
    ownerRypAccount: ownerRypAccount.toBase58(),
    position: position.toBase58(),
    programId: programId.toBase58(),
    rypMint: rypMint.toBase58(),
    rypVault: rypVault.toBase58(),
    systemProgramId: SystemProgram.programId.toBase58(),
    tokenProgramId: SPL_TOKEN_PROGRAM_ID.toBase58(),
  };
}

export function parseRypAmountToBaseUnits(amountUi: number | string, decimals: number) {
  const normalized = amountUi.toString().replace(/,/g, "").trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Invalid RYP amount: ${amountUi}`);
  }

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    throw new Error(`RYP amount has more than ${decimals} decimal places`);
  }

  const paddedFraction = fraction.padEnd(decimals, "0");
  return (BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0")).toString();
}

function deriveAssociatedTokenAddress({ mint, owner }: { mint: PublicKey; owner: PublicKey }) {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  return address;
}

function transactionPlan({
  action,
  addresses,
  amountBaseUnits,
  amountUi,
  instruction,
  warnings,
}: {
  action: PreparedSolanaTransactionPlan["action"];
  addresses: ReturnType<typeof deriveProtocolAddresses>;
  amountBaseUnits?: string;
  amountUi?: string;
  instruction: PreparedInstructionPlan;
  warnings: string[];
}): PreparedSolanaTransactionPlan {
  return {
    action,
    amountBaseUnits,
    amountUi,
    derivedAccounts: derivedAccountReferences(addresses),
    feePayer: addresses.owner,
    instructions: [instruction],
    warnings,
  };
}

function instructionPlan({
  accounts,
  amountBaseUnits,
  discriminatorHex,
  instructionName,
  programId,
}: {
  accounts: PreparedInstructionAccount[];
  amountBaseUnits?: string;
  discriminatorHex: string;
  instructionName: string;
  programId: string;
}): PreparedInstructionPlan {
  return {
    accounts,
    dataHex: `${discriminatorHex}${amountBaseUnits ? u64LeHex(BigInt(amountBaseUnits)) : ""}`,
    discriminatorHex,
    instructionName,
    programId,
  };
}

function stakeAccounts(addresses: ReturnType<typeof deriveProtocolAddresses>): PreparedInstructionAccount[] {
  return orderedAccounts([
    account("Owner", addresses.owner, "Signer and fee payer", true, true),
    account("Protocol config", addresses.config, "Config PDA", false, true),
    account("RYP mint", addresses.rypMint, "Token mint reference", false, false),
    account("Owner RYP account", addresses.ownerRypAccount, "Source token account", false, true),
    account("RYP vault", addresses.rypVault, "Protocol staking vault", false, true),
    account("Stake position", addresses.position, "Per-wallet stake state PDA", false, true),
    account("Token program", addresses.tokenProgramId, "SPL token CPI", false, false),
    account("Associated token program", addresses.associatedTokenProgramId, "ATA validation", false, false),
    account("System program", addresses.systemProgramId, "Account initialization", false, false),
  ]);
}

function unstakeAccounts(addresses: ReturnType<typeof deriveProtocolAddresses>): PreparedInstructionAccount[] {
  return orderedAccounts([
    account("Owner", addresses.owner, "Signer and fee payer", true, true),
    account("Protocol config", addresses.config, "Config PDA", false, true),
    account("RYP mint", addresses.rypMint, "Token mint reference", false, false),
    account("Owner RYP account", addresses.ownerRypAccount, "Destination token account", false, true),
    account("RYP vault", addresses.rypVault, "Protocol staking vault", false, true),
    account("Stake position", addresses.position, "Per-wallet stake state PDA", false, true),
    account("Token program", addresses.tokenProgramId, "SPL token CPI", false, false),
  ]);
}

function votingRightsAccounts(addresses: ReturnType<typeof deriveProtocolAddresses>): PreparedInstructionAccount[] {
  return orderedAccounts([
    account("Owner", addresses.owner, "Signer", true, false),
    account("Protocol config", addresses.config, "Config PDA", false, false),
    account("Stake position", addresses.position, "Per-wallet stake state PDA", false, true),
  ]);
}

function derivedAccountReferences(addresses: ReturnType<typeof deriveProtocolAddresses>): TransactionAccountReference[] {
  return [
    account("Protocol config", addresses.config, "Derived from seed: config", false, true),
    account("Stake position", addresses.position, "Derived from stake-position + wallet", false, true),
    account("Owner RYP account", addresses.ownerRypAccount, "Associated token account for RYP", false, true),
    account("RYP vault", addresses.rypVault, "Associated token account owned by config PDA", false, true),
  ];
}

function orderedAccounts(accounts: TransactionAccountReference[]): PreparedInstructionAccount[] {
  return accounts.map((accountReference, index) => ({ ...accountReference, order: index }));
}

function account(
  label: string,
  address: string,
  role: string,
  signer: boolean,
  writable: boolean,
): TransactionAccountReference {
  return {
    address,
    label,
    role,
    signer,
    writable,
  };
}

function textSeed(seed: string) {
  return new TextEncoder().encode(seed);
}

function u64LeHex(value: bigint) {
  const bytes = new Uint8Array(8);
  let cursor = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(cursor & 0xffn);
    cursor >>= 8n;
  }
  return bytesToHex(bytes);
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
