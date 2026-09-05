'use strict';

const assert = require('node:assert/strict');

const values = new Map();
global.localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
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

values.set('stash_fast_tag_recent_tags', '{invalid json');
assert.deepEqual(storage.readRecentEntries('tags'), []);
values.set('stash_fast_tag_recent_tags', JSON.stringify({ not: 'an array' }));
assert.deepEqual(storage.readRecentEntries('tags'), []);

const manyRecent = Array.from({ length: 30 }, (_, index) => ({ id: index, name: `Tag ${index}` }));
storage.writeRecentEntries('tags', manyRecent);
assert.equal(storage.readRecentEntries('tags').length, 24);
assert.equal(storage.readRecentEntries('tags')[0].name, 'Tag 0');

storage.addRecentEntry('tags', { id: 99, name: 'Tag 5' });
const deduplicated = storage.readRecentEntries('tags');
assert.equal(deduplicated[0].id, 99);
assert.equal(deduplicated.filter(item => item.name === 'Tag 5').length, 1);
assert.equal(deduplicated.length, 24);

storage.addRecentEntry('groups', { id: 'g1', title: 'Example Group' });
assert.deepEqual(storage.readRecentEntries('groups')[0], { id: 'g1', name: 'Example Group' });
assert.deepEqual(storage.readRecentEntries('unknown'), []);

values.set('stash_fast_tag_pinned_tags', '{invalid json');
assert.deepEqual(storage.readPinnedEntries('tags'), []);
storage.writePinnedEntries('tags', [{ id: 1, name: 'Pinned Tag' }]);
assert.deepEqual(storage.readPinnedEntries('tags'), [{ id: 1, name: 'Pinned Tag' }]);
storage.writePinnedEntries('tags', { invalid: true });
assert.deepEqual(storage.readPinnedEntries('tags'), []);

values.delete('fasttag_scrub_speeds');
assert.deepEqual(storage.getScrubSpeeds(), { slow: 5, normal: 10, fast: 20, freeze: 1 });
assert.ok(Object.isFrozen(storage.DEFAULT_SCRUB_SPEEDS));
assert.equal(storage.MAX_SCRUB_CUE_DISPLAYS, 5);

storage.setScrubSpeeds({ slow: -5, normal: 80, fast: 500, freeze: 0 });
assert.deepEqual(storage.getScrubSpeeds(), { slow: 0, normal: 60, fast: 120, freeze: 1 });
values.set('fasttag_scrub_speeds', JSON.stringify({ slow: '12.5', normal: 'bad', fast: 0, freeze: 0.05 }));
assert.deepEqual(storage.getScrubSpeeds(), { slow: 12.5, normal: 10, fast: 0, freeze: 0.1 });
values.set('fasttag_scrub_speeds', '{invalid json');
assert.deepEqual(storage.getScrubSpeeds(), { slow: 5, normal: 10, fast: 20, freeze: 1 });

values.delete('stash_fast_tag_scrub_cue_count_v6');
assert.equal(storage.getScrubCueCount(), 0);
storage.incrementScrubCueCount();
storage.incrementScrubCueCount();
assert.equal(storage.getScrubCueCount(), 2);
storage.resetScrubCueCount();
assert.equal(values.has('stash_fast_tag_scrub_cue_count_v6'), false);

const persistedBooleanPairs = [
    ['isVideoHudPersistedOpen', 'setVideoHudPersistedOpen', 'fasttag_video_hud_open_state', false],
    ['isScraperHudPersistedOpen', 'setScraperHudPersistedOpen', 'fasttag_scraper_hud_open_state', false],
    ['getDetachScraper', 'setDetachScraper', 'fasttag_detach_scraper_v1', true],
    ['getHideObviousFalsePositives', 'setHideObviousFalsePositives', 'fasttag_hide_obvious_false_positives_v1', true]
];

for (const [getter, setter, key, defaultValue] of persistedBooleanPairs) {
    values.delete(key);
    assert.equal(storage[getter](), defaultValue, `${getter} should use its existing default`);
    storage[setter](!defaultValue);
    assert.equal(values.get(key), String(!defaultValue));
    assert.equal(storage[getter](), !defaultValue);
}

values.delete('fasttag_scraper_matching_settings_v1');
const balancedMatching = storage.resetScraperMatchingSettings();
assert.equal(balancedMatching.preset, 'balanced');
assert.deepEqual(balancedMatching, storage.DEFAULT_SCRAPER_MATCHING_SETTINGS);
const strictMatching = storage.setScraperMatchingPreset('strict');
assert.equal(strictMatching.preset, 'strict');
assert.equal(strictMatching.singleWordAliasMode, 'ignore');
assert.equal(strictMatching.requireStudioMismatch, false);
const customMatching = storage.setScraperMatchingSettings({
    preset: 'custom', initialResultLimit: 500, titleSimilarityThreshold: -1, durationMismatchPercent: 150
});
assert.equal(customMatching.preset, 'custom');
assert.equal(customMatching.initialResultLimit, 100, 'custom result limit should be clamped');
assert.equal(customMatching.titleSimilarityThreshold, 0, 'custom title threshold should be clamped');
assert.equal(customMatching.durationMismatchPercent, 100, 'custom duration percentage should be clamped');
assert.equal(storage.resetScraperMatchingSettings().preset, 'balanced');

async function testPersistentCache() {
    assert.equal(await storage.idbGet('tags'), null, 'IndexedDB should fall back cleanly when unavailable');

    const records = new Map();
    const objectStore = {
        get(type) {
            const request = {};
            queueMicrotask(() => {
                request.result = records.get(type);
                request.onsuccess();
            });
            return request;
        },
        put(item) { records.set(item.type, item); },
        delete(type) { records.delete(type); },
        clear() { records.clear(); }
    };
    const database = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => objectStore,
        transaction: () => ({ objectStore: () => objectStore })
    };
    global.indexedDB = {
        open(name, version) {
            assert.equal(name, 'stash_fasttag_cache_db');
            assert.equal(version, 1);
            const request = {};
            queueMicrotask(() => request.onsuccess({ target: { result: database } }));
            return request;
        }
    };

    await storage.idbSet('tags', [{ id: '1' }], 1234);
    assert.deepEqual(await storage.idbGet('tags'), { type: 'tags', data: [{ id: '1' }], timestamp: 1234 });
    await storage.idbDelete('tags');
    assert.equal(await storage.idbGet('tags'), null);
    await storage.idbSet('tags', [], 1);
    await storage.idbSet('performers', [], 2);
    await storage.idbDelete(null);
    assert.equal(records.size, 0);
}

testPersistentCache()
    .then(() => console.log('fasttag-storage tests passed'))
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
