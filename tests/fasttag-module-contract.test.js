'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '..');
const pluginDirectory = path.join(repositoryRoot, 'plugins', 'fasttag');
const yaml = fs.readFileSync(path.join(pluginDirectory, 'fasttag.yml'), 'utf8');
const mainSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag.js'), 'utf8');
const coverEditorSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag-cover-editor.js'), 'utf8');
const settingsSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag-settings.js'), 'utf8');
const previewSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag-preview.js'), 'utf8');
const scraperControllerSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag-scraper-controller.js'), 'utf8');
const popupSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag-popup.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(pluginDirectory, 'fasttag-ui.js'), 'utf8');
const runnerSource = fs.readFileSync(path.join(__dirname, 'run-all.js'), 'utf8');
const expectedOrder = [
    'tabulator.min.js',
    'fasttag-core.js',
    'fasttag-entities.js',
    'fasttag-storage.js',
    'fasttag-diagnostics.js',
    'fasttag-api.js',
    'fasttag-notifications.js',
    'fasttag-settings.js',
    'fasttag-integrations.js',
    'fasttag-gemini.js',
    'fasttag-scraper.js',
    'fasttag-scraper-ui.js',
    'fasttag-scraper-controller.js',
    'fasttag-preview.js',
    'fasttag-cover-editor.js',
    'fasttag-ui.js',
    'fasttag-popup.js',
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
for (const namespace of ['Core', 'Entities', 'Storage', 'Diagnostics', 'Api', 'Notifications', 'Settings', 'Integrations', 'Gemini', 'Scraper', 'ScraperUi', 'ScraperController', 'Preview', 'CoverEditor', 'Ui', 'Popup', 'Editors', 'Workflows']) {
    assert.ok(mainSource.includes(`FastTag${namespace}`), `main entry point should require FastTag${namespace}`);
}
assert.equal(mainSource.includes('LEGACY_'), false, 'legacy comparison declarations should be removed');
assert.ok(runnerSource.includes('(?:-[a-z]+)*'), 'test runner should discover multi-hyphen FastTag modules');
assert.ok(mainSource.includes('__fastTagRuntimeInitialized'), 'FastTag should guard duplicate runtime initialization');
assert.ok(mainSource.includes("createButton.textContent = '＋ Studio';"), 'Edit Everything should offer compact studio creation when search has no match');
assert.ok(mainSource.includes("createButton.textContent = '＋ Group';"), 'Edit Everything should offer compact group creation when search has no match');
assert.ok(mainSource.includes("handleCreateEntity('studios');"), 'the compact Studio pill should use the confirmed entity-creation workflow');
assert.ok(mainSource.includes("handleCreateEntity('groups');"), 'the compact Group pill should use the confirmed entity-creation workflow');
assert.ok(mainSource.includes('const exactStudioExists = allStudios.some'), 'partial Studio matches must not hide the exact-name creation action');
assert.ok(mainSource.includes('const exactGroupExists = allGroups.some'), 'partial Group matches must not hide the exact-name creation action');
assert.ok(mainSource.includes('#scenes-popup .fasttag-quick-chip.fasttag-create-studio-chip'), 'Studio creation should have a specific gold rule that overrides generic quick-chip styling');
assert.ok(mainSource.includes('#scenes-popup .fasttag-quick-chip.fasttag-create-group-chip'), 'Group creation should have a specific gold rule that overrides generic quick-chip styling');
assert.ok(mainSource.includes("else if (type === 'studios') selectedStudioId = String(newId);"), 'a newly created Studio should replace the scene studio selection');
assert.ok(mainSource.includes("else if (type === 'groups') selectedGroupIds.add(String(newId));"), 'a newly created Group should join the scene group selection');
assert.ok(mainSource.includes('loadFastTagHelpModule'), 'Settings should lazy-load the standalone FastTag help module');
assert.equal(javascriptSection.includes('fasttag-help.js'), false, 'optional help must not participate in critical plugin startup');
assert.ok(yaml.includes('assets:\n    /: .'), 'FastTag should expose optional offline help through the Stash plugin asset route');
assert.ok(mainSource.includes('/plugin/fasttag/assets/fasttag-help.js'), 'help loader should try the configuration-derived Stash plugin asset URL');
assert.ok(mainSource.includes('/plugin/mypluginrc/assets/fasttag-help.js'), 'help loader should support the installed package ID asset URL');
assert.ok(mainSource.includes("scriptUrl.searchParams.set('v', '4.4.3-help-1')"), 'optional help should use the current release cache key so updated guide code is loaded');
assert.ok(fs.existsSync(path.join(pluginDirectory, 'USER_GUIDE.md')), 'offline Markdown user guide should ship with FastTag');

const scraperSaveMutation = scraperControllerSource.match(/mutation FastTagAcceptSave[\s\S]*?`, \{ input: updateInput \}\);/)?.[0] || '';
assert.ok(scraperSaveMutation.includes('title'), 'scraper save should return the updated title for live card refresh');
assert.ok(scraperSaveMutation.includes('date'), 'scraper save should return the updated date for live card refresh');
assert.ok(
    scraperControllerSource.includes('syncSceneToApolloCache(saveRes.data.sceneUpdate);'),
    'scraper save should synchronize returned metadata to the live scene-card cache'
);
assert.ok(
    scraperControllerSource.includes('setLiveEverythingPopupTitle(popup, match.title);'),
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
assert.ok(scraperControllerSource.includes('resolutionFailures'), 'scraper saves should report unresolved selected entities');
assert.ok(scraperControllerSource.includes('stash_ids { endpoint stash_id }'), 'scraper acceptance should preserve existing scene Stash IDs');
assert.ok(scraperControllerSource.includes('mutation FastTagAcceptStashId'), 'accepted StashDB matches should save their remote ID independently');
assert.ok(scraperControllerSource.includes('stash_ids: stashIdResolution.stashIds'), 'the Stash ID mutation should preserve existing IDs and add the accepted remote ID');
assert.ok(scraperControllerSource.includes('!idWasSaved'), 'scraper acceptance should verify that Stash returned the accepted remote ID');
assert.ok(
    popupSource.includes('!form.contains(e.target) && !isTextEntryTarget'),
    'background hotkey blocking must not consume typing in detached FastTag inputs'
);
assert.ok(scraperControllerSource.includes('fasttag-scrape-empty-query'), 'zero-result scraper state should provide an editable manual-search field');
assert.ok(
    scraperControllerSource.includes('await renderMatches(\n                            popup.scraperCardContainer,\n                            [],'),
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
assert.ok(settingsSource.includes('fasttag-tab-pane-matching'), 'Settings should provide a dedicated scraper-matching tab');
assert.ok(settingsSource.includes('fasttag-match-restore-defaults'), 'scraper-matching settings should provide a restore-defaults action');
assert.ok(settingsSource.includes("setScraperMatchingPreset(matchingPresetSelect.value)"), 'matching presets should update the persisted analysis criteria');
assert.ok(settingsSource.includes('<option value="custom" disabled'), 'Custom matching should be an automatic status rather than a selectable preset');
assert.ok(scraperControllerSource.includes('partitionObviousFalsePositiveMatches(allResults)'), 'scraper rendering should preserve and partition the complete result set');
assert.ok(scraperControllerSource.includes('fasttag-scrape-toggle-hidden'), 'filtered scraper results must remain available through a show-hidden control');
assert.ok(scraperControllerSource.includes('fasttag-scrape-toggle-overflow'), 'lower-ranked scraper results must remain available through a show-all control');
assert.ok(scraperControllerSource.includes('const initialResultLimit = getScraperMatchingSettings().initialResultLimit;'), 'large scraper result limits should use the matching preference');
assert.ok(scraperControllerSource.includes('font-variant-numeric: tabular-nums'), 'scraper navigation counters should use stable-width numerals');
assert.ok(scraperControllerSource.includes("getScraperHeaderDensity(availableWidth) === 'tight'"), 'the scraper header should use deterministic compact labels only at very narrow widths');
assert.ok(scraperControllerSource.includes("const scraperSourceLabel = scraperSourceName.replace(/\\.(?:org|com|net|cc)$/i, '');"), 'the scraper header should remove a trailing domain suffix from configured source names');
assert.ok(scraperControllerSource.includes('title="${escapeHtml(scraperSourceName)}">${escapeHtml(scraperSourceLabel)}</span>'), 'the scraper header should identify its source without implying that the candidate is a confirmed match');
assert.ok(scraperControllerSource.includes("scraperHeader.style.display = 'flex';"), 'each scraper header measurement should begin from its normal single-row layout');
assert.equal(scraperControllerSource.includes("scraperHeader.style.display = 'grid';"), false, 'the scraper header must never switch into a second row');
assert.ok(scraperControllerSource.includes("scraperSourceLabelElement.style.display = tight ? 'none' : '';"), 'very narrow headers should reclaim space from redundant source text');
assert.ok(scraperControllerSource.includes("scraperDockLabelElement.style.display = tight ? 'none' : '';"), 'very narrow headers should keep the Dock icon while reclaiming its label width');
assert.ok(scraperControllerSource.includes('flex-shrink: 0; max-width: 100%; margin-left: auto;'), 'scraper actions must remain inside the single-row HUD header');
assert.ok(scraperControllerSource.includes('>✕ Dismiss</button>'), 'result dismissal should be clearly labelled away from the navigation arrows');
assert.ok(scraperControllerSource.includes("value=\"${escapeHtml(match._searchQuery || '')}\""), 'manual scraper search should retain the complete contextual query');
assert.ok(scraperControllerSource.includes('function isPopupActive(popup)'), 'scraper rendering should reject stale popup work');
assert.ok(scraperControllerSource.includes('watchHudOwner(popup);'), 'detached scraper HUD should monitor its owning popup');
assert.ok(scraperControllerSource.includes('floatingHudElement._fastTagResizeObserver?.disconnect?.();'), 'closing the scraper HUD must stop its size observer before removal');
assert.ok(scraperControllerSource.includes('hudElement?.isConnected'), 'a detached scraper HUD must never persist its post-removal zero size');
assert.ok(scraperControllerSource.includes("dependencies?.getDetachScraper?.()\n            ? ensureHud(popup)"), 'remembered detached mode should create its HUD before rendering the first loading state');
assert.ok(scraperControllerSource.includes('savedWidth >= 300') && scraperControllerSource.includes('savedHeight >= 220'), 'invalid saved scraper dimensions should fall back to safe defaults');
assert.ok(scraperControllerSource.includes('const recheckScraperHeaderLayout = () =>') && scraperControllerSource.includes('root.setTimeout(updateScraperHeaderLayout, 80);'), 'scraper header wrapping should be rechecked after its final text and fonts settle');
assert.ok(scraperControllerSource.includes('targetContainer._fastTagRecheckScraperHeaderLayout = recheckScraperHeaderLayout;'), 'each scraper HUD should expose its own responsive header recheck');
assert.ok(scraperControllerSource.includes("acceptBtn.style.background = '#059669';\n                    container._fastTagRecheckScraperHeaderLayout?.();"), 'changing Accept to Saved should immediately recheck the responsive header layout');
assert.ok(popupSource.includes('activePopup._fastTagClosed = true;'), 'popup closure should invalidate pending scraper work');
assert.ok(scraperControllerSource.includes('function beginRequest(popup, sceneId)'), 'scrapes should receive a per-popup request generation');
assert.ok(scraperControllerSource.includes('if (!isRequestCurrent(popup, activeSceneId, scrapeRequestId)) return null;'), 'late automatic scrape responses should be discarded');
assert.ok(mainSource.includes('invalidateScraperRequests(popup);\n            popup.currentSceneId = sceneId;'), 'scene navigation should invalidate requests for the previous scene');
assert.ok(scraperControllerSource.includes('{ endpoint: match._sourceEndpoint, name: match._sourceName }'), 'scraper acceptance should pass source identity into new performer creation');
assert.ok(settingsSource.includes('fasttag-match-fill-performer-images'), 'Match settings should expose missing performer image enrichment');
assert.ok(mainSource.includes('buildScrapedPerformerPreviewData(performer, match, cachedPerformers)'), 'scraper performer pills should provide local-or-source hover previews');
assert.ok(scraperControllerSource.includes('data-scrape-performer-index='), 'scraper performer pills should be identifiable hover targets');
assert.ok(mainSource.includes('schedulePerformerHoverCardHide(delay = 260)'), 'performer previews should remain reachable across the pointer gap');
assert.ok(mainSource.includes("toastError(`AI Parse Error: ${err.message}`, undefined, 4500)"), 'AI Parse error notifications should use the shorter display duration');
assert.ok(previewSource.includes('FastTagCoverEditor.mountLauncher({'), 'Edit Everything media controls should mount the cover editor launcher');
assert.ok(previewSource.includes('code paths { preview screenshot webp stream }') && previewSource.includes('studioCode,'), 'the preview lookup should pass Stash Studio Code into the Cover Editor without another request');
assert.ok(previewSource.includes('getCaptureState: () =>'), 'the active media preview should expose safe frame-capture availability');
assert.ok(previewSource.includes('mountForCoverEditor: target =>'), 'the existing player should move into the cover editor rather than opening a second stream');
assert.ok(previewSource.includes('releaseFromCoverEditor: (releaseOptions = {}) =>'), 'closing the cover editor should return the existing player to Edit Everything');
assert.ok(previewSource.includes('coverEditorWasPoppedOut = isVideoPoppedOut;'), 'cover editing should remember whether the player started in its floating HUD');
assert.ok(previewSource.includes('if (restorePopout) togglePopout(true);'), 'closing the cover editor should restore the prior floating-video state');
assert.ok(coverEditorSource.includes("currentOptions.mediaController?.pause?.();\n                const source = captureState.source"), 'capturing a cover should pause controllable video media first');
assert.ok(coverEditorSource.includes("const playPauseButton = createActionButton('⏸ Pause')"), 'the cover editor should provide persistent playback controls');
assert.ok(popupSource.includes("e.target.closest('#fasttag-cover-editor-hud')"), 'cover-editor interactions should remain inside the owning popup boundary');
assert.ok(popupSource.includes("#fasttag-create-modal, #fasttag-cover-editor-hud"), 'Escape should be delegated to the cover editor before the owning popup');
assert.ok(popupSource.includes('#fasttag-cover-editor-hud #fasttag-media-container'), 'the relocated cover-editor player should bypass the modal wheel trap for two-way scrubbing');
assert.ok(previewSource.includes("progressBarBg.addEventListener('pointerdown'"), 'the full-video progress bar should support drag seeking');
assert.ok(previewSource.includes('timelineWasPlaying = shouldResumeAfterTimelineSeek('), 'timeline seeking should preserve normal and pending wheel-scrub playback state');
assert.ok(previewSource.includes("window.addEventListener('pointerup', finishTimelineSeek"), 'timeline seeking should finish even when pointer capture is lost outside the bar');
assert.ok(previewSource.includes("height: 16px; background: transparent"), 'the interactive timeline should provide an accessible pointer target');
assert.ok(previewSource.includes("progressBarTrack.style.height = '7px'"), 'the visible timeline should grow while hovered or dragged');
assert.ok(previewSource.includes('}, 3500);'), 'the interactive timeline should remain visible longer after use');
assert.ok(previewSource.includes('if (isVideoPoppedOut || coverEditing) return;'), 'clicking video inside the cover editor should not open the scene page');
assert.ok(previewSource.includes("currentMediaSource = 'preview-video'"), 'MP4 previews should be recognised as controllable fallback video');
assert.ok(previewSource.includes("currentMediaSource = 'preview-image'"), 'animated image previews should be recognised as capturable fallback media');
assert.ok(previewSource.includes("source: 'preview-image'"), 'the cover editor should expose animated preview capture availability');
assert.ok(coverEditorSource.includes("'Captured preview frame'"), 'fallback captures should be identified as preview frames');
assert.ok(coverEditorSource.includes('overflow:auto;resize:both'), 'the cover-editor HUD should be resizable from its browser corner');
assert.ok(coverEditorSource.includes('min-height:20px;padding:5px 10px'), 'the cover-editor title bar should match the compact main-popup header height');
assert.ok(coverEditorSource.includes("height:${isCompact ? '28px' : '44px'};flex:0 0 ${isCompact ? '28px' : '44px'};overflow-y:auto;box-sizing:border-box;display:${isCompact ? 'none' : 'flex'};align-items:center"), 'both cover-editor layouts should keep a fixed scrollable status height when guidance is shown');
assert.ok(coverEditorSource.includes("EDITOR_SIZE_STORAGE_KEY = 'fasttag_cover_editor_size'"), 'the cover editor should remember its resized dimensions');
assert.ok(coverEditorSource.includes("COMPACT_EDITOR_SIZE_STORAGE_KEY = 'fasttag_cover_editor_size_compact_v3'"), 'compact Cover Editor dimensions should be remembered separately');
assert.ok(coverEditorSource.includes('editor.restoreBaseSize?.();\n        saveEditorSize(editor.element, editor.compactMode);'), 'temporary status expansion must be removed before the compact size is saved on close');
assert.ok(coverEditorSource.includes('grid-template-columns:auto auto minmax(68px,1fr) auto auto'), 'cover playback and capture controls should remain on one line');
assert.ok(coverEditorSource.includes("padding:7px 12px;min-width:44px"), 'the cover editor frame-step buttons should provide a comfortably wide target');
assert.ok(!coverEditorSource.includes('Step backward while paused') && !coverEditorSource.includes('Step forward while paused'), 'the frame-step buttons should not display redundant tooltips');
assert.ok(coverEditorSource.includes('bindStepButton(stepBackButton, -1)') && coverEditorSource.includes('bindStepButton(stepForwardButton, 1)'), 'both cover editor arrows should support click-and-hold stepping');
assert.ok(coverEditorSource.includes('root.setTimeout(repeatStep, 400)') && coverEditorSource.includes('holdUsesShift ? 100 : 150'), 'arrow holds should use a safety delay followed by responsive frame or second repeats');
assert.ok(coverEditorSource.includes("button.addEventListener('pointercancel', stopHolding") && coverEditorSource.includes("root.addEventListener('blur', stopHolding"), 'interrupted arrow holds should stop safely');
assert.ok(coverEditorSource.includes("pasteButton.textContent = isCompact ? '📋 Paste' : '⌨ Press Ctrl+V / Cmd+V'"), 'blocked clipboard reads should preserve the compact footer while providing an explicit standard-layout prompt');
assert.ok(coverEditorSource.includes("panel.focus?.({ preventScroll: true })"), 'the manual paste fallback should focus the cover editor');
assert.ok(coverEditorSource.includes("root.location?.protocol === 'http:' && root.isSecureContext === false"), 'the clipboard explanation should only identify insecure HTTP connections');
assert.ok(coverEditorSource.includes('This HTTP network address cannot read the clipboard directly'), 'pressing Paste on an insecure HTTP connection should explain the keyboard fallback');
assert.ok(coverEditorSource.includes("root.confirm?.('Discard the new cover without saving?')"), 'closing an editor with a proposed cover should request confirmation');
assert.ok(coverEditorSource.includes("candidateBox.addEventListener('drop'"), 'the new-cover target should accept dragged image files');
assert.ok(coverEditorSource.includes('Capture, upload, paste or drop an image'), 'the empty new-cover target should advertise drag-and-drop support');
assert.ok(coverEditorSource.includes('Cover saved to Stash. Continue editing or move to another scene.'), 'saving a cover should leave the editor open for continued navigation');
assert.ok(coverEditorSource.includes('fasttag-cover-studio-code') && coverEditorSource.includes('renderStudioCode(nextOptions.studioCode);'), 'the Cover Editor should show and update a saved Studio Code during navigation');
assert.ok(mainSource.includes('mountMomentaryPeekButton(form, form.querySelector') && popupSource.includes("dependencies.mountMomentaryPeekButton?.(form, form.querySelector('.popup-header'))"), 'Everything and single-field editor popups should mount the shared eye control');
assert.ok(coverEditorSource.includes('dependencies.mountMomentaryPeekButton?.(panel, header, closeButton);'), 'the Cover Editor should mount the shared eye control');
assert.ok(scraperControllerSource.includes('dependencies.mountMomentaryPeekButton?.(targetContainer, scraperHeaderActions);'), 'the detached scraper HUD should mount the shared eye control');
assert.ok(scraperControllerSource.includes("dependencies.mountMomentaryPeekButton?.(detachedHud, detachedHud.querySelector?.('#fasttag-scrape-loading-actions'))"), 'the detached scraper HUD should join global peek while it is still loading');
assert.ok(previewSource.includes('dependencies.mountMomentaryPeekButton?.(() => floatingHudElement, controlsRow)'), 'the floating video HUD should mount the shared eye control');
assert.ok(uiSource.includes("panel.style.opacity = '0.15'") && uiSource.includes("root.addEventListener('pointerup', restoreMomentaryPeek, true)") && uiSource.includes('momentaryPeekTargets.forEach'), 'the shared eye should fade all registered FastTag panels to 15% opacity and restore them on release anywhere');
assert.ok(uiSource.includes("panel.style.pointerEvents = 'none'") && uiSource.includes("root.addEventListener('click', blockMomentaryPeekClick, true)"), 'global peek should pass wheel scrolling through faded panels while blocking accidental clicks behind them');
assert.ok(uiSource.includes("root.addEventListener('wheel', forwardMomentaryPeekWheel") && uiSource.includes('document.elementsFromPoint?.(event.clientX, event.clientY)') && uiSource.includes('scrollTarget.scrollTop += event.deltaY * scale'), 'global peek should explicitly forward mouse and touch-mouse wheel movement to the Stash scroller beneath the pointer');
assert.ok(uiSource.includes('suppressMomentaryPeekContextMenuWhileHeld = true') && uiSource.includes('suppressMomentaryPeekContextMenuUntil = Date.now() + 500') && uiSource.includes("root.addEventListener('contextmenu', blockRecentMomentaryPeekContextMenu, true)"), 'a right-button chord during peek should suppress repeated browser context menus until every mouse button is released');
assert.ok(uiSource.includes('event.pointerId === momentaryPeekPrimaryPointerId') && uiSource.includes("root.addEventListener('mousedown', blockMomentaryPeekMouseDown, true)"), 'peek context-menu suppression should track the initiating primary pointer and directly block secondary mouse-down events');
assert.ok(uiSource.includes("momentaryPeekInputShield.style.cssText = 'position:fixed;inset:0;z-index:2147483646") && uiSource.includes('isPointerRelease && !releasedInitiatingPointer'), 'peek should shield the underlying page and ignore non-primary releases until the initiating pointer is released');
assert.ok(uiSource.includes("momentaryPeekInputShield.addEventListener('mouseleave', restoreMomentaryPeek)"), 'peek should restore before the pointer leaves the webpage for browser or operating-system controls');
assert.ok(uiSource.includes("root.addEventListener('contextmenu', cancelUnexpectedMomentaryPeekInput, true)") && uiSource.includes('event.buttons === activeMomentaryPeekButtons'), 'global peek should restore safely when a second mouse button or context menu interrupts the original hold');
assert.ok(previewSource.includes("if (!saveOptions?.keepEditorOpen && !signal.aborted)"), 'saving within the persistent editor should not rebuild the underlying scene preview');
assert.ok(popupSource.includes('if (dependencies.coverEditor.closeActiveEditor?.(false, true) === false) return false;'), 'parent-popup closure should respect the unsaved-cover warning while remembering an open Cover Editor');
assert.ok(coverEditorSource.includes("dependencies.setPersistedOpen?.(true);") && coverEditorSource.includes("dependencies?.setPersistedOpen?.(false);"), 'the Cover Editor should remember whether it was explicitly left open or closed');
assert.ok(coverEditorSource.includes("button.isConnected && !activeEditor && dependencies?.isPersistedOpen?.()"), 'Edit Everything should restore a Cover Editor that was left open');
assert.ok(previewSource.includes('FastTagCoverEditor.restoreForHost?.({'), 'a remembered Cover Editor shell should open before scene media lookup completes');
assert.ok(coverEditorSource.includes("restoringOverlay.textContent = 'Preparing video…'"), 'the early restored shell should explain that its video is being prepared');
assert.ok(mainSource.includes("{ opacity: 0, transform: 'scale(.985)' }") && mainSource.includes("{ duration: 160, easing: 'ease-out' }"), 'Edit Everything should animate only after its full-size positioning geometry is available');
assert.ok(mainSource.includes("form.style.transformOrigin = 'top left'"), 'Edit Everything entrance scaling should keep its positioned top-left corner stationary');
assert.ok(mainSource.includes("prefers-reduced-motion: reduce"), 'Edit Everything entrance motion should respect reduced-motion preferences');
assert.ok(previewSource.includes('const animateHudEntrance = !window.matchMedia?.') && previewSource.includes('floatingHudElement.animate?.(['), 'the floating video HUD should use the subtle accessible entrance');
assert.ok(scraperControllerSource.includes('const animateHudEntrance = !root.matchMedia?.') && scraperControllerSource.includes('hudElement.animate?.(['), 'the detached scraper HUD should use the subtle accessible entrance');
assert.ok(previewSource.includes("hostContainer.style.height = 'auto';"), 'loading a new scene should restore a preview container collapsed by the cover editor');
assert.ok(!previewSource.includes('if (signal.aborted || !hostContainer.isConnected) return;'), 'aborted scene previews should still restore their connected host before navigation');
assert.ok((mainSource.match(/FastTagCoverEditor\.prepareForSceneNavigation\?\.\(\) === false/g) || []).length >= 4, 'all Edit Everything scene-navigation paths should hand the open cover editor to the next scene');
assert.ok(coverEditorSource.includes('beginNavigation') && coverEditorSource.includes('rebindScene'), 'scene navigation should rebind the existing cover-editor HUD in place');
assert.ok(coverEditorSource.includes('releaseFromCoverEditor?.({ forNavigation: true })') && previewSource.includes('if (releaseOptions.forNavigation)'), 'in-place navigation should detach the old player without briefly restoring it behind the HUD');
assert.ok(coverEditorSource.includes('generation !== sceneGeneration') && coverEditorSource.includes('sceneGeneration += 1'), 'late image processing must not populate the next scene after navigation');
assert.ok(!coverEditorSource.includes('fasttag-cover-navigation-overlay') && !coverEditorSource.includes('Loading next scene…'), 'fast Cover Editor navigation should retain the previous frame without flashing a loading overlay');
assert.ok(coverEditorSource.includes('Discard the new cover and continue to the next scene?'), 'cover-editor handoff should protect unsaved proposed covers');
const aiApplyMetadataBlock = mainSource.match(/mutation FastTagAIApplyMetadata[\s\S]*?syncSceneToApolloCache\(metadataRes\.data\.sceneUpdate\);/)?.[0] || '';
assert.ok(aiApplyMetadataBlock.includes('title date'), 'AI Apply All should return updated title and date');
assert.ok(aiApplyMetadataBlock.includes('syncSceneToApolloCache'), 'AI Apply All should synchronize metadata to live scene cards');
assert.ok(mainSource.includes("btn.dataset.aiActionState === 'pending' || btn.dataset.aiActionState === 'complete'"), 'AI entity pills should ignore repeated clicks while saving or after completion');
assert.ok(mainSource.includes('btn.textContent = `✓ ${label}`;'), 'AI entity pills should render one exact completion tick rather than prefixing repeated ticks');
const customMenuOpenBlock = mainSource.slice(mainSource.indexOf('function showCustomMenu('), mainSource.indexOf('function showCustomMenu(') + 500);
assert.equal(customMenuOpenBlock.includes('closePopup();'), false, 'opening the context menu must not trigger a Refract-wide card refresh');
const singleEditorOpenBlock = mainSource.slice(mainSource.indexOf('async function openEntityPopup('), mainSource.indexOf('async function openEntityPopup(') + 900);
assert.ok(singleEditorOpenBlock.includes('if (activePopup) closePopup(false);'), 'a direct card-icon click must not run empty popup cleanup and refresh every Refract card');
assert.ok((mainSource.match(/Finished \$\{/g) || []).length >= 2, 'single and Everything sequential workflows should distinguish their final progress action from the ordinary Close button');
assert.ok((mainSource.match(/cancelBtn\.style\.display = isLast \? 'none' : 'block';/g) || []).length >= 2, 'single and Everything workflows should hide the redundant Close button on the final sequential scene');
assert.ok((mainSource.match(/classList\.toggle\('fasttag-btn-finished-pulse', isLast\)/g) || []).length >= 2, 'both final sequential actions should use the gentle completion pulse');
assert.ok(mainSource.includes('@media (prefers-reduced-motion: reduce)'), 'the final-action pulse should respect reduced-motion preferences');
const everythingSequentialButtonBlock = mainSource.slice(mainSource.indexOf('} else if (sequentialEditState.enabled) {', mainSource.indexOf('const updateSaveButton = () =>')), mainSource.indexOf('} else {', mainSource.indexOf('} else if (sequentialEditState.enabled) {', mainSource.indexOf('const updateSaveButton = () =>'))));
assert.ok(everythingSequentialButtonBlock.includes("popup.cancelBtn.style.display = isLast ? 'none' : 'block';"), 'Edit Everything must apply final-scene hiding inside its Sequential branch');

console.log('fasttag-module-contract tests passed');
