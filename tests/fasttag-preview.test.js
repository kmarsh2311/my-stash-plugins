'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-preview.js');
const preview = global.FastTag.preview;
assert.ok(preview, 'FastTag preview namespace should be installed');

global.location = { origin: 'http://stash.local:9999', href: 'http://stash.local:9999/scenes' };

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

for (const [screenWidth, expected] of [
    [2400, { width: '760px', height: '428px' }],
    [1920, { width: '600px', height: '338px' }],
    [1400, { width: '520px', height: '293px' }],
    [1100, { width: '460px', height: '259px' }],
    [800, { width: '320px', height: '180px' }],
    [500, { width: '300px', height: '169px' }]
]) {
    global.innerWidth = screenWidth;
    assert.deepEqual(preview.getDefaultPopoutSize(), expected);
}

const mediaNode = (source, poster = '') => ({
    currentSrc: source,
    src: source,
    poster,
    getAttribute: name => name === 'poster' ? poster : source
});
const card = {
    querySelector: selector => selector === 'video' ? mediaNode('/card-preview.mp4', '/card-cover.jpg') : null,
    querySelectorAll: () => []
};
assert.deepEqual(preview.extractMediaUrlsFromCard(card), {
    previewUrl: '/card-preview.mp4',
    coverUrl: '/card-cover.jpg'
});
assert.deepEqual(preview.extractMediaUrlsFromCard(null), { previewUrl: null, coverUrl: null });
assert.equal(preview.toRelativeMediaUrl('https://other.host/video.mp4?x=1'), '/video.mp4?x=1');

async function testMediaLookup() {
    const calls = [];
    preview.configure({
        fetchGQL: async (query, variables) => {
            calls.push({ query, variables });
            if (calls.length === 1) return { errors: [{ message: 'webp unsupported' }] };
            return { data: { findScene: { paths: { preview: '/generated-preview', screenshot: '/generated-cover', stream: '/generated-stream' } } } };
        }
    });
    assert.deepEqual(await preview.fetchSceneMediaUrls('12', card), {
        previewUrl: '/generated-preview',
        coverUrl: '/generated-cover',
        streamUrl: '/generated-stream'
    });
    assert.equal(calls.length, 2, 'schema compatibility queries should be tried in order');

    preview.configure({ fetchGQL: async () => ({ data: { findScene: { paths: { preview: null, screenshot: null } } } }) });
    assert.deepEqual(await preview.fetchSceneMediaUrls('13', null), {
        previewUrl: null,
        coverUrl: '/scene/13/screenshot',
        streamUrl: '/scene/13/stream'
    }, 'an explicitly missing preview should not be replaced by a guessed URL');
}

testMediaLookup()
    .then(() => console.log('fasttag-preview tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
