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
    getActivePopup: () => null
});

assert.deepEqual(popup.getSavedSize('single'), { width: 640, height: 520 });
assert.deepEqual(defaultSizeCalls, ['single']);
values.set('stash_fast_tag_popup_size', JSON.stringify({ width: 500, height: 450 }));
assert.deepEqual(popup.getSavedSize('single'), { width: 500, height: 450 }, 'legacy single-popup size should remain compatible');
popup.setSavedSize(501.4, 452.7, 'single');
assert.deepEqual(JSON.parse(values.get('stash_fast_tag_popup_size_single')), { width: 501, height: 453 });
popup.setSavedSize(701.6, 602.2, 'everything');
assert.deepEqual(JSON.parse(values.get('stash_fast_tag_popup_size_everything')), { width: 702, height: 602 });

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
popup.positionNearCard(restored.form, null);
assert.equal(restored.form.style.left, '792px');
assert.equal(restored.form.style.top, '8px');

console.log('fasttag-popup tests passed');
