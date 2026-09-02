# Changelog

All notable changes to the **FastTag** Stash plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [4.1.0] - 2026-09-02

### Added & Improved
- **🤖 AI Smart Parser (Google Gemini Beta)**:
  - **1-Click Scene Parsing**: Click **`✨ AI Parse`** in Edit Everything to automatically extract clean scene titles, release dates, studios, performers, and tags from messy filenames using Google Gemini.
  - **Local WebSocket Bridge**: Ships with lightweight Python bridge daemon (`fasttag_gemini_bridge.py`) and Stash tasks (`fasttag_task.py`) listening locally on port `9998`, bypassing browser CORS / Content-Security-Policy network restrictions.
  - **Intelligent Multi-Model Failover**: Automatically cascades across up to 5 models (`gemini-flash-latest`, `gemini-flash-lite-latest`, `gemini-3.8-flash`, `gemini-3.7-flash`, `gemini-3.5-flash`) on Google 429 rate limit quotas.
  - **1-Click Entity Creation**: Shows purple dashed buttons (`+ Create "Name"`) for missing performers, studios, and tags directly inside the suggestions card.
  - **Sequential Navigation Lifecycle**: Automatically clears and hides AI cards when advancing scenes, re-parsing only when auto-parse is enabled.
  - **Settings Integration**: Dedicated **🤖 AI** tab in FastTag Settings with API key storage, model selector, auto-parse toggle, and live connection testing.
- **💡 Enhanced Suggestion Engine**:
  - **Adjacent-Token Compound Word Joining**: Multi-word tokens in filenames (e.g., `Only Fans`, `Deep Throat`, `Step Brother`) now properly match single-word tags (`Onlyfans`, `Deepthroat`, `Stepbrother`).
  - **Plural & Singular Stemming**: Flexible stemming matches plurals and singulars (e.g. `Tattoos` ➔ `Tattoo`, `Piercing` ➔ `Piercings`).
  - **Space-Agnostic Fuzzy Matching**: Handles camelCase vs lowercase database differences seamlessly.
  - **Status Indicators**: Displays emerald green checkmark (`✓`) for tags and performers already added to the scene.
- **🎨 Real-Time Refract Theme Compatibility**:
  - Automatically clears Refract theme's processed card markers and performer circles whenever tags, performers, or studios are saved.
  - Triggers Refract's MutationObserver to immediately re-render updated performer avatar circles and studio badges on scene cards in real time without requiring a manual page reload.
- **🛠️ Bug Fixes & Refinements**:
  - **Universal Toast Copying**: Added off-screen textarea fallback to ensure toast **📋 Copy** button works universally across plain HTTP, HTTPS, and local network IP connections.
  - **Toast Duration**: Extended error toast visibility to 8 seconds with hover pause.
  - **Zero-Latency Table Loading**: Pre-populates Tabulator tables from memory cache (`getCachedOrNull`) to eliminate the brief *"No tags found"* placeholder flash.
  - **Keyboard Navigation**: Enter key properly toggles highlighted items in single-entity popups without jumping scenes.

---

## [4.0.1] - 2026-09-01

### Added & Improved
- **⚙️ Card Icon Click Toggle**:
  - Added `Enable Card Icon Clicks` setting in **⚙️ FastTag Settings ➔ 🎨 Display** tab.
  - Allows users to disable left-clicking scene card badge icons so FastTag popups only open via the right-click context menu.

---

## [4.0.0] - 2026-09-01

### Major Release Highlights & UI Overhaul
- **🎨 Category Tabbed Settings Suite**:
  - Completely redesigned FastTag Settings into 4 compact, dedicated category tabs:
    - **Display & UI**: Theme, Show ID Column, Smart Suggestions, Recent Items, Pinned Items.
    - **Video & Playback**: Always Play Full Video, Video Scrubbing Speeds (Slow, Normal, Fast, Shift Freeze, Reset Defaults).
    - **Scraper & Workflow**: Auto-Scrape in Sequential Mode, Detach Scraper Sidecar.
    - **System & Diagnostics**: Layouts Reset, Debug Mode toggle, 250-entry Flight Recorder buffer, Copy/Download Logs, Trash clear.
  - Replaces long vertical scrolling with a sleek, compact 0-scroll tabbed interface.
