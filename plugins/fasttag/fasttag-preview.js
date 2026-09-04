(function initializeFastTagPreview(root) {
    'use strict';

    function getDominantWheelDelta(deltaX, deltaY) {
        const rawDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
        return !rawDelta || isNaN(rawDelta) ? null : rawDelta;
    }

    function getWheelNotches(rawDelta, deltaMode) {
        const notches = deltaMode === 1 ? rawDelta : (rawDelta / 60);
        return Math.abs(notches) < 0.05 ? null : notches;
    }

    function selectScrubStep(scrubSpeeds, timeDelta, shiftHeld) {
        if (shiftHeld) return scrubSpeeds.freeze;
        const slow = scrubSpeeds.slow > 0 ? scrubSpeeds.slow : 0;
        const normal = scrubSpeeds.normal > 0 ? scrubSpeeds.normal : 0;
        const fast = scrubSpeeds.fast > 0 ? scrubSpeeds.fast : 0;
        if (timeDelta < 80) return fast || normal || slow || 10.0;
        if (timeDelta < 200) return normal || slow || fast || 10.0;
        return slow || normal || fast || 10.0;
    }

    function calculateScrubTarget(currentTime, duration, notches, step) {
        const direction = -Math.sign(notches);
        return Math.min(duration, Math.max(0, currentTime + (direction * step)));
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.preview = Object.freeze({
        getDominantWheelDelta,
        getWheelNotches,
        selectScrubStep,
        calculateScrubTarget
    });
}(typeof window !== 'undefined' ? window : globalThis));
