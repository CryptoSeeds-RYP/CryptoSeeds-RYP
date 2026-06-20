# Slice 116: Receipt Lifecycle Hardening

## Purpose

Golden Key and Voting Rights are now represented by stronger on-chain receipt state inside `StakePosition`.

This is not full NFT minting yet. It is the auditable protocol layer that future non-transferable NFT metadata can mirror.

## Added

- Golden Key issue timestamp.
- Golden Key revoke timestamp when the wallet fully unstakes.
- Voting Rights activation timestamp.
- Voting Rights receipt level.
- Level 1 when voting rights activate after the staking delay.
- Level 2 after 100 successful votes.
- `GoldenKeyReceiptUpdated` event.
- `VotingRightsLevelUpdated` event.
- Localnet smoke assertions for Golden Key issue/revoke lifecycle.
- Account layout sync for the expanded `StakePosition`.

## Rules

- Golden Key is active while the wallet has non-zero stake.
- Full unstake deactivates Golden Key and Voting Rights receipt state.
- Voting Rights remain one-wallet-one-vote; receipt level does not change voting weight.
- Vote count can still support future achievement history, while active receipt state resets on full unstake.

## Not Added

- No NFT minting.
- No dynamic metadata updates.
- No token-weighted voting.
- No extra voting power for level 2.

## Verification

- `npm.cmd run protocol:check:win`
- `npm.cmd run protocol:test:win`
- `npm.cmd run protocol:build:wsl`
- `npm.cmd run protocol:idl:check`
- `npm.cmd run protocol:smoke:localnet:wsl`
