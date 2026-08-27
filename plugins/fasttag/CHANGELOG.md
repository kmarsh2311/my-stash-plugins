# Changelog

All notable changes to the **FastTag** Stash plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
