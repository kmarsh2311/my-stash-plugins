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
*   **Sequential Edit Mode:** Bulk review and tag scenes sequentially (`[1/24]`, `[2/24]`) without closing the popup. Use navigation arrows (`◄` / `►`) or keyboard shortcuts (`Alt + →`, `Alt + ←`, `Ctrl + Enter`).
*   **Dynamic Smart Save:** Primary button automatically distinguishes between reviewing/skipping (`Next Scene ►`) and saving edits (`Save & Next Scene ►`) with real-time color feedback.
*   **Native Dark Theme & Theme Switcher:** Sleek dark slate styling designed to match Stash's interface out of the box, with an instant live theme toggle (`Dark`, `Light`, `Auto`) in **Settings ➔ Plugins**.
*   **Fast Metadata Editing:** Edit Tags, Performers, and Galleries directly from any scene card.
*   **Draggable Popups:** Floating, draggable interface for seamless multi-tasking.
*   **Animated Scene Preview:** Shows a looping video preview above the popup to help identify scenes while adding tags, performers, or galleries.
*   **Toggleable Recent Chips:** Active chips show clear checkmark pills (`✓`) and can be toggled on/off with one click.
*   **Optimized Performance:** Features local caching for tags/performers to ensure snappy search results.
*   **Persistence & Scroll Restoration:** Remembers your column widths and automatically restores your exact scroll position after saving or navigating.

**Best for:** rapid, distraction-free tagging of scenes, performers, and galleries in a video collection workflow.

---

## 🚀 Installation

### Recommended Method (Stash Plugin Manager):
1. In Stash, go to **Settings ➔ Plugins ➔ Package Sources** (or **Community Repositories**).
2. Click **Add Source**, give it a name (e.g. `kam` or `FastTag`), and enter the repository URL:
   ```
   https://kmarsh2311.github.io/my-stash-plugins/index.yml
   ```
3. Under **Available Plugins**, find **FastTag** and click **Install**.
4. Click **Reload Plugins** and refresh your browser (<kbd>Cmd/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>R</kbd>).

---

### Manual Method:
1. Download `fasttag.js` and `fasttag.yml`.
2. Place them into your Stash plugins folder: `.stash/plugins/fasttag/`.
3. In Stash, go to **Settings ➔ Plugins** and click **Reload Plugins**.

---

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
