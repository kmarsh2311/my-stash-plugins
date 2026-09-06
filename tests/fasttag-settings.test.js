'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'plugins', 'fasttag', 'fasttag-settings.js'), 'utf8');
const appended = [];
const root = {
    FastTag: {},
    console: { warn() {} },
    setTimeout,
    document: {
        getElementById: () => null,
        createElement: () => ({
            style: {},
            querySelector: () => null,
            querySelectorAll: () => [],
            remove() {}
        }),
        addEventListener() {},
        removeEventListener() {},
        body: { appendChild: element => appended.push(element) }
    }
};
root.window = root;
vm.runInNewContext(source, root, { filename: 'fasttag-settings.js' });

assert.equal(typeof root.FastTag.settings.open, 'function');
assert.equal(Object.isFrozen(root.FastTag.settings), true);
assert.match(source, /const \{[\s\S]*getThemePreference[\s\S]*setThemePreference[\s\S]*\} = options;/, 'settings dependencies should be explicit');
assert.match(source, /document\.addEventListener\('keydown', onSettingsKeyDown\)/, 'settings should own its Escape listener');
assert.match(source, /document\.removeEventListener\('keydown', onSettingsKeyDown\)/, 'settings should remove its Escape listener');
assert.match(source, /if \(e\.target === modal\)[\s\S]*closeModal\(\)/, 'settings should retain outside-click closure');
assert.match(source, /saveSpeedsFromInputs\(\)[\s\S]*modal\.remove\(\)/, 'settings closure should persist scrub controls before removal');
assert.match(source, /setScraperMatchingSettings\(\{[\s\S]*initialResultLimit/, 'custom matching controls should persist as a group');
assert.match(source, /resetScraperMatchingSettings\(\)/, 'matching defaults should remain restorable');
assert.match(source, /promptDebugModeWarningDialog\(\)/, 'enabling debug mode should retain its warning gate');
assert.match(source, /await callGeminiAPI\(/, 'Gemini connection testing should remain asynchronous');

const falseGetter = () => false;
const noOp = () => {};
const matching = {
    preset: 'balanced',
    hideObviousFalsePositives: true,
    singleWordAliasMode: 'weak',
    majorCastConflict: true,
    requireStudioMismatch: true,
    closeDurationProtects: true,
    titleSimilarityThreshold: 0.2,
    durationMismatchThreshold: 300,
    durationMismatchPercent: 25,
    initialResultLimit: 25
};
root.FastTag.settings.open({
    cacheStore: {},
    getEffectiveTheme: () => 'dark',
    getThemePreference: () => 'auto',
    getScrubSpeeds: () => ({ slow: 2, normal: 5, fast: 15, freeze: 0.5 }),
    getScraperMatchingSettings: () => matching,
    getGeminiApiKey: () => '',
    getGeminiModel: () => 'gemini-1.5-flash',
    getLogBufferSize: () => 0,
    getOrganizedWord: () => 'organized',
    getShowIdColumns: falseGetter,
    getEnableSuggestions: falseGetter,
    getAutoScrapeSequential: falseGetter,
    getShowRecentChips: falseGetter,
    getShowPinnedChips: falseGetter,
    getEnableCardIconClicks: falseGetter,
    getAlwaysPlayFullVideo: falseGetter,
    getAutoMarkOrganized: falseGetter,
    getDetachScraper: falseGetter,
    getFillMissingPerformerImages: falseGetter,
    getGeminiAutoParse: falseGetter,
    getDebugMode: falseGetter,
    DEFAULT_SCRUB_SPEEDS: { slow: 2, normal: 5, fast: 15, freeze: 0.5 },
    setThemePreference: noOp,
    setShowIdColumns: noOp,
    setEnableSuggestions: noOp,
    setShowRecentChips: noOp,
    setShowPinnedChips: noOp,
    setEnableCardIconClicks: noOp,
    setAlwaysPlayFullVideo: noOp,
    setAutoMarkOrganized: noOp,
    setAutoScrapeSequential: noOp,
    setDetachScraper: noOp,
    setFillMissingPerformerImages: noOp,
    setScraperMatchingSettings: noOp,
    setScraperMatchingPreset: noOp,
    resetScraperMatchingSettings: noOp,
    setScrubSpeeds: noOp,
    resetScrubCueCount: noOp,
    setGeminiApiKey: noOp,
    setGeminiModel: noOp,
    setGeminiAutoParse: noOp,
    callGeminiAPI: noOp,
    setDebugMode: noOp,
    copyDebugLogsToClipboard: noOp,
    downloadDebugLogFile: noOp,
    clearDebugLogs: noOp,
    resetAllLayoutsToDefault: noOp,
    invalidateCache: noOp,
    promptDebugModeWarningDialog: noOp,
    loadFastTagHelpModule: noOp,
    showToast: noOp,
    toastError: noOp
});
assert.equal(appended.length, 1, 'opening settings should append one modal');
assert.equal(appended[0].id, 'fasttag-settings-modal');

console.log('fasttag-settings tests passed');