- **🎨 Vibrant Vector SVG Icons**:
  - Replaced grey emojis in Studio and Group header bars with glowing, high-definition SVG icons:
    - **Studio**: Indigo Cinema Camera (`#818cf8`) with soft glow shadow.
    - **Group**: Amber Filmstrip (`#f59e0b`) with soft glow shadow.
- **🎬 Always Play Full Video & Cross-Platform <kbd>Option+V</kbd> / <kbd>Alt+V</kbd> Shortcut**:
  - Added "Always Play Full Video" toggle in Settings to automatically stream the full video when opening scenes instead of short preview clips.
  - Added instant keyboard shortcut: **<kbd>Option+V</kbd> (Mac)** / **<kbd>Alt+V</kbd> (Windows/Linux)** to toggle between Full Video Stream and Preview on the fly.
  - Native input interception prevents Mac keyboards from typing the special character `√` into search boxes.
  - Automatic 800ms retry logic for network stalls and sleeping NAS hard drives, with calm, friendly toast feedback for unsupported video codecs.

---

## [3.9.7] - 2026-09-01

### Added & Improved
- **🎲 Random Untagged Scene Mode**:
  - Added dedicated Random Mode accessible from the scene card context menu (`🎲 Random Untagged Scene`).
  - Automatically queries Stash GraphQL for random untagged scenes in your library and opens them directly in FastTag.
  - Dedicated Random Mode header displays remaining backlog counter (`⚡ 🎲 [X untagged] Scene Title`) and hides sequential controls.
  - Prominent **`[ 🎲 Next Random Scene ]`** bottom footer button styled with a vibrant sunset gradient, soft ambient glow, hover shimmer, and animated 3D keyframe dice spin on roll.
  - Secret power-user hotkey: <kbd>Ctrl+Enter</kbd> (PC/Linux) and <kbd>Cmd+Enter</kbd> (Mac) rolls the next random untagged scene, while plain <kbd>Enter</kbd> is safely locked to prevent accidental scene skips.
- **Smart Popularity-Driven Search**:
  - When actively searching, results are now sorted purely by **Match Relevance & Scene Count (popularity)** across all modals, ensuring popular tags (e.g. `Blond Hair`) always appear at the top.
  - Selected tags/performers remain pinned at the very top of tables when search is empty for instant review and 1-click removal.
- **Video Preview Aspect Ratio Scaling**:
  - Changed video and image preview rendering to `object-fit: contain`. Popped-out floating video HUD and embedded preview windows now scale the full video frame smoothly without cropping or cutting off logos/subtitles.

---

## [3.9.6] - 2026-09-01

### Fixed & Improved
- **SQLite-Accurate `Stash Sort Name` Collation**:
  - `Stash Sort Name` on Tags now compares strings using raw ASCII character collation (`!` $\rightarrow$ `0-9` $\rightarrow$ `_` $\rightarrow$ `A-Z`), matching Stash's backend `COLLATE NOCASE` query 1:1.
  - Tag sorting now perfectly honors custom prefix markers (e.g. `!Favorite` at top, `zzz_Junk` at bottom).

---

## [3.9.5] - 2026-08-31

### Added & Improved
- **Real-Time Auto-Save in Edit Everything**:
  - Tags, performers, studios, groups, suggestion pills, and recent chips now auto-save immediately to Stash GraphQL in the background on every interaction with instant toast feedback.
- **Streamlined Action Buttons**:
  - Unified footer buttons across single-scene modes with a clean, full-width <kbd>Done</kbd> button in normal mode and <kbd>Next Scene ►</kbd> in sequential mode.
