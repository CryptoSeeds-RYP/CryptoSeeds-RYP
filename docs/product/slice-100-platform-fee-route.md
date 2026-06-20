# Slice 100 Platform Fee Route

Date: 2026-06-20

This slice adds the first on-chain value-loop funding path for CryptoSeeds platform fees.

## Added

- `route_platform_fee` Anchor instruction.
- `RewardConfig.total_routed_fee_amount`.
- `RewardVaultState.total_funded_amount`.
- Frontend transaction planner support through `buildRoutePlatformFeeTransactionPlan`.
- Localnet smoke coverage for signer-approved RYP fee routing.

## Behavior

The payer signs a RYP transfer from their own token account. The protocol splits the provided fee amount by the reviewed reward config:

- holder reward vault,
- staker reward vault,
- independent treasury vault.

Holder and staker amounts are rounded down. Any remainder stays in the treasury bucket so the routed totals always equal the signer-approved fee amount.

## Safety Boundaries

- The instruction does not enforce a global transfer tax on the existing SPL token.
- The payer source token account must be owned by the signing payer.
- Holder and staker destination vaults must be verified and program-controlled.
- Treasury destination must match the verified independent treasury vault state.
- Reward-vault and reward-config funded totals are tracked on-chain.
- No hidden custody, backend signing, or automatic broadcast was added.

## Verification

- Rust unit tests cover route split and custody constraints.
- `protocol:idl:check` covers 25 frontend instruction plans and 11 account layouts.
- `protocol:smoke:localnet:wsl` routes 30,000 base units into holder `10,002`, staker `9,999`, and treasury `9,999` buckets on a local validator.
