# Slice 70 Evaluation - Wallet Signature Message Integrity

## Intent

Harden the Solana wallet signature boundary so a signed transaction can only be accepted if the wallet returns the same transaction message that was simulated and shown in the preview.

The goal is simple: simulate first, sign exactly that message, and keep broadcast disabled until the next reviewed boundary.

## Changes

- Added a signed-message comparison against the simulated `serializedMessageBase64` preview.
- Blocked signature requests when the simulation boundary is missing the unsigned message preview.
- Blocked signature requests when the simulation boundary fee payer does not match the prepared transaction plan.
- Changed signature handling so unverifiable signatures return `FAILED` instead of a signed receipt with `signatureVerified: false`.
- Added a regression test where a wallet adapter mutates the transaction blockhash after simulation.

## Verification

- `npm test -- src/solana/solanaTransactionBoundary.test.ts`
- `npm test`
- `npm run build`
- `npm run copy:audit`
- `npm run visual:audit`
- `npm run protocol:idl:check`
- `npm audit --omit=dev`

## Result

The wallet boundary now fails closed if:

- simulation has not passed
- the unsigned message preview is missing
- the fee payer changes between plan and boundary
- the returned signed message differs from the simulated preview
- the wallet signature does not verify

## Security Note

This keeps the Phantom/Solana route self-custodial and predictable. The app can collect a wallet signature receipt, but it does not store signed transaction bytes and does not broadcast at this stage.

## Next Recommended Step

Add a reviewed broadcast boundary only after devnet program id, cluster selection, IDL drift checks, transaction simulation, and user-facing warning copy are all accepted together.
