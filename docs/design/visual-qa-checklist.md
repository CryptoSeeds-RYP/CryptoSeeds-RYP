# Visual QA Checklist

Date: 2026-05-30

Use this before merging major MicroVerse visual changes.

## Viewports

Check at minimum:

- desktop: 1440x900
- wide desktop: 1920x1080
- tablet: 1024x768
- mobile: 390x844

## Composition

- First viewport clearly signals CryptoSeeds as a premium regenerative Web3 world.
- Homestead, Explorer's Map, Governance Hall, SeedBot Terminal, and project fields are visually distinguishable.
- Live world feels immersive without hiding app navigation.
- Important text does not overlap canvas detail in a way that hurts readability.
- Scene is not dominated by one color family.
- Lower-tier users still get an alive, aspirational world.

## Interaction

- WASD and arrow movement work on desktop.
- Click-to-move works without blocking project marker taps.
- Project markers are large enough to select.
- Mobile/touch does not cause layout shift.
- Reduced-motion mode still looks polished.

## Web3 Safety

- Wallet, staking, SeedBot, project risk, governance, and claim actions remain in stable React UI.
- No transaction approval is hidden inside scene animation.
- Harvest language clearly distinguishes rewards, reports, NFTs, updates, and donations.
- No visual implies guaranteed profit or risk-free return.

## Performance

- Production build passes.
- MicroVerse chunk size is reviewed after new art imports.
- Large concept assets are compressed before release use.
- Real sprites should be converted to WebP or atlas format before public launch.

## Accessibility

- Scene remains non-essential for understanding wallet and transaction state.
- Controls can still be reached by keyboard through React UI.
- Color alone is not the only signal for project state.
- Reduced-motion setting is respected.
