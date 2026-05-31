# Slice 77 Evaluation: Admin Dashboard God-Wallet Test Scaffold

## Goal

Add an Admin Dashboard scaffold for the testing god-wallet approach while keeping it safe for devops and future live usage.

## Added

- Configurable `VITE_ADMIN_AUTHORITY_ADDRESS`.
- `admin` MicroVerse location and Admin Dashboard view.
- Admin access model with configured-wallet, connected-wallet, mainnet, and broadcast warnings.
- Admin action previews for:
  - project registry,
  - charity accounts,
  - treasury labels,
  - fee split policy,
  - homestead config,
  - SeedBot config,
  - emergency pause,
  - program authority review.
- Unit tests proving wrong wallets and mainnet remain blocked.
- Admin dashboard architecture document.

## CTO Call

The god-wallet path is acceptable for localnet/devnet testing, but not as a final production model. The dashboard unlocks only when the connected wallet matches the configured authority and the environment is not mainnet. Even then, MVP actions are draft/proposal-only and cannot execute live from the UI.

## Next Best Step

Wire Admin Dashboard drafts into actual editable local state:

- project draft editor,
- treasury label editor,
- homestead config editor,
- review queue,
- exportable proposal JSON,
- and eventually multisig proposal creation.
