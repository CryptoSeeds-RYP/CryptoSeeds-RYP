# Visual Layer Architecture

## Recommendation

CryptoSeeds should use a hybrid visual architecture that feels immersive without turning the MVP into a full game engine project:

- **PixiJS/WebGL** for the main navigable MicroVerse live environment.
- **React** for wallet, DeFi, governance, project review, and transaction controls.
- **Three.js** later for selective cinematic 3D spaces such as SeedBot Terminal, Governance Hall, and premium project showcases.

## Why PixiJS First

The main CryptoSeeds world is a state-driven 2.5D strategy-map interface, not a free-camera 3D game. PixiJS is a strong fit because it gives us a fast GPU-rendered scene graph for sprites, effects, animated project plots, weather, particles, camera movement, and isometric-style maps while keeping the UX simple and mobile-friendly.

PixiJS also lets us keep the Web3 dApp ergonomics in React instead of putting wallet flows inside a game engine.

## Current Implementation

The MVP visual layer now uses a live PixiJS world instead of a static map skin:

- generated concept background plate at `public/assets/concepts/microverse-world-plate-v1.png`
- visual asset registry at `src/visual/microverseAssets.ts`
- landmark destination registry in `src/visual/microverseAssets.ts`
- transparent runtime landmark assets for all MVP world locations
- transparent runtime project tile assets for open, active, milestone, harvest, completed, and paused states
- larger world canvas with camera follow
- WASD and arrow-key movement
- click-to-move navigation
- default strategy-map selection mode with glowing regions
- optional character navigation mode for personal farm exploration
- player avatar and glow state
- river/canal water layer with bridges and glints
- paths, islands, groves, dome clusters, lanterns, and windmill details
- district foundations under every landmark so the world reads as one built MicroVerse
- state-driven project markers scaled into world coordinates, with bitmap tile assets and procedural fallback symbols
- React HUD focus panel for landmark and project plot hover/focus state
- registry-aligned landmark navigation markers with mobile edge clamping
- animated particles, tier atmosphere, and rain/storm effects
- reduced-motion handling for users who prefer less animation

This creates the first "walkable dashboard" version of the MicroVerse while preserving React for every transaction, disclosure, wallet, and project-review surface.

## Visual North Star

The visual layer should feel like a premium regenerative strategy world:

- Civilization-style readable progression
- Arcane-inspired lighting and atmosphere
- futuristic greenhouse and nature-tech materials
- subtle steampunk detail for RYP, Golden Key, Voting Scroll, and SeedBot identity
- clear DeFi controls sitting above a rich live environment
- no cartoon farming clone, casino surface, meme-token dashboard, or generic dark terminal styling

The MicroVerse should be thrilling because it is alive and stateful, not because it hides the Web3 product behind spectacle.

## Rendering Layers

| Layer | Technology | Purpose |
| --- | --- | --- |
| App shell | React | Layout, navigation, wallet state, forms, disclosures |
| Live world | PixiJS | Homestead, movement, project slots, weather, particles, animated markers |
| Detail overlays | React | Project cards, transaction previews, risk acknowledgement |
| Cinematic rooms | Three.js later | SeedBot greenhouse, Governance Hall, premium 3D moments |

## State Rule

The visual layer must be driven by domain state:

- staking tier
- project slots
- project participation status
- reward availability
- governance activity
- SeedBot unlock state
- seasonal/weather state
- movement/camera state
- navigation mode

No major visual upgrade should be purely decorative. It should correspond to user, project, protocol, reward, or ecosystem state.

## Immersion Stack Sequence

Build the visual stack in this order:

1. PixiJS procedural world, navigation, and state-driven markers. Done.
2. Generated bitmap concept plate and asset registry. Done for the first world plate.
3. Generated transparent runtime assets for key locations and project states. Done for the MVP landmark set and first project lifecycle tiles.
4. Texture atlas and sprite-sheet pipeline for production assets.
5. Richer shader-like effects in PixiJS for water, lighting, harvest, and weather.
6. Selective Three.js rooms for SeedBot Terminal, Governance Hall, and premium project reveals.
7. Optional ambient soundscape only after UX, accessibility, and performance are stable.

Three.js should enhance special moments. It should not replace the main MicroVerse shell until there is a proven reason.

## Asset Direction

Use generated or commissioned bitmap assets for:

- isometric terrain
- world background plates
- project plot tiles
- atmospheric overlays
- project icons
- Golden Key and Voting Scroll visuals
- SeedBot greenhouse panels
- player/avatar silhouettes
- landmark buildings

Avoid building the main world as inline SVG. Keep SVG/icon use limited to UI icons via Lucide.

All runtime visual asset paths, landmark coordinates, and core Pixi colors should be registered in `src/visual/microverseAssets.ts` so production art can replace procedural fallbacks without rewriting scene logic.

Strategy-map buttons, Pixi landmark rings, and future landmark sprites should all read from the same landmark destination registry. Avoid hardcoding separate UI marker lists.

Transparent landmark and project tile sprites should load from registered `assetPath` values first. Procedural Pixi drawings must remain as fallback when a sprite is missing or fails to load.

Project tile assets should map to lifecycle state, not individual hardcoded cards. The current runtime mapping lives in `MICROVERSE_PROJECT_TILE_ASSETS` and covers `EMPTY`, `PREPARING`, `ACTIVE`, `MILESTONE`, `HARVEST`, `COMPLETED`, and `PAUSED`.

## Performance Rules

- Keep Pixi scenes isolated from React re-render churn.
- Pass compact scene state into the renderer.
- Use texture atlases/sprite sheets once real assets arrive.
- Respect reduced-motion settings.
- Keep mobile scene interactions tap-friendly.
- Keep wallet approvals and risk disclosures in stable React surfaces, not inside animated scene objects.

## MVP Visual Target

The first visual engine should show:

- navigable living terrain background
- active project field markers
- empty unlocked project fields
- animated energy/harvest pulses
- tier-based atmosphere
- simple camera-safe layout and click-to-move route

This is enough to prove the MicroVerse identity without building a full 3D game.
