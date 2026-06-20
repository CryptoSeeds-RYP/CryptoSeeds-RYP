# Slice 106: Reward Proof Export

## Outcome

Added deterministic Merkle proof generation for holder/staker reward claim records.

The protocol can now move from holder reward accounting to a claimable root:

1. Build and review a holder reward epoch.
2. Export a reward claim Merkle packet for the intended on-chain epoch id.
3. Pass the exported `claimMerkleRoot` into `draft_reward_epoch`.
4. Let wallets create their own claim records from proofs.
5. Let wallets claim tokens or mark zero-net rollover records through the existing wallet-approved paths.

## Added

- `src/solana/rewardMerkleClaims.ts`
- `src/solana/rewardMerkleClaims.test.ts`
- `scripts/prepare-reward-claim-merkle.mjs`
- `npm run rewards:claim-merkle`
- Proof-backed transaction planner:
  - `buildCreateRewardClaimRecordFromProofTransactionPlan`

## Safety Notes

- Proof exports are data-only.
- No private keys, seed phrases, custody, signing, broadcasting, or token movement are involved.
- Merkle leaves bind epoch PDA, wallet, reward role, gross allocation, delivery cost, net claim, rollover amount, and leaf index.
- Proof vector serialization matches Anchor/Borsh: `u32 length` followed by 32-byte proof nodes.
- Proof depth is capped to the same 32-node limit enforced by the Rust program.

## Operational Command

```bash
npm run rewards:claim-merkle -- <reward-epoch-draft.json> <epoch-id>
```

Optional flags:

```bash
--program-id <pubkey>
--reward-role HOLDER_REWARD
--reward-epoch-address <pubkey>
```

`--reward-epoch-address` is useful when testing against a known localnet/devnet epoch PDA.
