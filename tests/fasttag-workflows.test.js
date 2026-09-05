'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-workflows.js');
const workflows = global.FastTag.workflows;

assert.equal(workflows.clampIndex(5, 3), 2);
assert.equal(workflows.clampIndex(-2, 3), 0);
assert.equal(workflows.clampIndex(0, 0), -1);

const results = [{ id: 1 }, { id: 2 }, { id: 3 }];
const dismissed = workflows.dismissIndexedResult(results, 1);
assert.strictEqual(dismissed.results, results);
assert.deepEqual(results, [{ id: 1 }, { id: 3 }]);
assert.deepEqual(dismissed.dismissed, { id: 2 });
assert.equal(dismissed.index, 1);

const target = [{ id: 'old' }];
assert.strictEqual(workflows.replaceResults(target, [{ id: 'new' }]), target);
assert.deepEqual(target, [{ id: 'new' }]);

const randomHistory = workflows.createRandomSceneHistory('10', 25);
workflows.appendRandomSceneHistory(randomHistory, '11', 24);
workflows.appendRandomSceneHistory(randomHistory, '12', 23);
assert.deepEqual(randomHistory, {
    entries: [{ id: '10', count: 25 }, { id: '11', count: 24 }, { id: '12', count: 23 }],
    index: 2
});
assert.equal(workflows.moveRandomSceneHistory(randomHistory, -1)?.id, '11');
assert.equal(workflows.moveRandomSceneHistory(randomHistory, -1)?.id, '10');
assert.equal(workflows.moveRandomSceneHistory(randomHistory, -1), null);
assert.equal(workflows.moveRandomSceneHistory(randomHistory, 1)?.id, '11');
workflows.appendRandomSceneHistory(randomHistory, '13', 22);
assert.deepEqual(randomHistory.entries.map(entry => entry.id), ['10', '11', '13'], 'new rolls should discard forward history');
assert.equal(workflows.moveRandomSceneHistory(randomHistory, 1), null);

async function testSerialTaskQueue() {
    const enqueue = workflows.createSerialTaskQueue();
    const events = [];
    let releaseFirst;
    const firstGate = new Promise(resolve => { releaseFirst = resolve; });
    const first = enqueue(async () => {
        events.push('first-start');
        await firstGate;
        events.push('first-end');
        return 1;
    });
    const second = enqueue(async () => {
        events.push('second-start');
        events.push('second-end');
        return 2;
    });
    await Promise.resolve();
    assert.deepEqual(events, ['first-start']);
    releaseFirst();
    assert.deepEqual(await Promise.all([first, second]), [1, 2]);
    assert.deepEqual(events, ['first-start', 'first-end', 'second-start', 'second-end']);
}

testSerialTaskQueue()
    .then(() => console.log('fasttag-workflows tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
