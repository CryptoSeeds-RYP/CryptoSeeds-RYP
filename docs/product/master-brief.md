# CryptoSeeds MicroVerse - Product, Protocol, and Engineering Brief

## Executive Summary

CryptoSeeds is a Solana-based Web3 and DeFi-style dApp ecosystem built around RYP, a fixed-supply token originally launched in 2020 with a maximum supply of 50,000,000 RYP and minting disabled.

The product is evolving into the CryptoSeeds MicroVerse: a premium, regenerative ecosystem layer where users can stake RYP, unlock a personal live dashboard, browse vetted project opportunities, participate through wallet-approved actions, vote in governance, receive ecosystem rewards, earn non-transferable NFT identity markers, and access self-custodial tools such as the SeedBot Terminal.

CryptoSeeds should feel like serious Web3 infrastructure wrapped in an immersive, strategy-game-inspired interface. It should be professional, accessible, transparent, and visually memorable.

## DApp Identity

CryptoSeeds is not just a website, brochure, or off-chain farming game. It should be designed as a full self-custodial Web3 dApp with DeFi modules and a MicroVerse interface layer.

Self-custody and decentralization are product constraints, not marketing shields. CryptoSeeds should reduce custody, intermediary, and discretionary-control risk through architecture, while avoiding any public claim that the project bypasses regulation or has no legal risk.

The production architecture should be wallet-first and on-chain-aware:

- Users connect self-custodial Solana wallets.
- RYP balances and staking state are read from token accounts and protocol accounts.
- Staking, unstaking, claims, voting, project participation, and swaps are wallet-approved actions.
- Protocol state drives the MicroVerse dashboard, farm visuals, project slots, rewards, NFTs, and governance access.
- Off-chain services may index data, serve metadata, power analytics, and provide project documents, but they should not custody user funds.

The MicroVerse is the experience layer. The DeFi protocol is the backbone.

Core dApp modules:

- Wallet connection and network state
- RYP token balance detection
- Staking and tier logic
- Fee reduction calculation
- Reward accrual and claims
- Treasury and network-fee distribution
- Golden Key and Voting Rights NFT identity
- Project pools and participation records
- Governance proposals and voting
- SeedBot Terminal market tools
- Transaction previews, logs, and safety controls

## Preferred Style

The visual direction should be premium and immersive, with inspiration from:

- Civilization-style strategic progression
- Arcane-style atmosphere and materials
- Futuristic nature-tech environments
- Permaculture and regenerative farming
- Mystical, steampunk, and Yggdrasil-like ecosystem symbolism

Avoid cartoon farm-game styling, meme-token aesthetics, casino energy, cluttered DeFi dashboards, and cheap metaverse language.

## Core Product Vision

CryptoSeeds coordinates:

- RYP staking
- DeFi utility flows
- Utility-gated project access
- Vetted project discovery
- Governance
- NFT identity and achievements
- Ecosystem rewards
- Sustainable project participation
- Donations and R&D support
- Self-custodial market tools
- Gamified user progression

The farm/MicroVerse dashboard is the emotional center of the product. It helps users understand complex Web3 actions as visible ecosystem growth.

## Language Rules

Avoid:

- guaranteed yield
- passive income
- profit share
- risk-free returns
- investment returns
- DeFi casino
- play-to-earn
- copy-trade to earn
- AI money printer

Prefer:

- MicroVerse
- ecosystem layer
- stewardship
- project access
- participation
- governance
- regenerative finance
- ethical coordination
- sustainable project infrastructure
- utility-gated access
- wallet-approved execution

## RYP Utility

RYP is the native utility token of the CryptoSeeds ecosystem.

Known token parameters:

- Token: RYP
- Maximum supply: 50,000,000 RYP
- Minting: disabled

Main uses:

- Staking
- MicroVerse access
- Network fees
- Governance eligibility
- NFT reward eligibility
- Project participation access
- SeedBot Terminal access tiers
- Ecosystem utility

## Network Fee Model

The planned network fee is 3.5%. This fee may be dynamically divided between holders, stakers, and treasury. Exact percentages should remain configurable.

Fee reduction by staking tier:

| Tier | Name | Fee Reduction | Effective Fee |
| --- | --- | ---: | ---: |
| 1 | Seed | 0% | 3.5% |
| 2 | Sprout | 10% | 3.15% |
| 3 | Sapling | 20% | 2.8% |
| 4 | Tree | 30% | 2.45% |
| 5 | Fruit | 40% | 2.1% |

The UI should calculate and explain these clearly.

