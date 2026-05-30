# Wallet Strategy

CryptoSeeds should support two wallet routes at launch:

## Solana Wallet Route

Primary wallet route for RYP, staking, governance NFTs, project participation, reward claims, and SeedBot Solana execution.

Initial implementation:

- Solana Wallet Adapter
- Wallet Standard adapters
- Phantom-first UX
- Compatible with Wallet Standard wallets that expose Solana capabilities
- `@solana/wallet-standard-wallet-adapter-react` is a direct dependency, not a transitive assumption

This route controls real CryptoSeeds protocol actions.

## MetaMask / EVM Route

Secondary wallet route for EVM identity, future cross-chain access, and users who naturally start from MetaMask.

Initial implementation:

- EIP-1193 provider detection through `window.ethereum`
- `eth_accounts`
- `eth_requestAccounts`
- `eth_chainId`
- `accountsChanged`
- `chainChanged`

This route should not be used for Solana RYP staking unless MetaMask exposes compatible Solana support in the browser and we explicitly integrate that path.

MetaMask's current developer direction includes MetaMask Connect with EVM, Solana, and multichain packages. For now CryptoSeeds should keep the existing `window.ethereum` route as an EVM/SeedBot identity and routing surface. If we add MetaMask Solana support later, evaluate `@metamask/connect-solana` or `@metamask/connect-multichain` as a separate integration rather than blurring it with the Phantom/Solana Wallet Standard route.

## UX Rule

Do not blur the two wallet responsibilities.

- Solana wallet = RYP protocol actions
- MetaMask = EVM identity/future cross-chain path

If future bridging or multichain access is added, the transaction preview must clearly show which chain, wallet, token, program/contract, route, and risk profile is being used.

## Sources

- Phantom Wallet Standard documentation: https://docs.phantom.com/developer-powertools/wallet-standard
- Phantom Solana integration documentation: https://docs.phantom.com/solana/integrating-phantom
- Phantom Solana token display guidance: https://docs.phantom.com/best-practices/tokens/token-display
- MetaMask Connect documentation: https://docs.metamask.io/metamask-connect/
