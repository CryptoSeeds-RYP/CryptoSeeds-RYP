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
- Frontend/IDL drift checks through `npm run protocol:idl:check`.
- WSL local validator smoke checks through `npm run protocol:smoke:localnet:wsl`.

The WSL route is the primary local path for Anchor builds. The localnet smoke check preloads the compiled SBF program with `solana-test-validator --bpf-program`, creates a test RYP-like mint, checks invalid config and unauthorized action rejections, initializes config, stakes, verifies project authority and operator delegation, verifies voting-delay/top-up/partial-unstake behavior, verifies pause enforcement, and unstakes. Full public deployment verification still needs a synced devnet/mainnet program id and key-management review.

## First Program

The first program is `cryptoseeds_protocol`.

Current scope:

- Initialize protocol config
- Store RYP mint and staking vault
- Configure tier thresholds in raw token base units
- Configure base platform/action fee and tier fee reductions
- Model the 1% RYP token-transfer fee target separately from the platform/action fee
- Stake RYP into a protocol vault
- Enforce the canonical config-owned RYP vault on stake and unstake paths
- Track per-wallet stake position
- Track Golden Key receipt issue/revoke lifecycle
- Calculate staking tier
- Activate Golden Key state
- Unlock Voting Rights state after 14 days with receipt-level state
- Upgrade Voting Rights receipt level after 100 successful votes without changing vote weight
- Unstake RYP
- Initialize reward config for draft holder/staker/treasury epoch accounting
- Register and verify reward vault state by role
- Route wallet-approved platform fees into verified holder/staker/treasury vaults
- Draft balanced, execution-blocked reward epochs
- Review/cancel reward epochs
- Expire reward epoch claims and record unclaimed net rewards
- Create role-keyed reward claim records
- Claim reviewed reward tokens from verified program-controlled reward vaults
- Create/close governance proposals with bounded voting windows and minimum-vote thresholds
- Cast one-wallet governance votes gated by active voting rights and active voting windows
- Transfer and accept separated project authority with two-step rotation
- Register project records with ProjectApproval governance binding, per-wallet caps, total allocation caps, and participation windows
- Create project disclosure revision records with metadata, risk disclosure, and terms hashes
- Require project participation to reference the current on-chain disclosure revision hash
- Update project lifecycle status with ProjectApproval governance binding
- Toggle project-level participation pause without changing lifecycle status
- Grant and revoke project-scoped operator records with explicit status/pause permissions and mandatory expiry
- Let active project operators perform limited status/pause actions without fund movement or global authority
- Record project participation by wallet with per-wallet and project-level allocation accounting
- Record project cancellation and external refund accounting without custody or token movement
- Create/revoke bounded SeedBot permission records
- Record owner-signed SeedBot usage against permission caps
- Emergency pause
- Emit protocol events

Current localnet security coverage includes rejected duplicate tier thresholds, reward config initialization, rejected invalid reward splits, rejected blank reward metadata, reward vault registration and verification, wallet-approved platform fee routing into holder/staker/treasury vaults, rejected pending-vault reward epochs, rejected reward metadata mismatch, rejected non-authority reward verification, rejected unbalanced reward epochs, balanced reward epoch drafts, reviewed reward epochs, holder reward token claims, staker rollover claims, reward epoch expiry accounting, duplicate reward claim rejection, governance proposal window/minimum-vote storage, rejected early governance close, deterministic governance proposal close, blocked voting without active voting rights, project authority transfer and acceptance, rejected stale project authority, rejected public project registration before approved governance, rejected invalid project participation bounds, rejected invalid project participation windows, draft project registration against an open ProjectApproval proposal, project disclosure revision creation, project min/max/wallet-cap participation accounting with current disclosure revision binding, rejected non-authority project pause, project pause toggling, rejected expired project operator grants, project operator grants, operator project pause toggling, rejected operator-only unsafe status transitions, project operator revocation, rejected revoked-operator actions, rejected public project status update before approved governance, rejected participation before project-open status, rejected project refund pools above recorded participation, project cancellation accounting, rejected invalid project refund accounting, SeedBot permission creation/revocation/renewal, owner-signed SeedBot usage accounting, rejected SeedBot daily-cap breaches, rejected below-Seed staking, Golden Key receipt issue/revoke lifecycle, rejected early voting-right activation, rejected mismatched-owner unstaking, rejected oversized unstaking, Seed-to-Sprout top-up state preservation, Sprout-to-Seed partial unstake state preservation, rejected non-authority pause attempts, pause enforcement for stake, unstake, and voting activation paths, and two-step protocol/reward authority rotation with stale-authority rejection.

