# Slice 167: Devnet Next-Action Test Coverage

## Scope

This slice makes the devnet next-action recommender safer to maintain by separating its decision logic from CLI execution and covering the deployment sequence with tests.

## Changes

- Exported the recommender decision function without running the CLI on import.
- Kept the existing `npm run devnet:next` CLI behavior unchanged.
- Added scenario tests for reward-vault keypair prep, authority funding, test mint creation, program deployment, protocol initialization planning, read-only readiness, and deployment receipt preparation.

## Safety Position

The recommender remains read-only at runtime. Tests call pure decision logic and do not perform RPC calls, create keypairs, deploy programs, initialize protocol state, sign transactions, or enable frontend broadcast.

## Verification

- Recommender scenario tests
- `devnet:next` local run
- Full app regression before push
