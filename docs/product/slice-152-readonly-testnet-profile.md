# Slice 152: Read-only Testnet Readiness Profile

## Scope

This slice separates read-only public devnet preview readiness from wallet-execution readiness.

## Changes

- Added `--profile read-only` to `scripts/check-public-testnet-readiness.mjs`.
- Kept `wallet-execution` as the default profile.
- The read-only profile checks:
  - ops readiness,
  - devnet status,
  - devnet program inspection,
  - devnet protocol state inspection.
- The wallet-execution profile also checks devnet broadcast readiness.
- The readiness report now includes the selected profile.
- Updated the operations runbook to include a read-only public testnet gate before the wallet-execution gate.
- Updated setup docs to document both profile commands.

## Safety Position

Read-only readiness must not imply signing or broadcast readiness. The read-only profile intentionally excludes the broadcast gate and returns `READY_FOR_READ_ONLY_TESTNET_PREVIEW` only for non-execution review. Wallet execution remains behind `--profile wallet-execution`, explicit broadcast review, and human approval.

## Verification

- Focused public testnet readiness CLI tests
- Operations model tests
- Full app regression and ops checks before push
