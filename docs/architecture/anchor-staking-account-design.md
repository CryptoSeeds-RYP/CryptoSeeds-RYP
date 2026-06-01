# Anchor Staking Account Design

This document defines the first CryptoSeeds Solana protocol slice: RYP staking, tier state, Golden Key receipt state, and Voting Rights eligibility.

## Design Goals

- Keep RYP fixed-supply and non-minting.
- Keep all stake movement wallet-approved.
- Store tier thresholds in raw token base units.
- Track Golden Key and Voting Rights state without minting final NFTs yet.
- Keep project participation, rewards, and governance modules separate from staking until the staking core is reviewed.
- Emit clear events for protocol indexing and UI state.

## Program

`cryptoseeds_protocol`

Current synced localnet/devnet program id:

`5RWpGEGB9Yr7cmaoWZJQ9t263Wb8K18GrcMDqHByLXSb`

The matching program keypair is generated locally under ignored `target/devnet/cryptoseeds_protocol-keypair.json`. Devnet deployment is still blocked until the devnet authority wallet is funded and the devnet test RYP mint exists.

## Seeds

| Account | Seeds | Purpose |
| --- | --- | --- |
| `ProtocolConfig` | `["config"]` | Global staking config and vault authority |
| `StakePosition` | `["stake-position", owner]` | Per-wallet staking state |
| RYP vault ATA | ATA mint = RYP, authority = `ProtocolConfig` | Holds staked RYP |

## ProtocolConfig

Stores global protocol settings.

| Field | Type | Notes |
| --- | --- | --- |
| `authority` | `Pubkey` | Admin authority for pause/config actions |
| `ryp_mint` | `Pubkey` | Confirmed RYP mint |
| `ryp_vault` | `Pubkey` | Program-owned token account |
| `base_fee_bps` | `u16` | Planned platform/action base fee, currently 350 bps |
| `tier_thresholds` | `[u64; 5]` | Seed, Sprout, Sapling, Tree, Fruit thresholds in base units |
| `tier_fee_reduction_bps` | `[u16; 5]` | Fee reduction amounts in bps |
| `total_staked` | `u64` | Aggregate staked base units |
| `paused` | `bool` | Emergency pause |
| `bump` | `u8` | PDA bump |

Recommended RYP thresholds with 6 decimals:

| Tier | RYP | Base Units |
| --- | ---: | ---: |
| Seed | 5,000 | 5,000,000,000 |
| Sprout | 20,000 | 20,000,000,000 |
| Sapling | 50,000 | 50,000,000,000 |
| Tree | 100,000 | 100,000,000,000 |
| Fruit | 150,000 | 150,000,000,000 |

Recommended fee reductions:

| Tier | Effective Fee | Reduction From 350 bps |
| --- | ---: | ---: |
| Seed | 3.50% | 0 bps |
| Sprout | 3.15% | 35 bps |
| Sapling | 2.80% | 70 bps |
| Tree | 2.45% | 105 bps |
| Fruit | 2.10% | 140 bps |

## StakePosition

Stores per-wallet staking state.

| Field | Type | Notes |
| --- | --- | --- |
| `owner` | `Pubkey` | Wallet owner |
| `staked_amount` | `u64` | Staked RYP base units |
| `tier` | `StakeTier` | Current staking tier |
| `staking_start_ts` | `i64` | Start of active staking cycle |
| `voting_rights_eligible_ts` | `i64` | Timestamp when voting can activate |
| `last_reward_claim_ts` | `i64` | Placeholder for later rewards module |
| `golden_key_active` | `bool` | Receipt/access state |
| `voting_rights_active` | `bool` | 14-day voting eligibility state |
| `vote_count` | `u32` | Used later for Voting Rights NFT evolution |
| `bump` | `u8` | PDA bump |

Important cycle rule:

If a wallet fully unstakes and later stakes again, the staking start timestamp and voting eligibility timer must reset. This prevents users from carrying old voting eligibility across a zero-stake gap.

## Instructions

### `initialize_config`

Creates `ProtocolConfig` and the program-owned RYP vault ATA.

Validation:

- `base_fee_bps <= 1000`
- Thresholds are non-zero and strictly increasing.
- Fee reductions do not exceed the base fee.

### `stake_ryp`

Transfers RYP from the owner token account into the program vault.

Validation:

- Protocol not paused.
- Amount > 0.
- Resulting stake reaches at least Seed tier.
- Transfer uses wallet signer authority.
- Config account must point to the canonical config-owned RYP vault.

State:

- If previous stake was zero, start a new active staking cycle.
- Preserve active voting rights when a user increases an already-active stake.
- Activate Golden Key state while stake remains non-zero.
- Update tier from total staked amount.
- Update total staked.

### `unstake_ryp`

Transfers RYP back from the vault to the owner token account.

Validation:

- Protocol not paused.
- Amount > 0.
- Owner matches stake position.
- Position has enough staked RYP.
- Vault matches config and the canonical config-owned associated token account for the RYP mint.

State:

- Update tier from remaining stake.
- If remaining stake is zero, deactivate Golden Key and Voting Rights state.
- Update total staked.

### `activate_voting_rights`

Activates 1-wallet-1-vote eligibility after the 14-day staking delay.

Validation:

- Protocol not paused.
- Owner matches stake position.
- Tier is not `None`.
- Current timestamp is greater than or equal to `voting_rights_eligible_ts`.

## Events

Recommended event set:

- `ConfigInitialized`
- `PauseUpdated`
- `StakeDeposited`
- `StakeWithdrawn`
- `StakeUpdated`
- `VotingRightsActivated`

Events should include enough data for an indexer to reconstruct:

- Owner
- Amount delta
- New staked amount
- Previous tier
- New tier
- Golden Key state
- Voting Rights state
- Relevant timestamps

## Deferred

Do not include these in the first staking program deployment:

- Reward accrual and expiration
- 1% RYP transfer-fee router and holder/staker/treasury distribution accounting
- Real Golden Key NFT mint/burn/return
- Real Voting Rights NFT minting and dynamic metadata
- Project pool participation
- Governance proposal storage
- SeedBot permissions
- Treasury distribution

## Current Localnet Coverage

`npm run protocol:smoke:localnet:wsl` verifies the first staking happy path and several rejection paths against a disposable Solana validator:

- invalid duplicate tier thresholds are rejected before config creation
- below-Seed stake amounts are rejected before position creation or vault transfer
- early voting-right activation is rejected before the 14-day delay
- mismatched-owner unstake attempts are rejected
- oversized unstake attempts are rejected before vault transfer
- Seed-to-Sprout top-ups preserve staking start and voting eligibility timestamps
- Sprout-to-Seed partial unstake keeps Golden Key active and preserves the voting timer
- non-authority pause attempts are rejected
- paused protocol state blocks stake, unstake, and voting activation
- full unstake returns the vault balance and resets position state
