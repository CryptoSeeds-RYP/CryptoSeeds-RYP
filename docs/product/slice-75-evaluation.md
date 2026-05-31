# Slice 75 Evaluation: Project Owner and Charity Disclosure Fields

## Goal

Make project discovery more proper and audit-friendly by adding explicit receiving-account and disclosure metadata to every project listing.

## Added

- Project receiving-account type:
  - account label,
  - chain,
  - address or inactive status,
  - account type,
  - custody model,
  - verification status,
  - user-funds flag,
  - notes.
- Project disclosure type:
  - project-owner token holding disclosure,
  - founder/operator conflict flag,
  - treasury independence,
  - charity separation,
  - legal-review gate,
  - conflict notes.
- Registry checks for disclosure warnings and blocking issues.
- Explorer Account Disclosure section for selected projects.
- Tests covering project-owner wallet disclosures and separated charity account handling.

## Product Call

This reinforces the platform model:

- users keep their own assets,
- project owners and charities use disclosed receiving wallets/contracts,
- donation flows stay separated,
- treasury independence is explicit,
- legal-review gates remain visible before public participation.

## Next Best Step

Mirror the disclosure model into a protocol/indexer-facing spec:

- project registry account/hash design,
- document hash anchoring,
- receiving-account verification events,
- and admin/governance flows for approving or rejecting project listings.
