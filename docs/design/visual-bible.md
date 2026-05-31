# CryptoSeeds Visual Bible

Date: 2026-05-30

## North Star

CryptoSeeds should feel like a premium regenerative strategy world wrapped around a serious Web3 and DeFi dApp.

The user should feel:

- curious enough to explore
- safe enough to connect a wallet
- impressed by the world quality
- clear about risk, staking, governance, SeedBot, and project participation

The visual layer is not decoration. It is the user's living map of protocol state.

## Style Pillars

| Pillar | Direction |
| --- | --- |
| Strategy readability | Civilization-style map clarity, visible landmarks, understandable project state |
| Premium atmosphere | Arcane-inspired light, layered dusk, teal shadows, warm gold signal points |
| Old-world monumentality | ornate civic structures, brass filigree, observatory domes, monumental terraces, never direct historical-copy pastiche |
| Adventure clarity | cel-shaded silhouette readability, playful navigation affordances, approachable shapes without childish tone |
| Regenerative technology | glass greenhouses, water systems, cultivated land, clean energy, nature-tech materials |
| Web3 seriousness | no casino energy, no meme-token styling, no childish farming clone tone |
| Stateful beauty | every visual upgrade should correspond to staking, project, reward, governance, donation, or SeedBot state |

The external art references should be translated into an original CryptoSeeds language: ornate old-world architecture, expressive cel-shaded readability, painterly cinematic lighting, and strategy-map clarity. Do not copy recognizable characters, locations, UI, logos, or exact compositions from existing games or shows.

## Palette

| Use | Color |
| --- | --- |
| Terrain base | `#10282d` |
| Terrain wash | `#1e575b` |
| Deep water | `#0f4658` |
| Living water | `#2194a9` |
| Ivory text/light | `#fff8df` |
| Soil/path gold | `#f1cc74` |
| Harvest gold | `#ffd66b` |
| Greenhouse teal | `#80dcca` |
| Grove green | `#80c66d` |
| Research blue | `#8fb7ff` |
| Steward violet | `#d7b1ff` |
| Risk warm | `#ffa37b` |

Keep the palette broad enough to avoid a one-note teal or brown world. Gold should be used as a state signal, not everywhere.

## Camera And Composition

The core camera should remain 2.5D/isometric-adjacent:

- readable from desktop and mobile
- landmarks visible at a glance
- central space kept open for player movement and active plots
- enough depth to feel like a world, not a flat dashboard
- no full open-world camera in the MVP

The current implementation uses PixiJS for the live world and React for controls. This split should remain.

## Navigation Modes

CryptoSeeds should support two visual navigation modes:

| Mode | Purpose |
| --- | --- |
| Strategy | Default MicroVerse map mode. Users select glowing regions, project fields, and landmarks like a strategy map. |
| Walk | Optional personal-farm mode. Users can move an avatar with keyboard or click-to-move for a more intimate farm view. |

Strategy mode should be the default for broad ecosystem browsing. Character navigation should be reserved for the personal farm feeling, not required for normal staking, governance, SeedBot, or project review flows.

## Landmark Language

| Landmark | Visual Language |
| --- | --- |
| Homestead | cultivated fields, warm key light, first user-owned base |
| Explorer's Map | observatory, map table, research glass, project discovery signal |
| Governance Hall | ceremonial dome, scroll-light, elder council atmosphere |
| SeedBot Terminal | greenhouse command center, market roots, mechanical risk instruments |
| Steward's Glade | donation/impact grove, violet ritual light, calm stewardship |
| Lorehouse | archive tower, wind and scroll motifs, education and docs |
| Treasury Grove | protected gold-lit trees, transparent allocation symbolism |

Every landmark should eventually have:

- idle state
- locked state
- active state
- notification state
- milestone or reward-ready state where relevant

MVP map landmarks and their app destinations are registered in `src/visual/microverseAssets.ts`. The React marker layer and Pixi strategic hotspot layer should use this shared registry.

## RPG Homestead Customization

The personal homestead should feel like an epic RPG base that grows through staking tier, project participation, governance, donations, achievements, and seasonal events.

Tier progression should affect visual scale and customization capacity:

