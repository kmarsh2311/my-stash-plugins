// ==UserScript==
// @name         Stash FastTag (Test Lab)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Fast scene tagging workflow for Stash: edit tags, performers, and galleries from scene cards with quick search, popups, and sequential navigation
// @match        http://localhost:*/*
// @match        http://127.0.0.1:*/*
// @grant        none
// @run-at       document-end
// @require      https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js
// @require      https://cdn.jsdelivr.net/npm/toastify-js
// @updateURL    https://raw.githubusercontent.com/kmarsh2311/my-stash-plugins/main/fasttag.js
// @downloadURL  https://raw.githubusercontent.com/kmarsh2311/my-stash-plugins/main/fasttag.js
// ==/UserScript==

(async function() {
    'use strict';
    console.log('[FastTag Test Lab] Initialized with Studios, Suggestions, Pinned Chips, Bulk Mode, and Hotkeys');

    // --- Entity Configuration & Schema Registry ---
    const ENTITY_CONFIG = {
        tags: {
            title: 'Tag',
            pluralTitle: 'Tags',
            labelKey: 'name',
            searchFields: ['name', 'id'],
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true, headerSort: false },
                { title: "Name", field: "name", widthGrow: 2, resizable: true, headerSort: false },
            ],
            fetchQuery: `query { findTags(filter: { per_page: -1 }) { tags { id name } } }`,
            extractList: data => data?.findTags?.tags || [],
            fetchExistingQuery: `query ($id: ID!) { findScene(id: $id) { tags { id } } }`,
            extractExisting: data => data?.findScene?.tags?.map(t => t.id) || [],
            createQuery: `mutation ($name: String!) { tagCreate(input: { name: $name }) { id name } }`,
            createExtract: data => data?.tagCreate?.id,
            createVariables: val => ({ name: val }),
            updateQuery: `mutation ($scene_id: ID!, $tag_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, tag_ids: $tag_ids }) { id } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), tag_ids: ids.map(String) })
        },
        performers: {
            title: 'Performer',
            pluralTitle: 'Performers',
            labelKey: 'name',
            searchFields: ['name', 'disambiguation', 'id'],
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true, headerSort: false },
                { title: "Name", field: "name", widthGrow: 2, resizable: true, headerSort: false },
                { title: "Disambiguation", field: "disambiguation", widthGrow: 1, resizable: true, headerSort: false },
            ],
            fetchQuery: `query { findPerformers(filter: { per_page: -1 }) { performers { id name disambiguation } } }`,
            extractList: data => data?.findPerformers?.performers || [],
            fetchExistingQuery: `query ($id: ID!) { findScene(id: $id) { performers { id } } }`,
            extractExisting: data => data?.findScene?.performers?.map(p => p.id) || [],
            createQuery: `mutation ($name: String!) { performerCreate(input: { name: $name }) { id name } }`,
            createExtract: data => data?.performerCreate?.id,
            createVariables: val => ({ name: val }),
            updateQuery: `mutation ($scene_id: ID!, $performer_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, performer_ids: $performer_ids }) { id } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), performer_ids: ids.map(String) })
        },
        galleries: {
            title: 'Gallery',
            pluralTitle: 'Galleries',
            labelKey: 'title',
            searchFields: ['title', 'id'],
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true, headerSort: false },
                { title: "Title", field: "title", widthGrow: 2, resizable: true, headerSort: false },
            ],
            fetchQuery: `query { findGalleries(filter: { per_page: -1 }) { galleries { id title } } }`,
            extractList: data => data?.findGalleries?.galleries || [],
            fetchExistingQuery: `query ($id: ID!) { findScene(id: $id) { galleries { id } } }`,
            extractExisting: data => data?.findScene?.galleries?.map(g => g.id) || [],
            createQuery: `mutation ($title: String!) { galleryCreate(input: { title: $title }) { id title } }`,
            createExtract: data => data?.galleryCreate?.id,
            createVariables: val => ({ title: val }),
            updateQuery: `mutation ($scene_id: ID!, $gallery_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, gallery_ids: $gallery_ids }) { id } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), gallery_ids: ids.map(String) })
        },
        studios: {
            title: 'Studio',
            pluralTitle: 'Studios',
            labelKey: 'name',
            searchFields: ['name', 'parent_name', 'id'],
            isSingleSelect: true,
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true, headerSort: false },
                { title: "Name", field: "name", widthGrow: 2, resizable: true, headerSort: false },
                { title: "Parent Studio", field: "parent_name", widthGrow: 1, resizable: true, headerSort: false },
            ],
            fetchQuery: `query { findStudios(filter: { per_page: -1 }) { studios { id name parent_studio { id name } } } }`,
            extractList: data => (data?.findStudios?.studios || []).map(s => ({
                id: s.id,
                name: s.name,
                parent_name: s.parent_studio ? s.parent_studio.name : ''
            })),
            fetchExistingQuery: `query ($id: ID!) { findScene(id: $id) { studio { id name } } }`,
            extractExisting: data => data?.findScene?.studio?.id ? [data.findScene.studio.id] : [],
            createQuery: `mutation ($name: String!) { studioCreate(input: { name: $name }) { id name } }`,
            createExtract: data => data?.studioCreate?.id,
            createVariables: val => ({ name: val }),
            updateQuery: `mutation ($scene_id: ID!, $studio_id: ID) { sceneUpdate(input: { id: $scene_id, studio_id: $studio_id }) { id } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), studio_id: ids.length > 0 ? String(ids[0]) : null })
        }
    };

    // --- State & Controllers ---
    let currentMenu = null;
    let activePopup = null;
    let activeTableInstance = null;
    let menuAbortController = null;
    let popupAbortController = null;
    let previewAbortController = null;
    let isTabActive = true;

    let cacheStore = {
        tags: { data: null, timestamp: 0 },
        performers: { data: null, timestamp: 0 },
        galleries: { data: null, timestamp: 0 },
        studios: { data: null, timestamp: 0 }
    };
    const CACHE_TTL = 5 * 60 * 1000;

    let sequentialEditState = {
        enabled: false,
        allSceneCards: [],
        currentIndex: 0,
        currentSceneId: null,
        currentType: null,
        popupPosition: { left: 0, top: 0 },
        initialSelectedIds: new Set(),
        getSelectedIdsFn: null
    };

    const THEME_STORAGE_KEY = 'stash_fast_tag_theme';
    const recentStorageKeys = {
        tags: 'stash_fast_tag_recent_tags',
        performers: 'stash_fast_tag_recent_performers',
        galleries: 'stash_fast_tag_recent_galleries',
        studios: 'stash_fast_tag_recent_studios'
    };

    // --- Scroll Restoration ---
    const scrollKey = 'stash_scroll_pos_' + window.location.pathname + window.location.search;
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
        sessionStorage.removeItem(scrollKey);
        const targetScroll = parseInt(savedScroll, 10);
        let attempts = 0;
        const restoreScroll = () => {
            window.scrollTo(0, targetScroll);
            if (window.scrollY !== targetScroll && attempts < 30) {
                attempts++;
                setTimeout(restoreScroll, 100);
            }
        };
        setTimeout(restoreScroll, 50);
    }

    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) {
            sessionStorage.setItem(scrollKey, window.scrollY);
        }
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
        isTabActive = !document.hidden;
    });

    // --- Style & Dependency Injections ---
    let dependencyLoadPromise = null;
    function loadScript(src, id) {
        return new Promise((resolve, reject) => {
            if (document.getElementById(id)) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.id = id;
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    function ensureDependenciesLoaded() {
        if (typeof Tabulator !== 'undefined' && typeof Toastify !== 'undefined') {
            return Promise.resolve();
        }
        if (dependencyLoadPromise) return dependencyLoadPromise;

        dependencyLoadPromise = (async () => {
            const promises = [];
            if (typeof Tabulator === 'undefined') {
                promises.push(loadScript('https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js', 'tabulator-external-js'));
            }
            if (typeof Toastify === 'undefined') {
                promises.push(loadScript('https://cdn.jsdelivr.net/npm/toastify-js', 'toastify-external-js'));
            }
            await Promise.all(promises);
        })().catch(err => {
            console.warn('[FastTag] Dependency autoload note:', err.message);
        });

        return dependencyLoadPromise;
    }

    // Auto-trigger dependency preload immediately
    ensureDependenciesLoaded();

    if (!document.getElementById('tabulator-external-css')) {
        const link = document.createElement('link');
        link.id = 'tabulator-external-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/tabulator-tables@5.5.2/dist/css/tabulator.min.css';
        document.head.appendChild(link);
    }

    if (!document.getElementById('toastify-external-css')) {
        const link = document.createElement('link');
        link.id = 'toastify-external-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css';
        document.head.appendChild(link);
    }

    const styleId = 'scenes-manager-modern-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
        #scenes-popup {
            opacity: 0;
            visibility: hidden;
            transform: translateY(4px);
            transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
            will-change: opacity, transform;
        }
        #scenes-popup.popup-visible {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        #scenes-custom-menu {
            border-radius: 8px;
            padding: 6px;
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            min-width: 150px;
            animation: menuFadeIn 0.15s ease-out;
        }
        #scenes-custom-menu a {
            display: block;
            padding: 8px 12px;
            text-decoration: none;
            border-radius: 4px;
            transition: background 0.15s, color 0.15s;
        }
        @keyframes menuFadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }
        #scenes-custom-menu.theme-dark {
            background: #1e293b;
            border: 1px solid #334155;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
        }
        #scenes-custom-menu.theme-dark a { color: #e2e8f0; }
        #scenes-custom-menu.theme-dark a:hover { background: #334155; color: #ffffff; }

        #scenes-custom-menu.theme-light {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
        }
        #scenes-custom-menu.theme-light a { color: #1e293b; }
        #scenes-custom-menu.theme-light a:hover { background: #f1f5f9; color: #0f172a; }

        #scenes-popup.theme-dark {
            background: #1e293b !important;
            border: 1px solid #334155 !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4) !important;
            color: #f8fafc !important;
        }
        #scenes-popup.theme-dark .popup-title { color: #f1f5f9 !important; }
        #scenes-popup.theme-dark .popup-seq-label { color: #94a3b8 !important; }
        #scenes-popup.theme-dark .popup-nav-btn { background: #334155 !important; color: #e2e8f0 !important; border: 1px solid #475569 !important; }
        #scenes-popup.theme-dark .popup-drag-handle { border: 1px solid #334155 !important; background: #0f172a !important; color: #94a3b8 !important; }
        #scenes-popup.theme-dark .popup-search-input { border: 1px solid #334155 !important; background: #0f172a !important; color: #f8fafc !important; }
        #scenes-popup.theme-dark .popup-search-clear { color: #64748b !important; }
        #scenes-popup.theme-dark .popup-refresh-btn { border: 1px solid #334155 !important; background: #0f172a !important; color: #94a3b8 !important; }
        #scenes-popup.theme-dark .popup-cancel-btn { background: #334155 !important; border: 1px solid #475569 !important; color: #e2e8f0 !important; }

        #scenes-popup.theme-light {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1) !important;
            color: #0f172a !important;
        }
        #scenes-popup.theme-light .popup-title { color: #0f172a !important; }
        #scenes-popup.theme-light .popup-seq-label { color: #64748b !important; }
        #scenes-popup.theme-light .popup-nav-btn { background: #64748b !important; color: white !important; border: none !important; }
        #scenes-popup.theme-light .popup-drag-handle { border: 1px solid #e2e8f0 !important; background: #f8fafc !important; color: #94a3b8 !important; }
        #scenes-popup.theme-light .popup-search-input { border: 1px solid #cbd5e1 !important; background: #ffffff !important; color: #1e293b !important; }
        #scenes-popup.theme-light .popup-search-clear { color: #94a3b8 !important; }
        #scenes-popup.theme-light .popup-refresh-btn { border: 1px solid #cbd5e1 !important; background: #f8fafc !important; color: #475569 !important; }
        #scenes-popup.theme-light .popup-cancel-btn { background: #f1f5f9 !important; border: 1px solid #cbd5e1 !important; color: #334155 !important; }

        #scenes-popup.theme-dark .tabulator {
            background-color: #0f172a !important;
            border: 1px solid #334155 !important;
            border-radius: 6px !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            font-size: 12px !important;
            color: #e2e8f0 !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header {
            background-color: #1e293b !important;
            border-bottom: 1px solid #334155 !important;
            color: #94a3b8 !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col {
            background-color: transparent !important;
            border-right: none !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col-title {
            color: #94a3b8 !important;
            font-weight: 600 !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row {
            background-color: #0f172a !important;
            color: #e2e8f0 !important;
            border-bottom: 1px solid #1e293b !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row:hover {
            background-color: #1e293b !important;
            color: #ffffff !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-selected,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-selected:hover {
            background-color: #312e81 !important;
            color: #ffffff !important;
            border-bottom: 1px solid #4338ca !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-placeholder { color: #64748b !important; }
        #scenes-popup.theme-dark .tabulator-tableholder::-webkit-scrollbar-track {
            background: #0f172a;
            border-radius: 0 6px 6px 0;
            border-left: 1px solid #334155;
        }
        #scenes-popup.theme-dark .tabulator-tableholder::-webkit-scrollbar-thumb {
            background: #334155;
            border-radius: 6px;
            border: 2px solid #0f172a;
        }
        #scenes-popup.theme-dark .tabulator-tableholder::-webkit-scrollbar-thumb:hover { background: #475569; }

        #scenes-popup.theme-light .tabulator {
            background-color: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            font-size: 12px !important;
            color: #1e293b !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-header {
            background-color: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
            color: #64748b !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-header .tabulator-col {
            background-color: transparent !important;
            border-right: none !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-header .tabulator-col-title {
            color: #475569 !important;
            font-weight: 600 !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-row {
            background-color: #ffffff !important;
            color: #1e293b !important;
            border-bottom: 1px solid #f1f5f9 !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-row:hover { background-color: #f1f5f9 !important; }
        #scenes-popup.theme-light .tabulator .tabulator-row.tabulator-selected,
        #scenes-popup.theme-light .tabulator .tabulator-row.tabulator-selected:hover {
            background-color: #e0e7ff !important;
            color: #1e293b !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-placeholder { color: #94a3b8 !important; }
        #scenes-popup.theme-light .tabulator-tableholder::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 0 6px 6px 0;
            border-left: 1px solid #e2e8f0;
        }
        #scenes-popup.theme-light .tabulator-tableholder::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 6px;
            border: 2px solid #f1f5f9;
        }
        #scenes-popup.theme-light .tabulator-tableholder::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        #scenes-popup .tabulator-tableholder { overflow-x: hidden !important; }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar { width: 14px; }
        `;
        document.head.appendChild(style);
    }

    // --- Core GraphQL Network Operations ---
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
        const bg = type === "success" ? "#10b981" : (type === "info" ? "#6366f1" : "#ef4444");
        Toastify({
            text: message,
            duration: 2000,
            gravity: "top",
            position: "center",
            style: { background: bg }
        }).showToast();
    }

    const toastSuccess = (message, debug) => {
        showToast(message, 'success');
        if (debug) console.log(debug);
    };

    const toastError = (message, debug) => {
        showToast(message, 'error');
        if (debug) {
            console.error(debug);
        } else {
            console.error(`[FastTag Error]: ${message}`);
        }
    };

    // --- Theme & Storage Helpers ---
    function getThemePreference() {
        return localStorage.getItem(THEME_STORAGE_KEY) || 'dark';
    }

    function getEffectiveTheme() {
        const pref = getThemePreference();
        if (pref === 'light' || pref === 'dark') return pref;
        const htmlTheme = document.documentElement.getAttribute('data-bs-theme') || document.documentElement.getAttribute('data-theme');
        if (htmlTheme === 'light' || htmlTheme === 'dark') return htmlTheme;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
        return 'dark';
    }

    function setThemePreference(theme) {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }

    function getCachedOrNull(type) {
        const item = cacheStore[type];
        if (item && item.data && (Date.now() - item.timestamp < CACHE_TTL)) {
            return item.data;
        }
        return null;
    }

    function setCache(type, data) {
        cacheStore[type] = { data, timestamp: Date.now() };
    }

    function invalidateCache(type) {
        if (type && cacheStore[type]) {
            cacheStore[type] = { data: null, timestamp: 0 };
        } else {
            cacheStore = {
                tags: { data: null, timestamp: 0 },
                performers: { data: null, timestamp: 0 },
                galleries: { data: null, timestamp: 0 },
        studios: { data: null, timestamp: 0 }
            };
        }
    }

    const PINNED_STORAGE_PREFIX = 'stash_fast_tag_pinned_';
    function readPinnedEntries(type) {
        try {
            const raw = localStorage.getItem(PINNED_STORAGE_PREFIX + type);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writePinnedEntries(type, value) {
        try {
            localStorage.setItem(PINNED_STORAGE_PREFIX + type, JSON.stringify(Array.isArray(value) ? value : []));
        } catch (e) {}
    }

    function togglePinnedEntry(type, item) {
        if (!item || !item.id) return;
        const name = item.name || item.title;
        let list = readPinnedEntries(type);
        const exists = list.some(p => String(p.id) === String(item.id));
        if (exists) {
            list = list.filter(p => String(p.id) !== String(item.id));
            showToast(`Unpinned ${name}`, 'info');
        } else {
            list.push({ id: item.id, name: name });
            showToast(`Pinned ${name} 📌`, 'success');
        }
        writePinnedEntries(type, list);
    }

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
            localStorage.setItem(recentStorageKeys[type], JSON.stringify((Array.isArray(value) ? value : []).slice(0, 24)));
        } catch (e) {}
    }

    function addRecentEntry(type, item) {
        if (!item) return;
        const name = item.name || item.title;
        if (!name) return;
        const list = readRecentEntries(type).filter(entry => entry && (entry.name || entry.title) && (entry.name || entry.title) !== name);
        list.unshift({ id: item.id, name: name });
        writeRecentEntries(type, list);
    }

    function addRecentEntriesFromSelection(type, selectedItems) {
        if (!Array.isArray(selectedItems)) return;
        selectedItems.filter(Boolean).forEach(item => addRecentEntry(type, item));
    }

    // --- Bulk Scene Selection Detection ---
    function getBulkSelectedScenes() {
        const checkedBoxes = Array.from(document.querySelectorAll('.scene-card input[type="checkbox"]:checked, .scene-card.selected, [class*="scene-card"] input[type="checkbox"]:checked, input[type="checkbox"]:checked'));
        const scenes = [];
        const seen = new Set();
        checkedBoxes.forEach(el => {
            const card = el.closest('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
            if (!card) return;
            const sceneId = extractSceneId(card);
            if (sceneId && !seen.has(sceneId)) {
                seen.add(sceneId);
                scenes.push({ id: sceneId, card: card });
            }
        });
        return scenes;
    }

    // --- Preview & Scrubbing ---
    function extractPreviewUrlFromCard(cardElement) {
        if (!cardElement) return null;
        const candidates = [
            cardElement.querySelector('video'),
            cardElement.querySelector('img'),
            cardElement.querySelector('source[src]'),
            cardElement.querySelector('[src]'),
            cardElement.querySelector('[poster]')
        ];

        for (const node of candidates) {
            if (!node) continue;
            const src = node.currentSrc || node.src || node.getAttribute('src') || node.getAttribute('poster');
            if (src && /(preview|thumb|screenshot|\.webp|\.mp4|\.webm|\.m4v|\.mov|\.gif)/i.test(src)) {
                return src;
            }
        }
        return null;
    }

    async function fetchScenePreviewUrl(sceneId, cardElement) {
        const fromCard = extractPreviewUrlFromCard(cardElement);
        if (fromCard) return fromCard;

        if (!sceneId) return null;
        const directUrl = `${window.location.origin || 'http://localhost:9999'}/scene/${encodeURIComponent(sceneId)}/preview`;

        const queries = [
            `query ($id: ID!) { findScene(id: $id) { preview screenshot } }`,
            `query ($id: ID!) { findScene(id: $id) { paths { preview screenshot } } }`
        ];

        for (const query of queries) {
            try {
                const res = await fetchGQL(query, { id: sceneId });
                if (res.errors) continue;
                const scene = res.data?.findScene;
                if (!scene) continue;
                const preview = scene.preview || scene.screenshot || scene.paths?.preview || scene.paths?.screenshot;
                if (preview) return preview;
            } catch (error) {
                console.error('Stash Scene Manager: preview fetch failed', error);
            }
        }

        return directUrl;
    }

    async function attachScenePreview(hostContainer, sceneId, cardElement) {
        if (previewAbortController) {
            previewAbortController.abort();
        }
        previewAbortController = new AbortController();
        const { signal } = previewAbortController;

        if (!hostContainer) return;
        hostContainer.innerHTML = '';
        hostContainer.style.display = 'block';
        hostContainer.style.position = 'relative';
        hostContainer.style.width = '100%';
        hostContainer.style.aspectRatio = '16 / 9';
        hostContainer.style.maxHeight = '280px';
        hostContainer.style.margin = '0 0 10px 0';
        hostContainer.style.borderRadius = '8px';
        hostContainer.style.overflow = 'hidden';
        hostContainer.style.border = 'none';
        hostContainer.style.background = '#0f172a';
        hostContainer.style.boxShadow = 'none';
        hostContainer.style.cursor = 'pointer';

        hostContainer.onclick = (e) => {
            if (e.shiftKey) return;
            const sceneUrl = getSceneUrl(sceneId, cardElement);
            if (sceneUrl) {
                window.open(sceneUrl, '_blank');
            }
        };

        const previewUrl = await fetchScenePreviewUrl(sceneId, cardElement);
        if (signal.aborted) return;

        if (!previewUrl) {
            hostContainer.style.display = 'none';
            return;
        }

        const isVideoPreview = /\/preview(?:[?#]|$)|\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(previewUrl);
        const media = isVideoPreview ? document.createElement('video') : document.createElement('img');

        media.style.display = 'block';
        media.style.width = '100%';
        media.style.height = '100%';
        media.style.objectFit = 'cover';
        media.style.background = '#0f172a';
        media.style.pointerEvents = 'none';

        media.onerror = () => { hostContainer.style.display = 'none'; };

        if (isVideoPreview) {
            media.src = previewUrl;
            media.muted = true;
            media.autoplay = true;
            media.loop = true;
            media.playsInline = true;
            media.preload = 'auto';
            media.setAttribute('playsinline', 'true');
            media.setAttribute('webkit-playsinline', 'true');
            media.load();
            media.play().catch(() => {});
        } else {
            media.src = previewUrl;
            media.alt = 'Scene preview';
            media.loading = 'eager';
        }

        hostContainer.appendChild(media);

        if (isVideoPreview) {
            let wasPlaying = false;
            let resumeTimer = null;
            const RESUME_DELAY = 250;
            let scrubbing = false;
            let originalLoop = !!media.loop;
            let shiftHeld = false;
            let wheelListenerAttached = false;
            let isHovered = false;

            hostContainer.onmouseenter = () => {
                isHovered = true;
            };

            hostContainer.onmouseleave = () => {
                isHovered = false;
                if (shiftHeld) {
                    shiftHeld = false;
                    detachWheel();
                    clearTimeout(resumeTimer);
                    endScrubbing();
                }
            };

            const onWheel = (e) => {
                if (!shiftHeld) return;
                e.preventDefault();
                if (!media || media.duration <= 0 || !isFinite(media.duration)) return;

                const notches = e.deltaMode === 1 ? e.deltaY : e.deltaY / 100;
                if (notches === 0) return;

                if (!scrubbing) {
                    scrubbing = true;
                    originalLoop = !!media.loop;
                    try { media.loop = false; } catch (err) {}
                }

                if (!media.paused && !media.ended) {
                    wasPlaying = true;
                    try { media.pause(); } catch (err) {}
                }

                const scrubSeconds = -Math.sign(notches) * 1.0 * Math.min(Math.abs(notches), 10);
                media.currentTime = Math.min(media.duration, Math.max(0, media.currentTime + scrubSeconds));
                clearTimeout(resumeTimer);
            };

            const attachWheel = () => {
                if (!wheelListenerAttached) {
                    hostContainer.addEventListener('wheel', onWheel, { passive: false, signal });
                    wheelListenerAttached = true;
                }
            };

            const detachWheel = () => {
                if (wheelListenerAttached) {
                    hostContainer.removeEventListener('wheel', onWheel);
                    wheelListenerAttached = false;
                }
            };

            const endScrubbing = () => {
                scrubbing = false;
                try { media.loop = !!originalLoop; } catch (err) {}
                if (wasPlaying && !shiftHeld) {
                    media.play().catch(() => {});
                    wasPlaying = false;
                }
            };

            const onKeyDown = (e) => {
                if (e.key === 'Shift' && !shiftHeld && isHovered) {
                    shiftHeld = true;
                    if (!scrubbing) {
                        scrubbing = true;
                        originalLoop = !!media.loop;
                        try { media.loop = false; } catch (err) {}
                    }
                    if (!media.paused && !media.ended) {
                        wasPlaying = true;
                        try { media.pause(); } catch (err) {}
                    }
                    attachWheel();
                }
            };

            const onKeyUp = (e) => {
                if (e.key === 'Shift' && shiftHeld) {
                    shiftHeld = false;
                    detachWheel();
                    clearTimeout(resumeTimer);
                    resumeTimer = setTimeout(endScrubbing, RESUME_DELAY);
                }
            };

            const onWindowBlur = () => {
                if (shiftHeld) {
                    shiftHeld = false;
                    detachWheel();
                    clearTimeout(resumeTimer);
                    endScrubbing();
                }
            };

            document.addEventListener('keydown', onKeyDown, { signal });
            document.addEventListener('keyup', onKeyUp, { signal });
            window.addEventListener('blur', onWindowBlur, { signal });
        }
    }

    // --- State & Sequential Utilities ---
    function getSceneUrl(sceneId, cardElement) {
        if (cardElement) {
            const link = cardElement.querySelector('a.scene-card-link') ||
                         cardElement.querySelector('a[href*="/scenes/"]:not([class*="tag"]):not([class*="performer"]):not([class*="gallery"])') ||
                         cardElement.querySelector('a[href*="/scenes/"]');
            if (link) {
                const href = link.getAttribute('href') || link.href;
                if (href && href.includes('/scenes/')) {
                    return href;
                }
            }
        }
        if (sceneId) {
            const search = window.location.search || '';
            if (search) {
                const hasContinue = search.includes('continue=');
                const glue = search.includes('?') ? '&' : '?';
                return `/scenes/${sceneId}${search}${hasContinue ? '' : glue + 'continue=true'}`;
            }
            return `/scenes/${sceneId}`;
        }
        return null;
    }

    function extractSceneId(cardElement) {
        if (!cardElement) return null;
        const link = cardElement.querySelector('a[href*="/scenes/"]');
        if (link) {
            const match = link.href.match(/scenes\/([a-zA-Z0-9-]+)/);
            if (match) return match[1];
        }
        return null;
    }

    function getAllVisibleSceneCards() {
        const cards = document.querySelectorAll('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
        return Array.from(cards).filter(card => extractSceneId(card) !== null);
    }

    function getSceneCardIndex(sceneId, allCards) {
        return allCards.findIndex(card => extractSceneId(card) === sceneId);
    }

    function resetSequentialEditState() {
        sequentialEditState = {
            enabled: false,
            allSceneCards: [],
            currentIndex: 0,
            currentSceneId: null,
            currentType: null,
            popupPosition: { left: 0, top: 0 },
            initialSelectedIds: new Set(),
            getSelectedIdsFn: null
        };
    }

    function hasSelectionChanged(selectedIds) {
        if (!selectedIds) {
            if (typeof sequentialEditState.getSelectedIdsFn === 'function') {
                selectedIds = sequentialEditState.getSelectedIdsFn();
            } else {
                return false;
            }
        }
        const currentSet = new Set(Array.from(selectedIds).map(String));
        const initialSet = sequentialEditState.initialSelectedIds || new Set();
        if (currentSet.size !== initialSet.size) return true;
        for (let id of currentSet) {
            if (!initialSet.has(id)) return true;
        }
        return false;
    }

    function updateSequentialEditUI(form, type, selectedIds) {
        const config = ENTITY_CONFIG[type];
        const prevBtn = form.querySelector(`#${type}-prev-btn`);
        const nextBtn = form.querySelector(`#${type}-next-btn`);
        const title = form.querySelector(`#${type}-popup-title`);
        const modeCheckbox = form.querySelector(`#${type}-sequential-mode`);
        const saveBtn = form.querySelector(`#${type}-save-btn`);

        if (!sequentialEditState.enabled) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (modeCheckbox) modeCheckbox.checked = false;
            if (title) title.textContent = `Edit ${config.pluralTitle}`;
            if (saveBtn) {
                saveBtn.textContent = `Save ${config.pluralTitle}`;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
                saveBtn.style.background = '#6366f1';
            }
            return;
        }

        if (prevBtn) prevBtn.style.display = 'inline-flex';
        if (nextBtn) nextBtn.style.display = 'inline-flex';
        if (modeCheckbox) modeCheckbox.checked = true;

        const currentNum = sequentialEditState.currentIndex + 1;
        const totalNum = sequentialEditState.allSceneCards.length;
        if (title) title.textContent = `Edit ${config.pluralTitle} [${currentNum}/${totalNum}]`;

        const isLast = currentNum >= totalNum;
        const isChanged = hasSelectionChanged(selectedIds);

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';

            if (isChanged) {
                saveBtn.textContent = isLast ? 'Save & Close' : 'Save & Next Scene ►';
                saveBtn.style.background = '#10b981';
            } else {
                saveBtn.textContent = isLast ? 'Close' : 'Next Scene ►';
                saveBtn.style.background = '#6366f1';
            }
        }

        if (prevBtn) {
            const isFirst = sequentialEditState.currentIndex === 0;
            prevBtn.disabled = isFirst;
            prevBtn.style.opacity = isFirst ? '0.4' : '1';
            prevBtn.style.cursor = isFirst ? 'not-allowed' : 'pointer';
        }

        if (nextBtn) {
            nextBtn.disabled = isLast;
            nextBtn.style.opacity = isLast ? '0.4' : '1';
            nextBtn.style.cursor = isLast ? 'not-allowed' : 'pointer';
        }
    }

    async function refreshSceneCards() {
        const apollo = window.__APOLLO_CLIENT__;
        if (!apollo || typeof apollo.getObservableQueries !== 'function') return false;

        const sceneQueries = [...apollo.getObservableQueries().values()].filter(query => {
            const queryText = query.options?.query?.loc?.source?.body || '';
            return queryText.includes('FindScenes') && typeof query.refetch === 'function';
        });

        if (!sceneQueries.length) return false;
        await Promise.all(sceneQueries.map(query => query.refetch()));
        return true;
    }

    async function updateEntityForScene(type, sceneId, selectedIds) {
        const config = ENTITY_CONFIG[type];
        const res = await fetchGQL(config.updateQuery, config.updateVariables(sceneId, selectedIds));
        if (res.errors) {
            toastError(`Failed to update ${config.title.toLowerCase()}`, res.errors);
            return false;
        }
        return true;
    }

    async function navigateToNextScene(form, type, direction = 1, getSelectedIdsFn) {
        if (!sequentialEditState.enabled) return;

        const currentSceneId = sequentialEditState.currentSceneId;
        if (currentSceneId && typeof getSelectedIdsFn === 'function') {
            const currentSelectedIds = Array.from(getSelectedIdsFn());
            const hasChanged = hasSelectionChanged(currentSelectedIds);

            if (hasChanged) {
                const tableData = (activeTableInstance && typeof activeTableInstance.getData === 'function') ? activeTableInstance.getData() : [];
                const cachedData = getCachedOrNull(type) || [];
                const allData = Array.isArray(tableData) && tableData.length > 0 ? tableData : cachedData;

                const newlyAddedIds = currentSelectedIds.filter(id => !sequentialEditState.initialSelectedIds.has(String(id)));
                const targetIds = newlyAddedIds.length > 0 ? newlyAddedIds : currentSelectedIds;
                const itemsToAdd = targetIds.map(id => allData.find(entry => String(entry.id) === String(id))).filter(Boolean);

                if (itemsToAdd.length > 0) {
                    addRecentEntriesFromSelection(type, itemsToAdd);
                }

                const success = await updateEntityForScene(type, currentSceneId, currentSelectedIds);
                if (success) {
                    toastSuccess(`${ENTITY_CONFIG[type].title} saved`);
                    await refreshSceneCards();
                }
            }
        }

        const formRect = form.getBoundingClientRect();
        sequentialEditState.popupPosition = {
            left: formRect.left + window.scrollX,
            top: formRect.top + window.scrollY
        };

        const nextIndex = sequentialEditState.currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= sequentialEditState.allSceneCards.length) {
            toastError('No more scenes in this direction');
            return;
        }

        const nextCard = sequentialEditState.allSceneCards[nextIndex];
        const nextSceneId = extractSceneId(nextCard);
        if (!nextCard || !nextSceneId) {
            toastError('Error resolving next scene');
            return;
        }

        sequentialEditState.currentIndex = nextIndex;
        sequentialEditState.currentSceneId = nextSceneId;

        await loadEntityDataIntoPopup(type, nextSceneId, nextCard, activePopup);
    }

    function setupSequentialEditHandlers(form, type, sceneId, cardElement, getSelectedIdsFn) {
        sequentialEditState.getSelectedIdsFn = getSelectedIdsFn;
        const modeCheckbox = form.querySelector(`#${type}-sequential-mode`);
        const prevBtn = form.querySelector(`#${type}-prev-btn`);
        const nextBtn = form.querySelector(`#${type}-next-btn`);

        modeCheckbox.replaceWith(modeCheckbox.cloneNode(true));
        const newModeCheckbox = form.querySelector(`#${type}-sequential-mode`);

        newModeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!sequentialEditState.enabled || sequentialEditState.allSceneCards.length === 0) {
                    sequentialEditState.allSceneCards = getAllVisibleSceneCards();
                }

                const formRect = form.getBoundingClientRect();
                sequentialEditState.popupPosition = {
                    left: formRect.left + window.scrollX,
                    top: formRect.top + window.scrollY
                };

                sequentialEditState.enabled = true;
                sequentialEditState.currentType = type;
                sequentialEditState.currentSceneId = sceneId;
                sequentialEditState.currentIndex = getSceneCardIndex(sceneId, sequentialEditState.allSceneCards);

                if (sequentialEditState.currentIndex === -1) {
                    sequentialEditState.currentIndex = 0;
                }

                updateSequentialEditUI(form, type);
            } else {
                resetSequentialEditState();
                updateSequentialEditUI(form, type);
            }
        });

        if (sequentialEditState.enabled) {
            newModeCheckbox.checked = true;
            updateSequentialEditUI(form, type);
        }

        if (prevBtn) {
            prevBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToNextScene(form, type, -1, getSelectedIdsFn);
            };
        }
        if (nextBtn) {
            nextBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToNextScene(form, type, 1, getSelectedIdsFn);
            };
        }
    }

    // --- Search, Sorting, and Quick Selection ---
    function getSmartSortComparator(term, selectedIds, labelKey, searchFields = [labelKey]) {
        return (a, b) => {
            const aSel = selectedIds.has(String(a.id));
            const bSel = selectedIds.has(String(b.id));
            if (aSel && !bSel) return -1;
            if (!aSel && bSel) return 1;

            const aName = String(a[labelKey] || '').trim().toLowerCase();
            const bName = String(b[labelKey] || '').trim().toLowerCase();
            const aId = String(a.id || '').trim();
            const bId = String(b.id || '').trim();
            if (!term) return aName.localeCompare(bName);

            const aIdExact = aId === term ? 1 : 0;
            const bIdExact = bId === term ? 1 : 0;
            if (aIdExact !== bIdExact) return bIdExact - aIdExact;

            const aIdStarts = aId.startsWith(term) ? 1 : 0;
            const bIdStarts = bId.startsWith(term) ? 1 : 0;
            if (aIdStarts !== bIdStarts) return bIdStarts - aIdStarts;

            const aExact = aName === term ? 1 : 0;
            const bExact = bName === term ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;

            const aStarts = aName.startsWith(term) ? 1 : 0;
            const bStarts = bName.startsWith(term) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;

            const aIncludes = aName.includes(term) ? 1 : 0;
            const bIncludes = bName.includes(term) ? 1 : 0;
            if (aIncludes !== bIncludes) return bIncludes - aIncludes;

            if (Array.isArray(searchFields) && searchFields.length > 1) {
                const getFullSearchStr = (item) => searchFields
                    .map(f => String(item[f] || '').trim().toLowerCase())
                    .filter(Boolean)
                    .join(' ');
                const aFull = getFullSearchStr(a);
                const bFull = getFullSearchStr(b);
                const aFullInc = aFull.includes(term) ? 1 : 0;
                const bFullInc = bFull.includes(term) ? 1 : 0;
                if (aFullInc !== bFullInc) return bFullInc - aFullInc;
            }

            return aName.localeCompare(bName);
        };
    }

    function trySelectRecentChip(type, item, selectedIds, input, onSelected) {
        if (item) {
            addRecentEntry(type, item);
        }
        if (item && item.id != null) {
            const idStr = String(item.id);
            if (selectedIds.has(idStr)) {
                selectedIds.delete(idStr);
            } else {
                selectedIds.add(idStr);
            }
        }
        if (input && input.value) {
            input.value = '';
        }
        if (typeof onSelected === 'function') {
            onSelected();
        }
        return true;
    }

    const SUPERSCRIPT_DIGITS = ['', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

    function renderQuickActions(form, type, input, selectedIds, onRecentChipSelect) {
        const target = form.querySelector(`#${type}-quick-actions`);
        if (!target) return;

        const pinned = readPinnedEntries(type)
            .filter(item => item && (item.name || item.title))
            .map(item => ({ id: item.id, name: item.name || item.title, isPinned: true }));

        const pinnedIds = new Set(pinned.map(p => String(p.id)));

        const recent = readRecentEntries(type)
            .filter(item => item && (item.name || item.title) && !pinnedIds.has(String(item.id)))
            .map(item => ({ id: item.id, name: item.name || item.title, isPinned: false }));

        const combinedList = [...pinned, ...recent];

        if (!combinedList.length) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        const formHeight = form ? (form.offsetHeight || parseInt(form.style.height, 10) || 580) : 580;
        const maxRows = formHeight > 720 ? 3 : (formHeight > 520 ? 2 : 1);

        target.innerHTML = '';
        target.style.display = 'flex';
        target.style.alignItems = 'center';
        target.style.flexWrap = 'wrap';
        target.style.gap = '5px';
        target.style.maxHeight = 'none';
        target.style.overflow = 'visible';
        target.style.marginBottom = '8px';

        const isDark = getEffectiveTheme() === 'dark';
        const label = document.createElement('span');
        label.textContent = 'Recent:';
        label.className = 'popup-recent-label';
        label.style.cssText = `font-size: 11px; font-weight: 700; text-transform: uppercase; margin-right: 3px; user-select: none; flex-shrink: 0; line-height: 24px;`;
        target.appendChild(label);

        const rowTops = [];
        let chipIndex = 0;

        for (const item of combinedList) {
            chipIndex++;
            const isSelected = selectedIds && selectedIds.has(String(item.id));
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'fasttag-quick-chip';
            chip.setAttribute('data-index', String(chipIndex));
            chip.title = `[Hotkey: ${chipIndex <= 9 ? chipIndex : 'None'}] Click to toggle. Right-Click or Alt-Click to ${item.isPinned ? 'unpin' : 'pin'}.`;

            if (item.isPinned) {
                const pinSpan = document.createElement('span');
                pinSpan.textContent = '📌 ';
                chip.appendChild(pinSpan);
            }
            if (isSelected) {
                const checkSpan = document.createElement('span');
                checkSpan.textContent = '✓ ';
                checkSpan.style.fontWeight = '700';
                chip.appendChild(checkSpan);
            }
            const textNode = document.createTextNode(item.name);
            chip.appendChild(textNode);

            if (chipIndex <= 9) {
                const numSpan = document.createElement('span');
                numSpan.textContent = ` ${chipIndex}`;
                numSpan.style.cssText = `font-size: 10px; font-weight: 700; opacity: 0.9; margin-left: 2px; vertical-align: super; line-height: 0;`;
                chip.appendChild(numSpan);
            }

            if (isDark) {
                const bg = item.isPinned ? (isSelected ? '#4338ca' : '#1e1b4b') : (isSelected ? '#4f46e5' : '#1e293b');
                const border = item.isPinned ? (isSelected ? '#a5b4fc' : '#6366f1') : (isSelected ? '#818cf8' : '#475569');
                const color = isSelected ? '#ffffff' : (item.isPinned ? '#e0e7ff' : '#f1f5f9');

                chip.style.cssText = `padding: 3px 9px; border: 1px solid ${border}; border-radius: 999px; background: ${bg}; color: ${color}; font-size: 11.5px; font-weight: ${item.isPinned || isSelected ? '600' : '500'}; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; line-height: 1.3;`;
                chip.addEventListener('mouseenter', () => {
                    chip.style.background = isSelected ? '#4338ca' : '#334155';
                    chip.style.borderColor = isSelected ? '#c7d2fe' : '#64748b';
                    chip.style.color = '#ffffff';
                });
                chip.addEventListener('mouseleave', () => {
                    chip.style.background = bg;
                    chip.style.borderColor = border;
                    chip.style.color = color;
                });
            } else {
                const bg = item.isPinned ? (isSelected ? '#c7d2fe' : '#e0e7ff') : (isSelected ? '#e0e7ff' : '#f1f5f9');
                const border = item.isPinned ? '#6366f1' : (isSelected ? '#6366f1' : '#cbd5e1');
                const color = isSelected ? '#312e81' : '#1e293b';

                chip.style.cssText = `padding: 3px 9px; border: 1px solid ${border}; border-radius: 999px; background: ${bg}; color: ${color}; font-size: 11.5px; font-weight: ${item.isPinned || isSelected ? '600' : '500'}; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; line-height: 1.3;`;
                chip.addEventListener('mouseenter', () => {
                    chip.style.background = isSelected ? '#c7d2fe' : '#e2e8f0';
                    chip.style.color = '#0f172a';
                });
                chip.addEventListener('mouseleave', () => {
                    chip.style.background = bg;
                    chip.style.borderColor = border;
                    chip.style.color = color;
                });
            }

            chip.addEventListener('click', (e) => {
                if (e.altKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePinnedEntry(type, item);
                    renderQuickActions(form, type, input, selectedIds, onRecentChipSelect);
                    return;
                }
                trySelectRecentChip(type, item, selectedIds, input, onRecentChipSelect);
            });

            chip.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePinnedEntry(type, item);
                renderQuickActions(form, type, input, selectedIds, onRecentChipSelect);
            });

            target.appendChild(chip);

            const topPos = chip.offsetTop;
            if (!rowTops.includes(topPos)) {
                rowTops.push(topPos);
            }

            if (rowTops.length > maxRows) {
                target.removeChild(chip);
                break;
            }
        }
    }

    function renderSmartSuggestions(form, type, input, selectedIds, suggestions, onSelectCallback) {
        const target = form.querySelector(`#${type}-suggestions-container`);
        if (!target) return;

        if (!suggestions || !suggestions.length) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        const unselectedSuggestions = suggestions.filter(s => !selectedIds.has(String(s.id)));
        if (!unselectedSuggestions.length) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        const isDark = getEffectiveTheme() === 'dark';
        target.innerHTML = '';
        target.style.display = 'flex';
        target.style.alignItems = 'center';
        target.style.flexWrap = 'wrap';
        target.style.gap = '5px';
        target.style.background = isDark ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.12)';
        target.style.border = isDark ? '1px dashed rgba(245, 158, 11, 0.35)' : '1px dashed rgba(217, 119, 6, 0.4)';

        const label = document.createElement('span');
        label.textContent = '💡 Suggested:';
        label.style.cssText = `font-size: 11px; font-weight: 700; color: ${isDark ? '#fbbf24' : '#d97706'}; text-transform: uppercase; margin-right: 3px; user-select: none; flex-shrink: 0; line-height: 22px;`;
        target.appendChild(label);

        unselectedSuggestions.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = `+ ${item.name || item.title}`;
            btn.title = `Click to add ${item.name || item.title}`;
            
            const btnBg = isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7';
            const btnBorder = isDark ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b';
            const btnColor = isDark ? '#fde047' : '#92400e';

            btn.style.cssText = `padding: 3px 9px; border: 1px solid ${btnBorder}; border-radius: 999px; background: ${btnBg}; color: ${btnColor}; font-size: 11.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; line-height: 1.3;`;
            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#f59e0b';
                btn.style.color = '#ffffff';
                btn.style.borderColor = '#f59e0b';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = btnBg;
                btn.style.color = btnColor;
                btn.style.borderColor = btnBorder;
            });
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                addRecentEntry(type, item);
                trySelectRecentChip(type, item, selectedIds, input, onSelectCallback);
                renderSmartSuggestions(form, type, input, selectedIds, suggestions, onSelectCallback);
            });
            target.appendChild(btn);
        });

        if (unselectedSuggestions.length > 1) {
            const acceptAllBtn = document.createElement('button');
            acceptAllBtn.type = 'button';
            acceptAllBtn.textContent = '✓ Accept All';
            acceptAllBtn.title = 'Add all suggested items';
            acceptAllBtn.style.cssText = 'padding: 3px 10px; border: 1px solid #10b981; border-radius: 999px; background: #059669; color: #ffffff; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s ease; margin-left: 4px; line-height: 1.3;';
            acceptAllBtn.addEventListener('mouseenter', () => {
                acceptAllBtn.style.background = '#047857';
            });
            acceptAllBtn.addEventListener('mouseleave', () => {
                acceptAllBtn.style.background = '#059669';
            });
            acceptAllBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                for (const item of unselectedSuggestions) {
                    selectedIds.add(String(item.id));
                    addRecentEntry(type, item);
                }
                if (typeof onSelectCallback === 'function') {
                    await onSelectCallback();
                }
                renderSmartSuggestions(form, type, input, selectedIds, suggestions, onSelectCallback);
                showToast(`Added ${unselectedSuggestions.length} suggested items`, 'success');
            });
            target.appendChild(acceptAllBtn);
        }
    }


    // --- Window and Context Menu Management ---
    function closeMenu() {
        if (menuAbortController) {
            menuAbortController.abort();
            menuAbortController = null;
        }
        if (currentMenu) {
            currentMenu.remove();
            currentMenu = null;
        }
    }

    function closePopup(resetSequential = true) {
        if (popupAbortController) {
            popupAbortController.abort();
            popupAbortController = null;
        }
        if (previewAbortController) {
            previewAbortController.abort();
            previewAbortController = null;
        }
        if (activeTableInstance) {
            try { activeTableInstance.destroy(); } catch (e) {}
            activeTableInstance = null;
        }
        if (activePopup && activePopup.element) {
            activePopup.element.classList.remove('popup-visible');
            activePopup.element.remove();
            activePopup = null;
        }
        document.querySelectorAll('#scenes-popup').forEach(el => el.remove());

        if (resetSequential) {
            resetSequentialEditState();
        }
    }

    function createCustomMenu(clickEvent, sceneId, cardElement) {
        const theme = getEffectiveTheme();
        const menu = document.createElement('div');
        menu.id = 'scenes-custom-menu';
        menu.className = `theme-${theme}`;
        menu.style.position = 'absolute';
        menu.style.zIndex = '999999';

        const createMenuItem = (label, callback) => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = label;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                closeMenu();
                callback();
            });
            menu.appendChild(link);
        };

        createMenuItem('Edit Tags...', () => openEntityPopup('tags', sceneId, cardElement));
        createMenuItem('Edit Performers...', () => openEntityPopup('performers', sceneId, cardElement));
        createMenuItem('Edit Studio...', () => openEntityPopup('studios', sceneId, cardElement));
        createMenuItem('Edit Galleries...', () => openEntityPopup('galleries', sceneId, cardElement));
        createMenuItem('Edit Scene', () => openEditScenePage(sceneId));

        const bulkScenes = getBulkSelectedScenes();
        if (bulkScenes.length >= 2) {
            const separator = document.createElement('div');
            separator.style.cssText = 'height: 1px; background: rgba(148, 163, 184, 0.2); margin: 4px 0;';
            menu.appendChild(separator);

            const bulkHeader = document.createElement('div');
            bulkHeader.textContent = `📦 Bulk (${bulkScenes.length} scenes)`;
            bulkHeader.style.cssText = 'font-size: 10px; font-weight: 700; color: #818cf8; padding: 4px 8px; text-transform: uppercase; user-select: none;';
            menu.appendChild(bulkHeader);

            createMenuItem(`🏷️ Bulk Tags (${bulkScenes.length})`, () => openBulkEntityPopup('tags', bulkScenes));
            createMenuItem(`⭐ Bulk Performers (${bulkScenes.length})`, () => openBulkEntityPopup('performers', bulkScenes));
            createMenuItem(`🏢 Bulk Studio (${bulkScenes.length})`, () => openBulkEntityPopup('studios', bulkScenes));
        }

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
        supportLink.addEventListener('click', () => closeMenu());
        menu.appendChild(supportLink);

        document.body.appendChild(menu);
        currentMenu = menu;
        return menu;
    }

    function showCustomMenu(event, sceneId, cardElement) {
        closeMenu();
        closePopup();

        menuAbortController = new AbortController();
        const { signal } = menuAbortController;

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

        document.addEventListener('mousedown', (e) => {
            if (!menu.contains(e.target)) closeMenu();
        }, { signal });
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

    const POPUP_SIZE_KEY = 'stash_fast_tag_popup_size';
    function getSavedPopupSize() {
        try {
            const val = localStorage.getItem(POPUP_SIZE_KEY);
            return val ? JSON.parse(val) : null;
        } catch (e) { return null; }
    }
    function setSavedPopupSize(width, height) {
        try {
            localStorage.setItem(POPUP_SIZE_KEY, JSON.stringify({ width: Math.round(width), height: Math.round(height) }));
        } catch (e) {}
    }

    // --- Smart Suggestions Engine ---
    async function fetchSceneSmartSuggestions(type, sceneId, allAvailableItems, existingIds, cardElement) {
        if (!sceneId || !allAvailableItems || !allAvailableItems.length) return [];
        try {
            let cardText = '';
            let title = '';
            let details = '';
            let filePath = '';
            let fileName = '';

            if (cardElement) {
                cardText = cardElement.innerText || cardElement.textContent || '';
            }

            try {
                const query = `query ($id: ID!) { findScene(id: $id) { title details files { path } } }`;
                const res = await fetchGQL(query, { id: sceneId });
                const scene = res?.data?.findScene;
                if (scene) {
                    if (scene.title) title = scene.title;
                    if (scene.details) details = scene.details;
                    if (scene.files && scene.files.length > 0 && scene.files[0]?.path) {
                        filePath = scene.files[0].path;
                        const parts = filePath.split(/[/\\]/);
                        const lastPart = parts.length > 0 ? parts[parts.length - 1] : filePath;
                        fileName = lastPart.replace(/\.[^/.]+$/, '');
                    }
                }
            } catch (e) {}

            const rawCombined = `${cardText} ${title} ${details} ${fileName} ${filePath}`.toLowerCase();
            const fullTextSpaced = ' ' + rawCombined.replace(/[^a-z0-9]+/g, ' ') + ' ';
            if (!rawCombined.trim()) return [];

            const existingSet = new Set(Array.from(existingIds || []).map(String));
            const suggestions = [];

            for (const item of allAvailableItems) {
                if (existingSet.has(String(item.id))) continue;
                const name = (item.name || item.title || '').trim();
                if (!name || name.length < 2) continue;

                const nameLower = name.toLowerCase();
                const nameClean = nameLower.replace(/[^a-z0-9]+/g, ' ').trim();
                if (!nameClean) continue;

                const nameSpaced = ' ' + nameClean + ' ';

                if (fullTextSpaced.includes(nameSpaced)) {
                    suggestions.push(item);
                    if (suggestions.length >= 15) break;
                }
            }
            return suggestions;
        } catch (e) {
            console.error('[FastTag] Suggestions error:', e);
            return [];
        }
    }

    // --- Generic Popup Builder & Life-Cycle ---
    function createPopupShell(type) {
        const config = ENTITY_CONFIG[type];
        const theme = getEffectiveTheme();
        const savedSize = getSavedPopupSize();
        const form = document.createElement('form');
        form.id = 'scenes-popup';
        form.className = `theme-${theme}`;
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'absolute';
        form.style.zIndex = '1000000';
        form.style.padding = '14px';
        form.style.borderRadius = '10px';
        form.style.width = savedSize?.width ? `${savedSize.width}px` : '340px';
        form.style.height = savedSize?.height ? `${savedSize.height}px` : '580px';
        form.style.minWidth = '320px';
        form.style.maxWidth = '90vw';
        form.style.minHeight = '380px';
        form.style.maxHeight = '90vh';
        form.style.boxSizing = 'border-box';
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        form.innerHTML = `
            <div id="${type}-popup-header" class="popup-header" style="margin: 0 0 13px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: grab; user-select: none; flex-shrink: 0;">
                <span id="${type}-popup-title" class="popup-title" style="font-size: 13px; font-weight: 600; line-height: 1; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: grab; flex: 1;">Edit ${config.pluralTitle}</span>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0; cursor: default;">
                    <label class="popup-seq-label" style="font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; user-select: none; margin: 0; line-height: 1;">
                        <input type="checkbox" id="${type}-sequential-mode" style="cursor: pointer; margin: 0; width: 13px; height: 13px; accent-color: #6366f1; vertical-align: middle;">
                        Sequential
                    </label>
                    <button type="button" id="${type}-prev-btn" class="popup-nav-btn" style="padding: 3px 6px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: none; align-items: center; line-height: 1;">◄</button>
                    <button type="button" id="${type}-next-btn" class="popup-nav-btn" style="padding: 3px 6px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: none; align-items: center; line-height: 1;">►</button>
                </div>
            </div>
            <div id="${type}-preview-container" style="flex-shrink: 0;"></div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px; align-items: center; flex-shrink: 0;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="${type}-search-input" class="popup-search-input" autocomplete="off" spellcheck="false" placeholder="Search ${config.pluralTitle.toLowerCase()}..." style="width: 100%; padding: 7px 28px 7px 10px; box-sizing: border-box; border-radius: 6px; font-size: 12px; outline: none;">
                    <span id="${type}-search-clear" class="popup-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 16px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="${type}-create-btn" style="padding: 7px 9px; cursor: pointer; font-size: 12px; font-weight: 500; background: #059669; color: white; border: none; border-radius: 6px; white-space: nowrap; display: none;">+ Create</button>
                <button type="button" id="${type}-refresh-btn" class="popup-refresh-btn" title="Refresh cache" style="padding: 7px 9px; cursor: pointer; font-size: 13px; font-weight: 500; border-radius: 6px; white-space: nowrap; line-height: 1;">↻</button>
            </div>
            <div id="${type}-suggestions-container" style="display: none; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; flex-shrink: 0; background: rgba(245, 158, 11, 0.08); padding: 6px 8px; border-radius: 6px; border: 1px dashed rgba(245, 158, 11, 0.35);"></div>
            <div id="${type}-quick-actions" style="display: none; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; flex-shrink: 0;"></div>
            <div id="${type}-tabulator-table" style="margin-bottom: 10px; width: 100%; flex: 1 1 auto; min-height: 140px; box-sizing: border-box; overflow: hidden;"></div>
            <div style="display: flex; gap: 8px; flex-shrink: 0;">
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

        document.body.appendChild(form);
        return {
            element: form,
            previewContainer: form.querySelector(`#${type}-preview-container`),
            tableContainer: form.querySelector(`#${type}-tabulator-table`),
            searchInput: form.querySelector(`#${type}-search-input`),
            searchClear: form.querySelector(`#${type}-search-clear`),
            createBtn: form.querySelector(`#${type}-create-btn`),
            refreshBtn: form.querySelector(`#${type}-refresh-btn`),
            saveBtn: form.querySelector(`#${type}-save-btn`),
            cancelBtn: form.querySelector(`#${type}-cancel-btn`)
        };
    }

    function positionPopupNearCard(form, cardElement) {
        if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0) {
            form.style.left = `${sequentialEditState.popupPosition.left}px`;
            form.style.top = `${sequentialEditState.popupPosition.top}px`;

            requestAnimationFrame(() => form.classList.add('popup-visible'));
            const firstInput = form.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
            return;
        }

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

            form.classList.add('popup-visible');

            const firstInput = form.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
        });
    }

    function setupPopupListeners(form, signal, onSaveCallback) {
        setTimeout(() => {
            document.addEventListener('mousedown', (e) => {
                if (!form.contains(e.target)) closePopup();
            }, { signal });
        }, 0);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closePopup();
            } else if (e.key === 'Enter') {
                const isSearchFocused = document.activeElement && document.activeElement.tagName === 'INPUT';
                if (isSearchFocused && !(e.ctrlKey || e.metaKey)) return;

                if (!isSearchFocused || e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (sequentialEditState.enabled) {
                        const saveBtn = form.querySelector(`#${sequentialEditState.currentType}-save-btn`);
                        if (saveBtn) saveBtn.click();
                    } else if (onSaveCallback) {
                        onSaveCallback();
                    }
                }
            } else if (sequentialEditState.enabled && e.altKey) {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const nextBtn = form.querySelector(`#${sequentialEditState.currentType}-next-btn`);
                    if (nextBtn && !nextBtn.disabled) nextBtn.click();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prevBtn = form.querySelector(`#${sequentialEditState.currentType}-prev-btn`);
                    if (prevBtn && !prevBtn.disabled) prevBtn.click();
                }
            }
        }, { signal });

        let isDragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        const header = form.querySelector('.popup-header') || form.querySelector('.popup-drag-handle');

        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('input, button, label')) return;
                isDragging = true;
                header.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
                dragOffsetX = e.clientX - form.offsetLeft;
                dragOffsetY = e.clientY - form.offsetTop;
            }, { signal });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    form.style.left = `${e.clientX - dragOffsetX}px`;
                    form.style.top = `${e.clientY - dragOffsetY}px`;
                }
            }, { signal });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = 'grab';
                    document.body.style.userSelect = '';
                }
            }, { signal });
        }

        // --- Number Hotkeys (1-9) & Shortcut Navigation ---
        document.addEventListener('keydown', (e) => {
            const isInputFocused = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

            if (!isInputFocused) {
                if (e.key >= '1' && e.key <= '9') {
                    const idx = parseInt(e.key, 10);
                    const chipBtn = form.querySelector(`.fasttag-quick-chip[data-index="${idx}"]`);
                    if (chipBtn) {
                        e.preventDefault();
                        chipBtn.click();
                    }
                } else if (e.key === '/' || e.key === 's' || e.key === 'S') {
                    const searchBox = form.querySelector('input[type="text"]');
                    if (searchBox) {
                        e.preventDefault();
                        searchBox.focus();
                        searchBox.select();
                    }
                }
            }
        }, { signal });

        // --- 8-Direction Resizing ---
        let isResizing = false;
        let resizeDir = '';
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        let startWidth = 0;
        let startHeight = 0;

        const resizeHandles = form.querySelectorAll('.popup-resize-handle');
        resizeHandles.forEach(handle => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                resizeDir = handle.getAttribute('data-dir') || '';
                startX = e.clientX;
                startY = e.clientY;
                startLeft = form.offsetLeft;
                startTop = form.offsetTop;
                startWidth = form.offsetWidth;
                startHeight = form.offsetHeight;

                document.body.style.cursor = handle.style.cursor;
                document.body.style.userSelect = 'none';
            }, { signal });
        });

        document.addEventListener('mousemove', (e) => {
            if (isResizing) {
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newLeft = startLeft;
                let newTop = startTop;

                if (resizeDir.includes('e')) {
                    newWidth = startWidth + deltaX;
                }
                if (resizeDir.includes('w')) {
                    newWidth = startWidth - deltaX;
                    newLeft = startLeft + deltaX;
                }
                if (resizeDir.includes('s')) {
                    newHeight = startHeight + deltaY;
                }
                if (resizeDir.includes('n')) {
                    newHeight = startHeight - deltaY;
                    newTop = startTop + deltaY;
                }

                // Bounds clamping
                const minW = 320;
                const maxW = Math.round(window.innerWidth * 0.9);
                const minH = 380;
                const maxH = Math.round(window.innerHeight * 0.9);

                if (newWidth < minW) {
                    if (resizeDir.includes('w')) newLeft = startLeft + (startWidth - minW);
                    newWidth = minW;
                } else if (newWidth > maxW) {
                    if (resizeDir.includes('w')) newLeft = startLeft - (maxW - startWidth);
                    newWidth = maxW;
                }

                if (newHeight < minH) {
                    if (resizeDir.includes('n')) newTop = startTop + (startHeight - minH);
                    newHeight = minH;
                } else if (newHeight > maxH) {
                    if (resizeDir.includes('n')) newTop = startTop - (maxH - startHeight);
                    newHeight = maxH;
                }

                form.style.width = `${newWidth}px`;
                form.style.height = `${newHeight}px`;
                if (resizeDir.includes('w')) form.style.left = `${newLeft}px`;
                if (resizeDir.includes('n')) form.style.top = `${newTop}px`;

                if (activeTableInstance) {
                    activeTableInstance.redraw(true);
                }
                if (typeof form._fastTagOnResize === 'function') {
                    form._fastTagOnResize();
                }
            }
        }, { signal });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                setSavedPopupSize(form.offsetWidth, form.offsetHeight);
                if (activeTableInstance) {
                    activeTableInstance.redraw(true);
                }
                if (typeof form._fastTagOnResize === 'function') {
                    form._fastTagOnResize();
                }
            }
        }, { signal });
    }

    async function openBulkEntityPopup(type, bulkScenes) {
        const config = ENTITY_CONFIG[type];
        if (!config || !Array.isArray(bulkScenes) || bulkScenes.length === 0) return;

        if (typeof Tabulator === 'undefined') {
            await ensureDependenciesLoaded();
        }

        if (typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load. Please check your internet connection.");
            return;
        }

        closeMenu();
        closePopup(false);

        popupAbortController = new AbortController();
        const { signal } = popupAbortController;

        activePopup = createPopupShell(type);
        const form = activePopup.element;

        const titleEl = form.querySelector(`#${type}-popup-title`);
        if (titleEl) {
            titleEl.textContent = `📦 Bulk Edit ${config.pluralTitle} (${bulkScenes.length} scenes)`;
        }

        const seqLabel = form.querySelector('.popup-seq-label');
        if (seqLabel) seqLabel.style.display = 'none';
        const prevBtn = form.querySelector(`#${type}-prev-btn`);
        if (prevBtn) prevBtn.style.display = 'none';
        const nextBtn = form.querySelector(`#${type}-next-btn`);
        if (nextBtn) nextBtn.style.display = 'none';

        if (activePopup.previewContainer) {
            activePopup.previewContainer.innerHTML = `
                <div style="padding: 8px 12px; background: rgba(99, 102, 241, 0.12); border: 1px dashed #6366f1; border-radius: 6px; margin-bottom: 8px; font-size: 11px; font-weight: 600; color: #818cf8; text-align: center; user-select: none;">
                    📦 Applying to <strong>${bulkScenes.length}</strong> selected scenes
                </div>
            `;
        }

        const table = new Tabulator(activePopup.tableContainer, {
            layout: "fitColumns",
            height: "100%",
            placeholder: `No ${config.pluralTitle} Found`,
            selectable: config.isSingleSelect ? 1 : true,
            index: "id",
            columnDefaults: {
                headerSort: false
            },
            columns: config.columns,
        });
        activeTableInstance = table;

        // Pre-fetch common tags/performers/studios across selected scenes
        let initialCommonIds = new Set();
        if (config.fetchExistingQuery) {
            try {
                const existingResults = await Promise.all(
                    bulkScenes.map(s => fetchGQL(config.fetchExistingQuery, { id: s.id }))
                );
                const sceneIdSets = existingResults.map(res => 
                    new Set((config.extractExisting(res?.data) || []).map(String))
                );
                if (sceneIdSets.length > 0 && sceneIdSets[0].size > 0) {
                    for (const id of sceneIdSets[0]) {
                        if (sceneIdSets.every(s => s.has(id))) {
                            initialCommonIds.add(id);
                        }
                    }
                }
            } catch (e) {
                console.error('[FastTag Bulk] Failed to pre-fetch common entities:', e);
            }
        }

        const selectedIds = new Set(initialCommonIds);
        let isRestoringSelections = false;

        const filterInput = activePopup.searchInput;
        const clearBtn = activePopup.searchClear;
        const createBtn = activePopup.createBtn;
        const refreshBtn = activePopup.refreshBtn;
        const saveBtn = activePopup.saveBtn;

        saveBtn.textContent = `Apply to ${bulkScenes.length} Scenes`;

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
        };

        const onChipSelect = () => {
            filterInput.value = '';
            updateVisibility();
            fetchData('', true);
            refreshUI();
        };

        const refreshUI = () => {
            renderQuickActions(form, type, filterInput, selectedIds, onChipSelect);
            if (saveBtn) {
                const count = selectedIds.size;
                saveBtn.textContent = count > 0 
                    ? `Apply ${count} ${count === 1 ? config.title : config.pluralTitle} to ${bulkScenes.length} Scenes`
                    : `Apply to ${bulkScenes.length} Scenes`;
            }
        };
        form._fastTagOnResize = refreshUI;

        activeTableInstance.on("rowSelected", (row) => {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.add(String(id));
                refreshUI();
            }
        });

        activeTableInstance.on("rowDeselected", (row) => {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                refreshUI();
            }
        });

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull(type);
            if (!cachedData) {
                const res = await fetchGQL(config.fetchQuery);
                cachedData = config.extractList(res.data);
                setCache(type, cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = cachedData;
            const searchFields = config.searchFields || [config.labelKey];
            if (term) {
                const tokens = term.split(/\s+/);
                data = cachedData.filter(item => {
                    const itemSearchStr = searchFields
                        .map(f => String(item[f] || '').trim().toLowerCase())
                        .filter(Boolean)
                        .join(' ');
                    return tokens.every(t => itemSearchStr.includes(t));
                });
            }

            data.sort(getSmartSortComparator(term, selectedIds, config.labelKey, searchFields));

            isRestoringSelections = true;
            try {
                await activeTableInstance.setData(data);
                selectedIds.forEach(id => {
                    const r = activeTableInstance.getRow(id);
                    if (r) activeTableInstance.selectRow(r);
                });
                refreshUI();
                if (resetScroll && data.length > 0) {
                    activeTableInstance.scrollToRow(activeTableInstance.getRows()[0], "top", false);
                }
            } finally {
                isRestoringSelections = false;
            }
        }

        let debounceTimer = null;
        filterInput.oninput = (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchData(e.target.value, true), 150);
        };

        clearBtn.onclick = () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus({ preventScroll: true });
        };

        refreshBtn.onclick = async () => {
            invalidateCache(type);
            await fetchData(filterInput.value.trim(), false);
        };

        createBtn.onclick = async () => {
            const val = filterInput.value.trim();
            if (!val) return;

            const res = await fetchGQL(config.createQuery, config.createVariables(val));
            const newId = config.createExtract(res.data);

            if (newId) {
                toastSuccess(`${config.title} created successfully`);
                invalidateCache(type);
                selectedIds.add(String(newId));
                addRecentEntry(type, { id: newId, [config.labelKey]: val });
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                refreshUI();
                filterInput.focus({ preventScroll: true });
            } else {
                toastError(`Failed to create ${config.title.toLowerCase()}`, res.errors);
            }
        };

        activePopup.cancelBtn.onclick = () => closePopup();

        saveBtn.onclick = async () => {
            const chosenIds = Array.from(selectedIds);
            if (chosenIds.length === 0 && initialCommonIds.size === 0) {
                showToast(`Please select at least one ${config.title.toLowerCase()}`, 'error');
                return;
            }

            const removedIds = new Set(Array.from(initialCommonIds).filter(id => !selectedIds.has(id)));
            const addedIds = Array.from(selectedIds).filter(id => !initialCommonIds.has(id));

            saveBtn.disabled = true;
            saveBtn.textContent = `Saving (${bulkScenes.length})...`;
            saveBtn.style.opacity = '0.7';

            let updatedCount = 0;
            for (const scene of bulkScenes) {
                let targetIds = chosenIds;
                if (!config.isSingleSelect && config.fetchExistingQuery) {
                    try {
                        const existRes = await fetchGQL(config.fetchExistingQuery, { id: scene.id });
                        const existIds = (config.extractExisting(existRes?.data) || []).map(String);
                        const filtered = existIds.filter(id => !removedIds.has(id));
                        const merged = new Set([...filtered, ...addedIds]);
                        targetIds = Array.from(merged);
                    } catch (e) {}
                }
                const success = await updateEntityForScene(type, scene.id, targetIds);
                if (success) updatedCount++;
            }

            await refreshSceneCards();
            closePopup();
            toastSuccess(`Applied ${config.title} to ${updatedCount} scenes`);
        };

        setupPopupListeners(form, signal, () => {});
        await fetchData("", true);
        positionPopupNearCard(form, bulkScenes[0].card || document.body);
    }

    async function openEntityPopup(type, sceneId, cardElement) {
        const config = ENTITY_CONFIG[type];
        if (!config) return;

        if (typeof Tabulator === 'undefined') {
            await ensureDependenciesLoaded();
        }

        if (typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load. Please check your internet connection.");
            return;
        }

        closePopup(false);

        popupAbortController = new AbortController();
        const { signal } = popupAbortController;

        activePopup = createPopupShell(type);
        const form = activePopup.element;

        const table = new Tabulator(activePopup.tableContainer, {
            layout: "fitColumns",
            height: "100%",
            placeholder: `No ${config.pluralTitle} Found`,
            selectable: true,
            index: "id",
            columnDefaults: {
                headerSort: false
            },
            columns: config.columns,
        });
        activeTableInstance = table;

        setupPopupListeners(form, signal, async () => {
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            const selectedIds = sequentialEditState.getSelectedIdsFn ? sequentialEditState.getSelectedIdsFn() : new Set();
            const success = await updateEntityForScene(type, sceneId, Array.from(selectedIds));
            if (success) {
                await refreshSceneCards();
                closePopup();
                toastSuccess('Scene updated');
            }
        });

        await loadEntityDataIntoPopup(type, sceneId, cardElement, activePopup);
        positionPopupNearCard(form, cardElement);
    }

    async function loadEntityDataIntoPopup(type, sceneId, cardElement, popup) {
        const config = ENTITY_CONFIG[type];
        const form = popup.element;
        attachScenePreview(popup.previewContainer, sceneId, cardElement);

        const existingRes = await fetchGQL(config.fetchExistingQuery, { id: sceneId });
        const existingIds = config.extractExisting(existingRes.data);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        sequentialEditState.initialSelectedIds = new Set(selectedIds);
        let isRestoringSelections = false;

        setupSequentialEditHandlers(form, type, sceneId, cardElement, () => selectedIds);

        const filterInput = popup.searchInput;
        const clearBtn = popup.searchClear;
        const createBtn = popup.createBtn;
        const refreshBtn = popup.refreshBtn;

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
        };

        let smartSuggestions = [];
        const onRecentChipSelect = async () => {
            filterInput.value = '';
            updateVisibility();
            await fetchData('', true);
            if (!sequentialEditState.enabled) {
                await saveWithoutReload(sceneId, selectedIds);
            } else {
                refreshUI();
            }
        };

        const refreshUI = () => {
            updateSequentialEditUI(form, type, selectedIds);
            renderQuickActions(form, type, filterInput, selectedIds, onRecentChipSelect);
            renderSmartSuggestions(form, type, filterInput, selectedIds, smartSuggestions, onRecentChipSelect);
        };
        form._fastTagOnResize = refreshUI;

        const saveWithoutReload = async (sId, ids) => {
            sessionStorage.setItem(scrollKey, window.scrollY);
            const success = await updateEntityForScene(type, sId, Array.from(ids));
            if (success) {
                await refreshSceneCards();
                toastSuccess(`${config.title} saved`);
            }
            return success;
        };

        activeTableInstance.on("rowSelected", (row) => {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.add(String(id));
                refreshUI();

                if (filterInput.value.trim().length > 0) {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData("", false).then(() => {
                        const r = activeTableInstance.getRow(id);
                        if (r) activeTableInstance.scrollToRow(r, "top", false);
                        filterInput.focus({ preventScroll: true });
                    });
                }
            }
        });

        activeTableInstance.on("rowDeselected", (row) => {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                refreshUI();
                if (filterInput.value.trim().length > 0) {
                    fetchData(filterInput.value.trim(), false);
                }
            }
        });

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull(type);
            if (!cachedData) {
                const res = await fetchGQL(config.fetchQuery);
                cachedData = config.extractList(res.data);
                setCache(type, cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = cachedData;
            const searchFields = config.searchFields || [config.labelKey];
            if (term) {
                const tokens = term.split(/\s+/);
                data = cachedData.filter(item => {
                    const itemSearchStr = searchFields
                        .map(f => String(item[f] || '').trim().toLowerCase())
                        .filter(Boolean)
                        .join(' ');
                    return tokens.every(t => itemSearchStr.includes(t));
                });
            }

            data.sort(getSmartSortComparator(term, selectedIds, config.labelKey, searchFields));

            isRestoringSelections = true;
            try {
                await activeTableInstance.setData(data);
                selectedIds.forEach(id => {
                    const r = activeTableInstance.getRow(id);
                    if (r) activeTableInstance.selectRow(r);
                });
                renderQuickActions(form, type, filterInput, selectedIds, onRecentChipSelect);
                updateSequentialEditUI(form, type, selectedIds);
                if (resetScroll && data.length > 0) {
                    activeTableInstance.scrollToRow(activeTableInstance.getRows()[0], "top", false);
                }
            } finally {
                isRestoringSelections = false;
            }
        }

        let debounceTimer = null;
        filterInput.oninput = (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchData(e.target.value, true), 150);
        };

        clearBtn.onclick = () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus({ preventScroll: true });
        };

        refreshBtn.onclick = async () => {
            invalidateCache(type);
            await fetchData(filterInput.value.trim(), false);
        };

        createBtn.onclick = async () => {
            const val = filterInput.value.trim();
            if (!val) return;

            const res = await fetchGQL(config.createQuery, config.createVariables(val));
            const newId = config.createExtract(res.data);

            if (newId) {
                toastSuccess(`${config.title} created successfully`);
                invalidateCache(type);
                selectedIds.add(String(newId));
                addRecentEntry(type, { id: newId, [config.labelKey]: val });
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                refreshUI();
                filterInput.focus({ preventScroll: true });
            } else {
                toastError(`Failed to create ${config.title.toLowerCase()}`, res.errors);
            }
        };

        await fetchData("", true);

        const allLoadedItems = getCachedOrNull(type) || [];
        fetchSceneSmartSuggestions(type, sceneId, allLoadedItems, selectedIds, cardElement).then(suggs => {
            smartSuggestions = suggs;
            renderSmartSuggestions(form, type, filterInput, selectedIds, smartSuggestions, onRecentChipSelect);
        });

        popup.saveBtn.onclick = async () => {
            if (sequentialEditState.enabled) {
                if (sequentialEditState.currentIndex >= sequentialEditState.allSceneCards.length - 1) {
                    await saveWithoutReload(sceneId, selectedIds);
                    closePopup();
                } else {
                    navigateToNextScene(form, type, 1, () => selectedIds);
                }
                return;
            }

            const cached = getCachedOrNull(type) || [];
            const selectedItems = Array.from(selectedIds).map(id => cached.find(entry => String(entry.id) === String(id))).filter(Boolean);
            addRecentEntriesFromSelection(type, selectedItems);

            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            const success = await saveWithoutReload(sceneId, selectedIds);
            if (success) closePopup();
        };

        popup.cancelBtn.onclick = () => closePopup();
    }

    // --- Global DOM Triggers ---
    document.addEventListener('contextmenu', function(event) {
        if (activePopup) return;
        closeMenu();
        const sceneCard = event.target.closest('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
        if (!sceneCard) return;

        const sceneId = extractSceneId(sceneCard);
        if (sceneId) {
            showCustomMenu(event, sceneId, sceneCard);
        }
    }, true);

    document.addEventListener('click', function(event) {
        if (activePopup) return;
        const sceneCard = event.target.closest('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
        if (!sceneCard) return;

        if (event.target.closest('input[type="checkbox"], .checkbox, [class*="checkbox"]')) return;
        if (event.target.closest('a[href*="/scenes/"]:not([class*="tag"]):not([class*="performer"]):not([class*="gallery"])')) return;

        const targetLink = event.target.closest('a');
        const href = targetLink ? targetLink.getAttribute('href') || '' : '';
        const badgeElement = event.target.closest('.minimal.btn, .btn-primary, .badge-button, .tag-button, .performer-button, .gallery-button, .btn[minimal], button.minimal');

        const isClickWithinButton = (element, clickEvent) => {
            if (!element) return false;
            const rect = element.getBoundingClientRect();
            return clickEvent.clientX >= rect.left && clickEvent.clientX <= rect.right &&
                   clickEvent.clientY >= rect.top && clickEvent.clientY <= rect.bottom;
        };

        if (!isClickWithinButton(badgeElement, event) && !isClickWithinButton(event.target, event)) {
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
            openEntityPopup('performers', sceneId, sceneCard);
        } else if (combinedContext.includes('/galleries/') || iconClass.includes('fa-images') || combinedContext.includes('gallery')) {
            openEntityPopup('galleries', sceneId, sceneCard);
        } else {
            openEntityPopup('tags', sceneId, sceneCard);
        }
    }, true);

    // --- Settings Injection ---
    function initSettingsPageObserver() {
        const tryInjectSettings = () => {
            if (document.querySelector('#fast-tag-plugin-settings')) return;

            const titleCandidates = document.querySelectorAll('h1, h2, h3, h4, h5, h6, .card-title, .setting-title, .plugin-title, b, strong, span');
            let fastTagHeader = null;

            for (let el of titleCandidates) {
                const text = (el.innerText || el.textContent || '').trim();
                if (text.length < 50 && (text.startsWith('FastTag') || text.startsWith('mypluginrc') || text.includes('FastTag ('))) {
                    fastTagHeader = el;
                    break;
                }
            }

            if (!fastTagHeader) return;

            const targetCard = fastTagHeader.closest('.setting-group, .card, .list-group-item, tr, .plugin-card, .row') || fastTagHeader.parentElement?.parentElement;
            if (!targetCard) return;
            if (targetCard.querySelector('#fast-tag-plugin-settings')) return;

            const settingsContainer = document.createElement('div');
            settingsContainer.id = 'fast-tag-plugin-settings';
            settingsContainer.style.cssText = 'margin-top: 14px; padding: 14px 20px 0 20px; border-top: 1px solid rgba(128,128,128,0.18); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-sizing: border-box; width: 100%;';

            const labelContainer = document.createElement('div');
            labelContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

            const title = document.createElement('div');
            title.textContent = 'Popup Theme';
            title.style.cssText = 'font-weight: 500; font-size: 14px;';

            const subtitle = document.createElement('div');
            subtitle.textContent = 'Visual appearance for tagging popups: Dark, Light, or Auto';
            subtitle.style.cssText = 'font-size: 12px; opacity: 0.75;';

            labelContainer.appendChild(title);
            labelContainer.appendChild(subtitle);

            const btnGroup = document.createElement('div');
            btnGroup.style.cssText = 'display: flex; gap: 6px; align-items: center;';

            const updateButtons = (selectedTheme) => {
                Array.from(btnGroup.children).forEach(b => {
                    const bVal = b.getAttribute('data-theme-val');
                    const isSelected = bVal === selectedTheme;
                    b.style.border = `1px solid ${isSelected ? '#6366f1' : 'rgba(128,128,128,0.3)'}`;
                    b.style.background = isSelected ? '#6366f1' : 'transparent';
                    b.style.color = isSelected ? '#ffffff' : 'inherit';
                    b.style.fontWeight = isSelected ? '600' : 'normal';
                });
            };

            const createThemeBtn = (themeVal, labelText) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = labelText;
                btn.setAttribute('data-theme-val', themeVal);
                const isInit = getThemePreference() === themeVal;
                btn.style.cssText = `padding: 5px 12px; font-size: 12px; border-radius: 6px; cursor: pointer; border: 1px solid ${isInit ? '#6366f1' : 'rgba(128,128,128,0.3)'}; background: ${isInit ? '#6366f1' : 'transparent'}; color: ${isInit ? '#ffffff' : 'inherit'}; font-weight: ${isInit ? '600' : 'normal'}; transition: all 0.15s ease;`;

                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setThemePreference(themeVal);
                    updateButtons(themeVal);
                    toastSuccess(`Theme set to ${labelText}`);
                };
                return btn;
            };

            btnGroup.appendChild(createThemeBtn('dark', '🌙 Dark'));
            btnGroup.appendChild(createThemeBtn('light', '☀️ Light'));
            btnGroup.appendChild(createThemeBtn('auto', '⚙ Auto'));

            settingsContainer.appendChild(labelContainer);
            settingsContainer.appendChild(btnGroup);
            targetCard.appendChild(settingsContainer);
        };

        tryInjectSettings();
        const observer = new MutationObserver(() => tryInjectSettings());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    initSettingsPageObserver();
})();