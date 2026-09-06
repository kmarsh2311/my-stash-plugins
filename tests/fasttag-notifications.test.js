'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'plugins', 'fasttag', 'fasttag-notifications.js'), 'utf8');

class FakeElement {
    constructor(tagName) {
        this.tagName = tagName;
        this.style = {};
        this.listeners = new Map();
        this.parentNode = null;
        this.innerHTML = '';
    }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    querySelector() { return null; }
    remove() {
        if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
        this.parentNode = null;
    }
}

const body = {
    children: [],
    appendChild(element) {
        element.parentNode = this;
        this.children.push(element);
    }
};
const timers = [];
const logs = [];
const root = {
    FastTag: {},
    document: {
        body,
        createElement: tagName => new FakeElement(tagName),
        getElementById: id => body.children.find(element => element.id === id) || null
    },
    navigator: {},
    setTimeout: (callback, delay) => {
        timers.push({ callback, delay });
        return timers.length;
    },
    clearTimeout() {},
    requestAnimationFrame: callback => callback(),
    console: { log() {}, error() {} }
};
root.window = root;

vm.runInNewContext(source, root, { filename: 'fasttag-notifications.js' });
const notifications = root.FastTag.notifications;
notifications.configure({
    escapeHtml: value => String(value).replaceAll('<', '&lt;'),
    getDebugMode: () => false,
    log: (...args) => logs.push(args)
});

notifications.showToast('<saved>', 'success', 3200);
assert.equal(body.children.length, 1);
assert.equal(body.children[0].id, 'fasttag-native-toast');
assert.match(body.children[0].innerHTML, /&lt;saved>/);
assert.match(body.children[0].style.cssText, /background: #059669/);
assert.equal(logs[0][0], 'ACTION');
assert.equal(timers.at(-1).delay, 3200);

const firstToast = body.children[0];
notifications.showToast('working', 'info', 1500);
assert.equal(firstToast.parentNode, null, 'a new toast should replace the previous toast');
assert.equal(body.children.length, 1);
assert.match(body.children[0].style.cssText, /background: #6366f1/);
assert.equal(logs.at(-1)[0], 'INFO');

notifications.configure({ getDebugMode: () => true });
notifications.showToast('debug', 'error', 1000, { code: 7 });
const debugToast = body.children[0];
assert.match(debugToast.innerHTML, /fasttag-toast-copy-btn/);
assert.match(debugToast.innerHTML, /fasttag-toast-close-btn/);
assert.equal(timers.at(-1).delay, 15000, 'debug mode should retain toasts for at least 15 seconds');
assert.equal(logs.at(-1)[0], 'ERROR');

debugToast.listeners.get('mouseleave')();
assert.equal(timers.at(-1).delay, 5000, 'hover exit should use the capped redisplay duration');

console.log('fasttag-notifications tests passed');
