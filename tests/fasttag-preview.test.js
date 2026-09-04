'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-preview.js');
const preview = global.FastTag.preview;
assert.ok(preview, 'FastTag preview namespace should be installed');

assert.equal(preview.getDominantWheelDelta(10, -20), -20);
assert.equal(preview.getDominantWheelDelta(20, -10), 20);
assert.equal(preview.getDominantWheelDelta(5, -5), -5, 'vertical delta should win a tie');
assert.equal(preview.getDominantWheelDelta(0, 0), null);
assert.equal(preview.getDominantWheelDelta(Number.NaN, Number.NaN), null);

assert.equal(preview.getWheelNotches(120, 0), 2);
assert.equal(preview.getWheelNotches(-3, 1), -3);
assert.equal(preview.getWheelNotches(2, 0), null, 'sub-threshold trackpad movement should be ignored');
assert.equal(preview.getWheelNotches(3, 0), 0.05, 'the threshold itself should be accepted');

const speeds = { slow: 5, normal: 10, fast: 20, freeze: 1 };
assert.equal(preview.selectScrubStep(speeds, 79, false), 20);
assert.equal(preview.selectScrubStep(speeds, 80, false), 10);
assert.equal(preview.selectScrubStep(speeds, 199, false), 10);
assert.equal(preview.selectScrubStep(speeds, 200, false), 5);
assert.equal(preview.selectScrubStep(speeds, 20, true), 1);
assert.equal(preview.selectScrubStep({ slow: 0, normal: 0, fast: 7, freeze: 0.5 }, 300, false), 7);
assert.equal(preview.selectScrubStep({ slow: 0, normal: 0, fast: 0, freeze: 0.5 }, 20, false), 10);

assert.equal(preview.calculateScrubTarget(50, 100, 1, 10), 40);
assert.equal(preview.calculateScrubTarget(50, 100, -1, 10), 60);
assert.equal(preview.calculateScrubTarget(5, 100, 1, 10), 0);
assert.equal(preview.calculateScrubTarget(95, 100, -1, 10), 100);

console.log('fasttag-preview tests passed');