| Tier | Homestead Feel |
| --- | --- |
| Seed | starter base, first cottage, first fields, basic pathing |
| Sprout | growing holding, workers, extra paths, more decorative identity |
| Sapling | richer estate, greenhouses, project trophies, stewardship objects |
| Tree | mature domain, prestige buildings, larger project districts |
| Fruit | regenerative citadel, rare cosmetics, symbolic effects, broad layout options |

Customization options should include buildings, paths, banners, crop styles, greenhouse modules, project trophies, donation grove elements, seasonal items, Golden Key displays, Voting Scroll displays, and SeedBot instruments. Keep these expressive and cosmetic. Do not make the visual language imply guaranteed financial advantage.

Current MVP runtime landmark assets:

- `public/assets/landmarks/homestead-active.png`
- `public/assets/landmarks/explorer-map-active.png`
- `public/assets/landmarks/governance-hall-active.png`
- `public/assets/landmarks/harvest-ledger-active.png`
- `public/assets/landmarks/seedbot-terminal-active.png`
- `public/assets/landmarks/stewards-glade-active.png`
- `public/assets/landmarks/lorehouse-active.png`
- `public/assets/landmarks/treasury-grove-active.png`

## Project Tile Language

Project tiles are the small visual record of vetted project participation inside the user's MicroVerse. They should read clearly at dashboard size and support fast status scanning.

| State | Visual Language |
| --- | --- |
| Open | quiet prepared land, soft gold access signal, invitation without pressure |
| Active | visible cultivation/work systems, water channels, warm operating lights |
| Milestone | ceremonial glow, activated ring, upgraded infrastructure |
| Harvest | golden claim-ready signal, glowing crop/report energy, no money imagery |
| Completed | mature landscape, calm finished cycle, stable pathing |
| Paused | muted warm caution, dimmed activity, no panic styling |

Runtime tile assets currently live under `public/assets/project-tiles/` and are registered through `MICROVERSE_PROJECT_TILE_ASSETS`.

## Asset Pipeline

Use this production sequence:

1. Generate or commission concept plates for world and landmarks.
2. Select art direction and crop into reusable assets.
3. Export WebP or PNG at 2x scale.
4. Build a texture atlas when the asset count grows.
5. Register all assets in `src/visual/microverseAssets.ts`.
6. Run `npm run visual:audit`.
7. Keep procedural Pixi graphics as fallback.

The current first concept plate is saved at:

`public/assets/concepts/microverse-world-plate-v1.png`

Every runtime or concept asset should have:

- explicit role
- state
- path
- target dimensions
- byte budget
- production readiness flag
- short notes explaining how it should be used

Transparent landmark and project tile assets must pass `npm run visual:audit`, including alpha-channel validation.

## Motion And Effects

Motion should feel alive but restrained:

- water shimmer
- lantern pulse
- harvest glow
- gentle pollen/energy particles
- weather overlays
- subtle camera smoothing
- landmark notification pulses

Avoid:

- constant loud animation
- casino-style flashing
- fast particle spam
- effects that obscure transaction or risk information

Reduced-motion users must still receive a polished visual state without heavy animation.

## UI Rule

The world can be magical. The DeFi surfaces must be precise.

Wallet approvals, project risk disclosures, SeedBot controls, staking actions, governance votes, and reward claims should remain in React panels with clear language and stable layout.

## Prompt Used For First Concept Plate

```text
Premium 2.5D regenerative Web3 strategy world background for the CryptoSeeds MicroVerse, river delta with bridges, cultivated islands, wild field edges, glowing greenhouse landmarks, Governance Hall silhouette, SeedBot greenhouse command center, Steward's Glade, and distant nature-tech domes. High-end stylized concept art, soft isometric/2.5D game perspective, Arcane-inspired lighting, Civilization-style strategic map readability, futuristic regenerative nature-tech, subtle steampunk accents. Wide landscape composition with open central playable space and landmark clusters around the map. Golden dusk, teal shadows, warm lanterns, premium mystical atmosphere. No UI text, no logos, no foreground characters, not cartoonish, not a casino, not meme-token styling.
```
