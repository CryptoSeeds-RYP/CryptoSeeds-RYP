# Slice 95 Protocol Expansion

Date: 2026-06-20

This slice expands the CryptoSeeds Anchor program from staking plus reward drafts into a broader protocol skeleton for admin control, reward review, governance, project participation, and SeedBot permission state.

## Added On Chain

- Fee config updates through `update_fee_config`.
- Protocol authority transfer through `transfer_protocol_authority`.
- Reward epoch review and cancellation.
- Wallet-level reward claim records.
- Wallet claim marking for reviewed reward records.
- Wallet-approved platform fee routing into verified holder/staker/treasury vaults.
- Governance proposal records.
- One-wallet vote records gated by active voting-right state.
- Governance proposal close flow.
- Project registry records with required tier, risk level, status, metadata hash, receiving wallet, and governance proposal pointer. Later slices harden this pointer into a real ProjectApproval account binding.
- Project participation records gated by stake tier and project status.
- SeedBot permission records with expiry, max trade amount, max daily trades, and revocation.

## Safety Boundaries

- Reward vault movement remains limited to explicit wallet-approved fee routing and reviewed wallet reward claims.
- No automated SeedBot execution was added.
- Project participation records do not custody funds.
- Governance voting still requires active voting rights.
- Project and SeedBot records use fixed-size hashes and public keys, not mutable strings.
- Authority-sensitive actions emit events.

## Verification

- Rust unit tests cover reward accounting, metadata hashes, tier access, project-open status, reward vault verification, fee reductions, reward cadence, reward split, and staking tier mapping.
- `protocol:idl:check` now covers 25 instructions and 11 account layouts.
- Localnet smoke now exercises reward review/claim records, platform fee routing, governance proposal close, blocked voting without active rights, project governance binding, SeedBot permission creation/revocation, and fee updates.
- Devnet mint creation is scripted but externally blocked until the devnet authority wallet receives SOL.

## Remaining Protocol Work

- Fund the devnet authority wallet and create the devnet RYP test mint.
- Deploy the expanded program to devnet.
- Add successful governance voting path once local time-warp or test-only voting setup is available.
- Add SeedBot permission renewal/update flow.
- Add public UI gates for reviewed project/governance actions after devnet deployment is stable.
