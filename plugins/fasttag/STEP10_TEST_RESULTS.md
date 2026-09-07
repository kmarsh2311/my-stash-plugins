# FastTag Step 10 test results

## Test build

- Source branch: `feature/runtime-refactor`
- Runtime source commit: `2af6e6d`
- Test plugin ID: `fasttag-refactor-test`
- Test installation: `~/.stash/plugins/fasttag-refactor-test`
- Live plugin ID: `fasttag` (installed from package directory `mypluginrc`)

The test package is listed under `plugins.disabled` in the Stash configuration.
Never enable it while the live FastTag plugin is enabled.

## Automated preflight

- [x] Source working tree clean before staging
- [x] Full source verification: 20 JavaScript syntax checks
- [x] Full source verification: 2 Python syntax checks
- [x] Full source verification: 21 test suites
- [x] Test-package JavaScript syntax checks
- [x] Test-package Python syntax checks
- [x] Test package differs from source only by its marker and required plugin-ID/name paths
- [x] Test plugin remains disabled after installation

## Safe activation

- [x] Disable live **FastTag** (`fasttag`) in Stash
- [x] Confirm its button changes from **Disable** to **Enable**
- [x] Reload plugins so the distinct test manifest is listed
- [x] Enable **FastTag Refactor Test** (`fasttag-refactor-test`)
- [x] Hard-refresh the browser and confirm the test plugin opens

## Manual regression checklist

- [x] Single Tag editor
- [x] Single Performer editor and hover preview
- [x] Single Studio editor
- [ ] Single Gallery editor — unavailable: test library currently has no galleries
- [x] Single-editor automatic save and refresh
- [x] Single-editor sequential previous/next navigation
- [x] Edit Everything tags, performers, studio, and groups
- [x] Recent and pinned pills
- [x] Suggestions and global search
- [x] Edit Everything automatic save
- [x] Sequential navigation with dirty metadata
- [x] Random-scene navigation and history
- [x] Bulk single-entity editing
- [x] Bulk Edit Everything
- [x] Bulk partial-failure reporting and retry behavior
- [x] Scraper search, filtering, navigation, and dismissal
- [x] Scraper field checkboxes and acceptance
- [x] Separate StashDB ID and cover saving
- [x] Scraper performer image enrichment
- [ ] Gemini bridge start, parse, timeout, and fallback behavior
- [x] Organized-state updates
- [ ] Preview/full-video switching and scrubbing
- [ ] Floating video and scraper HUD lifecycle
- [ ] Cover Editor capture, upload, paste/drop, save, and navigation
- [ ] Standard Stash scene-card refresh
- [ ] Refract scene-card refresh
- [ ] Right-click metadata menu and native media context menu
- [ ] Left-click entity-icon shortcuts
- [ ] Dark and light themes
- [ ] Desktop, tablet-width, and phone-width layouts
- [ ] Browser console checked for new FastTag errors
- [ ] Stash log checked for new FastTag errors

## Results and defects

Record each failure with the scene ID, editor/mode, exact action, expected
result, actual result, browser-console message, and whether it reproduces after
switching back to the released live plugin.

### Fixed during testing

- Single Tag add/remove and sequential navigation saved and refreshed correctly.
- The first pass exposed `ReferenceError: searchClear is not defined` after a
  searched row was selected. It also exposed Tabulator warnings caused by
  missing-row lookups and attempts to remove unregistered selection events.
  Commit `4a2e2c2` fixes all three sources and adds regression assertions. The
  isolated test package was refreshed from that commit. After reloading plugins
  and hard-refreshing, the same add/remove and sequential actions produced no
  console errors or repeated Tabulator warnings.
- The Organised pill and search action both worked. Automatic organisation did
  not initially run because **Auto-Mark Scene as Organised** was disabled; once
  enabled, metadata changes correctly marked scenes Organised in both the
  single editor and Edit Everything.
- Single Performer and Studio editing saved correctly. Closing either editor
  exposed two remaining Tabulator warnings from shared popup teardown. Commit
  `ab02acf` removes those redundant event-removal calls; table destruction
  remains responsible for releasing all handlers.
- Initial Edit Everything table rendering could request redraws before Tabulator
  emitted its `tableBuilt` event. Commit `1839674` guards every coordinator and
  popup redraw against Tabulator's initialization state. After reloading the
  plugin and clearing the console, opening and closing both the Performer and
  Studio editors produced no new console messages.
