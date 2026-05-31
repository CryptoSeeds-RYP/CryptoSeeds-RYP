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
};

export const PLACEHOLDER_PROTOCOL_PROGRAM_ID = "FG6PaFpoGXkYsidMpWxTWqVfbGqmtn8z8DK9HdJrMPfL";

const protocolProgramId =
  import.meta.env.VITE_CRYPTOSEEDS_PROGRAM_ID ??
  PLACEHOLDER_PROTOCOL_PROGRAM_ID;

export const appConfig: AppConfig = {
  cluster: readCluster(import.meta.env.VITE_SOLANA_CLUSTER),
  rpcUrl: import.meta.env.VITE_SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
  rypMintAddress:
    import.meta.env.VITE_RYP_MINT_ADDRESS ?? "CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD",
  rypDecimals: Number(import.meta.env.VITE_RYP_DECIMALS ?? 6),
  protocolProgramId,
  protocolDeployment: readProtocolDeployment(
    import.meta.env.VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT,
    protocolProgramId,
  ),
  heliusApiKey: import.meta.env.VITE_HELIUS_API_KEY,
  demoMode: import.meta.env.VITE_DEMO_MODE !== "false",
  solanaBroadcastEnabled: import.meta.env.VITE_SOLANA_BROADCAST_ENABLED === "true",
  seedBotHyperliquidNetwork: readHyperliquidNetwork(import.meta.env.VITE_SEEDBOT_HYPERLIQUID_NETWORK),
  seedBotSignedExecutionEnabled: import.meta.env.VITE_SEEDBOT_SIGNED_EXECUTION === "true",
};

function readCluster(value: string | undefined): AppConfig["cluster"] {
  if (value === "devnet" || value === "mainnet-beta" || value === "localnet") return value;
  return "localnet";
}

function readProtocolDeployment(
  value: string | undefined,
  programId: string,
): AppConfig["protocolDeployment"] {
  if (programId === PLACEHOLDER_PROTOCOL_PROGRAM_ID) return "placeholder";
  if (value === "devnet" || value === "mainnet-beta" || value === "localnet") return value;
  return "placeholder";
}

function readHyperliquidNetwork(value: string | undefined): AppConfig["seedBotHyperliquidNetwork"] {
  if (value === "MAINNET" || value === "TESTNET") return value;
  return "TESTNET";
}
