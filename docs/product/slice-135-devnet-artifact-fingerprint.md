# Slice 135: Devnet Artifact Fingerprint

## Purpose

Make devnet deployment review more explicit by fingerprinting the compiled Anchor program artifact before any deploy transaction is sent.

## Implemented

- Added `programArtifact` to `npm run devnet:status -- --env .env.devnet.example`.
- The status report now includes:
  - whether the compiled `.so` exists,
  - the relative artifact path,
  - the SHA-256 checksum,
  - the artifact byte size.
- Updated the devnet deployment status document with the checksum report behavior.
- Recorded the latest `0.1 SOL` faucet funding attempt as rate-limited.

## Boundaries

- This does not deploy the program.
- This does not sign or broadcast any transaction.
- Devnet remains blocked until the authority wallet receives devnet SOL.

## Verification

- `npm run devnet:status -- --env .env.devnet.example` reports the program artifact checksum.
- `npm run ops:check` passes.
- `npm test -- --run src/solana/protocolConfigInspection.test.ts` passes.
