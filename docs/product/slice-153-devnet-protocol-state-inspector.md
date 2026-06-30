# Slice 153: Devnet Protocol State Inspector

## Scope

This slice adds a standalone read-only devnet protocol-state inspection command.

## Changes

- Added `scripts/inspect-devnet-protocol-state.mjs`.
- Added `npm run devnet:inspect:protocol`.
- The inspector derives the same protocol config, reward config, RYP vault, treasury vault, and reward-vault state targets used by devnet initialization.
- The inspector requires `VITE_INDEPENDENT_TREASURY_ADDRESS` and blocks if it reuses the admin authority wallet.
- The inspector reads devnet RPC state without signing or broadcasting.
- It decodes and validates:
  - deployed program account,
  - `ProtocolConfig`,
  - `RewardConfig`,
  - holder, staker, treasury, delivery-cost, and rollover reward vault states.
- It blocks if initialized state is missing, owned by the wrong program, has invalid account discriminators, mismatched mint/vault targets, unsafe fee/tier settings, unverified vaults, mismatched metadata hashes, non-draft reward execution, or any vault marked as receiving user funds.
- Public testnet readiness profiles now include protocol-state inspection.

## Safety Position

This command is read-only. It does not create accounts, initialize protocol state, sign transactions, broadcast transactions, move funds, or enable frontend execution.

## Current Expected Result

Until the devnet authority is funded, the devnet mint exists, the program is deployed, and initialization has executed, the command should report `BLOCKED`.

## Verification

- Syntax check for the new script
- Focused CLI tests with mocked decoded account state
- Ops readiness check
- Full app regression and audit checks before push
