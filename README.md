<p align="center">

  <img width="336" height="672" alt="image" src="https://github.com/user-attachments/assets/4eeabd95-70fb-4be7-9b43-6d9b029769d4" />

</p>

# My Stash Plugins

A collection of custom scripts and plugins designed to speed up the [Stash](https://github.com/stashapp/stash) workflow for video scene tagging and metadata cleanup. This repository is focused on fast tagging of scenes, performers, galleries, and related metadata without leaving the library view.

---

## 🛠 Featured Scripts

### FastTag - Scene Manager Context Menu
A fast tagging workflow for Stash scene cards, designed for video libraries where you want to assign tags and performers quickly without leaving the page. 

**Key Features:**
*   **💡 Smart Scene Suggestions:** Automatically detects and suggests matching tags, performers, and studios from filenames, titles, directory paths, and quality badges (`4K`, `1080p`, `NEW`). One-click `+ Tag` or `✓ Accept All` with instant autosave.
*   **📌 Pinned Tokens:** Pin favorite tags, performers, and studios (`Alt + Click` or `Right Click`) for fixed, permanent muscle-memory number hotkeys.
*   **🏢 Full Entity Editing:** Edit Tags, Performers, Studios (with parent hierarchy search), and Galleries directly from any scene card.
*   **📦 Multi-Scene Bulk Tagging:** Batch-apply or remove tags, performers, and studios across multiple selected scenes simultaneously.
*   **⌨️ Number Hotkeys (`1`–`9`):** Fast single-key toggling for the first 9 tokens, with `/` or `S` to jump into search.
*   **8-Direction Resizing & 16:9 Video Preview:** Freely stretch the modal from any border or corner with automatic size memory and responsive widescreen video preview.
*   **Sequential Edit Mode:** Bulk review and tag scenes sequentially (`[1/24]`, `[2/24]`) without closing the popup.
*   **Dynamic Smart Save:** Primary button automatically distinguishes between reviewing/skipping (`Next Scene ►`) and saving edits (`Save & Next Scene ►`).
*   **Native Dark Theme & Theme Switcher:** Sleek dark slate styling with an instant live theme toggle (`Dark`, `Light`, `Auto`) in **Settings ➔ Plugins**.
*   **Automated Dependency Autoloader:** Auto-injects table and toast libraries on native Stash installs.

*See the full release history in [CHANGELOG.md](CHANGELOG.md) and the comprehensive user guide in [HOWTO.md](HOWTO.md).*

## 📥 Installation

### Method 1: Stash Plugin Manager (Recommended)
1. In Stash, go to **Settings ➔ Plugins ➔ Available Plugins ➔ Add Source**.
2. Paste the Source URL:
   ```text
   https://kmarsh2311.github.io/my-stash-plugins/index.yml
   ```
3. Find **FastTag** in the list and click **Install**.

### Method 2: Manual Installation
1. Download `fasttag.js` and `fasttag.yml`.
2. Place them into your Stash plugins folder: `.stash/plugins/mypluginrc/`.
3. Go to **Settings ➔ Plugins** and click **Reload Plugins**.

---

## 📖 How to Use

> For the full illustrated guide and workflows, see **[HOWTO.md](HOWTO.md)**.

* **Open FastTag:** **Right-Click** anywhere on any scene card in Stash to open the context menu.
* **⚡ Edit Everything:** Tag everything in one unified window with dual side-by-side tables for Tags & Performers, dedicated Studio bar, smart suggestions, and 16:9 video preview.
* **Single Entity Modes:** Choose `Edit Tags...`, `Edit Performers...`, `Edit Studio...`, or `Edit Galleries...` for focused edits.
* **🔁 Sequential Mode:** Check `[x] Sequential` to review and tag scene-by-scene (`[1/60]`) with instant in-place transitions.
* **💡 Smart Suggestions:** 1-click accept tags, performers, and studios auto-detected from filenames, titles, and video quality badges.
* **📌 Pin Favorites:** `Alt + Click` or `Right-Click` any recent chip to pin it for permanent number hotkeys (`1`–`9`).
* **⌨️ Hotkeys:**
  - `1`–`9`: Toggle recent chips
  - `/` or `S`: Focus search
  - `Esc`: Clear search / close popup
  - `Alt + →` / `Alt + ←`: Next / Previous scene in sequential mode
  - `Enter`: Save and close (or Save & Next Scene)

---

## 🎯 Why This Exists
This plugin is built for quickly tagging scenes in a video library, especially when you want to assign metadata like performers, tags, and galleries without opening multiple pages or navigating away from the current view.

---

## 🤝 Support & Contributing
*   **Support:** If you find FastTag helpful, you can [buy me a KitKat here 🍫](https://buymeacoffee.com/kamarsh).
