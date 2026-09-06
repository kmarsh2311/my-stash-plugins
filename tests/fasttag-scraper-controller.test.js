'use strict';

const assert = require('node:assert/strict');

global.FastTag = global.FastTag || {};
require('../plugins/fasttag/fasttag-scraper-controller.js');
const controller = global.FastTag.scraperController;

assert.ok(controller, 'FastTag scraper controller namespace should be installed');

let activePopup = null;
controller.configure({ getActivePopup: () => activePopup });

const popup = {
    currentSceneId: 'scene-1',
    element: { isConnected: true }
};
activePopup = popup;

const firstRequest = controller.beginRequest(popup, 'scene-1');
assert.equal(firstRequest, 1);
assert.equal(controller.isRequestCurrent(popup, 'scene-1', firstRequest), true);
assert.equal(controller.isRequestCurrent(popup, 'scene-2', firstRequest), false, 'a response must not cross scene ownership');

const secondRequest = controller.beginRequest(popup, 'scene-1');
assert.equal(secondRequest, 2);
assert.equal(controller.isRequestCurrent(popup, 'scene-1', firstRequest), false, 'newer requests must supersede older responses');
assert.equal(controller.isRequestCurrent(popup, 'scene-1', secondRequest), true);

controller.invalidateRequests(popup);
assert.equal(controller.isRequestCurrent(popup, 'scene-1', secondRequest), false, 'invalidation must reject the active response');
assert.equal(popup._activeScrapeRequest, null);

popup._fastTagClosed = true;
assert.equal(controller.beginRequest(popup, 'scene-1'), null, 'closed popups must not begin scraper work');
popup._fastTagClosed = false;
popup.element.isConnected = false;
assert.equal(controller.beginRequest(popup, 'scene-1'), null, 'detached popups must not begin scraper work');
popup.element.isConnected = true;
activePopup = {};
assert.equal(controller.beginRequest(popup, 'scene-1'), null, 'inactive popups must not begin scraper work');

let removed = false;
const hud = { remove: () => { removed = true; } };
controller.setHudElement(hud);
assert.equal(controller.getHudElement(), hud);
controller.closeHud();
assert.equal(removed, true);
assert.equal(controller.getHudElement(), null);

controller.setHudPosition({ left: '20px', top: '30px' });
controller.setHudSize({ width: '390px', height: '480px' });
controller.resetLayoutState();
assert.equal(controller.getHudPosition(), null);
assert.equal(controller.getHudSize(), null);

async function testAcceptMatchOrdering() {
    const events = [];
    const acceptedStashIds = [{ endpoint: 'https://stashdb.org/graphql', stash_id: 'remote-1' }];
    const context = {
        setSelectedStudio() {},
        setSelectedPerformers() {},
        setSelectedTags() {},
        setInitialStudio() {},
        setInitialPerformers() {},
        setInitialTags() {},
        async renderStudioBar() {},
        refreshAllUI() {}
    };
    const acceptButton = { style: {} };
    const acceptPopup = {
        element: { getAttribute: () => 'everything' },
        _context: context
    };

    controller.configure({
        getActivePopup: () => acceptPopup,
        log() {},
        readScrapeFieldSelection() {
            events.push('selection');
            return { title: true, studio: true, cover: true, performerIndices: [0], tagIndices: [0] };
        },
        async resolveScrapedStudioResult() { events.push('studio'); return { id: 'studio-1', failures: [] }; },
        async resolveScrapedEntityIdsResult(type) {
            events.push(type);
            return { ids: [type === 'performers' ? 'performer-1' : 'tag-1'], failures: [] };
        },
        async fetchGQL(query) {
            if (query.includes('FastTagAcceptCurrentScene')) {
                events.push('current');
                return { data: { findScene: { id: 'scene-1', performers: [], tags: [], stash_ids: [] } } };
            }
            if (query.includes('FastTagStashBoxes')) {
                events.push('configuration');
                return { data: { configuration: { general: { stashBoxes: [] } } } };
            }
            if (query.includes('FastTagAcceptSave')) {
                events.push('metadata');
                return { data: { sceneUpdate: { id: 'scene-1', title: 'Matched title' } } };
            }
            if (query.includes('FastTagAcceptStashId')) {
                events.push('stash-id');
                return { data: { sceneUpdate: { id: 'scene-1', stash_ids: acceptedStashIds } } };
            }
            if (query.includes('FastTagAcceptCover')) {
                events.push('cover');
                return { data: { sceneUpdate: { id: 'scene-1' } } };
            }
            throw new Error('Unexpected GraphQL operation');
        },
        buildAcceptedSceneStashIds() { return { stashIds: acceptedStashIds, added: true, reason: null }; },
        buildScrapeUpdateInput() {
            return { updateInput: { id: 'scene-1' }, mergedPerformerIds: ['performer-1'], mergedTagIds: ['tag-1'] };
        },
        sceneCardUpdateFields: 'id',
        syncSceneToApolloCache() { events.push('apollo'); },
        setLiveEverythingPopupTitle() { events.push('title'); },
        async refreshSceneCards() { events.push('refresh'); },
        recordSaveUsage() { events.push('usage'); },
        deleteSessionCache() { events.push('cache-delete'); },
        toastError(message) { throw new Error(message); },
        toastSuccess() { events.push('success'); }
    });

    await controller.acceptMatch({
        title: 'Matched title',
        image: 'https://example.test/cover.jpg',
        studio: { name: 'Studio' },
        performers: [{ name: 'Performer' }],
        tags: [{ name: 'Tag' }],
        remote_site_id: 'remote-1',
        _sourceName: 'StashDB'
    }, { querySelector: () => acceptButton }, 'scene-1', context, acceptPopup);

    assert.deepEqual(events.slice(0, 4), ['selection', 'studio', 'performers', 'tags']);
    assert.ok(events.indexOf('metadata') < events.indexOf('stash-id'));
    assert.ok(events.indexOf('stash-id') < events.indexOf('cover'));
    assert.ok(events.indexOf('apollo') < events.indexOf('refresh'));
    assert.ok(events.indexOf('refresh') < events.indexOf('cache-delete'));
    assert.equal(acceptButton.disabled, true);
}

testAcceptMatchOrdering()
    .then(() => console.log('fasttag-scraper-controller tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
