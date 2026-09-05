'use strict';

const assert = require('node:assert/strict');

let selectedLinks = [];
let selectedCards = [];
global.document = {
    querySelectorAll(selector) {
        return selector === '.scene-card' ? selectedCards : selectedLinks;
    }
};
global.FastTag = {};
require('../plugins/fasttag/fasttag-integrations.js');

const integrations = global.FastTag.integrations;
assert.ok(integrations, 'FastTag integrations namespace should be installed');

function makeCard() {
    const circles = [{ removed: false, remove() { this.removed = true; } }];
    return {
        removedAttribute: null,
        circles,
        removeAttribute(name) { this.removedAttribute = name; },
        querySelectorAll: () => circles
    };
}

const targetedCard = makeCard();
selectedLinks = [{ closest: () => targetedCard }];
assert.equal(integrations.syncSceneToApolloCache({ id: 42, tags: [] }), false);
assert.equal(targetedCard.removedAttribute, 'data-stash-sc');
assert.equal(targetedCard.circles[0].removed, true);

let modification = null;
global.__APOLLO_CLIENT__ = {
    cache: {
        identify: ({ id }) => `Scene:${id}`,
        modify: value => { modification = value; }
    }
};
const scene = {
    id: 42,
    tags: [{ id: 1, name: 'Tag' }],
    performers: [{ id: 2, name: 'Performer' }],
    studio: { id: 3, name: 'Studio' },
    organized: 1,
    title: 'Title',
    date: '2026-09-04'
};
assert.equal(integrations.syncSceneToApolloCache(scene), true);
assert.equal(modification.id, 'Scene:42');
const toReference = value => ({ __ref: `${value.__typename}:${value.id}` });
assert.deepEqual(modification.fields.tags(null, { toReference }), [{ __ref: 'Tag:1' }]);
assert.deepEqual(modification.fields.performers(null, { toReference }), [{ __ref: 'Performer:2' }]);
assert.deepEqual(modification.fields.studio(null, { toReference }), { __ref: 'Studio:3' });
assert.equal(modification.fields.organized(), true);
assert.equal(modification.fields.title(), 'Title');
assert.equal(modification.fields.date(), '2026-09-04');

const allCard = makeCard();
selectedCards = [allCard];
integrations.resetRefractSceneCards();
assert.equal(allCard.removedAttribute, 'data-stash-sc');
assert.equal(allCard.circles[0].removed, true);

async function testRefreshAndDebounce() {
    let sceneRefetches = 0;
    let unrelatedRefetches = 0;
    const timers = [];
    const originalSetTimeout = global.setTimeout;
    const originalClearTimeout = global.clearTimeout;
    global.setTimeout = (callback, delay) => {
        const timer = { callback, delay, cleared: false };
        timers.push(timer);
        return timer;
    };
    global.clearTimeout = timer => { if (timer) timer.cleared = true; };
    global.__APOLLO_CLIENT__.getObservableQueries = () => new Map([
        ['scenes', { queryName: 'FindScenes', refetch: async () => { sceneRefetches += 1; } }],
        ['other', { queryName: 'FindTags', refetch: async () => { unrelatedRefetches += 1; } }]
    ]);

    try {
        assert.equal(await integrations.refreshSceneCards('42'), true);
        assert.equal(sceneRefetches, 1);
        assert.equal(unrelatedRefetches, 0);
        assert.deepEqual(timers.map(timer => timer.delay), [60, 300]);

        integrations.refreshSceneCardsDebounced('1', 150);
        integrations.refreshSceneCardsDebounced('2', 25);
        assert.equal(timers[2].cleared, true);
        assert.equal(timers[3].delay, 25);
    } finally {
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
    }
}

testRefreshAndDebounce()
    .then(() => console.log('fasttag-integrations tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
