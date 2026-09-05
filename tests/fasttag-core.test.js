'use strict';

const assert = require('node:assert/strict');

delete global.FastTag;
require('../plugins/fasttag/fasttag-core.js');

const core = global.FastTag?.core;
assert.ok(core, 'FastTag core namespace should be installed');

assert.equal(core.escapeHtml('<b title="x&y">'), '&lt;b title=&quot;x&amp;y&quot;&gt;');
assert.equal(core.escapeHtml(0), '');

assert.equal(core.formatTime(-1), '0:00');
assert.equal(core.formatTime(65.9), '1:05');
assert.equal(core.formatTime(3661), '1:01:01');

assert.equal(core.formatDurationSec(65.4), '1:05');
assert.equal(core.formatDurationSec(3661), '1:01:01');
assert.equal(core.parseDurationSec('1:01:01'), 3661);
assert.equal(core.parseDurationSec('01:05'), 65);
assert.equal(core.parseDurationSec('65.6'), 66);

assert.equal(core.cleanFilenameForSuggestions('MyScene_1080p.mp4'), 'MyScene_');
assert.equal(core.cleanFilenameForSuggestions('MyScene 1080p.mp4'), 'MyScene ');
assert.equal(core.cleanFilenameForSuggestions('MyScene_1080p_x264.mkv'), 'MyScene__');
assert.equal(core.normalizeTextForSuggestions('CaféScene4K'), 'cafe scene 4 k');
assert.equal(core.normalizeTextForSuggestions('CafeScene4K'), 'cafe scene 4 k');
assert.equal(core.cleanTitleForScraping('Example.Scene_1080p.mp4'), 'Example Scene');
assert.equal(core.cleanTitleForScraping('Botp0047 Alexsilver Reecebentley Deaconhunter 1080p'), 'Botp0047 Alexsilver Reecebentley Deaconhunter');
assert.equal(core.cleanTitleForScraping('Example-2160p-x265.mkv'), 'Example');
assert.equal(core.cleanTitleForScraping('720p Example Scene WEBRIP'), 'Example Scene');

function matches(item, text) {
    const normalized = core.normalizeTextForSuggestions(text);
    const tokens = normalized.split(/\s+/).filter(Boolean);
    return core.isSuggestionMatch(item, ` ${normalized} `, new Set(tokens), tokens);
}

assert.equal(matches({ name: 'Onlyfans' }, 'Only Fans'), true);
assert.equal(matches({ name: 'Deep Throat' }, 'Deepthroat'), true);
assert.equal(matches({ name: 'Tattoo' }, 'Tattoos'), true);
assert.equal(matches({ name: 'Piercings' }, 'Piercing'), true);
assert.equal(matches({ name: 'Robert', alias_list: ['Bobby'] }, 'Bobby arrives'), false);
assert.equal(matches({ name: 'Angel of Bogota', alias_list: ['Angel'] }, 'Angel arrives'), false);
assert.equal(matches({ name: 'Clayton', alias_list: ['Danny'] }, 'Danny Boy Fucks'), false);
assert.equal(matches({ name: 'Benny Fox' }, 'Papi Kocic and Reece Beresford fuck Benny Fox'), true);
assert.equal(matches({ name: 'Cher' }, 'Cher performs live'), true);
assert.equal(matches({ name: 'Clayton', alias_list: ['Danny Clayton'] }, 'Danny Clayton performs'), true);
assert.equal(matches({ name: 'Café Scene' }, 'CafeScene'), true);
// Existing behaviour: primary tag names can exact-match even when listed as stop words.
assert.equal(matches({ name: 'Man' }, 'A man arrives'), true);

const rankedSuggestions = core.rankSuggestionItems([
    { id: '2', name: 'Fox' },
    { id: '1', name: 'Benny Fox' },
    { id: '3', name: 'Outdoor Scene' },
    { id: '4', name: 'Benny', alias_list: ['Benny Fox'] }
], 'Papi Kocic and Benny Fox', 'An outdoor description mentions Scene much later.', new Set(), 20);
assert.deepEqual(rankedSuggestions.map(item => item.id), ['1', '4', '2']);

const limitedSuggestions = core.rankSuggestionItems([
    { id: '1', name: 'Fox' },
    { id: '2', name: 'Benny Fox' }
], 'Benny Fox', '', new Set(), 1);
assert.deepEqual(limitedSuggestions.map(item => item.id), ['2'], 'exact primary names should win before the result limit');

assert.deepEqual(
    core.rankSuggestionItems([{ id: '1', name: 'Outdoor Scene' }], '', 'Outdoor words occur in a different scene.', null, 20),
    [],
    'details-only multiword matches should require the complete phrase'
);
assert.deepEqual(
    core.rankSuggestionItems([{ id: '1', name: 'Outdoor Scene' }], '', 'This is an Outdoor Scene.', null, 20).map(item => item.id),
    ['1']
);

const selectedPerformers = [
    { id: '1', name: 'Skyler Dallon' },
    { id: '2', name: 'Dominic Couture' },
    { id: '3', name: 'Skyler Blue' }
];
assert.equal(core.findUniqueSelectedPerformerComponentMatch(selectedPerformers, new Set(['1', '2']), 'Skyler')?.id, '1');
assert.equal(core.findUniqueSelectedPerformerComponentMatch(selectedPerformers, new Set(['1', '3']), 'Skyler'), null);
assert.equal(core.findUniqueSelectedPerformerComponentMatch(selectedPerformers, new Set(['1']), 'Sky'), null);
assert.equal(core.findUniqueSelectedPerformerComponentMatch(selectedPerformers, new Set(['1']), 'Skyler Dallon'), null);

const sceneLink = { href: 'http://localhost:9999/scenes/abc-123?continue=true' };
const sceneCard = {
    querySelector: () => sceneLink,
    contains: (candidate) => candidate === mediaArea
};
const mediaArea = { name: 'preview' };
const infoTarget = {
    nodeType: 1,
    closest: (selector) => selector.includes('.scene-card,') ? sceneCard : null
};
const mediaTarget = {
    nodeType: 1,
    closest: (selector) => selector.includes('.thumbnail-section') ? mediaArea : sceneCard
};

assert.equal(core.extractSceneId(sceneCard), 'abc-123');
assert.equal(core.findSceneCardForContextTarget(infoTarget), sceneCard);
assert.equal(core.isScenePreviewContextTarget(infoTarget, sceneCard), false);
assert.equal(core.isScenePreviewContextTarget(mediaTarget, sceneCard), true);

console.log('fasttag-core tests passed');
