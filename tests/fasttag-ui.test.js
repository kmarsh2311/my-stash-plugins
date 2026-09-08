'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-preview.js');
require('../plugins/fasttag/fasttag-ui.js');
const ui = global.FastTag.ui;
const preview = global.FastTag.preview;
const logs = [];
ui.configure({ getDefaultPopoutSize: preview.getDefaultPopoutSize, log: (...args) => logs.push(args) });

global.innerWidth = 1920;
global.innerHeight = 1080;
assert.deepEqual(ui.getOptimalPopupSize('everything'), { width: 760, height: 760 });
assert.deepEqual(ui.getOptimalPopupSize('single'), { width: 345, height: 660 });
assert.deepEqual(ui.getDefaultEverythingPosition(760, 760), { x: 685, y: 160 });

global.innerWidth = 1400;
global.innerHeight = 900;
assert.deepEqual(ui.getDefaultEverythingPosition(760, 760), { x: 548, y: 70 });

global.innerWidth = 800;
global.innerHeight = 600;
assert.deepEqual(ui.getOptimalPopupSize('everything'), { width: 720, height: 620 });
assert.deepEqual(ui.getOptimalPopupSize('single'), { width: 320, height: 540 });
assert.deepEqual(ui.getDefaultEverythingPosition(720, 620), { x: 40, y: 8 });
assert.equal(logs.length, 3);
assert.equal(logs[0][0], 'DEBUG');
assert.equal(logs[0][1], 'LAYOUT');

const rootListeners = new Map();
global.addEventListener = (type, handler) => {
    if (!rootListeners.has(type)) rootListeners.set(type, new Set());
    rootListeners.get(type).add(handler);
};
global.removeEventListener = (type, handler) => rootListeners.get(type)?.delete(handler);

class FakeElement {
    constructor() {
        this.style = {};
        this.children = [];
        this.listeners = new Map();
        this.isConnected = true;
        this.parentNode = null;
        this.parentElement = null;
        this.className = '';
    }

    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }

    dispatch(type, event) {
        event.type = type;
        for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
    }

    appendChild(child) {
        child.parentNode = this;
        child.parentElement = this;
        this.children.push(child);
        return child;
    }

    insertBefore(child) {
        return this.appendChild(child);
    }

    remove() {
        this.isConnected = false;
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    }

    querySelector(selector) {
        if (selector === '.fasttag-momentary-peek') {
            return this.children.find(child => child.className === 'fasttag-momentary-peek') || null;
        }
        return null;
    }

    setAttribute(name, value) {
        this[name] = value;
    }
}

const body = new FakeElement();
const documentElement = new FakeElement();
const scrollTarget = new FakeElement();
scrollTarget.scrollTop = 0;
scrollTarget.scrollLeft = 0;
scrollTarget.scrollHeight = 1000;
scrollTarget.clientHeight = 400;
scrollTarget.scrollWidth = 400;
scrollTarget.clientWidth = 400;
global.document = {
    body,
    documentElement,
    scrollingElement: scrollTarget,
    createElement: () => new FakeElement(),
    elementsFromPoint: () => [scrollTarget]
};
global.getComputedStyle = () => ({ overflowY: 'auto', overflowX: 'hidden' });

function makeEvent(properties = {}) {
    return {
        type: properties.type || '',
        button: properties.button ?? 0,
        buttons: properties.buttons ?? 0,
        pointerId: properties.pointerId ?? 7,
        clientX: properties.clientX ?? 10,
        clientY: properties.clientY ?? 10,
        deltaX: properties.deltaX ?? 0,
        deltaY: properties.deltaY ?? 0,
        deltaMode: properties.deltaMode ?? 0,
        prevented: false,
        stopped: false,
        preventDefault() { this.prevented = true; },
        stopPropagation() { this.stopped = true; },
        stopImmediatePropagation() { this.stopped = true; }
    };
}

function dispatchRoot(type, event) {
    event.type = type;
    for (const handler of [...(rootListeners.get(type) || [])]) handler(event);
}

const panelOne = new FakeElement();
const panelTwo = new FakeElement();
const buttonOne = ui.mountMomentaryPeekButton(panelOne, new FakeElement());
ui.mountMomentaryPeekButton(panelTwo, new FakeElement());
const originalDateNow = Date.now;
let fakeNow = 1000;
Date.now = () => fakeNow;
buttonOne.dispatch('pointerdown', makeEvent({ button: 0, buttons: 1, pointerId: 7 }));
assert.equal(panelOne.style.opacity, '0.15');
assert.equal(panelTwo.style.opacity, '0.15');
assert.equal(panelOne.style.pointerEvents, 'none');
assert.equal(body.children.length, 1, 'peek should install one full-page input shield');

dispatchRoot('pointermove', makeEvent({ button: 2, buttons: 3, pointerId: 7 }));
dispatchRoot('pointerup', makeEvent({ button: 2, buttons: 1, pointerId: 7 }));
assert.equal(panelOne.style.opacity, '0.15', 'releasing a secondary button must not end peek');
const contextMenuEvent = makeEvent({ button: 2 });
dispatchRoot('contextmenu', contextMenuEvent);
assert.equal(contextMenuEvent.prevented, true, 'right-click must remain blocked during peek');
const clickEvent = makeEvent({ button: 0 });
dispatchRoot('click', clickEvent);
assert.equal(clickEvent.prevented, true, 'ordinary clicks must not reach the page during peek');

const wheelEvent = makeEvent({ deltaY: 35 });
dispatchRoot('wheel', wheelEvent);
assert.equal(scrollTarget.scrollTop, 35, 'peek should forward wheel movement to the Stash scroller');
assert.equal(wheelEvent.prevented, true);

dispatchRoot('pointerup', makeEvent({ button: 0, buttons: 0, pointerId: 7 }));
assert.equal(panelOne.style.opacity, undefined);
assert.equal(panelTwo.style.opacity, undefined);
assert.equal(panelOne.style.pointerEvents, undefined);
assert.equal(body.children.length, 0, 'primary release should remove the input shield');
const delayedContextMenuEvent = makeEvent({ button: 2 });
dispatchRoot('contextmenu', delayedContextMenuEvent);
assert.equal(delayedContextMenuEvent.prevented, true, 'a delayed context menu should be blocked just after release');
fakeNow += 501;
const laterContextMenuEvent = makeEvent({ button: 2 });
dispatchRoot('contextmenu', laterContextMenuEvent);
assert.equal(laterContextMenuEvent.prevented, false, 'ordinary context menus should resume after the release grace period');

buttonOne.dispatch('pointerdown', makeEvent({ button: 0, buttons: 1, pointerId: 9 }));
assert.equal(body.children.length, 1);
body.children[0].dispatch('mouseleave', makeEvent());
assert.equal(panelOne.style.opacity, undefined, 'leaving the webpage should restore every panel');
assert.equal(body.children.length, 0);
Date.now = originalDateNow;

console.log('fasttag-ui tests passed');
