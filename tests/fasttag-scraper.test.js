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
assert.equal(originalMatches[0]._matchType, 'hash');
assert.equal(originalMatches[0]._sourceName, 'StashDB');
assert.equal(originalMatches[0]._localDuration, 120);
assert.deepEqual(originalMatches[0]._localFingerprints, [{ type: 'phash' }]);
assert.equal(originalMatches[0]._matchAssessment, 'strong');
assert.deepEqual(scraper.enrichScraperMatches(null, 'hash', 'StashDB', null, []), []);

const performerRanked = scraper.rankMatchesByLinkedPerformers([
    { title: 'Unrelated', performers: [{ name: 'Someone Else' }] },
    { title: 'Alias match', performers: [{ name: 'Johnny' }] },
    { title: 'ID match', performers: [{ stored_id: '12', name: 'Different Remote Name' }] }
], [
    { id: 12, name: 'John Smith', alias_list: ['Johnny'] },
    { id: 13, name: 'Jane Doe', alias_list: [] }
]);
assert.deepEqual(performerRanked.map(match => match.title), ['Alias match', 'ID match', 'Unrelated']);
assert.deepEqual(performerRanked[0]._performerOverlapNames, ['John Smith']);
assert.equal(performerRanked[2]._hasLinkedPerformers, true);
assert.equal(performerRanked[2]._performerOverlapCount, 0);

const evidenceRanked = scraper.rankScraperMatchesByEvidence([
    {
        title: 'Seth, Jeremy & Kaiden',
        duration: 1220,
        studio: { name: 'Different Studio' },
        performers: [{ stored_id: '12', name: 'John Smith' }],
        _matchType: 'title'
    },
    {
        title: 'Correct Production',
        duration: 1540,
        studio: { stored_id: '20', name: 'Local Studio' },
        performers: [{ stored_id: '12', name: 'John Smith' }],
        _matchType: 'title'
    }
], {
    linkedPerformers: [{ id: 12, name: 'John Smith', alias_list: [] }],
    localStudio: { id: 20, name: 'Local Studio' },
    localDuration: 1544,
    localTitle: 'Correct Production John Smith'
});
assert.equal(evidenceRanked[0].title, 'Correct Production');
assert.equal(evidenceRanked[0]._matchAssessment, 'likely');
assert.equal(evidenceRanked[1]._matchAssessment, 'unlikely');
assert.ok(evidenceRanked[1]._matchReasons.includes('Studio differs'));
assert.ok(evidenceRanked[1]._matchReasons.includes('Duration differs substantially'));

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

const checkboxes = new Map([
    ['#fasttag-scrape-chk-studio', { checked: true }],
    ['#fasttag-scrape-chk-title', { checked: false }],
    ['#fasttag-scrape-chk-date', { checked: true }],
    ['#fasttag-scrape-chk-cover', { checked: true }],
    ['#fasttag-scrape-chk-details', { checked: false }]
]);
const selection = scraper.readScrapeFieldSelection({
    querySelector: selector => checkboxes.get(selector) || null,
    querySelectorAll: selector => selector.includes('perf')
        ? [{ getAttribute: () => '2' }, { getAttribute: () => '0' }]
        : [{ getAttribute: () => '1' }]
});
assert.deepEqual(selection, {
    studio: true,
    title: false,
    date: true,
    cover: true,
    details: false,
    performerIndices: [2, 0],
    tagIndices: [1]
});
assert.deepEqual(scraper.mergeUniqueIds([1, '2'], ['2', 3]), ['1', '2', '3']);

const payloadOptions = {
    sceneId: 'scene-9',
    match: { title: 'New title', date: '2026-09-04', details: 'Details', image: 'cover-data' },
    selection: { title: true, date: true, details: true, cover: true },
    studioIdToSet: '10',
    performerIdsToAdd: ['2', '3'],
    tagIdsToAdd: [],
    existingPerformerIds: ['1', '2'],
    existingTagIds: ['8']
};
assert.deepEqual(scraper.buildScrapeUpdateInput(payloadOptions), {
    updateInput: {
        id: 'scene-9',
        studio_id: '10',
        performer_ids: ['1', '2', '3'],
        date: '2026-09-04',
        details: 'Details',
        title: 'New title'
    },
    mergedPerformerIds: ['1', '2', '3'],
    mergedTagIds: ['8']
});
assert.deepEqual(scraper.buildScrapeUpdateInput({
    ...payloadOptions,
    includeCover: true,
    onlyChangedCollections: false
}).updateInput, {
    id: 'scene-9',
    studio_id: '10',
    performer_ids: ['1', '2', '3'],
    tag_ids: ['8'],
    date: '2026-09-04',
    details: 'Details',
    cover_image: 'cover-data',
    title: 'New title'
});