## Staking Tiers

| Tier | Name | Required RYP |
| --- | --- | ---: |
| 1 | Seed | 5,000 |
| 2 | Sprout | 20,000 |
| 3 | Sapling | 50,000 |
| 4 | Tree | 100,000 |
| 5 | Fruit | 150,000 |

Access to projects starts from Seed tier. Early access should not be positioned as pay-to-win. Higher tiers may unlock more visual identity, project slots, analytics, cosmetics, and reduced fees, but should not imply guaranteed financial advantage.

## MicroVerse Dashboard

The MicroVerse Dashboard is the central user experience. It should be a premium, state-driven, gamified dashboard where users can:

- Connect wallet
- View RYP balance and staking tier
- Activate a personal farm/environment
- Browse vetted project opportunities
- Review project details, milestones, and risks
- Participate through wallet-approved actions
- Track project progress visually
- Harvest eligible rewards or updates
- Vote in governance
- View NFTs and achievements
- Access donations and impact updates
- Use the SeedBot Terminal

Before staking, the user sees an undeveloped but alive natural landscape: wild fields, misty terrain, empty project plots, locked structures, distant map areas, and an inactive SeedBot Terminal.

After staking, the user dashboard becomes an active farm/ecosystem hub. Higher tiers expand the environment, but the Seed tier should still feel meaningful.

## Main MicroVerse Locations

| Location | Purpose |
| --- | --- |
| Homestead | User's main farm dashboard |
| Explorer's Map | Browse vetted projects |
| Project Fields | Active project participation |
| Harvest Ledger | Rewards, claims, updates, and history |
| Governance Hall | Voting and proposals |
| SeedBot Terminal | Self-custodial trading tools |
| Lorehouse | Education, guides, documents |
| Steward's Glade | Donations and impact projects |
| NFT Gallery | Golden Key, Voting NFT, achievements |
| Treasury Grove | Treasury transparency and allocations |
| Arcade / Experimental Zone | Future compliance-gated experiences |

For MVP, focus on Homestead, Explorer's Map, Project Cards, Harvest Ledger, basic Governance Hall, and a SeedBot Terminal preview or signal-only mode.

## Vetted Project Participation

Public UI should use safer language such as vetted projects, approved ecosystem projects, project participation opportunities, regenerative opportunities, impact projects, or ecosystem-backed initiatives.

Avoid presenting projects as guaranteed investments.

Projects should include:

- Project summary
- Operator/owner
- Location
- Category
- Required RYP tier
- Participation status
- Duration
- Milestones
- Documents
- Risk disclosure
- Smart contract terms
- Expected update frequency
- User participation status
- Claimable rewards or updates, if applicable

Project statuses:

- Proposed
- Under Review
- Governance Vote
- Approved
- Open
- Active
- Milestone Reached
- Harvest Available
- Completed
- Paused
- Rejected

## Project Visual Progression

When a user participates in a project, that project should appear inside their personal environment. Visual progression should be linked to actual project states and milestones.

Example organic farm lifecycle:

- Empty soil plot
- Workers arrive
- Soil prepared
- Seeds planted
- Irrigation appears
- Crops grow
- Structures appear
- Harvest animation available
- Project completes or enters next cycle

Example renewable energy lifecycle:

- Survey markers appear
- Foundation starts
- Structures appear
- Panels or turbines installed
- Energy flow activates
- Storage/grid node lights up
- Reports or rewards become available

Codex should structure this as a state-driven system, not static hardcoded pages.

## Rewards and Harvesting

Rewards and updates should be presented as harvestable events, while clearly distinguishing between:

- Financial rewards
- Informational project updates
- Cosmetic rewards
- NFT achievements
- Governance notifications
- Donation impact reports

Safer UI phrases:

- Harvest staking rewards
- View project update
- Claim ecosystem reward
- Open impact report
- Claim NFT achievement
- Harvest available

Avoid:

- guaranteed harvest
- guaranteed profit
- risk-free yield
- passive income farm
- money grows here
- safe investment

Holder rewards accumulate indefinitely until claimed. If unclaimed after 1 year, they may be redistributed back into the ecosystem. This must be implemented carefully and represented clearly.

## NFT Identity

### Golden Key NFT

The Golden Key NFT is non-transferable and granted when the user stakes. It acts as a receipt-like access token and visual symbol of MicroVerse access. It should be returned, burned, or invalidated when the user unstakes, depending on final protocol design.

### Voting Rights NFT

The Voting Rights NFT is non-transferable and unlocks after 14 days of staking. It supports 1 wallet = 1 vote governance.

