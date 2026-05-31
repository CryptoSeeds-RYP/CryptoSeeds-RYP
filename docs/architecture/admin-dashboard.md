# Admin Dashboard Architecture

The Admin Dashboard is a testing and operations surface for project configuration, disclosure management, treasury labels, visual tuning, and safety proposals.

## MVP Rule

The dashboard may unlock from a configured testing authority wallet, but it must remain proposal-only in the MVP.

Required gates:

- `VITE_ADMIN_AUTHORITY_ADDRESS` must be configured.
- Connected wallet must match that address.
- Cluster must not be `mainnet-beta`.
- Protocol deployment must not be `mainnet-beta`.
- Admin actions cannot execute live from the UI.
- Mainnet admin actions remain blocked until final launch review.

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
| Emergency pause | Devnet-ready concept | Testnet/devnet only until authority policy is approved |
| Program authority | Blocked | No production authority transfer from this dashboard |

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
- SeedBot success-fee preview as review-gated and disabled for live use.
