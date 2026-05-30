export const DEMO_WALLET_ADDRESS = "3bmqc6gEdUNmRrANE6w6CuW2ht5Vscy8SGXaLyTLQsy3";

export function isDemoWalletAddress(walletAddress?: string) {
  return walletAddress === DEMO_WALLET_ADDRESS;
}
