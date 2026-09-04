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

console.log('fasttag-ui tests passed');
