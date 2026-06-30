# Reward Vault and Epoch Drafts

This document defines the next CryptoSeeds reward infrastructure slice.

The goal is to prepare holder and staker reward accounting with explicit review gates and a narrowly scoped token-claim path for verified program-controlled vaults.

## Reward Vault Roles

Every reward epoch draft should reference exactly one vault for each role:

| Role | Purpose |
| --- | --- |
| Holder reward | Funds Passive Holder Rewards for self-custodial RYP holders |
| Staker reward | Funds staking-specific rewards |
| Independent treasury | Receives the treasury fee bucket |
| Delivery cost reserve | Tracks payout delivery costs deducted from holder allocations |
| Rollover | Tracks dusty, small, or deferred holder allocations |

Draft vault config must include:

- label,
- reward mint,
- address or explicit pending status,
- custody model,
- verification status,
- notes,
- `receivesUserFunds = false`.

Reward vaults should never be presented as user custody accounts.

## Epoch Draft Flow

1. Collect platform/action fees into fee vault accounting.
2. Split fees by holder, staker, treasury, and any review-gated buckets.
3. Prepare a holder snapshot.
4. Exclude treasury, protocol, project-owner, charity, liquidity, and other system wallets as policy requires.
5. Build the Passive Holder Rewards epoch.
6. Validate accounting:

   `distributed net payouts + reserved delivery costs + rolled-forward allocations = holder reward pool`

7. Attach vault configs.
8. Export draft JSON for review.
9. Export the claim Merkle packet for the reviewed epoch id.
10. Pass the exported `claimMerkleRoot` into `draft_reward_epoch`.
11. Only after review, prepare devnet instructions.

Preferred one-command claim packet export from raw holder snapshot input:

```bash
npm run rewards:holder-claim-packet -- <epoch-input.json> <epoch-id>
```

The output includes the holder reward epoch draft, the proof-only claim packet, and the `claimMerkleRoot` that should be reviewed before being passed into `draft_reward_epoch`.

Claim proof export:

```bash
npm run rewards:claim-merkle -- <reward-epoch-draft.json> <epoch-id>
```

The lower-level claim proof export accepts an already generated reward epoch draft. The export contains the epoch `claimMerkleRoot`, each wallet leaf, and each wallet proof. The root must match the value stored in `RewardEpoch.claim_merkle_root`; otherwise proof-backed claim-record creation will fail on-chain.

Preferred wallet claim flow:

1. Wallet receives or looks up its Merkle record.
2. Wallet signs `create_reward_claim_record_from_proof`.
3. If net reward is positive, wallet signs `claim_reward_tokens`.
4. If net reward is zero and rolled forward, wallet signs `claim_reward_record`.

The older authority-created `create_reward_claim_record` path remains available as an operational fallback, but the public/self-custodial path should use proofs so users create their own claim records.

## MVP Safety Rules

- Admin UI is draft/export only.
- No payout transaction from the Admin Dashboard.
- No reward vault movement from the Admin Dashboard.
- No mainnet action while program id is placeholder or broadcast is disabled.
- No holder reward epoch review packet when the snapshot has zero eligible non-excluded holder balance.
- No holder payout if accounting does not balance.
- No duplicate vault address inside a draft.
- No disabled vault role inside a draft.
- No vault marked as receiving user funds.

## On-Chain Direction

Anchor now includes the first reward-account scaffold:

| Account | Purpose |
| --- | --- |
| `RewardConfig` | Reward authority, mint, vault roles, epoch cadence, pause flags, routed fee total |
| `RewardVaultState` | Role, mint, vault address, verification metadata hash, funded total |
| `RewardEpoch` | Snapshot timestamp, pool amount, net payout total, delivery cost reserve, rollover total, claim expiry, expired-unclaimed accounting, exclusion hash, claim Merkle root, recorded claim totals, paid claim totals, review status |
| `RewardClaimRecord` | Wallet, epoch, holder/staker role, claimed amount, delivery cost, rollover, claim state |
| `RewardExclusionList` | Hash or registry pointer for excluded wallets |

Current reward instructions:

