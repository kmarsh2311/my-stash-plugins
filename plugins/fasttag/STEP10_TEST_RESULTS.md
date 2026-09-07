# FastTag Step 10 test results

## Test build

- Source branch: `feature/runtime-refactor`
- Runtime source commit: `d05c4fb`
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

- [ ] Single Tag editor
- [ ] Single Performer editor and hover preview
- [ ] Single Studio editor
- [ ] Single Gallery editor
- [ ] Single-editor automatic save and refresh
- [ ] Single-editor sequential previous/next navigation
- [ ] Edit Everything tags, performers, studio, and groups
- [ ] Recent and pinned pills
- [ ] Suggestions and global search
- [ ] Edit Everything automatic save
- [ ] Sequential navigation with dirty metadata
- [ ] Random-scene navigation and history
- [ ] Bulk single-entity editing
- [ ] Bulk Edit Everything
- [ ] Bulk partial-failure reporting and retry behavior
- [ ] Scraper search, filtering, navigation, and dismissal
- [ ] Scraper field checkboxes and acceptance
- [ ] Separate StashDB ID and cover saving
- [ ] Scraper performer image enrichment
- [ ] Gemini bridge start, parse, timeout, and fallback behavior
- [ ] Organized-state updates
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
