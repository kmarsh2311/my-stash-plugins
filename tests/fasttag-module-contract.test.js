'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const pluginDirectory = path.join(repositoryRoot, 'plugins', 'fasttag');
const yaml = fs.readFileSync(path.join(pluginDirectory, 'fasttag.yml'), 'utf8');
const mainSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag.js'), 'utf8');
const coverEditorSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag-cover-editor.js'), 'utf8');
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
    'fasttag-cover-editor.js',
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
for (const namespace of ['Core', 'Entities', 'Storage', 'Integrations', 'Gemini', 'Scraper', 'ScraperUi', 'Preview', 'CoverEditor', 'Ui', 'Editors', 'Workflows']) {
    assert.ok(mainSource.includes(`FastTag${namespace}`), `main entry point should require FastTag${namespace}`);
}
assert.equal(mainSource.includes('LEGACY_'), false, 'legacy comparison declarations should be removed');
assert.ok(runnerSource.includes('(?:-[a-z]+)*'), 'test runner should discover multi-hyphen FastTag modules');
assert.ok(mainSource.includes('__fastTagRuntimeInitialized'), 'FastTag should guard duplicate runtime initialization');
assert.ok(mainSource.includes('loadFastTagHelpModule'), 'Settings should lazy-load the standalone FastTag help module');
assert.equal(javascriptSection.includes('fasttag-help.js'), false, 'optional help must not participate in critical plugin startup');
assert.ok(yaml.includes('assets:\n    /: .'), 'FastTag should expose optional offline help through the Stash plugin asset route');
assert.ok(mainSource.includes('/plugin/fasttag/assets/fasttag-help.js'), 'help loader should try the configuration-derived Stash plugin asset URL');
assert.ok(mainSource.includes('/plugin/mypluginrc/assets/fasttag-help.js'), 'help loader should support the installed package ID asset URL');
assert.ok(fs.existsSync(path.join(pluginDirectory, 'USER_GUIDE.md')), 'offline Markdown user guide should ship with FastTag');