Current Rust unit coverage also includes reward split totals, platform fee split/remainder math, reward cadence bounds, reward epoch accounting balance, and verified-vault requirements for epoch drafts.

Client preparation now has a TypeScript planning layer at `src/solana/protocolTransactionPlan.ts`:

- Derives the protocol config PDA from `config`
- Derives the per-wallet stake position PDA from `stake-position + wallet`
- Derives the owner RYP associated token account
- Derives the protocol RYP vault associated token account owned by the config PDA
- Builds Anchor instruction data for staking, reward claims, platform fee routing, governance voting/proposals with explicit voting windows and minimum votes, project authority rotation, project disclosure revisions, project operator grants/revocations, project registry/status updates with ProjectApproval account binding, project pause controls, project cancellation/refund accounting, project participation with current disclosure revision binding, wallet caps, allocation caps, and participation windows, SeedBot permissions, and fee config updates
- Builds owner-signed SeedBot usage-record instruction previews for later guarded execution composition
- Exposes account order, signer/writable flags, instruction discriminator, and raw data hex for wallet-preview surfaces
- Rejects prepared token amounts outside Solana's u64 SPL token amount bounds before instruction data is encoded
- Installs a browser `Buffer` shim at app startup so Solana wallet and transaction libraries can run in Vite without relying on Node globals

The frontend instruction metadata is centralized in `src/solana/protocolInstructionSpecs.json`. `npm run protocol:idl:check` compares that spec against `target/idl/cryptoseeds_protocol.json` after Anchor build output exists, and the WSL localnet smoke wrapper runs the drift check before launching the validator.

This is still a preparation layer. It does not sign, broadcast, or bypass wallet approval.

The next client boundary is `src/solana/solanaTransactionBoundary.ts`:

- Converts prepared instruction plans into unsigned Solana `Transaction` objects
- Builds a serialized-message preview for wallet review surfaces
- Blocks demo/disconnected wallets and fee-payer mismatches before any signature request
- Runs RPC simulation with `sigVerify: false` and no wallet signature
- Requests a wallet signature only after simulation passes, then stores a receipt rather than signed transaction bytes
- Rejects signed receipts if the wallet returns a different message than the simulated preview
- Keeps broadcast disabled until a later explicit signing and send boundary is reviewed

Broadcast readiness is modeled separately in `src/solana/solanaBroadcastReadiness.ts`. It checks the signed receipt, demo mode, broadcast flag, program deployment status, placeholder program id, cluster/deployment match, and prepared instruction program ids. The repo-level command is:

```bash
npm run devnet:readiness
```

## Deferred Modules

These should be added after the staking core is reviewed:

- Actual Golden Key NFT mint/burn/return logic
- Voting Rights NFT minting and dynamic metadata
- Voting Rights receipt rendering and metadata sync
- Reward accrual and expired-unclaimed redistribution movement
- Treasury distribution
- Airdrop eligibility
- Actual SeedBot DEX execution composition

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
- Keep delegated operator records project-scoped, permission-scoped, time-bounded, revocable, and unable to move funds
- Emit events for staking and voting-right changes
- Use checked arithmetic
- Store token thresholds in base units
- Use wallet-approved transactions only
- Review all CPI signer seeds carefully before deployment
- Keep localnet rejection tests current for config, stake, unstake, pause, voting-right, and reward-epoch paths
- Keep reward claim and payout execution behind explicit review, verified vaults, wallet signatures, and bounded claim totals
