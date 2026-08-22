// ==UserScript==
// @name         Stash Scene Manager Context Menu
// @namespace    http://tampermonkey.net/
// @version      1.9.52
// @description  Fast scene tagging workflow for Stash: edit tags, performers, and galleries from scene cards with quick search and popups
// @match        http://localhost:*/*
// @match        http://127.0.0.1:*/*
// @grant        none
// @run-at       document-end
// @require      https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js
// @require      https://cdn.jsdelivr.net/npm/toastify-js
// @updateURL    https://raw.githubusercontent.com/kmarsh2311/my-stash-plugins/main/a.js
// @downloadURL  https://raw.githubusercontent.com/kmarsh2311/my-stash-plugins/main/a.js
// ==/UserScript==

(async function() {
    'use strict';

    // Scroll position persistence for full saves and delayed Stash rendering.
    const scrollKey = 'stash_scroll_pos_' + window.location.pathname + window.location.search;
    let activeScrollContainer = null;

    function getElementPath(element) {
        if (element.id) return `#${CSS.escape(element.id)}`;
        const path = [];
        let current = element;
        while (current && current !== document.body) {
            let index = 1;
            let sibling = current;
            while ((sibling = sibling.previousElementSibling)) index++;
            path.unshift(`${current.tagName.toLowerCase()}:nth-child(${index})`);
            current = current.parentElement;
        }
        return path.join(' > ');
    }

    function findScrollContainer(path) {
        if (!path) return null;
        try {
            return document.querySelector(path);
        } catch (e) {
            return null;
        }
    }

    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
        sessionStorage.removeItem(scrollKey);
        let targetScroll;
        try {
            const parsed = JSON.parse(savedScroll);
            targetScroll = typeof parsed === 'number'
                ? { windowX: 0, windowY: parsed, containerTop: 0, containerLeft: 0, containerPath: '' }
                : {
                    windowX: Number(parsed.windowX ?? parsed.x) || 0,
                    windowY: Number(parsed.windowY ?? parsed.y) || 0,
                    containerTop: Number(parsed.containerTop) || 0,
                    containerLeft: Number(parsed.containerLeft) || 0,
                    containerPath: parsed.containerPath || ''
                };
        } catch (e) {
            targetScroll = { windowX: 0, windowY: parseInt(savedScroll, 10) || 0, containerTop: 0, containerLeft: 0, containerPath: '' };
        }
        let attempts = 0;
        const restoreScroll = () => {
            const container = findScrollContainer(targetScroll.containerPath);
            window.scrollTo(targetScroll.windowX, targetScroll.windowY);
            if (container) {
                container.scrollLeft = targetScroll.containerLeft;
                container.scrollTop = targetScroll.containerTop;
            }
            const containerRestored = !container || (container.scrollLeft === targetScroll.containerLeft && container.scrollTop === targetScroll.containerTop);
            if ((window.scrollX !== targetScroll.windowX || window.scrollY !== targetScroll.windowY || !containerRestored) && attempts < 100) {
                attempts++;
                setTimeout(restoreScroll, 100);
            }
        };
        setTimeout(restoreScroll, 50);
    }

    const saveScrollPosition = () => {
        const container = activeScrollContainer && document.contains(activeScrollContainer)
            ? activeScrollContainer
            : null;
        sessionStorage.setItem(scrollKey, JSON.stringify({
            windowX: window.scrollX,
            windowY: window.scrollY,
            containerTop: container ? container.scrollTop : 0,
            containerLeft: container ? container.scrollLeft : 0,
            containerPath: container ? getElementPath(container) : ''
        }));
    };

    // Track window and nested scrolling surfaces so detail pages restore correctly.
    document.addEventListener('scroll', (event) => {
        if (event.target instanceof HTMLElement && !event.target.closest('#scenes-popup')) {
            activeScrollContainer = event.target;
        }
        if (window.scrollY > 0 || activeScrollContainer) {
            saveScrollPosition();
        }
    }, { capture: true, passive: true });

    let isTabActive = true;
    document.addEventListener('visibilitychange', () => {
        isTabActive = !document.hidden;
    });

    if (!document.getElementById('tabulator-external-css')) {
        const tabulatorCSS = document.createElement('link');
        tabulatorCSS.id = 'tabulator-external-css';
        tabulatorCSS.rel = 'stylesheet';
        tabulatorCSS.href = 'https://unpkg.com/tabulator-tables@5.5.2/dist/css/tabulator.min.css';
        document.head.appendChild(tabulatorCSS);
    }

    if (!document.getElementById('toastify-external-css')) {
        const toastifyCSS = document.createElement('link');
        toastifyCSS.id = 'toastify-external-css';
        toastifyCSS.rel = 'stylesheet';
        toastifyCSS.href = 'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css';
        document.head.appendChild(toastifyCSS);
    }

    const styleId = 'scenes-manager-modern-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
        #scenes-custom-menu {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 6px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            min-width: 150px;
            animation: menuFadeIn 0.15s ease-out;
        }
        #scenes-custom-menu a {
            display: block;
            padding: 8px 12px;
            color: #1e293b;
            text-decoration: none;
            border-radius: 4px;
            transition: background 0.15s, color 0.15s;
        }
        #scenes-custom-menu a:hover {
            background: #f1f5f9;
            color: #0f172a;
        }
        @keyframes menuFadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        #scenes-popup .tabulator {
            background-color: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            font-size: 12px !important;
        }
        #scenes-popup .tabulator .tabulator-header {
            background-color: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
            color: #64748b !important;
        }
        #scenes-popup .tabulator .tabulator-header .tabulator-col {
            background-color: transparent !important;
            border-right: none !important;
        }
        #scenes-popup .tabulator .tabulator-header .tabulator-col-title {
            color: #475569 !important;
            font-weight: 600 !important;
        }
        #scenes-popup .tabulator .tabulator-row {
            background-color: #ffffff !important;
            color: #1e293b !important;
            border-bottom: 1px solid #f1f5f9 !important;
        }
        #scenes-popup .tabulator .tabulator-row:hover {
            background-color: #f1f5f9 !important;
        }
        #scenes-popup .tabulator .tabulator-row.tabulator-selected,
        #scenes-popup .tabulator .tabulator-row.tabulator-selected:hover {
            background-color: #e0e7ff !important;
            color: #1e293b !important;
        }
        #scenes-popup .tabulator .tabulator-placeholder {
            color: #94a3b8 !important;
        }
        #scenes-popup .tabulator-tableholder {
            overflow-x: hidden !important;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar {
            width: 14px;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 0 6px 6px 0;
            border-left: 1px solid #e2e8f0;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 6px;
            border: 2px solid #f1f5f9;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-button:single-button {
            background-color: #e2e8f0;
            display: block;
            border-style: solid;
            height: 14px;
            width: 14px;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-button:single-button:vertical:decrement {
            border-width: 0 4px 5px 4px;
            border-color: transparent transparent #475569 transparent;
            background-position: center;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-button:single-button:vertical:increment {
            border-width: 5px 4px 0 4px;
            border-color: #475569 transparent transparent transparent;
            background-position: center;
        }
        `;
        document.head.appendChild(style);
    }

    const fetchGQL = async (query, variables = {}) => {
        try {
            const res = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables })
            });

            if (!res.ok) {
                return { errors: [{ message: `GraphQL request failed: ${res.status} ${res.statusText}` }] };
            }

            const payload = await res.json();
            if (!payload || typeof payload !== 'object') {
                return { errors: [{ message: 'GraphQL response was not valid JSON.' }] };
            }

            return payload;
        } catch (err) {
            console.error('Stash Scene Manager: Network error', err);
            return { errors: [{ message: err.message || 'Unknown network error' }] };
        }
    };

    function showToast(message, type = "success") {
        if (typeof Toastify === 'undefined') {
            console.log(`[Toast Fallback - ${type}] ${message}`);
            return;
        }
        Toastify({
            text: message,
            duration: 2000,
            gravity: "top",
            position: "center",
            backgroundColor: type === "success" ? "#10b981" : "#ef4444",
        }).showToast();
    }

    const toastSuccess = (message, debug) => {
        showToast(message, 'success');
        if (debug) console.log(debug);
    };

    const toastError = (message, debug) => {
        showToast(message, 'error');
        console.error(debug);
    };

    let currentMenu = null;
    let currentPopup = null;
    let activeTableInstance = null;
    let menuOutsideClickHandler = null;
    let popupCleanupFns = [];

    function clearPopupCleanupFns() {
        while (popupCleanupFns.length) {
            const cleanup = popupCleanupFns.pop();
            if (typeof cleanup === 'function') cleanup();
        }
    }

    function closeMenu() {
        if (menuOutsideClickHandler) {
            document.removeEventListener('mousedown', menuOutsideClickHandler);
            menuOutsideClickHandler = null;
        }
        if (currentMenu) {
            currentMenu.remove();
            currentMenu = null;
        }
    }

    function closePopup() {
        clearPopupCleanupFns();
        if (activeTableInstance) {
            try { activeTableInstance.destroy(); } catch (e) {}
            activeTableInstance = null;
        }
        if (currentPopup) {
            currentPopup.remove();
            currentPopup = null;
        }
        document.querySelectorAll('#scenes-popup').forEach(el => {
            if (!currentPopup || el !== currentPopup) {
                el.remove();
            }
        });
    }

    let cacheStore = {
        tags: { data: null, timestamp: 0 },
        performers: { data: null, timestamp: 0 },
        galleries: { data: null, timestamp: 0 }
    };
    const CACHE_TTL = 5 * 60 * 1000;

    function getCachedOrNull(type) {
        const item = cacheStore[type];
        if (item.data && (Date.now() - item.timestamp < CACHE_TTL)) {
            return item.data;
        }
        return null;
    }

    function setCache(type, data) {
        cacheStore[type] = { data, timestamp: Date.now() };
    }

    function invalidateCache() {
        cacheStore = {
            tags: { data: null, timestamp: 0 },
            performers: { data: null, timestamp: 0 },
            galleries: { data: null, timestamp: 0 }
        };
    }

    const recentStorageKeys = {
        tags: 'stash_fast_tag_recent_tags',
        performers: 'stash_fast_tag_recent_performers',
        galleries: 'stash_fast_tag_recent_galleries'
    };

    function readRecentEntries(type) {
        try {
            const raw = localStorage.getItem(recentStorageKeys[type]);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writeRecentEntries(type, value) {
        try {
            localStorage.setItem(recentStorageKeys[type], JSON.stringify((Array.isArray(value) ? value : []).slice(0, 8)));
        } catch (e) {}
    }

    function addRecentEntry(type, item) {
        if (!item || !item.name) return;
        const list = readRecentEntries(type).filter(entry => entry && entry.name && entry.name !== item.name);
        list.unshift({ id: item.id, name: item.name });
        writeRecentEntries(type, list);
    }

    function addRecentEntriesFromSelection(type, selectedItems) {
        if (!Array.isArray(selectedItems)) return;
        selectedItems.filter(Boolean).forEach(item => addRecentEntry(type, item));
    }

    function getSmartSortComparator(type, term, selectedIds) {
        return (a, b) => {
            const aSel = selectedIds.has(String(a.id));
            const bSel = selectedIds.has(String(b.id));
            if (aSel && !bSel) return -1;
            if (!aSel && bSel) return 1;

            const aName = String(a.name || a.title || '').trim().toLowerCase();
            const bName = String(b.name || b.title || '').trim().toLowerCase();
            if (!term) {
                return aName.localeCompare(bName);
            }

            const aExact = aName === term ? 1 : 0;
            const bExact = bName === term ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;

            const aStarts = aName.startsWith(term) ? 1 : 0;
            const bStarts = bName.startsWith(term) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;

            const aIncludes = aName.includes(term) ? 1 : 0;
            const bIncludes = bName.includes(term) ? 1 : 0;
            if (aIncludes !== bIncludes) return bIncludes - aIncludes;

            return aName.localeCompare(bName);
        };
    }

    function trySelectRecentChip(type, item, selectedIds, input, onSelected) {
        const table = activeTableInstance;
        const itemName = String(item && item.name ? item.name : '').trim().toLowerCase();

        if (!table) {
            if (input) {
                input.value = itemName;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus();
            }
            return false;
        }

        const data = Array.isArray(table.getData()) ? table.getData() : [];
        const normalized = (value) => String(value || '').trim().toLowerCase();

        let match = data.find(row => normalized(row.name || row.title) === itemName);
        if (!match) {
            match = data.find(row => normalized(row.name || row.title).includes(itemName));
        }

        if (match && match.id != null) {
            const rowId = String(match.id);
            selectedIds.add(rowId);
            try {
                table.deselectRow();
                table.selectRow(rowId);
                const row = table.getRow(rowId);
                if (row) {
                    table.scrollToRow(row, 'top', false);
                }
            } catch (e) {}

            if (typeof onSelected === 'function') {
                onSelected();
            }

            if (input) {
                input.value = '';
                input.focus();
            }
            return true;
        }

        if (input) {
            input.value = item && item.name ? item.name : '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus();
        }
        return false;
    }

    function renderQuickActions(form, type, input, selectedIds, sourceItems, labelField, onRecentChipSelect) {
        const target = form.querySelector(`#${type}-quick-actions`);
        if (!target) return;

        const recent = readRecentEntries(type)
            .slice(0, 6)
            .filter(item => item && item.name)
            .map(item => ({ id: item.id, name: item.name }));

        if (!recent.length) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        target.innerHTML = '';
        target.style.display = 'flex';
        target.style.flexWrap = 'wrap';
        target.style.gap = '6px';
        target.style.marginBottom = '10px';

        recent.forEach(item => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.textContent = item.name;
            chip.style.cssText = 'padding: 5px 8px; border: 1px solid #dfe3ea; border-radius: 999px; background: #f8fafc; color: #243447; font-size: 11px; cursor: pointer;';
            chip.addEventListener('click', () => {
                trySelectRecentChip(type, item, selectedIds, input, onRecentChipSelect);
            });
            target.appendChild(chip);
        });
    }

    function createCustomMenu(clickEvent, sceneId, cardElement) {
        const menu = document.createElement('div');
        menu.id = 'scenes-custom-menu';
        menu.style.position = 'absolute';
        menu.style.zIndex = '999999';

        const editTagsLink = document.createElement('a');
        editTagsLink.href = '#';
        editTagsLink.textContent = 'Edit Tags...';
        editTagsLink.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            createTagsPopup(sceneId, cardElement);
        });
        menu.appendChild(editTagsLink);

        const editPerformersLink = document.createElement('a');
        editPerformersLink.href = '#';
        editPerformersLink.textContent = 'Edit Performers...';
        editPerformersLink.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            createPerformersPopup(sceneId, cardElement);
        });
        menu.appendChild(editPerformersLink);

        const editGalleriesLink = document.createElement('a');
        editGalleriesLink.href = '#';
        editGalleriesLink.textContent = 'Edit Galleries...';
        editGalleriesLink.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            createGalleriesPopup(sceneId, cardElement);
        });
        menu.appendChild(editGalleriesLink);

        const editSceneLink = document.createElement('a');
        editSceneLink.href = '#';
        editSceneLink.textContent = 'Edit Scene';
        editSceneLink.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            openEditScenePage(sceneId);
        });
        menu.appendChild(editSceneLink);

        const hr = document.createElement('div');
        hr.style.height = '1px';
        hr.style.background = '#e2e8f0';
        hr.style.margin = '4px 0';
        menu.appendChild(hr);

        const supportLink = document.createElement('a');
        supportLink.href = 'https://www.patreon.com/serechops/membership';
        supportLink.textContent = 'Support';
        supportLink.style.color = '#d97706';
        supportLink.target = '_blank';
        supportLink.addEventListener('click', () => { closeMenu(); });
        menu.appendChild(supportLink);

        document.body.appendChild(menu);
        currentMenu = menu;
        return menu;
    }

    function showCustomMenu(event, sceneId, cardElement) {
        closeMenu();
        closePopup();

        const menu = createCustomMenu(event, sceneId, cardElement);
        event.preventDefault();

        const absX = event.clientX + window.scrollX;
        const absY = event.clientY + window.scrollY;

        menu.style.visibility = 'hidden';
        menu.style.top = `${absY}px`;
        menu.style.left = `${absX}px`;

        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            let posX = absX;
            let posY = absY;

            if (event.clientX + rect.width > window.innerWidth) {
                posX = (window.innerWidth + window.scrollX) - rect.width - 10;
            }
            if (event.clientY + rect.height > window.innerHeight) {
                posY = (window.innerHeight + window.scrollY) - rect.height - 10;
            }

            menu.style.top = `${posY}px`;
            menu.style.left = `${posX}px`;
            menu.style.visibility = 'visible';
        });

        const handleOutsideClick = (e) => {
            if (!menu.contains(e.target)) {
                closeMenu();
            }
        };
        menuOutsideClickHandler = handleOutsideClick;
        document.addEventListener('mousedown', handleOutsideClick);
    }

    function extractSceneId(cardElement) {
        const link = cardElement.querySelector('a[href*="/scenes/"]');
        if (link) {
            const match = link.href.match(/scenes\/([a-zA-Z0-9-]+)/);
            if (match) return match[1];
        }
        return null;
    }

    // ==========================================
    // 1. TAGS POPUP LOGIC
    // ==========================================
    async function createTagsPopup(sceneId, cardElement) {
        if (typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load.");
            return;
        }
        closePopup();

        const form = document.createElement('form');
        form.id = 'scenes-popup';
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'absolute';
        form.style.zIndex = '1000000';
        form.style.visibility = 'hidden';
        form.style.padding = '14px';
        form.style.background = '#ffffff';
        form.style.border = '1px solid #e2e8f0';
        form.style.borderRadius = '10px';
        form.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
        form.style.width = '340px';
        form.style.boxSizing = 'border-box';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        form.innerHTML = `
            <h2 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; cursor: move; user-select: none; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span>Edit Tags for Scene</span>
                <span style="font-size: 11px; color: #64748b; font-weight: normal;">Draggable</span>
            </h2>
            <div style="display: flex; gap: 6px; margin-bottom: 10px; align-items: center;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="tags-search-input" autocomplete="off" spellcheck="false" placeholder="Search Tags..." style="width: 100%; padding: 7px 28px 7px 10px; box-sizing: border-box; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; font-size: 12px; outline: none;">
                    <span id="tags-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #94a3b8; font-size: 16px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="tags-create-btn" style="padding: 7px 8px; cursor: pointer; font-size: 12px; font-weight: 500; background: #10b981; color: white; border: none; border-radius: 6px; white-space: nowrap; display: none;">Create</button>
                <button type="button" id="tags-refresh-btn" style="padding: 7px 8px; cursor: pointer; font-size: 12px; font-weight: 500; background: #64748b; color: white; border: none; border-radius: 6px; white-space: nowrap;">Refresh</button>
            </div>
            <div id="tags-quick-actions" style="display: none; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;"></div>
            <div id="tags-tabulator-table" style="margin-bottom: 10px; width: 100%; box-sizing: border-box;"></div>
            <div style="display: flex; gap: 8px;">
                <button type="button" id="tags-save-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 12px; font-weight: 500; background: #6366f1; color: white; border: none; border-radius: 6px;">Save Tags</button>
                <button type="button" id="tags-cancel-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 12px; font-weight: 500; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px;">Close</button>
            </div>
        `;
        document.body.appendChild(form);
        currentPopup = form;

        const table = new Tabulator("#tags-tabulator-table", {
            layout: "fitColumns",
            height: "200px",
            placeholder: "No Tags Found",
            selectable: true,
            index: "id",
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center" },
                { title: "Name", field: "name", widthGrow: 2 },
            ],
        });
        activeTableInstance = table;

        setupPopupDragAndClose(form, async () => {
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndReloadTags(sceneId, selectedIds);
        });

        const existingIds = await fetchExistingTagIds(sceneId);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        let isRestoringSelections = false;

        const filterInput = form.querySelector('#tags-search-input');
        const clearBtn = form.querySelector('#tags-search-clear');
        const createBtn = form.querySelector('#tags-create-btn');
        const refreshBtn = form.querySelector('#tags-refresh-btn');

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
        };

        table.on("rowSelected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.add(String(id));
                
                const hasSearch = filterInput.value.trim().length > 0;
                if (hasSearch) {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData("", false).then(() => {
                        const r = table.getRow(id);
                        if (r) table.scrollToRow(r, "top", false);
                        filterInput.focus();
                    });
                }
            }
        });

        table.on("rowDeselected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                fetchData(filterInput.value.trim(), false);
            }
        });

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull('tags');
            if (!cachedData) {
                cachedData = await fetchTags();
                setCache('tags', cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = cachedData;
            if (term) {
                const tokens = term.split(/\s+/);
                data = cachedData.filter(item => tokens.every(t => (item.name || '').toLowerCase().includes(t)));
            }

            data.sort(getSmartSortComparator('tags', term, selectedIds));

            isRestoringSelections = true;
            try {
                await table.setData(data);
                selectedIds.forEach(id => {
                    const r = table.getRow(id);
                    if (r) table.selectRow(r);
                });
                renderQuickActions(form, 'tags', filterInput, selectedIds, data, 'name', () => {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData('', false);
                    saveTagsWithoutReload(sceneId, selectedIds);
                });
                if (resetScroll && data.length > 0) table.scrollToRow(table.getRows()[0], "top", false);
            } finally {
                isRestoringSelections = false;
            }
        }

        let debounceTimer = null;
        filterInput.addEventListener('input', (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData(e.target.value, true);
            }, 150);
        });

        clearBtn.addEventListener('click', () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus();
        });

        refreshBtn.addEventListener('click', async () => {
            invalidateCache();
            await fetchData(filterInput.value.trim(), false);
        });

        createBtn.addEventListener('click', async () => {
            const val = filterInput.value.trim();
            if (!val) return;
            const newId = await createNewTag(val);
            if (newId) {
                invalidateCache();
                selectedIds.add(String(newId));
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                filterInput.focus();
            }
        });

        await fetchData("", true);

        form.querySelector('#tags-save-btn').addEventListener('click', async () => {
            const selectedItems = Array.from(selectedIds).map(id => {
                const item = getCachedOrNull('tags') || [];
                return item.find(entry => String(entry.id) === String(id));
            }).filter(Boolean);
            addRecentEntriesFromSelection('tags', selectedItems);
            renderQuickActions(form, 'tags', filterInput, selectedIds, selectedItems, 'name', () => {
                filterInput.value = '';
                updateVisibility();
                fetchData('', false);
                saveTagsWithoutReload(sceneId, selectedIds);
            });
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndReloadTags(sceneId, selectedIds);
        });

        form.querySelector('#tags-cancel-btn').addEventListener('click', () => { closePopup(); });
        positionPopupNearCard(form, cardElement);
    }

    async function saveTagsWithoutReload(sceneId, selectedIds) {
        saveScrollPosition();
        const success = await updateSceneWithTags(sceneId, Array.from(selectedIds));
        if (success) {
            toastSuccess('Tag saved');
        }
        return success;
    }

    async function saveAndReloadTags(sceneId, selectedIds) {
        saveScrollPosition();
        const success = await updateSceneWithTags(sceneId, Array.from(selectedIds));
        if (success) {
            closePopup();
            toastSuccess(`Scene updated! Reloading...`);
            setTimeout(() => { window.location.reload(); }, 0);
        }
    }

    // ==========================================
    // 2. PERFORMERS POPUP LOGIC
    // ==========================================
    async function createPerformersPopup(sceneId, cardElement) {
        if (typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load.");
            return;
        }
        closePopup();

        const form = document.createElement('form');
        form.id = 'scenes-popup';
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'absolute';
        form.style.zIndex = '1000000';
        form.style.visibility = 'hidden';
        form.style.padding = '14px';
        form.style.background = '#ffffff';
        form.style.border = '1px solid #e2e8f0';
        form.style.borderRadius = '10px';
        form.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
        form.style.width = '340px';
        form.style.boxSizing = 'border-box';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        form.innerHTML = `
            <h2 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; cursor: move; user-select: none; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span>Edit Performers for Scene</span>
                <span style="font-size: 11px; color: #64748b; font-weight: normal;">Draggable</span>
            </h2>
            <div style="display: flex; gap: 6px; margin-bottom: 10px; align-items: center;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="performers-search-input" autocomplete="off" spellcheck="false" placeholder="Search Performers..." style="width: 100%; padding: 7px 28px 7px 10px; box-sizing: border-box; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; font-size: 12px; outline: none;">
                    <span id="performers-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #94a3b8; font-size: 16px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="performers-create-btn" style="padding: 7px 8px; cursor: pointer; font-size: 12px; font-weight: 500; background: #10b981; color: white; border: none; border-radius: 6px; white-space: nowrap; display: none;">Create</button>
                <button type="button" id="performers-refresh-btn" style="padding: 7px 8px; cursor: pointer; font-size: 12px; font-weight: 500; background: #64748b; color: white; border: none; border-radius: 6px; white-space: nowrap;">Refresh</button>
            </div>
            <div id="performers-quick-actions" style="display: none; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;"></div>
            <div id="performers-tabulator-table" style="margin-bottom: 10px; width: 100%; box-sizing: border-box;"></div>
            <div style="display: flex; gap: 8px;">
                <button type="button" id="performers-save-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 12px; font-weight: 500; background: #6366f1; color: white; border: none; border-radius: 6px;">Save Performers</button>
                <button type="button" id="performers-cancel-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 12px; font-weight: 500; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px;">Close</button>
            </div>
        `;
        document.body.appendChild(form);
        currentPopup = form;

        const table = new Tabulator("#performers-tabulator-table", {
            layout: "fitColumns",
            height: "380px",
            placeholder: "No Performers Found",
            selectable: true,
            index: "id",
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true },
                { title: "Name", field: "name", widthGrow: 2, resizable: true },
                { title: "Disambiguation", field: "disambiguation", widthGrow: 1, resizable: true },
            ],
            persistence: {
                columns: true, // Remembers column widths and layout changes
            },
            persistenceMode: "local", // Saves to browser localStorage
        });
        activeTableInstance = table;

        setupPopupDragAndClose(form, async () => {
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndReloadPerformers(sceneId, selectedIds);
        });

        const existingIds = await fetchExistingPerformerIds(sceneId);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        let isRestoringSelections = false;

        const filterInput = form.querySelector('#performers-search-input');
        const clearBtn = form.querySelector('#performers-search-clear');
        const createBtn = form.querySelector('#performers-create-btn');
        const refreshBtn = form.querySelector('#performers-refresh-btn');

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
        };

        table.on("rowSelected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.add(String(id));
                
                const hasSearch = filterInput.value.trim().length > 0;
                if (hasSearch) {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData("", false).then(() => {
                        const r = table.getRow(id);
                        if (r) table.scrollToRow(r, "top", false);
                        filterInput.focus();
                    });
                }
            }
        });

        table.on("rowDeselected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                fetchData(filterInput.value.trim(), false);
            }
        });

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull('performers');
            if (!cachedData) {
                cachedData = await fetchPerformers();
                setCache('performers', cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = cachedData;
            if (term) {
                const tokens = term.split(/\s+/);
                data = cachedData.filter(item => tokens.every(t => (item.name || '').toLowerCase().includes(t)));
            }

            data.sort(getSmartSortComparator('performers', term, selectedIds));

            isRestoringSelections = true;
            try {
                await table.setData(data);
                selectedIds.forEach(id => {
                    const r = table.getRow(id);
                    if (r) table.selectRow(r);
                });
                renderQuickActions(form, 'performers', filterInput, selectedIds, data, 'name', () => {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData('', false);
                    savePerformersWithoutReload(sceneId, selectedIds);
                });
                if (resetScroll && data.length > 0) table.scrollToRow(table.getRows()[0], "top", false);
            } finally {
                isRestoringSelections = false;
            }
        }

        let debounceTimer = null;
        filterInput.addEventListener('input', (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData(e.target.value, true);
            }, 150);
        });

        clearBtn.addEventListener('click', () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus();
        });

        refreshBtn.addEventListener('click', async () => {
            invalidateCache();
            await fetchData(filterInput.value.trim(), false);
        });

        createBtn.addEventListener('click', async () => {
            const val = filterInput.value.trim();
            if (!val) return;
            const newId = await createNewPerformer(val);
            if (newId) {
                invalidateCache();
                selectedIds.add(String(newId));
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                filterInput.focus();
            }
        });

        await fetchData("", true);

        form.querySelector('#performers-save-btn').addEventListener('click', async () => {
            const selectedItems = Array.from(selectedIds).map(id => {
                const item = getCachedOrNull('performers') || [];
                return item.find(entry => String(entry.id) === String(id));
            }).filter(Boolean);
            addRecentEntriesFromSelection('performers', selectedItems);
            renderQuickActions(form, 'performers', filterInput, selectedIds, selectedItems, 'name', () => {
                filterInput.value = '';
                updateVisibility();
                fetchData('', false);
                savePerformersWithoutReload(sceneId, selectedIds);
            });
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndReloadPerformers(sceneId, selectedIds);
        });

        form.querySelector('#performers-cancel-btn').addEventListener('click', () => { closePopup(); });
        positionPopupNearCard(form, cardElement);
    }

    async function savePerformersWithoutReload(sceneId, selectedIds) {
        saveScrollPosition();
        const success = await updateSceneWithPerformers(sceneId, Array.from(selectedIds));
        if (success) {
            toastSuccess('Performer saved');
        }
        return success;
    }

    async function saveAndReloadPerformers(sceneId, selectedIds) {
        saveScrollPosition();
        const success = await updateSceneWithPerformers(sceneId, Array.from(selectedIds));
        if (success) {
            closePopup();
            toastSuccess(`Scene updated! Reloading...`);
            setTimeout(() => { window.location.reload(); }, 0);
        }
    }

    // ==========================================
    // 3. GALLERIES POPUP LOGIC
    // ==========================================
    async function createGalleriesPopup(sceneId, cardElement) {
        if (typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load.");
            return;
        }
        closePopup();

        const form = document.createElement('form');
        form.id = 'scenes-popup';
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'absolute';
        form.style.zIndex = '1000000';
        form.style.visibility = 'hidden';
        form.style.padding = '14px';
        form.style.background = '#ffffff';
        form.style.border = '1px solid #e2e8f0';
        form.style.borderRadius = '10px';
        form.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
        form.style.width = '340px';
        form.style.boxSizing = 'border-box';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        form.innerHTML = `
            <h2 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; cursor: move; user-select: none; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span>Edit Galleries for Scene</span>
                <span style="font-size: 11px; color: #64748b; font-weight: normal;">Draggable</span>
            </h2>
            <div style="display: flex; gap: 6px; margin-bottom: 10px; align-items: center;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="galleries-search-input" autocomplete="off" spellcheck="false" placeholder="Search Galleries..." style="width: 100%; padding: 7px 28px 7px 10px; box-sizing: border-box; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; font-size: 12px; outline: none;">
                    <span id="galleries-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #94a3b8; font-size: 16px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="galleries-create-btn" style="padding: 7px 8px; cursor: pointer; font-size: 12px; font-weight: 500; background: #10b981; color: white; border: none; border-radius: 6px; white-space: nowrap; display: none;">Create</button>
                <button type="button" id="galleries-refresh-btn" style="padding: 7px 8px; cursor: pointer; font-size: 12px; font-weight: 500; background: #64748b; color: white; border: none; border-radius: 6px; white-space: nowrap;">Refresh</button>
            </div>
            <div id="galleries-quick-actions" style="display: none; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;"></div>
            <div id="galleries-tabulator-table" style="margin-bottom: 10px; width: 100%; box-sizing: border-box;"></div>
            <div style="display: flex; gap: 8px;">
                <button type="button" id="galleries-save-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 12px; font-weight: 500; background: #6366f1; color: white; border: none; border-radius: 6px;">Save Galleries</button>
                <button type="button" id="galleries-cancel-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 12px; font-weight: 500; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px;">Close</button>
            </div>
        `;
        document.body.appendChild(form);
        currentPopup = form;

        const table = new Tabulator("#galleries-tabulator-table", {
            layout: "fitColumns",
            height: "280px",
            placeholder: "No Galleries Found",
            selectable: true,
            index: "id",
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center" },
                { title: "Title", field: "title", widthGrow: 2 },
            ],
        });
        activeTableInstance = table;

        setupPopupDragAndClose(form, async () => {
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndReloadGalleries(sceneId, selectedIds);
        });

        const existingIds = await fetchExistingGalleryIds(sceneId);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        let isRestoringSelections = false;

        const filterInput = form.querySelector('#galleries-search-input');
        const clearBtn = form.querySelector('#galleries-search-clear');
        const createBtn = form.querySelector('#galleries-create-btn');
        const refreshBtn = form.querySelector('#galleries-refresh-btn');

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
        };

        table.on("rowSelected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.add(String(id));
                
                const hasSearch = filterInput.value.trim().length > 0;
                if (hasSearch) {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData("", false).then(() => {
                        const r = table.getRow(id);
                        if (r) table.scrollToRow(r, "top", false);
                        filterInput.focus();
                    });
                }
            }
        });

        table.on("rowDeselected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                fetchData(filterInput.value.trim(), false);
            }
        });

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull('galleries');
            if (!cachedData) {
                cachedData = await fetchGalleries();
                setCache('galleries', cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = cachedData;
            if (term) {
                const tokens = term.split(/\s+/);
                data = cachedData.filter(item => tokens.every(t => (item.title || '').toLowerCase().includes(t)));
            }

            data.sort(getSmartSortComparator('galleries', term, selectedIds));

            isRestoringSelections = true;
            try {
                await table.setData(data);
                selectedIds.forEach(id => {
                    const r = table.getRow(id);
                    if (r) table.selectRow(r);
                });
                renderQuickActions(form, 'galleries', filterInput, selectedIds, data, 'title', () => {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData('', false);
                    saveGalleriesWithoutReload(sceneId, selectedIds);
                });
                if (resetScroll && data.length > 0) table.scrollToRow(table.getRows()[0], "top", false);
            } finally {
                isRestoringSelections = false;
            }
        }

        let debounceTimer = null;
        filterInput.addEventListener('input', (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData(e.target.value, true);
            }, 150);
        });

        clearBtn.addEventListener('click', () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus();
        });

        refreshBtn.addEventListener('click', async () => {
            invalidateCache();
            await fetchData(filterInput.value.trim(), false);
        });

        createBtn.addEventListener('click', async () => {
            const val = filterInput.value.trim();
            if (!val) return;
            const newId = await createNewGallery(val);
            if (newId) {
                invalidateCache();
                selectedIds.add(String(newId));
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                filterInput.focus();
            }
        });

        await fetchData("", true);

        form.querySelector('#galleries-save-btn').addEventListener('click', async () => {
            const selectedItems = Array.from(selectedIds).map(id => {
                const item = getCachedOrNull('galleries') || [];
                return item.find(entry => String(entry.id) === String(id));
            }).filter(Boolean);
            addRecentEntriesFromSelection('galleries', selectedItems);
            renderQuickActions(form, 'galleries', filterInput, selectedIds, selectedItems, 'title', () => {
                filterInput.value = '';
                updateVisibility();
                fetchData('', false);
                saveGalleriesWithoutReload(sceneId, selectedIds);
            });
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndReloadGalleries(sceneId, selectedIds);
        });

        form.querySelector('#galleries-cancel-btn').addEventListener('click', () => { closePopup(); });
        positionPopupNearCard(form, cardElement);
    }

    async function saveGalleriesWithoutReload(sceneId, selectedIds) {
        saveScrollPosition();
        const success = await updateSceneWithGalleries(sceneId, Array.from(selectedIds));
        if (success) {
            toastSuccess('Gallery saved');
        }
        return success;
    }

    async function saveAndReloadGalleries(sceneId, selectedIds) {
        saveScrollPosition();
        const success = await updateSceneWithGalleries(sceneId, Array.from(selectedIds));
        if (success) {
            closePopup();
            toastSuccess(`Scene updated! Reloading...`);
            setTimeout(() => { window.location.reload(); }, 400);
        }
    }

    // ==========================================
    // SHARED HELPER FUNCTIONS
    // ==========================================
    function setupPopupDragAndClose(form, onSaveCallback) {
        const handleOutsideClick = (e) => {
            if (!form.contains(e.target)) {
                closePopup();
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closePopup();
            } else if (e.key === 'Enter') {
                const isSearchFocused = document.activeElement && document.activeElement.tagName === 'INPUT';

                // Prevent Enter from doing anything when typing in the search box
                if (isSearchFocused) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                // Otherwise, allow saving/submitting via Enter or Ctrl/Cmd + Enter elsewhere
                if (!isSearchFocused || e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (onSaveCallback) onSaveCallback();
                }
            }
        };

        popupCleanupFns.push(() => document.removeEventListener('mousedown', handleOutsideClick));
        popupCleanupFns.push(() => document.removeEventListener('keydown', handleKeyDown));
        popupCleanupFns.push(() => {
            document.onmousemove = null;
            document.onmouseup = null;
        });

        setTimeout(() => { document.addEventListener('mousedown', handleOutsideClick); }, 0);
        document.addEventListener('keydown', handleKeyDown);

        let isDragging = false;
        let dragOffsetX, dragOffsetY;
        const header = form.querySelector('h2');
        header.onmousedown = function(e) {
            isDragging = true;
            dragOffsetX = e.clientX - form.offsetLeft;
            dragOffsetY = e.clientY - form.offsetTop;
            document.onmousemove = function(e) {
                if (isDragging) {
                    form.style.left = `${e.clientX - dragOffsetX}px`;
                    form.style.top = `${e.clientY - dragOffsetY}px`;
                }
            };
            document.onmouseup = function() {
                isDragging = false;
                document.onmousemove = null;
                document.onmouseup = null;
            };
        };
    }

    function positionPopupNearCard(form, cardElement) {
        const cardRect = cardElement.getBoundingClientRect();
        let popupX = cardRect.right + window.scrollX + 10;
        let popupY = cardRect.top + window.scrollY;

        form.style.left = `${popupX}px`;
        form.style.top = `${popupY}px`;

        requestAnimationFrame(() => {
            const formRect = form.getBoundingClientRect();
            if (cardRect.right + 10 + formRect.width > window.innerWidth) {
                popupX = cardRect.left + window.scrollX - formRect.width - 10;
            }
            if (cardRect.top + formRect.height > window.innerHeight) {
                popupY = (window.innerHeight + window.scrollY) - formRect.height - 10;
            }
            form.style.left = `${popupX}px`;
            form.style.top = `${popupY}px`;
            form.style.visibility = 'visible';

            const firstInput = form.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus();
        });
    }

    async function fetchTags() {
        const gqlQuery = `query { findTags(filter: { per_page: -1 }) { tags { id name } } }`;
        const res = await fetchGQL(gqlQuery);
        return res.data?.findTags?.tags || [];
    }

    async function fetchPerformers() {
        const gqlQuery = `query { findPerformers(filter: { per_page: -1 }) { performers { id name disambiguation } } }`;
        const res = await fetchGQL(gqlQuery);
        return res.data?.findPerformers?.performers || [];
    }

    async function fetchGalleries() {
        const gqlQuery = `query { findGalleries(filter: { per_page: -1 }) { galleries { id title } } }`;
        const res = await fetchGQL(gqlQuery);
        return res.data?.findGalleries?.galleries || [];
    }

    async function createNewTag(name) {
        const mutation = `mutation ($name: String!) { tagCreate(input: { name: $name }) { id name } }`;
        const res = await fetchGQL(mutation, { name });
        if (res.errors) { toastError('Failed to create tag', res.errors); return null; }
        toastSuccess('Tag created successfully', res.data.tagCreate);
        return res.data.tagCreate.id;
    }

    async function createNewPerformer(name) {
        const mutation = `mutation ($name: String!) { performerCreate(input: { name: $name }) { id name } }`;
        const res = await fetchGQL(mutation, { name });
        if (res.errors) { toastError('Failed to create performer', res.errors); return null; }
        toastSuccess('Performer created successfully', res.data.performerCreate);
        return res.data.performerCreate.id;
    }

    async function createNewGallery(title) {
        const mutation = `mutation ($title: String!) { galleryCreate(input: { title: $title }) { id title } }`;
        const res = await fetchGQL(mutation, { title });
        if (res.errors) { toastError('Failed to create gallery', res.errors); return null; }
        toastSuccess('Gallery created successfully', res.data.galleryCreate);
        return res.data.galleryCreate.id;
    }

    async function updateSceneWithTags(sceneId, tagIds) {
        const mutationQuery = `mutation ($scene_id: ID!, $tag_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, tag_ids: $tag_ids }) { id } }`;
        const res = await fetchGQL(mutationQuery, { scene_id: sceneId, tag_ids: tagIds });
        if (res.errors) { toastError('Failed to update the scene with tags', res.errors); return false; }
        return true;
    }

    async function updateSceneWithPerformers(sceneId, performerIds) {
        const gqlQuery = `mutation ($scene_id: ID!, $performer_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, performer_ids: $performer_ids }) { id } }`;
        const res = await fetchGQL(gqlQuery, { scene_id: sceneId, performer_ids: performerIds });
        if (res.errors) { toastError('Failed to update the scene with performers', res.errors); return false; }
        return true;
    }

    async function updateSceneWithGalleries(sceneId, galleryIds) {
        const gqlQuery = `mutation ($scene_id: ID!, $gallery_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, gallery_ids: $gallery_ids }) { id } }`;
        const res = await fetchGQL(gqlQuery, { scene_id: sceneId, gallery_ids: galleryIds });
        if (res.errors) { toastError('Failed to update the scene with galleries', res.errors); return false; }
        return true;
    }

    async function fetchExistingTagIds(sceneId) {
        const query = `query ($id: ID!) { findScene(id: $id) { tags { id } } }`;
        const res = await fetchGQL(query, { id: sceneId });
        return res.data?.findScene?.tags?.map(tag => tag.id) || [];
    }

    async function fetchExistingPerformerIds(sceneId) {
        const query = `query ($id: ID!) { findScene(id: $id) { performers { id } } }`;
        const res = await fetchGQL(query, { id: sceneId });
        return res.data?.findScene?.performers?.map(performer => performer.id) || [];
    }

    async function fetchExistingGalleryIds(sceneId) {
        const query = `query ($id: ID!) { findScene(id: $id) { galleries { id } } }`;
        const res = await fetchGQL(query, { id: sceneId });
        return res.data?.findScene?.galleries?.map(gallery => gallery.id) || [];
    }

    function openEditScenePage(sceneId) {
        const editPageUrl = `/scenes/${sceneId}/edit`;
        const newWindow = window.open(editPageUrl, '_blank');
        if (newWindow) {
            newWindow.onload = () => {
                setTimeout(() => {
                    const editTab = newWindow.document.querySelector('[data-rb-event-key="scene-edit-panel"]');
                    if (editTab) editTab.click();
                }, 1000);
            };
        }
    }

    document.addEventListener('contextmenu', async function(event) {
        if (currentPopup || currentMenu) return;

        const sceneCard = event.target.closest('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
        if (!sceneCard) return;

        const sceneId = extractSceneId(sceneCard);
        if (sceneId) {
            showCustomMenu(event, sceneId, sceneCard);
        }
    }, true);

    document.addEventListener('click', function(event) {
        if (currentPopup) return;

        const sceneCard = event.target.closest('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
        if (!sceneCard) return;

        if (event.target.closest('a[href*="/scenes/"]:not([class*="tag"]):not([class*="performer"]):not([class*="gallery"])')) {
            return;
        }

        const targetLink = event.target.closest('a');
        const href = targetLink ? targetLink.getAttribute('href') || '' : '';
        const badgeElement = event.target.closest('.tag, .performer-tag, .gallery-tag, .chip, [class*="badge"], [class*="tag"], [class*="chip"], [class*="performer"], [class*="gallery"]');

        if (!badgeElement && !href.includes('/tags/') && !href.includes('/performers/') && !href.includes('/galleries/')) {
            return;
        }

        const sceneId = extractSceneId(sceneCard);
        if (!sceneId) return;

        const svg = (badgeElement || targetLink)?.querySelector('svg') || event.target.closest('svg');
        const iconClass = svg ? svg.getAttribute('class') || '' : '';
        const combinedContext = (badgeElement ? badgeElement.outerHTML : '') + ' ' + href + ' ' + iconClass;

        event.preventDefault();
        event.stopImmediatePropagation();
        closeMenu();

        if (combinedContext.includes('/performers/') || iconClass.includes('fa-user') || combinedContext.includes('performer')) {
            createPerformersPopup(sceneId, sceneCard);
        } else if (combinedContext.includes('/galleries/') || iconClass.includes('fa-images') || combinedContext.includes('gallery')) {
            createGalleriesPopup(sceneId, sceneCard);
        } else {
            createTagsPopup(sceneId, sceneCard);
        }
    }, true);

})();
