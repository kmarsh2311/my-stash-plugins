# FastTag refactor status

`feature/runtime-refactor` is an isolated development branch created from the
published FastTag 4.3.0 package commit. It must not be published or copied over
the live plugin until the manual regression checklist in `REFACTOR_PLAN.md` has
passed.

## Current phase

Steps 1–10 are complete. The full automated suite and isolated manual
regression pass succeeded through runtime commit `86c9ae1`; the remaining
commits record the final test results. The three editor families now have independent workflow
contracts. `fasttag-editors.js` owns normalized save snapshots, the
single-editor latest-save gate, shared bounded bulk batching and result totals,
and Edit Everything's serial/latest-save coordination. The coordinator still
owns editor DOM rendering, GraphQL mutations, notifications, live-cache/card
effects, and navigation wiring, supplied to the workflow module through narrow
callbacks. This avoids coupling the distinct single, bulk, and Edit Everything
views merely to reduce file size.

The extracted workflows have focused concurrency, snapshot, delta, progress,
and stale-result coverage. `fasttag.js` has moved from the 839,005-byte baseline
to 556,733 bytes (11,046 lines) without an intentional user-visible change.

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
- `fasttag-editors.js`: selection normalization, single/Edit Everything save
  ownership, bulk-selection deltas, and bounded bulk execution
- `fasttag-workflows.js`: tested result-list and navigation state transitions

`fasttag.js` remains the runtime coordinator and owns editor popup rendering,
global event wiring, navigation, mutation execution, and user-visible effects.

See `ARCHITECTURE.md` for the permanent ownership rules used for future work.

## Automated verification

Run from the repository root:

```sh
node tests/run-all.js
```

The runner syntax-checks every FastTag JavaScript source and executes each test
file in a separate Node process to prevent shared browser mocks leaking between
suites.

## Validation outcome

`STEP10_TEST_RESULTS.md` records the completed isolated test pass across single,
Everything, bulk, sequential/random, scraper, Gemini, preview, Cover Editor,
theme, responsive, standard-card, and Refract workflows. Browser and FastTag
logs were clean in the final session. Stash server-log errors were traced to
macOS notifications and the separate community Path Parser plugin. Gallery
editing could not be exercised because the test library has no galleries; its
shared single-editor path is covered by the other entity editors and automated
tests.

## Handoff

The branch is ready for a local merge into `main`. After merging, reinstall the
normal package, ensure the isolated `fasttag-refactor-test` package is disabled
or removed, enable only normal FastTag, and perform one short smoke test. GitHub
publication remains a separate, explicit action.
