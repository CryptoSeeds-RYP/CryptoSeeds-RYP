# Web3 and DeFi DApp Architecture

CryptoSeeds should be treated as a full Web3/DeFi dApp. The MicroVerse is the user experience layer, but the app should be designed around wallet state, protocol state, transparent transactions, and self-custodial user control.

## Core Principle

The user owns the wallet. CryptoSeeds provides interfaces, protocol programs, routing, visual state, and data services. CryptoSeeds must not custody private keys, seed phrases, or unrestricted user funds.

Decentralization is a design target, not a slogan. Every module should reduce custody, hidden discretion, opaque admin control, and off-chain trust where practical, while staying honest that legal review is still required before public financial-adjacent launch.

## DApp Layers

| Layer | Purpose |
| --- | --- |
| Wallet Layer | Connect wallets, read accounts, request signatures |
| Protocol Layer | Staking, rewards, NFTs, governance, project pools, treasury logic |
| DeFi Integration Layer | Swaps, routing, token prices, market data, risk controls |
| Indexing/Data Layer | Read events, project state, documents, milestones, analytics |
| MicroVerse UI Layer | Farm dashboard, maps, project visuals, harvest flow, SeedBot UI |
| Admin/Operations Layer | Project management, disclosures, treasury visibility, emergency controls |

## On-Chain First, Off-Chain Where Sensible

On-chain or protocol-account state should eventually cover:

- RYP staking positions
- Tier eligibility
- Reward accrual and claims
- Golden Key NFT state
- Voting Rights NFT state
- Governance votes
- Project participation records
- Treasury and fee distribution state
- Automation permissions, if guarded automation is added later

Off-chain services may cover:

- Project documents
- Risk disclosures
- Rich metadata
- Visual assets
- Indexing and analytics
- Market data aggregation
- Notifications and alerts
- Paper trading simulations

Off-chain services should not be required to trustlessly control user funds.

## Transaction Design

Every wallet action should have a transaction intent before signature.

The UI should show:

- Action type
- Input token
- Output token, when relevant
- Amount
- Protocol or route
- Slippage, when relevant
- Fees
- Account/program involved
- Risk summary
- Expected result
- Final wallet approval status

For Solana staking actions, the app should simulate the prepared transaction before requesting a wallet signature. The returned signed message must match the simulated unsigned message exactly, and signed transaction bytes should not be stored or broadcast until a separate reviewed broadcast boundary exists.

Broadcast readiness should be explicit, not implied by a signature. A signed receipt can show that the wallet approved the simulated message, but broadcast remains blocked unless environment, cluster, program id, deployment status, and review gates all pass.

Examples:

- Stake RYP
- Unstake RYP
- Claim staking rewards
- Claim ecosystem reward
- Vote on proposal
- Participate in project
- Claim achievement NFT
- Prepare swap through SeedBot Terminal
- Revoke automation permission

## DeFi Modules

### Staking

Staking is the core access mechanism. It drives tiers, Golden Key NFT status, Voting Rights NFT eligibility, fee reductions, farm state, and project access.

### Rewards

Rewards should be claimable, transparent, and conservative. The UI should distinguish staking rewards, fee-share rewards, project updates, NFT achievements, airdrops, and donation impact updates.

Passive Holder Rewards are a separate holder bucket for self-custodial RYP holders who do not stake. The weekly engine should deduct delivery costs from each holder's gross allocation, roll small allocations forward, and use less frequent payout windows for small holders so the system is not subsidized by dev or treasury funds.

### Treasury and Fees

The RYP token-transfer fee target is 1% and should use the same holder, staker, and independent treasury bucket model as the platform/action fee policy.

The separate 3.5% platform/action fee should remain configurable and tier-reduced. Fee distribution and reductions must be transparent to users.

### Project Pools

Project pools should be handled carefully. They may represent participation in approved ecosystem projects, but financial-rights mechanics require legal review before implementation.

### Governance

Governance should use 1 wallet = 1 vote through a non-transferable Voting Rights NFT after 14 days of staking. Token-weighted voting should not be the default model.

### SeedBot Terminal

SeedBot Terminal is a self-custodial trading-tool module. MVP should support signal-only tools, watchlists, portfolio views, paper trading, and wallet-approved execution. Guarded automation must be revocable, capped, explicitly permissioned, and legal-review gated.

SeedBot must not provide discretionary account management. Strategy routes should be based on objective, pre-disclosed parameters that users can review before signing. Any live success-fee, profit-fee, or performance-fee model must stay disabled until reviewed.

## Regulatory Surface Reduction

| Risk Surface | Build Direction |
| --- | --- |
| Custody | User wallets only; no seed phrases, private keys, backend wallets, or unrestricted user funds |
| Execution | User-directed transaction intents, simulation, wallet signature, separate broadcast readiness |
| Routing | Objective, pre-disclosed route parameters and visible venue limitations |
| Automation | Disabled in MVP; later must be capped, revocable, and permission-scoped |
| Fees | Transparent protocol/tool fee previews; live profit-based fees require review |
| Projects | Risk-labeled participation and updates; financial-rights mechanics require review |
| Admin | Multisig/timelock path, public authority map, event logs, emergency pause policy |
| Marketing | No return promises and no claims that self-custody bypasses legal obligations |

## Implementation Direction

Initial app stack should likely be:

- React
- Vite
- TypeScript
- Solana wallet adapter
- Phantom/Solflare/Backpack support
- Modular service adapters for RPC, token data, swap routing, and indexing
- Anchor client integration when protocol programs exist

The first frontend can use mock protocol state, but types and components should be shaped like real dApp state so Solana integrations can replace fixtures later.

## Non-Negotiables

- No seed phrase input
- No private key storage
- No custodial user wallets
- No hidden transactions
- No unlimited approvals
- No guaranteed returns
- No regulatory-workaround claims
- No discretionary strategy execution
- No live profit-based fees before legal review
- No casino mechanics in MVP
- No leverage/perps in MVP
- No copy-trading marketplace in MVP
- Clear transaction previews
- Clear risk labels
- Clear revoke/disable patterns for future automation
