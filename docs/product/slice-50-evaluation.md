# Slice 50 Evaluation - Map-First Homestead Pass

## Intent

Respond to the visual QA note that the MicroVerse still felt cramped, flashed old background treatment during scene reloads, and did not yet make districts feel large enough for a Civ-style strategy map.

## Changes

- Removed the old river-delta artwork from the outer app shell so scene reloads no longer expose the legacy framework underneath.
- Promoted Homestead into a map-first layout on desktop, with protocol, transaction, and snapshot panels flowing below the world instead of narrowing it.
- Increased the MicroVerse map height across desktop and mobile breakpoints so hover-panning has room to breathe.
- Enlarged landmark sprites, district rings, and project tiles.
- Increased hover/selected scaling and raised hovered districts above neighboring map elements.
- Added stronger edge-light overlays to make hover-pan boundaries feel intentional.

## QA Focus

- Verify desktop Homestead opens with a wider strategy-map view.
- Verify mobile does not regress into overlapping controls.
- Verify the old river-delta image no longer appears behind the map during reload.
- Verify districts and project tiles remain readable after enlargement.
- Verify hover and selected district scaling does not clip key assets.

## Follow-Up

The next visual pass should move more control affordances out of the map viewport on very narrow screens, likely into a compact bottom command tray. That will leave the world even cleaner while preserving fast navigation.
