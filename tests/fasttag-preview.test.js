'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-preview.js');
const preview = global.FastTag.preview;
assert.ok(preview, 'FastTag preview namespace should be installed');
assert.equal(preview.isPoppedOut(), false);
assert.equal(preview.getFloatingHudElement(), null);
assert.doesNotThrow(() => preview.abortCurrentPreview());
assert.doesNotThrow(() => preview.resetSessionCue());
assert.doesNotThrow(() => preview.resetLayoutState());

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
assert.equal(preview.calculateSeekTarget(150, 100, 200, 120), 30);
assert.equal(preview.calculateSeekTarget(50, 100, 200, 120), 0);
assert.equal(preview.calculateSeekTarget(400, 100, 200, 120), 120);
assert.equal(preview.calculateSeekTarget(150, 100, 0, 120), null);
assert.equal(preview.shouldResumeAfterTimelineSeek(true, false, false, false), true, 'normal editors should always resume their looping video after timeline seeking');
assert.equal(preview.shouldResumeAfterTimelineSeek(false, false, false, true), true, 'a playing Cover Editor video should resume after timeline seeking');
assert.equal(preview.shouldResumeAfterTimelineSeek(true, true, false, true), true, 'a Cover Editor wheel-scrub pause should retain its pending resume through timeline seeking');
assert.equal(preview.shouldResumeAfterTimelineSeek(true, true, true, true), false, 'Cover Editor Shift freeze should remain paused after timeline seeking');
assert.equal(preview.shouldResumeAfterTimelineSeek(true, false, false, true), false, 'an intentionally paused Cover Editor video should remain paused');

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

assert.deepEqual(preview.calculateVideoPopoutPosition({
    formRect: { left: 800, right: 1500, top: 100 },
    hudWidth: 600,
    hudHeight: 338,
    screenWidth: 1920,
    screenHeight: 1080
}), { left: '186px', top: '100px', width: '600px', height: '338px' });
assert.deepEqual(preview.calculateVideoPopoutPosition({
    formRect: { left: 100, right: 800, top: 5 },
    hudWidth: 600,
    hudHeight: 338,
    screenWidth: 1600,
    screenHeight: 900
}), { left: '814px', top: '14px', width: '600px', height: '338px' });
assert.deepEqual(preview.calculateVideoPopoutPosition({
    formRect: { left: 100, right: 800, top: 800 },
    scraperRect: { right: 1200 },
    hudWidth: 600,
    hudHeight: 338,
    screenWidth: 1600,
    screenHeight: 900
}), { left: '14px', top: '548px', width: '600px', height: '338px' });
assert.deepEqual(preview.calculateVideoPopoutPosition({
    formRect: null,
    hudWidth: 520,
    hudHeight: 293
}), { left: '20px', top: '70px', width: '520px', height: '293px' });

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

    global.document = {
        createElement: () => ({ style: {}, closest: () => null }),
        querySelector: () => null,
        body: { contains: () => false }
    };
    global.localStorage = { getItem: () => null, setItem() {} };
    global.ResizeObserver = class { observe() {} disconnect() {} };
    preview.configure({
        fetchGQL: async () => ({}),
        coverEditor: { closeForHost() {}, mountLauncher() {} },
        getSceneUrl: () => null,
        getScrubSpeeds: () => ({ slow: 5, normal: 10, fast: 20, freeze: 1 }),
        getScrubCueCount: () => 0,
        incrementScrubCueCount() {},
        MAX_SCRUB_CUE_DISPLAYS: 5,
        isVideoHudPersistedOpen: () => false,
        setVideoHudPersistedOpen() {},
        getAlwaysPlayFullVideo: () => false,
        showToast() {},
        log() {},
        getActivePopup: () => null,
        getFloatingScraperHudElement: () => null,
        getDefaultEverythingPosition: () => ({ x: 20, y: 70 })
    });
    const emptyHost = { style: {}, id: 'everything-preview-container' };
    await preview.attachScenePreview(emptyHost, null, null);
    assert.equal(emptyHost.style.display, 'none', 'a scene with no media should hide the empty preview host');
    assert.ok(emptyHost._previewAbortController instanceof AbortController, 'the preview host should own its abort controller');
    preview.abortCurrentPreview();
    assert.equal(emptyHost._previewAbortController.signal.aborted, true, 'controller teardown should abort the active preview');
}

testMediaLookup()
    .then(() => console.log('fasttag-preview tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
