# Slice 40 Evaluation: Strategy And Walk Navigation Modes

Date: 2026-05-30

## Scope

This slice changes the MicroVerse interaction model so the main map no longer depends on character walking.

Implemented:

- `MicroVerseNavigationMode` model
- Strategy mode as the default map interaction
- Walk mode as an optional personal-farm interaction
- Homestead toggle between Strategy and Walk
- Strategy mode disables keyboard/click movement and hides the avatar
- Walk mode preserves WASD, arrow-key movement, click-to-move, avatar, and camera follow
- Strategy mode uses viewport-scale world sizing for broad map readability
- Strategy mode adds glowing selectable hotspot rings for landmarks and project fields
- CSS treatment for glowing map regions and mode toggle
- visual architecture and visual bible updates

## Product Decision

Use Strategy mode for the broad MicroVerse map.

Use Walk mode only where it adds emotional value, especially the personal farm/homestead layer.

This keeps CryptoSeeds closer to a premium Civilization-style Web3 strategy dashboard and avoids forcing users to walk an avatar around when they are trying to stake, review risk, vote, or use SeedBot.

## Verification

Passed:

- `npm test` -- 16 files, 69 tests.
- `npm run build`.
- `npm run visual:audit`.
- `npm audit --audit-level=moderate` -- 0 vulnerabilities.
- `npm run token:check` -- RYP mint remains fixed-supply with null mint/freeze authority.
- secret scan -- no matches.
- `git diff --check`.
