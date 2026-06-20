# Slice 141 RYP Platform Transfer Route

Date: 2026-06-20

This slice adds a wallet-approved RYP transfer path that applies the CryptoSeeds 1% platform-fee target without pretending the existing SPL mint can enforce a global transfer tax.

## Added

- `transfer_ryp_with_platform_fee` Anchor instruction.
- `RypTransferWithPlatformFee` protocol event.
- Shared arithmetic helper for quoting fee and net transfer amounts.
- Frontend transaction planner support through `buildTransferRypWithPlatformFeeTransactionPlan`.
- IDL drift coverage for the new instruction account order, discriminator, and argument list.

## Behavior

The owner signs one protocol instruction with a gross RYP amount.

The protocol:

- calculates the fee as `gross_amount * 100 / 10000`,
- rejects amounts that produce a zero fee,
- transfers the net amount to the recipient RYP token account,
- splits the fee by the reviewed reward config,
- routes fee buckets to holder, staker, and independent treasury vaults,
- updates `RewardConfig.total_routed_fee_amount`,
- updates each destination `RewardVaultState.total_funded_amount`.

## Safety Boundaries

- This is an opt-in CryptoSeeds-routed transfer path, not a global mutation of the existing SPL token.
- The owner wallet must sign.
- The owner source token account must be owned by the signing wallet.
- The recipient token account must use the configured RYP mint.
- Holder and staker fee vaults must be verified and program-controlled.
- The treasury destination must match the verified independent treasury vault state.
- No backend custody, delegated signing, or automatic broadcast was added.

## Verification

- Rust unit tests cover the 1% fee quote, net transfer amount, tiny-transfer floor, and overflow boundary.
- `protocol:test:wsl` passes with `51` Rust tests.
- `protocol:build:wsl` builds the Anchor program and IDL.
- `protocol:idl:check` passes with `42` frontend instruction plans and `14` account layouts.
- `protocol:smoke:localnet:wsl` covers live localnet recipient net transfer and holder/staker/treasury fee-vault accounting.
- `src/solana/protocolTransactionPlan.test.ts` covers the frontend transaction planner and tiny-transfer rejection.
