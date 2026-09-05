'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-help.js');
const help = global.FastTag.help;

assert.ok(help, 'FastTag help namespace should be installed');
assert.ok(help.GUIDE_SECTIONS.length >= 15, 'guide should cover all major FastTag workflows');
assert.equal(new Set(help.GUIDE_SECTIONS.map(section => section.id)).size, help.GUIDE_SECTIONS.length, 'guide section IDs should be unique');
assert.ok(help.searchGuide('fingerprint').some(section => section.id === 'scraping'));
assert.ok(help.searchGuide('Gemini bridge').some(section => section.id === 'ai'));
assert.ok(help.searchGuide('cache refresh').some(section => section.id === 'cache'));
assert.equal(help.searchGuide('words-that-do-not-exist').length, 0);
assert.equal(help.stripHtml('<p>Hello <strong>world</strong></p>'), 'Hello world');

console.log('fasttag-help tests passed');
