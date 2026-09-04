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
        autoMarkOrganized: 'stash_fast_tag_auto_mark_organized'
    });

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
        setAutoMarkOrganized
    });
}(typeof window !== 'undefined' ? window : globalThis));
