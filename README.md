# CryptoSeeds MicroVerse

CryptoSeeds MicroVerse is a full Web3 and DeFi-style Solana dApp built around RYP. The product vision combines staking access, visual ecosystem progression, vetted project participation, governance, rewards, NFT identity, and optional self-custodial trading tools through the SeedBot Terminal.

The first build should be a polished, state-driven dApp rather than a marketing website or full game. Users should be able to connect a wallet, see RYP status, understand staking tiers, browse project opportunities, review risks, harvest eligible rewards, and access governance in a simple premium interface.

## Product Pillars

- **Web3 dApp core:** wallet-first, on-chain-aware, self-custodial, and transaction transparent.
- **DeFi utility:** staking, rewards, fee logic, treasury flows, project pools, and trading-tool access.
- **RYP utility:** staking, access, governance eligibility, rewards, and ecosystem tools.
- **MicroVerse dashboard:** a live farm/environment hub that evolves from user and project state.
- **Vetted project discovery:** clear project cards, risk labels, documents, milestones, and lifecycle tracking.
- **Self-custody:** no seed phrase collection, no custodial user wallets, no hidden transaction execution.
- **Governance:** 1 wallet = 1 vote, gated by a non-transferable Voting Rights NFT after a staking delay.
- **SeedBot Terminal:** signal-only and wallet-approved trading tools first; guarded automation only later.

## RYP Token

Mainnet RYP mint:

`CFPzKkPYqpyfNJp3WDB4dykMemfhwYrV9cgNUy7nsoPD`

## Current Build Stage

This repository is starting with product and architecture foundations plus the first frontend dApp shell. Implementation should be added in small evaluated slices:

1. Docs and product architecture.
2. Web3 dApp shell for the MicroVerse dashboard.
3. Wallet/RYP read-only integration.
4. Staking tier and farm-state simulation mapped to protocol state.
5. Project discovery and detail flow.
6. Governance eligibility and NFT identity flow.
7. SeedBot Terminal signal-only/wallet-approved execution prototype.

## Local Development

```bash
npm install
npm run dev
npm run build
npm run token:check
```

The current dev server uses Vite at `http://127.0.0.1:5173`.

Copy `.env.example` to `.env` for local/default development. Use `.env.devnet.example` as the devnet deployment-prep template once the devnet authority wallet is funded and the devnet test RYP mint exists. The public mainnet RYP mint is already configured for read-only checks.

Broadcast is intentionally disabled by default. `npm run devnet:prep` checks deployment posture while broadcast stays off, and `npm run devnet:readiness` explains the remaining blockers before any reviewed send/broadcast boundary is considered.

## Checks

Deterministic app checks:

```bash
npm run devnet:prep
npm run devnet:readiness
npm run visual:audit
npm run copy:audit
npm test
npm run build
```

Windows host-side protocol checks:

```powershell
npm run protocol:check:win
npm run protocol:test:win
```

WSL Anchor protocol checks:

```powershell
npm run protocol:build:wsl
npm run protocol:idl:check
npm run protocol:test:wsl
npm run protocol:smoke:localnet:wsl
npm run protocol:admin:fixture:wsl
npm run protocol:admin:fixture:check
```

GitHub Actions runs app and host-side protocol checks on pushes and pull requests. The public RYP mint authority check runs as a scheduled/manual external audit because it depends on public Solana RPC availability.

## Protocol Development

The protocol scaffold is Anchor/Rust based:

```bash
npm run protocol:build
npm run protocol:test
```

Rust, Cargo, Solana/Agave tooling, Anchor, and Node must be installed before protocol builds can run locally. The current Windows machine has a working Ubuntu 24.04 WSL2 route; see `docs/setup/wsl-solana-status.md`.

`protocol:idl:check` compares the frontend wallet instruction spec with the generated Anchor IDL. `protocol:smoke:localnet:wsl` builds the Anchor program, runs the IDL drift check, starts a disposable local Solana validator, preloads the program at the declared Anchor id, creates a test RYP-like mint, checks invalid config and unauthorized action rejections, initializes protocol config, stakes Seed-tier tokens, verifies voting-delay, top-up, partial-unstake, and pause behavior, then fully unstakes. `protocol:admin:fixture:wsl` exports the localnet Admin inspection fixture, and `protocol:admin:fixture:check` validates that the fixture remains read-only, reward-safe, and aligned with the app inspection epoch.

## Guardrails

CryptoSeeds can be a serious DeFi dApp without promising returns. Do not build or describe the product as a casino, meme token, guaranteed-yield app, passive-income engine, or unreviewed investment platform. Use language such as project participation, ecosystem rewards, utility access, governance, impact updates, and self-custodial tools.
