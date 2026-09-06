'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag.js'), 'utf8');
const previewSource = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag-preview.js'), 'utf8');
const scraperControllerSource = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag-scraper-controller.js'), 'utf8');
const popupSource = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag-popup.js'), 'utf8');

function section(startMarker, endMarker, text = source) {
    const start = text.indexOf(startMarker);
    assert.notEqual(start, -1, `missing characterization start marker: ${startMarker}`);
    const end = text.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(end, -1, `missing characterization end marker: ${endMarker}`);
    return text.slice(start, end);
}

function assertBefore(text, first, second, message) {
    const firstIndex = text.indexOf(first);
    const secondIndex = text.indexOf(second);
    assert.notEqual(firstIndex, -1, `missing first ordering marker: ${first}`);
    assert.notEqual(secondIndex, -1, `missing second ordering marker: ${second}`);
    assert.ok(firstIndex < secondIndex, message);
}

// Startup is deliberately guarded before any module configuration or global
// listener registration, so loading the plugin twice cannot duplicate runtime
// ownership.
const startup = section('(async function() {', '// --- State & Controllers ---');
assertBefore(startup, 'if (window.__fastTagRuntimeInitialized)', 'window.__fastTagRuntimeInitialized = true;', 'duplicate startup must be rejected before claiming the runtime');
assertBefore(startup, 'window.__fastTagRuntimeInitialized = true;', 'FastTagGemini.configure({', 'runtime ownership must be claimed before services are configured');
assert.equal((source.match(/window\.__fastTagRuntimeInitialized = true;/g) || []).length, 1, 'runtime ownership should have one assignment');

// Scraper responses belong to a live popup, scene and monotonically increasing
// request generation. Navigation invalidates the previous generation first.
const scraperLifecycle = section('function isPopupActive(popup)', 'function watchHudOwner(popup)', scraperControllerSource);
assert.ok(scraperLifecycle.includes('popup === dependencies?.getActivePopup?.()'), 'scraper work must belong to the active popup');
assert.ok(scraperLifecycle.includes("popup._fastTagClosed !== true"), 'closed popups must reject scraper work');
assert.ok(scraperLifecycle.includes('Boolean(popup.element?.isConnected)'), 'detached popups must reject scraper work');
assert.ok(scraperLifecycle.includes('Number(popup?._scrapeRequestGeneration || 0) + 1'), 'scraper request generations must increase');
assert.ok(scraperLifecycle.includes('popup._activeScrapeRequest = null;'), 'invalidation must clear the active request');
assert.ok(scraperLifecycle.includes('popup._activeScrapeRequest?.sceneId === normalizedSceneId'), 'current-result checks must include scene identity');

// A detached scraper belongs to its originating popup. Rebinding replaces the
// old observer, detachment closes the HUD, and explicit closure relinquishes
// both DOM and observer ownership.
const scraperHudOwnership = section('function watchHudOwner(popup)', 'function getInitialPopoutPosition(', scraperControllerSource);
assertBefore(scraperHudOwnership, 'floatingHudOwnerObserver.disconnect();', 'floatingHudOwnerPopup = popup || null;', 'HUD ownership must disconnect an old observer before rebinding');
assert.ok(scraperHudOwnership.includes('if (!isPopupActive(popup) && floatingHudOwnerPopup === popup)'), 'only the current detached-HUD owner may trigger automatic closure');
assert.ok(scraperHudOwnership.includes('closeHud();'), 'detaching the owner popup must close its scraper HUD');
assertBefore(scraperHudOwnership, 'floatingHudOwnerObserver = null;', 'floatingHudElement.remove();', 'HUD closure must release its observer before removing the element');
assert.ok(scraperHudOwnership.includes('floatingHudElement = null;'), 'HUD closure must release its element reference');

