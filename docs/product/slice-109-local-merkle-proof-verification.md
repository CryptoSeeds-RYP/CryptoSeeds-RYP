# Slice 109 - Local Merkle Proof Verification

Added local verification for reward claim Merkle proof packets before wallet transaction plans are trusted.

The protocol already validates `create_reward_claim_record_from_proof` on-chain, but the app and ops layer should reject tampered proof packets before preparing wallet-facing claim flows.

## What Changed

- Added `verifyRewardClaimMerkleRecord`.
- Reconstructs each record root from:
  - `leafHash`,
  - `leafIndex`,
  - `proof`,
  - exported `claimMerkleRoot`.
- Blocks malformed 32-byte hex inputs.
- Blocks oversized proofs.
- Blocks wallet plans whose records do not reconstruct the exported root.

## Why It Matters

This adds a preflight integrity check between reward proof export and wallet signing.

Bad or tampered proof packets now fail before users see a trusted claim plan. The final authority remains the Solana program, but the frontend and admin tooling now catch the same class of failure earlier.

## Current Deployment Status

This is pushed as local application and transaction-planning logic. It does not deploy the Anchor program by itself.

Devnet deployment still requires funding the devnet authority before the test mint and program account can be created.
