# Slice 49 Evaluation: Hover Pan and Asset Visibility Repair

Date: 2026-05-30

## Scope

This slice responded to visual review that the map/background still felt broken, district assets were too subdued, and map movement should happen from mouse hover instead of requiring click-drag.

Delivered:

- removed the old fallback terrain image from the live scene and CSS fallback path
- made the concept plate the only premium visual base for the MicroVerse map shell
- muted the procedural terrain layer further so it cannot overpower the painted world
- added edge-hover panning in Strategy mode
- kept click-drag as a fallback, but it is no longer required for map movement
- enlarged district emblems, district glow zones, district rings, and project tile targets
- increased district glow/ring/sprite visibility for selected and hovered regions

## Evaluation

The map behavior is now closer to the requested strategy-game feel. Users can move the cursor near the map edges to glide across the world, while districts are larger and more visible without reverting to floating standalone buttons.

Strong points:

- background fallback no longer exposes the older river-delta framework
- assets are meaningfully larger and should read better at normal zoom
- hover-edge pan gives a Civ-like navigation pattern without click-drag friction
- compile and test pass after the interaction change

Risks:

- visible-browser review remains mandatory because headless Edge validates the CSS shell but does not reliably show live WebGL layers
- larger district assets may need coordinate tuning once reviewed by eye in the live app
- hover-edge pan speed may need small adjustment after a manual feel pass

## Next Recommendation

Next slice should be a visible-browser design QA pass:

1. manually review district overlap while hovering around the live map
2. tune landmark coordinates and per-district scale values
3. add a small map reset/home control if hover pan leaves users far from base
4. then begin production asset compression and replacement
