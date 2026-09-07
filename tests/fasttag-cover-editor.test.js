'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'plugins', 'fasttag', 'fasttag-cover-editor.js'), 'utf8');

global.FastTag = {};
require('../plugins/fasttag/fasttag-cover-editor.js');
const coverEditor = global.FastTag.coverEditor;

assert.ok(coverEditor, 'FastTag cover editor namespace should be installed');
assert.ok(source.includes("dependencies.getCompactMode?.() === true"), 'Cover Editor should read the optional compact-layout preference');
assert.ok(source.includes('? [cancelButton, uploadButton, pasteButton, saveButton]'), 'compact footer should contain Cancel, Upload, Paste and Set Cover in that order');
assert.ok(source.includes("height:${isCompact ? '148px' : '165px'}") && !source.includes("height:${isCompact ? '112px' : '165px'}"), 'compact New Cover should retain the full Current Cover preview height');
assert.ok(source.includes("status.style.display = isCompact && !error && !showInCompact ? 'none' : 'flex'"), 'compact mode should hide routine guidance while retaining actionable status messages');

assert.deepEqual(coverEditor.calculateImageSize(3840, 2160), { width: 1920, height: 1080 });
assert.deepEqual(coverEditor.calculateImageSize(1080, 1920), { width: 1080, height: 1920 });
assert.deepEqual(coverEditor.calculateImageSize(1280, 720), { width: 1280, height: 720 });
assert.deepEqual(coverEditor.calculateImageSize(0, 720), { width: 0, height: 0 });
assert.deepEqual(coverEditor.calculateImageSize(4000, 2000, 1000), { width: 1000, height: 500 });
assert.equal(coverEditor.formatTime(0), '0:00');
assert.equal(coverEditor.formatTime(65.9), '1:05');
assert.equal(coverEditor.formatTime(3661), '1:01:01');
assert.equal(coverEditor.resolveStepSeconds(-1), -1);
assert.equal(coverEditor.resolveStepSeconds(1), 1);
assert.equal(coverEditor.resolveStepSeconds(-1, true), -1 / 30);
assert.equal(coverEditor.resolveStepSeconds(1, true), 1 / 30);
assert.deepEqual(coverEditor.resolveEditorSize(null, 1920, 1080), {
    width: 450,
    height: 740,
    minWidth: 360,
    minHeight: 420,
    maxWidth: 1896,
    maxHeight: 1056
});
assert.equal(coverEditor.resolveEditorSize(null, 1920, 1080, true).height, 545);
assert.deepEqual(coverEditor.resolveEditorSize({ width: 700, height: 900 }, 600, 700), {
    width: 576,
    height: 676,
    minWidth: 360,
    minHeight: 420,
    maxWidth: 576,
    maxHeight: 676
});

assert.equal(coverEditor.validateImageBlob(null), 'No image was provided.');
assert.equal(coverEditor.validateImageBlob({ type: 'text/plain', size: 20 }), 'Choose an image file.');
assert.equal(coverEditor.validateImageBlob({ type: 'image/png', size: 26 * 1024 * 1024 }), 'The image is larger than 25 MB.');
assert.equal(coverEditor.validateImageBlob({ type: 'image/webp', size: 1024 }), '');

const textItem = { type: 'text/plain' };
const imageItem = { type: 'image/png' };
assert.equal(coverEditor.findClipboardImage([textItem, imageItem]), imageItem);
assert.equal(coverEditor.findClipboardImage([textItem]), null);
assert.equal(coverEditor.findClipboardImage(null), null);

assert.throws(
    () => coverEditor.captureVideoFrame(null),
    /No video or preview frame is available/
);
assert.throws(
    () => coverEditor.captureVideoFrame({ tagName: 'VIDEO', readyState: 1, videoWidth: 1920, videoHeight: 1080 }),
    /finish loading/
);
assert.throws(
    () => coverEditor.captureMediaFrame({ tagName: 'IMG', complete: false, naturalWidth: 320, naturalHeight: 180 }),
    /preview frame to finish loading/
);

console.log('fasttag-cover-editor tests passed');
