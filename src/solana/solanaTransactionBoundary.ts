import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type SimulatedTransactionResponse,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import type {
  PreparedInstructionPlan,
  PreparedSolanaTransactionPlan,
  SolanaWalletBoundaryPreview,
} from "../domain/transactions";

type BoundaryInput = {
  plan?: PreparedSolanaTransactionPlan;
  walletPublicKey?: string;
  walletCanSign: boolean;
  recentBlockhash?: string;
  lastValidBlockHeight?: number;
};

type SimulationInput = {
  connection: Connection;
  plan?: PreparedSolanaTransactionPlan;
  walletPublicKey?: string;
  walletCanSign: boolean;
};

export async function simulatePreparedSolanaTransaction({
  connection,
  plan,
  walletCanSign,
  walletPublicKey,
}: SimulationInput): Promise<SolanaWalletBoundaryPreview> {
  const blockedReasons = validateBoundary({ plan, walletCanSign, walletPublicKey });
  if (blockedReasons.length > 0 || !plan) {
    return blockedBoundaryPreview({ plan, reasons: blockedReasons, walletPublicKey });
  }

  try {
    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    const preview = buildSolanaWalletBoundaryPreview({
      plan,
      walletCanSign,
      walletPublicKey,
      recentBlockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });
    if (preview.status === "BLOCKED" || !plan) return preview;

    const simulationTransaction = createSolanaVersionedTransactionFromPlan({
      plan,
      recentBlockhash: latestBlockhash.blockhash,
    });
    const simulation = await connection.simulateTransaction(simulationTransaction, {
      commitment: "confirmed",
      replaceRecentBlockhash: false,
      sigVerify: false,
    });
    const response = simulation.value;
    const simulationError = stringifySimulationError(response.err);

    return {
      ...preview,
      message: simulationError
        ? "Simulation completed with an on-chain error. Review logs before requesting a wallet signature."
        : "Simulation passed. The next safe step is an explicit wallet signature request.",
      simulationError,
      simulationLogs: response.logs ?? [],
      status: simulationError ? "SIMULATION_FAILED" : "SIMULATION_PASSED",
      unitsConsumed: response.unitsConsumed,
    };
  } catch (error) {
    return {
      ...boundaryMetricFields(plan, walletPublicKey),
      message: "Simulation request failed before wallet signing. No transaction was signed or broadcast.",
      simulationError: stringifyUnknownError(error),
      simulationLogs: [],
      status: "SIMULATION_FAILED",
      warnings: [
        ...plan.warnings,
        "RPC simulation can fail if the selected cluster, program config, or local validator is unavailable.",
      ],
    };
  }
}

export function buildSolanaWalletBoundaryPreview({
  lastValidBlockHeight,
  plan,
  recentBlockhash,
  walletCanSign,
  walletPublicKey,
}: BoundaryInput): SolanaWalletBoundaryPreview {
  const blockedReasons = validateBoundary({ plan, walletCanSign, walletPublicKey });
  if (!recentBlockhash && blockedReasons.length === 0) {
    blockedReasons.push("A recent Solana blockhash is required before the wallet can sign.");
  }

  const metrics = boundaryMetricFields(plan, walletPublicKey);

  if (blockedReasons.length > 0 || !plan || !recentBlockhash) {
    return blockedBoundaryPreview({ plan, reasons: blockedReasons, walletPublicKey });
  }

  const transaction = createSolanaTransactionFromPlan({
    lastValidBlockHeight,
    plan,
    recentBlockhash,
  });

  return {
    feePayer: plan.feePayer,
    instructionCount: metrics.instructionCount,
    lastValidBlockHeight,
    message: "Unsigned transaction built. Simulation should pass before requesting a wallet signature.",
    recentBlockhash,
    requiredSigners: metrics.requiredSigners,
    serializedMessageBase64: Buffer.from(transaction.serializeMessage()).toString("base64"),
    simulationLogs: [],
    status: "READY_FOR_SIGNATURE",
    walletAddress: metrics.walletAddress,
    warnings: [
      ...plan.warnings,
      "This boundary builds an unsigned transaction only; it does not sign or broadcast.",
      "Simulation is advisory and must not replace the wallet approval screen.",
    ],
    writableAccountCount: metrics.writableAccountCount,
  };
}

