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

export type TransactionChain = "SOLANA" | "EVM" | "MULTICHAIN";

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
  anchorName?: string;
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
  action:
    | "ACTIVATE_VOTING_RIGHTS"
    | "ACCEPT_PROJECT_AUTHORITY"
    | "CANCEL_PROJECT"
    | "CLAIM_REWARD"
    | "CLOSE_GOVERNANCE_PROPOSAL"
    | "CREATE_GOVERNANCE_PROPOSAL"
    | "CREATE_PROJECT_DISCLOSURE_REVISION"
    | "CREATE_REWARD_CLAIM_RECORD"
    | "CREATE_REWARD_CLAIM_RECORD_FROM_PROOF"
    | "CREATE_SEEDBOT_PERMISSION"
    | "EXPIRE_REWARD_EPOCH_CLAIMS"
    | "GRANT_PROJECT_OPERATOR"
    | "INITIALIZE_CONFIG"
    | "INITIALIZE_REWARD_CONFIG"
    | "OPERATOR_SET_PROJECT_PAUSE"
    | "OPERATOR_UPDATE_PROJECT_STATUS"
    | "PARTICIPATE_PROJECT"
    | "PARTICIPATE_PROJECT_DIRECT_SETTLEMENT"
    | "RECORD_PROJECT_PARTICIPANT_REFUND"
    | "RECORD_PROJECT_REFUND"
    | "RECORD_SEEDBOT_USAGE"
    | "REGISTER_PROJECT"
    | "REGISTER_REWARD_VAULT"
    | "REVOKE_PROJECT_OPERATOR"
    | "REVOKE_PERMISSION"
    | "ROUTE_PLATFORM_FEE"
    | "SET_PROJECT_PAUSE"
    | "STAKE_RYP"
    | "TRANSFER_RYP_WITH_PLATFORM_FEE"
    | "TRANSFER_PROJECT_AUTHORITY"
    | "UNSTAKE_RYP"
    | "UPDATE_FEE_CONFIG"
    | "UPDATE_PROJECT_STATUS"
    | "UPDATE_SEEDBOT_PERMISSION"
    | "VERIFY_REWARD_VAULT"
    | "VOTE_PROPOSAL";
  feePayer: string;
  amountBaseUnits?: string;
  amountUi?: string;
  instructions: PreparedInstructionPlan[];
  derivedAccounts: TransactionAccountReference[];
  warnings: string[];
};

export type SolanaWalletBoundaryStatus =
  | "BLOCKED"
  | "READY_FOR_SIGNATURE"
  | "SIMULATION_PASSED"
  | "SIMULATION_FAILED";

export type SolanaWalletBoundaryPreview = {
  status: SolanaWalletBoundaryStatus;
  message: string;
  feePayer?: string;
  walletAddress?: string;
  instructionCount: number;
  requiredSigners: string[];
  writableAccountCount: number;
  recentBlockhash?: string;
  lastValidBlockHeight?: number;
  serializedMessageBase64?: string;
  simulationError?: string;
  simulationLogs: string[];
  unitsConsumed?: number;
  warnings: string[];
};

export type SolanaWalletSignatureStatus = "BLOCKED" | "SIGNED" | "FAILED";

export type SolanaWalletSignatureReceipt = {
  status: SolanaWalletSignatureStatus;
  message: string;
  walletAddress?: string;
  feePayer?: string;
  signatureBase64?: string;
  messageFingerprint?: string;
  signatureVerified: boolean;
  signedAt?: string;
  warnings: string[];
};

export type SolanaBroadcastReadinessStatus = "BLOCKED" | "READY_FOR_REVIEW";

export type SolanaBroadcastReadinessPreview = {
  status: SolanaBroadcastReadinessStatus;
  message: string;
  action?: PreparedSolanaTransactionPlan["action"];
  blockers: string[];
  cluster: string;
  programId: string;
  signatureStatus?: SolanaWalletSignatureStatus;
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
  solanaBoundary?: SolanaWalletBoundaryPreview;
  solanaSignature?: SolanaWalletSignatureReceipt;
  solanaBroadcastReadiness?: SolanaBroadcastReadinessPreview;
  lifecycle: TransactionLifecycleStep[];
  riskSummary: string;
  expectedResult: string;
  status: TransactionIntentStatus;
};
