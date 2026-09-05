(function initializeFastTagWorkflows(root) {
    'use strict';

    function clampIndex(index, length) {
        if (length <= 0) return -1;
        return Math.max(0, Math.min(Number.isFinite(index) ? index : 0, length - 1));
    }

    function dismissIndexedResult(results, index) {
        if (!Array.isArray(results) || results.length === 0) return { results: [], index: -1, dismissed: null };
        const safeIndex = clampIndex(index, results.length);
        const [dismissed] = results.splice(safeIndex, 1);
        return { results, index: clampIndex(safeIndex, results.length), dismissed: dismissed || null };
    }

    function replaceResults(target, replacement) {
        if (!Array.isArray(target)) return Array.isArray(replacement) ? replacement.slice() : [];
        target.splice(0, target.length, ...(Array.isArray(replacement) ? replacement : []));
        return target;
    }

    function createSerialTaskQueue() {
        let tail = Promise.resolve();
        return task => {
            const queued = tail.then(task, task);
            tail = queued.then(() => undefined, () => undefined);
            return queued;
        };
    }

    function createRandomSceneHistory(sceneId, count) {
        const entries = sceneId ? [{ id: String(sceneId), count }] : [];
        return { entries, index: entries.length - 1 };
    }

    function appendRandomSceneHistory(history, sceneId, count) {
        const state = history && Array.isArray(history.entries) ? history : createRandomSceneHistory();
        const id = String(sceneId || '');
        if (!id) return state;
        state.entries = state.entries.slice(0, Math.max(0, state.index + 1));
        const last = state.entries[state.entries.length - 1];
        if (last && last.id === id) {
            last.count = count;
        } else {
            state.entries.push({ id, count });
        }
        state.index = state.entries.length - 1;
        return state;
    }

    function moveRandomSceneHistory(history, direction) {
        if (!history || !Array.isArray(history.entries)) return null;
        const nextIndex = history.index + (direction < 0 ? -1 : 1);
        if (nextIndex < 0 || nextIndex >= history.entries.length) return null;
        history.index = nextIndex;
        return history.entries[nextIndex];
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.workflows = Object.freeze({
        clampIndex,
        dismissIndexedResult,
        replaceResults,
        createSerialTaskQueue,
        createRandomSceneHistory,
        appendRandomSceneHistory,
        moveRandomSceneHistory
    });
}(typeof window !== 'undefined' ? window : globalThis));
