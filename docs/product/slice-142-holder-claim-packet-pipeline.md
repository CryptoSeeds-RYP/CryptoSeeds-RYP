# Slice 142 Holder Claim Packet Pipeline

Date: 2026-06-20

This slice reduces holder reward operations from a manual two-command flow to one proof-only command.

## Added

- `scripts/prepare-holder-reward-claim-packet.mjs`.
- Package script `rewards:holder-claim-packet`.
- Ops readiness coverage for the new script.
- CLI regression tests for valid packet export, duplicate holder rejection, and missing epoch id usage.

## Behavior

The operator supplies raw holder reward epoch input and an on-chain epoch id:

```bash
npm run rewards:holder-claim-packet -- docs/operations/holder-reward-epoch.example.json 7
```

The pipeline:

- runs the holder reward draft builder,
- preserves all snapshot, anti-dust, cadence, vault, duplicate-wallet, and accounting validation,
- writes the draft to a temporary local file,
- runs the Merkle proof exporter,
- verifies the final proof packet,
- emits one review packet containing the draft, claim packet, and `claimMerkleRoot`.

## Safety Boundaries

- The pipeline is proof-only.
- It does not sign transactions.
- It does not broadcast.
- It does not create claim records.
- It does not transfer reward tokens.
- If the draft or Merkle packet is invalid, the pipeline emits or reports a blocked result and exits nonzero.

## Verification

- `src/ops/prepareHolderRewardClaimPacketCli.test.ts` covers the new command.
- The example command emits `holder-reward-claim-packet/v1` with `status: READY_FOR_REVIEW`.
- The example command reproduces claim Merkle root `dc13a773e38d5864d2cc6fd9a8d5d1d39111c0286e94fb6ce1a3ea6cfdcde34d`.
