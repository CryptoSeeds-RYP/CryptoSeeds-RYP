# Slice 176: Admin Mission Phase Alignment

## Summary

Aligned Admin Mission Control with the terminal mission deployment sequence.

## Changes

- Pointed the Admin devnet funding phase at the read-only funding packet.
- Moved the Admin devnet protocol phase to `REVIEW_REQUIRED` once mint and program are ready but protocol accounts are not decoded.
- Pointed that protocol phase at the reviewed `devnet:init:protocol` planning command.
- Added regression coverage for the funding command and protocol-initialization phase state.

## Safety Notes

- The Admin Dashboard remains proposal/read-only oriented.
- This slice changes phase state and command guidance only.
- It does not execute funding, mint creation, deployment, protocol initialization, or wallet broadcast.
