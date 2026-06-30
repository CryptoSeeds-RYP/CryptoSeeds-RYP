# Slice 187 - Localnet Smoke Runbook

## Scope

This slice makes the operations runbook match the mission verification gate for protocol-facing changes.

## Changes

- Added a monitor-only `protocol-localnet-smoke-gate` runbook item.
- The runbook item points to `npm.cmd run protocol:smoke:localnet:wsl`.
- Added tests that keep the smoke gate non-approval, monitor-only, and separate from devnet deployment approval.
- Updated the operations architecture table.

## Safety

The localnet smoke gate uses a disposable local validator. It does not deploy to devnet, approve launch, broadcast wallet transactions, or mutate mainnet state.
