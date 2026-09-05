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
assert.deepEqual(
    scraper.buildOpaqueRecoveryFallbackQueries(['F861554688 BoyNapped Daniel Hausser', 'Rocco Siffredi 1080p']),
    ['BoyNapped Daniel Hausser'],
    'strong recovery-style identifiers should be removed only in an additional fallback query'
);
assert.deepEqual(
    scraper.buildOpaqueRecoveryFallbackQueries(['ABP-123 Real Studio Code', 'Studio 1234567']),
    [],
    'plausible studio codes and shorter numbers should remain untouched'
);
assert.ok(
    scraper.buildLinkedPerformerFallbackQueries(
        [{ name: 'Example Performer' }],
        ['PVC Twink fucked raw']
    ).includes('example performer pvc twink fucked raw'),
    'generic scoring words must remain available to actual scraper fallback searches'
);
const weakMatch = { remote_site_id: 'weak-1', _matchScore: -10, _matchAssessment: 'unlikely' };
const possibleMatch = { remote_site_id: 'possible-1', _matchScore: 25, _matchAssessment: 'possible' };
const strongMatch = { remote_site_id: 'strong-1', _matchScore: 80, _matchAssessment: 'strong' };
assert.equal(scraper.hasDecisiveScraperMatch([weakMatch]), false);
assert.equal(scraper.hasDecisiveScraperMatch([possibleMatch]), false, 'possible results should not prevent stronger fallback searches');
assert.equal(scraper.hasDecisiveScraperMatch([weakMatch, strongMatch]), true);
assert.deepEqual(
    scraper.mergeScraperMatchResults([weakMatch], [strongMatch, weakMatch]),
    [strongMatch, weakMatch],
    'original and fallback results should be combined, deduplicated and ranked'
);
assert.deepEqual(
    scraper.buildStudioPerformerFallbackQueries(
        { name: 'BoyNapped' },
        [{ name: 'Daniel Hausser' }, { name: 'Alex Example' }],
        ['F861554688']
    ),
    ['boynapped daniel hausser alex example', 'boynapped daniel hausser', 'boynapped alex example'],
    'the studio and all linked performers should be tried before individual-performer fallbacks'
);
assert.equal(
    scraper.buildContextualSearchQuery(
        { name: 'BoyCrush' },
        [{ name: 'Benjamin Riley' }, { name: 'Jason Valencia' }]
    ),
    'boycrush benjamin riley jason valencia',
    'the editable search should include the studio and every linked performer'
);
assert.deepEqual(
    scraper.resolvePreferredStashBox([
        { name: 'FansDB', endpoint: 'https://fansdb.cc/graphql' },
        { name: 'StashDB', endpoint: 'https://stashdb.org/graphql' }
    ]),
    { index: 1, name: 'StashDB', endpoint: 'https://stashdb.org/graphql' },
    'the configured StashDB source should be resolved instead of assuming index zero'
);
assert.deepEqual(
    scraper.resolvePreferredStashBox([{ name: 'FansDB', endpoint: 'https://fansdb.cc/graphql' }]),
    { index: 0, name: 'FansDB', endpoint: 'https://fansdb.cc/graphql' },
    'a non-StashDB fallback source should retain its real name and endpoint'
);
assert.equal(
    scraper.getScraperResultUrl({
        _sourceName: 'StashDB',
        _sourceEndpoint: 'https://stashdb.org/graphql',
        remote_site_id: 'stash-scene-uuid',
        urls: ['https://gayeroticvideoindex.com/episode/11609']
    }),
    'https://stashdb.org/scenes/stash-scene-uuid',
    'StashDB remote IDs must take priority over external scene URLs'
);
assert.equal(
    scraper.getScraperResultUrl({
        _sourceName: 'FansDB',
        _sourceEndpoint: 'https://fansdb.cc/graphql',
        remote_site_id: 'fans-id',
        urls: ['https://fansdb.cc/scenes/fans-id']
    }),
    'https://fansdb.cc/scenes/fans-id',
    'other configured sources should retain their own returned URL'
);

