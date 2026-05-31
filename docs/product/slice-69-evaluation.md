# Slice 69 Evaluation - Protocol IDL Drift Gate

## Intent

Simplify the Solana wallet planning layer and prevent silent drift between the Rust/Anchor program and the frontend transaction previews.

The frontend prepares wallet-approved staking, unstaking, and voting-right activation instructions by hand. That is acceptable for the current MVP, but the account order and discriminators must stay aligned with the generated Anchor IDL.

## Changes

- Added `src/solana/protocolInstructionSpecs.json` as the frontend instruction metadata source.
- Updated `src/solana/protocolTransactionPlan.ts` to build account plans from that shared spec instead of repeating account order in separate functions.
- Added `anchorName` to transaction account references so preview accounts can be traced back to Anchor account names.
- Added `scripts/check-protocol-idl-drift.mjs`.
- Added `npm run protocol:idl:check`.
- Updated the WSL localnet smoke wrapper so it runs the IDL drift check after `anchor build --ignore-keys` and before local validator execution.

## Verification

- `npm test`
- `npm run build`
- `npm run protocol:idl:check`
- `npm run protocol:smoke:localnet:wsl`
- `npm run protocol:test:wsl`
- `npm run protocol:check:win`
- `npm run copy:audit`
- `npm run visual:audit`
- `npm audit --omit=dev`

## Result

The IDL drift check passed for the three frontend instruction plans:

- `stake_ryp`
- `unstake_ryp`
- `activate_voting_rights`

The check compares:

- instruction discriminator
- account order
- signer flags
- writable flags
- argument names

## Product/CTO Note

This is a deliberate simplification. Instead of letting staking, unstaking, and voting account lists spread across the app, the frontend now has one small instruction spec and one automated IDL gate. That keeps the wallet UX easier to review and reduces the risk of sending users to sign stale or malformed Solana transactions.

## Next Recommended Step

Use the same principle for the next slice: add one clear wallet execution boundary for localnet/devnet transaction simulation and keep the UI copy plain, self-custodial, and conservative.
