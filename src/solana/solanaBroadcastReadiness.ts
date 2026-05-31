import { appConfig, PLACEHOLDER_PROTOCOL_PROGRAM_ID, type AppConfig } from "../config/env";
import type {
  PreparedSolanaTransactionPlan,
  SolanaBroadcastReadinessPreview,
  SolanaWalletSignatureReceipt,
} from "../domain/transactions";

export type BroadcastReadinessInput = {
  config?: Pick<
    AppConfig,
    | "cluster"
    | "demoMode"
    | "protocolDeployment"
    | "protocolProgramId"
    | "solanaBroadcastEnabled"
  >;
  plan?: PreparedSolanaTransactionPlan;
  signature?: SolanaWalletSignatureReceipt;
};

export function buildSolanaBroadcastReadiness({
  config = appConfig,
  plan,
  signature,
}: BroadcastReadinessInput): SolanaBroadcastReadinessPreview {
  const blockers = broadcastBlockers({ config, plan, signature });
  const action = plan?.action;

  return {
    action,
    blockers,
    cluster: config.cluster,
    message:
      blockers.length > 0
        ? blockers[0]
        : "Broadcast prerequisites are satisfied for a reviewed devnet/localnet send boundary.",
    programId: config.protocolProgramId,
    signatureStatus: signature?.status,
    status: blockers.length > 0 ? "BLOCKED" : "READY_FOR_REVIEW",
    warnings: [
      "No broadcast function is implemented in this readiness model.",
      "Send/broadcast must remain a separate reviewed boundary.",
    ],
  };
}

function broadcastBlockers({
  config,
  plan,
  signature,
}: Required<Pick<BroadcastReadinessInput, "config">> &
  Pick<BroadcastReadinessInput, "plan" | "signature">) {
  const blockers: string[] = [];

  if (!plan) blockers.push("No prepared Solana transaction plan is available.");
  if (!signature) blockers.push("No wallet signature receipt is available.");
  if (signature && signature.status !== "SIGNED") blockers.push("Wallet signature receipt is not signed.");
  if (signature && !signature.signatureVerified) blockers.push("Wallet signature receipt is not verified.");
  if (plan && signature) {
    if (!signature.feePayer) {
      blockers.push("Wallet signature receipt is missing the fee payer.");
    } else if (plan.feePayer !== signature.feePayer) {
      blockers.push("Wallet signature fee payer does not match the prepared transaction plan.");
    }
    if (!signature.walletAddress) {
      blockers.push("Wallet signature receipt is missing the wallet address.");
    } else if (plan.feePayer !== signature.walletAddress) {
      blockers.push("Wallet signature wallet address does not match the prepared transaction fee payer.");
    }
    if (!signature.messageFingerprint) {
      blockers.push("Wallet signature receipt is missing the signed message fingerprint.");
    }
  }
  if (!config.solanaBroadcastEnabled) blockers.push("Solana broadcast is disabled by environment flag.");
  if (config.demoMode) blockers.push("Demo mode must be disabled before broadcast review.");
  if (config.protocolProgramId === PLACEHOLDER_PROTOCOL_PROGRAM_ID) {
    blockers.push("Protocol program id is still the development placeholder.");
  }
  if (config.protocolDeployment === "placeholder") {
    blockers.push("Protocol deployment status is still placeholder.");
  }
  if (config.protocolDeployment !== "placeholder" && config.protocolDeployment !== config.cluster) {
    blockers.push("Protocol deployment status does not match the selected Solana cluster.");
  }
  if (config.cluster === "mainnet-beta") {
    blockers.push("Mainnet broadcast is blocked until a final launch review explicitly replaces this gate.");
  }
  if (plan) {
    const mismatchedProgram = plan.instructions.find((instruction) => instruction.programId !== config.protocolProgramId);
    if (mismatchedProgram) {
      blockers.push("Prepared instruction program id does not match the configured protocol program id.");
    }
  }

  return blockers;
}