const originalMatches = [{ title: 'Match', fingerprints: [{ algorithm: 'phash', hash: 'abc' }] }];
assert.strictEqual(scraper.enrichScraperMatches(originalMatches, 'scene-id', 'StashDB', 120, [{ type: 'phash', value: 'abc' }]), originalMatches);
assert.equal(originalMatches[0]._matchType, 'scene-id');
assert.equal(originalMatches[0]._sourceName, 'StashDB');
assert.equal(originalMatches[0]._localDuration, 120);
assert.deepEqual(originalMatches[0]._localFingerprints, [{ type: 'phash', value: 'abc' }]);
assert.equal(originalMatches[0]._matchAssessment, 'strong');
assert.deepEqual(scraper.enrichScraperMatches(null, 'scene-id', 'StashDB', null, []), []);

const performerRanked = scraper.rankMatchesByLinkedPerformers([
    { title: 'Unrelated', performers: [{ name: 'Someone Else' }] },
    { title: 'Alias match', performers: [{ name: 'Johnny' }] },
    { title: 'ID match', performers: [{ stored_id: '12', name: 'Different Remote Name' }] }
], [
    { id: 12, name: 'John Smith', alias_list: ['Johnny'] },
    { id: 13, name: 'Jane Doe', alias_list: [] }
]);
assert.deepEqual(performerRanked.map(match => match.title), ['ID match', 'Alias match', 'Unrelated']);
assert.deepEqual(performerRanked[0]._performerOverlapNames, ['Different Remote Name']);
assert.deepEqual(performerRanked[1]._weakPerformerOverlapNames, ['John Smith']);
assert.equal(performerRanked[1]._performerOverlapCount, 0, 'single-word aliases must not be reported as confirmed performer matches');
assert.equal(performerRanked[2]._hasLinkedPerformers, true);
assert.equal(performerRanked[2]._performerOverlapCount, 0);
assert.deepEqual(performerRanked[2]._additionalPerformerNames, ['Someone Else']);

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
assert.equal(
    scraper.calculateTitleSimilarity(
        'My Dirtiest Fantasy PVC Twink fucked raw Part 2',
        'Angel gets brutally face-fucked and fucked raw',
        [],
        ['My Dirtiest Fantasy']
    ),
    0,
    'generic descriptors and the known studio must not create title similarity'
);
assert.equal(
    scraper.calculateTitleSimilarity('Example Studio Summer Holiday', 'Summer Holiday', [], ['Example Studio']),
    1,
    'distinctive title words should still produce a strong comparison'
);

const ambiguousAliasEvidence = scraper.rankScraperMatchesByEvidence([{
    title: 'Cabana Boys',
    duration: 1829,
    performers: [{ name: 'Aaron' }, { name: 'Sabian' }],
    _matchType: 'title'
}], {
    linkedPerformers: [
        { id: 1, name: 'Alex Silvers', alias_list: [] },
        { id: 2, name: 'Aaron Aurora', alias_list: ['Aaron'] }
    ],
    localDuration: 1829,
    localTitle: 'F1911707904'
})[0];
assert.equal(ambiguousAliasEvidence._performerOverlapCount, 0);
assert.deepEqual(ambiguousAliasEvidence._weakPerformerOverlapNames, ['Aaron Aurora']);
assert.equal(ambiguousAliasEvidence._matchAssessment, 'possible', 'an ambiguous alias plus duration alone must not produce a likely match');

