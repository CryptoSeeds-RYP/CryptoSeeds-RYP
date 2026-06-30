# Slice 172: Mission CLI Deployment Sequencing

## Summary

Aligned `npm run mission:status` with the Admin Dashboard deployment sequencing.

## Changes

- Replaced the single broad devnet deployment phase with separate mission phases:
  - Fund Devnet Authority,
  - Create Devnet Test Mint,
  - Deploy Devnet Program,
  - Initialize Devnet Protocol.
- Phase status now follows the recommender result:
  - `fund_devnet_authority`,
  - `create_devnet_test_mint`,
  - `deploy_program_and_plan_init`,
  - `plan_protocol_initialization`,
  - readiness/receipt review states.
- Updated mission CLI tests for the funding, mint, program, and protocol steps.
- Scoped each phase command to its own deployment step so a global next-action recommendation cannot appear under the wrong phase label.
- Updated setup docs to document the shared terminal/Admin sequencing.

## Safety Notes

- The command remains read-only.
- It does not create a mint, deploy a program, initialize protocol accounts, broadcast wallet transactions, or create local keypairs.
- Mutation-risk steps remain printed as explicit commands requiring separate review.

## Current Expected State

With the authority still unfunded, `mission:status` should show:

- `fund_devnet_authority`: `BLOCKED`,
- `create_devnet_test_mint`: `WAITING_ON_DEVNET`,
- `deploy_devnet_program`: `WAITING_ON_DEVNET`,
- `initialize_devnet_protocol`: `WAITING_ON_DEVNET`.
