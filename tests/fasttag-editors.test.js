'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-editors.js');
const editors = global.FastTag.editors;
assert.ok(editors, 'FastTag editors namespace should be installed');

assert.deepEqual(Array.from(editors.normalizeIdSet([1, '2', 1])), ['1', '2']);
assert.equal(editors.hasSelectionSetChanged([1, 2], new Set(['2', '1'])), false);
assert.equal(editors.hasSelectionSetChanged([1, 3], new Set(['1', '2'])), true);
assert.equal(editors.hasSelectionSetChanged([], new Set()), false);
assert.equal(editors.hasSelectionSetChanged(null, ['1']), true);

const delta = editors.calculateBulkSelectionDelta(new Set(['1', '2']), new Set(['2', '3']));
assert.deepEqual(Array.from(delta.removedIds), ['1']);
assert.deepEqual(delta.addedIds, ['3']);
assert.deepEqual(editors.applyBulkSelectionDelta(['1', '2', '4'], delta.removedIds, delta.addedIds), ['2', '4', '3']);
assert.deepEqual(editors.applyBulkSelectionDelta([1, 1, 2], [], [2, 3]), ['1', '2', '3']);

assert.throws(
    () => editors.createSingleEditorSaveWorkflow(),
    /requires a commit function/,
    'single-editor workflows should require an explicit mutation boundary'
);

const pendingCommits = [];
const replacedBaselines = [];
const latestSuccesses = [];
const singleWorkflow = editors.createSingleEditorSaveWorkflow({
    commit: (sceneId, ids) => new Promise(resolve => pendingCommits.push({ sceneId, ids, resolve })),
    replaceBaseline: ids => replacedBaselines.push(Array.from(ids)),
    onLatestSuccess: result => latestSuccesses.push({
        sceneId: result.sceneId,
        ids: Array.from(result.selectedIds),
        context: result.context
    })
});

const firstSave = singleWorkflow.save('scene-1', new Set([1]), { showToast: false });
const secondSelection = new Set([1, 2]);
const secondSave = singleWorkflow.save('scene-1', secondSelection, { showToast: true });
secondSelection.add(3);
assert.deepEqual(pendingCommits.map(entry => entry.ids), [['1'], ['1', '2']], 'each save should snapshot normalized IDs at its boundary');

pendingCommits[0].resolve(true);
pendingCommits[1].resolve(true);

Promise.all([firstSave, secondSave]).then(results => {
    assert.deepEqual(results, [true, true]);
    assert.deepEqual(replacedBaselines, [['1', '2']], 'only the newest successful save should replace the clean baseline');
    assert.deepEqual(latestSuccesses, [{ sceneId: 'scene-1', ids: ['1', '2'], context: { showToast: true } }]);
    console.log('fasttag-editors tests passed');
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