const disjointPerformerEvidence = scraper.rankScraperMatchesByEvidence([{
    title: 'Angel gets brutally face-fucked',
    duration: 1024,
    studio: { stored_id: '20', name: 'My Dirtiest Fantasy' },
    performers: [{ name: 'Angel Black' }, { name: 'Erik Devil' }],
    _matchType: 'title'
}], {
    linkedPerformers: [
        { id: 1, name: 'Rodion Taxa', alias_list: [] },
        { id: 2, name: 'Peter Polloc', alias_list: [] }
    ],
    localStudio: { id: '20', name: 'My Dirtiest Fantasy' },
    localDuration: 1016,
    localTitle: 'My Dirtiest Fantasy PVC Twink fucked raw Part 2 Rodion Taxa Peter Polloc'
})[0];
assert.equal(disjointPerformerEvidence._performerSetConflict, true);
assert.equal(disjointPerformerEvidence._titleSimilarity, 0);
assert.equal(disjointPerformerEvidence._matchAssessment, 'unlikely', 'a completely different multi-performer cast must outweigh studio and duration matches');
assert.ok(disjointPerformerEvidence._matchReasons.some(reason => reason.includes('returned performers differ')));

const obviouslyWrong = {
    _matchType: 'title',
    _matchAssessment: 'unlikely',
    _hasVerifiedFingerprint: false,
    _comparisonContext: { scene: true, performers: true, studio: true, duration: true },
    _performerOverlapCount: 0,
    _studioComparison: 'mismatch',
    _durationDifference: 510,
    _localDuration: 990,
    _titleSimilarity: 0.05
};
assert.equal(scraper.isObviousFalsePositive(obviouslyWrong), true);
assert.equal(scraper.isObviousFalsePositive({ ...obviouslyWrong, _matchType: 'scene-id' }), false, 'direct scene lookup must never be hidden');
assert.equal(scraper.isObviousFalsePositive({ ...obviouslyWrong, _hasVerifiedFingerprint: true }), false, 'verified fingerprints must never be hidden');
assert.equal(scraper.isObviousFalsePositive({
    ...obviouslyWrong,
    _localFingerprints: [{ type: 'phash', value: 'abc' }],
    fingerprints: [{ algorithm: 'phash', hash: 'abc' }]
}), false, 'fingerprint data must protect a result even without a precomputed flag');
assert.equal(scraper.isObviousFalsePositive({ ...obviouslyWrong, _performerOverlapCount: 1 }), false, 'one linked performer match is enough to keep a result visible');
assert.equal(scraper.isObviousFalsePositive({ ...obviouslyWrong, _comparisonContext: { scene: true, performers: true, studio: false, duration: true } }), false, 'incomplete comparison evidence must not hide a result');
assert.equal(scraper.isObviousFalsePositive({
    ...obviouslyWrong,
    _comparisonContext: { scene: true, performers: true, studio: true, duration: false },
    _durationDifference: null
}), true, 'performer, studio and title conflicts should be enough when duration is unavailable');
assert.equal(scraper.isObviousFalsePositive({ ...obviouslyWrong, _durationDifference: 8 }), false, 'a close duration should keep an otherwise conflicting result visible');
const falsePositivePartition = scraper.partitionObviousFalsePositiveMatches([
    { title: 'Best of weak results', ...obviouslyWrong },
    { title: 'Second weak result', ...obviouslyWrong }
]);
assert.equal(falsePositivePartition.visible.length, 1, 'at least the highest-ranked result must remain visible');
assert.equal(falsePositivePartition.visible[0].title, 'Best of weak results');
assert.equal(falsePositivePartition.hidden.length, 1);