export function createSolanaTransactionFromPlan({
  lastValidBlockHeight,
  plan,
  recentBlockhash,
}: {
  plan: PreparedSolanaTransactionPlan;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
}) {
  const transaction = new Transaction({
    feePayer: new PublicKey(plan.feePayer),
    recentBlockhash,
  });
  if (typeof lastValidBlockHeight === "number") transaction.lastValidBlockHeight = lastValidBlockHeight;

  transaction.add(...plan.instructions.map(createInstruction));
  return transaction;
}

function createSolanaVersionedTransactionFromPlan({
  plan,
  recentBlockhash,
}: {
  plan: PreparedSolanaTransactionPlan;
  recentBlockhash: string;
}) {
  const message = new TransactionMessage({
    instructions: plan.instructions.map(createInstruction),
    payerKey: new PublicKey(plan.feePayer),
    recentBlockhash,
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

function createInstruction(instruction: PreparedInstructionPlan) {
  return new TransactionInstruction({
    data: Buffer.from(instruction.dataHex, "hex"),
    keys: instruction.accounts.map((account) => ({
      isSigner: account.signer,
      isWritable: account.writable,
      pubkey: publicKeyFromAddress(account.address, account.label),
    })),
    programId: new PublicKey(instruction.programId),
  });
}

function validateBoundary({ plan, walletCanSign, walletPublicKey }: BoundaryInput) {
  const reasons: string[] = [];
  if (!plan) reasons.push("No prepared Solana transaction plan is available.");
  if (!walletPublicKey) reasons.push("Connect a real Solana wallet before requesting a wallet boundary.");
  if (!walletCanSign) reasons.push("Connected wallet does not expose Solana transaction signing.");
  if (plan && walletPublicKey && plan.feePayer !== walletPublicKey) {
    reasons.push("Connected wallet does not match the prepared transaction fee payer.");
  }
  if (plan && walletPublicKey && !requiredSignerAddresses(plan).includes(walletPublicKey)) {
    reasons.push("Connected wallet is not listed as a required signer.");
  }

  return reasons;
}

function blockedBoundaryPreview({
  plan,
  reasons,
  walletPublicKey,
}: {
  plan?: PreparedSolanaTransactionPlan;
  reasons: string[];
  walletPublicKey?: string;
}): SolanaWalletBoundaryPreview {
  return {
    ...boundaryMetricFields(plan, walletPublicKey),
    message: reasons[0] ?? "Prepared Solana transaction is not ready for wallet approval.",
    simulationLogs: [],
    status: "BLOCKED",
    warnings: [
      ...reasons,
      "No wallet signature is requested while this boundary is blocked.",
    ],
  };
}

function boundaryMetricFields(plan: PreparedSolanaTransactionPlan | undefined, walletPublicKey: string | undefined) {
  return {
    feePayer: plan?.feePayer,
    instructionCount: plan?.instructions.length ?? 0,
    requiredSigners: plan ? requiredSignerAddresses(plan) : [],
    walletAddress: walletPublicKey,
    writableAccountCount: plan
      ? plan.instructions.reduce((total, instruction) => total + instruction.accounts.filter((account) => account.writable).length, 0)
      : 0,
  };
}

function requiredSignerAddresses(plan: PreparedSolanaTransactionPlan) {
  return Array.from(
    new Set(
      plan.instructions.flatMap((instruction) =>
        instruction.accounts
          .filter((account) => account.signer)
          .map((account) => account.address)
          .filter((address): address is string => Boolean(address)),
      ),
    ),
  );
}

function publicKeyFromAddress(address: string | undefined, label: string) {
  if (!address) throw new Error(`Missing Solana account address for ${label}`);
  return new PublicKey(address);
}

function stringifySimulationError(error: SimulatedTransactionResponse["err"]) {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  return JSON.stringify(error);
}

function stringifyUnknownError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown simulation error";
}
