'use strict';

const assert = require('node:assert/strict');

const values = new Map();
global.localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value))
};
global.FastTag = {};
require('../plugins/fasttag/fasttag-storage.js');

const storage = global.FastTag.storage;
assert.ok(storage, 'FastTag storage namespace should be installed');

assert.equal(storage.getThemePreference(), 'dark');
storage.setThemePreference('light');
assert.equal(values.get('stash_fast_tag_theme'), 'light');

const defaultTruePairs = [
    ['getAutoScrapeSequential', 'setAutoScrapeSequential', 'stash_fast_tag_auto_scrape_sequential'],
    ['getShowIdColumns', 'setShowIdColumns', 'stash_fast_tag_show_ids'],
    ['getEnableSuggestions', 'setEnableSuggestions', 'stash_fast_tag_enable_suggestions'],
    ['getEnableCardIconClicks', 'setEnableCardIconClicks', 'fasttag_enable_card_icon_clicks'],
    ['getShowRecentChips', 'setShowRecentChips', 'fasttag_show_recent_chips'],
    ['getShowPinnedChips', 'setShowPinnedChips', 'fasttag_show_pinned_chips'],
    ['getGeminiAutoParse', 'setGeminiAutoParse', 'fasttag_gemini_auto_parse'],
    ['getGeminiSuggestions', 'setGeminiSuggestions', 'fasttag_gemini_suggestions']
];

for (const [getter, setter, key] of defaultTruePairs) {
    values.delete(key);
    assert.equal(storage[getter](), true, `${getter} should default to true`);
    storage[setter](false);
    assert.equal(values.get(key), 'false');
    assert.equal(storage[getter](), false);
}

values.delete('fasttag_always_play_full_video');
assert.equal(storage.getAlwaysPlayFullVideo(), false);
storage.setAlwaysPlayFullVideo(true);
assert.equal(values.get('fasttag_always_play_full_video'), 'true');

values.delete('stash_fast_tag_auto_mark_organized');
assert.equal(storage.getAutoMarkOrganized(), false);
storage.setAutoMarkOrganized(true);
assert.equal(values.get('stash_fast_tag_auto_mark_organized'), 'true');

assert.equal(storage.getGeminiApiKey(), '');
storage.setGeminiApiKey('  secret-key  ');
assert.equal(values.get('fasttag_gemini_api_key'), 'secret-key');
assert.equal(storage.getGeminiModel(), 'gemini-flash-latest');
storage.setGeminiModel('gemini-custom');
assert.equal(values.get('fasttag_gemini_model'), 'gemini-custom');

console.log('fasttag-storage tests passed');
