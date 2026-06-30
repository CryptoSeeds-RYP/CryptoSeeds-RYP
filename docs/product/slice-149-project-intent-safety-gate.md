# Slice 149: Project Intent Safety Gate

## Scope

This slice hardens project participation previews against caller bypass.

## Changes

- `buildProjectParticipationIntent` now runs project-level eligibility checks before creating a wallet-ready preview.
- Projects with unsafe status, closed participation, incomplete governance, missing receiving account disclosure, unapproved risk disclosure, invalid required documents, rejected operators, charity/account mismatch, or required legal review now produce a `BLOCKED` preview.
- Blocked project previews stay `PREVIEW_ONLY`, keep wallet signature blocked in the transaction lifecycle, and do not mark risk acknowledgement as accepted.
- Added transaction-intent regression coverage for a governance/disclosure-blocked project.

## Why

The Explorer UI already prevented invalid project participation, but the transaction-intent layer still assumed callers had performed that check. Wallet-facing builders should fail closed independently so future admin tools, API adapters, or AI agents cannot accidentally prepare a wallet-ready project preview from unsafe project metadata.

## Verification

- Focused transaction, project registry, and participation tests passed.
- Full Vitest suite passed.
- Production app build passed.
- Copy guardrail audit passed.
- Visual asset audit passed.
- Ops readiness check passed.
- `npm audit --audit-level=moderate` found 0 vulnerabilities.
- `git diff --check` passed.