- Edit Everything metadata changes occasionally exposed Apollo's warning that
  a performer reference was not yet part of its normalized store. Commit
  `dbd0f2b` makes tag, performer, and studio references merge their returned
  entity data into the store during direct scene-card synchronization. Saving
  was already successful. After reloading, Edit Everything tag, performer,
  studio, and group changes worked and the Apollo warning did not recur. The
  remaining grey navigation-object messages originate from generic injected
  `javascript`, contain no warning/error severity, and are not emitted by any
  FastTag logging statement.
- Recent tag pills and automatic suggestions appeared and applied correctly.
  Pinned tag and performer pills also applied correctly in every editor mode
  and remained available after reopening FastTag. Global search found and
  applied existing metadata correctly. Edit Everything changes saved
  automatically throughout these tests.
- In sequential Edit Everything mode, metadata saved quickly enough to complete
  before the immediate Next Scene action. Returning to the previous scene
  confirmed that the change persisted and navigation loaded the correct scene.
- Random Scene navigation worked across several scenes; backward and forward
  controls traversed the same scenes in the correct history order.
- Bulk single-entity Tag editing added a tag to every selected scene and then
  removed it from every selected scene; the affected cards updated correctly.
- With the browser temporarily Offline, Bulk Edit Everything reported that all
  updates failed, kept the editor open, and exposed Retry Changes. Restoring
  connectivity and retrying updated every selected scene successfully. The
  automated workflow test separately verifies mixed-success result totals.
- Bulk Edit Everything applied and removed metadata across all selected scenes,
  reported the expected outcome, and produced no browser-console errors.
- Navigating while the scraper HUD remained open left the previous scene's
  result visible until the new scrape completed. Commit `ce9a29c` replaces it
  immediately with a scene-neutral loading state in docked and detached modes,
  while retaining the existing request-generation ownership guard. Browser
  testing confirmed the previous result disappears immediately and the HUD
  remains stable while the next scene is scraped.

### Post-validation polish

- Consider a lightweight CSS-only scraper-loading illustration: a magnifying
  glass scanning small moving video-file tiles, with reduced-motion support.

### Confirmed working

- Scraper search population and adjustment, false-positive/result-limit
  controls, candidate navigation, dismissal, and cross-scene loading behaviour
  worked without new functional errors. CSP messages for optional third-party
  source maps were classified as harmless developer-tool noise.
- Scraper acceptance respected individual field selections: checked metadata
  saved and refreshed immediately, while unchecked fields remained unchanged.
- Performer-image enrichment populated missing performer artwork successfully
  during scraper acceptance and produced no console errors.
- At narrow saved HUD widths, the fixed-width scraper header could place Accept
  beyond the right edge. The first wrapping adjustment kept it horizontally
  bounded but allowed its second line to sit behind the search row. Commit
  `dd95e82` introduced a measured compact layout, but browser testing showed
  that its flexible height could still overlap the search row. Commit `51b81eb`
  uses two explicit grid rows and reserves 52px below 370px, while retaining one
  row at normal widths.
- Closing the floating scraper HUD could allow its ResizeObserver to persist the
  removed element's `0px` dimensions. CSS then forced every subsequent opening
  to the cramped 300px minimum. Commit `d75a1a8` disconnects HUD observers before
  removal, ignores detached or invalid dimensions, and migrates an invalid saved
  size back to the 390×480 default. Browser testing confirmed that valid resized
  dimensions are remembered again.
- The initial compact-header correction used a fixed 370px breakpoint, so it
  sometimes moved the controls to a second row even though their actual contents
  still fitted. Commit `270bb96` measures the title and action controls on every
  resize and uses the second row only when they genuinely overflow. Browser
  testing confirmed the controls remain on one row when they fit.
- The header's previous “Source Match” wording was both truncated at narrow
  widths and could imply that an unconfirmed candidate was correct. Commit
  `2af6e6d` displays only the actual scraper source name, such as “StashDB”.
  Browser retest pending.
- Accepting a StashDB result stored the correct remote scene ID. With Cover
  selected it also saved the remote cover; with Cover cleared it retained the
  existing cover while still storing the ID. No warnings or console errors
  occurred.
