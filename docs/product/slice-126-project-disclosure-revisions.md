# Slice 126: Project Disclosure Revisions

## Purpose

Move project disclosure provenance on-chain so project participation can reference a reviewed disclosure packet instead of trusting an arbitrary off-chain hash.

## Implemented

- Added `ProjectDisclosureRevision` PDA derived from `project-disclosure-revision + project + revision_id`.
- Added `create_project_disclosure_revision` under separated project authority.
- Added current disclosure revision tracking to `ProjectRecord`.
- Added metadata, risk disclosure, and terms hashes to each revision record.
- Updated `participate_project` to require the current disclosure revision account.
- Updated participation validation so the acknowledged disclosure hash must match the current reviewed risk disclosure hash.
- Added TypeScript transaction planning, instruction specs, account layouts, tests, and localnet smoke coverage.

## Boundaries

- The revision account stores hashes only; source documents stay off-chain or in a future content-addressed storage layer.
- Creating a revision does not move funds.
- Participation still requires wallet approval, tier access, open project status, allocation limits, and the participation window.
- Project authority can publish revisions, but public launch should still require documented review policy and operational logging.

## Deferred

- Admin dashboard forms for revision creation.
- Indexed revision history views.
- Optional governance requirement before a revision can become current.
- Document storage integration.
