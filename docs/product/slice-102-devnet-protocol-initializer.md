# Slice 102 Devnet Protocol Initializer

Date: 2026-06-20

This slice adds the first guarded devnet protocol initialization path.

## Added

- `npm run devnet:init:protocol`
- `scripts/initialize-devnet-protocol.mjs`

## Behavior

The script reads the devnet env file and checks:

- cluster and deployment are both `devnet`,
- demo mode is off,
- frontend broadcast remains disabled,
- authority keypair matches `VITE_ADMIN_AUTHORITY_ADDRESS`,
- `VITE_INDEPENDENT_TREASURY_ADDRESS` is configured,
- independent treasury address is distinct from the admin authority wallet,
- independent treasury keypair exists under ignored `target/devnet/independent-treasury.json`,
- independent treasury keypair matches `VITE_INDEPENDENT_TREASURY_ADDRESS`,
- configured program account exists and is executable,
- configured devnet RYP test mint exists with expected decimals,
- authority wallet has enough devnet SOL for initialization.

Without `--execute`, it produces a plan only.

With `--execute`, it initializes:

1. `ProtocolConfig` and the staking vault.
2. `RewardConfig`.
3. Holder, staker, treasury, delivery-cost, and rollover reward token accounts.
4. Role-specific `RewardVaultState` accounts.
5. Verified reward vault metadata.

## Safety Boundaries

- No frontend broadcast is enabled.
- `--execute` is required for on-chain writes.
- The script blocks when devnet mint or program accounts are missing.
- Keypair contents are not printed.
- Reward vault token account keypairs are generated under ignored `target/devnet/reward-vaults`.
- The independent treasury vault uses `VITE_INDEPENDENT_TREASURY_ADDRESS`; the checked-in devnet example sets it to a treasury owner distinct from the admin authority.
- The initializer blocks rather than falling back to the admin authority when the independent treasury address or owner keypair is missing.

## Current Blocker

The script currently blocks because the devnet program and devnet test mint are not deployed yet, and it will keep blocking if the local independent treasury owner keypair no longer matches the configured treasury address.
