# Production Asset Prompts

Date: 2026-05-30

Use these prompts for the first production landmark and project tile batch. Save accepted assets under `public/assets/` and register them through `src/visual/microverseAssetSpecs.json` and `src/visual/microverseAssets.ts`.

## Shared Rules

Every generated asset should follow:

- premium regenerative Web3 strategy game style
- ornate old-world monumentality translated into original CryptoSeeds architecture
- cel-shaded adventure readability without copying existing characters, maps, UI, or compositions
- soft 2.5D/isometric perspective
- Arcane-inspired lighting
- Civilization-style readability
- futuristic nature-tech materials
- no text
- no watermark
- no logo
- not cartoonish
- not a casino
- not a mobile farming clone
- readable silhouette at small dashboard size

Use direct entertainment references only as internal shorthand. Final prompts and production briefs should describe the original qualities we want: monumental civic geometry, expressive silhouette clarity, painterly teal-gold lighting, and strategy-map legibility.

For cutout-style runtime assets, generate on a flat chroma-key background first and remove the background locally before use.

## Homestead

```text
Use case: stylized-concept
Asset type: 2.5D game landmark cutout
Primary request: CryptoSeeds Homestead landmark, cultivated regenerative farm base with warm golden key-light, small nature-tech greenhouse, curated fields, brass irrigation details, and premium Web3 strategy-game polish.
Style/medium: high-end stylized 2.5D/isometric game asset, Arcane-inspired lighting, Civilization-style readability, futuristic regenerative nature-tech.
Composition/framing: centered landmark cutout with generous padding, readable silhouette, no foreground character.
Lighting/mood: warm dusk lanterns, teal shadow, calm and premium.
Constraints: no text, no logo, no watermark, not cartoonish, no casino styling.
```

## Governance Hall

```text
Use case: stylized-concept
Asset type: 2.5D game landmark cutout
Primary request: CryptoSeeds Governance Hall, ceremonial glass-and-brass dome with scroll-light motif, circular council architecture, subtle runic seal energy, serious Web3 governance atmosphere.
Style/medium: premium stylized isometric landmark, Arcane-inspired gold and teal lighting, high-detail nature-tech materials.
Composition/framing: centered building, strong silhouette, transparent-ready cutout framing.
Lighting/mood: dignified, luminous, mystical but not childish.
Constraints: no text, no logo, no watermark, no meme-token look.
```

## SeedBot Terminal

```text
Use case: stylized-concept
Asset type: 2.5D game landmark cutout
Primary request: CryptoSeeds SeedBot Terminal, futuristic greenhouse command center for self-custodial trading tools, glass canopy, brass market instruments, glowing market roots, risk-control panels, strategy seed vault.
Style/medium: premium 2.5D/isometric game asset, Arcane-inspired lighting, steampunk nature-tech, serious trading terminal identity.
Composition/framing: centered landmark with readable silhouette and no UI text.
Lighting/mood: focused, powerful, safe, analytical, warm gold signal lights with deep teal shadows.
Constraints: no profit language, no charts with numbers, no text, no logo, no casino feel.
```

## Project Tile States

Generate each project category with these states:

- open
- active
- milestone
- harvest
- completed
- paused

Project categories:

- regenerative grove
- research greenhouse
- water node
- donation glade
- ecosystem plot

Base prompt:

```text
Use case: stylized-concept
Asset type: 2.5D game project tile cutout
Primary request: CryptoSeeds <CATEGORY> project tile in <STATE> state, premium regenerative Web3 strategy dashboard asset with clear visual state language.
Style/medium: high-end 2.5D/isometric game tile, Arcane-inspired lighting, Civilization-style readability, futuristic nature-tech materials.
Composition/framing: centered tile, transparent-ready cutout framing, readable at small size.
Lighting/mood: <STATE-SPECIFIC MOOD>.
Constraints: no text, no logo, no watermark, not cartoonish, no casino styling.
```

State moods:

- open: quiet potential, soft gold outline
- active: lively work lights, visible progress
- milestone: bright milestone glow, ceremonial signal
- harvest: golden claim-ready signal, not money imagery
- completed: calm mature landscape, stable success marker
- paused: muted warm caution light, no danger panic
