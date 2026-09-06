(function initializeFastTagScraperController(root) {
    'use strict';

    let dependencies = null;
    let floatingHudElement = null;
    let floatingHudPosition = null;
    let floatingHudSize = null;
    let floatingHudOwnerPopup = null;
    let floatingHudOwnerObserver = null;

    function configure(options) {
        dependencies = options;
    }

    function isPopupActive(popup) {
        if (!popup) return true;
        return popup === dependencies?.getActivePopup?.()
            && popup._fastTagClosed !== true
            && Boolean(popup.element?.isConnected);
    }

    function beginRequest(popup, sceneId) {
        if (!isPopupActive(popup)) return null;
        const normalizedSceneId = String(sceneId || '');
        if (popup?.currentSceneId != null && String(popup.currentSceneId) !== normalizedSceneId) return null;
        const requestId = Number(popup?._scrapeRequestGeneration || 0) + 1;
        popup._scrapeRequestGeneration = requestId;
        popup._activeScrapeRequest = { requestId, sceneId: normalizedSceneId };
        return requestId;
    }

    function invalidateRequests(popup) {
        if (!popup) return;
        popup._scrapeRequestGeneration = Number(popup._scrapeRequestGeneration || 0) + 1;
        popup._activeScrapeRequest = null;
    }

    function isRequestCurrent(popup, sceneId, requestId = null) {
        if (!isPopupActive(popup)) return false;
        const normalizedSceneId = String(sceneId || '');
        if (popup?.currentSceneId != null && String(popup.currentSceneId) !== normalizedSceneId) return false;
        if (requestId == null) return true;
        return popup?._activeScrapeRequest?.requestId === requestId
            && popup._activeScrapeRequest?.sceneId === normalizedSceneId;
    }

    function watchHudOwner(popup) {
        if (floatingHudOwnerObserver) {
            floatingHudOwnerObserver.disconnect();
            floatingHudOwnerObserver = null;
        }
        floatingHudOwnerPopup = popup || null;
        const ownerParent = popup?.element?.parentNode;
        if (!popup || !ownerParent || typeof root.MutationObserver === 'undefined') return;

        floatingHudOwnerObserver = new root.MutationObserver(() => {
            if (!isPopupActive(popup) && floatingHudOwnerPopup === popup) {
                closeHud();
            }
        });
        floatingHudOwnerObserver.observe(ownerParent, { childList: true });
    }

    function closeHud() {
        if (floatingHudOwnerObserver) {
            floatingHudOwnerObserver.disconnect();
            floatingHudOwnerObserver = null;
        }
        floatingHudOwnerPopup = null;
        if (floatingHudElement) {
            floatingHudElement.remove();
            floatingHudElement = null;
        }
    }

    function getInitialPopoutPosition(hudWidth = 390, hudHeight = 480) {
        if (!dependencies) throw new Error('[FastTag] Scraper controller is not configured');
        const document = root.document;
        const activePopup = dependencies.getActivePopup?.();
        const activeForm = activePopup?.element || document.querySelector('#scenes-popup');
        const margin = 12;
        const screenWidth = root.innerWidth;
        const screenHeight = root.innerHeight;

        const videoHudElement = dependencies.getFloatingVideoHudElement?.();
        const isVideoOpen = dependencies.isVideoPoppedOut?.()
            && videoHudElement
            && document.body.contains(videoHudElement);
        const videoRect = isVideoOpen ? videoHudElement.getBoundingClientRect() : null;

        if (activeForm) {
            let rect = activeForm.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.left <= 0) {
                const formW = parseInt(activeForm.style.width, 10) || 760;
                const formH = parseInt(activeForm.style.height, 10) || 760;
                const defPos = dependencies.getDefaultEverythingPosition(formW, formH);
                rect = { left: defPos.x, right: defPos.x + formW, top: defPos.y, bottom: defPos.y + formH, width: formW, height: formH };
            }

            const spaceRight = Math.max(0, screenWidth - rect.right - margin);
            const spaceLeft = Math.max(0, rect.left - margin);
            if (spaceRight >= hudWidth + margin) {
                const left = Math.round(rect.right + margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return { left: `${left}px`, top: `${top}px`, width: `${hudWidth}px`, height: `${hudHeight}px` };
            }
            if (spaceLeft >= hudWidth + margin && (!isVideoOpen || (videoRect && videoRect.left >= rect.right))) {
                const left = Math.round(rect.left - hudWidth - margin);
                const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
                return { left: `${left}px`, top: `${top}px`, width: `${hudWidth}px`, height: `${hudHeight}px` };
            }
            const left = Math.max(margin, Math.min(screenWidth - hudWidth - margin, Math.round(rect.right + margin)));
            const top = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(rect.top)));
            return { left: `${left}px`, top: `${top}px`, width: `${hudWidth}px`, height: `${hudHeight}px` };
        }

        return { right: '20px', top: '70px', width: `${hudWidth}px`, height: `${hudHeight}px` };
    }

    function attachResizeHandles(hudElement) {
        if (!hudElement) return;
        const document = root.document;
        hudElement.querySelectorAll('.fasttag-scraper-resize-handle').forEach(element => element.remove());

        const minW = 300;
        const minH = 220;
        const maxW = Math.max(minW, root.innerWidth - 16);
        const maxH = Math.max(minH, root.innerHeight - 16);
        const handles = [
            { dir: 'n', style: 'top: -5px; left: 12px; right: 12px; height: 10px; cursor: ns-resize; z-index: 100;' },
            { dir: 's', style: 'bottom: -5px; left: 12px; right: 12px; height: 10px; cursor: ns-resize; z-index: 100;' },
            { dir: 'e', style: 'right: -5px; top: 12px; bottom: 12px; width: 10px; cursor: ew-resize; z-index: 100;' },
            { dir: 'w', style: 'left: -5px; top: 12px; bottom: 12px; width: 10px; cursor: ew-resize; z-index: 100;' },
            { dir: 'ne', style: 'top: -5px; right: -5px; width: 16px; height: 16px; cursor: nesw-resize; z-index: 101;' },
            { dir: 'nw', style: 'top: -5px; left: -5px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 101;' },
            { dir: 'se', style: 'bottom: -5px; right: -5px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 101;' },
            { dir: 'sw', style: 'bottom: -5px; left: -5px; width: 16px; height: 16px; cursor: nesw-resize; z-index: 101;' }
        ];

        handles.forEach(({ dir, style }) => {
            const handle = document.createElement('div');
            handle.className = 'fasttag-scraper-resize-handle';
            handle.setAttribute('data-dir', dir);
            handle.style.cssText = `position: absolute; ${style} user-select: none; touch-action: none;`;
            handle.addEventListener('mousedown', event => {
                event.preventDefault();
                event.stopPropagation();
                hudElement._isDragging = true;
                const startX = event.clientX;
                const startY = event.clientY;
                const rect = hudElement.getBoundingClientRect();
                const startL = rect.left;
                const startT = rect.top;
                const startW = hudElement.offsetWidth;
                const startH = hudElement.offsetHeight;
                document.body.style.cursor = handle.style.cursor;
                document.body.style.userSelect = 'none';

                const onMouseMove = moveEvent => {
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;
                    let newW = startW;
                    let newH = startH;
                    let newL = startL;
                    let newT = startT;
                    if (dir.includes('e')) newW = startW + dx;
                    if (dir.includes('w')) { newW = startW - dx; newL = startL + dx; }
                    if (dir.includes('s')) newH = startH + dy;
                    if (dir.includes('n')) { newH = startH - dy; newT = startT + dy; }
                    if (newW < minW) { if (dir.includes('w')) newL = startL + (startW - minW); newW = minW; }
                    if (newW > maxW) { if (dir.includes('w')) newL = startL + (startW - maxW); newW = maxW; }
                    if (newL < 8) { if (dir.includes('w')) newW = startW + (startL - 8); newL = 8; }
                    if (newH < minH) { if (dir.includes('n')) newT = startT + (startH - minH); newH = minH; }
                    if (newH > maxH) { if (dir.includes('n')) newT = startT + (startH - maxH); newH = maxH; }
                    if (newT < 8) { if (dir.includes('n')) newH = startH + (startT - 8); newT = 8; }
                    if (newT + newH > root.innerHeight - 8 && dir.includes('s')) newH = root.innerHeight - 8 - newT;
                    if (newL + newW > root.innerWidth - 8 && dir.includes('e')) newW = root.innerWidth - 8 - newL;
                    hudElement.style.width = `${Math.round(newW)}px`;
                    hudElement.style.height = `${Math.round(newH)}px`;
                    hudElement.style.left = `${Math.round(newL)}px`;
                    hudElement.style.top = `${Math.round(newT)}px`;
                    hudElement.style.right = 'auto';
                    floatingHudSize = { width: `${Math.round(newW)}px`, height: `${Math.round(newH)}px` };
                    floatingHudPosition = { top: `${Math.round(newT)}px`, left: `${Math.round(newL)}px` };
                };

                const onMouseUp = () => {
                    hudElement._isDragging = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    try {
                        root.localStorage.setItem('fasttag_scraper_hud_pos', JSON.stringify(floatingHudPosition));
                        root.localStorage.setItem('fasttag_scraper_hud_size', JSON.stringify(floatingHudSize));
                    } catch (error) {}
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
            hudElement.appendChild(handle);
        });
    }

    function getHudElement() { return floatingHudElement; }
    function setHudElement(element) { floatingHudElement = element || null; }
    function getHudPosition() { return floatingHudPosition; }
    function setHudPosition(position) { floatingHudPosition = position || null; }
    function getHudSize() { return floatingHudSize; }
    function setHudSize(size) { floatingHudSize = size || null; }
    function getHudOwnerPopup() { return floatingHudOwnerPopup; }
    function isHudOpen() { return Boolean(floatingHudElement && root.document?.body?.contains(floatingHudElement)); }
    function resetLayoutState() { floatingHudPosition = null; floatingHudSize = null; }

    async function acceptMatch(match, container, sceneId, ctx, popup) {
        if (!dependencies) throw new Error('[FastTag] Scraper controller is not configured');
        const {
            log: ftLog,
            readScrapeFieldSelection,
            resolveScrapedStudioResult,
            resolveScrapedEntityIdsResult,
            fetchGQL,
            buildAcceptedSceneStashIds,
            buildScrapeUpdateInput,
            sceneCardUpdateFields: SCENE_CARD_UPDATE_FIELDS,
            syncSceneToApolloCache,
            setLiveEverythingPopupTitle,
            refreshSceneCards,
            recordSaveUsage,
            deleteSessionCache,
            toastError,
            toastSuccess
        } = dependencies;
        try {
            ftLog('ACTION', 'SCRAPE', `Accept match clicked for scene ${sceneId}: "${match.title || ''}"`, {
                sceneId,
                title: match.title,
                studio: match.studio?.name,
                performersCount: match.performers?.length,
                tagsCount: match.tags?.length,
                date: match.date
            });

            const scrapeSelection = readScrapeFieldSelection(container);

            // 1–3. Resolve studio, performers and tags against stored IDs and the local library.
            const studioResolution = await resolveScrapedStudioResult(match.studio, scrapeSelection.studio);
            const performerResolution = await resolveScrapedEntityIdsResult(
                'performers',
                match.performers,
                scrapeSelection.performerIndices,
                { endpoint: match._sourceEndpoint, name: match._sourceName }
            );
            const tagResolution = await resolveScrapedEntityIdsResult('tags', match.tags, scrapeSelection.tagIndices);
            const studioIdToSet = studioResolution.id;
            const performerIdsToAdd = performerResolution.ids;
            const tagIdsToAdd = tagResolution.ids;
            const resolutionFailures = [
                ...studioResolution.failures.map(name => `studio “${name}”`),
                ...performerResolution.failures.map(name => `performer “${name}”`),
                ...tagResolution.failures.map(name => `tag “${name}”`)
            ];
            const scraperSourceName = String(match?._sourceName || 'scraper source');
            const scraperIdLabel = `${scraperSourceName} ID`;

            // 4. Update Scene & Synchronize Context
            const effectiveCtx = ctx || popup?._context || dependencies.getActivePopup?.()?._context;
            const isEverythingModal = popup?.element?.getAttribute('data-popup-type') === 'everything' || popup?.element?.getAttribute('data-popup-type') === 'bulk-everything' || dependencies.getActivePopup?.()?.type === 'everything' || Boolean(effectiveCtx);

            if (isEverythingModal && effectiveCtx) {
                // Save scraper fields DIRECTLY. Do not route Accept through the general doSave()
                // mutation because that also includes unrelated fields (for example groups) and can
                // cause the whole GraphQL mutation to fail on Stash versions with a different schema.
                // Cover image is deliberately saved in a SECOND mutation so an image-specific error
                // cannot prevent title/studio/performers/date/details/tags from being saved.

                const sceneRes = await fetchGQL(`
                    query FastTagAcceptCurrentScene($id: ID!) {
                        findScene(id: $id) {
                            id
                            performers { id }
                            tags { id }
                            studio { id }
                            stash_ids { endpoint stash_id }
                        }
                    }
                `, { id: sceneId });

                if (sceneRes?.errors?.length) {
                    throw new Error(sceneRes.errors.map(e => e.message).join('; '));
                }

                const existingPerformerIds = (sceneRes?.data?.findScene?.performers || []).map(p => String(p.id));
                const existingTagIds = (sceneRes?.data?.findScene?.tags || []).map(t => String(t.id));
                let stashIdResolution = { stashIds: sceneRes?.data?.findScene?.stash_ids || [], added: false, reason: null };
                try {
                    const configRes = await fetchGQL(`query FastTagStashBoxes { configuration { general { stashBoxes { endpoint name } } } }`);
                    stashIdResolution = buildAcceptedSceneStashIds(
                        sceneRes?.data?.findScene?.stash_ids,
                        match,
                        configRes?.data?.configuration?.general?.stashBoxes
                    );
                } catch (error) {
                    if (match?.remote_site_id || match?.urls?.some?.(url => /^https?:\/\//i.test(url))) {
                        stashIdResolution.reason = 'the configured scraper endpoint could not be loaded';
                    }
                }
                if (stashIdResolution.reason) resolutionFailures.push(`${scraperIdLabel} (${stashIdResolution.reason})`);
                const { updateInput, mergedPerformerIds, mergedTagIds } = buildScrapeUpdateInput({
                    sceneId,
                    match,
                    selection: scrapeSelection,
                    studioIdToSet,
                    performerIdsToAdd,
                    tagIdsToAdd,
                    existingPerformerIds,
                    existingTagIds
                });

                const saveRes = await fetchGQL(`
                    mutation FastTagAcceptSave($input: SceneUpdateInput!) {
                        sceneUpdate(input: $input) {
                            ${SCENE_CARD_UPDATE_FIELDS}
                            title
                            date
                        }
                    }
                `, { input: updateInput });

                if (saveRes?.errors?.length || !saveRes?.data?.sceneUpdate?.id) {
                    const msg = saveRes?.errors?.map(e => e.message).join('; ') || 'Stash did not return a saved scene.';
                    throw new Error(msg);
                }

                syncSceneToApolloCache(saveRes.data.sceneUpdate);
                if (scrapeSelection.title && match.title) {
                    setLiveEverythingPopupTitle(popup, match.title);
                }

                // Save and verify the StashDB ID independently. Keeping this separate from the
                // metadata mutation makes any endpoint/ID problem visible without rolling back
                // title, studio, performer, tag, date or details changes that already succeeded.
                if (stashIdResolution.added) {
                    const expectedStashId = stashIdResolution.stashIds[stashIdResolution.stashIds.length - 1];
                    const stashIdSaveRes = await fetchGQL(`
                        mutation FastTagAcceptStashId($input: SceneUpdateInput!) {
                            sceneUpdate(input: $input) {
                                id
                                stash_ids { endpoint stash_id }
                            }
                        }
                    `, { input: { id: sceneId, stash_ids: stashIdResolution.stashIds } });
                    const returnedStashIds = stashIdSaveRes?.data?.sceneUpdate?.stash_ids || [];
                    const expectedEndpoint = String(expectedStashId.endpoint).replace(/\/+$/, '').toLowerCase();
                    const idWasSaved = returnedStashIds.some(item =>
                        String(item?.endpoint || '').replace(/\/+$/, '').toLowerCase() === expectedEndpoint
                        && String(item?.stash_id || '') === String(expectedStashId.stash_id)
                    );
                    if (stashIdSaveRes?.errors?.length || !idWasSaved) {
                        const reason = stashIdSaveRes?.errors?.map(error => error.message).join('; ')
                            || 'Stash did not return the accepted ID after saving';
                        resolutionFailures.push(`${scraperIdLabel} (${reason})`);
                    }
                }

                // Save cover separately. If Stash rejects the image value, all other metadata is
                // already safely committed and the user gets a warning rather than losing everything.
                let coverSaved = true;
                if (scrapeSelection.cover && match.image) {
                    const coverRes = await fetchGQL(`
                        mutation FastTagAcceptCover($input: SceneUpdateInput!) {
                            sceneUpdate(input: $input) { id }
                        }
                    `, { input: { id: sceneId, cover_image: match.image } });
                    if (coverRes?.errors?.length || !coverRes?.data?.sceneUpdate?.id) {
                        coverSaved = false;
                        console.warn('[FastTag] Cover image save failed:', coverRes?.errors || coverRes);
                    }
                }

                // Keep the Edit Everything popup state in sync with what was actually saved.
                if (typeof effectiveCtx.setSelectedStudio === 'function' && studioIdToSet) {
                    effectiveCtx.setSelectedStudio(studioIdToSet);
                }
                if (typeof effectiveCtx.setSelectedPerformers === 'function') {
                    effectiveCtx.setSelectedPerformers(new Set(mergedPerformerIds));
                }
                if (typeof effectiveCtx.setSelectedTags === 'function') {
                    effectiveCtx.setSelectedTags(new Set(mergedTagIds));
                }
                if (typeof effectiveCtx.setInitialStudio === 'function' && studioIdToSet) {
                    effectiveCtx.setInitialStudio(studioIdToSet);
                }
                if (typeof effectiveCtx.setInitialPerformers === 'function') {
                    effectiveCtx.setInitialPerformers(new Set(mergedPerformerIds));
                }
                if (typeof effectiveCtx.setInitialTags === 'function') {
                    effectiveCtx.setInitialTags(new Set(mergedTagIds));
                }

                if (typeof effectiveCtx.fetchColumnData === 'function' && popup) {
                    if (popup.tagsTable) await effectiveCtx.fetchColumnData('tags', popup.tagsTable, '', new Set(mergedTagIds));
                    if (popup.performersTable) await effectiveCtx.fetchColumnData('performers', popup.performersTable, '', new Set(mergedPerformerIds));
                }
                if (typeof effectiveCtx.renderStudioBar === 'function') await effectiveCtx.renderStudioBar('');
                if (typeof effectiveCtx.refreshAllUI === 'function') effectiveCtx.refreshAllUI();

                await refreshSceneCards(sceneId);
                recordSaveUsage();
                deleteSessionCache(sceneId);

                root._fastTagEverythingScraperOpen = true;
                const acceptBtn = container ? container.querySelector('#fasttag-scrape-accept-btn') : null;
                if (acceptBtn) {
                    acceptBtn.innerHTML = resolutionFailures.length > 0
                        ? '<span>⚠ Saved with warnings</span>'
                        : (coverSaved ? '<span>✓ Saved</span>' : '<span>✓ Saved (cover failed)</span>');
                    acceptBtn.disabled = true;
                    acceptBtn.style.opacity = '0.7';
                    acceptBtn.style.cursor = 'default';
                    acceptBtn.style.background = '#059669';
                }

                if (resolutionFailures.length > 0) {
                    const coverNote = coverSaved ? '' : ' The cover also failed to save.';
                    toastError(`Metadata saved, but FastTag could not apply: ${resolutionFailures.join(', ')}.${coverNote}`);
                } else if (coverSaved) {
                    toastSuccess(`Matched & Saved from ${scraperSourceName}!`);
                } else {
                    toastError('Metadata saved, but Stash rejected the cover image.');
                }
                return;
            } else {
                throw new Error('Scraping is only supported from Edit Everything.');
            }
        } catch (err) {
            console.error('[FastTag] Error accepting scrape match:', err);
            toastError('Failed to apply match: ' + (err?.message || err));
        }
    }


    root.FastTag = root.FastTag || {};
    root.FastTag.scraperController = Object.freeze({
        configure,
        isPopupActive,
        beginRequest,
        invalidateRequests,
        isRequestCurrent,
        watchHudOwner,
        closeHud,
        getInitialPopoutPosition,
        attachResizeHandles,
        getHudElement,
        setHudElement,
        getHudPosition,
        setHudPosition,
        getHudSize,
        setHudSize,
        getHudOwnerPopup,
        isHudOpen,
        resetLayoutState,
        acceptMatch
    });
}(typeof window !== 'undefined' ? window : globalThis));
