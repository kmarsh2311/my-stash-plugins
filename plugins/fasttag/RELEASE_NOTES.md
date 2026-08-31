## 3.9.1 - Keyboard Navigation Loop Bugfixes, Recent Chips & Mouse Focus Sync
 
### Bug Fixes & Refinements
- **Full Keyboard Navigation Loop & Recent Chips**:
  - Integrated **Recent** chips into the keyboard navigation loop for Edit Everything, Bulk Edit Everything, Single Edit, and Bulk Single Edit modals.
  - Seamless 8-section vertical/horizontal flow across Studio/Group bars, suggestions, recent chips, tables, and create buttons.
- **Search-Aware Initial Navigation Landing**:
  - When the search box is **empty**, pressing <kbd>↓</kbd> lands on **Suggestions pills** first, then **Recent chips**, then **Main Table rows**.
  - When the search box has an active **search term**, pressing <kbd>↓</kbd> jumps straight into the **Main Table rows**.
  - Pressing <kbd>↑</kbd> from an empty search box jumps straight into the Studio / Group bar.
- **Mouse & Keyboard Focus Synchronization**:
  - Clicking any table row immediately syncs the keyboard active row highlight (`activeNavIndex` / `singleNavIndex`).
  - Clicking inside modal backdrops/containers automatically refocuses the search input with `{ preventScroll: true }`, ensuring arrow keys and keyboard shortcuts never lose focus.
  - Row focus styling unified across entire row with context-aware `#38bdf8` electric blue highlight when selecting/deselecting.

---

## 3.9.0 - Split Studio & Group Bar, Full Keyboard Navigation & Scene-Count Search Ranking

### Highlights & New Features
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

## 3.8.1 - Auto-Scraping for Edit Everything, Sizing Optimizations & UI Polish
 
### Highlights & New Features
- **Auto-Scrape in Sequential Mode (Edit Everything)**: Automatically fetches and displays StashDB/scraper matches when stepping through scenes in Sequential Mode (`Next Scene ►` / <kbd>Alt</kbd> + <kbd>→</kbd>).
- **Dedicated Settings Toggle**: Added **"Auto-Scrape in Sequential Mode"** setting in `⚙️ FastTag Settings` with persistent sidecar continuity and session cache protection.
- **Sleek Proportional Sizing**:
  - Single edit popups (*Tags, Performers, Studio, Galleries*) default to a sleek `345px × 660px` (fits 9–11 visible rows).
  - Edit Everything optimized with compact `205px` docked video player and spacious `860px × 760px` layout (fits 10–12 rows).
- **Enlarged Sidecar Poster**: Adaptively enlarged poster thumbnail in the sidecar HUD (`148px × 94px`) while preserving the high-res 350px hover zoom preview.
- **Toast Notifications Z-Index**: Layered toast notifications at `z-index: 20,000,000` above all modal backdrops.

---

## 3.8.0 - Detachable Scraper Sidecar, 3-Pane Zero-Overlap Matrix & Offline Docker Support
 
### Highlights & New Features
- **Detachable Scraper Sidecar HUD**: Pop out the StashDB Scraper Match Card into its own floating, draggable, resizable sidecar window (`⤢ Pop Out`) for simultaneous multi-window scraping and video playback.
- **Smart 3-Pane Zero-Overlap Matrix**: Multi-window tiling layout with mathematical zero-overlap boundary enforcement across all grid columns (Columns 1–6).
- **Streamlined Scraper Header**: Moved `✓ Accept` action directly into the Scraper header row, eliminating the bottom bar for maximum content preview space.
- **Offline & Strict Docker CSP Support**: Bundled `tabulator.min.js` and `tabulator.min.css` locally in the plugin directory to comply with strict Content-Security-Policy (`script-src 'self'`) and support offline/air-gapped Docker instances.
- **Native Toast Engine**: Replaced external Toastify dependency with an embedded zero-dependency notification engine.

---

## 3.7.0 - Performer Hover ID Card, Visual Matcher & Profile Jump

### Highlights & New Features
- **Performer Hover ID Card**:
  - Hovering over any Performer row in **`⚡ Edit Everything`**, **`Edit Performers`**, or **Bulk Tagging** opens a frosted glass ID badge.
  - **110×146px Portrait Photo**: Large, crisp performer avatar with fallback icon support.
  - **Instant Metadata Breakdown**: Performer Name, Star Rating (`★★★★☆`), Disambiguation, Country flag (`🇺🇸 US`), Gender badge, Age, Ethnicity, and Known Aliases (`aka: ...`).
  - **1-Click Profile Jump**: Click anywhere on the card to open that performer's full profile page in Stash (`/performers/{id}`) in a new browser tab.
  - **Smart Floating HUD Collision Avoidance**: Automatically places the card on the side opposite the popped-out video so playback is never obscured.
  - **Snappy 100ms Hover Intent**: Zero flicker on rapid sweeps.

