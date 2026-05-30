# Solana Protocol Architecture

CryptoSeeds should use Rust programs on Solana for core protocol logic. Anchor is the preferred framework because it is the leading Solana program framework, produces IDLs for TypeScript clients, and gives the project safer account validation patterns.

## Tooling Target

- Rust and Cargo
- Anchor 1.x
- Anchor SPL
- Solana/Agave local validator tooling
- TypeScript generated clients from Anchor IDL
- Vite/React dApp client

The current local machine now has Rust and Cargo installed in the user profile, but does not yet have Solana/Agave CLI, Anchor CLI, WSL, or MSVC C++ build tools available. The scaffold is ready, but protocol compilation/deployment requires finishing the Solana/Anchor toolchain setup.

## First Program

The first program is `cryptoseeds_protocol`.

Current scope:

- Initialize protocol config
- Store RYP mint and staking vault
- Configure tier thresholds in raw token base units
- Configure base network fee and tier fee reductions
- Stake RYP into a protocol vault
- Track per-wallet stake position
- Calculate staking tier
- Activate Golden Key state
- Unlock Voting Rights state after 14 days
- Unstake RYP
- Emergency pause
- Emit protocol events

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
