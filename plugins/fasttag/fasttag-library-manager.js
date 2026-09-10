(function initializeFastTagLibraryManagerIntegration(root) {
    'use strict';

    const pendingSceneCardRefreshes = new Map();

    function bridge() {
        const candidate = root.StashLibraryManager;
        return candidate && typeof candidate.openFilenameCorrection === 'function' ? candidate : null;
    }

    function isAvailable() {
        return bridge() !== null;
    }

    function openFilenameCorrection(sceneId) {
        const libraryManager = bridge();
        if (!libraryManager) return false;
        libraryManager.openFilenameCorrection(String(sceneId));
        return true;
    }

    function scheduleSceneCardRefreshAfterRename(sceneId, refreshSceneCards, delayMs = 2500) {
        if (!isAvailable() || typeof refreshSceneCards !== 'function') return false;

        const normalizedSceneId = String(sceneId || '').trim();
        if (!normalizedSceneId) return false;

        const existingTimer = pendingSceneCardRefreshes.get(normalizedSceneId);
        if (existingTimer) root.clearTimeout(existingTimer);

        const timer = root.setTimeout(async () => {
            pendingSceneCardRefreshes.delete(normalizedSceneId);
            if (!isAvailable()) return;
            try {
                await refreshSceneCards(normalizedSceneId);
            } catch (error) {
                console.warn('[FastTag] Delayed scene-card refresh failed:', error);
            }
        }, delayMs);
        pendingSceneCardRefreshes.set(normalizedSceneId, timer);
        return true;
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.libraryManager = Object.freeze({
        isAvailable,
        openFilenameCorrection,
        scheduleSceneCardRefreshAfterRename
    });
}(typeof window !== 'undefined' ? window : globalThis));
