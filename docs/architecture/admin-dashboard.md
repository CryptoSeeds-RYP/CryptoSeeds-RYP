# Admin Dashboard Architecture

The Admin Dashboard is a testing and operations surface for project configuration, disclosure management, treasury labels, visual tuning, and safety proposals.

## MVP Rule

The dashboard may unlock from a configured testing authority wallet or the independent treasury owner wallet, but it must remain proposal-only in the MVP.

Required gates:

- At least one operator wallet must be configured through `VITE_ADMIN_AUTHORITY_ADDRESS` or `VITE_INDEPENDENT_TREASURY_ADDRESS`.
- Connected wallet must match the configured admin authority or independent treasury owner.
- Cluster must not be `mainnet-beta`.
- Protocol deployment must not be `mainnet-beta`.
- Admin actions cannot execute live from the UI.
- Mainnet admin actions remain blocked until final launch review.
- Public testnet readiness still requires `VITE_ADMIN_AUTHORITY_ADDRESS` even if the treasury owner can open the operator cockpit.

The independent treasury owner route is an operator-dashboard unlock for testing and review. It does not change protocol signing authority, does not move funds, and does not enable live execution. Protocol transaction previews still require a configured admin authority before signing review.

## Why Not A God Wallet Forever

A single authority wallet cannot be spoofed cryptographically if the program checks signer status and the public key. The real risk is operational compromise:

- signing a malicious admin transaction,
- using a fake admin page,
- compromised browser or device,
- compromised frontend build,
- leaked seed phrase/private key,
- compromised program upgrade authority.

The MVP god-wallet route is acceptable for localnet/devnet testing only. Production should migrate to self-owned multisig or another threshold authority model.

## Admin Modules

| Module | MVP Status | Notes |
| --- | --- | --- |
| Project registry | Draft only | Project text, docs, receiving accounts, disclosure notes |
| Charity accounts | Draft only | Donation-only account separation |
| Treasury labels | Draft only | Public labels and reporting cadence |
| Fee split policy | Review gated | 1% RYP transfer-fee route plus holder/staker/treasury/dev split proposals |
| Reward epochs | Draft only | Holder snapshot, reward vault, rollover, and delivery-cost review packets |
| Homestead config | Local/dev preview | Cosmetic and UI tuning only |
| SeedBot config | Review gated | Strategy/venue/performance copy and permission gates |
| Emergency pause | Devnet-ready previews | Global policy plus scoped module pause/recovery previews |
| Program authority | Blocked | No production authority transfer from this dashboard |

## Read-Only Protocol Inspection

The dashboard includes read-only inspectors for deployment and audit checks:

- protocol config PDA, RYP mint, staking vault, base fee, tier thresholds, global pause state, scoped module pause flags, and authorities,
- connected/admin wallet stake position, Golden Key state, voting-rights state, and vote count,
- configured governance proposal plus the connected wallet's vote record,
- configured project record plus the connected wallet's project participation record,
- reward config, reward vault states, and reward epoch preview.

Inspection target IDs are configured by environment:

- `VITE_REWARD_INSPECTION_EPOCH_ID`
- `VITE_GOVERNANCE_INSPECTION_PROPOSAL_ID`
- `VITE_PROJECT_INSPECTION_ID`

These inspectors must stay read-only. Missing optional wallet/project/proposal accounts are warnings; decoded unsafe state, mismatched PDA ownership, non-record-only project funding, blank metadata/disclosure hashes, invalid windows, and mismatched vote/participation records are blockers.

## Production Direction

Later production design should use:

- protocol authority separate from treasury,
- treasury authority separate from project registry,
- emergency guardian with limited pause rights,
- self-owned multisig or home-server signer setup,
- timelock for non-emergency changes,
- public logs for all material changes.

Fee edits should be drafted as review packets, not executed directly. The dashboard can preview:

- 1% RYP transfer-fee policy,
- 3.5% platform/action fee before tier reductions,
- holder/staker/independent-treasury distribution buckets,
- scoped module pause and recovery instructions for staking, governance, projects, SeedBot, and fee routing,
- public testnet readiness gates that summarize environment, admin access, protocol inspection, module pause state, reward inspection, and broadcast boundary status,
- SeedBot success-fee preview as review-gated and disabled for live use.
