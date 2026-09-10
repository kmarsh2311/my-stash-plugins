(function initializeFastTagPopup(root) {
    'use strict';

    let dependencies = null;
    let popupAbortController = null;
    let isClosing = false;

    function configure(options) {
        dependencies = options;
    }

    function beginSession() {
        popupAbortController = new root.AbortController();
        return popupAbortController.signal;
    }

    function isPopupClosing() {
        return isClosing;
    }

    function redrawTableIfReady(table, force = true) {
        if (!table || table.initialized !== true || typeof table.redraw !== 'function') return false;
        table.redraw(force);
        return true;
    }

    function closeActive(resetSequential = true) {
        if (!dependencies) throw new Error('[FastTag] Popup integration is not configured');
        if (dependencies.coverEditor.closeActiveEditor?.(false, true) === false) return false;
        isClosing = true;
        try {
            const activePopup = dependencies.getActivePopup?.();
            if (activePopup) {
                activePopup._fastTagClosed = true;
                dependencies.invalidateScraperRequests(activePopup);
                if (activePopup.tagsTable) {
                    try {
                        activePopup.tagsTable.destroy();
                    } catch (error) {}
                    activePopup.tagsTable = null;
                }
                if (activePopup.performersTable) {
                    try {
                        activePopup.performersTable.destroy();
                    } catch (error) {}
                    activePopup.performersTable = null;
                }
            }

            const activeTableInstance = dependencies.getActiveTableInstance?.();
            if (activeTableInstance) {
                try {
                    activeTableInstance.destroy();
                } catch (error) {}
                dependencies.setActiveTableInstance(null);
            }
            if (popupAbortController) {
                popupAbortController.abort();
                popupAbortController = null;
            }
            dependencies.abortCurrentPreview();
            if (activePopup?.element) {
                activePopup.element.classList.remove('popup-visible');
                activePopup.element.remove();
                dependencies.setActivePopup(null);
            }
            root.document.querySelectorAll('#scenes-popup').forEach(element => element.remove());
            dependencies.closeFloatingVideoHud(resetSequential);
            dependencies.closeFloatingScraperHud(resetSequential);
            dependencies.hidePerformerHoverCard();
            dependencies.hideScrapeCoverTooltip();
            dependencies.hideMicroTooltip();
            dependencies.resetPreviewSessionCue();

            root.document.body.classList.remove('fasttag-modal-open');
            if (resetSequential) {
                dependencies.resetSequentialEditState();
                dependencies.sessionScrapeCache.clear();
                root._fastTagEverythingScraperOpen = false;
            }
            // Save workflows already synchronize the affected scene cards. A
            // blanket refresh here rebuilds every Refract card (and visibly
            // flashes its icons), while cancelling a popup has nothing to sync.
            return true;
        } finally {
            root.setTimeout(() => {
                isClosing = false;
            }, 100);
        }
    }

    function getSavedSize(type = 'single') {
        if (!dependencies) throw new Error('[FastTag] Popup integration is not configured');
        try {
            const key = type === 'everything' ? 'stash_fast_tag_popup_size_everything' : 'stash_fast_tag_popup_size_single';
            const value = root.localStorage.getItem(key)
                || (type !== 'everything' ? root.localStorage.getItem('stash_fast_tag_popup_size') : null);
            if (value) {
                const parsed = JSON.parse(value);
                if (parsed && parsed.width && parsed.height) return parsed;
            }
        } catch (error) {}
        return dependencies.getOptimalPopupSize(type);
    }

    function setSavedSize(width, height, type = 'single') {
        try {
            const key = type === 'everything' ? 'stash_fast_tag_popup_size_everything' : 'stash_fast_tag_popup_size_single';
            root.localStorage.setItem(key, JSON.stringify({ width: Math.round(width), height: Math.round(height) }));
        } catch (error) {}
    }

    function createShell(type) {
        const config = dependencies.entityConfig[type];
        const theme = dependencies.getEffectiveTheme();
        const isDark = theme === 'dark';
        const kbdBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
        const kbdBorder = isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)';
        const savedSize = getSavedSize('single');
        const form = root.document.createElement('form');
        form.id = 'scenes-popup';
        form.setAttribute('data-popup-type', 'single');
        form.className = `theme-${theme}`;
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'fixed';
        form.style.zIndex = '1000000';
        form.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
        form.style.background = isDark ? '#1e293b' : '#ffffff';
        form.style.border = isDark ? '1px solid #334155' : '1px solid #cbd5e1';
        form.style.boxShadow = isDark ? '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)' : '0 20px 25px -5px rgba(0, 0, 0, 0.15)';
        form.style.padding = '8px 12px 12px 12px';
        form.style.borderRadius = '10px';
        const maxScreenW = Math.max(320, root.innerWidth - 16);
        const maxScreenH = Math.max(480, root.innerHeight - 16);
        const optimal = dependencies.getOptimalPopupSize('single');
        const rawW = savedSize?.width && savedSize.width >= 320 ? savedSize.width : optimal.width;
        const rawH = savedSize?.height && savedSize.height >= 480 ? savedSize.height : optimal.height;
        form.style.width = `${Math.min(rawW, maxScreenW)}px`;
        form.style.height = `${Math.min(rawH, maxScreenH)}px`;
        form.style.minWidth = '320px';
        form.style.maxWidth = 'calc(100vw - 16px)';
        form.style.minHeight = '480px';
        form.style.maxHeight = 'calc(100vh - 16px)';
        form.style.boxSizing = 'border-box';
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.overflow = 'hidden';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        form.innerHTML = `
            <div id="${type}-popup-header" class="popup-header" style="margin: 0 0 7px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: grab; user-select: none; flex-shrink: 0; min-height: 20px;">
                <div style="display: inline-flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                    <span id="${type}-popup-title" class="popup-title" style="font-size: 13px; font-weight: 600; line-height: 1.2; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: grab; display: inline-flex; align-items: center;">Edit ${config.pluralTitle}</span>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; cursor: default;">
                    <label class="popup-seq-label" style="font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; user-select: none; margin: 0; line-height: 1;">
                        <input type="checkbox" id="${type}-sequential-mode" style="cursor: pointer; margin: 0; width: 13px; height: 13px; accent-color: #6366f1; vertical-align: middle;">
                        Sequential
                    </label>
                    <div id="${type}-nav-group" style="display: inline-flex; align-items: center; gap: 4px; overflow: hidden; max-width: 0; opacity: 0; transition: max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease; vertical-align: middle;">
                        <button type="button" id="${type}-prev-btn" class="popup-nav-btn" title="Previous scene (Alt+A or Alt+Left)" style="padding: 2px 7px; height: 22px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; box-sizing: border-box;">◄</button>
                        <button type="button" id="${type}-next-btn" class="popup-nav-btn" title="Next scene (Alt+D or Alt+Right)" style="padding: 2px 7px; height: 22px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; box-sizing: border-box;">►</button>
                    </div>
                </div>
            </div>
            <div id="${type}-preview-container" style="flex-shrink: 0;"></div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px; align-items: center; flex-shrink: 0;">
                <div style="position: relative; flex: 1; display: flex; align-items: center;">
                    <svg viewBox="0 0 24 24" width="13.5" height="13.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 10px; color: ${isDark ? '#818cf8' : '#6366f1'}; opacity: 0.8; pointer-events: none; user-select: none;">
                        <circle cx="11" cy="11" r="7"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="${type}-search-input" autofocus class="popup-search-input" autocomplete="off" spellcheck="false" placeholder="Search ${config.pluralTitle.toLowerCase()}..." style="width: 100%; padding: 8px 28px 8px 31px; box-sizing: border-box; border-radius: 8px; font-size: 12.5px; font-weight: 500; outline: none;">
                    <span id="${type}-search-clear" class="popup-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 16px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="${type}-refresh-btn" class="popup-refresh-btn" title="Refresh cache" style="padding: 8px 10px; cursor: pointer; font-size: 13px; font-weight: 500; border-radius: 8px; white-space: nowrap; line-height: 1;">↻</button>
            </div>
            <div id="${type}-scraper-card-container" style="display: none; flex-direction: column; margin-bottom: 8px; flex-shrink: 0; width: 100%; box-sizing: border-box;"></div>
            <div id="${type}-suggestions-container" style="display: none; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; flex-shrink: 0; background: rgba(245, 158, 11, 0.08); padding: 6px 8px; border-radius: 6px; border: 1px dashed rgba(245, 158, 11, 0.35);"></div>
            <div id="${type}-quick-actions" style="display: none; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; flex-shrink: 0;"></div>
            <div id="${type}-tabulator-table" style="margin-bottom: 6px; width: 100%; flex: 1 1 0px; min-height: 60px; box-sizing: border-box; overflow: hidden;"></div>
            <div id="${type}-bottom-create-container" style="display: none; align-items: center; justify-content: center; margin-bottom: 8px; flex-shrink: 0;">
                <button type="button" id="${type}-create-btn" class="fasttag-create-empty-btn" style="display: inline-flex; align-items: center; gap: 6px; width: 100%; justify-content: center; padding: 7px 14px; background: #059669; color: white; border: none; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 5px rgba(5,150,105,0.3); transition: all 0.15s ease;"></button>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                <button type="button" id="${type}-organized-btn" class="fasttag-organized-pill" style="display: none; flex-shrink: 0;"></button>
                <button type="button" id="${type}-save-btn" style="flex: 1; padding: 8px; cursor: pointer; font-size: 12px; font-weight: 600; background: #6366f1; color: white; border: none; border-radius: 6px; transition: background 0.15s ease;">Save ${config.pluralTitle}</button>
                <button type="button" id="${type}-cancel-btn" class="popup-cancel-btn" style="padding: 8px 14px; cursor: pointer; font-size: 12px; font-weight: 500; border-radius: 6px;">Close</button>
            </div>

            <!-- 8-Direction Resize Handles -->
            <div class="popup-resize-handle" data-dir="n" style="position: absolute; top: -5px; left: 12px; right: 12px; height: 10px; cursor: ns-resize; z-index: 10;"></div>
            <div class="popup-resize-handle" data-dir="s" style="position: absolute; bottom: -5px; left: 12px; right: 12px; height: 10px; cursor: ns-resize; z-index: 10;"></div>
            <div class="popup-resize-handle" data-dir="e" style="position: absolute; right: -5px; top: 12px; bottom: 12px; width: 10px; cursor: ew-resize; z-index: 10;"></div>
            <div class="popup-resize-handle" data-dir="w" style="position: absolute; left: -5px; top: 12px; bottom: 12px; width: 10px; cursor: ew-resize; z-index: 10;"></div>
            <div class="popup-resize-handle" data-dir="ne" style="position: absolute; top: -5px; right: -5px; width: 16px; height: 16px; cursor: nesw-resize; z-index: 11;"></div>
            <div class="popup-resize-handle" data-dir="nw" style="position: absolute; top: -5px; left: -5px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 11;"></div>
            <div class="popup-resize-handle" data-dir="se" style="position: absolute; bottom: -5px; right: -5px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 11;"></div>
            <div class="popup-resize-handle" data-dir="sw" style="position: absolute; bottom: -5px; left: -5px; width: 16px; height: 16px; cursor: nesw-resize; z-index: 11;"></div>
        `;

        root.document.body.appendChild(form);
        dependencies.mountMomentaryPeekButton?.(form, form.querySelector('.popup-header'));
        return {
            element: form,
            previewContainer: form.querySelector(`#${type}-preview-container`),
            tableContainer: form.querySelector(`#${type}-tabulator-table`),
            bottomCreateContainer: form.querySelector(`#${type}-bottom-create-container`),
            searchInput: form.querySelector(`#${type}-search-input`),
            searchClear: form.querySelector(`#${type}-search-clear`),
            kbdShortcut: form.querySelector(`#${type}-kbd-shortcut`),
            createBtn: form.querySelector(`#${type}-create-btn`),
            scrapeBtn: form.querySelector(`#${type}-scrape-btn`),
            scraperCardContainer: form.querySelector(`#${type}-scraper-card-container`),
            organizedBtn: form.querySelector(`#${type}-organized-btn`),
            refreshBtn: form.querySelector(`#${type}-refresh-btn`),
            saveBtn: form.querySelector(`#${type}-save-btn`),
            cancelBtn: form.querySelector(`#${type}-cancel-btn`)
        };
    }


    function positionNearCard(form, cardElement) {
        if (!dependencies) throw new Error('[FastTag] Popup integration is not configured');
        const minTop = 8;
        const minLeft = 8;
        const sequentialEditState = dependencies.getSequentialEditState();

        const clampPos = (x, y) => {
            const formW = form.offsetWidth || 400;
            const formH = form.offsetHeight || 500;
            const maxAllowedTop = Math.max(minTop, root.innerHeight - formH - 8);
            const maxAllowedLeft = Math.max(minLeft, root.innerWidth - formW - 8);
            return {
                x: Math.max(minLeft, Math.min(maxAllowedLeft, x)),
                y: Math.max(minTop, Math.min(maxAllowedTop, y))
            };
        };

        const popupType = form.getAttribute('data-popup-type') || dependencies.getActivePopup?.()?.type;
        const isEverythingModal = popupType === 'everything' || popupType === 'bulk-everything';

        if (isEverythingModal) {
            let savedPos = null;
            try {
                savedPos = JSON.parse(root.localStorage.getItem('fasttag_everything_pos') || 'null');
            } catch (error) {}

            let posX = null;
            let posY = null;
            const formW = parseInt(form.style.width, 10) || form.offsetWidth || 660;
            const formH = parseInt(form.style.height, 10) || form.offsetHeight || 520;

            if (savedPos && savedPos.left && savedPos.top) {
                const parsedX = parseInt(savedPos.left, 10);
                const parsedY = parseInt(savedPos.top, 10);
                if (!isNaN(parsedX) && !isNaN(parsedY)) {
                    const pos = clampPos(parsedX, parsedY);
                    posX = pos.x;
                    posY = pos.y;
                }
            }

            if (posX == null || posY == null) {
                const defaultPosition = dependencies.getDefaultEverythingPosition(formW, formH);
                posX = defaultPosition.x;
                posY = defaultPosition.y;
            }

            form.style.left = `${posX}px`;
            form.style.top = `${posY}px`;
            if (sequentialEditState.enabled) {
                sequentialEditState.popupPosition = { left: posX, top: posY };
            }

            root.requestAnimationFrame(() => {
                const actualFormRect = form.getBoundingClientRect();
                const pos = clampPos(actualFormRect.left, actualFormRect.top);
                form.style.left = `${pos.x}px`;
                form.style.top = `${pos.y}px`;
                form.classList.add('popup-visible');
                if (typeof form._fastTagOnResize === 'function') form._fastTagOnResize();
                const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
                if (firstInput) firstInput.focus({ preventScroll: true });
            });
            return;
        }

        if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0) {
            const pos = clampPos(sequentialEditState.popupPosition.left, sequentialEditState.popupPosition.top);
            form.style.left = `${pos.x}px`;
            form.style.top = `${pos.y}px`;
            root.requestAnimationFrame(() => form.classList.add('popup-visible'));
            const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
            return;
        }

        // A fresh single-entity editor belongs to the card that opened it. Older
        // builds persisted dragged single-editor positions across sessions; clear
        // that legacy value so it cannot override the current card anchor. During
        // an active sequential session the branch above still retains a user move.
        try {
            root.localStorage.removeItem('fasttag_single_pos');
        } catch (error) {}

        const cardRect = cardElement ? cardElement.getBoundingClientRect() : { right: 100, top: 100, left: 100 };
        let popupX = cardRect.right + 10;
        let popupY = Math.max(minTop, cardRect.top);
        form.style.left = `${popupX}px`;
        form.style.top = `${popupY}px`;

        root.requestAnimationFrame(() => {
            const formRect = form.getBoundingClientRect();
            if (cardRect.right + 10 + formRect.width > root.innerWidth) popupX = cardRect.left - formRect.width - 10;
            if (cardRect.top + formRect.height > root.innerHeight) popupY = root.innerHeight - formRect.height - 8;
            const pos = clampPos(popupX, popupY);
            form.style.left = `${pos.x}px`;
            form.style.top = `${pos.y}px`;
            form.classList.add('popup-visible');
            if (typeof form._fastTagOnResize === 'function') form._fastTagOnResize();
            const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
        });
    }

    function setupListeners(form, signal, onSaveCallback) {
        if (!dependencies) throw new Error('[FastTag] Popup integration is not configured');
        const sequentialEditState = dependencies.getSequentialEditState();
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, { signal });

        setTimeout(() => {
            root.document.addEventListener('mousedown', (e) => {
                if (e.target && (
                    form.contains(e.target) ||
                    e.target.closest('#fasttag-sort-dropdown-menu') ||
                    e.target.closest('#fasttag-floating-video-hud') ||
                    e.target.closest('#fasttag-floating-scraper-hud') ||
                    e.target.closest('#fasttag-cover-editor-hud') ||
                    e.target.closest('#fasttag-performer-hover-card') ||
                    e.target.closest('#fasttag-settings-modal') ||
                    e.target.closest('#fasttag-create-modal') ||
                    e.target.closest('#fasttag-scrape-cover-tooltip') ||
                    e.target.closest('#fasttag-micro-tooltip') ||
                    e.target.closest('.toastify')
                )) {
                    return;
                }
                closeActive();
            }, { signal });
        }, 0);

        root.document.body.classList.add('fasttag-modal-open');

        // Global Wheel Trap for FastTag Modal:
        // Completely locks background Stash page from scrolling, while allowing popup & sidecar scroll containers to scroll
        root.addEventListener('wheel', (e) => {
            const popup = root.document.querySelector('#scenes-popup');
            if (!popup || popup.style.display === 'none') return;

            const scraperHud = root.document.querySelector('#fasttag-floating-scraper-hud');
            const videoHud = root.document.querySelector('#fasttag-floating-video-hud');
            const coverEditorHud = root.document.querySelector('#fasttag-cover-editor-hud');
            const settingsModal = root.document.querySelector('#fasttag-settings-modal');
            const isInsideAllowed = (el) => Boolean(
                (popup && popup.contains(el)) ||
                (scraperHud && scraperHud.contains(el)) ||
                (videoHud && videoHud.contains(el)) ||
                (coverEditorHud && coverEditorHud.contains(el)) ||
                (settingsModal && settingsModal.contains(el))
            );

            // 1. Allow video player & preview containers to handle mouse wheel freely for frame scrubbing
            if (e.target.closest('[id$="-preview-container"], .fasttag-video-preview, video, #fasttag-floating-video-hud, #fasttag-cover-editor-hud #fasttag-media-container, #fasttag-video-container, #fasttag-video-element')) {
                return;
            }

            // 2. Check if mouse is over a horizontal scroll container (Studio/Groups bar, Suggestion chips, Recent chips)
            const hScrollable = e.target.closest('#everything-studio-scroll, #everything-groups-scroll, #everything-studio-half, #everything-groups-half, #everything-sugg-tags-chips, #everything-sugg-performers-chips, [id$="-suggestions-container"], .fasttag-chip-row, [id*="-chips"]');
            if (hScrollable && isInsideAllowed(hScrollable)) {
                const target = hScrollable.closest('#everything-studio-scroll, #everything-groups-scroll, #everything-sugg-tags-chips, #everything-sugg-performers-chips, [id$="-suggestions-container"], .fasttag-chip-row, [id*="-chips"]') || hScrollable;
                let delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
                if (e.deltaMode === 1) delta *= 28;
                else if (e.deltaMode === 2) delta *= 400;
                if (delta !== 0) {
                    target.scrollLeft += delta;
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }

            const scrollable = e.target.closest('.tabulator-tableholder, #fasttag-scrape-items-preview, #fasttag-cover-editor-hud, [id$="-quick-actions"], [id*="-chips"], .fasttag-chip-row, textarea');
            if (scrollable && isInsideAllowed(scrollable)) {
                const hasScrollableY = scrollable.scrollHeight > scrollable.clientHeight;
                const atTop = scrollable.scrollTop <= 0 && e.deltaY < 0;
                const atBottom = (scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1) && e.deltaY > 0;
                if (atTop || atBottom || !hasScrollableY) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } else if (scraperHud && scraperHud.contains(e.target)) {
                // Forward the scroll to #fasttag-scrape-items-preview so wheel scrolling works anywhere in the sidecar!
                const preview = scraperHud.querySelector('#fasttag-scrape-items-preview');
                if (preview) {
                    let delta = e.deltaY;
                    if (e.deltaMode === 1) delta *= 28;
                    else if (e.deltaMode === 2) delta *= 400;
                    preview.scrollTop += delta;
                    e.preventDefault();
                    e.stopPropagation();
                }
            } else {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false, capture: true, signal });

        // Strictly contain all popup keyboard events so they never bubble out to Stash
        form.addEventListener('keydown', (e) => {
            // Alt+V / Option+V to toggle Full Video Stream vs Preview (prevent Mac from typing special character √ into inputs)
            if (e.altKey && (e.code === 'KeyV' || e.key === 'v' || e.key === 'V' || e.key === '√')) {
                e.preventDefault();
                e.stopPropagation();
                if (typeof root._fastTagActiveToggleVideoMode === 'function') {
                    root._fastTagActiveToggleVideoMode();
                }
                return;
            }

            e.stopPropagation();
            const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            if (!isTyping && (e.key === ' ' || e.key === 'Spacebar' || e.key === 'j' || e.key === 'k' || e.key === 'l' || e.key === 'n' || e.key === 'p')) {
                e.preventDefault();
            }
        }, { signal });

        root.document.addEventListener('keydown', (e) => {
            if (!root.document.body.contains(form)) return;

            // Handle Escape key: 2-stage (Stage 1: clear search if text present; Stage 2: close popup)
            if (e.key === 'Escape') {
                const subModal = root.document.querySelector('#fasttag-settings-modal, #fasttag-create-modal, #fasttag-cover-editor-hud, .fasttag-create-dialog-overlay, .fasttag-bulk-confirm-overlay');
                if (subModal && subModal.style.display !== 'none') return;

                const searchBox = form.querySelector('#everything-global-search, #scenes-popup-global-filter, #scenes-popup-filter, input[type="text"], input[type="search"]');
                if (searchBox && searchBox.value.trim().length > 0) {
                    e.preventDefault();
                    e.stopPropagation();
                    const clearBtn = form.querySelector('#everything-global-clear, [id$="-search-clear"]');
                    if (clearBtn) {
                        clearBtn.click();
                    } else {
                        searchBox.value = '';
                        searchBox.dispatchEvent(new root.Event('input', { bubbles: true }));
                    }
                    searchBox.focus({ preventScroll: true });
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                closeActive();
                return;
            }

            if (e.target?.closest?.('#fasttag-cover-editor-hud')) return;

            // Alt+S for Scrape
            if (e.altKey && (e.key === 's' || e.key === 'S')) {
                const scrapeBtn = form.querySelector('.popup-scrape-btn');
                if (scrapeBtn && !scrapeBtn.disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    scrapeBtn.click();
                    return;
                }
            }

            // Alt+V / Option+V to toggle Full Video Stream vs Preview
            if (e.altKey && (e.code === 'KeyV' || e.key === 'v' || e.key === 'V' || e.key === '√')) {
                if (typeof root._fastTagActiveToggleVideoMode === 'function') {
                    e.preventDefault();
                    e.stopPropagation();
                    root._fastTagActiveToggleVideoMode();
                    return;
                }
            }

            // Alt+A / Alt+D and Alt+Left / Alt+Right for Sequential or Random navigation.
            if ((sequentialEditState.enabled || dependencies.getActivePopup?.()?._isRandomMode) && e.altKey) {
                if (e.key === 'ArrowRight' || e.code === 'KeyD') {
                    e.preventDefault();
                    e.stopPropagation();
                    const nextBtn = form.querySelector('button[id$="-next-btn"]');
                    if (nextBtn && !nextBtn.disabled) nextBtn.click();
                    return;
                } else if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
                    e.preventDefault();
                    e.stopPropagation();
                    const prevBtn = form.querySelector('button[id$="-prev-btn"]');
                    if (prevBtn && !prevBtn.disabled) prevBtn.click();
                    return;
                }
            }

            // If key event originated OUTSIDE form, block Stash hotkeys from running in the
            // background, but never consume typing inside detached FastTag inputs (such as
            // the floating scraper's manual-search field).
            const isTextEntryTarget = Boolean(e.target && (
                e.target.isContentEditable
                || e.target.tagName === 'INPUT'
                || e.target.tagName === 'TEXTAREA'
                || e.target.tagName === 'SELECT'
            ));
            if (!form.contains(e.target) && !isTextEntryTarget) {
                const pageNavKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar', 'n', 'N', 'p', 'P', 'j', 'J', 'k', 'K', 'l', 'L'];
                if (pageNavKeys.includes(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }
        }, { capture: true, signal });

        root.document.addEventListener('keydown', (e) => {
            if (e.defaultPrevented) return;
            if (e.key === 'Enter') {
                const isSearchFocused = root.document.activeElement && (root.document.activeElement.tagName === 'INPUT' || root.document.activeElement.tagName === 'TEXTAREA');

                if (isSearchFocused && !e.ctrlKey && !e.metaKey) return;

                if (!isSearchFocused || e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    const saveBtn = form.querySelector('button[id$="-save-btn"]');
                    if (saveBtn) {
                        saveBtn.click();
                    } else if (onSaveCallback) {
                        onSaveCallback();
                    }
                }
            }
        }, { signal });

        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        const header = form.querySelector('.popup-header') || form.querySelector('.popup-drag-handle');

        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.button !== 0 || e.target.closest('input, button, label')) return;
                isDragging = true;
                header.style.cursor = 'grabbing';
                root.document.body.style.userSelect = 'none';
                startX = e.clientX;
                startY = e.clientY;
                const rect = form.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
            }, { signal });

            root.document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    let targetX = startLeft + dx;
                    let targetY = startTop + dy;

                    // Strictly clamp to viewport bounds so the popup stays 100% inside visible screen
                    const minTop = 8;
                    const maxTop = Math.max(minTop, root.innerHeight - form.offsetHeight - 8);
                    const minLeft = 8;
                    const maxLeft = Math.max(minLeft, root.innerWidth - form.offsetWidth - 8);

                    targetY = Math.max(minTop, Math.min(maxTop, targetY));
                    targetX = Math.max(minLeft, Math.min(maxLeft, targetX));

                    form.style.left = `${targetX}px`;
                    form.style.top = `${targetY}px`;
                }
            }, { signal });

            root.document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = 'grab';
                    root.document.body.style.userSelect = '';
                    const popupType = form.getAttribute('data-popup-type') || dependencies.getActivePopup?.()?.type;
                    if (popupType === 'everything' || popupType === 'bulk-everything') {
                        try {
                            localStorage.setItem('fasttag_everything_pos', JSON.stringify({
                                left: form.style.left,
                                top: form.style.top
                            }));
                        } catch (e) {}
                    } else {
                        try {
                            localStorage.removeItem('fasttag_single_pos');
                        } catch (e) {}
                    }
                    if (sequentialEditState.enabled) {
                        const rect = form.getBoundingClientRect();
                        sequentialEditState.popupPosition = { left: rect.left, top: rect.top };
                    }
                }
            }, { signal });
        }

        // --- Type-to-Search (Omnibox Auto-Focus) & Background Hotkey Blocker ---
        root.document.addEventListener('keydown', (e) => {
            const isInputFocused = root.document.activeElement && (root.document.activeElement.tagName === 'INPUT' || root.document.activeElement.tagName === 'TEXTAREA');

            const isSubModalOpen = root.document.querySelector('#fasttag-settings-modal, #fasttag-create-modal');
            if (isSubModalOpen && isSubModalOpen.style.display !== 'none') return;

            if (!isInputFocused) {
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    const searchBox = form.querySelector('#everything-global-search, #scenes-popup-global-filter, #scenes-popup-filter, input[type="text"], input[type="search"]');
                    if (searchBox && root.document.body.contains(searchBox)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        searchBox.focus({ preventScroll: true });
                        searchBox.value += e.key;
                        const len = searchBox.value.length;
                        try { searchBox.setSelectionRange(len, len); } catch (err) {}
                        searchBox.dispatchEvent(new root.Event('input', { bubbles: true }));
                        return;
                    }
                } else if (e.key === 'Backspace') {
                    const searchBox = form.querySelector('#everything-global-search, #scenes-popup-global-filter, #scenes-popup-filter, input[type="text"], input[type="search"]');
                    if (searchBox && root.document.body.contains(searchBox)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        searchBox.focus({ preventScroll: true });
                        if (searchBox.value.length > 0) {
                            searchBox.value = searchBox.value.slice(0, -1);
                            const len = searchBox.value.length;
                            try { searchBox.setSelectionRange(len, len); } catch (err) {}
                            searchBox.dispatchEvent(new root.Event('input', { bubbles: true }));
                        }
                        return;
                    }
                } else {
                    const stashHotkeys = [' ', 'Spacebar', 'n', 'N', 'p', 'P', 'j', 'J', 'k', 'K', 'l', 'L'];
                    if (stashHotkeys.includes(e.key) && !e.altKey && !e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                    }
                }
            }
        }, { capture: true, signal });

        // --- 8-Direction Resizing ---
        let isResizing = false;
        let resizeDir = '';
        let resizeStartX = 0;
        let resizeStartY = 0;
        let resizeStartLeft = 0;
        let resizeStartTop = 0;
        let resizeStartWidth = 0;
        let resizeStartHeight = 0;

        const resizeHandles = form.querySelectorAll('.popup-resize-handle');
        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                resizeDir = handle.getAttribute('data-dir') || '';
                resizeStartX = e.clientX;
                resizeStartY = e.clientY;
                const rect = form.getBoundingClientRect();
                resizeStartLeft = rect.left;
                resizeStartTop = rect.top;
                resizeStartWidth = form.offsetWidth;
                resizeStartHeight = form.offsetHeight;

                root.document.body.style.cursor = handle.style.cursor;
                root.document.body.style.userSelect = 'none';
            }, { signal });
        });

        root.document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const deltaX = e.clientX - resizeStartX;
                const deltaY = e.clientY - resizeStartY;

                let newWidth = resizeStartWidth;
                let newHeight = resizeStartHeight;
                let newLeft = resizeStartLeft;
                let newTop = resizeStartTop;

                if (resizeDir.includes('e')) {
                    newWidth = resizeStartWidth + deltaX;
                }
                if (resizeDir.includes('w')) {
                    newWidth = resizeStartWidth - deltaX;
                    newLeft = resizeStartLeft + deltaX;
                }
                if (resizeDir.includes('s')) {
                    newHeight = resizeStartHeight + deltaY;
                }
                if (resizeDir.includes('n')) {
                    newHeight = resizeStartHeight - deltaY;
                    newTop = resizeStartTop + deltaY;
                }

                // Bounds clamping
                const minW = 320;
                const maxW = Math.max(minW, root.innerWidth - 16);
                const minH = 380;
                const maxH = Math.max(minH, root.innerHeight - 16);
                const minTop = 8;
                const maxBottom = root.innerHeight - 8;
                const minLeft = 8;
                const maxRight = root.innerWidth - 8;

                if (newTop < minTop) {
                    if (resizeDir.includes('n')) {
                        newHeight = resizeStartHeight - (minTop - resizeStartTop);
                        newTop = minTop;
                    }
                }
                if (newLeft < minLeft) {
                    if (resizeDir.includes('w')) {
                        newWidth = resizeStartWidth - (minLeft - resizeStartLeft);
                        newLeft = minLeft;
                    }
                }

                // South clamping (bottom of screen >= 8px)
                if (resizeDir.includes('s')) {
                    if (resizeStartTop + newHeight > maxBottom) {
                        newHeight = Math.max(minH, maxBottom - resizeStartTop);
                    }
                }

                // East clamping (right of screen >= 8px)
                if (resizeDir.includes('e')) {
                    if (resizeStartLeft + newWidth > maxRight) {
                        newWidth = Math.max(minW, maxRight - resizeStartLeft);
                    }
                }

                if (newWidth < minW) {
                    if (resizeDir.includes('w')) newLeft = resizeStartLeft + (resizeStartWidth - minW);
                    newWidth = minW;
                } else if (newWidth > maxW) {
                    if (resizeDir.includes('w')) newLeft = resizeStartLeft - (maxW - resizeStartWidth);
                    newWidth = maxW;
                }

                if (newHeight < minH) {
                    if (resizeDir.includes('n')) newTop = resizeStartTop + (resizeStartHeight - minH);
                    newHeight = minH;
                } else if (newHeight > maxH) {
                    if (resizeDir.includes('n')) newTop = resizeStartTop - (maxH - resizeStartHeight);
                    newHeight = maxH;
                }

                form.style.width = `${newWidth}px`;
                form.style.height = `${newHeight}px`;
                if (resizeDir.includes('w')) form.style.left = `${newLeft}px`;
                if (resizeDir.includes('n')) form.style.top = `${newTop}px`;

                redrawTableIfReady(dependencies.getActiveTableInstance?.(), true);
                if (typeof form._fastTagOnResize === 'function') {
                    form._fastTagOnResize();
                }
            }
        }, { signal });

        root.document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                root.document.body.style.cursor = '';
                root.document.body.style.userSelect = '';
                const popupType = form.getAttribute('data-popup-type') || (form.querySelector('#everything-columns-container') ? 'everything' : 'single');
                setSavedSize(form.offsetWidth, form.offsetHeight, popupType);
                redrawTableIfReady(dependencies.getActiveTableInstance?.(), true);
                if (typeof form._fastTagOnResize === 'function') {
                    form._fastTagOnResize();
                }
            }
        }, { signal });
    }


    root.FastTag = root.FastTag || {};
    root.FastTag.popup = Object.freeze({
        configure,
        beginSession,
        isPopupClosing,
        closeActive,
        getSavedSize,
        setSavedSize,
        createShell,
        positionNearCard,
        setupListeners
    });
}(typeof window !== 'undefined' ? window : globalThis));