- **Settings Toggles for Recent & Pinned Items**:
  - Added user preference switches in FastTag Settings to toggle **Show Recent Items** (ON/OFF) and **Show Pinned Items** (ON/OFF) across all modals.
  - When switched off, quick history containers are hidden to maximize vertical space for table rows.
  - Keyboard navigation seamlessly adapts and bypasses hidden chip sections.

---

## [3.9.4] - 2026-08-31

### Fixed & Improved
- **Smart Suggestions Accuracy & False-Positive Elimination**:
  - Eliminated parent directory bleed: Suggestions are now strictly derived from the scene file's basename, excluding all parent folder paths.
  - Eliminated scene card DOM scraping: Stopped parsing raw HTML from card elements (avoiding resolution, codec, duration, and hover preview text contamination).
  - Added video release noise filtering (stripping `1080p`, `4k`, `hevc`, `x264`, `x265`, `aac`, `webrip`, `bluray`, etc.).
  - Added stop-word guard to prevent short common English words in secondary performer/tag aliases from generating spurious suggestions.
  - Excluded already-assigned items from appearing in the suggestions container.
- **Edit Everything & Bulk Everything Search Input Stability**:
  - Replaced Tabulator `rowSelected` / `rowDeselected` events with direct human `rowClick` handlers. Programmatic row selection and background column filtering during fast typing can no longer clear the search console.

---

## [3.9.3] - 2026-08-31

### Critical Bug Fixes & Stability Hardening
- **Decoupled Database Saves from Tabulator Lifecycle Events**:
  - Eliminated phantom tag wipes during scene transitions and DOM teardowns by moving database save triggers strictly to genuine user interactions (`rowClick` and <kbd>Enter</kbd> keypress). Tabulator's internal `setData()`, `deselectRow()`, and sorting operations can no longer trigger accidental background saves.
- **Sequential Navigation Scene Target Isolation**:
  - Fixed a critical scene ID target mismatch in sequential mode where navigating to the next scene could overwrite the preceding scene's tags.
  - Scene IDs are now dynamically resolved from the active modal form and strictly synchronized on every scene transition.
- **Event Listener Stacking Elimination Across Scenes**:
  - Replaced `addEventListener` with direct property assignments (`filterInput.onkeydown`, `globalSearch.onkeydown`, `form.onclick`) so advancing through scenes never stacks duplicate event listeners or executes stale closures holding previous scenes' data.
- **Single Edit Modal Viewport & Table Auto-Recalculation**:
  - Added explicit Tabulator `redraw(true)` calls to ensure tables immediately claim 100% of available flex container height when suggestions and recent chip containers expand.
  - Increased minimum modal height to 480px (with optimal height 580–680px) for comfortable multi-row visibility.
- **Search Deselection Scroll Reset**:
  - Deselecting an item from search now clears keyboard row navigation indexes and cleanly resets the scroll container directly to the top (`scrollTop = 0`).

---

## [3.9.2] - 2026-08-31

### Fixed & Improved
- **Search Input Bug Fix (Disappearing Letters)**:
  - Fixed an issue where typing queries (such as `l` or `I`) would wipe search text 100ms after typing due to automatic re-selection triggering legacy search-clearing handlers.
  - Table row selections and deselections now preserve search input state smoothly.
- **Edit Everything Save & Selection Workflow**:
  - Selecting/deselecting tags, performers, studios, or groups updates selection state and marks the **Save Scene** button dirty without prematurely firing `doSave()` GraphQL mutations or premature toasts.
- **Scraper Accept Hotkey Input Guard**:
  - Global <kbd>Enter</kbd> key listener now guards against capturing <kbd>Enter</kbd> while the user is actively typing in a search box or text input.
- **Scraper Sidecar 8-Direction Resizing**:
  - Added 8-directional edge and corner resize handles (N, S, E, W, NE, NW, SE, SW) to the floating scraper HUD with coordinate clamping and size persistence.
- **Scraper Header & Match Badge Visual Polish**:
  - Locked scraper header to a single flex row to prevent button clipping.
  - Sized match counter badge with breathing violet glow animation and clean rounded corners with no border clipping.
