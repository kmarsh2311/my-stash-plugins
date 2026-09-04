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

console.log('fasttag-scraper-ui tests passed');
