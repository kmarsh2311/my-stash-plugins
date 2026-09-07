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

Promise.all([firstSave, secondSave]).then(async results => {
    assert.deepEqual(results, [true, true]);
    assert.deepEqual(replacedBaselines, [['1', '2']], 'only the newest successful save should replace the clean baseline');
    assert.deepEqual(latestSuccesses, [{ sceneId: 'scene-1', ids: ['1', '2'], context: { showToast: true } }]);

    await assert.rejects(
        () => editors.runBatchedSceneUpdates([], null),
        /requires an update function/,
        'bulk workflows should require an explicit scene-update boundary'
    );

    const started = [];
    const releases = [];
    const progress = [];
    const bulkRun = editors.runBatchedSceneUpdates(
        [{ id: '1' }, { id: '2' }, { id: '3' }],
        scene => new Promise(resolve => {
            started.push(scene.id);
            releases.push(() => resolve(scene.id !== '2'));
        }),
        {
            concurrency: 2,
            onProgress: state => progress.push({ ...state })
        }
    );

    await Promise.resolve();
    assert.deepEqual(started, ['1', '2'], 'bulk workflow should not start a later batch before the active batch completes');
    releases[0]();
    releases[1]();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(started, ['1', '2', '3'], 'bulk workflow should start the next batch after the active batch completes');
    releases[2]();

    const bulkResult = await bulkRun;
    assert.deepEqual(bulkResult, {
        processedCount: 3,
        updatedCount: 2,
        failedCount: 1,
        totalCount: 3
    });
    assert.deepEqual(progress, [
        { processedCount: 2, updatedCount: 1, failedCount: 1, totalCount: 3 },
        { processedCount: 3, updatedCount: 2, failedCount: 1, totalCount: 3 }
    ]);
    console.log('fasttag-editors tests passed');
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
