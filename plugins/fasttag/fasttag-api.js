(function(root) {
    'use strict';

    root.FastTag = root.FastTag || {};

    let fetchImpl = (...args) => root.fetch(...args);
    let log = () => {};
    let getDebugMode = () => false;

    function configure(options = {}) {
        if (typeof options.fetchImpl === 'function') fetchImpl = options.fetchImpl;
        if (typeof options.log === 'function') log = options.log;
        if (typeof options.getDebugMode === 'function') getDebugMode = options.getDebugMode;
    }

    function getOperationName(query) {
        return (String(query || '').match(/(query|mutation)\s+([A-Za-z0-9_]+)/) || [])[2] || 'GQL';
    }

    async function fetchGQL(query, variables = {}) {
        const queryName = getOperationName(query);
        try {
            const res = await fetchImpl('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables })
            });

            if (!res.ok) {
                const errPayload = { errors: [{ message: `GraphQL request failed: ${res.status} ${res.statusText}` }] };
                log('ERROR', 'GQL', `${queryName} failed with HTTP ${res.status}`, { queryName, variables, error: errPayload });
                return errPayload;
            }

            const payload = await res.json();
            if (!payload || typeof payload !== 'object') {
                const errPayload = { errors: [{ message: 'GraphQL response was not valid JSON.' }] };
                log('ERROR', 'GQL', `${queryName} invalid JSON response`, { queryName, error: errPayload });
                return errPayload;
            }

            if (payload.errors && payload.errors.length > 0) {
                log('WARN', 'GQL', `${queryName} returned GraphQL errors`, { queryName, variables, errors: payload.errors });
            } else if (getDebugMode()) {
                log('DEBUG', 'GQL', `${queryName} success`, { queryName, variables });
            }

            return payload;
        } catch (err) {
            log('ERROR', 'GQL', `${queryName} network exception: ${err.message || err}`, { queryName, variables, error: String(err) });
            root.console?.error?.('Stash Scene Manager: Network error', err);
            return { errors: [{ message: err.message || 'Unknown network error' }] };
        }
    }

    root.FastTag.api = Object.freeze({ configure, getOperationName, fetchGQL });
}(typeof window !== 'undefined' ? window : globalThis));
