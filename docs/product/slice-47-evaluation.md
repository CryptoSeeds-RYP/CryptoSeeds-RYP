# Slice 47 Evaluation: District Lighting Cleanup

Date: 2026-05-30

## Scope

This slice cleaned up the MicroVerse after visual review showed overlapping assets, a background flash, and too much single-object clutter.

Delivered:

- made the painted MicroVerse plate the stable PixiJS world base instead of a temporary fallback
- reduced opaque procedural terrain so it no longer covers the premium background
- softened water, paths, gardens, and foreground overlays so they support the art instead of replacing it
- converted landmark interaction into larger district zones with glow, ring, label, and a softened emblem
- reduced landmark emblem and project tile sizes to prevent overlap
- kept dock/camera navigation while making selected districts light up as regions
- aligned the CSS fallback with the PixiJS base plate to reduce loading flicker

## Evaluation

The visual layer is now closer to the intended strategy-map direction. Districts read as areas of the world instead of isolated assets scattered on top of an older framework. The painted base remains visible before and after PixiJS loads, which should prevent the jarring transition where the polished background disappears.

Strong points:

- district lighting is now the primary interaction affordance
- individual assets are reduced to emblems inside districts
- the old procedural terrain is now atmospheric overlay rather than the dominant look
- selected district state is tracked in the Pixi runtime and can pulse independently of React panels
- CSS and Pixi now share the same premium world plate as the base

Risks:

- district hit areas should still be reviewed in a visible browser because headless screenshots do not consistently render WebGL
- the current generated landmark emblems remain placeholder-quality and should eventually be replaced with art-directed production assets
- project fields may need the same district treatment once we add more active slots

## Next Recommendation

Next slice should add a deliberate map readability pass:

1. add route lines from Homestead to selected district
2. add edge fog and directional lighting so panning feels intentional
3. create a selected-district panel state for touch devices
4. begin replacing placeholder emblems with a consistent district asset set
