/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SOLANA_CLUSTER?: "localnet" | "devnet" | "mainnet-beta";
  readonly VITE_SOLANA_RPC_URL?: string;
  readonly VITE_RYP_MINT_ADDRESS?: string;
  readonly VITE_RYP_DECIMALS?: string;
  readonly VITE_CRYPTOSEEDS_PROGRAM_ID?: string;
  readonly VITE_HELIUS_API_KEY?: string;
  readonly VITE_DEMO_MODE?: string;
  readonly VITE_SEEDBOT_HYPERLIQUID_NETWORK?: "MAINNET" | "TESTNET";
  readonly VITE_SEEDBOT_SIGNED_EXECUTION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
