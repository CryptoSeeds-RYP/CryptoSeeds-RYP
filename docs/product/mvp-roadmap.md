# MVP Roadmap

## Build Philosophy

CryptoSeeds should be built step by step and evaluated after each slice. Each slice should answer one question: does this make the dApp clearer, safer, and more useful?

Do not attempt the full MicroVerse first. The first release should prove the core Web3/DeFi loop:

connect wallet -> understand RYP status -> stake or simulate tier -> see MicroVerse activate -> browse vetted projects -> review risk -> track rewards/governance -> access SeedBot safely.

## Slice 0: Repository Foundation

Deliverables:

- Product master brief
- MVP roadmap
- State model draft
- Compliance guardrails
- Initial Git repository

Evaluation:

- Is the concept clear enough for a new engineer?
- Are the compliance and self-custody rules visible early?
- Is the MVP smaller than the full vision?

## Slice 1: Frontend Shell

Deliverables:

- React/Vite app
- App layout
- Navigation for Homestead, Explorer's Map, Harvest Ledger, Governance Hall, SeedBot Terminal
- Static demo state
- Premium visual direction
- Wallet connect entry point
- Network/account status area
- Transaction preview component pattern

Evaluation:

- Does it feel like a real Web3/DeFi dApp rather than a generic dashboard?
- Can a user understand the main areas without reading instructions?
- Does it work on desktop and mobile?

## Slice 2: MicroVerse State Model

Deliverables:

- UserMicroVerseState type
- Project type
- Reward type
- FarmVisualState mapping
- Protocol account shape draft
- Transaction intent shape draft
- Demo fixtures

Evaluation:

- Can visual state be driven by data?
- Can staking tier, projects, rewards, governance, and transaction state change the dashboard?
- Is the model simple enough to extend?

## Slice 3: Homestead Dashboard

Deliverables:

- Wallet status panel
- RYP status panel
- Staking tier panel
- Golden Key status
- Voting Rights status
- Farm visual state
- Locked/unlocked location states

Evaluation:

- Does the pre-stake state feel alive rather than empty?
- Does staking/tier state visibly change the environment?
- Are locked areas clear and fair?

## Slice 4: Explorer's Map and Project Cards

Deliverables:

- Project list/map hybrid
- Project cards
- Filters by category, risk, tier, status
- Project detail page
- Risk disclosure section
- Milestone timeline

Evaluation:

- Can users browse opportunities simply?
- Are risks visible before participation?
- Does the UI avoid looking like a guaranteed investment marketplace?

## Slice 5: Harvest Ledger

Deliverables:

- Reward/update types
- Claimable item list
- Harvest indicators
- Activity history
- Clear distinction between rewards, reports, NFTs, and governance notices

Evaluation:

- Does "harvest" clarify rather than mislead?
- Can users understand where each item came from?
- Are financial and non-financial items separated?

## Slice 6: Governance Hall

Deliverables:

- Proposal list
- Voting Rights NFT eligibility state
- 14-day staking rule display
- 1 wallet = 1 vote explanation
- Project approval proposal example

Evaluation:

- Is governance accessible without being token-weighted?
- Are eligibility rules clear?
- Are sybil and abuse concerns documented?

## Slice 7: SeedBot Terminal MVP

Deliverables:

- Terminal preview
- Watchlist
- Signal-only feed
- Paper trading mode
- Wallet-approved execution mock flow
- Risk controls panel
- Emergency disable/revoke UI placeholder

Evaluation:

- Is self-custody unmistakable?
- Are private keys never requested?
- Does the UI avoid profit promises?
- Are automation boundaries clear?

## Do Not Build Yet

- Full 3D world
- Multiplayer farms
- Advanced crafting
- Casino/arcade wagering
- Leverage or perpetual futures
- Memecoin sniper tools
- Custodial user wallets
- Backend-held trading keys
- Copy-trading marketplace
- Tokenized SPV investment flows
- Guaranteed-return project mechanics
