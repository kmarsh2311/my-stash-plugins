// ==UserScript==
// @name         Stash FastTag
// @namespace    http://tampermonkey.net/
// @version      4.3.0
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
    const FastTagDiagnostics = window.FastTag?.diagnostics;
    if (!FastTagDiagnostics) throw new Error('[FastTag] fasttag-diagnostics.js must load before fasttag.js');
    const FastTagApi = window.FastTag?.api;
    if (!FastTagApi) throw new Error('[FastTag] fasttag-api.js must load before fasttag.js');
    const FastTagNotifications = window.FastTag?.notifications;
    if (!FastTagNotifications) throw new Error('[FastTag] fasttag-notifications.js must load before fasttag.js');
    const FastTagSettings = window.FastTag?.settings;
    if (!FastTagSettings) throw new Error('[FastTag] fasttag-settings.js must load before fasttag.js');
    const FastTagIntegrations = window.FastTag?.integrations;
    if (!FastTagIntegrations) throw new Error('[FastTag] fasttag-integrations.js must load before fasttag.js');
    const FastTagGemini = window.FastTag?.gemini;
    if (!FastTagGemini) throw new Error('[FastTag] fasttag-gemini.js must load before fasttag.js');
    const FastTagScraper = window.FastTag?.scraper;
    if (!FastTagScraper) throw new Error('[FastTag] fasttag-scraper.js must load before fasttag.js');
    const FastTagScraperUi = window.FastTag?.scraperUi;
    if (!FastTagScraperUi) throw new Error('[FastTag] fasttag-scraper-ui.js must load before fasttag.js');
    const FastTagScraperController = window.FastTag?.scraperController;
    if (!FastTagScraperController) throw new Error('[FastTag] fasttag-scraper-controller.js must load before fasttag.js');
    const FastTagPreview = window.FastTag?.preview;
    if (!FastTagPreview) throw new Error('[FastTag] fasttag-preview.js must load before fasttag.js');
    const FastTagCoverEditor = window.FastTag?.coverEditor;
    if (!FastTagCoverEditor) throw new Error('[FastTag] fasttag-cover-editor.js must load before fasttag.js');
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
        getFillMissingPerformerImages,
        setFillMissingPerformerImages,
        getScraperMatchingSettings,
        setScraperMatchingSettings,
        setScraperMatchingPreset,
        resetScraperMatchingSettings,
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
        getDebugMode,
        setDebugMode,
        ftLog,
        getLogBufferSize,
        clearDebugLogs,
        exportDebugLogsAsText,
        downloadDebugLogFile,
        copyDebugLogsToClipboard,
        attachGlobalErrorListeners
    } = FastTagDiagnostics;
    const { fetchGQL } = FastTagApi;
    const { showToast, toastSuccess, toastError } = FastTagNotifications;
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
        isPopupActive: isScraperPopupActive,
        beginRequest: beginScraperRequest,
        invalidateRequests: invalidateScraperRequests,
        isRequestCurrent: isScraperRequestCurrent,
        watchHudOwner: watchFloatingScraperHudOwner,
        closeHud: closeFloatingScraperHud,
        getInitialPopoutPosition: getInitialScraperPopoutPosition,
        attachResizeHandles: attachScraperHudResizeHandles,
        sessionCache: sessionScrapeCache,
        renderMatches: renderScraperMatchCard,
        acceptMatch: handleAcceptScrapeMatch
    } = FastTagScraperController;
    const {
        getDefaultPopoutSize,
        attachScenePreview,
        closeFloatingVideoHud,
        abortCurrentPreview
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

    FastTagDiagnostics.configure({ getUsageCount: () => getUsageCount() });
    FastTagDiagnostics.attachGlobalErrorListeners();
    FastTagApi.configure({
        fetchImpl: (...args) => window.fetch(...args),
        log: (...args) => ftLog(...args),
        getDebugMode: () => getDebugMode()
    });
    FastTagNotifications.configure({
        escapeHtml,
        getDebugMode: () => getDebugMode(),
        log: (...args) => ftLog(...args)
    });

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
        getScraperMatchingSettings,
        getFillMissingPerformerImages,
        getEntityConfig: type => ENTITY_CONFIG[type],
        getCachedOrNull: type => getCachedOrNull(type),
        setCache: (type, data) => setCache(type, data)
    });
    FastTagScraperController.configure({
        getActivePopup: () => activePopup,
        getFloatingVideoHudElement: () => FastTagPreview.getFloatingHudElement(),
        isVideoPoppedOut: () => FastTagPreview.isPoppedOut(),
        getDefaultEverythingPosition: (...args) => getDefaultEverythingPosition(...args),
        entityConfig: ENTITY_CONFIG,
        getScraperMatchingSettings,
        getHideObviousFalsePositives,
        partitionObviousFalsePositiveMatches,
        getDetachScraper,
        getEffectiveTheme: () => getEffectiveTheme(),
        getCachedOrNull: type => getCachedOrNull(type),
        setCache: (type, data) => setCache(type, data),
        cleanTitleForScraping,
        isEasterEggActive: () => isEasterEggActive(),
        setScraperHudPersistedOpen,
        fetchScraperMatchesForScene: (...args) => fetchScraperMatchesForScene(...args),
        analyzeScraperMatch,
        getScraperResultUrl,
        getPerformerPresentation,
        getAssessmentPresentation,
        getSourcePresentation,
        getUnavailableContextPresentation,
        getAcceptPresentation,
        formatDurationSec,
        escapeHtml,
        setDetachScraper,
        hideScrapeCoverTooltip: () => hideScrapeCoverTooltip(),
        showScrapeCoverTooltip: (...args) => showScrapeCoverTooltip(...args),
        startScrapedPerformerHover: (...args) => startScrapedPerformerHover(...args),
        stopScrapedPerformerHover: () => stopScrapedPerformerHover(),
        log: (...args) => ftLog(...args),
        readScrapeFieldSelection,
        resolveScrapedStudioResult,
        resolveScrapedEntityIdsResult,
        fetchGQL: (...args) => fetchGQL(...args),
        buildAcceptedSceneStashIds,
        buildScrapeUpdateInput,
        sceneCardUpdateFields: SCENE_CARD_UPDATE_FIELDS,
        syncSceneToApolloCache,
        setLiveEverythingPopupTitle: (...args) => setLiveEverythingPopupTitle(...args),
        refreshSceneCards: (...args) => refreshSceneCards(...args),
        recordSaveUsage: () => recordSaveUsage(),
        toastError: (...args) => toastError(...args),
        toastSuccess: (...args) => toastSuccess(...args)
    });
    FastTagPreview.configure({
        fetchGQL: (...args) => fetchGQL(...args),
        coverEditor: FastTagCoverEditor,
        getSceneUrl: (...args) => getSceneUrl(...args),
        getScrubSpeeds,
        getScrubCueCount,
        incrementScrubCueCount,
        MAX_SCRUB_CUE_DISPLAYS,
        isVideoHudPersistedOpen,
        setVideoHudPersistedOpen,
        getAlwaysPlayFullVideo,
        showToast: (...args) => showToast(...args),
        log: (...args) => ftLog(...args),
        getActivePopup: () => activePopup,
        getFloatingScraperHudElement: () => FastTagScraperController.getHudElement(),
        getDefaultEverythingPosition: (...args) => getDefaultEverythingPosition(...args)
    });
    FastTagCoverEditor.configure({
        fetchGQL: (...args) => fetchGQL(...args),
        refreshSceneCards: sceneId => refreshSceneCards(sceneId),
        showToast: (...args) => showToast(...args),
        getTheme: () => getEffectiveTheme(),
        log: (...args) => ftLog(...args)
    });
    FastTagUi.configure({
        getDefaultPopoutSize,
        log: (...args) => ftLog(...args)
    });

    console.log('[FastTag v4.3.0] Initialized with Targeted Apollo Cache Sync, IndexedDB Cache, and 0ms Scene Card Updates');

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
        return FastTagSettings.open({
            cacheStore,
            getEffectiveTheme,
            getThemePreference,
            getShowIdColumns,
            getEnableSuggestions,
            getAutoScrapeSequential,
            getScrubSpeeds,
            getScraperMatchingSettings,
            getShowRecentChips,
            getShowPinnedChips,
            getEnableCardIconClicks,
            getAlwaysPlayFullVideo,
            getOrganizedWord,
            getAutoMarkOrganized,
            getDetachScraper,
            getFillMissingPerformerImages,
            getGeminiApiKey,
            getGeminiModel,
            getGeminiAutoParse,
            getDebugMode,
            getLogBufferSize,
            setThemePreference,
            setShowIdColumns,
            setEnableSuggestions,
            setShowRecentChips,
            setShowPinnedChips,
            setEnableCardIconClicks,
            setAlwaysPlayFullVideo,
            setAutoMarkOrganized,
            setAutoScrapeSequential,
            setDetachScraper,
            setFillMissingPerformerImages,
            setScraperMatchingSettings,
            setScraperMatchingPreset,
            resetScraperMatchingSettings,
            setScrubSpeeds,
            resetScrubCueCount,
            DEFAULT_SCRUB_SPEEDS,
            setGeminiApiKey,
            setGeminiModel,
            setGeminiAutoParse,
            callGeminiAPI,
            setDebugMode,
            copyDebugLogsToClipboard,
            downloadDebugLogFile,
            clearDebugLogs,
            resetAllLayoutsToDefault,
            invalidateCache,
            promptDebugModeWarningDialog,
            loadFastTagHelpModule,
            showToast,
            toastError
        });
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
        if (FastTagCoverEditor.closeActiveEditor?.() === false) return false;
        isModalClosing = true;
        try {
            if (activePopup) {
                activePopup._fastTagClosed = true;
                invalidateScraperRequests(activePopup);
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
            abortCurrentPreview();
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
            FastTagPreview.resetSessionCue();

            document.body.classList.remove('fasttag-modal-open');
            if (resetSequential) {
                resetSequentialEditState();
                sessionScrapeCache.clear();
                window._fastTagEverythingScraperOpen = false;
            }
            refreshSceneCardsDebounced(null, 50);
            return true;
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
            FastTagPreview.resetLayoutState();
            FastTagScraperController.resetLayoutState();

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
    let performerHoverHideTimeout = null;

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

    function cancelPerformerHoverCardHide() {
        if (performerHoverHideTimeout) {
            clearTimeout(performerHoverHideTimeout);
            performerHoverHideTimeout = null;
        }
    }

    function schedulePerformerHoverCardHide(delay = 260) {
        cancelPerformerHoverCardHide();
        performerHoverHideTimeout = setTimeout(() => {
            performerHoverHideTimeout = null;
            if (!isHoveringCard) hidePerformerHoverCard();
        }, delay);
    }

    function hidePerformerHoverCard() {
        if (isHoveringCard) return;
        cancelPerformerHoverCardHide();
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
        cancelPerformerHoverCardHide();
        if (!performerHoverCardElement) {
            performerHoverCardElement = document.createElement('div');
            performerHoverCardElement.id = 'fasttag-performer-hover-card';
            document.body.appendChild(performerHoverCardElement);
        }

        const imgUrl = data.image_path || data.images?.[0] || (data.id ? `/performer/${data.id}/image` : '');
        const safeImgUrl = escapeHtml(imgUrl);
        const profileUrl = data._profileUrl || (data.id ? `/performers/${data.id}` : '');
        const profileSource = escapeHtml(data._profileSource || (data.id ? 'Local library' : 'Scraper result'));
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

        performerHoverCardElement.style.cssText = `position: fixed; z-index: 1000005; pointer-events: auto; cursor: ${profileUrl ? 'pointer' : 'default'}; width: 315px; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 12px; box-shadow: 0 20px 45px rgba(0,0,0,0.85), inset 0 0 0 1px rgba(255,255,255,0.08); padding: 10px 11px; box-sizing: border-box; display: flex; gap: 11px; font-family: system-ui, -apple-system, sans-serif; transition: opacity 0.15s ease, transform 0.15s ease, border-color 0.15s ease; opacity: 0; transform: scale(0.96);`;

        performerHoverCardElement.innerHTML = `
            <div style="width: 110px; height: 146px; border-radius: 8px; overflow: hidden; background: #1e293b; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 4px 14px rgba(0,0,0,0.5);">
                ${imgUrl ? `<img src="${safeImgUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />` : ''}
                <div style="display: ${imgUrl ? 'none' : 'flex'}; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 42px; color: #64748b;">⭐</div>
            </div>
            <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 2px;">
                        <span style="font-size: 14.5px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${name}</span>
                        ${ratingStars}
                    </div>
                    <div style="font-size: 9.5px; color: #818cf8; margin-bottom: 3px;">${profileSource}</div>
                    ${disambiguation ? `<div style="font-size: 11px; color: #94a3b8; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 4px;">${disambiguation}</div>` : ''}
                    ${pills.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 3.5px; margin-top: 3px;">${pills.join('')}</div>` : ''}
                </div>
                <div>
                    ${aliases ? `<div style="font-size: 9.5px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 4px;"><strong style="color: #94a3b8;">aka:</strong> ${aliases}</div>` : ''}
                    ${profileUrl ? `<div style="display: flex; align-items: center; justify-content: flex-end; gap: 3px; font-size: 10px; font-weight: 600; color: #818cf8; opacity: 0.95; margin-top: 4px;"><span>View Profile</span><span style="font-size: 10.5px;">↗</span></div>` : ''}
                </div>
            </div>
        `;

        performerHoverCardElement.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (profileUrl) window.open(profileUrl, '_blank');
        };

        performerHoverCardElement.onmouseenter = () => {
            isHoveringCard = true;
            cancelPerformerHoverCardHide();
            if (performerHoverTimeout) clearTimeout(performerHoverTimeout);
            performerHoverCardElement.style.borderColor = 'rgba(99, 102, 241, 0.8)';
            performerHoverCardElement.style.opacity = '1';
            performerHoverCardElement.style.transform = 'scale(1)';
        };

        performerHoverCardElement.onmouseleave = (e) => {
            isHoveringCard = false;
            performerHoverCardElement.style.borderColor = 'rgba(148, 163, 184, 0.35)';
            if (!e.relatedTarget || !e.relatedTarget.closest('.tabulator-row, .fasttag-performer-hover-trigger')) {
                schedulePerformerHoverCardHide(120);
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
        const videoHudElement = FastTagPreview.getFloatingHudElement();
        if (FastTagPreview.isPoppedOut() && videoHudElement && document.body.contains(videoHudElement)) {
            hudRect = videoHudElement.getBoundingClientRect();
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

    function getScrapedPerformerProfileUrl(performer, match) {
        const urls = Array.isArray(performer?.urls) ? performer.urls : [];
        const directUrl = urls.find(value => /^https?:\/\//i.test(String(value || '')));
        if (directUrl) return directUrl;
        const remoteId = String(performer?.remote_site_id || '').trim();
        if (/^https?:\/\//i.test(remoteId)) return remoteId;
        const sourceEndpoint = String(match?._sourceEndpoint || '').trim();
        if (!remoteId || !/^https?:\/\//i.test(sourceEndpoint)) return '';
        const sourceRoot = sourceEndpoint.replace(/\/graphql\/?$/i, '').replace(/\/+$/, '');
        return `${sourceRoot}/performers/${encodeURIComponent(remoteId)}`;
    }

    function buildScrapedPerformerPreviewData(performer, match, cachedPerformers) {
        const normalizedName = String(performer?.name || '').trim().toLowerCase();
        const local = (cachedPerformers || []).find(item =>
            (performer?.stored_id && String(item.id) === String(performer.stored_id))
            || (normalizedName && String(item?.name || '').trim().toLowerCase() === normalizedName)
        );
        const scrapedImage = (Array.isArray(performer?.images) ? performer.images : [])
            .map(value => String(value || '').trim())
            .find(Boolean) || '';
        if (local) {
            const localImage = String(local.image_path || '');
            const localImageMissing = !localImage || /[?&]default=true(?:&|$)/i.test(localImage);
            return {
                ...performer,
                ...local,
                image_path: localImageMissing && scrapedImage ? scrapedImage : localImage,
                _profileUrl: `/performers/${local.id}`,
                _profileSource: localImageMissing && scrapedImage ? `${match?._sourceName || 'Scraper'} image · Local profile` : 'Local library'
            };
        }
        return {
            ...performer,
            image_path: scrapedImage,
            _profileUrl: getScrapedPerformerProfileUrl(performer, match),
            _profileSource: match?._sourceName || 'Scraper result'
        };
    }

    function startScrapedPerformerHover(performer, match, cachedPerformers, trigger) {
        isHoveringCard = false;
        cancelPerformerHoverCardHide();
        if (performerHoverTimeout) clearTimeout(performerHoverTimeout);
        performerHoverTimeout = setTimeout(() => {
            showPerformerHoverCard(
                buildScrapedPerformerPreviewData(performer, match, cachedPerformers),
                trigger
            );
        }, 100);
    }

    function stopScrapedPerformerHover() {
        if (performerHoverTimeout) {
            clearTimeout(performerHoverTimeout);
            performerHoverTimeout = null;
        }
        if (!isHoveringCard) schedulePerformerHoverCardHide();
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
            const coverEditorHud = document.querySelector('#fasttag-cover-editor-hud');
            const settingsModal = document.querySelector('#fasttag-settings-modal');
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
                const subModal = document.querySelector('#fasttag-settings-modal, #fasttag-create-modal, #fasttag-cover-editor-hud, .fasttag-create-dialog-overlay, .fasttag-bulk-confirm-overlay');
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
                if (FastTagCoverEditor.prepareForSceneNavigation?.() === false) return;
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
        if (FastTagCoverEditor.prepareForSceneNavigation?.() === false) return;

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
        if (FastTagCoverEditor.prepareForSceneNavigation?.() === false) return;

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

            invalidateScraperRequests(popup);
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
                if (FastTagCoverEditor.prepareForSceneNavigation?.() === false) return;
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
                    || FastTagScraperController.isHudOpen();
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

            const triggerScrapeAction = FastTagScraperController.createTrigger({
                popup,
                mode: 'everything',
                getSceneId: () => popup.currentSceneId || currentSceneId,
                getCardElement: () => popup.currentCardElement || cardElement,
                getContext: () => popup._context,
                focusAfter: () => popup.globalSearch?.focus({ preventScroll: true })
            });

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
                    toastError(`AI Parse Error: ${err.message}`, undefined, 4500);
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
            const triggerScrapeAction = FastTagScraperController.createTrigger({
                popup,
                mode: 'single',
                getSceneId: () => sceneId,
                getCardElement: () => cardElement,
                getContext: () => null,
                focusAfter: () => filterInput.focus({ preventScroll: true })
            });
            popup.triggerScrape = triggerScrapeAction;
            popup.scrapeBtn.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await triggerScrapeAction(false, sceneId, cardElement);
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
