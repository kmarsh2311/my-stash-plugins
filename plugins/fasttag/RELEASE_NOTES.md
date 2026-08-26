# Release Notes

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
