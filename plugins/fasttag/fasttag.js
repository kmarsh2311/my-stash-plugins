// ==UserScript==
// @name         Stash FastTag
// @namespace    http://tampermonkey.net/
// @version      4.2.11
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
    const FastTagCore = window.FastTag?.core;
    if (!FastTagCore) throw new Error('[FastTag] fasttag-core.js must load before fasttag.js');
    const FastTagEntities = window.FastTag?.entities;
    if (!FastTagEntities) throw new Error('[FastTag] fasttag-entities.js must load before fasttag.js');
    const FastTagStorage = window.FastTag?.storage;
    if (!FastTagStorage) throw new Error('[FastTag] fasttag-storage.js must load before fasttag.js');
    const FastTagIntegrations = window.FastTag?.integrations;
    if (!FastTagIntegrations) throw new Error('[FastTag] fasttag-integrations.js must load before fasttag.js');
    const FastTagGemini = window.FastTag?.gemini;
    if (!FastTagGemini) throw new Error('[FastTag] fasttag-gemini.js must load before fasttag.js');
    const FastTagScraper = window.FastTag?.scraper;
    if (!FastTagScraper) throw new Error('[FastTag] fasttag-scraper.js must load before fasttag.js');
    const FastTagScraperUi = window.FastTag?.scraperUi;
    if (!FastTagScraperUi) throw new Error('[FastTag] fasttag-scraper-ui.js must load before fasttag.js');
    const FastTagPreview = window.FastTag?.preview;
    if (!FastTagPreview) throw new Error('[FastTag] fasttag-preview.js must load before fasttag.js');
    const FastTagUi = window.FastTag?.ui;
    if (!FastTagUi) throw new Error('[FastTag] fasttag-ui.js must load before fasttag.js');
    const FastTagEditors = window.FastTag?.editors;
    if (!FastTagEditors) throw new Error('[FastTag] fasttag-editors.js must load before fasttag.js');
    const FastTagWorkflows = window.FastTag?.workflows;
    if (!FastTagWorkflows) throw new Error('[FastTag] fasttag-workflows.js must load before fasttag.js');
    if (window.__fastTagRuntimeInitialized) {
        console.warn('[FastTag] Runtime is already initialized; skipped duplicate event-handler registration.');
        return;
    }
    window.__fastTagRuntimeInitialized = true;
    const {
        escapeHtml,
        cleanTitleForScraping,
        formatTime,
        formatDurationSec,
        parseDurationSec,
        cleanFilenameForSuggestions,
        normalizeTextForSuggestions,
        rankSuggestionItems,
        findUniqueSelectedPerformerComponentMatch,
        extractSceneId,
        findSceneCardForContextTarget,
        isScenePreviewContextTarget
    } = FastTagCore;
    const { SCENE_CARD_UPDATE_FIELDS, ENTITY_CONFIG } = FastTagEntities;
    const {
        getAutoScrapeSequential,
        setAutoScrapeSequential,
        getThemePreference,
        setThemePreference,
        getShowIdColumns,
        setShowIdColumns,
        getEnableSuggestions,
        setEnableSuggestions,
        getEnableCardIconClicks,
        setEnableCardIconClicks,
        getAlwaysPlayFullVideo,
        setAlwaysPlayFullVideo,
        getShowRecentChips,
        setShowRecentChips,
        getShowPinnedChips,
        setShowPinnedChips,
        getGeminiApiKey,
        setGeminiApiKey,
        getGeminiModel,
        setGeminiModel,
        getGeminiAutoParse,
        setGeminiAutoParse,
        getAutoMarkOrganized,
        setAutoMarkOrganized,
        DEFAULT_SCRUB_SPEEDS,
        MAX_SCRUB_CUE_DISPLAYS,
        getScrubSpeeds,
        setScrubSpeeds,
        getScrubCueCount,
        incrementScrubCueCount,
        resetScrubCueCount,
        isVideoHudPersistedOpen,
        setVideoHudPersistedOpen,
        isScraperHudPersistedOpen,
        setScraperHudPersistedOpen,
        getDetachScraper,
        setDetachScraper,
        getHideObviousFalsePositives,
        setHideObviousFalsePositives,
        idbGet,
        idbSet,
        idbDelete,
        readPinnedEntries,
        writePinnedEntries,
        readRecentEntries,
        writeRecentEntries,
        addRecentEntry,
        addRecentEntriesFromSelection
    } = FastTagStorage;
    const {
        resetRefractSceneCards,
        syncSceneToApolloCache,
        refreshSceneCards,
        refreshSceneCardsDebounced
    } = FastTagIntegrations;
    const { callGeminiAPI, parseSceneWithGemini } = FastTagGemini;
    const {
        analyzeScraperMatch,
        readScrapeFieldSelection,
        buildScrapeUpdateInput,
        buildAcceptedSceneStashIds,
        getScraperResultUrl,
        partitionObviousFalsePositiveMatches,
        resolveScrapedStudioResult,
        resolveScrapedEntityIdsResult,
        fetchScraperMatchesForScene
    } = FastTagScraper;
    const {
        getAssessmentPresentation,
        getAcceptPresentation,
        getPerformerPresentation,
        getSourcePresentation,
        getUnavailableContextPresentation
    } = FastTagScraperUi;
    const {
        getDominantWheelDelta,
        getWheelNotches,
        selectScrubStep,
        calculateScrubTarget,
        getDefaultPopoutSize,
        calculateVideoPopoutPosition,
        fetchSceneMediaUrls: fetchSceneMediaUrlsFromModule
    } = FastTagPreview;
    const { getOptimalPopupSize, getDefaultEverythingPosition } = FastTagUi;
    const {
        createSerialTaskQueue,
        createRandomSceneHistory,
        appendRandomSceneHistory,
        moveRandomSceneHistory
    } = FastTagWorkflows;
    const {
        hasSelectionSetChanged,
        calculateBulkSelectionDelta,
        applyBulkSelectionDelta
    } = FastTagEditors;

    FastTagGemini.configure({
        fetchGQL: (...args) => fetchGQL(...args),
        getGeminiApiKey,
        getGeminiModel,
        getCachedOrNull: type => getCachedOrNull(type),
        log: (...args) => ftLog(...args)
    });
    FastTagScraper.configure({
        fetchGQL: (...args) => fetchGQL(...args),
        cleanTitleForScraping,
        parseDurationSec,
        getEntityConfig: type => ENTITY_CONFIG[type],
        getCachedOrNull: type => getCachedOrNull(type),
        setCache: (type, data) => setCache(type, data)
    });
    FastTagPreview.configure({ fetchGQL: (...args) => fetchGQL(...args) });
    FastTagUi.configure({
        getDefaultPopoutSize,
        log: (...args) => ftLog(...args)
    });

    console.log('[FastTag v4.2.11] Initialized with Targeted Apollo Cache Sync, IndexedDB Cache, and 0ms Scene Card Updates');

    let fastTagHelpLoadPromise = null;
    function loadFastTagHelpModule() {
        if (window.FastTag?.help?.openGuide) return Promise.resolve(window.FastTag.help);
        if (fastTagHelpLoadPromise) return fastTagHelpLoadPromise;

        fastTagHelpLoadPromise = new Promise((resolve, reject) => {
            const assetPaths = [
                '/plugin/fasttag/assets/fasttag-help.js',
                '/plugin/mypluginrc/assets/fasttag-help.js'
            ];
            const attemptLoad = (index) => {
                document.getElementById('fasttag-help-script')?.remove();
                if (index >= assetPaths.length) {
                    reject(new Error(`The offline help module could not be loaded (${assetPaths.join(' or ')}).`));
                    return;
                }
                const script = document.createElement('script');
                script.id = 'fasttag-help-script';
                script.src = new URL(assetPaths[index], window.location.origin).href;
                script.async = true;
                script.onload = () => {
                    if (window.FastTag?.help?.openGuide) resolve(window.FastTag.help);
                    else attemptLoad(index + 1);
                };
                script.onerror = () => attemptLoad(index + 1);
                document.head.appendChild(script);
            };
            attemptLoad(0);
        }).catch(error => {
            fastTagHelpLoadPromise = null;
            throw error;
        });
        return fastTagHelpLoadPromise;
    }

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
        studios: { data: null, timestamp: 0 },
        groups: { data: null, timestamp: 0 }
    };
    const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
    const REVALIDATE_INTERVAL = 2 * 60 * 60 * 1000; // 2 hours background revalidation threshold

    // --- IndexedDB Persistent Caching Layer (0ms Remote Access) ---
    async function prewarmCacheFromIDB() {
        try {
            const types = ['tags', 'performers', 'studios', 'groups', 'galleries'];
            const promises = types.map(async (type) => {
                const item = await idbGet(type);
                if (item && item.data && Array.isArray(item.data) && (Date.now() - item.timestamp < CACHE_TTL)) {
                    cacheStore[type] = { data: item.data, timestamp: item.timestamp };
                }
            });
            await Promise.all(promises);
            console.log('[FastTag] Pre-warmed cache from IndexedDB:', {
                tags: cacheStore.tags?.data?.length || 0,
                performers: cacheStore.performers?.data?.length || 0,
                studios: cacheStore.studios?.data?.length || 0,
                groups: cacheStore.groups?.data?.length || 0
            });
        } catch (e) {
            console.warn('[FastTag] Error pre-warming cache from IndexedDB:', e);
        }
    }

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
            overscroll-behavior: contain !important;
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

        .fasttag-btn-random {
            background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%) !important;
            box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4), 0 1px 3px rgba(0, 0, 0, 0.2) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            color: #ffffff !important;
            font-weight: 700 !important;
            letter-spacing: 0.01em;
            position: relative;
            overflow: hidden;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .fasttag-btn-random:hover {
            transform: translateY(-1.5px) !important;
            box-shadow: 0 6px 20px rgba(217, 70, 239, 0.5), 0 2px 5px rgba(0, 0, 0, 0.25) !important;
            filter: brightness(1.06);
        }
        .fasttag-btn-random:active {
            transform: translateY(1px) scale(0.98) !important;
            box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4) !important;
        }
        .fasttag-btn-random::after {
            content: '';
            position: absolute;
            top: 0; left: -100%; width: 60%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.28), transparent);
            transform: skewX(-20deg);
            transition: left 0.6s ease;
            pointer-events: none;
        }
        .fasttag-dice-icon {
            display: inline-block;
            transform-origin: center center;
        }
        @keyframes fasttagDiceRoll {
            0% { transform: rotate(0deg) scale(1); }
            40% { transform: rotate(180deg) scale(1.45); }
            75% { transform: rotate(380deg) scale(1.15); }
            100% { transform: rotate(360deg) scale(1); }
        }
        .fasttag-dice-rolling {
            animation: fasttagDiceRoll 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
        }

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
        #scenes-popup .tabulator-tableholder,
        #fasttag-floating-video-hud,
        #fasttag-floating-scraper-hud,
        #fasttag-settings-modal,
        #fasttag-scrape-items-preview {
            overscroll-behavior: contain !important;
        }

        #scenes-popup.theme-dark .popup-title { color: #f1f5f9 !important; }
        #scenes-popup.theme-dark .popup-seq-label { color: #94a3b8 !important; }
        #scenes-popup.theme-dark .popup-nav-btn { background: #334155 !important; color: #e2e8f0 !important; border: 1px solid #475569 !important; }
        #scenes-popup.theme-dark .popup-drag-handle { border: 1px solid #334155 !important; background: #0f172a !important; color: #94a3b8 !important; }
        #scenes-popup.theme-dark .popup-search-input {
            border: 1px solid rgba(99, 102, 241, 0.35) !important;
            background: #0f172a !important;
            color: #ffffff !important;
            font-weight: 500 !important;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.2) !important;
            transition: all 0.15s ease !important;
        }
        #scenes-popup.theme-dark .popup-search-input:focus {
            border-color: #818cf8 !important;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25), inset 0 1px 2px rgba(0, 0, 0, 0.4) !important;
            background: #131c2e !important;
        }
        #scenes-popup.theme-dark .popup-search-input::placeholder {
            color: rgba(148, 163, 184, 0.45) !important;
            font-weight: 400 !important;
            letter-spacing: 0.15px !important;
        }
        #scenes-popup.theme-dark .popup-search-clear { color: #818cf8 !important; }
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
        #scenes-popup.theme-light .popup-search-input {
            border: 1px solid rgba(99, 102, 241, 0.38) !important;
            background: #ffffff !important;
            color: #0f172a !important;
            font-weight: 500 !important;
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.08) !important;
            transition: all 0.15s ease !important;
        }
        #scenes-popup.theme-light .popup-search-input:focus {
            border-color: #6366f1 !important;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2) !important;
        }
        #scenes-popup.theme-light .popup-search-input::placeholder {
            color: rgba(100, 116, 139, 0.5) !important;
            font-weight: 400 !important;
            letter-spacing: 0.15px !important;
        }
        #scenes-popup.theme-light .popup-search-clear { color: #6366f1 !important; }
        #scenes-popup.theme-light .popup-refresh-btn { border: 1px solid #cbd5e1 !important; background: #f8fafc !important; color: #475569 !important; }
        #scenes-popup.theme-light .popup-cancel-btn { background: #f1f5f9 !important; border: 1px solid #cbd5e1 !important; color: #334155 !important; }

        #scenes-popup.theme-dark .tabulator {
            border: 1px solid #334155 !important;
            border-radius: 8px !important;
            overflow: hidden !important;
        }
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
            background-color: #131c2e !important;
            border-bottom: 1px solid rgba(148, 163, 184, 0.22) !important;
            color: #cbd5e1 !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col {
            background-color: transparent !important;
            border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col:last-child {
            border-right: none !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-header .tabulator-col-title {
            color: #cbd5e1 !important;
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
        /* Virtual Action Row - Base */
        #scenes-popup .tabulator .tabulator-row.fasttag-virtual-action-row,
        #scenes-popup.theme-dark .tabulator .tabulator-row.fasttag-virtual-action-row,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-even.fasttag-virtual-action-row,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-odd.fasttag-virtual-action-row {
            transition: background-color 0.12s ease;
        }

        /* Virtual Action Row - Pending (Warm Amber) */
        #scenes-popup .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-pending,
        #scenes-popup.theme-dark .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-pending,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-even.fasttag-virtual-action-row.fasttag-action-pending,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-odd.fasttag-virtual-action-row.fasttag-action-pending {
            background-color: rgba(245, 158, 11, 0.12) !important;
            border-left: 3px solid #f59e0b !important;
        }
        #scenes-popup .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-pending:hover,
        #scenes-popup.theme-dark .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-pending:hover,
        #scenes-popup .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-pending.fasttag-keyboard-active,
        #scenes-popup.theme-dark .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-pending.fasttag-keyboard-active {
            background-color: rgba(245, 158, 11, 0.24) !important;
        }
        .tabulator-row.fasttag-virtual-action-row.fasttag-action-pending .tabulator-cell {
            font-weight: 600 !important;
            color: #b45309 !important;
        }
        #scenes-popup.theme-dark .tabulator-row.fasttag-virtual-action-row.fasttag-action-pending .tabulator-cell {
            color: #fbbf24 !important;
        }

        /* Virtual Action Row - Completed (Emerald Green) */
        #scenes-popup .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-completed,
        #scenes-popup.theme-dark .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-completed,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-even.fasttag-virtual-action-row.fasttag-action-completed,
        #scenes-popup.theme-dark .tabulator .tabulator-row.tabulator-row-odd.fasttag-virtual-action-row.fasttag-action-completed {
            background-color: rgba(16, 185, 129, 0.12) !important;
            border-left: 3px solid #10b981 !important;
        }
        #scenes-popup .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-completed:hover,
        #scenes-popup.theme-dark .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-completed:hover,
        #scenes-popup .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-completed.fasttag-keyboard-active,
        #scenes-popup.theme-dark .tabulator .tabulator-row.fasttag-virtual-action-row.fasttag-action-completed.fasttag-keyboard-active {
            background-color: rgba(16, 185, 129, 0.24) !important;
        }
        .tabulator-row.fasttag-virtual-action-row.fasttag-action-completed .tabulator-cell {
            font-weight: 600 !important;
            color: #059669 !important;
        }
        #scenes-popup.theme-dark .tabulator-row.fasttag-virtual-action-row.fasttag-action-completed .tabulator-cell {
            color: #34d399 !important;
        }

        #scenes-popup .tabulator .tabulator-row.fasttag-keyboard-active,
        #scenes-popup .tabulator .tabulator-row.fasttag-keyboard-active.tabulator-row-even,
        #scenes-popup .tabulator .tabulator-row.fasttag-keyboard-active.tabulator-row-odd,
        .tabulator .tabulator-row.fasttag-keyboard-active {
            outline: 2px solid #f43f5e !important;
            outline-offset: -2px !important;
            box-shadow: 0 0 10px rgba(244, 63, 94, 0.45) !important;
            background-color: rgba(244, 63, 94, 0.15) !important;
            position: relative !important;
            z-index: 5 !important;
        }
        #scenes-popup .tabulator .tabulator-row.fasttag-keyboard-active .tabulator-cell {
            outline: none !important;
            border-left: none !important;
            border-right: none !important;
        }
        #scenes-popup.theme-dark .tabulator .tabulator-row.fasttag-keyboard-active.tabulator-selected {
            background-color: #3730a3 !important;
            outline: 2px solid #38bdf8 !important;
            outline-offset: -2px !important;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-row.fasttag-keyboard-active {
            outline: 2px solid #e11d48 !important;
            outline-offset: -2px !important;
            box-shadow: 0 0 8px rgba(225, 29, 72, 0.3) !important;
            background-color: rgba(225, 29, 72, 0.12) !important;
            position: relative !important;
            z-index: 5 !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-row.fasttag-keyboard-active.tabulator-selected {
            background-color: #93c5fd !important;
            outline: 2px solid #2563eb !important;
            outline-offset: -2px !important;
            box-shadow: 0 0 10px rgba(37, 99, 235, 0.4) !important;
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
            border-radius: 8px !important;
            overflow: hidden !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            font-size: 12px !important;
            color: #1e293b !important;
        }
        #scenes-popup.theme-light .tabulator .tabulator-header {
            background-color: #f1f5f9 !important;
            border-bottom: 1px solid #cbd5e1 !important;
            color: #334155 !important;
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

        /* Pill containers - Clean fenced card perfectly married with table */
        [id$="-quick-actions"] {
            box-sizing: border-box !important;
            padding: 5px 6px !important;
            border-radius: 6px !important;
            height: 52px !important;
            max-height: 52px !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            overscroll-behavior: contain !important;
            scrollbar-width: thin !important;
            scrollbar-color: rgba(148, 163, 184, 0.35) transparent !important;
            margin-bottom: 8px !important;
        }
        #scenes-popup.theme-dark [id$="-quick-actions"] {
            background-color: #1e293b !important;
            border: 1px solid #334155 !important;
        }
        #scenes-popup.theme-light [id$="-quick-actions"] {
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
        }
        [id$="-quick-actions"]::-webkit-scrollbar,
        #everything-tags-chips::-webkit-scrollbar,
        #everything-performers-chips::-webkit-scrollbar {
            width: 4px !important;
            display: block !important;
        }
        [id$="-quick-actions"]::-webkit-scrollbar-thumb,
        #everything-tags-chips::-webkit-scrollbar-thumb,
        #everything-performers-chips::-webkit-scrollbar-thumb {
            background: rgba(148, 163, 184, 0.35) !important;
            border-radius: 4px !important;
        }

        /* Body scroll lock when FastTag is open */
        body.fasttag-modal-open {
            overflow: hidden !important;
        }

        /* Sortable column header styling - Idea 2 */
        .fasttag-sortable-header {
            cursor: pointer !important;
            user-select: none !important;
            transition: background-color 0.15s ease !important;
        }
        #scenes-popup.theme-dark .fasttag-sortable-header:hover {
            background-color: rgba(99, 102, 241, 0.16) !important;
        }
        #scenes-popup.theme-dark .fasttag-sortable-header:hover .tabulator-col-title {
            color: #ffffff !important;
        }
        #scenes-popup.theme-light .fasttag-sortable-header:hover {
            background-color: rgba(99, 102, 241, 0.08) !important;
        }
        #scenes-popup.theme-light .fasttag-sortable-header:hover .tabulator-col-title {
            color: #1e1b4b !important;
        }

        .fasttag-sort-arrow-btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 18px !important;
            height: 18px !important;
            border-radius: 4px !important;
            font-size: 10px !important;
            color: #818cf8 !important;
            cursor: pointer !important;
            user-select: none !important;
            transition: all 0.15s ease !important;
            line-height: 1 !important;
        }
        #scenes-popup.theme-dark .fasttag-sort-arrow-btn:hover {
            background: rgba(99, 102, 241, 0.3) !important;
            color: #ffffff !important;
            transform: scale(1.18);
        }
        #scenes-popup.theme-light .fasttag-sort-arrow-btn:hover {
            background: rgba(99, 102, 241, 0.15) !important;
            color: #4f46e5 !important;
            transform: scale(1.18);
        }

        #fasttag-sort-dropdown-menu {
            animation: fasttagMenuFadeIn 0.12s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fasttagMenuFadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
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
        @keyframes fasttagMatchBadgePulse {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.35);
                background: rgba(99, 102, 241, 0.18);
                border-color: rgba(129, 140, 248, 0.55);
            }
            50% {
                box-shadow: 0 0 8px 1px rgba(99, 102, 241, 0.55);
                background: rgba(99, 102, 241, 0.35);
                border-color: rgba(165, 180, 252, 0.95);
            }
        }
        .fasttag-match-counter-pulse {
            animation: fasttagMatchBadgePulse 2.8s infinite ease-in-out !important;
        }
        .fasttag-match-counter-pulse:hover {
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
        @keyframes fasttagCreatePulse {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4), 0 2px 5px rgba(0, 0, 0, 0.25);
                filter: brightness(1);
            }
            50% {
                box-shadow: 0 0 14px 3px rgba(16, 185, 129, 0.55), 0 2px 6px rgba(0, 0, 0, 0.3);
                filter: brightness(1.12);
            }
        }
        @keyframes fasttagCreatePulsePerformer {
            0%, 100% {
                box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.4), 0 2px 5px rgba(0, 0, 0, 0.25);
                filter: brightness(1);
            }
            50% {
                box-shadow: 0 0 14px 3px rgba(2, 132, 199, 0.55), 0 2px 6px rgba(0, 0, 0, 0.3);
                filter: brightness(1.12);
            }
        }
        .fasttag-create-empty-btn {
            animation: fasttagCreatePulse 3.5s infinite ease-in-out !important;
            transition: transform 0.15s ease, filter 0.15s ease !important;
        }
        .fasttag-create-empty-btn[data-type="performers"] {
            animation: fasttagCreatePulsePerformer 3.5s infinite ease-in-out !important;
        }
        .fasttag-create-empty-btn:hover {
            animation-play-state: paused !important;
            filter: brightness(1.18) !important;
            transform: translateY(-1px) scale(1.01) !important;
        }
        .fasttag-create-empty-btn.fasttag-create-btn-active {
            animation-play-state: paused !important;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.6), 0 0 14px rgba(99, 102, 241, 0.7) !important;
            filter: brightness(1.2) !important;
            transform: scale(1.02) !important;
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
        @keyframes fasttagRefreshPulse {
            0% {
                box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.75);
                border-color: #6366f1 !important;
                color: #818cf8 !important;
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 10px 3px rgba(99, 102, 241, 0.5);
                border-color: #818cf8 !important;
                color: #c7d2fe !important;
                transform: scale(1.08);
            }
            100% {
                box-shadow: 0 0 0 0 rgba(99, 102, 241, 0);
                border-color: #6366f1 !important;
                color: #818cf8 !important;
                transform: scale(1);
            }
        }
        .fasttag-refresh-pulse {
            animation: fasttagRefreshPulse 1.6s infinite ease-in-out !important;
            border-color: #6366f1 !important;
            background: rgba(99, 102, 241, 0.18) !important;
        }
        /* Studio & Group Scroll Containers - Scrollbar Hidden (Mouse wheel & gesture scrollable) */
        #everything-studio-scroll, #everything-groups-scroll {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }
        #everything-studio-scroll::-webkit-scrollbar, #everything-groups-scroll::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
        }

        /* Studio & Group selected pills - muted fills matching the selected table rows */
        .fasttag-studio-pill {
            background: #312e81 !important;
            color: #ffffff !important;
            border: 1px solid #4338ca !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.35) !important;
            transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .fasttag-studio-pill:hover {
            transform: translateY(-1px) !important;
            filter: brightness(1.08) !important;
            box-shadow: 0 3px 8px rgba(49, 46, 129, 0.4) !important;
        }
        .fasttag-group-pill {
            background: #581c87 !important;
            color: #ffffff !important;
            border: 1px solid #7e22ce !important;
            box-shadow: 0 1px 3px rgba(0,0,0,0.35) !important;
            transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .fasttag-group-pill:hover {
            transform: translateY(-1px) !important;
            filter: brightness(1.08) !important;
            box-shadow: 0 3px 8px rgba(88, 28, 135, 0.4) !important;
        }
        .fasttag-pill-clear-btn {
            transition: transform 0.15s ease, color 0.15s ease, opacity 0.15s ease !important;
        }
        .fasttag-pill-clear-btn:hover {
            color: #fca5a5 !important;
            opacity: 1 !important;
            transform: scale(1.3) !important;
        }

        /* Unselected Suggestions / Quick Chips - Subtle Ghost / Dashed Outline with colored prefix */
        .fasttag-quick-chip {
            background: rgba(255, 255, 255, 0.04) !important;
            border: 1px dashed rgba(148, 163, 184, 0.35) !important;
            color: #94a3b8 !important;
            font-weight: 500 !important;
            transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        #scenes-popup.theme-dark .fasttag-quick-chip[aria-pressed="true"] {
            background: #312e81 !important;
            border: 1px solid #4338ca !important;
            color: #ffffff !important;
            font-weight: 600 !important;
        }
        #scenes-popup.theme-dark .fasttag-quick-chip[aria-pressed="true"]:hover {
            background: #3730a3 !important;
            border-color: #6366f1 !important;
        }
        #scenes-popup.theme-light .fasttag-quick-chip[aria-pressed="true"] {
            background: #e0e7ff !important;
            border: 1px solid #a5b4fc !important;
            color: #1e293b !important;
            font-weight: 600 !important;
        }
        .fasttag-quick-chip.chip-studio:hover {
            background: rgba(99, 102, 241, 0.22) !important;
            border: 1px solid #818cf8 !important;
            color: #ffffff !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 6px rgba(99, 102, 241, 0.35) !important;
        }
        .fasttag-quick-chip.chip-group:hover {
            background: rgba(168, 85, 247, 0.22) !important;
            border: 1px solid #c084fc !important;
            color: #ffffff !important;
            transform: translateY(-1px) !important;
            box-shadow: 0 2px 6px rgba(168, 85, 247, 0.35) !important;
        }
        .fasttag-quick-chip:active {
            transform: translateY(0px) scale(0.97) !important;
        }
        /* Keyboard Focus Indicator for Studio & Group Chips (Curved Pill-Conforming Ring) */
        .fasttag-keyboard-meta-focus {
            outline: none !important;
            border-radius: 999px !important;
            box-shadow: 0 0 0 1.5px #818cf8, 0 0 8px rgba(129, 140, 248, 0.55) !important;
            color: #ffffff !important;
            transition: all 0.12s ease !important;
        }
        .fasttag-studio-pill.fasttag-keyboard-meta-focus,
        .chip-studio.fasttag-keyboard-meta-focus {
            border: 1px solid #818cf8 !important;
            box-shadow: 0 0 0 1.5px #818cf8, 0 0 8px rgba(129, 140, 248, 0.6) !important;
            background: rgba(99, 102, 241, 0.28) !important;
            color: #ffffff !important;
            filter: brightness(1.2) !important;
        }
        .fasttag-group-pill.fasttag-keyboard-meta-focus,
        .chip-group.fasttag-keyboard-meta-focus {
            border: 1px solid #c084fc !important;
            box-shadow: 0 0 0 1.5px #c084fc, 0 0 8px rgba(192, 132, 252, 0.6) !important;
            background: rgba(168, 85, 247, 0.28) !important;
            color: #ffffff !important;
            filter: brightness(1.2) !important;
        }
        .fasttag-suggestion-chip.fasttag-keyboard-meta-focus {
            outline: none !important;
            border-style: solid !important;
            box-shadow: 0 0 0 1.5px #38bdf8, 0 0 8px rgba(56, 189, 248, 0.6) !important;
            filter: brightness(1.25) !important;
            transform: scale(1.04) !important;
        }
        @media (pointer: coarse) {
            .fasttag-suggestion-chip,
            .fasttag-smart-suggestion-chip {
                min-height: 36px !important;
                padding: 7px 11px !important;
                font-size: 12px !important;
            }
        }
        .fasttag-quick-chip.fasttag-keyboard-meta-focus {
            outline: none !important;
            border-color: #818cf8 !important;
            box-shadow: 0 0 0 1.5px #818cf8, 0 0 8px rgba(129, 140, 248, 0.6) !important;
            filter: brightness(1.25) !important;
            transform: scale(1.04) !important;
        }
        /* Sleek FastTag Themed Scrollbars */
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar,
        #scenes-popup .tabulator-tableholder *::-webkit-scrollbar,
        #scenes-popup div::-webkit-scrollbar,
        #fasttag-floating-scraper-hud div::-webkit-scrollbar {
            width: 5px !important;
            height: 5px !important;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-track,
        #scenes-popup div::-webkit-scrollbar-track {
            background: transparent !important;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-thumb,
        #scenes-popup div::-webkit-scrollbar-thumb {
            background: rgba(129, 140, 248, 0.35) !important;
            border-radius: 4px !important;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-thumb:hover,
        #scenes-popup div::-webkit-scrollbar-thumb:hover {
            background: rgba(129, 140, 248, 0.7) !important;
        }
        #scenes-popup .tabulator-tableholder {
            scrollbar-width: thin !important;
            scrollbar-color: rgba(129, 140, 248, 0.35) transparent !important;
        }
        #scenes-popup #everything-sugg-tags-chips,
        #scenes-popup #everything-sugg-performers-chips {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
            overscroll-behavior-inline: contain;
        }
        #scenes-popup #everything-sugg-tags-chips::-webkit-scrollbar,
        #scenes-popup #everything-sugg-performers-chips::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
        }
        `;
        document.head.appendChild(style);
    }

    // --- FastTag Comprehensive Diagnostics & Logging Engine ---
    const DEBUG_STORAGE_KEY = 'fasttag_debug_mode';
    const DEBUG_LOGS_STORAGE_KEY = 'fasttag_debug_logs_buffer';
    const MAX_DEBUG_LOGS = 600;
    let inMemoryDebugLogs = [];

    function getDebugMode() {
        return localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
    }
    function setDebugMode(enabled) {
        localStorage.setItem(DEBUG_STORAGE_KEY, enabled ? 'true' : 'false');
        ftLog('INFO', 'CONFIG', `Debug Mode turned ${enabled ? 'ON' : 'OFF'}`);
    }

    try {
        const savedLogs = localStorage.getItem(DEBUG_LOGS_STORAGE_KEY);
        if (savedLogs) inMemoryDebugLogs = JSON.parse(savedLogs) || [];
    } catch (e) {
        inMemoryDebugLogs = [];
    }

    function getCircularReplacer() {
        const seen = new WeakSet();
        return (key, value) => {
            if (typeof value === "object" && value !== null) {
                if (seen.has(value) || value instanceof HTMLElement || value instanceof Node) {
                    return '[DOM/Circular]';
                }
                seen.add(value);
            }
            return value;
        };
    }

    let saveLogsTimeout = null;
    function scheduleSaveLogsBuffer() {
        if (saveLogsTimeout) return;
        saveLogsTimeout = setTimeout(() => {
            saveLogsTimeout = null;
            try {
                localStorage.setItem(DEBUG_LOGS_STORAGE_KEY, JSON.stringify(inMemoryDebugLogs.slice(-250)));
            } catch (e) {}
        }, 1000);
    }

    function ftLog(level, category, message, data = null) {
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').replace('Z', '');
        const entry = {
            time: timeStr,
            level: String(level).toUpperCase(),
            category: String(category).toUpperCase(),
            message: String(message),
            data: data ? (typeof data === 'object' ? JSON.parse(JSON.stringify(data, getCircularReplacer())) : data) : null
        };

        inMemoryDebugLogs.push(entry);
        if (inMemoryDebugLogs.length > MAX_DEBUG_LOGS) {
            inMemoryDebugLogs.shift();
        }

        scheduleSaveLogsBuffer();

        if (getDebugMode() || level === 'ERROR' || level === 'WARN') {
            const prefix = `[FastTag][${entry.category}]`;
            if (level === 'ERROR') {
                console.error(prefix, message, data || '');
            } else if (level === 'WARN') {
                console.warn(prefix, message, data || '');
            } else {
                console.log(prefix, message, data || '');
            }
        }
    }

    function getLogBufferSize() {
        return inMemoryDebugLogs.length;
    }

    function clearDebugLogs() {
        inMemoryDebugLogs = [];
        try { localStorage.removeItem(DEBUG_LOGS_STORAGE_KEY); } catch (e) {}
        ftLog('INFO', 'LOG', 'Debug logs cleared by user');
    }

    function exportDebugLogsAsText() {
        const screenInfo = `Screen: ${window.innerWidth}x${window.innerHeight}, DPR: ${window.devicePixelRatio || 1}, UserAgent: ${navigator.userAgent}`;
        const header = `=== FastTag Diagnostics Log ===\nExported: ${new Date().toISOString()}\n${screenInfo}\nUsage Count: ${getUsageCount()}\n===============================\n\n`;
        const body = inMemoryDebugLogs.map(e => {
            let dataStr = '';
            if (e.data !== null && e.data !== undefined) {
                try {
                    dataStr = '\n  ' + JSON.stringify(e.data, null, 2).replace(/\n/g, '\n  ');
                } catch (err) {
                    dataStr = '\n  [Non-serializable data]';
                }
            }
            return `[${e.time}] [${e.level}] [${e.category}] ${e.message}${dataStr}`;
        }).join('\n');
        return header + body;
    }

    function downloadDebugLogFile() {
        const text = exportDebugLogsAsText();
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const d = new Date().toISOString().slice(0, 10);
        a.href = url;
        a.download = `fasttag-debug-${d}.log`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
    }

    function copyDebugLogsToClipboard() {
        const text = exportDebugLogsAsText();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            const ta = document.createElement('textarea');
            ta.value = text;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            return Promise.resolve();
        }
    }

    // Global Error & Promise Rejection Interceptor for FastTag Diagnostics
    if (!window._fastTagErrorListenersAttached) {
        window._fastTagErrorListenersAttached = true;
        window.addEventListener('error', (event) => {
            if (event?.filename && event.filename.includes('fasttag')) {
                ftLog('ERROR', 'RUNTIME', `Uncaught error in ${event.filename}:${event.lineno}:${event.colno} - ${event.message}`, {
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error?.stack || null
                });
            }
        });
        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            const str = String(reason?.message || reason);
            if (str.includes('fasttag') || (reason?.stack && reason.stack.includes('fasttag'))) {
                ftLog('ERROR', 'PROMISE', `Unhandled Promise Rejection: ${str}`, {
                    message: str,
                    stack: reason?.stack || null
                });
            }
        });
    }

    // --- Core GraphQL Network Operations ---
    const fetchGQL = async (query, variables = {}) => {
        const queryName = (query.match(/(query|mutation)\s+([A-Za-z0-9_]+)/) || [])[2] || 'GQL';
        try {
            const res = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables })
            });

            if (!res.ok) {
                const errPayload = { errors: [{ message: `GraphQL request failed: ${res.status} ${res.statusText}` }] };
                ftLog('ERROR', 'GQL', `${queryName} failed with HTTP ${res.status}`, { queryName, variables, error: errPayload });
                return errPayload;
            }

            const payload = await res.json();
            if (!payload || typeof payload !== 'object') {
                const errPayload = { errors: [{ message: 'GraphQL response was not valid JSON.' }] };
                ftLog('ERROR', 'GQL', `${queryName} invalid JSON response`, { queryName, error: errPayload });
                return errPayload;
            }

            if (payload.errors && payload.errors.length > 0) {
                ftLog('WARN', 'GQL', `${queryName} returned GraphQL errors`, { queryName, variables, errors: payload.errors });
            } else if (getDebugMode()) {
                ftLog('DEBUG', 'GQL', `${queryName} success`, { queryName, variables });
            }

            return payload;
        } catch (err) {
            ftLog('ERROR', 'GQL', `${queryName} network exception: ${err.message || err}`, { queryName, variables, error: String(err) });
            console.error('Stash Scene Manager: Network error', err);
            return { errors: [{ message: err.message || 'Unknown network error' }] };
        }
    };

    function showToast(message, type = "success", duration = 3000, debugPayload = null) {
        try {
            const isDebug = getDebugMode();
            const effectiveDuration = isDebug ? Math.max(duration, 15000) : duration;

            ftLog(type === 'error' ? 'ERROR' : (type === 'info' ? 'INFO' : 'ACTION'), 'TOAST', message, debugPayload);

            const existing = document.getElementById('fasttag-native-toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.id = 'fasttag-native-toast';
            const bg = type === "success" ? "#059669" : (type === "info" ? "#6366f1" : "#dc2626");
            const icon = type === "success" ? "✓" : (type === "info" ? "ℹ" : "✕");

            toast.style.cssText = `
                position: fixed;
                top: 18px;
                left: 50%;
                transform: translateX(-50%) translateY(-10px);
                background: ${bg};
                color: #ffffff;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                z-index: 20000000;
                opacity: 0;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                pointer-events: auto;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                max-width: 90vw;
                font-family: system-ui, -apple-system, sans-serif;
            `;

            let copyBtnHtml = '';
            if (type === 'error' || debugPayload || isDebug) {
                copyBtnHtml = `<button id="fasttag-toast-copy-btn" type="button" style="background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.35); color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 10.5px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; margin-left: 4px; line-height: 1.3;" title="Copy details to clipboard">📋 Copy</button>`;
            }

            let closeBtnHtml = '';
            if (isDebug || type === 'error') {
                closeBtnHtml = `<button id="fasttag-toast-close-btn" type="button" style="background: none; border: none; color: rgba(255,255,255,0.85); padding: 0 0 0 4px; font-size: 14px; line-height: 1; cursor: pointer; display: inline-flex; align-items: center;" title="Dismiss">✕</button>`;
            }

            toast.innerHTML = `
                <span style="font-size: 13px; line-height: 1; flex-shrink: 0;">${icon}</span>
                <span class="fasttag-toast-msg" style="word-break: break-word; max-width: 600px;">${escapeHtml(message)}</span>
                ${copyBtnHtml}
                ${closeBtnHtml}
            `;
            document.body.appendChild(toast);

            const copyBtn = toast.querySelector('#fasttag-toast-copy-btn');
            if (copyBtn) {
                copyBtn.onclick = (e) => {
                    e.stopPropagation();
                    const msgEl = toast.querySelector('.fasttag-toast-msg');
                    let copyText = (msgEl ? msgEl.innerText : message.replace(/<[^>]*>/g, '')).trim();
                    if (debugPayload) {
                        try {
                            copyText += '\n\nDetails:\n' + (typeof debugPayload === 'object' ? JSON.stringify(debugPayload, null, 2) : String(debugPayload));
                        } catch (err) {
                            copyText += '\n\nDetails:\n' + String(debugPayload);
                        }
                    }

                    const fallbackCopy = (txt) => {
                        const ta = document.createElement('textarea');
                        ta.value = txt;
                        ta.setAttribute('readonly', '');
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        ta.style.top = '0';
                        document.body.appendChild(ta);
                        ta.focus();
                        ta.select();
                        ta.setSelectionRange(0, ta.value.length);
                        try {
                            document.execCommand('copy');
                            copyBtn.textContent = '✓ Copied!';
                        } catch (err) {
                            copyBtn.textContent = '❌ Failed';
                        }
                        ta.remove();
                    };

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(copyText).then(() => {
                            copyBtn.textContent = '✓ Copied!';
                        }).catch(() => {
                            fallbackCopy(copyText);
                        });
                    } else {
                        fallbackCopy(copyText);
                    }

                    setTimeout(() => { if (copyBtn) copyBtn.textContent = '📋 Copy'; }, 2500);
                };
            }

            let dismissTimer = null;
            const startDismiss = (time) => {
                dismissTimer = setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(-50%) translateY(-10px)';
                    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 220);
                }, time);
            };

            const closeBtn = toast.querySelector('#fasttag-toast-close-btn');
            if (closeBtn) {
                closeBtn.onclick = (e) => {
                    e.stopPropagation();
                    if (dismissTimer) clearTimeout(dismissTimer);
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(-50%) translateY(-10px)';
                    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 220);
                };
            }

            // Pause on hover
            toast.addEventListener('mouseenter', () => {
                if (dismissTimer) clearTimeout(dismissTimer);
            });
            toast.addEventListener('mouseleave', () => {
                startDismiss(Math.min(effectiveDuration, 5000));
            });

            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });

            startDismiss(effectiveDuration);
        } catch (e) {
            console.log(`[Toast ${type}]: ${message}`);
        }
    }

    const toastSuccess = (message, debug) => {
        showToast(message, 'success', 3000, debug);
        if (debug) console.log(debug);
    };

    const toastError = (message, debug) => {
        showToast(message, 'error', 8000, debug);
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
                showToast('🍫 Achievement Unlocked: 100 Scenes Tagged! Have a break, buy me a KitKat! 🎉', 'success', 7000);
            }, 500);
        }
        return count;
    }

    function isEasterEggActive() {
        const count = getUsageCount();
        return count >= 100 && count <= 105;
    }

    // --- Theme & Storage Helpers ---
    function getEffectiveTheme() {
        const pref = getThemePreference();
        if (pref === 'light' || pref === 'dark') return pref;
        const htmlTheme = document.documentElement.getAttribute('data-bs-theme') || document.documentElement.getAttribute('data-theme');
        if (htmlTheme === 'light' || htmlTheme === 'dark') return htmlTheme;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
        return 'dark';
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

    function setLiveEverythingPopupTitle(popup, title) {
        const nextTitle = String(title || '').trim();
        if (!popup || !nextTitle) return;
        if (!popup.sceneData) popup.sceneData = {};
        popup.sceneData.title = nextTitle;
        if (typeof popup._refreshHeaderTitle === 'function') {
            popup._refreshHeaderTitle();
        } else if (popup.titleSpan) {
            popup.titleSpan.textContent = nextTitle;
            applyMarqueeAnimation(popup.titleSpan);
        }
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

    let hasShownScrubCueThisSession = false;

    let isVideoPoppedOut = false;
    let floatingHudElement = null;
    let floatingHudPosition = null;
    let floatingHudSize = null;
    // --- Google Gemini AI Smart Metadata & Filename Parser ---
    // --- Organized Status Workflow Helpers ---
    async function updateSceneOrganized(sceneId, isOrganized) {
        if (!sceneId) return false;
        try {
            const query = `mutation UpdateSceneOrganized($id: ID!, $organized: Boolean!) {
                sceneUpdate(input: { id: $id, organized: $organized }) {
                    ${SCENE_CARD_UPDATE_FIELDS}
                }
            }`;
            const res = await fetchGQL(query, { id: String(sceneId), organized: Boolean(isOrganized) });
            if (res?.data?.sceneUpdate) {
                syncSceneToApolloCache(res.data.sceneUpdate);
            }
            return res?.data?.sceneUpdate?.organized !== undefined;
        } catch (e) {
            console.error('[FastTag] Error updating organized status:', e);
            return false;
        }
    }

    function getOrganizedWord(form = 'organized') {
        const lang = (navigator.language || (navigator.languages && navigator.languages[0]) || 'en-US').toLowerCase();
        const isBritish = lang.includes('gb') || lang.includes('uk') || lang.includes('au') || lang.includes('nz') || lang.includes('za') || lang.includes('ie');
        if (form === 'organized') return isBritish ? 'Organised' : 'Organized';
        if (form === 'unorganized') return isBritish ? 'Unorganised' : 'Unorganized';
        if (form === 'mark_as') return isBritish ? 'Mark as Organised' : 'Mark as Organized';
        return isBritish ? 'Organised' : 'Organized';
    }

    function setupOrganizedButton(btn, getSceneId, initialOrganized = false) {
        if (!btn) return { update: () => {}, get: () => false };
        let currentOrganized = Boolean(initialOrganized);

        const renderBtn = (isOrg) => {
            const isDark = getEffectiveTheme() === 'dark';
            btn.style.display = 'inline-flex';
            const orgWord = getOrganizedWord('organized');
            const unorgWord = getOrganizedWord('unorganized');
            if (isOrg) {
                btn.style.background = '#059669';
                btn.style.border = '1px solid #059669';
                btn.style.color = '#ffffff';
                btn.title = `Scene is marked as ${orgWord} in Stash. Click to toggle.`;
                btn.innerHTML = `<span style="font-weight: 800; font-size: 11px; line-height: 1;">✓</span> ${orgWord}`;
            } else {
                btn.style.background = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                btn.style.border = isDark ? '1px dashed rgba(148, 163, 184, 0.45)' : '1px dashed #94a3b8';
                btn.style.color = isDark ? '#94a3b8' : '#64748b';
                btn.title = `Scene is ${unorgWord} in Stash. Click to mark as ${orgWord}.`;
                btn.innerHTML = `<span style="font-size: 11px; line-height: 1;">⚡</span> ${unorgWord}`;
            }
        };

        btn.style.cssText = `
            padding: 0 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            line-height: 1;
            transition: all 0.15s ease;
            user-select: none;
            vertical-align: middle;
            box-sizing: border-box;
            height: 32px;
        `;

        btn.onmouseenter = () => {
            if (!currentOrganized) {
                const isDark = getEffectiveTheme() === 'dark';
                btn.style.background = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
                btn.style.borderColor = isDark ? 'rgba(148, 163, 184, 0.7)' : '#64748b';
            } else {
                btn.style.background = '#047857';
            }
        };
        btn.onmouseleave = () => {
            renderBtn(currentOrganized);
        };

        renderBtn(currentOrganized);

        btn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const sId = typeof getSceneId === 'function' ? getSceneId() : getSceneId;
            if (!sId) return;

            const nextOrg = !currentOrganized;
            renderBtn(nextOrg); // Optimistic UI
            btn.style.pointerEvents = 'none';

            try {
                const ok = await updateSceneOrganized(sId, nextOrg);
                if (ok) {
                    currentOrganized = nextOrg;
                    showToast(nextOrg ? `✓ Scene marked as ${getOrganizedWord('organized')}` : `Scene marked as ${getOrganizedWord('unorganized')}`, 'info', 2000);
                    refreshSceneCardsDebounced(sId);
                } else {
                    renderBtn(currentOrganized); // rollback
                    toastError('Failed to update organized status');
                }
            } catch (err) {
                renderBtn(currentOrganized); // rollback
                toastError('Error updating organized status');
            } finally {
                btn.style.pointerEvents = 'auto';
            }
        };

        return {
            update: (newVal) => {
                currentOrganized = Boolean(newVal);
                renderBtn(currentOrganized);
            },
            get: () => currentOrganized
        };
    }

    function getInitialPopoutPosition(hudWidth = 600, hudHeight = 338) {
        const activeForm = activePopup?.element || document.querySelector('#scenes-popup');
        const isScraperOpen = floatingScraperHudElement && document.body.contains(floatingScraperHudElement);
        const scraperRect = isScraperOpen ? floatingScraperHudElement.getBoundingClientRect() : null;
        let rect = null;
        if (activeForm) {
            rect = activeForm.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.left <= 0) {
                const formW = parseInt(activeForm.style.width, 10) || 760;
                const formH = parseInt(activeForm.style.height, 10) || 760;
                const defPos = getDefaultEverythingPosition(formW, formH);
                rect = { left: defPos.x, right: defPos.x + formW, top: defPos.y, bottom: defPos.y + formH, width: formW, height: formH };
            }
        }
        return calculateVideoPopoutPosition({
            formRect: rect,
            scraperRect,
            hudWidth,
            hudHeight,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight
        });
    }

    function closeFloatingVideoHud(fullReset = false) {
        if (floatingHudElement) {
            floatingHudElement.remove();
            floatingHudElement = null;
        }
        isVideoPoppedOut = false;
    }

    let floatingScraperHudElement = null;
    let floatingScraperHudPosition = null;
    let floatingScraperHudSize = null;

    function closeFloatingScraperHud(fullReset = false) {
        if (floatingScraperHudElement) {
            floatingScraperHudElement.remove();
            floatingScraperHudElement = null;
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
            let rect = activeForm.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.left <= 0) {
                const formW = parseInt(activeForm.style.width, 10) || 760;
                const formH = parseInt(activeForm.style.height, 10) || 760;
                const defPos = getDefaultEverythingPosition(formW, formH);
                rect = { left: defPos.x, right: defPos.x + formW, top: defPos.y, bottom: defPos.y + formH, width: formW, height: formH };
            }

            const spaceRight = Math.max(0, screenWidth - rect.right - margin);
            const spaceLeft = Math.max(0, rect.left - margin);

            // 1. Primary: Place Scraper on the RIGHT flank of the main modal
            if (spaceRight >= hudWidth + margin) {
                const left = Math.round(rect.right + margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return { left: `${left}px`, top: `${top}px`, width: `${hudWidth}px`, height: `${hudHeight}px` };
            }

            // 2. Secondary: If right flank is tight, try the LEFT flank if not occupied by video
            if (spaceLeft >= hudWidth + margin && (!isVideoOpen || (videoRect && videoRect.left >= rect.right))) {
                const left = Math.round(rect.left - hudWidth - margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return { left: `${left}px`, top: `${top}px`, width: `${hudWidth}px`, height: `${hudHeight}px` };
            }

            // 3. Viewport fallback (flush with right screen edge)
            const left = Math.max(margin, Math.min(screenWidth - hudWidth - margin, Math.round(rect.right + margin)));
            const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
            return { left: `${left}px`, top: `${top}px`, width: `${hudWidth}px`, height: `${hudHeight}px` };
        }

        return { right: '20px', top: '70px', width: `${hudWidth}px`, height: `${hudHeight}px` };
    }

    function promptDebugModeWarningDialog() {
        return new Promise((resolve) => {
            const theme = getEffectiveTheme();
            const isDark = theme === 'dark';

            const overlay = document.createElement('div');
            overlay.className = 'fasttag-confirm-dialog-overlay';
            overlay.style.cssText = `
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.72);
                backdrop-filter: blur(2.5px);
                z-index: 100000000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 16px;
                box-sizing: border-box;
                animation: fasttagFadeIn 0.12s ease-out;
            `;

            const dialog = document.createElement('div');
            dialog.className = 'fasttag-confirm-dialog-card';
            const cardBg = isDark ? '#1e293b' : '#ffffff';
            const cardBorder = isDark ? '1px solid rgba(245, 158, 11, 0.45)' : '1px solid rgba(245, 158, 11, 0.6)';
            const textColor = isDark ? '#f8fafc' : '#0f172a';
            const textMuted = isDark ? '#94a3b8' : '#64748b';

            dialog.style.cssText = `
                background: ${cardBg};
                border: ${cardBorder};
                border-radius: 10px;
                padding: 18px 20px;
                width: 100%;
                max-width: 400px;
                box-shadow: 0 20px 30px rgba(0, 0, 0, 0.6);
                display: flex;
                flex-direction: column;
                gap: 13px;
                color: ${textColor};
                font-family: inherit;
            `;

            dialog.innerHTML = `
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 15px; color: #f59e0b;">
                    <span style="font-size: 18px; line-height: 1;">⚠️</span>
                    <span>Enable Debug Mode?</span>
                </div>
                <div style="font-size: 12px; line-height: 1.45; color: ${textColor};">
                    FastTag will operate differently in Debug Mode:
                    <ul style="margin: 8px 0 8px 18px; padding: 0; font-size: 11.5px; color: ${textMuted}; display: flex; flex-direction: column; gap: 4px;">
                        <li>Toasts will remain on screen for <strong>15 seconds</strong> (with pause-on-hover & copy buttons) to allow screenshots.</li>
                        <li>Detailed network queries and state diagnostics will be logged.</li>
                    </ul>
                    <span style="font-size: 11px; color: #fbbf24; font-weight: 600;">Keep disabled during normal fast tagging.</span>
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
                    <button type="button" id="fasttag-debug-dialog-cancel" style="background: ${isDark ? 'rgba(148, 163, 184, 0.15)' : '#e2e8f0'}; border: 1px solid ${isDark ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1'}; color: ${textColor}; font-size: 12px; font-weight: 600; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease;">Cancel</button>
                    <button type="button" id="fasttag-debug-dialog-continue" style="background: #f59e0b; border: 1px solid #d97706; color: #000000; font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">Continue</button>
                </div>
            `;

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            const cleanup = (result) => {
                document.removeEventListener('keydown', onKeyDown);
                overlay.remove();
                resolve(result);
            };

            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    cleanup(false);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    cleanup(true);
                }
            };
            document.addEventListener('keydown', onKeyDown);

            const cancelBtn = dialog.querySelector('#fasttag-debug-dialog-cancel');
            if (cancelBtn) cancelBtn.onclick = () => cleanup(false);

            const continueBtn = dialog.querySelector('#fasttag-debug-dialog-continue');
            if (continueBtn) continueBtn.onclick = () => cleanup(true);

            overlay.onclick = (e) => {
                if (e.target === overlay) cleanup(false);
            };
        });
    }

    function openSettingsModal() {
        const existing = document.getElementById('fasttag-settings-modal');
        if (existing) existing.remove();

        const theme = getEffectiveTheme();
        const currentPref = getThemePreference();
        const showIds = getShowIdColumns();
        const enableSug = getEnableSuggestions();
        const autoScrape = getAutoScrapeSequential();
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
            <div style="background: ${bg}; color: ${text}; border: 1px solid ${border}; border-radius: 12px; width: 480px; max-width: 92vw; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); overflow: hidden; font-family: inherit;">
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 12px; border-bottom: 1px solid ${border}; background: ${cardBg};">
                    <div style="font-weight: 700; font-size: 15px; display: flex; align-items: center; gap: 8px;">
                        <span>⚙️</span> FastTag Settings
                    </div>
                    <button id="fasttag-settings-close" style="background: none; border: none; font-size: 18px; color: ${textMuted}; cursor: pointer; line-height: 1; padding: 4px;">✕</button>
                </div>

                <!-- Category Tabs Header -->
                <div id="fasttag-settings-tab-bar" style="display: flex; gap: 4px; padding: 6px 12px; background: ${cardBg}; border-bottom: 1px solid ${border}; user-select: none;">
                    <button type="button" class="fasttag-settings-tab-btn active" data-tab="display" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 700; border: none; border-radius: 7px; background: #6366f1; color: #ffffff; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                        <span>🎨</span> Display
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="video" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                        <span>🎬</span> Video
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="scraper" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                        <span>⚡</span> Workflow
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="ai" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; transition: all 0.15s ease;">
                        <span>🤖</span> AI <span style="font-size: 8px; padding: 1px 4px; border-radius: 3px; background: rgba(245, 158, 11, 0.2); color: #f59e0b; font-weight: 800; line-height: 1.1;">BETA</span>
                    </button>
                    <button type="button" class="fasttag-settings-tab-btn" data-tab="system" style="flex: 1; padding: 6px 4px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 7px; background: transparent; color: ${textMuted}; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px; transition: all 0.15s ease;">
                        <span>🛠️</span> System
                    </button>
                </div>

                <div style="padding: 16px 18px; min-height: 290px; max-height: 60vh; overflow-y: auto;">
                    <!-- TAB 1: DISPLAY -->
                    <div id="fasttag-tab-pane-display" class="fasttag-tab-pane" style="display: flex; flex-direction: column; gap: 14px;">
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
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Display numeric database ID column in Tag, Performer, Studio, and Gallery popups.</div>
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

                        <!-- Show Recent Items setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Show Recent Items</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Display recent history chips above tables across all modals.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-show-recent" ${getShowRecentChips() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Show Pinned Items setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Show Pinned Items</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Display pinned chips (📌) in quick action bars.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-show-pinned" ${getShowPinnedChips() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Card Icon Clicks setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Enable Card Icon Clicks</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Left-clicking Tag, Performer, Studio, or Gallery icons on scene cards opens FastTag popups directly. (Uncheck to require right-click context menu)</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-card-icon-clicks" ${getEnableCardIconClicks() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>
                    </div>

                    <!-- TAB 2: VIDEO -->
                    <div id="fasttag-tab-pane-video" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <!-- Always Play Full Video setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Always Play Full Video</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically stream the full video when opening scenes instead of short preview clips. (Shortcut: Option+V / Alt+V)</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-always-full-video" ${getAlwaysPlayFullVideo() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Video Scrubbing Speeds setting -->
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div>
                                    <div style="font-weight: 600; font-size: 13px;">Video Scrubbing Speeds</div>
                                    <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Seconds skipped per wheel notch in Full Video mode (Set to 0 to disable)</div>
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
                        </div>
                    </div>

                    <!-- TAB 3: WORKFLOW -->
                    <div id="fasttag-tab-pane-scraper" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <!-- Auto-Mark Scene as Organized / Organised -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Auto-Mark Scene as ${getOrganizedWord('organized')}</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically set scene status to '${getOrganizedWord('organized')}' when saving tags in FastTag.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-auto-mark-organized" ${getAutoMarkOrganized() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #059669; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Auto-Scrape in Sequential Mode setting -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Auto-Scrape in Sequential Mode</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically fetch scraper matches on scene transitions when using Edit Everything in Sequential Mode.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-auto-scrape" ${autoScrape ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Conservative false-positive filtering -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Hide Obvious False Positives</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Hide keyword results when performer, studio and title evidence all strongly conflict. A close duration keeps a result visible; missing duration does not prevent filtering.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-hide-obvious-false-positives" ${getHideObviousFalsePositives() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
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
                    </div>

                    <!-- TAB 4: AI (GEMINI) -->
                    <div id="fasttag-tab-pane-ai" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
                        <!-- Prominent Experimental Feature Banner -->
                        <div style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 8px; padding: 10px 12px; display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 18px; line-height: 1.1; flex-shrink: 0;">⚠️</span>
                            <div style="flex: 1;">
                                <div style="font-weight: 700; font-size: 12px; color: #f59e0b; display: flex; align-items: center; gap: 6px;">
                                    EXPERIMENTAL FEATURE
                                    <span style="font-size: 8.5px; background: rgba(245, 158, 11, 0.25); color: #f59e0b; padding: 1px 5px; border-radius: 4px; font-weight: 800;">ACTIVE DEVELOPMENT</span>
                                </div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 3px; line-height: 1.45;">
                                    The Gemini AI Smart Parser is an experimental feature currently under active development. Results, quotas, and response times may vary depending on filename formatting and Google API availability.
                                </div>
                            </div>
                        </div>

                        <!-- Gemini API Key configuration -->
                        <div style="display: flex; flex-direction: column; gap: 8px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                                    <span>✨</span> Google Gemini API Key
                                </div>
                                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="font-size: 11px; color: #818cf8; text-decoration: none; font-weight: 600;">Get Free Key ↗</a>
                            </div>
                            <div style="font-size: 11px; color: ${textMuted};">Powers intelligent filename parsing, performer extraction, studio identification, and clean title generation.</div>
                            
                            <div style="display: flex; gap: 6px; margin-top: 4px;">
                                <div style="position: relative; flex: 1;">
                                    <input type="password" id="fasttag-setting-gemini-key" value="${getGeminiApiKey()}" placeholder="Paste your Gemini API key here..." style="width: 100%; box-sizing: border-box; padding: 7px 34px 7px 10px; border-radius: 6px; border: 1px solid ${border}; background: ${bg}; color: ${text}; font-size: 12px; font-family: monospace;">
                                    <button type="button" id="fasttag-btn-toggle-key" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 13px; color: ${textMuted}; padding: 2px 4px;" title="Show/Hide Key">👁️</button>
                                </div>
                                <button type="button" id="fasttag-btn-test-gemini" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); color: #818cf8; font-size: 11.5px; font-weight: 600; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;">⚡ Test Key</button>
                            </div>
                            <div id="fasttag-gemini-test-status" style="font-size: 11px; display: none; margin-top: 2px;"></div>
                        </div>

                        <!-- Gemini Model Selection -->
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                            <div>
                                <div style="font-weight: 600; font-size: 13px;">AI Model</div>
                                <div style="font-size: 11px; color: ${textMuted};">Select Google Gemini model</div>
                            </div>
                            <select id="fasttag-setting-gemini-model" style="padding: 6px 10px; border-radius: 6px; border: 1px solid ${border}; background: ${cardBg}; color: ${text}; font-size: 12px; cursor: pointer;">
                                <option value="gemini-flash-latest" ${getGeminiModel() === 'gemini-flash-latest' ? 'selected' : ''}>Gemini Flash Latest (Auto-Managed, Recommended)</option>
                                <option value="gemini-3.8-flash" ${getGeminiModel() === 'gemini-3.8-flash' ? 'selected' : ''}>Gemini 3.8 Flash (High Performance)</option>
                                <option value="gemini-3.6-flash" ${getGeminiModel() === 'gemini-3.6-flash' ? 'selected' : ''}>Gemini 3.6 Flash</option>
                                <option value="gemini-flash-lite-latest" ${getGeminiModel() === 'gemini-flash-lite-latest' ? 'selected' : ''}>Gemini Flash Lite (Fastest)</option>
                                <option value="gemini-pro-latest" ${getGeminiModel() === 'gemini-pro-latest' ? 'selected' : ''}>Gemini Pro Latest (Deep Analysis)</option>
                            </select>
                        </div>

                        <div style="height: 1px; background: ${border};"></div>

                        <!-- Auto-Parse on Scene Open -->
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; font-size: 13px;">Auto-Parse Filename on Scene Open</div>
                                <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Automatically run AI filename extraction when opening a scene to suggest missing metadata.</div>
                            </div>
                            <input type="checkbox" id="fasttag-setting-gemini-auto-parse" ${getGeminiAutoParse() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                        </div>

                    </div>

                    <!-- TAB 5: SYSTEM -->
                    <div id="fasttag-tab-pane-system" class="fasttag-tab-pane" style="display: none; flex-direction: column; gap: 14px;">
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

                        <!-- Persistent Cache (IndexedDB) -->
                        <div style="display: flex; flex-direction: column; gap: 10px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 6px;">
                                        <span>⚡</span> Persistent Client Cache (IndexedDB)
                                    </div>
                                    <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Caches tags, performers, studios, and groups locally in browser storage so Edit Everything opens in 0ms across network connections.</div>
                                </div>
                                <button type="button" id="fasttag-btn-purge-cache" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; font-size: 11.5px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap;">🗑️ Purge Cache</button>
                            </div>
                            <div id="fasttag-cache-stats" style="font-size: 11px; color: ${textMuted}; border-top: 1px dashed ${border}; padding-top: 6px; display: flex; gap: 10px; flex-wrap: wrap;">
                                <span>Tags: <strong style="color: ${text};">${cacheStore.tags?.data?.length || 0}</strong></span>
                                <span>Performers: <strong style="color: ${text};">${cacheStore.performers?.data?.length || 0}</strong></span>
                                <span>Studios: <strong style="color: ${text};">${cacheStore.studios?.data?.length || 0}</strong></span>
                                <span>Groups: <strong style="color: ${text};">${cacheStore.groups?.data?.length || 0}</strong></span>
                            </div>
                        </div>

                        <!-- Developer & Diagnostics / Debug Mode -->
                        <div style="display: flex; flex-direction: column; gap: 10px; background: ${cardBg}; padding: 12px; border-radius: 8px; border: 1px solid ${border};">
                            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                                <div style="flex: 1;">
                                    <div style="font-weight: 600; font-size: 13px; display: flex; align-items: center; gap: 5px;">
                                        <span>🛠️</span> Debug Mode
                                    </div>
                                    <div style="font-size: 11px; color: ${textMuted}; margin-top: 2px;">Extends toast display time to 15 seconds and records continuous diagnostics.</div>
                                </div>
                                <input type="checkbox" id="fasttag-setting-debug-mode" ${getDebugMode() ? 'checked' : ''} style="cursor: pointer; width: 18px; height: 18px; accent-color: #6366f1; margin-top: 2px;">
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px dashed ${border}; padding-top: 8px; margin-top: 2px;">
                                <div style="font-size: 11px; color: ${textMuted}; display: flex; align-items: center; gap: 4px;">
                                    <span>📋</span> Logs: <strong id="fasttag-log-count" style="color: ${text};">${getLogBufferSize()} entries</strong>
                                </div>
                                <div style="display: flex; gap: 6px;">
                                    <button type="button" id="fasttag-btn-copy-log" style="background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.35); color: #818cf8; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 5px; cursor: pointer;">📋 Copy Log</button>
                                    <button type="button" id="fasttag-btn-export-log" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: #34d399; font-size: 11px; font-weight: 600; padding: 4px 8px; border-radius: 5px; cursor: pointer;">📥 Download Log</button>
                                    <button type="button" id="fasttag-btn-clear-log" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); color: #f87171; font-size: 11px; font-weight: 600; padding: 4px 7px; border-radius: 5px; cursor: pointer;" title="Clear log buffer">🗑️</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div style="padding: 12px 18px; background: ${cardBg}; border-top: 1px solid ${border}; display: flex; justify-content: space-between; gap: 8px;">
                    <button id="fasttag-settings-help" type="button" style="background: ${isDark ? 'rgba(99,102,241,.16)' : '#eef2ff'}; color: ${isDark ? '#c7d2fe' : '#3730a3'}; border: 1px solid ${isDark ? 'rgba(129,140,248,.45)' : '#a5b4fc'}; padding: 7px 13px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;">❓ Help &amp; User Guide</button>
                    <button id="fasttag-settings-done" style="background: #6366f1; color: white; border: none; padding: 7px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer;">Done</button>
                </div>
            </div>
        `;

        // Tab Switching Handlers
        let activeSettingsTab = 'display';
        const tabBtns = modal.querySelectorAll('.fasttag-settings-tab-btn');
        const tabPanes = modal.querySelectorAll('.fasttag-tab-pane');

        const switchSettingsTab = (targetTab) => {
            activeSettingsTab = targetTab;
            tabBtns.forEach(btn => {
                const isActive = btn.getAttribute('data-tab') === targetTab;
                btn.classList.toggle('active', isActive);
                btn.style.background = isActive ? '#6366f1' : 'transparent';
                btn.style.color = isActive ? '#ffffff' : textMuted;
                btn.style.fontWeight = isActive ? '700' : '600';
            });
            tabPanes.forEach(pane => {
                const isTarget = pane.id === `fasttag-tab-pane-${targetTab}`;
                pane.style.display = isTarget ? 'flex' : 'none';
            });
        };

        tabBtns.forEach(btn => {
            btn.onclick = () => switchSettingsTab(btn.getAttribute('data-tab'));
            btn.onmouseenter = () => {
                if (btn.getAttribute('data-tab') !== activeSettingsTab) {
                    btn.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
                    btn.style.color = text;
                }
            };
            btn.onmouseleave = () => {
                if (btn.getAttribute('data-tab') !== activeSettingsTab) {
                    btn.style.background = 'transparent';
                    btn.style.color = textMuted;
                }
            };
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

        const recentToggle = modal.querySelector('#fasttag-setting-show-recent');
        if (recentToggle) {
            recentToggle.addEventListener('change', (e) => {
                setShowRecentChips(e.target.checked);
                showToast(`Recent items ${e.target.checked ? 'enabled' : 'hidden'}`, 'info');
            });
        }

        const pinnedToggle = modal.querySelector('#fasttag-setting-show-pinned');
        if (pinnedToggle) {
            pinnedToggle.addEventListener('change', (e) => {
                setShowPinnedChips(e.target.checked);
                showToast(`Pinned items ${e.target.checked ? 'enabled' : 'hidden'}`, 'info');
            });
        }

        const iconClicksToggle = modal.querySelector('#fasttag-setting-card-icon-clicks');
        if (iconClicksToggle) {
            iconClicksToggle.addEventListener('change', (e) => {
                setEnableCardIconClicks(e.target.checked);
                showToast(`Card icon clicks ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const autoMarkOrganizedToggle = modal.querySelector('#fasttag-setting-auto-mark-organized');
        if (autoMarkOrganizedToggle) {
            autoMarkOrganizedToggle.addEventListener('change', (e) => {
                setAutoMarkOrganized(e.target.checked);
                showToast(`Auto-Mark Scene as Organized ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const autoScrapeToggle = modal.querySelector('#fasttag-setting-auto-scrape');
        if (autoScrapeToggle) {
            autoScrapeToggle.addEventListener('change', (e) => {
                setAutoScrapeSequential(e.target.checked);
                showToast(`Auto-Scrape in Sequential Mode ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const detachScraperToggle = modal.querySelector('#fasttag-setting-detach-scraper');
        if (detachScraperToggle) {
            detachScraperToggle.addEventListener('change', (e) => {
                setDetachScraper(e.target.checked);
                showToast(`Scraper sidecar ${e.target.checked ? 'detached' : 'embedded'}`, 'info');
            });
        }

        const falsePositiveToggle = modal.querySelector('#fasttag-setting-hide-obvious-false-positives');
        if (falsePositiveToggle) {
            falsePositiveToggle.addEventListener('change', (e) => {
                setHideObviousFalsePositives(e.target.checked);
                showToast(`Obvious scraper false-positive filtering ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const alwaysFullVideoToggle = modal.querySelector('#fasttag-setting-always-full-video');
        if (alwaysFullVideoToggle) {
            alwaysFullVideoToggle.addEventListener('change', (e) => {
                setAlwaysPlayFullVideo(e.target.checked);
                showToast(`Always play full video ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
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
                resetScrubCueCount();
                if (speedSlowInput) speedSlowInput.value = DEFAULT_SCRUB_SPEEDS.slow;
                if (speedNormalInput) speedNormalInput.value = DEFAULT_SCRUB_SPEEDS.normal;
                if (speedFastInput) speedFastInput.value = DEFAULT_SCRUB_SPEEDS.fast;
                if (speedFreezeInput) speedFreezeInput.value = DEFAULT_SCRUB_SPEEDS.freeze;
                showToast('Scrubbing speeds & onboarding tips reset', 'info');
            });
        }

        // TAB 4: AI Listeners
        const geminiKeyInput = modal.querySelector('#fasttag-setting-gemini-key');
        const toggleKeyBtn = modal.querySelector('#fasttag-btn-toggle-key');
        const testGeminiBtn = modal.querySelector('#fasttag-btn-test-gemini');
        const geminiTestStatus = modal.querySelector('#fasttag-gemini-test-status');
        const geminiModelSelect = modal.querySelector('#fasttag-setting-gemini-model');
        const geminiAutoParseToggle = modal.querySelector('#fasttag-setting-gemini-auto-parse');

        if (geminiKeyInput) {
            geminiKeyInput.addEventListener('input', (e) => {
                setGeminiApiKey(e.target.value);
            });
        }

        if (toggleKeyBtn && geminiKeyInput) {
            toggleKeyBtn.addEventListener('click', () => {
                const isPass = geminiKeyInput.type === 'password';
                geminiKeyInput.type = isPass ? 'text' : 'password';
                toggleKeyBtn.textContent = isPass ? '🔒' : '👁️';
            });
        }

        if (testGeminiBtn && geminiTestStatus) {
            testGeminiBtn.addEventListener('click', async () => {
                const key = geminiKeyInput?.value?.trim() || getGeminiApiKey();
                if (!key) {
                    geminiTestStatus.style.display = 'block';
                    geminiTestStatus.style.color = '#f87171';
                    geminiTestStatus.textContent = '✕ Please paste a Gemini API key first.';
                    return;
                }

                testGeminiBtn.disabled = true;
                testGeminiBtn.textContent = '⏳ Testing...';
                geminiTestStatus.style.display = 'block';
                geminiTestStatus.style.color = '#818cf8';
                geminiTestStatus.textContent = 'Connecting to Google Gemini API...';

                try {
                    const res = await callGeminiAPI(key, geminiModelSelect?.value || 'gemini-1.5-flash');
                    if (res?.status === 'ok') {
                        geminiTestStatus.style.color = '#34d399';
                        geminiTestStatus.innerHTML = `✓ <strong>Connected!</strong> Google Gemini AI is online and ready.`;
                        setGeminiApiKey(key);
                        showToast('✓ Gemini API key verified & saved successfully!', 'success');
                    } else {
                        geminiTestStatus.style.color = '#f87171';
                        geminiTestStatus.textContent = `✕ Unexpected response from Gemini.`;
                    }
                } catch (err) {
                    geminiTestStatus.style.color = '#f87171';
                    geminiTestStatus.textContent = `✕ ${err.message}`;
                    showToast(`Gemini Test Failed: ${err.message}`, 'error');
                } finally {
                    testGeminiBtn.disabled = false;
                    testGeminiBtn.textContent = '⚡ Test Key';
                }
            });
        }

        if (geminiModelSelect) {
            geminiModelSelect.addEventListener('change', (e) => {
                setGeminiModel(e.target.value);
                showToast(`Gemini Model set to ${e.target.value}`, 'info');
            });
        }

        if (geminiAutoParseToggle) {
            geminiAutoParseToggle.addEventListener('change', (e) => {
                setGeminiAutoParse(e.target.checked);
                showToast(`Auto-Parse on Scene Open ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
            });
        }

        const resetLayoutsBtn = modal.querySelector('#fasttag-setting-reset-layouts');
        if (resetLayoutsBtn) {
            resetLayoutsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                resetAllLayoutsToDefault();
            });
        }

        const purgeCacheBtn = modal.querySelector('#fasttag-btn-purge-cache');
        if (purgeCacheBtn) {
            purgeCacheBtn.addEventListener('click', (e) => {
                e.preventDefault();
                invalidateCache();
                const statsEl = modal.querySelector('#fasttag-cache-stats');
                if (statsEl) {
                    statsEl.innerHTML = '<span style="color: #10b981; font-weight: 600;">✓ Cache purged! Live network reload on next search.</span>';
                }
                showToast('Persistent client cache cleared', 'success');
            });
        }

        const debugToggle = modal.querySelector('#fasttag-setting-debug-mode');
        if (debugToggle) {
            debugToggle.addEventListener('click', async (e) => {
                const wantsEnable = debugToggle.checked;
                if (wantsEnable) {
                    debugToggle.checked = false;
                    const confirmed = await promptDebugModeWarningDialog();
                    if (confirmed) {
                        debugToggle.checked = true;
                        setDebugMode(true);
                        showToast('Debug Mode ENABLED (15s toasts active)', 'info');
                    }
                } else {
                    setDebugMode(false);
                    showToast('Debug Mode disabled', 'info');
                }
            });
        }

        const copyLogBtn = modal.querySelector('#fasttag-btn-copy-log');
        if (copyLogBtn) {
            copyLogBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await copyDebugLogsToClipboard();
                copyLogBtn.textContent = '✓ Copied!';
                setTimeout(() => { if (copyLogBtn) copyLogBtn.textContent = '📋 Copy Log'; }, 2000);
                showToast('Copied FastTag debug log to clipboard', 'success');
            });
        }

        const exportLogBtn = modal.querySelector('#fasttag-btn-export-log');
        if (exportLogBtn) {
            exportLogBtn.addEventListener('click', (e) => {
                e.preventDefault();
                downloadDebugLogFile();
                showToast('Downloaded FastTag debug log file', 'success');
            });
        }

        const clearLogBtn = modal.querySelector('#fasttag-btn-clear-log');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', (e) => {
                e.preventDefault();
                clearDebugLogs();
                const countEl = modal.querySelector('#fasttag-log-count');
                if (countEl) countEl.textContent = '0 entries';
                showToast('FastTag debug logs cleared', 'info');
            });
        }

        const closeModal = () => {
            try {
                saveSpeedsFromInputs();
            } catch (err) {
                console.warn('[FastTag] Error saving speeds:', err);
            }
            document.removeEventListener('keydown', onSettingsKeyDown);
            modal.remove();
        };

        const onSettingsKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeModal();
            }
        };
        document.addEventListener('keydown', onSettingsKeyDown);

        const closeBtn = modal.querySelector('#fasttag-settings-close');
        if (closeBtn) closeBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeModal(); };

        const doneBtn = modal.querySelector('#fasttag-settings-done');
        if (doneBtn) doneBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); closeModal(); };

        const helpBtn = modal.querySelector('#fasttag-settings-help');
        if (helpBtn) helpBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            helpBtn.disabled = true;
            const originalText = helpBtn.innerHTML;
            helpBtn.textContent = '⏳ Loading Guide…';
            try {
                const help = await loadFastTagHelpModule();
                help.openGuide({ theme: getEffectiveTheme(), version: '4.2.11' });
            } catch (error) {
                toastError(`Unable to open help: ${error.message}`);
            } finally {
                helpBtn.disabled = false;
                helpBtn.innerHTML = originalText;
            }
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };

        document.body.appendChild(modal);
    }

    function getCachedOrNull(type) {
        const item = cacheStore[type];
        if (item && item.data && Array.isArray(item.data)) {
            const age = Date.now() - item.timestamp;
            if (age < CACHE_TTL) {
                if (age > REVALIDATE_INTERVAL && !item._isRevalidating) {
                    revalidateCacheInBackground(type);
                }
                return item.data;
            }
        }
        return null;
    }

    function setCache(type, data) {
        const now = Date.now();
        cacheStore[type] = { data, timestamp: now };
        idbSet(type, data, now);
    }

    function invalidateCache(type) {
        if (type && cacheStore[type]) {
            cacheStore[type] = { data: null, timestamp: 0 };
            idbDelete(type);
        } else {
            cacheStore = {
                tags: { data: null, timestamp: 0 },
                performers: { data: null, timestamp: 0 },
                galleries: { data: null, timestamp: 0 },
                studios: { data: null, timestamp: 0 },
                groups: { data: null, timestamp: 0 }
            };
            idbDelete(null);
        }
    }

    async function revalidateCacheInBackground(type) {
        const config = ENTITY_CONFIG[type];
        if (!config || !config.fetchQuery) return;
        if (cacheStore[type]) cacheStore[type]._isRevalidating = true;
        try {
            const res = await fetchGQL(config.fetchQuery);
            const freshList = config.extractList(res?.data);
            if (freshList && freshList.length) {
                setCache(type, freshList);
            }
        } catch (e) {
            // Silently ignore background revalidation errors
        } finally {
            if (cacheStore[type]) cacheStore[type]._isRevalidating = false;
        }
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
    async function attachScenePreview(hostContainer, sceneId, cardElement) {
        if (!hostContainer) return;
        if (hostContainer._previewAbortController) {
            hostContainer._previewAbortController.abort();
        }
        const previewAbort = new AbortController();
        hostContainer._previewAbortController = previewAbort;
        previewAbortController = previewAbort;
        const { signal } = previewAbort;

        hostContainer.innerHTML = '';
        hostContainer.style.display = 'block';
        hostContainer.style.position = 'relative';
        hostContainer.style.width = '100%';
        hostContainer.style.aspectRatio = '16 / 9';
        const isEverythingHost = hostContainer.id === 'everything-preview-container';
        hostContainer.style.maxHeight = isEverythingHost ? '205px' : '280px';
        hostContainer.style.margin = '0 0 8px 0';
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

        const { previewUrl, coverUrl, streamUrl } = await fetchSceneMediaUrlsFromModule(sceneId, cardElement);
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

        // Popout Button (YouTube Picture-in-Picture overlapping screens icon)
        const popoutBtn = document.createElement('button');
        popoutBtn.type = 'button';
        popoutBtn.id = 'fasttag-stream-popout-btn';
        popoutBtn.style.cssText = 'background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; padding: 2px 7px; font-size: 11.5px; font-weight: 600; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: center; opacity: 0.85; box-shadow: 0 2px 6px rgba(0,0,0,0.4); transition: all 0.15s ease; line-height: 1; min-width: 23px; height: 20px;';
        popoutBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; pointer-events: none;">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" fill="none" stroke-width="2"></rect>
                <rect x="12" y="11" width="8" height="7" rx="1.5" fill="currentColor" stroke="none"></rect>
            </svg>
        `;
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
                setVideoHudPersistedOpen(true);
                ftLog('ACTION', 'HUD', 'Video HUD popped out');

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
                        try {
                            localStorage.setItem('fasttag_video_hud_pos', JSON.stringify(floatingHudPosition));
                        } catch (e) {}
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
                        try {
                            localStorage.setItem('fasttag_video_hud_size', JSON.stringify(floatingHudSize));
                        } catch (e) {}
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

                    let savedPos = floatingHudPosition;
                    if (!savedPos) {
                        try {
                            savedPos = JSON.parse(localStorage.getItem('fasttag_video_hud_pos') || 'null');
                        } catch (e) {}
                    }
                    let savedSize = floatingHudSize;
                    if (!savedSize) {
                        try {
                            savedSize = JSON.parse(localStorage.getItem('fasttag_video_hud_size') || 'null');
                        } catch (e) {}
                    }

                    if (savedPos && savedPos.left && savedPos.top) {
                        const pLeft = parseInt(savedPos.left, 10);
                        const pTop = parseInt(savedPos.top, 10);
                        const pW = savedSize?.width ? parseInt(savedSize.width, 10) : (parseInt(defaultSize.width, 10) || 600);
                        const pH = savedSize?.height ? parseInt(savedSize.height, 10) : (parseInt(defaultSize.height, 10) || 338);
                        if (!isNaN(pLeft) && !isNaN(pTop)) {
                            finalLeft = `${Math.max(8, Math.min(window.innerWidth - pW - 8, pLeft))}px`;
                            finalTop = `${Math.max(8, Math.min(window.innerHeight - pH - 8, pTop))}px`;
                            finalRight = null;
                            finalWidth = `${pW}px`;
                            finalHeight = `${pH}px`;
                            floatingHudPosition = { left: finalLeft, top: finalTop };
                            if (savedSize) floatingHudSize = savedSize;
                        }
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

                        dragStartX = e.clientX;
                        dragStartY = e.clientY;
                        startLeft = floatingHudElement.offsetLeft;
                        startTop = floatingHudElement.offsetTop;
                        isDragging = false;
                        document.addEventListener('mousemove', onHudMouseMove);
                        document.addEventListener('mouseup', onHudMouseUp);
                    };

                    document.body.appendChild(floatingHudElement);

                    const resizeObserver = new ResizeObserver((entries) => {
                        for (let entry of entries) {
                            if (floatingHudElement && isVideoPoppedOut) {
                                floatingHudSize = { width: `${floatingHudElement.offsetWidth}px`, height: `${floatingHudElement.offsetHeight}px` };
                                try {
                                    localStorage.setItem('fasttag_video_hud_size', JSON.stringify(floatingHudSize));
                                } catch (e) {}
                            }
                        }
                    });
                    resizeObserver.observe(floatingHudElement);
                }

                // Smoothly swap content inside floating window
                floatingHudElement.innerHTML = '';
                mediaContainer.style.cursor = 'default';
                mediaContainer.title = '';
                floatingHudElement.appendChild(mediaContainer);

                // Switch popout button to PiP Dock button directly on floating video player
                popoutBtn.style.display = 'flex';
                popoutBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; pointer-events: none;">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" fill="none" stroke-width="2"></rect>
                        <path d="M12 12l-4 4m0 0h3.5m-3.5 0v-3.5" stroke="currentColor" stroke-width="2"></path>
                    </svg>
                `;
                popoutBtn.setAttribute('data-micro-tooltip', 'Dock video back into popup');

                // 5-Second Inactivity Fade for Floating Video Controls
                let controlsFadeTimer = null;
                const resetControlsFade = () => {
                    if (!isVideoPoppedOut) return;
                    clearTimeout(controlsFadeTimer);
                    controlsRow.style.transition = 'opacity 0.2s ease';
                    controlsRow.style.opacity = '0.9';
                    controlsFadeTimer = setTimeout(() => {
                        if (isVideoPoppedOut) {
                            controlsRow.style.transition = 'opacity 1s ease';
                            controlsRow.style.opacity = '0.15';
                        }
                    }, 5000);
                };

                floatingHudElement.onmousemove = resetControlsFade;
                floatingHudElement.onmouseenter = resetControlsFade;
                controlsRow.onmouseenter = () => {
                    clearTimeout(controlsFadeTimer);
                    controlsRow.style.transition = 'opacity 0.15s ease';
                    controlsRow.style.opacity = '1';
                };
                controlsRow.onmouseleave = resetControlsFade;

                resetControlsFade();

                // Collapse preview container completely so tables get 100% full height
                hostContainer.innerHTML = '';
                hostContainer.style.display = 'none';
                hostContainer.style.margin = '0';
                hostContainer.style.height = '0';
                hostContainer.style.maxHeight = '0';
                hostContainer.onclick = null;
            } else {
                isVideoPoppedOut = false;
                setVideoHudPersistedOpen(false);
                ftLog('ACTION', 'HUD', 'Video HUD docked back into popup');
                controlsRow.style.transition = 'all 0.15s ease';
                controlsRow.style.opacity = '0.9';
                controlsRow.onmouseenter = null;
                controlsRow.onmouseleave = null;
                if (floatingHudElement) {
                    floatingHudElement.onmousemove = null;
                    floatingHudElement.onmouseenter = null;
                    floatingHudElement.onmouseleave = null;
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
                const isEvHost = hostContainer.id === 'everything-preview-container';
                hostContainer.style.maxHeight = isEvHost ? '205px' : '280px';
                hostContainer.style.margin = '0 0 8px 0';
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
                popoutBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; pointer-events: none;">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" fill="none" stroke-width="2"></rect>
                        <rect x="12" y="11" width="8" height="7" rx="1.5" fill="currentColor" stroke="none"></rect>
                    </svg>
                `;
                popoutBtn.setAttribute('data-micro-tooltip', 'Pop out video into floating HUD');
            }
        };

        popoutBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            togglePopout(!isVideoPoppedOut);
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
            const rawDelta = getDominantWheelDelta(e.deltaX, e.deltaY);
            if (rawDelta === null) return;

            const now = performance.now();
            const timeDelta = lastWheelTimestamp > 0 ? (now - lastWheelTimestamp) : 300;
            lastWheelTimestamp = now;

            const scrubSpeeds = getScrubSpeeds();

            const step = selectScrubStep(scrubSpeeds, timeDelta, shiftHeld);
            const notches = getWheelNotches(rawDelta, e.deltaMode);
            if (notches === null) return;

            if (!scrubbing) {
                scrubbing = true;
                originalLoop = !!currentMedia.loop;
                try { currentMedia.loop = false; } catch (err) {}
            }

            if (!currentMedia.paused && !currentMedia.ended) {
                wasPlaying = true;
                try { currentMedia.pause(); } catch (err) {}
            }

            currentMedia.currentTime = calculateScrubTarget(currentMedia.currentTime, currentMedia.duration, notches, step);
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
                video.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain; background: #0f172a; pointer-events: none;';
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

                let hasRetriedStream = false;
                video.onerror = () => {
                    // If transient network glitch or drive spin-up delay, retry once after 800ms
                    if (!hasRetriedStream && video.error && (video.error.code === 2 || video.error.code === 1)) {
                        hasRetriedStream = true;
                        setTimeout(() => {
                            if (currentMedia === video && !signal.aborted) {
                                video.load();
                                video.play().catch(() => {});
                            }
                        }, 800);
                        return;
                    }
                    const errCode = video.error ? video.error.code : 0;
                    const msg = errCode === 4
                        ? 'Full video format not supported by browser — showing preview'
                        : 'Full stream unavailable — showing preview';
                    showToast(msg, 'info', 3000);
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
                        video.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain; background: #0f172a; pointer-events: none;';
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
                            if (streamUrl) {
                                renderMedia('stream');
                            } else {
                                renderCoverOnly();
                            }
                        };
                        video.addEventListener('error', () => {
                            if (streamUrl) {
                                renderMedia('stream');
                            } else {
                                renderCoverOnly();
                            }
                        });

                        currentMedia = video;
                        mediaContainer.insertBefore(video, mediaContainer.firstChild);
                        video.load();
                        video.play().catch(() => {});
                    } else {
                        // Image/webp preview
                        const img = document.createElement('img');
                        img.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain; background: #0f172a; pointer-events: none;';
                        img.alt = 'Scene preview';
                        img.loading = 'eager';
                        img.src = previewUrl;
                        img.onerror = () => {
                            if (streamUrl) {
                                renderMedia('stream');
                            } else {
                                renderCoverOnly();
                            }
                        };
                        currentMedia = img;
                        mediaContainer.insertBefore(img, mediaContainer.firstChild);
                    }
                } else if (streamUrl) {
                    renderMedia('stream');
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
            img.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain; background: #0f172a; pointer-events: none;';
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

        window._fastTagActiveToggleVideoMode = () => {
            if (currentMode === 'stream') {
                renderMedia('preview');
                showToast('Switched to Video Preview', 'info', 1500);
            } else {
                renderMedia('stream');
                showToast('Streaming Full Video', 'info', 1500);
            }
        };

        signal.addEventListener('abort', () => {
            if (window._fastTagActiveToggleVideoMode) {
                window._fastTagActiveToggleVideoMode = null;
            }
        });

        // Initial render (honors Always Play Full Video setting)
        renderMedia(getAlwaysPlayFullVideo() ? 'stream' : 'preview');

        // Initial Popout State sync
        if (isVideoPoppedOut || isVideoHudPersistedOpen()) {
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
        const initialSet = sequentialEditState.initialSelectedIds || new Set();
        return hasSelectionSetChanged(selectedIds, initialSet);
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
        const cancelBtn = form.querySelector(`#${type}-cancel-btn`);

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
                saveBtn.style.display = 'none';
            }
            if (cancelBtn) {
                cancelBtn.style.flex = '1';
                cancelBtn.style.width = '100%';
                cancelBtn.style.fontWeight = '600';
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

        if (cancelBtn) {
            cancelBtn.style.flex = 'none';
            cancelBtn.style.width = 'auto';
            cancelBtn.style.fontWeight = '500';
        }

        if (saveBtn) {
            saveBtn.style.display = 'block';
            saveBtn.style.flex = '1';
            saveBtn.disabled = false;
            saveBtn.style.opacity = '1';
            saveBtn.style.cursor = 'pointer';
            saveBtn.textContent = isLast ? (isEasterEggActive() ? 'Close 🍫' : 'Close') : (isEasterEggActive() ? 'Next Scene 🍫 ►' : 'Next Scene ►');
            saveBtn.style.background = '#6366f1';
            saveBtn.classList.remove('fasttag-btn-pulse');
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

    async function updateEntityForScene(type, sceneId, selectedIds) {
        const config = ENTITY_CONFIG[type];
        const res = await fetchGQL(config.updateQuery, config.updateVariables(sceneId, selectedIds));
        if (res.errors) {
            toastError(`Failed to update ${config.title.toLowerCase()}`, res.errors);
            return false;
        }
        if (res?.data?.sceneUpdate) {
            syncSceneToApolloCache(res.data.sceneUpdate);
        }
        resetRefractSceneCards(sceneId);
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

        const currentSceneId = form._fastTagSceneId || sequentialEditState.currentSceneId;
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
                    if (getAutoMarkOrganized()) {
                        updateSceneOrganized(currentSceneId, true);
                    }
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
        form._fastTagSceneId = nextSceneId;

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
            sequentialEditState.currentSceneId = sceneId;
            if (!sequentialEditState.allSceneCards || sequentialEditState.allSceneCards.length === 0) {
                sequentialEditState.allSceneCards = getAllVisibleSceneCards();
            }
            const idx = getSceneCardIndex(sceneId, sequentialEditState.allSceneCards);
            if (idx !== -1) {
                sequentialEditState.currentIndex = idx;
            }
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

    // --- Sort Options Registry & Dropdown Menu ---
    const ENTITY_SORT_CRITERIA = {
        tags: [
            { field: 'name', label: 'Name', defaultDir: 'asc' },
            { field: 'sort_name', label: 'Stash Sort Name', defaultDir: 'asc' },
            { field: 'scene_count', label: 'Scene Count', defaultDir: 'desc' },
            { field: 'created_at', label: 'Date Added', defaultDir: 'desc' },
            { field: 'updated_at', label: 'Date Updated', defaultDir: 'desc' }
        ],
        performers: [
            { field: 'name', label: 'Name', defaultDir: 'asc' },
            { field: 'scene_count', label: 'Scene Count', defaultDir: 'desc' },
            { field: 'rating100', label: 'Rating', defaultDir: 'desc' },
            { field: 'birthdate', label: 'Age / Birthdate', defaultDir: 'desc' },
            { field: 'created_at', label: 'Date Added', defaultDir: 'desc' },
            { field: 'updated_at', label: 'Date Updated', defaultDir: 'desc' }
        ],
        studios: [
            { field: 'name', label: 'Name', defaultDir: 'asc' },
            { field: 'scene_count', label: 'Scene Count', defaultDir: 'desc' },
            { field: 'created_at', label: 'Date Added', defaultDir: 'desc' },
            { field: 'updated_at', label: 'Date Updated', defaultDir: 'desc' }
        ],
        galleries: [
            { field: 'name', label: 'Title', defaultDir: 'asc' },
            { field: 'created_at', label: 'Date Added', defaultDir: 'desc' },
            { field: 'updated_at', label: 'Date Updated', defaultDir: 'desc' }
        ],
        groups: [
            { field: 'name', label: 'Name', defaultDir: 'asc' },
            { field: 'scene_count', label: 'Scene Count', defaultDir: 'desc' },
            { field: 'created_at', label: 'Date Added', defaultDir: 'desc' },
            { field: 'updated_at', label: 'Date Updated', defaultDir: 'desc' }
        ]
    };

    function getEntitySortCriteria(type) {
        return ENTITY_SORT_CRITERIA[type] || [];
    }

    function getSavedSortField(type) {
        try {
            const savedField = localStorage.getItem(`fasttag_sort_field_${type}`);
            const criteria = getEntitySortCriteria(type);
            if (savedField && criteria.some(c => c.field === savedField)) return savedField;

            const legacyKey = localStorage.getItem(`fasttag_sort_${type}`);
            if (legacyKey) {
                const match = criteria.find(c => legacyKey.startsWith(c.field));
                if (match) return match.field;
            }
        } catch (e) {}
        return 'name';
    }

    function getSavedSortDirection(type) {
        try {
            const savedDir = localStorage.getItem(`fasttag_sort_dir_${type}`);
            if (savedDir === 'asc' || savedDir === 'desc') return savedDir;

            const legacyKey = localStorage.getItem(`fasttag_sort_${type}`);
            if (legacyKey) {
                if (legacyKey.endsWith('_desc')) return 'desc';
                if (legacyKey.endsWith('_asc')) return 'asc';
            }
        } catch (e) {}
        const currentField = getSavedSortField(type);
        const criteria = getEntitySortCriteria(type);
        const opt = criteria.find(c => c.field === currentField);
        return opt?.defaultDir || 'asc';
    }

    function setSavedSort(type, field, dir) {
        try {
            localStorage.setItem(`fasttag_sort_field_${type}`, field);
            localStorage.setItem(`fasttag_sort_dir_${type}`, dir);
            localStorage.setItem(`fasttag_sort_${type}`, `${field}_${dir}`);
        } catch (e) {}
    }

    function getSavedSortKey(type) {
        return `${getSavedSortField(type)}_${getSavedSortDirection(type)}`;
    }

    function getSortHeaderTitle(type, field = 'name') {
        if (field !== 'name' && field !== 'title') {
            return field.charAt(0).toUpperCase() + field.slice(1);
        }
        const currentField = getSavedSortField(type);
        const currentDir = getSavedSortDirection(type);
        const criteria = getEntitySortCriteria(type);
        const opt = criteria.find(c => c.field === currentField) || criteria[0];
        const label = opt ? opt.label : 'Name';
        const arrow = currentDir === 'asc' ? '▲' : '▼';
        return `
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; gap: 6px; box-sizing: border-box;">
                <span class="fasttag-sort-title-label" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;">${label}</span>
                <span data-sort-arrow="true" class="fasttag-sort-arrow-btn" title="Click to flip order (${currentDir === 'asc' ? 'Ascending' : 'Descending'})">${arrow}</span>
            </div>
        `;
    }

    function handleHeaderSortClick(e, col, type, onSortChanged) {
        e.preventDefault();
        e.stopPropagation();

        const arrowEl = e.target.closest('[data-sort-arrow]');
        if (arrowEl) {
            // 1-Click Direction Flip!
            const currentField = getSavedSortField(type);
            const currentDir = getSavedSortDirection(type);
            const newDir = currentDir === 'asc' ? 'desc' : 'asc';
            setSavedSort(type, currentField, newDir);
            if (col && typeof col.updateDefinition === 'function') {
                col.updateDefinition({ title: getSortHeaderTitle(type, col.getField()) });
            }
            if (typeof onSortChanged === 'function') {
                onSortChanged(`${currentField}_${newDir}`);
            }
            return;
        }

        // Open criteria dropdown menu
        openSortDropdownMenu(e, col, type, onSortChanged);
    }

    function openSortDropdownMenu(e, col, type, onSortChanged) {
        e.preventDefault();
        e.stopPropagation();

        const colEl = e.target.closest('.tabulator-col') || e.target;
        if (colEl && colEl._fastTagLastMenuClosedAt && (Date.now() - colEl._fastTagLastMenuClosedAt < 250)) {
            colEl._fastTagLastMenuClosedAt = 0;
            return;
        }

        const existingMenu = document.querySelector('#fasttag-sort-dropdown-menu');
        if (existingMenu) {
            existingMenu.remove();
            return;
        }

        const criteria = getEntitySortCriteria(type);
        if (!criteria.length) return;

        const currentField = getSavedSortField(type);
        const currentDir = getSavedSortDirection(type);
        const isDark = getEffectiveTheme() === 'dark';

        const menu = document.createElement('div');
        menu.id = 'fasttag-sort-dropdown-menu';
        menu.style.position = 'fixed';
        menu.style.zIndex = '2000000';
        menu.style.minWidth = '200px';
        menu.style.maxWidth = '265px';
        menu.style.maxHeight = '360px';
        menu.style.overflowY = 'auto';
        menu.style.backgroundColor = isDark ? '#1e293b' : '#ffffff';
        menu.style.background = isDark ? '#1e293b' : '#ffffff';
        menu.style.border = isDark ? '1px solid #334155' : '1px solid #cbd5e1';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = isDark ? '0 10px 25px -5px rgba(0,0,0,0.6)' : '0 10px 25px -5px rgba(0,0,0,0.15)';
        menu.style.padding = '4px 0';
        menu.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        menu.style.fontSize = '12px';
        menu.style.color = isDark ? '#e2e8f0' : '#1e293b';

        menu.addEventListener('mousedown', (ev) => {
            ev.stopPropagation();
        });

        const headerItem = document.createElement('div');
        headerItem.textContent = `Sort ${ENTITY_CONFIG[type]?.pluralTitle || 'Items'} By`;
        headerItem.style.cssText = `padding: 6px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${isDark ? '#94a3b8' : '#64748b'}; letter-spacing: 0.5px; border-bottom: ${isDark ? '1px solid #334155' : '1px solid #e2e8f0'}; margin-bottom: 2px; position: sticky; top: 0; background: inherit; z-index: 1;`;
        menu.appendChild(headerItem);

        criteria.forEach(opt => {
            const itemBtn = document.createElement('div');
            const isActive = opt.field === currentField;
            itemBtn.style.cssText = `padding: 6px 12px; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 8px; transition: background 0.1s ease; font-weight: ${isActive ? '600' : '400'}; color: ${isActive ? (isDark ? '#818cf8' : '#4f46e5') : (isDark ? '#e2e8f0' : '#1e293b')}; background: ${isActive ? (isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(99, 102, 241, 0.08)') : 'transparent'};`;
            
            const labelSpan = document.createElement('span');
            labelSpan.textContent = opt.label;
            itemBtn.appendChild(labelSpan);

            if (isActive) {
                const rightBadge = document.createElement('div');
                rightBadge.style.cssText = 'display: inline-flex; align-items: center; gap: 4px;';
                const arrowIcon = currentDir === 'asc' ? '▲' : '▼';
                rightBadge.innerHTML = `<span style="font-size: 9.5px; opacity: 0.85; background: ${isDark ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.15)'}; padding: 1px 5px; border-radius: 4px; font-weight: 700;">${arrowIcon}</span><span style="font-weight: 700;">✓</span>`;
                itemBtn.appendChild(rightBadge);
            }

            itemBtn.addEventListener('mouseenter', () => {
                if (!isActive) itemBtn.style.background = isDark ? '#334155' : '#f1f5f9';
            });
            itemBtn.addEventListener('mouseleave', () => {
                if (!isActive) itemBtn.style.background = 'transparent';
            });

            itemBtn.addEventListener('mousedown', (ev) => {
                ev.stopPropagation();
            });

            itemBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                let nextDir = opt.defaultDir || 'asc';
                if (isActive) {
                    nextDir = currentDir === 'asc' ? 'desc' : 'asc';
                }
                setSavedSort(type, opt.field, nextDir);
                if (col && typeof col.updateDefinition === 'function') {
                    col.updateDefinition({ title: getSortHeaderTitle(type, col.getField()) });
                }
                menu.remove();
                if (typeof onSortChanged === 'function') {
                    onSortChanged(`${opt.field}_${nextDir}`);
                }
            });

            menu.appendChild(itemBtn);
        });

        document.body.appendChild(menu);

        const rect = colEl.getBoundingClientRect();
        const menuW = menu.offsetWidth || 200;
        let top = rect.bottom + 4;
        let left = Math.min(rect.left, window.innerWidth - menuW - 10);
        left = Math.max(10, left);

        if (top + menu.offsetHeight > window.innerHeight - 10) {
            top = Math.max(10, rect.top - menu.offsetHeight - 4);
        }

        menu.style.top = `${top}px`;
        menu.style.left = `${left}px`;

        const cleanupListeners = () => {
            document.removeEventListener('mousedown', closeHandler, true);
            document.removeEventListener('click', closeHandler, true);
            document.removeEventListener('keydown', keyHandler, true);
        };

        const closeHandler = (ev) => {
            if (!menu.contains(ev.target)) {
                if (colEl && (colEl === ev.target || colEl.contains(ev.target))) {
                    colEl._fastTagLastMenuClosedAt = Date.now();
                }
                menu.remove();
                cleanupListeners();
            }
        };
        const keyHandler = (ev) => {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                menu.remove();
                cleanupListeners();
            }
        };

        setTimeout(() => {
            document.addEventListener('mousedown', closeHandler, true);
            document.addEventListener('click', closeHandler, true);
            document.addEventListener('keydown', keyHandler, true);
        }, 10);
    }

    // --- Search, Sorting, and Quick Selection ---
    function getSmartSortComparator(term, selectedIds, labelKey, searchFields = [labelKey], sortKey = 'name_asc') {
        return (a, b) => {
            const aName = String(a[labelKey] || '').trim().toLowerCase();
            const bName = String(b[labelKey] || '').trim().toLowerCase();
            const aId = String(a.id || '').trim();
            const bId = String(b.id || '').trim();

            if (!term) {
                const hasSet = selectedIds && typeof selectedIds.has === 'function';
                const aSel = hasSet && selectedIds.has(String(a.id));
                const bSel = hasSet && selectedIds.has(String(b.id));
                if (aSel && !bSel) return -1;
                if (!aSel && bSel) return 1;

                switch (sortKey) {
                    case 'name_desc':
                        return bName.localeCompare(aName);
                    case 'sort_name':
                    case 'sort_name_asc': {
                        const aSort = String(a.sort_name && a.sort_name.trim() ? a.sort_name : (a[labelKey] || '')).trim().toLowerCase();
                        const bSort = String(b.sort_name && b.sort_name.trim() ? b.sort_name : (b[labelKey] || '')).trim().toLowerCase();
                        if (aSort < bSort) return -1;
                        if (aSort > bSort) return 1;
                        return aName < bName ? -1 : (aName > bName ? 1 : 0);
                    }
                    case 'sort_name_desc': {
                        const aSort = String(a.sort_name && a.sort_name.trim() ? a.sort_name : (a[labelKey] || '')).trim().toLowerCase();
                        const bSort = String(b.sort_name && b.sort_name.trim() ? b.sort_name : (b[labelKey] || '')).trim().toLowerCase();
                        if (aSort > bSort) return -1;
                        if (aSort < bSort) return 1;
                        return aName > bName ? -1 : (aName < bName ? 1 : 0);
                    }
                    case 'scene_count_desc':
                        return (Number(b.scene_count) || 0) - (Number(a.scene_count) || 0) || aName.localeCompare(bName);
                    case 'scene_count_asc':
                        return (Number(a.scene_count) || 0) - (Number(b.scene_count) || 0) || aName.localeCompare(bName);
                    case 'image_count_desc':
                        return (Number(b.image_count) || 0) - (Number(a.image_count) || 0) || aName.localeCompare(bName);
                    case 'image_count_asc':
                        return (Number(a.image_count) || 0) - (Number(b.image_count) || 0) || aName.localeCompare(bName);
                    case 'gallery_count_desc':
                        return (Number(b.gallery_count) || 0) - (Number(a.gallery_count) || 0) || aName.localeCompare(bName);
                    case 'gallery_count_asc':
                        return (Number(a.gallery_count) || 0) - (Number(b.gallery_count) || 0) || aName.localeCompare(bName);
                    case 'o_counter_desc':
                        return (Number(b.o_counter) || 0) - (Number(a.o_counter) || 0) || aName.localeCompare(bName);
                    case 'o_counter_asc':
                        return (Number(a.o_counter) || 0) - (Number(b.o_counter) || 0) || aName.localeCompare(bName);
                    case 'career_start_year_desc':
                        return (Number(b.career_start_year) || 0) - (Number(a.career_start_year) || 0) || aName.localeCompare(bName);
                    case 'career_start_year_asc': {
                        const aYr = Number(a.career_start_year) || 9999;
                        const bYr = Number(b.career_start_year) || 9999;
                        return aYr - bYr || aName.localeCompare(bName);
                    }
                    case 'height_cm_desc':
                        return (Number(b.height_cm) || 0) - (Number(a.height_cm) || 0) || aName.localeCompare(bName);
                    case 'height_cm_asc': {
                        const aH = Number(a.height_cm) || 9999;
                        const bH = Number(b.height_cm) || 9999;
                        return aH - bH || aName.localeCompare(bName);
                    }
                    case 'rating100_desc':
                        return (Number(b.rating100) || 0) - (Number(a.rating100) || 0) || aName.localeCompare(bName);
                    case 'rating100_asc':
                        return (Number(a.rating100) || 0) - (Number(b.rating100) || 0) || aName.localeCompare(bName);
                    case 'birthdate_desc':
                        return String(b.birthdate || '').localeCompare(String(a.birthdate || '')) || aName.localeCompare(bName);
                    case 'birthdate_asc': {
                        const aBirth = a.birthdate || '9999-99-99';
                        const bBirth = b.birthdate || '9999-99-99';
                        return aBirth.localeCompare(bBirth) || aName.localeCompare(bName);
                    }
                    case 'created_at_desc':
                        return String(b.created_at || '').localeCompare(String(a.created_at || '')) || aName.localeCompare(bName);
                    case 'created_at_asc':
                        return String(a.created_at || '9999').localeCompare(String(b.created_at || '9999')) || aName.localeCompare(bName);
                    case 'updated_at_desc':
                        return String(b.updated_at || '').localeCompare(String(a.updated_at || '')) || aName.localeCompare(bName);
                    case 'updated_at_asc':
                        return String(a.updated_at || '9999').localeCompare(String(b.updated_at || '9999')) || aName.localeCompare(bName);
                    case 'random': {
                        const hashA = ((Number(a.id) || 1) * 9301 + 49297) % 233280;
                        const hashB = ((Number(b.id) || 1) * 9301 + 49297) % 233280;
                        return hashA - hashB;
                    }
                    case 'name_asc':
                    default:
                        return aName.localeCompare(bName);
                }
            }

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

            // Priority Tiebreaker: Higher scene_count (tag/usage count) first
            const aCount = Number(a.scene_count) || 0;
            const bCount = Number(b.scene_count) || 0;
            if (aCount !== bCount) return bCount - aCount;

            return aName.localeCompare(bName);
        };
    }

    function trySelectRecentChip(type, item, selectedIds, input, onSelected) {
        if (!item) return false;
        let idStr = (item.id != null && item.id !== '') ? String(item.id) : null;
        if (!idStr) {
            const cached = getCachedOrNull(type) || [];
            const name = item.name || item.title;
            if (name) {
                const found = cached.find(c => (c.name || c.title || '').trim().toLowerCase() === name.trim().toLowerCase());
                if (found) idStr = String(found.id);
            }
        }
        if (!idStr) return false;

        addRecentEntry(type, { ...item, id: idStr });

        if (selectedIds.has(idStr)) {
            selectedIds.delete(idStr);
        } else {
            selectedIds.add(idStr);
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

        const showPinned = getShowPinnedChips();
        const showRecent = getShowRecentChips();
        const cached = getCachedOrNull(type) || [];

        const resolveItem = (item, isPinned) => {
            let id = (item.id != null && item.id !== '') ? String(item.id) : null;
            const name = item.name || item.title;
            if (!id && name) {
                const found = cached.find(c => (c.name || c.title || '').trim().toLowerCase() === name.trim().toLowerCase());
                if (found) id = String(found.id);
            }
            return { id, name, isPinned };
        };

        const pinned = showPinned ? readPinnedEntries(type)
            .filter(item => item && (item.name || item.title))
            .map(item => resolveItem(item, true))
            .filter(item => item.id != null) : [];

        const pinnedIds = new Set(pinned.map(p => String(p.id)));

        const recent = showRecent ? readRecentEntries(type)
            .filter(item => item && (item.name || item.title))
            .map(item => resolveItem(item, false))
            .filter(item => item.id != null && !pinnedIds.has(String(item.id))) : [];

        const combinedList = [...pinned, ...recent];

        if (!combinedList.length) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        const formHeight = form ? (form.offsetHeight || parseInt(form.style.height, 10) || 580) : 580;
        const maxRows = formHeight > 720 ? 3 : (formHeight > 520 ? 2 : 1);

        const isDark = getEffectiveTheme() === 'dark';
        target.innerHTML = '';
        target.style.display = 'flex';
        target.style.alignItems = 'center';
        target.style.flexWrap = 'wrap';
        target.style.gap = '4px';
        target.style.height = '52px';
        target.style.maxHeight = '52px';
        target.style.boxSizing = 'border-box';
        target.style.overflowY = 'auto';
        target.style.overflowX = 'hidden';
        target.style.overscrollBehavior = 'contain';
        target.style.scrollbarWidth = 'thin';
        target.style.padding = '5px 6px';
        target.style.backgroundColor = isDark ? '#1e293b' : '#f8fafc';
        target.style.border = isDark ? '1px solid #334155' : '1px solid #e2e8f0';
        target.style.borderRadius = '8px';
        target.style.marginBottom = '8px';
        const label = document.createElement('span');
        label.textContent = 'Recent:';
        label.className = 'popup-recent-label';
        label.style.cssText = `font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${isDark ? '#94a3b8' : '#64748b'}; letter-spacing: 0.5px; margin-right: 2px; user-select: none; flex-shrink: 0; line-height: 20px;`;
        target.appendChild(label);

        let chipIndex = 0;
        for (const item of combinedList) {
            chipIndex++;
            const isSelected = selectedIds && selectedIds.has(String(item.id));
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'fasttag-quick-chip';
            chip.setAttribute('data-index', String(chipIndex));
            chip.title = `Click to toggle. Right-Click or Alt-Click to ${item.isPinned ? 'unpin' : 'pin'}.`;

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

            if (isDark) {
                const bg = item.isPinned ? (isSelected ? '#4338ca' : '#1e1b4b') : (isSelected ? '#4f46e5' : '#1e293b');
                const border = item.isPinned ? (isSelected ? '#a5b4fc' : '#6366f1') : (isSelected ? '#818cf8' : '#475569');
                const color = isSelected ? '#ffffff' : (item.isPinned ? '#e0e7ff' : '#f1f5f9');

                chip.style.cssText = `padding: 2px 7px; border: 1px solid ${border}; border-radius: 999px; background: ${bg}; color: ${color}; font-size: 10.5px; font-weight: ${item.isPinned || isSelected ? '600' : '500'}; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; line-height: 1.25;`;
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

                chip.style.cssText = `padding: 2px 7px; border: 1px solid ${border}; border-radius: 999px; background: ${bg}; color: ${color}; font-size: 10.5px; font-weight: ${item.isPinned || isSelected ? '600' : '500'}; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; line-height: 1.25;`;
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
                e.preventDefault();
                e.stopPropagation();
                if (e.altKey) {
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
            btn.className = 'fasttag-smart-suggestion-chip';
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
            acceptAllBtn.className = 'fasttag-smart-suggestion-chip';
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
    let isModalClosing = false;

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
        isModalClosing = true;
        try {
            if (activePopup) {
                if (activePopup.tagsTable) {
                    try {
                        activePopup.tagsTable.off("rowSelected");
                        activePopup.tagsTable.off("rowDeselected");
                        activePopup.tagsTable.destroy();
                    } catch (e) {}
                    activePopup.tagsTable = null;
                }
                if (activePopup.performersTable) {
                    try {
                        activePopup.performersTable.off("rowSelected");
                        activePopup.performersTable.off("rowDeselected");
                        activePopup.performersTable.destroy();
                    } catch (e) {}
                    activePopup.performersTable = null;
                }
            }
            if (activeTableInstance) {
                try {
                    activeTableInstance.off("rowSelected");
                    activeTableInstance.off("rowDeselected");
                    activeTableInstance.destroy();
                } catch (e) {}
                activeTableInstance = null;
            }
            if (popupAbortController) {
                popupAbortController.abort();
                popupAbortController = null;
            }
            if (previewAbortController) {
                previewAbortController.abort();
                previewAbortController = null;
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

            document.body.classList.remove('fasttag-modal-open');
            if (resetSequential) {
                resetSequentialEditState();
                sessionScrapeCache.clear();
                window._fastTagEverythingScraperOpen = false;
            }
            refreshSceneCardsDebounced(null, 50);
        } finally {
            setTimeout(() => {
                isModalClosing = false;
            }, 100);
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
        createMenuItem('🎲 Random Untagged Scene', () => rollNextRandomUntaggedScene());

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
            createMenuItem(`📁 Bulk Groups (${bulkScenes.length})`, () => openBulkEntityPopup('groups', bulkScenes));
            createMenuItem(`⚡ Bulk Edit Everything (${bulkScenes.length})`, () => openBulkEverythingPopup(bulkScenes));
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
            // 1. Remove custom popup sizes and positions
            localStorage.removeItem('stash_fast_tag_popup_size_everything');
            localStorage.removeItem('stash_fast_tag_popup_size_single');
            localStorage.removeItem('stash_fast_tag_popup_size');
            localStorage.removeItem('fasttag_everything_pos');
            localStorage.removeItem('fasttag_video_hud_pos');
            localStorage.removeItem('fasttag_video_hud_size');
            localStorage.removeItem('fasttag_video_hud_open_state');
            localStorage.removeItem('fasttag_scraper_hud_pos');
            localStorage.removeItem('fasttag_scraper_hud_size');
            localStorage.removeItem('fasttag_scraper_hud_open_state');
            localStorage.removeItem('fasttag_embedded_scraper_h');

            // 2. Remove all custom column widths and splitters
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && (k.startsWith('fasttag_col_width_') || k.startsWith('fasttag_splitter_') || k === 'fasttag_everything_splitter_ratio' || k === 'fasttag_everything_col_split')) {
                    keysToRemove.push(k);
                }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));

            // 3. Reset floating HUD positions and sizes
            floatingHudPosition = null;
            floatingHudSize = null;
            floatingScraperHudPosition = null;
            floatingScraperHudSize = null;

            // 4. If a popup is currently open, smoothly snap it to optimal size and balanced position
            if (activePopup?.element) {
                const isEverything = activePopup.element.getAttribute('data-popup-type') === 'everything' || activePopup.element.getAttribute('data-popup-type') === 'bulk-everything';
                const type = isEverything ? 'everything' : 'single';
                const optimal = getOptimalPopupSize(type);
                activePopup.element.style.transition = 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.25s cubic-bezier(0.4, 0, 0.2, 1), left 0.25s cubic-bezier(0.4, 0, 0.2, 1), top 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
                activePopup.element.style.width = `${optimal.width}px`;
                activePopup.element.style.height = `${optimal.height}px`;
                if (isEverything) {
                    const pos = getDefaultEverythingPosition(optimal.width, optimal.height);
                    activePopup.element.style.left = `${pos.x}px`;
                    activePopup.element.style.top = `${pos.y}px`;
                }
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

            toastSuccess('All popup sizes, window positions, and column layouts reset to optimal defaults');
        } catch (err) {
            console.error('[FastTag] Error resetting layouts:', err);
            toastError('Failed to reset layouts: ' + err.message);
        }
    }

    function getColumnsWithSavedWidths(type, scope = 'single', onSortChanged = null) {
        let baseCols = (ENTITY_CONFIG[type]?.columns || []).map(c => ({ ...c }));
        if (!getShowIdColumns()) {
            baseCols = baseCols.filter(c => c.field !== 'id');
        }
        return baseCols.map((c, idx) => {
            let colDef = { ...c };
            if (c.field === 'name' || c.field === 'title') {
                colDef.title = getSortHeaderTitle(type, c.field);
                colDef.cssClass = (colDef.cssClass ? colDef.cssClass + ' ' : '') + 'fasttag-sortable-header';
                colDef.headerClick = (e, col) => {
                    handleHeaderSortClick(e, col, type, onSortChanged);
                };
            }
            if (idx === baseCols.length - 1) {
                return { ...colDef, width: undefined, widthGrow: colDef.widthGrow || 1 };
            }
            try {
                const saved = localStorage.getItem(`fasttag_col_width_${scope}_${type}_${c.field}`);
                if (saved) {
                    const w = parseInt(saved, 10);
                    if (!isNaN(w) && w >= 35) {
                        return { ...colDef, width: w, widthGrow: undefined };
                    }
                }
            } catch (e) {}
            return colDef;
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

    // Temporary in-memory session cache for active scrape results (cleared when popup is closed)
    const sessionScrapeCache = new Map();

    function attachScraperHudResizeHandles(hudElement) {
        if (!hudElement) return;
        hudElement.querySelectorAll('.fasttag-scraper-resize-handle').forEach(el => el.remove());

        const minW = 300;
        const minH = 220;
        const maxW = Math.max(minW, window.innerWidth - 16);
        const maxH = Math.max(minH, window.innerHeight - 16);

        const handles = [
            { dir: 'n', style: 'top: -5px; left: 12px; right: 12px; height: 10px; cursor: ns-resize; z-index: 100;' },
            { dir: 's', style: 'bottom: -5px; left: 12px; right: 12px; height: 10px; cursor: ns-resize; z-index: 100;' },
            { dir: 'e', style: 'right: -5px; top: 12px; bottom: 12px; width: 10px; cursor: ew-resize; z-index: 100;' },
            { dir: 'w', style: 'left: -5px; top: 12px; bottom: 12px; width: 10px; cursor: ew-resize; z-index: 100;' },
            { dir: 'ne', style: 'top: -5px; right: -5px; width: 16px; height: 16px; cursor: nesw-resize; z-index: 101;' },
            { dir: 'nw', style: 'top: -5px; left: -5px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 101;' },
            { dir: 'se', style: 'bottom: -5px; right: -5px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 101;' },
            { dir: 'sw', style: 'bottom: -5px; left: -5px; width: 16px; height: 16px; cursor: nesw-resize; z-index: 101;' }
        ];

        handles.forEach(({ dir, style }) => {
            const handle = document.createElement('div');
            handle.className = 'fasttag-scraper-resize-handle';
            handle.setAttribute('data-dir', dir);
            handle.style.cssText = `position: absolute; ${style} user-select: none; touch-action: none;`;

            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();

                hudElement._isDragging = true;
                const startX = e.clientX;
                const startY = e.clientY;
                const rect = hudElement.getBoundingClientRect();
                const startL = rect.left;
                const startT = rect.top;
                const startW = hudElement.offsetWidth;
                const startH = hudElement.offsetHeight;

                document.body.style.cursor = handle.style.cursor;
                document.body.style.userSelect = 'none';

                const onMouseMove = (ev) => {
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;

                    let newW = startW;
                    let newH = startH;
                    let newL = startL;
                    let newT = startT;

                    if (dir.includes('e')) newW = startW + dx;
                    if (dir.includes('w')) {
                        newW = startW - dx;
                        newL = startL + dx;
                    }
                    if (dir.includes('s')) newH = startH + dy;
                    if (dir.includes('n')) {
                        newH = startH - dy;
                        newT = startT + dy;
                    }

                    // Bounds Clamping
                    if (newW < minW) {
                        if (dir.includes('w')) newL = startL + (startW - minW);
                        newW = minW;
                    }
                    if (newW > maxW) {
                        if (dir.includes('w')) newL = startL + (startW - maxW);
                        newW = maxW;
                    }
                    if (newL < 8) {
                        if (dir.includes('w')) newW = startW + (startL - 8);
                        newL = 8;
                    }

                    if (newH < minH) {
                        if (dir.includes('n')) newT = startT + (startH - minH);
                        newH = minH;
                    }
                    if (newH > maxH) {
                        if (dir.includes('n')) newT = startT + (startH - maxH);
                        newH = maxH;
                    }
                    if (newT < 8) {
                        if (dir.includes('n')) newH = startH + (startT - 8);
                        newT = 8;
                    }
                    if (newT + newH > window.innerHeight - 8) {
                        if (dir.includes('s')) newH = window.innerHeight - 8 - newT;
                    }
                    if (newL + newW > window.innerWidth - 8) {
                        if (dir.includes('e')) newW = window.innerWidth - 8 - newL;
                    }

                    hudElement.style.width = `${Math.round(newW)}px`;
                    hudElement.style.height = `${Math.round(newH)}px`;
                    hudElement.style.left = `${Math.round(newL)}px`;
                    hudElement.style.top = `${Math.round(newT)}px`;
                    hudElement.style.right = 'auto';

                    floatingScraperHudSize = { width: `${Math.round(newW)}px`, height: `${Math.round(newH)}px` };
                    floatingScraperHudPosition = { top: `${Math.round(newT)}px`, left: `${Math.round(newL)}px` };
                };

                const onMouseUp = () => {
                    hudElement._isDragging = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    try {
                        localStorage.setItem('fasttag_scraper_hud_pos', JSON.stringify(floatingScraperHudPosition));
                        localStorage.setItem('fasttag_scraper_hud_size', JSON.stringify(floatingScraperHudSize));
                    } catch (e) {}
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            hudElement.appendChild(handle);
        });
    }

    async function renderScraperMatchCard(container, incomingResults, sceneId, ctx, popup, onDismiss, emptySearchQuery = '') {
        const allResults = Array.isArray(incomingResults) ? incomingResults : [];
        const filterFalsePositives = getHideObviousFalsePositives();
        const falsePositivePartition = partitionObviousFalsePositiveMatches(allResults);
        const showingHiddenResults = filterFalsePositives && allResults._fastTagShowHidden === true;
        const results = filterFalsePositives && !showingHiddenResults
            ? falsePositivePartition.visible
            : allResults;
        const hiddenResultCount = falsePositivePartition.hidden.length;
        const hasResults = results.length > 0;
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

                let savedPos = floatingScraperHudPosition;
                if (!savedPos) {
                    try {
                        savedPos = JSON.parse(localStorage.getItem('fasttag_scraper_hud_pos') || 'null');
                    } catch (e) {}
                }
                let savedSize = floatingScraperHudSize;
                if (!savedSize) {
                    try {
                        savedSize = JSON.parse(localStorage.getItem('fasttag_scraper_hud_size') || 'null');
                    } catch (e) {}
                }

                if (savedPos && savedPos.left && savedPos.top) {
                    const pLeft = parseInt(savedPos.left, 10);
                    const pTop = parseInt(savedPos.top, 10);
                    const pW = savedSize?.width ? parseInt(savedSize.width, 10) : (parseInt(defaultPos.width, 10) || 390);
                    const pH = savedSize?.height ? parseInt(savedSize.height, 10) : (parseInt(defaultPos.height, 10) || 480);
                    if (!isNaN(pLeft) && !isNaN(pTop)) {
                        finalLeft = `${Math.max(8, Math.min(window.innerWidth - pW - 8, pLeft))}px`;
                        finalTop = `${Math.max(8, Math.min(window.innerHeight - pH - 8, pTop))}px`;
                        finalRight = null;
                        finalWidth = `${pW}px`;
                        finalHeight = `${pH}px`;
                        floatingScraperHudPosition = { left: finalLeft, top: finalTop };
                        if (savedSize) floatingScraperHudSize = savedSize;
                    }
                }
                const isDarkTheme = getEffectiveTheme() === 'dark';
                floatingScraperHudElement.style.cssText = `position: fixed; top: ${finalTop}; ${finalLeft ? `left: ${finalLeft};` : `right: ${finalRight};`} width: ${finalWidth}; height: ${finalHeight}; min-width: 300px; min-height: 220px; max-width: 92vw; max-height: 92vh; z-index: 1000000; background: ${isDarkTheme ? '#1e293b' : '#ffffff'}; border: 1.5px solid ${isDarkTheme ? '#4338ca' : '#a5b4fc'}; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: visible; display: flex; flex-direction: column;`;
                document.body.appendChild(floatingScraperHudElement);

                const scraperResizeObserver = new ResizeObserver(() => {
                    if (floatingScraperHudElement && !floatingScraperHudElement._isDragging) {
                        floatingScraperHudSize = {
                            width: `${floatingScraperHudElement.offsetWidth}px`,
                            height: `${floatingScraperHudElement.offsetHeight}px`
                        };
                        try {
                            localStorage.setItem('fasttag_scraper_hud_size', JSON.stringify(floatingScraperHudSize));
                        } catch (e) {}
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

        if (!hasResults) {
            const initialQuery = cleanTitleForScraping(emptySearchQuery || '');
            targetContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px; box-sizing: border-box; height: 100%; min-height: 150px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <strong style="font-size: 12px; color: ${isDark ? '#e2e8f0' : '#1e293b'};">⚡ Scraper Search</strong>
                        <button type="button" id="fasttag-scrape-empty-close" style="border: none; background: transparent; color: ${isDark ? '#94a3b8' : '#64748b'}; font-size: 15px; cursor: pointer;">✕</button>
                    </div>
                    <div style="padding: 8px; border-radius: 6px; background: ${isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb'}; border: 1px solid ${isDark ? 'rgba(245,158,11,0.35)' : '#fcd34d'}; color: ${isDark ? '#fde68a' : '#92400e'}; font-size: 11px;">
                        No automatic matches were found. Edit the search words below and try again.
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <input id="fasttag-scrape-empty-query" type="text" value="${escapeHtml(initialQuery)}" placeholder="Enter title, studio or performer names" style="flex: 1; min-width: 0; height: 30px; box-sizing: border-box; padding: 4px 8px; border-radius: 6px; border: 1px solid ${isDark ? 'rgba(129,140,248,0.55)' : '#a5b4fc'}; background: ${isDark ? '#0f172a' : '#ffffff'}; color: ${isDark ? '#e2e8f0' : '#1e293b'}; font-size: 11px; outline: none;">
                        <button id="fasttag-scrape-empty-search" type="button" style="height: 30px; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(129,140,248,0.6); background: rgba(99,102,241,0.22); color: ${isDark ? '#c7d2fe' : '#4338ca'}; font-size: 10.5px; font-weight: 700; cursor: pointer;">Search</button>
                    </div>
                </div>
            `;

            const closeEmpty = () => {
                window._fastTagEverythingScraperOpen = false;
                setScraperHudPersistedOpen(false);
                closeFloatingScraperHud();
                if (container) {
                    container.innerHTML = '';
                    container.style.display = 'none';
                }
                if (popup?.scrapeBtn) {
                    popup.scrapeBtn.disabled = false;
                    popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                    popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                }
                if (typeof onDismiss === 'function') onDismiss();
            };
            const runEmptySearch = async () => {
                const input = targetContainer.querySelector('#fasttag-scrape-empty-query');
                const button = targetContainer.querySelector('#fasttag-scrape-empty-search');
                const query = (input?.value || '').trim();
                if (!query) {
                    toastError('Enter the words you want to search for.');
                    input?.focus();
                    return;
                }
                button.disabled = true;
                button.textContent = 'Searching…';
                try {
                    const manualResults = await fetchScraperMatchesForScene(sceneId, null, query);
                    if (!manualResults?.length) {
                        toastError(`No scraper matches found for “${query}”`);
                        button.disabled = false;
                        button.textContent = 'Search';
                        input?.focus();
                        return;
                    }
                    sessionScrapeCache.set(sceneId, manualResults);
                    await renderScraperMatchCard(container, manualResults, sceneId, ctx, popup, onDismiss);
                } catch (error) {
                    button.disabled = false;
                    button.textContent = 'Search';
                    toastError('Scrape search failed: ' + (error?.message || error));
                }
            };

            targetContainer.querySelector('#fasttag-scrape-empty-close')?.addEventListener('click', closeEmpty);
            const emptySearchInput = targetContainer.querySelector('#fasttag-scrape-empty-query');
            emptySearchInput?.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                event.stopPropagation();
                runEmptySearch();
            });
            targetContainer.querySelector('#fasttag-scrape-empty-search')?.addEventListener('click', runEmptySearch);
            if (popup?.scrapeBtn) {
                popup.scrapeBtn.disabled = false;
                popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>▲ Hide 🍫</span>' : '<span>▲ Hide</span>';
                if (isDetached) popup.scrapeBtn.classList.add('fasttag-dock-pulse');
            }
            if (isDetached && floatingScraperHudElement) attachScraperHudResizeHandles(floatingScraperHudElement);
            setTimeout(() => emptySearchInput?.focus({ preventScroll: true }), 0);
            return;
        }

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

            const remoteResultUrl = getScraperResultUrl(match);

            // Calculate match likelihood & fingerprint verification (mirroring Stash's native scraper)
            const {
                isHashMatch,
                matchBadges,
                localDurSec,
                scrapedDurSec,
                totalFps,
                matchingDurFps
            } = analyzeScraperMatch(match);

            const performerPresentation = getPerformerPresentation(match);
            let performerMatchBadge = '';
            if (performerPresentation) {
                const overlapNames = performerPresentation.overlapNames;
                if (overlapNames.length > 0) {
                    performerMatchBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Matches performer already linked to this scene: ${escapeHtml(overlapNames.join(', '))}">
                            <span>★</span><span>Performer Match (${performerPresentation.overlapCount}/${performerPresentation.linkedCount})</span>
                        </span>
                    `;
                } else {
                    performerMatchBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="None of this result's performers match the ${performerPresentation.linkedCount} performer(s) already linked to your scene. Check the result carefully before accepting it.">
                            <span>⚠</span><span>No Linked Performer Match</span>
                        </span>
                    `;
                }
            }

            const assessment = getAssessmentPresentation(match);
            const assessmentBadge = assessment ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 700; color: ${assessment.color}; background: ${assessment.background}; border: 1px solid ${assessment.border}; padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="${escapeHtml(assessment.tooltip)}">
                    <span>${assessment.icon}</span><span>${assessment.label}</span>
                </span>
            ` : '';

            const sourcePresentation = getSourcePresentation(match, isHashMatch);
            const sourceTone = sourcePresentation?.tone === 'success'
                ? { color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', icon: '✓' }
                : sourcePresentation?.tone === 'warning'
                    ? { color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', icon: '⌕' }
                    : { color: isDark ? '#cbd5e1' : '#475569', background: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', icon: '↗' };
            const sourceBadge = sourcePresentation ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: ${sourceTone.color}; background: ${sourceTone.background}; border: 1px solid ${sourceTone.border}; padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="${escapeHtml(sourcePresentation.tooltip)}">
                    <span>${sourceTone.icon}</span><span>${escapeHtml(sourcePresentation.label)}</span>
                </span>
            ` : '';

            const unavailableContext = getUnavailableContextPresentation(match);
            const unavailableContextBadge = unavailableContext ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 500; color: ${isDark ? '#94a3b8' : '#64748b'}; background: rgba(148, 163, 184, 0.1); border: 1px dashed rgba(148, 163, 184, 0.4); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="${escapeHtml(unavailableContext.tooltip)}">
                    <span>ⓘ</span><span>${escapeHtml(unavailableContext.label)}</span>
                </span>
            ` : '';

            const studioMismatchBadge = match._studioComparison === 'mismatch' ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="The scraped studio (${escapeHtml(studioName)}) differs from the studio already linked to this scene.">
                    <span>⚠</span><span>Studio Mismatch</span>
                </span>
            ` : '';
            const additionalPerformerBadge = performerPresentation?.additionalCount > 0 ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="The scraped result contains additional performer(s) not currently linked to this scene: ${escapeHtml(performerPresentation.additionalNames.join(', '))}">
                    <span>＋</span><span>${performerPresentation.additionalCount} Additional Performer${performerPresentation.additionalCount === 1 ? '' : 's'}</span>
                </span>
            ` : '';
            const acceptPresentation = getAcceptPresentation(match);

            let durationBadge = '';
            if (scrapedDurSec && localDurSec) {
                const diff = Math.abs(scrapedDurSec - localDurSec);
                if (diff <= 3) {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Duration matches within 3 seconds (${formatDurationSec(scrapedDurSec)})">
                            <span>⏱</span><span>${formatDurationSec(scrapedDurSec)} (Exact Match)</span>
                        </span>
                    `;
                } else if (diff <= 60) {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 500; color: ${isDark ? '#cbd5e1' : '#475569'}; background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.25); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Scraped duration is ${formatDurationSec(scrapedDurSec)}, local is ${formatDurationSec(localDurSec)}">
                            <span>⏱</span><span>${formatDurationSec(scrapedDurSec)} (Local: ${formatDurationSec(localDurSec)})</span>
                        </span>
                    `;
                } else {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Scraped duration is ${formatDurationSec(scrapedDurSec)}, local is ${formatDurationSec(localDurSec)}; the difference is ${formatDurationSec(diff)}.">
                            <span>⚠</span><span>Duration Mismatch (${formatDurationSec(diff)})</span>
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
                    <div id="fasttag-scrape-header" style="display: flex; align-items: center; justify-content: space-between; gap: 6px; user-select: none; white-space: nowrap; overflow: visible; min-height: 26px; padding: 1px 0;">
                        <div style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: ${isDark ? '#e0e7ff' : '#312e81'}; min-width: 0; flex: 1; overflow: visible;">
                            <span style="font-size: 13px; line-height: 1; flex-shrink: 0;">⚡</span>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex-shrink: 1;">${escapeHtml(match._sourceName || 'StashDB')} Match</span>
                            ${results.length > 1 ? `
                                <div class="fasttag-match-counter-pulse" style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: ${isDark ? '#e0e7ff' : '#312e81'}; background: ${isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)'}; border: 1px solid ${isDark ? 'rgba(129, 140, 248, 0.75)' : '#818cf8'}; padding: 2px 6px; border-radius: 5px; margin-left: 2px; user-select: none; flex-shrink: 0; white-space: nowrap; line-height: 1;">
                                    <button type="button" id="fasttag-scrape-prev" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(148,163,184,0.4); border-radius: 3px; cursor: pointer; color: inherit; padding: 1px 5px; font-size: 9.5px; line-height: 1; transition: all 0.15s ease;" ${currentIndex === 0 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} title="Previous match (Left Arrow)">◀</button>
                                    <span style="letter-spacing: 0.2px; font-size: 11px; font-weight: 700; white-space: nowrap;">${currentIndex + 1}/${results.length}</span>
                                    <button type="button" id="fasttag-scrape-next" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(148,163,184,0.4); border-radius: 3px; cursor: pointer; color: inherit; padding: 1px 5px; font-size: 9.5px; line-height: 1; transition: all 0.15s ease;" ${currentIndex === results.length - 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} title="Next match (Right Arrow)">▶</button>
                                </div>
                            ` : ''}
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0; white-space: nowrap;">
                            ${remoteResultUrl ? `
                                <a href="${remoteResultUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 600; color: #818cf8; text-decoration: none; padding: 2.5px 6px; border-radius: 4px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); transition: background 0.15s ease; white-space: nowrap; line-height: 1;" title="Open in ${escapeHtml(match._sourceName || 'source')} in new tab">
                                    <span>🔗</span><span>↗</span>
                                </a>
                            ` : ''}
                            <button type="button" id="fasttag-scrape-dismiss-match" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 4px; padding: 2.5px 6px; font-size: 10px; font-weight: 700; color: #f87171; cursor: pointer; line-height: 1;" title="Dismiss this result for the current FastTag session">✕</button>
                            <button type="button" id="fasttag-scrape-popout-toggle" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 4px; padding: 2.5px 6px; font-size: 10px; font-weight: 700; color: #818cf8; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 3px; line-height: 1; transition: all 0.15s ease; white-space: nowrap;" data-micro-tooltip="${isDetached ? 'Dock scraper inside popup' : 'Pop out scraper into floating window'}">
                                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; pointer-events: none;">
                                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" fill="none" stroke-width="2"></rect>
                                    <rect x="12" y="11" width="8" height="7" rx="1.5" fill="currentColor" stroke="none"></rect>
                                </svg>
                                <span>${isDetached ? 'Dock' : 'Pop Out'}</span>
                            </button>
                            <button type="button" id="fasttag-scrape-accept-btn" style="background: ${acceptPresentation.background}; border: 1px solid ${acceptPresentation.border}; color: #ffffff; padding: 2.5px 7px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 2px; box-shadow: 0 1px 4px ${acceptPresentation.shadow}; line-height: 1.2; transition: all 0.15s ease; white-space: nowrap; flex-shrink: 0;" title="${acceptPresentation.title}">
                                <span>${acceptPresentation.label}</span>
                            </button>
                        </div>
                    </div>

                    <div id="fasttag-scrape-manual-search-form" style="display: flex; align-items: center; gap: 5px;">
                        <input id="fasttag-scrape-manual-query" type="text" value="${escapeHtml(match._searchQuery || '')}" placeholder="Optional: correct the search words" style="flex: 1; min-width: 0; height: 25px; box-sizing: border-box; padding: 3px 7px; border-radius: 5px; border: 1px solid ${isDark ? 'rgba(129,140,248,0.45)' : '#a5b4fc'}; background: ${isDark ? 'rgba(15,23,42,0.8)' : '#ffffff'}; color: ${isDark ? '#e2e8f0' : '#1e293b'}; font-size: 10.5px; outline: none;">
                        <button id="fasttag-scrape-manual-search-btn" type="button" style="height: 25px; padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(129,140,248,0.55); background: rgba(99,102,241,0.18); color: ${isDark ? '#c7d2fe' : '#4338ca'}; font-size: 10px; font-weight: 700; cursor: pointer; white-space: nowrap;">Search</button>
                    </div>

                    ${filterFalsePositives && hiddenResultCount > 0 ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 6px; border-radius: 5px; background: rgba(245,158,11,0.09); border: 1px solid rgba(245,158,11,0.25); color: ${isDark ? '#fcd34d' : '#92400e'}; font-size: 9.5px; line-height: 1.25;">
                            <span>${hiddenResultCount} obvious false positive${hiddenResultCount === 1 ? '' : 's'} ${showingHiddenResults ? 'shown' : 'hidden'}</span>
                            <button id="fasttag-scrape-toggle-hidden" type="button" style="border: 1px solid rgba(245,158,11,0.45); border-radius: 4px; background: rgba(245,158,11,0.12); color: inherit; padding: 2px 6px; font-size: 9.5px; font-weight: 700; cursor: pointer; white-space: nowrap;">${showingHiddenResults ? 'Hide again' : 'Show hidden'}</button>
                        </div>
                    ` : ''}

                    <div id="fasttag-scrape-body-wrapper" style="display: flex; flex-direction: column; gap: 7px; ${isDetached ? 'flex: 1 1 auto; min-height: 0; overflow: hidden;' : 'height: auto;'} transition: all 0.15s ease;">
                        <!-- Dedicated Verification Badges Row -->
                        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap; padding: 3px 6px; background: ${isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.03)'}; border-radius: 5px; border: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}; flex-shrink: 0;">
                            ${assessmentBadge}
                            ${sourceBadge}
                            ${isHashMatch ? matchBadges.map(b => `
                                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Direct file fingerprint match on StashDB">
                                    <span>✓</span><span>${b}</span>
                                </span>
                            `).join('') : ''}
                            ${unavailableContextBadge}
                            ${performerMatchBadge}
                            ${additionalPerformerBadge}
                            ${studioMismatchBadge}
                            ${durationBadge}
                        </div>

                    <!-- Items Preview Box with Relative Wrapper for Scroll Indicator -->
                    <div style="position: relative; border-radius: 6px; overflow: hidden; ${isDetached ? 'flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;' : 'height: auto;'}">
                        <div id="fasttag-scrape-items-preview" style="display: flex; flex-direction: column; gap: 7px; background: ${isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)'}; padding: 7px 9px 10px 9px; border-radius: 6px; font-size: 11px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; ${isDetached ? 'flex: 1 1 auto; min-height: 80px; max-height: none;' : `height: ${savedEmbeddedH}px; min-height: 50px; max-height: 520px;`} scrollbar-width: thin; scrollbar-color: ${isDark ? 'rgba(129, 140, 248, 0.65) rgba(0,0,0,0.25)' : '#a5b4fc #f1f5f9'}; transition: opacity 0.1s ease;">
                            ${isDetached ? `
                                <!-- Detached Hero Cover Banner (On its own dedicated line) -->
                                ${match.image ? `
                                    <div class="fasttag-scrape-cover-thumb" style="width: 100%; max-height: clamp(160px, 35vh, 320px); aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: #000; border: 1px solid ${isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1'}; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: all 0.15s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.3); flex-shrink: 0;" title="Hover to view full-size cover">
                                        <img src="${match.image}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" />
                                        <label style="position: absolute; left: 7px; bottom: 7px; z-index: 2; display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 4px; background: rgba(15, 23, 42, 0.88); color: #e0e7ff; font-size: 10px; font-weight: 700; cursor: pointer; user-select: none;" title="Include this cover image when accepting the match">
                                            <input type="checkbox" id="fasttag-scrape-chk-cover" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #6366f1; margin: 0;">
                                            <span>🖼️ Cover</span>
                                        </label>
                                    </div>
                                ` : ''}

                                <!-- Title & Studio (Clean stacked rows directly below hero cover) -->
                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                    <!-- Title Row -->
                                    <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                        <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 55px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#e0e7ff' : '#312e81'}; font-size: 11px;" title="Check to update scene title">
                                            <input type="checkbox" id="fasttag-scrape-chk-title" style="cursor: pointer; width: 12px; height: 12px; accent-color: #6366f1; margin: 0; position: relative; top: 1.5px;">
                                            <span style="font-size: 11px;">✏️</span>
                                            <span>Title:</span>
                                        </label>
                                        <span style="display: inline-block; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="${escapeHtml(match.title || '')}">${escapeHtml(match.title || 'Untitled Match')}</span>
                                        ${match.date ? `
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; font-size: 10.5px; color: ${isDark ? '#94a3b8' : '#64748b'}; font-weight: 500; cursor: pointer; user-select: none;" title="Include this date when accepting the match">
                                                <input type="checkbox" id="fasttag-scrape-chk-date" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #0ea5e9; margin: 0; position: relative; top: 1px;">
                                                <span>📅 ${escapeHtml(match.date)}</span>
                                            </label>
                                        ` : ''}
                                    </div>

                                    ${studioName ? `
                                        <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 55px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#a5b4fc' : '#4f46e5'}; font-size: 11px;">
                                                <input type="checkbox" id="fasttag-scrape-chk-studio" checked style="cursor: pointer; width: 12px; height: 12px; accent-color: ${isStudioNew ? '#f59e0b' : '#6366f1'}; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">🏢</span>
                                                <span>Studio:</span>
                                            </label>
                                            ${isStudioNew ? `
                                                <span style="display: inline-flex; align-items: baseline; gap: 4px; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px;" title="Not in your local library — will create new studio upon saving">
                                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(studioName)}</span>
                                                    <span style="font-size: 8.5px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}; padding: 0.5px 3.5px; border-radius: 3px; color: ${isDark ? '#fef08a' : '#78350f'}; flex-shrink: 0;">+ New</span>
                                                </span>
                                            ` : `
                                                <span style="display: inline-block; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="Exists in your local library">${escapeHtml(studioName)}</span>
                                            `}
                                        </div>
                                    ` : ''}
                                </div>
                            ` : `
                                <!-- Docked Mode: Compact Side-by-Side -->
                                <div style="display: flex; gap: 9px; align-items: stretch;">
                                    ${match.image ? `
                                        <div class="fasttag-scrape-cover-thumb" style="flex-shrink: 0; width: 116px; height: 74px; border-radius: 6px; overflow: hidden; background: #000; border: 1px solid ${isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1'}; display: flex; align-items: center; justify-content: center; align-self: flex-start; cursor: pointer; position: relative; transition: all 0.15s ease;" title="Hover to view full-size cover">
                                            <img src="${match.image}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" />
                                            <label style="position: absolute; left: 4px; bottom: 4px; z-index: 2; display: inline-flex; align-items: center; gap: 3px; padding: 2px 5px; border-radius: 3px; background: rgba(15, 23, 42, 0.88); color: #e0e7ff; font-size: 9px; font-weight: 700; cursor: pointer; user-select: none;" title="Include this cover image when accepting the match">
                                                <input type="checkbox" id="fasttag-scrape-chk-cover" checked style="cursor: pointer; width: 10px; height: 10px; accent-color: #6366f1; margin: 0;">
                                                <span>Cover</span>
                                            </label>
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
                                            <span style="display: inline-block; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="${escapeHtml(match.title || '')}">${escapeHtml(match.title || 'Untitled Match')}</span>
                                            ${match.date ? `
                                                <label style="display: inline-flex; align-items: baseline; gap: 4px; font-size: 10.5px; color: ${isDark ? '#94a3b8' : '#64748b'}; font-weight: 500; cursor: pointer; user-select: none;" title="Include this date when accepting the match">
                                                    <input type="checkbox" id="fasttag-scrape-chk-date" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #0ea5e9; margin: 0; position: relative; top: 1px;">
                                                    <span>📅 ${escapeHtml(match.date)}</span>
                                                </label>
                                            ` : ''}
                                        </div>

                                        ${studioName ? `
                                            <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                                <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 60px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#a5b4fc' : '#4f46e5'}; font-size: 11px;">
                                                    <input type="checkbox" id="fasttag-scrape-chk-studio" checked style="cursor: pointer; width: 12px; height: 12px; accent-color: ${isStudioNew ? '#f59e0b' : '#6366f1'}; margin: 0; position: relative; top: 1.5px;">
                                                    <span style="font-size: 11px;">🏢</span>
                                                    <span>Studio:</span>
                                                </label>
                                                ${isStudioNew ? `
                                                    <span style="display: inline-flex; align-items: baseline; gap: 4px; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px;" title="Not in your local library — will create new studio upon saving">
                                                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(studioName)}</span>
                                                        <span style="font-size: 8.5px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}; padding: 0.5px 3.5px; border-radius: 3px; color: ${isDark ? '#fef08a' : '#78350f'}; flex-shrink: 0;">+ New</span>
                                                    </span>
                                                ` : `
                                                    <span style="display: inline-block; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="Exists in your local library">${escapeHtml(studioName)}</span>
                                                `}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `}

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
                                                    <label style="display: inline-flex; align-items: baseline; gap: 4px; background: ${isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe'}; color: ${isDark ? '#bae6fd' : '#0369a1'}; border: 1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : '#7dd3fc'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; user-select: none;" title="Exists in your local library">
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

            const runManualSearch = async () => {
                const input = targetContainer.querySelector('#fasttag-scrape-manual-query');
                const searchBtn = targetContainer.querySelector('#fasttag-scrape-manual-search-btn');
                const query = (input?.value || '').trim();
                if (!query) {
                    toastError('Enter the words you want to search for.');
                    input?.focus();
                    return;
                }
                if (searchBtn) {
                    searchBtn.disabled = true;
                    searchBtn.textContent = 'Searching…';
                }
                try {
                    const manualResults = await fetchScraperMatchesForScene(sceneId, null, query);
                    if (!manualResults?.length) {
                        toastError(`No scraper matches found for “${query}”`);
                        if (searchBtn) {
                            searchBtn.disabled = false;
                            searchBtn.textContent = 'Search';
                        }
                        return;
                    }
                    sessionScrapeCache.set(sceneId, manualResults);
                    hideScrapeCoverTooltip();
                    await renderScraperMatchCard(container, manualResults, sceneId, ctx, popup, onDismiss);
                } catch (error) {
                    toastError('Scrape search failed: ' + (error?.message || error));
                    if (searchBtn) {
                        searchBtn.disabled = false;
                        searchBtn.textContent = 'Search';
                    }
                }
            };

            const manualSearchBtn = targetContainer.querySelector('#fasttag-scrape-manual-search-btn');
            if (manualSearchBtn) manualSearchBtn.onclick = runManualSearch;
            const manualSearchInput = targetContainer.querySelector('#fasttag-scrape-manual-query');
            if (manualSearchInput) {
                manualSearchInput.onkeydown = (event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    event.stopPropagation();
                    runManualSearch();
                };
            }

            const toggleHiddenBtn = targetContainer.querySelector('#fasttag-scrape-toggle-hidden');
            if (toggleHiddenBtn) {
                toggleHiddenBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    allResults._fastTagShowHidden = !showingHiddenResults;
                    hideScrapeCoverTooltip();
                    renderScraperMatchCard(container, allResults, sceneId, ctx, popup, onDismiss);
                };
            }

            const dismissMatchBtn = targetContainer.querySelector('#fasttag-scrape-dismiss-match');
            if (dismissMatchBtn) {
                dismissMatchBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    hideScrapeCoverTooltip();
                    const selectedMatch = results[currentIndex];
                    const sourceIndex = allResults.indexOf(selectedMatch);
                    if (sourceIndex >= 0) allResults.splice(sourceIndex, 1);
                    if (allResults.length === 0) {
                        sessionScrapeCache.delete(sceneId);
                        renderScraperMatchCard(container, allResults, sceneId, ctx, popup, onDismiss);
                        if (typeof onDismiss === 'function') onDismiss();
                        return;
                    }
                    sessionScrapeCache.set(sceneId, allResults);
                    renderScraperMatchCard(container, allResults, sceneId, ctx, popup, onDismiss);
                };
            }

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
                    renderScraperMatchCard(popup?.scraperCardContainer || container, allResults, sceneId, ctx, popup, onDismiss);
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
                        try {
                            localStorage.setItem('fasttag_scraper_hud_pos', JSON.stringify(floatingScraperHudPosition));
                        } catch (e) {}
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

            if (isDetached && floatingScraperHudElement) {
                attachScraperHudResizeHandles(floatingScraperHudElement);
            }
        };

        updateCardView();
    }

    async function handleAcceptScrapeMatch(match, container, sceneId, ctx, popup) {
        try {
            ftLog('ACTION', 'SCRAPE', `Accept match clicked for scene ${sceneId}: "${match.title || ''}"`, {
                sceneId,
                title: match.title,
                studio: match.studio?.name,
                performersCount: match.performers?.length,
                tagsCount: match.tags?.length,
                date: match.date
            });

            const scrapeSelection = readScrapeFieldSelection(container);

            // 1–3. Resolve studio, performers and tags against stored IDs and the local library.
            const studioResolution = await resolveScrapedStudioResult(match.studio, scrapeSelection.studio);
            const performerResolution = await resolveScrapedEntityIdsResult('performers', match.performers, scrapeSelection.performerIndices);
            const tagResolution = await resolveScrapedEntityIdsResult('tags', match.tags, scrapeSelection.tagIndices);
            const studioIdToSet = studioResolution.id;
            const performerIdsToAdd = performerResolution.ids;
            const tagIdsToAdd = tagResolution.ids;
            const resolutionFailures = [
                ...studioResolution.failures.map(name => `studio “${name}”`),
                ...performerResolution.failures.map(name => `performer “${name}”`),
                ...tagResolution.failures.map(name => `tag “${name}”`)
            ];
            const scraperSourceName = String(match?._sourceName || 'scraper source');
            const scraperIdLabel = `${scraperSourceName} ID`;

            // 4. Update Scene & Synchronize Context
            const effectiveCtx = ctx || popup?._context || activePopup?._context;
            const isEverythingModal = popup?.element?.getAttribute('data-popup-type') === 'everything' || popup?.element?.getAttribute('data-popup-type') === 'bulk-everything' || activePopup?.type === 'everything' || Boolean(effectiveCtx);

            if (isEverythingModal && effectiveCtx) {
                // Save scraper fields DIRECTLY. Do not route Accept through the general doSave()
                // mutation because that also includes unrelated fields (for example groups) and can
                // cause the whole GraphQL mutation to fail on Stash versions with a different schema.
                // Cover image is deliberately saved in a SECOND mutation so an image-specific error
                // cannot prevent title/studio/performers/date/details/tags from being saved.

                const sceneRes = await fetchGQL(`
                    query FastTagAcceptCurrentScene($id: ID!) {
                        findScene(id: $id) {
                            id
                            performers { id }
                            tags { id }
                            studio { id }
                            stash_ids { endpoint stash_id }
                        }
                    }
                `, { id: sceneId });

                if (sceneRes?.errors?.length) {
                    throw new Error(sceneRes.errors.map(e => e.message).join('; '));
                }

                const existingPerformerIds = (sceneRes?.data?.findScene?.performers || []).map(p => String(p.id));
                const existingTagIds = (sceneRes?.data?.findScene?.tags || []).map(t => String(t.id));
                let stashIdResolution = { stashIds: sceneRes?.data?.findScene?.stash_ids || [], added: false, reason: null };
                try {
                    const configRes = await fetchGQL(`query FastTagStashBoxes { configuration { general { stashBoxes { endpoint name } } } }`);
                    stashIdResolution = buildAcceptedSceneStashIds(
                        sceneRes?.data?.findScene?.stash_ids,
                        match,
                        configRes?.data?.configuration?.general?.stashBoxes
                    );
                } catch (error) {
                    if (match?.remote_site_id || match?.urls?.some?.(url => /^https?:\/\//i.test(url))) {
                        stashIdResolution.reason = 'the configured scraper endpoint could not be loaded';
                    }
                }
                if (stashIdResolution.reason) resolutionFailures.push(`${scraperIdLabel} (${stashIdResolution.reason})`);
                const { updateInput, mergedPerformerIds, mergedTagIds } = buildScrapeUpdateInput({
                    sceneId,
                    match,
                    selection: scrapeSelection,
                    studioIdToSet,
                    performerIdsToAdd,
                    tagIdsToAdd,
                    existingPerformerIds,
                    existingTagIds
                });

                const saveRes = await fetchGQL(`
                    mutation FastTagAcceptSave($input: SceneUpdateInput!) {
                        sceneUpdate(input: $input) {
                            ${SCENE_CARD_UPDATE_FIELDS}
                            title
                            date
                        }
                    }
                `, { input: updateInput });

                if (saveRes?.errors?.length || !saveRes?.data?.sceneUpdate?.id) {
                    const msg = saveRes?.errors?.map(e => e.message).join('; ') || 'Stash did not return a saved scene.';
                    throw new Error(msg);
                }

                syncSceneToApolloCache(saveRes.data.sceneUpdate);
                if (scrapeSelection.title && match.title) {
                    setLiveEverythingPopupTitle(popup, match.title);
                }

                // Save and verify the StashDB ID independently. Keeping this separate from the
                // metadata mutation makes any endpoint/ID problem visible without rolling back
                // title, studio, performer, tag, date or details changes that already succeeded.
                if (stashIdResolution.added) {
                    const expectedStashId = stashIdResolution.stashIds[stashIdResolution.stashIds.length - 1];
                    const stashIdSaveRes = await fetchGQL(`
                        mutation FastTagAcceptStashId($input: SceneUpdateInput!) {
                            sceneUpdate(input: $input) {
                                id
                                stash_ids { endpoint stash_id }
                            }
                        }
                    `, { input: { id: sceneId, stash_ids: stashIdResolution.stashIds } });
                    const returnedStashIds = stashIdSaveRes?.data?.sceneUpdate?.stash_ids || [];
                    const expectedEndpoint = String(expectedStashId.endpoint).replace(/\/+$/, '').toLowerCase();
                    const idWasSaved = returnedStashIds.some(item =>
                        String(item?.endpoint || '').replace(/\/+$/, '').toLowerCase() === expectedEndpoint
                        && String(item?.stash_id || '') === String(expectedStashId.stash_id)
                    );
                    if (stashIdSaveRes?.errors?.length || !idWasSaved) {
                        const reason = stashIdSaveRes?.errors?.map(error => error.message).join('; ')
                            || 'Stash did not return the accepted ID after saving';
                        resolutionFailures.push(`${scraperIdLabel} (${reason})`);
                    }
                }

                // Save cover separately. If Stash rejects the image value, all other metadata is
                // already safely committed and the user gets a warning rather than losing everything.
                let coverSaved = true;
                if (scrapeSelection.cover && match.image) {
                    const coverRes = await fetchGQL(`
                        mutation FastTagAcceptCover($input: SceneUpdateInput!) {
                            sceneUpdate(input: $input) { id }
                        }
                    `, { input: { id: sceneId, cover_image: match.image } });
                    if (coverRes?.errors?.length || !coverRes?.data?.sceneUpdate?.id) {
                        coverSaved = false;
                        console.warn('[FastTag] Cover image save failed:', coverRes?.errors || coverRes);
                    }
                }

                // Keep the Edit Everything popup state in sync with what was actually saved.
                if (typeof effectiveCtx.setSelectedStudio === 'function' && studioIdToSet) {
                    effectiveCtx.setSelectedStudio(studioIdToSet);
                }
                if (typeof effectiveCtx.setSelectedPerformers === 'function') {
                    effectiveCtx.setSelectedPerformers(new Set(mergedPerformerIds));
                }
                if (typeof effectiveCtx.setSelectedTags === 'function') {
                    effectiveCtx.setSelectedTags(new Set(mergedTagIds));
                }
                if (typeof effectiveCtx.setInitialStudio === 'function' && studioIdToSet) {
                    effectiveCtx.setInitialStudio(studioIdToSet);
                }
                if (typeof effectiveCtx.setInitialPerformers === 'function') {
                    effectiveCtx.setInitialPerformers(new Set(mergedPerformerIds));
                }
                if (typeof effectiveCtx.setInitialTags === 'function') {
                    effectiveCtx.setInitialTags(new Set(mergedTagIds));
                }

                if (typeof effectiveCtx.fetchColumnData === 'function' && popup) {
                    if (popup.tagsTable) await effectiveCtx.fetchColumnData('tags', popup.tagsTable, '', new Set(mergedTagIds));
                    if (popup.performersTable) await effectiveCtx.fetchColumnData('performers', popup.performersTable, '', new Set(mergedPerformerIds));
                }
                if (typeof effectiveCtx.renderStudioBar === 'function') await effectiveCtx.renderStudioBar('');
                if (typeof effectiveCtx.refreshAllUI === 'function') effectiveCtx.refreshAllUI();

                await refreshSceneCards(sceneId);
                recordSaveUsage();
                sessionScrapeCache.delete(sceneId);

                window._fastTagEverythingScraperOpen = true;
                const acceptBtn = container ? container.querySelector('#fasttag-scrape-accept-btn') : null;
                if (acceptBtn) {
                    acceptBtn.innerHTML = resolutionFailures.length > 0
                        ? '<span>⚠ Saved with warnings</span>'
                        : (coverSaved ? '<span>✓ Saved</span>' : '<span>✓ Saved (cover failed)</span>');
                    acceptBtn.disabled = true;
                    acceptBtn.style.opacity = '0.7';
                    acceptBtn.style.cursor = 'default';
                    acceptBtn.style.background = '#059669';
                }

                if (resolutionFailures.length > 0) {
                    const coverNote = coverSaved ? '' : ' The cover also failed to save.';
                    toastError(`Metadata saved, but FastTag could not apply: ${resolutionFailures.join(', ')}.${coverNote}`);
                } else if (coverSaved) {
                    toastSuccess(`Matched & Saved from ${scraperSourceName}!`);
                } else {
                    toastError('Metadata saved, but Stash rejected the cover image.');
                }
                return;
            } else {
                throw new Error('Scraping is only supported from Edit Everything.');
            }
        } catch (err) {
            console.error('[FastTag] Error accepting scrape match:', err);
            toastError('Failed to apply match: ' + (err?.message || err));
        }
    }

    // --- Smart Suggestions Engine ---
    async function fetchSceneSmartSuggestions(type, sceneId, allAvailableItems, existingIds, cardElement) {
        if (!getEnableSuggestions() || !sceneId || !allAvailableItems || !allAvailableItems.length) return [];
        try {
            let title = '';
            let details = '';
            let fileName = '';

            try {
                const query = `query ($id: ID!) { findScene(id: $id) { title details files { path } } }`;
                const res = await fetchGQL(query, { id: sceneId });
                const scene = res?.data?.findScene;
                if (scene) {
                    if (scene.title) title = scene.title;
                    if (scene.details) details = scene.details;
                    if (scene.files && scene.files.length > 0 && scene.files[0]?.path) {
                        const filePath = scene.files[0].path;
                        const parts = filePath.split(/[/\\]/);
                        const lastPart = parts.length > 0 ? parts[parts.length - 1] : filePath;
                        fileName = cleanFilenameForSuggestions(lastPart);
                    }
                }
            } catch (e) {}

            return rankSuggestionItems(
                allAvailableItems,
                `${title} ${fileName}`.trim(),
                details,
                existingIds,
                20
            );
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
        const maxScreenH = Math.max(480, window.innerHeight - 16);
        const optimal = getOptimalPopupSize('single');
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

        document.body.appendChild(form);
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

        const popupType = form.getAttribute('data-popup-type') || activePopup?.type;
        const isEverythingModal = popupType === 'everything' || popupType === 'bulk-everything';

        // For Edit Everything / Bulk Edit Everything: Center in viewport by default or use saved drag position
        if (isEverythingModal) {
            let savedPos = null;
            try {
                savedPos = JSON.parse(localStorage.getItem('fasttag_everything_pos') || 'null');
            } catch (e) {}

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
                const defPos = getDefaultEverythingPosition(formW, formH);
                posX = defPos.x;
                posY = defPos.y;
            }

            form.style.left = `${posX}px`;
            form.style.top = `${posY}px`;

            if (sequentialEditState.enabled) {
                sequentialEditState.popupPosition = { left: posX, top: posY };
            }

            requestAnimationFrame(() => {
                const actualFormRect = form.getBoundingClientRect();
                const pos = clampPos(actualFormRect.left, actualFormRect.top);
                form.style.left = `${pos.x}px`;
                form.style.top = `${pos.y}px`;

                form.classList.add('popup-visible');

                if (typeof form._fastTagOnResize === 'function') {
                    form._fastTagOnResize();
                }

                const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
                if (firstInput) {
                    firstInput.focus({ preventScroll: true });
                }
            });
            return;
        }

        if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0) {
            const pos = clampPos(sequentialEditState.popupPosition.left, sequentialEditState.popupPosition.top);
            form.style.left = `${pos.x}px`;
            form.style.top = `${pos.y}px`;

            requestAnimationFrame(() => form.classList.add('popup-visible'));
            const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
            return;
        }

        // For single-column modals: Check saved position from dragging first, otherwise anchor near card
        let savedSinglePos = null;
        try {
            savedSinglePos = JSON.parse(localStorage.getItem('fasttag_single_pos') || 'null');
        } catch (e) {}

        if (savedSinglePos && savedSinglePos.left && savedSinglePos.top) {
            const parsedX = parseInt(savedSinglePos.left, 10);
            const parsedY = parseInt(savedSinglePos.top, 10);
            if (!isNaN(parsedX) && !isNaN(parsedY)) {
                const pos = clampPos(parsedX, parsedY);
                form.style.left = `${pos.x}px`;
                form.style.top = `${pos.y}px`;
                if (sequentialEditState.enabled) {
                    sequentialEditState.popupPosition = { left: pos.x, top: pos.y };
                }
                requestAnimationFrame(() => {
                    const actualFormRect = form.getBoundingClientRect();
                    const p = clampPos(actualFormRect.left, actualFormRect.top);
                    form.style.left = `${p.x}px`;
                    form.style.top = `${p.y}px`;
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
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }, { signal });

        setTimeout(() => {
            document.addEventListener('mousedown', (e) => {
                if (e.target && (
                    form.contains(e.target) ||
                    e.target.closest('#fasttag-sort-dropdown-menu') ||
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

        document.body.classList.add('fasttag-modal-open');

        // Global Wheel Trap for FastTag Modal:
        // Completely locks background Stash page from scrolling, while allowing popup & sidecar scroll containers to scroll
        window.addEventListener('wheel', (e) => {
            const popup = document.querySelector('#scenes-popup');
            if (!popup || popup.style.display === 'none') return;

            const scraperHud = document.querySelector('#fasttag-floating-scraper-hud');
            const videoHud = document.querySelector('#fasttag-floating-video-hud');
            const settingsModal = document.querySelector('#fasttag-settings-modal');
            const isInsideAllowed = (el) => Boolean(
                (popup && popup.contains(el)) ||
                (scraperHud && scraperHud.contains(el)) ||
                (videoHud && videoHud.contains(el)) ||
                (settingsModal && settingsModal.contains(el))
            );

            // 1. Allow video player & preview containers to handle mouse wheel freely for frame scrubbing
            if (e.target.closest('[id$="-preview-container"], .fasttag-video-preview, video, #fasttag-floating-video-hud, #fasttag-video-container, #fasttag-video-element')) {
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

            const scrollable = e.target.closest('.tabulator-tableholder, #fasttag-scrape-items-preview, [id$="-quick-actions"], [id*="-chips"], .fasttag-chip-row, textarea');
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
                if (typeof window._fastTagActiveToggleVideoMode === 'function') {
                    window._fastTagActiveToggleVideoMode();
                }
                return;
            }

            e.stopPropagation();
            const isTyping = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';
            if (!isTyping && (e.key === ' ' || e.key === 'Spacebar' || e.key === 'j' || e.key === 'k' || e.key === 'l' || e.key === 'n' || e.key === 'p')) {
                e.preventDefault();
            }
        }, { signal });

        document.addEventListener('keydown', (e) => {
            if (!document.body.contains(form)) return;

            // Handle Escape key: 2-stage (Stage 1: clear search if text present; Stage 2: close popup)
            if (e.key === 'Escape') {
                const subModal = document.querySelector('#fasttag-settings-modal, #fasttag-create-modal, .fasttag-create-dialog-overlay, .fasttag-bulk-confirm-overlay');
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
                        searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    searchBox.focus({ preventScroll: true });
                    return;
                }

                e.preventDefault();
                e.stopPropagation();
                closePopup();
                return;
            }

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
                if (typeof window._fastTagActiveToggleVideoMode === 'function') {
                    e.preventDefault();
                    e.stopPropagation();
                    window._fastTagActiveToggleVideoMode();
                    return;
                }
            }

            // Alt+Left / Alt+Right for Sequential
            if ((sequentialEditState.enabled || activePopup?._isRandomMode) && e.altKey) {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    e.stopPropagation();
                    const nextBtn = form.querySelector('button[id$="-next-btn"]');
                    if (nextBtn && !nextBtn.disabled) nextBtn.click();
                    return;
                } else if (e.key === 'ArrowLeft') {
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

        document.addEventListener('keydown', (e) => {
            if (e.defaultPrevented) return;
            if (e.key === 'Enter') {
                const isSearchFocused = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

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
                    const popupType = form.getAttribute('data-popup-type') || activePopup?.type;
                    if (popupType === 'everything' || popupType === 'bulk-everything') {
                        try {
                            localStorage.setItem('fasttag_everything_pos', JSON.stringify({
                                left: form.style.left,
                                top: form.style.top
                            }));
                        } catch (e) {}
                    } else {
                        try {
                            localStorage.setItem('fasttag_single_pos', JSON.stringify({
                                left: form.style.left,
                                top: form.style.top
                            }));
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
        document.addEventListener('keydown', (e) => {
            const isInputFocused = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

            const isSubModalOpen = document.querySelector('#fasttag-settings-modal, #fasttag-create-modal');
            if (isSubModalOpen && isSubModalOpen.style.display !== 'none') return;

            if (!isInputFocused) {
                if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    const searchBox = form.querySelector('#everything-global-search, #scenes-popup-global-filter, #scenes-popup-filter, input[type="text"], input[type="search"]');
                    if (searchBox && document.body.contains(searchBox)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        searchBox.focus({ preventScroll: true });
                        searchBox.value += e.key;
                        const len = searchBox.value.length;
                        try { searchBox.setSelectionRange(len, len); } catch (err) {}
                        searchBox.dispatchEvent(new Event('input', { bubbles: true }));
                        return;
                    }
                } else if (e.key === 'Backspace') {
                    const searchBox = form.querySelector('#everything-global-search, #scenes-popup-global-filter, #scenes-popup-filter, input[type="text"], input[type="search"]');
                    if (searchBox && document.body.contains(searchBox)) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        searchBox.focus({ preventScroll: true });
                        if (searchBox.value.length > 0) {
                            searchBox.value = searchBox.value.slice(0, -1);
                            const len = searchBox.value.length;
                            try { searchBox.setSelectionRange(len, len); } catch (err) {}
                            searchBox.dispatchEvent(new Event('input', { bubbles: true }));
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
        if (activePopup.scrapeBtn) activePopup.scrapeBtn.style.display = 'none';
        if (activePopup.scraperCardContainer) activePopup.scraperCardContainer.style.display = 'none';

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
            columns: getColumnsWithSavedWidths(type, 'bulk', () => {
                if (activePopup?._fastTagFetchData) {
                    activePopup._fastTagFetchData(filterInput.value, false);
                }
            }),
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
            const val = filterInput.value.trim();
            const hasVal = val.length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            if (kbdShortcut) kbdShortcut.style.display = hasVal ? 'none' : 'block';

            if (hasVal && activePopup.bottomCreateContainer && createBtn) {
                const currentData = activeTableInstance && typeof activeTableInstance.getData === 'function' ? activeTableInstance.getData() : [];
                const hasExactMatch = currentData.some(item => (item[config.labelKey] || '').toLowerCase() === val.toLowerCase());
                if (!hasExactMatch) {
                    createBtn.textContent = `+ Create ${config.title} "${val}"`;
                    activePopup.bottomCreateContainer.style.display = 'flex';
                } else {
                    activePopup.bottomCreateContainer.style.display = 'none';
                }
            } else if (activePopup.bottomCreateContainer) {
                activePopup.bottomCreateContainer.style.display = 'none';
            }
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

        let debounceTimer = null;
        let currentSingleSection = 'table'; // 'table' | 'recent' | 'suggestions' | 'create'
        let singleNavIndex = -1;

        const getSingleSuggestions = () => {
            const container = form.querySelector(`#${type}-suggestions-container`);
            if (!container || container.style.display === 'none' || container.offsetParent === null) return [];
            return Array.from(container.querySelectorAll('button'));
        };

        const getSingleRecentChips = () => {
            const container = form.querySelector(`#${type}-quick-actions`);
            if (!container || container.style.display === 'none' || container.offsetParent === null) return [];
            return Array.from(container.querySelectorAll('.fasttag-quick-chip'));
        };

        const scrollSingleRowIntoViewIfNeeded = (row) => {
            if (!activeTableInstance || !row) return;
            const el = typeof row.getElement === 'function' ? row.getElement() : null;
            const holder = activeTableInstance.element?.querySelector('.tabulator-tableholder');
            if (holder && el) {
                const holderRect = holder.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                if (elRect.bottom > holderRect.bottom) {
                    holder.scrollTop += (elRect.bottom - holderRect.bottom + 4);
                } else if (elRect.top < holderRect.top) {
                    holder.scrollTop -= (holderRect.top - elRect.top + 4);
                }
            } else if (typeof row.scrollTo === 'function') {
                row.scrollTo('nearest', false);
            }
        };

        const updateSingleKeyboardHighlight = () => {
            if (!activeTableInstance || typeof activeTableInstance.getRows !== 'function') return;
            const rows = activeTableInstance.getRows();
            const isBottomCreateVisible = activePopup.bottomCreateContainer && activePopup.bottomCreateContainer.style.display !== 'none';

            rows.forEach(r => {
                const el = r.getElement();
                if (el) el.classList.remove('fasttag-keyboard-active');
            });
            form.querySelectorAll('.fasttag-keyboard-meta-focus').forEach(el => el.classList.remove('fasttag-keyboard-meta-focus'));

            if (createBtn) {
                createBtn.classList.remove('fasttag-create-btn-active');
                createBtn.style.boxShadow = '0 2px 5px rgba(5,150,105,0.3)';
                createBtn.style.transform = 'none';
                createBtn.style.filter = 'none';
            }

            if (currentSingleSection === 'suggestions') {
                const suggBtns = getSingleSuggestions();
                if (suggBtns.length > 0) {
                    if (singleNavIndex < 0) singleNavIndex = 0;
                    if (singleNavIndex >= suggBtns.length) singleNavIndex = suggBtns.length - 1;
                    const btn = suggBtns[singleNavIndex];
                    if (btn) {
                        btn.classList.add('fasttag-keyboard-meta-focus');
                        if (typeof btn.scrollIntoView === 'function') {
                            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        }
                    }
                }
                return;
            }

            if (currentSingleSection === 'recent') {
                const recentChips = getSingleRecentChips();
                if (recentChips.length > 0) {
                    if (singleNavIndex < 0) singleNavIndex = 0;
                    if (singleNavIndex >= recentChips.length) singleNavIndex = recentChips.length - 1;
                    const chip = recentChips[singleNavIndex];
                    if (chip) {
                        chip.classList.add('fasttag-keyboard-meta-focus');
                        if (typeof chip.scrollIntoView === 'function') {
                            chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        }
                    }
                }
                return;
            }

            if (currentSingleSection === 'create') {
                if (createBtn && isBottomCreateVisible) {
                    createBtn.classList.add('fasttag-create-btn-active');
                    createBtn.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.5), 0 2px 8px rgba(0,0,0,0.3)';
                    createBtn.style.transform = 'scale(1.02)';
                    createBtn.style.filter = 'brightness(1.15)';
                }
                return;
            }

            if (currentSingleSection === 'table') {
                if (singleNavIndex >= 0 && singleNavIndex < rows.length && rows[singleNavIndex]) {
                    const el = rows[singleNavIndex].getElement();
                    if (el) el.classList.add('fasttag-keyboard-active');
                    scrollSingleRowIntoViewIfNeeded(rows[singleNavIndex]);
                }
            }
        };

        activeTableInstance.on("rowSelected", async (row) => {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) {
                    selectedIds.add(String(id));
                    addRecentEntry(type, row.getData());
                }
                currentSingleSection = 'table';
                const rows = activeTableInstance.getRows();
                singleNavIndex = rows.indexOf(row);
                updateSingleKeyboardHighlight();

                const hasSearch = filterInput && filterInput.value.trim().length > 0;
                if (hasSearch) {
                    filterInput.value = '';
                    if (searchClear) searchClear.style.display = 'none';
                    if (form.querySelector(`#${type}-kbd-shortcut`)) form.querySelector(`#${type}-kbd-shortcut`).style.display = 'block';
                    await fetchData('', false);
                    const r = activeTableInstance.getRow(id);
                    if (r) activeTableInstance.scrollToRow(r, "top", false);
                    singleNavIndex = -1;
                    updateSingleKeyboardHighlight();
                    if (filterInput) filterInput.focus({ preventScroll: true });
                } else if (filterInput) {
                    filterInput.focus({ preventScroll: true });
                }
                refreshUI();
            }
        });

        activeTableInstance.on("rowDeselected", async (row) => {
            if (!isRestoringSelections && !isModalClosing) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                currentSingleSection = 'table';
                singleNavIndex = -1;
                updateSingleKeyboardHighlight();

                const hasSearch = filterInput && filterInput.value.trim().length > 0;
                if (hasSearch) {
                    filterInput.value = '';
                    if (searchClear) searchClear.style.display = 'none';
                    if (form.querySelector(`#${type}-kbd-shortcut`)) form.querySelector(`#${type}-kbd-shortcut`).style.display = 'block';
                }
                await fetchData('', true);
                if (filterInput) filterInput.focus({ preventScroll: true });
                refreshUI();
            }
        });

        form.addEventListener('click', (e) => {
            if (!e.target.closest('input, textarea')) {
                if (filterInput) filterInput.focus({ preventScroll: true });
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
            let data = Array.from(cachedData);
            const searchFields = config.searchFields || [config.labelKey];
            if (term) {
                const tokens = term.split(/\s+/);
                data = data.filter(item => {
                    const itemSearchStr = searchFields
                        .map(f => String(item[f] || '').trim().toLowerCase())
                        .filter(Boolean)
                        .join(' ');
                    return tokens.every(t => itemSearchStr.includes(t));
                });
            }

            data.sort(getSmartSortComparator(term, selectedIds, config.labelKey, searchFields, getSavedSortKey(type)));

            isRestoringSelections = true;
            try {
                if (typeof activeTableInstance.deselectRow === 'function') {
                    activeTableInstance.deselectRow();
                }
                await activeTableInstance.setData(data);
                if (typeof activeTableInstance.deselectRow === 'function') {
                    activeTableInstance.deselectRow();
                }
                selectedIds.forEach(id => {
                    const r = activeTableInstance.getRow(id);
                    if (r) activeTableInstance.selectRow(r);
                });
                refreshUI();
                if (resetScroll && data.length > 0) {
                    const holder = activeTableInstance.element?.querySelector('.tabulator-tableholder') || activeTableInstance.element;
                    if (holder) {
                        holder.scrollTop = 0;
                        holder.scrollLeft = 0;
                    }
                    const firstRow = activeTableInstance.getRows()[0];
                    if (firstRow) activeTableInstance.scrollToRow(firstRow, "top", false);
                }
            } finally {
                isRestoringSelections = false;
            }
        }
        activePopup._fastTagFetchData = fetchData;

        filterInput.oninput = (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            const val = e.target.value.trim();
            debounceTimer = setTimeout(async () => {
                await fetchData(e.target.value, true);
                if (val.length > 0) {
                    const rows = activeTableInstance && typeof activeTableInstance.getRows === 'function' ? activeTableInstance.getRows() : [];
                    if (rows.length > 0) {
                        currentSingleSection = 'table';
                        singleNavIndex = 0;
                    } else if (activePopup.bottomCreateContainer && activePopup.bottomCreateContainer.style.display !== 'none') {
                        currentSingleSection = 'create';
                        singleNavIndex = 0;
                    } else if (getSingleRecentChips().length > 0) {
                        currentSingleSection = 'recent';
                        singleNavIndex = 0;
                    } else if (getSingleSuggestions().length > 0) {
                        currentSingleSection = 'suggestions';
                        singleNavIndex = 0;
                    } else {
                        currentSingleSection = 'table';
                        singleNavIndex = -1;
                    }
                } else {
                    currentSingleSection = 'table';
                    singleNavIndex = -1;
                }
                updateSingleKeyboardHighlight();
            }, 150);
        };

        filterInput.onkeydown = async (e) => {
            const rows = activeTableInstance && typeof activeTableInstance.getRows === 'function' ? activeTableInstance.getRows() : [];
            const isBottomCreateVisible = activePopup.bottomCreateContainer && activePopup.bottomCreateContainer.style.display !== 'none';
            const suggBtns = getSingleSuggestions();
            const recentChips = getSingleRecentChips();

            if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                if (currentSingleSection === 'suggestions' && suggBtns.length > 0) {
                    e.preventDefault();
                    if (e.key === 'ArrowLeft') {
                        if (singleNavIndex > 0) singleNavIndex--;
                        else singleNavIndex = suggBtns.length - 1;
                    } else {
                        if (singleNavIndex < suggBtns.length - 1) singleNavIndex++;
                        else singleNavIndex = 0;
                    }
                    updateSingleKeyboardHighlight();
                    return;
                } else if (currentSingleSection === 'recent' && recentChips.length > 0) {
                    e.preventDefault();
                    if (e.key === 'ArrowLeft') {
                        if (singleNavIndex > 0) singleNavIndex--;
                        else singleNavIndex = recentChips.length - 1;
                    } else {
                        if (singleNavIndex < recentChips.length - 1) singleNavIndex++;
                        else singleNavIndex = 0;
                    }
                    updateSingleKeyboardHighlight();
                    return;
                }
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (singleNavIndex < 0) {
                    const hasVal = (popup.searchInput?.value || '').trim().length > 0;
                    if (!hasVal) {
                        if (suggBtns.length > 0) {
                            currentSingleSection = 'suggestions';
                            singleNavIndex = 0;
                        } else if (recentChips.length > 0) {
                            currentSingleSection = 'recent';
                            singleNavIndex = 0;
                        } else if (rows.length > 0) {
                            currentSingleSection = 'table';
                            singleNavIndex = 0;
                        } else if (isBottomCreateVisible) {
                            currentSingleSection = 'create';
                            singleNavIndex = 0;
                        }
                    } else {
                        if (rows.length > 0) {
                            currentSingleSection = 'table';
                            singleNavIndex = 0;
                        } else if (isBottomCreateVisible) {
                            currentSingleSection = 'create';
                            singleNavIndex = 0;
                        } else if (suggBtns.length > 0) {
                            currentSingleSection = 'suggestions';
                            singleNavIndex = 0;
                        } else if (recentChips.length > 0) {
                            currentSingleSection = 'recent';
                            singleNavIndex = 0;
                        }
                    }
                    updateSingleKeyboardHighlight();
                    return;
                }

                if (currentSingleSection === 'suggestions') {
                    if (recentChips.length > 0) {
                        currentSingleSection = 'recent';
                        singleNavIndex = 0;
                    } else if (rows.length > 0) {
                        currentSingleSection = 'table';
                        singleNavIndex = 0;
                    } else if (isBottomCreateVisible) {
                        currentSingleSection = 'create';
                        singleNavIndex = 0;
                    }
                } else if (currentSingleSection === 'recent') {
                    if (rows.length > 0) {
                        currentSingleSection = 'table';
                        singleNavIndex = 0;
                    } else if (isBottomCreateVisible) {
                        currentSingleSection = 'create';
                        singleNavIndex = 0;
                    }
                } else if (currentSingleSection === 'table') {
                    if (rows.length > 0) {
                        if (singleNavIndex < 0) {
                            singleNavIndex = 0;
                        } else if (singleNavIndex < rows.length - 1) {
                            singleNavIndex++;
                        } else if (singleNavIndex === rows.length - 1 && isBottomCreateVisible) {
                            currentSingleSection = 'create';
                            singleNavIndex = 0;
                        }
                    } else if (isBottomCreateVisible) {
                        currentSingleSection = 'create';
                        singleNavIndex = 0;
                    }
                }
                updateSingleKeyboardHighlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (singleNavIndex < 0) {
                    if (recentChips.length > 0) {
                        currentSingleSection = 'recent';
                        singleNavIndex = 0;
                    } else if (suggBtns.length > 0) {
                        currentSingleSection = 'suggestions';
                        singleNavIndex = 0;
                    }
                    updateSingleKeyboardHighlight();
                    return;
                }
                if (currentSingleSection === 'create') {
                    if (rows.length > 0) {
                        currentSingleSection = 'table';
                        singleNavIndex = rows.length - 1;
                    } else if (recentChips.length > 0) {
                        currentSingleSection = 'recent';
                        singleNavIndex = 0;
                    } else if (suggBtns.length > 0) {
                        currentSingleSection = 'suggestions';
                        singleNavIndex = 0;
                    }
                } else if (currentSingleSection === 'table') {
                    if (singleNavIndex > 0) {
                        singleNavIndex--;
                    } else {
                        if (recentChips.length > 0) {
                            currentSingleSection = 'recent';
                            singleNavIndex = 0;
                        } else if (suggBtns.length > 0) {
                            currentSingleSection = 'suggestions';
                            singleNavIndex = 0;
                        } else {
                            singleNavIndex = -1;
                        }
                    }
                } else if (currentSingleSection === 'recent') {
                    if (suggBtns.length > 0) {
                        currentSingleSection = 'suggestions';
                        singleNavIndex = 0;
                    }
                }
                updateSingleKeyboardHighlight();
            } else if (e.key === 'Enter') {
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (saveBtn) saveBtn.click();
                    return;
                }

                if (currentSingleSection === 'suggestions') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (suggBtns.length > 0 && singleNavIndex >= 0 && singleNavIndex < suggBtns.length) {
                        suggBtns[singleNavIndex].click();
                        if (filterInput.value.trim().length > 0) {
                            filterInput.value = '';
                            updateVisibility();
                            await fetchData("", false);
                            filterInput.focus({ preventScroll: true });
                        }
                    }
                    return;
                }

                if (currentSingleSection === 'recent') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (recentChips.length > 0 && singleNavIndex >= 0 && singleNavIndex < recentChips.length) {
                        recentChips[singleNavIndex].click();
                        if (filterInput.value.trim().length > 0) {
                            filterInput.value = '';
                            updateVisibility();
                            await fetchData("", false);
                            filterInput.focus({ preventScroll: true });
                        }
                    }
                    return;
                }

                if (currentSingleSection === 'create' && isBottomCreateVisible) {
                    e.preventDefault();
                    e.stopPropagation();
                    createBtn.click();
                    return;
                }

                const hadSearch = filterInput.value.trim().length > 0;
                if (!hadSearch && singleNavIndex < 0) {
                    e.preventDefault();
                    if (saveBtn) saveBtn.click();
                    return;
                }

                const targetIdx = singleNavIndex >= 0 ? singleNavIndex : 0;
                if (rows.length > 0 && rows[targetIdx]) {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetRow = rows[targetIdx];
                    const rowData = targetRow.getData();
                    if (rowData && rowData.id) {
                        const strId = String(rowData.id);
                        const wasSelected = selectedIds.has(strId);
                        if (wasSelected) {
                            selectedIds.delete(strId);
                            activeTableInstance.deselectRow(targetRow);
                        } else {
                            selectedIds.add(strId);
                            activeTableInstance.selectRow(targetRow);
                            addRecentEntry(type, rowData);
                        }
                        if (hadSearch) {
                            filterInput.value = '';
                            updateVisibility();
                            await fetchData("", true);
                            if (!wasSelected) {
                                const r = activeTableInstance.getRow(rowData.id);
                                if (r) activeTableInstance.scrollToRow(r, "top", false);
                            }
                            currentSingleSection = 'table';
                            singleNavIndex = -1;
                        } else {
                            refreshUI();
                            if (wasSelected) {
                                await fetchData("", true);
                            }
                        }
                        filterInput.focus({ preventScroll: true });
                        updateSingleKeyboardHighlight();
                    }
                }
            }
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
                await saveWithoutReload(sceneId, selectedIds);
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

            const confirmed = await promptBulkConfirmationDialog(
                `Are you sure you want to apply these changes to ${bulkScenes.length} selected scenes?`,
                form,
                `Yes, Apply to ${bulkScenes.length} Scenes`
            );
            if (!confirmed) return;

            const { removedIds, addedIds } = calculateBulkSelectionDelta(initialCommonIds, selectedIds);

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
                            targetIds = applyBulkSelectionDelta(existIds, removedIds, addedIds);
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

    function promptBulkConfirmationDialog(message, parentForm, confirmText = 'Yes, Apply Changes') {
        return new Promise((resolve) => {
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
            const inputBorder = isDark ? '1px solid rgba(148, 163, 184, 0.3)' : '1px solid #cbd5e1';

            dialog.style.cssText = `
                background: ${cardBg};
                border: ${cardBorder};
                border-radius: 8px;
                padding: 18px 20px;
                width: 100%;
                max-width: 360px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
                gap: 14px;
                color: ${textColor};
                box-sizing: border-box;
            `;

            dialog.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="font-size: 14px; font-weight: 700; display: inline-flex; align-items: center; gap: 7px; color: ${isDark ? '#f8fafc' : '#0f172a'};">
                        <span>📦</span>
                        <span>Confirm Bulk Changes</span>
                    </div>
                    <button type="button" class="fasttag-dialog-close-btn" style="background: none; border: none; font-size: 18px; line-height: 1; cursor: pointer; color: inherit; opacity: 0.6; padding: 0 4px;" title="Cancel">&times;</button>
                </div>
                <div style="font-size: 12.5px; font-weight: 500; opacity: 0.9; line-height: 1.45; color: ${textColor};">
                    ${escapeHtml(message)}
                </div>
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px;">
                    <button type="button" class="fasttag-dialog-cancel-btn" style="padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: transparent; border: ${inputBorder}; color: inherit; transition: all 0.15s ease;">No, Cancel</button>
                    <button type="button" class="fasttag-dialog-confirm-btn" style="padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; background: #10b981; border: none; color: #ffffff; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.15s ease;">${escapeHtml(confirmText)}</button>
                </div>
            `;

            overlay.appendChild(dialog);
            parentForm.appendChild(overlay);

            const confirmBtn = dialog.querySelector('.fasttag-dialog-confirm-btn');
            const cancelBtn = dialog.querySelector('.fasttag-dialog-cancel-btn');
            const closeBtn = dialog.querySelector('.fasttag-dialog-close-btn');

            const cleanup = (val) => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                resolve(val);
            };

            confirmBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); cleanup(true); };
            cancelBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); cleanup(false); };
            closeBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); cleanup(false); };

            dialog.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    cleanup(true);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    cleanup(false);
                }
            };

            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                    cleanup(false);
                }
            };

            setTimeout(() => {
                confirmBtn.focus();
            }, 50);
        });
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
                    <div id="everything-seq-container" style="display: inline-flex; align-items: center; gap: 6px;">
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
            </div>
            <div id="everything-preview-container" style="flex-shrink: 0;"></div>

            <!-- Split Metadata Bar: Studio (Left) | Group (Right) -->
            <div id="everything-metadata-bar" style="display: flex; gap: 6px; margin-bottom: 5px; flex-shrink: 0; min-height: 25px; box-sizing: border-box;">
                <!-- Left Half: Studio (Compact Icon Prefix + Smooth Horizontal Scroll) -->
                <div id="everything-studio-half" style="display: flex; align-items: center; gap: 5px; flex: 1 1 0px; min-width: 0; padding: 2.5px 6px; background: ${studioBarBg}; border: ${studioBarBorder}; border-radius: 7px; box-sizing: border-box; overflow: hidden;" title="Studio">
                    <span style="display: flex; align-items: center; justify-content: center; flex-shrink: 0; user-select: none; width: 14px; height: 14px;" title="Studio">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#818cf8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 1px 2px rgba(99,102,241,0.5));">
                            <path d="M15 10l5-3v10l-5-3"></path>
                            <rect x="2" y="6" width="13" height="12" rx="2.5"></rect>
                        </svg>
                    </span>
                    <div id="everything-studio-scroll" style="display: flex; align-items: center; gap: 3.5px; flex: 1 1 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: none;">
                        <div id="everything-selected-studio-chip" class="fasttag-studio-pill" style="display: none; align-items: center; gap: 4px; font-weight: 700; padding: 1.5px 6px; border-radius: 999px; font-size: 10px; white-space: nowrap; flex-shrink: 0; cursor: default;">
                            <span style="font-weight: 800; font-size: 9.5px; opacity: 0.95;">✓</span>
                            <span id="everything-selected-studio-name"></span>
                            <button type="button" id="everything-clear-studio-btn" class="fasttag-pill-clear-btn" style="background: none; border: none; cursor: pointer; color: #ffffff; font-weight: 700; font-size: 12px; padding: 0 0 0 3px; line-height: 1; opacity: 0.85;" title="Remove Studio">&times;</button>
                        </div>
                        <div id="everything-recent-studios" style="display: flex; gap: 3.5px; align-items: center; flex-shrink: 0;"></div>
                    </div>
                </div>

                <!-- Right Half: Groups (Compact Filmstrip Icon Prefix + Smooth Horizontal Scroll) -->
                <div id="everything-groups-half" style="display: flex; align-items: center; gap: 5px; flex: 1 1 0px; min-width: 0; padding: 2.5px 6px; background: ${studioBarBg}; border: ${studioBarBorder}; border-radius: 7px; box-sizing: border-box; overflow: hidden;" title="Group">
                    <span style="display: flex; align-items: center; justify-content: center; flex-shrink: 0; user-select: none; width: 14px; height: 14px;" title="Group">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 1px 2px rgba(245,158,11,0.5));">
                            <rect x="3" y="3" width="18" height="18" rx="2.5"></rect>
                            <line x1="8.5" y1="3" x2="8.5" y2="21"></line>
                            <line x1="15.5" y1="3" x2="15.5" y2="21"></line>
                            <line x1="3" y1="8" x2="8.5" y2="8"></line>
                            <line x1="15.5" y1="8" x2="21" y2="8"></line>
                            <line x1="3" y1="12" x2="21" y2="12"></line>
                            <line x1="3" y1="16" x2="8.5" y2="16"></line>
                            <line x1="15.5" y1="16" x2="21" y2="16"></line>
                        </svg>
                    </span>
                    <div id="everything-groups-scroll" style="display: flex; align-items: center; gap: 3.5px; flex: 1 1 auto; min-width: 0; overflow-x: auto; overflow-y: hidden; white-space: nowrap; scrollbar-width: none;">
                        <div id="everything-selected-groups-container" style="display: flex; gap: 3.5px; align-items: center; flex-shrink: 0;"></div>
                        <div id="everything-recent-groups" style="display: flex; gap: 3.5px; align-items: center; flex-shrink: 0;"></div>
                    </div>
                </div>
            </div>

            <!-- Clean Full-Width Search Bar (Matching Single Entity Popups) -->
            <div style="display: flex; gap: 6px; margin-bottom: 6px; align-items: center; flex-shrink: 0;">
                <div style="position: relative; flex: 1; display: flex; align-items: center; min-width: 0;">
                    <svg viewBox="0 0 24 24" width="13.5" height="13.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="position: absolute; left: 10px; color: ${isDark ? '#818cf8' : '#6366f1'}; opacity: 0.8; pointer-events: none; user-select: none;">
                        <circle cx="11" cy="11" r="7"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input type="text" id="everything-global-search" autofocus class="popup-search-input" autocomplete="off" spellcheck="false" placeholder="Search tags, performers, studios & groups..." style="width: 100%; padding: 8px 28px 8px 31px; box-sizing: border-box; border-radius: 8px; font-size: 12.5px; font-weight: 500; outline: none;">
                    <span id="everything-global-clear" class="popup-search-clear" style="position: absolute; right: 8px; cursor: pointer; font-size: 16px; line-height: 1; display: none; user-select: none; color: #818cf8;">&times;</span>
                </div>
                <button type="button" id="everything-refresh-btn" class="popup-refresh-btn" title="Refresh all caches" style="padding: 8px 10px; cursor: pointer; font-size: 13px; font-weight: 500; border-radius: 8px; white-space: nowrap; line-height: 1; flex-shrink: 0;">↻</button>
                <button type="button" id="everything-scrape-btn" class="popup-scrape-btn" title="Scrape scene metadata (StashDB / Scrapers) [Alt+S]" style="padding: 7px 10px; cursor: pointer; font-size: 11.5px; font-weight: 700; border-radius: 8px; white-space: nowrap; line-height: 1; flex-shrink: 0; background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#c7d2fe' : '#4338ca'}; border: 1px solid ${isDark ? 'rgba(99, 102, 241, 0.45)' : '#a5b4fc'}; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;">⚡ Scrape</button>
                <button type="button" id="everything-ai-btn" class="popup-ai-btn" title="Extract Clean Title, Performers & Studio with Google Gemini AI [Alt+A]" style="padding: 7px 10px; cursor: pointer; font-size: 11.5px; font-weight: 700; border-radius: 8px; white-space: nowrap; line-height: 1; flex-shrink: 0; background: ${isDark ? 'rgba(168, 85, 247, 0.2)' : '#f3e8ff'}; color: ${isDark ? '#e9d5ff' : '#7e22ce'}; border: 1px solid ${isDark ? 'rgba(168, 85, 247, 0.45)' : '#d8b4fe'}; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s ease;">✨ AI Parse</button>
            </div>

            <!-- Interactive AI Match Card Container -->
            <div id="everything-ai-card-container" style="display: none; flex-direction: column; margin-bottom: 6px; flex-shrink: 0; width: 100%; box-sizing: border-box;"></div>

            <!-- Interactive Scraper Match Card Container -->
            <div id="everything-scraper-card-container" style="display: none; flex-direction: column; margin-bottom: 6px; flex-shrink: 0; width: 100%; box-sizing: border-box;"></div>

            <!-- Dual-Column Suggestions Bar (Single Compact Row, Always Visible) -->
            <div id="everything-suggestions-container" style="display: flex; align-items: center; margin-bottom: 6px; flex-shrink: 0; width: 100%; box-sizing: border-box;">
                <!-- Tag & Studio Suggestions (Above Tags Column & Studio Bar) -->
                <div id="everything-sugg-tags-box" style="box-sizing: border-box; display: flex; align-items: center; gap: 4px; background: ${isDark ? 'rgba(99, 102, 241, 0.08)' : '#eef2ff'}; border: 1px dashed ${isDark ? 'rgba(129, 140, 248, 0.35)' : 'rgba(99, 102, 241, 0.4)'}; border-radius: 6px; padding: 2px 6px; overflow: visible; height: 26px;">
                    <span class="fasttag-tooltip" data-tooltip="Suggested Tags & Studios" style="font-size: 11px; user-select: none; flex-shrink: 0; line-height: 1; margin-right: 2px;">💡</span>
                    <div id="everything-sugg-tags-chips" style="display: flex; align-items: center; gap: 4px; overflow-x: auto; flex: 1; min-width: 0; padding: 1px 0;">
                        <span class="fasttag-sugg-empty" style="font-size: 10px; font-weight: 500; opacity: 0.45; font-style: italic; color: #818cf8; user-select: none; line-height: 1;">None</span>
                    </div>
                </div>

                <!-- 1px invisible spacer matching column splitter -->
                <div id="everything-sugg-spacer" style="width: 1px; flex-shrink: 0; display: block;"></div>

                <!-- Performer & Group Suggestions (Above Performers Column & Group Bar) -->
                <div id="everything-sugg-performers-box" style="box-sizing: border-box; display: flex; align-items: center; gap: 4px; background: ${isDark ? 'rgba(14, 165, 233, 0.08)' : '#f0f9ff'}; border: 1px dashed ${isDark ? 'rgba(56, 189, 248, 0.35)' : 'rgba(14, 165, 233, 0.4)'}; border-radius: 6px; padding: 2px 6px; overflow: visible; height: 26px;">
                    <span class="fasttag-tooltip" data-tooltip="Suggested Performers & Groups" style="font-size: 11px; user-select: none; flex-shrink: 0; line-height: 1; margin-right: 2px;">💡</span>
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
            <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
                <button type="button" id="everything-organized-btn" class="fasttag-organized-pill" style="display: none; flex-shrink: 0;"></button>
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
            organizedBtn: form.querySelector('#everything-organized-btn'),
            seqContainer: form.querySelector('#everything-seq-container'),
            sequentialCheckbox: form.querySelector('#everything-sequential-mode'),
            navGroup: form.querySelector('#everything-nav-group'),
            prevBtn: form.querySelector('#everything-prev-btn'),
            nextBtn: form.querySelector('#everything-next-btn'),
            previewContainer: form.querySelector('#everything-preview-container'),
            studioBar: {
                container: form.querySelector('#everything-studio-half'),
                scrollContainer: form.querySelector('#everything-studio-scroll'),
                chip: form.querySelector('#everything-selected-studio-chip'),
                chipName: form.querySelector('#everything-selected-studio-name'),
                clearBtn: form.querySelector('#everything-clear-studio-btn'),
                recentContainer: form.querySelector('#everything-recent-studios')
            },
            groupsBar: {
                container: form.querySelector('#everything-groups-half'),
                scrollContainer: form.querySelector('#everything-groups-scroll'),
                selectedContainer: form.querySelector('#everything-selected-groups-container'),
                recentContainer: form.querySelector('#everything-recent-groups')
            },
            suggestionsContainer: form.querySelector('#everything-suggestions-container'),
            searchConsole: form.querySelector('#everything-search-console'),
            globalSearch: form.querySelector('#everything-global-search'),
            kbdShortcut: form.querySelector('#everything-kbd-shortcut'),
            globalClear: form.querySelector('#everything-global-clear'),
            scrapeBtn: form.querySelector('#everything-scrape-btn'),
            scraperCardContainer: form.querySelector('#everything-scraper-card-container'),
            aiBtn: form.querySelector('#everything-ai-btn'),
            aiCardContainer: form.querySelector('#everything-ai-card-container'),
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
        const showPinned = getShowPinnedChips();
        const showRecent = getShowRecentChips();
        const cached = getCachedOrNull(type) || [];

        const resolveItem = (item, isPinned) => {
            let id = (item.id != null && item.id !== '') ? String(item.id) : null;
            const name = item.name || item.title;
            if (!id && name) {
                const found = cached.find(c => (c.name || c.title || '').trim().toLowerCase() === name.trim().toLowerCase());
                if (found) id = String(found.id);
            }
            return { id, name, isPinned };
        };

        const pinned = showPinned ? readPinnedEntries(type)
            .filter(item => item && (item.name || item.title))
            .map(p => resolveItem(p, true))
            .filter(p => p.id != null) : [];

        const pinnedIds = new Set(pinned.map(p => String(p.id)));

        const recent = showRecent ? readRecentEntries(type)
            .filter(item => item && (item.name || item.title))
            .map(r => resolveItem(r, false))
            .filter(r => r.id != null && !pinnedIds.has(String(r.id))) : [];

        const combined = [...pinned, ...recent];

        if (!combined.length) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'flex';
        container.style.flexWrap = 'wrap';
        container.style.gap = '4px';
        container.style.maxHeight = '46px';
        container.style.overflowY = 'auto';
        container.style.overflowX = 'hidden';
        container.style.overscrollBehavior = 'contain';
        container.style.scrollbarWidth = 'none';
        container.style.marginBottom = '6px';
        container.innerHTML = '';
        const isDark = getEffectiveTheme() === 'dark';

        let index = 0;
        for (const item of combined) {
            index++;
            const isSelected = selectedIds && selectedIds.has(String(item.id));
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'fasttag-quick-chip';
            chip.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            chip.title = `${isSelected ? 'Selected — click to remove' : 'Click to add'}. Right-Click or Alt-Click to ${item.isPinned ? 'unpin' : 'pin'}.`;

            if (item.isPinned) {
                const pinSpan = document.createElement('span');
                pinSpan.textContent = '📌 ';
                chip.appendChild(pinSpan);
            }
            const stateSpan = document.createElement('span');
            stateSpan.textContent = isSelected ? '✓ ' : '+ ';
            stateSpan.style.fontWeight = '700';
            chip.appendChild(stateSpan);
            const textNode = document.createTextNode(item.name || item.title || '');
            chip.appendChild(textNode);

            const bg = isDark ? (isSelected ? '#4f46e5' : (item.isPinned ? '#1e1b4b' : '#1e293b')) : (isSelected ? '#c7d2fe' : '#f1f5f9');
            const border = isDark ? (isSelected ? '#a5b4fc' : (item.isPinned ? '#6366f1' : '#475569')) : (isSelected ? '#6366f1' : '#cbd5e1');
            const color = isDark ? (isSelected ? '#ffffff' : (item.isPinned ? '#e0e7ff' : '#f1f5f9')) : (isSelected ? '#312e81' : '#1e293b');

            chip.style.cssText = `padding: 2px 7px; border: 1px solid ${border}; border-radius: 999px; background: ${bg}; color: ${color}; font-size: 11px; font-weight: ${item.isPinned || isSelected ? '600' : '500'}; cursor: pointer; transition: all 0.15s ease; flex-shrink: 0; line-height: 1.25;`;

            chip.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
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
        let title = '';
        let details = '';
        let fileName = '';

        try {
            const query = `query ($id: ID!) { findScene(id: $id) { title details files { path } } }`;
            const res = await fetchGQL(query, { id: sceneId });
            const scene = res?.data?.findScene;
            if (scene) {
                if (scene.title) title = scene.title;
                if (scene.details) details = scene.details;
                if (scene.files && scene.files.length > 0 && scene.files[0]?.path) {
                    const filePath = scene.files[0].path;
                    const parts = filePath.split(/[/\\]/);
                    const lastPart = parts.length > 0 ? parts[parts.length - 1] : filePath;
                    fileName = cleanFilenameForSuggestions(lastPart);
                }
            }
        } catch (e) {}

        const primaryText = `${title} ${fileName}`.trim();
        if (!primaryText && !details.trim()) {
            if (container) container.style.display = 'none';
            return;
        }

        const types = [
            { type: 'tags', icon: '🏷️' },
            { type: 'studios', icon: '🏢' },
            { type: 'performers', icon: '⭐' },
            { type: 'groups', icon: '📁' }
        ];

        const allSuggestions = [];

        for (const { type, icon } of types) {
            const config = ENTITY_CONFIG[type];
            if (!config) continue;
            let cached = getCachedOrNull(type);
            const loadedTable = type === 'tags' ? ctx?.tagsTable : type === 'performers' ? ctx?.performersTable : null;
            const loadedTableData = loadedTable && typeof loadedTable.getData === 'function' ? loadedTable.getData() : null;
            if (Array.isArray(loadedTableData) && loadedTableData.length > 0) {
                cached = loadedTableData;
            }
            if (!cached) {
                try {
                    const res = await fetchGQL(config.fetchQuery);
                    cached = config.extractList(res.data);
                    if ((!cached || !cached.length) && type === 'groups') {
                        cached = res?.data?.findGroups?.groups || res?.data?.findMovies?.movies || [];
                    }
                    if (cached) setCache(type, cached);
                } catch (e) {
                    cached = [];
                }
            }
            if (!cached || !Array.isArray(cached)) continue;

            let existingSet = null;
            if (ctx) {
                if (typeof ctx.getSelectedIds === 'function') {
                    existingSet = ctx.getSelectedIds(type);
                } else if (type === 'tags') {
                    existingSet = ctx.selectedTagIds;
                } else if (type === 'performers') {
                    existingSet = ctx.selectedPerformerIds;
                } else if (type === 'studios') {
                    const sid = typeof ctx.selectedStudioId === 'function' ? ctx.selectedStudioId() : ctx.selectedStudioId;
                    existingSet = sid ? new Set([String(sid)]) : new Set();
                } else if (type === 'groups') {
                    const gids = typeof ctx.selectedGroupIds === 'function' ? ctx.selectedGroupIds() : ctx.selectedGroupIds;
                    existingSet = gids || new Set();
                }
            }

            rankSuggestionItems(cached, primaryText, details, existingSet, 20)
                .forEach(item => allSuggestions.push({ type, icon, item }));
        }

        const tagsBox = container.querySelector('#everything-sugg-tags-box');
        const tagsChips = container.querySelector('#everything-sugg-tags-chips');
        const perfBox = container.querySelector('#everything-sugg-performers-box');
        const perfChips = container.querySelector('#everything-sugg-performers-chips');

        const updateBoxVisibility = () => {
            const hasRealTags = tagsChips && tagsChips.querySelectorAll('.fasttag-suggestion-chip').length > 0;
            const hasRealPerf = perfChips && perfChips.querySelectorAll('.fasttag-suggestion-chip').length > 0;

            if (!hasRealTags && !hasRealPerf) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'flex';
            if (tagsBox) {
                tagsBox.style.display = 'flex';
                tagsBox.style.visibility = 'visible';
                tagsBox.style.pointerEvents = 'auto';
            }
            if (perfBox) {
                perfBox.style.display = 'flex';
                perfBox.style.visibility = 'visible';
                perfBox.style.pointerEvents = 'auto';
            }
            syncSuggestionsAlignment(container.closest('form'));
        };

        const activateSuggestion = async (sug) => {
            const idStr = String(sug.item.id);
            const tagSet = typeof ctx.getSelectedTags === 'function' ? ctx.getSelectedTags() : ctx.selectedTagIds;
            const perfSet = typeof ctx.getSelectedPerformers === 'function' ? ctx.getSelectedPerformers() : ctx.selectedPerformerIds;
            if (sug.type === 'tags' && tagSet) {
                tagSet.add(idStr);
            } else if (sug.type === 'performers' && perfSet) {
                perfSet.add(idStr);
            } else if (sug.type === 'studios') {
                if (typeof ctx.setSelectedStudio === 'function') {
                    ctx.setSelectedStudio(idStr);
                } else if (typeof ctx.setStudioId === 'function') {
                    ctx.setStudioId(idStr);
                }
            } else if (sug.type === 'groups') {
                const grpSet = typeof ctx.getSelectedGroups === 'function' ? ctx.getSelectedGroups() : ctx.selectedGroupIds;
                if (grpSet) {
                    grpSet.add(idStr);
                } else if (typeof ctx.addGroupId === 'function') {
                    ctx.addGroupId(idStr);
                }
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
            } else if (sug.type === 'studios') {
                chipBg = isDark ? 'rgba(99, 102, 241, 0.22)' : '#ede9fe';
                chipBorder = isDark ? '1px dashed rgba(129, 140, 248, 0.85)' : '1px dashed #4f46e5';
                chipColor = isDark ? '#e0e7ff' : '#312e81';
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
                e.stopPropagation();
                await activateSuggestion(sug);
                if (typeof ctx.refreshAllUI === 'function') {
                    ctx.refreshAllUI();
                }
            });

            if (parentChipsContainer) parentChipsContainer.appendChild(chip);
        };

        const renderSuggestionsUI = () => {
            if (tagsChips) tagsChips.innerHTML = '';
            if (perfChips) perfChips.innerHTML = '';

            // Left side: Tags & Studios (since Studio bar and Tag column are on the left)
            const leftSuggestions = allSuggestions.filter(s => {
                if (s.type === 'tags') return !ctx.selectedTagIds.has(String(s.item.id));
                if (s.type === 'studios') {
                    const curStud = typeof ctx.selectedStudioId === 'function' ? ctx.selectedStudioId() : ctx.selectedStudioId;
                    return String(curStud || '') !== String(s.item.id);
                }
                return false;
            });

            // Right side: Performers & Groups (since Group bar and Performer column are on the right)
            const rightSuggestions = allSuggestions.filter(s => {
                if (s.type === 'performers') return !ctx.selectedPerformerIds.has(String(s.item.id));
                if (s.type === 'groups') {
                    const grpIds = typeof ctx.selectedGroupIds === 'function' ? ctx.selectedGroupIds() : ctx.selectedGroupIds;
                    return !grpIds || !grpIds.has(String(s.item.id));
                }
                return false;
            });

            if (leftSuggestions.length > 0) {
                leftSuggestions.forEach(s => createSuggestionChip(s, tagsChips));
            } else if (tagsChips) {
                const emptySpan = document.createElement('span');
                emptySpan.className = 'fasttag-sugg-empty';
                emptySpan.textContent = 'None';
                emptySpan.style.cssText = `font-size: 10px; font-weight: 500; opacity: 0.45; font-style: italic; color: ${isDark ? '#818cf8' : '#6366f1'}; user-select: none; line-height: 1;`;
                tagsChips.appendChild(emptySpan);
            }

            if (rightSuggestions.length > 0) {
                rightSuggestions.forEach(s => createSuggestionChip(s, perfChips));
            } else if (perfChips) {
                const emptySpan = document.createElement('span');
                emptySpan.className = 'fasttag-sugg-empty';
                emptySpan.textContent = 'None';
                emptySpan.style.cssText = `font-size: 10px; font-weight: 500; opacity: 0.45; font-style: italic; color: ${isDark ? '#38bdf8' : '#0284c7'}; user-select: none; line-height: 1;`;
                perfChips.appendChild(emptySpan);
            }

            updateBoxVisibility();
        };

        container._fastTagRenderSuggestions = renderSuggestionsUI;
        renderSuggestionsUI();
    }

    async function rollNextRandomUntaggedScene(popup = null) {
        if (popup && popup.saveBtn) {
            const dice = popup.saveBtn.querySelector('.fasttag-dice-icon');
            if (dice) {
                dice.classList.remove('fasttag-dice-rolling');
                void dice.offsetWidth;
                dice.classList.add('fasttag-dice-rolling');
            }
        }

        const query = `
            query FindRandomUntaggedScene {
                findScenes(
                    scene_filter: { tags: { modifier: IS_NULL } }
                    filter: { per_page: 1, sort: "random" }
                ) {
                    count
                    scenes {
                        id
                        title
                        files { path }
                    }
                }
            }
        `;
        try {
            showToast('🎲 Rolling random untagged scene...', 'info', 1500);
            const res = await fetchGQL(query);
            const data = res?.data?.findScenes;
            const count = data?.count || 0;
            const scenes = data?.scenes || [];

            if (scenes.length === 0 || !scenes[0]?.id) {
                toastSuccess('🎉 No untagged scenes found! Your library is fully tagged.');
                return;
            }

            const targetScene = scenes[0];
            if (popup && popup.element && popup.element.isConnected) {
                popup._isRandomMode = true;
                popup._randomUntaggedCount = count;
                if (!popup._randomHistoryState) {
                    popup._randomHistoryState = createRandomSceneHistory(popup.currentSceneId, popup._randomUntaggedCount);
                }
                appendRandomSceneHistory(popup._randomHistoryState, targetScene.id, count);
                sequentialEditState.enabled = false;
                await loadEditEverythingDataIntoPopup(targetScene.id, null, popup);
                popup._context?.refreshAllUI?.();
                toastSuccess(`🎲 Rolled random untagged scene (${count} remaining)`);
            } else {
                await openEditEverythingPopup(targetScene.id, null, true, count);
                toastSuccess(`🎲 Found random untagged scene (${count} remaining)`);
            }
        } catch (e) {
            toastError('Failed to find random untagged scene', e);
        }
    }

    async function navigateRandomSceneHistory(popup, direction, doSaveFn) {
        const history = popup?._randomHistoryState;
        if (!popup?._isRandomMode || !history) return;

        const previousIndex = history.index;
        const target = moveRandomSceneHistory(history, direction);
        if (!target) return;

        const ctx = popup._context;
        try {
            if (ctx && typeof doSaveFn === 'function' && typeof ctx.isDirty === 'function' && ctx.isDirty()) {
                await doSaveFn();
            }
            popup._randomUntaggedCount = target.count;
            await loadEditEverythingDataIntoPopup(target.id, null, popup);
            popup._context?.refreshAllUI?.();
        } catch (error) {
            history.index = previousIndex;
            toastError(`Unable to open random-scene history: ${error?.message || error}`);
        }
    }

    async function navigateSequentialEditEverything(popup, sceneId, direction, doSaveFn) {
        if (!sequentialEditState.enabled) return;

        if (!window._fastTagEverythingScraperOpen) {
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

        ftLog('ACTION', 'NAV', `Sequential navigation: Scene ${sceneId} -> Scene ${nextSceneId} (Index ${nextIndex + 1}/${cards.length}, direction ${direction > 0 ? '+1' : '-1'})`, {
            fromSceneId: sceneId,
            toSceneId: nextSceneId,
            nextIndex,
            totalCards: cards.length,
            direction
        });

        popup._isNavigatingSequential = true;
        try {
            await loadEditEverythingDataIntoPopup(nextSceneId, nextCard, popup);
        } finally {
            popup._isNavigatingSequential = false;
        }
    }

    function setupSequentialEditEverythingHandlers(popup, sceneId, cardElement, doSaveFn) {
        const seqCheckbox = popup.sequentialCheckbox;
        const prevBtn = popup.prevBtn;
        const nextBtn = popup.nextBtn;
        const titleSpan = popup.titleSpan;

        const updateUI = () => {
            const isRandom = Boolean(popup._isRandomMode);
            const isSeq = Boolean(sequentialEditState.enabled) && !isRandom;
            seqCheckbox.checked = isSeq;
            const sceneTitle = getSceneTitle(popup.sceneData, sceneId, cardElement);

            if (isRandom) {
                const history = popup._randomHistoryState || createRandomSceneHistory(sceneId, popup._randomUntaggedCount);
                popup._randomHistoryState = history;
                const historyPosition = history.index >= 0 ? `${history.index + 1}/${history.entries.length}` : '1/1';
                const untaggedCount = popup._randomUntaggedCount !== undefined ? popup._randomUntaggedCount : '?';
                titleSpan.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; font-size: 13px; line-height: 1; flex-shrink: 0; margin-right: 4px; user-select: none; transform: translateY(1.5px);">⚡</span><span style="opacity: 0.95; font-size: 11px; background: rgba(99,102,241,0.25); border: 1px solid rgba(99,102,241,0.45); padding: 1px 6px; border-radius: 4px; margin-right: 7px; font-weight: 700; color: #a5b4fc; white-space: nowrap; flex-shrink: 0; line-height: 1.3;">🎲 [${historyPosition}] [${untaggedCount} untagged]</span><span class="fasttag-marquee-box" style="flex: 1; min-width: 0; overflow: hidden; display: inline-flex; align-items: center;"><span class="fasttag-marquee-track"><span class="fasttag-marquee-item" data-raw-title="${escapeHtml(sceneTitle)}" title="${escapeHtml(sceneTitle)}">${escapeHtml(sceneTitle)}</span></span></span>`;
                titleSpan.title = `🎲 ${sceneTitle} [${untaggedCount} untagged]`;
                applyMarqueeAnimation(titleSpan);

                if (popup.seqContainer) popup.seqContainer.style.display = 'inline-flex';
                const seqLabel = seqCheckbox?.closest('label');
                if (seqLabel) seqLabel.style.display = 'none';
                if (popup.navGroup) popup.navGroup.style.display = 'inline-flex';
            } else if (isSeq) {
                const seqLabel = seqCheckbox?.closest('label');
                if (seqLabel) seqLabel.style.display = 'inline-flex';
                if (popup.seqContainer) popup.seqContainer.style.display = 'inline-flex';
                if (popup.navGroup) popup.navGroup.style.display = 'inline-flex';

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
                const seqLabel = seqCheckbox?.closest('label');
                if (seqLabel) seqLabel.style.display = 'inline-flex';
                if (popup.seqContainer) popup.seqContainer.style.display = 'inline-flex';
                if (popup.navGroup) popup.navGroup.style.display = 'inline-flex';

                titleSpan.innerHTML = `<span style="display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; font-size: 13px; line-height: 1; flex-shrink: 0; margin-right: 7px; user-select: none; transform: translateY(1.5px);">⚡</span><span class="fasttag-marquee-box" style="flex: 1; min-width: 0; overflow: hidden; display: inline-flex; align-items: center;"><span class="fasttag-marquee-track"><span class="fasttag-marquee-item" data-raw-title="${escapeHtml(sceneTitle)}" title="${escapeHtml(sceneTitle)}">${escapeHtml(sceneTitle)}</span></span></span>`;
                titleSpan.title = sceneTitle;
                applyMarqueeAnimation(titleSpan);
            }

            const randomHistory = popup._randomHistoryState;
            const canRandomBack = isRandom && randomHistory && randomHistory.index > 0;
            const canRandomForward = isRandom && randomHistory && randomHistory.index < randomHistory.entries.length - 1;
            prevBtn.disabled = isRandom ? !canRandomBack : !isSeq;
            nextBtn.disabled = isRandom ? !canRandomForward : !isSeq;
            prevBtn.style.opacity = prevBtn.disabled ? '0.4' : '1';
            nextBtn.style.opacity = nextBtn.disabled ? '0.4' : '1';
            prevBtn.style.cursor = prevBtn.disabled ? 'not-allowed' : 'pointer';
            nextBtn.style.cursor = nextBtn.disabled ? 'not-allowed' : 'pointer';
            prevBtn.title = isRandom ? 'Previous random scene (Alt+Left)' : 'Previous scene (Alt+Left)';
            nextBtn.title = isRandom ? 'Next scene in random history (Alt+Right)' : 'Next scene (Alt+Right)';

            if (popup.navGroup) {
                popup.navGroup.style.maxWidth = (isSeq || isRandom) ? '60px' : '0';
                popup.navGroup.style.opacity = (isSeq || isRandom) ? '1' : '0';
            }
        };

        popup._refreshHeaderTitle = updateUI;

        try {
            if (!popup._isRandomMode) {
                const savedPref = localStorage.getItem('fasttag_sequential_edit_mode');
                if (savedPref === 'true') {
                    sequentialEditState.enabled = true;
                    sequentialEditState.allSceneCards = getAllVisibleSceneCards();
                    sequentialEditState.currentIndex = getSceneCardIndex(sceneId, sequentialEditState.allSceneCards);
                    sequentialEditState.currentSceneId = sceneId;
                }
            } else {
                sequentialEditState.enabled = false;
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

        prevBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideScrapeCoverTooltip();
            if (popup._isRandomMode) {
                await navigateRandomSceneHistory(popup, -1, doSaveFn);
            } else {
                await navigateSequentialEditEverything(popup, sceneId, -1, doSaveFn);
            }
        };

        nextBtn.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            hideScrapeCoverTooltip();
            if (popup._isRandomMode) {
                await navigateRandomSceneHistory(popup, 1, doSaveFn);
            } else {
                await navigateSequentialEditEverything(popup, sceneId, 1, doSaveFn);
            }
        };

        if (popup.randomBtn) {
            popup.randomBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                popup.randomBtn.style.transform = 'scale(0.92)';
                setTimeout(() => { if (popup.randomBtn) popup.randomBtn.style.transform = 'none'; }, 150);
                await rollNextRandomUntaggedScene(popup);
            };
        }
    }

    async function loadEditEverythingDataIntoPopup(sceneId, cardElement, popup) {
        try {
            const ctx = popup._context;
            if (!ctx) return;

            popup.currentSceneId = sceneId;
            popup.currentCardElement = cardElement;

            if (!window._fastTagEverythingScraperOpen && popup.scraperCardContainer) {
                popup.scraperCardContainer.innerHTML = '';
                popup.scraperCardContainer.style.display = 'none';
            }
            ctx.setCurrentSceneId(sceneId);
            popup.currentSceneId = sceneId;
            popup.currentCardElement = cardElement;

            // Close & clear previous scene's AI parse card immediately on navigation
            if (popup.aiCardContainer) {
                popup.aiCardContainer.style.display = 'none';
                popup.aiCardContainer.innerHTML = '';
            }
            if (popup.aiBtn) {
                popup.aiBtn.disabled = false;
                popup.aiBtn.innerHTML = '<span>✨ AI Parse</span>';
            }

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
                        organized
                        files { path }
                        tags { id name }
                        performers { id name disambiguation }
                        studio { id name }
                        groups { group { id name } scene_index }
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

            if (popup.organizedBtn) {
                if (!popup._organizedController) {
                    popup._organizedController = setupOrganizedButton(popup.organizedBtn, () => popup.currentSceneId, sceneData?.organized);
                } else {
                    popup._organizedController.update(sceneData?.organized);
                }
            }

            const selTags = new Set((sceneData?.tags || []).map(t => String(t.id)));
            const selPerfs = new Set((sceneData?.performers || []).map(p => String(p.id)));
            const selStud = sceneData?.studio?.id ? String(sceneData.studio.id) : null;
            const selGroups = new Set((sceneData?.groups || []).map(g => g.group?.id ? String(g.group.id) : '').filter(Boolean));

            ctx.setSelectedTags(selTags);
            ctx.setSelectedPerformers(selPerfs);
            ctx.setSelectedStudio(selStud);
            ctx.setSelectedGroups(selGroups);
            ctx.setInitialTags(new Set(selTags));
            ctx.setInitialPerformers(new Set(selPerfs));
            ctx.setInitialStudio(selStud);
            ctx.setInitialGroups(new Set(selGroups));

            setupSequentialEditEverythingHandlers(popup, sceneId, cardElement, ctx.doSave);

            await Promise.all([
                ctx.fetchColumnData('tags', popup.tagsTable, '', selTags),
                ctx.fetchColumnData('performers', popup.performersTable, '', selPerfs)
            ]);

            const tagHolder = popup.tags.tableContainer?.querySelector('.tabulator-tableholder');
            if (tagHolder) tagHolder.scrollTop = 0;
            const perfHolder = popup.performers.tableContainer?.querySelector('.tabulator-tableholder');
            if (perfHolder) perfHolder.scrollTop = 0;

            await Promise.all([
                ctx.renderStudioBar(''),
                ctx.renderGroupBar('')
            ]);
            ctx.refreshAllUI();

            const shouldAutoOpenScraper = (isScraperHudPersistedOpen() || (getAutoScrapeSequential() && sequentialEditState.enabled && window._fastTagEverythingScraperOpen));
            if (shouldAutoOpenScraper) {
                window._fastTagEverythingScraperOpen = true;
                setTimeout(() => {
                    if (typeof popup.triggerScrape === 'function') {
                        popup.triggerScrape(true, sceneId, cardElement);
                    }
                }, 80);
            }

            if (getGeminiAutoParse() && getGeminiApiKey()) {
                setTimeout(() => {
                    if (typeof popup.triggerAIParse === 'function') {
                        popup.triggerAIParse(true, sceneId, cardElement);
                    }
                }, 100);
            }

            await loadUnifiedSuggestions(sceneId, cardElement, popup.suggestionsContainer, {
                selectedTagIds: ctx.getSelectedTags(),
                selectedPerformerIds: ctx.getSelectedPerformers(),
                selectedStudioId: () => ctx.getSelectedStudio(),
                selectedGroupIds: ctx.getSelectedGroups(),
                setStudioId: (id) => { ctx.setSelectedStudio(id); },
                addGroupId: (id) => { const grps = ctx.getSelectedGroups(); if (grps) grps.add(String(id)); },
                tagsTable: popup.tagsTable,
                performersTable: popup.performersTable,
                fetchColumnData: ctx.fetchColumnData,
                renderStudioBar: ctx.renderStudioBar,
                renderGroupBar: ctx.renderGroupBar,
                onSuggestionActivated: ctx.onSuggestionActivated,
                doSave: ctx.doSave,
                refreshAllUI: ctx.refreshAllUI
            });

            setTimeout(() => {
                if (typeof ctx.resetNavState === 'function') {
                    ctx.resetNavState();
                }
                if (popup.globalSearch && document.body.contains(popup.globalSearch)) {
                    popup.globalSearch.focus({ preventScroll: true });
                }
            }, 60);
        } catch (err) {
            console.error('[FastTag] Error in loadEditEverythingDataIntoPopup:', err);
            toastError(`Error loading data: ${err?.message || err}`);
        }
    }

    function renderEverythingAIMatchCard(container, aiResult, sceneId, popup, ctx) {
        if (!container) return;
        const hasSuggestion = aiResult && (
            (typeof aiResult.clean_title === 'string' && aiResult.clean_title.trim())
            || (typeof aiResult.date === 'string' && aiResult.date.trim())
            || (typeof aiResult.studio === 'string' && aiResult.studio.trim())
            || (Array.isArray(aiResult.performers) && aiResult.performers.length > 0)
            || (Array.isArray(aiResult.tags) && aiResult.tags.length > 0)
        );
        if (!hasSuggestion) {
            container.style.display = 'none';
            container.innerHTML = '';
            return;
        }

        const isDark = getEffectiveTheme() === 'dark';
        const cardBg = isDark ? 'linear-gradient(135deg, rgba(88, 28, 135, 0.22) 0%, rgba(15, 23, 42, 0.85) 100%)' : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)';
        const cardBorder = isDark ? '1px solid rgba(168, 85, 247, 0.45)' : '1px solid #c084fc';
        const textMain = isDark ? '#ffffff' : '#1e1b4b';
        const textSub = isDark ? '#c084fc' : '#7e22ce';

        const allTags = getCachedOrNull('tags') || [];
        const allPerformers = getCachedOrNull('performers') || [];
        const allStudios = getCachedOrNull('studios') || [];
        const selTagIds = ctx?.getSelectedTags ? ctx.getSelectedTags() : (ctx?.selectedTagIds || new Set());
        const selPerfIds = ctx?.getSelectedPerformers ? ctx.getSelectedPerformers() : (ctx?.selectedPerformerIds || new Set());
        const selStudioId = ctx?.getSelectedStudio ? ctx.getSelectedStudio() : null;

        const matchesEntityName = (candidateName, searchName) => {
            if (!candidateName || !searchName) return false;
            const cClean = normalizeTextForSuggestions(candidateName);
            const sClean = normalizeTextForSuggestions(searchName);
            if (cClean === sClean) return true;
            const cNoSpace = cClean.replace(/\s+/g, '');
            const sNoSpace = sClean.replace(/\s+/g, '');
            return cNoSpace.length > 0 && cNoSpace === sNoSpace;
        };

        // Match performers by name/alias
        const matchedPerformers = (aiResult.performers || []).map(pName => {
            const found = allPerformers.find(p => {
                if (matchesEntityName(p.name, pName)) return true;
                if (p.alias_list && p.alias_list.some(a => matchesEntityName(a, pName))) return true;
                return false;
            });
            const possibleItem = found ? null : findUniqueSelectedPerformerComponentMatch(allPerformers, selPerfIds, pName);
            return { rawName: pName, item: found, matched: !!found, possibleItem };
        });

        // Match studio by name/alias
        let matchedStudio = null;
        if (aiResult.studio) {
            matchedStudio = allStudios.find(s => {
                if (matchesEntityName(s.name, aiResult.studio)) return true;
                if (s.aliases && s.aliases.some(a => matchesEntityName(a, aiResult.studio))) return true;
                return false;
            });
        }

        // Match tags by name/alias
        const matchedTags = (aiResult.tags || []).map(tName => {
            const found = allTags.find(t => {
                if (matchesEntityName(t.name, tName)) return true;
                if (t.aliases && t.aliases.some(a => matchesEntityName(a, tName))) return true;
                return false;
            });
            return { rawName: tName, item: found, matched: !!found };
        });

        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.background = cardBg;
        container.style.border = cardBorder;
        container.style.borderRadius = '8px';
        container.style.padding = '8px 10px';
        container.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.15)';

        const isStudioAlreadySelected = matchedStudio && selStudioId && String(selStudioId) === String(matchedStudio.id);

        container.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="font-size: 13px;">✨</span>
                    <strong style="font-size: 12px; color: ${textMain};">Google Gemini AI Suggestions</strong>
                    ${aiResult.confidence ? `<span style="font-size: 10px; background: rgba(168, 85, 247, 0.25); color: ${textSub}; font-weight: 700; padding: 1.5px 6px; border-radius: 999px;">${aiResult.confidence}% match</span>` : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button type="button" id="fasttag-ai-apply-all-btn" style="background: linear-gradient(135deg, #9333ea 0%, #6366f1 100%); color: #ffffff; border: none; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 6px rgba(147, 51, 234, 0.4); transition: transform 0.1s ease;">
                        <span>🚀 Apply All</span>
                    </button>
                    <button type="button" id="fasttag-ai-close-card-btn" style="background: none; border: none; color: ${isDark ? '#94a3b8' : '#64748b'}; font-size: 14px; cursor: pointer; padding: 2px 4px; line-height: 1;">✕</button>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 5px; font-size: 11.5px;">
                <!-- Clean Title -->
                ${aiResult.clean_title ? `
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; background: rgba(0,0,0,0.15); padding: 3px 6px; border-radius: 5px;">
                        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                            <span style="color: ${textSub}; font-weight: 600;">Title:</span>
                            <span style="color: ${textMain}; font-weight: 500; margin-left: 4px;">"${escapeHtml(aiResult.clean_title)}"</span>
                        </div>
                        <button type="button" id="fasttag-ai-apply-title-btn" style="background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.5); color: ${textSub}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; cursor: pointer; flex-shrink: 0;">Set Title</button>
                    </div>
                ` : ''}

                <!-- Date & Studio -->
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                    ${aiResult.date ? `
                        <div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.15); padding: 2px 6px; border-radius: 5px;">
                            <span style="color: ${textSub}; font-weight: 600;">Date:</span>
                            <span style="color: ${textMain};">${escapeHtml(aiResult.date)}</span>
                            <button type="button" id="fasttag-ai-apply-date-btn" style="background: none; border: 1px solid rgba(168,85,247,0.4); color: ${textSub}; font-size: 9.5px; font-weight: 700; padding: 1px 4px; border-radius: 4px; cursor: pointer; margin-left: 2px;">Set</button>
                        </div>
                    ` : ''}

                    ${aiResult.studio ? `
                        <div style="display: flex; align-items: center; gap: 4px; background: rgba(0,0,0,0.15); padding: 2px 6px; border-radius: 5px;">
                            <span style="color: ${textSub}; font-weight: 600;">Studio:</span>
                            <span style="color: ${textMain}; font-weight: 600;">${escapeHtml(matchedStudio ? matchedStudio.name : aiResult.studio)}</span>
                            ${matchedStudio ? `
                                <button type="button" id="fasttag-ai-apply-studio-btn" style="background: ${isStudioAlreadySelected ? '#059669' : '#4f46e5'}; color: #fff; border: none; font-size: 9.5px; font-weight: 700; padding: 1px 5px; border-radius: 4px; cursor: pointer;">${isStudioAlreadySelected ? '✓ Set' : '+ Set'}</button>
                            ` : `
                                <button type="button" id="fasttag-ai-create-studio-btn" data-name="${escapeHtml(aiResult.studio)}" style="background: rgba(168, 85, 247, 0.2); border: 1px dashed rgba(168, 85, 247, 0.6); color: ${isDark ? '#e9d5ff' : '#7e22ce'}; font-size: 9.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px; cursor: pointer;" title="Create '${escapeHtml(aiResult.studio)}' studio in Stash & set as scene studio">+ Create</button>
                            `}
                        </div>
                    ` : ''}
                </div>

                <!-- Performers -->
                ${matchedPerformers.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                        <span style="color: ${textSub}; font-weight: 600; font-size: 11px;">Performers:</span>
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${matchedPerformers.map((p) => {
                                if (p.matched) {
                                    const isAdded = selPerfIds && selPerfIds.has(String(p.item.id));
                                    const pillBg = isAdded ? '#059669' : 'rgba(56, 189, 248, 0.18)';
                                    const pillBorder = isAdded ? '1px solid #059669' : '1px solid rgba(56, 189, 248, 0.5)';
                                    const pillColor = isAdded ? '#ffffff' : (isDark ? '#bae6fd' : '#0369a1');
                                    const pillText = isAdded ? `✓ ${escapeHtml(p.item.name)}` : `+ ${escapeHtml(p.item.name)}`;
                                    return `<button type="button" class="fasttag-ai-chip-perf" data-id="${p.item.id}" style="background: ${pillBg}; border: ${pillBorder}; color: ${pillColor}; font-size: 10px; font-weight: 600; padding: 1.5px 6px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; gap: 2px;" title="${isAdded ? 'Already added to scene' : 'Add to scene'}">${pillText}</button>`;
                                } else if (p.possibleItem) {
                                    return `<span style="display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap;"><span style="background: rgba(245, 158, 11, 0.16); border: 1px solid rgba(245, 158, 11, 0.7); color: ${isDark ? '#fde68a' : '#92400e'}; font-size: 10px; font-weight: 650; padding: 1.5px 7px; border-radius: 999px;" title="Gemini returned '${escapeHtml(p.rawName)}'; this may refer to the performer already linked to the scene.">⚠ ${escapeHtml(p.rawName)} → ${escapeHtml(p.possibleItem.name)}?</span><button type="button" class="fasttag-ai-chip-create-perf" data-name="${escapeHtml(p.rawName)}" style="background: rgba(168, 85, 247, 0.15); border: 1px dashed rgba(168, 85, 247, 0.6); color: ${isDark ? '#e9d5ff' : '#7e22ce'}; font-size: 10px; font-weight: 600; padding: 1.5px 7px; border-radius: 999px; cursor: pointer;" title="Create '${escapeHtml(p.rawName)}' only if this is a different performer">+ Create separately</button></span>`;
                                } else {
                                    return `<button type="button" class="fasttag-ai-chip-create-perf" data-name="${escapeHtml(p.rawName)}" style="background: rgba(168, 85, 247, 0.15); border: 1px dashed rgba(168, 85, 247, 0.6); color: ${isDark ? '#e9d5ff' : '#7e22ce'}; font-size: 10px; font-weight: 600; padding: 1.5px 7px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; gap: 3px;" title="Create '${escapeHtml(p.rawName)}' in Stash & add to scene">+ Create "${escapeHtml(p.rawName)}"</button>`;
                                }
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Tags -->
                ${matchedTags.length > 0 ? `
                    <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                        <span style="color: ${textSub}; font-weight: 600; font-size: 11px;">Tags:</span>
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            ${matchedTags.map((t) => {
                                if (t.matched) {
                                    const isAdded = selTagIds && selTagIds.has(String(t.item.id));
                                    const pillBg = isAdded ? '#059669' : 'rgba(99, 102, 241, 0.18)';
                                    const pillBorder = isAdded ? '1px solid #059669' : '1px solid rgba(99, 102, 241, 0.5)';
                                    const pillColor = isAdded ? '#ffffff' : (isDark ? '#c7d2fe' : '#4338ca');
                                    const pillText = isAdded ? `✓ ${escapeHtml(t.item.name)}` : `+ ${escapeHtml(t.item.name)}`;
                                    return `<button type="button" class="fasttag-ai-chip-tag" data-id="${t.item.id}" style="background: ${pillBg}; border: ${pillBorder}; color: ${pillColor}; font-size: 10px; font-weight: 600; padding: 1.5px 6px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; gap: 2px;" title="${isAdded ? 'Already added to scene' : 'Add to scene'}">${pillText}</button>`;
                                } else {
                                    return `<button type="button" class="fasttag-ai-chip-create-tag" data-name="${escapeHtml(t.rawName)}" style="background: rgba(168, 85, 247, 0.15); border: 1px dashed rgba(168, 85, 247, 0.6); color: ${isDark ? '#e9d5ff' : '#7e22ce'}; font-size: 10px; font-weight: 600; padding: 1.5px 7px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; gap: 3px;" title="Create tag '${escapeHtml(t.rawName)}' in Stash & add to scene">+ Create "${escapeHtml(t.rawName)}"</button>`;
                                }
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // Wire event handlers on the AI Match Card
        const closeBtn = container.querySelector('#fasttag-ai-close-card-btn');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.preventDefault();
                container.style.display = 'none';
                container.innerHTML = '';
            };
        }

        const applyTitleBtn = container.querySelector('#fasttag-ai-apply-title-btn');
        if (applyTitleBtn && aiResult.clean_title) {
            applyTitleBtn.onclick = async (e) => {
                e.preventDefault();
                try {
                    const titleRes = await fetchGQL(`mutation DirectSceneUpdate($input: SceneUpdateInput!) { sceneUpdate(input: $input) { ${SCENE_CARD_UPDATE_FIELDS} title } }`, {
                        input: { id: sceneId, title: aiResult.clean_title }
                    });
                    if (titleRes?.errors?.length || !titleRes?.data?.sceneUpdate?.id) {
                        throw new Error(titleRes?.errors?.map(error => error.message).join('; ') || 'Stash did not return the updated scene.');
                    }
                    syncSceneToApolloCache(titleRes.data.sceneUpdate);
                    setLiveEverythingPopupTitle(popup, aiResult.clean_title);
                    applyTitleBtn.textContent = '✓ Set';
                    applyTitleBtn.disabled = true;
                    applyTitleBtn.style.background = '#059669';
                    applyTitleBtn.style.color = '#fff';
                    toastSuccess(`Updated Scene Title to "${aiResult.clean_title}"`);
                    await refreshSceneCards(sceneId);
                } catch (err) {
                    toastError(`Failed to update title: ${err.message}`);
                }
            };
        }

        const applyDateBtn = container.querySelector('#fasttag-ai-apply-date-btn');
        if (applyDateBtn && aiResult.date) {
            applyDateBtn.onclick = async (e) => {
                e.preventDefault();
                try {
                    const dateRes = await fetchGQL(`mutation DirectSceneUpdate($input: SceneUpdateInput!) { sceneUpdate(input: $input) { ${SCENE_CARD_UPDATE_FIELDS} date } }`, {
                        input: { id: sceneId, date: aiResult.date }
                    });
                    if (dateRes?.data?.sceneUpdate) {
                        syncSceneToApolloCache(dateRes.data.sceneUpdate);
                    }
                    applyDateBtn.textContent = '✓ Set';
                    applyDateBtn.disabled = true;
                    applyDateBtn.style.background = '#059669';
                    applyDateBtn.style.color = '#fff';
                    toastSuccess(`Updated Scene Date to ${aiResult.date}`);
                    await refreshSceneCards(sceneId);
                } catch (err) {
                    toastError(`Failed to update date: ${err.message}`);
                }
            };
        }

        const applyStudioBtn = container.querySelector('#fasttag-ai-apply-studio-btn');
        if (applyStudioBtn && matchedStudio) {
            applyStudioBtn.onclick = async (e) => {
                e.preventDefault();
                if (typeof ctx.setSelectedStudio === 'function') {
                    ctx.setSelectedStudio(String(matchedStudio.id));
                }
                addRecentEntry('studios', matchedStudio);
                if (typeof ctx.renderStudioBar === 'function') {
                    ctx.renderStudioBar('');
                }
                if (typeof ctx.refreshAllUI === 'function') {
                    ctx.refreshAllUI();
                }
                if (typeof ctx.doSave === 'function') {
                    await ctx.doSave(`Studio set to "${matchedStudio.name}"`);
                }
                applyStudioBtn.textContent = '✓';
                applyStudioBtn.disabled = true;
            };
        }

        const createStudioBtn = container.querySelector('#fasttag-ai-create-studio-btn');
        if (createStudioBtn) {
            createStudioBtn.onclick = async (e) => {
                e.preventDefault();
                const rawName = createStudioBtn.getAttribute('data-name');
                if (!rawName) return;
                createStudioBtn.disabled = true;
                createStudioBtn.textContent = '⏳ Creating...';
                try {
                    const res = await fetchGQL(ENTITY_CONFIG.studios.createQuery, ENTITY_CONFIG.studios.createVariables(rawName));
                    const newId = ENTITY_CONFIG.studios.createExtract(res.data);
                    if (newId) {
                        invalidateCache('studios');
                        if (typeof ctx.setSelectedStudio === 'function') {
                            ctx.setSelectedStudio(String(newId));
                        }
                        addRecentEntry('studios', { id: newId, name: rawName });
                        if (typeof ctx.renderStudioBar === 'function') {
                            await ctx.renderStudioBar('');
                        }
                        if (typeof ctx.refreshAllUI === 'function') ctx.refreshAllUI();
                        if (typeof ctx.doSave === 'function') {
                            await ctx.doSave(`Created & set studio "${rawName}"`);
                        }
                        createStudioBtn.style.background = '#059669';
                        createStudioBtn.style.border = 'none';
                        createStudioBtn.style.color = '#fff';
                        createStudioBtn.textContent = '✓ Set';
                        toastSuccess(`Created & set studio "${rawName}"`);
                    } else {
                        createStudioBtn.disabled = false;
                        createStudioBtn.textContent = '+ Create';
                        toastError(`Failed to create studio "${rawName}"`);
                    }
                } catch (err) {
                    createStudioBtn.disabled = false;
                    createStudioBtn.textContent = '+ Create';
                    toastError(`Error creating studio: ${err.message}`);
                }
            };
        }

        container.querySelectorAll('.fasttag-ai-chip-perf').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                const pId = btn.getAttribute('data-id');
                const perfSet = ctx.getSelectedPerformers ? ctx.getSelectedPerformers() : ctx.selectedPerformerIds;
                if (pId && perfSet) {
                    perfSet.add(String(pId));
                    const item = allPerformers.find(p => String(p.id) === String(pId));
                    if (item) addRecentEntry('performers', item);
                    if (typeof ctx.fetchColumnData === 'function') {
                        await ctx.fetchColumnData('performers', popup.performersTable, '', perfSet);
                    }
                    if (typeof ctx.refreshAllUI === 'function') ctx.refreshAllUI();
                    if (typeof ctx.doSave === 'function') {
                        await ctx.doSave(`Added performer "${item?.name || pId}"`);
                    }
                    btn.style.background = '#059669';
                    btn.style.color = '#fff';
                    btn.textContent = `✓ ${btn.textContent.replace(/^\+\s*/, '')}`;
                }
            };
        });

        container.querySelectorAll('.fasttag-ai-chip-create-perf').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                const rawName = btn.getAttribute('data-name');
                if (!rawName) return;
                btn.disabled = true;
                btn.textContent = '⏳ Creating...';
                try {
                    const res = await fetchGQL(ENTITY_CONFIG.performers.createQuery, ENTITY_CONFIG.performers.createVariables(rawName));
                    const newId = ENTITY_CONFIG.performers.createExtract(res.data);
                    if (newId) {
                        invalidateCache('performers');
                        const perfSet = ctx.getSelectedPerformers ? ctx.getSelectedPerformers() : ctx.selectedPerformerIds;
                        if (perfSet) perfSet.add(String(newId));
                        addRecentEntry('performers', { id: newId, name: rawName });
                        if (typeof ctx.fetchColumnData === 'function') {
                            await ctx.fetchColumnData('performers', popup.performersTable, '', perfSet);
                        }
                        if (typeof ctx.refreshAllUI === 'function') ctx.refreshAllUI();
                        if (typeof ctx.doSave === 'function') {
                            await ctx.doSave(`Created & added performer "${rawName}"`);
                        }
                        btn.style.background = '#059669';
                        btn.style.border = 'none';
                        btn.style.color = '#fff';
                        btn.textContent = `✓ ${rawName}`;
                        toastSuccess(`Created & added performer "${rawName}"`);
                    } else {
                        btn.disabled = false;
                        btn.textContent = `+ Create "${rawName}"`;
                        toastError(`Failed to create performer "${rawName}"`);
                    }
                } catch (err) {
                    btn.disabled = false;
                    btn.textContent = `+ Create "${rawName}"`;
                    toastError(`Error creating performer: ${err.message}`);
                }
            };
        });

        container.querySelectorAll('.fasttag-ai-chip-tag').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                const tId = btn.getAttribute('data-id');
                const tagSet = ctx.getSelectedTags ? ctx.getSelectedTags() : ctx.selectedTagIds;
                if (tId && tagSet) {
                    tagSet.add(String(tId));
                    const item = allTags.find(t => String(t.id) === String(tId));
                    if (item) addRecentEntry('tags', item);
                    if (typeof ctx.fetchColumnData === 'function') {
                        await ctx.fetchColumnData('tags', popup.tagsTable, '', tagSet);
                    }
                    if (typeof ctx.refreshAllUI === 'function') ctx.refreshAllUI();
                    if (typeof ctx.doSave === 'function') {
                        await ctx.doSave(`Added tag "${item?.name || tId}"`);
                    }
                    btn.style.background = '#059669';
                    btn.style.color = '#fff';
                    btn.textContent = `✓ ${btn.textContent.replace(/^\+\s*/, '')}`;
                }
            };
        });

        container.querySelectorAll('.fasttag-ai-chip-create-tag').forEach(btn => {
            btn.onclick = async (e) => {
                e.preventDefault();
                const rawName = btn.getAttribute('data-name');
                if (!rawName) return;
                btn.disabled = true;
                btn.textContent = '⏳ Creating...';
                try {
                    const res = await fetchGQL(ENTITY_CONFIG.tags.createQuery, ENTITY_CONFIG.tags.createVariables(rawName));
                    const newId = ENTITY_CONFIG.tags.createExtract(res.data);
                    if (newId) {
                        invalidateCache('tags');
                        const tagSet = ctx.getSelectedTags ? ctx.getSelectedTags() : ctx.selectedTagIds;
                        if (tagSet) tagSet.add(String(newId));
                        addRecentEntry('tags', { id: newId, name: rawName });
                        if (typeof ctx.fetchColumnData === 'function') {
                            await ctx.fetchColumnData('tags', popup.tagsTable, '', tagSet);
                        }
                        if (typeof ctx.refreshAllUI === 'function') ctx.refreshAllUI();
                        if (typeof ctx.doSave === 'function') {
                            await ctx.doSave(`Created & added tag "${rawName}"`);
                        }
                        btn.style.background = '#059669';
                        btn.style.border = 'none';
                        btn.style.color = '#fff';
                        btn.textContent = `✓ ${rawName}`;
                        toastSuccess(`Created & added tag "${rawName}"`);
                    } else {
                        btn.disabled = false;
                        btn.textContent = `+ Create "${rawName}"`;
                        toastError(`Failed to create tag "${rawName}"`);
                    }
                } catch (err) {
                    btn.disabled = false;
                    btn.textContent = `+ Create "${rawName}"`;
                    toastError(`Error creating tag: ${err.message}`);
                }
            };
        });

        const applyAllBtn = container.querySelector('#fasttag-ai-apply-all-btn');
        if (applyAllBtn) {
            applyAllBtn.onclick = async (e) => {
                e.preventDefault();
                applyAllBtn.disabled = true;
                applyAllBtn.textContent = '⏳ Applying...';

                try {
                    const updateVars = { id: sceneId };
                    if (aiResult.clean_title) updateVars.title = aiResult.clean_title;
                    if (aiResult.date) updateVars.date = aiResult.date;

                    if (matchedStudio && typeof ctx.setSelectedStudio === 'function') {
                        ctx.setSelectedStudio(String(matchedStudio.id));
                        addRecentEntry('studios', matchedStudio);
                    } else if (!matchedStudio && aiResult.studio && typeof ctx.setSelectedStudio === 'function') {
                        try {
                            const res = await fetchGQL(ENTITY_CONFIG.studios.createQuery, ENTITY_CONFIG.studios.createVariables(aiResult.studio));
                            const newId = ENTITY_CONFIG.studios.createExtract(res.data);
                            if (newId) {
                                invalidateCache('studios');
                                ctx.setSelectedStudio(String(newId));
                                addRecentEntry('studios', { id: newId, name: aiResult.studio });
                            }
                        } catch (e) {}
                    }

                    const perfSet = ctx.getSelectedPerformers ? ctx.getSelectedPerformers() : ctx.selectedPerformerIds;
                    for (const p of matchedPerformers) {
                        if (p.matched && perfSet) {
                            perfSet.add(String(p.item.id));
                            addRecentEntry('performers', p.item);
                        } else if (!p.matched && !p.possibleItem && p.rawName && perfSet) {
                            try {
                                const res = await fetchGQL(ENTITY_CONFIG.performers.createQuery, ENTITY_CONFIG.performers.createVariables(p.rawName));
                                const newId = ENTITY_CONFIG.performers.createExtract(res.data);
                                if (newId) {
                                    invalidateCache('performers');
                                    perfSet.add(String(newId));
                                    addRecentEntry('performers', { id: newId, name: p.rawName });
                                }
                            } catch (e) {}
                        }
                    }

                    const tagSet = ctx.getSelectedTags ? ctx.getSelectedTags() : ctx.selectedTagIds;
                    for (const t of matchedTags) {
                        if (t.matched && tagSet) {
                            tagSet.add(String(t.item.id));
                            addRecentEntry('tags', t.item);
                        } else if (!t.matched && t.rawName && tagSet) {
                            try {
                                const res = await fetchGQL(ENTITY_CONFIG.tags.createQuery, ENTITY_CONFIG.tags.createVariables(t.rawName));
                                const newId = ENTITY_CONFIG.tags.createExtract(res.data);
                                if (newId) {
                                    invalidateCache('tags');
                                    tagSet.add(String(newId));
                                    addRecentEntry('tags', { id: newId, name: t.rawName });
                                }
                            } catch (e) {}
                        }
                    }

                    if (updateVars.title || updateVars.date) {
                        const metadataRes = await fetchGQL(`mutation FastTagAIApplyMetadata($input: SceneUpdateInput!) { sceneUpdate(input: $input) { ${SCENE_CARD_UPDATE_FIELDS} title date } }`, {
                            input: updateVars
                        });
                        if (metadataRes?.errors?.length || !metadataRes?.data?.sceneUpdate?.id) {
                            throw new Error(metadataRes?.errors?.map(error => error.message).join('; ') || 'Stash did not return the updated scene.');
                        }
                        syncSceneToApolloCache(metadataRes.data.sceneUpdate);
                        if (aiResult.clean_title) setLiveEverythingPopupTitle(popup, aiResult.clean_title);
                    }

                    if (typeof ctx.renderStudioBar === 'function') {
                        ctx.renderStudioBar('');
                    }

                    if (typeof ctx.fetchColumnData === 'function') {
                        await Promise.all([
                            ctx.fetchColumnData('tags', popup.tagsTable, '', tagSet || new Set()),
                            ctx.fetchColumnData('performers', popup.performersTable, '', perfSet || new Set())
                        ]);
                    }

                    if (typeof ctx.refreshAllUI === 'function') {
                        ctx.refreshAllUI();
                    }

                    if (typeof ctx.doSave === 'function') {
                        await ctx.doSave('Applied all Gemini AI suggestions');
                    }

                    applyAllBtn.style.background = '#059669';
                    applyAllBtn.innerHTML = '<span>✓ Applied All!</span>';
                    showToast('✓ Successfully applied Gemini AI metadata!', 'success');
                    await refreshSceneCards(sceneId);
                } catch (err) {
                    applyAllBtn.disabled = false;
                    applyAllBtn.innerHTML = '<span>🚀 Apply All</span>';
                    toastError(`Failed to apply AI metadata: ${err.message}`);
                }
            };
        }
    }

    async function openEditEverythingPopup(sceneId, cardElement, isRandomMode = false, randomCount = 0) {
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
                activePopup._isRandomMode = isRandomMode;
                activePopup._randomUntaggedCount = randomCount;
                if (isRandomMode) {
                    sequentialEditState.enabled = false;
                    activePopup._randomHistoryState = createRandomSceneHistory(sceneId, randomCount);
                } else {
                    activePopup._randomHistoryState = null;
                }
                await loadEditEverythingDataIntoPopup(sceneId, cardElement, activePopup);
                return;
            }

            closePopup(false);
            window._fastTagEverythingScraperOpen = false;

            popupAbortController = new AbortController();
            const { signal } = popupAbortController;

            const popup = createEditEverythingPopupShell();
            popup.type = 'everything';
            popup._isRandomMode = isRandomMode;
            popup._randomUntaggedCount = randomCount;
            popup._randomHistoryState = isRandomMode ? createRandomSceneHistory(sceneId, randomCount) : null;
            if (isRandomMode) {
                sequentialEditState.enabled = false;
            }
            activePopup = popup;
            const form = popup.element;
            positionPopupNearCard(form, cardElement);

            let selectedTagIds = new Set();
            let selectedPerformerIds = new Set();
            let selectedStudioId = null;
            let selectedGroupIds = new Set();
            let initialTagIds = new Set();
            let initialPerformerIds = new Set();
            let initialStudioId = null;
            let initialGroupIds = new Set();
            let isRestoring = false;
            let currentSceneId = sceneId;

            // Initialize Tabulator tables with cached data immediately so there's zero placeholder flash
            const tagsTable = new Tabulator(popup.tags.tableContainer, {
                data: getCachedOrNull('tags') || [],
                layout: "fitColumns",
                columnResizeMode: "fit",
                height: "100%",
                placeholder: () => getCachedOrNull('tags') ? "No Tags Found" : "Loading Tags...",
                selectable: true,
                index: "id",
                rowFormatter: (row) => {
                    const d = row.getData();
                    if (d && (d._isVirtualOrganized || d.id === '⚡' || d.id === '◯' || d.id === '✓')) {
                        const el = row.getElement();
                        el.classList.add('fasttag-virtual-action-row');
                        if (d._isOrganizedState) {
                            el.classList.add('fasttag-action-completed');
                            el.classList.remove('fasttag-action-pending');
                        } else {
                            el.classList.add('fasttag-action-pending');
                            el.classList.remove('fasttag-action-completed');
                        }
                    }
                },
                columnDefaults: { headerSort: false },
                columns: getColumnsWithSavedWidths('tags', 'everything', () => {
                    if (popup.tagsFetchData) popup.tagsFetchData();
                })
            });
            attachColumnWidthSaver(tagsTable, 'tags', 'everything');

            const performersTable = new Tabulator(popup.performers.tableContainer, {
                data: getCachedOrNull('performers') || [],
                layout: "fitColumns",
                columnResizeMode: "fit",
                height: "100%",
                placeholder: () => getCachedOrNull('performers') ? "No Performers Found" : "Loading Performers...",
                selectable: true,
                index: "id",
                columnDefaults: { headerSort: false },
                columns: getColumnsWithSavedWidths('performers', 'everything', () => {
                    if (popup.performersFetchData) popup.performersFetchData();
                })
            });
            attachColumnWidthSaver(performersTable, 'performers', 'everything');
            attachPerformerHoverCard(performersTable, popup.performers.tableContainer);

            popup.tagsTable = tagsTable;
            popup.performersTable = performersTable;

            const isDirty = () => {
                if (selectedStudioId !== initialStudioId) return true;
                if (selectedTagIds.size !== initialTagIds.size) return true;
                if (selectedPerformerIds.size !== initialPerformerIds.size) return true;
                if (selectedGroupIds.size !== initialGroupIds.size) return true;
                for (const id of selectedTagIds) {
                    if (!initialTagIds.has(id)) return true;
                }
                for (const id of selectedPerformerIds) {
                    if (!initialPerformerIds.has(id)) return true;
                }
                for (const id of selectedGroupIds) {
                    if (!initialGroupIds.has(id)) return true;
                }
                return false;
            };

            const updateBadges = () => {
                popup.tags.badge.textContent = `${selectedTagIds.size} selected`;
                popup.performers.badge.textContent = `${selectedPerformerIds.size} selected`;
            };

            const updateSaveButton = () => {
                if (popup._isRandomMode) {
                    if (popup.cancelBtn) {
                        popup.cancelBtn.style.flex = 'none';
                        popup.cancelBtn.style.width = 'auto';
                        popup.cancelBtn.style.fontWeight = '500';
                        popup.cancelBtn.textContent = 'Close';
                    }
                    if (popup.saveBtn) {
                        popup.saveBtn.style.display = 'block';
                        popup.saveBtn.style.flex = '1';
                        popup.saveBtn.disabled = false;
                        popup.saveBtn.style.opacity = '1';
                        popup.saveBtn.style.cursor = 'pointer';
                        if (!popup.saveBtn.classList.contains('fasttag-btn-random')) {
                            popup.saveBtn.className = 'fasttag-btn-random';
                            popup.saveBtn.innerHTML = `<span class="fasttag-dice-icon" style="display: inline-block; margin-right: 6px; font-size: 15px; line-height: 1; vertical-align: middle;">🎲</span>Next Random Scene`;
                        }
                        popup.saveBtn.classList.remove('fasttag-btn-pulse-calm');
                    }
                } else if (sequentialEditState.enabled) {
                    const cards = sequentialEditState.allSceneCards || getAllVisibleSceneCards();
                    const idx = getSceneCardIndex(currentSceneId, cards);
                    const isLast = idx !== -1 && idx === cards.length - 1;

                    if (popup.cancelBtn) {
                        popup.cancelBtn.style.flex = 'none';
                        popup.cancelBtn.style.width = 'auto';
                        popup.cancelBtn.style.fontWeight = '500';
                        popup.cancelBtn.textContent = 'Close';
                    }

                    if (popup.saveBtn) {
                        popup.saveBtn.className = '';
                        popup.saveBtn.style.boxShadow = 'none';
                        popup.saveBtn.style.display = 'block';
                        popup.saveBtn.style.flex = '1';
                        popup.saveBtn.disabled = false;
                        popup.saveBtn.style.opacity = '1';
                        popup.saveBtn.style.cursor = 'pointer';
                        popup.saveBtn.textContent = isLast ? (isEasterEggActive() ? 'Close 🍫' : 'Close') : (isEasterEggActive() ? 'Next Scene 🍫 ►' : 'Next Scene ►');
                        popup.saveBtn.style.background = '#6366f1';
                        popup.saveBtn.classList.remove('fasttag-btn-pulse-calm');
                    }
                } else {
                    if (popup.saveBtn) {
                        popup.saveBtn.className = '';
                        popup.saveBtn.style.display = 'none';
                    }
                    if (popup.cancelBtn) {
                        popup.cancelBtn.style.flex = '1';
                        popup.cancelBtn.style.width = '100%';
                        popup.cancelBtn.style.fontWeight = '600';
                        popup.cancelBtn.textContent = isEasterEggActive() ? 'Done 🍫' : 'Done';
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
                    let curStudio = allStudios.find(s => String(s.id) === String(selectedStudioId));
                    if (!curStudio && popup.sceneData?.studio && String(popup.sceneData.studio.id) === String(selectedStudioId)) {
                        curStudio = popup.sceneData.studio;
                    }
                    if (!curStudio) {
                        const recents = getRecentEntries('studios') || [];
                        curStudio = recents.find(s => String(s.id) === String(selectedStudioId));
                    }
                    if (curStudio) {
                        studioBar.chipName.textContent = curStudio.name;
                        studioBar.chip.style.display = 'inline-flex';
                    } else {
                        studioBar.chipName.textContent = `Studio #${selectedStudioId}`;
                        studioBar.chip.style.display = 'inline-flex';
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
                        emptySpan.textContent = 'Studio';
                        emptySpan.style.cssText = `font-size: 10px; opacity: 0.45; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'}; letter-spacing: 0.3px; user-select: none;`;
                        studioBar.recentContainer.appendChild(emptySpan);
                    }
                    return;
                }

                const matchingStudios = allStudios
                    .filter(s => (s.name || '').toLowerCase().includes(term) && String(s.id) !== String(selectedStudioId))
                    .sort((a, b) => {
                        const aName = (a.name || '').toLowerCase();
                        const bName = (b.name || '').toLowerCase();
                        const aExact = aName === term ? 1 : 0;
                        const bExact = bName === term ? 1 : 0;
                        if (aExact !== bExact) return bExact - aExact;
                        const aStarts = aName.startsWith(term) ? 1 : 0;
                        const bStarts = bName.startsWith(term) ? 1 : 0;
                        if (aStarts !== bStarts) return bStarts - aStarts;
                        const aCount = Number(a.scene_count) || 0;
                        const bCount = Number(b.scene_count) || 0;
                        if (aCount !== bCount) return bCount - aCount;
                        return aName.localeCompare(bName);
                    })
                    .slice(0, 8);

                if (!matchingStudios.length && !selectedStudioId) {
                    const emptySpan = document.createElement('span');
                    emptySpan.textContent = 'No matching studio';
                    emptySpan.style.cssText = `font-size: 10px; opacity: 0.6; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'};`;
                    studioBar.recentContainer.appendChild(emptySpan);
                    return;
                }

                matchingStudios.forEach(st => {
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = 'fasttag-quick-chip chip-studio';
                    chip.title = `Click to set studio to "${st.name}"`;
                    chip.innerHTML = `<span style="color: ${isDark ? '#818cf8' : '#4f46e5'}; font-weight: 700; margin-right: 2px;">+</span> ${escapeHtml(st.name)}`;
                    chip.style.cssText = `padding: 1.5px 6px; border-radius: 999px; font-size: 10px; cursor: pointer; flex-shrink: 0; line-height: 1.2;`;

                    chip.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (selectedStudioId === String(st.id)) {
                            selectedStudioId = null;
                        } else {
                            selectedStudioId = String(st.id);
                            addRecentEntry('studios', st);
                        }
                        popup.globalSearch.value = '';
                        popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                        currentNavSection = 'tags';
                        activeNavIndex = -1;
                        await Promise.all([
                            fetchColumnData('tags', tagsTable, '', selectedTagIds),
                            fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                        ]);
                        refreshAllUI();
                        updateEverythingKeyboardHighlight();
                        await doSave(selectedStudioId ? `Studio "${st.name}" assigned` : 'Studio removed');
                        popup.globalSearch.focus({ preventScroll: true });
                    };

                    studioBar.recentContainer.appendChild(chip);
                });
            };

            const renderGroupBar = async (searchQuery = '') => {
                const groupsBar = popup.groupsBar;
                if (!groupsBar) return;

                let allGroups = getCachedOrNull('groups');
                if (!allGroups) {
                    try {
                        const res = await fetchGQL(ENTITY_CONFIG.groups.fetchQuery);
                        allGroups = ENTITY_CONFIG.groups.extractList(res?.data);
                        if (!allGroups || !allGroups.length) {
                            allGroups = res?.data?.findGroups?.groups || res?.data?.findMovies?.movies || [];
                        }
                    } catch (e) {
                        allGroups = [];
                    }
                    setCache('groups', allGroups);
                }
                if (!allGroups) return;

                groupsBar.selectedContainer.innerHTML = '';
                selectedGroupIds.forEach(id => {
                    const grp = allGroups.find(g => String(g.id) === String(id));
                    const name = grp ? grp.name : `Group #${id}`;
                    const pill = document.createElement('div');
                    pill.className = 'fasttag-group-pill';
                    pill.style.cssText = `display: inline-flex; align-items: center; gap: 4px; font-weight: 700; padding: 1.5px 6px; border-radius: 999px; font-size: 10px; white-space: nowrap; flex-shrink: 0; cursor: default;`;
                    pill.innerHTML = `
                        <span style="font-weight: 800; font-size: 9.5px; opacity: 0.95;">✓</span>
                        <span>${escapeHtml(name)}</span>
                        <button type="button" class="fasttag-pill-clear-btn" style="background: none; border: none; cursor: pointer; color: #ffffff; font-weight: 700; font-size: 12px; padding: 0 0 0 2.5px; line-height: 1; opacity: 0.85;" title="Remove Group">&times;</button>
                    `;

                    pill.querySelector('button').onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectedGroupIds.delete(String(id));
                        popup.globalSearch.value = '';
                        popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                        currentNavSection = 'tags';
                        activeNavIndex = -1;
                        await Promise.all([
                            fetchColumnData('tags', tagsTable, '', selectedTagIds),
                            fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                        ]);
                        refreshAllUI();
                        updateEverythingKeyboardHighlight();
                        await doSave('Removed from group');
                        popup.globalSearch.focus({ preventScroll: true });
                    };
                    groupsBar.selectedContainer.appendChild(pill);
                });

                const term = searchQuery ? searchQuery.trim().toLowerCase() : '';
                const isDark = getEffectiveTheme() === 'dark';
                groupsBar.recentContainer.innerHTML = '';
                if (!term) {
                    if (selectedGroupIds.size === 0) {
                        const emptySpan = document.createElement('span');
                        emptySpan.textContent = 'Group';
                        emptySpan.style.cssText = `font-size: 10px; opacity: 0.45; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'}; letter-spacing: 0.3px; user-select: none;`;
                        groupsBar.recentContainer.appendChild(emptySpan);
                    }
                    return;
                }

                const matchingGroups = allGroups
                    .filter(g => (g.name || '').toLowerCase().includes(term) && !selectedGroupIds.has(String(g.id)))
                    .sort((a, b) => {
                        const aName = (a.name || '').toLowerCase();
                        const bName = (b.name || '').toLowerCase();
                        const aExact = aName === term ? 1 : 0;
                        const bExact = bName === term ? 1 : 0;
                        if (aExact !== bExact) return bExact - aExact;
                        const aStarts = aName.startsWith(term) ? 1 : 0;
                        const bStarts = bName.startsWith(term) ? 1 : 0;
                        if (aStarts !== bStarts) return bStarts - aStarts;
                        const aCount = Number(a.scene_count) || 0;
                        const bCount = Number(b.scene_count) || 0;
                        if (aCount !== bCount) return bCount - aCount;
                        return (a.name || '').localeCompare(b.name || '');
                    })
                    .slice(0, 8);

                if (!matchingGroups.length && selectedGroupIds.size === 0) {
                    const emptySpan = document.createElement('span');
                    emptySpan.textContent = 'No matching group';
                    emptySpan.style.cssText = `font-size: 10px; opacity: 0.6; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'};`;
                    groupsBar.recentContainer.appendChild(emptySpan);
                    return;
                }

                matchingGroups.forEach(grp => {
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = 'fasttag-quick-chip chip-group';
                    chip.title = `Click to add to group "${grp.name}"`;
                    chip.innerHTML = `<span style="color: ${isDark ? '#c084fc' : '#9333ea'}; font-weight: 700; margin-right: 2px;">+</span> ${escapeHtml(grp.name)}`;
                    chip.style.cssText = `padding: 1.5px 6px; border-radius: 999px; font-size: 10px; cursor: pointer; flex-shrink: 0; line-height: 1.2;`;

                    chip.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectedGroupIds.add(String(grp.id));
                        addRecentEntry('groups', grp);
                        popup.globalSearch.value = '';
                        popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                        currentNavSection = 'tags';
                        activeNavIndex = -1;
                        await Promise.all([
                            fetchColumnData('tags', tagsTable, '', selectedTagIds),
                            fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                        ]);
                        refreshAllUI();
                        updateEverythingKeyboardHighlight();
                        await doSave(`Added to group "${grp.name}"`);
                        popup.globalSearch.focus({ preventScroll: true });
                    };
                    groupsBar.recentContainer.appendChild(chip);
                });
            };

            if (popup.studioBar?.clearBtn) {
                popup.studioBar.clearBtn.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectedStudioId = null;
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    currentNavSection = 'tags';
                    activeNavIndex = -1;
                    await Promise.all([
                        fetchColumnData('tags', tagsTable, '', selectedTagIds),
                        fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                    ]);
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    await doSave('Studio cleared');
                    popup.globalSearch.focus({ preventScroll: true });
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
                let data = Array.from(cached);
                const searchFields = config.searchFields || [config.labelKey];
                if (term) {
                    const tokens = term.split(/\s+/);
                    data = data.filter(item => {
                        const itemSearchStr = searchFields
                            .map(f => String(item[f] || '').trim().toLowerCase())
                            .filter(Boolean)
                            .join(' ');
                        return tokens.every(t => itemSearchStr.includes(t));
                    });
                }

                data.sort(getSmartSortComparator(term, selIds, config.labelKey, searchFields, getSavedSortKey(type)));

                if (type === 'tags' && term && ('organized'.startsWith(term) || 'unorganized'.startsWith(term) || 'organised'.startsWith(term) || 'unorganised'.startsWith(term) || term === 'org')) {
                    const isOrg = popup._organizedController ? popup._organizedController.get() : false;
                    const orgWord = getOrganizedWord('organized');
                    const markWord = getOrganizedWord('mark_as');
                    data.unshift({
                        id: isOrg ? '✓' : '⚡',
                        name: isOrg ? orgWord : markWord,
                        _isVirtualOrganized: true,
                        _isOrganizedState: isOrg
                    });
                }

                isRestoring = true;
                try {
                    await tableInstance.setData(data);
                    selIds.forEach(id => {
                        const r = tableInstance.getRow(id);
                        if (r) tableInstance.selectRow(r);
                    });

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

            popup.tagsFetchData = () => fetchColumnData('tags', tagsTable, popup.globalSearch?.value || '', selectedTagIds);
            popup.performersFetchData = () => fetchColumnData('performers', performersTable, popup.globalSearch?.value || '', selectedPerformerIds);

            const onTagChipSelect = async () => {
                const query = popup.globalSearch?.value || '';
                refreshAllUI();
                const savePromise = doSave('Tags updated');
                await fetchColumnData('tags', tagsTable, query, selectedTagIds);
                refreshAllUI();
                await savePromise;
            };

            const onPerformerChipSelect = async () => {
                const query = popup.globalSearch?.value || '';
                refreshAllUI();
                const savePromise = doSave('Performers updated');
                await fetchColumnData('performers', performersTable, query, selectedPerformerIds);
                refreshAllUI();
                await savePromise;
            };

            if (tagsTable) {
                try {
                    tagsTable.off("rowClick");
                    tagsTable.off("rowSelected");
                    tagsTable.off("rowDeselected");
                } catch (e) {}
            }
            if (performersTable) {
                try {
                    performersTable.off("rowClick");
                    performersTable.off("rowSelected");
                    performersTable.off("rowDeselected");
                } catch (e) {}
            }

            tagsTable.on("rowClick", async (e, row) => {
                const rowData = row.getData();
                if (!rowData || !rowData.id) return;
                const strId = String(rowData.id);

                if (rowData._isVirtualOrganized || strId === '__fasttag_virtual_organized__' || strId === '⚡' || strId === '◯' || strId === '✓') {
                    if (popup.organizedBtn) {
                        popup.organizedBtn.click();
                    }
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    currentNavSection = 'tags';
                    activeNavIndex = -1;
                    await Promise.all([
                        fetchColumnData('tags', tagsTable, '', selectedTagIds),
                        fetchColumnData('performers', performersTable, '', selectedPerformerIds),
                        renderStudioBar(''),
                        renderGroupBar('')
                    ]);
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    if (popup.globalSearch) popup.globalSearch.focus({ preventScroll: true });
                    return;
                }

                const wasSelected = selectedTagIds.has(strId);

                if (wasSelected) {
                    selectedTagIds.delete(strId);
                    tagsTable.deselectRow(row);
                } else {
                    selectedTagIds.add(strId);
                    tagsTable.selectRow(row);
                    addRecentEntry('tags', rowData);
                }

                currentNavSection = 'tags';
                const rows = tagsTable.getRows();
                activeNavIndex = rows.indexOf(row);
                refreshAllUI();
                updateEverythingKeyboardHighlight();
                doSave(wasSelected ? 'Tag removed' : 'Tags updated');

                const hasSearch = popup.globalSearch && popup.globalSearch.value.trim().length > 0;
                if (hasSearch) {
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    await refreshGlobalSearch('');
                    if (!wasSelected) {
                        const r = tagsTable.getRow(rowData.id);
                        if (r) tagsTable.scrollToRow(r, "top", false);
                    } else {
                        try {
                            const holder = tagsTable.element?.querySelector('.tabulator-tableholder') || tagsTable.element;
                            if (holder) holder.scrollTop = 0;
                            const firstRow = tagsTable.getRows()[0];
                            if (firstRow) tagsTable.scrollToRow(firstRow, "top", false);
                        } catch (err) {}
                    }
                    activeNavIndex = -1;
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    popup.globalSearch.focus({ preventScroll: true });
                } else {
                    if (!wasSelected) {
                        if (popup.refreshBtn) {
                            popup.refreshBtn.classList.add('fasttag-refresh-pulse');
                            popup.refreshBtn.title = 'Re-sort columns & pin selected items to top';
                        }
                    } else {
                        await refreshGlobalSearch('');
                    }
                    popup.globalSearch.focus({ preventScroll: true });
                }
            });

            performersTable.on("rowClick", async (e, row) => {
                const rowData = row.getData();
                if (!rowData || !rowData.id) return;
                const strId = String(rowData.id);
                const wasSelected = selectedPerformerIds.has(strId);

                if (wasSelected) {
                    selectedPerformerIds.delete(strId);
                    performersTable.deselectRow(row);
                } else {
                    selectedPerformerIds.add(strId);
                    performersTable.selectRow(row);
                    addRecentEntry('performers', rowData);
                }

                currentNavSection = 'performers';
                const rows = performersTable.getRows();
                activeNavIndex = rows.indexOf(row);
                refreshAllUI();
                updateEverythingKeyboardHighlight();
                doSave(wasSelected ? 'Performer removed' : 'Performers updated');

                const hasSearch = popup.globalSearch && popup.globalSearch.value.trim().length > 0;
                if (hasSearch) {
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    await refreshGlobalSearch('');
                    if (!wasSelected) {
                        const r = performersTable.getRow(rowData.id);
                        if (r) performersTable.scrollToRow(r, "top", false);
                    } else {
                        try {
                            const holder = performersTable.element?.querySelector('.tabulator-tableholder') || performersTable.element;
                            if (holder) holder.scrollTop = 0;
                            const firstRow = performersTable.getRows()[0];
                            if (firstRow) performersTable.scrollToRow(firstRow, "top", false);
                        } catch (err) {}
                    }
                    activeNavIndex = -1;
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    popup.globalSearch.focus({ preventScroll: true });
                } else {
                    if (!wasSelected) {
                        if (popup.refreshBtn) {
                            popup.refreshBtn.classList.add('fasttag-refresh-pulse');
                            popup.refreshBtn.title = 'Re-sort columns & pin selected items to top';
                        }
                    } else {
                        await refreshGlobalSearch('');
                    }
                    popup.globalSearch.focus({ preventScroll: true });
                }
            });

            form.addEventListener('click', (e) => {
                if (!e.target.closest('input, textarea')) {
                    if (popup.globalSearch) {
                        popup.globalSearch.focus({ preventScroll: true });
                    }
                }
            });

            const refreshGlobalSearch = async (val) => {
                const query = (val || '').trim();
                await Promise.all([
                    fetchColumnData('tags', tagsTable, query, selectedTagIds),
                    fetchColumnData('performers', performersTable, query, selectedPerformerIds),
                    renderStudioBar(query),
                    renderGroupBar(query)
                ]);
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
            let currentNavSection = 'tags'; // 'tags' | 'performers' | 'studios' | 'groups' | 'tag-suggestions' | 'perf-suggestions'
            let activeNavIndex = -1;

            const getStudioBarItems = () => {
                const items = [];
                if (popup.studioBar?.chip && popup.studioBar.chip.style.display !== 'none') {
                    items.push({ type: 'studio-selected', el: popup.studioBar.chip, clickTarget: popup.studioBar.clearBtn });
                }
                if (popup.studioBar?.recentContainer) {
                    popup.studioBar.recentContainer.querySelectorAll('.fasttag-quick-chip, .chip-studio').forEach(btn => {
                        items.push({ type: 'studio-chip', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getGroupBarItems = () => {
                const items = [];
                if (popup.groupsBar?.selectedContainer) {
                    popup.groupsBar.selectedContainer.querySelectorAll('.fasttag-group-pill').forEach(pill => {
                        const btn = pill.querySelector('button');
                        items.push({ type: 'group-selected', el: pill, clickTarget: btn || pill });
                    });
                }
                if (popup.groupsBar?.recentContainer) {
                    popup.groupsBar.recentContainer.querySelectorAll('.fasttag-quick-chip, .chip-group').forEach(btn => {
                        items.push({ type: 'group-chip', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getTagSuggestionItems = () => {
                const items = [];
                const box = form.querySelector('#everything-sugg-tags-box');
                if (box && box.style.visibility === 'hidden') return items;
                const container = form.querySelector('#everything-sugg-tags-chips');
                if (container && container.offsetParent !== null) {
                    container.querySelectorAll('.fasttag-suggestion-chip').forEach(btn => {
                        items.push({ type: 'tag-sugg', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getPerformerSuggestionItems = () => {
                const items = [];
                const box = form.querySelector('#everything-sugg-performers-box');
                if (box && box.style.visibility === 'hidden') return items;
                const container = form.querySelector('#everything-sugg-performers-chips');
                if (container && container.offsetParent !== null) {
                    container.querySelectorAll('.fasttag-suggestion-chip').forEach(btn => {
                        items.push({ type: 'perf-sugg', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getTagRecentItems = () => {
                const items = [];
                const container = popup.tags?.chipsContainer;
                if (container && container.style.display !== 'none' && container.offsetParent !== null) {
                    container.querySelectorAll('.fasttag-quick-chip').forEach(btn => {
                        items.push({ type: 'tag-recent', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getPerformerRecentItems = () => {
                const items = [];
                const container = popup.performers?.chipsContainer;
                if (container && container.style.display !== 'none' && container.offsetParent !== null) {
                    container.querySelectorAll('.fasttag-quick-chip').forEach(btn => {
                        items.push({ type: 'perf-recent', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const scrollRowIntoViewIfNeeded = (table, row) => {
                if (!table || !row) return;
                const el = typeof row.getElement === 'function' ? row.getElement() : null;
                const holder = table.element?.querySelector('.tabulator-tableholder');
                if (holder && el) {
                    const holderRect = holder.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    if (elRect.bottom > holderRect.bottom) {
                        holder.scrollTop += (elRect.bottom - holderRect.bottom + 4);
                    } else if (elRect.top < holderRect.top) {
                        holder.scrollTop -= (holderRect.top - elRect.top + 4);
                    }
                } else if (typeof row.scrollTo === 'function') {
                    row.scrollTo('nearest', false);
                }
            };

            const updateEverythingKeyboardHighlight = () => {
                form.querySelectorAll('.tabulator-row.fasttag-keyboard-active').forEach(el => el.classList.remove('fasttag-keyboard-active'));
                form.querySelectorAll('.fasttag-keyboard-meta-focus').forEach(el => el.classList.remove('fasttag-keyboard-meta-focus'));

                form.querySelectorAll('.fasttag-create-empty-btn').forEach(btn => {
                    btn.classList.remove('fasttag-create-btn-active');
                    btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    btn.style.transform = 'none';
                    btn.style.filter = 'none';
                });

                const tagsHeader = form.querySelector('#everything-col-tags span');
                const perfHeader = form.querySelector('#everything-col-performers span');
                if (tagsHeader) {
                    tagsHeader.style.textDecoration = (currentNavSection === 'tags' && activeNavIndex >= 0) ? 'underline 2px #818cf8' : 'none';
                }
                if (perfHeader) {
                    perfHeader.style.textDecoration = (currentNavSection === 'performers' && activeNavIndex >= 0) ? 'underline 2px #38bdf8' : 'none';
                }

                if (currentNavSection === 'studios') {
                    const items = getStudioBarItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'groups') {
                    const items = getGroupBarItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'tag-suggestions') {
                    const items = getTagSuggestionItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'perf-suggestions') {
                    const items = getPerformerSuggestionItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'tag-recent') {
                    const items = getTagRecentItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'perf-recent') {
                    const items = getPerformerRecentItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (activeNavIndex < 0) return;

                const curTable = currentNavSection === 'tags' ? tagsTable : performersTable;
                const curCreateBtn = form.querySelector(`.fasttag-create-empty-btn[data-type="${currentNavSection}"]`);
                const isCreateVisible = curCreateBtn && curCreateBtn.parentElement && curCreateBtn.parentElement.style.display !== 'none';
                const rows = curTable && typeof curTable.getRows === 'function' ? curTable.getRows() : [];

                if (isCreateVisible && activeNavIndex === rows.length) {
                    curCreateBtn.classList.add('fasttag-create-btn-active');
                    curCreateBtn.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.5), 0 2px 8px rgba(0,0,0,0.3)';
                    curCreateBtn.style.transform = 'scale(1.02)';
                    curCreateBtn.style.filter = 'brightness(1.15)';
                    return;
                }

                if (rows.length === 0) return;
                if (activeNavIndex >= rows.length) activeNavIndex = rows.length - 1;

                const targetRow = rows[activeNavIndex];
                if (targetRow) {
                    const el = targetRow.getElement();
                    if (el) el.classList.add('fasttag-keyboard-active');
                    scrollRowIntoViewIfNeeded(curTable, targetRow);
                }
            };

            popup.globalSearch.oninput = () => {
                const val = popup.globalSearch.value.trim();
                const hasVal = val.length > 0;
                popup.globalClear.style.display = hasVal ? 'block' : 'none';
                if (popup.kbdShortcut) popup.kbdShortcut.style.display = hasVal ? 'none' : 'block';
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(async () => {
                    const currentVal = popup.globalSearch ? popup.globalSearch.value.trim() : '';
                    await refreshGlobalSearch(currentVal);
                    if (currentVal.length > 0) {
                        const tagCount = tagsTable ? tagsTable.getRows().length : 0;
                        const perfCount = performersTable ? performersTable.getRows().length : 0;
                        if (tagCount > 0) {
                            currentNavSection = 'tags';
                            activeNavIndex = 0;
                        } else if (perfCount > 0) {
                            currentNavSection = 'performers';
                            activeNavIndex = 0;
                        } else if (getTagSuggestionItems().length > 0) {
                            currentNavSection = 'tag-suggestions';
                            activeNavIndex = 0;
                        } else if (getPerformerSuggestionItems().length > 0) {
                            currentNavSection = 'perf-suggestions';
                            activeNavIndex = 0;
                        } else if (getTagRecentItems().length > 0) {
                            currentNavSection = 'tag-recent';
                            activeNavIndex = 0;
                        } else if (getPerformerRecentItems().length > 0) {
                            currentNavSection = 'perf-recent';
                            activeNavIndex = 0;
                        } else if (getStudioBarItems().length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        } else if (getGroupBarItems().length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'tags';
                            activeNavIndex = -1;
                        }
                    } else {
                        currentNavSection = 'tags';
                        activeNavIndex = -1;
                    }
                    updateEverythingKeyboardHighlight();
                }, 100);
            };

            popup.globalSearch.onkeydown = async (e) => {
                if ((e.altKey && e.code === 'KeyO') || (e.altKey && e.key.toLowerCase() === 'o')) {
                    e.preventDefault();
                    if (popup.organizedBtn) {
                        popup.organizedBtn.click();
                        setTimeout(() => {
                            fetchColumnData('tags', tagsTable, popup.globalSearch?.value || '', selectedTagIds);
                        }, 50);
                    }
                    return;
                }

                if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (currentNavSection === 'studios') {
                        const studioItems = getStudioBarItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const groupItems = getGroupBarItems();
                                if (groupItems.length > 0) {
                                    currentNavSection = 'groups';
                                    activeNavIndex = groupItems.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < studioItems.length - 1) activeNavIndex++;
                            else {
                                const groupItems = getGroupBarItems();
                                if (groupItems.length > 0) {
                                    currentNavSection = 'groups';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'groups') {
                        const groupItems = getGroupBarItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const studioItems = getStudioBarItems();
                                if (studioItems.length > 0) {
                                    currentNavSection = 'studios';
                                    activeNavIndex = studioItems.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < groupItems.length - 1) activeNavIndex++;
                            else {
                                const studioItems = getStudioBarItems();
                                if (studioItems.length > 0) {
                                    currentNavSection = 'studios';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'tag-suggestions') {
                        const tagSuggs = getTagSuggestionItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const perfSuggs = getPerformerSuggestionItems();
                                if (perfSuggs.length > 0) {
                                    currentNavSection = 'perf-suggestions';
                                    activeNavIndex = perfSuggs.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < tagSuggs.length - 1) activeNavIndex++;
                            else {
                                const perfSuggs = getPerformerSuggestionItems();
                                if (perfSuggs.length > 0) {
                                    currentNavSection = 'perf-suggestions';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'perf-suggestions') {
                        const perfSuggs = getPerformerSuggestionItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const tagSuggs = getTagSuggestionItems();
                                if (tagSuggs.length > 0) {
                                    currentNavSection = 'tag-suggestions';
                                    activeNavIndex = tagSuggs.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < perfSuggs.length - 1) activeNavIndex++;
                            else {
                                const tagSuggs = getTagSuggestionItems();
                                if (tagSuggs.length > 0) {
                                    currentNavSection = 'tag-suggestions';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'tag-recent') {
                        const tagRecents = getTagRecentItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const perfRecents = getPerformerRecentItems();
                                if (perfRecents.length > 0) {
                                    currentNavSection = 'perf-recent';
                                    activeNavIndex = perfRecents.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < tagRecents.length - 1) activeNavIndex++;
                            else {
                                const perfRecents = getPerformerRecentItems();
                                if (perfRecents.length > 0) {
                                    currentNavSection = 'perf-recent';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'perf-recent') {
                        const perfRecents = getPerformerRecentItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const tagRecents = getTagRecentItems();
                                if (tagRecents.length > 0) {
                                    currentNavSection = 'tag-recent';
                                    activeNavIndex = tagRecents.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < perfRecents.length - 1) activeNavIndex++;
                            else {
                                const tagRecents = getTagRecentItems();
                                if (tagRecents.length > 0) {
                                    currentNavSection = 'tag-recent';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'tags') {
                        currentNavSection = 'performers';
                        const perfRows = performersTable ? performersTable.getRows() : [];
                        activeNavIndex = perfRows.length > 0 ? Math.min(Math.max(0, activeNavIndex), perfRows.length - 1) : 0;
                    } else if (currentNavSection === 'performers') {
                        currentNavSection = 'tags';
                        const tagRows = tagsTable ? tagsTable.getRows() : [];
                        activeNavIndex = tagRows.length > 0 ? Math.min(Math.max(0, activeNavIndex), tagRows.length - 1) : 0;
                    }
                    updateEverythingKeyboardHighlight();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (activeNavIndex < 0) {
                        const hasVal = (popup.globalSearch?.value || '').trim().length > 0;
                        if (!hasVal) {
                            const tagSuggs = getTagSuggestionItems();
                            const perfSuggs = getPerformerSuggestionItems();
                            const tagRecents = getTagRecentItems();
                            const perfRecents = getPerformerRecentItems();
                            const tagRows = tagsTable ? tagsTable.getRows() : [];
                            const perfRows = performersTable ? performersTable.getRows() : [];
                            const tagCreate = form.querySelector('.fasttag-create-empty-btn[data-type="tags"]');
                            const isTagCreate = tagCreate && tagCreate.parentElement && tagCreate.parentElement.style.display !== 'none';
                            const perfCreate = form.querySelector('.fasttag-create-empty-btn[data-type="performers"]');
                            const isPerfCreate = perfCreate && perfCreate.parentElement && perfCreate.parentElement.style.display !== 'none';

                            if (tagSuggs.length > 0) {
                                currentNavSection = 'tag-suggestions';
                                activeNavIndex = 0;
                            } else if (perfSuggs.length > 0) {
                                currentNavSection = 'perf-suggestions';
                                activeNavIndex = 0;
                            } else if (tagRecents.length > 0) {
                                currentNavSection = 'tag-recent';
                                activeNavIndex = 0;
                            } else if (perfRecents.length > 0) {
                                currentNavSection = 'perf-recent';
                                activeNavIndex = 0;
                            } else if (tagRows.length > 0) {
                                currentNavSection = 'tags';
                                activeNavIndex = 0;
                            } else if (perfRows.length > 0) {
                                currentNavSection = 'performers';
                                activeNavIndex = 0;
                            } else if (isTagCreate) {
                                currentNavSection = 'tags';
                                activeNavIndex = tagRows.length;
                            } else if (isPerfCreate) {
                                currentNavSection = 'performers';
                                activeNavIndex = perfRows.length;
                            }
                        } else {
                            const tagRows = tagsTable ? tagsTable.getRows() : [];
                            const perfRows = performersTable ? performersTable.getRows() : [];
                            const tagCreate = form.querySelector('.fasttag-create-empty-btn[data-type="tags"]');
                            const isTagCreate = tagCreate && tagCreate.parentElement && tagCreate.parentElement.style.display !== 'none';
                            const perfCreate = form.querySelector('.fasttag-create-empty-btn[data-type="performers"]');
                            const isPerfCreate = perfCreate && perfCreate.parentElement && perfCreate.parentElement.style.display !== 'none';

                            if (tagRows.length > 0) {
                                currentNavSection = 'tags';
                                activeNavIndex = 0;
                            } else if (perfRows.length > 0) {
                                currentNavSection = 'performers';
                                activeNavIndex = 0;
                            } else if (isTagCreate) {
                                currentNavSection = 'tags';
                                activeNavIndex = tagRows.length;
                            } else if (isPerfCreate) {
                                currentNavSection = 'performers';
                                activeNavIndex = perfRows.length;
                            } else if (getTagSuggestionItems().length > 0) {
                                currentNavSection = 'tag-suggestions';
                                activeNavIndex = 0;
                            } else if (getPerformerSuggestionItems().length > 0) {
                                currentNavSection = 'perf-suggestions';
                                activeNavIndex = 0;
                            }
                        }
                        updateEverythingKeyboardHighlight();
                        return;
                    }

                    if (currentNavSection === 'studios') {
                        const tagSuggs = getTagSuggestionItems();
                        const tagRecents = getTagRecentItems();
                        if (tagSuggs.length > 0) {
                            currentNavSection = 'tag-suggestions';
                            activeNavIndex = 0;
                        } else if (tagRecents.length > 0) {
                            currentNavSection = 'tag-recent';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'tags';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'groups') {
                        const perfSuggs = getPerformerSuggestionItems();
                        const perfRecents = getPerformerRecentItems();
                        if (perfSuggs.length > 0) {
                            currentNavSection = 'perf-suggestions';
                            activeNavIndex = 0;
                        } else if (perfRecents.length > 0) {
                            currentNavSection = 'perf-recent';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'performers';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'tag-suggestions') {
                        const tagRecents = getTagRecentItems();
                        if (tagRecents.length > 0) {
                            currentNavSection = 'tag-recent';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'tags';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'perf-suggestions') {
                        const perfRecents = getPerformerRecentItems();
                        if (perfRecents.length > 0) {
                            currentNavSection = 'perf-recent';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'performers';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'tag-recent') {
                        currentNavSection = 'tags';
                        activeNavIndex = 0;
                    } else if (currentNavSection === 'perf-recent') {
                        currentNavSection = 'performers';
                        activeNavIndex = 0;
                    } else if (currentNavSection === 'tags') {
                        const rows = tagsTable ? tagsTable.getRows() : [];
                        const curCreateBtn = form.querySelector('.fasttag-create-empty-btn[data-type="tags"]');
                        const isCreate = curCreateBtn && curCreateBtn.parentElement && curCreateBtn.parentElement.style.display !== 'none';
                        if (rows.length > 0) {
                            if (activeNavIndex < 0) activeNavIndex = 0;
                            else if (activeNavIndex < rows.length - 1) activeNavIndex++;
                            else if (activeNavIndex === rows.length - 1 && isCreate) activeNavIndex = rows.length;
                            else {
                                currentNavSection = 'performers';
                                activeNavIndex = 0;
                            }
                        } else if (isCreate && activeNavIndex < rows.length) {
                            activeNavIndex = rows.length;
                        } else {
                            currentNavSection = 'performers';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'performers') {
                        const rows = performersTable ? performersTable.getRows() : [];
                        const curCreateBtn = form.querySelector('.fasttag-create-empty-btn[data-type="performers"]');
                        const isCreate = curCreateBtn && curCreateBtn.parentElement && curCreateBtn.parentElement.style.display !== 'none';
                        if (rows.length > 0) {
                            if (activeNavIndex < 0) activeNavIndex = 0;
                            else if (activeNavIndex < rows.length - 1) activeNavIndex++;
                            else if (activeNavIndex === rows.length - 1 && isCreate) activeNavIndex = rows.length;
                        } else if (isCreate) {
                            activeNavIndex = rows.length;
                        }
                    }
                    updateEverythingKeyboardHighlight();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (activeNavIndex < 0) {
                        const studioItems = getStudioBarItems();
                        const groupItems = getGroupBarItems();
                        if (studioItems.length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        } else if (groupItems.length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        }
                        updateEverythingKeyboardHighlight();
                        return;
                    }
                    if (currentNavSection === 'studios') {
                        // Stay in studio bar
                    } else if (currentNavSection === 'groups') {
                        // Stay in group bar
                    } else if (currentNavSection === 'tag-suggestions') {
                        const studioItems = getStudioBarItems();
                        if (studioItems.length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        } else {
                            const groupItems = getGroupBarItems();
                            if (groupItems.length > 0) {
                                currentNavSection = 'groups';
                                activeNavIndex = 0;
                            }
                        }
                    } else if (currentNavSection === 'perf-suggestions') {
                        const groupItems = getGroupBarItems();
                        if (groupItems.length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        } else {
                            const studioItems = getStudioBarItems();
                            if (studioItems.length > 0) {
                                currentNavSection = 'studios';
                                activeNavIndex = 0;
                            }
                        }
                    } else if (currentNavSection === 'tag-recent') {
                        const tagSuggs = getTagSuggestionItems();
                        const studioItems = getStudioBarItems();
                        const groupItems = getGroupBarItems();
                        if (tagSuggs.length > 0) {
                            currentNavSection = 'tag-suggestions';
                            activeNavIndex = 0;
                        } else if (studioItems.length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        } else if (groupItems.length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'perf-recent') {
                        const perfSuggs = getPerformerSuggestionItems();
                        const groupItems = getGroupBarItems();
                        const studioItems = getStudioBarItems();
                        if (perfSuggs.length > 0) {
                            currentNavSection = 'perf-suggestions';
                            activeNavIndex = 0;
                        } else if (groupItems.length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        } else if (studioItems.length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'tags') {
                        const rows = tagsTable ? tagsTable.getRows() : [];
                        if (activeNavIndex > 0) {
                            activeNavIndex--;
                        } else {
                            const tagRecents = getTagRecentItems();
                            const tagSuggs = getTagSuggestionItems();
                            const studioItems = getStudioBarItems();
                            const groupItems = getGroupBarItems();
                            if (tagRecents.length > 0) {
                                currentNavSection = 'tag-recent';
                                activeNavIndex = 0;
                            } else if (tagSuggs.length > 0) {
                                currentNavSection = 'tag-suggestions';
                                activeNavIndex = 0;
                            } else if (studioItems.length > 0) {
                                currentNavSection = 'studios';
                                activeNavIndex = 0;
                            } else if (groupItems.length > 0) {
                                currentNavSection = 'groups';
                                activeNavIndex = 0;
                            } else {
                                activeNavIndex = -1;
                            }
                        }
                    } else if (currentNavSection === 'performers') {
                        const rows = performersTable ? performersTable.getRows() : [];
                        if (activeNavIndex > 0) {
                            activeNavIndex--;
                        } else {
                            const perfRecents = getPerformerRecentItems();
                            const perfSuggs = getPerformerSuggestionItems();
                            const groupItems = getGroupBarItems();
                            const studioItems = getStudioBarItems();
                            if (perfRecents.length > 0) {
                                currentNavSection = 'perf-recent';
                                activeNavIndex = 0;
                            } else if (perfSuggs.length > 0) {
                                currentNavSection = 'perf-suggestions';
                                activeNavIndex = 0;
                            } else if (groupItems.length > 0) {
                                currentNavSection = 'groups';
                                activeNavIndex = 0;
                            } else if (studioItems.length > 0) {
                                currentNavSection = 'studios';
                                activeNavIndex = 0;
                            } else {
                                currentNavSection = 'tags';
                                const tagRows = tagsTable ? tagsTable.getRows() : [];
                                activeNavIndex = tagRows.length > 0 ? tagRows.length - 1 : -1;
                            }
                        }
                    }
                    updateEverythingKeyboardHighlight();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    if (e.ctrlKey || e.metaKey) {
                        if (popup.saveBtn) popup.saveBtn.click();
                        return;
                    }

                    if (currentNavSection === 'studios') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getStudioBarItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'groups') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getGroupBarItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'tag-suggestions') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getTagSuggestionItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'perf-suggestions') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getPerformerSuggestionItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'tag-recent') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getTagRecentItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'perf-recent') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getPerformerRecentItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    const curCreateBtn = form.querySelector(`.fasttag-create-empty-btn[data-type="${currentNavSection}"]`);
                    const isCreateVisible = curCreateBtn && curCreateBtn.parentElement && curCreateBtn.parentElement.style.display !== 'none';
                    const curTable = currentNavSection === 'tags' ? tagsTable : performersTable;
                    const rows = curTable ? curTable.getRows() : [];

                    if (isCreateVisible && activeNavIndex === rows.length) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCreateEntity(currentNavSection);
                        return;
                    }

                    const hasSearch = popup.globalSearch && popup.globalSearch.value.trim().length > 0;
                    if (!hasSearch && activeNavIndex < 0) {
                        e.preventDefault();
                        if (!popup._isRandomMode && popup.saveBtn) popup.saveBtn.click();
                        return;
                    }

                    if (rows.length > 0) {
                        e.preventDefault();
                        const targetIdx = Math.max(0, Math.min(activeNavIndex, rows.length - 1));
                        const selectedRow = rows[targetIdx];
                        if (selectedRow) {
                            const rowData = selectedRow.getData();
                            const idStr = String(rowData.id);

                            if (rowData._isVirtualOrganized || idStr === '__fasttag_virtual_organized__' || idStr === '⚡' || idStr === '◯' || idStr === '✓') {
                                if (popup.organizedBtn) {
                                    popup.organizedBtn.click();
                                }
                                popup.globalSearch.value = '';
                                popup.globalClear.style.display = 'none';
                                if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                                currentNavSection = 'tags';
                                activeNavIndex = -1;
                                await Promise.all([
                                    fetchColumnData('tags', tagsTable, '', selectedTagIds),
                                    fetchColumnData('performers', performersTable, '', selectedPerformerIds),
                                    renderStudioBar(''),
                                    renderGroupBar('')
                                ]);
                                refreshAllUI();
                                updateEverythingKeyboardHighlight();
                                if (popup.globalSearch) popup.globalSearch.focus({ preventScroll: true });
                                return;
                            }

                            const isSelected = selectedRow.isSelected();
                            if (isSelected) {
                                selectedRow.deselect();
                                if (currentNavSection === 'tags') selectedTagIds.delete(idStr);
                                else selectedPerformerIds.delete(idStr);
                            } else {
                                selectedRow.select();
                                if (currentNavSection === 'tags') selectedTagIds.add(idStr);
                                else selectedPerformerIds.add(idStr);
                                addRecentEntry(currentNavSection, rowData);
                            }

                            refreshAllUI();
                            clearTimeout(searchDebounce);
                            doSave(isSelected ? (currentNavSection === 'tags' ? 'Tag removed' : 'Performer removed') : (currentNavSection === 'tags' ? 'Tags updated' : 'Performers updated'));

                            if (hasSearch) {
                                popup.globalSearch.value = '';
                                popup.globalClear.style.display = 'none';
                                if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                                await refreshGlobalSearch('');
                                if (!isSelected) {
                                    const r = curTable.getRow(rowData.id);
                                    if (r) curTable.scrollToRow(r, "top", false);
                                } else {
                                    try {
                                        const holder = curTable.element?.querySelector('.tabulator-tableholder') || curTable.element;
                                        if (holder) holder.scrollTop = 0;
                                        const firstRow = curTable.getRows()[0];
                                        if (firstRow) curTable.scrollToRow(firstRow, "top", false);
                                    } catch (e) {}
                                }
                                activeNavIndex = -1;
                                refreshAllUI();
                                updateEverythingKeyboardHighlight();
                                popup.globalSearch.focus({ preventScroll: true });
                            } else {
                                if (isSelected) {
                                    await refreshGlobalSearch('');
                                    try {
                                        const holder = curTable.element?.querySelector('.tabulator-tableholder') || curTable.element;
                                        if (holder) holder.scrollTop = 0;
                                        const firstRow = curTable.getRows()[0];
                                        if (firstRow) curTable.scrollToRow(firstRow, "top", false);
                                    } catch (e) {}
                                }
                                updateEverythingKeyboardHighlight();
                            }
                        }
                    }
                }
            };

            popup.globalClear.onclick = () => {
                popup.globalSearch.value = '';
                popup.globalClear.style.display = 'none';
                if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                refreshGlobalSearch('');
                popup.globalSearch.focus();
            };

            popup.refreshBtn.onclick = async () => {
                const scraperIsOpen = (popup.scraperCardContainer
                    && popup.scraperCardContainer.style.display !== 'none'
                    && popup.scraperCardContainer.innerHTML.trim() !== '')
                    || (floatingScraperHudElement && document.body.contains(floatingScraperHudElement));
                if (scraperIsOpen) {
                    if (isDirty()) {
                        let saved = await latestEverythingSavePromise;
                        if (saved && isDirty()) {
                            saved = await doSave('Scene changes saved before searching again');
                        }
                        if (!saved) {
                            toastError('Could not save the latest scene changes, so the scrape was not restarted.');
                            return;
                        }
                    }
                    const activeSceneId = popup.currentSceneId || currentSceneId;
                    const previousResults = (sessionScrapeCache.get(activeSceneId) || []).slice();
                    sessionScrapeCache.delete(activeSceneId);
                    popup.refreshBtn.disabled = true;
                    popup.refreshBtn.textContent = '⟳';
                    popup.refreshBtn.title = 'Searching again using current scene metadata';
                    try {
                        const succeeded = await popup.triggerScrape?.(true, activeSceneId, popup.currentCardElement || cardElement);
                        if (succeeded === false && previousResults.length > 0) {
                            sessionScrapeCache.set(activeSceneId, previousResults);
                            await renderScraperMatchCard(
                                popup.scraperCardContainer,
                                previousResults,
                                activeSceneId,
                                popup._context,
                                popup,
                                () => popup.globalSearch?.focus({ preventScroll: true })
                            );
                        }
                    } finally {
                        popup.refreshBtn.disabled = false;
                        popup.refreshBtn.textContent = '↻';
                        popup.refreshBtn.title = 'Search again using current scene metadata';
                    }
                    return;
                }
                popup.refreshBtn.classList.remove('fasttag-refresh-pulse');
                popup.refreshBtn.title = 'Refresh all caches';
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
            };

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
                const createBtn = e.target.closest('.fasttag-create-empty-btn');
                if (createBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetType = createBtn.getAttribute('data-type');
                    if (targetType) handleCreateEntity(targetType);
                }
            });

                const refreshAllUI = () => {
                    updateBadges();
                    updateSaveButton();
                    renderStudioBar(popup.globalSearch.value);
                    renderGroupBar(popup.globalSearch.value);
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

            let pendingEverythingSaveSeq = 0;
            const enqueueEverythingSave = createSerialTaskQueue();
            let latestEverythingSavePromise = Promise.resolve(true);
            const doSave = (customSuccessMessage = null, shouldCloseScraper = false) => {
                const saveSeq = ++pendingEverythingSaveSeq;
                const targetSceneId = currentSceneId;
                const autoMarkOrg = getAutoMarkOrganized();
                const variables = {
                    id: targetSceneId,
                    tag_ids: Array.from(selectedTagIds),
                    performer_ids: Array.from(selectedPerformerIds),
                    studio_id: selectedStudioId || null,
                    groups: Array.from(selectedGroupIds).map(gid => ({ group_id: gid }))
                };
                if (autoMarkOrg) variables.organized = true;

                const runSave = async () => {
                    if (shouldCloseScraper && !window._fastTagEverythingScraperOpen) {
                        if (popup.scraperCardContainer) {
                            popup.scraperCardContainer.innerHTML = '';
                            popup.scraperCardContainer.style.display = 'none';
                        }
                        hideScrapeCoverTooltip();
                    }

                    const mutation = `
                        mutation SceneUpdateEverything($id: ID!, $tag_ids: [ID!], $performer_ids: [ID!], $studio_id: ID, $groups: [SceneGroupInput!]${autoMarkOrg ? ', $organized: Boolean' : ''}) {
                            sceneUpdate(input: {
                                id: $id,
                                tag_ids: $tag_ids,
                                performer_ids: $performer_ids,
                                studio_id: $studio_id,
                                groups: $groups${autoMarkOrg ? ', organized: $organized' : ''}
                            }) {
                                ${SCENE_CARD_UPDATE_FIELDS}
                            }
                        }
                    `;
                    try {
                        const res = await fetchGQL(mutation, variables);

                        if (res?.data?.sceneUpdate?.id) {
                            syncSceneToApolloCache(res.data.sceneUpdate);
                            if (autoMarkOrg && popup._organizedController) {
                                popup._organizedController.update(true);
                            }
                            if (saveSeq !== pendingEverythingSaveSeq) return true;
                            initialTagIds = new Set(selectedTagIds);
                            initialPerformerIds = new Set(selectedPerformerIds);
                            initialStudioId = selectedStudioId;
                            initialGroupIds = new Set(selectedGroupIds);

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
                            selectedGroupIds.forEach(gid => {
                                const allGroups = getCachedOrNull('groups') || [];
                                const grp = allGroups.find(g => String(g.id) === String(gid));
                                if (grp) addRecentEntry('groups', grp);
                            });

                            resetRefractSceneCards(targetSceneId);

                            refreshSceneCardsDebounced(targetSceneId);
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

                latestEverythingSavePromise = enqueueEverythingSave(runSave);
                return latestEverythingSavePromise;
                };

                const onSuggestionActivated = async (sug) => {
                    if (popup.globalSearch && popup.globalSearch.value) {
                        popup.globalSearch.value = '';
                        if (popup.globalClear) popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    }
                    currentNavSection = 'tags';
                    activeNavIndex = -1;
                    await Promise.all([
                        fetchColumnData('tags', tagsTable, '', selectedTagIds),
                        fetchColumnData('performers', performersTable, '', selectedPerformerIds),
                        renderStudioBar(''),
                        renderGroupBar('')
                    ]);
                    const holderTags = popup.tags.tableContainer?.querySelector('.tabulator-tableholder');
                    if (holderTags) holderTags.scrollTop = 0;
                    const holderPerfs = popup.performers.tableContainer?.querySelector('.tabulator-tableholder');
                    if (holderPerfs) holderPerfs.scrollTop = 0;
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    await doSave('Scene updated');
                    if (popup.globalSearch) popup.globalSearch.focus({ preventScroll: true });
                };

            // Store context methods on popup instance for in-place sequential updates & scraper matches
            popup._context = {
                setCurrentSceneId: (id) => { currentSceneId = id; },
                setSelectedTags: (s) => {
                    selectedTagIds.clear();
                    if (s) s.forEach(id => selectedTagIds.add(String(id)));
                },
                setSelectedPerformers: (s) => {
                    selectedPerformerIds.clear();
                    if (s) s.forEach(id => selectedPerformerIds.add(String(id)));
                },
                setSelectedStudio: (s) => { selectedStudioId = s ? String(s) : null; },
                setSelectedGroups: (s) => {
                    selectedGroupIds.clear();
                    if (s) s.forEach(id => selectedGroupIds.add(String(id)));
                },
                getSelectedTags: () => selectedTagIds,
                getSelectedPerformers: () => selectedPerformerIds,
                getSelectedStudio: () => selectedStudioId,
                getSelectedGroups: () => selectedGroupIds,
                selectedTagIds,
                selectedPerformerIds,
                selectedGroupIds,
                setInitialTags: (s) => {
                    initialTagIds.clear();
                    if (s) s.forEach(id => initialTagIds.add(String(id)));
                },
                setInitialPerformers: (s) => {
                    initialPerformerIds.clear();
                    if (s) s.forEach(id => initialPerformerIds.add(String(id)));
                },
                setInitialStudio: (s) => { initialStudioId = s ? String(s) : null; },
                setInitialGroups: (s) => {
                    initialGroupIds.clear();
                    if (s) s.forEach(id => initialGroupIds.add(String(id)));
                },
                fetchColumnData,
                renderStudioBar,
                renderGroupBar,
                refreshAllUI,
                doSave,
                onSuggestionActivated,
                resetNavState: () => {
                    currentNavSection = 'tags';
                    activeNavIndex = -1;
                    updateEverythingKeyboardHighlight();
                },
                isDirty,
                isEverything: true
            };

            makeColumnResizable(popup.columnsContainer, popup.colTags, popup.colPerformers, popup.colResizer, () => {
                try {
                    tagsTable.redraw(false);
                    performersTable.redraw(false);
                } catch (e) {}
            }, signal);

            const triggerScrapeAction = async (forceOpen = false, targetSceneId = null, targetCardElement = null) => {
                const activeSceneId = targetSceneId || popup.currentSceneId || currentSceneId;
                const activeCardElement = targetCardElement || popup.currentCardElement || cardElement;

                // If scraper card is currently open and not force-opening, clicking "Hide" closes it and toggles back to "Scrape"
                const isScraperOpen = (popup.scraperCardContainer && popup.scraperCardContainer.style.display !== 'none' && popup.scraperCardContainer.innerHTML.trim() !== '') || (floatingScraperHudElement && document.body.contains(floatingScraperHudElement));
                if (isScraperOpen && !forceOpen) {
                    window._fastTagEverythingScraperOpen = false;
                    setScraperHudPersistedOpen(false);
                    ftLog('ACTION', 'SCRAPER', 'Scraper HUD closed by user');
                    if (popup.scraperCardContainer) {
                        popup.scraperCardContainer.style.display = 'none';
                        popup.scraperCardContainer.innerHTML = '';
                    }
                    closeFloatingScraperHud();
                    popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                    popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                    popup.scrapeBtn.title = 'Scrape scene metadata';
                    popup.refreshBtn.title = 'Refresh all caches';
                    hideScrapeCoverTooltip();
                    return;
                }

                window._fastTagEverythingScraperOpen = true;
                setScraperHudPersistedOpen(true);
                popup.refreshBtn.title = 'Search again using current scene metadata';
                ftLog('ACTION', 'SCRAPER', 'Scraper HUD opened');

                // If already scraped for this scene during this active session, reopen instantly with 0ms lag!
                if (sessionScrapeCache.has(activeSceneId) && sessionScrapeCache.get(activeSceneId)?.length > 0) {
                    const cached = sessionScrapeCache.get(activeSceneId);
                    cached._fromCache = true;
                    renderScraperMatchCard(popup.scraperCardContainer, cached, activeSceneId, popup._context, popup, () => {
                        popup.globalSearch?.focus({ preventScroll: true });
                    });
                    return;
                }

                const origHtml = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                popup.scrapeBtn.disabled = true;
                popup.scrapeBtn.innerHTML = `<span>⏳ Scraping...</span>`;

                try {
                    const matches = await fetchScraperMatchesForScene(activeSceneId, activeCardElement);
                    if (!matches || matches.length === 0) {
                        toastError('No scraper matches found on configured scrapers');
                        const firstPath = popup.sceneData?.files?.[0]?.path || '';
                        const pathParts = firstPath.split(/[/\\]/);
                        const initialSearch = pathParts[pathParts.length - 1] || popup.sceneData?.title || '';
                        await renderScraperMatchCard(
                            popup.scraperCardContainer,
                            [],
                            activeSceneId,
                            popup._context,
                            popup,
                            () => popup.globalSearch?.focus({ preventScroll: true }),
                            initialSearch
                        );
                        return true;
                    } else {
                        sessionScrapeCache.set(activeSceneId, matches);
                        popup.scrapeBtn.disabled = false;
                        renderScraperMatchCard(popup.scraperCardContainer, matches, activeSceneId, popup._context, popup, () => {
                            popup.globalSearch?.focus({ preventScroll: true });
                        });
                        return true;
                    }
                } catch (err) {
                    popup.scrapeBtn.disabled = false;
                    popup.scrapeBtn.innerHTML = origHtml;
                    toastError('Scrape error: ' + (err?.message || err));
                    return false;
                }
            };

            popup.triggerScrape = triggerScrapeAction;

            if (popup.scrapeBtn) {
                popup.scrapeBtn.onclick = async (e) => {
                    if (e) { e.preventDefault(); e.stopPropagation(); }
                    await triggerScrapeAction(false, popup.currentSceneId, popup.currentCardElement);
                };
            }

            const triggerAIParseAction = async (forceOpen = false, targetSceneId = null, targetCardElement = null) => {
                const activeSceneId = targetSceneId || popup.currentSceneId || currentSceneId;
                const activeCardElement = targetCardElement || popup.currentCardElement || cardElement;

                const isAIOpen = popup.aiCardContainer && popup.aiCardContainer.style.display !== 'none' && popup.aiCardContainer.innerHTML.trim() !== '';
                if (isAIOpen && !forceOpen) {
                    popup.aiCardContainer.style.display = 'none';
                    popup.aiCardContainer.innerHTML = '';
                    if (popup.aiBtn) popup.aiBtn.innerHTML = '<span>✨ AI Parse</span>';
                    return;
                }

                const apiKey = getGeminiApiKey();
                if (!apiKey) {
                    showToast('Please enter your Google Gemini API Key in Settings ➔ 🤖 AI', 'info');
                    openSettingsModal();
                    setTimeout(() => {
                        const aiTabBtn = document.querySelector('.fasttag-settings-tab-btn[data-tab="ai"]');
                        if (aiTabBtn) aiTabBtn.click();
                    }, 50);
                    return;
                }

                if (popup.aiBtn) {
                    popup.aiBtn.disabled = true;
                    popup.aiBtn.innerHTML = '<span>⏳ AI Parsing...</span>';
                }

                try {
                    let title = '';
                    let fileName = '';
                    let details = '';

                    try {
                        const query = `query ($id: ID!) { findScene(id: $id) { title details files { path } } }`;
                        const res = await fetchGQL(query, { id: activeSceneId });
                        const scene = res?.data?.findScene;
                        if (scene) {
                            if (scene.title) title = scene.title;
                            if (scene.details) details = scene.details;
                            if (scene.files && scene.files.length > 0 && scene.files[0]?.path) {
                                const filePath = scene.files[0].path;
                                const parts = filePath.split(/[/\\]/);
                                fileName = parts.length > 0 ? parts[parts.length - 1] : filePath;
                            }
                        }
                    } catch (e) {}

                    const aiResult = await parseSceneWithGemini(activeSceneId, fileName, title);
                    if (popup.aiCardContainer) {
                        renderEverythingAIMatchCard(popup.aiCardContainer, aiResult, activeSceneId, popup, popup._context);
                    }
                    if (popup.aiBtn) {
                        popup.aiBtn.disabled = false;
                        popup.aiBtn.innerHTML = '<span>✨ AI Parse</span>';
                    }
                } catch (err) {
                    if (popup.aiBtn) {
                        popup.aiBtn.disabled = false;
                        popup.aiBtn.innerHTML = '<span>✨ AI Parse</span>';
                    }
                    toastError(`AI Parse Error: ${err.message}`);
                }
            };

            popup.triggerAIParse = triggerAIParseAction;

            if (popup.aiBtn) {
                popup.aiBtn.onclick = async (e) => {
                    if (e) { e.preventDefault(); e.stopPropagation(); }
                    await triggerAIParseAction(false, popup.currentSceneId, popup.currentCardElement);
                };
            }

            popup.saveBtn.onclick = async () => {
                if (popup._isRandomMode) {
                    await rollNextRandomUntaggedScene(popup);
                } else if (sequentialEditState.enabled) {
                    const cards = sequentialEditState.allSceneCards || getAllVisibleSceneCards();
                    const idx = getSceneCardIndex(currentSceneId, cards);
                    const isLast = idx !== -1 && idx === cards.length - 1;
                    if (isLast) {
                        closePopup();
                    } else {
                        navigateSequentialEditEverything(popup, currentSceneId, 1, null);
                    }
                } else {
                    closePopup();
                }
            };

            popup.cancelBtn.onclick = () => closePopup();

            const enableHScroll = (containerEl, scrollTargetEl) => {
                if (!containerEl) return;
                const target = scrollTargetEl || containerEl;
                const onWheel = (e) => {
                    let delta = 0;
                    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                        delta = e.deltaX;
                    } else {
                        delta = e.deltaY;
                    }
                    if (e.deltaMode === 1) delta *= 28;
                    else if (e.deltaMode === 2) delta *= 400;

                    if (delta !== 0) {
                        e.preventDefault();
                        e.stopPropagation();
                        target.scrollLeft += delta;
                    }
                };
                containerEl.addEventListener('wheel', onWheel, { passive: false });
                if (scrollTargetEl && scrollTargetEl !== containerEl) {
                    scrollTargetEl.addEventListener('wheel', onWheel, { passive: false });
                }
            };
            enableHScroll(popup.studioBar?.container, popup.studioBar?.scrollContainer);
            enableHScroll(popup.groupsBar?.container, popup.groupsBar?.scrollContainer);

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

    async function openBulkEverythingPopup(bulkScenes) {
        try {
            if (!Array.isArray(bulkScenes) || bulkScenes.length === 0) return;

            if (!isTabulatorLoaded()) {
                await ensureDependenciesLoaded();
            }
            if (!isTabulatorLoaded()) {
                toastError("Tabulator library failed to load. Please check your internet connection or adblocker.");
                return;
            }

            closeMenu();
            closePopup(false);
            window._fastTagEverythingScraperOpen = false;

            popupAbortController = new AbortController();
            const { signal } = popupAbortController;

            const popup = createEditEverythingPopupShell();
            popup.type = 'bulk-everything';
            activePopup = popup;
            const form = popup.element;

            // Set Title
            if (popup.titleSpan) {
                popup.titleSpan.textContent = `📦 Bulk Edit Everything (${bulkScenes.length} scenes)`;
            }

            // Hide sequential elements
            const seqLabel = form.querySelector('.popup-seq-label');
            if (seqLabel) seqLabel.style.display = 'none';
            if (popup.navGroup) popup.navGroup.style.display = 'none';
            if (popup.scrapeBtn) popup.scrapeBtn.style.display = 'none';
            if (popup.suggestionsContainer) popup.suggestionsContainer.style.display = 'none';
            if (popup.scraperCardContainer) popup.scraperCardContainer.style.display = 'none';

            // Display bulk status banner in preview container
            if (popup.previewContainer) {
                popup.previewContainer.innerHTML = `
                    <div style="padding: 6px 12px; background: rgba(99, 102, 241, 0.12); border: 1px dashed #6366f1; border-radius: 6px; margin-bottom: 6px; font-size: 11px; font-weight: 600; color: #818cf8; text-align: center; user-select: none;">
                        📦 Applying changes across <strong>${bulkScenes.length}</strong> selected scenes
                    </div>
                `;
            }

            let selectedTagIds = new Set();
            let selectedPerformerIds = new Set();
            let selectedStudioId = null;
            let selectedGroupIds = new Set();
            let initialCommonTagIds = new Set();
            let initialCommonPerformerIds = new Set();
            let initialCommonStudioId = null;
            let initialCommonGroupIds = new Set();
            let studioModified = false;
            let isRestoring = false;
            let searchDebounce = null;

            // Initialize Tabulator tables with cached data immediately so there's zero placeholder flash
            const tagsTable = new Tabulator(popup.tags.tableContainer, {
                data: getCachedOrNull('tags') || [],
                layout: "fitColumns",
                columnResizeMode: "fit",
                height: "100%",
                placeholder: () => getCachedOrNull('tags') ? "No Tags Found" : "Loading Tags...",
                selectable: true,
                index: "id",
                columnDefaults: { headerSort: false },
                columns: getColumnsWithSavedWidths('tags', 'bulk-everything', () => {
                    if (popup.tagsFetchData) popup.tagsFetchData();
                })
            });
            attachColumnWidthSaver(tagsTable, 'tags', 'bulk-everything');

            const performersTable = new Tabulator(popup.performers.tableContainer, {
                data: getCachedOrNull('performers') || [],
                layout: "fitColumns",
                columnResizeMode: "fit",
                height: "100%",
                placeholder: () => getCachedOrNull('performers') ? "No Performers Found" : "Loading Performers...",
                selectable: true,
                index: "id",
                columnDefaults: { headerSort: false },
                columns: getColumnsWithSavedWidths('performers', 'bulk-everything', () => {
                    if (popup.performersFetchData) popup.performersFetchData();
                })
            });
            attachColumnWidthSaver(performersTable, 'performers', 'bulk-everything');
            attachPerformerHoverCard(performersTable, popup.performers.tableContainer);

            popup.tagsTable = tagsTable;
            popup.performersTable = performersTable;

            // Pre-fetch common entities across selected scenes in parallel
            const bulkSceneQuery = `
                query FindSceneBulkEverything($id: ID!) {
                    findScene(id: $id) {
                        id
                        tags { id }
                        performers { id }
                        studio { id }
                        groups { group { id } }
                    }
                }
            `;

            try {
                const sceneResults = await Promise.all(
                    bulkScenes.map(s => fetchGQL(bulkSceneQuery, { id: s.id }))
                );
                const validScenes = sceneResults.map(r => r?.data?.findScene).filter(Boolean);

                if (validScenes.length > 0) {
                    // Common Tags
                    const tagSets = validScenes.map(s => new Set((s.tags || []).map(t => String(t.id))));
                    if (tagSets.length > 0 && tagSets[0].size > 0) {
                        for (const tid of tagSets[0]) {
                            if (tagSets.every(ts => ts.has(tid))) {
                                initialCommonTagIds.add(tid);
                                selectedTagIds.add(tid);
                            }
                        }
                    }

                    // Common Performers
                    const perfSets = validScenes.map(s => new Set((s.performers || []).map(p => String(p.id))));
                    if (perfSets.length > 0 && perfSets[0].size > 0) {
                        for (const pid of perfSets[0]) {
                            if (perfSets.every(ps => ps.has(pid))) {
                                initialCommonPerformerIds.add(pid);
                                selectedPerformerIds.add(pid);
                            }
                        }
                    }

                    // Common Groups
                    const groupSets = validScenes.map(s => new Set((s.groups || []).map(g => g.group?.id ? String(g.group.id) : '').filter(Boolean)));
                    if (groupSets.length > 0 && groupSets[0].size > 0) {
                        for (const gid of groupSets[0]) {
                            if (groupSets.every(gs => gs.has(gid))) {
                                initialCommonGroupIds.add(gid);
                                selectedGroupIds.add(gid);
                            }
                        }
                    }

                    // Common Studio
                    const firstStudio = validScenes[0]?.studio?.id ? String(validScenes[0].studio.id) : null;
                    if (firstStudio && validScenes.every(s => String(s?.studio?.id) === firstStudio)) {
                        initialCommonStudioId = firstStudio;
                        selectedStudioId = firstStudio;
                    }
                }
            } catch (e) {
                console.error('[FastTag Bulk Everything] Error pre-fetching common metadata:', e);
            }

            const updateBadges = () => {
                popup.tags.badge.textContent = `${selectedTagIds.size} selected`;
                popup.performers.badge.textContent = `${selectedPerformerIds.size} selected`;
            };

            const updateSaveButton = () => {
                const addedTagsCount = Array.from(selectedTagIds).filter(id => !initialCommonTagIds.has(id)).length;
                const removedTagsCount = Array.from(initialCommonTagIds).filter(id => !selectedTagIds.has(id)).length;
                const addedPerfsCount = Array.from(selectedPerformerIds).filter(id => !initialCommonPerformerIds.has(id)).length;
                const removedPerfsCount = Array.from(initialCommonPerformerIds).filter(id => !selectedPerformerIds.has(id)).length;
                const addedGroupsCount = Array.from(selectedGroupIds).filter(id => !initialCommonGroupIds.has(id)).length;
                const removedGroupsCount = Array.from(initialCommonGroupIds).filter(id => !selectedGroupIds.has(id)).length;
                const hasStudioChange = studioModified || (selectedStudioId !== initialCommonStudioId);

                const totalChanges = addedTagsCount + removedTagsCount + addedPerfsCount + removedPerfsCount + addedGroupsCount + removedGroupsCount + (hasStudioChange ? 1 : 0);

                if (totalChanges > 0 || selectedTagIds.size > 0 || selectedPerformerIds.size > 0 || selectedStudioId || selectedGroupIds.size > 0) {
                    popup.saveBtn.textContent = `Apply Changes to ${bulkScenes.length} Scenes`;
                    popup.saveBtn.disabled = false;
                    popup.saveBtn.style.opacity = '1';
                    popup.saveBtn.style.cursor = 'pointer';
                    popup.saveBtn.style.background = '#10b981';
                    popup.saveBtn.classList.add('fasttag-btn-pulse-calm');
                } else {
                    popup.saveBtn.textContent = `Apply to ${bulkScenes.length} Scenes`;
                    popup.saveBtn.disabled = false;
                    popup.saveBtn.style.opacity = '1';
                    popup.saveBtn.style.cursor = 'pointer';
                    popup.saveBtn.style.background = '#6366f1';
                    popup.saveBtn.classList.remove('fasttag-btn-pulse-calm');
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
                    const curStudio = allStudios.find(s => String(s.id) === String(selectedStudioId));
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
                        emptySpan.textContent = 'Studio';
                        emptySpan.style.cssText = `font-size: 10px; opacity: 0.45; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'}; letter-spacing: 0.3px; user-select: none;`;
                        studioBar.recentContainer.appendChild(emptySpan);
                    }
                    return;
                }

                const matchingStudios = allStudios
                    .filter(s => (s.name || '').toLowerCase().includes(term) && String(s.id) !== String(selectedStudioId))
                    .sort((a, b) => {
                        const aName = (a.name || '').toLowerCase();
                        const bName = (b.name || '').toLowerCase();
                        const aExact = aName === term ? 1 : 0;
                        const bExact = bName === term ? 1 : 0;
                        if (aExact !== bExact) return bExact - aExact;
                        const aStarts = aName.startsWith(term) ? 1 : 0;
                        const bStarts = bName.startsWith(term) ? 1 : 0;
                        if (aStarts !== bStarts) return bStarts - aStarts;
                        const aCount = Number(a.scene_count) || 0;
                        const bCount = Number(b.scene_count) || 0;
                        if (aCount !== bCount) return bCount - aCount;
                        return aName.localeCompare(bName);
                    })
                    .slice(0, 8);

                if (!matchingStudios.length && !selectedStudioId) {
                    const emptySpan = document.createElement('span');
                    emptySpan.textContent = 'No matching studio';
                    emptySpan.style.cssText = `font-size: 10px; opacity: 0.6; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'};`;
                    studioBar.recentContainer.appendChild(emptySpan);
                    return;
                }

                matchingStudios.forEach(st => {
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = 'fasttag-quick-chip chip-studio';
                    chip.title = `Click to set studio to "${st.name}" across all selected scenes`;
                    chip.innerHTML = `<span style="color: ${isDark ? '#818cf8' : '#4f46e5'}; font-weight: 700; margin-right: 2px;">+</span> ${escapeHtml(st.name)}`;
                    chip.style.cssText = `padding: 1.5px 6px; border-radius: 999px; font-size: 10px; cursor: pointer; flex-shrink: 0; line-height: 1.2;`;

                    chip.onclick = async (e) => {
                        e.preventDefault();
                        studioModified = true;
                        if (selectedStudioId === String(st.id)) {
                            selectedStudioId = null;
                        } else {
                            selectedStudioId = String(st.id);
                            addRecentEntry('studios', st);
                        }
                        popup.globalSearch.value = '';
                        popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                        currentNavSection = 'tags';
                        activeNavIndex = -1;
                        await Promise.all([
                            fetchColumnData('tags', tagsTable, '', selectedTagIds),
                            fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                        ]);
                        refreshAllUI();
                        updateEverythingKeyboardHighlight();
                        popup.globalSearch.focus({ preventScroll: true });
                    };

                    studioBar.recentContainer.appendChild(chip);
                });
            };

            const renderGroupBar = async (searchQuery = '') => {
                const groupsBar = popup.groupsBar;
                if (!groupsBar) return;

                let allGroups = getCachedOrNull('groups');
                if (!allGroups) {
                    try {
                        const res = await fetchGQL(ENTITY_CONFIG.groups.fetchQuery);
                        allGroups = ENTITY_CONFIG.groups.extractList(res?.data);
                        if (!allGroups || !allGroups.length) {
                            allGroups = res?.data?.findGroups?.groups || res?.data?.findMovies?.movies || [];
                        }
                    } catch (e) {
                        try {
                            const fallbackRes = await fetchGQL(`query { findMovies(filter: { per_page: -1 }) { movies { id name } } }`);
                            allGroups = fallbackRes?.data?.findMovies?.movies || [];
                        } catch (e2) {
                            console.error('[FastTag Bulk Everything] Failed to fetch groups:', e, e2);
                        }
                    }
                    if (allGroups && allGroups.length) setCache('groups', allGroups);
                }
                if (!allGroups) allGroups = [];

                const isDark = getEffectiveTheme() === 'dark';
                groupsBar.selectedContainer.innerHTML = '';
                groupsBar.recentContainer.innerHTML = '';

                selectedGroupIds.forEach(id => {
                    const grp = allGroups.find(g => String(g.id) === String(id));
                    const name = grp ? grp.name : `Group #${id}`;

                    const pill = document.createElement('div');
                    pill.className = 'fasttag-group-pill';
                    pill.style.cssText = `display: inline-flex; align-items: center; gap: 3.5px; font-weight: 700; padding: 1.5px 6px; border-radius: 999px; font-size: 10px; white-space: nowrap; flex-shrink: 0; cursor: default;`;
                    pill.innerHTML = `
                        <span style="font-weight: 800; font-size: 9.5px; opacity: 0.95;">✓</span>
                        <span>${escapeHtml(name)}</span>
                        <button type="button" class="fasttag-pill-clear-btn" style="background: none; border: none; cursor: pointer; color: #ffffff; font-weight: 700; font-size: 12px; padding: 0 0 0 2.5px; line-height: 1; opacity: 0.85;" title="Remove Group">&times;</button>
                    `;

                    pill.querySelector('button').onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectedGroupIds.delete(String(id));
                        popup.globalSearch.value = '';
                        popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                        currentNavSection = 'tags';
                        activeNavIndex = -1;
                        await Promise.all([
                            fetchColumnData('tags', tagsTable, '', selectedTagIds),
                            fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                        ]);
                        refreshAllUI();
                        updateEverythingKeyboardHighlight();
                        popup.globalSearch.focus({ preventScroll: true });
                    };
                    groupsBar.selectedContainer.appendChild(pill);
                });

                const term = searchQuery ? searchQuery.trim().toLowerCase() : '';
                if (!term) {
                    if (selectedGroupIds.size === 0) {
                        const emptySpan = document.createElement('span');
                        emptySpan.textContent = 'Group';
                        emptySpan.style.cssText = `font-size: 10px; opacity: 0.45; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'}; letter-spacing: 0.3px; user-select: none;`;
                        groupsBar.recentContainer.appendChild(emptySpan);
                    }
                    return;
                }

                const matchingGroups = allGroups
                    .filter(g => (g.name || '').toLowerCase().includes(term) && !selectedGroupIds.has(String(g.id)))
                    .sort((a, b) => {
                        const aName = (a.name || '').toLowerCase();
                        const bName = (b.name || '').toLowerCase();
                        const aExact = aName === term ? 1 : 0;
                        const bExact = bName === term ? 1 : 0;
                        if (aExact !== bExact) return bExact - aExact;
                        const aStarts = aName.startsWith(term) ? 1 : 0;
                        const bStarts = bName.startsWith(term) ? 1 : 0;
                        if (aStarts !== bStarts) return bStarts - aStarts;
                        const aCount = Number(a.scene_count) || 0;
                        const bCount = Number(b.scene_count) || 0;
                        if (aCount !== bCount) return bCount - aCount;
                        return (a.name || '').localeCompare(b.name || '');
                    })
                    .slice(0, 8);

                if (!matchingGroups.length && selectedGroupIds.size === 0) {
                    const emptySpan = document.createElement('span');
                    emptySpan.textContent = 'No matching group';
                    emptySpan.style.cssText = `font-size: 10px; opacity: 0.6; font-style: italic; color: ${isDark ? '#94a3b8' : '#64748b'};`;
                    groupsBar.recentContainer.appendChild(emptySpan);
                    return;
                }

                matchingGroups.forEach(grp => {
                    const chip = document.createElement('button');
                    chip.type = 'button';
                    chip.className = 'fasttag-quick-chip chip-group';
                    chip.title = `Click to add to group "${grp.name}" across all selected scenes`;
                    chip.innerHTML = `<span style="color: ${isDark ? '#c084fc' : '#9333ea'}; font-weight: 700; margin-right: 2px;">+</span> ${escapeHtml(grp.name)}`;
                    chip.style.cssText = `padding: 1.5px 6px; border-radius: 999px; font-size: 10px; cursor: pointer; flex-shrink: 0; line-height: 1.2;`;

                    chip.onclick = async (e) => {
                        e.preventDefault();
                        selectedGroupIds.add(String(grp.id));
                        addRecentEntry('groups', grp);
                        popup.globalSearch.value = '';
                        popup.globalClear.style.display = 'none';
                        if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                        currentNavSection = 'tags';
                        activeNavIndex = -1;
                        await Promise.all([
                            fetchColumnData('tags', tagsTable, '', selectedTagIds),
                            fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                        ]);
                        refreshAllUI();
                        updateEverythingKeyboardHighlight();
                        popup.globalSearch.focus({ preventScroll: true });
                    };
                    groupsBar.recentContainer.appendChild(chip);
                });
            };

            if (popup.studioBar?.clearBtn) {
                popup.studioBar.clearBtn.onclick = async (e) => {
                    e.preventDefault();
                    studioModified = true;
                    selectedStudioId = null;
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    currentNavSection = 'tags';
                    activeNavIndex = -1;
                    await Promise.all([
                        fetchColumnData('tags', tagsTable, '', selectedTagIds),
                        fetchColumnData('performers', performersTable, '', selectedPerformerIds)
                    ]);
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    popup.globalSearch.focus({ preventScroll: true });
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
                let data = Array.from(cached);
                const searchFields = config.searchFields || [config.labelKey];
                if (term) {
                    const tokens = term.split(/\s+/);
                    data = data.filter(item => {
                        const itemSearchStr = searchFields
                            .map(f => String(item[f] || '').trim().toLowerCase())
                            .filter(Boolean)
                            .join(' ');
                        return tokens.every(t => itemSearchStr.includes(t));
                    });
                }

                data.sort(getSmartSortComparator(term, selIds, config.labelKey, searchFields, getSavedSortKey(type)));

                isRestoring = true;
                try {
                    if (typeof tableInstance.deselectRow === 'function') {
                        tableInstance.deselectRow();
                    }
                    await tableInstance.setData(data);
                    if (typeof tableInstance.deselectRow === 'function') {
                        tableInstance.deselectRow();
                    }
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

            const refreshAllUI = () => {
                updateBadges();
                updateSaveButton();
                renderStudioBar(popup.globalSearch ? popup.globalSearch.value : '');
                renderGroupBar(popup.globalSearch ? popup.globalSearch.value : '');
            };

            if (tagsTable) {
                try {
                    tagsTable.off("rowClick");
                    tagsTable.off("rowSelected");
                    tagsTable.off("rowDeselected");
                } catch (e) {}
            }
            if (performersTable) {
                try {
                    performersTable.off("rowClick");
                    performersTable.off("rowSelected");
                    performersTable.off("rowDeselected");
                } catch (e) {}
            }

            tagsTable.on("rowClick", async (e, row) => {
                const rowData = row.getData();
                if (!rowData || !rowData.id) return;
                const strId = String(rowData.id);
                const wasSelected = selectedTagIds.has(strId);

                if (wasSelected) {
                    selectedTagIds.delete(strId);
                    tagsTable.deselectRow(row);
                } else {
                    selectedTagIds.add(strId);
                    tagsTable.selectRow(row);
                    addRecentEntry('tags', rowData);
                }

                currentNavSection = 'tags';
                const rows = tagsTable.getRows();
                activeNavIndex = rows.indexOf(row);
                refreshAllUI();
                updateEverythingKeyboardHighlight();

                const hasSearch = popup.globalSearch && popup.globalSearch.value.trim().length > 0;
                if (hasSearch) {
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    await refreshGlobalSearch('');
                    if (!wasSelected) {
                        const r = tagsTable.getRow(rowData.id);
                        if (r) tagsTable.scrollToRow(r, "top", false);
                    } else {
                        try {
                            const holder = tagsTable.element?.querySelector('.tabulator-tableholder') || tagsTable.element;
                            if (holder) holder.scrollTop = 0;
                            const firstRow = tagsTable.getRows()[0];
                            if (firstRow) tagsTable.scrollToRow(firstRow, "top", false);
                        } catch (err) {}
                    }
                    activeNavIndex = -1;
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    popup.globalSearch.focus({ preventScroll: true });
                } else {
                    if (wasSelected) {
                        await refreshGlobalSearch('');
                    }
                    if (popup.globalSearch) popup.globalSearch.focus({ preventScroll: true });
                }
            });

            performersTable.on("rowClick", async (e, row) => {
                const rowData = row.getData();
                if (!rowData || !rowData.id) return;
                const strId = String(rowData.id);
                const wasSelected = selectedPerformerIds.has(strId);

                if (wasSelected) {
                    selectedPerformerIds.delete(strId);
                    performersTable.deselectRow(row);
                } else {
                    selectedPerformerIds.add(strId);
                    performersTable.selectRow(row);
                    addRecentEntry('performers', rowData);
                }

                currentNavSection = 'performers';
                const rows = performersTable.getRows();
                activeNavIndex = rows.indexOf(row);
                refreshAllUI();
                updateEverythingKeyboardHighlight();

                const hasSearch = popup.globalSearch && popup.globalSearch.value.trim().length > 0;
                if (hasSearch) {
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    await refreshGlobalSearch('');
                    if (!wasSelected) {
                        const r = performersTable.getRow(rowData.id);
                        if (r) performersTable.scrollToRow(r, "top", false);
                    } else {
                        try {
                            const holder = performersTable.element?.querySelector('.tabulator-tableholder') || performersTable.element;
                            if (holder) holder.scrollTop = 0;
                            const firstRow = performersTable.getRows()[0];
                            if (firstRow) performersTable.scrollToRow(firstRow, "top", false);
                        } catch (err) {}
                    }
                    activeNavIndex = -1;
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    popup.globalSearch.focus({ preventScroll: true });
                } else {
                    if (wasSelected) {
                        await refreshGlobalSearch('');
                    }
                    if (popup.globalSearch) popup.globalSearch.focus({ preventScroll: true });
                }
            });

            form.addEventListener('click', (e) => {
                if (!e.target.closest('input, textarea')) {
                    if (popup.globalSearch) {
                        popup.globalSearch.focus({ preventScroll: true });
                    }
                }
            });

            const refreshGlobalSearch = async (val) => {
                await Promise.all([
                    fetchColumnData('tags', tagsTable, val, selectedTagIds),
                    fetchColumnData('performers', performersTable, val, selectedPerformerIds)
                ]);
                await renderStudioBar(val);
                await renderGroupBar(val);
            };

            let currentNavSection = 'tags'; // 'tags' | 'performers' | 'studios' | 'groups' | 'tag-suggestions' | 'perf-suggestions'
            let activeNavIndex = -1;

            const getStudioBarItems = () => {
                const items = [];
                if (popup.studioBar?.chip && popup.studioBar.chip.style.display !== 'none') {
                    items.push({ type: 'studio-selected', el: popup.studioBar.chip, clickTarget: popup.studioBar.clearBtn });
                }
                if (popup.studioBar?.recentContainer) {
                    popup.studioBar.recentContainer.querySelectorAll('.fasttag-quick-chip, .chip-studio').forEach(btn => {
                        items.push({ type: 'studio-chip', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getGroupBarItems = () => {
                const items = [];
                if (popup.groupsBar?.selectedContainer) {
                    popup.groupsBar.selectedContainer.querySelectorAll('.fasttag-group-pill').forEach(pill => {
                        const btn = pill.querySelector('button');
                        items.push({ type: 'group-selected', el: pill, clickTarget: btn || pill });
                    });
                }
                if (popup.groupsBar?.recentContainer) {
                    popup.groupsBar.recentContainer.querySelectorAll('.fasttag-quick-chip, .chip-group').forEach(btn => {
                        items.push({ type: 'group-chip', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getTagSuggestionItems = () => {
                const items = [];
                const box = form.querySelector('#everything-sugg-tags-box');
                if (box && box.style.visibility === 'hidden') return items;
                const container = form.querySelector('#everything-sugg-tags-chips');
                if (container && container.offsetParent !== null) {
                    container.querySelectorAll('.fasttag-suggestion-chip').forEach(btn => {
                        items.push({ type: 'tag-sugg', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getPerformerSuggestionItems = () => {
                const items = [];
                const box = form.querySelector('#everything-sugg-performers-box');
                if (box && box.style.visibility === 'hidden') return items;
                const container = form.querySelector('#everything-sugg-performers-chips');
                if (container && container.offsetParent !== null) {
                    container.querySelectorAll('.fasttag-suggestion-chip').forEach(btn => {
                        items.push({ type: 'perf-sugg', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getTagRecentItems = () => {
                const items = [];
                const container = popup.tags?.chipsContainer;
                if (container && container.style.display !== 'none' && container.offsetParent !== null) {
                    container.querySelectorAll('.fasttag-quick-chip').forEach(btn => {
                        items.push({ type: 'tag-recent', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const getPerformerRecentItems = () => {
                const items = [];
                const container = popup.performers?.chipsContainer;
                if (container && container.style.display !== 'none' && container.offsetParent !== null) {
                    container.querySelectorAll('.fasttag-quick-chip').forEach(btn => {
                        items.push({ type: 'perf-recent', el: btn, clickTarget: btn });
                    });
                }
                return items;
            };

            const scrollRowIntoViewIfNeeded = (table, row) => {
                if (!table || !row) return;
                const el = typeof row.getElement === 'function' ? row.getElement() : null;
                const holder = table.element?.querySelector('.tabulator-tableholder');
                if (holder && el) {
                    const holderRect = holder.getBoundingClientRect();
                    const elRect = el.getBoundingClientRect();
                    if (elRect.bottom > holderRect.bottom) {
                        holder.scrollTop += (elRect.bottom - holderRect.bottom + 4);
                    } else if (elRect.top < holderRect.top) {
                        holder.scrollTop -= (holderRect.top - elRect.top + 4);
                    }
                } else if (typeof row.scrollTo === 'function') {
                    row.scrollTo('nearest', false);
                }
            };

            const updateEverythingKeyboardHighlight = () => {
                form.querySelectorAll('.tabulator-row.fasttag-keyboard-active').forEach(el => el.classList.remove('fasttag-keyboard-active'));
                form.querySelectorAll('.fasttag-keyboard-meta-focus').forEach(el => el.classList.remove('fasttag-keyboard-meta-focus'));

                form.querySelectorAll('.fasttag-create-empty-btn').forEach(btn => {
                    btn.classList.remove('fasttag-create-btn-active');
                    btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                    btn.style.transform = 'none';
                    btn.style.filter = 'none';
                });

                const tagsHeader = form.querySelector('#everything-col-tags span');
                const perfHeader = form.querySelector('#everything-col-performers span');
                if (tagsHeader) {
                    tagsHeader.style.textDecoration = (currentNavSection === 'tags' && activeNavIndex >= 0) ? 'underline 2px #818cf8' : 'none';
                }
                if (perfHeader) {
                    perfHeader.style.textDecoration = (currentNavSection === 'performers' && activeNavIndex >= 0) ? 'underline 2px #38bdf8' : 'none';
                }

                if (currentNavSection === 'studios') {
                    const items = getStudioBarItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'groups') {
                    const items = getGroupBarItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'tag-suggestions') {
                    const items = getTagSuggestionItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'perf-suggestions') {
                    const items = getPerformerSuggestionItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'tag-recent') {
                    const items = getTagRecentItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (currentNavSection === 'perf-recent') {
                    const items = getPerformerRecentItems();
                    if (items.length > 0) {
                        if (activeNavIndex < 0) activeNavIndex = 0;
                        if (activeNavIndex >= items.length) activeNavIndex = items.length - 1;
                        const item = items[activeNavIndex];
                        if (item && item.el) {
                            item.el.classList.add('fasttag-keyboard-meta-focus');
                            if (typeof item.el.scrollIntoView === 'function') {
                                item.el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                            }
                        }
                    }
                    return;
                }

                if (activeNavIndex < 0) return;

                const curTable = currentNavSection === 'tags' ? tagsTable : performersTable;
                const curCreateBtn = form.querySelector(`.fasttag-create-empty-btn[data-type="${currentNavSection}"]`);
                const isCreateVisible = curCreateBtn && curCreateBtn.parentElement && curCreateBtn.parentElement.style.display !== 'none';
                const rows = curTable && typeof curTable.getRows === 'function' ? curTable.getRows() : [];

                if (isCreateVisible && activeNavIndex === rows.length) {
                    curCreateBtn.classList.add('fasttag-create-btn-active');
                    curCreateBtn.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.5), 0 2px 8px rgba(0,0,0,0.3)';
                    curCreateBtn.style.transform = 'scale(1.02)';
                    curCreateBtn.style.filter = 'brightness(1.15)';
                    return;
                }

                if (rows.length === 0) return;
                if (activeNavIndex >= rows.length) activeNavIndex = rows.length - 1;

                const targetRow = rows[activeNavIndex];
                if (targetRow) {
                    const el = targetRow.getElement();
                    if (el) el.classList.add('fasttag-keyboard-active');
                    scrollRowIntoViewIfNeeded(curTable, targetRow);
                }
            };

            const handleCreateEntity = async (targetType) => {
                const val = (popup.globalSearch?.value || '').trim();
                if (!val) return;

                const config = ENTITY_CONFIG[targetType];
                const confirmedName = await promptCreateEntityDialog(targetType, val, form);
                if (!confirmedName) {
                    if (popup.globalSearch) popup.globalSearch.focus({ preventScroll: true });
                    return;
                }

                const res = await fetchGQL(config.createQuery, config.createVariables(confirmedName));
                const newId = config.createExtract(res.data);

                if (newId) {
                    toastSuccess(`${config.title} "${confirmedName}" created successfully`);
                    invalidateCache(targetType);
                    if (targetType === 'tags') {
                        selectedTagIds.add(String(newId));
                    } else {
                        selectedPerformerIds.add(String(newId));
                    }
                    addRecentEntry(targetType, { id: newId, [config.labelKey]: confirmedName });
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    currentNavSection = targetType;
                    activeNavIndex = 0;
                    await refreshGlobalSearch('');
                    refreshAllUI();
                    updateEverythingKeyboardHighlight();
                    if (popup.globalSearch) popup.globalSearch.focus({ preventScroll: true });
                } else {
                    toastError(`Failed to create ${config.title.toLowerCase()}`, res.errors);
                }
            };

            form.addEventListener('click', (e) => {
                const createBtn = e.target.closest('.fasttag-create-empty-btn');
                if (createBtn) {
                    const targetType = createBtn.getAttribute('data-type');
                    if (targetType) handleCreateEntity(targetType);
                }
            });

            popup.globalSearch.oninput = () => {
                const val = popup.globalSearch.value.trim();
                const hasVal = val.length > 0;
                popup.globalClear.style.display = hasVal ? 'block' : 'none';
                if (popup.kbdShortcut) popup.kbdShortcut.style.display = hasVal ? 'none' : 'block';
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(async () => {
                    const currentVal = popup.globalSearch ? popup.globalSearch.value.trim() : '';
                    await refreshGlobalSearch(currentVal);
                    if (currentVal.length > 0) {
                        const tagCount = tagsTable ? tagsTable.getRows().length : 0;
                        const perfCount = performersTable ? performersTable.getRows().length : 0;
                        if (tagCount > 0) {
                            currentNavSection = 'tags';
                            activeNavIndex = 0;
                        } else if (perfCount > 0) {
                            currentNavSection = 'performers';
                            activeNavIndex = 0;
                        } else if (getTagSuggestionItems().length > 0) {
                            currentNavSection = 'tag-suggestions';
                            activeNavIndex = 0;
                        } else if (getPerformerSuggestionItems().length > 0) {
                            currentNavSection = 'perf-suggestions';
                            activeNavIndex = 0;
                        } else if (getTagRecentItems().length > 0) {
                            currentNavSection = 'tag-recent';
                            activeNavIndex = 0;
                        } else if (getPerformerRecentItems().length > 0) {
                            currentNavSection = 'perf-recent';
                            activeNavIndex = 0;
                        } else if (getStudioBarItems().length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        } else if (getGroupBarItems().length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'tags';
                            activeNavIndex = -1;
                        }
                    } else {
                        currentNavSection = 'tags';
                        activeNavIndex = -1;
                    }
                    updateEverythingKeyboardHighlight();
                }, 100);
            };

            popup.globalSearch.onkeydown = async (e) => {
                if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (currentNavSection === 'studios') {
                        const studioItems = getStudioBarItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const groupItems = getGroupBarItems();
                                if (groupItems.length > 0) {
                                    currentNavSection = 'groups';
                                    activeNavIndex = groupItems.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < studioItems.length - 1) activeNavIndex++;
                            else {
                                const groupItems = getGroupBarItems();
                                if (groupItems.length > 0) {
                                    currentNavSection = 'groups';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'groups') {
                        const groupItems = getGroupBarItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const studioItems = getStudioBarItems();
                                if (studioItems.length > 0) {
                                    currentNavSection = 'studios';
                                    activeNavIndex = studioItems.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < groupItems.length - 1) activeNavIndex++;
                            else {
                                const studioItems = getStudioBarItems();
                                if (studioItems.length > 0) {
                                    currentNavSection = 'studios';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'tag-suggestions') {
                        const tagSuggs = getTagSuggestionItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const perfSuggs = getPerformerSuggestionItems();
                                if (perfSuggs.length > 0) {
                                    currentNavSection = 'perf-suggestions';
                                    activeNavIndex = perfSuggs.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < tagSuggs.length - 1) activeNavIndex++;
                            else {
                                const perfSuggs = getPerformerSuggestionItems();
                                if (perfSuggs.length > 0) {
                                    currentNavSection = 'perf-suggestions';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'perf-suggestions') {
                        const perfSuggs = getPerformerSuggestionItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const tagSuggs = getTagSuggestionItems();
                                if (tagSuggs.length > 0) {
                                    currentNavSection = 'tag-suggestions';
                                    activeNavIndex = tagSuggs.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < perfSuggs.length - 1) activeNavIndex++;
                            else {
                                const tagSuggs = getTagSuggestionItems();
                                if (tagSuggs.length > 0) {
                                    currentNavSection = 'tag-suggestions';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'tag-recent') {
                        const tagRecents = getTagRecentItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const perfRecents = getPerformerRecentItems();
                                if (perfRecents.length > 0) {
                                    currentNavSection = 'perf-recent';
                                    activeNavIndex = perfRecents.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < tagRecents.length - 1) activeNavIndex++;
                            else {
                                const perfRecents = getPerformerRecentItems();
                                if (perfRecents.length > 0) {
                                    currentNavSection = 'perf-recent';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'perf-recent') {
                        const perfRecents = getPerformerRecentItems();
                        if (e.key === 'ArrowLeft') {
                            if (activeNavIndex > 0) activeNavIndex--;
                            else {
                                const tagRecents = getTagRecentItems();
                                if (tagRecents.length > 0) {
                                    currentNavSection = 'tag-recent';
                                    activeNavIndex = tagRecents.length - 1;
                                }
                            }
                        } else {
                            if (activeNavIndex < perfRecents.length - 1) activeNavIndex++;
                            else {
                                const tagRecents = getTagRecentItems();
                                if (tagRecents.length > 0) {
                                    currentNavSection = 'tag-recent';
                                    activeNavIndex = 0;
                                }
                            }
                        }
                    } else if (currentNavSection === 'tags') {
                        currentNavSection = 'performers';
                        const perfRows = performersTable ? performersTable.getRows() : [];
                        activeNavIndex = perfRows.length > 0 ? Math.min(Math.max(0, activeNavIndex), perfRows.length - 1) : 0;
                    } else if (currentNavSection === 'performers') {
                        currentNavSection = 'tags';
                        const tagRows = tagsTable ? tagsTable.getRows() : [];
                        activeNavIndex = tagRows.length > 0 ? Math.min(Math.max(0, activeNavIndex), tagRows.length - 1) : 0;
                    }
                    updateEverythingKeyboardHighlight();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (activeNavIndex < 0) {
                        const hasVal = (popup.globalSearch?.value || '').trim().length > 0;
                        if (!hasVal) {
                            const tagSuggs = getTagSuggestionItems();
                            const perfSuggs = getPerformerSuggestionItems();
                            const tagRecents = getTagRecentItems();
                            const perfRecents = getPerformerRecentItems();
                            const tagRows = tagsTable ? tagsTable.getRows() : [];
                            const perfRows = performersTable ? performersTable.getRows() : [];
                            const tagCreate = form.querySelector('.fasttag-create-empty-btn[data-type="tags"]');
                            const isTagCreate = tagCreate && tagCreate.parentElement && tagCreate.parentElement.style.display !== 'none';
                            const perfCreate = form.querySelector('.fasttag-create-empty-btn[data-type="performers"]');
                            const isPerfCreate = perfCreate && perfCreate.parentElement && perfCreate.parentElement.style.display !== 'none';

                            if (tagSuggs.length > 0) {
                                currentNavSection = 'tag-suggestions';
                                activeNavIndex = 0;
                            } else if (perfSuggs.length > 0) {
                                currentNavSection = 'perf-suggestions';
                                activeNavIndex = 0;
                            } else if (tagRecents.length > 0) {
                                currentNavSection = 'tag-recent';
                                activeNavIndex = 0;
                            } else if (perfRecents.length > 0) {
                                currentNavSection = 'perf-recent';
                                activeNavIndex = 0;
                            } else if (tagRows.length > 0) {
                                currentNavSection = 'tags';
                                activeNavIndex = 0;
                            } else if (perfRows.length > 0) {
                                currentNavSection = 'performers';
                                activeNavIndex = 0;
                            } else if (isTagCreate) {
                                currentNavSection = 'tags';
                                activeNavIndex = tagRows.length;
                            } else if (isPerfCreate) {
                                currentNavSection = 'performers';
                                activeNavIndex = perfRows.length;
                            }
                        } else {
                            const tagRows = tagsTable ? tagsTable.getRows() : [];
                            const perfRows = performersTable ? performersTable.getRows() : [];
                            const tagCreate = form.querySelector('.fasttag-create-empty-btn[data-type="tags"]');
                            const isTagCreate = tagCreate && tagCreate.parentElement && tagCreate.parentElement.style.display !== 'none';
                            const perfCreate = form.querySelector('.fasttag-create-empty-btn[data-type="performers"]');
                            const isPerfCreate = perfCreate && perfCreate.parentElement && perfCreate.parentElement.style.display !== 'none';

                            if (tagRows.length > 0) {
                                currentNavSection = 'tags';
                                activeNavIndex = 0;
                            } else if (perfRows.length > 0) {
                                currentNavSection = 'performers';
                                activeNavIndex = 0;
                            } else if (isTagCreate) {
                                currentNavSection = 'tags';
                                activeNavIndex = tagRows.length;
                            } else if (isPerfCreate) {
                                currentNavSection = 'performers';
                                activeNavIndex = perfRows.length;
                            } else if (getTagSuggestionItems().length > 0) {
                                currentNavSection = 'tag-suggestions';
                                activeNavIndex = 0;
                            } else if (getPerformerSuggestionItems().length > 0) {
                                currentNavSection = 'perf-suggestions';
                                activeNavIndex = 0;
                            }
                        }
                        updateEverythingKeyboardHighlight();
                        return;
                    }

                    if (currentNavSection === 'studios') {
                        const tagSuggs = getTagSuggestionItems();
                        const tagRecents = getTagRecentItems();
                        if (tagSuggs.length > 0) {
                            currentNavSection = 'tag-suggestions';
                            activeNavIndex = 0;
                        } else if (tagRecents.length > 0) {
                            currentNavSection = 'tag-recent';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'tags';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'groups') {
                        const perfSuggs = getPerformerSuggestionItems();
                        const perfRecents = getPerformerRecentItems();
                        if (perfSuggs.length > 0) {
                            currentNavSection = 'perf-suggestions';
                            activeNavIndex = 0;
                        } else if (perfRecents.length > 0) {
                            currentNavSection = 'perf-recent';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'performers';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'tag-suggestions') {
                        const tagRecents = getTagRecentItems();
                        if (tagRecents.length > 0) {
                            currentNavSection = 'tag-recent';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'tags';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'perf-suggestions') {
                        const perfRecents = getPerformerRecentItems();
                        if (perfRecents.length > 0) {
                            currentNavSection = 'perf-recent';
                            activeNavIndex = 0;
                        } else {
                            currentNavSection = 'performers';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'tag-recent') {
                        currentNavSection = 'tags';
                        activeNavIndex = 0;
                    } else if (currentNavSection === 'perf-recent') {
                        currentNavSection = 'performers';
                        activeNavIndex = 0;
                    } else if (currentNavSection === 'tags') {
                        const rows = tagsTable ? tagsTable.getRows() : [];
                        const curCreateBtn = form.querySelector('.fasttag-create-empty-btn[data-type="tags"]');
                        const isCreate = curCreateBtn && curCreateBtn.parentElement && curCreateBtn.parentElement.style.display !== 'none';
                        if (rows.length > 0) {
                            if (activeNavIndex < 0) activeNavIndex = 0;
                            else if (activeNavIndex < rows.length - 1) activeNavIndex++;
                            else if (activeNavIndex === rows.length - 1 && isCreate) activeNavIndex = rows.length;
                            else {
                                currentNavSection = 'performers';
                                activeNavIndex = 0;
                            }
                        } else if (isCreate && activeNavIndex < rows.length) {
                            activeNavIndex = rows.length;
                        } else {
                            currentNavSection = 'performers';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'performers') {
                        const rows = performersTable ? performersTable.getRows() : [];
                        const curCreateBtn = form.querySelector('.fasttag-create-empty-btn[data-type="performers"]');
                        const isCreate = curCreateBtn && curCreateBtn.parentElement && curCreateBtn.parentElement.style.display !== 'none';
                        if (rows.length > 0) {
                            if (activeNavIndex < 0) activeNavIndex = 0;
                            else if (activeNavIndex < rows.length - 1) activeNavIndex++;
                            else if (activeNavIndex === rows.length - 1 && isCreate) activeNavIndex = rows.length;
                        } else if (isCreate) {
                            activeNavIndex = rows.length;
                        }
                    }
                    updateEverythingKeyboardHighlight();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (activeNavIndex < 0) {
                        const studioItems = getStudioBarItems();
                        const groupItems = getGroupBarItems();
                        if (studioItems.length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        } else if (groupItems.length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        }
                        updateEverythingKeyboardHighlight();
                        return;
                    }
                    if (currentNavSection === 'studios') {
                        // Stay in studio bar
                    } else if (currentNavSection === 'groups') {
                        // Stay in group bar
                    } else if (currentNavSection === 'tag-suggestions') {
                        const studioItems = getStudioBarItems();
                        if (studioItems.length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        } else {
                            const groupItems = getGroupBarItems();
                            if (groupItems.length > 0) {
                                currentNavSection = 'groups';
                                activeNavIndex = 0;
                            }
                        }
                    } else if (currentNavSection === 'perf-suggestions') {
                        const groupItems = getGroupBarItems();
                        if (groupItems.length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        } else {
                            const studioItems = getStudioBarItems();
                            if (studioItems.length > 0) {
                                currentNavSection = 'studios';
                                activeNavIndex = 0;
                            }
                        }
                    } else if (currentNavSection === 'tag-recent') {
                        const tagSuggs = getTagSuggestionItems();
                        const studioItems = getStudioBarItems();
                        const groupItems = getGroupBarItems();
                        if (tagSuggs.length > 0) {
                            currentNavSection = 'tag-suggestions';
                            activeNavIndex = 0;
                        } else if (studioItems.length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        } else if (groupItems.length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'perf-recent') {
                        const perfSuggs = getPerformerSuggestionItems();
                        const groupItems = getGroupBarItems();
                        const studioItems = getStudioBarItems();
                        if (perfSuggs.length > 0) {
                            currentNavSection = 'perf-suggestions';
                            activeNavIndex = 0;
                        } else if (groupItems.length > 0) {
                            currentNavSection = 'groups';
                            activeNavIndex = 0;
                        } else if (studioItems.length > 0) {
                            currentNavSection = 'studios';
                            activeNavIndex = 0;
                        }
                    } else if (currentNavSection === 'tags') {
                        const rows = tagsTable ? tagsTable.getRows() : [];
                        if (activeNavIndex > 0) {
                            activeNavIndex--;
                        } else {
                            const tagRecents = getTagRecentItems();
                            const tagSuggs = getTagSuggestionItems();
                            const studioItems = getStudioBarItems();
                            const groupItems = getGroupBarItems();
                            if (tagRecents.length > 0) {
                                currentNavSection = 'tag-recent';
                                activeNavIndex = 0;
                            } else if (tagSuggs.length > 0) {
                                currentNavSection = 'tag-suggestions';
                                activeNavIndex = 0;
                            } else if (studioItems.length > 0) {
                                currentNavSection = 'studios';
                                activeNavIndex = 0;
                            } else if (groupItems.length > 0) {
                                currentNavSection = 'groups';
                                activeNavIndex = 0;
                            } else {
                                activeNavIndex = -1;
                            }
                        }
                    } else if (currentNavSection === 'performers') {
                        const rows = performersTable ? performersTable.getRows() : [];
                        if (activeNavIndex > 0) {
                            activeNavIndex--;
                        } else {
                            const perfRecents = getPerformerRecentItems();
                            const perfSuggs = getPerformerSuggestionItems();
                            const groupItems = getGroupBarItems();
                            const studioItems = getStudioBarItems();
                            if (perfRecents.length > 0) {
                                currentNavSection = 'perf-recent';
                                activeNavIndex = 0;
                            } else if (perfSuggs.length > 0) {
                                currentNavSection = 'perf-suggestions';
                                activeNavIndex = 0;
                            } else if (groupItems.length > 0) {
                                currentNavSection = 'groups';
                                activeNavIndex = 0;
                            } else if (studioItems.length > 0) {
                                currentNavSection = 'studios';
                                activeNavIndex = 0;
                            } else {
                                currentNavSection = 'tags';
                                const tagRows = tagsTable ? tagsTable.getRows() : [];
                                activeNavIndex = tagRows.length > 0 ? tagRows.length - 1 : -1;
                            }
                        }
                    }
                    updateEverythingKeyboardHighlight();
                } else if (e.key === 'Enter') {
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (popup.saveBtn) popup.saveBtn.click();
                        return;
                    }

                    if (currentNavSection === 'studios') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getStudioBarItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'groups') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getGroupBarItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'tag-suggestions') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getTagSuggestionItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'perf-suggestions') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getPerformerSuggestionItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'tag-recent') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getTagRecentItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    if (currentNavSection === 'perf-recent') {
                        e.preventDefault();
                        e.stopPropagation();
                        const items = getPerformerRecentItems();
                        if (items.length > 0 && activeNavIndex >= 0 && activeNavIndex < items.length) {
                            const item = items[activeNavIndex];
                            if (item && item.clickTarget) item.clickTarget.click();
                        }
                        return;
                    }

                    const curCreateBtn = form.querySelector(`.fasttag-create-empty-btn[data-type="${currentNavSection}"]`);
                    const isCreateVisible = curCreateBtn && curCreateBtn.parentElement && curCreateBtn.parentElement.style.display !== 'none';
                    const curTable = currentNavSection === 'tags' ? tagsTable : performersTable;
                    const rows = curTable ? curTable.getRows() : [];

                    if (isCreateVisible && activeNavIndex === rows.length) {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCreateEntity(currentNavSection);
                        return;
                    }

                    const hasSearch = popup.globalSearch && popup.globalSearch.value.trim().length > 0;
                    if (!hasSearch && activeNavIndex < 0) {
                        e.preventDefault();
                        if (popup.saveBtn) popup.saveBtn.click();
                        return;
                    }

                    if (rows.length > 0) {
                        e.preventDefault();
                        const targetIdx = Math.max(0, Math.min(activeNavIndex, rows.length - 1));
                        const selectedRow = rows[targetIdx];
                        if (selectedRow) {
                            const rowData = selectedRow.getData();
                            const isSelected = selectedRow.isSelected();
                            const idStr = String(rowData.id);
                            if (isSelected) {
                                selectedRow.deselect();
                                if (currentNavSection === 'tags') selectedTagIds.delete(idStr);
                                else selectedPerformerIds.delete(idStr);
                            } else {
                                selectedRow.select();
                                if (currentNavSection === 'tags') selectedTagIds.add(idStr);
                                else selectedPerformerIds.add(idStr);
                                addRecentEntry(currentNavSection, rowData);
                            }

                            if (hasSearch) {
                                popup.globalSearch.value = '';
                                popup.globalClear.style.display = 'none';
                                if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                                await refreshGlobalSearch('');
                                const r = curTable.getRow(rowData.id);
                                if (r) curTable.scrollToRow(r, "top", false);
                                activeNavIndex = -1;
                                refreshAllUI();
                                updateEverythingKeyboardHighlight();
                                popup.globalSearch.focus({ preventScroll: true });
                            } else {
                                refreshAllUI();
                            }
                        }
                    }
                }
            };

            if (popup.globalClear) {
                popup.globalClear.onclick = () => {
                    popup.globalSearch.value = '';
                    popup.globalClear.style.display = 'none';
                    if (popup.kbdShortcut) popup.kbdShortcut.style.display = 'block';
                    refreshGlobalSearch('');
                    updateEverythingKeyboardHighlight();
                    popup.globalSearch.focus({ preventScroll: true });
                };
            }

            if (popup.refreshBtn) {
                popup.refreshBtn.onclick = async () => {
                    invalidateCache('tags');
                    invalidateCache('performers');
                    invalidateCache('studios');
                    invalidateCache('groups');
                    await refreshGlobalSearch(popup.globalSearch ? popup.globalSearch.value.trim() : '');
                };
            }

            if (popup.cancelBtn) {
                popup.cancelBtn.onclick = () => closePopup();
            }

            if (popup.saveBtn) {
                popup.saveBtn.onclick = async () => {
                const addedTagIds = Array.from(selectedTagIds).filter(id => !initialCommonTagIds.has(id));
                const removedTagIds = new Set(Array.from(initialCommonTagIds).filter(id => !selectedTagIds.has(id)));
                const addedPerformerIds = Array.from(selectedPerformerIds).filter(id => !initialCommonPerformerIds.has(id));
                const removedPerformerIds = new Set(Array.from(initialCommonPerformerIds).filter(id => !selectedPerformerIds.has(id)));
                const addedGroupIds = Array.from(selectedGroupIds).filter(id => !initialCommonGroupIds.has(id));
                const removedGroupIds = new Set(Array.from(initialCommonGroupIds).filter(id => !selectedGroupIds.has(id)));
                const hasStudioChange = studioModified || (selectedStudioId !== initialCommonStudioId);

                const confirmed = await promptBulkConfirmationDialog(
                    `Are you sure you want to apply these changes across ${bulkScenes.length} selected scenes?`,
                    form,
                    `Yes, Apply to ${bulkScenes.length} Scenes`
                );
                if (!confirmed) return;

                popup.saveBtn.disabled = true;
                popup.saveBtn.textContent = `Applying... 0/${bulkScenes.length}`;
                let updatedCount = 0;
                const CONCURRENCY = 3;

                const sceneDetailQuery = `
                    query FindSceneDetailsForBulk($id: ID!) {
                        findScene(id: $id) {
                            id
                            tags { id }
                            performers { id }
                            studio { id }
                            groups { group { id } }
                        }
                    }
                `;

                for (let i = 0; i < bulkScenes.length; i += CONCURRENCY) {
                    const batch = bulkScenes.slice(i, i + CONCURRENCY);
                    await Promise.all(batch.map(async (s) => {
                        try {
                            const res = await fetchGQL(sceneDetailQuery, { id: s.id });
                            const scene = res?.data?.findScene;
                            if (!scene) return;

                            // Merge Tags
                            const currentTags = (scene.tags || []).map(t => String(t.id));
                            const targetTags = Array.from(new Set([
                                ...currentTags.filter(id => !removedTagIds.has(id)),
                                ...addedTagIds
                            ]));

                            // Merge Performers
                            const currentPerfs = (scene.performers || []).map(p => String(p.id));
                            const targetPerfs = Array.from(new Set([
                                ...currentPerfs.filter(id => !removedPerformerIds.has(id)),
                                ...addedPerformerIds
                            ]));

                            // Merge Groups
                            const currentGroups = (scene.groups || []).map(g => g.group?.id ? String(g.group.id) : '').filter(Boolean);
                            const targetGroups = Array.from(new Set([
                                ...currentGroups.filter(id => !removedGroupIds.has(id)),
                                ...addedGroupIds
                            ])).map(gid => ({ group_id: String(gid) }));

                            // Studio
                            const targetStudio = hasStudioChange ? (selectedStudioId ? String(selectedStudioId) : null) : (scene.studio?.id ? String(scene.studio.id) : null);

                            const updateQuery = `
                                mutation BulkSceneUpdate(
                                    $id: ID!,
                                    $tag_ids: [ID!],
                                    $performer_ids: [ID!],
                                    $studio_id: ID,
                                    $groups: [SceneGroupInput!]
                                ) {
                                    sceneUpdate(input: {
                                        id: $id,
                                        tag_ids: $tag_ids,
                                        performer_ids: $performer_ids,
                                        studio_id: $studio_id,
                                        groups: $groups
                                    }) {
                                        id
                                    }
                                }
                            `;

                            const updateRes = await fetchGQL(updateQuery, {
                                id: String(s.id),
                                tag_ids: targetTags,
                                performer_ids: targetPerfs,
                                studio_id: targetStudio,
                                groups: targetGroups
                            });

                            if (updateRes?.data?.sceneUpdate?.id) {
                                updatedCount++;
                            }
                        } catch (err) {
                            console.error('[FastTag Bulk Everything] Error updating scene', s.id, err);
                        }
                    }));

                    if (popup.saveBtn) {
                        popup.saveBtn.textContent = `Applying... ${Math.min(i + CONCURRENCY, bulkScenes.length)}/${bulkScenes.length}`;
                    }
                }

                const failedCount = bulkScenes.length - updatedCount;
                if (updatedCount === bulkScenes.length) {
                    toastSuccess(`Successfully updated all ${updatedCount} scenes!`);
                    recordSaveUsage();
                    closePopup();
                    await refreshSceneCards();
                } else {
                    popup.saveBtn.disabled = false;
                    popup.saveBtn.textContent = 'Retry Changes';
                    if (updatedCount > 0) {
                        recordSaveUsage();
                        toastError(`Updated ${updatedCount} scenes, but ${failedCount} failed. The editor has stayed open so you can retry.`);
                        await refreshSceneCards();
                    } else {
                        toastError(`No scenes were updated. All ${failedCount} updates failed; review the error log and retry.`);
                    }
                }
            };
            }

            setupPopupListeners(form, signal, () => {});

            await Promise.all([
                fetchColumnData('tags', tagsTable, '', selectedTagIds),
                fetchColumnData('performers', performersTable, '', selectedPerformerIds),
                renderStudioBar(''),
                renderGroupBar('')
            ]);
            refreshAllUI();

            const targetCard = (bulkScenes[0] && bulkScenes[0].card && document.body.contains(bulkScenes[0].card)) ? bulkScenes[0].card : null;
            positionPopupNearCard(form, targetCard);

            setTimeout(() => {
                if (popup.globalSearch && document.body.contains(popup.globalSearch)) {
                    popup.globalSearch.focus({ preventScroll: true });
                }
            }, 80);
        } catch (err) {
            console.error('[FastTag] Error opening Bulk Edit Everything:', err);
            toastError(`Error opening Bulk Edit Everything: ${err?.message || err}`);
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
            data: getCachedOrNull(type) || [],
            layout: "fitColumns",
            columnResizeMode: "fit",
            height: "100%",
            placeholder: () => getCachedOrNull(type) ? `No ${config.pluralTitle} Found` : `Loading ${config.pluralTitle}...`,
            selectable: true,
            index: "id",
            rowFormatter: (row) => {
                const d = row.getData();
                if (d && (d._isVirtualOrganized || d.id === '⚡' || d.id === '◯' || d.id === '✓')) {
                    const el = row.getElement();
                    el.classList.add('fasttag-virtual-action-row');
                    if (d._isOrganizedState) {
                        el.classList.add('fasttag-action-completed');
                        el.classList.remove('fasttag-action-pending');
                    } else {
                        el.classList.add('fasttag-action-pending');
                        el.classList.remove('fasttag-action-completed');
                    }
                }
            },
            columnDefaults: {
                headerSort: false
            },
            columns: getColumnsWithSavedWidths(type, 'single', () => {
                if (activePopup?._fastTagFetchData) {
                    activePopup._fastTagFetchData(activePopup.searchInput?.value || '', false);
                }
            }),
        });
        attachColumnWidthSaver(table, type, 'single');
        if (type === 'performers') attachPerformerHoverCard(table, activePopup.tableContainer);
        activeTableInstance = table;

        setupPopupListeners(form, signal, async () => {
            const saveBtn = form.querySelector(`button[id$="-save-btn"]`);
            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click();
            } else {
                closePopup();
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

        sequentialEditState.currentSceneId = sceneId;
        form._fastTagSceneId = sceneId;
        form._fastTagSceneCard = cardElement;
        attachScenePreview(popup.previewContainer, sceneId, cardElement);

        const existingRes = await fetchGQL(config.fetchExistingQuery, { id: sceneId });
        form._fastTagSceneData = existingRes?.data?.findScene;
        if (popup.organizedBtn) {
            if (!popup._organizedController) {
                popup._organizedController = setupOrganizedButton(popup.organizedBtn, () => form._fastTagSceneId, form._fastTagSceneData?.organized);
            } else {
                popup._organizedController.update(form._fastTagSceneData?.organized);
            }
        }
        const existingIds = config.extractExisting(existingRes.data);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        sequentialEditState.initialSelectedIds = new Set(selectedIds);
        let isRestoringSelections = false;
        setupSequentialEditHandlers(form, type, sceneId, cardElement, () => selectedIds);

        const saveBtn = popup.saveBtn || form.querySelector(`#${type}-save-btn`);
        if (saveBtn) {
            saveBtn.onclick = async (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (sequentialEditState.enabled) {
                    const currentNum = sequentialEditState.currentIndex + 1;
                    const totalNum = sequentialEditState.allSceneCards.length;
                    const isLast = currentNum >= totalNum;
                    if (isLast) {
                        closePopup();
                    } else {
                        await navigateToNextScene(form, type, 1, () => selectedIds);
                    }
                } else {
                    closePopup();
                }
            };
        }

        const filterInput = popup.searchInput;
        const clearBtn = popup.searchClear;
        const createBtn = popup.createBtn;
        const refreshBtn = popup.refreshBtn;
        const kbdShortcut = popup.kbdShortcut;

        const updateVisibility = () => {
            const val = filterInput.value.trim();
            const hasVal = val.length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            if (kbdShortcut) kbdShortcut.style.display = hasVal ? 'none' : 'block';

            if (hasVal && popup.bottomCreateContainer && createBtn) {
                const currentData = activeTableInstance && typeof activeTableInstance.getData === 'function' ? activeTableInstance.getData() : [];
                const hasExactMatch = currentData.some(item => (item[config.labelKey] || '').toLowerCase() === val.toLowerCase());
                if (!hasExactMatch) {
                    createBtn.textContent = `+ Create ${config.title} "${val}"`;
                    popup.bottomCreateContainer.style.display = 'flex';
                } else {
                    popup.bottomCreateContainer.style.display = 'none';
                }
            } else if (popup.bottomCreateContainer) {
                popup.bottomCreateContainer.style.display = 'none';
            }
        };

        let smartSuggestions = [];
        const onRecentChipSelect = async () => {
            if (filterInput && filterInput.value) {
                filterInput.value = '';
                updateVisibility();
            }
            refreshUI();
            const savePromise = saveWithoutReload(sceneId, selectedIds);
            await fetchData('', true);
            refreshUI();
            await savePromise;
            if (filterInput) filterInput.focus({ preventScroll: true });
        };

        const refreshUI = () => {
            updateSequentialEditUI(form, type, selectedIds);
            renderQuickActions(form, type, filterInput, selectedIds, onRecentChipSelect);
            renderSmartSuggestions(form, type, filterInput, selectedIds, smartSuggestions, onRecentChipSelect);
        };
        form._fastTagOnResize = refreshUI;

        let pendingSaveSeq = 0;
        const saveWithoutReload = async (sId, ids, showToast = true) => {
            const currentSeq = ++pendingSaveSeq;
            sessionStorage.setItem(scrollKey, window.scrollY);
            const success = await updateEntityForScene(type, sId, Array.from(ids));
            if (currentSeq !== pendingSaveSeq) return success;
            if (success) {
                if (getAutoMarkOrganized()) {
                    updateSceneOrganized(sId, true);
                    if (popup._organizedController) {
                        popup._organizedController.update(true);
                    }
                }
                sequentialEditState.initialSelectedIds = new Set(ids);
                refreshSceneCardsDebounced(sId);
                recordSaveUsage();
                if (showToast) {
                    toastSuccess(`${config.pluralTitle} updated`);
                }
                updateSequentialEditUI(form, type, ids);
            }
            return success;
        };

        if (activeTableInstance) {
            try {
                activeTableInstance.off("rowClick");
                activeTableInstance.off("rowSelected");
                activeTableInstance.off("rowDeselected");
            } catch (e) {}
        }

        activeTableInstance.on("rowClick", async (e, row) => {
            const rowData = row.getData();
            if (!rowData || !rowData.id) return;
            const strId = String(rowData.id);

            if (rowData._isVirtualOrganized || strId === '__fasttag_virtual_organized__' || strId === '⚡' || strId === '◯' || strId === '✓') {
                if (popup.organizedBtn) {
                    popup.organizedBtn.click();
                }
                filterInput.value = '';
                updateVisibility();
                refreshUI();
                await fetchData("", true);
                if (filterInput) filterInput.focus({ preventScroll: true });
                return;
            }

            const wasSelected = selectedIds.has(strId);

            if (wasSelected) {
                selectedIds.delete(strId);
                activeTableInstance.deselectRow(row);
            } else {
                selectedIds.add(strId);
                activeTableInstance.selectRow(row);
                addRecentEntry(type, rowData);
            }

            refreshUI();
            saveWithoutReload(sceneId, selectedIds);

            const hasSearch = filterInput && filterInput.value.trim().length > 0;
            if (hasSearch) {
                filterInput.value = '';
                if (searchClear) searchClear.style.display = 'none';
                if (form.querySelector(`#${type}-kbd-shortcut`)) form.querySelector(`#${type}-kbd-shortcut`).style.display = 'block';
                await fetchData('', true);
                if (!wasSelected) {
                    const r = activeTableInstance.getRow(rowData.id);
                    if (r) activeTableInstance.scrollToRow(r, "top", false);
                }
                singleNavIndex = -1;
                updateSingleKeyboardHighlight();
                if (filterInput) filterInput.focus({ preventScroll: true });
            } else {
                if (!wasSelected) {
                    if (refreshBtn) {
                        refreshBtn.classList.add('fasttag-refresh-pulse');
                        refreshBtn.title = 'Re-sort list & pin selected tags to top';
                    }
                } else {
                    await fetchData('', true);
                }
                if (filterInput) filterInput.focus({ preventScroll: true });
            }
            refreshUI();
        });

        form.onclick = (e) => {
            if (!e.target.closest('input, textarea')) {
                if (filterInput) filterInput.focus({ preventScroll: true });
            }
        };

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull(type);
            if (!cachedData) {
                const res = await fetchGQL(config.fetchQuery);
                cachedData = config.extractList(res.data);
                setCache(type, cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = Array.from(cachedData);
            const searchFields = config.searchFields || [config.labelKey];
            if (term) {
                const tokens = term.split(/\s+/);
                data = data.filter(item => {
                    const itemSearchStr = searchFields
                        .map(f => String(item[f] || '').trim().toLowerCase())
                        .filter(Boolean)
                        .join(' ');
                    return tokens.every(t => itemSearchStr.includes(t));
                });
            }

            data.sort(getSmartSortComparator(term, selectedIds, config.labelKey, searchFields, getSavedSortKey(type)));

            if (type === 'tags' && term && ('organized'.startsWith(term) || 'unorganized'.startsWith(term) || 'organised'.startsWith(term) || 'unorganised'.startsWith(term) || term === 'org')) {
                const isOrg = popup._organizedController ? popup._organizedController.get() : false;
                const orgWord = getOrganizedWord('organized');
                const markWord = getOrganizedWord('mark_as');
                data.unshift({
                    id: isOrg ? '✓' : '⚡',
                    name: isOrg ? orgWord : markWord,
                    _isVirtualOrganized: true,
                    _isOrganizedState: isOrg
                });
            }

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
                updateVisibility();
                if (resetScroll && data.length > 0) {
                    const holder = activeTableInstance.element?.querySelector('.tabulator-tableholder') || activeTableInstance.element;
                    if (holder) {
                        holder.scrollTop = 0;
                        holder.scrollLeft = 0;
                    }
                    const firstRow = activeTableInstance.getRows()[0];
                    if (firstRow) activeTableInstance.scrollToRow(firstRow, "top", false);
                }
            } finally {
                isRestoringSelections = false;
            }
        }
        popup._fastTagFetchData = fetchData;

        let debounceTimer = null;
        let currentSingleSection = 'table'; // 'table' | 'recent' | 'suggestions' | 'create'
        let singleNavIndex = -1;

        const getSingleSuggestions = () => {
            const container = form.querySelector(`#${type}-suggestions-container`);
            if (!container || container.style.display === 'none' || container.offsetParent === null) return [];
            return Array.from(container.querySelectorAll('button'));
        };

        const getSingleRecentChips = () => {
            const container = form.querySelector(`#${type}-quick-actions`);
            if (!container || container.style.display === 'none' || container.offsetParent === null) return [];
            return Array.from(container.querySelectorAll('.fasttag-quick-chip'));
        };

        const scrollSingleRowIntoViewIfNeeded = (row) => {
            if (!activeTableInstance || !row) return;
            const el = typeof row.getElement === 'function' ? row.getElement() : null;
            const holder = activeTableInstance.element?.querySelector('.tabulator-tableholder');
            if (holder && el) {
                const holderRect = holder.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                if (elRect.bottom > holderRect.bottom) {
                    holder.scrollTop += (elRect.bottom - holderRect.bottom + 4);
                } else if (elRect.top < holderRect.top) {
                    holder.scrollTop -= (holderRect.top - elRect.top + 4);
                }
            } else if (typeof row.scrollTo === 'function') {
                row.scrollTo('nearest', false);
            }
        };

        const updateSingleKeyboardHighlight = () => {
            if (!activeTableInstance || typeof activeTableInstance.getRows !== 'function') return;
            const rows = activeTableInstance.getRows();
            const isBottomCreateVisible = popup.bottomCreateContainer && popup.bottomCreateContainer.style.display !== 'none';

            rows.forEach(r => {
                const el = r.getElement();
                if (el) el.classList.remove('fasttag-keyboard-active');
            });
            form.querySelectorAll('.fasttag-keyboard-meta-focus').forEach(el => el.classList.remove('fasttag-keyboard-meta-focus'));

            if (createBtn) {
                createBtn.classList.remove('fasttag-create-btn-active');
                createBtn.style.boxShadow = '0 2px 5px rgba(5,150,105,0.3)';
                createBtn.style.transform = 'none';
                createBtn.style.filter = 'none';
            }

            if (currentSingleSection === 'suggestions') {
                const suggBtns = getSingleSuggestions();
                if (suggBtns.length > 0) {
                    if (singleNavIndex < 0) singleNavIndex = 0;
                    if (singleNavIndex >= suggBtns.length) singleNavIndex = suggBtns.length - 1;
                    const btn = suggBtns[singleNavIndex];
                    if (btn) {
                        btn.classList.add('fasttag-keyboard-meta-focus');
                        if (typeof btn.scrollIntoView === 'function') {
                            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        }
                    }
                }
                return;
            }

            if (currentSingleSection === 'recent') {
                const recentChips = getSingleRecentChips();
                if (recentChips.length > 0) {
                    if (singleNavIndex < 0) singleNavIndex = 0;
                    if (singleNavIndex >= recentChips.length) singleNavIndex = recentChips.length - 1;
                    const chip = recentChips[singleNavIndex];
                    if (chip) {
                        chip.classList.add('fasttag-keyboard-meta-focus');
                        if (typeof chip.scrollIntoView === 'function') {
                            chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
                        }
                    }
                }
                return;
            }

            if (currentSingleSection === 'create') {
                if (createBtn && isBottomCreateVisible) {
                    createBtn.classList.add('fasttag-create-btn-active');
                    createBtn.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.5), 0 2px 8px rgba(0,0,0,0.3)';
                    createBtn.style.transform = 'scale(1.02)';
                    createBtn.style.filter = 'brightness(1.15)';
                }
                return;
            }

            if (currentSingleSection === 'table') {
                if (singleNavIndex >= 0 && singleNavIndex < rows.length && rows[singleNavIndex]) {
                    const el = rows[singleNavIndex].getElement();
                    if (el) el.classList.add('fasttag-keyboard-active');
                    scrollSingleRowIntoViewIfNeeded(rows[singleNavIndex]);
                }
            }
        };

        filterInput.oninput = (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            const val = e.target.value.trim();
            debounceTimer = setTimeout(async () => {
                await fetchData(e.target.value, true);
                if (val.length > 0) {
                    const rows = activeTableInstance && typeof activeTableInstance.getRows === 'function' ? activeTableInstance.getRows() : [];
                    if (rows.length > 0) {
                        currentSingleSection = 'table';
                        singleNavIndex = 0;
                    } else if (popup.bottomCreateContainer && popup.bottomCreateContainer.style.display !== 'none') {
                        currentSingleSection = 'create';
                        singleNavIndex = 0;
                    } else if (getSingleRecentChips().length > 0) {
                        currentSingleSection = 'recent';
                        singleNavIndex = 0;
                    } else if (getSingleSuggestions().length > 0) {
                        currentSingleSection = 'suggestions';
                        singleNavIndex = 0;
                    } else {
                        currentSingleSection = 'table';
                        singleNavIndex = -1;
                    }
                } else {
                    currentSingleSection = 'table';
                    singleNavIndex = -1;
                }
                updateSingleKeyboardHighlight();
            }, 150);
        };

        filterInput.onkeydown = async (e) => {
            if (e.altKey && (e.key === 'o' || e.key === 'O' || e.code === 'KeyO')) {
                e.preventDefault();
                e.stopPropagation();
                if (popup.organizedBtn) {
                    popup.organizedBtn.click();
                    setTimeout(() => {
                        if (type === 'tags' && filterInput.value.trim()) {
                            fetchData(filterInput.value, false);
                        }
                    }, 50);
                }
                return;
            }

            const rows = activeTableInstance && typeof activeTableInstance.getRows === 'function' ? activeTableInstance.getRows() : [];
            const isBottomCreateVisible = popup.bottomCreateContainer && popup.bottomCreateContainer.style.display !== 'none';
            const suggBtns = getSingleSuggestions();
            const recentChips = getSingleRecentChips();

            if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                if (currentSingleSection === 'suggestions' && suggBtns.length > 0) {
                    e.preventDefault();
                    if (e.key === 'ArrowLeft') {
                        if (singleNavIndex > 0) singleNavIndex--;
                        else singleNavIndex = suggBtns.length - 1;
                    } else {
                        if (singleNavIndex < suggBtns.length - 1) singleNavIndex++;
                        else singleNavIndex = 0;
                    }
                    updateSingleKeyboardHighlight();
                    return;
                } else if (currentSingleSection === 'recent' && recentChips.length > 0) {
                    e.preventDefault();
                    if (e.key === 'ArrowLeft') {
                        if (singleNavIndex > 0) singleNavIndex--;
                        else singleNavIndex = recentChips.length - 1;
                    } else {
                        if (singleNavIndex < recentChips.length - 1) singleNavIndex++;
                        else singleNavIndex = 0;
                    }
                    updateSingleKeyboardHighlight();
                    return;
                }
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (singleNavIndex < 0) {
                    const hasVal = filterInput.value.trim().length > 0;
                    if (!hasVal) {
                        if (suggBtns.length > 0) {
                            currentSingleSection = 'suggestions';
                            singleNavIndex = 0;
                        } else if (recentChips.length > 0) {
                            currentSingleSection = 'recent';
                            singleNavIndex = 0;
                        } else if (rows.length > 0) {
                            currentSingleSection = 'table';
                            singleNavIndex = 0;
                        } else if (isBottomCreateVisible) {
                            currentSingleSection = 'create';
                            singleNavIndex = 0;
                        }
                    } else {
                        if (rows.length > 0) {
                            currentSingleSection = 'table';
                            singleNavIndex = 0;
                        } else if (isBottomCreateVisible) {
                            currentSingleSection = 'create';
                            singleNavIndex = 0;
                        } else if (suggBtns.length > 0) {
                            currentSingleSection = 'suggestions';
                            singleNavIndex = 0;
                        } else if (recentChips.length > 0) {
                            currentSingleSection = 'recent';
                            singleNavIndex = 0;
                        }
                    }
                    updateSingleKeyboardHighlight();
                    return;
                }

                if (currentSingleSection === 'suggestions') {
                    if (recentChips.length > 0) {
                        currentSingleSection = 'recent';
                        singleNavIndex = 0;
                    } else if (rows.length > 0) {
                        currentSingleSection = 'table';
                        singleNavIndex = 0;
                    } else if (isBottomCreateVisible) {
                        currentSingleSection = 'create';
                        singleNavIndex = 0;
                    }
                } else if (currentSingleSection === 'recent') {
                    if (rows.length > 0) {
                        currentSingleSection = 'table';
                        singleNavIndex = 0;
                    } else if (isBottomCreateVisible) {
                        currentSingleSection = 'create';
                        singleNavIndex = 0;
                    }
                } else if (currentSingleSection === 'table') {
                    if (rows.length > 0) {
                        if (singleNavIndex < 0) {
                            singleNavIndex = 0;
                        } else if (singleNavIndex < rows.length - 1) {
                            singleNavIndex++;
                        } else if (singleNavIndex === rows.length - 1 && isBottomCreateVisible) {
                            currentSingleSection = 'create';
                            singleNavIndex = 0;
                        }
                    } else if (isBottomCreateVisible) {
                        currentSingleSection = 'create';
                        singleNavIndex = 0;
                    }
                }
                updateSingleKeyboardHighlight();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (singleNavIndex < 0) {
                    if (recentChips.length > 0) {
                        currentSingleSection = 'recent';
                        singleNavIndex = 0;
                    } else if (suggBtns.length > 0) {
                        currentSingleSection = 'suggestions';
                        singleNavIndex = 0;
                    }
                    updateSingleKeyboardHighlight();
                    return;
                }
                if (currentSingleSection === 'create') {
                    if (rows.length > 0) {
                        currentSingleSection = 'table';
                        singleNavIndex = rows.length - 1;
                    } else if (recentChips.length > 0) {
                        currentSingleSection = 'recent';
                        singleNavIndex = 0;
                    } else if (suggBtns.length > 0) {
                        currentSingleSection = 'suggestions';
                        singleNavIndex = 0;
                    }
                } else if (currentSingleSection === 'table') {
                    if (singleNavIndex > 0) {
                        singleNavIndex--;
                    } else {
                        if (recentChips.length > 0) {
                            currentSingleSection = 'recent';
                            singleNavIndex = 0;
                        } else if (suggBtns.length > 0) {
                            currentSingleSection = 'suggestions';
                            singleNavIndex = 0;
                        } else {
                            singleNavIndex = -1;
                        }
                    }
                } else if (currentSingleSection === 'recent') {
                    if (suggBtns.length > 0) {
                        currentSingleSection = 'suggestions';
                        singleNavIndex = 0;
                    }
                }
                updateSingleKeyboardHighlight();
            } else if (e.key === 'Enter') {
                clearTimeout(debounceTimer);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                if (e.ctrlKey || e.metaKey) {
                    const saveBtn = form.querySelector('button[id$="-save-btn"]');
                    if (saveBtn) saveBtn.click();
                    return;
                }

                if (currentSingleSection === 'suggestions') {
                    if (suggBtns.length > 0 && singleNavIndex >= 0 && singleNavIndex < suggBtns.length) {
                        suggBtns[singleNavIndex].click();
                        if (filterInput.value.trim().length > 0) {
                            filterInput.value = '';
                            updateVisibility();
                            await fetchData("", false);
                            filterInput.focus({ preventScroll: true });
                        }
                    }
                    return;
                }

                if (currentSingleSection === 'recent') {
                    if (recentChips.length > 0 && singleNavIndex >= 0 && singleNavIndex < recentChips.length) {
                        recentChips[singleNavIndex].click();
                        if (filterInput.value.trim().length > 0) {
                            filterInput.value = '';
                            updateVisibility();
                            await fetchData("", false);
                            filterInput.focus({ preventScroll: true });
                        }
                    }
                    return;
                }

                if (currentSingleSection === 'create' && isBottomCreateVisible) {
                    createBtn.click();
                    return;
                }

                const hadSearch = filterInput.value.trim().length > 0;
                if (!hadSearch && singleNavIndex < 0) {
                    const saveBtn = form.querySelector('button[id$="-save-btn"]');
                    if (saveBtn) saveBtn.click();
                    return;
                }

                const targetIdx = singleNavIndex >= 0 ? singleNavIndex : 0;
                if (rows.length > 0 && rows[targetIdx]) {
                    const targetRow = rows[targetIdx];
                    const rowData = targetRow.getData();
                    if (rowData && rowData.id) {
                        const strId = String(rowData.id);
                        if (rowData._isVirtualOrganized || strId === '__fasttag_virtual_organized__' || strId === '⚡' || strId === '◯' || strId === '✓') {
                            if (popup.organizedBtn) {
                                popup.organizedBtn.click();
                            }
                            filterInput.value = '';
                            updateVisibility();
                            refreshUI();
                            await fetchData("", true);
                            currentSingleSection = 'table';
                            singleNavIndex = -1;
                            updateSingleKeyboardHighlight();
                            if (filterInput) filterInput.focus({ preventScroll: true });
                            return;
                        }
                        const wasSelected = selectedIds.has(strId);
                        if (wasSelected) {
                            selectedIds.delete(strId);
                            activeTableInstance.deselectRow(targetRow);
                        } else {
                            selectedIds.add(strId);
                            activeTableInstance.selectRow(targetRow);
                            addRecentEntry(type, rowData);
                        }
                        if (hadSearch) {
                            filterInput.value = '';
                            updateVisibility();
                            refreshUI();
                            saveWithoutReload(sceneId, selectedIds);
                            fetchData("", true).then(() => {
                                if (!wasSelected) {
                                    const r = activeTableInstance.getRow(rowData.id);
                                    if (r) activeTableInstance.scrollToRow(r, "top", false);
                                }
                                currentSingleSection = 'table';
                                singleNavIndex = -1;
                                updateSingleKeyboardHighlight();
                                if (filterInput) filterInput.focus({ preventScroll: true });
                            });
                        } else {
                            if (refreshBtn) {
                                refreshBtn.classList.add('fasttag-refresh-pulse');
                                refreshBtn.title = 'Re-sort list & pin selected tags to top';
                            }
                            saveWithoutReload(sceneId, selectedIds);
                            refreshUI();
                            if (filterInput) filterInput.focus({ preventScroll: true });
                        }
                        updateSingleKeyboardHighlight();
                    }
                }
            }
        };

        clearBtn.onclick = () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus({ preventScroll: true });
        };

        refreshBtn.onclick = async () => {
            refreshBtn.classList.remove('fasttag-refresh-pulse');
            refreshBtn.title = 'Refresh cache';
            invalidateCache(type);
            await fetchData(filterInput.value.trim(), true);
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
        const sceneCard = findSceneCardForContextTarget(event.target);
        if (!sceneCard) return;

        // Keep the browser's native menu on preview images, videos and media controls.
        if (isScenePreviewContextTarget(event.target, sceneCard)) return;

        const sceneId = extractSceneId(sceneCard);
        if (sceneId) {
            showCustomMenu(event, sceneId, sceneCard);
        }
    }, true);

    document.addEventListener('click', function(event) {
        if (activePopup) return;
        if (!getEnableCardIconClicks()) return;
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

    // --- Background Cache Preloader (Instant 0ms popup opening) ---
    async function preloadCaches() {
        await prewarmCacheFromIDB();
        const types = ['tags', 'performers', 'studios', 'groups', 'galleries'];
        for (const type of types) {
            if (!getCachedOrNull(type)) {
                try {
                    const config = ENTITY_CONFIG[type];
                    if (config?.fetchQuery) {
                        const res = await fetchGQL(config.fetchQuery);
                        if (res?.data) {
                            const data = config.extractList(res.data);
                            if (Array.isArray(data) && data.length > 0) {
                                setCache(type, data);
                            }
                        }
                    }
                } catch (e) {}
            }
        }
    }
    // Prewarm from IndexedDB immediately on script execution, then run background checks after 300ms
    prewarmCacheFromIDB();
    setTimeout(preloadCaches, 300);
})();
