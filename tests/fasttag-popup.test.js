'use strict';

const assert = require('node:assert/strict');

const values = new Map();
global.localStorage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
};
global.innerWidth = 1200;
global.innerHeight = 800;
global.requestAnimationFrame = callback => callback();
let appendedForm = null;
global.document = {
    body: {
        appendChild: form => { appendedForm = form; },
        classList: { remove() {} }
    },
    querySelectorAll: () => [],
    createElement(tagName) {
        return {
            tagName: tagName.toUpperCase(),
            style: {},
            attributes: {},
            setAttribute(name, value) { this.attributes[name] = String(value); },
            querySelector(selector) { return { selector }; }
        };
    }
};
global.FastTag = global.FastTag || {};

require('../plugins/fasttag/fasttag-popup.js');
const popup = global.FastTag.popup;
assert.ok(popup, 'FastTag popup namespace should be installed');

const sequentialState = { enabled: false, popupPosition: { left: 0, top: 0 } };
let defaultSizeCalls = [];
popup.configure({
    getOptimalPopupSize(type) {
        defaultSizeCalls.push(type);
        return { width: 640, height: 520 };
    },
    getDefaultEverythingPosition: () => ({ x: 240, y: 120 }),
    getSequentialEditState: () => sequentialState,
    getActivePopup: () => null,
    entityConfig: { tags: { pluralTitle: 'Tags' } },
    getEffectiveTheme: () => 'dark'
});

assert.deepEqual(popup.getSavedSize('single'), { width: 640, height: 520 });
assert.deepEqual(defaultSizeCalls, ['single']);
values.set('stash_fast_tag_popup_size', JSON.stringify({ width: 500, height: 450 }));
assert.deepEqual(popup.getSavedSize('single'), { width: 500, height: 450 }, 'legacy single-popup size should remain compatible');
popup.setSavedSize(501.4, 452.7, 'single');
assert.deepEqual(JSON.parse(values.get('stash_fast_tag_popup_size_single')), { width: 501, height: 453 });
popup.setSavedSize(701.6, 602.2, 'everything');
assert.deepEqual(JSON.parse(values.get('stash_fast_tag_popup_size_everything')), { width: 702, height: 602 });

const shell = popup.createShell('tags');
assert.equal(shell.element, appendedForm, 'the shell should be appended before it is returned');
assert.equal(shell.element.id, 'scenes-popup');
assert.equal(shell.element.attributes['data-popup-type'], 'single');
assert.equal(shell.element.className, 'theme-dark');
assert.equal(shell.element.style.width, '501px');
assert.match(shell.element.innerHTML, /class="popup-resize-handle"/);
assert.equal(shell.searchInput.selector, '#tags-search-input');
assert.equal(shell.cancelBtn.selector, '#tags-cancel-btn');

function createForm(type, width = 500, height = 400) {
    const visibleClasses = [];
    let focusCount = 0;
    const input = { focus: () => { focusCount += 1; } };
    const form = {
        style: { width: `${width}px`, height: `${height}px` },
        offsetWidth: width,
        offsetHeight: height,
        getAttribute: name => name === 'data-popup-type' ? type : null,
        getBoundingClientRect() {
            const left = parseInt(this.style.left, 10) || 0;
            const top = parseInt(this.style.top, 10) || 0;
            return { left, top, right: left + width, bottom: top + height, width, height };
        },
        classList: { add: name => visibleClasses.push(name) },
        querySelector: () => input
    };
    return { form, visibleClasses, getFocusCount: () => focusCount };
}

values.delete('fasttag_everything_pos');
const everything = createForm('everything', 600, 500);
sequentialState.enabled = true;
popup.positionNearCard(everything.form, null);
assert.equal(everything.form.style.left, '240px');
assert.equal(everything.form.style.top, '120px');
assert.deepEqual(sequentialState.popupPosition, { left: 240, top: 120 });
assert.deepEqual(everything.visibleClasses, ['popup-visible']);
assert.equal(everything.getFocusCount(), 1);

sequentialState.enabled = false;
sequentialState.popupPosition = { left: 0, top: 0 };
values.delete('fasttag_single_pos');
const single = createForm('single', 400, 300);
popup.positionNearCard(single.form, { getBoundingClientRect: () => ({ right: 1150, left: 900, top: 700 }) });
assert.equal(single.form.style.left, '490px', 'an overflowing card anchor should place the popup to the card’s left');
assert.equal(single.form.style.top, '492px', 'card anchoring should clamp to the lower viewport edge');
assert.deepEqual(single.visibleClasses, ['popup-visible']);