- **Edit Everything Scraper Compatibility**:
  - Added context getters to support accepting and saving scraped metadata directly within the Edit Everything modal.

---

## [3.9.1] - 2026-08-31

### Fixed & Improved
- **Full Keyboard Navigation Loop & Recent Chips Support**:
  - Integrated **Recent** chips into the keyboard navigation loop for Edit Everything, Bulk Edit Everything, Single Edit, and Bulk Single Edit modals.
  - Added full 8-section vertical/horizontal flow: Studios/Groups $\leftrightarrow$ Suggestions $\leftrightarrow$ Recent $\leftrightarrow$ Main Table rows $\leftrightarrow$ Create Button.
- **Search-Aware Initial Navigation Landing**:
  - When the search box is **empty**, pressing <kbd>↓</kbd> lands on **Suggestions pills** first, then **Recent chips**, then **Main Table rows**.
  - When the search box has an active **search term**, pressing <kbd>↓</kbd> jumps directly into the **Main Table rows** for rapid search-and-select ergonomics.
  - Pressing <kbd>↑</kbd> from an empty search box jumps straight into the Studio / Group bar.
- **Mouse & Keyboard Focus Synchronization**:
  - Clicking any table row immediately syncs the keyboard active row highlight (`activeNavIndex` / `singleNavIndex`).
  - Clicking inside modal backdrops/containers automatically refocuses the search input with `{ preventScroll: true }`, ensuring arrow keys and keyboard shortcuts never lose focus.
  - Row focus styling unified across entire row with context-aware `#38bdf8` electric blue highlight when selecting/deselecting.

---

## [3.9.0] - 2026-08-31

### Added & Improved
- **Split Studio & Group Metadata Bar**:
  - Pinned Studio (`🏢`) and Group (`📁`) icon prefixes with horizontal scrolling and subtle watermark names when empty.
  - Symmetrical `No matching studio` / `No matching group` feedback on search misses.
  - Solid gradient selected pills with one-click `✕` remove vs ghost dashed suggestion chips with accented `+` prefix.
  - Hidden scrollbar tracks for clean, full-height pill clicking and smooth mouse-wheel / trackpad horizontal scrolling.
- **Full Keyboard Navigation (<kbd>↑</kbd> Up Arrow)**:
  - Press <kbd>↑</kbd> to jump focus straight into Studio & Group chips from the search box or table top.
  - Navigate between chips using <kbd>←</kbd> / <kbd>→</kbd> / <kbd>Tab</kbd> with curved, entity-matched glowing focus rings.
  - Press <kbd>Enter</kbd> to select or remove chips with instant scene auto-save, search reset, and focus return.
- **Smart Scene-Count Search Ranking**:
  - Filtered search results automatically rank matches by usage frequency (`scene_count` descending), bringing your most frequently assigned tags and performers to the top.
  - Full compatibility with all custom browsing sort options when search is cleared.

---

## [3.8.1] - 2026-08-30

### Added & Improved
- **Auto-Scrape in Sequential Mode (Edit Everything)**:
  - Automatically fetches and displays StashDB/scraper matches when stepping through scenes in Sequential Mode (`Next Scene ►` / <kbd>Alt</kbd> + <kbd>→</kbd>).
  - Dedicated toggle setting in `⚙️ FastTag Settings` with persistent sidecar continuity and session cache protection.
- **Sleek Proportional Sizing & Layout Polish**:
  - Single edit popups default to a sleek `345px × 660px` (fits 9–11 visible rows).
  - Edit Everything optimized with compact `205px` docked video player and spacious `860px × 760px` layout (fits 10–12 rows).
- **Enlarged Sidecar Poster**:
  - Adaptively enlarged poster thumbnail in the sidecar HUD (`148px × 94px`) while preserving the high-res 350px hover zoom preview.
- **Toast Notifications Z-Index**:
  - Layered toast notifications at `z-index: 20,000,000` so notifications render crisp and unobscured in front of modal backdrops.

---

## [3.8.0] - 2026-08-30

