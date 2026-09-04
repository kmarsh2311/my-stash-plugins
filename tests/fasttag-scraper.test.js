'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-scraper.js');
const scraper = global.FastTag.scraper;
assert.ok(scraper, 'FastTag scraper namespace should be installed');

const cleanTitleForScraping = value => value.toLowerCase().replace(/\.mp4$/i, '').replace(/[^a-z0-9]+/g, ' ').trim();
const parseDurationSec = value => {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    const parts = String(value).split(':').map(Number);
    return parts.length === 2 ? parts[0] * 60 + parts[1] : Number(value) || 0;
};

scraper.configure({ fetchGQL: async () => ({}), cleanTitleForScraping, parseDurationSec });
assert.deepEqual(
    scraper.buildScrapeCandidateQueries('Same Title', 'same-title.mp4', 'Different Card'),
    ['same title', 'different card'],
    'candidate queries should be cleaned and deduplicated in title, filename, card order'
);

const originalMatches = [{ title: 'Match' }];
assert.strictEqual(scraper.enrichScraperMatches(originalMatches, 'hash', 'StashDB', 120, [{ type: 'phash' }]), originalMatches);
assert.deepEqual(originalMatches[0], {
    title: 'Match',
    _matchType: 'hash',
    _sourceName: 'StashDB',
    _localDuration: 120,
    _localFingerprints: [{ type: 'phash' }]
});
assert.deepEqual(scraper.enrichScraperMatches(null, 'hash', 'StashDB', null, []), []);

const analysis = scraper.analyzeScraperMatch({
    _matchType: 'title',
    _localDuration: 120,
    duration: '2:02',
    _localFingerprints: [
        { type: 'PHash', value: 'ABC' },
        { type: 'oshash', value: 'DEF' }
    ],
    fingerprints: [
        { algorithm: 'phash', hash: 'abc', duration: 119 },
        { algorithm: 'md5', hash: 'def', duration: 140 }
    ]
});
assert.equal(analysis.phashMatch, true);
assert.equal(analysis.oshashMatch, true);
assert.equal(analysis.md5Match, '');
assert.equal(analysis.isHashMatch, true);
assert.deepEqual(analysis.matchBadges, ['PHash is a match', 'MD5 Checksum is a match']);
assert.equal(analysis.localDurSec, 120);
assert.equal(analysis.scrapedDurSec, 122);
assert.equal(analysis.totalFps, 2);
assert.equal(analysis.matchingDurFps, 1);

assert.deepEqual(
    scraper.analyzeScraperMatch({ _matchType: 'hash', _localFingerprints: [], fingerprints: [] }).matchBadges,
    ['Fingerprint is a match']
);

async function testHashMatch() {
    const calls = [];
    scraper.configure({
        cleanTitleForScraping,
        parseDurationSec,
        fetchGQL: async (query, variables) => {
            calls.push({ query, variables });
            if (query.includes('findScene')) {
                return { data: { findScene: { title: 'Scene', files: [{ path: '/media/file.mp4', duration: 90, fingerprints: [{ type: 'phash', value: 'abc' }] }] } } };
            }
            return { data: { scrapeSingleScene: [{ title: 'Hash result' }] } };
        }
    });
    const results = await scraper.fetchScraperMatchesForScene(7, null);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].variables, { source: { stash_box_index: 0 }, input: { scene_id: '7' } });
    assert.equal(results[0]._matchType, 'hash');
    assert.equal(results[0]._localDuration, 90);
    assert.deepEqual(results[0]._localFingerprints, [{ type: 'phash', value: 'abc' }]);
}

async function testTitleThenInstalledScraperFallback() {
    const calls = [];
    scraper.configure({
        cleanTitleForScraping,
        parseDurationSec,
        fetchGQL: async (query, variables) => {
            calls.push({ query, variables });
            if (query.includes('findScene')) {
                return { data: { findScene: { title: 'A Scene', files: [{ path: 'Folder/A_File.mp4' }] } } };
            }
            if (query.includes('listScrapers')) {
                return { data: { listScrapers: [{ id: 'builtin_autotag', name: 'Ignored' }, { id: 'custom', name: 'Custom Scraper' }] } };
            }
            if (variables?.source?.scraper_id === 'custom') {
                return { data: { scrapeSingleScene: [{ title: 'Installed result' }] } };
            }
            return { data: { scrapeSingleScene: [] } };
        }
    });
    const card = { querySelector: () => ({ textContent: 'Card Name' }) };
    const results = await scraper.fetchScraperMatchesForScene('8', card);
    assert.equal(results[0]._matchType, 'scraper');
    assert.equal(results[0]._sourceName, 'Custom Scraper');
    assert.ok(calls.some(call => call.variables?.input?.query === 'a scene'));
    assert.ok(calls.some(call => call.variables?.input?.query === 'a file'));
    assert.ok(calls.some(call => call.variables?.input?.query === 'card name'));
    assert.equal(calls.some(call => call.variables?.source?.scraper_id === 'builtin_autotag'), false);
}

Promise.resolve()
    .then(testHashMatch)
    .then(testTitleThenInstalledScraperFallback)
    .then(() => console.log('fasttag-scraper tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
