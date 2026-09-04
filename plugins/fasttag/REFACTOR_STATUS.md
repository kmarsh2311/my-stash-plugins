# FastTag refactor status

This branch is an isolated development copy. It must not be published or copied
over the live plugin until the manual regression checklist in `REFACTOR_PLAN.md`
has passed.

## Extracted modules

- `fasttag-core.js`: formatting, normalization, matching, and scene-card discovery
- `fasttag-entities.js`: entity schema and GraphQL registry
- `fasttag-storage.js`: preferences, recent/pinned entries, and IndexedDB persistence
- `fasttag-integrations.js`: Apollo cache updates and Refract refresh handling
- `fasttag-gemini.js`: Gemini bridge transport and scene parsing
- `fasttag-scraper.js`: discovery, match analysis, entity resolution, and save payloads
- `fasttag-preview.js`: media discovery, scrubbing calculations, and HUD layout
- `fasttag-ui.js`: shared popup sizing and workstation positioning
- `fasttag-editors.js`: selection normalization and bulk-selection deltas

`fasttag.js` remains the runtime coordinator and owns DOM-heavy popup rendering,
event wiring, navigation, and save orchestration.

## Automated verification

Run from the repository root:

```sh
node tests/run-all.js
```

The runner syntax-checks every FastTag JavaScript source and executes each test
file in a separate Node process to prevent shared browser mocks leaking between
suites.

## Still required before a merge or release

1. Create an isolated Stash test-plugin directory with a distinct plugin ID.
2. Keep it disabled whenever the production FastTag plugin is enabled.
3. Run the complete manual regression checklist in `REFACTOR_PLAN.md` using both
   standard Stash and Refract.
4. Compare browser-console errors and update latency with production v4.2.8.
5. Only after successful testing, decide whether to merge, version, package, and
   publish the refactor.
