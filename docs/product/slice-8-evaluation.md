# Slice 8 Evaluation - Anchor Staking Account Design and Protocol Hardening

## Built

- Added the Anchor staking account design document.
- Confirmed the Rust program already contains config initialization, RYP vault setup, staking, unstaking, pause controls, and voting-right activation.
- Added `voting_rights_eligible_ts` to the stake position model.
- Fixed the staking-cycle rule so restaking after a full unstake resets the 14-day Voting Rights timer.
- Fixed staking behavior so adding more RYP to an existing stake does not wipe already-active voting rights.
- Added signer/owner validation for existing stake positions.
- Added `StakeDeposited` and `StakeWithdrawn` events with tier transition data.
- Expanded `StakeUpdated` with Golden Key and Voting Rights state.
- Added `VotingRightsAlreadyActive` error.
- Installed the Rustfmt component and formatted the protocol program.
- Updated `Anchor.toml` so the test script does not call a missing npm script.

## Verification

- `cargo fmt -- --check` passes for `programs/cryptoseeds_protocol`.
- `cargo metadata --format-version 1 --no-deps` succeeds.
- `npm run build` passes.
- `npm audit --audit-level=moderate` reports 0 vulnerabilities.
- `npm run token:check` confirms the live RYP mint remains fixed and non-mintable.
- Local dev server responds at `http://127.0.0.1:5173`.
- Secret-shaped string scan found no Discord bot token, private key, seed phrase, or mnemonic patterns in the repo.

## Toolchain Blocker

`cargo check` cannot complete on this Windows environment because the MSVC linker is not installed:

```text
linker `link.exe` not found
```

This blocks full Rust compilation until Visual C++ Build Tools or WSL/Solana tooling is installed. The blocker is environmental, not an application-level test failure.

## Remaining Risks

- The Anchor program has not been fully compiled because of the local linker blocker.
- The program id is still a placeholder.
- Golden Key and Voting Rights are still state flags, not final non-transferable NFTs.
- Reward accrual, project pools, governance proposals, and SeedBot permissions are intentionally deferred.

## Recommended Next Slice

Prepare deployment-grade protocol work:

- Decide WSL versus native Visual C++ Build Tools.
- Install Solana/Agave CLI and Anchor/AVM.
- Generate a real program keypair.
- Replace the placeholder program id in `Anchor.toml`, `declare_id!`, and frontend env.
- Add Anchor tests for stake, unstake, restake timer reset, voting activation, pause, and invalid thresholds.

