# Slice 173: Funding Packet Deployment Sequence

## Summary

Aligned the read-only devnet funding packet with the current staged deployment lane.

## Changes

- Replaced older post-funding shortcut commands with the explicit mission sequence:
  - check authority funding,
  - inspect devnet status,
  - ask the next-action recommender,
  - create the devnet RYP test mint,
  - deploy the program and print the initialization plan,
  - review protocol initialization,
  - execute protocol initialization after review,
  - run read-only testnet readiness,
  - prepare the deployment receipt.
- Made the funding packet use the selected env source in every generated command.
- Updated funding packet tests to reject the old `--mint` and `--execute-init` bootstrap shortcuts in the handoff.
- Simplified devnet deployment docs to show one primary mint and initialization path.

## Safety Notes

- The funding packet remains read-only.
- It does not request airdrops, create a mint, deploy a program, initialize protocol accounts, or broadcast wallet transactions.
- Devnet mutation commands are listed only as post-funding operator steps requiring separate execution and review.
