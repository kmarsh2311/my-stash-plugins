(function initializeFastTagLibraryManagerIntegration(root) {
    'use strict';

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

    root.FastTag = root.FastTag || {};
    root.FastTag.libraryManager = Object.freeze({ isAvailable, openFilenameCorrection });
}(typeof window !== 'undefined' ? window : globalThis));
