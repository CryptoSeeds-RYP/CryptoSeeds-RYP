import { useCallback, useEffect, useMemo, useState } from "react";
import { getEthereumProvider } from "./ethereumProvider";

export type MetaMaskWalletState = {
  available: boolean;
  connected: boolean;
  address?: string;
  chainId?: string;
  error?: string;
};

export function useMetaMaskWallet() {
  const provider = useMemo(getEthereumProvider, []);
  const [state, setState] = useState<MetaMaskWalletState>({
    available: Boolean(provider),
    connected: false,
  });

  const refresh = useCallback(async () => {
    if (!provider) {
      setState({ available: false, connected: false });
      return;
    }

    const [accounts, chainId] = await Promise.all([
      provider.request<string[]>({ method: "eth_accounts" }).catch(() => []),
      provider.request<string>({ method: "eth_chainId" }).catch(() => undefined),
    ]);

    setState({
      available: true,
      connected: accounts.length > 0,
      address: accounts[0],
      chainId,
    });
  }, [provider]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!provider?.on) return undefined;

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccounts = Array.isArray(accounts) ? accounts.filter((item): item is string => typeof item === "string") : [];
      setState((current) => ({
        ...current,
        connected: nextAccounts.length > 0,
        address: nextAccounts[0],
        error: undefined,
      }));
    };

    const handleChainChanged = (chainId: unknown) => {
      setState((current) => ({
        ...current,
        chainId: typeof chainId === "string" ? chainId : current.chainId,
      }));
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) {
      setState({ available: false, connected: false, error: "MetaMask not detected" });
      return;
    }

    try {
      const accounts = await provider.request<string[]>({ method: "eth_requestAccounts" });
      const chainId = await provider.request<string>({ method: "eth_chainId" }).catch(() => undefined);
      setState({
        available: true,
        connected: accounts.length > 0,
        address: accounts[0],
        chainId,
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "MetaMask connection rejected",
      }));
    }
  }, [provider]);

  return { ...state, connect };
}

export function shortEvmAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function evmChainLabel(chainId?: string) {
  if (!chainId) return "EVM";
  if (chainId === "0x1") return "Ethereum";
  if (chainId === "0x89") return "Polygon";
  if (chainId === "0xa") return "Optimism";
  if (chainId === "0xa4b1") return "Arbitrum";
  if (chainId === "0x2105") return "Base";
  return `EVM ${Number.parseInt(chainId, 16) || chainId}`;
}