const scraperSaveMutation = mainSource.match(/mutation FastTagAcceptSave[\s\S]*?`, \{ input: updateInput \}\);/)?.[0] || '';
assert.ok(scraperSaveMutation.includes('title'), 'scraper save should return the updated title for live card refresh');
assert.ok(scraperSaveMutation.includes('date'), 'scraper save should return the updated date for live card refresh');
assert.ok(
    mainSource.includes('syncSceneToApolloCache(saveRes.data.sceneUpdate);'),
    'scraper save should synchronize returned metadata to the live scene-card cache'
);
assert.ok(
    mainSource.includes('setLiveEverythingPopupTitle(popup, match.title);'),
    'scraper acceptance should update the open popup title immediately'
);
assert.ok(
    mainSource.includes('popup._refreshHeaderTitle = updateUI;'),
    'live title updates should preserve sequential and random header controls'
);
assert.equal(
    mainSource.includes('In Single-Column Popup (Edit Tags, Edit Performers, Edit Studio)'),
    false,
    'obsolete single-popup scraper save path should remain removed'
);
assert.ok(mainSource.includes('createSerialTaskQueue()'), 'Edit Everything saves should use the serial workflow queue');
assert.ok(mainSource.includes('resolutionFailures'), 'scraper saves should report unresolved selected entities');
assert.ok(mainSource.includes('stash_ids { endpoint stash_id }'), 'scraper acceptance should preserve existing scene Stash IDs');
assert.ok(mainSource.includes('mutation FastTagAcceptStashId'), 'accepted StashDB matches should save their remote ID independently');
assert.ok(mainSource.includes('stash_ids: stashIdResolution.stashIds'), 'the Stash ID mutation should preserve existing IDs and add the accepted remote ID');
assert.ok(mainSource.includes('!idWasSaved'), 'scraper acceptance should verify that Stash returned the accepted remote ID');
assert.ok(
    mainSource.includes('!form.contains(e.target) && !isTextEntryTarget'),
    'background hotkey blocking must not consume typing in detached FastTag inputs'
);
assert.ok(mainSource.includes('fasttag-scrape-empty-query'), 'zero-result scraper state should provide an editable manual-search field');
assert.ok(
    mainSource.includes('renderScraperMatchCard(\n                            popup.scraperCardContainer,\n                            [],'),
    'Edit Everything should open the scraper search panel when automatic scraping returns no results'
);
assert.ok(
    mainSource.includes('sessionScrapeCache.delete(activeSceneId);')
        && mainSource.includes('popup.triggerScrape?.(true, activeSceneId'),
    'refreshing an open scraper should clear only the active scene cache and force a new automatic search'
);
assert.ok(
    mainSource.includes('await latestEverythingSavePromise')
        && mainSource.includes("doSave('Scene changes saved before searching again')"),
    'scraper refresh should wait for automatic scene saving before searching again'
);
assert.ok(
    mainSource.includes('sessionScrapeCache.set(activeSceneId, previousResults);'),
    'failed scraper refreshes should restore the previous result set'
);
assert.ok(mainSource.includes('fasttag-tab-pane-matching'), 'Settings should provide a dedicated scraper-matching tab');
assert.ok(mainSource.includes('fasttag-match-restore-defaults'), 'scraper-matching settings should provide a restore-defaults action');
assert.ok(mainSource.includes("setScraperMatchingPreset(matchingPresetSelect.value)"), 'matching presets should update the persisted analysis criteria');
assert.ok(mainSource.includes('<option value="custom" disabled'), 'Custom matching should be an automatic status rather than a selectable preset');
assert.ok(mainSource.includes('partitionObviousFalsePositiveMatches(allResults)'), 'scraper rendering should preserve and partition the complete result set');
assert.ok(mainSource.includes('fasttag-scrape-toggle-hidden'), 'filtered scraper results must remain available through a show-hidden control');
assert.ok(mainSource.includes('fasttag-scrape-toggle-overflow'), 'lower-ranked scraper results must remain available through a show-all control');
assert.ok(mainSource.includes('const initialResultLimit = getScraperMatchingSettings().initialResultLimit;'), 'large scraper result limits should use the matching preference');
assert.ok(mainSource.includes('font-variant-numeric: tabular-nums'), 'scraper navigation counters should use stable-width numerals');
assert.ok(mainSource.includes('>✕ Dismiss</button>'), 'result dismissal should be clearly labelled away from the navigation arrows');
assert.ok(mainSource.includes("value=\"${escapeHtml(match._searchQuery || '')}\""), 'manual scraper search should retain the complete contextual query');
assert.ok(mainSource.includes('function isScraperPopupActive(popup)'), 'scraper rendering should reject stale popup work');
assert.ok(mainSource.includes('watchFloatingScraperHudOwner(popup);'), 'detached scraper HUD should monitor its owning popup');
assert.ok(mainSource.includes('activePopup._fastTagClosed = true;'), 'popup closure should invalidate pending scraper work');
assert.ok(mainSource.includes('function beginScraperRequest(popup, sceneId)'), 'scrapes should receive a per-popup request generation');
assert.ok(mainSource.includes('if (!isScraperRequestCurrent(popup, activeSceneId, scrapeRequestId)) return null;'), 'late automatic scrape responses should be discarded');
assert.ok(mainSource.includes('invalidateScraperRequests(popup);\n            popup.currentSceneId = sceneId;'), 'scene navigation should invalidate requests for the previous scene');
assert.ok(mainSource.includes('{ endpoint: match._sourceEndpoint, name: match._sourceName }'), 'scraper acceptance should pass source identity into new performer creation');
assert.ok(mainSource.includes('fasttag-match-fill-performer-images'), 'Match settings should expose missing performer image enrichment');
assert.ok(mainSource.includes('buildScrapedPerformerPreviewData(performer, match, cachedPerformers)'), 'scraper performer pills should provide local-or-source hover previews');
assert.ok(mainSource.includes('data-scrape-performer-index='), 'scraper performer pills should be identifiable hover targets');
assert.ok(mainSource.includes('schedulePerformerHoverCardHide(delay = 260)'), 'performer previews should remain reachable across the pointer gap');
assert.ok(mainSource.includes("toastError(`AI Parse Error: ${err.message}`, undefined, 4500)"), 'AI Parse error notifications should use the shorter display duration');
assert.ok(mainSource.includes('FastTagCoverEditor.mountLauncher({'), 'Edit Everything media controls should mount the cover editor launcher');
assert.ok(mainSource.includes('getCaptureState: () =>'), 'the active media preview should expose safe frame-capture availability');
assert.ok(mainSource.includes('mountForCoverEditor: target =>'), 'the existing player should move into the cover editor rather than opening a second stream');
assert.ok(mainSource.includes('releaseFromCoverEditor: () =>'), 'closing the cover editor should return the existing player to Edit Everything');
assert.ok(coverEditorSource.includes("options.mediaController?.pause?.();\n                setCandidate(captureVideoFrame"), 'capturing a cover should pause the selected video frame first');
assert.ok(coverEditorSource.includes("const playPauseButton = createActionButton('⏸ Pause')"), 'the cover editor should provide persistent playback controls');
assert.ok(mainSource.includes("e.target.closest('#fasttag-cover-editor-hud')"), 'cover-editor interactions should remain inside the owning popup boundary');
assert.ok(mainSource.includes("#fasttag-create-modal, #fasttag-cover-editor-hud"), 'Escape should be delegated to the cover editor before the owning popup');
assert.ok(mainSource.includes('#fasttag-cover-editor-hud #fasttag-media-container'), 'the relocated cover-editor player should bypass the modal wheel trap for two-way scrubbing');
assert.ok(coverEditorSource.includes('overflow:auto;resize:both'), 'the cover-editor HUD should be resizable from its browser corner');
const aiApplyMetadataBlock = mainSource.match(/mutation FastTagAIApplyMetadata[\s\S]*?syncSceneToApolloCache\(metadataRes\.data\.sceneUpdate\);/)?.[0] || '';
assert.ok(aiApplyMetadataBlock.includes('title date'), 'AI Apply All should return updated title and date');
assert.ok(aiApplyMetadataBlock.includes('syncSceneToApolloCache'), 'AI Apply All should synchronize metadata to live scene cards');

console.log('fasttag-module-contract tests passed');
