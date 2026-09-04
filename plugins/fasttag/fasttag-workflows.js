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

    root.FastTag = root.FastTag || {};
    root.FastTag.workflows = Object.freeze({ clampIndex, dismissIndexedResult, replaceResults });
}(typeof window !== 'undefined' ? window : globalThis));