const scraperTrigger = section('function createTrigger(options)', 'async function renderMatches(', scraperControllerSource);
assertBefore(scraperTrigger, 'const scrapeRequestId = beginRequest(popup, activeSceneId);', 'await dependencies.fetchScraperMatchesForScene(activeSceneId, activeCardElement);', 'a scraper action must claim request ownership before starting network work');
assertBefore(scraperTrigger, 'await dependencies.fetchScraperMatchesForScene(activeSceneId, activeCardElement);', 'if (!isRequestCurrent(popup, activeSceneId, scrapeRequestId)) return null;', 'a completed scrape must be revalidated before its result is rendered');
assert.ok(scraperTrigger.includes('sessionCache.has(activeSceneId)'), 'repeat scraper opens should reuse the active session cache');
assert.ok(scraperTrigger.includes("mode === 'everything' ? false : undefined"), 'Edit Everything refreshes must be able to detect a failed scrape');

// Accept reads the visible field choices once, resolves all selected entities,
// commits ordinary metadata first, then stores the remote ID and cover in
// independent mutations so either optional save cannot roll back metadata.
const scraperAcceptance = section('async function acceptMatch(', 'root.FastTag = root.FastTag || {};', scraperControllerSource);
assertBefore(scraperAcceptance, 'const scrapeSelection = readScrapeFieldSelection(container);', 'const studioResolution = await resolveScrapedStudioResult(', 'acceptance must snapshot field choices before asynchronous resolution');
assertBefore(scraperAcceptance, 'const tagResolution = await resolveScrapedEntityIdsResult(', 'const sceneRes = await fetchGQL(`', 'all selected entities must resolve before scene mutation preparation');
assertBefore(scraperAcceptance, 'mutation FastTagAcceptSave', 'mutation FastTagAcceptStashId', 'ordinary metadata must save before the accepted remote ID');
assertBefore(scraperAcceptance, 'mutation FastTagAcceptStashId', 'mutation FastTagAcceptCover', 'the remote ID must save before the independently protected cover');
assertBefore(scraperAcceptance, 'syncSceneToApolloCache(saveRes.data.sceneUpdate);', 'await refreshSceneCards(sceneId);', 'the local GraphQL cache must update before scene cards are refreshed');
assertBefore(scraperAcceptance, 'await refreshSceneCards(sceneId);', 'sessionCache.delete(sceneId);', 'the accepted result cache must only clear after the refreshed scene is available');

const sceneReload = section('async function loadEditEverythingDataIntoPopup(', 'function renderEverythingAIMatchCard(');
assertBefore(sceneReload, 'invalidateScraperRequests(popup);', 'popup.currentSceneId = sceneId;', 'scene changes must invalidate old scraper work before changing identity');
assertBefore(sceneReload, 'popup.currentSceneId = sceneId;', 'attachScenePreview(', 'the popup scene identity must change before its preview is rebound');

// Popup closure first allows the Cover Editor to veto data loss, then marks the
// popup closed before destroying tables, aborting listeners, and closing HUDs.
const popupClose = section('function closeActive(resetSequential = true)', 'function getSavedSize(', popupSource);
assertBefore(popupClose, 'dependencies.coverEditor.closeActiveEditor?.() === false', 'isClosing = true;', 'unsaved cover confirmation must run before popup teardown');
assertBefore(popupClose, 'activePopup._fastTagClosed = true;', 'invalidateScraperRequests(activePopup);', 'popup closure must be visible before scraper invalidation');
for (const expected of [
    'activePopup.tagsTable.destroy();',
    'activePopup.performersTable.destroy();',
    'activeTableInstance.destroy();',
    'popupAbortController.abort();',
    'dependencies.abortCurrentPreview();',
    'dependencies.closeFloatingVideoHud(resetSequential);',
    'dependencies.closeFloatingScraperHud(resetSequential);',
    'document.body.classList.remove(\'fasttag-modal-open\');'
]) {
    assert.ok(popupClose.includes(expected), `popup teardown must retain: ${expected}`);
}
assert.ok(popupClose.includes('if (resetSequential) {'), 'session state should only be reset when requested');
assert.ok(popupClose.includes('dependencies.sessionScrapeCache.clear();'), 'full popup closure must clear session scrape results');

