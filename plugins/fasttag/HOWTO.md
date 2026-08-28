# 📖 FastTag - User Guide & How-To

Welcome to the comprehensive guide for **FastTag**, the fast tagging and metadata workflow plugin for [Stash](https://github.com/stashapp/stash).

---

## 📑 Table of Contents
1. [Getting Started](#-getting-started)
2. [Context Menu Overview](#-context-menu-overview)
3. [⚡ Edit Everything (All-In-One Mode)](#-edit-everything-all-in-one-mode)
4. [Single Entity Popups](#-single-entity-popups)
5. [🔁 Sequential Editing Mode](#-sequential-editing-mode)
6. [💡 Smart Scene Suggestions](#-smart-scene-suggestions)
7. [📌 Pinned Tokens & Quick-Select Bar](#-pinned-tokens--quick-select-bar)
8. [📦 Multi-Scene Bulk Tagging](#-multi-scene-bulk-tagging)
9. [⌨️ Keyboard Shortcuts Reference](#️-keyboard-shortcuts-reference)
10. [📐 Window Resizing & Viewport Controls](#-window-resizing--viewport-controls)
11. [🎨 Themes & Settings](#-themes--settings)

---

## 🚀 Getting Started

FastTag attaches directly to scene cards in your Stash library view:
* **Open the Menu:** **Right-Click** anywhere on a scene card (or click the 3-dot card menu).
* **Select an Action:** Choose what you want to edit (`Edit Tags...`, `Edit Performers...`, `Edit Studio...`, `Edit Galleries...`, `Edit Scene`, or `⚡ Edit Everything...`).
* **Close the Popup:** Press `Esc` or click outside the popup.

---

## 📋 Context Menu Overview

When you right-click a scene card, FastTag displays a streamlined context menu:

| Menu Item | Action |
| :--- | :--- |
| **`Edit Tags...`** | Opens dedicated Tags manager with suggestions and quick-chips. |
| **`Edit Performers...`** | Opens dedicated Performers manager with disambiguation search. |
| **`Edit Studio...`** | Opens dedicated Studio selector with parent hierarchy support. |
| **`Edit Galleries...`** | Opens dedicated Gallery assigner. |
| **`Edit Scene`** | Navigates directly to the full Stash scene edit page. |
| **`⚡ Edit Everything...`** | Opens the all-in-one dual-table popup (Tags + Performers + Studio). |
| **`⚙️ FastTag Settings`** | Opens dedicated settings to toggle ID columns, suggestions, and themes. |
| **`Buy me a KitKat 🍫`** | Optional support link to sponsor the developer. |

---

## ⚡ Edit Everything (All-In-One Mode)

`⚡ Edit Everything` provides a complete command center to tag an entire scene from a single window without page reloads:

1. **🏢 Dedicated Studio Bar (Top):**
   - Displays the scene's currently assigned Studio chip.
   - Click the **`×`** on the chip to remove the studio.
   - Click any recent studio chip on the right to assign it instantly with auto-save.
2. **💡 Smart Suggestions Bar:**
   - Highlights auto-detected tags, performers, and studios extracted from the filename, path, or title.
   - Click **`+ Tag`** to add a single suggestion, or click **`✓ Accept All`** to commit all suggestions instantly.
3. **🔍 Unified Global Search Console:**
   - Type in the central search bar to simultaneously filter both the **Tags** and **Performers** tables.
   - Press **`/`** from anywhere to instantly focus the search bar.
4. **↔️ Split-Column Workspace:**
   - Left column manages **Tags**; right column manages **Performers**.
   - Drag the center vertical divider line to adjust the column split to your preference.
5. **Dynamic Video Preview:**
   - Interactive animated widescreen (16:9) video preview displayed above the tables.

---

## 🏷️ Single Entity Popups

If you only need to adjust one type of metadata:
* Open `Edit Tags...`, `Edit Performers...`, `Edit Studio...`, or `Edit Galleries...`.
* The popup shows:
  - **Scene Video Preview** at the top.
  - **Quick-Action Chips Bar** showing your recently used items.
  - **Search Input** with instant ID search (e.g. typing `770` immediately finds entity #770).
  - **Tabulator Data Table** with multi-select support and sortable headers.

---

## 🔁 Sequential Editing Mode

Review and tag your entire library scene-by-scene with zero visual lag:

1. **Enable Sequential Mode:** Check the **`[x] Sequential`** checkbox in the top header.
2. **Progress Indicator:** The header title updates to show your progress (e.g. `⚡ Edit Everything [8/60]`).
3. **Seamless Navigation:**
   - Click **`►`** or press **`Alt + Right Arrow`** to advance to the next scene.
   - Click **`◄`** or press **`Alt + Left Arrow`** to go back to the previous scene.
   - The primary button updates to **`Save & Next Scene ►`** (or **`Next Scene ►`** if no changes were made).
4. **Instant In-Place Swapping:** Navigating updates the video preview, studio, tags, performers, and tables instantly without redrawing or closing the window.

---

## 💡 Smart Scene Suggestions

FastTag includes an intelligent heuristic parser that analyzes:
- Scene titles
- Video filenames
- Folder and directory paths
- Quality/format tokens (`4K`, `1080p`, `NEW`, `720p`)

**Actions:**
* **Individual Accept:** Click any amber suggestion pill to immediately attach it.
* **Batch Accept:** Click **`✓ Accept All (N)`** to attach all suggestions and automatically trigger a background save.

---

## 📌 Pinned Tokens & Quick-Select Bar

Keep your favorite and most frequently used tags, performers, or studios permanently within reach:

* **Pinning a Token:** **Right-Click** or **`Alt + Click`** on any chip in the recent row.
* **Pinned State (`📌`):** Pinned items stay permanently locked at the front of the quick-action row across all scenes and browser restarts.
* **Unpinning:** **Right-Click** or **`Alt + Click`** on a pinned chip to unlock it.
* **Hotkeys (`1`–`9`):** Each visible chip has a numeric badge. Pressing the corresponding number key (`1`–`9`) instantly toggles that item on the current scene.

---

## 📦 Multi-Scene Bulk Tagging

Tag multiple scenes in batch:

1. In Stash's library view, select checkboxes on two or more scene cards.
2. Right-click any selected card.
3. The context menu will reveal dedicated **Bulk Actions**:
   - `🏷️ Bulk Tags (N scenes)`
   - `⭐ Bulk Performers (N scenes)`
   - `🏢 Bulk Studio (N scenes)`
4. FastTag non-destructively merges new items or lets you remove shared tags across all selected scenes simultaneously.

---

## ⌨️ Keyboard Shortcuts Reference

| Shortcut | Description |
| :--- | :--- |
| **`Scroll Wheel`** | Scrub full video forward / backward (Full Video mode) |
| **`Hold Shift + Scroll`** | Freeze video playback & step frame-by-frame |
| **`1` – `9`** | Toggle quick-action chip by its numeric badge |
| **`/`** or **`S`** | Jump directly into the search bar |
| **`Esc`** | Clear active search text, or close the popup |
| **`Alt + →`** | Navigate to the next scene (Sequential Mode) |
| **`Alt + ←`** | Navigate to the previous scene (Sequential Mode) |
| **`Alt + Click`** | Pin / Unpin a recent chip (`📌`) |
| **`Enter`** | Save changes and close (or Save & Next Scene) |

---

## 📐 Window Resizing & Viewport Controls

* **8-Way Resizing:** Hover over any of the 4 borders or 4 corners to drag and resize the popup freely.
* **Fluid Auto-Flex:** Tables and previews dynamically flex to fill 100% of the window dimensions with zero empty space.
* **Size Memory:** FastTag remembers your custom dimensions per popup type (`Single Entity` vs `Edit Everything`).
* **Boundary Clamping:** The window enforces an 8px margin from screen edges, preventing the header from getting lost under bookmark bars or dragging off the page.

---

## 🎨 Themes & Settings

FastTag provides a dedicated settings modal accessible directly from the context menu:
* **Open Settings:** Right-click any scene card ➔ **`⚙️ FastTag Settings`**.
* **Toggle ID Columns:** Hide or show the numeric database ID column across all popups. When hidden, Name and Title columns expand across 100% of the table width.
* **Toggle Smart Suggestions:** Enable or disable the `💡 SUGGESTED` bar.
* **Theme Selection:** Switch instantly between:
  - **Dark (Slate & Indigo)**
  - **Light (Clean White & Slate)**
  - **Match Stash UI (Automatically syncs with Stash theme)**

---

## 🤝 Support & Feedback
If FastTag speeds up your library workflow, consider supporting the project:
* 🍫 **[Buy me a KitKat here 🍫](https://buymeacoffee.com/kamarsh)**
