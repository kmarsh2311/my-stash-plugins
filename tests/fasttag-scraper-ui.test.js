'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-scraper-ui.js');
const ui = global.FastTag.scraperUi;

assert.equal(ui.getAssessmentPresentation({ _matchAssessment: 'unlikely', _matchReasons: ['Studio differs'] }).label, 'Likely Wrong Scene');
assert.equal(ui.getAssessmentPresentation({ _matchAssessment: 'unlikely' }).icon, '⚠');
assert.equal(ui.getAssessmentPresentation({ _matchAssessment: 'likely' }).label, 'Likely Match');
assert.equal(ui.getAssessmentPresentation({}), null);

assert.equal(ui.getAcceptPresentation({ _matchAssessment: 'unlikely' }).requiresReview, true);
assert.equal(ui.getAcceptPresentation({ _matchAssessment: 'likely' }).label, '✓ Accept');

assert.deepEqual(ui.getPerformerPresentation({
    _hasLinkedPerformers: true,
    _performerOverlapNames: ['One'],
    _performerOverlapCount: 1,
    _linkedPerformerCount: 2,
    _additionalPerformerNames: ['Extra'],
    _additionalPerformerCount: 1
}), {
    overlapNames: ['One'], overlapCount: 1, linkedCount: 2,
    additionalNames: ['Extra'], additionalCount: 1, hasOverlap: true
});
assert.equal(ui.getPerformerPresentation({}), null);

assert.equal(ui.getSourcePresentation({ _matchType: 'scene-id' }).label, 'Scene Lookup');
assert.equal(ui.getSourcePresentation({ _matchType: 'title', _searchQuery: 'scene words' }).label, 'Keyword Search');
assert.equal(ui.getSourcePresentation({ _matchType: 'scraper', _sourceName: 'Custom' }).label, 'Custom Search');
assert.equal(ui.getSourcePresentation({}, true).label, 'Verified Fingerprint');

assert.deepEqual(ui.getUnavailableContextPresentation({
    _comparisonContext: { scene: true, performers: false, studio: true, duration: false, fingerprints: false }
}).missing, ['linked performers', 'duration', 'fingerprints']);
assert.equal(ui.getUnavailableContextPresentation({
    _comparisonContext: { scene: true, performers: true, studio: true, duration: true, fingerprints: true }
}), null);
assert.equal(ui.getUnavailableContextPresentation({ _comparisonContext: { scene: false } }).label, 'Local Comparison Unavailable');

console.log('fasttag-scraper-ui tests passed');
