# FastTag refactor status

`feature/runtime-refactor` is an isolated development branch created from the
published FastTag 4.3.0 package commit. It must not be published or copied over
the live plugin until the manual regression checklist in `REFACTOR_PLAN.md` has
passed.

## Current phase

Step 3 is complete. In addition to the 4.3.0 baseline in
`REFACTOR_BASELINE.md`, `fasttag-runtime-characterization.test.js` now protects
the coordinator's startup ownership, popup and HUD cleanup, scraper request
generations, scene rebinding, sequential navigation, Cover Editor handoff, and
serialized Edit Everything saves.

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

Begin the first low-risk extraction by separating GraphQL transport,
notifications, and diagnostics behind explicit module APIs. Preserve the
characterized ordering and behaviour and move only one responsibility per
commit.

## Still required before a merge or release

1. Create an isolated Stash test-plugin directory with a distinct plugin ID.
2. Keep it disabled whenever the production FastTag plugin is enabled.
3. Run the complete manual regression checklist in `REFACTOR_PLAN.md` using both
   standard Stash and Refract.
4. Compare browser-console errors and update latency with released v4.3.0.
5. Only after successful testing, decide whether to merge, version, package, and
   publish the refactor.
