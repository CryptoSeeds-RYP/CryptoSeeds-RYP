import { Activity, Wallet } from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { evmChainLabel, shortEvmAddress, useMetaMaskWallet } from "../evm/useMetaMaskWallet";

export function WalletDock({
  metaMask,
  demoMode,
  onDemoModeChange,
}: {
  metaMask: ReturnType<typeof useMetaMaskWallet>;
  demoMode: boolean;
  onDemoModeChange: (enabled: boolean) => void;
}) {
  return (
    <div className="wallet-dock" aria-label="Wallet connections">
      <WalletMultiButton className="wallet-button solana-wallet-button" />
      <button
        className={`wallet-button metamask-button ${metaMask.connected ? "connected" : ""} ${metaMask.error ? "error" : ""}`}
        onClick={metaMask.connect}
        title={metaMask.error ?? (metaMask.available ? "Connect MetaMask EVM route" : "MetaMask not detected")}
        disabled={!metaMask.available}
      >
        <Wallet size={18} />
        <span>{metaMask.connected ? shortEvmAddress(metaMask.address) : "MetaMask"}</span>
        <em>{evmChainLabel(metaMask.chainId)}</em>
      </button>
      <button
        className={`wallet-button demo-button ${demoMode ? "connected" : ""}`}
        onClick={() => onDemoModeChange(!demoMode)}
        title="Toggle demo protocol state"
      >
        <Activity size={18} />
        {demoMode ? "Demo On" : "Demo Off"}
      </button>
    </div>
  );
}
