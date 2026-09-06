# FastTag modularisation plan

Development continues on the isolated `feature/runtime-refactor` branch created
from released FastTag v4.3.0. Nothing in this branch is copied to the live Stash
plugin or published from `main` unless the refactored build later passes
side-by-side testing.

## Baseline

- Source commit: `4e0e08d` (published FastTag v4.3.0 package)
- `fasttag.js`: 15,529 lines / 839,005 bytes
- Baseline SHA-256: `ef8c0f846ed05db4c9c3d723b70950185dea44889c7531f515a90487394b8d97`
- Runtime format: one browser IIFE with shared closure state
- Stash loads the modules in the order recorded in `REFACTOR_BASELINE.md`

See `REFACTOR_BASELINE.md` for the complete frozen load-order, API, size, and
verification reference.

## Safety rules

1. Never copy refactor files into `~/.stash/plugins/mypluginrc` during normal
   development.
2. Never publish this branch or merge it into `main` before a separate test
   plugin instance has passed the full regression checklist.
3. Extract one subsystem per commit; do not combine extraction with behaviour
   changes or UI redesigns.
4. Keep entity IDs as strings and preserve the existing mutable `Set`
   ownership contracts used by tables, recent chips, suggestions, and saving.
5. Preserve script load order explicitly in `fasttag.yml`.
6. After every extraction, run syntax checks, diff checks, and compare the
   public function/constant inventory against the previous step.

## Current module boundary

The modules will share one explicit `window.FastTag` namespace. They will use
classic scripts loaded in dependency order, matching Stash's current plugin
loader rather than introducing a bundler.

1. `fasttag-core.js`
   - Entity configuration and schema registry
   - GraphQL operations
   - General formatting and escaping helpers
2. `fasttag-storage.js`
   - Preferences and local-storage accessors
   - IndexedDB cache
   - Recent and pinned entries
3. `fasttag-integrations.js`
   - Apollo scene-card synchronisation
   - Refract refresh compatibility
   - Scene-card discovery
4. `fasttag-gemini.js`
   - Gemini bridge connection and parsing
5. `fasttag-scraper.js`
   - Scraper queries, result rendering, and acceptance
6. `fasttag-preview.js`
   - Preview media, scrubbing, and floating video HUD
7. `fasttag-ui.js`
   - Toasts, dialogs, tooltips, shared popup shell, and layout helpers
8. `fasttag-editors.js`
   - Single-entity, bulk, and Edit Everything workflows
9. `fasttag.js`
   - Shared runtime state, startup, and global event wiring

These are target ownership boundaries, not an instruction to move everything
at once. Boundaries may be adjusted when dependency mapping shows that a
smaller extraction is safer.

## Extraction sequence

### Stage 1: establish the module contract

- Introduce the `window.FastTag` namespace in the refactor copy only.
- Keep the original IIFE operational while exposing narrowly selected helpers.
- Add new files to `fasttag.yml` only when they contain working code.
- Confirm that startup still occurs exactly once.

### Stage 2: pure and low-state helpers

- Extract escaping, formatting, normalization, and scene-card discovery.
- Verify outputs against representative inputs before and after extraction.
- This stage must not change GraphQL, popup, or save behaviour.

### Stage 3: storage and caching

- Extract preference accessors, recent/pinned storage, and IndexedDB caching.
- Confirm cache keys and stored data formats remain byte-for-byte compatible.

### Stage 4: isolated integrations

- Extract Apollo/Refract card refresh code.
- Test standard Stash and Refract after tag, performer, studio, and organised
  updates.

### Stage 5: Gemini, scraper, and preview

- Move each feature separately, retaining its existing API and timeouts.
- Test each extraction before beginning the next one.

### Stage 6: editors and shared UI

- Extract shared popup infrastructure before reducing duplicated editor code.
- Do not deduplicate single/bulk workflows until their current behaviour has
  characterization coverage.

## Regression checklist before any merge

- Single Tag, Performer, Studio, and Gallery editors
- Edit Everything, including suggestions and recent/pinned pills
- Bulk editors and partial-failure reporting
- Sequential and random-scene navigation
- Scraper field checkboxes and separate cover save
- Gemini connection, timeout, parsing, and fallback behaviour
- Organised-state updates
- Preview/full-video switching and scrubbing
- Standard and Refract scene-card real-time refresh
- Right-click metadata area versus native preview-media context menu
- Left-click entity-icon shortcuts
- Dark and light themes
- Desktop, tablet-width, and phone-width layouts

## Next implementation target

Add characterization and lifecycle coverage for the coordinator's DOM-heavy
workflows before moving more implementation. The first subsequent extraction
will separate diagnostics, GraphQL transport, and notifications without
changing their user-visible behaviour.
