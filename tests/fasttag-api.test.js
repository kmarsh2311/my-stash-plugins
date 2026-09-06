'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

global.window = global;
global.FastTag = {};
require(path.resolve(__dirname, '..', 'plugins', 'fasttag', 'fasttag-api.js'));

const api = global.FastTag.api;
assert.equal(api.getOperationName('query FindScene($id: ID!) { findScene(id: $id) { id } }'), 'FindScene');
assert.equal(api.getOperationName(' mutation UpdateScene { sceneUpdate(input: {}) { id } }'), 'UpdateScene');
assert.equal(api.getOperationName('{ configuration { general { databasePath } } }'), 'GQL');

async function run() {
    const calls = [];
    const logs = [];
    api.configure({
        fetchImpl: async (...args) => {
            calls.push(args);
            return { ok: true, json: async () => ({ data: { findScene: { id: '7' } } }) };
        },
        log: (...args) => logs.push(args),
        getDebugMode: () => true
    });
    const variables = { id: '7' };
    const success = await api.fetchGQL('query FindScene($id: ID!) { findScene(id: $id) { id } }', variables);
    assert.deepEqual(success, { data: { findScene: { id: '7' } } });
    assert.equal(calls[0][0], '/graphql');
    assert.deepEqual(JSON.parse(calls[0][1].body), {
        query: 'query FindScene($id: ID!) { findScene(id: $id) { id } }',
        variables
    });
    assert.equal(logs[0][0], 'DEBUG');

    api.configure({ fetchImpl: async () => ({ ok: false, status: 503, statusText: 'Unavailable' }), getDebugMode: () => false });
    assert.deepEqual(await api.fetchGQL('mutation SaveScene { sceneUpdate(input: {}) { id } }'), {
        errors: [{ message: 'GraphQL request failed: 503 Unavailable' }]
    });
    assert.equal(logs.at(-1)[0], 'ERROR');

    api.configure({ fetchImpl: async () => ({ ok: true, json: async () => null }) });
    assert.deepEqual(await api.fetchGQL('query InvalidPayload { configuration { general { databasePath } } }'), {
        errors: [{ message: 'GraphQL response was not valid JSON.' }]
    });

    api.configure({ fetchImpl: async () => { throw new Error('offline'); } });
    const originalConsoleError = console.error;
    console.error = () => {};
    try {
        assert.deepEqual(await api.fetchGQL('query Offline { configuration { general { databasePath } } }'), {
            errors: [{ message: 'offline' }]
        });
    } finally {
        console.error = originalConsoleError;
    }

    console.log('fasttag-api tests passed');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
