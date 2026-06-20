# Slice 104 Two-Step Authority Transfer

Date: 2026-06-20

This slice hardens protocol and reward authority rotation.

## Added

- `ProtocolConfig.pending_authority`
- `RewardConfig.pending_authority`
- `accept_protocol_authority`
- `transfer_reward_authority`
- `accept_reward_authority`

## Changed

`transfer_protocol_authority` now nominates a pending authority instead of immediately replacing the active authority.

The pending authority must sign `accept_protocol_authority` before the active protocol authority changes.

Reward authority rotation is separate:

1. Current reward authority nominates the new reward authority.
2. New protocol authority accepts protocol authority.
3. New reward authority accepts reward authority.

`accept_reward_authority` requires the signer to already be the protocol authority, which prevents reward administration from drifting away from protocol control during rotation.

## Safety Boundary

This does not introduce multisig by itself. It gives the current single-authority devnet model a safer rotation path and prepares the program for later multisig/timelock authority ownership.
