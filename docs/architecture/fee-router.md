# Fee Router and RYP Transfer Fee

CryptoSeeds has two separate fee surfaces:

1. RYP token-transfer fee.
2. CryptoSeeds platform/action fee.

Keeping these separate avoids confusing token movement with protocol actions.

## RYP Transfer Fee

Target transfer fee:

`100 bps` / `1%`

Split model:

- holders
- stakers
- independent treasury

The exact percentage split between those buckets is configurable and not final. The current code models a draft equal split only for local preview and testing.

This fee is intended to add RYP utility and fund holder/staker/treasury distribution mechanics without changing the fixed-supply mint assumptions.

## Platform Action Fee

Current platform/action base fee:

`350 bps` / `3.5%`

This applies to CryptoSeeds-controlled protocol actions, not arbitrary wallet transfers.

Tier reductions:

| Tier | Effective Fee |
| --- | ---: |
| Seed | 3.50% |
| Sprout | 3.15% |
| Sapling | 2.80% |
| Tree | 2.45% |
| Fruit | 2.10% |

The platform/action fee uses the same holder, staker, and independent treasury bucket model.

## Solana Enforcement Options

CryptoSeeds can preview and route fees for app-controlled actions first. Enforcing a fee on every raw wallet-to-wallet RYP transfer is a different Solana token-design problem.

Current RYP mint owner program:

`TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA`

That is the legacy SPL Token program, so the existing mint should be treated as fixed and not silently upgradable into a transfer-fee mint.

The official Solana Token Extensions documentation describes `TransferFeeConfig` as a mint extension that applies a fee to transfers for that mint. The same docs note that token extensions are configured as optional mint/account extensions, and most extensions cannot be added after account initialization.

References:

- [Solana Transfer Fees](https://solana.com/docs/tokens/extensions/transfer-fees)
- [Solana Token Extensions](https://solana.com/docs/tokens/extensions/)

Practical routes:

| Route | Description | CTO View |
| --- | --- | --- |
| App-controlled fee route | Charge and disclose the 1% fee only inside CryptoSeeds-controlled protocol actions. | Best for MVP. |
| Program-controlled project/staking route | Protocol instructions collect and distribute fees during staking, project participation, and claim flows. | Strong next step. |
| Token-2022 migration | Create a reviewed Token-2022 route with transfer-fee extension support. | Powerful but compatibility-sensitive. |
| Wrapper token route | Existing RYP is deposited into a wrapper that enforces transfer rules. | Useful bridge, but needs clear redemption and liquidity design. |

## Distribution Rules

The fee router must:

- quote gross amount, fee amount, and net amount before signing,
- keep holder, staker, and treasury buckets visible,
- validate that configured split shares total 10,000 bps,
- allocate rounding remainder deterministically,
- support net-of-cost holder payouts where delivery costs are deducted from each holder's allocation,
- roll dusty allocations forward into monthly, quarterly, or claim-only windows,
- emit events for indexers,
- avoid hidden custody or hidden fee movement,
- keep SeedBot success-fee logic separate and review-gated.

## Open Decisions

- Final holder/staker/treasury split percentages.
- Whether staking deposits and withdrawals should be exempt, charged, or handled through explicit protocol fee instructions.
- Whether the project keeps the current mint only, adds a wrapper, or later pursues a Token-2022 migration.
- Whether fee distributions are claimable continuously, epoch-based, or batched for cost efficiency.
