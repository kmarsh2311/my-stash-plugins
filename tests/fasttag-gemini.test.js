'use strict';

const assert = require('node:assert/strict');

const nativeSetTimeout = global.setTimeout;
const requestTimeouts = [];
global.setTimeout = (callback, delay, ...args) => {
    if (delay === 40000) {
        requestTimeouts.push(callback);
        return { requestTimeout: true };
    }
    return nativeSetTimeout(callback, delay, ...args);
};
global.location = { hostname: 'stash.local' };
global.FastTag = {};

const sentPayloads = [];
class FakeWebSocket {
    static OPEN = 1;
    constructor(url) {
        this.url = url;
        this.readyState = FakeWebSocket.OPEN;
        queueMicrotask(() => this.onopen());
    }
    send(rawPayload) {
        const payload = JSON.parse(rawPayload);
        sentPayloads.push(payload);
        const result = payload.type === 'test'
            ? { connected: true }
            : { clean_title: 'Clean title', studio: 'Studio One', performers: ['Person One'] };
        queueMicrotask(() => this.onmessage({ data: JSON.stringify({ id: payload.id, result }) }));
    }
    close() { this.readyState = 3; }
}
global.WebSocket = FakeWebSocket;

require('../plugins/fasttag/fasttag-gemini.js');
const gemini = global.FastTag.gemini;
assert.ok(gemini, 'FastTag Gemini namespace should be installed');

const logs = [];
gemini.configure({
    fetchGQL: async () => ({}),
    getGeminiApiKey: () => 'stored-key',
    getGeminiModel: () => 'stored-model',
    getCachedOrNull: type => type === 'performers'
        ? Array.from({ length: 155 }, (_, index) => ({ name: `Performer ${index}` }))
        : Array.from({ length: 65 }, (_, index) => ({ name: `Studio ${index}` })),
    log: (...args) => logs.push(args)
});

async function runTests() {
    const testResult = await gemini.callGeminiAPI('custom-key', 'custom-model');
    assert.deepEqual(testResult, { connected: true });
    assert.equal(sentPayloads[0].type, 'test');
    assert.equal(sentPayloads[0].api_key, 'custom-key');
    assert.equal(sentPayloads[0].model, 'custom-model');

    const parseResult = await gemini.parseSceneWithGemini('scene-1', 'raw_file.mp4', 'Raw title');
    assert.equal(parseResult.clean_title, 'Clean title');
    const parsePayload = sentPayloads[1];
    assert.equal(parsePayload.type, 'parse');
    assert.equal(parsePayload.api_key, 'stored-key');
    assert.equal(parsePayload.model, 'stored-model');
    assert.equal(parsePayload.performers_context.length, 150);
    assert.equal(parsePayload.studios_context.length, 60);
    assert.equal(logs.length, 2);

    const cachedResult = await gemini.parseSceneWithGemini('scene-1', 'different.mp4', 'Different');
    assert.strictEqual(cachedResult, parseResult);
    assert.equal(sentPayloads.length, 2, 'a cached scene parse should not send another request');
    assert.equal(requestTimeouts.length, 2);

    gemini.configure({
        fetchGQL: async () => ({}),
        getGeminiApiKey: () => '',
        getGeminiModel: () => 'stored-model',
        getCachedOrNull: () => [],
        log: () => {}
    });
    await assert.rejects(() => gemini.callGeminiAPI(), /No Gemini API key configured/);
}

runTests()
    .then(() => console.log('fasttag-gemini tests passed'))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => { global.setTimeout = nativeSetTimeout; });
