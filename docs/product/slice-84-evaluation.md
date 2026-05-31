# Slice 84 Evaluation - Reward Account Discriminator Guard

## Goal

Harden the read-only frontend reward account decoders so they cannot silently decode the wrong Anchor account type.

## Completed

- Added a frontend account layout manifest for reward config, vault state, and reward epoch accounts.
- Added Anchor account discriminator checks before decoding reward account fields.
- Updated reward account tests to write valid discriminators into fixtures.
- Added a negative test for wrong-discriminator rejection.
- Expanded the IDL drift check to validate reward account discriminators, field order, offsets, sizes, and minimum lengths.

## Safety Posture

- No executable reward controls were added.
- No transaction builder was added.
- The Admin Dashboard remains read-only for reward accounts.
- Layout drift now fails the protocol IDL check before deployment review.

## Next Step

Use the layout manifest in a localnet-backed Admin smoke flow that initializes reward accounts, reads them through RPC, and verifies the UI shows decoded reward state.
