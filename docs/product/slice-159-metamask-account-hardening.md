# Slice 159: MetaMask Account Hardening

## Scope

This slice hardens the MetaMask/EVM route before public testnet review.

## Changes

- Added runtime normalization for injected EVM account responses.
- Ignored malformed, short, non-string, or non-hex EVM account values.
- Prevented compact wallet formatting from displaying invalid addresses.
- Added tests for EVM address shape and injected account normalization.

## Safety Position

The MetaMask route remains an EVM identity and future cross-chain route. It does not control Solana RYP staking, does not request private keys, and does not enable transaction broadcast.

## Verification

- EVM wallet tests
- Full app regression before push