### Added & Improved
- **Detachable Scraper Sidecar HUD & 3-Window Multi-Tasking**:
  - Pop out the StashDB Scraper Match Card into its own floating, draggable, resizable sidecar window (`⤢ Pop Out`).
  - Seamless multi-window workflow with simultaneous floating Video player, Scraper Match Card, and FastTag main popup.
- **Smart 3-Pane Zero-Overlap Layout Matrix**:
  - Resolution-aware positioning with strict collision avoidance (`enforceZeroOverlap`) preventing windows from overlapping across all grid columns (Columns 1–6).
- **Header-Streamlined Actions**:
  - Moved the **`✓ Accept`** action directly into the top header row of the Scraper Match Card, eliminating the bottom bar for 100% vertical preview space.
- **Offline & Docker CSP Compatibility**:
  - Bundled local `tabulator.min.js` and `tabulator.min.css` directly in the plugin directory to comply with strict Content-Security-Policy (`script-src 'self'`) and support offline/air-gapped Docker instances.
  - Replaced external Toastify dependency with a native, zero-dependency floating toast engine.

---

## [3.7.0] - 2026-08-28

### Added & Improved
- **Performer Hover ID Card & Visual Matcher**:
  - Hovering over any Performer row in **`⚡ Edit Everything`**, **`Edit Performers`**, or **Bulk Tagging** opens a sleek frosted glass ID badge.
  - **Large High-Resolution Photo**: Clear `110px × 146px` portrait headshot with fallback icon support.
  - **Instant Metadata Breakdown**: Displays Performer Name, Star Rating (`★★★★☆`), Disambiguation details, Country flag (`🇺🇸 US`), Gender badge (`♀ Female` / `♂ Male` / `⚧ Trans`), Age (`29 yrs`), Ethnicity, and Known Aliases (`aka: ...`).
  - **1-Click Profile Navigation**: Click anywhere on the card to open that performer's full profile page in Stash (`/performers/{id}`) in a new browser tab.
  - **Smart HUD Collision Avoidance**: Automatically detects where the floating video HUD is positioned and directs the card to the opposite side so your video playback is never obstructed.
  - **Snappy 100ms Hover Intent**: Rapid mouse sweeps stay smooth and flicker-free.

---

## [3.6.0] - 2026-08-28

### Added & Improved
- **Floating Video Popout HUD**:
  - Click the floating **`⤢`** button on the video player to pop the video out into a resizable, draggable floating window with a crisp black accent border.
  - FastTag's video slot collapses into a sleek 33px placeholder bar (`Video detached in Floating HUD`), expanding 100% vertical space for Tag and Performer tables.
  - **1-Click Docking**: Click anywhere on the placeholder bar or the **`⤝`** button to instantly snap the video back into FastTag.
  - **Smart Non-Overlapping Spawning**: Automatically calculates 2x visual docked size and spawns beside the FastTag popup with 0% overlap (auto-shifting Edit Everything if needed).
  - **Sequential Session Persistence**: Remembers custom position and enlarged size across all subsequent scenes (`Next Scene ►` / `Alt + →`) without resetting until FastTag is closed.
  - **Zero-Flash Transitions**: Floating window stays permanently mounted during sequential navigation with smooth in-place video replacement.
  - **Smart Drag & Resize Isolation**: Direct-surface window dragging with a `24px` bottom-right corner exclusion zone for smooth native resizing.
- **Full Video Stream Scrubbing**: Click the floating `🎬 Full Video` pill in the 16:9 media box to switch from looping preview clips to the scene's full stream with interactive mouse wheel scrubbing.
- **Dynamic Velocity-Based Scrubbing**: Wheel scrubbing automatically calculates step sizes based on scroll velocity with customizable tiers (*Slow*, *Normal*, *Fast*).
- **Hold Shift to Freeze & Frame Scrub**: Holding the <kbd>Shift</kbd> key pauses auto-resume and switches scrubbing to precision frame stepping.
- **Configurable Scrub Speeds in Settings**: Dedicated section in `⚙️ FastTag Settings` with real-time auto-saving to customize Slow (0–30s), Normal (0–60s), Fast (0–120s), and Freeze (0.1–10s) speeds.
- **Cinematic Lordicon Animated Mouse Cue**:
  - Vector mouse with animated Lordicon scroll wheel and static teal directional chevrons.
  - High-contrast frosted glass mouse mat backdrop with micro-pill hint (`Scroll to scrub • Hold Shift to freeze`).
  - 3.0s initial video breathing room pause, 1.5s slow cinematic fade-in, and 4.5s on-screen presence.
