# Passive Holder Rewards

Passive Holder Rewards are separate from staking rewards.

The holder bucket is for wallets that hold RYP in self-custodial wallets. They do not need to stake into the CryptoSeeds protocol to be eligible for this bucket.

## Core Rule

Payouts should be self-funding:

`holder net payout = gross holder allocation - delivery costs`

CryptoSeeds should not subsidize weekly payouts from dev or treasury funds. If a holder's allocation is too small to clear delivery cost and the minimum net payout threshold, the allocation rolls forward.

## Weekly Snapshot Model

1. Collect platform fees into fee vaults.
2. Split the holder bucket from the staker and treasury buckets.
3. Take an RYP holder snapshot.
4. Exclude treasury, protocol vault, project-owner, charity, liquidity, and known system wallets where policy requires.
5. Calculate each eligible wallet's gross allocation.
6. Estimate delivery cost for each payout.
7. Pay only wallets whose net amount is worth delivering.
8. Roll small or dusty allocations forward.

## Holder-Size Cadence

Small holders should not force dust-heavy weekly transfers.

Draft cadence model:

| Holder Tier | RYP Balance | Payout Cadence |
| --- | ---: | --- |
| Canopy | 100,000+ RYP | Weekly |
| Sprout | 20,000+ RYP | Weekly |
| Seed | 5,000+ RYP | Monthly |
| Small | 500+ RYP | Quarterly |
| Micro | below 500 RYP | Claim-only / roll forward |

This is a draft operations model, not a final public promise.

## Why This Works

The current RYP mint does not need to enforce raw transfer taxes for holder rewards to work.

CryptoSeeds-controlled platform fees can fund reward vaults. Holder snapshots decide who is eligible for the holder bucket. Weekly/monthly/quarterly payout jobs can distribute net rewards after delivery cost.

## Why Not Pay Everyone Every Week

Solana transactions have size and compute limits, and each payout still requires transaction handling. Paying tiny dust amounts weekly can waste the holder's allocation on delivery cost.

The correct behavior is:

- large holders clear weekly if net payout is meaningful,
- medium holders batch monthly,
- small holders batch quarterly,
- micro allocations roll forward or become claim-only.

## Accounting Invariant

Every epoch must balance:

`distributed net payouts + reserved delivery costs + rolled-forward allocations = holder reward pool`

This makes the system auditable and prevents silent treasury leakage.
