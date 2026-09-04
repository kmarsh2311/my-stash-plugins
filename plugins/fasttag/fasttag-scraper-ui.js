(function initializeFastTagScraperUi(root) {
    'use strict';

    const ASSESSMENT_STYLES = Object.freeze({
        strong: Object.freeze({ label: 'Strong Match', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', icon: '✓' }),
        likely: Object.freeze({ label: 'Likely Match', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', icon: '✓' }),
        possible: Object.freeze({ label: 'Possible Match', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', icon: '✓' }),
        unlikely: Object.freeze({ label: 'Likely Wrong Scene', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', icon: '⚠' })
    });

    function getAssessmentPresentation(match) {
        const style = ASSESSMENT_STYLES[match?._matchAssessment] || null;
        if (!style) return null;
        return {
            ...style,
            tooltip: (match?._matchReasons || []).join(' • ')
        };
    }

    function getAcceptPresentation(match) {
        const requiresReview = match?._matchAssessment === 'unlikely';
        return requiresReview
            ? {
                requiresReview: true,
                label: '⚠ Review & Accept',
                title: 'This result has conflicting evidence; review it carefully before saving',
                background: '#b45309',
                border: '#f59e0b',
                shadow: 'rgba(180,83,9,0.4)'
            }
            : {
                requiresReview: false,
                label: '✓ Accept',
                title: 'Accept match and save metadata',
                background: '#059669',
                border: '#10b981',
                shadow: 'rgba(5,150,105,0.4)'
            };
    }

    function getPerformerPresentation(match) {
        if (!match?._hasLinkedPerformers) return null;
        const overlapNames = match._performerOverlapNames || [];
        const additionalNames = match._additionalPerformerNames || [];
        return {
            overlapNames,
            overlapCount: match._performerOverlapCount || 0,
            linkedCount: match._linkedPerformerCount || 0,
            additionalNames,
            additionalCount: match._additionalPerformerCount || 0,
            hasOverlap: overlapNames.length > 0
        };
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.scraperUi = Object.freeze({
        ASSESSMENT_STYLES,
        getAssessmentPresentation,
        getAcceptPresentation,
        getPerformerPresentation
    });
}(typeof window !== 'undefined' ? window : globalThis));
