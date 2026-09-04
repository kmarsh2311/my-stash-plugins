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

console.log('fasttag-workflows tests passed');
