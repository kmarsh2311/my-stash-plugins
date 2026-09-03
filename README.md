<div align="center">

# ⚡ FastTag for Stash
### Lightning-Fast Scene Tagging Workflow & Backlog Manager for Stash

![Version](https://img.shields.io/badge/version-4.2.4-6366f1?style=for-the-badge)
[![Changelog](https://img.shields.io/badge/changelog-v4.2.4-8b5cf6?style=for-the-badge)](CHANGELOG.md)
![Stash](https://img.shields.io/badge/Stash-v0.26+-f59e0b?style=for-the-badge)
![License](https://img.shields.io/badge/license-AGPL--3.0-10b981?style=for-the-badge)

<br />

<p align="center">
  <img src="docs/images/context_menu.png" alt="FastTag Context Menu" height="340" />
  <img src="docs/images/edit_tags.png" alt="FastTag Edit Tags" height="340" />
  <img src="docs/images/edit_everything.png" alt="FastTag Edit Everything" height="340" />
</p>

</div>

---

## 🚀 Overview

**FastTag** is a powerful, keyboard-driven tagging workflow plugin for [Stash](https://github.com/stashapp/stash). It allows you to edit tags, performers, studios, and galleries directly from scene cards without navigating away from your library or opening multiple tabs.

Featuring a **Dual-Table Edit Everything Workspace**, **AI Smart Parser**, **Scene Organisation Controls**, **Random Untagged Backlog Mode**, **Smart Popularity Search**, **Full Video Stream Scrubbing**, and **Performer ID Cards**, FastTag makes organizing media collections effortless and fast.

> [!TIP]
> **✨ What's New in v4.2.3**: Added **Targeted Apollo Scene Card Sync (0ms Single-Card Updates)**. Scene mutations now directly sync `Scene:${id}` in Apollo Client's in-memory normalized cache, updating the background scene card's tags, performers, studio, and organised status in real time (0ms) while completely eliminating the heavy 40-scene `FindScenes` network refetch bottleneck. Read the full **[CHANGELOG.md](CHANGELOG.md)**.

---

## 🔥 Key Features

* **🤖 AI Smart Parser (Google Gemini Beta):** 1-Click extraction of clean titles, release dates, studios, performers, and tags from messy filenames using Google Gemini. Ships with a local Python WebSocket bridge daemon (`port 9998`), multi-model auto-failover, 1-click entity creation, and seamless sequential navigation.
* **⚡ Edit Everything (All-in-One Workspace):** Dual side-by-side tables for editing Tags, Performers, and Studios simultaneously with resizable columns, compact Studio & Group bars with glowing SVG icons, and 16:9 video preview.
* **🎲 Random Untagged Scene Mode:** One-click backlog cleanup with 3D rolling dice keyframe animations, sunset cyberpunk button, remaining backlog counter, and secret power-user hotkeys (<kbd>Cmd/Ctrl+Enter</kbd>).
* **🔁 In-Place Sequential Navigation:** Review and tag scene-by-scene sequentially (`[1/60]`) with instant in-place transitions.
* **📊 Smart Popularity Search:** Ranks active search results by popularity (scene count) & match relevance across all modals, keeping selected items pinned at the top when search is empty.
* **🎬 Full Video Stream Scrubbing & Frame Freeze:** Toggle to `🎬 Full Video` to scrub through full scene streams with velocity-based mouse wheel control, hold <kbd>Shift</kbd> to freeze & step frame-by-frame, and tap <kbd>Option+V</kbd> (Mac) / <kbd>Alt+V</kbd> (Windows/Linux) to toggle modes.
* **⤢ Floating Video Popout HUD:** Click `⤢` to detach the video into a 2x floating, resizable workstation while FastTag collapses into a 33px placeholder bar for 100% vertical table space. Click `⤝` to snap back!
* **⚙️ Category Tabbed Settings Suite:** Sleek 5-tab settings modal (**🎨 Display**, **🎬 Video**, **⚡ Scraper**, **🤖 AI**, **🛠️ System**) with 250-entry flight recorder diagnostics and instant reset buttons.
* **🎭 Performer Hover ID Cards & 1-Click Profile Jump:** Hovering over any performer row displays a frosted glass ID card with their 110×146px portrait photo, rating (`★★★★☆`), country flag (`🇺🇸 US`), gender, age, aliases, and disambiguation. Click to open their profile in a new tab!
* **⚡ Smart Auto-Save Workflow:** Quick-action suggestions, recent chips, studio chips, and search-and-select immediately auto-save to the scene.
* **💾 Save-in-Place Workflow:** Clicking `Save` saves changes directly to Stash while keeping the popup open so you can continue tagging without interruption.
* **🎨 State-Aware Pulsing Save Button:** Save button stays dimmed when everything is saved, and lights up **Emerald Green** with a breathing pulse when pending edits exist.
* **💡 Smart Scene Suggestions:** Automatically detects and suggests matching tags, performers, and studios from filenames, titles, directory paths, and quality badges (`4K`, `1080p`, `NEW`).
* **📌 Pinned Tokens:** Pin favorite tags, performers, and studios (`Alt + Click` or `Right Click`) for 1-click quick action chips.
* **🏢 Full Entity Editing:** Edit Tags, Performers, Studios (with parent hierarchy search), and Galleries directly from any scene card.
* **📦 Multi-Scene Bulk Tagging:** Batch-apply or remove tags, performers, and studios across multiple selected scenes simultaneously.
* **📐 8-Direction Resizing & Size Memory:** Stretch the modal from any edge or corner with automatic size persistence.

---

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

## ⌨️ Keyboard Shortcuts Cheat Sheet

| Shortcut | Action |
| :--- | :--- |
| <kbd>Option</kbd> + <kbd>V</kbd> *(Mac)* / <kbd>Alt</kbd> + <kbd>V</kbd> | Toggle Full Video Stream vs Preview mode |
| <kbd>Cmd</kbd> + <kbd>Enter</kbd> *(Mac)* / <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Roll Next Random Untagged Scene *(in Random Mode)* |
| <kbd>Alt</kbd> + <kbd>→</kbd> / <kbd>Alt</kbd> + <kbd>←</kbd> | Next / Previous scene in sequential mode |
| <kbd>Mouse Wheel</kbd> | Scrub video forward/backward *(in Full Video mode)* |
| <kbd>Shift</kbd> + <kbd>Mouse Wheel</kbd> | Freeze video & step frame-by-frame |
| <kbd>Esc</kbd> | Clear search box / close modal (2-stage) |
| <kbd>Enter</kbd> | Save in place *(or Save & Next Scene in Sequential Mode)* |

---

## 📖 Documentation & Links

* 📘 **Full User Guide**: See **[HOWTO.md](plugins/fasttag/HOWTO.md)** for complete workflows and screenshots.
* 📝 **Release History**: See **[CHANGELOG.md](CHANGELOG.md)** for full version history.

---

## 🤝 Support & Contributing

If you find FastTag helpful, feel free to [buy me a KitKat here 🍫](https://buymeacoffee.com/kamarsh)!