---

## 3.6.0 - Floating Video Popout HUD, Stream Scrubbing & Velocity Speeds

### Highlights & New Features
- **Detachable Floating Video HUD**:
  - Pop out the video into a draggable, resizable floating window (`⤢`) with a sleek black border.
  - Collapses FastTag's video slot into a slim interactive 33px placeholder bar, maximizing vertical height for table browsing.
  - **1-Click Docking**: Click the placeholder bar or **`⤝`** button to snap the video back into FastTag instantly.
  - **Smart Non-Overlapping Spawning**: Opens at 2x visual docked size beside FastTag with 0% overlap across both single and Edit Everything views.
  - **Sequential Mode Memory**: Preserves custom position and enlarged size across all subsequent scenes (`Next Scene ►` / `Alt + →`).
  - **Zero-Flash Transitions**: Window stays permanently mounted during sequential navigation with seamless in-place video replacement.
- **Full Video Stream Scrubbing**: Switch from looping previews to the full scene video stream (`🎬 Full Video`) with velocity-based mouse wheel scrubbing.
- **Velocity-Based Scrubbing**: Dynamically adjusts step size based on scroll speed (*Slow*, *Normal*, *Fast*).
- **Hold Shift to Freeze & Step**: Pauses auto-resume and switches scrubbing to precision frame stepping.
- **Configurable Speeds in Settings**: Customize Slow, Normal, Fast, and Freeze step sizes with instant real-time auto-saving.
- **Animated Lordicon Mouse Cue**: Vector animated mouse cue with 3.0s entrance breathing room, 1.5s slow fade-in, and 4.5s on-screen presence.
- **5-Session Smart Decay**: Shows on the first 5 sessions to train the user, then permanently retires for zero clutter.
- **Tabulator Dark Mode Polish**: Eliminates white row divider line flicker artifacts.

---

## 3.5.3 - Scene Cover Image Fallback for Previews

### Highlights & Improvements
- **Automatic Scene Cover / Screenshot Fallback**: When opening FastTag on scenes that have not yet had preview videos (`.mp4`) or animated `.webp` generated, FastTag automatically loads and displays the scene's static cover image in the 16:9 box instead of collapsing or hiding the preview container.
- **Graceful Error Recovery**: Instantly catches 404 or video playback errors and falls back to the scene cover image.

---

## 3.5.2 - UI Refinements & Polish

### Highlights & Fixes
- **General UI & Performance Polish**: Minor UI refinements and internal milestone optimizations.

---

## 3.5.1 - Performance & Selector Hardening

### Highlights & Fixes
- **3-Worker Concurrency Pool for Bulk Tagging**: Speeds up multi-scene bulk tagging by up to 3x using a parallel worker pool, with live progress updates (`Saving (3/15)...`).
- **Strict Bulk Checkbox Query**: Hardened `getBulkSelectedScenes()` to only inspect checkboxes inside scene cards, preventing page filter checkboxes from interfering.
- **Clean Scene Card Scope**: Removed generic `.card` selector so FastTag ignores non-scene pages (*Tags, Performers, Settings*).

---

## 3.5.0 - Smart Auto-Save, Entity Creation Modals, Save-in-Place & UI Polish

### Highlights & New Features
- **Smart Auto-Save Workflow**: Top quick actions (Suggestions, Recent 1–9, Studio Bar, Created Entities) auto-save immediately. Search & select auto-saves to the scene on click, while table browsing allows batch selections without unwanted saves.
- **Save-in-Place (No Popup Dismissal)**: Clicking Save saves selections to Stash and keeps the popup open so you can continue tagging without interruption.
- **State-Aware Save Button with Dynamic Breathing Pulse**: Dimmed/disabled button when clean, lighting up with a gentle pulse (1.8s for single views, 2.4s for Edit Everything) when changes are pending.
- **Universal Entity Creation Modal**: Pre-flight review popup before creating new Tags or Performers across all single, bulk, and unified views.
- **Universal Search Shortcut Indicator (`/`)**: Added `/` shortcut badge to search boxes across all single and bulk views.
- **Unified 3-Second Confirmation Toasts**: Merged dual creation + save notifications into single clear toasts.

---

## 3.4.0 - Settings Screen, Column Customization & Gallery Auto-Fallback