- **Progressive Onboarding Smart Decay**: The interactive scrubbing cue automatically displays during the first 5 sessions to train the user, then permanently retires for zero clutter. Protected against spam in sequential mode.
- **Tabulator Dark Mode Background Polish**: Forced all virtual DOM row states to `#0f172a`, completely eliminating white row divider line flicker artifacts.

---

## [3.5.3] - 2026-08-28

### Added & Improved
- **Automatic Scene Cover / Screenshot Fallback**: When opening FastTag or navigating sequentially across scenes where no preview video (`.mp4`) or animated `.webp` has been generated, FastTag seamlessly displays the scene's static cover screenshot in the 16:9 media box instead of collapsing or hiding the preview container.
- **Graceful Error Recovery**: If a preview video URL returns a 404 or fails to load, FastTag instantly catches the error and transitions to the scene cover image without interruption.

---

## [3.5.2] - 2026-08-28

### Polish & Improvements
- **General UI & Performance Refinements**: Minor UI polish, toast animation timing optimizations, and internal milestone tracking.

---

## [3.5.1] - 2026-08-27

### Performance & Hardening
- **3-Worker Concurrency Pool for Bulk Tagging**: Upgraded bulk scene save execution from a sequential loop to a parallel 3-worker concurrency pool, delivering up to a 3x speedup on multi-scene saves while remaining 100% safe against SQLite database write contention.
- **Strict Bulk Checkbox Targeting**: Refined `getBulkSelectedScenes()` to query checkboxes strictly within scene cards, preventing top filter bar checkboxes or settings toggles from interfering with bulk selections.
- **Hardened DOM Scope**: Removed generic `.card` selector from global click and contextmenu listeners, ensuring FastTag only attaches to real scene cards and completely ignores non-scene pages (*Tags, Performers, Settings*).

---

## [3.5.0] - 2026-08-27

### Added
- **Smart Auto-Save Architecture**:
  - Top quick actions (*Suggestions, Recent 1–9 pills, Studio Bar, and Created Entities*) auto-save immediately to the scene.
  - Search & select: Searching for an item and clicking it immediately selects it, clears search, and auto-saves to the scene.
  - List browsing: Browsing and selecting items in the lower tables without an active search allows multi-item review without triggering premature saves.
- **Save-in-Place (Keeps Popup Open)**: Clicking `Save Tags` / `Save Scene` saves selections immediately to Stash and keeps the popup open so you can continue tagging without interruption.
- **State-Aware Save Button with Dynamic Breathing Pulse**:
  - Dimmed/disabled button (`opacity: 0.45`, `cursor: not-allowed`) when clean (everything saved).
  - Lights up Emerald Green with a gentle breathing pulse when pending changes exist.
  - View-specific pulse speeds: **1.8s** for single views, **2.4s** for Edit Everything.
- **Universal Entity Creation Modal**:
  - Creating a new Tag or Performer from any view (*Edit Tags, Edit Performers, Edit Everything, Bulk Tagging*) opens a confirmation popup to verify spelling, aliases, or cancel before creating.
- **Universal Search Shortcut Indicator (`/`)**: Added `/` shortcut badge into search boxes across all single and bulk views.
- **Unified 3-Second Confirmation Toasts**: Merged dual creation + save notifications into single clear toasts.

### Fixed
- Fixed Tabulator table scroll jumping back to the top when checking/unchecking items.
- Fixed non-performer suggestions bleeding into the Performer Suggestions box in Edit Everything.
- Fixed duplicate event listener stacking on sequential navigation arrows (`◄` / `►`).
- Added dirty-check before saving on sequential navigation so browsing scenes without edits does not spam save requests.

