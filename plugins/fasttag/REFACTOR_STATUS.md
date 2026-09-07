# FastTag refactor status

`feature/runtime-refactor` is an isolated development branch created from the
published FastTag 4.3.0 package commit. It must not be published or copied over
the live plugin until the manual regression checklist in `REFACTOR_PLAN.md` has
passed.

## Current phase

Step 9 is complete and Step 10 manual validation is in progress against staged
runtime commit `2af6e6d`. The three editor
families now have independent workflow
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

## Next work

The `fasttag-refactor-test` package has been staged from runtime commit
`2af6e6d` with a distinct manifest filename, display name, plugin task ID, and
help-asset path. The released `fasttag` plugin is disabled and the isolated test
build is now enabled for manual validation.
Follow `STEP10_TEST_RESULTS.md` to switch safely from the live plugin and run the
complete checklist against standard Stash and Refract. Do not merge or publish
the refactor until that manual pass is complete.

## Still required before a merge or release

1. Keep the test package disabled whenever the production FastTag plugin is enabled.
2. Run the complete manual regression checklist in `REFACTOR_PLAN.md` using both
   standard Stash and Refract.
3. Compare browser-console errors and update latency with released v4.3.0.
4. Only after successful testing, decide whether to merge, version, package, and
   publish the refactor.
