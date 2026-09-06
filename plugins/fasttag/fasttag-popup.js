(function initializeFastTagPopup(root) {
    'use strict';

    let dependencies = null;

    function configure(options) {
        dependencies = options;
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
                        <button type="button" id="${type}-prev-btn" class="popup-nav-btn" title="Previous scene (Alt+Left)" style="padding: 2px 7px; height: 22px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; box-sizing: border-box;">◄</button>
                        <button type="button" id="${type}-next-btn" class="popup-nav-btn" title="Next scene (Alt+Right)" style="padding: 2px 7px; height: 22px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; box-sizing: border-box;">►</button>
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

        let savedSinglePos = null;
        try {
            savedSinglePos = JSON.parse(root.localStorage.getItem('fasttag_single_pos') || 'null');
        } catch (error) {}

        if (savedSinglePos && savedSinglePos.left && savedSinglePos.top) {
            const parsedX = parseInt(savedSinglePos.left, 10);
            const parsedY = parseInt(savedSinglePos.top, 10);
            if (!isNaN(parsedX) && !isNaN(parsedY)) {
                const pos = clampPos(parsedX, parsedY);
                form.style.left = `${pos.x}px`;
                form.style.top = `${pos.y}px`;
                if (sequentialEditState.enabled) sequentialEditState.popupPosition = { left: pos.x, top: pos.y };
                root.requestAnimationFrame(() => {
                    const actualFormRect = form.getBoundingClientRect();
                    const clamped = clampPos(actualFormRect.left, actualFormRect.top);
                    form.style.left = `${clamped.x}px`;
                    form.style.top = `${clamped.y}px`;
                    form.classList.add('popup-visible');
                    if (typeof form._fastTagOnResize === 'function') form._fastTagOnResize();
                    const firstInput = form.querySelector('input[type="text"], input[type="search"]');
                    if (firstInput) firstInput.focus({ preventScroll: true });
                });
                return;
            }
        }

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

    root.FastTag = root.FastTag || {};
    root.FastTag.popup = Object.freeze({
        configure,
        getSavedSize,
        setSavedSize,
        createShell,
        positionNearCard
    });
}(typeof window !== 'undefined' ? window : globalThis));