---

## [3.4.0] - 2026-08-27

### Added
- **FastTag Settings Modal (`⚙️ FastTag Settings...`)**: Dedicated settings screen in the context menu to customize preferences without popup clutter.
- **Hide / Show ID Column Toggle**: Option in settings to toggle the numeric database ID column on and off across all popups. Defaults to ON for backwards compatibility. When disabled, Name and Title columns expand to fill 100% of the table width.
- **Gallery Title Auto-Fallback**: Auto-galleries with empty/null titles now automatically fall back to their Folder name or Zip archive name (e.g. `Summer Shoot 2024` instead of an empty row).
- **Smart Suggestions Toggle**: Easily enable or disable smart suggestions (`💡 SUGGESTED`) from settings.
- **Theme Switcher in Settings**: Instant selection of Dark, Light, or Match Stash UI themes.

---

## [3.3.0] - 2026-08-26

### Added
- **In-Place Sequential Navigation in Edit Everything**: Switching scenes (via `►`, `◄`, `Save & Next Scene`, or `Alt + Right` / `Alt + Left`) now updates the existing popup DOM and Tabulator tables instantaneously with zero visual redraw or window flashing, matching the 60fps performance of Single Entity popups.
- **Fluid Auto-Flex Popup Resizing**: Upgraded popup resizing with dynamic `ResizeObserver` lifecycle management. Tables and previews dynamically expand and flex to fill 100% of the popup height and width without leaving dead space.
- **4-Sided 8px Viewport Safety & Clamping**: Enforced strict boundary protection so the popup header never slides under browser bookmarks or navigation bars (`window.scrollY + 8px`), and dragging is clamped at the bottom of the viewport to prevent infinite page expansion.
- **High-Resolution & Multi-Monitor Support**: Max size caps expanded to `calc(100vh - 16px)` and `calc(100vw - 16px)` for full-screen flexibility on 1080p, 1440p, and 4K displays.
- **Comprehensive User Guide (`HOWTO.md`)**: Detailed documentation covering all workflows, hotkeys, suggestions, pinned tokens, and window controls.

### Changed
- **Centered Header Title & Smooth Sequential Toggle**: Header titles (`⚡ Edit Everything [X/N]`) are vertically centered (`line-height: 1.2`), and sequential arrow buttons smoothly slide and fade in/out on toggle (`max-width: 0 → 60px`).
- **Context Menu Layout**: Moved `⚡ Edit Everything...` directly below `Edit Scene` for a more natural hierarchy.
- **Support Link**: Updated support link to `Buy me a KitKat 🍫` pointing to `https://buymeacoffee.com/kamarsh`.

---

## [3.2.0] - 2026-08-25

### Added
- **Smart Scene Suggestions**: Heuristic engine suggests matching tags, performers, and studios extracted from scene titles, filenames, directory folder paths, and quality badges (`4K`, `1080p`, `NEW`). Includes warm amber theme, single-click `+ tag`, and `✓ Accept All` with instant autosave.
- **Studio Support (`isSingleSelect`)**: Complete studio management directly from scene cards with parent studio hierarchy search and single-select replacement.
- **Pinned Tokens & Chips (`📌`)**: Right-Click or `Alt + Click` any recent token to pin it permanently at the front of the quick-action bar for fixed muscle-memory numbers.
- **Multi-Scene Bulk Tagging**: Select multiple scene checkboxes in Stash to batch-edit Tags, Performers, or Studios. Includes non-destructive tag merging and diff-aware add/remove capabilities.
- **Multi-Number Keyboard Hotkeys (`1`–`9`)**: Press number keys to rapidly toggle quick chips in sequence without focus stealing. Press `/` or `S` to jump straight to search.
- **High-Contrast Typography & 10px Bold Numeric Badges**: Enhanced pill legibility with elevated slate surfaces, high-contrast off-white text, and bold dedicated numerical hotkey badges.

---

