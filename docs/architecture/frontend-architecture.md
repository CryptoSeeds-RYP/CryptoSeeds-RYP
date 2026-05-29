# Frontend Architecture

The frontend is a Web3/DeFi dApp shell with a MicroVerse interface layer. The UI should never talk directly to fixture data or raw protocol clients. It should use service adapters so mock data can be replaced by Solana wallet/RPC integrations later.

## Current Layers

| Layer | Path | Purpose |
| --- | --- | --- |
| Config | `src/config` | Environment and network configuration |
| Domain | `src/domain` | Project, staking, rewards, tiering, and transaction intent types |
| Fixtures | `src/fixtures` | Demo protocol-like data for local development |
| Services | `src/services` | Adapter interfaces and mock implementations |
| State | `src/state` | React hooks that compose services into app state |
| Components | `src/components` | Reusable panels, wallet controls, metrics, and transaction surfaces |
| Views | `src/views` | MicroVerse locations such as Homestead, Explorer, Harvest, Governance, and SeedBot |
| UI shell | `src/App.tsx`, `src/styles.css` | Application layout, navigation, and visual system |

## Adapter Strategy

Current mock services:

- `wallet`
- `tokenBalances`
- `staking`
- `projects`
- `rewards`
- `seedBot`

Future real services:

- Solana wallet adapter for Phantom, Solflare, Backpack, and Wallet Standard support
- MetaMask/EIP-1193 connector for EVM identity and future cross-chain access
- RPC/token account reader for RYP balances
- Anchor client for `cryptoseeds_protocol`
- Project registry/indexer service
- Reward indexer service
- Jupiter or equivalent routing service for wallet-approved SeedBot swaps

## Rule

React components should render state and request intents. Services should know where state comes from. Protocol clients should stay behind service adapters.

## Dependency Rule

Keep wallet and Solana packages as lean as possible. The app now reads RYP balances with `@solana/web3.js` parsed token-account queries instead of `@solana/spl-token`, which avoids pulling in extra transitive package risk for a simple balance read.
