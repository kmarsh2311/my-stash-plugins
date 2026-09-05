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

console.log('fasttag-editors tests passed');
