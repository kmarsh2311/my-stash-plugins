# FastTag architecture

FastTag uses classic browser scripts loaded in the exact order declared in
`fasttag.yml`. Each module publishes a frozen API under `window.FastTag`; the
final `fasttag.js` file coordinates those APIs and owns browser lifecycle.

## Module ownership

- `fasttag-core.js`: pure text, time, filename, matching, and card-discovery helpers.
- `fasttag-entities.js`: entity definitions and reusable entity GraphQL operations.
- `fasttag-storage.js`: settings, IndexedDB caches, recent items, and pinned items.
- `fasttag-integrations.js`: Apollo cache and theme-specific scene-card refreshes.
- `fasttag-gemini.js`: Gemini bridge transport, timeouts, and parsed results.
- `fasttag-scraper.js`: scraper requests, evidence scoring, ranking, and save payloads.
- `fasttag-scraper-ui.js`: scraper presentation decisions and review-state labels.
- `fasttag-preview.js`: media discovery, scrubbing calculations, and video HUD geometry.
- `fasttag-ui.js`: shared popup sizing and placement calculations.
- `fasttag-editors.js`: reusable selection and bulk-edit calculations.
- `fasttag-workflows.js`: reusable navigation and result-list state transitions.
- `fasttag.js`: DOM rendering, event wiring, feature coordination, and startup.

## Change rules

1. Put pure decisions and transformations in the owning feature module and test
   them without a browser.
2. Keep DOM lookup, event binding, and orchestration in `fasttag.js` unless a
   whole view can be extracted with a small, explicit dependency interface.
3. Do not embed persistence in UI renderers. Use `fasttag-storage.js`.
4. Do not update scene cards directly from feature code. Use
   `fasttag-integrations.js`.
5. Keep entity IDs normalized as strings at editor and save boundaries.
6. Add every new module to `fasttag.yml`, the load-order contract test, and the
   unified test runner's filename convention.
7. Run `node tests/run-all.js` before staging the test plugin.

## Why the coordinator remains large

FastTag builds several interaction-heavy interfaces without a framework. Moving
DOM code merely to reduce a line count would exchange one large file for tightly
coupled modules. Extract code when it has an independently testable contract;
leave page lifecycle and wiring in the coordinator.
