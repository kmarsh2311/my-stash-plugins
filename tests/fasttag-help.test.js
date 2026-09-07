'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'plugins', 'fasttag', 'fasttag-help.js'), 'utf8');

global.FastTag = {};
require('../plugins/fasttag/fasttag-help.js');
const help = global.FastTag.help;

assert.ok(help, 'FastTag help namespace should be installed');
assert.ok(help.GUIDE_SECTIONS.length >= 15, 'guide should cover all major FastTag workflows');
assert.equal(new Set(help.GUIDE_SECTIONS.map(section => section.id)).size, help.GUIDE_SECTIONS.length, 'guide section IDs should be unique');
assert.ok(help.searchGuide('fingerprint').some(section => section.id === 'scraping'));
assert.ok(help.searchGuide('Gemini bridge').some(section => section.id === 'ai'));
assert.ok(help.searchGuide('cache refresh').some(section => section.id === 'cache'));
assert.ok(help.searchGuide('HTTP LAN address').some(section => section.id === 'video'));
assert.equal(help.searchGuide('words-that-do-not-exist').length, 0);
assert.equal(help.stripHtml('<p>Hello <strong>world</strong></p>'), 'Hello world');
assert.ok(source.includes('class="fasttag-help-header"'), 'the guide header should use a plugin-scoped element');
assert.ok(source.includes('id="fasttag-help-nav" role="navigation"'), 'the guide navigation should avoid host-theme semantic nav rules');
assert.ok(source.includes('id="fasttag-help-content" role="main"'), 'the guide content should avoid host-theme semantic main rules');

console.log('fasttag-help tests passed');
