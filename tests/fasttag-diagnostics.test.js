'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'plugins', 'fasttag', 'fasttag-diagnostics.js'), 'utf8');
const values = new Map();
const listeners = new Map();
const silentConsole = { log() {}, warn() {}, error() {} };
const root = {
    FastTag: {},
    localStorage: {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    },
    navigator: { userAgent: 'FastTag Test' },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    setTimeout,
    addEventListener: (type, listener) => listeners.set(type, listener),
    console: silentConsole
};
root.window = root;

vm.runInNewContext(source, root, { filename: 'fasttag-diagnostics.js' });
const diagnostics = root.FastTag.diagnostics;
diagnostics.configure({ getUsageCount: () => 42 });

assert.equal(diagnostics.getDebugMode(), false);
diagnostics.setDebugMode(true);
assert.equal(values.get('fasttag_debug_mode'), 'true');
assert.equal(diagnostics.getDebugMode(), true);

const circular = { label: 'cycle' };
circular.self = circular;
diagnostics.ftLog('ACTION', 'TEST', 'Characterized event', circular);
const exported = diagnostics.exportDebugLogsAsText();
assert.match(exported, /Screen: 1280x720, DPR: 2, UserAgent: FastTag Test/);
assert.match(exported, /Usage Count: 42/);
assert.match(exported, /\[ACTION\] \[TEST\] Characterized event/);
assert.match(exported, /"self": "\[DOM\/Circular\]"/);

diagnostics.attachGlobalErrorListeners();
diagnostics.attachGlobalErrorListeners();
assert.equal(listeners.size, 2, 'global diagnostics listeners should attach only once');
assert.equal(root._fastTagErrorListenersAttached, true);
const beforeError = diagnostics.getLogBufferSize();
listeners.get('error')({ filename: '/plugin/fasttag/fasttag.js', lineno: 10, colno: 2, message: 'boom', error: new Error('boom') });
assert.equal(diagnostics.getLogBufferSize(), beforeError + 1);
listeners.get('error')({ filename: '/other/plugin.js', message: 'ignore' });
assert.equal(diagnostics.getLogBufferSize(), beforeError + 1, 'unrelated global errors should be ignored');

diagnostics.clearDebugLogs();
assert.equal(diagnostics.getLogBufferSize(), 1, 'clearing retains only its own audit entry');
assert.match(diagnostics.exportDebugLogsAsText(), /Debug logs cleared by user/);

console.log('fasttag-diagnostics tests passed');
