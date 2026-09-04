'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const pluginDirectory = path.join(repositoryRoot, 'plugins', 'fasttag');
const yaml = fs.readFileSync(path.join(pluginDirectory, 'fasttag.yml'), 'utf8');
const mainSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag.js'), 'utf8');
const expectedOrder = [
    'tabulator.min.js',
    'fasttag-core.js',
    'fasttag-entities.js',
    'fasttag-storage.js',
    'fasttag-integrations.js',
    'fasttag-gemini.js',
    'fasttag-scraper.js',
    'fasttag-preview.js',
    'fasttag-ui.js',
    'fasttag-editors.js',
    'fasttag.js'
];
const javascriptSection = yaml.match(/javascript:\s*\n([\s\S]*?)\n\s*css:/)?.[1] || '';
const configuredOrder = Array.from(javascriptSection.matchAll(/^\s*-\s+(.+\.js)\s*$/gm), match => match[1]);
assert.deepEqual(configuredOrder, expectedOrder, 'Stash must load FastTag modules in dependency order');

for (const file of expectedOrder) {
    assert.ok(fs.existsSync(path.join(pluginDirectory, file)), `${file} should exist`);
}
for (const namespace of ['Core', 'Entities', 'Storage', 'Integrations', 'Gemini', 'Scraper', 'Preview', 'Ui', 'Editors']) {
    assert.ok(mainSource.includes(`FastTag${namespace}`), `main entry point should require FastTag${namespace}`);
}
assert.equal(mainSource.includes('LEGACY_'), false, 'legacy comparison declarations should be removed');

console.log('fasttag-module-contract tests passed');
