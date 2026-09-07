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
let resizeObserverDisconnected = false;
let headerObserverDisconnected = false;
const hud = {
    _fastTagResizeObserver: { disconnect: () => { resizeObserverDisconnected = true; } },
    _fastTagScraperHeaderResizeObserver: { disconnect: () => { headerObserverDisconnected = true; } },
    remove: () => { removed = true; }
};
controller.setHudElement(hud);
assert.equal(controller.getHudElement(), hud);
controller.closeHud();
assert.equal(removed, true);
assert.equal(resizeObserverDisconnected, true);
assert.equal(headerObserverDisconnected, true);
assert.equal(controller.getHudElement(), null);

controller.setHudPosition({ left: '20px', top: '30px' });
controller.setHudSize({ width: '390px', height: '480px' });
controller.resetLayoutState();
assert.equal(controller.getHudPosition(), null);
assert.equal(controller.getHudSize(), null);

const loadingPopup = {
    currentSceneId: 'scene-loading',
    element: { isConnected: true },
    scraperCardContainer: { style: { display: 'none' }, innerHTML: 'Previous scene result' },
    scrapeBtn: { disabled: false, innerHTML: '<span>Scrape</span>' }
};
activePopup = loadingPopup;
controller.configure({
    getActivePopup: () => activePopup,
    getEffectiveTheme: () => 'dark'
});
assert.equal(controller.showLoadingState(loadingPopup), true);
assert.equal(loadingPopup.scraperCardContainer.style.display, 'flex');
assert.match(loadingPopup.scraperCardContainer.innerHTML, /Scraping new scene/);
assert.match(loadingPopup.scraperCardContainer.innerHTML, /fasttag-scrape-lens/);
assert.match(loadingPopup.scraperCardContainer.innerHTML, /Checking fingerprints, titles and scene details/);
assert.doesNotMatch(loadingPopup.scraperCardContainer.innerHTML, /@keyframes|animation:/, 'the loading illustration should remain static');
assert.match(loadingPopup.scraperCardContainer.innerHTML, /role="status" aria-live="polite"/);
assert.doesNotMatch(loadingPopup.scraperCardContainer.innerHTML, /Previous scene result/);
assert.equal(loadingPopup.scrapeBtn.disabled, true);

const connectedHudElements = new Set();
global.innerWidth = 1200;
global.innerHeight = 800;
global.document = {
    body: {
        contains: element => connectedHudElements.has(element),
        appendChild: element => { connectedHudElements.add(element); element.isConnected = true; }
    },
    createElement: () => ({
        style: {},
        innerHTML: '',
        offsetWidth: 390,
        offsetHeight: 480,
        remove() { connectedHudElements.delete(this); this.isConnected = false; }
    }),
    querySelector: () => null
};
global.ResizeObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() {}
};
global.localStorage = { getItem: () => null, setItem() {} };
controller.configure({
    getActivePopup: () => activePopup,
    getEffectiveTheme: () => 'dark',
    getDetachScraper: () => true,
    getFloatingVideoHudElement: () => null,
    isVideoPoppedOut: () => false,
    getDefaultEverythingPosition: () => ({ x: 200, y: 100 })
});
loadingPopup.element.getBoundingClientRect = () => ({ left: 300, right: 900, top: 80, bottom: 680, width: 600, height: 600 });
loadingPopup.scraperCardContainer.innerHTML = 'Previous embedded result';
assert.equal(controller.showLoadingState(loadingPopup), true);
const detachedLoadingHud = controller.getHudElement();
assert.ok(detachedLoadingHud && connectedHudElements.has(detachedLoadingHud), 'remembered detached mode should create the HUD before scraping begins');
assert.match(detachedLoadingHud.innerHTML, /Scraping new scene/);
assert.equal(loadingPopup.scraperCardContainer.style.display, 'none', 'detached loading should not flash inside the main popup');
controller.closeHud();

async function testTriggerRejectsLateResults() {
    let resolveFetch;
    const lateResult = new Promise(resolve => { resolveFetch = resolve; });
    const triggerPopup = {
        currentSceneId: 'scene-1',
        element: { isConnected: true },
        scraperCardContainer: { style: { display: 'none' }, innerHTML: '' },
        scrapeBtn: { classList: { remove() {} }, innerHTML: '', disabled: false }
    };
    activePopup = triggerPopup;
    controller.configure({
        getActivePopup: () => activePopup,
        isEasterEggActive: () => false,
        setScraperHudPersistedOpen() {},
        log() {},
        hideScrapeCoverTooltip() {},
        toastError() {},
        fetchScraperMatchesForScene: () => lateResult
    });
    const trigger = controller.createTrigger({
        popup: triggerPopup,
        mode: 'single',
        getSceneId: () => triggerPopup.currentSceneId
    });
    const pending = trigger();
    triggerPopup.currentSceneId = 'scene-2';
    controller.invalidateRequests(triggerPopup);
    resolveFetch([{ title: 'Result for the old scene' }]);
    assert.equal(await pending, null);
    assert.equal(controller.sessionCache.has('scene-1'), false, 'late results must never enter the session cache');
}

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
        toastError(message) { throw new Error(message); },
        toastSuccess() { events.push('success'); }
    });

    controller.sessionCache.set('scene-1', [{ title: 'cached' }]);
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
    assert.equal(controller.sessionCache.has('scene-1'), false, 'accepted scene results should leave the session cache after refresh');
    assert.equal(acceptButton.disabled, true);
}

testTriggerRejectsLateResults()
    .then(() => testAcceptMatchOrdering())
    .then(() => console.log('fasttag-scraper-controller tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
