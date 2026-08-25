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

*See the full release history in [CHANGELOG.md](CHANGELOG.md).*

## 📥 Installation

### Method 1: Stash Plugin Manager (Recommended)
1. In Stash, go to **Settings ➔ Plugins ➔ Available Plugins ➔ Add Source**.
2. Paste the Source URL:
   ```text
   https://raw.githubusercontent.com/kmarsh2311/my-stash-plugins/refs/heads/main/index.yml
   ```
3. Find **FastTag** in the list and click **Install**.

### Method 2: Manual Installation
1. Download `fasttag.js` and `fasttag.yml`.
2. Place them into your Stash plugins folder: `.stash/plugins/mypluginrc/`.
3. Go to **Settings ➔ Plugins** and click **Reload Plugins**.
## 💡 How to Use
*   **Right-Click:** Use the context menu on any scene card to access the quick edit tool.
*   **Quick Tagging:** Select tags and performers from a searchable popup while reviewing video scenes.
*   **Scene Preview:** The popup displays the scene's animated preview above the title bar while you work.
*   **Bulk Review Workflow:** Keep your tagging flow fast while scanning large collections of scenes.
*   **Save:** Recent tag and performer selections are committed immediately and update the scene card in place. The popup stays open so you can continue choosing recent items, while the full Save button commits the current selection and refreshes the scene view without reloading the page.

## 🎯 Why This Exists
This plugin is built for quickly tagging scenes in a video library, especially when you want to assign metadata like performers, tags, and galleries without opening multiple pages or navigating away from the current view.

---

## 🤝 Support & Contributing
*   **Support:** If you find these plugins helpful, you can support further development [here](https://www.patreon.com/serechops/membership).
*   **Issues:** Found a bug? Please open an issue in this repository.
