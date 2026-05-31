# Solana Protocol Architecture

CryptoSeeds should use Rust programs on Solana for core protocol logic. Anchor is the preferred framework because it is the leading Solana program framework, produces IDLs for TypeScript clients, and gives the project safer account validation patterns.

## Tooling Target

- Rust and Cargo
- Anchor 1.x
- Anchor SPL
- Solana/Agave local validator tooling
- TypeScript generated clients from Anchor IDL
- Vite/React dApp client

The current local machine has two verification paths:

- Windows host-side Rust checks through `npm run protocol:check:win` and `npm run protocol:test:win`.
- WSL Solana/Anchor checks through `npm run protocol:build:wsl` and `npm run protocol:test:wsl`.
- WSL local validator smoke checks through `npm run protocol:smoke:localnet:wsl`.

The WSL route is the primary local path for Anchor builds. The localnet smoke check preloads the compiled SBF program with `solana-test-validator --bpf-program`, creates a test RYP-like mint, checks invalid config and unauthorized action rejections, initializes config, stakes, verifies voting-delay/top-up/partial-unstake behavior, verifies pause enforcement, and unstakes. Full public deployment verification still needs a synced devnet/mainnet program id and key-management review.

## First Program

The first program is `cryptoseeds_protocol`.

Current scope:

- Initialize protocol config
- Store RYP mint and staking vault
- Configure tier thresholds in raw token base units
- Configure base network fee and tier fee reductions
- Stake RYP into a protocol vault
- Enforce the canonical config-owned RYP vault on stake and unstake paths
- Track per-wallet stake position
- Calculate staking tier
- Activate Golden Key state
- Unlock Voting Rights state after 14 days
- Unstake RYP
- Emergency pause
- Emit protocol events

Current localnet security coverage includes rejected duplicate tier thresholds, rejected below-Seed staking, rejected early voting-right activation, rejected mismatched-owner unstaking, rejected oversized unstaking, Seed-to-Sprout top-up state preservation, Sprout-to-Seed partial unstake state preservation, rejected non-authority pause attempts, and pause enforcement for stake, unstake, and voting activation paths.

Client preparation now has a TypeScript planning layer at `src/solana/protocolTransactionPlan.ts`:

- Derives the protocol config PDA from `config`
- Derives the per-wallet stake position PDA from `stake-position + wallet`
- Derives the owner RYP associated token account
- Derives the protocol RYP vault associated token account owned by the config PDA
- Builds Anchor instruction data for `stake_ryp`, `unstake_ryp`, and `activate_voting_rights`
- Exposes account order, signer/writable flags, instruction discriminator, and raw data hex for wallet-preview surfaces
- Rejects prepared token amounts outside Solana's u64 SPL token amount bounds before instruction data is encoded
- Installs a browser `Buffer` shim at app startup so Solana wallet and transaction libraries can run in Vite without relying on Node globals

This is still a preparation layer. It does not sign, broadcast, or bypass wallet approval.

The next client boundary is `src/solana/solanaTransactionBoundary.ts`:

- Converts prepared instruction plans into unsigned Solana `Transaction` objects
- Builds a serialized-message preview for wallet review surfaces
- Blocks demo/disconnected wallets and fee-payer mismatches before any signature request
- Runs RPC simulation with `sigVerify: false` and no wallet signature
- Requests a wallet signature only after simulation passes, then stores a receipt rather than signed transaction bytes
- Keeps broadcast disabled until a later explicit signing and send boundary is reviewed

## Deferred Modules

These should be added after the staking core is reviewed:

- Actual Golden Key NFT mint/burn/return logic
- Voting Rights NFT minting and dynamic metadata
- Reward accrual and expiration
- Project pool participation
- Governance proposals and voting records
- Treasury distribution
- Airdrop eligibility
- SeedBot guarded automation permissions

## Program Boundaries

Keep the protocol modular. If the code grows too large, split into programs:

- `cryptoseeds_staking`
- `cryptoseeds_rewards`
- `cryptoseeds_governance`
- `cryptoseeds_projects`
- `cryptoseeds_seedbot_permissions`

For the first build, a single `cryptoseeds_protocol` program is acceptable while the data model settles.

## Security Rules

- No hidden minting
- No private-key custody
- No unlimited delegated trading authority
- Use explicit pause controls
- Keep authority paths visible
- Emit events for staking and voting-right changes
- Use checked arithmetic
- Store token thresholds in base units
- Use wallet-approved transactions only
- Review all CPI signer seeds carefully before deployment
- Keep localnet rejection tests current for config, stake, unstake, pause, and voting-right paths
