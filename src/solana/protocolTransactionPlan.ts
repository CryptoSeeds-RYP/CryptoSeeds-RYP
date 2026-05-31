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
import protocolInstructionSpecsJson from "./protocolInstructionSpecs.json";

export const CONFIG_SEED = "config";
export const STAKE_POSITION_SEED = "stake-position";
export const SPL_TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

type ProtocolAccountName =
  | "associated_token_program"
  | "config"
  | "owner"
  | "owner_ryp_account"
  | "position"
  | "ryp_mint"
  | "ryp_vault"
  | "system_program"
  | "token_program";

type ProtocolInstructionAccountSpec = {
  name: ProtocolAccountName;
  label: string;
  role: string;
  signer: boolean;
  writable: boolean;
};

type ProtocolInstructionSpec = {
  discriminatorHex: string;
  args: string[];
  accounts: ProtocolInstructionAccountSpec[];
};

export const PROTOCOL_INSTRUCTION_SPECS = protocolInstructionSpecsJson as Record<
  "activate_voting_rights" | "stake_ryp" | "unstake_ryp",
  ProtocolInstructionSpec
>;
const U64_MAX = 2n ** 64n - 1n;

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
  const spec = PROTOCOL_INSTRUCTION_SPECS.stake_ryp;
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    amountBaseUnits,
    discriminatorHex: spec.discriminatorHex,
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
  const spec = PROTOCOL_INSTRUCTION_SPECS.unstake_ryp;
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    amountBaseUnits,
    discriminatorHex: spec.discriminatorHex,
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
  const spec = PROTOCOL_INSTRUCTION_SPECS.activate_voting_rights;
  const instruction = instructionPlan({
    accounts: accountsFromSpec(spec, addresses),
    discriminatorHex: spec.discriminatorHex,
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
  const baseUnits = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(paddedFraction || "0");
  assertU64(baseUnits);
  return baseUnits.toString();
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

function accountsFromSpec(
  spec: ProtocolInstructionSpec,
  addresses: ReturnType<typeof deriveProtocolAddresses>,
): PreparedInstructionAccount[] {
  return orderedAccounts(
    spec.accounts.map((accountSpec) =>
      account(
        accountSpec.name,
        accountSpec.label,
        addressForProtocolAccount(addresses, accountSpec.name),
        accountSpec.role,
        accountSpec.signer,
        accountSpec.writable,
      ),
    ),
  );
}

function derivedAccountReferences(addresses: ReturnType<typeof deriveProtocolAddresses>): TransactionAccountReference[] {
  return [
    account("config", "Protocol config", addresses.config, "Derived from seed: config", false, true),
    account("position", "Stake position", addresses.position, "Derived from stake-position + wallet", false, true),
    account("owner_ryp_account", "Owner RYP account", addresses.ownerRypAccount, "Associated token account for RYP", false, true),
    account("ryp_vault", "RYP vault", addresses.rypVault, "Associated token account owned by config PDA", false, true),
  ];
}

function addressForProtocolAccount(addresses: ReturnType<typeof deriveProtocolAddresses>, name: ProtocolAccountName) {
  switch (name) {
    case "associated_token_program":
      return addresses.associatedTokenProgramId;
    case "config":
      return addresses.config;
    case "owner":
      return addresses.owner;
    case "owner_ryp_account":
      return addresses.ownerRypAccount;
    case "position":
      return addresses.position;
    case "ryp_mint":
      return addresses.rypMint;
    case "ryp_vault":
      return addresses.rypVault;
    case "system_program":
      return addresses.systemProgramId;
    case "token_program":
      return addresses.tokenProgramId;
  }
}

function orderedAccounts(accounts: TransactionAccountReference[]): PreparedInstructionAccount[] {
  return accounts.map((accountReference, index) => ({ ...accountReference, order: index }));
}

function account(
  anchorName: string,
  label: string,
  address: string,
  role: string,
  signer: boolean,
  writable: boolean,
): TransactionAccountReference {
  return {
    anchorName,
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
  assertU64(value);
  const bytes = new Uint8Array(8);
  let cursor = value;
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number(cursor & 0xffn);
    cursor >>= 8n;
  }
  return bytesToHex(bytes);
}

function assertU64(value: bigint) {
  if (value < 0 || value > U64_MAX) {
    throw new Error("RYP amount exceeds Solana u64 token amount bounds");
  }
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