Visual concept:

- Ethereal open scroll
- Runic seal
- Dynamic vote marks
- Level 2 upgrade after 100 successful votes

Governance should avoid token-weighted voting and reduce whale domination, while recognizing that 1 wallet = 1 vote needs anti-sybil safeguards.

### Achievement NFTs

Achievement NFTs should mark staking milestones, governance activity, project participation, long-term holding, donation participation, quest completion, stewardship paths, and seasonal events.

## Governance

Governance principles:

- 1 wallet = 1 vote
- Voting Rights NFT required
- 14-day staking period before voting
- Non-transferable governance identity

Governance may decide:

- Project approvals
- Treasury allocations
- Donation causes
- R&D priorities
- Ecosystem upgrades
- Seasonal event themes
- SeedBot Terminal feature policy
- Risk policy updates

## SeedBot Terminal

SeedBot Terminal is a self-custodial strategy and trading tool inside the MicroVerse. It should be positioned as user-controlled trading infrastructure, not a profit engine.

Core rule:

CryptoSeeds must never custody user funds, seed phrases, or private keys.

SeedBot must stay user-directed. The first public version should be signal-only, paper-trading, and wallet-approved. Any guarded automation, success-fee, profit-fee, performance-fee, or strategy execution that could look discretionary must remain disabled until security and jurisdictional legal review are complete.

SeedBot access levels:

| User Status | Access |
| --- | --- |
| Visitor | Demo view and education |
| RYP Holder | Watchlists and basic alerts |
| Seed Tier | Signal-only tools |
| Sprout Tier | Wallet-approved execution |
| Sapling Tier | Advanced strategy templates |
| Tree Tier | Portfolio tools |
| Fruit Tier | Guarded automation access, subject to safety rules |

MVP SeedBot should include:

- Read-only portfolio view
- Token watchlist
- Price alerts
- Signal feed
- Manual swap preparation
- Wallet-approved transaction signing
- Trade history
- Risk warnings
- Paper trading
- Strategy simulation
- Basic RYP-gated access

Do not build first:

- Fully autonomous trading
- Leverage
- Perpetual futures
- Memecoin sniping
- Copy trading
- Strategy marketplace
- Custodial wallets
- Backend-held trading keys
- Unlimited approvals
- Profit leaderboards

## Compliance Boundaries

CryptoSeeds is financial-adjacent. Security, self-custody, transparent transaction previews, revocable permissions, and conservative contract design are mandatory.

Self-custody reduces custody risk, but it does not automatically remove securities, commodities, money-transmission, adviser, financial-promotion, tax, gambling, or consumer-protection concerns. Public wording should say that CryptoSeeds is self-custodial and user-directed, not that it avoids regulation.

Avoid building or marketing:

- guaranteed APY
- real-world revenue entitlement
- securities-like project claims
- tokenized SPV ownership flows without legal review
- gambling-style arcade mechanics
- token wagering
- leverage/perps in MVP
- discretionary strategy execution
- live profit-based fees without legal review
- public claims that decentralization eliminates legal obligations

Donations must not promise financial return. Reward-bearing or participation-based projects must be clearly separated from donation and impact updates.

## Recommended MVP Phases

### MVP 1: Core DApp

- Wallet connect
- RYP balance detection
- Staking tier display/simulation
- Stake/unstake flow design
- Golden Key NFT concept flow
- Basic MicroVerse dashboard
- Rewards panel
- Basic governance eligibility
- Transaction preview patterns
- Network/account state indicators

### MVP 2: Project Participation

- Explorer's Map
- Project cards
- Project detail pages
- Risk disclosure flow
- Project lifecycle states
- Visual project slots
- Voting Rights NFT eligibility

### MVP 3: SeedBot Terminal

- Portfolio view
- Watchlists
- Alerts
- Signal-only tools
- Wallet-approved swaps
- Paper trading
- RYP-gated access

### MVP 4: Advanced Systems

- Guarded bot automation
- Dynamic NFTs
- Social farm visits
- Crafting/upcycling
- Seasonal events
- Arcade, if compliance-gated
- Advanced governance

## Codex Build Rules

Build CryptoSeeds as a premium, state-driven, self-custodial Web3 and DeFi dApp. Keep protocol logic, app state, visual state, and integrations modular. Start with a focused MVP. Do not overpromise returns, implement gambling mechanics, request private keys, or create uncontrolled automation. Every project must show risks. Every transaction must have a plain-English preview. Every major visual change should map to real user, project, protocol, or ecosystem state.