scraper.configure({
    fetchGQL: async () => ({}), cleanTitleForScraping, parseDurationSec,
    getScraperMatchingSettings: () => ({
        hideObviousFalsePositives: true,
        singleWordAliasMode: 'ignore',
        majorCastConflict: true,
        requireStudioMismatch: false,
        closeDurationProtects: false,
        titleSimilarityThreshold: 0.35,
        durationMismatchThreshold: 120,
        durationMismatchPercent: 15
    })
});
const strictAliasResult = scraper.rankMatchesByLinkedPerformers(
    [{ performers: [{ name: 'Aaron' }] }],
    [{ id: 2, name: 'Aaron Aurora', alias_list: ['Aaron'] }]
)[0];
assert.equal(strictAliasResult._weakPerformerOverlapCount, 0, 'Strict alias handling should ignore ambiguous single-word aliases');
assert.deepEqual(strictAliasResult._additionalPerformerNames, ['Aaron']);
assert.equal(scraper.isObviousFalsePositive({
    ...obviouslyWrong,
    _comparisonContext: { scene: true, performers: true, studio: false, duration: true },
    _studioComparison: 'unknown',
    _durationDifference: 8,
    _titleSimilarity: 0.25
}), true, 'Strict filtering should not require studio conflict or duration disagreement');
scraper.configure({ fetchGQL: async () => ({}), cleanTitleForScraping, parseDurationSec });

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
    scraper.analyzeScraperMatch({ _matchType: 'scene-id', _localFingerprints: [], fingerprints: [] }).matchBadges,
    []
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

const stashIdResult = scraper.buildAcceptedSceneStashIds(
    [{ endpoint: 'https://fansdb.cc/graphql', stash_id: 'fans-1' }],
    { _sourceName: 'StashDB', remote_site_id: 'stash-scene-1' },
    [{ name: 'StashDB', endpoint: 'https://stashdb.org/graphql' }]
);
assert.equal(stashIdResult.added, true);
assert.deepEqual(stashIdResult.stashIds, [
    { endpoint: 'https://fansdb.cc/graphql', stash_id: 'fans-1' },
    { endpoint: 'https://stashdb.org/graphql', stash_id: 'stash-scene-1' }
]);
assert.equal(scraper.buildAcceptedSceneStashIds(
    stashIdResult.stashIds,
    { _sourceName: 'StashDB', remote_site_id: 'https://stashdb.org/scenes/stash-scene-1' },
    [{ name: 'StashDB', endpoint: 'https://stashdb.org/graphql/' }]
).added, false, 'the same StashDB ID should not be duplicated');
assert.match(scraper.buildAcceptedSceneStashIds(
    stashIdResult.stashIds,
    { _sourceName: 'StashDB', remote_site_id: 'different-scene' },
    [{ name: 'StashDB', endpoint: 'https://stashdb.org/graphql' }]
).reason, /different ID/);
assert.deepEqual(scraper.buildAcceptedSceneStashIds(
    [],
    { _sourceName: 'FansDB', _sourceEndpoint: 'https://fansdb.cc/graphql', remote_site_id: 'fans-scene-2' },
    [
        { name: 'FansDB', endpoint: 'https://fansdb.cc/graphql' },
        { name: 'StashDB', endpoint: 'https://stashdb.org/graphql' }
    ]
), {
    stashIds: [{ endpoint: 'https://fansdb.cc/graphql', stash_id: 'fans-scene-2' }],
    added: true,
    reason: null
}, 'configured non-StashDB results should retain their own source endpoint');
assert.equal(scraper.buildAcceptedSceneStashIds(
    [],
    { _sourceName: 'Custom Scraper', remote_site_id: 'custom-1' },
    [{ name: 'StashDB', endpoint: 'https://stashdb.org/graphql' }]
).added, false, 'non-StashDB scraper identifiers must not be saved as StashDB IDs');

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
            if (query.includes('FastTagScraperSources')) {
                return { data: { configuration: { general: { stashBoxes: [
                    { name: 'FansDB', endpoint: 'https://fansdb.cc/graphql' },
                    { name: 'StashDB', endpoint: 'https://stashdb.org/graphql' }
                ] } } } };
            }
            if (query.includes('findScene')) {
                return { data: { findScene: { title: 'Scene', performers: [{ id: 4, name: 'Local Person', alias_list: [] }], files: [{ path: '/media/file.mp4', duration: 90, fingerprints: [{ type: 'phash', value: 'abc' }] }] } } };
            }
            return { data: { scrapeSingleScene: [{ title: 'Hash result', performers: [{ stored_id: 4, name: 'Local Person' }] }] } };
        }
    });
    const results = await scraper.fetchScraperMatchesForScene(7, null);
    assert.equal(calls.length, 3);
    const sceneIdScrapeCall = calls.find(call => call.variables?.input?.scene_id === '7');
    assert.deepEqual(sceneIdScrapeCall.variables, { source: { stash_box_index: 1 }, input: { scene_id: '7' } });
    assert.equal(results[0]._matchType, 'scene-id');
    assert.equal(results[0]._sourceName, 'StashDB');
    assert.equal(results[0]._sourceEndpoint, 'https://stashdb.org/graphql');
    assert.equal(results[0]._localDuration, 90);
    assert.deepEqual(results[0]._localFingerprints, [{ type: 'phash', value: 'abc' }]);
    assert.deepEqual(results[0]._performerOverlapNames, ['Local Person']);
    assert.deepEqual(results[0]._comparisonContext, {
        scene: true, performers: true, studio: false, duration: true, fingerprints: true
    });
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

