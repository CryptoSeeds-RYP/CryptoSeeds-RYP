# Visual Layer Architecture

## Recommendation

CryptoSeeds should use a hybrid visual architecture:

- **PixiJS/WebGL** for the main MicroVerse live environment.
- **React** for wallet, DeFi, governance, project review, and transaction controls.
- **Three.js** later for selective cinematic 3D spaces such as SeedBot Terminal, Governance Hall, and premium project showcases.

## Why PixiJS First

The main CryptoSeeds world is a state-driven 2.5D strategy-map interface, not a free-camera 3D game. PixiJS is a strong fit because it gives us a fast GPU-rendered scene graph for sprites, effects, animated project plots, weather, particles, and isometric-style maps while keeping the UX simple and mobile-friendly.

PixiJS also lets us keep the Web3 dApp ergonomics in React instead of putting wallet flows inside a game engine.

## Rendering Layers

| Layer | Technology | Purpose |
| --- | --- | --- |
| App shell | React | Layout, navigation, wallet state, forms, disclosures |
| Live map | PixiJS | Homestead, project slots, atmospheric effects, animated markers |
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

No major visual upgrade should be purely decorative. It should correspond to user, project, protocol, reward, or ecosystem state.

## Asset Direction

Use generated or commissioned bitmap assets for:

- isometric terrain
- project plot tiles
- atmospheric overlays
- project icons
- Golden Key and Voting Scroll visuals
- SeedBot greenhouse panels

Avoid building the main world as inline SVG. Keep SVG/icon use limited to UI icons via Lucide.

## Performance Rules

- Keep Pixi scenes isolated from React re-render churn.
- Pass compact scene state into the renderer.
- Use texture atlases/sprite sheets once real assets arrive.
- Respect reduced-motion settings later.
- Keep mobile scene interactions tap-friendly.

## MVP Visual Target

The first visual engine should show:

- living terrain background
- active project field markers
- empty unlocked project fields
- animated energy/harvest pulses
- tier-based atmosphere
- simple camera-safe layout

This is enough to prove the MicroVerse identity without building a full 3D game.