| Instruction | Purpose | Movement |
| --- | --- | --- |
| `initialize_reward_config` | Creates reward config and split/cadence policy | No funds |
| `register_reward_vault` | Registers one role-specific vault state as pending verification | No funds |
| `verify_reward_vault` | Marks a reviewed vault state as verified when metadata hash matches | No funds |
| `route_platform_fee` | Routes a wallet-approved RYP platform fee into verified holder/staker/treasury vaults | Moves signer-approved fee tokens only |
| `transfer_ryp_with_platform_fee` | Transfers RYP through the CryptoSeeds protocol, sends the net amount to the recipient, and routes the 1% fee into verified holder/staker/treasury vaults | Moves signer-approved gross transfer tokens only |
| `draft_reward_epoch` | Creates a balanced, execution-blocked epoch draft | No funds |
| `review_reward_epoch` | Marks a drafted epoch as reviewed and claim-record eligible | No funds |
| `cancel_reward_epoch` | Cancels an epoch and keeps execution blocked | No funds |
| `expire_reward_epoch_claims` | Marks an expired reviewed epoch as blocked and records unclaimed net rewards | No funds |
| `create_reward_claim_record` | Creates a wallet-specific, role-keyed claim accounting record after review | No funds |
| `create_reward_claim_record_from_proof` | Lets a wallet create its own holder/staker claim record from a reviewed Merkle proof | No funds |
| `claim_reward_record` | Lets the wallet mark a zero-net rollover claim record as claimed | No funds |
| `claim_reward_tokens` | Lets the wallet claim a positive net reward from a verified program-controlled reward vault | Moves reviewed reward tokens only |

The token-claim path is intentionally narrow:

- only holder and staker reward roles are claimable by wallets,
- the claim record PDA includes the reward role so holder and staker claims cannot collide,
- public claim creation can be proven against the reviewed epoch `claim_merkle_root`,
- Merkle leaves bind the epoch PDA, role, wallet, gross allocation, delivery cost, net amount, rolled-forward amount, and leaf index,
- Merkle proofs are capped to avoid unbounded instruction cost,
- the source vault must match the reviewed `RewardVaultState`,
- the source vault must be program-controlled,
- the reward mint must match the reviewed epoch,
- the wallet destination token account must be owned by the claiming wallet,
- duplicate claims are rejected,
- claims after the epoch claim window are rejected,
- epoch-level recorded gross, recorded net, and claimed net totals prevent over-allocation and over-payment.

The platform-fee route is also intentionally narrow:

- the payer signs the RYP transfer,
- the payer source account must be owned by the payer,
- holder and staker destination vaults must be verified program-controlled reward vaults,
- the independent treasury destination must match its verified vault state,
- the split uses `RewardConfig` holder/staker/treasury bps,
- holder and staker amounts are rounded down and any remainder stays in the treasury bucket,
- `RewardConfig.total_routed_fee_amount` and each destination `RewardVaultState.total_funded_amount` are updated on-chain,
- this does not create or enforce a global wallet-to-wallet transfer tax for the existing SPL token.

The CryptoSeeds-routed RYP transfer path uses the same verified vault rules, but it derives the fee from `RYP_TOKEN_TRANSFER_FEE_BPS = 100` against the signer-approved gross transfer amount. The recipient token account receives the net amount, and the fee is split into holder, staker, and treasury buckets. Amounts too small to create a nonzero fee are rejected by the public transaction planner and by the on-chain instruction.

Reward logic remains modular from staking until batching, exclusion-list execution, authority review, and public UI exposure are complete.

## Protocol Rejection Rules

The Anchor validation layer rejects:

