'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag.js'), 'utf8');
const previewSource = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag-preview.js'), 'utf8');
const scraperControllerSource = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag-scraper-controller.js'), 'utf8');
const popupSource = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag-popup.js'), 'utf8');
const editorSource = fs.readFileSync(path.join(repositoryRoot, 'plugins', 'fasttag', 'fasttag-editors.js'), 'utf8');

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
assertBefore(popupClose, 'dependencies.coverEditor.closeActiveEditor?.(false, true) === false', 'isClosing = true;', 'unsaved cover confirmation must run before popup teardown');
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
assert.equal(popupClose.includes(".off('rowSelected')"), false, 'popup teardown must not remove unregistered Tabulator selection events');
assert.equal(popupClose.includes(".off('rowDeselected')"), false, 'popup teardown must let table destruction release event handlers');
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

// Edit Everything honours its persisted workstation position. Single editors
// retain a user move only during sequential navigation and otherwise return to
// their current card anchor before becoming visible and focusing their input.
const popupPositioning = section('function positionNearCard(', 'root.FastTag = root.FastTag || {};', popupSource);
assert.ok(popupPositioning.includes("localStorage.getItem('fasttag_everything_pos')"), 'Edit Everything position must be restored');
assert.ok(popupPositioning.includes("localStorage.removeItem('fasttag_single_pos')"), 'obsolete persistent single-editor positions must be cleared');
assertBefore(popupPositioning, 'if (isEverythingModal)', 'if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0)', 'Edit Everything placement must be decided before single-editor sequential continuity');
assertBefore(popupPositioning, 'if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0)', 'const cardRect = cardElement ?', 'active sequential positioning must take priority over fresh card anchoring');
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
assert.equal(popupListeners.includes("localStorage.setItem('fasttag_single_pos'"), false, 'dragging a single editor must not persist its position beyond the current session');
assert.ok(popupListeners.includes('sequentialEditState.popupPosition = { left: rect.left, top: rect.top };'), 'dragging during sequential editing must retain the position for that session');
assert.ok(popupListeners.includes('setSavedSize(form.offsetWidth, form.offsetHeight, popupType);'), 'resize completion must persist popup dimensions');
assert.ok((popupListeners.match(/\{ signal \}/g) || []).length >= 8, 'shared event listeners must remain abort-owned');

// The single-entity editor establishes scene identity and a clean selection
// baseline before it binds scene-specific handlers. Automatic saves are
// sequenced so a slower, older response cannot overwrite the newest baseline.
const singleEditorWorkflow = section('async function loadEntityDataIntoPopup(', '// --- Global DOM Triggers ---');
assertBefore(singleEditorWorkflow, 'form._fastTagSceneId = sceneId;', 'await fetchGQL(config.fetchExistingQuery, { id: sceneId });', 'single-editor scene identity must be set before loading its metadata');
assertBefore(singleEditorWorkflow, 'sequentialEditState.initialSelectedIds = new Set(selectedIds);', 'setupSequentialEditHandlers(', 'single-editor navigation must bind after the clean selection baseline exists');
assert.ok(singleEditorWorkflow.includes('createSingleEditorSaveWorkflow({'), 'single-editor saves must delegate to the editor workflow module');
assert.ok(singleEditorWorkflow.includes('return singleEditorSaveWorkflow.save(sId, ids, { showToast });'), 'single-editor callers must await the extracted save result');
assertBefore(singleEditorWorkflow, 'refreshUI();\n            saveWithoutReload(sceneId, selectedIds);', 'const hasSearch = filterInput', 'row selection must update the UI and start its automatic save before search cleanup');
assert.ok(singleEditorWorkflow.includes('if (hasSelectionChanged(selectedIds))'), 'manual single-editor saves must avoid unchanged mutations');
assert.equal(source.includes('if (searchClear)'), false, 'editor search cleanup must use its defined clear-button reference');
assert.ok(source.includes('selectTableRowsById(activeTableInstance, selectedIds);'), 'selection restoration must avoid noisy Tabulator lookups for absent rows');
assert.ok(source.includes('activeTableInstance?._fastTagSingleRowClickBound'), 'single-editor handler cleanup must only remove a previously bound event');
assert.equal(source.includes('.off("rowSelected")'), false, 'editor setup must not remove Tabulator events it never registered');
assert.equal(source.includes('.off("rowDeselected")'), false, 'editor setup must not remove Tabulator events it never registered');
assert.ok(source.includes("table.initialized !== true || typeof table.redraw !== 'function'"), 'editor redraws must wait for Tabulator initialization');
assert.equal(source.includes('tableInstance.redraw(true);'), false, 'initial table loading must not redraw an uninitialized table directly');

