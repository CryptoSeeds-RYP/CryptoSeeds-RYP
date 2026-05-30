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
| Regenerative technology | glass greenhouses, water systems, cultivated land, clean energy, nature-tech materials |
| Web3 seriousness | no casino energy, no meme-token styling, no childish farming clone tone |
| Stateful beauty | every visual upgrade should correspond to staking, project, reward, governance, donation, or SeedBot state |

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

## Asset Pipeline

Use this production sequence:

1. Generate or commission concept plates for world and landmarks.
2. Select art direction and crop into reusable assets.
3. Export WebP or PNG at 2x scale.
4. Build a texture atlas when the asset count grows.
5. Register all assets in `src/visual/microverseAssets.ts`.
6. Keep procedural Pixi graphics as fallback.

The current first concept plate is saved at:

`public/assets/concepts/microverse-world-plate-v1.png`

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
