'use strict';

const assert = require('node:assert/strict');

delete global.FastTag;
require('../plugins/fasttag/fasttag-core.js');

const core = global.FastTag?.core;
assert.ok(core, 'FastTag core namespace should be installed');

assert.equal(core.escapeHtml('<b title="x&y">'), '&lt;b title=&quot;x&amp;y&quot;&gt;');
assert.equal(core.escapeHtml(0), '');

assert.equal(core.formatTime(-1), '0:00');
assert.equal(core.formatTime(65.9), '1:05');
assert.equal(core.formatTime(3661), '1:01:01');

assert.equal(core.formatDurationSec(65.4), '1:05');
assert.equal(core.formatDurationSec(3661), '1:01:01');
assert.equal(core.parseDurationSec('1:01:01'), 3661);
assert.equal(core.parseDurationSec('01:05'), 65);
assert.equal(core.parseDurationSec('65.6'), 66);

assert.equal(core.cleanFilenameForSuggestions('MyScene_1080p.mp4'), 'MyScene_1080p');
assert.equal(core.cleanFilenameForSuggestions('MyScene 1080p.mp4'), 'MyScene  ');
assert.equal(core.normalizeTextForSuggestions('CaféScene4K'), 'cafescene 4 k');
assert.equal(core.normalizeTextForSuggestions('CafeScene4K'), 'cafe scene 4 k');

const sceneLink = { href: 'http://localhost:9999/scenes/abc-123?continue=true' };
const sceneCard = {
    querySelector: () => sceneLink,
    contains: (candidate) => candidate === mediaArea
};
const mediaArea = { name: 'preview' };
const infoTarget = {
    nodeType: 1,
    closest: (selector) => selector.includes('.scene-card,') ? sceneCard : null
};
const mediaTarget = {
    nodeType: 1,
    closest: (selector) => selector.includes('.thumbnail-section') ? mediaArea : sceneCard
};

assert.equal(core.extractSceneId(sceneCard), 'abc-123');
assert.equal(core.findSceneCardForContextTarget(infoTarget), sceneCard);
assert.equal(core.isScenePreviewContextTarget(infoTarget, sceneCard), false);
assert.equal(core.isScenePreviewContextTarget(mediaTarget, sceneCard), true);

console.log('fasttag-core tests passed');