// The shared popup shell must retain its stable DOM contract, clamp restored
// sizes to the viewport, and enter the document before callers bind controls.
const popupShell = section('function createShell(type)', 'function positionNearCard(', popupSource);
assertBefore(popupShell, "const savedSize = getSavedSize('single');", "const form = root.document.createElement('form');", 'popup sizing must be resolved before constructing the shell');
assert.ok(popupShell.includes('Math.min(rawW, maxScreenW)'), 'restored popup width must be clamped to the viewport');
assert.ok(popupShell.includes('Math.min(rawH, maxScreenH)'), 'restored popup height must be clamped to the viewport');
for (const selector of ['preview-container', 'tabulator-table', 'search-input', 'refresh-btn', 'save-btn', 'cancel-btn']) {
    assert.ok(popupShell.includes(selector), `popup shell must retain its ${selector} control`);
}
assert.equal((popupShell.match(/class="popup-resize-handle"/g) || []).length, 8, 'popup shell must retain all eight resize handles');
assertBefore(popupShell, 'document.body.appendChild(form);', 'return {', 'the popup must be connected before its control references are returned');

// Positioning honours persisted positions and sequential continuity before
// falling back to card anchoring, then exposes and focuses the popup in a frame.
const popupPositioning = section('function positionNearCard(', 'root.FastTag = root.FastTag || {};', popupSource);
assert.ok(popupPositioning.includes("localStorage.getItem('fasttag_everything_pos')"), 'Edit Everything position must be restored');
assert.ok(popupPositioning.includes("localStorage.getItem('fasttag_single_pos')"), 'single-editor position must be restored');
assertBefore(popupPositioning, 'if (isEverythingModal)', 'if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0)', 'Edit Everything placement must be decided before single-editor sequential continuity');
assertBefore(popupPositioning, "localStorage.getItem('fasttag_single_pos')", 'const cardRect = cardElement ?', 'a saved single-editor position must take priority over card anchoring');
assert.ok(popupPositioning.includes("form.classList.add('popup-visible');"), 'positioned popups must become visible');
assert.ok(popupPositioning.includes('focus({ preventScroll: true })'), 'positioned popups must focus their first input without moving the page');

// Every shared listener follows the popup abort signal. Escape clears a search
// before closing, sidecar/submodal clicks remain inside ownership, and drag or
// resize completion persists the appropriate layout state.
const popupListeners = section('function setupListeners(', 'root.FastTag = root.FastTag || {};', popupSource);
assert.ok(popupListeners.includes("form.addEventListener('submit'"), 'popup submission must be contained');
assert.ok(popupListeners.includes("root.addEventListener('wheel'"), 'popup wheel containment must remain installed');
assert.ok(popupListeners.includes("document.addEventListener('keydown'"), 'popup keyboard containment must remain installed');
assert.ok(popupListeners.includes("e.target.closest('#fasttag-cover-editor-hud')"), 'Cover Editor interactions must remain within popup ownership');
const escapeHandling = section("if (e.key === 'Escape')", "if (e.target?.closest?.('#fasttag-cover-editor-hud'))", popupListeners);
assertBefore(escapeHandling, 'if (searchBox && searchBox.value.trim().length > 0)', 'closeActive();', 'Escape must clear active search text before closing the popup');
assert.ok(popupListeners.includes("localStorage.setItem('fasttag_everything_pos'"), 'dragging Edit Everything must persist its position');
assert.ok(popupListeners.includes("localStorage.setItem('fasttag_single_pos'"), 'dragging a single editor must persist its position');
assert.ok(popupListeners.includes('setSavedSize(form.offsetWidth, form.offsetHeight, popupType);'), 'resize completion must persist popup dimensions');
assert.ok((popupListeners.match(/\{ signal \}/g) || []).length >= 8, 'shared event listeners must remain abort-owned');

