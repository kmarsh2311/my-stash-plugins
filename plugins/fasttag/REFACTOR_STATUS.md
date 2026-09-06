# FastTag refactor status

`feature/runtime-refactor` is an isolated development branch created from the
published FastTag 4.3.0 package commit. It must not be published or copied over
the live plugin until the manual regression checklist in `REFACTOR_PLAN.md` has
passed.

## Current phase

Step 8 is complete. `fasttag-popup.js` now owns saved popup dimensions,
single/Edit Everything positioning, shared single-editor shell construction,
outside-click and keyboard containment, wheel handling, dragging, eight-way
resizing, abort-controller lifetime, and ordered popup teardown. Editor tables,
selection state, navigation, and automatic saving remain in the coordinator.
The extracted positioning and lifecycle have focused unit coverage, and source
comparison confirmed the shell and listener implementations retained their
previous behaviour at the new dependency boundaries. `fasttag.js` has moved
from the 839,005-byte baseline to 556,208 bytes without an intentional
behavioural change.

## Extracted modules

- `fasttag-core.js`: formatting, normalization, matching, and scene-card discovery
- `fasttag-entities.js`: entity schema and GraphQL registry
- `fasttag-storage.js`: preferences, recent/pinned entries, and IndexedDB persistence
- `fasttag-integrations.js`: Apollo cache updates and Refract refresh handling
- `fasttag-gemini.js`: Gemini bridge transport and scene parsing
- `fasttag-scraper.js`: discovery, match analysis, entity resolution, and save payloads
- `fasttag-scraper-ui.js`: scraper assessment and review presentation models
- `fasttag-scraper-controller.js`: request/HUD lifecycle, result presentation, session caching, and acceptance coordination
- `fasttag-preview.js`: media discovery, scrubbing calculations, and HUD layout
- `fasttag-ui.js`: shared popup sizing and workstation positioning
- `fasttag-popup.js`: shared shell, positioning, event containment, resizing, and close/abort lifecycle
- `fasttag-editors.js`: selection normalization and bulk-selection deltas
- `fasttag-workflows.js`: tested result-list and navigation state transitions

`fasttag.js` remains the runtime coordinator and owns editor popup rendering,
global event wiring, navigation, and editor save orchestration.

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

Characterize editor-specific workflow ownership before moving editor rendering
or state. Keep single, bulk, and Edit Everything behaviour separate until their
selection, navigation, and automatic-save contracts are independently covered.

## Still required before a merge or release

1. Create an isolated Stash test-plugin directory with a distinct plugin ID.
2. Keep it disabled whenever the production FastTag plugin is enabled.
3. Run the complete manual regression checklist in `REFACTOR_PLAN.md` using both
   standard Stash and Refract.
4. Compare browser-console errors and update latency with released v4.3.0.
5. Only after successful testing, decide whether to merge, version, package, and
   publish the refactor.