const singleEditorSave = section('function createSingleEditorSaveWorkflow(', 'root.FastTag = root.FastTag || {};', editorSource);
assertBefore(singleEditorSave, 'const saveSequence = ++pendingSaveSequence;', 'const selectionSnapshot = normalizeIdSet(selectedIds);', 'single-editor saves must claim a sequence before snapshotting selections');
assertBefore(singleEditorSave, 'await options.commit(sceneId, Array.from(selectionSnapshot), context);', 'if (saveSequence !== pendingSaveSequence) return success;', 'single-editor mutations must finish before stale results are rejected');
assertBefore(singleEditorSave, 'if (saveSequence !== pendingSaveSequence) return success;', 'replaceBaseline(new Set(selectionSnapshot), context);', 'an older single-editor save must not replace the newest clean baseline');

// Single-editor sequential navigation commits a changed selection against the
// current scene before advancing state and loading the next scene in-place.
const singleEditorNavigation = section('async function navigateToNextScene(', 'function setupSequentialEditHandlers(');
assertBefore(singleEditorNavigation, 'await updateEntityForScene(type, currentSceneId, currentSelectedIds);', 'const nextIndex = sequentialEditState.currentIndex + direction;', 'single-editor navigation must save the current scene before choosing the next one');
assertBefore(singleEditorNavigation, 'if (nextIndex < 0 || nextIndex >= sequentialEditState.allSceneCards.length)', 'sequentialEditState.currentIndex = nextIndex;', 'single-editor navigation must validate bounds before advancing state');
assertBefore(singleEditorNavigation, 'form._fastTagSceneId = nextSceneId;', 'await loadEntityDataIntoPopup(type, nextSceneId, nextCard, activePopup);', 'single-editor identity must advance before the next scene is loaded');

// Bulk single-entity editing starts from values common to every scene, then
// applies only the user's add/remove delta to each scene's current values.
const bulkEntityWorkflow = section('async function openBulkEntityPopup(', 'function promptBulkConfirmationDialog(');
assertBefore(bulkEntityWorkflow, 'let initialCommonIds = new Set();', 'const selectedIds = new Set(initialCommonIds);', 'bulk editing must derive common values before creating editable selection state');
const bulkEntitySave = section('saveBtn.onclick = async () => {', 'setupPopupListeners(form, signal', bulkEntityWorkflow);
assertBefore(bulkEntitySave, 'if (!confirmed) return;', 'calculateBulkSelectionDelta(initialCommonIds, selectedIds);', 'bulk deltas must only be computed after confirmation');
assertBefore(bulkEntitySave, 'const existIds = (config.extractExisting(existRes?.data) || []).map(String);', 'targetIds = applyBulkSelectionDelta(existIds, removedIds, addedIds);', 'bulk editing must merge its delta with each scene\'s current values');
assert.ok(bulkEntitySave.includes('const bulkResult = await runBatchedSceneUpdates('), 'bulk mutations must delegate their batching and result totals');
assert.ok(bulkEntitySave.includes('concurrency: 3,'), 'bulk mutations must retain their bounded concurrency');
assertBefore(bulkEntitySave, 'await refreshSceneCards();', 'closePopup();', 'bulk editing must refresh scene cards before closing');

const bulkBatchWorkflow = section('async function runBatchedSceneUpdates(', 'root.FastTag = root.FastTag || {};', editorSource);
assertBefore(bulkBatchWorkflow, 'const results = await Promise.all(', 'updatedCount += results.filter(Boolean).length;', 'bulk result counts must be updated only after an entire batch settles');
assertBefore(bulkBatchWorkflow, 'processedCount += batch.length;', 'await onProgress({', 'bulk progress must follow completed work');

// Bulk Edit Everything independently tracks common values for every entity
// kind, preserves non-common per-scene metadata, and remains open on failures.
const bulkEverythingWorkflow = section('async function openBulkEverythingPopup(', 'async function openEntityPopup(');
for (const baseline of [
    'initialCommonTagIds',
    'initialCommonPerformerIds',
    'initialCommonStudioId',
    'initialCommonGroupIds'
]) {
    assert.ok(bulkEverythingWorkflow.includes(baseline), `bulk Edit Everything must retain its ${baseline} baseline`);
}
assertBefore(bulkEverythingWorkflow, 'const addedTagIds =', 'const confirmed = await promptBulkConfirmationDialog(', 'bulk Edit Everything must snapshot its selection delta before confirmation');
assertBefore(bulkEverythingWorkflow, 'const currentTags = (scene.tags || []).map', 'const targetTags = Array.from(new Set([', 'bulk tag changes must merge with each scene\'s current tags');
assertBefore(bulkEverythingWorkflow, 'const currentPerfs = (scene.performers || []).map', 'const targetPerfs = Array.from(new Set([', 'bulk performer changes must merge with each scene\'s current performers');
assertBefore(bulkEverythingWorkflow, 'const currentGroups = (scene.groups || []).map', 'const targetGroups = Array.from(new Set([', 'bulk group changes must merge with each scene\'s current groups');
assert.ok(bulkEverythingWorkflow.includes('const bulkResult = await runBatchedSceneUpdates('), 'bulk Edit Everything must share tested batching and result totals');
assert.ok(bulkEverythingWorkflow.includes('const { updatedCount, failedCount } = bulkResult;'), 'bulk Edit Everything must use the extracted completion summary');
assert.ok(bulkEverythingWorkflow.includes("popup.saveBtn.textContent = 'Retry Changes';"), 'a partial bulk failure must leave the editor available for retry');
assert.ok(bulkEverythingWorkflow.includes('The editor has stayed open so you can retry.'), 'partial bulk failure messaging must explain retained editor ownership');

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
const saveWorkflow = section('let latestEverythingSavePromise = Promise.resolve(true);', 'const onSuggestionActivated = async (sug) =>');
assert.ok(saveWorkflow.includes('const everythingSaveWorkflow = createEditEverythingSaveWorkflow({'), 'Edit Everything saves must delegate queue ownership to the editor module');
assert.ok(saveWorkflow.includes('enqueue: createSerialTaskQueue(),'), 'Edit Everything saves must retain their serial task queue');
assertBefore(saveWorkflow, 'syncSceneToApolloCache(res.data.sceneUpdate);', 'return true;', 'every successful scene mutation must update the live cache');
assert.ok(saveWorkflow.includes('initialTagIds = new Set(selection.tagIds);'), 'only the extracted latest-success stage may replace the clean baseline');
assert.ok(saveWorkflow.includes('sceneId: currentSceneId,'), 'a queued save must snapshot its original scene ID');
assert.ok(saveWorkflow.includes('tagIds: selectedTagIds,'), 'a queued save must snapshot its current tag selection');
assert.ok(saveWorkflow.includes('latestEverythingSavePromise = everythingSaveWorkflow.save({'), 'the coordinator must retain the latest queued promise for refresh and navigation');
assert.ok(saveWorkflow.includes('return latestEverythingSavePromise;'), 'callers must be able to await the queued mutation');

