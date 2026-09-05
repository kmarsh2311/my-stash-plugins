'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const pluginDirectory = path.join(repositoryRoot, 'plugins', 'fasttag');
const yaml = fs.readFileSync(path.join(pluginDirectory, 'fasttag.yml'), 'utf8');
const mainSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag.js'), 'utf8');
const runnerSource = fs.readFileSync(path.join(__dirname, 'run-all.js'), 'utf8');
const expectedOrder = [
    'tabulator.min.js',
    'fasttag-core.js',
    'fasttag-entities.js',
    'fasttag-storage.js',
    'fasttag-integrations.js',
    'fasttag-gemini.js',
    'fasttag-scraper.js',
    'fasttag-scraper-ui.js',
    'fasttag-preview.js',
    'fasttag-ui.js',
    'fasttag-editors.js',
    'fasttag-workflows.js',
    'fasttag.js'
];
const javascriptSection = yaml.match(/javascript:\s*\n([\s\S]*?)\n\s*css:/)?.[1] || '';
const configuredOrder = Array.from(javascriptSection.matchAll(/^\s*-\s+(.+\.js)\s*$/gm), match => match[1]);
assert.deepEqual(configuredOrder, expectedOrder, 'Stash must load FastTag modules in dependency order');

for (const file of expectedOrder) {
    assert.ok(fs.existsSync(path.join(pluginDirectory, file)), `${file} should exist`);
}
for (const namespace of ['Core', 'Entities', 'Storage', 'Integrations', 'Gemini', 'Scraper', 'ScraperUi', 'Preview', 'Ui', 'Editors', 'Workflows']) {
    assert.ok(mainSource.includes(`FastTag${namespace}`), `main entry point should require FastTag${namespace}`);
}
assert.equal(mainSource.includes('LEGACY_'), false, 'legacy comparison declarations should be removed');
assert.ok(runnerSource.includes('(?:-[a-z]+)*'), 'test runner should discover multi-hyphen FastTag modules');
assert.ok(mainSource.includes('__fastTagRuntimeInitialized'), 'FastTag should guard duplicate runtime initialization');
assert.ok(mainSource.includes('loadFastTagHelpModule'), 'Settings should lazy-load the standalone FastTag help module');
assert.equal(javascriptSection.includes('fasttag-help.js'), false, 'optional help must not participate in critical plugin startup');
assert.ok(fs.existsSync(path.join(pluginDirectory, 'USER_GUIDE.md')), 'offline Markdown user guide should ship with FastTag');

const scraperSaveMutation = mainSource.match(/mutation FastTagAcceptSave[\s\S]*?`, \{ input: updateInput \}\);/)?.[0] || '';
assert.ok(scraperSaveMutation.includes('title'), 'scraper save should return the updated title for live card refresh');
assert.ok(scraperSaveMutation.includes('date'), 'scraper save should return the updated date for live card refresh');
assert.ok(
    mainSource.includes('syncSceneToApolloCache(saveRes.data.sceneUpdate);'),
    'scraper save should synchronize returned metadata to the live scene-card cache'
);
assert.equal(
    mainSource.includes('In Single-Column Popup (Edit Tags, Edit Performers, Edit Studio)'),
    false,
    'obsolete single-popup scraper save path should remain removed'
);
assert.ok(mainSource.includes('createSerialTaskQueue()'), 'Edit Everything saves should use the serial workflow queue');
assert.ok(mainSource.includes('resolutionFailures'), 'scraper saves should report unresolved selected entities');
const aiApplyMetadataBlock = mainSource.match(/mutation FastTagAIApplyMetadata[\s\S]*?syncSceneToApolloCache\(metadataRes\.data\.sceneUpdate\);/)?.[0] || '';
assert.ok(aiApplyMetadataBlock.includes('title date'), 'AI Apply All should return updated title and date');
assert.ok(aiApplyMetadataBlock.includes('syncSceneToApolloCache'), 'AI Apply All should synchronize metadata to live scene cards');

console.log('fasttag-module-contract tests passed');
