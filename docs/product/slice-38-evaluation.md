# Slice 38 Evaluation: Visual Bible And Asset Pipeline

Date: 2026-05-30

## Scope

This slice turns the visual-stack recommendation into a production direction the repo can keep building from.

Implemented:

- generated first CryptoSeeds MicroVerse world concept plate
- saved concept asset at `public/assets/concepts/microverse-world-plate-v1.png`
- added `src/visual/microverseAssets.ts` as the visual asset, palette, and landmark registry
- wired the Pixi renderer to load the generated concept plate with fallback terrain
- moved major landmark coordinates and identity into the registry
- added richer fallback landmark drawings for SeedBot Terminal, Steward's Glade, Lorehouse, and Treasury Grove
- added asset registry tests
- added `docs/design/visual-bible.md`
- added `docs/design/visual-qa-checklist.md`
- updated visual architecture and asset brief docs

## Product Position

The visual stack remains:

- PixiJS for the main 2.5D live world
- React for wallet, DeFi, project risk, governance, staking, and SeedBot controls
- generated or commissioned bitmap assets for visual quality
- Three.js later for selective cinematic rooms

This keeps the product beautiful and immersive without compromising Web3 clarity.

## Design Decision

The app should use concept art now as a direction setter, not as the final shipped asset pipeline. Public launch art should be compressed, cropped, and converted into WebP or texture-atlas assets.

Procedural Pixi graphics remain valuable as fallback and for state-driven effects. They should not be the final visual identity.

## Verification

Passed:

- `npm test` -- 16 files, 68 tests.
- `npm run build`.
- `npm audit --audit-level=moderate` -- 0 vulnerabilities.
- `npm run token:check` -- RYP mint remains fixed-supply with null mint/freeze authority.
- secret scan -- no matches.
- `git diff --check`.

Pending:

- desktop and mobile screenshot QA
- image compression/WebP conversion pass
- first dedicated landmark assets for Homestead, Governance Hall, SeedBot Terminal, and Explorer's Map

## Next Step

Create the first production asset batch:

- Homestead active/locked states
- SeedBot Terminal locked/signal/execution states
- Governance Hall inactive/vote-active states
- project tile states for open, active, milestone, harvest, completed, and paused
