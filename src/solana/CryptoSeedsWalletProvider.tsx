import { useMemo, type PropsWithChildren } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useStandardWalletAdapters } from "@solana/wallet-standard-wallet-adapter-react";
import { appConfig } from "../config/env";

function endpointForCluster() {
  if (appConfig.rpcUrl) return appConfig.rpcUrl;
  if (appConfig.cluster === "mainnet-beta") return clusterApiUrl("mainnet-beta");
  if (appConfig.cluster === "devnet") return clusterApiUrl("devnet");
  return "http://127.0.0.1:8899";
}

export function CryptoSeedsWalletProvider({ children }: PropsWithChildren) {
  const endpoint = useMemo(endpointForCluster, []);
  const walletAdapters = useStandardWalletAdapters([]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={walletAdapters} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

