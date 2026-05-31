# Decentralization and Self-Custody Architecture

This document is not legal advice. It defines the CryptoSeeds build posture for reducing custody, intermediary, and discretionary-control risk while preserving a useful Web3/DeFi product.

## North Star

CryptoSeeds should be as self-custodial and decentralized as practical:

- Users hold their own wallets.
- Users approve every transaction or explicitly grant narrow, revocable permissions.
- CryptoSeeds does not hold seed phrases, private keys, or unrestricted user funds.
- Protocol rules are transparent, deterministic, and auditable.
- Off-chain services provide data, documents, analytics, and indexing, not custody.
- Admin powers are minimized, publicly documented, and protected by multisig/timelock controls where possible.

Self-custody is a risk-reduction design principle. It is not a promise that no financial-services, securities, commodities, money-transmission, adviser, promotions, tax, gambling, or consumer-protection rules apply.

## Product Positioning

Use product language that describes utility and user control.

Preferred:

- Self-custodial execution
- User-directed strategy tools
- Wallet-approved transactions
- Protocol-based access
- RYP utility access
- Project participation
- Market signals
- Historical performance data
- Transparent fee preview
- Revocable permissions

Do not say:

- Regulation-free
- Bypasses regulation
- Avoids financial-services rules
- No legal risk
- Guaranteed compliant
- Self-custody solves compliance
- Guaranteed profit
- Risk-free strategy

## Architecture Boundaries

| Area | Safer Build Direction | Blocked Until Review |
| --- | --- | --- |
| Wallets | Phantom, MetaMask, Solflare, Backpack, Wallet Standard | Backend-created or backend-controlled wallets |
| Staking | User signs stake and unstake transactions | Hidden staking, pooled custody, guaranteed yield claims |
| Rewards | Transparent claimable protocol rewards and updates | Fixed-return promises or real-world revenue rights |
| Projects | Risk-labeled participation records and project updates | Tokenized equity, debt, SPV ownership, or revenue entitlement |
| SeedBot | Signals, watchlists, paper trading, wallet-approved route previews | Discretionary account management or unlimited automation |
| Fees | Transparent protocol/tool fees | Profit-based or performance-based live fees before review |
| Governance | Non-transferable voting identity, one wallet one vote | Governance that can secretly change user rights |
| Admin | Multisig, timelock, event logs, pause policy | Undocumented unilateral fund movement |

## SeedBot-Specific Rule

The SeedBot Terminal can be public as a self-custodial interface only if it stays user-directed:

- Signal-only first.
- Paper trading and simulations before live trading.
- Wallet-approved transactions before any automation.
- Guarded automation only after security and legal review.
- No private keys, seed phrases, backend wallets, or withdrawal actions.
- Objective route parameters and venue limitations must be visible.
- Past performance must be shown as historical data only.
- Any success-fee or profit-fee model is a review-gated preview until approved for the relevant jurisdictions.

## Decentralization Roadmap

1. Keep the app non-custodial by design.
2. Keep broadcast disabled until environment, program id, cluster, and review gates pass.
3. Use protocol accounts for staking, tier, voting, and reward state.
4. Add event logs for every material state transition.
5. Move project registry hashes and disclosures on-chain where practical.
6. Put admin authority behind multisig.
7. Add timelocks for non-emergency parameter changes.
8. Publish fee, reward, and upgrade policies.
9. Add a permission registry before guarded automation exists.
10. Support revoke and emergency disable flows before live strategy execution.

## Reference Points

Official materials that informed this posture:

- SEC Staff Statement on self-custodial user interfaces, April 13, 2026: https://www.sec.gov/newsroom/speeches-statements/staff-statement-regarding-broker-dealer-registration-certain-user-interfaces-utilized-prepare-staff-statement-regarding-broker-dealer-registration-certain-user-interfaces-utilized
- SEC crypto asset interpretive release, March 17, 2026: https://www.sec.gov/rule-release/33-11412
- FinCEN virtual currency guidance on users, exchangers, administrators, and money transmission: https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-persons-administering
- CFTC/SEC investor alert on crypto trading websites and guaranteed-return claims: https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/watch_out_for_digital_fraud.html
