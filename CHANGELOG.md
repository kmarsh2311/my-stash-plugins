# Changelog

All notable changes to the **FastTag** Stash plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
