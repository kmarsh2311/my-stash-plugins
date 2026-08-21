# Tagger for scenes and performers directly from title card

<img width="350" height="432" alt="image" src="https://github.com/user-attachments/assets/469cbb1b-4f7a-4446-a23f-05b65814d464" />

<img width="345" height="429" alt="image" src="https://github.com/user-attachments/assets/478eb6c6-0748-4cf4-8d4b-d30376979982" />


Key Features & Architecture
Context Menu Integration: Provides a dedicated custom right-click menu on scene cards with quick-access links to edit tags, performers, and galleries, jump straight to the scene edit page, or access external support links.

Interactive Popup Modals: Uses Tabulator tables inside draggable, floating popups to let you search, select, create, and assign tags and performers fluidly.

Smart UI & Persistence:

Features column persistence (localStorage) so your customized table widths and layouts stay remembered across sessions.

Includes local caching (CACHE_TTL mechanisms) for tags, performers, and galleries to make searches fast and responsive.

Advanced State Management:

Automatically saves and restores your scroll position across page reloads (using sessionStorage and SPA tracking).

Automatically handles visibility changes (visibilitychange listeners) and debounced search inputs to prevent lag when filtering large libraries.

Notification System: Integrates Toastify notifications to provide real-time, clean visual feedback when scenes are updated or when operations succeed/fail
