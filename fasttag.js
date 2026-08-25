// ==UserScript==
// @name         Stash FastTag
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

    // --- Entity Configuration & Schema Registry ---
    const ENTITY_CONFIG = {
        tags: {
            title: 'Tag',
            pluralTitle: 'Tags',
            labelKey: 'name',
            searchFields: ['name'],
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true },
                { title: "Name", field: "name", widthGrow: 2, resizable: true },
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
            searchFields: ['name', 'disambiguation'],
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true },
                { title: "Name", field: "name", widthGrow: 2, resizable: true },
                { title: "Disambiguation", field: "disambiguation", widthGrow: 1, resizable: true },
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
            searchFields: ['title'],
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true },
                { title: "Title", field: "title", widthGrow: 2, resizable: true },
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
        galleries: { data: null, timestamp: 0 }
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
        galleries: 'stash_fast_tag_recent_galleries'
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
                galleries: { data: null, timestamp: 0 }
            };
        }
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
            localStorage.setItem(recentStorageKeys[type], JSON.stringify((Array.isArray(value) ? value : []).slice(0, 8)));
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

        hostContainer.innerHTML = '';
        hostContainer.style.display = 'block';
        hostContainer.style.position = 'relative';
        hostContainer.style.width = '100%';
        hostContainer.style.minHeight = '150px';
        hostContainer.style.margin = '0 0 10px 0';
        hostContainer.style.borderRadius = '8px';
        hostContainer.style.overflow = 'hidden';
        hostContainer.style.border = '1px solid #e2e8f0';
        hostContainer.style.background = '#0f172a';
        hostContainer.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.05)';

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
        media.style.height = '150px';
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
                if (e.key === 'Shift' && !shiftHeld) {
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
            if (!term) return aName.localeCompare(bName);

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
        const table = activeTableInstance;
        const config = ENTITY_CONFIG[type];
        const itemName = String(item && (item.name || item.title) ? (item.name || item.title) : '').trim().toLowerCase();

        if (!table) {
            if (input) {
                input.value = itemName;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus({ preventScroll: true });
            }
            return false;
        }

        const data = Array.isArray(table.getData()) ? table.getData() : [];
        const normalized = (v) => String(v || '').trim().toLowerCase();

        let match = null;
        if (item && item.id != null) {
            match = data.find(row => String(row.id) === String(item.id));
        }
        if (!match) {
            match = data.find(row => normalized(row[config.labelKey]) === itemName) ||
                    data.find(row => normalized(row[config.labelKey]).includes(itemName));
        }

        if (match && match.id != null) {
            const rowId = String(match.id);
            if (selectedIds.has(rowId)) {
                selectedIds.delete(rowId);
                try { table.deselectRow(rowId); } catch (e) {}
            } else {
                selectedIds.add(rowId);
                try {
                    table.selectRow(rowId);
                    const row = table.getRow(rowId);
                    if (row) table.scrollToRow(row, 'top', false);
                } catch (e) {}
            }

            if (typeof onSelected === 'function') onSelected();

            if (input) {
                input.value = '';
                input.focus({ preventScroll: true });
            }
            return true;
        }

        if (input) {
            input.value = item && (item.name || item.title) ? (item.name || item.title) : '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus({ preventScroll: true });
        }
        return false;
    }

    function renderQuickActions(form, type, input, selectedIds, onRecentChipSelect) {
        const target = form.querySelector(`#${type}-quick-actions`);
        if (!target) return;

        const recent = readRecentEntries(type)
            .slice(0, 8)
            .filter(item => item && (item.name || item.title))
            .map(item => ({ id: item.id, name: item.name || item.title }));

        if (!recent.length) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        target.innerHTML = '';
        target.style.display = 'flex';
        target.style.alignItems = 'center';
        target.style.flexWrap = 'wrap';
        target.style.gap = '5px';
        target.style.marginBottom = '10px';

        const isDark = getEffectiveTheme() === 'dark';
        const label = document.createElement('span');
        label.textContent = 'Recent:';
        label.className = 'popup-recent-label';
        label.style.cssText = `font-size: 10px; font-weight: 600; text-transform: uppercase; margin-right: 2px; user-select: none;`;
        target.appendChild(label);

        recent.forEach(item => {
            const isSelected = selectedIds && selectedIds.has(String(item.id));
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.textContent = isSelected ? `✓ ${item.name}` : item.name;
            chip.title = isSelected ? `Currently selected (${item.name})` : `Click to select ${item.name}`;

            if (isDark) {
                chip.style.cssText = isSelected
                    ? 'padding: 3px 8px; border: 1px solid #6366f1; border-radius: 999px; background: #312e81; color: #c7d2fe; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;'
                    : 'padding: 3px 8px; border: 1px solid #334155; border-radius: 999px; background: #0f172a; color: #cbd5e1; font-size: 10px; cursor: pointer; transition: all 0.15s ease;';
                chip.addEventListener('mouseenter', () => {
                    chip.style.background = isSelected ? '#3730a3' : '#334155';
                    if (!isSelected) chip.style.color = '#ffffff';
                });
                chip.addEventListener('mouseleave', () => {
                    chip.style.background = isSelected ? '#312e81' : '#0f172a';
                    if (!isSelected) chip.style.color = '#cbd5e1';
                });
            } else {
                chip.style.cssText = isSelected
                    ? 'padding: 3px 8px; border: 1px solid #818cf8; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 10px; font-weight: 600; cursor: pointer; transition: all 0.15s ease;'
                    : 'padding: 3px 8px; border: 1px solid #dfe3ea; border-radius: 999px; background: #f8fafc; color: #334155; font-size: 10px; cursor: pointer; transition: all 0.15s ease;';
                chip.addEventListener('mouseenter', () => {
                    if (!isSelected) chip.style.background = '#f1f5f9';
                });
                chip.addEventListener('mouseleave', () => {
                    if (!isSelected) chip.style.background = '#f8fafc';
                });
            }

            chip.addEventListener('click', () => {
                trySelectRecentChip(type, item, selectedIds, input, onRecentChipSelect);
            });
            target.appendChild(chip);
        });
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
        createMenuItem('Edit Galleries...', () => openEntityPopup('galleries', sceneId, cardElement));
        createMenuItem('Edit Scene', () => openEditScenePage(sceneId));

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

    // --- Generic Popup Builder & Life-Cycle ---
    function createPopupShell(type) {
        const config = ENTITY_CONFIG[type];
        const theme = getEffectiveTheme();
        const form = document.createElement('form');
        form.id = 'scenes-popup';
        form.className = `theme-${theme}`;
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'absolute';
        form.style.zIndex = '1000000';
        form.style.padding = '14px';
        form.style.borderRadius = '10px';
        form.style.width = '340px';
        form.style.boxSizing = 'border-box';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';

        form.innerHTML = `
            <div style="margin: 0 0 10px 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span id="${type}-popup-title" class="popup-title" style="font-size: 13px; font-weight: 600; user-select: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Edit ${config.pluralTitle}</span>
                <div style="display: flex; align-items: center; gap: 5px; flex-shrink: 0;">
                    <label class="popup-seq-label" style="font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 3px; user-select: none; padding-right: 2px;">
                        <input type="checkbox" id="${type}-sequential-mode" style="cursor: pointer; margin: 0; accent-color: #6366f1;">
                        Sequential
                    </label>
                    <button type="button" id="${type}-prev-btn" class="popup-nav-btn" style="padding: 3px 6px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: none; align-items: center;">◄</button>
                    <button type="button" id="${type}-next-btn" class="popup-nav-btn" style="padding: 3px 6px; cursor: pointer; font-size: 10px; font-weight: 600; border-radius: 4px; display: none; align-items: center;">►</button>
                    <span class="popup-drag-handle" title="Drag popup" style="font-size: 12px; font-weight: bold; cursor: grab; user-select: none; padding: 1px 4px; border-radius: 4px; line-height: 1.2;">⠿</span>
                </div>
            </div>
            <div id="${type}-preview-container"></div>
            <div style="display: flex; gap: 6px; margin-bottom: 8px; align-items: center;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="${type}-search-input" class="popup-search-input" autocomplete="off" spellcheck="false" placeholder="Search ${config.pluralTitle.toLowerCase()}..." style="width: 100%; padding: 7px 28px 7px 10px; box-sizing: border-box; border-radius: 6px; font-size: 12px; outline: none;">
                    <span id="${type}-search-clear" class="popup-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; font-size: 16px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="${type}-create-btn" style="padding: 7px 9px; cursor: pointer; font-size: 12px; font-weight: 500; background: #059669; color: white; border: none; border-radius: 6px; white-space: nowrap; display: none;">+ Create</button>
                <button type="button" id="${type}-refresh-btn" class="popup-refresh-btn" title="Refresh cache" style="padding: 7px 9px; cursor: pointer; font-size: 13px; font-weight: 500; border-radius: 6px; white-space: nowrap; line-height: 1;">↻</button>
            </div>
            <div id="${type}-quick-actions" style="display: none; flex-wrap: wrap; gap: 5px; margin-bottom: 8px;"></div>
            <div id="${type}-tabulator-table" style="margin-bottom: 10px; width: 100%; box-sizing: border-box;"></div>
            <div style="display: flex; gap: 8px;">
                <button type="button" id="${type}-save-btn" style="flex: 1; padding: 8px; cursor: pointer; font-size: 12px; font-weight: 600; background: #6366f1; color: white; border: none; border-radius: 6px; transition: background 0.15s ease;">Save ${config.pluralTitle}</button>
                <button type="button" id="${type}-cancel-btn" class="popup-cancel-btn" style="padding: 8px 14px; cursor: pointer; font-size: 12px; font-weight: 500; border-radius: 6px;">Close</button>
            </div>
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
        const dragHandle = form.querySelector('.popup-drag-handle');

        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => {
                isDragging = true;
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
                isDragging = false;
            }, { signal });
        }
    }

    async function openEntityPopup(type, sceneId, cardElement) {
        const config = ENTITY_CONFIG[type];
        if (!config || typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load.");
            return;
        }

        closePopup(false);

        popupAbortController = new AbortController();
        const { signal } = popupAbortController;

        activePopup = createPopupShell(type);
        const form = activePopup.element;

        const table = new Tabulator(activePopup.tableContainer, {
            layout: "fitColumns",
            height: "300px",
            placeholder: `No ${config.pluralTitle} Found`,
            selectable: true,
            index: "id",
            columns: config.columns,
            persistence: { columns: true },
            persistenceMode: "local",
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

        const refreshUI = () => {
            updateSequentialEditUI(form, type, selectedIds);
            renderQuickActions(form, type, filterInput, selectedIds, onRecentChipSelect);
        };

        const onRecentChipSelect = async () => {
            filterInput.value = '';
            updateVisibility();
            await fetchData('', false);
            if (!sequentialEditState.enabled) {
                await saveWithoutReload(sceneId, selectedIds);
            } else {
                refreshUI();
            }
        };

        const saveWithoutReload = async (sId, ids) => {
            sessionStorage.setItem(scrollKey, window.scrollY);
            const success = await updateEntityForScene(type, sId, Array.from(ids));
            if (success) {
                await refreshSceneCards();
                toastSuccess(`${config.title} saved`);
            }
            return success;
        };

        activeTableInstance.off("rowSelected");
        activeTableInstance.off("rowDeselected");

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
        if (activePopup || currentMenu) return;
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
            if (!window.location.pathname.startsWith('/settings')) return;

            const cards = document.querySelectorAll('.card, .list-group-item, [class*="plugin"], .setting-group, tr, div');
            for (let el of cards) {
                const text = el.innerText || el.textContent || '';
                if ((text.includes('FastTag') || text.includes('A Plugin')) && (text.includes('Fast scene tagging workflow') || text.includes('My first custom Stash plugin'))) {
                    if (el.querySelector('#fast-tag-plugin-settings')) return;

                    const hasChildWithSameText = Array.from(el.children).some(child => {
                        const childText = child.innerText || child.textContent || '';
                        return (childText.includes('FastTag') || childText.includes('A Plugin')) && (childText.includes('Fast scene tagging workflow') || childText.includes('My first custom Stash plugin'));
                    });
                    if (hasChildWithSameText) continue;

                    const settingsContainer = document.createElement('div');
                    settingsContainer.id = 'fast-tag-plugin-settings';
                    settingsContainer.style.cssText = 'margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(128,128,128,0.2); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; font-size: 13px;';

                    const label = document.createElement('span');
                    label.textContent = 'Popup Theme:';
                    label.style.fontWeight = '500';

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
                        btn.style.cssText = `padding: 4px 10px; font-size: 12px; border-radius: 6px; cursor: pointer; border: 1px solid ${isInit ? '#6366f1' : 'rgba(128,128,128,0.3)'}; background: ${isInit ? '#6366f1' : 'transparent'}; color: ${isInit ? '#ffffff' : 'inherit'}; font-weight: ${isInit ? '600' : 'normal'}; transition: all 0.15s ease;`;

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

                    settingsContainer.appendChild(label);
                    settingsContainer.appendChild(btnGroup);
                    el.appendChild(settingsContainer);
                    break;
                }
            }
        };

        tryInjectSettings();
        const observer = new MutationObserver(() => tryInjectSettings());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    initSettingsPageObserver();
})();