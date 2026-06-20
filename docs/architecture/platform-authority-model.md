# Platform Authority Model

CryptoSeeds should operate as a self-custodial platform and interface layer. Users keep their assets in their own wallets. Project owners, operators, and charities should use disclosed receiving wallets or contracts. The CryptoSeeds treasury should be independent from founder, operator, project-owner, charity, and user wallets.

## Boundaries

| Boundary | Target Posture |
| --- | --- |
| User assets | User wallets only; no platform custody |
| Project-owner funds | Disclosed project-owner wallets or contracts |
| Charity flows | Separate donation wallets/contracts with no financial-return promise |
| Treasury | Independent wallets, public labels, reporting cadence |
| Platform fees | Transparent preview before wallet approval |
| Founder/project-owner token holdings | Disclosed allocation, lockup/vesting expectations, conflict notes |

## Authority Controls

| Control | MVP State | Target Control |
| --- | --- | --- |
| Emergency pause | Localnet admin authority | Multisig authority with public incident log |
| Fee parameters | Configurable | Multisig plus timelock before non-emergency changes |
| Project registry | Separate project authority | Operator disclosure, document hashes, risk labels, governance approval |
| Project operator delegation | Project-scoped operator records | Permission-scoped, revocable operators with public disclosure |
| Project pause/cancellation/refund accounting | Separate project authority; limited pause/status operator records | Multisig plus incident log before public use |
| Treasury wallets | Disclosure required | Independent multisig wallets with labels and reporting cadence |
| SeedBot permissions | Disabled | Revocable permission registry before guarded automation |

No authority control should custody user funds. Any authority that can affect user rights, fee parameters, project visibility, or automation permissions should emit logs and have a public policy before launch.

Protocol, project, and reward authority rotation is two-step on-chain:

1. Current authority nominates a pending authority.
2. Pending authority signs an accept instruction.
3. The program clears the pending authority after acceptance.

`ProtocolConfig` stores a separate project authority and pending project authority. Project registry, project lifecycle updates, project pause, project cancellation, and project refund accounting use this project authority instead of the main protocol authority.

Project operator records are derived per project and operator wallet. The project authority can grant or revoke limited permissions such as status updates or participation pause toggles. Operator grants are time-bounded and must be renewed deliberately. Operators cannot move funds, alter treasury/reward routing, change fee parameters, cancel projects, record refund accounting, or take over project authority.

`RewardConfig` has its own pending authority field so reward administration can be rotated deliberately after the protocol authority accepts. This avoids a silent one-step authority swap and reduces accidental lockout risk.

## Project Listing Disclosure Minimum

Every listed project should carry:

- project-owner/operator name,
- operator jurisdiction when available,
- operator verification status,
- receiving account label,
- receiving account chain,
- receiving account address or explicit inactive status,
- receiving account custody model,
- receiving account verification status,
- whether the receiving account may receive user funds,
- project-owner token holding disclosure status,
- founder/operator conflict flag,
- treasury independence flag,
- charity separation flag,
- legal-review gate flag,
- conflict notes,
- required documents and risk disclosure version.

Donation listings must use separated charity-controlled accounts and must not be mixed with reward-bearing or participation-based project accounts.

## Fee Memory

- RYP token-transfer fee target: 100 bps / 1%.
- Token-transfer split buckets: holders, stakers, independent treasury.
- Base platform/action fee: 350 bps.
- Tier effective fees:
  - Seed: 350 bps.
  - Sprout: 315 bps.
  - Sapling: 280 bps.
  - Tree: 245 bps.
  - Fruit: 210 bps.
- Platform/action split buckets: holders, stakers, independent treasury.
- Exact split percentages: configurable and not final.
- Full token-transfer-level enforcement requires a reviewed wrapper, migration, or token-extension route; app-controlled actions can preview and route the fee earlier.
- SeedBot success-fee preview: 1200 bps on realized positive strategy PnL only, split 40% dev / 60% treasury, disabled for live use pending review.

## Review Gates

The following stay disabled, design-only, or disclosure-gated until reviewed:

- SeedBot success fees.
- Guarded automation.
- Project financial rights.
- Tokenized SPV/equity/debt/revenue mechanics.
- Founder, operator, advisor, treasury, and community token allocation disclosures.
- Fiat on/off ramps.
- Leverage, perps, margin, copy trading, or strategy marketplace features.
