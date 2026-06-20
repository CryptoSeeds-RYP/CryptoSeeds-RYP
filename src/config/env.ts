export type AppConfig = {
  cluster: "localnet" | "devnet" | "mainnet-beta";
  rpcUrl: string;
  rypMintAddress: string;
  rypDecimals: number;
  protocolProgramId: string;
  protocolDeployment: "placeholder" | "localnet" | "devnet" | "mainnet-beta";
  heliusApiKey?: string;
  demoMode: boolean;
  solanaBroadcastEnabled: boolean;
  seedBotHyperliquidNetwork: "MAINNET" | "TESTNET";
  seedBotSignedExecutionEnabled: boolean;
  adminAuthorityAddress?: string;
  independentTreasuryAddress?: string;
  rewardInspectionEpochId: bigint;
  governanceInspectionProposalId: bigint;
  projectInspectionId: bigint;
};

export const PLACEHOLDER_PROTOCOL_PROGRAM_ID = "FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL";

const cluster = readCluster(import.meta.env.VITE_SOLANA_CLUSTER);
const protocolProgramId =
  import.meta.env.VITE_CRYPTOSEEDS_PROGRAM_ID ??
  PLACEHOLDER_PROTOCOL_PROGRAM_ID;

export const appConfig: AppConfig = {
  cluster,
  rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
  rypMintAddress:
    import.meta.env.VITE_RYP_MINT_ADDRESS ?? "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD",
  rypDecimals: Number(import.meta.env.VITE_RYP_DECIMALS ?? 6),
  protocolProgramId,
  protocolDeployment: readProtocolDeployment(
    import.meta.env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT,
    protocolProgramId,
    cluster,
  ),
  heliusApiKey: import.meta.env.VITE_HELIUS_API_KEY,
  demoMode: import.meta.env.VITE_DEMO_MODE !== "false",
  solanaBroadcastEnabled: import.meta.env.VITE_SOLANA_BROADCAST_ENABLED === "true",
  seedBotHyperliquidNetwork: readHyperliquidNetwork(import.meta.env.VITE_SEEDBOT_HYPERLIQUID_NETWORK),
  seedBotSignedExecutionEnabled: import.meta.env.VITE_SEEDBOT_SIGNED_EXECUTION === "true",
  adminAuthorityAddress: readOptionalString(import.meta.env.VITE_ADMIN_AUTHORITY_ADDRESS),
  independentTreasuryAddress: readOptionalString(import.meta.env.VITE_INDEPENDENT_TREASURY_ADDRESS),
  rewardInspectionEpochId: readRewardInspectionEpochId(import.meta.env.VITE_REWARD_INSPECTION_EPOCH_ID),
  governanceInspectionProposalId: readInspectionId(import.meta.env.VITE_GOVERNANCE_INSPECTION_PROPOSAL_ID),
  projectInspectionId: readInspectionId(import.meta.env.VITE_PROJECT_INSPECTION_ID),
};

export function readCluster(value: string | undefined): AppConfig["cluster"] {
  if (value === "devnet" || value === "mainnet-beta" || value === "localnet") return value;
  return "localnet";
}

export function readProtocolDeployment(
  value: string | undefined,
  programId: string,
  cluster: AppConfig["cluster"],
): AppConfig["protocolDeployment"] {
  if (value === "localnet" && cluster === "localnet") return "localnet";
  if (programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID) return "placeholder";
  if (value === "devnet" || value === "mainnet-beta" || value === "localnet") return value;
  return "placeholder";
}

export function readHyperliquidNetwork(value: string | undefined): AppConfig["seedBotHyperliquidNetwork"] {
  if (value === "MAINNET" || value === "TESTNET") return value;
  return "TESTNET";
}

export function readOptionalString(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function readRewardInspectionEpochId(value: string | undefined) {
  return readInspectionId(value);
}

export function readInspectionId(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return 0n;

  try {
    return BigInt(trimmed);
  } catch {
    return 0n;
  }
}
