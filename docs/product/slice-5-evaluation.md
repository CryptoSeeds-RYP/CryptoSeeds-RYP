# Slice 5 Evaluation - Project Detail and Risk Review Flow

## Built

- Expanded the project model with operator, update cadence, risk disclosure, participation terms, and impact metrics.
- Added a selected-project review surface below the Explorer's Map project grid.
- Added structured project metadata, documents, milestones, and impact metrics.
- Added an explicit risk acknowledgement checkbox before a project participation preview can be prepared.
- Split project selection from participation-intent preparation.
- Updated the transaction preview panel so it behaves as a non-signing preview until real wallet transactions are implemented.

## Current Behavior

- Selecting a project opens a full review surface without preparing an on-chain action.
- The transaction preview remains in review mode until the user acknowledges the project risk disclosure.
- Locked, closed, or ineligible projects cannot prepare a wallet preview.
- Donation projects clearly state that no financial return is expected.

## Verification

- `npm run build` passes.
- `npm audit --audit-level=moderate` reports 0 vulnerabilities.
- `npm run token:check` confirms the live RYP mint remains read-only with mint and freeze authority disabled.

## Remaining Risks

- Project documents are represented as labels only; the next implementation should model actual document URLs, hashes, versions, and approval timestamps.
- Participation previews are still local UI intents, not real Solana transactions.
- Risk acknowledgement is local UI state and does not yet persist to wallet, program, or backend records.

## Recommended Next Slice

Build the first real transaction-intent adapter layer:

- Structured project participation intent model
- Wallet/session-aware transaction preview
- Program id and account list display
- Risk acknowledgement persistence placeholder
- Mock transaction lifecycle states
- Clear split between preview, wallet signature, broadcast, and confirmation

