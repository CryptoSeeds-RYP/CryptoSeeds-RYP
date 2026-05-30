export type EthereumProvider = {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request<T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<T>;
  on?(event: "accountsChanged" | "chainChanged" | "connect" | "disconnect", listener: (...args: unknown[]) => void): void;
  removeListener?(
    event: "accountsChanged" | "chainChanged" | "connect" | "disconnect",
    listener: (...args: unknown[]) => void,
  ): void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function getEthereumProvider() {
  if (typeof window === "undefined") return undefined;
  const { ethereum } = window;
  if (!ethereum) return undefined;
  if (Array.isArray(ethereum.providers)) {
    return ethereum.providers.find((provider) => provider.isMetaMask) ?? ethereum;
  }
  return ethereum;
}
