<p align="center">
  <img src="docs/images/context_menu.png" alt="FastTag Context Menu" height="380" />
  <img src="docs/images/edit_tags.png" alt="FastTag Edit Tags" height="380" />
  <img src="docs/images/edit_everything.png" alt="FastTag Edit Everything" height="380" />
</p>

# My Stash Plugins

A collection of custom scripts and plugins designed to speed up the [Stash](https://github.com/stashapp/stash) workflow for video scene tagging and metadata cleanup. This repository is focused on fast tagging of scenes, performers, galleries, and related metadata without leaving the library view.

---

## 🛠 Featured Scripts

### FastTag - Scene Manager Context Menu
A fast tagging workflow for Stash scene cards, designed for video libraries where you want to assign tags and performers quickly without leaving the page. 

*   **⚡ Edit Everything (All-in-One Workspace):** Dual side-by-side tables for editing Tags, Performers, and Studios simultaneously with resizable columns, compact Studio & Group bars with glowing SVG icons, and 16:9 video preview.
*   **🎲 Random Untagged Scene Mode:** One-click backlog cleanup with 3D rolling dice keyframe animations, sunset cyberpunk button, remaining backlog counter, and secret power-user hotkeys (<kbd>Cmd/Ctrl+Enter</kbd>).
*   **🔁 In-Place Sequential Navigation:** Review and tag scene-by-scene sequentially (`[1/60]`) with instant in-place transitions.
*   **📊 Smart Popularity Search:** Ranks search results by popularity (scene count) & match relevance across all modals, keeping selected items pinned at the top when search is empty.
*   **🎬 Full Video Stream Scrubbing & Frame Freeze:** Toggle to `🎬 Full Video` to scrub through the full scene with velocity-based mouse wheel control, hold <kbd>Shift</kbd> to freeze & step frame-by-frame, and tap <kbd>Option+V</kbd> (Mac) / <kbd>Alt+V</kbd> (Windows/Linux) to toggle modes.
*   **⤢ Floating Video Popout HUD:** Click `⤢` to detach the video into a 2x floating, resizable window while FastTag collapses into a 33px placeholder bar for 100% vertical table space. Click `⤝` to snap back!
*   **⚙️ Category Tabbed Settings Suite:** Redesigned 4-tab settings modal (**🎨 Display**, **🎬 Video**, **⚡ Scraper**, **🛠️ System**) with 250-entry flight recorder diagnostics and instant reset buttons.
*   **🎭 Performer Hover ID Cards & 1-Click Profile Jump:** Hovering over any performer row displays a frosted glass ID card with their 110×146px portrait photo, rating (`★★★★☆`), country flag (`🇺🇸 US`), gender, age, aliases, and disambiguation. Click to open their profile in a new tab!
*   **⚡ Smart Auto-Save Workflow:** Quick-action suggestions, recent pills (`1`–`9`), studio chips, and search-and-select immediately auto-save to the scene.
*   **💾 Save-in-Place Workflow:** Clicking `Save` saves changes directly to Stash while keeping the popup open so you can continue tagging without interruption.
*   **🎨 State-Aware Pulsing Save Button:** Save button stays dimmed when everything is saved, and lights up **Emerald Green** with a breathing pulse when pending edits exist.
*   **💡 Smart Scene Suggestions:** Automatically detects and suggests matching tags, performers, and studios from filenames, titles, directory paths, and quality badges (`4K`, `1080p`, `NEW`).
*   **📌 Pinned Tokens:** Pin favorite tags, performers, and studios (`Alt + Click` or `Right Click`) for fixed, permanent muscle-memory number hotkeys (`1`–`9`).
*   **🏢 Full Entity Editing:** Edit Tags, Performers, Studios (with parent hierarchy search), and Galleries directly from any scene card.
*   **📦 Multi-Scene Bulk Tagging:** Batch-apply or remove tags, performers, and studios across multiple selected scenes simultaneously.
*   **⌨️ Number Hotkeys (`1`–`9`) & Search Shortcut (`/`):** Fast single-key toggling for tokens, with `/` or `S` to jump into search.
*   **📐 8-Direction Resizing & Size Memory:** Stretch the modal from any edge or corner with automatic size persistence.

*See the full release history in [CHANGELOG.md](plugins/fasttag/CHANGELOG.md) and the comprehensive user guide in [HOWTO.md](plugins/fasttag/HOWTO.md).*

## 📥 Installation

### Method 1: Stash Plugin Manager (Recommended)
1. In Stash, go to **Settings ➔ Plugins ➔ Available Plugins ➔ Add Source**.
2. Paste the Source URL:
   ```text
   https://kmarsh2311.github.io/my-stash-plugins/index.yml
   ```
3. Find **FastTag** in the list and click **Install**.

### Method 2: Manual Installation
1. Download `fasttag.js` and `fasttag.yml` from `plugins/fasttag/`.
2. Place them into your Stash plugins folder: `.stash/plugins/mypluginrc/`.
3. Go to **Settings ➔ Plugins** and click **Reload Plugins**.

---

## 📖 How to Use

> For the full illustrated guide and workflows, see **[HOWTO.md](plugins/fasttag/HOWTO.md)**.

* **Open FastTag:** **Right-Click** anywhere on any scene card in Stash to open the context menu.
* **⚡ Edit Everything:** Tag everything in one unified window with dual side-by-side tables for Tags & Performers, dedicated Studio bar, smart suggestions, and 16:9 video preview.
* **Single Entity Modes:** Choose `Edit Tags...`, `Edit Performers...`, `Edit Studio...`, or `Edit Galleries...` for focused edits.
* **🔁 Sequential Mode:** Check `[x] Sequential` to review and tag scene-by-scene (`[1/60]`) with instant in-place transitions.
* **💡 Smart Suggestions:** 1-click accept tags, performers, and studios auto-detected from filenames, titles, and video quality badges.
* **📌 Pin Favorites:** `Alt + Click` or `Right-Click` any recent chip to pin it for permanent number hotkeys (`1`–`9`).
* **➕ Quick Entity Creation:** Type a new name into search and click `+ Create` to check spelling and aliases before adding it to Stash and your scene.
* **⚙️ FastTag Settings:** Right-click ➔ `FastTag Settings` to toggle database ID columns, enable/disable suggestions, and switch themes.
* **💾 Save in Place:** Clicking `Save` (or pressing `Enter`) saves changes immediately to Stash and keeps the popup open so you can continue tagging.
* **⌨️ Hotkeys:**
  - `Scroll Wheel`: Scrub full video forward/backward (in Full Video mode)
  - `Hold Shift + Scroll`: Freeze video and step frame-by-frame
  - `1`–`9`: Toggle recent chips (auto-saves immediately)
  - `/` or `S`: Focus search
  - `Esc`: Clear search / close popup
  - `Alt + →` / `Alt + ←`: Next / Previous scene in sequential mode
  - `Enter`: Save in place (or Save & Next Scene in sequential mode)

---

## 🎯 Why This Exists
This plugin is built for quickly tagging scenes in a video library, especially when you want to assign metadata like performers, tags, and galleries without opening multiple pages or navigating away from the current view.

---

## 🤝 Support & Contributing
*   **Support:** If you find FastTag helpful, you can [buy me a KitKat here 🍫](https://buymeacoffee.com/kamarsh).
