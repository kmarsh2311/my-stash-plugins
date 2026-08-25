# Release Notes

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
