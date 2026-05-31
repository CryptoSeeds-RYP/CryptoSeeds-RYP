# Slice 67 Evaluation - Localnet Security Boundary Checks

## Intent

Strengthen the Anchor localnet smoke test from a happy-path execution check into a first security boundary check for the staking program.

This slice focuses on proving that the protocol rejects unsafe staking states before any devnet deployment work begins.

## Changes

- Expanded `scripts/run-anchor-localnet-smoke.mjs`.
- Added a hostile test wallet for unauthorized action attempts.
- Added a rejected `initialize_config` case for duplicate tier thresholds.
- Added a rejected `stake_ryp` case for amounts below the Seed tier.
- Added a rejected `unstake_ryp` case for a mismatched owner and stake position.
- Added a rejected `set_pause` case for a non-authority signer.
- Added pause enforcement checks for both staking and unstaking.
- Added smoke-test helpers for expected transaction failures and missing account assertions.

## Verification

- `npm run protocol:smoke:localnet:wsl`
- `npm run protocol:test:wsl`
- `npm run protocol:check:win`
- `npm test`
- `npm run build`
- `npm run copy:audit`
- `npm run visual:audit`
- `npm run token:check`
- `npm audit --omit=dev`

## Result

The localnet smoke test now passes against a disposable validator and verifies:

- `initialize_config`
- `reject_invalid_thresholds`
- `reject_below_tier_stake`
- `stake_ryp`
- `reject_unauthorized_unstake`
- `reject_unauthorized_pause`
- `pause_blocks_stake_and_unstake`
- `unstake_ryp`

The test confirms that rejected transactions do not create protocol accounts, do not move RYP into the vault, and do not change pause state when the signer lacks authority.

## Security Notes

This does not replace a full audit, but it is a useful deployment gate. The staking program now has executable localnet coverage for the first high-value failure paths:

- bad config
- under-tier stake
- signer/position mismatch
- admin authority misuse
- emergency pause enforcement

## Next Recommended Protocol Checks

- Add localnet coverage for partial unstake and full unstake state transitions.
- Add localnet coverage for voting-right activation before and after the 14-day delay.
- Add localnet coverage for restaking after a full unstake resetting the voting timer.
- Add localnet coverage for insufficient token balance and insufficient staked balance.
- Add client-side simulation tests that compare prepared transaction plans with the deployed IDL.
