// ==UserScript==
// @name         Stash FastTag
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Fast scene tagging workflow for Stash: edit tags, performers, studios, and galleries from scene cards with smart suggestions, bulk tagging, and sequential navigation
// @match        http://localhost:*/*
// @match        http://127.0.0.1:*/*
// @grant        none
// @run-at       document-end
// @require      https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js
// @require      https://cdn.jsdelivr.net/npm/toastify-js
// @updateURL    https://kmarsh2311.github.io/my-stash-plugins/fasttag.js
// @downloadURL  https://kmarsh2311.github.io/my-stash-plugins/fasttag.js
// ==/UserScript==

(async function() {
    'use strict';
    console.log('[FastTag v3.4.0] Initialized with Settings, Suggestions, Pinned Chips, Bulk Mode, and Hotkeys');

    // --- Entity Configuration & Schema Registry ---
    const ENTITY_CONFIG = {
        tags: {
            title: 'Tag',
            pluralTitle: 'Tags',
            labelKey: 'name',
            searchFields: ['name', 'id'],
            columns: [
                { title: "ID", field: "id", width: 55, hozAlign: "center", headerHozAlign: "center", resizable: false, headerSort: false },
                { title: "Name", field: "name", resizable: false, headerSort: false },
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
                { title: "ID", field: "id", width: 55, hozAlign: "center", headerHozAlign: "center", resizable: false, headerSort: false },
                { title: "Name", field: "name", widthGrow: 2, resizable: true, headerSort: false },
                { title: "Details", field: "disambiguation", widthGrow: 1, resizable: false, headerSort: false },
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
                { title: "ID", field: "id", width: 55, hozAlign: "center", headerHozAlign: "center", resizable: false, headerSort: false },
                { title: "Title", field: "title", resizable: false, headerSort: false },
            ],
            fetchQuery: `query { findGalleries(filter: { per_page: -1 }) { galleries { id title folder { path } files { path } } } }`,
            extractList: data => (data?.findGalleries?.galleries || []).map(g => {
                let displayTitle = (g.title && g.title.trim()) ? g.title.trim() : '';
                if (!displayTitle) {
                    const folderPath = g.folder?.path || g.files?.[0]?.path || '';
                    if (folderPath) {
                        const parts = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
                        displayTitle = parts.length > 0 ? parts[parts.length - 1] : `Gallery #${g.id}`;
                    } else {
                        displayTitle = `Gallery #${g.id}`;
                    }
                }
                return {
                    id: g.id,
                    title: displayTitle,
                    rawTitle: g.title || ''
                };
            }),
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
                { title: "ID", field: "id", width: 55, hozAlign: "center", headerHozAlign: "center", resizable: false, headerSort: false },
                { title: "Name", field: "name", widthGrow: 2, resizable: true, headerSort: false },
                { title: "Parent Studio", field: "parent_name", widthGrow: 1, resizable: false, headerSort: false },
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
    const SHOW_IDS_STORAGE_KEY = 'stash_fast_tag_show_ids';
    const SUGGESTIONS_STORAGE_KEY = 'stash_fast_tag_enable_suggestions';
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
    const TABULATOR_JS_CDNS = [
        'https://cdn.jsdelivr.net/npm/tabulator-tables@5.5.2/dist/js/tabulator.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/tabulator/5.5.2/js/tabulator.min.js',
        'https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js'
    ];
    const TABULATOR_CSS_CDNS = [
        'https://cdn.jsdelivr.net/npm/tabulator-tables@5.5.2/dist/css/tabulator.min.css',
        'https://cdnjs.cloudflare.com/ajax/libs/tabulator/5.5.2/css/tabulator.min.css',
        'https://unpkg.com/tabulator-tables@5.5.2/dist/css/tabulator.min.css'
    ];
    const TOASTIFY_JS_CDNS = [
        'https://cdn.jsdelivr.net/npm/toastify-js',
        'https://cdnjs.cloudflare.com/ajax/libs/toastify-js/1.12.0/toastify.min.js',
        'https://unpkg.com/toastify-js'
    ];
    const TOASTIFY_CSS_CDNS = [
        'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css',
        'https://cdnjs.cloudflare.com/ajax/libs/toastify-js/1.12.0/toastify.min.css',
        'https://unpkg.com/toastify-js/src/toastify.min.css'
    ];

    let dependencyLoadPromise = null;

    function isTabulatorLoaded() {
        return typeof Tabulator !== 'undefined' || typeof window.Tabulator !== 'undefined';
    }

    function isToastifyLoaded() {
        return typeof Toastify !== 'undefined' || typeof window.Toastify !== 'undefined';
    }

    function loadScriptWithFallback(urls, id) {
        return new Promise((resolve, reject) => {
            if (document.getElementById(id) && (isTabulatorLoaded() || isToastifyLoaded())) {
                resolve();
                return;
            }
            let index = 0;
            function tryNext() {
                if (index >= urls.length) {
                    reject(new Error(`All CDN sources failed for script ${id}`));
                    return;
                }
                const src = urls[index++];
                const existing = document.getElementById(id);
                if (existing) existing.remove();

                const script = document.createElement('script');
                script.id = id;
                script.src = src;
                script.async = true;
                script.onload = () => resolve();
                script.onerror = () => {
                    console.warn(`[FastTag] Failed to load ${src}, trying fallback CDN...`);
                    tryNext();
                };
                document.head.appendChild(script);
            }
            tryNext();
        });
    }

    function loadCssWithFallback(urls, id) {
        if (document.getElementById(id)) return;
        let index = 0;
        function tryNext() {
            if (index >= urls.length) return;
            const href = urls[index++];
            const existing = document.getElementById(id);
            if (existing) existing.remove();

            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.href = href;
            link.onerror = () => tryNext();
            document.head.appendChild(link);
        }
        tryNext();
    }

    function ensureDependenciesLoaded() {
        if (isTabulatorLoaded() && isToastifyLoaded()) {
            return Promise.resolve();
        }
        if (dependencyLoadPromise) return dependencyLoadPromise;

        dependencyLoadPromise = (async () => {
            const promises = [];
            if (!isTabulatorLoaded()) {
                promises.push(loadScriptWithFallback(TABULATOR_JS_CDNS, 'tabulator-external-js'));
            }
            if (!isToastifyLoaded()) {
                promises.push(loadScriptWithFallback(TOASTIFY_JS_CDNS, 'toastify-external-js'));
            }
            loadCssWithFallback(TABULATOR_CSS_CDNS, 'tabulator-external-css');
            loadCssWithFallback(TOASTIFY_CSS_CDNS, 'toastify-external-css');

            await Promise.all(promises);
        })().catch(err => {
            console.warn('[FastTag] Dependency autoload note:', err.message);
            dependencyLoadPromise = null;
        });

        return dependencyLoadPromise;
    }

    // Auto-trigger dependency preload immediately
    ensureDependenciesLoaded();

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
            border-right: 1px solid #334155 !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col:last-child {
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
        #scenes-popup.theme-dark .tabulator .tabulator-row .tabulator-cell {
            border-right: 1px solid #1e293b !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row .tabulator-cell:last-child {
            border-right: none !important;
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
        #scenes-popup.theme-dark .tabulator-tableholder {
            scrollbar-width: thin !important;
            scrollbar-color: rgba(148, 163, 184, 0.35) transparent !important;
        }
        #scenes-popup.theme-dark .tabulator-tableholder::-webkit-scrollbar {
            width: 6px !important;
        }
        #scenes-popup.theme-dark .tabulator-tableholder::-webkit-scrollbar-track {
            background: transparent !important;
            border: none !important;
        }
        #scenes-popup.theme-dark .tabulator-tableholder::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.35) !important;
            border-radius: 999px !important;
            border: none !important;
        }
        #scenes-popup.theme-dark .tabulator-tableholder::-webkit-scrollbar-thumb:hover {
            background: rgba(148, 163, 184, 0.6) !important;
        }

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
            border-right: 1px solid #e2e8f0 !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-header .tabulator-col:last-child {
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
        #scenes-popup.theme-light .tabulator .tabulator-row .tabulator-cell {
            border-right: 1px solid #f1f5f9 !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-row .tabulator-cell:last-child {
            border-right: none !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-row:hover { background-color: #f1f5f9 !important; }
        #scenes-popup.theme-light .tabulator .tabulator-row.tabulator-selected,
        #scenes-popup.theme-light .tabulator .tabulator-row.tabulator-selected:hover {
            background-color: #e0e7ff !important;
            color: #1e293b !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-placeholder { color: #94a3b8 !important; }
        #scenes-popup.theme-light .tabulator-tableholder {
            scrollbar-width: thin !important;
            scrollbar-color: rgba(100, 116, 139, 0.3) transparent !important;
        }
        #scenes-popup.theme-light .tabulator-tableholder::-webkit-scrollbar {
            width: 6px !important;
        }
        #scenes-popup.theme-light .tabulator-tableholder::-webkit-scrollbar-track {
            background: transparent !important;
            border: none !important;
        }
        #scenes-popup.theme-light .tabulator-tableholder::-webkit-scrollbar-thumb {
            background: rgba(100, 116, 139, 0.3) !important;
            border-radius: 999px !important;
            border: none !important;
        }
        #scenes-popup.theme-light .tabulator-tableholder::-webkit-scrollbar-thumb:hover {
            background: rgba(100, 116, 139, 0.5) !important;
        }
        #scenes-popup .tabulator-tableholder { overflow-x: hidden !important; }
        #scenes-popup .tabulator .tabulator-table { width: 100% !important; min-width: 100% !important; box-sizing: border-box !important; }
        #scenes-popup .tabulator .tabulator-row {
            width: 100% !important;
            min-width: 100% !important;
            display: flex !important;
            box-sizing: border-box !important;
            height: 26px !important;
            min-height: 26px !important;
            max-height: 26px !important;
            line-height: 20px !important;
            border-top: none !important;
        }
        #scenes-popup .tabulator .tabulator-cell {
            box-sizing: border-box !important;
            height: 26px !important;
            min-height: 26px !important;
            max-height: 26px !important;
            padding: 2px 6px !important;
            display: flex !important;
            align-items: center !important;
            border-top: none !important;
        }
        #scenes-popup .tabulator .tabulator-row .tabulator-cell:last-child { flex: 1 1 0px !important; width: auto !important; }
        #scenes-popup .tabulator .tabulator-header .tabulator-header-contents { width: 100% !important; min-width: 100% !important; }
        #scenes-popup .tabulator .tabulator-header .tabulator-headers { width: 100% !important; min-width: 100% !important; display: flex !important; }
        #scenes-popup .tabulator .tabulator-header .tabulator-col {
            box-sizing: border-box !important;
            height: 26px !important;
            min-height: 26px !important;
            max-height: 26px !important;
        }
        #scenes-popup .tabulator .tabulator-header .tabulator-col:last-child { flex: 1 1 0px !important; width: auto !important; }

        /* Hide ugly native horizontal scrollbars cleanly across all chip rows */
        #everything-recent-studios, #everything-tags-chips, #everything-performers-chips, #everything-suggestions-chips,
        [id*="-chips"], [id*="-chips-container"], [id*="-recent-"], .fasttag-chip-row {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }
        #everything-recent-studios::-webkit-scrollbar,
        #everything-tags-chips::-webkit-scrollbar,
        #everything-performers-chips::-webkit-scrollbar,
        #everything-suggestions-chips::-webkit-scrollbar,
        [id*="-chips"]::-webkit-scrollbar,
        [id*="-chips-container"]::-webkit-scrollbar,
        [id*="-recent-"]::-webkit-scrollbar,
        .fasttag-chip-row::-webkit-scrollbar {
            display: none !important;
        }

        /* Instant custom micro-tooltips */
        .fasttag-tooltip {
            position: relative;
            display: inline-flex;
            align-items: center;
            cursor: pointer;
        }
        .fasttag-tooltip::after {
            content: attr(data-tooltip);
            position: absolute;
            bottom: calc(100% + 5px);
            left: 0;
            transform: translateY(2px);
            background: #0f172a;
            color: #f8fafc;
            font-size: 10.5px;
            font-weight: 600;
            padding: 3px 7px;
            border-radius: 5px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.12s ease, transform 0.12s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(148, 163, 184, 0.3);
            z-index: 10000;
        }
        .fasttag-tooltip:hover::after {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        #everything-recent-studios::-webkit-scrollbar,
        #everything-tags-chips::-webkit-scrollbar,
        #everything-performers-chips::-webkit-scrollbar,
        #everything-suggestions-chips::-webkit-scrollbar,
        [id*="-chips"]::-webkit-scrollbar,
        [id*="-chips-container"]::-webkit-scrollbar,
        [id*="-recent-"]::-webkit-scrollbar,
        .fasttag-chip-row::-webkit-scrollbar {
            width: 0 !important;
            height: 0 !important;
        }
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

    function getShowIdColumns() {
        const val = localStorage.getItem(SHOW_IDS_STORAGE_KEY);
        return val === null ? true : val === 'true'; // Default true (ON)
    }

    function setShowIdColumns(enabled) {
        localStorage.setItem(SHOW_IDS_STORAGE_KEY, enabled ? 'true' : 'false');
    }

    function getEnableSuggestions() {
        const val = localStorage.getItem(SUGGESTIONS_STORAGE_KEY);
        return val === null ? true : val === 'true'; // Default true (ON)
    }

    function setEnableSuggestions(enabled) {
        localStorage.setItem(SUGGESTIONS_STORAGE_KEY, enabled ? 'true' : 'false');
    }

    function openSettingsModal() {
        const existing = document.getElementById('fasttag-settings-modal');
        if (existing) existing.remove();

        const theme = getEffectiveTheme();
        const currentPref = getThemePreference();
        const showIds = getShowIdColumns();
        const enableSug = getEnableSuggestions();

        const modal = document.createElement('div');
        modal.id = 'fasttag-settings-modal';
        modal.className = `theme-${theme}`;
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            z-index: 10000000;
            background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(3px);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fasttagFadeIn 0.15s ease-out;
        `;

        const isDark = theme === 'dark';
        const bg = isDark ? '#1e293b' : '#ffffff';
        const text = isDark ? '#f8fafc' : '#0f172a';
        const textMuted = isDark ? '#94a3b8' : '#64748b';
        const border = isDark ? '#334155' : '#e2e8f0';
        const cardBg = isDark ? '#0f172a' : '#f8fafc';

        modal.innerHTML = `
            <div style="background: ${bg}; color: ${text}; border: 1px solid ${border}; border-radius: 12px; width: 440px; max-width: 90vw; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); overflow: hidden; font-family: inherit;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid ${border}; background: ${cardBg};">
                    <div style="font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px;">
                        <span>⚙️</span> FastTag Settings
                    </div>
                    <button id="fasttag-settings-close" style="background: none; border: none; font-size: 18px; color: ${textMuted}; cursor: pointer; line-height: 1; padding: 4px;">✕</button>
                </div>
                <div style="padding: 18px; display: flex; flex-direction: column; gap: 16px;">
                    <!-- Theme setting -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                        <div>
                            <div style="font-weight: 600; font-size: 13px;">Theme</div>
                            <div style="font-size: 11px; color: ${textMuted};">Choose popup visual theme</div>
                        </div>
                        <select id="fasttag-setting-theme" style="padding: 6px 10px; border-radius: 6px; border: 1px solid ${border}; background: ${cardBg}; color: ${text}; font-size: 12px; cursor: pointer;">
                            <option value="dark" ${currentPref === 'dark' ? 'selected' : ''}>Dark</option>
                            <option value="light" ${currentPref === 'light' ? 'selected' : ''}>Light</option>
                            <option value="auto" ${currentPref === 'auto' ? 'selected' : ''}>Auto (Match Stash)</option>
                        </select>
                    </div>

                    <div style="height: 1px; background: ${border};"></div>

                    <!-- Show ID Column setting -->
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 13px;">Show ID Column</div>
                            <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Display numeric database ID column in Tag, Performer, Studio, and Gallery popups. (When unchecked, Name and Title expand to 100% width)</div>
                        </div>
                        <input type="checkbox" id="fasttag-setting-show-ids" ${showIds ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                    </div>

                    <div style="height: 1px; background: ${border};"></div>

                    <!-- Smart Suggestions setting -->
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 13px;">Smart Suggestions</div>
                            <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically detect and suggest matching Performers, Tags, and Studios from filenames and titles.</div>
                        </div>
                        <input type="checkbox" id="fasttag-setting-suggestions" ${enableSug ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                    </div>
                </div>
                <div style="padding: 12px 18px; background: ${cardBg}; border-top: 1px solid ${border}; display: flex; justify-content: flex-end;">
                    <button id="fasttag-settings-done" style="background: #6366f1; color: white; border: none; padding: 7px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">Done</button>
                </div>
            </div>
        `;

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.id === 'fasttag-settings-close' || e.target.id === 'fasttag-settings-done') {
                modal.remove();
            }
        });

        const themeSelect = modal.querySelector('#fasttag-setting-theme');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                setThemePreference(e.target.value);
                modal.className = `theme-${getEffectiveTheme()}`;
                showToast(`Theme set to ${e.target.value}`, 'info');
            });
        }

        const idToggle = modal.querySelector('#fasttag-setting-show-ids');
        if (idToggle) {
            idToggle.addEventListener('change', (e) => {
                setShowIdColumns(e.target.checked);
                showToast(`ID column ${e.target.checked ? 'enabled' : 'hidden'}`, 'success');
            });
        }

        const sugToggle = modal.querySelector('#fasttag-setting-suggestions');
        if (sugToggle) {
            sugToggle.addEventListener('change', (e) => {
                setEnableSuggestions(e.target.checked);
                showToast(`Suggestions ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        document.body.appendChild(modal);
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
        const navGroup = form.querySelector(`#${type}-nav-group`);

        if (!sequentialEditState.enabled) {
            if (navGroup) {
                navGroup.style.maxWidth = '0';
                navGroup.style.opacity = '0';
            }
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

        if (navGroup) {
            navGroup.style.maxWidth = '60px';
            navGroup.style.opacity = '1';
        }
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
        createMenuItem('⚡ Edit Everything...', () => openEditEverythingPopup(sceneId, cardElement));

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

        createMenuItem('⚙️ FastTag Settings...', () => openSettingsModal());

        const hr = document.createElement('div');
        hr.style.height = '1px';
        hr.style.background = '#e2e8f0';
        hr.style.margin = '4px 0';
        menu.appendChild(hr);

        const supportLink = document.createElement('a');
        supportLink.href = 'https://buymeacoffee.com/kamarsh';
        supportLink.textContent = 'Buy me a KitKat 🍫';
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

    function getSavedPopupSize(type = 'single') {
        try {
            const key = type === 'everything' ? 'stash_fast_tag_popup_size_everything' : 'stash_fast_tag_popup_size_single';
            const val = localStorage.getItem(key) || (type !== 'everything' ? localStorage.getItem('stash_fast_tag_popup_size') : null);
            return val ? JSON.parse(val) : null;
        } catch (e) { return null; }
    }
    function setSavedPopupSize(width, height, type = 'single') {
        try {
            const key = type === 'everything' ? 'stash_fast_tag_popup_size_everything' : 'stash_fast_tag_popup_size_single';
            localStorage.setItem(key, JSON.stringify({ width: Math.round(width), height: Math.round(height) }));
        } catch (e) {}
    }

    function getColumnsWithSavedWidths(type, scope = 'single') {
        let baseCols = (ENTITY_CONFIG[type]?.columns || []).map(c => ({ ...c }));
        if (!getShowIdColumns()) {
            baseCols = baseCols.filter(c => c.field !== 'id');
        }
        return baseCols.map((c, idx) => {
            if (idx === baseCols.length - 1) {
                return { ...c, width: undefined, widthGrow: c.widthGrow || 1 };
            }
            try {
                const saved = localStorage.getItem(`fasttag_col_width_${scope}_${type}_${c.field}`);
                if (saved) {
                    const w = parseInt(saved, 10);
                    if (!isNaN(w) && w >= 35) {
                        return { ...c, width: w, widthGrow: undefined };
                    }
                }
            } catch (e) {}
            return c;
        });
    }

    function attachColumnWidthSaver(table, type, scope = 'single') {
        if (!table || typeof table.on !== 'function') return;
        table.on("columnResized", function(col) {
            try {
                const field = col.getField();
                const width = col.getWidth();
                if (field && width && width >= 35) {
                    localStorage.setItem(`fasttag_col_width_${scope}_${type}_${field}`, String(Math.round(width)));
                }
            } catch (e) {}
        });
    }

    // --- Smart Suggestions Engine ---
    async function fetchSceneSmartSuggestions(type, sceneId, allAvailableItems, existingIds, cardElement) {
        if (!getEnableSuggestions() || !sceneId || !allAvailableItems || !allAvailableItems.length) return [];
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
        const savedSize = getSavedPopupSize('single');
        const form = document.createElement('form');
        form.id = 'scenes-popup';
        form.setAttribute('data-popup-type', 'single');
        form.className = `theme-${theme}`;
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'absolute';
        form.style.zIndex = '1000000';
        form.style.padding = '14px';
        form.style.borderRadius = '10px';
        const maxScreenW = Math.max(320, window.innerWidth - 16);
        const maxScreenH = Math.max(380, window.innerHeight - 16);
        const rawW = savedSize?.width && savedSize.width >= 320 ? savedSize.width : 340;
        const rawH = savedSize?.height && savedSize.height >= 380 ? savedSize.height : 580;
        form.style.width = `${Math.min(rawW, maxScreenW)}px`;
        form.style.height = `${Math.min(rawH, maxScreenH)}px`;
        form.style.minWidth = '320px';
        form.style.maxWidth = 'calc(100vw - 16px)';
        form.style.minHeight = '380px';
        form.style.maxHeight = 'calc(100vh - 16px)';
        form.style.boxSizing = 'border-box';
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        form.innerHTML = `
            <div id="${type}-popup-header" class="popup-header" style="margin: 0 0 13px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: grab; user-select: none; flex-shrink: 0; min-height: 24px;">
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
        const minTop = window.scrollY + 8;
        const minLeft = window.scrollX + 8;

        const clampPos = (x, y) => {
            const formW = form.offsetWidth || 400;
            const formH = form.offsetHeight || 500;
            const maxAllowedTop = Math.max(minTop, window.scrollY + window.innerHeight - formH - 8);
            const maxAllowedLeft = Math.max(minLeft, window.scrollX + window.innerWidth - formW - 8);
            return {
                x: Math.max(minLeft, Math.min(maxAllowedLeft, x)),
                y: Math.max(minTop, Math.min(maxAllowedTop, y))
            };
        };

        if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0) {
            const pos = clampPos(sequentialEditState.popupPosition.left, sequentialEditState.popupPosition.top);
            form.style.left = `${pos.x}px`;
            form.style.top = `${pos.y}px`;

            requestAnimationFrame(() => form.classList.add('popup-visible'));
            const firstInput = form.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
            return;
        }

        const cardRect = cardElement.getBoundingClientRect();
        let popupX = cardRect.right + window.scrollX + 10;
        let popupY = Math.max(minTop, cardRect.top + window.scrollY);

        form.style.left = `${popupX}px`;
        form.style.top = `${popupY}px`;

        requestAnimationFrame(() => {
            const formRect = form.getBoundingClientRect();
            if (cardRect.right + 10 + formRect.width > window.innerWidth) {
                popupX = cardRect.left + window.scrollX - formRect.width - 10;
            }
            if (cardRect.top + formRect.height > window.innerHeight) {
                popupY = (window.innerHeight + window.scrollY) - formRect.height - 8;
            }
            const pos = clampPos(popupX, popupY);

            form.style.left = `${pos.x}px`;
            form.style.top = `${pos.y}px`;

            form.classList.add('popup-visible');

            if (typeof form._fastTagOnResize === 'function') {
                form._fastTagOnResize();
            }

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
                    const saveBtn = form.querySelector('button[id$="-save-btn"]');
                    if (saveBtn) {
                        saveBtn.click();
                    } else if (onSaveCallback) {
                        onSaveCallback();
                    }
                }
            } else if (sequentialEditState.enabled && e.altKey) {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    const nextBtn = form.querySelector('button[id$="-next-btn"]');
                    if (nextBtn && !nextBtn.disabled) nextBtn.click();
                } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const prevBtn = form.querySelector('button[id$="-prev-btn"]');
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
                    let targetX = e.clientX - dragOffsetX;
                    let targetY = e.clientY - dragOffsetY;

                    // Strictly clamp to viewport bounds so the popup stays 100% inside visible screen
                    const minTop = window.scrollY + 8;
                    const maxTop = Math.max(minTop, window.scrollY + window.innerHeight - form.offsetHeight - 8);
                    const minLeft = window.scrollX + 8;
                    const maxLeft = Math.max(minLeft, window.scrollX + window.innerWidth - form.offsetWidth - 8);

                    targetY = Math.max(minTop, Math.min(maxTop, targetY));
                    targetX = Math.max(minLeft, Math.min(maxLeft, targetX));

                    form.style.left = `${targetX}px`;
                    form.style.top = `${targetY}px`;
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
                const maxW = Math.max(minW, window.innerWidth - 16);
                const minH = 380;
                const maxH = Math.max(minH, window.innerHeight - 16);
                const minTop = window.scrollY + 8;
                const maxBottom = window.scrollY + window.innerHeight - 8;
                const minLeft = window.scrollX + 8;
                const maxRight = window.scrollX + window.innerWidth - 8;

                if (newTop < minTop) {
                    if (resizeDir.includes('n')) {
                        newHeight = startHeight - (minTop - startTop);
                        newTop = minTop;
                    }
                }
                if (newLeft < minLeft) {
                    if (resizeDir.includes('w')) {
                        newWidth = startWidth - (minLeft - startLeft);
                        newLeft = minLeft;
                    }
                }

                // South clamping (bottom of screen >= 8px)
                if (resizeDir.includes('s')) {
                    if (startTop + newHeight > maxBottom) {
                        newHeight = Math.max(minH, maxBottom - startTop);
                    }
                }

                // East clamping (right of screen >= 8px)
                if (resizeDir.includes('e')) {
                    if (startLeft + newWidth > maxRight) {
                        newWidth = Math.max(minW, maxRight - startLeft);
                    }
                }

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
                const popupType = form.getAttribute('data-popup-type') || (form.querySelector('#everything-columns-container') ? 'everything' : 'single');
                setSavedPopupSize(form.offsetWidth, form.offsetHeight, popupType);
                if (activeTableInstance) {
                    activeTableInstance.redraw(true);
                }
                if (typeof form._fastTagOnResize === 'function') {
                    form._fastTagOnResize();
                }
            }
        }, { signal });
    }

    function syncSuggestionsAlignment(form) {
        if (!form) return;
        const leftCol = form.querySelector('#everything-col-tags');
        const rightCol = form.querySelector('#everything-col-performers');
        const tagsSuggBox = form.querySelector('#everything-sugg-tags-box');
        const perfSuggBox = form.querySelector('#everything-sugg-performers-box');
        const spacer = form.querySelector('#everything-sugg-spacer');
        if (!leftCol || !rightCol || !tagsSuggBox || !perfSuggBox) return;

        const leftW = leftCol.offsetWidth;
        const rightW = rightCol.offsetWidth;

        tagsSuggBox.style.flex = 'none';
        tagsSuggBox.style.width = `${leftW}px`;
        if (spacer) {
            spacer.style.display = 'block';
            spacer.style.width = '1px';
        }
        perfSuggBox.style.flex = 'none';
        perfSuggBox.style.width = `${rightW}px`;
    }

    function makeColumnResizable(container, leftCol, rightCol, splitter, onResize, signal) {
        if (!container || !leftCol || !rightCol || !splitter) return;

        const STORAGE_KEY = 'fasttag_everything_col_split';
        let currentRatio = 0.5;

        try {
            const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
            if (!isNaN(saved) && saved >= 0.18 && saved <= 0.82) {
                currentRatio = saved;
            }
        } catch (e) {}

        const applyRatio = (ratio) => {
            const clamped = Math.max(0.18, Math.min(0.82, ratio));
            currentRatio = clamped;
            leftCol.style.flex = `${clamped} 1 0px`;
            leftCol.style.width = 'auto';
            leftCol.style.minWidth = '140px';
            rightCol.style.flex = `${1 - clamped} 1 0px`;
            rightCol.style.width = 'auto';
            rightCol.style.minWidth = '140px';

            const form = container.closest('form');
            if (form) {
                syncSuggestionsAlignment(form);
            }
            if (onResize) onResize();
        };

        applyRatio(currentRatio);

        if (window.ResizeObserver) {
            const ro = new ResizeObserver(() => {
                const form = container.closest('form');
                if (form) syncSuggestionsAlignment(form);
                if (onResize) onResize();
            });
            ro.observe(container);
            if (signal) {
                signal.addEventListener('abort', () => ro.disconnect());
            }
        }

        const normalColor = getEffectiveTheme() === 'dark' ? 'rgba(148, 163, 184, 0.18)' : '#cbd5e1';
        splitter.addEventListener('mouseenter', () => {
            splitter.style.background = '#6366f1';
        });
        splitter.addEventListener('mouseleave', () => {
            if (!isDragging) {
                splitter.style.background = normalColor;
            }
        });

        // Double-click to reset 50/50
        splitter.addEventListener('dblclick', (e) => {
            e.preventDefault();
            applyRatio(0.5);
            try { localStorage.setItem(STORAGE_KEY, '0.5'); } catch (e) {}
        });

        let isDragging = false;
        let startX = 0;
        let startLeftW = 0;
        let totalW = 0;

        splitter.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            const containerRect = container.getBoundingClientRect();
            const leftRect = leftCol.getBoundingClientRect();
            totalW = containerRect.width - splitter.offsetWidth;
            startLeftW = leftRect.width;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            splitter.style.background = '#6366f1';

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                const dx = moveEvent.clientX - startX;
                const newLeftW = startLeftW + dx;
                const newRatio = newLeftW / totalW;
                applyRatio(newRatio);
            };

            const onMouseUp = () => {
                if (!isDragging) return;
                isDragging = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                splitter.style.background = normalColor;
                window.removeEventListener('mousemove', onMouseMove);
                window.removeEventListener('mouseup', onMouseUp);

                // Save ratio
                try {
                    const finalLeftRect = leftCol.getBoundingClientRect();
                    const finalRatio = finalLeftRect.width / totalW;
                    const clamped = Math.max(0.18, Math.min(0.82, finalRatio));
                    localStorage.setItem(STORAGE_KEY, String(clamped));
                } catch (e) {}
            };

            window.addEventListener('mousemove', onMouseMove, { signal });
            window.addEventListener('mouseup', onMouseUp, { signal });
        });
    }

    async function openBulkEntityPopup(type, bulkScenes) {
        const config = ENTITY_CONFIG[type];
        if (!config || !Array.isArray(bulkScenes) || bulkScenes.length === 0) return;

        if (!isTabulatorLoaded()) {
            await ensureDependenciesLoaded();
        }

        if (!isTabulatorLoaded()) {
            toastError("Tabulator library failed to load. Please check your internet connection or adblocker.");
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
            columnResizeMode: "fit",
            height: "100%",
            placeholder: `No ${config.pluralTitle} Found`,
            selectable: config.isSingleSelect ? 1 : true,
            index: "id",
            columnDefaults: {
                headerSort: false
            },
            columns: getColumnsWithSavedWidths(type, 'bulk'),
        });
        attachColumnWidthSaver(table, type, 'bulk');
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

    // --- Edit Everything (Tags + Performers + Studios) ---
    function createEditEverythingPopupShell() {
        const theme = getEffectiveTheme();
        const isDark = theme === 'dark';
        const colBg = isDark ? 'rgba(15, 23, 42, 0.25)' : '#f8fafc';
        const colBorder = isDark ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid #cbd5e1';
        const badgeColor = isDark ? '#94a3b8' : '#64748b';
        const studioBarBg = isDark ? 'rgba(15, 23, 42, 0.35)' : '#f8fafc';
        const studioBarBorder = isDark ? '1px solid rgba(148, 163, 184, 0.18)' : '1px solid #cbd5e1';

        const searchConsoleBg = isDark ? 'rgba(15, 23, 42, 0.65)' : '#ffffff';
        const searchConsoleBorder = isDark ? '1px solid rgba(148, 163, 184, 0.25)' : '1px solid #cbd5e1';
        const kbdBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
        const kbdBorder = isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)';

        const savedSize = getSavedPopupSize('everything');
        const form = document.createElement('form');
        form.id = 'scenes-popup';
        form.setAttribute('data-popup-type', 'everything');
        form.className = `theme-${theme}`;
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'absolute';
        form.style.zIndex = '1000000';
        form.style.padding = '14px';
        form.style.borderRadius = '10px';
        const maxScreenW = Math.max(320, window.innerWidth - 16);
        const maxScreenH = Math.max(380, window.innerHeight - 16);
        const defaultW = Math.min(Math.round(window.innerWidth * 0.9), 800);
        const defaultH = Math.min(Math.round(window.innerHeight * 0.9), 680);
        const rawW = savedSize?.width && savedSize.width >= 320 ? savedSize.width : defaultW;
        const rawH = savedSize?.height && savedSize.height >= 380 ? savedSize.height : defaultH;
        form.style.width = `${Math.min(rawW, maxScreenW)}px`;
        form.style.height = `${Math.min(rawH, maxScreenH)}px`;
        form.style.minWidth = '320px';
        form.style.maxWidth = 'calc(100vw - 16px)';
        form.style.minHeight = '380px';
        form.style.maxHeight = 'calc(100vh - 16px)';
        form.style.boxSizing = 'border-box';
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.overflow = 'hidden';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        form.innerHTML = `
            <div id="everything-popup-header" class="popup-header" style="margin: 0 0 10px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: grab; user-select: none; flex-shrink: 0; min-height: 24px;">
                <div style="display: inline-flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                    <span id="everything-popup-title" class="popup-title" style="font-size: 13px; font-weight: 600; line-height: 1.2; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: grab; display: inline-flex; align-items: center;">⚡ Edit Scene (Tags + Performers + Studio)</span>
                </div>
                <div style="display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; cursor: default;">
                    <label class="popup-seq-label" style="font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; user-select: none; margin: 0; line-height: 1;">
                        <input type="checkbox" id="everything-sequential-mode" style="cursor: pointer; margin: 0; width: 13px; height: 13px; accent-color: #6366f1; vertical-align: middle;">
                        Sequential
                    </label>
                    <div id="everything-nav-group" style="display: inline-flex; align-items: center; gap: 4px; overflow: hidden; max-width: 0; opacity: 0; transition: max-width 0.22s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.18s ease; vertical-align: middle;">
                        <button type="button" id="everything-prev-btn" class="popup-nav-btn" title="Previous scene (Alt+Left)" style="padding: 2px 7px; height: 22px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; box-sizing: border-box;">◄</button>
                        <button type="button" id="everything-next-btn" class="popup-nav-btn" title="Next scene (Alt+Right)" style="padding: 2px 7px; height: 22px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; line-height: 1; box-sizing: border-box;">►</button>
                    </div>
                </div>
            </div>
            <div id="everything-preview-container" style="flex-shrink: 0;"></div>

            <!-- Dedicated Studio Selector Bar (Unified Indigo/Slate Theme) -->
            <div id="everything-studio-bar" style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; padding: 4px 8px; background: ${studioBarBg}; border: ${studioBarBorder}; border-radius: 6px; flex-shrink: 0; font-size: 11.5px; overflow: hidden;">
                <span style="font-weight: 700; color: ${isDark ? '#a5b4fc' : '#4f46e5'}; white-space: nowrap; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; flex-shrink: 0;">🏢 Studio:</span>
                <div id="everything-selected-studio-chip" style="display: none; align-items: center; gap: 5px; background: ${isDark ? '#312e81' : '#e0e7ff'}; color: ${isDark ? '#ffffff' : '#312e81'}; border: 1px solid ${isDark ? '#4338ca' : '#a5b4fc'}; font-weight: 700; padding: 2px 9px; border-radius: 999px; font-size: 11px; white-space: nowrap; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.15);">
                    <span style="font-weight: 800; font-size: 11.5px; opacity: 0.95;">✓</span>
                    <span id="everything-selected-studio-name"></span>
                    <button type="button" id="everything-clear-studio-btn" style="background: none; border: none; cursor: pointer; color: ${isDark ? '#ffffff' : '#312e81'}; font-weight: 700; font-size: 14px; padding: 0 0 0 4px; line-height: 1; opacity: 0.85; transition: opacity 0.15s ease;" title="Remove Studio">&times;</button>
                </div>
                <div id="everything-recent-studios" style="display: flex; gap: 4px; overflow-x: auto; flex: 1; align-items: center; padding: 1px 0;"></div>
            </div>

            <!-- Option 1A: Clean Full-Width Command Center Search Bar -->
            <div id="everything-search-console" style="display: flex; gap: 6px; margin-bottom: 6px; align-items: center; flex-shrink: 0; background: ${searchConsoleBg}; border: ${searchConsoleBorder}; border-radius: 8px; padding: 3px 6px; box-sizing: border-box; transition: border-color 0.15s ease, box-shadow 0.15s ease;">
                <div style="position: relative; flex: 1; display: flex; align-items: center; min-width: 0;">
                    <span style="position: absolute; left: 8px; font-size: 13px; opacity: 0.6; pointer-events: none; user-select: none;">🔍</span>
                    <input type="text" id="everything-global-search" class="popup-search-input" autocomplete="off" spellcheck="false" placeholder="Search tags, performers & studios..." style="width: 100%; padding: 5px 28px 5px 28px; box-sizing: border-box; border-radius: 6px; font-size: 12px; outline: none; border: none; background: transparent; color: inherit; font-family: inherit;">
                    <span id="everything-kbd-shortcut" style="position: absolute; right: 8px; font-size: 10px; font-weight: 700; opacity: 0.5; background: ${kbdBg}; padding: 1px 5px; border-radius: 4px; border: ${kbdBorder}; pointer-events: none; user-select: none;">/</span>
                    <span id="everything-global-clear" class="popup-search-clear" style="position: absolute; right: 8px; cursor: pointer; font-size: 15px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="everything-refresh-btn" class="popup-refresh-btn" title="Refresh all caches" style="padding: 5px 9px; cursor: pointer; font-size: 12px; font-weight: 500; border-radius: 6px; white-space: nowrap; line-height: 1; flex-shrink: 0;">↻</button>
            </div>

            <!-- Dual-Column Suggestions Bar (Single Compact Row, Always Visible) -->
            <div id="everything-suggestions-container" style="display: flex; align-items: center; margin-bottom: 6px; flex-shrink: 0; width: 100%; box-sizing: border-box;">
                <!-- Tag Suggestions (Above Tags Column) -->
                <div id="everything-sugg-tags-box" style="box-sizing: border-box; display: flex; align-items: center; gap: 4px; background: ${isDark ? 'rgba(99, 102, 241, 0.08)' : '#eef2ff'}; border: 1px dashed ${isDark ? 'rgba(129, 140, 248, 0.35)' : 'rgba(99, 102, 241, 0.4)'}; border-radius: 6px; padding: 2px 6px; overflow: visible; height: 26px;">
                    <span class="fasttag-tooltip" data-tooltip="Suggested Tags" style="font-size: 11px; user-select: none; flex-shrink: 0; line-height: 1; margin-right: 2px;">💡</span>
                    <div id="everything-sugg-tags-chips" style="display: flex; align-items: center; gap: 4px; overflow-x: auto; flex: 1; min-width: 0; padding: 1px 0;">
                        <span class="fasttag-sugg-empty" style="font-size: 10px; font-weight: 500; opacity: 0.45; font-style: italic; color: #818cf8; user-select: none; line-height: 1;">None</span>
                    </div>
                </div>

                <!-- 1px invisible spacer matching column splitter -->
                <div id="everything-sugg-spacer" style="width: 1px; flex-shrink: 0; display: block;"></div>

                <!-- Performer Suggestions (Above Performers Column) -->
                <div id="everything-sugg-performers-box" style="box-sizing: border-box; display: flex; align-items: center; gap: 4px; background: ${isDark ? 'rgba(14, 165, 233, 0.08)' : '#f0f9ff'}; border: 1px dashed ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(14, 165, 233, 0.4)'}; border-radius: 6px; padding: 2px 6px; overflow: visible; height: 26px;">
                    <span class="fasttag-tooltip" data-tooltip="Suggested Performers" style="font-size: 11px; user-select: none; flex-shrink: 0; line-height: 1; margin-right: 2px;">💡</span>
                    <div id="everything-sugg-performers-chips" style="display: flex; align-items: center; gap: 4px; overflow-x: auto; flex: 1; min-width: 0; padding: 1px 0;">
                        <span class="fasttag-sugg-empty" style="font-size: 10px; font-weight: 500; opacity: 0.45; font-style: italic; color: #38bdf8; user-select: none; line-height: 1;">None</span>
                    </div>
                </div>
            </div>

            <!-- Unified 2-Column Card with Single Center Divider Line -->
            <div id="everything-columns-container" style="display: flex; flex: 1 1 auto; min-height: 100px; box-sizing: border-box; overflow: hidden; margin-bottom: 6px; background: ${colBg}; border: ${colBorder}; border-radius: 8px;">
                <!-- Column 1: Tags (Left) -->
                <div id="everything-col-tags" style="flex: 1 1 0px; min-width: 140px; display: flex; flex-direction: column; padding: 6px; box-sizing: border-box; overflow: hidden;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-shrink: 0;">
                        <span style="font-size: 11px; font-weight: 700; color: #818cf8; text-transform: uppercase; letter-spacing: 0.5px;">🏷️ Tags</span>
                        <span id="everything-tags-badge" style="font-size: 10.5px; font-weight: 600; color: ${badgeColor};">0 selected</span>
                    </div>
                    <div id="everything-tags-chips" style="display: none; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; flex-shrink: 0;"></div>
                    <div id="everything-tags-table" style="width: 100%; flex: 1 1 auto; min-height: 80px; box-sizing: border-box; overflow: hidden;"></div>
                </div>

                <!-- Clean Single 1px Vertical Divider / Resizer with invisible wide hit-area -->
                <div id="everything-col-resizer" style="width: 1px; background: ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#cbd5e1'}; cursor: col-resize; position: relative; user-select: none; flex-shrink: 0; z-index: 5; transition: background 0.15s ease;">
                    <div style="position: absolute; top: 0; bottom: 0; left: -5px; right: -5px; cursor: col-resize;"></div>
                </div>

                <!-- Column 2: Performers (Right) -->
                <div id="everything-col-performers" style="flex: 1 1 0px; min-width: 140px; display: flex; flex-direction: column; padding: 6px; box-sizing: border-box; overflow: hidden;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-shrink: 0;">
                        <span style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">⭐ Performers</span>
                        <span id="everything-performers-badge" style="font-size: 10.5px; font-weight: 600; color: ${badgeColor};">0 selected</span>
                    </div>
                    <div id="everything-performers-chips" style="display: none; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; flex-shrink: 0;"></div>
                    <div id="everything-performers-table" style="width: 100%; flex: 1 1 auto; min-height: 80px; box-sizing: border-box; overflow: hidden;"></div>
                </div>
            </div>

            <div style="display: flex; gap: 6px; flex-shrink: 0;">
                <button type="button" id="everything-save-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 11.5px; font-weight: 600; background: #6366f1; color: white; border: none; border-radius: 6px; transition: background 0.15s ease;">Save Scene</button>
                <button type="button" id="everything-cancel-btn" class="popup-cancel-btn" style="padding: 7px 12px; cursor: pointer; font-size: 11.5px; font-weight: 500; border-radius: 6px;">Close</button>
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
            header: form.querySelector('#everything-popup-header'),
            titleSpan: form.querySelector('#everything-popup-title'),
            sequentialCheckbox: form.querySelector('#everything-sequential-mode'),
            navGroup: form.querySelector('#everything-nav-group'),
            prevBtn: form.querySelector('#everything-prev-btn'),
            nextBtn: form.querySelector('#everything-next-btn'),
            previewContainer: form.querySelector('#everything-preview-container'),
            studioBar: {
                container: form.querySelector('#everything-studio-bar'),
                chip: form.querySelector('#everything-selected-studio-chip'),
                chipName: form.querySelector('#everything-selected-studio-name'),
                clearBtn: form.querySelector('#everything-clear-studio-btn'),
                recentContainer: form.querySelector('#everything-recent-studios')
            },
            suggestionsContainer: form.querySelector('#everything-suggestions-container'),
            searchConsole: form.querySelector('#everything-search-console'),
            globalSearch: form.querySelector('#everything-global-search'),
            kbdShortcut: form.querySelector('#everything-kbd-shortcut'),
            globalClear: form.querySelector('#everything-global-clear'),
            refreshBtn: form.querySelector('#everything-refresh-btn'),
            columnsContainer: form.querySelector('#everything-columns-container'),
            colTags: form.querySelector('#everything-col-tags'),
            colPerformers: form.querySelector('#everything-col-performers'),
            colResizer: form.querySelector('#everything-col-resizer'),
            tags: {
                badge: form.querySelector('#everything-tags-badge'),
                chipsContainer: form.querySelector('#everything-tags-chips'),
                tableContainer: form.querySelector('#everything-tags-table')
            },
            performers: {
                badge: form.querySelector('#everything-performers-badge'),
                chipsContainer: form.querySelector('#everything-performers-chips'),
                tableContainer: form.querySelector('#everything-performers-table')
            },
            saveBtn: form.querySelector('#everything-save-btn'),
            cancelBtn: form.querySelector('#everything-cancel-btn')
        };
    }

    function renderColumnChips(container, type, searchInput, selectedIds, onSelect) {
        if (!container) return;
        const pinned = readPinnedEntries(type).map(p => ({ ...p, isPinned: true }));
        const recent = readRecentEntries(type).filter(r => !pinned.some(p => String(p.id) === String(r.id)));
        const combined = [...pinned, ...recent].slice(0, 9);

        if (!combined.length) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.innerHTML = '';
        const isDark = getEffectiveTheme() === 'dark';

        let index = 0;
        for (const item of combined) {
            index++;
            const isSelected = selectedIds && selectedIds.has(String(item.id));
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'fasttag-quick-chip';
            chip.title = `[Hotkey: ${index <= 9 ? index : 'None'}] Click to toggle. Right-Click or Alt-Click to ${item.isPinned ? 'unpin' : 'pin'}.`;

            if (item.isPinned) {
                const pinSpan = document.createElement('span');
                pinSpan.textContent = '📌 ';
                chip.appendChild(pinSpan);
            }
            const textNode = document.createTextNode(item.name || item.title || '');
            chip.appendChild(textNode);

            if (index <= 9) {
                const numSpan = document.createElement('span');
                numSpan.textContent = ` ${index}`;
                numSpan.style.cssText = `font-size: 10px; font-weight: 700; opacity: 0.9; margin-left: 2px; vertical-align: super; line-height: 0;`;
                chip.appendChild(numSpan);
            }

            const bg = isDark ? (isSelected ? '#312e81' : (item.isPinned ? '#1e1b4b' : '#1e293b')) : (isSelected ? '#e0e7ff' : '#f1f5f9');
            const border = isDark ? (isSelected ? '#4338ca' : (item.isPinned ? '#6366f1' : '#475569')) : (isSelected ? '#a5b4fc' : '#cbd5e1');
            const color = isDark ? (isSelected ? '#ffffff' : (item.isPinned ? '#e0e7ff' : '#f1f5f9')) : (isSelected ? '#312e81' : '#1e293b');

            chip.style.cssText = `padding: 2px 7px; border: 1px solid ${border}; border-radius: 999px; background: ${bg}; color: ${color}; font-size: 11px; font-weight: ${item.isPinned || isSelected ? '600' : '500'}; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; line-height: 1.25;`;

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                if (e.altKey) {
                    togglePinnedEntry(type, item);
                    renderColumnChips(container, type, searchInput, selectedIds, onSelect);
                    return;
                }
                const idStr = String(item.id);
                if (selectedIds.has(idStr)) {
                    selectedIds.delete(idStr);
                } else {
                    if (type === 'studios') {
                        selectedIds.clear();
                    }
                    selectedIds.add(idStr);
                }
                addRecentEntry(type, item);
                if (onSelect) onSelect();
            });

            chip.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                togglePinnedEntry(type, item);
                renderColumnChips(container, type, searchInput, selectedIds, onSelect);
            });

            container.appendChild(chip);
        }
    }

    async function loadUnifiedSuggestions(sceneId, cardElement, container, ctx) {
        if (!getEnableSuggestions() || !container || !sceneId) {
            if (container) container.style.display = 'none';
            return;
        }

        const isDark = getEffectiveTheme() === 'dark';
        let cardText = cardElement ? (cardElement.innerText || cardElement.textContent || '') : '';
        let title = '';
        let details = '';
        let filePath = '';
        let fileName = '';

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
        const types = [
            { type: 'tags', icon: '🏷️', selected: ctx.selectedTagIds },
            { type: 'performers', icon: '⭐', selected: ctx.selectedPerformerIds },
            { type: 'studios', icon: '🏢', selected: new Set(ctx.selectedStudioId() ? [ctx.selectedStudioId()] : []) }
        ];

        const allSuggestions = [];

        for (const { type, icon, selected } of types) {
            const config = ENTITY_CONFIG[type];
            let cached = getCachedOrNull(type);
            if (!cached) {
                const res = await fetchGQL(config.fetchQuery);
                cached = config.extractList(res.data);
                setCache(type, cached);
            }
            if (!cached) continue;

            for (const item of cached) {
                if (selected.has(String(item.id))) continue;
                const name = (item.name || item.title || '').trim();
                if (!name || name.length < 2) continue;

                const nameClean = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                if (!nameClean) continue;

                if (fullTextSpaced.includes(' ' + nameClean + ' ')) {
                    allSuggestions.push({ type, icon, item });
                    if (allSuggestions.length >= 15) break;
                }
            }
        }

        const tagSuggestions = allSuggestions.filter(s => s.type === 'tags');
        const perfSuggestions = allSuggestions.filter(s => s.type === 'performers' || s.type === 'studios');

        const tagsBox = container.querySelector('#everything-sugg-tags-box');
        const tagsChips = container.querySelector('#everything-sugg-tags-chips');
        const perfBox = container.querySelector('#everything-sugg-performers-box');
        const perfChips = container.querySelector('#everything-sugg-performers-chips');

        if (tagsChips) tagsChips.innerHTML = '';
        if (perfChips) perfChips.innerHTML = '';

        const updateBoxVisibility = () => {
            const hasRealTags = tagsChips && tagsChips.querySelectorAll('.fasttag-suggestion-chip').length > 0;
            const hasRealPerf = perfChips && perfChips.querySelectorAll('.fasttag-suggestion-chip').length > 0;

            container.style.display = 'flex';
            if (tagsBox) {
                tagsBox.style.display = 'flex';
                tagsBox.style.visibility = 'visible';
                const emptyMsg = tagsBox.querySelector('.fasttag-sugg-empty');
                if (!hasRealTags) {
                    if (!emptyMsg) {
                        const span = document.createElement('span');
                        span.className = 'fasttag-sugg-empty';
                        span.textContent = 'None';
                        span.style.cssText = `font-size: 10px; font-weight: 500; opacity: 0.45; font-style: italic; color: #818cf8; user-select: none; line-height: 1;`;
                        tagsChips.appendChild(span);
                    }
                } else if (emptyMsg) {
                    emptyMsg.remove();
                }
            }
            if (perfBox) {
                perfBox.style.display = 'flex';
                perfBox.style.visibility = 'visible';
                const emptyMsg = perfBox.querySelector('.fasttag-sugg-empty');
                if (!hasRealPerf) {
                    if (!emptyMsg) {
                        const span = document.createElement('span');
                        span.className = 'fasttag-sugg-empty';
                        span.textContent = 'None';
                        span.style.cssText = `font-size: 10px; font-weight: 500; opacity: 0.45; font-style: italic; color: #38bdf8; user-select: none; line-height: 1;`;
                        perfChips.appendChild(span);
                    }
                } else if (emptyMsg) {
                    emptyMsg.remove();
                }
            }
            syncSuggestionsAlignment(container.closest('form'));
        };

        const activateSuggestion = async (sug) => {
            const idStr = String(sug.item.id);
            if (sug.type === 'tags') {
                ctx.selectedTagIds.add(idStr);
            } else if (sug.type === 'performers') {
                ctx.selectedPerformerIds.add(idStr);
            } else if (sug.type === 'studios') {
                ctx.setStudioId(idStr);
            }
            addRecentEntry(sug.type, sug.item);

            if (typeof ctx.onSuggestionActivated === 'function') {
                await ctx.onSuggestionActivated(sug);
            }
        };

        const createSuggestionChip = (sug, parentChipsContainer) => {
            let chipBg, chipBorder, chipColor;
            if (sug.type === 'tags') {
                chipBg = isDark ? 'rgba(99, 102, 241, 0.15)' : '#e0e7ff';
                chipBorder = isDark ? '1px dashed rgba(129, 140, 248, 0.7)' : '1px dashed #6366f1';
                chipColor = isDark ? '#c7d2fe' : '#3730a3';
            } else if (sug.type === 'performers') {
                chipBg = isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe';
                chipBorder = isDark ? '1px dashed rgba(56, 189, 248, 0.7)' : '1px dashed #0284c7';
                chipColor = isDark ? '#7dd3fc' : '#0369a1';
            } else {
                chipBg = isDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff';
                chipBorder = isDark ? '1px dashed rgba(192, 132, 252, 0.7)' : '1px dashed #9333ea';
                chipColor = isDark ? '#e9d5ff' : '#6b21a8';
            }

            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'fasttag-suggestion-chip';
            chip.textContent = `${sug.icon} + ${sug.item.name || sug.item.title}`;
            chip.title = `Click to add ${sug.type.slice(0, -1)}`;
            chip.style.cssText = `padding: 1.5px 7px; border: ${chipBorder}; border-radius: 999px; background: ${chipBg}; color: ${chipColor}; font-size: 10.5px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; line-height: 1.25;`;

            chip.addEventListener('click', async (e) => {
                e.preventDefault();
                await activateSuggestion(sug);
                chip.remove();
                updateBoxVisibility();
                ctx.refreshAllUI();
            });

            if (parentChipsContainer) parentChipsContainer.appendChild(chip);
        };

        tagSuggestions.forEach(s => createSuggestionChip(s, tagsChips));
        perfSuggestions.forEach(s => createSuggestionChip(s, perfChips));
        updateBoxVisibility();
    }

    async function navigateSequentialEditEverything(popup, sceneId, direction, doSaveFn) {
        if (!sequentialEditState.enabled) return;

        if (typeof doSaveFn === 'function') {
            await doSaveFn();
        }

        const form = popup.element;
        const formRect = form.getBoundingClientRect();
        const minTop = window.scrollY + 8;
        const minLeft = window.scrollX + 8;
        const maxAllowedTop = Math.max(minTop, window.scrollY + window.innerHeight - form.offsetHeight - 8);
        const maxAllowedLeft = Math.max(minLeft, window.scrollX + window.innerWidth - form.offsetWidth - 8);

        sequentialEditState.popupPosition = {
            left: Math.max(minLeft, Math.min(maxAllowedLeft, formRect.left + window.scrollX)),
            top: Math.max(minTop, Math.min(maxAllowedTop, formRect.top + window.scrollY))
        };

        if (!sequentialEditState.allSceneCards || sequentialEditState.allSceneCards.length === 0) {
            sequentialEditState.allSceneCards = getAllVisibleSceneCards();
        }

        const cards = sequentialEditState.allSceneCards;
        let currIdx = sequentialEditState.currentIndex;
        if (currIdx === -1 || !cards[currIdx] || extractSceneId(cards[currIdx]) !== sceneId) {
            currIdx = getSceneCardIndex(sceneId, cards);
            sequentialEditState.currentIndex = currIdx;
        }

        const nextIndex = currIdx + direction;
        if (nextIndex < 0 || nextIndex >= cards.length) {
            toastError('No more scenes in this direction');
            return;
        }

        const nextCard = cards[nextIndex];
        const nextSceneId = extractSceneId(nextCard);
        if (!nextCard || !nextSceneId) {
            toastError('Error resolving next scene');
            return;
        }

        sequentialEditState.currentIndex = nextIndex;
        sequentialEditState.currentSceneId = nextSceneId;

        await loadEditEverythingDataIntoPopup(nextSceneId, nextCard, popup);
    }

    function setupSequentialEditEverythingHandlers(popup, sceneId, cardElement, doSaveFn) {
        const seqCheckbox = popup.sequentialCheckbox;
        const prevBtn = popup.prevBtn;
        const nextBtn = popup.nextBtn;
        const titleSpan = popup.titleSpan;
        const saveBtn = popup.saveBtn;

        const updateUI = () => {
            const isEnabled = sequentialEditState.enabled;
            seqCheckbox.checked = isEnabled;

            if (isEnabled) {
                if (!sequentialEditState.allSceneCards || sequentialEditState.allSceneCards.length === 0) {
                    sequentialEditState.allSceneCards = getAllVisibleSceneCards();
                }
                const cards = sequentialEditState.allSceneCards;
                const idx = getSceneCardIndex(sceneId, cards);
                if (idx !== -1) {
                    sequentialEditState.currentIndex = idx;
                    titleSpan.textContent = `⚡ Edit Everything [${idx + 1}/${cards.length}]`;
                    const isFirst = idx === 0;
                    const isLast = idx === cards.length - 1;

                    prevBtn.disabled = isFirst;
                    prevBtn.style.opacity = isFirst ? '0.4' : '1';
                    prevBtn.style.cursor = isFirst ? 'not-allowed' : 'pointer';

                    nextBtn.disabled = isLast;
                    nextBtn.style.opacity = isLast ? '0.4' : '1';
                    nextBtn.style.cursor = isLast ? 'not-allowed' : 'pointer';

                    if (saveBtn) {
                        saveBtn.textContent = isLast ? 'Save & Close' : 'Save & Next Scene ►';
                    }
                }
                if (popup.navGroup) {
                    popup.navGroup.style.maxWidth = '60px';
                    popup.navGroup.style.opacity = '1';
                }
            } else {
                titleSpan.textContent = '⚡ Edit Scene (Tags + Performers + Studio)';
                if (saveBtn) {
                    saveBtn.textContent = 'Save Scene';
                }
                if (popup.navGroup) {
                    popup.navGroup.style.maxWidth = '0';
                    popup.navGroup.style.opacity = '0';
                }
            }
        };

        try {
            const savedPref = localStorage.getItem('fasttag_sequential_edit_mode');
            if (savedPref === 'true') {
                sequentialEditState.enabled = true;
                sequentialEditState.allSceneCards = getAllVisibleSceneCards();
                sequentialEditState.currentIndex = getSceneCardIndex(sceneId, sequentialEditState.allSceneCards);
                sequentialEditState.currentSceneId = sceneId;
            }
        } catch (e) {}

        updateUI();

        seqCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                sequentialEditState.enabled = true;
                localStorage.setItem('fasttag_sequential_edit_mode', 'true');
                sequentialEditState.allSceneCards = getAllVisibleSceneCards();
                sequentialEditState.currentIndex = getSceneCardIndex(sceneId, sequentialEditState.allSceneCards);
                sequentialEditState.currentSceneId = sceneId;
                const form = popup.element;
                const formRect = form.getBoundingClientRect();
                sequentialEditState.popupPosition = {
                    left: formRect.left + window.scrollX,
                    top: formRect.top + window.scrollY
                };
            } else {
                sequentialEditState.enabled = false;
                localStorage.setItem('fasttag_sequential_edit_mode', 'false');
                resetSequentialEditState();
            }
            updateUI();
        });

        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateSequentialEditEverything(popup, sceneId, -1, doSaveFn);
        });

        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            navigateSequentialEditEverything(popup, sceneId, 1, doSaveFn);
        });
    }

    async function loadEditEverythingDataIntoPopup(sceneId, cardElement, popup) {
        const ctx = popup._context;
        if (!ctx) return;

        ctx.setCurrentSceneId(sceneId);
        attachScenePreview(popup.previewContainer, sceneId, cardElement);

        popup.globalSearch.value = '';
        popup.globalClear.style.display = 'none';
        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';

        const sceneQuery = `
            query FindSceneEverything($id: ID!) {
                findScene(id: $id) {
                    id
                    title
                    details
                    files { path }
                    tags { id name }
                    performers { id name disambiguation }
                    studio { id name }
                }
            }
        `;

        let sceneData = null;
        try {
            const res = await fetchGQL(sceneQuery, { id: sceneId });
            sceneData = res?.data?.findScene;
        } catch (e) {
            console.error('[FastTag] Error loading scene details:', e);
        }
        popup.sceneData = sceneData;

        const selTags = new Set((sceneData?.tags || []).map(t => String(t.id)));
        const selPerfs = new Set((sceneData?.performers || []).map(p => String(p.id)));
        const selStud = sceneData?.studio?.id ? String(sceneData.studio.id) : null;

        ctx.setSelectedTags(selTags);
        ctx.setSelectedPerformers(selPerfs);
        ctx.setSelectedStudio(selStud);
        ctx.setInitialTags(new Set(selTags));
        ctx.setInitialPerformers(new Set(selPerfs));
        ctx.setInitialStudio(selStud);

        setupSequentialEditEverythingHandlers(popup, sceneId, cardElement, ctx.doSave);

        await Promise.all([
            ctx.fetchColumnData('tags', popup.tagsTable, '', selTags),
            ctx.fetchColumnData('performers', popup.performersTable, '', selPerfs)
        ]);

        const tagHolder = popup.tags.tableContainer?.querySelector('.tabulator-tableholder');
        if (tagHolder) tagHolder.scrollTop = 0;
        const perfHolder = popup.performers.tableContainer?.querySelector('.tabulator-tableholder');
        if (perfHolder) perfHolder.scrollTop = 0;

        await ctx.renderStudioBar('');
        ctx.refreshAllUI();

        await loadUnifiedSuggestions(sceneId, cardElement, popup.suggestionsContainer, {
            selectedTagIds: selTags,
            selectedPerformerIds: selPerfs,
            selectedStudioId: () => ctx.getSelectedStudio(),
            setStudioId: (id) => { ctx.setSelectedStudio(id); },
            tagsTable: popup.tagsTable,
            performersTable: popup.performersTable,
            fetchColumnData: ctx.fetchColumnData,
            renderStudioBar: ctx.renderStudioBar,
            onSuggestionActivated: ctx.onSuggestionActivated,
            doSave: ctx.doSave,
            refreshAllUI: ctx.refreshAllUI
        });
    }

    async function openEditEverythingPopup(sceneId, cardElement) {
        if (!isTabulatorLoaded()) {
            await ensureDependenciesLoaded();
        }
        if (!isTabulatorLoaded()) {
            toastError("Tabulator library failed to load. Please check your internet connection or adblocker.");
            return;
        }

        // If the Everything popup is already open, reuse it in-place! Zero redraw flash!
        if (activePopup && activePopup.type === 'everything' && activePopup.element && activePopup.element.isConnected) {
            await loadEditEverythingDataIntoPopup(sceneId, cardElement, activePopup);
            return;
        }

        closePopup(false);

        popupAbortController = new AbortController();
        const { signal } = popupAbortController;

        const popup = createEditEverythingPopupShell();
        popup.type = 'everything';
        activePopup = popup;
        const form = popup.element;

        let selectedTagIds = new Set();
        let selectedPerformerIds = new Set();
        let selectedStudioId = null;
        let initialTagIds = new Set();
        let initialPerformerIds = new Set();
        let initialStudioId = null;
        let isRestoring = false;
        let currentSceneId = sceneId;

        // Initialize Tabulator tables once
        const tagsTable = new Tabulator(popup.tags.tableContainer, {
            data: [],
            layout: "fitColumns",
            columnResizeMode: "fit",
            height: "100%",
            placeholder: "No Tags Found",
            selectable: true,
            index: "id",
            columnDefaults: { headerSort: false },
            columns: getColumnsWithSavedWidths('tags', 'everything')
        });
        attachColumnWidthSaver(tagsTable, 'tags', 'everything');

        const performersTable = new Tabulator(popup.performers.tableContainer, {
            data: [],
            layout: "fitColumns",
            columnResizeMode: "fit",
            height: "100%",
            placeholder: "No Performers Found",
            selectable: true,
            index: "id",
            columnDefaults: { headerSort: false },
            columns: getColumnsWithSavedWidths('performers', 'everything')
        });
        attachColumnWidthSaver(performersTable, 'performers', 'everything');

        popup.tagsTable = tagsTable;
        popup.performersTable = performersTable;

        const isDirty = () => {
            if (selectedStudioId !== initialStudioId) return true;
            if (selectedTagIds.size !== initialTagIds.size) return true;
            if (selectedPerformerIds.size !== initialPerformerIds.size) return true;
            for (const id of selectedTagIds) {
                if (!initialTagIds.has(id)) return true;
            }
            for (const id of selectedPerformerIds) {
                if (!initialPerformerIds.has(id)) return true;
            }
            return false;
        };

        const updateBadges = () => {
            popup.tags.badge.textContent = `${selectedTagIds.size} selected`;
            popup.performers.badge.textContent = `${selectedPerformerIds.size} selected`;
        };

        const updateSaveButton = () => {
            if (sequentialEditState.enabled) {
                const dirty = isDirty();
                const cards = sequentialEditState.allSceneCards || getAllVisibleSceneCards();
                const idx = getSceneCardIndex(currentSceneId, cards);
                const isLast = idx !== -1 && idx === cards.length - 1;
                if (dirty) {
                    popup.saveBtn.textContent = isLast ? 'Save & Close' : 'Save & Next Scene ►';
                    popup.saveBtn.style.background = '#10b981';
                } else {
                    popup.saveBtn.textContent = isLast ? 'Close' : 'Next Scene ►';
                    popup.saveBtn.style.background = '#6366f1';
                }
            } else {
                popup.saveBtn.textContent = 'Save Scene';
                popup.saveBtn.style.background = '#4f46e5';
            }
        };

        const renderStudioBar = async (searchQuery = '') => {
            const studioBar = popup.studioBar;
            if (!studioBar) return;

            let allStudios = getCachedOrNull('studios');
            if (!allStudios) {
                const res = await fetchGQL(ENTITY_CONFIG.studios.fetchQuery);
                allStudios = ENTITY_CONFIG.studios.extractList(res.data);
                setCache('studios', allStudios);
            }
            if (!allStudios) return;

            if (selectedStudioId) {
                const curStudio = allStudios.find(s => String(s.id) === String(selectedStudioId)) || (popup.sceneData?.studio?.id === selectedStudioId ? popup.sceneData.studio : null);
                if (curStudio) {
                    studioBar.chipName.textContent = curStudio.name;
                    studioBar.chip.style.display = 'inline-flex';
                } else {
                    studioBar.chip.style.display = 'none';
                }
            } else {
                studioBar.chip.style.display = 'none';
            }

            const term = searchQuery ? searchQuery.trim().toLowerCase() : '';
            studioBar.recentContainer.innerHTML = '';
            const isDark = getEffectiveTheme() === 'dark';

            if (!term) {
                if (!selectedStudioId) {
                    const emptySpan = document.createElement('span');
                    emptySpan.textContent = '(None - search below to assign)';
                    emptySpan.style.cssText = `font-size: 11px; opacity: 0.6; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'};`;
                    studioBar.recentContainer.appendChild(emptySpan);
                }
                return;
            }

            const matchingStudios = allStudios
                .filter(s => (s.name || '').toLowerCase().includes(term) && String(s.id) !== String(selectedStudioId))
                .slice(0, 10);

            if (!matchingStudios.length && !selectedStudioId) {
                const emptySpan = document.createElement('span');
                emptySpan.textContent = 'No matching studio';
                emptySpan.style.cssText = `font-size: 11px; opacity: 0.6; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'};`;
                studioBar.recentContainer.appendChild(emptySpan);
                return;
            }

            matchingStudios.forEach(st => {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'fasttag-quick-chip';
                chip.title = `Click to set studio to "${st.name}"`;
                chip.textContent = `+ ${st.name}`;
                const bg = isDark ? 'rgba(99, 102, 241, 0.15)' : '#eef2ff';
                const border = isDark ? '1px solid rgba(99, 102, 241, 0.45)' : '1px solid #818cf8';
                const color = isDark ? '#c7d2fe' : '#3730a3';
                chip.style.cssText = `padding: 2px 8px; border: ${border}; border-radius: 999px; background: ${bg}; color: ${color}; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; line-height: 1.25;`;

                chip.onclick = async (e) => {
                    e.preventDefault();
                    if (selectedStudioId === String(st.id)) {
                        selectedStudioId = null;
                    } else {
                        selectedStudioId = String(st.id);
                        addRecentEntry('studios', st);
                    }
                    refreshAllUI();
                    if (!sequentialEditState.enabled) {
                        await doSave();
                    }
                };

                studioBar.recentContainer.appendChild(chip);
            });
        };

        popup.studioBar.clearBtn.onclick = async (e) => {
            e.preventDefault();
            selectedStudioId = null;
            refreshAllUI();
            if (!sequentialEditState.enabled) {
                await doSave();
            }
        };

        async function fetchColumnData(type, tableInstance, query, selIds) {
            const config = ENTITY_CONFIG[type];
            let cached = getCachedOrNull(type);
            if (!cached) {
                const res = await fetchGQL(config.fetchQuery);
                cached = config.extractList(res.data);
                setCache(type, cached);
            }
            if (!cached) return;

            const term = query.trim().toLowerCase();
            let data = cached;
            const searchFields = config.searchFields || [config.labelKey];
            if (term) {
                const tokens = term.split(/\s+/);
                data = cached.filter(item => {
                    const itemSearchStr = searchFields
                        .map(f => String(item[f] || '').trim().toLowerCase())
                        .filter(Boolean)
                        .join(' ');
                    return tokens.every(t => itemSearchStr.includes(t));
                });
            }

            data.sort(getSmartSortComparator(term, selIds, config.labelKey, searchFields));

            isRestoring = true;
            try {
                await tableInstance.setData(data);
                selIds.forEach(id => {
                    const r = tableInstance.getRow(id);
                    if (r) tableInstance.selectRow(r);
                });
                tableInstance.redraw(true);
            } finally {
                isRestoring = false;
            }
        }

        const onTagChipSelect = async () => {
            popup.globalSearch.value = '';
            popup.globalClear.style.display = 'none';
            if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
            await Promise.all([
                fetchColumnData('tags', tagsTable, '', selectedTagIds),
                fetchColumnData('performers', performersTable, '', selectedPerformerIds)
            ]);
            const holder = popup.tags.tableContainer?.querySelector('.tabulator-tableholder');
            if (holder) holder.scrollTop = 0;
            refreshAllUI();
            if (!sequentialEditState.enabled) {
                await doSave();
            }
        };

        const onPerformerChipSelect = async () => {
            popup.globalSearch.value = '';
            popup.globalClear.style.display = 'none';
            if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
            await Promise.all([
                fetchColumnData('tags', tagsTable, '', selectedTagIds),
                fetchColumnData('performers', performersTable, '', selectedPerformerIds)
            ]);
            const holder = popup.performers.tableContainer?.querySelector('.tabulator-tableholder');
            if (holder) holder.scrollTop = 0;
            refreshAllUI();
            if (!sequentialEditState.enabled) {
                await doSave();
            }
        };

        const refreshAllUI = () => {
            updateBadges();
            updateSaveButton();
            renderStudioBar(popup.globalSearch.value);
            renderColumnChips(popup.tags.chipsContainer, 'tags', popup.globalSearch, selectedTagIds, onTagChipSelect);
            renderColumnChips(popup.performers.chipsContainer, 'performers', popup.globalSearch, selectedPerformerIds, onPerformerChipSelect);
            try {
                tagsTable.redraw(true);
                performersTable.redraw(true);
            } catch (e) {}
        };
        form._fastTagOnResize = refreshAllUI;

        tagsTable.on("rowSelected", (row) => {
            if (isRestoring) return;
            const id = row.getData()?.id;
            if (id) selectedTagIds.add(String(id));
            refreshAllUI();
        });
        tagsTable.on("rowDeselected", (row) => {
            if (isRestoring) return;
            const id = row.getData()?.id;
            if (id) selectedTagIds.delete(String(id));
            refreshAllUI();
        });

        performersTable.on("rowSelected", (row) => {
            if (isRestoring) return;
            const id = row.getData()?.id;
            if (id) selectedPerformerIds.add(String(id));
            refreshAllUI();
        });
        performersTable.on("rowDeselected", (row) => {
            if (isRestoring) return;
            const id = row.getData()?.id;
            if (id) selectedPerformerIds.delete(String(id));
            refreshAllUI();
        });

        const refreshGlobalSearch = (val) => {
            const query = (val || '').trim();
            fetchColumnData('tags', tagsTable, query, selectedTagIds);
            fetchColumnData('performers', performersTable, query, selectedPerformerIds);
            renderStudioBar(query);
        };

        if (popup.searchConsole && popup.globalSearch) {
            popup.globalSearch.addEventListener('focus', () => {
                popup.searchConsole.style.borderColor = '#6366f1';
                popup.searchConsole.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.25)';
            });
            popup.globalSearch.addEventListener('blur', () => {
                const isDark = getEffectiveTheme() === 'dark';
                popup.searchConsole.style.borderColor = isDark ? 'rgba(148, 163, 184, 0.25)' : '#cbd5e1';
                popup.searchConsole.style.boxShadow = 'none';
            });
        }

        let searchDebounce = null;
        popup.globalSearch.addEventListener('input', () => {
            const val = popup.globalSearch.value.trim();
            const hasVal = val.length > 0;
            popup.globalClear.style.display = hasVal ? 'block' : 'none';
            if (popup.kbdShortcut) popup.kbdShortcut.style.display = hasVal ? 'none' : 'block';
            clearTimeout(searchDebounce);
            searchDebounce = setTimeout(() => {
                refreshGlobalSearch(val);
            }, 120);
        });

        popup.globalClear.addEventListener('click', () => {
            popup.globalSearch.value = '';
            popup.globalClear.style.display = 'none';
            if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
            refreshGlobalSearch('');
            popup.globalSearch.focus();
        });

        popup.refreshBtn.addEventListener('click', async () => {
            invalidateCache('tags');
            invalidateCache('performers');
            invalidateCache('studios');
            popup.globalSearch.value = '';
            popup.globalClear.style.display = 'none';
            if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
            await Promise.all([
                fetchColumnData('tags', tagsTable, '', selectedTagIds),
                fetchColumnData('performers', performersTable, '', selectedPerformerIds)
            ]);
            await renderStudioBar();
            toastSuccess('Refreshed all caches');
        });

        const doSave = async () => {
            const mutation = `
                mutation SceneUpdateEverything($id: ID!, $tag_ids: [ID!], $performer_ids: [ID!], $studio_id: ID) {
                    sceneUpdate(input: {
                        id: $id,
                        tag_ids: $tag_ids,
                        performer_ids: $performer_ids,
                        studio_id: $studio_id
                    }) {
                        id
                    }
                }
            `;
            try {
                const res = await fetchGQL(mutation, {
                    id: currentSceneId,
                    tag_ids: Array.from(selectedTagIds),
                    performer_ids: Array.from(selectedPerformerIds),
                    studio_id: selectedStudioId || null
                });

                if (res?.data?.sceneUpdate?.id) {
                    selectedTagIds.forEach(id => {
                        const row = tagsTable.getRow(id);
                        if (row) addRecentEntry('tags', row.getData());
                    });
                    selectedPerformerIds.forEach(id => {
                        const row = performersTable.getRow(id);
                        if (row) addRecentEntry('performers', row.getData());
                    });
                    if (selectedStudioId) {
                        const allStudios = getCachedOrNull('studios') || [];
                        const st = allStudios.find(s => String(s.id) === String(selectedStudioId));
                        if (st) addRecentEntry('studios', st);
                    }

                    await refreshSceneCards();
                    toastSuccess('Scene saved successfully');
                    return true;
                }
            } catch (e) {
                toastError('Failed to save scene', e);
            }
            return false;
        };

        const onSuggestionActivated = async (sug) => {
            const query = popup.globalSearch?.value || '';
            if (sug.type === 'tags') {
                await fetchColumnData('tags', tagsTable, query, selectedTagIds);
                const holder = popup.tags.tableContainer?.querySelector('.tabulator-tableholder');
                if (holder) holder.scrollTop = 0;
            } else if (sug.type === 'performers') {
                await fetchColumnData('performers', performersTable, query, selectedPerformerIds);
                const holder = popup.performers.tableContainer?.querySelector('.tabulator-tableholder');
                if (holder) holder.scrollTop = 0;
            } else if (sug.type === 'studios') {
                renderStudioBar(query);
            }
            refreshAllUI();

            if (!sequentialEditState.enabled) {
                await doSave();
            }
        };

        makeColumnResizable(popup.columnsContainer, popup.colTags, popup.colPerformers, popup.colResizer, () => {
            try {
                tagsTable.redraw(true);
                performersTable.redraw(true);
            } catch (e) {}
        }, signal);

        popup.saveBtn.onclick = async () => {
            if (sequentialEditState.enabled) {
                const cards = sequentialEditState.allSceneCards || getAllVisibleSceneCards();
                const idx = getSceneCardIndex(currentSceneId, cards);
                const isLast = idx !== -1 && idx === cards.length - 1;
                if (isDirty()) {
                    await doSave();
                }
                if (isLast) {
                    closePopup();
                } else {
                    navigateSequentialEditEverything(popup, currentSceneId, 1, null);
                }
            } else {
                const ok = await doSave();
                if (ok) closePopup();
            }
        };

        popup.cancelBtn.onclick = () => closePopup();

        // Store context methods on popup instance for in-place sequential updates
        popup._context = {
            setSelectedTags: (s) => { selectedTagIds = s; },
            setSelectedPerformers: (s) => { selectedPerformerIds = s; },
            setSelectedStudio: (s) => { selectedStudioId = s; },
            setInitialTags: (s) => { initialTagIds = s; },
            setInitialPerformers: (s) => { initialPerformerIds = s; },
            setInitialStudio: (s) => { initialStudioId = s; },
            setCurrentSceneId: (id) => { currentSceneId = id; },
            getSelectedTags: () => selectedTagIds,
            getSelectedPerformers: () => selectedPerformerIds,
            getSelectedStudio: () => selectedStudioId,
            fetchColumnData,
            renderStudioBar,
            refreshAllUI,
            doSave,
            onSuggestionActivated,
            isDirty
        };

        setupPopupListeners(form, signal, async () => {
            await doSave();
            closePopup();
        });

        await loadEditEverythingDataIntoPopup(sceneId, cardElement, popup);
        positionPopupNearCard(form, cardElement);
    }

    async function openEntityPopup(type, sceneId, cardElement) {
        const config = ENTITY_CONFIG[type];
        if (!config) return;

        if (!isTabulatorLoaded()) {
            await ensureDependenciesLoaded();
        }

        if (!isTabulatorLoaded()) {
            toastError("Tabulator library failed to load. Please check your internet connection or adblocker.");
            return;
        }

        closePopup(false);

        popupAbortController = new AbortController();
        const { signal } = popupAbortController;

        activePopup = createPopupShell(type);
        const form = activePopup.element;

        const table = new Tabulator(activePopup.tableContainer, {
            layout: "fitColumns",
            columnResizeMode: "fit",
            height: "100%",
            placeholder: `No ${config.pluralTitle} Found`,
            selectable: true,
            index: "id",
            columnDefaults: {
                headerSort: false
            },
            columns: getColumnsWithSavedWidths(type, 'single'),
        });
        attachColumnWidthSaver(table, type, 'single');
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

        // Ignore checkboxes and scene play/title links
        if (event.target.closest('input[type="checkbox"], .checkbox, [class*="checkbox"]')) return;
        if (event.target.closest('a[href*="/scenes/"]:not([class*="tag"]):not([class*="performer"]):not([class*="gallery"])')) return;

        const targetLink = event.target.closest('a');
        const href = targetLink ? (targetLink.getAttribute('href') || '') : '';
        const badgeButton = event.target.closest('.tag-button, .performer-button, .gallery-button, .badge-button, .btn-minimal, .minimal.btn, .btn[minimal], button.minimal');
        const svg = event.target.closest('svg') || targetLink?.querySelector('svg') || badgeButton?.querySelector('svg');
        const iconName = svg ? (svg.getAttribute('data-icon') || svg.getAttribute('class') || '') : '';
        const badgeContext = `${href} ${iconName} ${badgeButton ? badgeButton.className : ''} ${event.target.className || ''}`.toLowerCase();

        let clickedEntityType = null;

        if (badgeContext.includes('/performers') || badgeContext.includes('fa-user') || badgeContext.includes('performer') || iconName.includes('user')) {
            clickedEntityType = 'performers';
        } else if (badgeContext.includes('/tags') || badgeContext.includes('fa-tag') || badgeContext.includes('tag') || iconName.includes('tag')) {
            clickedEntityType = 'tags';
        } else if (badgeContext.includes('/studios') || badgeContext.includes('studio') || iconName.includes('building') || iconName.includes('video')) {
            clickedEntityType = 'studios';
        } else if (badgeContext.includes('/galleries') || badgeContext.includes('fa-images') || badgeContext.includes('gallery') || iconName.includes('image')) {
            clickedEntityType = 'galleries';
        }

        // If not clicked on a recognized entity badge, do not intercept the click
        if (!clickedEntityType) {
            return;
        }

        const sceneId = extractSceneId(sceneCard);
        if (!sceneId) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        closeMenu();

        openEntityPopup(clickedEntityType, sceneId, sceneCard);
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