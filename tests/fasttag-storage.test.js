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

console.log('fasttag-storage tests passed');
