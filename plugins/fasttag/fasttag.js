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
            icon: '🏷️',
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
            fetchExistingQuery: `query ($id: ID!) { findScene(id: $id) { id title files { path } tags { id } } }`,
            extractExisting: data => data?.findScene?.tags?.map(t => t.id) || [],
            createQuery: `mutation ($name: String!) { tagCreate(input: { name: $name }) { id name } }`,
            createExtract: data => data?.tagCreate?.id,
            createVariables: val => ({ name: val }),
            updateQuery: `mutation ($scene_id: ID!, $tag_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, tag_ids: $tag_ids }) { id } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), tag_ids: ids.map(String) })
        },
        performers: {
            icon: '⭐',
            title: 'Performer',
            pluralTitle: 'Performers',
            labelKey: 'name',
            searchFields: ['name', 'disambiguation', 'id'],
            columns: [
                { title: "ID", field: "id", width: 55, hozAlign: "center", headerHozAlign: "center", resizable: false, headerSort: false },
                { title: "Name", field: "name", widthGrow: 2, resizable: true, headerSort: false },
                { title: "Details", field: "disambiguation", widthGrow: 1, resizable: false, headerSort: false },
            ],
            fetchQuery: `query { findPerformers(filter: { per_page: -1 }) { performers { id name disambiguation image_path country gender birthdate ethnicity rating100 alias_list } } }`,
            extractList: data => data?.findPerformers?.performers || [],
            fetchExistingQuery: `query ($id: ID!) { findScene(id: $id) { id title files { path } performers { id } } }`,
            extractExisting: data => data?.findScene?.performers?.map(p => p.id) || [],
            createQuery: `mutation ($name: String!) { performerCreate(input: { name: $name }) { id name } }`,
            createExtract: data => data?.performerCreate?.id,
            createVariables: val => ({ name: val }),
            updateQuery: `mutation ($scene_id: ID!, $performer_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, performer_ids: $performer_ids }) { id } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), performer_ids: ids.map(String) })
        },
        galleries: {
            icon: '🖼️',
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
            fetchExistingQuery: `query ($id: ID!) { findScene(id: $id) { id title files { path } galleries { id } } }`,
            extractExisting: data => data?.findScene?.galleries?.map(g => g.id) || [],
            createQuery: `mutation ($title: String!) { galleryCreate(input: { title: $title }) { id title } }`,
            createExtract: data => data?.galleryCreate?.id,
            createVariables: val => ({ title: val }),
            updateQuery: `mutation ($scene_id: ID!, $gallery_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, gallery_ids: $gallery_ids }) { id } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), gallery_ids: ids.map(String) })
        },
        studios: {
            icon: '🏢',
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
            fetchExistingQuery: `query ($id: ID!) { findScene(id: $id) { id title files { path } studio { id name } } }`,
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

    const TABULATOR_JS_CDNS = [
        'https://cdnjs.cloudflare.com/ajax/libs/tabulator/5.5.2/js/tabulator.min.js',
        'https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js',
        'https://cdn.jsdelivr.net/npm/tabulator-tables@5.5.2/dist/js/tabulator.min.js'
    ];
    const TABULATOR_CSS_CDNS = [
        'https://cdnjs.cloudflare.com/ajax/libs/tabulator/5.5.2/css/tabulator.min.css',
        'https://unpkg.com/tabulator-tables@5.5.2/dist/css/tabulator.min.css',
        'https://cdn.jsdelivr.net/npm/tabulator-tables@5.5.2/dist/css/tabulator.min.css'
    ];

    let dependencyLoadPromise = null;

    function isTabulatorLoaded() {
        return typeof Tabulator !== 'undefined' || typeof window.Tabulator !== 'undefined';
    }

    function loadScriptWithFallback(urls, id) {
        return new Promise((resolve, reject) => {
            if (isTabulatorLoaded()) {
                resolve();
                return;
            }
            let index = 0;
            function tryNext() {
                if (index >= urls.length) {
                    reject(new Error(`All sources failed for script ${id}`));
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
                    console.warn(`[FastTag] Failed to load ${src}, trying fallback...`);
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
        if (isTabulatorLoaded()) {
            return Promise.resolve();
        }
        if (dependencyLoadPromise) return dependencyLoadPromise;

        dependencyLoadPromise = (async () => {
            if (isTabulatorLoaded()) return;
            const promises = [];
            promises.push(loadScriptWithFallback(TABULATOR_JS_CDNS, 'tabulator-external-js'));
            loadCssWithFallback(TABULATOR_CSS_CDNS, 'tabulator-external-css');
            await Promise.all(promises);
        })().catch(err => {
            console.warn('[FastTag] Tabulator load fallback note:', err.message);
            dependencyLoadPromise = null;
        });

        return dependencyLoadPromise;
    }

    // Preload dependencies
    ensureDependenciesLoaded();

    const styleId = 'scenes-manager-modern-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
        #scenes-popup {
            background-color: #1e293b;
            background: #1e293b;
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
            background-color: #1e293b !important;
            background: #1e293b !important;
            border: 1px solid #334155 !important;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5) !important;
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

        #scenes-popup.theme-dark .tabulator,
        #scenes-popup.theme-dark .tabulator-tableholder,
        #scenes-popup.theme-dark .tabulator-table,
        #scenes-popup.theme-dark .tabulator .tabulator-row,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-even,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-odd {
            background-color: #0f172a !important;
            color: #e2e8f0 !important;
            outline: none !important;
            box-shadow: none !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header {
            background-color: #1e293b !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
            color: #94a3b8 !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col {
            background-color: transparent !important;
            border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col:last-child {
            border-right: none !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col-title {
            color: #94a3b8 !important;
            font-weight: 600 !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row {
            border-top: none !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row .tabulator-cell {
            border-top: none !important;
            border-bottom: none !important;
            border-right: 1px solid rgba(255, 255, 255, 0.07) !important;
            outline: none !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row .tabulator-cell:last-child {
            border-right: none !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row:hover,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-even:hover,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-odd:hover {
            background-color: #1e293b !important;
            color: #ffffff !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-selected,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-selected:hover,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-even.tabulator-selected,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-odd.tabulator-selected {
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

        #fasttag-scrape-items-preview {
            scrollbar-width: thin !important;
            scrollbar-color: rgba(129, 140, 248, 0.65) rgba(0, 0, 0, 0.25) !important;
        }
        #fasttag-scrape-items-preview::-webkit-scrollbar {
            width: 6px !important;
            height: 6px !important;
            display: block !important;
        }
        #fasttag-scrape-items-preview::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.25) !important;
            border-radius: 4px !important;
        }
        #fasttag-scrape-items-preview::-webkit-scrollbar-thumb {
            background: rgba(129, 140, 248, 0.65) !important;
            border-radius: 4px !important;
        }
        #fasttag-scrape-items-preview::-webkit-scrollbar-thumb:hover {
            background: rgba(129, 140, 248, 0.9) !important;
        }

        #fasttag-scrape-v-resizer:hover {
            border-bottom: 2px solid #818cf8 !important;
        }

        #scenes-popup.theme-light #fasttag-scrape-items-preview {
            scrollbar-color: rgba(99, 102, 241, 0.65) rgba(0, 0, 0, 0.08) !important;
        }
        #scenes-popup.theme-light #fasttag-scrape-items-preview::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.08) !important;
        }
        #scenes-popup.theme-light #fasttag-scrape-items-preview::-webkit-scrollbar-thumb {
            background: rgba(99, 102, 241, 0.65) !important;
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

        /* Micro-tooltip trigger base class */
        .fasttag-tooltip {
            display: inline-flex;
            align-items: center;
        }
        #everything-recent-studios::-webkit-scrollbar,
        #everything-tags-chips::-webkit-scrollbar,
        #everything-performers-chips::-webkit-scrollbar,
        #everything-suggestions-chips::-webkit-scrollbar,
        /* Seamless 1-Way Infinite Marquee Loop for Long Scene Titles / Filenames */
        .fasttag-marquee-box {
            overflow: hidden;
            max-width: 100%;
            min-width: 0;
            flex: 1 1 auto;
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
        }
        .fasttag-marquee-track {
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            will-change: transform;
        }
        .fasttag-marquee-item {
            display: inline-block;
            white-space: nowrap;
        }
        @keyframes fasttagMarqueeLoop {
            0% {
                transform: translateX(0);
            }
            100% {
                transform: translateX(-50%);
            }
        }
        .fasttag-marquee-track.is-looping {
            animation: fasttagMarqueeLoop var(--fasttag-marquee-speed, 12s) linear 1s infinite;
        }
        .fasttag-marquee-box:hover .fasttag-marquee-track.is-looping {
            animation-play-state: paused;
        }
        @keyframes fasttagDockPulse {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4), 0 2px 5px rgba(0, 0, 0, 0.3);
                background: rgba(99, 102, 241, 0.25);
                border-color: rgba(99, 102, 241, 0.55);
            }
            50% {
                box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2), 0 0 10px rgba(99, 102, 241, 0.6);
                background: rgba(99, 102, 241, 0.42);
                border-color: rgba(129, 140, 248, 0.85);
            }
        }
        #fasttag-inline-dock-btn, .fasttag-dock-pulse {
            animation: fasttagDockPulse 3.8s infinite ease-in-out !important;
        }
        #fasttag-inline-dock-btn:hover, .fasttag-dock-pulse:hover {
            animation-play-state: paused !important;
        }
        .tabulator-placeholder {
            pointer-events: auto !important;
            user-select: auto !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 100% !important;
            height: 100% !important;
        }
        .tabulator-placeholder * {
            pointer-events: auto !important;
        }
        .fasttag-create-empty-btn:hover {
            filter: brightness(1.15);
            transform: translateY(-1px);
        }
        @keyframes fasttagFadeInDialog {
            from { opacity: 0; transform: scale(0.96); }
            to { opacity: 1; transform: scale(1); }
        }
        .fasttag-create-dialog-card {
            animation: fasttagFadeInDialog 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fasttag-dialog-confirm-btn:hover {
            filter: brightness(1.1);
            transform: translateY(-1px);
        }
        .fasttag-dialog-cancel-btn:hover {
            background: rgba(148, 163, 184, 0.18) !important;
        }
        .fasttag-dialog-input {
            color: #ffffff !important;
        }
        .fasttag-dialog-input::selection {
            background: #6366f1 !important;
            color: #ffffff !important;
        }
        .fasttag-dialog-input:focus {
            border-color: #6366f1 !important;
            box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25) !important;
        }
        @keyframes fasttagSavePulse {
            0% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.65);
                filter: brightness(1);
            }
            50% {
                box-shadow: 0 0 14px 4px rgba(16, 185, 129, 0.45);
                filter: brightness(1.12);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.65);
                filter: brightness(1);
            }
        }
        @keyframes fasttagSavePulseCalm {
            0% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
                filter: brightness(1);
            }
            50% {
                box-shadow: 0 0 12px 3px rgba(16, 185, 129, 0.38);
                filter: brightness(1.08);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
                filter: brightness(1);
            }
        }
        .fasttag-btn-pulse {
            animation: fasttagSavePulse 1.8s infinite ease-in-out !important;
        }
        .fasttag-btn-pulse-calm {
            animation: fasttagSavePulseCalm 2.4s infinite ease-in-out !important;
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

    function showToast(message, type = "success", duration = 3000) {
        try {
            const existing = document.getElementById('fasttag-native-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.id = 'fasttag-native-toast';
            const bg = type === "success" ? "#059669" : (type === "info" ? "#6366f1" : "#dc2626");
            const icon = type === "success" ? "✓" : (type === "info" ? "ℹ" : "✕");
            toast.style.cssText = `position: fixed; top: 18px; left: 50%; transform: translateX(-50%) translateY(-10px); background: ${bg}; color: #ffffff; padding: 7px 15px; border-radius: 8px; font-size: 12px; font-weight: 600; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2000000; opacity: 0; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: none; display: inline-flex; align-items: center; gap: 6px; font-family: system-ui, -apple-system, sans-serif;`;
            toast.innerHTML = `<span style="font-size: 13px; line-height: 1;">${icon}</span><span>${escapeHtml(message)}</span>`;
            document.body.appendChild(toast);

            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });

            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(-10px)';
                setTimeout(() => { if (toast.parentNode) toast.remove(); }, 220);
            }, duration);
        } catch (e) {
            console.log(`[Toast ${type}]: ${message}`);
        }
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

    // --- Milestone & Usage Helpers ---
    const USAGE_STORAGE_KEY = 'stash_fast_tag_usage_count';

    function getUsageCount() {
        const val = localStorage.getItem(USAGE_STORAGE_KEY);
        return val === null ? 0 : (parseInt(val, 10) || 0);
    }

    function recordSaveUsage() {
        const count = getUsageCount() + 1;
        localStorage.setItem(USAGE_STORAGE_KEY, String(count));
        if (count === 100) {
            setTimeout(() => {
                showToast('🍫 Achievement Unlocked: 100 Scenes Tagged! Have a break, have a KitKat! 🎉', 'success', 7000);
            }, 500);
        }
        return count;
    }

    function isEasterEggActive() {
        const count = getUsageCount();
        return count >= 100 && count <= 105;
    }

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

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getSceneTitle(sceneData, sceneId, cardElement) {
        if (sceneData?.title && sceneData.title.trim()) {
            return sceneData.title.trim();
        }
        if (sceneData?.files && sceneData.files.length > 0 && sceneData.files[0]?.path) {
            const parts = sceneData.files[0].path.replace(/\\/g, '/').split('/').filter(Boolean);
            if (parts.length > 0) return parts[parts.length - 1];
        }
        if (cardElement) {
            const titleLink = cardElement.querySelector('.card-section-title, a.scene-card-link, .scene-card__title, .title a, a[href*="/scenes/"] span');
            const text = titleLink ? titleLink.textContent.trim() : '';
            if (text && !text.match(/^[0-9.]+\s*(?:MiB|GiB|MB|GB|KB|p|k|fps|:)/i)) {
                return text;
            }
        }
        return `Scene #${sceneId || ''}`;
    }

    function applyMarqueeAnimation(titleEl) {
        if (!titleEl) return;
        const box = titleEl.querySelector('.fasttag-marquee-box') || titleEl;
        const track = box.querySelector('.fasttag-marquee-track') || box;
        if (!track) return;

        track.classList.remove('is-looping');
        track.style.removeProperty('--fasttag-marquee-speed');

        const firstItem = track.querySelector('.fasttag-marquee-item') || track;
        const titleText = firstItem.getAttribute('data-raw-title') || firstItem.textContent || '';
        if (!titleText) return;

        // Reset track to single copy
        track.innerHTML = `<span class="fasttag-marquee-item" data-raw-title="${escapeHtml(titleText)}" title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</span>`;

        requestAnimationFrame(() => {
            const rawItem = track.querySelector('.fasttag-marquee-item');
            if (!rawItem) return;
            const singleWidth = rawItem.scrollWidth;
            const containerWidth = box.clientWidth;

            if (singleWidth > containerWidth) {
                track.innerHTML = `
                    <span class="fasttag-marquee-item" data-raw-title="${escapeHtml(titleText)}">${escapeHtml(titleText)}</span>
                    <span style="display: inline-block; margin: 0 24px; opacity: 0.4; font-size: 10px; user-select: none;">•</span>
                    <span class="fasttag-marquee-item">${escapeHtml(titleText)}</span>
                    <span style="display: inline-block; margin: 0 24px; opacity: 0.4; font-size: 10px; user-select: none;">•</span>
                `;
                const cycleWidth = singleWidth + 48;
                const duration = Math.max(6, Math.min(30, cycleWidth / 35));
                track.style.setProperty('--fasttag-marquee-speed', `${duration.toFixed(2)}s`);
                track.classList.add('is-looping');
            }
        });
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

    const SCRUB_SPEEDS_STORAGE_KEY = 'stash_fast_tag_scrub_speeds';
    const DEFAULT_SCRUB_SPEEDS = {
        slow: 5.0,
        normal: 10.0,
        fast: 20.0,
        freeze: 1.0
    };
    let hasShownScrubCueThisSession = false;
    const SCRUB_CUE_COUNT_KEY = 'stash_fast_tag_scrub_cue_count_v6';
    const MAX_SCRUB_CUE_DISPLAYS = 5;

    function getScrubCueCount() {
        try {
            return parseInt(localStorage.getItem(SCRUB_CUE_COUNT_KEY) || '0', 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    function incrementScrubCueCount() {
        try {
            const current = getScrubCueCount();
            localStorage.setItem(SCRUB_CUE_COUNT_KEY, String(current + 1));
        } catch (e) {}
    }

    let isVideoPoppedOut = false;
    let floatingHudElement = null;
    let floatingHudPosition = null;
    let floatingHudSize = null;

    function getDefaultPopoutSize(hostContainer) {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        
        let targetWidth = 600;
        if (screenW >= 2200) {
            targetWidth = 760;
        } else if (screenW >= 1600) { // 1080p standard (1920x1080)
            targetWidth = 600;
        } else if (screenW >= 1300) {
            targetWidth = 520;
        } else if (screenW >= 1000) {
            targetWidth = 460;
        } else {
            targetWidth = Math.max(300, Math.round(screenW * 0.40));
        }

        const targetHeight = Math.round(targetWidth * (9 / 16));
        return { width: `${targetWidth}px`, height: `${targetHeight}px` };
    }

    function enforceZeroOverlap(left, top, width, height, formRect, otherRect, screenWidth, screenHeight, margin = 14) {
        let finalLeft = left;
        let finalTop = top;

        // If placed to the left of formRect, ensure right edge (finalLeft + width) does not collide with formRect.left
        if (formRect && finalLeft < formRect.left) {
            if (finalLeft + width > formRect.left - margin) {
                finalLeft = Math.max(margin, formRect.left - width - margin);
            }
        }
        // If placed to the right of formRect, ensure left edge does not collide with formRect.right
        if (formRect && finalLeft < formRect.right && finalLeft + width > formRect.right) {
            finalLeft = Math.min(screenWidth - width - margin, formRect.right + margin);
        }

        // Keep strictly inside viewport bounds
        finalLeft = Math.max(margin, Math.min(screenWidth - width - margin, finalLeft));
        finalTop = Math.max(margin, Math.min(screenHeight - height - margin, finalTop));

        return {
            left: `${Math.round(finalLeft)}px`,
            top: `${Math.round(finalTop)}px`,
            width: `${Math.round(width)}px`,
            height: `${Math.round(height)}px`
        };
    }

    function getInitialPopoutPosition(hudWidth = 600, hudHeight = 338) {
        const activeForm = activePopup?.element || document.querySelector('#scenes-popup');
        const margin = 14;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const isScraperOpen = floatingScraperHudElement && document.body.contains(floatingScraperHudElement);
        const scraperRect = isScraperOpen ? floatingScraperHudElement.getBoundingClientRect() : null;

        if (activeForm) {
            const rect = activeForm.getBoundingClientRect();
            const spaceRight = Math.max(0, screenWidth - rect.right - margin);
            const spaceLeft = Math.max(0, rect.left - margin);

            // 1. If Scraper Sidecar is open:
            if (isScraperOpen && scraperRect) {
                const scraperIsOnRight = scraperRect.left >= rect.right - 50;
                const scraperIsOnLeft = scraperRect.right <= rect.left + 50;

                if (scraperIsOnRight) {
                    // Option A: 3-Pane Row - Place Video to the RIGHT of Scraper HUD
                    if (screenWidth - scraperRect.right >= hudWidth + margin) {
                        const left = Math.round(scraperRect.right + margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                    }
                    // Option B: Flank Opposite Side - Place Video on the LEFT of Main Popup
                    if (spaceLeft >= hudWidth + margin) {
                        const left = Math.round(rect.left - hudWidth - margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                    }
                    // Option C: Place Video between Popup and Scraper HUD
                    if (scraperRect.left - rect.right >= hudWidth + (margin * 2)) {
                        const left = Math.round(rect.right + margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                    }
                    // Option D: Vertical Stacking (under Scraper HUD)
                    if (screenHeight >= scraperRect.height + hudHeight + (margin * 3)) {
                        if (scraperRect.top > margin + 20 && floatingScraperHudElement) {
                            floatingScraperHudElement.style.top = `${margin}px`;
                        }
                        const top = Math.round(margin + (floatingScraperHudElement ? floatingScraperHudElement.offsetHeight : scraperRect.height) + margin);
                        const left = Math.round(scraperRect.left);
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                    }
                } else if (scraperIsOnLeft) {
                    // Option A: 3-Pane Row - Place Video to the LEFT of Scraper HUD
                    if (scraperRect.left >= hudWidth + margin) {
                        const left = Math.round(scraperRect.left - hudWidth - margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                    }
                    // Option B: Flank Opposite Side - Place Video on the RIGHT of Main Popup
                    if (spaceRight >= hudWidth + margin) {
                        const left = Math.round(rect.right + margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                    }
                    // Option C: Place Video between Scraper HUD and Popup
                    if (rect.left - scraperRect.right >= hudWidth + (margin * 2)) {
                        const left = Math.round(scraperRect.right + margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                    }
                    // Option D: Vertical Stacking (under Scraper HUD)
                    if (screenHeight >= scraperRect.height + hudHeight + (margin * 3)) {
                        if (scraperRect.top > margin + 20 && floatingScraperHudElement) {
                            floatingScraperHudElement.style.top = `${margin}px`;
                        }
                        const top = Math.round(margin + (floatingScraperHudElement ? floatingScraperHudElement.offsetHeight : scraperRect.height) + margin);
                        const left = Math.round(scraperRect.left);
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                    }
                }
            }

            // 2. Main popup is near the LEFT (Columns 1, 2) -> Place on the RIGHT of popup
            if (spaceRight >= spaceLeft && spaceRight >= hudWidth + margin) {
                const left = Math.round(rect.right + margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
            }

            // 3. Main popup is near the RIGHT (Columns 5, 6) -> Place on the LEFT of popup
            if (spaceLeft > spaceRight && spaceLeft >= hudWidth + margin) {
                const left = Math.round(rect.left - hudWidth - margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
            }

            // 4. Either side fits without nudging
            if (spaceRight >= hudWidth + margin) {
                const left = Math.round(rect.right + margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
            }
            if (spaceLeft >= hudWidth + margin) {
                const left = Math.round(rect.left - hudWidth - margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
            }

            // 5. Coordinated Shift
            if (screenWidth >= rect.width + hudWidth + (margin * 3)) {
                if (spaceLeft >= spaceRight) {
                    const newFormLeft = Math.round(screenWidth - rect.width - margin);
                    activeForm.style.left = `${newFormLeft}px`;
                    if (sequentialEditState.enabled) {
                        sequentialEditState.popupPosition = { left: newFormLeft, top: rect.top };
                    }
                    const left = Math.round(newFormLeft - hudWidth - margin);
                    const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                    return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                } else {
                    const newFormLeft = margin;
                    activeForm.style.left = `${newFormLeft}px`;
                    if (sequentialEditState.enabled) {
                        sequentialEditState.popupPosition = { left: newFormLeft, top: rect.top };
                    }
                    const left = Math.round(newFormLeft + rect.width + margin);
                    const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                    return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
                }
            }

            // 6. Vertical Stacking fallback
            if (screenHeight - rect.bottom >= hudHeight + margin) {
                const top = Math.round(rect.bottom + margin);
                const left = Math.max(margin, Math.min(screenWidth - hudWidth - margin, Math.round(rect.left)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
            }
            if (rect.top >= hudHeight + margin) {
                const top = Math.round(rect.top - hudHeight - margin);
                const left = Math.max(margin, Math.min(screenWidth - hudWidth - margin, Math.round(rect.left)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, scraperRect, screenWidth, screenHeight, margin);
            }
        }

        return { right: '30px', top: '70px', width: `${hudWidth}px`, height: `${hudHeight}px` };
    }

    function closeFloatingVideoHud(fullReset = false) {
        if (fullReset) {
            if (floatingHudElement) {
                floatingHudElement.remove();
                floatingHudElement = null;
            }
            isVideoPoppedOut = false;
            floatingHudPosition = null;
            floatingHudSize = null;
        }
    }

    const DETACH_SCRAPER_STORAGE_KEY = 'fasttag_detach_scraper_v1';
    let floatingScraperHudElement = null;
    let floatingScraperHudPosition = null;
    let floatingScraperHudSize = null;

    function getDetachScraper() {
        try {
            return localStorage.getItem(DETACH_SCRAPER_STORAGE_KEY) === 'true';
        } catch (e) {}
        return false;
    }

    function setDetachScraper(enabled) {
        try {
            localStorage.setItem(DETACH_SCRAPER_STORAGE_KEY, enabled ? 'true' : 'false');
        } catch (e) {}
    }

    function closeFloatingScraperHud(fullReset = false) {
        if (floatingScraperHudElement) {
            floatingScraperHudElement.remove();
            floatingScraperHudElement = null;
        }
        if (fullReset) {
            floatingScraperHudPosition = null;
            floatingScraperHudSize = null;
        }
    }

    function getInitialScraperPopoutPosition(hudWidth = 390, hudHeight = 480) {
        const activeForm = activePopup?.element || document.querySelector('#scenes-popup');
        const margin = 12;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        const isVideoOpen = isVideoPoppedOut && floatingHudElement && document.body.contains(floatingHudElement);
        const videoRect = isVideoOpen ? floatingHudElement.getBoundingClientRect() : null;

        if (activeForm) {
            const rect = activeForm.getBoundingClientRect();
            const spaceRight = Math.max(0, screenWidth - rect.right - margin);
            const spaceLeft = Math.max(0, rect.left - margin);

            // 1. If Video HUD is open:
            if (isVideoOpen && videoRect) {
                const videoIsOnRight = videoRect.left >= rect.right - 50;
                const videoIsOnLeft = videoRect.right <= rect.left + 50;

                if (videoIsOnRight) {
                    // Option A: 3-Pane Row - Place Scraper to the RIGHT of Video HUD
                    if (screenWidth - videoRect.right >= hudWidth + margin) {
                        const left = Math.round(videoRect.right + margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                    }
                    // Option B: Flank Opposite Side - Place Scraper on the LEFT of Main Popup
                    if (spaceLeft >= hudWidth + margin) {
                        const left = Math.round(rect.left - hudWidth - margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                    }
                    // Option C: Place Scraper between Popup and Video HUD
                    if (videoRect.left - rect.right >= hudWidth + (margin * 2)) {
                        const left = Math.round(rect.right + margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                    }
                    // Option D: Vertical Stacking (under Video HUD)
                    if (screenHeight >= videoRect.height + hudHeight + (margin * 3)) {
                        if (videoRect.top > margin + 20 && floatingHudElement) {
                            floatingHudElement.style.top = `${margin}px`;
                        }
                        const top = Math.round(margin + (floatingHudElement ? floatingHudElement.offsetHeight : videoRect.height) + margin);
                        const left = Math.round(videoRect.left);
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                    }
                } else if (videoIsOnLeft) {
                    // Option A: 3-Pane Row - Place Scraper to the LEFT of Video HUD
                    if (videoRect.left >= hudWidth + margin) {
                        const left = Math.round(videoRect.left - hudWidth - margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                    }
                    // Option B: Flank Opposite Side - Place Scraper on the RIGHT of Main Popup
                    if (spaceRight >= hudWidth + margin) {
                        const left = Math.round(rect.right + margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                    }
                    // Option C: Place Scraper between Video HUD and Popup
                    if (rect.left - videoRect.right >= hudWidth + (margin * 2)) {
                        const left = Math.round(videoRect.right + margin);
                        const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                    }
                    // Option D: Vertical Stacking (under Video HUD)
                    if (screenHeight >= videoRect.height + hudHeight + (margin * 3)) {
                        if (videoRect.top > margin + 20 && floatingHudElement) {
                            floatingHudElement.style.top = `${margin}px`;
                        }
                        const top = Math.round(margin + (floatingHudElement ? floatingHudElement.offsetHeight : videoRect.height) + margin);
                        const left = Math.round(videoRect.left);
                        return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                    }
                }
            }

            // 2. Main popup is near the LEFT (Columns 1, 2) -> Prefer RIGHT
            if (spaceRight >= spaceLeft && spaceRight >= hudWidth + margin) {
                const left = Math.round(rect.right + margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
            }

            // 3. Main popup is near the RIGHT (Columns 5, 6) -> Prefer LEFT
            if (spaceLeft > spaceRight && spaceLeft >= hudWidth + margin) {
                const left = Math.round(rect.left - hudWidth - margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
            }

            // 4. Either side fallback
            if (spaceRight >= hudWidth + margin) {
                const left = Math.round(rect.right + margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
            }
            if (spaceLeft >= hudWidth + margin) {
                const left = Math.round(rect.left - hudWidth - margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
            }

            // 5. Coordinated Shift
            if (screenWidth >= rect.width + hudWidth + (margin * 3)) {
                if (spaceLeft >= spaceRight) {
                    const newFormLeft = Math.round(screenWidth - rect.width - margin);
                    activeForm.style.left = `${newFormLeft}px`;
                    if (sequentialEditState.enabled) {
                        sequentialEditState.popupPosition = { left: newFormLeft, top: rect.top };
                    }
                    const left = Math.round(newFormLeft - hudWidth - margin);
                    const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                    return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                } else {
                    const newFormLeft = margin;
                    activeForm.style.left = `${newFormLeft}px`;
                    if (sequentialEditState.enabled) {
                        sequentialEditState.popupPosition = { left: newFormLeft, top: rect.top };
                    }
                    const left = Math.round(newFormLeft + rect.width + margin);
                    const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                    return enforceZeroOverlap(left, top, hudWidth, hudHeight, rect, videoRect, screenWidth, screenHeight, margin);
                }
            }
        }

        return { right: '20px', top: '70px', width: `${hudWidth}px`, height: `${hudHeight}px` };
    }

    function getScrubSpeeds() {
        try {
            const raw = localStorage.getItem(SCRUB_SPEEDS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return {
                    slow: Math.max(0, Math.min(30, Number(parsed.slow) !== undefined && !isNaN(Number(parsed.slow)) ? Number(parsed.slow) : DEFAULT_SCRUB_SPEEDS.slow)),
                    normal: Math.max(0, Math.min(60, Number(parsed.normal) !== undefined && !isNaN(Number(parsed.normal)) ? Number(parsed.normal) : DEFAULT_SCRUB_SPEEDS.normal)),
                    fast: Math.max(0, Math.min(120, Number(parsed.fast) !== undefined && !isNaN(Number(parsed.fast)) ? Number(parsed.fast) : DEFAULT_SCRUB_SPEEDS.fast)),
                    freeze: Math.max(0.1, Math.min(10, Number(parsed.freeze) || DEFAULT_SCRUB_SPEEDS.freeze))
                };
            }
        } catch (e) {}
        return { ...DEFAULT_SCRUB_SPEEDS };
    }

    function setScrubSpeeds(speeds) {
        localStorage.setItem(SCRUB_SPEEDS_STORAGE_KEY, JSON.stringify(speeds));
    }

    function openSettingsModal() {
        const existing = document.getElementById('fasttag-settings-modal');
        if (existing) existing.remove();

        const theme = getEffectiveTheme();
        const currentPref = getThemePreference();
        const showIds = getShowIdColumns();
        const enableSug = getEnableSuggestions();
        const scrubSpeeds = getScrubSpeeds();

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
            <div style="background: ${bg}; color: ${text}; border: 1px solid ${border}; border-radius: 12px; width: 460px; max-width: 92vw; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); overflow: hidden; font-family: inherit;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid ${border}; background: ${cardBg};">
                    <div style="font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px;">
                        <span>⚙️</span> FastTag Settings
                    </div>
                    <button id="fasttag-settings-close" style="background: none; border: none; font-size: 18px; color: ${textMuted}; cursor: pointer; line-height: 1; padding: 4px;">✕</button>
                </div>
                <div style="padding: 18px; display: flex; flex-direction: column; gap: 16px; max-height: 75vh; overflow-y: auto;">
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

                    <div style="height: 1px; background: ${border};"></div>

                    <!-- Detach Scraper Window setting -->
                    <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                        <div style="flex: 1;">
                            <div style="font-weight: 600; font-size: 13px;">Detach Scraper Window</div>
                            <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Open scraper matches in a floating sidecar window alongside the popup instead of embedding inside.</div>
                        </div>
                        <input type="checkbox" id="fasttag-setting-detach-scraper" ${getDetachScraper() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                    </div>

                    <div style="height: 1px; background: ${border};"></div>

                    <!-- Video Scrubbing Speeds setting -->
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 600; font-size: 13px;">Video Scrubbing Speeds</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Seconds skipped per wheel notch in Full Video mode (Set to 0 to disable a tier)</div>
                            </div>
                            <button type="button" id="fasttag-setting-reset-speeds" style="background: none; border: 1px solid ${border}; color: ${textMuted}; font-size: 11px; padding: 4px 8px; border-radius: 5px; cursor: pointer; transition: all 0.15s ease;">Reset Defaults</button>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <span>🐢</span> Slow Click (sec)
                                </label>
                                <input type="number" id="fasttag-speed-slow" min="0" max="30" step="1" value="${scrubSpeeds.slow}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: inherit;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <span>🚗</span> Normal Scroll (sec)
                                </label>
                                <input type="number" id="fasttag-speed-normal" min="0" max="60" step="1" value="${scrubSpeeds.normal}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: inherit;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <span>🚀</span> Fast Flick (sec)
                                </label>
                                <input type="number" id="fasttag-speed-fast" min="0" max="120" step="1" value="${scrubSpeeds.fast}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: inherit;">
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <label style="font-size: 11px; font-weight: 600; display: flex; align-items: center; gap: 4px;">
                                    <span>⏸️</span> Shift Freeze (sec)
                                </label>
                                <input type="number" id="fasttag-speed-freeze" min="0.1" max="10" step="0.5" value="${scrubSpeeds.freeze}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: inherit;">
                            </div>
                        </div>
                    <div style="height: 1px; background: ${border};"></div>

                    <!-- Reset Layouts & Sizes setting -->
                    <div style="display: flex; flex-direction: column; gap: 8px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                                    <span>📐</span> Layout & Dimensions
                                </div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Reset all customized popup sizes, column widths, and window positions back to optimal display defaults.</div>
                            </div>
                            <button type="button" id="fasttag-setting-reset-layouts" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); color: #818cf8; font-size: 11.5px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;">↺ Reset Layouts</button>
                        </div>
                    </div>
                </div>
                <div style="padding: 12px 18px; background: ${cardBg}; border-top: 1px solid ${border}; display: flex; justify-content: flex-end;">
                    <button id="fasttag-settings-done" style="background: #6366f1; color: white; border: none; padding: 7px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">Done</button>
                </div>
            </div>
        `;

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

        const detachToggle = modal.querySelector('#fasttag-setting-detach-scraper');
        if (detachToggle) {
            detachToggle.addEventListener('change', (e) => {
                setDetachScraper(e.target.checked);
                showToast(`Detached Scraper ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const speedSlowInput = modal.querySelector('#fasttag-speed-slow');
        const speedNormalInput = modal.querySelector('#fasttag-speed-normal');
        const speedFastInput = modal.querySelector('#fasttag-speed-fast');
        const speedFreezeInput = modal.querySelector('#fasttag-speed-freeze');

        const saveSpeedsFromInputs = () => {
            const parseVal = (input, min, max, def) => {
                const val = parseFloat(input?.value);
                if (isNaN(val)) return def;
                return Math.max(min, Math.min(max, val));
            };
            const newSpeeds = {
                slow: parseVal(speedSlowInput, 0, 30, DEFAULT_SCRUB_SPEEDS.slow),
                normal: parseVal(speedNormalInput, 0, 60, DEFAULT_SCRUB_SPEEDS.normal),
                fast: parseVal(speedFastInput, 0, 120, DEFAULT_SCRUB_SPEEDS.fast),
                freeze: parseVal(speedFreezeInput, 0.1, 10, DEFAULT_SCRUB_SPEEDS.freeze)
            };
            setScrubSpeeds(newSpeeds);
        };

        [speedSlowInput, speedNormalInput, speedFastInput, speedFreezeInput].forEach((inp) => {
            if (inp) {
                inp.addEventListener('input', saveSpeedsFromInputs);
                inp.addEventListener('change', saveSpeedsFromInputs);
            }
        });

        const resetSpeedsBtn = modal.querySelector('#fasttag-setting-reset-speeds');
        if (resetSpeedsBtn) {
            resetSpeedsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                setScrubSpeeds(DEFAULT_SCRUB_SPEEDS);
                localStorage.removeItem(SCRUB_CUE_COUNT_KEY);
                if (speedSlowInput) speedSlowInput.value = DEFAULT_SCRUB_SPEEDS.slow;
                if (speedNormalInput) speedNormalInput.value = DEFAULT_SCRUB_SPEEDS.normal;
                if (speedFastInput) speedFastInput.value = DEFAULT_SCRUB_SPEEDS.fast;
                if (speedFreezeInput) speedFreezeInput.value = DEFAULT_SCRUB_SPEEDS.freeze;
                showToast('Scrubbing speeds & onboarding tips reset', 'info');
            });
        }

        const resetLayoutsBtn = modal.querySelector('#fasttag-setting-reset-layouts');
        if (resetLayoutsBtn) {
            resetLayoutsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                resetAllLayoutsToDefault();
            });
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.id === 'fasttag-settings-close' || e.target.id === 'fasttag-settings-done') {
                saveSpeedsFromInputs();
                modal.remove();
            }
        });

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
        const checkedBoxes = Array.from(document.querySelectorAll('.scene-card input[type="checkbox"]:checked, .scene-card.selected, [class*="scene-card"] input[type="checkbox"]:checked, [class*="SceneCard"] input[type="checkbox"]:checked, [class*="scene-card"].selected, [class*="SceneCard"].selected'));
        const scenes = [];
        const seen = new Set();
        checkedBoxes.forEach(el => {
            const card = el.closest('.scene-card, [class*="scene-card"], [class*="SceneCard"]');
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
    function extractMediaUrlsFromCard(cardElement) {
        if (!cardElement) return { previewUrl: null, coverUrl: null };
        let previewUrl = null;
        let coverUrl = null;

        const videoNode = cardElement.querySelector('video');
        if (videoNode) {
            const vSrc = videoNode.currentSrc || videoNode.src || videoNode.getAttribute('src');
            if (vSrc && /(preview|\.mp4|\.webm|\.m4v|\.mov|\.webp|\.gif)/i.test(vSrc)) {
                previewUrl = vSrc;
            }
            const vPoster = videoNode.getAttribute('poster') || videoNode.poster;
            if (vPoster) {
                coverUrl = vPoster;
            }
        }

        const sourceNodes = cardElement.querySelectorAll('source[src]');
        for (const sNode of sourceNodes) {
            const sSrc = sNode.getAttribute('src') || sNode.src;
            if (sSrc && !previewUrl && /(preview|\.mp4|\.webm|\.m4v|\.mov|\.webp|\.gif)/i.test(sSrc)) {
                previewUrl = sSrc;
            }
        }

        const imgNodes = cardElement.querySelectorAll('img');
        for (const imgNode of imgNodes) {
            const iSrc = imgNode.currentSrc || imgNode.src || imgNode.getAttribute('src');
            if (iSrc) {
                if (!previewUrl && /(preview|\.mp4|\.webm|\.webp|\.gif)/i.test(iSrc)) {
                    previewUrl = iSrc;
                } else if (!coverUrl && /(screenshot|thumb|image|cover|\.jpe?g|\.png)/i.test(iSrc)) {
                    coverUrl = iSrc;
                } else if (!coverUrl) {
                    coverUrl = iSrc;
                }
            }
        }

        const bgNodes = cardElement.querySelectorAll('[style*="background"]');
        for (const node of bgNodes) {
            const bg = node.style.backgroundImage || node.getAttribute('style') || '';
            const match = bg.match(/url\(['"]?([^'"]+)['"]?\)/i);
            if (match && match[1]) {
                const src = match[1];
                if (!coverUrl && /(screenshot|thumb|image|cover|\/scene\/)/i.test(src)) {
                    coverUrl = src;
                }
            }
        }

        return { previewUrl, coverUrl };
    }

    async function fetchSceneMediaUrls(sceneId, cardElement) {
        const cardMedia = extractMediaUrlsFromCard(cardElement);
        let previewUrl = cardMedia.previewUrl;
        let coverUrl = cardMedia.coverUrl;
        let streamUrl = null;
        let previewExplicitlyMissing = false;

        if (sceneId) {
            const queries = [
                `query ($id: ID!) { findScene(id: $id) { paths { preview screenshot webp stream } } }`,
                `query ($id: ID!) { findScene(id: $id) { paths { preview screenshot stream } } }`,
                `query ($id: ID!) { findScene(id: $id) { paths { preview screenshot } } }`,
                `query ($id: ID!) { findScene(id: $id) { preview screenshot } }`
            ];

            for (const query of queries) {
                try {
                    const res = await fetchGQL(query, { id: sceneId });
                    if (res.errors) continue;
                    const scene = res.data?.findScene;
                    if (!scene) continue;

                    const gqlPreview = scene.paths?.preview || scene.preview || scene.paths?.webp || null;
                    const gqlScreenshot = scene.paths?.screenshot || scene.screenshot || null;
                    const gqlStream = scene.paths?.stream || null;

                    if (gqlPreview) {
                        previewUrl = gqlPreview;
                    } else if (scene.paths && ('preview' in scene.paths) && !scene.paths.preview && !scene.paths.webp) {
                        // Stash explicitly reports that no preview was generated
                        previewUrl = null;
                        previewExplicitlyMissing = true;
                    }

                    if (gqlScreenshot) {
                        coverUrl = gqlScreenshot;
                    }
                    if (gqlStream) {
                        streamUrl = gqlStream;
                    }
                    break;
                } catch (error) {
                    console.error('FastTag: preview fetch failed', error);
                }
            }
        }

        const baseOrigin = window.location.origin || 'http://localhost:9999';
        if (!coverUrl && sceneId) {
            coverUrl = `${baseOrigin}/scene/${encodeURIComponent(sceneId)}/screenshot`;
        }
        if (!streamUrl && sceneId) {
            streamUrl = `${baseOrigin}/scene/${encodeURIComponent(sceneId)}/stream`;
        }
        if (!previewUrl && !previewExplicitlyMissing && sceneId) {
            previewUrl = `${baseOrigin}/scene/${encodeURIComponent(sceneId)}/preview`;
        }

        return { previewUrl, coverUrl, streamUrl };
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const totalSecs = Math.floor(seconds);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        if (hrs > 0) {
            return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
        }
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

        // Media container holds the active video/img, progress bar, cue badge, and top-right controls
        const mediaContainer = document.createElement('div');
        mediaContainer.id = 'fasttag-media-container';
        mediaContainer.style.cssText = 'position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #0f172a; cursor: pointer;';

        let isDragging = false;
        let hasDragged = false;
        let dragStartX = 0, dragStartY = 0;
        let startLeft = 0, startTop = 0;

        mediaContainer.onclick = (e) => {
            if (isVideoPoppedOut) return; // Do NOT open scene when video is popped out into floating HUD
            if (e.shiftKey || hasDragged || isDragging) return;
            if (e.target && (e.target.closest('#fasttag-stream-toggle-pill') || e.target.closest('#fasttag-stream-popout-btn') || e.target.closest('#fasttag-hud-close-btn') || e.target.closest('#fasttag-inline-dock-btn'))) return;
            const sceneUrl = getSceneUrl(sceneId, cardElement);
            if (sceneUrl) {
                window.open(sceneUrl, '_blank');
            }
        };

        const { previewUrl, coverUrl, streamUrl } = await fetchSceneMediaUrls(sceneId, cardElement);
        if (signal.aborted) return;

        if (!previewUrl && !coverUrl && !streamUrl) {
            hostContainer.style.display = 'none';
            return;
        }

        let currentMode = 'preview'; // 'preview' or 'stream'
        let currentMedia = null;
        let wheelListenerAttached = false;
        let resumeTimer = null;
        let hudTimer = null;
        let scrubbing = false;
        let wasPlaying = false;
        let originalLoop = true;
        let shiftHeld = false;
        let isHovered = false;

        // Slim Progress Bar at the very bottom edge (no text/numbers)
        const progressBarBg = document.createElement('div');
        progressBarBg.id = 'fasttag-progress-bar-bg';
        progressBarBg.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(0, 0, 0, 0.45); z-index: 15; pointer-events: none; opacity: 0; transition: opacity 0.2s ease;';

        const progressBarFill = document.createElement('div');
        progressBarFill.id = 'fasttag-progress-bar-fill';
        progressBarFill.style.cssText = 'height: 100%; width: 0%; background: #6366f1; border-radius: 0 2px 2px 0; transition: width 0.08s linear;';
        progressBarBg.appendChild(progressBarFill);

        const updateProgressBar = () => {
            if (currentMedia && currentMedia.tagName === 'VIDEO' && currentMedia.duration > 0 && isFinite(currentMedia.duration)) {
                const pct = Math.min(100, Math.max(0, (currentMedia.currentTime / currentMedia.duration) * 100));
                progressBarFill.style.width = `${pct}%`;
            }
        };

        let progressBarTimer = null;
        const showProgressBar = () => {
            if (currentMode !== 'stream') return;
            updateProgressBar();
            progressBarBg.style.opacity = '1';
            clearTimeout(progressBarTimer);
            if (!shiftHeld) {
                progressBarTimer = setTimeout(() => {
                    progressBarBg.style.opacity = '0';
                }, 1500);
            }
        };

        // Floating Stream Cue Hint (appears once per session on switching to Full Video)
        const cueBadge = document.createElement('div');
        cueBadge.id = 'fasttag-scrub-cue-badge';
        cueBadge.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.85); z-index: 25; pointer-events: none; opacity: 0; transition: opacity 0.4s ease-out, transform 0.4s ease-out; display: flex; flex-direction: column; align-items: center; gap: 7px; user-select: none; white-space: nowrap;';
        cueBadge.innerHTML = `
            <div style="width: 86px; height: 74px; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1.5px solid rgba(255, 255, 255, 0.22); border-radius: 15px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 28px rgba(0,0,0,0.6), inset 0 0 0 1.5px rgba(8, 168, 138, 0.28);">
                <svg width="29" height="55" viewBox="0 0 24 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <!-- Static Top Arrow (Teal) -->
                    <path d="M7 5.5L12 1.5L17 5.5" stroke="#08a88a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>

                    <!-- Outer Capsule Body -->
                    <rect x="2.5" y="8.5" width="19" height="29" rx="9.5" stroke="#f8fafc" stroke-width="2.4"/>

                    <!-- Curved Horizontal Divider Arc -->
                    <path d="M2.5 19.5C6.5 22 17.5 22 21.5 19.5" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/>

                    <!-- Center Vertical Split Line -->
                    <line x1="12" y1="8.5" x2="12" y2="21" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/>

                    <!-- Animated Lordicon Teal Wheel Pill -->
                    <g>
                        <rect x="9.2" y="11.5" width="5.6" height="10" rx="2.8" stroke="#08a88a" stroke-width="2.2" fill="rgba(15, 23, 42, 0.6)">
                            <animateTransform attributeName="transform" type="translate" values="0,0; 0,3.5; 0,0" dur="1.2s" repeatCount="indefinite" />
                        </rect>
                    </g>

                    <!-- Static Bottom Arrow (Teal) -->
                    <path d="M7 40.5L12 44.5L17 40.5" stroke="#08a88a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div style="background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 600; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.95); display: flex; align-items: center; gap: 5px; box-shadow: 0 4px 14px rgba(0,0,0,0.65);">
                <span style="color: #ffffff;">Scroll to scrub</span>
                <span style="opacity: 0.4;">•</span>
                <span style="color: #e2e8f0; font-weight: 500;">Hold <kbd style="background: rgba(255,255,255,0.18); padding: 0.5px 4px; border-radius: 3px; font-family: monospace; font-size: 10px; color: #38bdf8; border: 1px solid rgba(255,255,255,0.25);">Shift</kbd> to freeze</span>
            </div>
        `;

        let cueTimer = null;
        let cueDelayTimer = null;
        const showCueOnce = () => {
            if (hasShownScrubCueThisSession) return;
            if (getScrubCueCount() >= MAX_SCRUB_CUE_DISPLAYS) return;

            hasShownScrubCueThisSession = true;

            clearTimeout(cueDelayTimer);
            clearTimeout(cueTimer);
            cueBadge.style.transition = 'opacity 1.5s cubic-bezier(0.16, 1, 0.3, 1), transform 1.5s cubic-bezier(0.16, 1, 0.3, 1)';
            cueBadge.style.opacity = '0';
            cueBadge.style.transform = 'translate(-50%, -50%) scale(0.88)';
            
            // 3000ms (3.0s) breathing room for the stream video to transition & start playing first
            cueDelayTimer = setTimeout(() => {
                cueBadge.style.opacity = '1';
                cueBadge.style.transform = 'translate(-50%, -50%) scale(1)';
                incrementScrubCueCount();

                cueTimer = setTimeout(() => {
                    cueBadge.style.transition = 'opacity 0.9s cubic-bezier(0.2, 0.8, 0.4, 1), transform 0.9s cubic-bezier(0.2, 0.8, 0.4, 1)';
                    cueBadge.style.opacity = '0';
                    cueBadge.style.transform = 'translate(-50%, -50%) scale(0.9)';
                }, 4500);
            }, 3000);
        };
        const hideCueImmediate = () => {
            clearTimeout(cueTimer);
            cueBadge.style.transition = 'opacity 0.15s ease';
            cueBadge.style.opacity = '0';
        };

        // Controls row at top-right of media container
        const controlsRow = document.createElement('div');
        controlsRow.id = 'fasttag-media-controls-row';
        controlsRow.style.cssText = 'position: absolute; top: 5px; right: 5px; z-index: 20; display: flex; align-items: center; gap: 4px; pointer-events: auto;';

        // Floating Mode Toggle Pill (compact & clear)
        const pillBtn = document.createElement('div');
        pillBtn.id = 'fasttag-stream-toggle-pill';
        pillBtn.style.cssText = 'background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; padding: 2.5px 8px; font-size: 10px; font-weight: 600; cursor: pointer; user-select: none; display: flex; align-items: center; gap: 4px; opacity: 0.85; box-shadow: 0 2px 6px rgba(0,0,0,0.4); transition: all 0.15s ease; line-height: 1;';
        
        pillBtn.onmouseenter = () => {
            pillBtn.style.opacity = '1';
            pillBtn.style.background = '#6366f1';
            pillBtn.style.borderColor = '#818cf8';
            pillBtn.style.transform = 'scale(1.04)';
        };
        pillBtn.onmouseleave = () => {
            pillBtn.style.opacity = '0.85';
            pillBtn.style.background = 'rgba(15, 23, 42, 0.78)';
            pillBtn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            pillBtn.style.transform = 'scale(1)';
        };

        const updatePill = (mode) => {
            if (mode === 'stream') {
                pillBtn.style.display = 'none';
            } else {
                pillBtn.style.display = 'flex';
                pillBtn.innerHTML = '🎬 Full Video';
                pillBtn.removeAttribute('title');
                pillBtn.setAttribute('data-micro-tooltip', 'Switch to full scene video stream (Scroll to scrub, Hold Shift to freeze)');
            }
        };

        pillBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            renderMedia('stream');
        };

        // Popout Button (Icon only: ⤢, clear & crisp)
        const popoutBtn = document.createElement('button');
        popoutBtn.type = 'button';
        popoutBtn.id = 'fasttag-stream-popout-btn';
        popoutBtn.style.cssText = 'background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; padding: 2px 7px; font-size: 11.5px; font-weight: 600; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: center; opacity: 0.85; box-shadow: 0 2px 6px rgba(0,0,0,0.4); transition: all 0.15s ease; line-height: 1; min-width: 23px; height: 20px;';
        popoutBtn.innerHTML = '⤢';
        popoutBtn.setAttribute('data-micro-tooltip', 'Pop out video into floating HUD');

        popoutBtn.onmouseenter = () => {
            popoutBtn.style.opacity = '1';
            popoutBtn.style.background = '#6366f1';
            popoutBtn.style.borderColor = '#818cf8';
            popoutBtn.style.transform = 'scale(1.08)';
        };
        popoutBtn.onmouseleave = () => {
            popoutBtn.style.opacity = '0.85';
            popoutBtn.style.background = 'rgba(15, 23, 42, 0.78)';
            popoutBtn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            popoutBtn.style.transform = 'scale(1)';
        };

        controlsRow.appendChild(pillBtn);
        controlsRow.appendChild(popoutBtn);

        const togglePopout = (enable) => {
            if (enable) {
                isVideoPoppedOut = true;

                let isDragging = false;
                let hasDragged = false;
                let dragStartX = 0;
                let dragStartY = 0;
                let startLeft = 0;
                let startTop = 0;

                const onHudMouseMove = (e) => {
                    if (!floatingHudElement) return;
                    const dx = e.clientX - dragStartX;
                    const dy = e.clientY - dragStartY;
                    if (!isDragging && Math.hypot(dx, dy) > 4) {
                        isDragging = true;
                        hasDragged = true;
                        floatingHudElement.style.cursor = 'grabbing';
                        document.body.style.cursor = 'grabbing';
                        document.body.style.userSelect = 'none';
                    }
                    if (isDragging) {
                        const newLeft = Math.max(8, Math.min(window.innerWidth - floatingHudElement.offsetWidth - 8, startLeft + dx));
                        const newTop = Math.max(8, Math.min(window.innerHeight - floatingHudElement.offsetHeight - 8, startTop + dy));
                        floatingHudElement.style.left = `${newLeft}px`;
                        floatingHudElement.style.top = `${newTop}px`;
                        floatingHudElement.style.right = 'auto';
                        floatingHudPosition = { top: `${newTop}px`, left: `${newLeft}px` };
                    }
                };

                const onHudMouseUp = () => {
                    document.removeEventListener('mousemove', onHudMouseMove);
                    document.removeEventListener('mouseup', onHudMouseUp);
                    if (floatingHudElement) {
                        floatingHudElement.style.cursor = 'default';
                    }
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    if (isDragging && floatingHudElement) {
                        floatingHudSize = { width: `${floatingHudElement.offsetWidth}px`, height: `${floatingHudElement.offsetHeight}px` };
                    }
                    setTimeout(() => { isDragging = false; hasDragged = false; }, 60);
                };

                if (!floatingHudElement || !document.body.contains(floatingHudElement)) {
                    floatingHudElement = document.createElement('div');
                    floatingHudElement.id = 'fasttag-floating-video-hud';
                    const defaultSize = getDefaultPopoutSize(hostContainer);
                    const defaultPos = getInitialPopoutPosition(parseInt(defaultSize.width, 10) || 600, parseInt(defaultSize.height, 10) || 338);
                    
                    let finalWidth = defaultPos.width || defaultSize.width;
                    let finalHeight = defaultPos.height || defaultSize.height;
                    let finalLeft = defaultPos.left;
                    let finalTop = defaultPos.top;
                    let finalRight = defaultPos.right;

                    // Check if user's remembered floatingHudPosition is valid and strictly non-overlapping
                    const activeForm = activePopup?.element || document.querySelector('#scenes-popup');
                    const isScraperOpen = floatingScraperHudElement && document.body.contains(floatingScraperHudElement);
                    const scraperRect = isScraperOpen ? floatingScraperHudElement.getBoundingClientRect() : null;
                    const formRect = activeForm ? activeForm.getBoundingClientRect() : null;

                    let isPositionValid = false;
                    if (floatingHudPosition && floatingHudPosition.left && floatingHudPosition.top) {
                        const pLeft = parseInt(floatingHudPosition.left, 10);
                        const pTop = parseInt(floatingHudPosition.top, 10);
                        const pW = floatingHudSize?.width ? parseInt(floatingHudSize.width, 10) : parseInt(finalWidth, 10);
                        const pH = floatingHudSize?.height ? parseInt(floatingHudSize.height, 10) : parseInt(finalHeight, 10);

                        const collidesWithForm = formRect && !(pLeft + pW <= formRect.left + 5 || pLeft >= formRect.right - 5 || pTop + pH <= formRect.top + 5 || pTop >= formRect.bottom - 5);
                        const collidesWithScraper = scraperRect && !(pLeft + pW <= scraperRect.left + 5 || pLeft >= scraperRect.right - 5 || pTop + pH <= scraperRect.top + 5 || pTop >= scraperRect.bottom - 5);

                        if (!collidesWithForm && !collidesWithScraper) {
                            finalLeft = floatingHudPosition.left;
                            finalTop = floatingHudPosition.top;
                            finalRight = null;
                            if (floatingHudSize) {
                                finalWidth = floatingHudSize.width;
                                finalHeight = floatingHudSize.height;
                            }
                            isPositionValid = true;
                        }
                    }
                    if (!isPositionValid) {
                        floatingHudPosition = null;
                    }

                    floatingHudElement.style.cssText = `position: fixed; top: ${finalTop}; ${finalLeft ? `left: ${finalLeft};` : `right: ${finalRight};`} width: ${finalWidth}; height: ${finalHeight}; min-width: 260px; min-height: 150px; max-width: 90vw; max-height: 85vh; z-index: 1000000; background: #0f172a; border: 2px solid #000000; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; resize: both; cursor: default;`;
                    document.body.appendChild(floatingHudElement);

                    // Draggable logic directly on floating video
                    floatingHudElement.onmousedown = (e) => {
                        e.stopPropagation();
                        if (e.target && e.target.closest('#fasttag-stream-toggle-pill')) {
                            return;
                        }
                        const rect = floatingHudElement.getBoundingClientRect();
                        // Don't initiate drag if clicking in the bottom-right corner resize zone
                        const isResizeZone = (rect.right - e.clientX) <= 24 && (rect.bottom - e.clientY) <= 24;
                        if (isResizeZone) {
                            return;
                        }

                        isDragging = false;
                        hasDragged = false;
                        dragStartX = e.clientX;
                        dragStartY = e.clientY;
                        startLeft = rect.left;
                        startTop = rect.top;
                        document.addEventListener('mousemove', onHudMouseMove);
                        document.addEventListener('mouseup', onHudMouseUp);
                    };

                    // Resize tracking
                    const resizeObserver = new ResizeObserver(() => {
                        if (floatingHudElement && !isDragging) {
                            floatingHudSize = { width: `${floatingHudElement.offsetWidth}px`, height: `${floatingHudElement.offsetHeight}px` };
                        }
                    });
                    resizeObserver.observe(floatingHudElement);
                }

                // Smoothly swap content inside floating window
                floatingHudElement.innerHTML = '';
                mediaContainer.style.cursor = 'default';
                mediaContainer.title = '';
                floatingHudElement.appendChild(mediaContainer);

                // Hide popout button while inside floating window
                popoutBtn.style.display = 'none';

                // Show slim interactive placeholder in main popup
                hostContainer.innerHTML = '';
                hostContainer.style.aspectRatio = 'auto';
                hostContainer.style.height = '33px';
                hostContainer.style.maxHeight = '33px';
                hostContainer.style.margin = '0 0 7px 0';
                hostContainer.style.background = 'rgba(15, 23, 42, 0.75)';
                hostContainer.style.border = '1px dashed rgba(99, 102, 241, 0.45)';
                hostContainer.style.borderRadius = '8px';
                hostContainer.style.display = 'flex';
                hostContainer.style.alignItems = 'center';
                hostContainer.style.justifyContent = 'space-between';
                hostContainer.style.padding = '0 5px 0 10px';
                hostContainer.style.cursor = 'pointer';
                hostContainer.title = 'Click to dock video back into popup';

                const placeholderLabel = document.createElement('span');
                placeholderLabel.style.cssText = 'font-size: 11.5px; color: #a5b4fc; display: flex; align-items: center; gap: 6px; font-weight: 600; user-select: none;';
                placeholderLabel.innerHTML = '<span style="display: inline-block; width: 6.5px; height: 6.5px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);"></span> Video detached in Floating HUD';
                hostContainer.appendChild(placeholderLabel);

                const inlineDockBtn = document.createElement('button');
                inlineDockBtn.type = 'button';
                inlineDockBtn.id = 'fasttag-inline-dock-btn';
                inlineDockBtn.style.cssText = 'background: rgba(99, 102, 241, 0.25); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); color: #ffffff; border: 1px solid rgba(99, 102, 241, 0.55); border-radius: 12px; padding: 2px 9px; font-size: 13px; font-weight: 700; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: center; opacity: 0.9; box-shadow: 0 2px 5px rgba(0,0,0,0.3); transition: all 0.15s ease; min-width: 26px; height: 23px; line-height: 1;';
                inlineDockBtn.innerHTML = '⤝';
                inlineDockBtn.setAttribute('data-micro-tooltip', 'Dock video back into popup');
                inlineDockBtn.onmouseenter = () => { inlineDockBtn.style.opacity = '1'; inlineDockBtn.style.background = '#6366f1'; inlineDockBtn.style.borderColor = '#818cf8'; inlineDockBtn.style.transform = 'scale(1.06)'; };
                inlineDockBtn.onmouseleave = () => { inlineDockBtn.style.opacity = '0.9'; inlineDockBtn.style.background = 'rgba(99, 102, 241, 0.25)'; inlineDockBtn.style.borderColor = 'rgba(99, 102, 241, 0.55)'; inlineDockBtn.style.transform = 'scale(1)'; };
                inlineDockBtn.onclick = (e) => { e.stopPropagation(); togglePopout(false); };
                hostContainer.appendChild(inlineDockBtn);

                hostContainer.onclick = (e) => {
                    e.stopPropagation();
                    togglePopout(false);
                };

            } else {
                isVideoPoppedOut = false;
                if (floatingHudElement) {
                    floatingHudElement.remove();
                    floatingHudElement = null;
                }
                hostContainer.onclick = null;
                hostContainer.innerHTML = '';
                hostContainer.style.display = 'block';
                hostContainer.style.position = 'relative';
                hostContainer.style.width = '100%';
                hostContainer.style.height = 'auto';
                hostContainer.style.aspectRatio = '16 / 9';
                hostContainer.style.maxHeight = '280px';
                hostContainer.style.margin = '0 0 10px 0';
                hostContainer.style.borderRadius = '8px';
                hostContainer.style.overflow = 'hidden';
                hostContainer.style.border = 'none';
                hostContainer.style.background = '#0f172a';
                hostContainer.style.boxShadow = 'none';
                hostContainer.style.padding = '0';
                hostContainer.style.cursor = 'pointer';
                hostContainer.title = '';
                mediaContainer.style.cursor = 'pointer';
                mediaContainer.title = 'Click to open scene in new tab';
                hostContainer.appendChild(mediaContainer);
                popoutBtn.style.display = 'flex';
            }
        };

        popoutBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            togglePopout(true);
        };

        const detachWheel = () => {
            if (wheelListenerAttached) {
                mediaContainer.removeEventListener('wheel', onWheel);
                wheelListenerAttached = false;
            }
        };

        const attachWheel = () => {
            if (!wheelListenerAttached && currentMode === 'stream') {
                mediaContainer.addEventListener('wheel', onWheel, { passive: false, signal });
                wheelListenerAttached = true;
            }
        };

        const endScrubbing = () => {
            scrubbing = false;
            if (currentMedia && currentMedia.tagName === 'VIDEO' && !shiftHeld) {
                try { currentMedia.loop = !!originalLoop; } catch (err) {}
                if (wasPlaying) {
                    currentMedia.play().catch(() => {});
                    wasPlaying = false;
                }
            }
        };

        let lastWheelTimestamp = 0;

        var onWheel = (e) => {
            if (currentMode !== 'stream') return;
            e.preventDefault();
            hideCueImmediate();
            if (!currentMedia || currentMedia.tagName !== 'VIDEO' || currentMedia.duration <= 0 || !isFinite(currentMedia.duration)) return;

            // Handle both vertical deltaY and horizontal deltaX across all mouse types
            const rawDelta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            if (!rawDelta || isNaN(rawDelta)) return;

            const now = performance.now();
            const timeDelta = lastWheelTimestamp > 0 ? (now - lastWheelTimestamp) : 300;
            lastWheelTimestamp = now;

            const scrubSpeeds = getScrubSpeeds();

            // Step size calculation:
            // When Shift is held -> fixed precision frame step from settings
            // When Shift is NOT held -> velocity-based dynamic step size with 0-disabled tier fallbacks
            let step = scrubSpeeds.freeze;
            if (!shiftHeld) {
                const s = scrubSpeeds.slow > 0 ? scrubSpeeds.slow : 0;
                const n = scrubSpeeds.normal > 0 ? scrubSpeeds.normal : 0;
                const f = scrubSpeeds.fast > 0 ? scrubSpeeds.fast : 0;

                if (timeDelta < 80) {
                    step = f || n || s || 10.0;
                } else if (timeDelta < 200) {
                    step = n || s || f || 10.0;
                } else {
                    step = s || n || f || 10.0;
                }
            }

            const notches = e.deltaMode === 1 ? rawDelta : (rawDelta / 60);
            if (Math.abs(notches) < 0.05) return;

            if (!scrubbing) {
                scrubbing = true;
                originalLoop = !!currentMedia.loop;
                try { currentMedia.loop = false; } catch (err) {}
            }

            if (!currentMedia.paused && !currentMedia.ended) {
                wasPlaying = true;
                try { currentMedia.pause(); } catch (err) {}
            }

            const direction = -Math.sign(notches);
            const scrubSeconds = direction * step;
            currentMedia.currentTime = Math.min(currentMedia.duration, Math.max(0, currentMedia.currentTime + scrubSeconds));
            clearTimeout(resumeTimer);

            showProgressBar();

            // If Shift is NOT held to freeze, automatically resume playback 300ms after scrolling stops
            if (!shiftHeld) {
                resumeTimer = setTimeout(endScrubbing, 300);
            }
        };

        const renderMedia = (mode) => {
            if (signal.aborted) return;
            currentMode = mode;
            updatePill(mode);

            // Teardown previous media
            if (currentMedia) {
                if (currentMedia.tagName === 'VIDEO') {
                    try {
                        currentMedia.pause();
                        currentMedia.removeAttribute('src');
                        currentMedia.load();
                    } catch (e) {}
                }
                currentMedia.remove();
                currentMedia = null;
            }

            detachWheel();
            clearTimeout(resumeTimer);
            clearTimeout(progressBarTimer);

            if (mode === 'stream') {
                if (!streamUrl) {
                    showToast('Stream URL not available', 'warning');
                    renderMedia('preview');
                    return;
                }

                showCueOnce();

                const video = document.createElement('video');
                video.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: cover; background: #0f172a; pointer-events: none;';
                video.muted = true;
                video.defaultMuted = true;
                video.volume = 0;
                video.autoplay = true;
                video.loop = true;
                video.playsInline = true;
                video.preload = 'auto';
                video.setAttribute('playsinline', 'true');
                video.setAttribute('webkit-playsinline', 'true');
                video.setAttribute('muted', '');
                video.src = streamUrl;

                video.onerror = () => {
                    showToast('Full stream playback failed (unsupported codec)', 'warning');
                    renderMedia('preview');
                };

                video.addEventListener('timeupdate', updateProgressBar);
                video.onloadedmetadata = () => {
                    showProgressBar();
                };

                currentMedia = video;
                mediaContainer.insertBefore(video, mediaContainer.firstChild);
                video.load();
                video.play().catch(() => {});
                if (isHovered) attachWheel();
            } else {
                hideCueImmediate();
                progressBarBg.style.opacity = '0';
                progressBarFill.style.width = '0%';

                // Preview mode
                if (previewUrl) {
                    const isVideo = /\/preview(?:[?#]|$)|\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(previewUrl);
                    if (isVideo) {
                        const video = document.createElement('video');
                        video.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: cover; background: #0f172a; pointer-events: none;';
                        video.muted = true;
                        video.defaultMuted = true;
                        video.volume = 0;
                        video.autoplay = true;
                        video.loop = true;
                        video.playsInline = true;
                        video.preload = 'auto';
                        video.setAttribute('playsinline', 'true');
                        video.setAttribute('webkit-playsinline', 'true');
                        video.setAttribute('muted', '');
                        video.src = previewUrl;

                        video.onerror = () => {
                            renderCoverOnly();
                        };
                        video.addEventListener('error', () => {
                            renderCoverOnly();
                        });

                        currentMedia = video;
                        mediaContainer.insertBefore(video, mediaContainer.firstChild);
                        video.load();
                        video.play().catch(() => {});
                    } else {
                        // Image/webp preview
                        const img = document.createElement('img');
                        img.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: cover; background: #0f172a; pointer-events: none;';
                        img.alt = 'Scene preview';
                        img.loading = 'eager';
                        img.src = previewUrl;
                        img.onerror = () => {
                            renderCoverOnly();
                        };
                        currentMedia = img;
                        mediaContainer.insertBefore(img, mediaContainer.firstChild);
                    }
                } else {
                    renderCoverOnly();
                }
            }
        };

        const renderCoverOnly = () => {
            hideCueImmediate();
            progressBarBg.style.opacity = '0';
            clearTimeout(progressBarTimer);
            if (currentMedia) {
                if (currentMedia.tagName === 'VIDEO') {
                    try { currentMedia.pause(); currentMedia.removeAttribute('src'); currentMedia.load(); } catch (e) {}
                }
                currentMedia.remove();
                currentMedia = null;
            }
            if (!coverUrl) {
                hostContainer.style.display = 'none';
                return;
            }
            const img = document.createElement('img');
            img.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: cover; background: #0f172a; pointer-events: none;';
            img.alt = 'Scene cover';
            img.loading = 'eager';
            img.onerror = () => {
                hostContainer.style.display = 'none';
            };
            img.src = coverUrl;
            currentMedia = img;
            mediaContainer.insertBefore(img, mediaContainer.firstChild);
        };

        // Append Progress Bar, Cue Badge, and Controls Row into mediaContainer
        mediaContainer.appendChild(progressBarBg);
        mediaContainer.appendChild(cueBadge);
        mediaContainer.appendChild(controlsRow);

        // Hover & Key Listeners for Scrubbing & Hold-to-Freeze attached to mediaContainer
        mediaContainer.onmouseenter = () => {
            isHovered = true;
            if (currentMode === 'stream') {
                attachWheel();
            }
        };

        mediaContainer.onmouseleave = () => {
            isHovered = false;
            detachWheel();
            if (shiftHeld) {
                shiftHeld = false;
                clearTimeout(resumeTimer);
                clearTimeout(progressBarTimer);
                progressBarBg.style.opacity = '0';
                if (currentMedia && currentMedia.tagName === 'VIDEO') {
                    currentMedia.play().catch(() => {});
                }
            }
            endScrubbing();
        };

        const onKeyDown = (e) => {
            if (currentMode !== 'stream') return;
            if (e.key === 'Shift' && !shiftHeld && isHovered) {
                shiftHeld = true;
                hideCueImmediate();
                clearTimeout(resumeTimer);
                clearTimeout(progressBarTimer);
                progressBarBg.style.opacity = '1';
                updateProgressBar();
                if (currentMedia && currentMedia.tagName === 'VIDEO') {
                    if (!currentMedia.paused && !currentMedia.ended) {
                        wasPlaying = true;
                        try { currentMedia.pause(); } catch (err) {}
                    }
                }
            }
        };

        const onKeyUp = (e) => {
            if (currentMode !== 'stream') return;
            if (e.key === 'Shift' && shiftHeld) {
                shiftHeld = false;
                clearTimeout(resumeTimer);
                clearTimeout(progressBarTimer);
                progressBarTimer = setTimeout(() => {
                    progressBarBg.style.opacity = '0';
                }, 1500);
                if (currentMedia && currentMedia.tagName === 'VIDEO') {
                    try { currentMedia.loop = !!originalLoop; } catch (err) {}
                    currentMedia.play().catch(() => {});
                    wasPlaying = false;
                }
            }
        };

        const onWindowBlur = () => {
            if (shiftHeld) {
                shiftHeld = false;
                clearTimeout(resumeTimer);
                clearTimeout(progressBarTimer);
                progressBarBg.style.opacity = '0';
                if (currentMedia && currentMedia.tagName === 'VIDEO') {
                    currentMedia.play().catch(() => {});
                }
            }
        };

        document.addEventListener('keydown', onKeyDown, { signal });
        document.addEventListener('keyup', onKeyUp, { signal });
        window.addEventListener('blur', onWindowBlur, { signal });

        // Initial render
        renderMedia('preview');

        // Initial Popout State sync
        if (isVideoPoppedOut) {
            togglePopout(true);
        } else {
            hostContainer.appendChild(mediaContainer);
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
        const cards = document.querySelectorAll('.scene-card, [class*="scene-card"], [class*="SceneCard"]');
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

        const sceneTitle = getSceneTitle(form._fastTagSceneData, form._fastTagSceneId, form._fastTagSceneCard);

        const icon = config.icon || '🏷️';
        const iconStyle = `display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; font-size: 13px; line-height: 1; flex-shrink: 0; margin-right: 7px; user-select: none; transform: translateY(1.5px);`;

        const isChanged = hasSelectionChanged(selectedIds);

        if (!sequentialEditState.enabled) {
            if (navGroup) {
                navGroup.style.maxWidth = '0';
                navGroup.style.opacity = '0';
            }
            if (modeCheckbox) modeCheckbox.checked = false;
            if (title) {
                title.innerHTML = `<span style="${iconStyle}">${icon}</span><span class="fasttag-marquee-box" style="flex: 1; min-width: 0; overflow: hidden; display: inline-flex; align-items: center;"><span class="fasttag-marquee-track"><span class="fasttag-marquee-item" data-raw-title="${escapeHtml(sceneTitle)}" title="${escapeHtml(sceneTitle)}">${escapeHtml(sceneTitle)}</span></span></span>`;
                title.title = sceneTitle;
                applyMarqueeAnimation(title);
            }
            if (saveBtn) {
                saveBtn.textContent = isEasterEggActive() ? `Save ${config.pluralTitle} 🍫` : `Save ${config.pluralTitle}`;
                if (isChanged) {
                    saveBtn.disabled = false;
                    saveBtn.style.opacity = '1';
                    saveBtn.style.cursor = 'pointer';
                    saveBtn.style.background = '#10b981';
                    saveBtn.classList.add('fasttag-btn-pulse');
                } else {
                    saveBtn.disabled = true;
                    saveBtn.style.opacity = '0.45';
                    saveBtn.style.cursor = 'not-allowed';
                    saveBtn.style.background = '#475569';
                    saveBtn.classList.remove('fasttag-btn-pulse');
                }
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
        const isLast = currentNum >= totalNum;

        if (title) {
            title.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; font-size: 13px; line-height: 1; flex-shrink: 0; margin-right: 4px; user-select: none; transform: translateY(1.5px);">${icon}</span><span style="opacity: 0.85; font-size: 11px; background: rgba(99,102,241,0.22); padding: 1px 6px; border-radius: 4px; margin-right: 7px; font-weight: 700; color: #a5b4fc; white-space: nowrap; flex-shrink: 0; line-height: 1.3;">[${currentNum}/${totalNum}]</span><span class="fasttag-marquee-box" style="flex: 1; min-width: 0; overflow: hidden; display: inline-flex; align-items: center;"><span class="fasttag-marquee-track"><span class="fasttag-marquee-item" data-raw-title="${escapeHtml(sceneTitle)}" title="${escapeHtml(sceneTitle)}">${escapeHtml(sceneTitle)}</span></span></span>`;
            title.title = `${sceneTitle} [${currentNum}/${totalNum}]`;
            applyMarqueeAnimation(title);
        }

        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';

            if (isChanged) {
                const saveText = isEasterEggActive() ? 'Save & Next Scene 🍫 ►' : 'Save & Next Scene ►';
                const closeText = isEasterEggActive() ? 'Save & Close 🍫' : 'Save & Close';
                saveBtn.textContent = isLast ? closeText : saveText;
                saveBtn.style.background = '#10b981';
                saveBtn.classList.add('fasttag-btn-pulse');
            } else {
                saveBtn.textContent = isLast ? 'Close' : 'Next Scene ►';
                saveBtn.style.background = '#6366f1';
                saveBtn.classList.remove('fasttag-btn-pulse');
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

        const scraperContainer = form.querySelector(`#${type}-scraper-card-container`);
        if (scraperContainer) {
            scraperContainer.innerHTML = '';
            scraperContainer.style.display = 'none';
        }
        closeFloatingScraperHud();
        const scrapeBtn = form.querySelector(`#${type}-scrape-btn`);
        if (scrapeBtn) {
            scrapeBtn.classList.remove('fasttag-dock-pulse');
            scrapeBtn.innerHTML = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
            scrapeBtn.title = 'Scrape scene metadata';
        }
        hideScrapeCoverTooltip();

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
                    recordSaveUsage();
                    toastSuccess(`${ENTITY_CONFIG[type].title} saved`);
                    await refreshSceneCards();
                }
            }
        }

        const formRect = form.getBoundingClientRect();
        sequentialEditState.popupPosition = {
            left: formRect.left,
            top: formRect.top
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
                    left: formRect.left,
                    top: formRect.top
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
        closeFloatingVideoHud(resetSequential);
        closeFloatingScraperHud(resetSequential);
        hidePerformerHoverCard();
        hideScrapeCoverTooltip();
        hideMicroTooltip();
        hasShownScrubCueThisSession = false;

        if (resetSequential) {
            resetSequentialEditState();
            sessionScrapeCache.clear();
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

        createMenuItem('🏷️ Edit Tags', () => openEntityPopup('tags', sceneId, cardElement));
        createMenuItem('⭐ Edit Performers', () => openEntityPopup('performers', sceneId, cardElement));
        createMenuItem('🏢 Edit Studio', () => openEntityPopup('studios', sceneId, cardElement));
        createMenuItem('🖼️ Edit Galleries', () => openEntityPopup('galleries', sceneId, cardElement));
        createMenuItem('🎬 Edit Scene', () => openEditScenePage(sceneId));
        createMenuItem('⚡ Edit Everything', () => openEditEverythingPopup(sceneId, cardElement));

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

        createMenuItem('⚙️ FastTag Settings', () => openSettingsModal());

        const hr = document.createElement('div');
        hr.style.height = '1px';
        hr.style.background = '#e2e8f0';
        hr.style.margin = '4px 0';
        menu.appendChild(hr);

        const supportLink = document.createElement('a');
        supportLink.href = 'https://buymeacoffee.com/kamarsh';
        supportLink.textContent = isEasterEggActive() ? 'Buy me a KitKat 🍫 (100+ Tagged!)' : 'Buy me a KitKat 🍫';
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

    function getOptimalPopupSize(type = 'single') {
        const screenW = window.innerWidth || 1920;
        const screenH = window.innerHeight || 1080;

        if (type === 'everything') {
            const rawW = Math.round(screenW * 0.50);
            const rawH = Math.round(screenH * 0.80);
            const width = Math.max(720, Math.min(Math.min(screenW - 24, rawW), 940));
            const height = Math.max(540, Math.min(Math.min(screenH - 24, rawH), 740));
            return { width, height };
        } else {
            const rawW = Math.round(screenW * 0.20);
            const rawH = Math.round(screenH * 0.68);
            const width = Math.max(320, Math.min(Math.min(screenW - 24, rawW), 380));
            const height = Math.max(460, Math.min(Math.min(screenH - 24, rawH), 540));
            return { width, height };
        }
    }

    function getSavedPopupSize(type = 'single') {
        try {
            const key = type === 'everything' ? 'stash_fast_tag_popup_size_everything' : 'stash_fast_tag_popup_size_single';
            const val = localStorage.getItem(key) || (type !== 'everything' ? localStorage.getItem('stash_fast_tag_popup_size') : null);
            if (val) {
                const parsed = JSON.parse(val);
                if (parsed && parsed.width && parsed.height) return parsed;
            }
        } catch (e) {}
        return getOptimalPopupSize(type);
    }
    function setSavedPopupSize(width, height, type = 'single') {
        try {
            const key = type === 'everything' ? 'stash_fast_tag_popup_size_everything' : 'stash_fast_tag_popup_size_single';
            localStorage.setItem(key, JSON.stringify({ width: Math.round(width), height: Math.round(height) }));
        } catch (e) {}
    }

    function resetAllLayoutsToDefault() {
        try {
            // 1. Remove custom popup sizes
            localStorage.removeItem('stash_fast_tag_popup_size_everything');
            localStorage.removeItem('stash_fast_tag_popup_size_single');
            localStorage.removeItem('stash_fast_tag_popup_size');

            // 2. Remove all custom column widths and splitters
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('fasttag_col_width_') || k.startsWith('fasttag_splitter_') || k === 'fasttag_everything_splitter_ratio')) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));

            // 3. Reset floating HUD positions and sizes
            floatingHudPosition = null;
            floatingHudSize = null;
            floatingScraperHudPosition = null;
            floatingScraperHudSize = null;

            // 4. If a popup is currently open, smoothly snap it to optimal size and redraw tables
            if (activePopup?.element) {
                const isEverything = activePopup.element.getAttribute('data-popup-type') === 'everything';
                const type = isEverything ? 'everything' : 'single';
                const optimal = getOptimalPopupSize(type);
                activePopup.element.style.transition = 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
                activePopup.element.style.width = `${optimal.width}px`;
                activePopup.element.style.height = `${optimal.height}px`;
                setTimeout(() => {
                    if (activePopup?.element) activePopup.element.style.transition = '';
                    if (activeTableInstance) {
                        try { activeTableInstance.redraw(true); } catch (e) {}
                    }
                    if (activePopup?.tagsTable) {
                        try { activePopup.tagsTable.redraw(true); } catch (e) {}
                    }
                    if (activePopup?.performersTable) {
                        try { activePopup.performersTable.redraw(true); } catch (e) {}
                    }
                }, 260);
            }

            toastSuccess('All popup sizes and column layouts reset to optimal display defaults');
        } catch (err) {
            console.error('[FastTag] Error resetting layouts:', err);
            toastError('Failed to reset layouts: ' + err.message);
        }
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

    // --- Performer Hover ID Card ---
    let performerHoverCardElement = null;
    let performerHoverTimeout = null;

    function getAgeFromBirthdate(birthdate) {
        if (!birthdate) return '';
        try {
            const birth = new Date(birthdate);
            if (isNaN(birth.getTime())) return '';
            const diff = Date.now() - birth.getTime();
            const ageDate = new Date(diff);
            const age = Math.abs(ageDate.getUTCFullYear() - 1970);
            return (age > 0 && age < 120) ? `${age} yrs` : '';
        } catch (e) {
            return '';
        }
    }

    function getCountryBadge(country) {
        if (!country) return '';
        const code = country.trim().toUpperCase();
        if (code.length === 2) {
            try {
                const flag = String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0)));
                return `${flag} ${code}`;
            } catch (e) {}
        }
        return country;
    }

    function formatGenderBadge(gender) {
        if (!gender) return '';
        const g = String(gender).toLowerCase();
        if (g.includes('female') && !g.includes('trans')) return '♀ Female';
        if (g.includes('male') && !g.includes('trans')) return '♂ Male';
        if (g.includes('trans_female') || g.includes('transgender_female')) return '⚧ Trans Female';
        if (g.includes('trans_male') || g.includes('transgender_male')) return '⚧ Trans Male';
        return gender;
    }

    let isHoveringCard = false;

    function hidePerformerHoverCard() {
        if (isHoveringCard) return;
        if (performerHoverTimeout) {
            clearTimeout(performerHoverTimeout);
            performerHoverTimeout = null;
        }
        if (performerHoverCardElement) {
            performerHoverCardElement.style.opacity = '0';
            performerHoverCardElement.style.transform = 'scale(0.95)';
            setTimeout(() => {
                if (performerHoverCardElement && performerHoverCardElement.style.opacity === '0' && !isHoveringCard) {
                    performerHoverCardElement.remove();
                    performerHoverCardElement = null;
                }
            }, 160);
        }
    }

    function showPerformerHoverCard(data, rowElement) {
        if (!data || !rowElement || !document.body.contains(rowElement)) return;
        if (!performerHoverCardElement) {
            performerHoverCardElement = document.createElement('div');
            performerHoverCardElement.id = 'fasttag-performer-hover-card';
            document.body.appendChild(performerHoverCardElement);
        }

        const imgUrl = data.image_path || `/performer/${data.id}/image`;
        const name = escapeHtml(data.name || `Performer #${data.id}`);
        const age = getAgeFromBirthdate(data.birthdate);
        const country = getCountryBadge(data.country);
        const gender = formatGenderBadge(data.gender);
        const disambiguation = data.disambiguation ? escapeHtml(data.disambiguation) : '';
        const aliases = Array.isArray(data.alias_list) && data.alias_list.length > 0 
            ? data.alias_list.slice(0, 3).map(a => escapeHtml(a)).join(', ') 
            : '';

        let ratingStars = '';
        if (typeof data.rating100 === 'number' && data.rating100 > 0) {
            const count = Math.min(5, Math.max(1, Math.round(data.rating100 / 20)));
            ratingStars = `<span style="color: #fbbf24; font-size: 11px; letter-spacing: 1px;">${'★'.repeat(count)}</span>`;
        }

        const pills = [];
        if (country) pills.push(`<span style="background: rgba(99, 102, 241, 0.2); color: #c7d2fe; border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 4px; padding: 1px 5px; font-size: 10px; font-weight: 600;">${country}</span>`);
        if (age) pills.push(`<span style="background: rgba(56, 189, 248, 0.15); color: #7dd3fc; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 4px; padding: 1px 5px; font-size: 10px; font-weight: 600;">${age}</span>`);
        if (gender) pills.push(`<span style="background: rgba(244, 114, 182, 0.15); color: #f472b6; border: 1px solid rgba(244, 114, 182, 0.35); border-radius: 4px; padding: 1px 5px; font-size: 10px; font-weight: 600;">${gender}</span>`);
        if (data.ethnicity) pills.push(`<span style="background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3); border-radius: 4px; padding: 1px 5px; font-size: 10px;">${escapeHtml(data.ethnicity)}</span>`);

        performerHoverCardElement.style.cssText = `position: fixed; z-index: 1000005; pointer-events: auto; cursor: pointer; width: 315px; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; box-shadow: 0 20px 45px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.08); padding: 10px 11px; box-sizing: border-box; display: flex; gap: 11px; font-family: system-ui, -apple-system, sans-serif; transition: opacity 0.15s ease, transform 0.15s ease, border-color 0.15s ease; opacity: 0; transform: scale(0.96);`;

        performerHoverCardElement.innerHTML = `
            <div style="width: 110px; height: 146px; border-radius: 8px; overflow: hidden; background: #1e293b; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 4px 14px rgba(0,0,0,0.5);">
                <img src="${imgUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
                <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 42px; color: #64748b;">⭐</div>
            </div>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
                        <span style="font-size: 14.5px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span>
                        ${ratingStars}
                    </div>
                    ${disambiguation ? `<div style="font-size: 11px; color: #94a3b8; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${disambiguation}</div>` : ''}
                    ${pills.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 3.5px; margin-top: 3px;">${pills.join('')}</div>` : ''}
                </div>
                <div>
                    ${aliases ? `<div style="font-size: 9.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px;"><strong style="color: #94a3b8;">aka:</strong> ${aliases}</div>` : ''}
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 3px; font-size: 10px; font-weight: 600; color: #818cf8; opacity: 0.95; margin-top: 4px;">
                        <span>View Profile</span><span style="font-size: 10.5px;">↗</span>
                    </div>
                </div>
            </div>
        `;

        performerHoverCardElement.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            window.open(`/performers/${data.id}`, '_blank');
        };

        performerHoverCardElement.onmouseenter = () => {
            isHoveringCard = true;
            if (performerHoverTimeout) clearTimeout(performerHoverTimeout);
            performerHoverCardElement.style.borderColor = 'rgba(99, 102, 241, 0.8)';
        };

        performerHoverCardElement.onmouseleave = (e) => {
            isHoveringCard = false;
            performerHoverCardElement.style.borderColor = 'rgba(148, 163, 184, 0.35)';
            if (!e.relatedTarget || !e.relatedTarget.closest('.tabulator-row')) {
                hidePerformerHoverCard();
            }
        };

        const rowRect = rowElement.getBoundingClientRect();
        const cardWidth = 315;
        const cardHeight = 146;
        const margin = 12;

        let top = rowRect.top - 20;
        if (top + cardHeight > window.innerHeight - margin) {
            top = window.innerHeight - cardHeight - margin;
        }
        if (top < margin) {
            top = margin;
        }

        let hudRect = null;
        if (isVideoPoppedOut && floatingHudElement && document.body.contains(floatingHudElement)) {
            hudRect = floatingHudElement.getBoundingClientRect();
        }

        let left;
        if (hudRect) {
            const form = activePopup && activePopup.element ? activePopup.element : null;
            const formRect = form ? form.getBoundingClientRect() : rowRect;
            const hudCenter = hudRect.left + hudRect.width / 2;
            const formCenter = formRect.left + formRect.width / 2;

            if (hudCenter < formCenter) {
                // Floating HUD is to the LEFT -> Place card strictly to the RIGHT
                left = rowRect.right + margin;
                if (left + cardWidth > window.innerWidth - margin) {
                    left = window.innerWidth - cardWidth - margin;
                }
            } else {
                // Floating HUD is to the RIGHT -> Place card strictly to the LEFT
                left = rowRect.left - cardWidth - margin;
                if (left < margin) {
                    left = margin;
                }
            }
        } else {
            // Standard placement: prefer Right, fallback to Left if offscreen
            left = rowRect.right + margin;
            if (left + cardWidth > window.innerWidth - margin) {
                left = rowRect.left - cardWidth - margin;
            }
            if (left < margin) {
                left = margin;
            }
            if (left + cardWidth > window.innerWidth - margin) {
                left = window.innerWidth - cardWidth - margin;
            }
        }

        performerHoverCardElement.style.left = `${Math.round(left)}px`;
        performerHoverCardElement.style.top = `${Math.round(top)}px`;

        requestAnimationFrame(() => {
            if (performerHoverCardElement) {
                performerHoverCardElement.style.opacity = '1';
                performerHoverCardElement.style.transform = 'scale(1)';
            }
        });
    }

    function attachPerformerHoverCard(table, tableContainer) {
        const container = tableContainer || (table && table.element);
        if (!container) return;

        let activeRowEl = null;

        container.addEventListener('mouseover', (e) => {
            const rowEl = e.target.closest('.tabulator-row');
            if (!rowEl || rowEl.classList.contains('tabulator-placeholder')) {
                return;
            }

            if (rowEl === activeRowEl) return;
            activeRowEl = rowEl;

            let rowData = null;
            if (table && typeof table.getRow === 'function') {
                try {
                    const row = table.getRow(rowEl);
                    if (row && typeof row.getData === 'function') {
                        rowData = row.getData();
                    }
                } catch (err) {}
            }
            if (!rowData) return;

            if (performerHoverTimeout) clearTimeout(performerHoverTimeout);
            performerHoverTimeout = setTimeout(() => {
                showPerformerHoverCard(rowData, rowEl);
            }, 100);
        });

        container.addEventListener('mouseout', (e) => {
            const rowEl = e.target.closest('.tabulator-row');
            if (!rowEl) return;
            const related = e.relatedTarget ? e.relatedTarget.closest('.tabulator-row') : null;
            if (related === rowEl) return;
            if (e.relatedTarget && e.relatedTarget.closest('#fasttag-performer-hover-card')) return;
            if (!related && !isHoveringCard) {
                activeRowEl = null;
                if (performerHoverTimeout) clearTimeout(performerHoverTimeout);
                hidePerformerHoverCard();
            }
        });

        container.addEventListener('mouseleave', (e) => {
            if (e.relatedTarget && e.relatedTarget.closest('#fasttag-performer-hover-card')) return;
            activeRowEl = null;
            if (performerHoverTimeout) clearTimeout(performerHoverTimeout);
            if (!isHoveringCard) hidePerformerHoverCard();
        });
    }

    // --- ⚡ Scraper & StashDB Auto-Match Engine ---
    let scrapeCoverTooltipEl = null;

    function showScrapeCoverTooltip(imgSrc, triggerEl) {
        if (!imgSrc || !triggerEl) return;
        if (!scrapeCoverTooltipEl) {
            scrapeCoverTooltipEl = document.createElement('div');
            scrapeCoverTooltipEl.id = 'fasttag-scrape-cover-tooltip';
            scrapeCoverTooltipEl.style.cssText = `
                position: fixed;
                z-index: 10000050;
                pointer-events: none;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 18px 45px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.22);
                background: #0f172a;
                width: 350px;
                height: 230px;
                display: none;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.15s ease, transform 0.15s ease;
                box-sizing: border-box;
                padding: 2px;
            `;
            scrapeCoverTooltipEl.innerHTML = `
                <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000; border-radius: 6px; overflow: hidden;">
                    <img src="" alt="Cover Tooltip" style="width: 100%; height: 100%; object-fit: contain; display: block; border-radius: 6px;" />
                </div>
            `;
            document.body.appendChild(scrapeCoverTooltipEl);
        }

        const img = scrapeCoverTooltipEl.querySelector('img');
        if (img) img.src = imgSrc;

        const rect = triggerEl.getBoundingClientRect();
        scrapeCoverTooltipEl.style.display = 'block';

        const tipW = 350;
        const tipH = 230;

        let left = rect.right + 12;
        if (left + tipW > window.innerWidth - 10) {
            left = rect.left - tipW - 12;
        }
        if (left < 10) {
            left = Math.max(10, rect.left);
        }

        let top = rect.top - 15;
        if (top + tipH > window.innerHeight - 10) {
            top = window.innerHeight - tipH - 10;
        }
        if (top < 10) top = 10;

        scrapeCoverTooltipEl.style.left = `${left}px`;
        scrapeCoverTooltipEl.style.top = `${top}px`;

        requestAnimationFrame(() => {
            if (scrapeCoverTooltipEl) {
                scrapeCoverTooltipEl.style.opacity = '1';
                scrapeCoverTooltipEl.style.transform = 'scale(1)';
            }
        });
    }

    function hideScrapeCoverTooltip() {
        if (scrapeCoverTooltipEl) {
            scrapeCoverTooltipEl.style.opacity = '0';
            scrapeCoverTooltipEl.style.transform = 'scale(0.95)';
            setTimeout(() => {
                if (scrapeCoverTooltipEl && scrapeCoverTooltipEl.style.opacity === '0') {
                    scrapeCoverTooltipEl.style.display = 'none';
                }
            }, 150);
        }
    }

    let floatingMicroTooltipEl = null;
    let microTooltipTimeout = null;

    function showMicroTooltip(text, triggerEl) {
        if (!text || !triggerEl) return;
        if (microTooltipTimeout) clearTimeout(microTooltipTimeout);

        microTooltipTimeout = setTimeout(() => {
            if (!floatingMicroTooltipEl) {
                floatingMicroTooltipEl = document.createElement('div');
                floatingMicroTooltipEl.id = 'fasttag-floating-microtooltip';
                floatingMicroTooltipEl.style.cssText = `
                    position: fixed;
                    z-index: 10000060;
                    pointer-events: none;
                    border-radius: 6px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.14);
                    background: #0f172a;
                    color: #f8fafc;
                    font-family: system-ui, -apple-system, sans-serif;
                    font-size: 11px;
                    font-weight: 500;
                    line-height: 1.4;
                    padding: 5px 9px;
                    max-width: 320px;
                    width: max-content;
                    box-sizing: border-box;
                    display: none;
                    opacity: 0;
                    transform: translateY(3px);
                    transition: opacity 0.12s ease, transform 0.12s ease;
                `;
                document.body.appendChild(floatingMicroTooltipEl);
            }

            floatingMicroTooltipEl.textContent = text;
            floatingMicroTooltipEl.style.display = 'block';

            const rect = triggerEl.getBoundingClientRect();
            const tipW = Math.min(320, floatingMicroTooltipEl.offsetWidth || 200);
            const tipH = floatingMicroTooltipEl.offsetHeight || 28;

            // Perfectly centered horizontally above element, clamped to viewport with 10px screen margin
            let left = rect.left + (rect.width / 2) - (tipW / 2);
            if (left < 10) left = 10;
            if (left + tipW > window.innerWidth - 10) {
                left = window.innerWidth - tipW - 10;
            }

            // Prefer positioning above element; if near top of window, place below element
            let top = rect.top - tipH - 6;
            if (top < 10) {
                top = rect.bottom + 6;
            }

            floatingMicroTooltipEl.style.left = `${left}px`;
            floatingMicroTooltipEl.style.top = `${top}px`;

            requestAnimationFrame(() => {
                if (floatingMicroTooltipEl) {
                    floatingMicroTooltipEl.style.opacity = '1';
                    floatingMicroTooltipEl.style.transform = 'translateY(0)';
                }
            });
        }, 250); // Snappy ~250ms delay
    }

    function hideMicroTooltip() {
        if (microTooltipTimeout) {
            clearTimeout(microTooltipTimeout);
            microTooltipTimeout = null;
        }
        if (floatingMicroTooltipEl) {
            floatingMicroTooltipEl.style.opacity = '0';
            floatingMicroTooltipEl.style.transform = 'translateY(3px)';
            setTimeout(() => {
                if (floatingMicroTooltipEl && floatingMicroTooltipEl.style.opacity === '0') {
                    floatingMicroTooltipEl.style.display = 'none';
                }
            }, 120);
        }
    }

    // Global event delegation for all FastTag micro tooltips (100% immune to CSS clipping/overflow)
    document.addEventListener('mouseover', (e) => {
        const target = e.target.closest('[data-micro-tooltip], [data-tooltip], #scenes-popup [title], #fasttag-floating-video-hud [title], #fasttag-settings-modal [title], .fasttag-chip [title], .fasttag-chip-row [title]');
        if (target) {
            let tipText = target.getAttribute('data-micro-tooltip') || target.getAttribute('data-tooltip');
            if (!tipText && target.hasAttribute('title')) {
                const rawTitle = target.getAttribute('title');
                if (rawTitle && rawTitle.trim()) {
                    tipText = rawTitle.trim();
                    target.setAttribute('data-micro-tooltip', tipText);
                    target.removeAttribute('title'); // Prevent slow OS tooltip from popping up over it
                }
            }
            if (tipText && tipText.trim()) {
                showMicroTooltip(tipText.trim(), target);
            }
        }
    }, true);

    document.addEventListener('mouseout', (e) => {
        const target = e.target.closest('[data-micro-tooltip], [data-tooltip]');
        if (target) {
            hideMicroTooltip();
        }
    }, true);

    function cleanTitleForScraping(rawStr) {
        if (!rawStr) return '';
        let clean = String(rawStr).replace(/\.[a-zA-Z0-9]{2,5}$/, '');
        clean = clean.replace(/[\b\._-](2160p|1080p|720p|480p|4k|uhd|hd|sd|fhd|hevc|x264|x265|h264|h265|aac|dvdrip|webrip|bluray|mp4|mkv|avi|wmv)[\b\._-]/gi, ' ');
        clean = clean.replace(/[\b\._-](2160p|1080p|720p|480p|4k|uhd|hd|sd|fhd|hevc|x264|x265|h264|h265|aac|dvdrip|webrip|bluray|mp4|mkv|avi|wmv)$/gi, '');
        clean = clean.replace(/[\._\-+]/g, ' ');
        clean = clean.replace(/\s+/g, ' ').trim();
        return clean;
    }

    // Temporary in-memory session cache for active scrape results (cleared when popup is closed)
    const sessionScrapeCache = new Map();

    async function fetchScraperMatchesForScene(sceneId, cardElement) {
        let sceneTitle = '';
        let sceneFileName = '';
        let sceneFilePath = '';
        let localDuration = null;
        let localFingerprints = [];

        try {
            const query = `query ($id: ID!) { findScene(id: $id) { id title details files { path duration fingerprints { type value } } } }`;
            const res = await fetchGQL(query, { id: sceneId });
            const sc = res?.data?.findScene;
            if (sc) {
                sceneTitle = sc.title || '';
                if (sc.files && sc.files.length > 0) {
                    const f0 = sc.files[0];
                    if (f0?.path) {
                        sceneFilePath = f0.path;
                        const parts = sceneFilePath.split(/[/\\]/);
                        sceneFileName = parts[parts.length - 1] || '';
                    }
                    if (f0?.duration) localDuration = f0.duration;
                    if (f0?.fingerprints) localFingerprints = f0.fingerprints;
                }
            }
        } catch (e) {}

        const SCRAPE_QUERY = `
            query FastTagScrapeSingleScene($source: ScraperSourceInput!, $input: ScrapeSingleSceneInput!) {
                scrapeSingleScene(source: $source, input: $input) {
                    title
                    code
                    details
                    director
                    urls
                    date
                    image
                    remote_site_id
                    duration
                    fingerprints {
                        algorithm
                        hash
                        duration
                    }
                    studio {
                        stored_id
                        name
                        image
                    }
                    tags {
                        stored_id
                        name
                    }
                    performers {
                        stored_id
                        name
                        gender
                        images
                    }
                }
            }
        `;

        const enrichMatches = (matches, matchType, sourceName) => {
            if (!Array.isArray(matches)) return [];
            matches.forEach(m => {
                m._matchType = matchType;
                m._sourceName = sourceName;
                m._localDuration = localDuration;
                m._localFingerprints = localFingerprints;
            });
            return matches;
        };

        // 1. First try direct hash scrape on StashBox 0
        try {
            const res = await fetchGQL(SCRAPE_QUERY, {
                source: { stash_box_index: 0 },
                input: { scene_id: String(sceneId) }
            });
            const matches = res?.data?.scrapeSingleScene;
            if (Array.isArray(matches) && matches.length > 0) {
                return enrichMatches(matches, 'hash', 'StashDB');
            }
        } catch (err) {
            console.log('[FastTag] Scrape by scene_id error/empty:', err);
        }

        // 2. Query StashBox by cleaned title/filename
        const candidateQueries = [];
        if (sceneTitle && sceneTitle.trim()) {
            candidateQueries.push(cleanTitleForScraping(sceneTitle));
        }
        if (sceneFileName && sceneFileName.trim()) {
            const cleanedFile = cleanTitleForScraping(sceneFileName);
            if (cleanedFile && !candidateQueries.includes(cleanedFile)) {
                candidateQueries.push(cleanedFile);
            }
        }
        if (cardElement) {
            const cardText = (cardElement.querySelector('.title, .card-title, .scene-card__title')?.textContent || '').trim();
            if (cardText) {
                const cleanedCard = cleanTitleForScraping(cardText);
                if (cleanedCard && !candidateQueries.includes(cleanedCard)) {
                    candidateQueries.push(cleanedCard);
                }
            }
        }

        for (const queryTerm of candidateQueries) {
            if (!queryTerm || queryTerm.length < 2) continue;
            try {
                const res = await fetchGQL(SCRAPE_QUERY, {
                    source: { stash_box_index: 0 },
                    input: { query: queryTerm }
                });
                const matches = res?.data?.scrapeSingleScene;
                if (Array.isArray(matches) && matches.length > 0) {
                    return enrichMatches(matches, 'title', 'StashDB');
                }
            } catch (err) {
                console.log('[FastTag] Scrape query error:', err);
            }
        }

        // 3. Fallback: Query installed scene scrapers
        try {
            const listRes = await fetchGQL(`query { listScrapers(types: [SCENE]) { id name } }`);
            const scrapers = listRes?.data?.listScrapers || [];
            for (const sc of scrapers) {
                if (sc.id === 'builtin_autotag') continue;
                for (const queryTerm of candidateQueries) {
                    if (!queryTerm || queryTerm.length < 2) continue;
                    try {
                        const res = await fetchGQL(SCRAPE_QUERY, {
                            source: { scraper_id: sc.id },
                            input: { query: queryTerm }
                        });
                        const matches = res?.data?.scrapeSingleScene;
                        if (Array.isArray(matches) && matches.length > 0) {
                            return enrichMatches(matches, 'scraper', sc.name || 'Scraper');
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        return [];
    }

    function formatDurationSec(sec) {
        if (!sec || isNaN(sec)) return '';
        const s = Math.round(Number(sec));
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        if (hrs > 0) {
            return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function parseDurationSec(val) {
        if (!val) return null;
        if (typeof val === 'number') return val;
        const str = String(val).trim();
        if (/^\d+(\.\d+)?$/.test(str)) return Math.round(Number(str));
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return null;
    }

    async function renderScraperMatchCard(container, results, sceneId, ctx, popup, onDismiss) {
        if (!results || results.length === 0) {
            if (container) {
                container.innerHTML = '';
                container.style.display = 'none';
            }
            closeFloatingScraperHud();
            return;
        }

        const isDetached = getDetachScraper();
        let targetContainer = container;

        if (isDetached) {
            if (popup?.scraperCardContainer) {
                popup.scraperCardContainer.innerHTML = '';
                popup.scraperCardContainer.style.display = 'none';
            }
            if (!floatingScraperHudElement || !document.body.contains(floatingScraperHudElement)) {
                floatingScraperHudElement = document.createElement('div');
                floatingScraperHudElement.id = 'fasttag-floating-scraper-hud';
                const defaultPos = getInitialScraperPopoutPosition(390, 480);
                let finalWidth = defaultPos.width || '390px';
                let finalHeight = defaultPos.height || '480px';
                let finalLeft = defaultPos.left;
                let finalTop = defaultPos.top;
                let finalRight = defaultPos.right;

                const activeForm = activePopup?.element || document.querySelector('#scenes-popup');
                const isVideoOpen = isVideoPoppedOut && floatingHudElement && document.body.contains(floatingHudElement);
                const videoRect = isVideoOpen ? floatingHudElement.getBoundingClientRect() : null;
                const formRect = activeForm ? activeForm.getBoundingClientRect() : null;

                let isPositionValid = false;
                if (floatingScraperHudPosition && floatingScraperHudPosition.left && floatingScraperHudPosition.top) {
                    const pLeft = parseInt(floatingScraperHudPosition.left, 10);
                    const pTop = parseInt(floatingScraperHudPosition.top, 10);
                    const pW = floatingScraperHudSize?.width ? parseInt(floatingScraperHudSize.width, 10) : parseInt(finalWidth, 10);
                    const pH = floatingScraperHudSize?.height ? parseInt(floatingScraperHudSize.height, 10) : parseInt(finalHeight, 10);

                    const collidesWithForm = formRect && !(pLeft + pW <= formRect.left + 5 || pLeft >= formRect.right - 5 || pTop + pH <= formRect.top + 5 || pTop >= formRect.bottom - 5);
                    const collidesWithVideo = videoRect && !(pLeft + pW <= videoRect.left + 5 || pLeft >= videoRect.right - 5 || pTop + pH <= videoRect.top + 5 || pTop >= videoRect.bottom - 5);

                    if (!collidesWithForm && !collidesWithVideo) {
                        finalLeft = floatingScraperHudPosition.left;
                        finalTop = floatingScraperHudPosition.top;
                        finalRight = null;
                        if (floatingScraperHudSize) {
                            finalWidth = floatingScraperHudSize.width;
                            finalHeight = floatingScraperHudSize.height;
                        }
                        isPositionValid = true;
                    }
                }
                if (!isPositionValid) {
                    floatingScraperHudPosition = null;
                }
                const isDarkTheme = getEffectiveTheme() === 'dark';
                floatingScraperHudElement.style.cssText = `position: fixed; top: ${finalTop}; ${finalLeft ? `left: ${finalLeft};` : `right: ${finalRight};`} width: ${finalWidth}; height: ${finalHeight}; min-width: 300px; min-height: 220px; max-width: 92vw; max-height: 92vh; z-index: 1000000; background: ${isDarkTheme ? '#1e293b' : '#ffffff'}; border: 1.5px solid ${isDarkTheme ? '#4338ca' : '#a5b4fc'}; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; resize: both; display: flex; flex-direction: column;`;
                document.body.appendChild(floatingScraperHudElement);

                const scraperResizeObserver = new ResizeObserver(() => {
                    if (floatingScraperHudElement && !floatingScraperHudElement._isDragging) {
                        floatingScraperHudSize = {
                            width: `${floatingScraperHudElement.offsetWidth}px`,
                            height: `${floatingScraperHudElement.offsetHeight}px`
                        };
                    }
                });
                scraperResizeObserver.observe(floatingScraperHudElement);
            }
            targetContainer = floatingScraperHudElement;
            targetContainer.style.display = 'flex';
        } else {
            closeFloatingScraperHud();
            targetContainer = popup?.scraperCardContainer || container;
            if (targetContainer) {
                targetContainer.style.display = 'flex';
            }
        }
        if (!targetContainer) return;

        const popupEl = popup?.element || (targetContainer ? targetContainer.closest('#scenes-popup') : null);
        const restoreSingleSize = () => {};
        const restoreSingleWidth = restoreSingleSize;

        // Ensure caches for performers, studios, tags are available to detect new vs existing entities
        const typesToLoad = [];
        if (!getCachedOrNull('studios')) typesToLoad.push('studios');
        if (!getCachedOrNull('performers')) typesToLoad.push('performers');
        if (!getCachedOrNull('tags')) typesToLoad.push('tags');

        if (typesToLoad.length > 0) {
            await Promise.all(typesToLoad.map(async (type) => {
                try {
                    const res = await fetchGQL(ENTITY_CONFIG[type].fetchQuery);
                    const list = ENTITY_CONFIG[type].extractList(res.data);
                    setCache(type, list);
                } catch (e) {
                    console.log('[FastTag] Error pre-caching ' + type, e);
                }
            }));
        }

        let currentIndex = 0;
        const isDark = getEffectiveTheme() === 'dark';

        const updateCardView = () => {
            const match = results[currentIndex];
            if (!match) return;

            const studioName = match.studio?.name || '';
            const performers = match.performers || [];
            const tags = match.tags || [];
            const urls = match.urls || [];

            const cachedStudios = getCachedOrNull('studios') || [];
            const cachedPerformers = getCachedOrNull('performers') || [];
            const cachedTags = getCachedOrNull('tags') || [];

            const isStudioNew = studioName ? !(match.studio?.stored_id || cachedStudios.some(s => (s.name || '').trim().toLowerCase() === studioName.trim().toLowerCase())) : false;

            let stashDbUrl = '';
            if (match.remote_site_id && match.remote_site_id.trim()) {
                const rid = match.remote_site_id.trim();
                stashDbUrl = rid.startsWith('http') ? rid : `https://stashdb.org/scenes/${rid}`;
            } else if (Array.isArray(urls)) {
                stashDbUrl = urls.find(u => u && u.includes('stashdb.org')) || '';
            }

            // Calculate match likelihood & fingerprint verification (mirroring Stash's native scraper)
            const localFps = match._localFingerprints || [];
            const localPhash = (localFps.find(f => f.type?.toLowerCase() === 'phash')?.value || '').toLowerCase();
            const localOshash = (localFps.find(f => f.type?.toLowerCase() === 'oshash')?.value || '').toLowerCase();
            const localMd5 = (localFps.find(f => f.type?.toLowerCase() === 'md5')?.value || '').toLowerCase();

            const remoteFps = match.fingerprints || [];
            const phashMatch = localPhash && remoteFps.some(rf => rf.algorithm?.toLowerCase() === 'phash' && (rf.hash || '').toLowerCase() === localPhash);
            const oshashMatch = localOshash && remoteFps.some(rf => (rf.algorithm?.toLowerCase() === 'oshash' || rf.algorithm?.toLowerCase() === 'md5') && (rf.hash || '').toLowerCase() === localOshash);
            const md5Match = localMd5 && remoteFps.some(rf => rf.algorithm?.toLowerCase() === 'md5' && (rf.hash || '').toLowerCase() === localMd5);

            const isHashMatch = match._matchType === 'hash' || phashMatch || oshashMatch || md5Match;

            const matchBadges = [];
            if (phashMatch) matchBadges.push('PHash is a match');
            if (oshashMatch || md5Match) matchBadges.push('MD5 Checksum is a match');

            if (matchBadges.length === 0 && isHashMatch) {
                matchBadges.push('Fingerprint is a match');
            }

            const localDurSec = parseDurationSec(match._localDuration);
            const scrapedDurSec = parseDurationSec(match.duration);

            const totalFps = remoteFps.length;
            const matchingDurFps = remoteFps.filter(rf => {
                const fd = parseDurationSec(rf.duration);
                return fd && localDurSec && Math.abs(fd - localDurSec) <= 15;
            }).length;

            let durationBadge = '';
            if (scrapedDurSec && localDurSec) {
                const diff = Math.abs(scrapedDurSec - localDurSec);
                if (diff <= 3) {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Duration matches within 3 seconds (${formatDurationSec(scrapedDurSec)})">
                            <span>⏱</span><span>${formatDurationSec(scrapedDurSec)} (Exact Match)</span>
                        </span>
                    `;
                } else {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 500; color: ${isDark ? '#cbd5e1' : '#475569'}; background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.25); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Scraped duration is ${formatDurationSec(scrapedDurSec)}, local is ${formatDurationSec(localDurSec)}">
                            <span>⏱</span><span>${formatDurationSec(scrapedDurSec)} (Local: ${formatDurationSec(localDurSec)})</span>
                        </span>
                    `;
                }
            } else if (localDurSec) {
                if (matchingDurFps > 0) {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="${matchingDurFps} of ${totalFps} StashDB submissions match your duration (${formatDurationSec(localDurSec)})">
                            <span>⏱</span><span>${formatDurationSec(localDurSec)} (${matchingDurFps}/${totalFps} Match)</span>
                        </span>
                    `;
                } else {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 500; color: ${isDark ? '#94a3b8' : '#64748b'}; background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.25); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;">
                            <span>⏱</span><span>${formatDurationSec(localDurSec)}</span>
                        </span>
                    `;
                }
            }

            let savedEmbeddedH = 220;
            try {
                const h = parseInt(localStorage.getItem('fasttag_embedded_scraper_h'), 10);
                if (!isNaN(h) && h >= 50 && h <= 520) savedEmbeddedH = h;
            } catch (e) {}

            targetContainer.style.display = isDetached ? 'flex' : 'flex';
            targetContainer.innerHTML = `
                <div style="background: ${isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc'}; border: ${isDetached ? 'none' : (isDark ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid #818cf8')}; border-radius: 8px; box-shadow: ${isDetached ? 'none' : '0 10px 25px rgba(0,0,0,0.5)'}, inset 0 0 0 1px rgba(255,255,255,0.06); padding: 9px 12px 6px 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 7px; ${isDetached ? 'height: 100%; min-height: 0; flex: 1 1 auto;' : 'height: auto;'} font-family: system-ui, -apple-system, sans-serif; transition: all 0.2s ease;">
                    <!-- Top Navigation & Link Header -->
                    <div id="fasttag-scrape-header" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; user-select: none;">
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: ${isDark ? '#e0e7ff' : '#312e81'};">
                            <span style="font-size: 13px; line-height: 1;">⚡</span>
                            <span>${escapeHtml(match._sourceName || 'StashDB')} Match</span>
                            ${results.length > 1 ? `
                                <div style="display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; color: ${isDark ? '#cbd5e1' : '#475569'}; margin-left: 4px;">
                                    <button type="button" id="fasttag-scrape-prev" style="background: none; border: 1px solid rgba(148,163,184,0.3); border-radius: 3px; cursor: pointer; color: inherit; padding: 1px 5px; font-size: 9px;" ${currentIndex === 0 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>◀</button>
                                    <span>${currentIndex + 1}/${results.length}</span>
                                    <button type="button" id="fasttag-scrape-next" style="background: none; border: 1px solid rgba(148,163,184,0.3); border-radius: 3px; cursor: pointer; color: inherit; padding: 1px 5px; font-size: 9px;" ${currentIndex === results.length - 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>▶</button>
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                            ${stashDbUrl ? `
                                <a href="${stashDbUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 600; color: #818cf8; text-decoration: none; padding: 2px 6px; border-radius: 4px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.35); transition: background 0.15s ease;" title="Open in StashDB in new tab">
                                    <span>🔗 StashDB</span><span style="font-size: 9px;">↗</span>
                                </a>
                            ` : ''}
                            <button type="button" id="fasttag-scrape-popout-toggle" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35); border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: 700; color: #818cf8; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 3px; line-height: 1; transition: all 0.15s ease;" data-micro-tooltip="${isDetached ? 'Dock scraper inside popup' : 'Pop out scraper into floating window'}">
                                <span>${isDetached ? '⤝' : '⤢'}</span>
                                <span>${isDetached ? 'Dock' : 'Pop Out'}</span>
                            </button>
                            <button type="button" id="fasttag-scrape-accept-btn" style="background: #059669; border: 1px solid #10b981; color: #ffffff; padding: 2.5px 8px; border-radius: 4px; font-size: 10.5px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; box-shadow: 0 1px 4px rgba(5,150,105,0.4); line-height: 1.2; transition: all 0.15s ease;" title="Accept match and save metadata (Enter)">
                                <span>✓ Accept</span>
                            </button>
                        </div>
                    </div>

                    <div id="fasttag-scrape-body-wrapper" style="display: flex; flex-direction: column; gap: 7px; ${isDetached ? 'flex: 1 1 auto; min-height: 0; overflow: hidden;' : 'height: auto;'} transition: all 0.15s ease;">
                        <!-- Dedicated Verification Badges Row -->
                        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap; padding: 3px 6px; background: ${isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.03)'}; border-radius: 5px; border: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}; flex-shrink: 0;">
                            ${isHashMatch ? matchBadges.map(b => `
                                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Direct file fingerprint match on StashDB">
                                    <span>✓</span><span>${b}</span>
                                </span>
                            `).join('') : `
                                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="No file hash/fingerprint match found on StashDB. This scene was found by searching words from your filename/title. Please check the preview to confirm it is the correct scene before saving.">
                                    <span>✕</span><span>No Hash Match (Keyword Search)</span>
                                </span>
                            `}
                            ${durationBadge}
                        </div>

                    <!-- Items Preview Box with Relative Wrapper for Scroll Indicator -->
                    <div style="position: relative; border-radius: 6px; overflow: hidden; ${isDetached ? 'flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;' : 'height: auto;'}">
                        <div id="fasttag-scrape-items-preview" style="display: flex; flex-direction: column; gap: 7px; background: ${isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)'}; padding: 7px 9px 10px 9px; border-radius: 6px; font-size: 11px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; ${isDetached ? 'flex: 1 1 auto; min-height: 80px; max-height: none;' : `height: ${savedEmbeddedH}px; min-height: 50px; max-height: 520px;`} scrollbar-width: thin; scrollbar-color: ${isDark ? 'rgba(129, 140, 248, 0.65) rgba(0,0,0,0.25)' : '#a5b4fc #f1f5f9'}; transition: opacity 0.1s ease;">
                            <!-- Top Row: Cover Thumbnail + Title & Studio (Side-by-Side) -->
                            <div style="display: flex; gap: 9px; align-items: stretch;">
                                ${match.image ? `
                                    <div class="fasttag-scrape-cover-thumb" style="flex-shrink: 0; width: 116px; height: 74px; border-radius: 6px; overflow: hidden; background: #000; border: 1px solid ${isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1'}; display: flex; align-items: center; justify-content: center; align-self: flex-start; cursor: pointer; position: relative; transition: border-color 0.15s ease;">
                                        <img src="${match.image}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" />
                                    </div>
                                ` : ''}
                                <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; flex: 1; min-width: 0;">
                                    <!-- Title Row -->
                                    <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                        <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 60px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#e0e7ff' : '#312e81'}; font-size: 11px;" title="Check to update scene title">
                                            <input type="checkbox" id="fasttag-scrape-chk-title" style="cursor: pointer; width: 12px; height: 12px; accent-color: #6366f1; margin: 0; position: relative; top: 1.5px;">
                                            <span style="font-size: 11px;">✏️</span>
                                            <span>Title:</span>
                                        </label>
                                        <span style="display: inline-block; background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(match.title || '')}">${escapeHtml(match.title || 'Untitled Match')}</span>
                                        ${match.date ? `<span style="font-size: 10.5px; color: ${isDark ? '#94a3b8' : '#64748b'}; font-weight: 500;">(${match.date})</span>` : ''}
                                    </div>

                                    ${studioName ? `
                                        <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 60px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#a5b4fc' : '#4f46e5'}; font-size: 11px;">
                                                <input type="checkbox" id="fasttag-scrape-chk-studio" checked style="cursor: pointer; width: 12px; height: 12px; accent-color: ${isStudioNew ? '#f59e0b' : '#6366f1'}; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">🏢</span>
                                                <span>Studio:</span>
                                            </label>
                                            ${isStudioNew ? `
                                                <span style="display: inline-flex; align-items: baseline; gap: 4px; background: ${isDark ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px;" title="Not in your local library — will create new studio upon saving">
                                                    <span>${escapeHtml(studioName)}</span>
                                                    <span style="font-size: 8.5px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}; padding: 0.5px 3.5px; border-radius: 3px; color: ${isDark ? '#fef08a' : '#78350f'};">+ New</span>
                                                </span>
                                            ` : `
                                                <span style="display: inline-block; background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px;" title="Exists in your local library">${escapeHtml(studioName)}</span>
                                            `}
                                        </div>
                                    ` : ''}
                                </div>
                            </div>

                            <!-- Full-Width Performers, Tags, Details Sections -->
                            <div style="display: flex; flex-direction: column; gap: 5px; border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}; padding-top: 5px;">
                                ${performers.length > 0 ? `
                                    <div style="display: flex; flex-direction: column; gap: 3px;">
                                        <div style="display: flex; align-items: baseline; justify-content: space-between;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#7dd3fc' : '#0284c7'}; font-size: 11px;">
                                                <input type="checkbox" id="fasttag-scrape-chk-perf-all" checked style="cursor: pointer; width: 12px; height: 12px; accent-color: #0ea5e9; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">👥</span>
                                                <span>Performers (${performers.length}):</span>
                                            </label>
                                        </div>
                                        <div id="fasttag-scrape-perf-pills" style="display: flex; flex-wrap: wrap; gap: 4px;">
                                            ${performers.map((p, pIdx) => {
                                                const isNew = !(p.stored_id || cachedPerformers.some(cp => (cp.name || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase()));
                                                if (isNew) {
                                                    return `
                                                        <label style="display: inline-flex; align-items: baseline; gap: 4px; background: ${isDark ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; user-select: none;" title="Not in your local library — will create new performer upon saving">
                                                            <input type="checkbox" class="fasttag-scrape-perf-item" data-idx="${pIdx}" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #f59e0b; margin: 0; position: relative; top: 1.5px;">
                                                            <span>${escapeHtml(p.name)}</span>
                                                            <span style="font-size: 8.5px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}; padding: 0.5px 3.5px; border-radius: 3px; color: ${isDark ? '#fef08a' : '#78350f'};">+ New</span>
                                                        </label>
                                                    `;
                                                }
                                                return `
                                                    <label style="display: inline-flex; align-items: baseline; gap: 4px; background: ${isDark ? 'rgba(14px 165, 233, 0.15)' : '#e0f2fe'}; color: ${isDark ? '#bae6fd' : '#0369a1'}; border: 1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : '#7dd3fc'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; user-select: none;" title="Exists in your local library">
                                                        <input type="checkbox" class="fasttag-scrape-perf-item" data-idx="${pIdx}" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #0ea5e9; margin: 0; position: relative; top: 1.5px;">
                                                        <span>${escapeHtml(p.name)}</span>
                                                    </label>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}

                                ${tags.length > 0 ? `
                                    <div style="display: flex; flex-direction: column; gap: 3px;">
                                        <div style="display: flex; align-items: baseline; justify-content: space-between;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#cbd5e1' : '#475569'}; font-size: 11px;">
                                                <input type="checkbox" id="fasttag-scrape-chk-tags-all" style="cursor: pointer; width: 12px; height: 12px; accent-color: #64748b; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">🏷️</span>
                                                <span>Tags (${tags.length}):</span>
                                            </label>
                                        </div>
                                        <div id="fasttag-scrape-tags-pills" style="display: flex; flex-wrap: wrap; gap: 3px; align-items: baseline;">
                                            ${tags.map((t, tIdx) => {
                                                const isNew = !(t.stored_id || cachedTags.some(ct => (ct.name || '').trim().toLowerCase() === (t.name || '').trim().toLowerCase()));
                                                if (isNew) {
                                                    return `
                                                        <label style="display: inline-flex; align-items: baseline; gap: 3px; background: ${isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.5)' : '#fbbf24'}; padding: 1.5px 5px; border-radius: 4px; font-size: 9.5px; cursor: pointer; user-select: none;" title="Not in your local library — will create new tag upon saving">
                                                            <input type="checkbox" class="fasttag-scrape-tag-item" data-idx="${tIdx}" style="cursor: pointer; width: 10px; height: 10px; accent-color: #f59e0b; margin: 0; position: relative; top: 1px;">
                                                            <span>${escapeHtml(t.name)}</span>
                                                            <span style="font-size: 8px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.2)'}; padding: 0.5px 3px; border-radius: 2px; color: ${isDark ? '#fef08a' : '#78350f'};">+ New</span>
                                                        </label>
                                                    `;
                                                }
                                                return `
                                                    <label style="display: inline-flex; align-items: baseline; gap: 3px; background: ${isDark ? 'rgba(148, 163, 184, 0.12)' : '#f1f5f9'}; color: ${isDark ? '#cbd5e1' : '#334155'}; border: 1px solid ${isDark ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1'}; padding: 1.5px 5px; border-radius: 4px; font-size: 9.5px; cursor: pointer; user-select: none;" title="Exists in your local library">
                                                        <input type="checkbox" class="fasttag-scrape-tag-item" data-idx="${tIdx}" style="cursor: pointer; width: 10px; height: 10px; accent-color: #64748b; margin: 0; position: relative; top: 1px;">
                                                        <span>${escapeHtml(t.name)}</span>
                                                    </label>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}

                                ${match.details && match.details.trim() ? `
                                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 2px; border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}; padding-top: 4px;">
                                        <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 60px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; font-size: 11px; color: ${isDark ? '#93c5fd' : '#2563eb'};">
                                                <input type="checkbox" id="fasttag-scrape-chk-details" style="cursor: pointer; width: 12px; height: 12px; accent-color: #3b82f6; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">📜</span>
                                                <span>Details:</span>
                                            </label>
                                            <span id="fasttag-scrape-toggle-details" style="display: inline-flex; align-items: baseline; gap: 5px; background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#c7d2fe' : '#3730a3'}; border: 1px solid ${isDark ? 'rgba(99, 102, 241, 0.35)' : '#c7d2fe'}; padding: 2px 7px; border-radius: 4px; font-weight: 500; font-size: 10.5px; cursor: pointer; max-width: 410px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: none; transition: background 0.15s ease;" title="Click to expand/collapse full synopsis">
                                                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-style: italic;">"${escapeHtml(match.details.trim().replace(/\s+/g, ' '))}"</span>
                                                <span id="fasttag-scrape-details-arrow" style="font-size: 7.5px; color: #818cf8; flex-shrink: 0;">▶</span>
                                            </span>
                                        </div>
                                        <div id="fasttag-scrape-details-content" style="display: none; max-height: 110px; overflow-y: auto; font-size: 11.5px; line-height: 1.5; color: ${isDark ? '#e2e8f0' : '#1e293b'}; background: ${isDark ? 'rgba(0,0,0,0.45)' : '#ffffff'}; padding: 7px 10px; border-radius: 5px; border: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}; white-space: pre-wrap; word-break: break-word; font-family: system-ui, -apple-system, sans-serif;">
                                            ${escapeHtml(match.details.trim())}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Guaranteed Visible Bottom Scroll Indicator -->
                        <div id="fasttag-scrape-scroll-hint" style="display: none; position: absolute; bottom: 0; left: 0; right: 0; height: 28px; background: linear-gradient(to top, ${isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(241, 245, 249, 0.95)'} 25%, transparent 100%); pointer-events: none; align-items: flex-end; justify-content: center; padding-bottom: 2px; transition: opacity 0.2s ease;">
                            <span style="font-size: 9px; font-weight: 600; color: #818cf8; display: inline-flex; align-items: center; gap: 3px; background: ${isDark ? '#1e293b' : '#ffffff'}; padding: 1px 7px; border-radius: 10px; border: 1px solid rgba(129, 140, 248, 0.4); box-shadow: 0 1px 4px rgba(0,0,0,0.3);">
                                <span>⌄</span><span>More below</span>
                            </span>
                        </div>
                    </div>

                    <!-- Seamless Edge Resizer (Zero wasted height, cursor: ns-resize) -->
                    <div id="fasttag-scrape-v-resizer" style="height: 11px; margin: 3px -12px -6px -12px; cursor: ns-resize; border-bottom: 2px solid rgba(99, 102, 241, 0.45); display: ${isDetached ? 'none' : 'flex'}; align-items: center; justify-content: center; user-select: none; transition: border-color 0.15s ease;" title="Drag up or down to resize scraper preview height">
                        <div style="width: 44px; height: 3px; border-radius: 2px; background: rgba(129, 140, 248, 0.6); pointer-events: none; transition: all 0.15s ease;"></div>
                    </div>
                </div>
            `;

            const previewBox = targetContainer.querySelector('#fasttag-scrape-items-preview');
            const perfPills = targetContainer.querySelector('#fasttag-scrape-perf-pills');
            const tagsPills = targetContainer.querySelector('#fasttag-scrape-tags-pills');

            // Wire popout / dock button
            const popoutToggleBtn = targetContainer.querySelector('#fasttag-scrape-popout-toggle');
            if (popoutToggleBtn) {
                popoutToggleBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hideScrapeCoverTooltip();
                    const nextState = !getDetachScraper();
                    setDetachScraper(nextState);
                    if (nextState) {
                        if (popup?.scraperCardContainer) {
                            popup.scraperCardContainer.innerHTML = '';
                            popup.scraperCardContainer.style.display = 'none';
                        }
                    } else {
                        closeFloatingScraperHud();
                    }
                    renderScraperMatchCard(popup?.scraperCardContainer || container, results, sceneId, ctx, popup, onDismiss);
                };
            }

            // Wire dragging when in detached floating window
            if (isDetached && floatingScraperHudElement) {
                const headerEl = targetContainer.querySelector('#fasttag-scrape-header');
                if (headerEl) {
                    headerEl.style.cursor = 'grab';
                    let isDragging = false;
                    let startX = 0, startY = 0, startL = 0, startT = 0;
                    const onMouseMove = (e) => {
                        if (!isDragging || !floatingScraperHudElement) return;
                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;
                        const newLeft = Math.max(8, Math.min(window.innerWidth - floatingScraperHudElement.offsetWidth - 8, startL + dx));
                        const newTop = Math.max(8, Math.min(window.innerHeight - floatingScraperHudElement.offsetHeight - 8, startT + dy));
                        floatingScraperHudElement.style.left = `${newLeft}px`;
                        floatingScraperHudElement.style.top = `${newTop}px`;
                        floatingScraperHudElement.style.right = 'auto';
                        floatingScraperHudPosition = { top: `${newTop}px`, left: `${newLeft}px` };
                    };
                    const onMouseUp = () => {
                        isDragging = false;
                        if (floatingScraperHudElement) floatingScraperHudElement._isDragging = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                        if (headerEl) headerEl.style.cursor = 'grab';
                    };
                    headerEl.onmousedown = (e) => {
                        if (e.target.closest('button, a, input, select')) return;
                        const rect = floatingScraperHudElement.getBoundingClientRect();
                        const isResizeZone = (rect.right - e.clientX) <= 24 && (rect.bottom - e.clientY) <= 24;
                        if (isResizeZone) return;

                        isDragging = true;
                        if (floatingScraperHudElement) floatingScraperHudElement._isDragging = true;
                        startX = e.clientX;
                        startY = e.clientY;
                        startL = rect.left;
                        startT = rect.top;
                        headerEl.style.cursor = 'grabbing';
                        document.body.style.userSelect = 'none';
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    };
                }
            }

            // Wire vertical resize dragging (allows smooth split resizing between scraper card and tags table)
            const resizer = targetContainer.querySelector('#fasttag-scrape-v-resizer');
            if (resizer && previewBox) {
                if (isDetached) {
                    resizer.style.display = 'none';
                } else {
                    resizer.style.display = 'flex';
                }
                let isResizing = false;
                let startY = 0;
                let startPreviewH = 0;

                const onMouseMove = (e) => {
                    if (!isResizing) return;
                    e.preventDefault();
                    const dy = e.clientY - startY;
                    const newPreviewH = Math.max(50, Math.min(520, startPreviewH + dy));
                    previewBox.style.height = `${newPreviewH}px`;
                    try {
                        localStorage.setItem('fasttag_embedded_scraper_h', String(newPreviewH));
                    } catch (e) {}
                    if (typeof updateScrollHint === 'function') updateScrollHint();
                    if (activeTableInstance) {
                        try { activeTableInstance.redraw(false); } catch (err) {}
                    }
                    if (popup?.tagsTable) {
                        try { popup.tagsTable.redraw(false); } catch (err) {}
                    }
                    if (popup?.performersTable) {
                        try { popup.performersTable.redraw(false); } catch (err) {}
                    }
                };

                const onMouseUp = () => {
                    if (isResizing) {
                        isResizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';
                        resizer.style.borderBottomColor = 'rgba(99, 102, 241, 0.45)';
                        const bar = resizer.querySelector('div');
                        if (bar) {
                            bar.style.width = '44px';
                            bar.style.background = 'rgba(129, 140, 248, 0.6)';
                        }
                    }
                };

                resizer.addEventListener('mouseenter', () => {
                    resizer.style.borderBottomColor = '#818cf8';
                    const bar = resizer.querySelector('div');
                    if (bar) {
                        bar.style.width = '64px';
                        bar.style.background = '#818cf8';
                    }
                });

                resizer.addEventListener('mouseleave', () => {
                    if (!isResizing) {
                        resizer.style.borderBottomColor = 'rgba(99, 102, 241, 0.45)';
                        const bar = resizer.querySelector('div');
                        if (bar) {
                            bar.style.width = '44px';
                            bar.style.background = 'rgba(129, 140, 248, 0.6)';
                        }
                    }
                });

                resizer.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isResizing = true;
                    startY = e.clientY;
                    startPreviewH = previewBox.offsetHeight || 180;
                    document.body.style.cursor = 'ns-resize';
                    document.body.style.userSelect = 'none';
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });

                resizer.addEventListener('mouseenter', () => {
                    const bar = resizer.querySelector('div');
                    if (bar) {
                        bar.style.width = '64px';
                        bar.style.background = '#818cf8';
                    }
                });
                resizer.addEventListener('mouseleave', () => {
                    if (!isResizing) {
                        const bar = resizer.querySelector('div');
                        if (bar) {
                            bar.style.width = '44px';
                            bar.style.background = isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8';
                        }
                    }
                });
            }

            // Toggle Synopsis / Details blurb
            const detailsToggleBtn = targetContainer.querySelector('#fasttag-scrape-toggle-details');
            const detailsContent = targetContainer.querySelector('#fasttag-scrape-details-content');
            const detailsArrow = targetContainer.querySelector('#fasttag-scrape-details-arrow');
            if (detailsToggleBtn && detailsContent) {
                detailsToggleBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isHidden = detailsContent.style.display === 'none';
                    detailsContent.style.display = isHidden ? 'block' : 'none';
                    if (detailsArrow) detailsArrow.textContent = isHidden ? '▼' : '▶';
                    detailsToggleBtn.title = isHidden ? 'Click to collapse synopsis' : 'Click to expand full synopsis';
                };
            }

            // Hover zoom tooltip for cover image
            const thumbEl = targetContainer.querySelector('.fasttag-scrape-cover-thumb');
            if (thumbEl && match.image) {
                thumbEl.onmouseenter = () => showScrapeCoverTooltip(match.image, thumbEl);
                thumbEl.onmouseleave = () => hideScrapeCoverTooltip();
            }

            // Bind interactions
            const prevBtn = targetContainer.querySelector('#fasttag-scrape-prev');
            if (prevBtn) {
                prevBtn.onclick = (e) => {
                    e.preventDefault();
                    hideScrapeCoverTooltip();
                    if (currentIndex > 0) {
                        currentIndex--;
                        updateCardView();
                    }
                };
            }

            const nextBtn = targetContainer.querySelector('#fasttag-scrape-next');
            if (nextBtn) {
                nextBtn.onclick = (e) => {
                    e.preventDefault();
                    hideScrapeCoverTooltip();
                    if (currentIndex < results.length - 1) {
                        currentIndex++;
                        updateCardView();
                    }
                };
            }

            const perfAllChk = targetContainer.querySelector('#fasttag-scrape-chk-perf-all');
            if (perfAllChk) {
                perfAllChk.onchange = (e) => {
                    targetContainer.querySelectorAll('.fasttag-scrape-perf-item').forEach(chk => {
                        chk.checked = e.target.checked;
                    });
                };
            }

            const tagsAllChk = targetContainer.querySelector('#fasttag-scrape-chk-tags-all');
            if (tagsAllChk) {
                tagsAllChk.onchange = (e) => {
                    targetContainer.querySelectorAll('.fasttag-scrape-tag-item').forEach(chk => {
                        chk.checked = e.target.checked;
                    });
                };
            }

            const cancelBtn = targetContainer.querySelector('#fasttag-scrape-cancel-btn');
            if (cancelBtn) {
                cancelBtn.onclick = (e) => {
                    e.preventDefault();
                    hideScrapeCoverTooltip();
                    restoreSingleWidth();
                    closeFloatingScraperHud();
                    targetContainer.innerHTML = '';
                    targetContainer.style.display = 'none';
                    if (typeof onDismiss === 'function') onDismiss();
                };
            }

            const scrollHint = targetContainer.querySelector('#fasttag-scrape-scroll-hint');
            const updateScrollHint = () => {
                if (!previewBox || !scrollHint) return;
                const canScrollDown = previewBox.scrollHeight > (previewBox.clientHeight + 6) && ((previewBox.scrollTop + previewBox.clientHeight) < (previewBox.scrollHeight - 8));
                scrollHint.style.display = canScrollDown ? 'flex' : 'none';
            };

            if (previewBox) {
                previewBox.onscroll = updateScrollHint;
                setTimeout(updateScrollHint, 60);
            }

            const acceptBtn = targetContainer.querySelector('#fasttag-scrape-accept-btn');
            if (acceptBtn) {
                acceptBtn.onclick = async (e) => {
                    e.preventDefault();
                    hideScrapeCoverTooltip();
                    acceptBtn.disabled = true;
                    acceptBtn.innerHTML = `<span>⏳ Saving...</span>`;
                    await handleAcceptScrapeMatch(match, targetContainer, sceneId, ctx, popup);
                };
            }

            if (popup && popup.scrapeBtn) {
                popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>▲ Hide 🍫</span>' : '<span>▲ Hide</span>';
                popup.scrapeBtn.title = isDetached ? 'Hide detached scraper window' : 'Hide scrape preview';
                if (isDetached) {
                    popup.scrapeBtn.classList.add('fasttag-dock-pulse');
                } else {
                    popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                }
            }
        };

        updateCardView();
    }

    async function handleAcceptScrapeMatch(match, container, sceneId, ctx, popup) {
        try {
            const isStudioChecked = container.querySelector('#fasttag-scrape-chk-studio')?.checked ?? false;
            const isTitleChecked = container.querySelector('#fasttag-scrape-chk-title')?.checked ?? false;
            const isDetailsChecked = container.querySelector('#fasttag-scrape-chk-details')?.checked ?? false;

            // 1. Studio Resolution
            let studioIdToSet = null;
            if (isStudioChecked && match.studio?.name) {
                if (match.studio.stored_id) {
                    studioIdToSet = String(match.studio.stored_id);
                } else {
                    let cachedStudios = getCachedOrNull('studios');
                    if (!cachedStudios) {
                        const res = await fetchGQL(ENTITY_CONFIG.studios.fetchQuery);
                        cachedStudios = ENTITY_CONFIG.studios.extractList(res.data);
                        setCache('studios', cachedStudios);
                    }
                    const found = cachedStudios?.find(s => (s.name || '').trim().toLowerCase() === match.studio.name.trim().toLowerCase());
                    if (found) {
                        studioIdToSet = String(found.id);
                    } else {
                        const createRes = await fetchGQL(ENTITY_CONFIG.studios.createQuery, { name: match.studio.name.trim() });
                        const newId = ENTITY_CONFIG.studios.createExtract(createRes.data);
                        if (newId) {
                            studioIdToSet = String(newId);
                            setCache('studios', null);
                        }
                    }
                }
            }

            // 2. Performers Resolution
            const checkedPerfIndices = Array.from(container.querySelectorAll('.fasttag-scrape-perf-item:checked')).map(el => parseInt(el.getAttribute('data-idx'), 10));
            const performerIdsToAdd = [];

            if (checkedPerfIndices.length > 0 && match.performers) {
                let cachedPerformers = getCachedOrNull('performers');
                if (!cachedPerformers) {
                    const res = await fetchGQL(ENTITY_CONFIG.performers.fetchQuery);
                    cachedPerformers = ENTITY_CONFIG.performers.extractList(res.data);
                    setCache('performers', cachedPerformers);
                }

                for (const idx of checkedPerfIndices) {
                    const p = match.performers[idx];
                    if (!p || !p.name) continue;
                    if (p.stored_id) {
                        performerIdsToAdd.push(String(p.stored_id));
                    } else {
                        const found = cachedPerformers?.find(cp => (cp.name || '').trim().toLowerCase() === p.name.trim().toLowerCase());
                        if (found) {
                            performerIdsToAdd.push(String(found.id));
                        } else {
                            const createRes = await fetchGQL(ENTITY_CONFIG.performers.createQuery, { name: p.name.trim() });
                            const newId = ENTITY_CONFIG.performers.createExtract(createRes.data);
                            if (newId) {
                                performerIdsToAdd.push(String(newId));
                                setCache('performers', null);
                            }
                        }
                    }
                }
            }

            // 3. Tags Resolution
            const checkedTagIndices = Array.from(container.querySelectorAll('.fasttag-scrape-tag-item:checked')).map(el => parseInt(el.getAttribute('data-idx'), 10));
            const tagIdsToAdd = [];

            if (checkedTagIndices.length > 0 && match.tags) {
                let cachedTags = getCachedOrNull('tags');
                if (!cachedTags) {
                    const res = await fetchGQL(ENTITY_CONFIG.tags.fetchQuery);
                    cachedTags = ENTITY_CONFIG.tags.extractList(res.data);
                    setCache('tags', cachedTags);
                }

                for (const idx of checkedTagIndices) {
                    const t = match.tags[idx];
                    if (!t || !t.name) continue;
                    if (t.stored_id) {
                        tagIdsToAdd.push(String(t.stored_id));
                    } else {
                        const found = cachedTags?.find(ct => (ct.name || '').trim().toLowerCase() === t.name.trim().toLowerCase());
                        if (found) {
                            tagIdsToAdd.push(String(found.id));
                        } else {
                            const createRes = await fetchGQL(ENTITY_CONFIG.tags.createQuery, { name: t.name.trim() });
                            const newId = ENTITY_CONFIG.tags.createExtract(createRes.data);
                            if (newId) {
                                tagIdsToAdd.push(String(newId));
                                setCache('tags', null);
                            }
                        }
                    }
                }
            }

            // 4. Update Scene & Synchronize Context
            if (ctx) {
                // In Edit Everything Popup: Update metadata first, then merge into context and trigger doSave()
                const metaInput = { id: sceneId };
                if (match.date) metaInput.date = match.date;
                if (isDetailsChecked && match.details) metaInput.details = match.details;
                if (match.image) metaInput.cover_image = match.image;
                if (isTitleChecked && match.title) metaInput.title = match.title;

                if (metaInput.date || metaInput.details || metaInput.cover_image || metaInput.title) {
                    const metaUpdate = `
                        mutation UpdateSceneMeta($input: SceneUpdateInput!) {
                            sceneUpdate(input: $input) { id }
                        }
                    `;
                    await fetchGQL(metaUpdate, { input: metaInput });
                }

                if (typeof ctx.setSelectedStudio === 'function' && studioIdToSet) {
                    ctx.setSelectedStudio(studioIdToSet);
                }
                if (typeof ctx.setSelectedPerformers === 'function') {
                    const currentPerfs = ctx.getSelectedPerformers ? ctx.getSelectedPerformers() : new Set();
                    performerIdsToAdd.forEach(id => currentPerfs.add(id));
                    ctx.setSelectedPerformers(currentPerfs);
                }
                if (typeof ctx.setSelectedTags === 'function') {
                    const currentTags = ctx.getSelectedTags ? ctx.getSelectedTags() : new Set();
                    tagIdsToAdd.forEach(id => currentTags.add(id));
                    ctx.setSelectedTags(currentTags);
                }

                if (typeof ctx.fetchColumnData === 'function' && popup) {
                    if (popup.tagsTable) await ctx.fetchColumnData('tags', popup.tagsTable, '', ctx.getSelectedTags());
                    if (popup.performersTable) await ctx.fetchColumnData('performers', popup.performersTable, '', ctx.getSelectedPerformers());
                }
                if (typeof ctx.renderStudioBar === 'function') {
                    await ctx.renderStudioBar('');
                }
                if (typeof ctx.refreshAllUI === 'function') {
                    ctx.refreshAllUI();
                }
                if (typeof ctx.doSave === 'function') {
                    await ctx.doSave('Matched & Saved from StashDB!');
                }
            } else {
                // In Single-Column Popup (Edit Tags, Edit Performers, Edit Studio):
                // Fetch current scene tags and performers first to safely MERGE without overwriting existing data
                const sceneRes = await fetchGQL(`query ($id: ID!) { findScene(id: $id) { id performers { id } tags { id } studio { id } } }`, { id: sceneId });
                const existingPerformerIds = (sceneRes?.data?.findScene?.performers || []).map(p => String(p.id));
                const existingTagIds = (sceneRes?.data?.findScene?.tags || []).map(t => String(t.id));

                const mergedPerformerIds = Array.from(new Set([...existingPerformerIds, ...performerIdsToAdd]));
                const mergedTagIds = Array.from(new Set([...existingTagIds, ...tagIdsToAdd]));

                const updateVars = { id: sceneId };
                if (studioIdToSet) updateVars.studio_id = studioIdToSet;
                if (mergedPerformerIds.length > 0) updateVars.performer_ids = mergedPerformerIds;
                if (mergedTagIds.length > 0) updateVars.tag_ids = mergedTagIds;
                if (match.date) updateVars.date = match.date;
                if (isDetailsChecked && match.details) updateVars.details = match.details;
                if (match.image) updateVars.cover_image = match.image;
                if (isTitleChecked && match.title) updateVars.title = match.title;

                await fetchGQL(`
                    mutation DirectSceneUpdate($input: SceneUpdateInput!) {
                        sceneUpdate(input: $input) { id }
                    }
                `, { input: updateVars });
                await refreshSceneCards();
                toastSuccess('Matched & Saved from StashDB!');

                sessionScrapeCache.delete(sceneId);

                // If in sequential edit mode, navigate to next scene; otherwise close popup cleanly
                if (sequentialEditState.enabled && popup && popup.element) {
                    const formEl = popup.element;
                    const type = formEl.getAttribute('data-entity-type') || 'tags';
                    if (sequentialEditState.currentIndex < sequentialEditState.allSceneCards.length - 1) {
                        let currentSelectedSet = new Set(mergedTagIds);
                        if (type === 'performers') currentSelectedSet = new Set(mergedPerformerIds);
                        else if (type === 'studios') currentSelectedSet = new Set(studioIdToSet ? [studioIdToSet] : []);
                        navigateToNextScene(formEl, type, 1, () => currentSelectedSet);
                        return;
                    }
                }
                closePopup();
                return;
            }

            const popupEl = popup?.element || (container ? container.closest('#scenes-popup') : null);
            if (popupEl && popupEl._savedPreScrapeSize) {
                popupEl.style.transition = 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), height 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
                popupEl.style.width = popupEl._savedPreScrapeSize.width;
                popupEl.style.height = popupEl._savedPreScrapeSize.height;
                popupEl._savedPreScrapeSize = null;
            }

            closeFloatingScraperHud();
            container.innerHTML = '';
            container.style.display = 'none';
            if (popup && popup.scrapeBtn) {
                popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                popup.scrapeBtn.title = 'Scrape scene metadata';
            }
            sessionScrapeCache.delete(sceneId);
        } catch (err) {
            console.error('[FastTag] Error accepting scrape match:', err);
            toastError('Failed to apply match: ' + (err?.message || err));
        }
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

            const suggestions = [];

            for (const item of allAvailableItems) {
                const name = (item.name || item.title || '').trim();
                if (!name || name.length < 2) continue;

                const nameLower = name.toLowerCase();
                const nameClean = nameLower.replace(/[^a-z0-9]+/g, ' ').trim();
                if (!nameClean) continue;

                const nameSpaced = ' ' + nameClean + ' ';

                if (fullTextSpaced.includes(nameSpaced)) {
                    suggestions.push(item);
                    if (suggestions.length >= 20) break;
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
        const isDark = theme === 'dark';
        const kbdBg = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
        const kbdBorder = isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)';
        const savedSize = getSavedPopupSize('single');
        const form = document.createElement('form');
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
        const maxScreenW = Math.max(320, window.innerWidth - 16);
        const maxScreenH = Math.max(380, window.innerHeight - 16);
        const optimal = getOptimalPopupSize('single');
        const rawW = savedSize?.width && savedSize.width >= 320 ? savedSize.width : optimal.width;
        const rawH = savedSize?.height && savedSize.height >= 380 ? savedSize.height : optimal.height;
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
                    <input type="text" id="${type}-search-input" autofocus class="popup-search-input" autocomplete="off" spellcheck="false" placeholder="Search ${config.pluralTitle.toLowerCase()}..." style="width: 100%; padding: 7px 28px 7px 10px; box-sizing: border-box; border-radius: 6px; font-size: 12px; outline: none;">
                    <span id="${type}-kbd-shortcut" style="position: absolute; right: 8px; font-size: 10px; font-weight: 700; opacity: 0.5; background: ${kbdBg}; padding: 1px 5px; border-radius: 4px; border: ${kbdBorder}; pointer-events: none; user-select: none;">/</span>
                    <span id="${type}-search-clear" class="popup-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 16px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="${type}-create-btn" style="padding: 7px 9px; cursor: pointer; font-size: 12px; font-weight: 500; background: #059669; color: white; border: none; border-radius: 6px; white-space: nowrap; display: none;">+ Create</button>
                <button type="button" id="${type}-refresh-btn" class="popup-refresh-btn" title="Refresh cache" style="padding: 7px 9px; cursor: pointer; font-size: 13px; font-weight: 500; border-radius: 6px; white-space: nowrap; line-height: 1;">↻</button>
                <button type="button" id="${type}-scrape-btn" class="popup-scrape-btn" title="Scrape scene metadata (StashDB / Scrapers) [Alt+S]" style="padding: 6px 8px; cursor: pointer; font-size: 11px; font-weight: 700; border-radius: 6px; white-space: nowrap; line-height: 1; background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#c7d2fe' : '#4338ca'}; border: 1px solid ${isDark ? 'rgba(99, 102, 241, 0.45)' : '#a5b4fc'}; display: inline-flex; align-items: center; gap: 3px; transition: all 0.15s ease;">⚡ Scrape</button>
            </div>
            <div id="${type}-scraper-card-container" style="display: none; flex-direction: column; margin-bottom: 8px; flex-shrink: 0; width: 100%; box-sizing: border-box;"></div>
            <div id="${type}-suggestions-container" style="display: none; flex-wrap: wrap; gap: 5px; margin-bottom: 9px; flex-shrink: 0; background: rgba(245, 158, 11, 0.08); padding: 6px 8px; border-radius: 6px; border: 1px dashed rgba(245, 158, 11, 0.35);"></div>
            <div id="${type}-quick-actions" style="display: none; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; flex-shrink: 0;"></div>
            <div id="${type}-tabulator-table" style="margin-bottom: 10px; width: 100%; flex: 1 1 0px; min-height: 60px; box-sizing: border-box; overflow: hidden;"></div>
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
            kbdShortcut: form.querySelector(`#${type}-kbd-shortcut`),
            createBtn: form.querySelector(`#${type}-create-btn`),
            scrapeBtn: form.querySelector(`#${type}-scrape-btn`),
            scraperCardContainer: form.querySelector(`#${type}-scraper-card-container`),
            refreshBtn: form.querySelector(`#${type}-refresh-btn`),
            saveBtn: form.querySelector(`#${type}-save-btn`),
            cancelBtn: form.querySelector(`#${type}-cancel-btn`)
        };
    }

    function positionPopupNearCard(form, cardElement) {
        const minTop = 8;
        const minLeft = 8;

        const clampPos = (x, y) => {
            const formW = form.offsetWidth || 400;
            const formH = form.offsetHeight || 500;
            const maxAllowedTop = Math.max(minTop, window.innerHeight - formH - 8);
            const maxAllowedLeft = Math.max(minLeft, window.innerWidth - formW - 8);
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
            const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
            return;
        }

        const cardRect = cardElement ? cardElement.getBoundingClientRect() : { right: 100, top: 100, left: 100 };
        let popupX = cardRect.right + 10;
        let popupY = Math.max(minTop, cardRect.top);

        form.style.left = `${popupX}px`;
        form.style.top = `${popupY}px`;

        requestAnimationFrame(() => {
            const formRect = form.getBoundingClientRect();
            if (cardRect.right + 10 + formRect.width > window.innerWidth) {
                popupX = cardRect.left - formRect.width - 10;
            }
            if (cardRect.top + formRect.height > window.innerHeight) {
                popupY = window.innerHeight - formRect.height - 8;
            }
            const pos = clampPos(popupX, popupY);

            form.style.left = `${pos.x}px`;
            form.style.top = `${pos.y}px`;

            form.classList.add('popup-visible');

            if (typeof form._fastTagOnResize === 'function') {
                form._fastTagOnResize();
            }

            const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
        });
    }

    function setupPopupListeners(form, signal, onSaveCallback) {
        setTimeout(() => {
            document.addEventListener('mousedown', (e) => {
                if (e.target && (
                    form.contains(e.target) ||
                    e.target.closest('#fasttag-floating-video-hud') ||
                    e.target.closest('#fasttag-floating-scraper-hud') ||
                    e.target.closest('#fasttag-performer-hover-card') ||
                    e.target.closest('#fasttag-settings-modal') ||
                    e.target.closest('#fasttag-create-modal') ||
                    e.target.closest('#fasttag-scrape-cover-tooltip') ||
                    e.target.closest('#fasttag-micro-tooltip') ||
                    e.target.closest('.toastify')
                )) {
                    return;
                }
                closePopup();
            }, { signal });
        }, 0);

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closePopup();
            } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
                const scrapeBtn = form.querySelector('.popup-scrape-btn');
                if (scrapeBtn && !scrapeBtn.disabled) {
                    e.preventDefault();
                    scrapeBtn.click();
                }
            } else if (e.key === 'Enter') {
                const scrapeAcceptBtn = form.querySelector('#fasttag-scrape-accept-btn');
                if (scrapeAcceptBtn && !scrapeAcceptBtn.disabled && scrapeAcceptBtn.offsetParent !== null) {
                    e.preventDefault();
                    scrapeAcceptBtn.click();
                    return;
                }

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
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        const header = form.querySelector('.popup-header') || form.querySelector('.popup-drag-handle');

        if (header) {
            header.addEventListener('mousedown', (e) => {
                if (e.target.closest('input, button, label')) return;
                isDragging = true;
                header.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
                startX = e.clientX;
                startY = e.clientY;
                const rect = form.getBoundingClientRect();
                startLeft = rect.left;
                startTop = rect.top;
            }, { signal });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    let targetX = startLeft + dx;
                    let targetY = startTop + dy;

                    // Strictly clamp to viewport bounds so the popup stays 100% inside visible screen
                    const minTop = 8;
                    const maxTop = Math.max(minTop, window.innerHeight - form.offsetHeight - 8);
                    const minLeft = 8;
                    const maxLeft = Math.max(minLeft, window.innerWidth - form.offsetWidth - 8);

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

                document.body.style.cursor = handle.style.cursor;
                document.body.style.userSelect = 'none';
            }, { signal });
        });

        document.addEventListener('mousemove', (e) => {
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
                const maxW = Math.max(minW, window.innerWidth - 16);
                const minH = 380;
                const maxH = Math.max(minH, window.innerHeight - 16);
                const minTop = 8;
                const maxBottom = window.innerHeight - 8;
                const minLeft = 8;
                const maxRight = window.innerWidth - 8;

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
        if (type === 'performers') attachPerformerHoverCard(table, activePopup.tableContainer);
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
        const kbdShortcut = activePopup.kbdShortcut;
        const saveBtn = activePopup.saveBtn;

        saveBtn.textContent = `Apply to ${bulkScenes.length} Scenes`;

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
            if (kbdShortcut) kbdShortcut.style.display = hasVal ? 'none' : 'block';
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

            const confirmedName = await promptCreateEntityDialog(type, val, form);
            if (!confirmedName) {
                filterInput.focus({ preventScroll: true });
                return;
            }

            const res = await fetchGQL(config.createQuery, config.createVariables(confirmedName));
            const newId = config.createExtract(res.data);

            if (newId) {
                toastSuccess(`${config.title} "${confirmedName}" created successfully`);
                invalidateCache(type);
                selectedIds.add(String(newId));
                addRecentEntry(type, { id: newId, [config.labelKey]: confirmedName });
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
            let updatedCount = 0;
            const CONCURRENCY = 3;
            for (let i = 0; i < bulkScenes.length; i += CONCURRENCY) {
                const batch = bulkScenes.slice(i, i + CONCURRENCY);
                await Promise.all(batch.map(async (scene) => {
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
                }));
                if (saveBtn) {
                    saveBtn.textContent = `Saving (${Math.min(i + CONCURRENCY, bulkScenes.length)}/${bulkScenes.length})...`;
                }
            }

            await refreshSceneCards();
            recordSaveUsage();
            closePopup();
            toastSuccess(`Applied ${config.title} to ${updatedCount} scenes`);
        };

        setupPopupListeners(form, signal, () => {});
        await fetchData("", true);
        positionPopupNearCard(form, bulkScenes[0].card || document.body);
        setTimeout(() => {
            if (filterInput && document.body.contains(filterInput)) {
                filterInput.focus({ preventScroll: true });
            }
        }, 80);
    }

    function promptCreateEntityDialog(type, initialValue, parentForm) {
        return new Promise((resolve) => {
            const config = ENTITY_CONFIG[type];
            const theme = getEffectiveTheme();
            const isDark = theme === 'dark';

            const overlay = document.createElement('div');
            overlay.className = 'fasttag-create-dialog-overlay';
            overlay.style.cssText = `
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(2px);
                z-index: 1000100;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 10px;
                padding: 16px;
                box-sizing: border-box;
                animation: fasttagFadeInDialog 0.15s cubic-bezier(0.16, 1, 0.3, 1);
            `;

            const dialog = document.createElement('div');
            dialog.className = 'fasttag-create-dialog-card';
            const cardBg = isDark ? '#1e293b' : '#ffffff';
            const cardBorder = isDark ? '1px solid rgba(148, 163, 184, 0.25)' : '1px solid #cbd5e1';
            const textColor = isDark ? '#f8fafc' : '#0f172a';
            const inputBg = isDark ? 'rgba(15, 23, 42, 0.6)' : '#f8fafc';
            const inputBorder = isDark ? '1px solid rgba(148, 163, 184, 0.3)' : '1px solid #cbd5e1';
            const icon = type === 'tags' ? '🏷️' : (type === 'performers' ? '⭐' : '🏢');
            const actionColor = type === 'tags' ? '#059669' : (type === 'performers' ? '#0284c7' : '#6366f1');

            dialog.style.cssText = `
                background: ${cardBg};
                border: ${cardBorder};
                border-radius: 8px;
                padding: 16px 18px;
                width: 100%;
                max-width: 360px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
                gap: 12px;
                color: ${textColor};
                box-sizing: border-box;
            `;

            dialog.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="font-size: 13.5px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px;">
                        <span>${icon}</span>
                        <span>Create New ${config.title}</span>
                    </div>
                    <button type="button" class="fasttag-dialog-close-btn" style="background: none; border: none; font-size: 18px; line-height: 1; cursor: pointer; color: inherit; opacity: 0.6; padding: 0 4px;" title="Cancel">&times;</button>
                </div>
                <div>
                    <label style="font-size: 11.5px; font-weight: 600; opacity: 0.85; margin-bottom: 4px; display: block; color: ${textColor};">${config.title} Name:</label>
                    <input type="text" class="fasttag-dialog-input" value="${escapeHtml(initialValue)}" style="width: 100%; padding: 7px 10px; border-radius: 6px; font-size: 13px; font-weight: 500; background: ${inputBg}; border: ${inputBorder}; color: ${isDark ? '#ffffff' : '#0f172a'} !important; outline: none; box-sizing: border-box;">
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button type="button" class="fasttag-dialog-cancel-btn" style="padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; border: ${inputBorder}; color: inherit; transition: all 0.15s ease;">Cancel</button>
                    <button type="button" class="fasttag-dialog-confirm-btn" style="padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: ${actionColor}; border: none; color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.15s ease;">Create ${config.title}</button>
                </div>
            `;

            overlay.appendChild(dialog);
            parentForm.appendChild(overlay);

            const input = dialog.querySelector('.fasttag-dialog-input');
            const confirmBtn = dialog.querySelector('.fasttag-dialog-confirm-btn');
            const cancelBtn = dialog.querySelector('.fasttag-dialog-cancel-btn');
            const closeBtn = dialog.querySelector('.fasttag-dialog-close-btn');

            const cleanup = (val) => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                resolve(val);
            };

            const doConfirm = () => {
                const finalVal = (input.value || '').trim();
                if (finalVal) {
                    cleanup(finalVal);
                } else {
                    input.focus();
                }
            };

            const doCancel = () => cleanup(null);

            confirmBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); doConfirm(); };
            cancelBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); doCancel(); };
            closeBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); doCancel(); };

            input.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    doConfirm();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    doCancel();
                }
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                    doCancel();
                }
            };

            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
        });
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
        form.style.position = 'fixed';
        form.style.zIndex = '1000000';
        form.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
        form.style.background = isDark ? '#1e293b' : '#ffffff';
        form.style.border = isDark ? '1px solid #334155' : '1px solid #cbd5e1';
        form.style.boxShadow = isDark ? '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)' : '0 20px 25px -5px rgba(0, 0, 0, 0.15)';
        form.style.padding = '8px 12px 12px 12px';
        form.style.borderRadius = '10px';
        const maxScreenW = Math.max(320, window.innerWidth - 16);
        const maxScreenH = Math.max(380, window.innerHeight - 16);
        const optimal = getOptimalPopupSize('everything');
        const rawW = savedSize?.width && savedSize.width >= 320 ? savedSize.width : optimal.width;
        const rawH = savedSize?.height && savedSize.height >= 380 ? savedSize.height : optimal.height;
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
            <div id="everything-popup-header" class="popup-header" style="margin: 0 0 7px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: grab; user-select: none; flex-shrink: 0; min-height: 20px;">
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
                    <input type="text" id="everything-global-search" autofocus class="popup-search-input" autocomplete="off" spellcheck="false" placeholder="Search tags, performers & studios..." style="width: 100%; padding: 5px 28px 5px 28px; box-sizing: border-box; border-radius: 6px; font-size: 12px; outline: none; border: none; background: transparent; color: inherit; font-family: inherit;">
                    <span id="everything-kbd-shortcut" style="position: absolute; right: 8px; font-size: 10px; font-weight: 700; opacity: 0.5; background: ${kbdBg}; padding: 1px 5px; border-radius: 4px; border: ${kbdBorder}; pointer-events: none; user-select: none;">/</span>
                    <span id="everything-global-clear" class="popup-search-clear" style="position: absolute; right: 8px; cursor: pointer; font-size: 15px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="everything-refresh-btn" class="popup-refresh-btn" title="Refresh all caches" style="padding: 5px 9px; cursor: pointer; font-size: 12px; font-weight: 500; border-radius: 6px; white-space: nowrap; line-height: 1; flex-shrink: 0;">↻</button>
                <button type="button" id="everything-scrape-btn" class="popup-scrape-btn" title="Scrape scene metadata (StashDB / Scrapers) [Alt+S]" style="padding: 5px 9px; cursor: pointer; font-size: 11.5px; font-weight: 700; border-radius: 6px; white-space: nowrap; line-height: 1; flex-shrink: 0; background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#c7d2fe' : '#4338ca'}; border: 1px solid ${isDark ? 'rgba(99, 102, 241, 0.45)' : '#a5b4fc'}; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;">⚡ Scrape</button>
            </div>

            <!-- Interactive Scraper Match Card Container -->
            <div id="everything-scraper-card-container" style="display: none; flex-direction: column; margin-bottom: 6px; flex-shrink: 0; width: 100%; box-sizing: border-box;"></div>

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
                    <div id="everything-tags-bottom-create" style="display: none; padding: 6px 0 2px 0; justify-content: center; flex-shrink: 0;"></div>
                </div>

                <!-- Clean Single 1px Vertical Divider / Resizer with invisible wide hit-area -->
                <div id="everything-col-resizer" style="width: 1px; background: ${isDark ? 'rgba(148, 163, 184, 0.2)' : '#cbd5e1'}; cursor: col-resize; position: relative; user-select: none; flex-shrink: 0; z-index: 5; transition: background 0.15s ease;">
                    <div style="position: absolute; top: 0; bottom: 0; left: -5px; right: -5px; cursor: col-resize;"></div>
                </div>

                <!-- Column 2: Performers (Right) -->
                <div id="everything-col-performers" style="flex: 1 1 0px; min-width: 140px; display: flex; flex-direction: column; padding: 6px; box-sizing: border-box; overflow: hidden;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; flex-shrink: 0;">
                        <span style="font-size: 11px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">👥 Performers</span>
                        <span id="everything-performers-badge" style="font-size: 10.5px; font-weight: 600; color: ${badgeColor};">0 selected</span>
                    </div>
                    <div id="everything-performers-chips" style="display: none; flex-wrap: wrap; gap: 4px; margin-bottom: 4px; flex-shrink: 0;"></div>
                    <div id="everything-performers-table" style="width: 100%; flex: 1 1 auto; min-height: 80px; box-sizing: border-box; overflow: hidden;"></div>
                    <div id="everything-performers-bottom-create" style="display: none; padding: 6px 0 2px 0; justify-content: center; flex-shrink: 0;"></div>
                </div>
            </div>

            <!-- Global Action Bar -->
            <div style="display: flex; gap: 8px; flex-shrink: 0;">
                <button type="button" id="everything-save-btn" style="flex: 1; padding: 8px; cursor: pointer; font-size: 12px; font-weight: 600; background: #6366f1; color: white; border: none; border-radius: 6px; transition: background 0.15s ease;">Save Scene</button>
                <button type="button" id="everything-cancel-btn" class="popup-cancel-btn" style="padding: 8px 14px; cursor: pointer; font-size: 12px; font-weight: 500; border-radius: 6px;">Close</button>
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
            scrapeBtn: form.querySelector('#everything-scrape-btn'),
            scraperCardContainer: form.querySelector('#everything-scraper-card-container'),
            refreshBtn: form.querySelector('#everything-refresh-btn'),
            columnsContainer: form.querySelector('#everything-columns-container'),
            colTags: form.querySelector('#everything-col-tags'),
            colPerformers: form.querySelector('#everything-col-performers'),
            colResizer: form.querySelector('#everything-col-resizer'),
            tags: {
                badge: form.querySelector('#everything-tags-badge'),
                chipsContainer: form.querySelector('#everything-tags-chips'),
                tableContainer: form.querySelector('#everything-tags-table'),
                bottomCreateContainer: form.querySelector('#everything-tags-bottom-create')
            },
            performers: {
                badge: form.querySelector('#everything-performers-badge'),
                chipsContainer: form.querySelector('#everything-performers-chips'),
                tableContainer: form.querySelector('#everything-performers-table'),
                bottomCreateContainer: form.querySelector('#everything-performers-bottom-create')
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
            { type: 'tags', icon: '🏷️' },
            { type: 'performers', icon: '⭐' },
            { type: 'studios', icon: '🏢' }
        ];

        const allSuggestions = [];

        for (const { type, icon } of types) {
            const config = ENTITY_CONFIG[type];
            let cached = getCachedOrNull(type);
            if (!cached) {
                const res = await fetchGQL(config.fetchQuery);
                cached = config.extractList(res.data);
                setCache(type, cached);
            }
            if (!cached) continue;

            for (const item of cached) {
                const name = (item.name || item.title || '').trim();
                if (!name || name.length < 2) continue;

                const nameClean = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
                if (!nameClean) continue;

                if (fullTextSpaced.includes(' ' + nameClean + ' ')) {
                    allSuggestions.push({ type, icon, item });
                    if (allSuggestions.length >= 25) break;
                }
            }
        }

        const tagsBox = container.querySelector('#everything-sugg-tags-box');
        const tagsChips = container.querySelector('#everything-sugg-tags-chips');
        const perfBox = container.querySelector('#everything-sugg-performers-box');
        const perfChips = container.querySelector('#everything-sugg-performers-chips');

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
                ctx.refreshAllUI();
            });

            if (parentChipsContainer) parentChipsContainer.appendChild(chip);
        };

        const renderSuggestionsUI = () => {
            if (tagsChips) tagsChips.innerHTML = '';
            if (perfChips) perfChips.innerHTML = '';

            const tagSuggestions = allSuggestions.filter(s => s.type === 'tags' && !ctx.selectedTagIds.has(String(s.item.id)));
            const perfSuggestions = allSuggestions.filter(s => {
                if (s.type === 'performers') return !ctx.selectedPerformerIds.has(String(s.item.id));
                if (s.type === 'studios') return ctx.selectedStudioId() !== String(s.item.id);
                return false;
            });

            tagSuggestions.forEach(s => createSuggestionChip(s, tagsChips));
            perfSuggestions.forEach(s => createSuggestionChip(s, perfChips));
            updateBoxVisibility();
        };

        container._fastTagRenderSuggestions = renderSuggestionsUI;
        renderSuggestionsUI();
    }

    async function navigateSequentialEditEverything(popup, sceneId, direction, doSaveFn) {
        if (!sequentialEditState.enabled) return;

        if (popup.scraperCardContainer) {
            popup.scraperCardContainer.innerHTML = '';
            popup.scraperCardContainer.style.display = 'none';
        }
        closeFloatingScraperHud();
        if (popup.scrapeBtn) {
            popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
            popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
            popup.scrapeBtn.title = 'Scrape scene metadata';
        }
        hideScrapeCoverTooltip();

        const ctx = popup._context;
        if (ctx && typeof doSaveFn === 'function' && typeof ctx.isDirty === 'function') {
            if (ctx.isDirty()) {
                await doSaveFn();
            }
        }

        const form = popup.element;
        if (form && form.isConnected) {
            const formRect = form.getBoundingClientRect();
            const minTop = 8;
            const minLeft = 8;
            const maxAllowedTop = Math.max(minTop, window.innerHeight - form.offsetHeight - 8);
            const maxAllowedLeft = Math.max(minLeft, window.innerWidth - form.offsetWidth - 8);

            sequentialEditState.popupPosition = {
                left: Math.max(minLeft, Math.min(maxAllowedLeft, formRect.left)),
                top: Math.max(minTop, Math.min(maxAllowedTop, formRect.top))
            };
        }

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

        const updateUI = () => {
            const isEnabled = sequentialEditState.enabled;
            seqCheckbox.checked = isEnabled;
            const sceneTitle = getSceneTitle(popup.sceneData, sceneId, cardElement);

            if (isEnabled) {
                if (!sequentialEditState.allSceneCards || sequentialEditState.allSceneCards.length === 0) {
                    sequentialEditState.allSceneCards = getAllVisibleSceneCards();
                }
                const cards = sequentialEditState.allSceneCards;
                const idx = getSceneCardIndex(sceneId, cards);
                if (idx !== -1) {
                    sequentialEditState.currentIndex = idx;
                    titleSpan.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; font-size: 13px; line-height: 1; flex-shrink: 0; margin-right: 4px; user-select: none; transform: translateY(1.5px);">⚡</span><span style="opacity: 0.85; font-size: 11px; background: rgba(99,102,241,0.22); padding: 1px 6px; border-radius: 4px; margin-right: 7px; font-weight: 700; color: #a5b4fc; white-space: nowrap; flex-shrink: 0; line-height: 1.3;">[${idx + 1}/${cards.length}]</span><span class="fasttag-marquee-box" style="flex: 1; min-width: 0; overflow: hidden; display: inline-flex; align-items: center;"><span class="fasttag-marquee-track"><span class="fasttag-marquee-item" data-raw-title="${escapeHtml(sceneTitle)}" title="${escapeHtml(sceneTitle)}">${escapeHtml(sceneTitle)}</span></span></span>`;
                    titleSpan.title = `${sceneTitle} [${idx + 1}/${cards.length}]`;
                    applyMarqueeAnimation(titleSpan);
                }
            } else {
                titleSpan.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; font-size: 13px; line-height: 1; flex-shrink: 0; margin-right: 7px; user-select: none; transform: translateY(1.5px);">⚡</span><span class="fasttag-marquee-box" style="flex: 1; min-width: 0; overflow: hidden; display: inline-flex; align-items: center;"><span class="fasttag-marquee-track"><span class="fasttag-marquee-item" data-raw-title="${escapeHtml(sceneTitle)}" title="${escapeHtml(sceneTitle)}">${escapeHtml(sceneTitle)}</span></span></span>`;
                titleSpan.title = sceneTitle;
                applyMarqueeAnimation(titleSpan);
            }

            prevBtn.disabled = !isEnabled;
            nextBtn.disabled = !isEnabled;
            prevBtn.style.opacity = isEnabled ? '1' : '0.4';
            nextBtn.style.opacity = isEnabled ? '1' : '0.4';
            prevBtn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
            nextBtn.style.cursor = isEnabled ? 'pointer' : 'not-allowed';

            if (popup.navGroup) {
                popup.navGroup.style.maxWidth = isEnabled ? '60px' : '0';
                popup.navGroup.style.opacity = isEnabled ? '1' : '0';
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

        seqCheckbox.onchange = (e) => {
            if (e.target.checked) {
                sequentialEditState.enabled = true;
                localStorage.setItem('fasttag_sequential_edit_mode', 'true');
                sequentialEditState.allSceneCards = getAllVisibleSceneCards();
                sequentialEditState.currentIndex = getSceneCardIndex(sceneId, sequentialEditState.allSceneCards);
                sequentialEditState.currentSceneId = sceneId;
                const form = popup.element;
                if (form) {
                    const formRect = form.getBoundingClientRect();
                    sequentialEditState.popupPosition = {
                        left: formRect.left,
                        top: formRect.top
                    };
                }
            } else {
                sequentialEditState.enabled = false;
                localStorage.setItem('fasttag_sequential_edit_mode', 'false');
                resetSequentialEditState();
            }
            updateUI();
            popup._context?.refreshAllUI?.();
        };

        prevBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (popup.scraperCardContainer) {
                popup.scraperCardContainer.innerHTML = '';
                popup.scraperCardContainer.style.display = 'none';
            }
            hideScrapeCoverTooltip();
            navigateSequentialEditEverything(popup, sceneId, -1, doSaveFn);
        };

        nextBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (popup.scraperCardContainer) {
                popup.scraperCardContainer.innerHTML = '';
                popup.scraperCardContainer.style.display = 'none';
            }
            hideScrapeCoverTooltip();
            navigateSequentialEditEverything(popup, sceneId, 1, doSaveFn);
        };
    }

    async function loadEditEverythingDataIntoPopup(sceneId, cardElement, popup) {
        try {
            const ctx = popup._context;
            if (!ctx) return;

            if (popup.scraperCardContainer) {
                popup.scraperCardContainer.innerHTML = '';
                popup.scraperCardContainer.style.display = 'none';
            }
            hideScrapeCoverTooltip();

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

            setTimeout(() => {
                if (popup.globalSearch && document.body.contains(popup.globalSearch)) {
                    popup.globalSearch.focus({ preventScroll: true });
                }
            }, 60);
        } catch (err) {
            console.error('[FastTag] Error in loadEditEverythingDataIntoPopup:', err);
            toastError(`Error loading data: ${err?.message || err}`);
        }
    }

    async function openEditEverythingPopup(sceneId, cardElement) {
        try {
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
            attachPerformerHoverCard(performersTable, popup.performers.tableContainer);

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
                const dirty = isDirty();
                if (sequentialEditState.enabled) {
                    const cards = sequentialEditState.allSceneCards || getAllVisibleSceneCards();
                    const idx = getSceneCardIndex(currentSceneId, cards);
                    const isLast = idx !== -1 && idx === cards.length - 1;
                    if (dirty) {
                        const saveText = isEasterEggActive() ? 'Save & Next Scene 🍫 ►' : 'Save & Next Scene ►';
                        const closeText = isEasterEggActive() ? 'Save & Close 🍫' : 'Save & Close';
                        popup.saveBtn.textContent = isLast ? closeText : saveText;
                        popup.saveBtn.style.background = '#10b981';
                        popup.saveBtn.classList.add('fasttag-btn-pulse-calm');
                    } else {
                        popup.saveBtn.textContent = isLast ? 'Close' : 'Next Scene ►';
                        popup.saveBtn.style.background = '#6366f1';
                        popup.saveBtn.classList.remove('fasttag-btn-pulse-calm');
                    }
                    popup.saveBtn.disabled = false;
                    popup.saveBtn.style.opacity = '1';
                    popup.saveBtn.style.cursor = 'pointer';
                } else {
                    popup.saveBtn.textContent = isEasterEggActive() ? 'Save Scene 🍫' : 'Save Scene';
                    if (dirty) {
                        popup.saveBtn.disabled = false;
                        popup.saveBtn.style.opacity = '1';
                        popup.saveBtn.style.cursor = 'pointer';
                        popup.saveBtn.style.background = '#10b981';
                        popup.saveBtn.classList.add('fasttag-btn-pulse-calm');
                    } else {
                        popup.saveBtn.disabled = true;
                        popup.saveBtn.style.opacity = '0.45';
                        popup.saveBtn.style.cursor = 'not-allowed';
                        popup.saveBtn.style.background = '#475569';
                        popup.saveBtn.classList.remove('fasttag-btn-pulse-calm');
                    }
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
                    await doSave();
                };

                studioBar.recentContainer.appendChild(chip);
            });
            };

            if (popup.studioBar?.clearBtn) {
                popup.studioBar.clearBtn.onclick = async (e) => {
                    e.preventDefault();
                    selectedStudioId = null;
                    refreshAllUI();
                    await doSave();
                };
            }

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

                    const rawTerm = (popup.globalSearch?.value || '').trim();
                    const bottomCreateEl = popup[type]?.bottomCreateContainer;

                    if (rawTerm && bottomCreateEl) {
                        const hasExactMatch = data.some(item => (item[config.labelKey] || '').toLowerCase() === rawTerm.toLowerCase());
                        if (!hasExactMatch) {
                            const btnBg = type === 'tags' ? '#059669' : '#0284c7';
                            const icon = type === 'tags' ? '🏷️' : '⭐';
                            bottomCreateEl.innerHTML = `
                                <button type="button" class="fasttag-create-empty-btn" data-type="${type}" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 16px; background: ${btnBg}; color: #ffffff; border: none; border-radius: 6px; font-size: 11.5px; font-weight: 600; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.15s ease;">${icon} Create ${config.title} "${escapeHtml(rawTerm)}"</button>
                            `;
                            bottomCreateEl.style.display = 'flex';
                        } else {
                            bottomCreateEl.innerHTML = '';
                            bottomCreateEl.style.display = 'none';
                        }
                    } else if (bottomCreateEl) {
                        bottomCreateEl.innerHTML = '';
                        bottomCreateEl.style.display = 'none';
                    }
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
                await doSave();
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
                await doSave();
            };

            const refreshAllUI = () => {
                updateBadges();
                updateSaveButton();
                renderStudioBar(popup.globalSearch.value);
                renderColumnChips(popup.tags.chipsContainer, 'tags', popup.globalSearch, selectedTagIds, onTagChipSelect);
                renderColumnChips(popup.performers.chipsContainer, 'performers', popup.globalSearch, selectedPerformerIds, onPerformerChipSelect);
                if (popup.suggestionsContainer && typeof popup.suggestionsContainer._fastTagRenderSuggestions === 'function') {
                    popup.suggestionsContainer._fastTagRenderSuggestions();
                }
                applyMarqueeAnimation(popup.titleSpan);
            };
            form._fastTagOnResize = () => {
                refreshAllUI();
                try {
                    tagsTable.redraw(false);
                    performersTable.redraw(false);
                } catch (e) {}
            };

            tagsTable.on("rowClick", (e, row) => {
                const id = row.getData()?.id;
                if (!id) return;
                const strId = String(id);
                const isSearching = popup.globalSearch && popup.globalSearch.value.trim().length > 0;

                if (selectedTagIds.has(strId)) {
                    selectedTagIds.delete(strId);
                    tagsTable.deselectRow(row);
                } else {
                    selectedTagIds.add(strId);
                    tagsTable.selectRow(row);
                    if (isSearching) {
                        popup.globalSearch.value = '';
                        popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                        Promise.all([
                            fetchColumnData('tags', tagsTable, '', selectedTagIds),
                            fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                        ]).then(() => {
                            const r = tagsTable.getRow(id);
                            if (r) tagsTable.scrollToRow(r, "top", false);
                            renderStudioBar('');
                            popup.globalSearch.focus({ preventScroll: true });
                        });
                    }
                }
                refreshAllUI();
                if (isSearching) {
                    doSave();
                }
            });

            performersTable.on("rowClick", (e, row) => {
                const id = row.getData()?.id;
                if (!id) return;
                const strId = String(id);
                const isSearching = popup.globalSearch && popup.globalSearch.value.trim().length > 0;

                if (selectedPerformerIds.has(strId)) {
                    selectedPerformerIds.delete(strId);
                    performersTable.deselectRow(row);
                } else {
                    selectedPerformerIds.add(strId);
                    performersTable.selectRow(row);
                    if (isSearching) {
                        popup.globalSearch.value = '';
                        popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                        Promise.all([
                            fetchColumnData('tags', tagsTable, '', selectedTagIds),
                            fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                        ]).then(() => {
                            const r = performersTable.getRow(id);
                            if (r) performersTable.scrollToRow(r, "top", false);
                            renderStudioBar('');
                            popup.globalSearch.focus({ preventScroll: true });
                        });
                    }
                }
                refreshAllUI();
                if (isSearching) {
                    doSave();
                }
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

            const handleCreateEntity = async (type) => {
                const searchVal = (popup.globalSearch?.value || '').trim();
                if (!searchVal) return;
                const finalName = await promptCreateEntityDialog(type, searchVal, form);
                if (!finalName) return; // user cancelled!

                const config = ENTITY_CONFIG[type];
                const res = await fetchGQL(config.createQuery, config.createVariables(finalName));
                const newId = config.createExtract(res.data);
                if (newId) {
                    invalidateCache(type);
                    if (type === 'tags') selectedTagIds.add(String(newId));
                    if (type === 'performers') selectedPerformerIds.add(String(newId));
                    addRecentEntry(type, { id: newId, [config.labelKey]: finalName });
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    await Promise.all([
                        fetchColumnData('tags', tagsTable, '', selectedTagIds),
                        fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                    ]);
                    refreshAllUI();
                    await doSave(`${config.title} "${finalName}" created & added to scene`);
                    popup.globalSearch.focus({ preventScroll: true });
                } else {
                    toastError(`Failed to create ${config.title.toLowerCase()}`, res.errors);
                }
            };

            form.addEventListener('click', (e) => {
                const btn = e.target.closest('.fasttag-create-empty-btn');
                if (btn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const type = btn.getAttribute('data-type');
                    if (type) handleCreateEntity(type);
                }
            });

            const doSave = async (customSuccessMessage = null) => {
                if (popup.scraperCardContainer) {
                    popup.scraperCardContainer.innerHTML = '';
                    popup.scraperCardContainer.style.display = 'none';
                }
                hideScrapeCoverTooltip();

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
                        initialTagIds = new Set(selectedTagIds);
                        initialPerformerIds = new Set(selectedPerformerIds);
                        initialStudioId = selectedStudioId;

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
                        recordSaveUsage();
                        toastSuccess(customSuccessMessage || 'Scene saved successfully');
                        updateSaveButton();
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
                await doSave();
            };

            makeColumnResizable(popup.columnsContainer, popup.colTags, popup.colPerformers, popup.colResizer, () => {
                try {
                    tagsTable.redraw(false);
                    performersTable.redraw(false);
                } catch (e) {}
            }, signal);

            if (popup.scrapeBtn) {
                popup.scrapeBtn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    // If scraper card is currently open, clicking this button (which says "Hide") closes it and toggles back to "Scrape"
                    const isScraperOpen = (popup.scraperCardContainer && popup.scraperCardContainer.style.display !== 'none' && popup.scraperCardContainer.innerHTML.trim() !== '') || (floatingScraperHudElement && document.body.contains(floatingScraperHudElement));
                    if (isScraperOpen) {
                        if (popup.scraperCardContainer) {
                            popup.scraperCardContainer.style.display = 'none';
                            popup.scraperCardContainer.innerHTML = '';
                        }
                        closeFloatingScraperHud();
                        popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                        popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                        popup.scrapeBtn.title = 'Scrape scene metadata';
                        hideScrapeCoverTooltip();
                        return;
                    }

                    // If already scraped for this scene during this active session, reopen instantly with 0ms lag!
                    if (sessionScrapeCache.has(currentSceneId) && sessionScrapeCache.get(currentSceneId)?.length > 0) {
                        const cached = sessionScrapeCache.get(currentSceneId);
                        cached._fromCache = true;
                        renderScraperMatchCard(popup.scraperCardContainer, cached, currentSceneId, popup._context, popup, () => {
                            popup.globalSearch?.focus({ preventScroll: true });
                        });
                        return;
                    }

                    const origHtml = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                    popup.scrapeBtn.disabled = true;
                    popup.scrapeBtn.innerHTML = `<span>⏳ Scraping...</span>`;

                    try {
                        const matches = await fetchScraperMatchesForScene(currentSceneId, cardElement);
                        if (!matches || matches.length === 0) {
                            popup.scrapeBtn.innerHTML = `<span>✕ No Matches</span>`;
                            toastError('No scraper matches found on configured scrapers');
                            setTimeout(() => {
                                popup.scrapeBtn.disabled = false;
                                popup.scrapeBtn.innerHTML = origHtml;
                            }, 2500);
                        } else {
                            sessionScrapeCache.set(currentSceneId, matches);
                            popup.scrapeBtn.disabled = false;
                            renderScraperMatchCard(popup.scraperCardContainer, matches, currentSceneId, popup._context, popup, () => {
                                popup.globalSearch?.focus({ preventScroll: true });
                            });
                        }
                    } catch (err) {
                        popup.scrapeBtn.disabled = false;
                        popup.scrapeBtn.innerHTML = origHtml;
                        toastError('Scrape error: ' + (err?.message || err));
                    }
                };
            }

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
                    if (isDirty()) {
                        await doSave();
                    }
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
            setTimeout(() => {
                if (popup.globalSearch && document.body.contains(popup.globalSearch)) {
                    popup.globalSearch.focus({ preventScroll: true });
                }
            }, 80);
        } catch (err) {
            console.error('[FastTag] Error in openEditEverythingPopup:', err);
            toastError(`Error opening Edit Everything: ${err?.message || err}`);
        }
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
        if (type === 'performers') attachPerformerHoverCard(table, activePopup.tableContainer);
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
        setTimeout(() => {
            if (activePopup?.searchInput && document.body.contains(activePopup.searchInput)) {
                activePopup.searchInput.focus({ preventScroll: true });
            }
        }, 80);
    }

    async function loadEntityDataIntoPopup(type, sceneId, cardElement, popup) {
        const config = ENTITY_CONFIG[type];
        const form = popup.element;

        if (popup.scraperCardContainer) {
            popup.scraperCardContainer.innerHTML = '';
            popup.scraperCardContainer.style.display = 'none';
        }
        hideScrapeCoverTooltip();

        form._fastTagSceneId = sceneId;
        form._fastTagSceneCard = cardElement;
        attachScenePreview(popup.previewContainer, sceneId, cardElement);

        const existingRes = await fetchGQL(config.fetchExistingQuery, { id: sceneId });
        form._fastTagSceneData = existingRes?.data?.findScene;
        const existingIds = config.extractExisting(existingRes.data);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        sequentialEditState.initialSelectedIds = new Set(selectedIds);
        let isRestoringSelections = false;

        setupSequentialEditHandlers(form, type, sceneId, cardElement, () => selectedIds);

        const filterInput = popup.searchInput;
        const clearBtn = popup.searchClear;
        const createBtn = popup.createBtn;
        const refreshBtn = popup.refreshBtn;
        const kbdShortcut = popup.kbdShortcut;

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
            if (kbdShortcut) kbdShortcut.style.display = hasVal ? 'none' : 'block';
        };

        let smartSuggestions = [];
        const onRecentChipSelect = async () => {
            filterInput.value = '';
            updateVisibility();
            await fetchData('', true);
            refreshUI();
            await saveWithoutReload(sceneId, selectedIds);
        };

        const refreshUI = () => {
            updateSequentialEditUI(form, type, selectedIds);
            renderQuickActions(form, type, filterInput, selectedIds, onRecentChipSelect);
            renderSmartSuggestions(form, type, filterInput, selectedIds, smartSuggestions, onRecentChipSelect);
        };
        form._fastTagOnResize = refreshUI;

        const saveWithoutReload = async (sId, ids, showToast = true) => {
            sessionStorage.setItem(scrollKey, window.scrollY);
            const success = await updateEntityForScene(type, sId, Array.from(ids));
            if (success) {
                sequentialEditState.initialSelectedIds = new Set(ids);
                await refreshSceneCards();
                recordSaveUsage();
                if (showToast) {
                    toastSuccess(`${config.title} saved`);
                }
                updateSequentialEditUI(form, type, ids);
            }
            return success;
        };

        activeTableInstance.on("rowClick", async (e, row) => {
            const id = row.getData()?.id;
            if (!id) return;
            const strId = String(id);
            const wasSearching = filterInput.value.trim().length > 0;

            if (selectedIds.has(strId)) {
                selectedIds.delete(strId);
                activeTableInstance.deselectRow(row);
                if (wasSearching) {
                    filterInput.value = '';
                    updateVisibility();
                    await saveWithoutReload(sceneId, selectedIds);
                    await fetchData("", false);
                    filterInput.focus({ preventScroll: true });
                }
            } else {
                selectedIds.add(strId);
                activeTableInstance.selectRow(row);
                if (wasSearching) {
                    filterInput.value = '';
                    updateVisibility();
                    await saveWithoutReload(sceneId, selectedIds);
                    await fetchData("", false);
                    const r = activeTableInstance.getRow(id);
                    if (r) activeTableInstance.scrollToRow(r, "top", false);
                    filterInput.focus({ preventScroll: true });
                }
            }
            refreshUI();
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
                renderSmartSuggestions(form, type, filterInput, selectedIds, smartSuggestions, onRecentChipSelect);
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

        if (popup.scrapeBtn) {
            popup.scrapeBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();

                // If scraper card is currently open, clicking this button (which says "Hide") closes it and toggles back to "Scrape"
                const isScraperOpen = (popup.scraperCardContainer && popup.scraperCardContainer.style.display !== 'none' && popup.scraperCardContainer.innerHTML.trim() !== '') || (floatingScraperHudElement && document.body.contains(floatingScraperHudElement));
                if (isScraperOpen) {
                    if (popup.scraperCardContainer) {
                        popup.scraperCardContainer.style.display = 'none';
                        popup.scraperCardContainer.innerHTML = '';
                    }
                    closeFloatingScraperHud();
                    popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                    popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                    popup.scrapeBtn.title = 'Scrape scene metadata';
                    hideScrapeCoverTooltip();
                    return;
                }

                // If already scraped for this scene during this active session, reopen instantly with 0ms lag!
                if (sessionScrapeCache.has(sceneId) && sessionScrapeCache.get(sceneId)?.length > 0) {
                    const cached = sessionScrapeCache.get(sceneId);
                    cached._fromCache = true;
                    renderScraperMatchCard(popup.scraperCardContainer, cached, sceneId, null, popup, () => {
                        filterInput.focus({ preventScroll: true });
                    });
                    return;
                }

                const origHtml = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                popup.scrapeBtn.disabled = true;
                popup.scrapeBtn.innerHTML = `<span>⏳ Scraping...</span>`;

                try {
                    const matches = await fetchScraperMatchesForScene(sceneId, cardElement);
                    if (!matches || matches.length === 0) {
                        popup.scrapeBtn.innerHTML = `<span>✕ No Matches</span>`;
                        toastError('No scraper matches found on configured scrapers');
                        setTimeout(() => {
                            popup.scrapeBtn.disabled = false;
                            popup.scrapeBtn.innerHTML = origHtml;
                        }, 2500);
                    } else {
                        sessionScrapeCache.set(sceneId, matches);
                        popup.scrapeBtn.disabled = false;
                        renderScraperMatchCard(popup.scraperCardContainer, matches, sceneId, null, popup, () => {
                            filterInput.focus({ preventScroll: true });
                        });
                    }
                } catch (err) {
                    popup.scrapeBtn.disabled = false;
                    popup.scrapeBtn.innerHTML = origHtml;
                    toastError('Scrape error: ' + (err?.message || err));
                }
            };
        }

        createBtn.onclick = async () => {
            const val = filterInput.value.trim();
            if (!val) return;

            const confirmedName = await promptCreateEntityDialog(type, val, form);
            if (!confirmedName) {
                filterInput.focus({ preventScroll: true });
                return;
            }

            const res = await fetchGQL(config.createQuery, config.createVariables(confirmedName));
            const newId = config.createExtract(res.data);

            if (newId) {
                invalidateCache(type);
                selectedIds.add(String(newId));
                addRecentEntry(type, { id: newId, [config.labelKey]: confirmedName });
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                refreshUI();
                await saveWithoutReload(sceneId, selectedIds, false);
                toastSuccess(`${config.title} "${confirmedName}" created & added to scene`);
                filterInput.focus({ preventScroll: true });
            } else {
                toastError(`Failed to create ${config.title.toLowerCase()}`, res.errors);
            }
        };

        await fetchData("", true);
        if (filterInput && document.body.contains(filterInput)) {
            filterInput.focus({ preventScroll: true });
        }

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

            if (hasSelectionChanged(selectedIds)) {
                const cached = getCachedOrNull(type) || [];
                const selectedItems = Array.from(selectedIds).map(id => cached.find(entry => String(entry.id) === String(id))).filter(Boolean);
                addRecentEntriesFromSelection(type, selectedItems);

                if (!isTabActive) await new Promise(r => setTimeout(r, 200));
                await saveWithoutReload(sceneId, selectedIds);
            }
        };

        popup.cancelBtn.onclick = () => closePopup();
    }

    // --- Global DOM Triggers ---
    document.addEventListener('contextmenu', function(event) {
        if (activePopup) return;
        closeMenu();
        const sceneCard = event.target.closest('.scene-card, [class*="scene-card"], [class*="SceneCard"]');
        if (!sceneCard) return;

        const sceneId = extractSceneId(sceneCard);
        if (sceneId) {
            showCustomMenu(event, sceneId, sceneCard);
        }
    }, true);

    document.addEventListener('click', function(event) {
        if (activePopup) return;
        const sceneCard = event.target.closest('.scene-card, [class*="scene-card"], [class*="SceneCard"]');
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
})();