async function testHashMatch() {
    const calls = [];
    scraper.configure({
        cleanTitleForScraping,
        parseDurationSec,
        fetchGQL: async (query, variables) => {
            calls.push({ query, variables });
            if (query.includes('findScene')) {
                return { data: { findScene: { title: 'Scene', performers: [{ id: 4, name: 'Local Person', alias_list: [] }], files: [{ path: '/media/file.mp4', duration: 90, fingerprints: [{ type: 'phash', value: 'abc' }] }] } } };
            }
            return { data: { scrapeSingleScene: [{ title: 'Hash result', performers: [{ stored_id: 4, name: 'Local Person' }] }] } };
        }
    });
    const results = await scraper.fetchScraperMatchesForScene(7, null);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].variables, { source: { stash_box_index: 0 }, input: { scene_id: '7' } });
    assert.equal(results[0]._matchType, 'hash');
    assert.equal(results[0]._localDuration, 90);
    assert.deepEqual(results[0]._localFingerprints, [{ type: 'phash', value: 'abc' }]);
    assert.deepEqual(results[0]._performerOverlapNames, ['Local Person']);
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

async function testEntityResolution() {
    const cache = new Map([
        ['studios', [{ id: 10, name: 'Known Studio' }]],
        ['performers', [{ id: 20, name: 'Known Person' }]]
    ]);
    const cacheWrites = [];
    const configs = {
        studios: {
            fetchQuery: 'fetch studios',
            extractList: data => data.studios,
            createQuery: 'create studio',
            createExtract: data => data.createdId
        },
        performers: {
            fetchQuery: 'fetch performers',
            extractList: data => data.performers,
            createQuery: 'create performer',
            createExtract: data => data.createdId
        },
        tags: {
            fetchQuery: 'fetch tags',
            extractList: data => data.tags,
            createQuery: 'create tag',
            createExtract: data => data.createdId
        }
    };
    const fetchCalls = [];
    scraper.configure({
        cleanTitleForScraping,
        parseDurationSec,
        getEntityConfig: type => configs[type],
        getCachedOrNull: type => cache.get(type) || null,
        setCache: (type, data) => {
            cacheWrites.push([type, data]);
            cache.set(type, data);
        },
        fetchGQL: async (query, variables) => {
            fetchCalls.push([query, variables]);
            if (query === 'fetch tags') return { data: { tags: [{ id: 30, name: 'Known Tag' }] } };
            if (query.startsWith('create')) return { data: { createdId: query.includes('studio') ? 11 : query.includes('performer') ? 21 : 31 } };
            throw new Error(`Unexpected query: ${query}`);
        }
    });

    assert.equal(await scraper.resolveScrapedStudio({ stored_id: 9, name: 'Remote Studio' }, true), '9');
    assert.equal(await scraper.resolveScrapedStudio({ name: ' known studio ' }, true), '10');
    assert.equal(await scraper.resolveScrapedStudio({ name: ' New Studio ' }, true), '11');
    assert.equal(await scraper.resolveScrapedStudio({ name: 'Ignored' }, false), null);

    assert.deepEqual(await scraper.resolveScrapedEntityIds('performers', [
        { stored_id: 19, name: 'Remote Person' },
        { name: ' known person ' },
        { name: 'New Person' },
        { name: '' }
    ], [0, 1, 2, 3, 99]), ['19', '20', '21']);
    assert.deepEqual(await scraper.resolveScrapedEntityIds('tags', [{ name: 'KNOWN TAG' }], [0]), ['30']);
    assert.ok(fetchCalls.some(([query]) => query === 'fetch tags'), 'missing caches should be loaded');
    assert.ok(cacheWrites.some(([type, data]) => type === 'studios' && data === null), 'creation should invalidate the studio cache');
    assert.ok(cacheWrites.some(([type, data]) => type === 'performers' && data === null), 'creation should invalidate the performer cache');
}

Promise.resolve()
    .then(testHashMatch)
    .then(testTitleThenInstalledScraperFallback)
    .then(testEntityResolution)
    .then(() => console.log('fasttag-scraper tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