### Highlights & New Features
- **FastTag Settings Modal**: New centralized settings screen accessible via right-click ➔ `⚙️ FastTag Settings...` to customize preferences without popup clutter.
- **Hide / Show ID Column Toggle**: Toggle the numeric database ID column on and off across all popups. Defaults to ON for backwards compatibility. When disabled, Name and Title columns expand to fill 100% width for maximum readability.
- **Gallery Title Auto-Fallback**: Auto-galleries with missing or empty titles now automatically fall back to their folder or zip archive name instead of displaying blank rows.
- **Smart Suggestions Toggle**: Easily toggle smart suggestions on or off from the new settings menu.
- **Theme Controls**: Conveniently switch between Dark, Light, and Match Stash themes.

---

## 3.3.1 - Multi-CDN Fallback, Auto-Retry & Plugin Updater Date Metadata

### Fixes & Improvements
- **Multi-CDN Dependency Loading**: Added automatic failover across jsDelivr, cdnjs, and unpkg for Tabulator and Toastify, preventing adblockers (Brave Shields, uBlock Origin) from blocking tables.
- **Auto-Retry Mechanism**: Fixed an issue where a temporary network hiccup during page load would prevent future popup openings from retrying CDN downloads.
- **Stash Plugin Manager Update Date**: Added `date:` timestamp field to `index.yml` so Stash's native "Check for updates" displays the update date and auto-updates cleanly.

---

## 3.3.0 - In-Place Sequential Navigation, Fluid Sizing & Comprehensive Guide

### Highlights & New Features
- **In-Place Sequential Navigation in Edit Everything**: Zero-flash instant scene switching matching Single Entity mode performance.
- **Fluid Auto-Flex Popup Resizing**: Dual-table layout dynamically flexes and fills 100% of the popup dimensions using `ResizeObserver`.
- **4-Sided 8px Viewport Safety**: Header never gets lost behind browser bookmarks, and downward dragging is clamped safely at the bottom of the viewport.
- **Comprehensive User Guide**: Full illustrated guide and hotkey cheatsheet in `HOWTO.md`.
- **Menu Polish**: Reordered context menu placing `⚡ Edit Everything...` directly below `Edit Scene`, and updated support link (`Buy me a KitKat 🍫`).

---

## 3.2.0 - Smart Scene Suggestions, Studio Hierarchy & Pinned Tokens

### Highlights & New Features
- **Smart Scene Suggestions**: Auto-detects matching tags, performers, and studios from filenames, titles, and paths with 1-click accept.
- **Dedicated Studio Support**: Direct studio management with parent hierarchy search and single-select replacement.
- **Pinned Tokens (`📌`)**: Pin favorite tokens for permanent muscle-memory number hotkeys (`1`–`9`).
- **Multi-Scene Bulk Tagging**: Batch tag multiple scenes simultaneously from card selections.

---

## 3.1.0 - Resizable Floating Window & Dynamic Adaptive Layout

### Highlights & New Features
- **8-Direction Window Resizing**: Freely grab any border or corner to resize the popup in all directions.
- **Dynamic 16:9 Video Scaling**: Proportional real-time video scaling matching the window width with zero distortion or cropping.
- **Exact DOM Token Fitting**: Recent items automatically calculate exact line wraps, displaying full chips across 1–3 clean rows with no sliced pills.
- **Dynamic Dependency Autoloader**: Auto-injects Tabulator and Toastify on native Stash installs without requiring userscript managers.
- **Window Size Memory**: Remembers custom window dimensions across scene transitions and browser sessions.

---

## 3.0.0 - FastTag Major Refactor & Disambiguation Search

### Highlights & New Features
- **Rebranded to FastTag**: Cleaner identity and streamlined configuration.
- **Polymorphic Entity Architecture**: Unified Tag, Performer, and Gallery operations under a single schema registry, shedding ~700 lines of redundant code.
- **Performer Disambiguation Search**: Search queries now match across performer names and disambiguation tags simultaneously (e.g. searching "Alex Studio" correctly resolves performers).
- **ID-First Recent Selection**: Quick-select recent chips now resolve by unique ID first to prevent collisions between performers sharing the same name.
- **Enhanced Lifecycle Safety**: Integrated `AbortController` and `AbortSignal` for clean event and timer disposal when popups or previews transition.
- **Sequential Navigation**: Refined multi-scene workflow with smart save detection and keyboard shortcuts (`Alt + →`, `Alt + ←`, `Ctrl + Enter`).

### Compatibility
- Fully compatible with Stash v0.26+ and v0.27+.
- Safe to install or update in-place from previous versions.

### Install / Update
- Repository index: `https://kmarsh2311.github.io/my-stash-plugins/index.yml`
- Full changelog: See [CHANGELOG.md](CHANGELOG.md)
