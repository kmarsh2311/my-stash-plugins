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
*   **8-Direction Window Resizing:** Grab any edge or corner to freely stretch the popup wider or taller with directional cursor cues. Automatically remembers your custom size.
*   **Proportional 16:9 Video Preview:** Dynamic widescreen video preview that scales with window width for clear scene identification without distortion.
*   **Sequential Edit Mode:** Bulk review and tag scenes sequentially (`[1/24]`, `[2/24]`) without closing the popup. Use navigation arrows (`◄` / `►`) or keyboard shortcuts (`Alt + →`, `Alt + ←`, `Ctrl + Enter`).
*   **Dynamic Smart Save:** Primary button automatically distinguishes between reviewing/skipping (`Next Scene ►`) and saving edits (`Save & Next Scene ►`) with real-time color feedback.
*   **Native Dark Theme & Theme Switcher:** Sleek dark slate styling designed to match Stash's interface out of the box, with an instant live theme toggle (`Dark`, `Light`, `Auto`) in **Settings ➔ Plugins**.
*   **ID Number & Disambiguation Search:** Search by entity ID numbers (e.g. `770`) or performer disambiguation tags with top-priority smart sorting.
*   **Exact DOM-Fitted Recent Chips:** Dynamically adapts recent quick-select tokens based on window width and height with zero cut-off pills.
*   **Fast Metadata Editing:** Edit Tags, Performers, and Galleries directly from any scene card.
*   **Draggable Floating Window:** Draggable header for seamless multi-tasking across scene collections.
*   **Automated Dependency Autoloader:** Auto-injects table and toast libraries on native Stash installs.

*See the full release history in [CHANGELOG.md](CHANGELOG.md).*

## 🚀 Installation

### Recommended Method (Stash Plugin Manager):
---

1. Download `fasttag.js` and `fasttag.yml`.
2. Place them into your Stash plugins folder: `.stash/plugins/fasttag/`.
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