// Sequential navigation saves dirty metadata before changing scene, checks
// bounds, protects unsaved cover work, and always releases its busy flag.
const sequentialNavigation = section('async function navigateSequentialEditEverything(', 'function setupSequentialEditEverythingHandlers(');
assertBefore(sequentialNavigation, 'if (ctx.isDirty())', 'const nextIndex = currIdx + direction;', 'dirty scene data must save before choosing the next scene');
assertBefore(sequentialNavigation, 'if (nextIndex < 0 || nextIndex >= cards.length)', 'sequentialEditState.currentIndex = nextIndex;', 'navigation bounds must be checked before state changes');
assertBefore(sequentialNavigation, 'FastTagCoverEditor.prepareForSceneNavigation?.() === false', 'sequentialEditState.currentIndex = nextIndex;', 'cover changes must be protected before advancing state');
assert.ok(sequentialNavigation.includes('popup._isNavigatingSequential = true;'), 'navigation must expose its busy state');
assert.ok(sequentialNavigation.includes('finally {\n            popup._isNavigatingSequential = false;'), 'navigation must clear its busy state after success or failure');

// Edit Everything snapshots each save and serializes mutations. Only the newest
// completed save may become the editor's clean baseline.
const saveWorkflow = section('let pendingEverythingSaveSeq = 0;', 'const onSuggestionActivated = async (sug) =>');
assertBefore(saveWorkflow, 'const saveSeq = ++pendingEverythingSaveSeq;', 'const variables = {', 'each save must obtain a sequence before snapshotting selections');
assert.ok(saveWorkflow.includes('const targetSceneId = currentSceneId;'), 'a queued save must retain its original scene ID');
assert.ok(saveWorkflow.includes('if (saveSeq !== pendingEverythingSaveSeq) return true;'), 'an older save must not replace the newest clean baseline');
assert.ok(saveWorkflow.includes('latestEverythingSavePromise = enqueueEverythingSave(runSave);'), 'scene mutations must use the serial queue');
assert.ok(saveWorkflow.includes('return latestEverythingSavePromise;'), 'callers must be able to await the queued mutation');

// Preview ownership is characterized before its controller extraction. A host
// aborts its previous player before claiming a replacement, global input
// listeners belong to that abort signal, and teardown relinquishes Cover Editor
// and media-controller ownership.
const previewLifecycle = section('async function attachScenePreview(', 'root.FastTag = root.FastTag || {};', previewSource);
assertBefore(previewLifecycle, 'hostContainer._previewAbortController.abort();', 'const previewAbort = new AbortController();', 'a host must stop its old preview before creating another');
assertBefore(previewLifecycle, 'hostContainer._previewAbortController = previewAbort;', 'const { signal } = previewAbort;', 'the host must own the new abort controller');
assert.ok(previewLifecycle.includes("document.addEventListener('keydown', onKeyDown, { signal });"), 'preview keyboard listeners must follow preview lifetime');
assert.ok(previewLifecycle.includes("document.addEventListener('keyup', onKeyUp, { signal });"), 'preview key-release listeners must follow preview lifetime');
assert.ok(previewLifecycle.includes("window.addEventListener('blur', onWindowBlur, { signal });"), 'preview blur cleanup must follow preview lifetime');
assert.ok(previewLifecycle.includes('FastTagCoverEditor.closeForHost(hostContainer);'), 'aborting a preview must close its Cover Editor ownership');
assert.ok(previewLifecycle.includes('delete hostContainer._fastTagMediaController;'), 'aborting a preview must release its media controller');
assert.ok(previewLifecycle.includes('setVideoHudPersistedOpen(true);'), 'popping video out must preserve that preference');
assert.ok(previewLifecycle.includes('setVideoHudPersistedOpen(false);'), 'docking video must clear the persisted popout state');
assert.ok(previewLifecycle.includes('coverEditorWasPoppedOut = isVideoPoppedOut;'), 'Cover Editor must remember floating-player ownership');
assert.ok(previewLifecycle.includes('if (restorePopout) togglePopout(true);'), 'Cover Editor release must restore prior floating state');
assert.ok(previewLifecycle.includes("renderMedia(getAlwaysPlayFullVideo() ? 'stream' : 'preview');"), 'initial media mode must retain the user preference');
assert.ok(previewLifecycle.includes('if (isVideoPoppedOut || isVideoHudPersistedOpen())'), 'new scenes must retain floating-video continuity');

console.log('fasttag-runtime-characterization tests passed');