const everythingSaveCoordinator = section('function createEditEverythingSaveWorkflow(', 'root.FastTag = root.FastTag || {};', editorSource);
assertBefore(everythingSaveCoordinator, 'const saveSequence = ++pendingSaveSequence;', 'const selectionSnapshot = snapshotEverythingSelection(selection);', 'each Edit Everything save must claim a sequence before snapshotting selections');
assertBefore(everythingSaveCoordinator, 'await options.execute(selectionSnapshot, context);', 'if (saveSequence !== pendingSaveSequence) return success;', 'queued mutations must complete before stale latest-success effects are rejected');
assertBefore(everythingSaveCoordinator, 'if (saveSequence !== pendingSaveSequence) return success;', 'await onLatestSuccess(selectionSnapshot, context);', 'an older queued save must not replace the newest clean baseline');
assert.ok(everythingSaveCoordinator.includes('return options.enqueue(runSave);'), 'Edit Everything mutations must execute through the supplied serial queue');

// Edit Everything keeps editable and initial sets separate, exposes those sets
// through one popup-owned context, and replaces both from a freshly loaded
// scene before rendering scene-dependent suggestions.
const everythingEditorWorkflow = section('async function openEditEverythingPopup(', 'async function openBulkEverythingPopup(');
assertBefore(everythingEditorWorkflow, 'let selectedTagIds = new Set();', 'let initialTagIds = new Set();', 'Edit Everything must keep editable tags separate from their clean baseline');
assertBefore(everythingEditorWorkflow, 'let selectedPerformerIds = new Set();', 'let initialPerformerIds = new Set();', 'Edit Everything must keep editable performers separate from their clean baseline');
assertBefore(everythingEditorWorkflow, 'const isDirty = () => {', 'const updateSaveButton = () => {', 'dirty-state ownership must exist before save controls are rendered');
assert.ok(everythingEditorWorkflow.includes('setCurrentSceneId: (id) => { currentSceneId = id; }'), 'the popup context must own its active scene identity');
assert.ok(everythingEditorWorkflow.includes('setInitialTags: (s) => {'), 'the popup context must expose clean-baseline replacement');
assert.ok(everythingEditorWorkflow.includes('isDirty,'), 'the popup context must expose its dirty-state contract to navigation');

const everythingSceneLoad = section('async function loadEditEverythingDataIntoPopup(', 'function renderEverythingAIMatchCard(');
assertBefore(everythingSceneLoad, 'ctx.setCurrentSceneId(sceneId);', 'await fetchGQL(sceneQuery, { id: sceneId });', 'Edit Everything must claim the new scene before fetching its metadata');
assertBefore(everythingSceneLoad, 'ctx.setSelectedTags(selTags);', 'ctx.setInitialTags(new Set(selTags));', 'loaded tag selections must be copied into a separate clean baseline');
assertBefore(everythingSceneLoad, 'ctx.setSelectedPerformers(selPerfs);', 'ctx.setInitialPerformers(new Set(selPerfs));', 'loaded performer selections must be copied into a separate clean baseline');
assertBefore(everythingSceneLoad, 'setupSequentialEditEverythingHandlers(', 'await Promise.all([\n                ctx.fetchColumnData', 'scene navigation handlers must bind before scene tables finish rendering');
assertBefore(everythingSceneLoad, 'ctx.refreshAllUI();', 'await loadUnifiedSuggestions(', 'scene metadata and controls must be refreshed before asynchronous suggestions are loaded');

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
