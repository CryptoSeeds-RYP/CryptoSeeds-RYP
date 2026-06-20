# Slice 132: Unstake Preview UI

## Purpose

Expose the unstake remainder guard in the app so users can prepare a safe unstake preview from the Protocol State panel.

## Implemented

- Added a compact unstake amount input to the Protocol State panel.
- Wired the control into the existing Transaction Preview panel.
- The preview uses the current staked amount from protocol snapshot state.
- Invalid below-Seed partial unstakes produce a blocked preview instead of a wallet-signable transaction plan.
- Full exits and partial unstakes that leave at least Seed tier remain previewable.

## Boundaries

- This is still preview-first; no transaction is broadcast automatically.
- The Anchor program remains the final enforcement layer.
- Live stake-position reads depend on the existing protocol snapshot/inspection path.

## Deferred

- Add a dedicated stake/unstake view with slider presets.
- Pull live stake amount directly from decoded stake-position accounts when devnet state is initialized.
- Add rendered visual QA for the protocol side panel once the next UI batch is ready.
