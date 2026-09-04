(function initializeFastTagStorage(root) {
    'use strict';

    const KEYS = Object.freeze({
        theme: 'stash_fast_tag_theme',
        showIds: 'stash_fast_tag_show_ids',
        suggestions: 'stash_fast_tag_enable_suggestions',
        autoScrape: 'stash_fast_tag_auto_scrape_sequential',
        showRecent: 'fasttag_show_recent_chips',
        showPinned: 'fasttag_show_pinned_chips',
        alwaysPlayFullVideo: 'fasttag_always_play_full_video',
        cardIconClicks: 'fasttag_enable_card_icon_clicks',
        geminiApiKey: 'fasttag_gemini_api_key',
        geminiModel: 'fasttag_gemini_model',
        geminiAutoParse: 'fasttag_gemini_auto_parse',
        geminiSuggestions: 'fasttag_gemini_suggestions',
        autoMarkOrganized: 'stash_fast_tag_auto_mark_organized',
        scrubSpeeds: 'fasttag_scrub_speeds',
        scrubCueCount: 'stash_fast_tag_scrub_cue_count_v6',
        videoHudOpen: 'fasttag_video_hud_open_state',
        detachScraper: 'fasttag_detach_scraper_v1',
        scraperHudOpen: 'fasttag_scraper_hud_open_state'
    });
    const RECENT_KEYS = Object.freeze({
        tags: 'stash_fast_tag_recent_tags',
        performers: 'stash_fast_tag_recent_performers',
        galleries: 'stash_fast_tag_recent_galleries',
        studios: 'stash_fast_tag_recent_studios',
        groups: 'stash_fast_tag_recent_groups'
    });
    const PINNED_PREFIX = 'stash_fast_tag_pinned_';
    const DEFAULT_SCRUB_SPEEDS = Object.freeze({
        slow: 5.0,
        normal: 10.0,
        fast: 20.0,
        freeze: 1.0
    });
    const MAX_SCRUB_CUE_DISPLAYS = 5;
    const IDB_NAME = 'stash_fasttag_cache_db';
    const IDB_VERSION = 1;
    const IDB_STORE = 'entity_cache';
    let idbPromise = null;

    function readBoolean(key, defaultValue) {
        const value = root.localStorage.getItem(key);
        return value === null ? defaultValue : value === 'true';
    }

    function writeBoolean(key, enabled) {
        root.localStorage.setItem(key, enabled ? 'true' : 'false');
    }

    function getAutoScrapeSequential() {
        try { return readBoolean(KEYS.autoScrape, true); } catch (e) { return true; }
    }
    function setAutoScrapeSequential(enabled) {
        try { writeBoolean(KEYS.autoScrape, enabled); } catch (e) {}
    }

    function getThemePreference() { return root.localStorage.getItem(KEYS.theme) || 'dark'; }
    function setThemePreference(theme) { root.localStorage.setItem(KEYS.theme, theme); }

    function getShowIdColumns() { return readBoolean(KEYS.showIds, true); }
    function setShowIdColumns(enabled) { writeBoolean(KEYS.showIds, enabled); }
    function getEnableSuggestions() { return readBoolean(KEYS.suggestions, true); }
    function setEnableSuggestions(enabled) { writeBoolean(KEYS.suggestions, enabled); }
    function getEnableCardIconClicks() { return readBoolean(KEYS.cardIconClicks, true); }
    function setEnableCardIconClicks(enabled) { writeBoolean(KEYS.cardIconClicks, enabled); }
    function getAlwaysPlayFullVideo() { return readBoolean(KEYS.alwaysPlayFullVideo, false); }
    function setAlwaysPlayFullVideo(enabled) { writeBoolean(KEYS.alwaysPlayFullVideo, enabled); }
    function getShowRecentChips() { return readBoolean(KEYS.showRecent, true); }
    function setShowRecentChips(enabled) { writeBoolean(KEYS.showRecent, enabled); }
    function getShowPinnedChips() { return readBoolean(KEYS.showPinned, true); }
    function setShowPinnedChips(enabled) { writeBoolean(KEYS.showPinned, enabled); }

    function getGeminiApiKey() { return root.localStorage.getItem(KEYS.geminiApiKey) || ''; }
    function setGeminiApiKey(value) { root.localStorage.setItem(KEYS.geminiApiKey, (value || '').trim()); }
    function getGeminiModel() { return root.localStorage.getItem(KEYS.geminiModel) || 'gemini-flash-latest'; }
    function setGeminiModel(value) { root.localStorage.setItem(KEYS.geminiModel, value || 'gemini-flash-latest'); }
    function getGeminiAutoParse() { return readBoolean(KEYS.geminiAutoParse, true); }
    function setGeminiAutoParse(enabled) { writeBoolean(KEYS.geminiAutoParse, enabled); }
    function getGeminiSuggestions() { return readBoolean(KEYS.geminiSuggestions, true); }
    function setGeminiSuggestions(enabled) { writeBoolean(KEYS.geminiSuggestions, enabled); }
    function getAutoMarkOrganized() { return root.localStorage.getItem(KEYS.autoMarkOrganized) === 'true'; }
    function setAutoMarkOrganized(enabled) { writeBoolean(KEYS.autoMarkOrganized, enabled); }

    function getScrubSpeeds() {
        try {
            const raw = root.localStorage.getItem(KEYS.scrubSpeeds);
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
        root.localStorage.setItem(KEYS.scrubSpeeds, JSON.stringify(speeds));
    }

    function getScrubCueCount() {
        try {
            return parseInt(root.localStorage.getItem(KEYS.scrubCueCount) || '0', 10) || 0;
        } catch (e) {
            return 0;
        }
    }

    function incrementScrubCueCount() {
        try {
            root.localStorage.setItem(KEYS.scrubCueCount, String(getScrubCueCount() + 1));
        } catch (e) {}
    }

    function resetScrubCueCount() {
        try { root.localStorage.removeItem(KEYS.scrubCueCount); } catch (e) {}
    }

    function isVideoHudPersistedOpen() {
        try { return root.localStorage.getItem(KEYS.videoHudOpen) === 'true'; } catch (e) { return false; }
    }
    function setVideoHudPersistedOpen(enabled) {
        try { writeBoolean(KEYS.videoHudOpen, enabled); } catch (e) {}
    }
    function isScraperHudPersistedOpen() {
        try { return root.localStorage.getItem(KEYS.scraperHudOpen) === 'true'; } catch (e) { return false; }
    }
    function setScraperHudPersistedOpen(enabled) {
        try { writeBoolean(KEYS.scraperHudOpen, enabled); } catch (e) {}
    }
    function getDetachScraper() {
        try { return readBoolean(KEYS.detachScraper, true); } catch (e) { return true; }
    }
    function setDetachScraper(enabled) {
        try { writeBoolean(KEYS.detachScraper, enabled); } catch (e) {}
    }

    function getIDB() {
        if (typeof root.indexedDB === 'undefined') return Promise.resolve(null);
        if (idbPromise) return idbPromise;
        idbPromise = new Promise((resolve) => {
            try {
                const req = root.indexedDB.open(IDB_NAME, IDB_VERSION);
                req.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(IDB_STORE)) {
                        db.createObjectStore(IDB_STORE, { keyPath: 'type' });
                    }
                };
                req.onsuccess = (event) => resolve(event.target.result);
                req.onerror = (error) => {
                    console.warn('[FastTag] IndexedDB open error, falling back to memory cache:', error);
                    resolve(null);
                };
            } catch (error) {
                console.warn('[FastTag] IndexedDB initialization failed:', error);
                resolve(null);
            }
        });
        return idbPromise;
    }

    async function idbGet(type) {
        try {
            const db = await getIDB();
            if (!db) return null;
            return new Promise((resolve) => {
                const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(type);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }

    async function idbSet(type, data, timestamp = Date.now()) {
        try {
            const db = await getIDB();
            if (!db) return;
            db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put({ type, data, timestamp });
        } catch (error) {
            console.warn('[FastTag] Error writing to IndexedDB:', error);
        }
    }

    async function idbDelete(type) {
        try {
            const db = await getIDB();
            if (!db) return;
            const store = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE);
            if (type) store.delete(type);
            else store.clear();
        } catch (e) {}
    }

    function readPinnedEntries(type) {
        try {
            const raw = root.localStorage.getItem(PINNED_PREFIX + type);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writePinnedEntries(type, value) {
        try {
            root.localStorage.setItem(PINNED_PREFIX + type, JSON.stringify(Array.isArray(value) ? value : []));
        } catch (e) {}
    }

    function readRecentEntries(type) {
        try {
            const key = RECENT_KEYS[type];
            if (!key) return [];
            const raw = root.localStorage.getItem(key);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writeRecentEntries(type, value) {
        try {
            const key = RECENT_KEYS[type];
            if (!key) return;
            root.localStorage.setItem(key, JSON.stringify((Array.isArray(value) ? value : []).slice(0, 24)));
        } catch (e) {}
    }

    function addRecentEntry(type, item) {
        if (!item) return;
        const name = item.name || item.title;
        if (!name) return;
        const list = readRecentEntries(type).filter(entry => entry && (entry.name || entry.title) && (entry.name || entry.title) !== name);
        list.unshift({ id: item.id, name });
        writeRecentEntries(type, list);
    }

    function addRecentEntriesFromSelection(type, selectedItems) {
        if (!Array.isArray(selectedItems)) return;
        selectedItems.filter(Boolean).forEach(item => addRecentEntry(type, item));
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.storage = Object.freeze({
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
        getGeminiSuggestions,
        setGeminiSuggestions,
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
        idbGet,
        idbSet,
        idbDelete,
        readPinnedEntries,
        writePinnedEntries,
        readRecentEntries,
        writeRecentEntries,
        addRecentEntry,
        addRecentEntriesFromSelection
    });
}(typeof window !== 'undefined' ? window : globalThis));