## [3.1.0] - 2026-08-25

### Added
- **8-Direction Edge & Corner Resizing**: The popup window can now be freely resized by dragging any of the 4 borders (top, bottom, left, right) or 4 corners. Dynamic mouse cursor indicators (`↔`, `↕`, `⤡`, `⤢`) provide intuitive feedback.
- **Dynamic 16:9 Responsive Video Preview**: Video previews now scale proportionally in real time using a clean 16:9 aspect ratio, ensuring no cropping, distortion, or hardcoded height limits.
- **Exact DOM Row-Fitting for Recent Tokens**: Recent chips calculate their layout based on actual DOM measurements (`offsetTop`), displaying complete chips across 1–3 clean rows with zero cut-off or sliced pills.
- **Automatic Window Size Memory**: Custom popup width and height are saved to browser storage and remembered across scenes and sessions.
- **Dynamic Dependency Autoloader (`ensureDependenciesLoaded`)**: Automatically detects missing libraries (like `Tabulator` and `Toastify`) and injects them asynchronously on native Stash installations without requiring Tampermonkey.

### Changed
- **Full-Width Table Columns**: Removed rigid pixel persistence so the `Name` and `Disambiguation` columns stretch across 100% of the table width with no empty side gaps.
- **Expanded Recent Token Storage**: Increased recent history storage limit from 8 to 24 items.
- **Improved Error Logging**: Enhanced `toastError` to provide clear, actionable console messages instead of `undefined`.

---

## [3.0.1] - 2026-08-25

### Added
- **ID Number Search & Top-Priority Matching**: Typing an entity ID (e.g. `770`, `731`) in the search box now immediately filters to that item and prioritizes exact matches at the top of the table.

### Fixed
- **Settings Card Integration**: Corrected DOM query in `initSettingsPageObserver` to anchor the theme switcher cleanly inside the FastTag settings card with native 20px padding.
- **YAML Formatting**: Quoted description scalars in `fasttag.yml` and `index.yml` to resolve Go YAML v3 parser issues in Stash.
- **Clean Header Layout**: Removed redundant drag icon (`⠿`) and made the entire top header draggable (`cursor: grab`), while aligning the Sequential checkbox baseline.

---

## [3.0.0] - 2026-08-24

### Added
- **Polymorphic Entity Architecture**: Unified Tag, Performer, and Gallery operations under a single schema registry, eliminating over 700 lines of redundant code.
- **Performer Disambiguation Search**: Search queries now search across performer names and disambiguation tags simultaneously (e.g. searching "Alex Studio" resolves the correct performer).
- **ID-First Recent Selection**: Quick-select recent chips now resolve by unique entity ID first to prevent collisions between items sharing the same name.
- **Lifecycle & Memory Safety**: Integrated `AbortController` and `AbortSignal` across all listeners, timers, and fetch requests for leak-free disposal.

### Changed
- **Rebranded to FastTag**: Streamlined repository configuration, manifest schemas, and plugin metadata.

---

## [2.0.0] - 2026-08-20

### Added
- **Sequential Tagging Workflow**: Tag multiple scenes in sequence with active progress indicators (`[1/24]`, `[2/24]`), next/prev buttons, and keyboard navigation (`Alt + →`, `Alt + ←`, `Ctrl + Enter`).
- **Dynamic Smart Save**: Primary button dynamically switches between skipping (`Next Scene ►`) and saving edits (`Save & Next Scene ►`) with real-time visual feedback.
- **Theme Switcher**: Added live Theme Switcher (🌙 Dark / ☀️ Light / ⚙ Auto) integrated directly into **Settings ➔ Plugins**.
- **Interactive Video Scrubbing**: Shift + Scroll on the video preview allows fine-grained scrubbing through the scene.

---

## [1.0.0] - 2026-08-10

### Added
- Initial release of the Fast Scene Tagging plugin for Stash.
- Context menu integration on scene cards for quick Tag, Performer, and Gallery editing.
- Live Tabulator table with instant search and selection.
- Looping video preview header.