values.set('fasttag_single_pos', JSON.stringify({ left: '5000px', top: '-20px' }));
const restored = createForm('single', 400, 300);
popup.positionNearCard(restored.form, { getBoundingClientRect: () => ({ right: 310, left: 60, top: 140 }) });
assert.equal(restored.form.style.left, '320px', 'a fresh single editor should ignore a legacy saved position and anchor beside its card');
assert.equal(restored.form.style.top, '140px');
assert.equal(values.has('fasttag_single_pos'), false, 'obsolete saved single-editor positions should be removed');

sequentialState.enabled = true;
sequentialState.popupPosition = { left: 360, top: 180 };
const sequentialSingle = createForm('single', 400, 300);
popup.positionNearCard(sequentialSingle.form, { getBoundingClientRect: () => ({ right: 110, left: 20, top: 20 }) });
assert.equal(sequentialSingle.form.style.left, '360px', 'sequential navigation should retain a user-moved popup position');
assert.equal(sequentialSingle.form.style.top, '180px');
sequentialState.enabled = false;
sequentialState.popupPosition = { left: 0, top: 0 };

const closeEvents = [];
const makeTable = name => ({
    off: event => closeEvents.push(`${name}:off:${event}`),
    destroy: () => closeEvents.push(`${name}:destroy`)
});
let activePopup = {
    tagsTable: makeTable('tags'),
    performersTable: makeTable('performers'),
    element: {
        classList: { remove: name => closeEvents.push(`popup:class:${name}`) },
        remove: () => closeEvents.push('popup:remove')
    }
};
let activeTable = makeTable('active');
let allowClose = false;
const sessionCache = new Map([['scene-1', []]]);
popup.configure({
    coverEditor: { closeActiveEditor: () => allowClose },
    getActivePopup: () => activePopup,
    setActivePopup: value => { activePopup = value; },
    getActiveTableInstance: () => activeTable,
    setActiveTableInstance: value => { activeTable = value; },
    invalidateScraperRequests: () => closeEvents.push('scraper:invalidate'),
    abortCurrentPreview: () => closeEvents.push('preview:abort'),
    closeFloatingVideoHud: reset => closeEvents.push(`video:close:${reset}`),
    closeFloatingScraperHud: reset => closeEvents.push(`scraper:close:${reset}`),
    hidePerformerHoverCard: () => closeEvents.push('performer:hide'),
    hideScrapeCoverTooltip: () => closeEvents.push('cover-tooltip:hide'),
    hideMicroTooltip: () => closeEvents.push('micro-tooltip:hide'),
    resetPreviewSessionCue: () => closeEvents.push('preview:cue-reset'),
    resetSequentialEditState: () => closeEvents.push('sequential:reset'),
    sessionScrapeCache: sessionCache,
    refreshSceneCardsDebounced: () => closeEvents.push('cards:refresh')
});

assert.equal(popup.closeActive(), false, 'unsaved Cover Editor work must be able to veto closure');
assert.deepEqual(closeEvents, []);

allowClose = true;
const popupSignal = popup.beginSession();
let sessionAborted = false;
popupSignal.addEventListener('abort', () => { sessionAborted = true; });
assert.equal(popup.closeActive(false), true);
assert.equal(sessionAborted, true, 'closing must abort all shared popup listeners');
assert.equal(activePopup, null);
assert.equal(activeTable, null);
assert.ok(closeEvents.indexOf('scraper:invalidate') < closeEvents.indexOf('popup:remove'));
assert.ok(closeEvents.includes('video:close:false'));
assert.ok(closeEvents.includes('scraper:close:false'));
assert.equal(closeEvents.includes('cards:refresh'), false, 'closing a popup must not rebuild every scene card');
assert.equal(closeEvents.includes('sequential:reset'), false, 'navigation state must survive a non-reset close');
assert.equal(sessionCache.has('scene-1'), true, 'session results must survive a non-reset close');

popup.beginSession();
popup.closeActive(true);
assert.ok(closeEvents.includes('sequential:reset'));
assert.equal(sessionCache.size, 0);

console.log('fasttag-popup tests passed');
