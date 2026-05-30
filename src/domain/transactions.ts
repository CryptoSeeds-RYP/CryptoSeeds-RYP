export type TransactionIntentType =
  | "STAKE_RYP"
  | "UNSTAKE_RYP"
  | "CLAIM_REWARD"
  | "PARTICIPATE_PROJECT"
  | "VOTE_PROPOSAL"
  | "CLAIM_NFT"
  | "SEEDBOT_SWAP"
  | "SEEDBOT_ALLOCATE"
  | "REVOKE_PERMISSION";

export type TransactionIntentStatus =
  | "DRAFT"
  | "READY"
  | "AWAITING_SIGNATURE"
  | "SIGNED"
  | "BROADCAST"
  | "CONFIRMED"
  | "FAILED";

export type TransactionChain = "SOLANA" | "EVM";

export type TransactionExecutionMode =
  | "PREVIEW_ONLY"
  | "WALLET_APPROVED"
  | "GUARDED_AUTOMATION";

export type TransactionLifecycleStep = {
  id: "review" | "wallet_signature" | "broadcast" | "confirmation";
  label: string;
  status: "COMPLETE" | "CURRENT" | "WAITING" | "BLOCKED" | "FAILED";
};

export type TransactionProgramReference = {
  label: string;
  address: string;
  role: string;
};

export type TransactionAccountReference = {
  label: string;
  address?: string;
  role: string;
  signer: boolean;
  writable: boolean;
};

export type PreparedInstructionAccount = TransactionAccountReference & {
  order: number;
};

export type PreparedInstructionPlan = {
  programId: string;
  instructionName: string;
  discriminatorHex: string;
  dataHex: string;
  accounts: PreparedInstructionAccount[];
};

export type PreparedSolanaTransactionPlan = {
  action: "STAKE_RYP" | "UNSTAKE_RYP" | "ACTIVATE_VOTING_RIGHTS";
  feePayer: string;
  amountBaseUnits?: string;
  amountUi?: string;
  instructions: PreparedInstructionPlan[];
  derivedAccounts: TransactionAccountReference[];
  warnings: string[];
};

export type RiskAcknowledgement = {
  id: string;
  label: string;
  accepted: boolean;
  acceptedAt?: string;
  disclosureRef: string;
};

export type TransactionIntent = {
  id: string;
  type: TransactionIntentType;
  title: string;
  chain: TransactionChain;
  network: string;
  executionMode: TransactionExecutionMode;
  signaturePolicy: string;
  walletAddress?: string;
  inputToken?: string;
  outputToken?: string;
  amount?: string;
  estimatedFees?: string;
  slippage?: string;
  programs: TransactionProgramReference[];
  accounts: TransactionAccountReference[];
  acknowledgement?: RiskAcknowledgement;
  preparedSolanaTransaction?: PreparedSolanaTransactionPlan;
  lifecycle: TransactionLifecycleStep[];
  riskSummary: string;
  expectedResult: string;
  status: TransactionIntentStatus;
};
