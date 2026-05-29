export type EthereumProvider = {
  isMetaMask?: boolean;
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
  return window.ethereum;
}