async function testManualSearchSkipsHashLookup() {
    const calls = [];
    scraper.configure({
        cleanTitleForScraping,
        parseDurationSec,
        fetchGQL: async (query, variables) => {
            calls.push({ query, variables });
            if (query.includes('findScene')) {
                return { data: { findScene: { title: 'Wrong Filename', performers: [], files: [{ path: 'wrong.mp4', duration: 90 }] } } };
            }
            return { data: { scrapeSingleScene: [{ title: 'Manual result' }] } };
        }
    });
    const results = await scraper.fetchScraperMatchesForScene('9', null, 'Correct Search Words');
    assert.equal(results[0].title, 'Manual result');
    assert.equal(results[0]._searchQuery, 'correct search words');
    assert.equal(results[0]._matchedSearchQuery, 'correct search words');
    assert.equal(calls.some(call => call.variables?.input?.scene_id), false);
    assert.equal(calls.some(call => call.variables?.input?.query === 'correct search words'), true);
}

async function testLinkedPerformerFallbackRunsAfterFilenameQueries() {
    const calls = [];
    scraper.configure({
        cleanTitleForScraping,
        parseDurationSec,
        fetchGQL: async (query, variables) => {
            calls.push({ query, variables });
            if (query.includes('findScene')) {
                return { data: { findScene: {
                    title: 'f997610384 ftyp',
                    performers: [{ id: '734', name: 'Johannes Lars', alias_list: [] }],
                    files: [{ path: '/media/f997610384 ftyp.mp4' }]
                } } };
            }
            if (query.includes('listScrapers')) return { data: { listScrapers: [] } };
            if (variables?.input?.query === 'johannes lars') {
                return { data: { scrapeSingleScene: [{ title: 'Performer fallback result', performers: [{ stored_id: '734', name: 'Johannes Lars' }] }] } };
            }
            return { data: { scrapeSingleScene: [] } };
        }
    });
    const results = await scraper.fetchScraperMatchesForScene('fallback-scene', null);
    const searchedQueries = calls.map(call => call.variables?.input?.query).filter(Boolean);
    assert.ok(searchedQueries.indexOf('f997610384 ftyp') < searchedQueries.indexOf('johannes lars'));
    assert.equal(results[0].title, 'Performer fallback result');
    assert.equal(results[0]._searchQuery, 'johannes lars');
    assert.equal(results[0]._matchedSearchQuery, 'johannes lars');
    assert.deepEqual(results[0]._performerOverlapNames, ['Johannes Lars']);
}

