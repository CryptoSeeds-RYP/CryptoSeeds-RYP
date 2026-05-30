# Slice 46 Evaluation: Strategy Map Expansion

Date: 2026-05-30

## Scope

This slice responded to the need for a larger, more navigable MicroVerse instead of a compressed all-in-one dashboard.

Delivered:

- expanded the PixiJS strategy world beyond the viewport so the map can pan like a strategy layer
- added drag-to-pan and wheel zoom controls in strategy mode
- added camera focus requests for Home, Explorer, Governance, Harvest, and SeedBot
- increased landmark sprite target sizes and project tile target sizes
- added hover zoom for runtime landmark sprites and project field markers
- moved district direction into a compact dock instead of floating every destination over the map
- wired Pixi landmark hover/click events back into React focus state
- tightened mobile map height and dock layout so the map reads as a directed world surface

## Evaluation

The Homestead now has a clearer "home plus districts" structure. Users can start from the Homestead, use the district dock to focus a location, drag around the wider map, zoom the strategy view, and enter sections through the focus panel rather than seeing every area as a flat overlay at once.

Strong points:

- strategy mode now has real camera state instead of a locked viewport
- world assets scale up and respond on hover, which makes the visual layer feel more physical
- district controls provide direction without turning every location into permanent map clutter
- the same landmark registry still drives art placement, camera focus, and React navigation
- tests and production build remain clean after the interaction changes

Risks:

- headless browser screenshots still show the CSS concept-plate fallback more reliably than live WebGL, so visible-browser review is still required for exact Pixi asset placement
- drag-to-pan and click-to-select can eventually conflict on small touch targets, so touch selection should get a deliberate selected-state pass
- the current district dock is functional MVP UI; later art direction should make it feel more like a premium strategy-map command bar

## Next Recommendation

Next slice should deepen the map itself:

1. add visible edge fog, boundary hints, and route arrows inside the Pixi world
2. add a persistent selected district state for touch devices
3. add project category filters to the Explorer map
4. start texture atlas/WebP compression before the asset count grows further
