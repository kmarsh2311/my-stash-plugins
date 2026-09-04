(function initializeFastTagEditors(root) {
    'use strict';

    function normalizeIdSet(ids) {
        return new Set(Array.from(ids || []).map(String));
    }

    function hasSelectionSetChanged(currentIds, initialIds) {
        const current = normalizeIdSet(currentIds);
        const initial = normalizeIdSet(initialIds);
        if (current.size !== initial.size) return true;
        for (const id of current) {
            if (!initial.has(id)) return true;
        }
        return false;
    }

    function calculateBulkSelectionDelta(initialCommonIds, selectedIds) {
        const initial = normalizeIdSet(initialCommonIds);
        const selected = normalizeIdSet(selectedIds);
        return {
            removedIds: new Set(Array.from(initial).filter(id => !selected.has(id))),
            addedIds: Array.from(selected).filter(id => !initial.has(id))
        };
    }

    function applyBulkSelectionDelta(existingIds, removedIds, addedIds) {
        const removed = normalizeIdSet(removedIds);
        const filtered = Array.from(existingIds || []).map(String).filter(id => !removed.has(id));
        return Array.from(new Set([...filtered, ...Array.from(addedIds || []).map(String)]));
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.editors = Object.freeze({
        normalizeIdSet,
        hasSelectionSetChanged,
        calculateBulkSelectionDelta,
        applyBulkSelectionDelta
    });
}(typeof window !== 'undefined' ? window : globalThis));
