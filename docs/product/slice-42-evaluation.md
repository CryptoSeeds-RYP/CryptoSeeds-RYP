# Slice 42 Evaluation: First Runtime Landmark Assets

Date: 2026-05-30

## Scope

This slice adds the first high-quality generated runtime landmark assets and wires Pixi to use them when available.

Implemented:

- generated Homestead active landmark asset
- generated Governance Hall active landmark asset
- generated SeedBot Terminal active landmark asset
- removed chroma-key backgrounds into transparent PNG runtime assets
- saved runtime assets under `public/assets/landmarks/`
- registered landmark `assetPath` values in `src/visual/microverseAssets.ts`
- registered quality gates in `src/visual/microverseAssetSpecs.json`
- upgraded `npm run visual:audit` to require alpha channels for landmark assets
- Pixi landmark renderer now loads registered sprite assets first
- procedural landmark drawings remain as fallback

## Product Decision

Start replacing procedural landmarks one at a time with transparent, high-detail 2.5D runtime art.

The app should not depend on final art being perfect. Each asset should:

- load from the registry
- pass visual audit
- fall back to procedural drawing if missing
- remain replaceable later with compressed WebP or atlas assets

## Generated Assets

- `public/assets/landmarks/homestead-active.png`
- `public/assets/landmarks/governance-hall-active.png`
- `public/assets/landmarks/seedbot-terminal-active.png`

## Verification

Passed:

- `npm run visual:audit`.
- `npm test` -- 16 files, 70 tests.
- `npm run build`.
- `npm audit --audit-level=moderate` -- 0 vulnerabilities.
- `npm run token:check` -- RYP mint remains fixed-supply with null mint/freeze authority.
- secret scan -- no matches.
- `git diff --check`.

Pending:

- browser screenshot QA was unavailable through the current tool environment
- compression/WebP or atlas conversion pass before public launch
