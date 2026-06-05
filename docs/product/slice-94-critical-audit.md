# Slice 94 Critical Audit

Date: 2026-06-05

This pass tightened deployment, copy, SeedBot, holder-reward, project-registry, and governance guardrails.

## Problems Fixed

1. Copy guardrails scanned only `src`, so risky language could enter docs or scripts.
2. Copy guardrails ignored Markdown, JSON, TOML, env examples, and script files.
3. Copy guardrails flagged allowed safety examples too aggressively because it had no nearby-context window.
4. Copy guardrails scanned test descriptions where prohibited phrases are used only as assertions.
5. The RYP mint checker had no `--env` route for repeatable mainnet/devnet checks.
6. The RYP mint checker did not strip quoted env values.
7. The RYP mint checker did not verify the mint owner program.
8. The RYP mint checker had no optional supply bound checks.
9. Devnet readiness had no `--env` support, unlike devnet prep.
10. Devnet readiness did not validate the RYP mint address.
11. Devnet readiness did not block the mainnet RYP mint on devnet.
12. Devnet readiness did not validate RYP decimals.
13. Devnet readiness did not validate the admin authority address.
14. Devnet prep did not fail cleanly for a missing env file.
15. Devnet prep did not strip quoted env values.
16. SeedBot strategies could ship with incomplete performance windows.
17. SeedBot strategies could ship with target weights that did not total 100%.
18. SeedBot strategies could ship with wallet route or venue mismatches.
19. Holder reward snapshots could double-count wallets through casing or whitespace differences.
20. Project and governance registries could accept duplicate or malformed audit identifiers.

## Verification Targets

- Domain validators should reject invalid SeedBot, holder reward, project document, and governance metadata.
- Deployment scripts should accept explicit env files and fail with actionable blockers.
- Copy audit should cover current product surfaces while allowing explicit safety guidance.
