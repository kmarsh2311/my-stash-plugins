# Tagger for for scenes and performers directly from Title card


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