- non-authority reward setup,
- reward split totals that do not equal 10,000 bps,
- zero or out-of-bounds reward cadence,
- zero reward pools,
- unbalanced epoch accounting,
- claim records before epoch review,
- claims after the reviewed epoch claim window,
- reward expiry before the claim window closes,
- proof-backed claim records when the epoch has no claim Merkle root,
- invalid or oversized reward Merkle proofs,
- fee routes into unverified or mismatched reward vaults,
- holder/staker fee routes into non-program-controlled vaults,
- claim-record totals that exceed reviewed epoch totals,
- token claims from non-program-controlled vaults,
- wallet claims against treasury, delivery-cost, or rollover vault roles,
- duplicate reward claims,
- invalid claim accounting,
- disabled vaults,
- unverified vaults,
- vault states with the wrong role, reward mint, or reward config,
- vault states marked as receiving user funds,
- default/empty vault addresses,
- blank metadata hashes,
- vaults with pending custody disclosure,
- metadata-hash mismatches during verification.

These checks are covered by Rust unit tests in `programs/cryptoseeds_protocol/src/lib.rs` and the WSL localnet smoke flow in `scripts/run-anchor-localnet-smoke.mjs`.

## Current Implementation

Local domain model:

- `src/domain/rewardVaults.ts`
- `src/domain/rewardVaults.test.ts`

The model builds review-gated reward epoch drafts and serializes bigint accounting into JSON strings for review packets.

Protocol model:

- `programs/cryptoseeds_protocol/src/lib.rs`

The protocol model stores reward config, vault verification state, reviewed epochs, and wallet-level claim records. It keeps `execution_blocked = true` on drafted, expired, or cancelled epochs and flips it off only after `review_reward_epoch`.
Reviewed epochs can also store a `claim_merkle_root` so wallets can create their own holder/staker claim records from off-chain snapshot proofs without requiring the authority to initialize every record individually.
Reviewed epochs carry a bounded claim window. After the window closes, `expire_reward_epoch_claims` records `expired_unclaimed_net_amount = distributed_net_amount - claimed_net_amount`, marks the epoch `Expired`, and blocks further claims. This is redistribution accounting only; later redistribution still needs a separately reviewed token movement route.

Frontend read-only model:

- `src/solana/rewardAccountInspection.ts`
- `src/solana/rewardAccountInspection.test.ts`
- `src/solana/rewardMerkleClaims.ts`
- `src/solana/rewardMerkleClaims.test.ts`
- `src/solana/protocolAccountLayouts.json`
- `src/views/AdminView.tsx`
- `src/solana/rewardClaimBatchPlan.ts`

The Admin Dashboard can derive and decode reward config, vault state, and epoch accounts for inspection. It does not expose reward setup, claim, payout, or vault-movement transaction builders.
Reward account decoders verify Anchor account discriminators before reading account fields.
The Merkle claim exporter builds deterministic proof packets from reviewed holder epochs. It is proof-only and does not sign, broadcast, create records, or transfer tokens.
The Merkle wallet planner converts a valid proof packet into preview-only wallet transaction plans for proof-backed record creation plus token claim or rollover marking.
The localnet Anchor smoke script uses the same layout manifest when parsing live reward accounts.
The smoke result includes an `adminRewardInspection` report that mirrors the Admin Dashboard's read-only inspection posture against live localnet accounts.
The reward claim batch planner converts a reviewed holder epoch into preview-only claim-record and wallet-claim transaction plans. It does not sign, broadcast, create claim records, or expose payout execution in the Admin Dashboard.
`npm run protocol:admin:fixture:wsl` writes `target/localnet-admin-fixture.json` with the localnet RPC URL, app env values, decoded reward accounts, and read-only Admin inspection report for browser harness work.
`npm run protocol:admin:fixture:check` validates the exported fixture before browser work by checking read-only mode, reward split totals, reward config draft-only status, safe drafted or reviewed epoch state, bounded claim totals, vault verification, no user-fund vault receivers, and the app reward-inspection epoch id.

Localnet inspection:

- Set `VITE_SOLANA_CLUSTER=localnet`.
- Set `VITE_CRYPTOSEEDS_PROGRAM_DEPLOYMENT=localnet`.
- Set `VITE_REWARD_INSPECTION_EPOCH_ID` to the localnet draft epoch id emitted by the fixture.
- Keep broadcast disabled unless a separate reviewed transaction slice explicitly enables it.

The development placeholder program id can be inspected on localnet only. Devnet and mainnet readiness still require a reviewed non-placeholder program id.
