# MicroVerse Asset Brief

Date: 2026-05-29

## Art Direction

CryptoSeeds should feel like a premium regenerative strategy interface, not a cartoon farming game.

Style targets:

- isometric or soft 2.5D perspective
- futuristic nature-tech materials
- Arcane-inspired lighting
- Civilization-style project progression
- steampunk detail only where it supports the RYP and SeedBot identity
- readable silhouettes at small dashboard sizes
- no casino, meme-token, or mobile farming clone styling

## MVP Asset Set

The first asset pack should be a compact sprite atlas, not a full 3D environment.

Required terrain:

- wild field base
- activated homestead base
- river or water edge
- path network
- empty project plot
- locked project plot

Required project tiles:

- regenerative grove
- research greenhouse
- solar or infrastructure node
- water node
- donation glade
- generic ecosystem plot

Required states per project tile:

- preparing
- active
- milestone reached
- harvest available
- completed
- paused

Required UI objects:

- Golden Key pedestal
- Voting Scroll pedestal
- Harvest Ledger marker
- Governance Hall marker
- SeedBot greenhouse marker
- reward crate
- milestone scroll
- impact report ledger

## Technical Requirements

- Use PNG or WebP for raster assets.
- Build at 2x scale for high-DPI displays.
- Keep transparent backgrounds for plot tiles and markers.
- Produce a texture atlas once the asset count grows.
- Keep the current PixiJS procedural markers as fallback.
- Name assets by category and state, for example `plot-grove-active.webp`.

## Initial Dimensions

Recommended starting sizes:

- terrain background: 1920x1080
- plot tiles: 256x256
- location markers: 160x160
- UI objects: 128x128
- particle sprites: 64x64

## Prompt Direction For Generated Concepts

Use prompts that describe a real dashboard asset, not a vague fantasy scene.

Example:

`Premium isometric regenerative agriculture project tile, chestnut grove, futuristic nature-tech irrigation, subtle golden milestone glow, transparent background, readable silhouette, serious Web3 strategy dashboard style, not cartoonish, no text.`

## Approval Rules

Every visual asset must support a real product state:

- staking tier
- project category
- project milestone
- reward availability
- governance activity
- donation impact
- SeedBot unlock state

Do not add decorative-only assets until the MVP state language is clear.
