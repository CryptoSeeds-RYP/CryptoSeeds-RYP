# Slice 169: Admin Mission Control

## Summary

Surfaced the RYP execution plan inside the Admin Dashboard so operators can see mission phase status without relying only on terminal output.

## Changes

- Added `buildAdminMissionControl` to the admin domain model.
- Mapped the current RYP mission into dashboard phases:
  - Rust safety,
  - ABI lock,
  - local verification,
  - devnet funding/bootstrap,
  - devnet protocol,
  - frontend read-only state,
  - fees and holder rewards,
  - projects and SeedBot,
  - public product layer,
  - wallet execution.
- Added Admin Dashboard mission cards with counts for local, review, devnet, and blocked phases.
- Added compact next-action and blocker visibility.
- Added tests for current devnet-blocked state and decoded-devnet review state.

## Safety Notes

- The new dashboard section is read-only.
- It does not execute terminal commands, broadcast transactions, initialize protocol accounts, or enable wallet execution.
- Wallet execution remains review-required after read-only devnet readiness.

## Current Expected State

Until the devnet authority is funded and protocol state is deployed/decoded, the Admin Dashboard should show mission work as waiting on devnet with the funding/bootstrap path as the next operating lane.
