'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'plugins', 'fasttag', 'fasttag-library-manager.js'),
    'utf8'
);
const timers = new Map();
const clearedTimers = [];
let nextTimerId = 1;
const context = {
    console,
    FastTag: {},
    StashLibraryManager: { openFilenameCorrection() {} },
    setTimeout(callback, delay) {
        const id = nextTimerId++;
        timers.set(id, { callback, delay });
        return id;
    },
    clearTimeout(id) {
        clearedTimers.push(id);
        timers.delete(id);
    }
};
context.window = context;
context.globalThis = context;
vm.runInNewContext(source, context);

const integration = context.FastTag.libraryManager;
const refreshedSceneIds = [];
const refreshSceneCards = sceneId => refreshedSceneIds.push(sceneId);

assert.equal(integration.scheduleSceneCardRefreshAfterRename('42', refreshSceneCards), true);
assert.equal(timers.get(1).delay, 2500);
assert.equal(integration.scheduleSceneCardRefreshAfterRename('42', refreshSceneCards), true);
assert.deepEqual(clearedTimers, [1], 'a newer save for the same scene should replace its pending refresh');
assert.equal(timers.has(1), false);
assert.equal(timers.has(2), true);

timers.get(2).callback();
assert.deepEqual(refreshedSceneIds, ['42']);

delete context.StashLibraryManager;
assert.equal(integration.scheduleSceneCardRefreshAfterRename('43', refreshSceneCards), false);
assert.equal(nextTimerId, 3, 'no new timer should be created without Library Manager');

console.log('FastTag Library Manager integration tests passed.');
