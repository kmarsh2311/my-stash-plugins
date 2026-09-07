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

    function createSingleEditorSaveWorkflow(options = {}) {
        if (typeof options.commit !== 'function') {
            throw new TypeError('[FastTag] Single-editor save workflow requires a commit function');
        }

        const replaceBaseline = typeof options.replaceBaseline === 'function'
            ? options.replaceBaseline
            : () => {};
        const onLatestSuccess = typeof options.onLatestSuccess === 'function'
            ? options.onLatestSuccess
            : () => {};
        let pendingSaveSequence = 0;

        async function save(sceneId, selectedIds, context = null) {
            const saveSequence = ++pendingSaveSequence;
            const selectionSnapshot = normalizeIdSet(selectedIds);
            const success = await options.commit(sceneId, Array.from(selectionSnapshot), context);

            if (saveSequence !== pendingSaveSequence) return success;
            if (success) {
                replaceBaseline(new Set(selectionSnapshot), context);
                await onLatestSuccess({
                    sceneId,
                    selectedIds: new Set(selectionSnapshot),
                    context
                });
            }
            return success;
        }

        return Object.freeze({ save });
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.editors = Object.freeze({
        normalizeIdSet,
        hasSelectionSetChanged,
        calculateBulkSelectionDelta,
        applyBulkSelectionDelta,
        createSingleEditorSaveWorkflow
    });
}(typeof window !== 'undefined' ? window : globalThis));