async function testPossibleMatchContinuesToStudioPerformerFallback() {
    const calls = [];
    scraper.configure({
        cleanTitleForScraping,
        parseDurationSec,
        fetchGQL: async (query, variables) => {
            calls.push({ query, variables });
            if (query.includes('FastTagScraperSources')) {
                return { data: { configuration: { general: { stashBoxes: [
                    { name: 'FansDB', endpoint: 'https://fansdb.cc/graphql' },
                    { name: 'StashDB', endpoint: 'https://stashdb.org/graphql' }
                ] } } } };
            }
            if (query.includes('findScene')) {
                return { data: { findScene: {
                    title: 'F861554688',
                    studio: { id: '20', name: 'BoyNapped' },
                    performers: [{ id: '734', name: 'Daniel Hausser', alias_list: [] }],
                    files: [{ path: '/recovered/F861554688.mp4' }]
                } } };
            }
            if (variables?.input?.scene_id) return { data: { scrapeSingleScene: [] } };
            if (variables?.input?.query === 'f861554688') {
                return { data: { scrapeSingleScene: [{
                    remote_site_id: 'possible-result',
                    title: 'Unrelated title',
                    performers: [{ stored_id: '734', name: 'Daniel Hausser' }]
                }] } };
            }
            if (variables?.input?.query === 'boynapped daniel hausser') {
                return { data: { scrapeSingleScene: [{
                    remote_site_id: 'likely-result',
                    title: 'BoyNapped Daniel Hausser',
                    studio: { stored_id: '20', name: 'BoyNapped' },
                    performers: [{ stored_id: '734', name: 'Daniel Hausser' }]
                }] } };
            }
            return { data: { scrapeSingleScene: [] } };
        }
    });
    const results = await scraper.fetchScraperMatchesForScene('recovered-scene', null);
    assert.equal(results[0].remote_site_id, 'likely-result');
    assert.ok(results.some(match => match.remote_site_id === 'possible-result'), 'earlier possible results should remain available');
    assert.ok(calls.some(call => call.variables?.input?.query === 'boynapped daniel hausser'));
    assert.ok(calls.filter(call => call.variables?.source?.stash_box_index !== undefined)
        .every(call => call.variables.source.stash_box_index === 1));
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
            createExtract: data => data?.createdId
        },
        performers: {
            fetchQuery: 'fetch performers',
            extractList: data => data.performers,
            createQuery: 'create performer',
            createExtract: data => data?.createdId
        },
        tags: {
            fetchQuery: 'fetch tags',
            extractList: data => data.tags,
            createQuery: 'create tag',
            createExtract: data => data?.createdId
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

    scraper.configure({
        cleanTitleForScraping,
        parseDurationSec,
        getEntityConfig: type => configs[type],
        getCachedOrNull: type => cache.get(type) || null,
        setCache: () => {},
        fetchGQL: async query => query === 'create performer' ? { errors: [{ message: 'creation failed' }] } : { data: {} }
    });
    assert.deepEqual(
        await scraper.resolveScrapedEntityIdsResult('performers', [{ name: 'Failed Person' }], [0]),
        { ids: [], failures: ['Failed Person'] }
    );
    assert.deepEqual(
        await scraper.resolveScrapedStudioResult({ name: 'Failed Studio' }, true),
        { id: null, failures: ['Failed Studio'] }
    );
    assert.ok(fetchCalls.some(([query]) => query === 'fetch tags'), 'missing caches should be loaded');
    assert.ok(cacheWrites.some(([type, data]) => type === 'studios' && data === null), 'creation should invalidate the studio cache');
    assert.ok(cacheWrites.some(([type, data]) => type === 'performers' && data === null), 'creation should invalidate the performer cache');
}

Promise.resolve()
    .then(testHashMatch)
    .then(testTitleThenInstalledScraperFallback)
    .then(testManualSearchSkipsHashLookup)
    .then(testLinkedPerformerFallbackRunsAfterFilenameQueries)
    .then(testPossibleMatchContinuesToStudioPerformerFallback)
    .then(testEntityResolution)
    .then(() => console.log('fasttag-scraper tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
