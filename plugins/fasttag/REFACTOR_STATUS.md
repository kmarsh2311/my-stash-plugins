# FastTag refactor status

`feature/runtime-refactor` is an isolated development branch created from the
published FastTag 4.3.0 package commit. It must not be published or copied over
the live plugin until the manual regression checklist in `REFACTOR_PLAN.md` has
passed.

## Current phase

Step 5 is complete. The complete Settings HUD, its tab and control wiring,
validation, close lifecycle, matching presets, Gemini test controls, and system
actions now belong to `fasttag-settings.js`. Its dependencies are injected
explicitly and a smoke test opens the HUD with an isolated browser substitute.
`fasttag.js` has moved from the 839,005-byte baseline to 764,717 bytes without an
intentional behavioural change.

## Extracted modules

- `fasttag-core.js`: formatting, normalization, matching, and scene-card discovery
- `fasttag-entities.js`: entity schema and GraphQL registry
- `fasttag-storage.js`: preferences, recent/pinned entries, and IndexedDB persistence
- `fasttag-integrations.js`: Apollo cache updates and Refract refresh handling
- `fasttag-gemini.js`: Gemini bridge transport and scene parsing
- `fasttag-scraper.js`: discovery, match analysis, entity resolution, and save payloads
- `fasttag-scraper-ui.js`: scraper assessment and review presentation models
- `fasttag-preview.js`: media discovery, scrubbing calculations, and HUD layout
- `fasttag-ui.js`: shared popup sizing and workstation positioning
- `fasttag-editors.js`: selection normalization and bulk-selection deltas
- `fasttag-workflows.js`: tested result-list and navigation state transitions

`fasttag.js` remains the runtime coordinator and owns DOM-heavy popup rendering,
event wiring, navigation, and save orchestration.

See `ARCHITECTURE.md` for the permanent ownership rules used for future work.

## Automated verification

Run from the repository root:

```sh
node tests/run-all.js
```

The runner syntax-checks every FastTag JavaScript source and executes each test
file in a separate Node process to prevent shared browser mocks leaking between
suites.

## Next work

Expand `fasttag-preview.js` into the complete preview controller, including
media selection, scrubbing, floating-HUD lifecycle, restoration, and the Cover
Editor player handoff. This is a higher-risk extraction and requires additional
characterization before implementation moves.

## Still required before a merge or release

1. Create an isolated Stash test-plugin directory with a distinct plugin ID.
2. Keep it disabled whenever the production FastTag plugin is enabled.
3. Run the complete manual regression checklist in `REFACTOR_PLAN.md` using both
   standard Stash and Refract.
4. Compare browser-console errors and update latency with released v4.3.0.
5. Only after successful testing, decide whether to merge, version, package, and
   publish the refactor.
