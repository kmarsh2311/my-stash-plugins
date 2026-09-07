(function initializeFastTagScraperController(root) {
    'use strict';

    let dependencies = null;
    let floatingHudElement = null;
    let floatingHudPosition = null;
    let floatingHudSize = null;
    let floatingHudOwnerPopup = null;
    let floatingHudOwnerObserver = null;
    const sessionCache = new Map();

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

    function showLoadingState(popup, message = 'Scraping new scene…') {
        if (!isPopupActive(popup)) return false;
        const detachedHud = isHudOpen() ? getHudElement() : null;
        const targetContainer = detachedHud || popup?.scraperCardContainer;
        if (!targetContainer) return false;

        const isDark = dependencies?.getEffectiveTheme?.() !== 'light';
        targetContainer.style.display = 'flex';
        targetContainer.innerHTML = `
            <div data-fasttag-scrape-loading="true" style="box-sizing: border-box; width: 100%; min-height: 150px; flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px; background: ${isDark ? '#1e293b' : '#ffffff'}; color: ${isDark ? '#cbd5e1' : '#475569'};">
                <span style="font-size: 12px; font-weight: 650;">⏳ ${message}</span>
            </div>
        `;
        if (popup?.scrapeBtn) {
            popup.scrapeBtn.disabled = true;
            popup.scrapeBtn.innerHTML = '<span>⏳ Scraping...</span>';
        }
        return true;
    }

    function createTrigger(options) {
        if (!dependencies) throw new Error('[FastTag] Scraper controller is not configured');
        const {
            popup,
            mode = 'everything',
            getSceneId,
            getCardElement,
            getContext = () => null,
            focusAfter = () => {}
        } = options || {};
        if (!popup || typeof getSceneId !== 'function') {
            throw new Error('[FastTag] Scraper trigger requires a popup and scene resolver');
        }

        return async (forceOpen = false, targetSceneId = null, targetCardElement = null) => {
            const activeSceneId = targetSceneId || getSceneId();
            const activeCardElement = targetCardElement || getCardElement?.() || null;
            const scrapeRequestId = beginRequest(popup, activeSceneId);
            if (scrapeRequestId == null) return null;

            const isScraperOpen = Boolean(
                popup.scraperCardContainer
                && popup.scraperCardContainer.style.display !== 'none'
                && popup.scraperCardContainer.innerHTML.trim() !== ''
            ) || isHudOpen();
            if (isScraperOpen && !forceOpen) {
                if (mode === 'everything') {
                    root._fastTagEverythingScraperOpen = false;
                    dependencies.setScraperHudPersistedOpen(false);
                    dependencies.log('ACTION', 'SCRAPER', 'Scraper HUD closed by user');
                }
                if (popup.scraperCardContainer) {
                    popup.scraperCardContainer.style.display = 'none';
                    popup.scraperCardContainer.innerHTML = '';
                }
                closeHud();
                popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                popup.scrapeBtn.innerHTML = dependencies.isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                popup.scrapeBtn.title = 'Scrape scene metadata';
                if (mode === 'everything' && popup.refreshBtn) popup.refreshBtn.title = 'Refresh all caches';
                dependencies.hideScrapeCoverTooltip();
                return;
            }

            if (mode === 'everything') {
                root._fastTagEverythingScraperOpen = true;
                dependencies.setScraperHudPersistedOpen(true);
                if (popup.refreshBtn) popup.refreshBtn.title = 'Search again using current scene metadata';
                dependencies.log('ACTION', 'SCRAPER', 'Scraper HUD opened');
            }

            if (sessionCache.has(activeSceneId) && sessionCache.get(activeSceneId)?.length > 0) {
                const cached = sessionCache.get(activeSceneId);
                cached._fromCache = true;
                renderMatches(
                    popup.scraperCardContainer,
                    cached,
                    activeSceneId,
                    getContext(),
                    popup,
                    focusAfter,
                    '',
                    scrapeRequestId
                );
                return;
            }

            const originalHtml = dependencies.isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
            popup.scrapeBtn.disabled = true;
            popup.scrapeBtn.innerHTML = '<span>⏳ Scraping...</span>';

            try {
                const matches = await dependencies.fetchScraperMatchesForScene(activeSceneId, activeCardElement);
                if (!isRequestCurrent(popup, activeSceneId, scrapeRequestId)) return null;
                if (!matches || matches.length === 0) {
                    if (mode !== 'everything') popup.scrapeBtn.innerHTML = '<span>✕ No Matches</span>';
                    dependencies.toastError('No scraper matches found on configured scrapers');
                    if (mode === 'everything') {
                        const firstPath = popup.sceneData?.files?.[0]?.path || '';
                        const pathParts = firstPath.split(/[/\\]/);
                        const initialSearch = pathParts[pathParts.length - 1] || popup.sceneData?.title || '';
                        await renderMatches(
                            popup.scraperCardContainer,
                            [],
                            activeSceneId,
                            getContext(),
                            popup,
                            focusAfter,
                            initialSearch,
                            scrapeRequestId
                        );
                        return true;
                    }
                    root.setTimeout(() => {
                        if (!isRequestCurrent(popup, activeSceneId, scrapeRequestId)) return;
                        popup.scrapeBtn.disabled = false;
                        popup.scrapeBtn.innerHTML = originalHtml;
                    }, 2500);
                    return;
                }

                sessionCache.set(activeSceneId, matches);
                popup.scrapeBtn.disabled = false;
                renderMatches(
                    popup.scraperCardContainer,
                    matches,
                    activeSceneId,
                    getContext(),
                    popup,
                    focusAfter,
                    '',
                    scrapeRequestId
                );
                return mode === 'everything' ? true : undefined;
            } catch (error) {
                if (!isRequestCurrent(popup, activeSceneId, scrapeRequestId)) return null;
                popup.scrapeBtn.disabled = false;
                popup.scrapeBtn.innerHTML = originalHtml;
                dependencies.toastError('Scrape error: ' + (error?.message || error));
                return mode === 'everything' ? false : undefined;
            }
        };
    }

    async function renderMatches(container, incomingResults, sceneId, ctx, popup, onDismiss, emptySearchQuery = '', scrapeRequestId = null) {
        if (!dependencies) throw new Error('[FastTag] Scraper controller is not configured');
        const document = root.document;
        const {
            entityConfig: ENTITY_CONFIG,
            getScraperMatchingSettings,
            getHideObviousFalsePositives,
            partitionObviousFalsePositiveMatches,
            getDetachScraper,
            getEffectiveTheme,
            getCachedOrNull,
            fetchGQL,
            setCache,
            cleanTitleForScraping,
            isEasterEggActive,
            setScraperHudPersistedOpen,
            fetchScraperMatchesForScene,
            toastError,
            analyzeScraperMatch,
            getScraperResultUrl,
            getPerformerPresentation,
            getAssessmentPresentation,
            getSourcePresentation,
            getUnavailableContextPresentation,
            getAcceptPresentation,
            formatDurationSec,
            escapeHtml,
            setDetachScraper,
            hideScrapeCoverTooltip,
            showScrapeCoverTooltip,
            startScrapedPerformerHover,
            stopScrapedPerformerHover
        } = dependencies;
        if (!isRequestCurrent(popup, sceneId, scrapeRequestId)) {
            if (!isPopupActive(popup) && getHudOwnerPopup() === popup) closeHud();
            return;
        }
        const initialResultLimit = getScraperMatchingSettings().initialResultLimit;
        const allResults = Array.isArray(incomingResults) ? incomingResults : [];
        const filterFalsePositives = getHideObviousFalsePositives();
        const falsePositivePartition = partitionObviousFalsePositiveMatches(allResults);
        const showingHiddenResults = filterFalsePositives && allResults._fastTagShowHidden === true;
        const filteredResults = filterFalsePositives && !showingHiddenResults
            ? falsePositivePartition.visible
            : allResults;
        const showingAllResults = allResults._fastTagShowAllResults === true;
        const overflowResultCount = Math.max(0, filteredResults.length - initialResultLimit);
        const results = showingAllResults ? filteredResults : filteredResults.slice(0, initialResultLimit);
        const hiddenResultCount = falsePositivePartition.hidden.length;
        const hasResults = results.length > 0;
        const isDetached = getDetachScraper();
        let targetContainer = container;
        let floatingScraperHudElement = getHudElement();
        let floatingScraperHudPosition = getHudPosition();
        let floatingScraperHudSize = getHudSize();

        if (isDetached) {
            if (popup?.scraperCardContainer) {
                popup.scraperCardContainer.innerHTML = '';
                popup.scraperCardContainer.style.display = 'none';
            }
            if (!floatingScraperHudElement || !document.body.contains(floatingScraperHudElement)) {
                floatingScraperHudElement = document.createElement('div');
                setHudElement(floatingScraperHudElement);
                floatingScraperHudElement.id = 'fasttag-floating-scraper-hud';
                const defaultPos = getInitialPopoutPosition(390, 480);
                let finalWidth = defaultPos.width || '390px';
                let finalHeight = defaultPos.height || '480px';
                let finalLeft = defaultPos.left;
                let finalTop = defaultPos.top;
                let finalRight = defaultPos.right;

                let savedPos = floatingScraperHudPosition;
                if (!savedPos) {
                    try {
                        savedPos = JSON.parse(root.localStorage.getItem('fasttag_scraper_hud_pos') || 'null');
                    } catch (e) {}
                }
                let savedSize = floatingScraperHudSize;
                if (!savedSize) {
                    try {
                        savedSize = JSON.parse(root.localStorage.getItem('fasttag_scraper_hud_size') || 'null');
                    } catch (e) {}
                }

                if (savedPos && savedPos.left && savedPos.top) {
                    const pLeft = parseInt(savedPos.left, 10);
                    const pTop = parseInt(savedPos.top, 10);
                    const pW = savedSize?.width ? parseInt(savedSize.width, 10) : (parseInt(defaultPos.width, 10) || 390);
                    const pH = savedSize?.height ? parseInt(savedSize.height, 10) : (parseInt(defaultPos.height, 10) || 480);
                    if (!isNaN(pLeft) && !isNaN(pTop)) {
                        finalLeft = `${Math.max(8, Math.min(root.innerWidth - pW - 8, pLeft))}px`;
                        finalTop = `${Math.max(8, Math.min(root.innerHeight - pH - 8, pTop))}px`;
                        finalRight = null;
                        finalWidth = `${pW}px`;
                        finalHeight = `${pH}px`;
                        floatingScraperHudPosition = { left: finalLeft, top: finalTop };
                        setHudPosition(floatingScraperHudPosition);
                        if (savedSize) floatingScraperHudSize = savedSize;
                        if (savedSize) setHudSize(savedSize);
                    }
                }
                const isDarkTheme = getEffectiveTheme() === 'dark';
                floatingScraperHudElement.style.cssText = `position: fixed; top: ${finalTop}; ${finalLeft ? `left: ${finalLeft};` : `right: ${finalRight};`} width: ${finalWidth}; height: ${finalHeight}; min-width: 300px; min-height: 220px; max-width: 92vw; max-height: 92vh; z-index: 1000000; background: ${isDarkTheme ? '#1e293b' : '#ffffff'}; border: 1.5px solid ${isDarkTheme ? '#4338ca' : '#a5b4fc'}; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: visible; display: flex; flex-direction: column;`;
                document.body.appendChild(floatingScraperHudElement);

                const scraperResizeObserver = new root.ResizeObserver(() => {
                    if (floatingScraperHudElement && !floatingScraperHudElement._isDragging) {
                        floatingScraperHudSize = {
                            width: `${floatingScraperHudElement.offsetWidth}px`,
                            height: `${floatingScraperHudElement.offsetHeight}px`
                        };
                        setHudSize(floatingScraperHudSize);
                        try {
                            root.localStorage.setItem('fasttag_scraper_hud_size', JSON.stringify(floatingScraperHudSize));
                        } catch (e) {}
                    }
                });
                scraperResizeObserver.observe(floatingScraperHudElement);
            }
            targetContainer = floatingScraperHudElement;
            watchHudOwner(popup);
            targetContainer.style.display = 'flex';
        } else {
            closeHud();
            targetContainer = popup?.scraperCardContainer || container;
            if (targetContainer) {
                targetContainer.style.display = 'flex';
            }
        }
        if (!targetContainer) return;

        const popupEl = popup?.element || (targetContainer ? targetContainer.closest('#scenes-popup') : null);
        const restoreSingleSize = () => {};
        const restoreSingleWidth = restoreSingleSize;

        // Ensure caches for performers, studios, tags are available to detect new vs existing entities
        const typesToLoad = [];
        if (!getCachedOrNull('studios')) typesToLoad.push('studios');
        if (!getCachedOrNull('performers')) typesToLoad.push('performers');
        if (!getCachedOrNull('tags')) typesToLoad.push('tags');

        if (typesToLoad.length > 0) {
            await Promise.all(typesToLoad.map(async (type) => {
                try {
                    const res = await fetchGQL(ENTITY_CONFIG[type].fetchQuery);
                    const list = ENTITY_CONFIG[type].extractList(res.data);
                    setCache(type, list);
                } catch (e) {
                    console.log('[FastTag] Error pre-caching ' + type, e);
                }
            }));
        }

        // Cache loading and scraper requests can finish after the owning popup closes.
        // Do not let a stale continuation recreate or update a detached HUD.
        if (!isRequestCurrent(popup, sceneId, scrapeRequestId)) {
            if (!isPopupActive(popup) && getHudOwnerPopup() === popup) closeHud();
            return;
        }

        let currentIndex = 0;
        const isDark = getEffectiveTheme() === 'dark';

        if (!hasResults) {
            const initialQuery = cleanTitleForScraping(emptySearchQuery || '');
            targetContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 10px; padding: 12px; box-sizing: border-box; height: 100%; min-height: 150px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <strong style="font-size: 12px; color: ${isDark ? '#e2e8f0' : '#1e293b'};">⚡ Scraper Search</strong>
                        <button type="button" id="fasttag-scrape-empty-close" style="border: none; background: transparent; color: ${isDark ? '#94a3b8' : '#64748b'}; font-size: 15px; cursor: pointer;">✕</button>
                    </div>
                    <div style="padding: 8px; border-radius: 6px; background: ${isDark ? 'rgba(245,158,11,0.1)' : '#fffbeb'}; border: 1px solid ${isDark ? 'rgba(245,158,11,0.35)' : '#fcd34d'}; color: ${isDark ? '#fde68a' : '#92400e'}; font-size: 11px;">
                        No automatic matches were found. Edit the search words below and try again.
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <input id="fasttag-scrape-empty-query" type="text" value="${escapeHtml(initialQuery)}" placeholder="Enter title, studio or performer names" style="flex: 1; min-width: 0; height: 30px; box-sizing: border-box; padding: 4px 8px; border-radius: 6px; border: 1px solid ${isDark ? 'rgba(129,140,248,0.55)' : '#a5b4fc'}; background: ${isDark ? '#0f172a' : '#ffffff'}; color: ${isDark ? '#e2e8f0' : '#1e293b'}; font-size: 11px; outline: none;">
                        <button id="fasttag-scrape-empty-search" type="button" style="height: 30px; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(129,140,248,0.6); background: rgba(99,102,241,0.22); color: ${isDark ? '#c7d2fe' : '#4338ca'}; font-size: 10.5px; font-weight: 700; cursor: pointer;">Search</button>
                    </div>
                </div>
            `;

            const closeEmpty = () => {
                invalidateRequests(popup);
                root._fastTagEverythingScraperOpen = false;
                setScraperHudPersistedOpen(false);
                closeHud();
                if (container) {
                    container.innerHTML = '';
                    container.style.display = 'none';
                }
                if (popup?.scrapeBtn) {
                    popup.scrapeBtn.disabled = false;
                    popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                    popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>⚡ Scrape 🍫</span>' : '<span>⚡ Scrape</span>';
                }
                if (typeof onDismiss === 'function') onDismiss();
            };
            const runEmptySearch = async () => {
                const input = targetContainer.querySelector('#fasttag-scrape-empty-query');
                const button = targetContainer.querySelector('#fasttag-scrape-empty-search');
                const query = (input?.value || '').trim();
                if (!query) {
                    toastError('Enter the words you want to search for.');
                    input?.focus();
                    return;
                }
                const manualRequestId = beginRequest(popup, sceneId);
                if (manualRequestId == null) return;
                button.disabled = true;
                button.textContent = 'Searching…';
                try {
                    const manualResults = await fetchScraperMatchesForScene(sceneId, null, query);
                    if (!isRequestCurrent(popup, sceneId, manualRequestId)) return;
                    if (!manualResults?.length) {
                        toastError(`No scraper matches found for “${query}”`);
                        button.disabled = false;
                        button.textContent = 'Search';
                        input?.focus();
                        return;
                    }
                    sessionCache.set(sceneId, manualResults);
                    await renderMatches(container, manualResults, sceneId, ctx, popup, onDismiss, '', manualRequestId);
                } catch (error) {
                    if (!isRequestCurrent(popup, sceneId, manualRequestId)) return;
                    button.disabled = false;
                    button.textContent = 'Search';
                    toastError('Scrape search failed: ' + (error?.message || error));
                }
            };

            targetContainer.querySelector('#fasttag-scrape-empty-close')?.addEventListener('click', closeEmpty);
            const emptySearchInput = targetContainer.querySelector('#fasttag-scrape-empty-query');
            emptySearchInput?.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                event.stopPropagation();
                runEmptySearch();
            });
            targetContainer.querySelector('#fasttag-scrape-empty-search')?.addEventListener('click', runEmptySearch);
            if (popup?.scrapeBtn) {
                popup.scrapeBtn.disabled = false;
                popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>▲ Hide 🍫</span>' : '<span>▲ Hide</span>';
                if (isDetached) popup.scrapeBtn.classList.add('fasttag-dock-pulse');
            }
            if (isDetached && floatingScraperHudElement) attachResizeHandles(floatingScraperHudElement);
            setTimeout(() => emptySearchInput?.focus({ preventScroll: true }), 0);
            return;
        }

        const updateCardView = () => {
            const match = results[currentIndex];
            if (!match) return;

            const studioName = match.studio?.name || '';
            const performers = match.performers || [];
            const tags = match.tags || [];
            const urls = match.urls || [];

            const cachedStudios = getCachedOrNull('studios') || [];
            const cachedPerformers = getCachedOrNull('performers') || [];
            const cachedTags = getCachedOrNull('tags') || [];

            const isStudioNew = studioName ? !(match.studio?.stored_id || cachedStudios.some(s => (s.name || '').trim().toLowerCase() === studioName.trim().toLowerCase())) : false;

            const remoteResultUrl = getScraperResultUrl(match);

            // Calculate match likelihood & fingerprint verification (mirroring Stash's native scraper)
            const {
                isHashMatch,
                matchBadges,
                localDurSec,
                scrapedDurSec,
                totalFps,
                matchingDurFps
            } = analyzeScraperMatch(match);

            const performerPresentation = getPerformerPresentation(match);
            let performerMatchBadge = '';
            if (performerPresentation) {
                const overlapNames = performerPresentation.overlapNames;
                if (overlapNames.length > 0) {
                    performerMatchBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Matches performer already linked to this scene: ${escapeHtml(overlapNames.join(', '))}">
                            <span>★</span><span>Performer Match (${performerPresentation.overlapCount}/${performerPresentation.linkedCount})</span>
                        </span>
                    `;
                } else if (performerPresentation.performerSetConflict) {
                    performerMatchBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="The returned performer set is completely different from the performers linked to this scene.">
                            <span>⚠</span><span>Performer Set Conflict</span>
                        </span>
                    `;
                } else if (performerPresentation.hasWeakOverlap) {
                    performerMatchBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="A returned single-word name could be an alias of ${escapeHtml(performerPresentation.weakOverlapNames.join(', '))}, but it is too ambiguous to confirm a performer match.">
                            <span>?</span><span>Possible Alias Match</span>
                        </span>
                    `;
                } else {
                    performerMatchBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="None of this result's performers match the ${performerPresentation.linkedCount} performer(s) already linked to your scene. Check the result carefully before accepting it.">
                            <span>⚠</span><span>No Linked Performer Match</span>
                        </span>
                    `;
                }
            }

            const assessment = getAssessmentPresentation(match);
            const assessmentBadge = assessment ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 700; color: ${assessment.color}; background: ${assessment.background}; border: 1px solid ${assessment.border}; padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="${escapeHtml(assessment.tooltip)}">
                    <span>${assessment.icon}</span><span>${assessment.label}</span>
                </span>
            ` : '';

            const sourcePresentation = getSourcePresentation(match, isHashMatch);
            const sourceTone = sourcePresentation?.tone === 'success'
                ? { color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.35)', icon: '✓' }
                : sourcePresentation?.tone === 'warning'
                    ? { color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', icon: '⌕' }
                    : { color: isDark ? '#cbd5e1' : '#475569', background: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', icon: '↗' };
            const sourceBadge = sourcePresentation ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: ${sourceTone.color}; background: ${sourceTone.background}; border: 1px solid ${sourceTone.border}; padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="${escapeHtml(sourcePresentation.tooltip)}">
                    <span>${sourceTone.icon}</span><span>${escapeHtml(sourcePresentation.label)}</span>
                </span>
            ` : '';

            const unavailableContext = getUnavailableContextPresentation(match);
            const unavailableContextBadge = unavailableContext ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 500; color: ${isDark ? '#94a3b8' : '#64748b'}; background: rgba(148, 163, 184, 0.1); border: 1px dashed rgba(148, 163, 184, 0.4); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="${escapeHtml(unavailableContext.tooltip)}">
                    <span>ⓘ</span><span>${escapeHtml(unavailableContext.label)}</span>
                </span>
            ` : '';

            const studioMismatchBadge = match._studioComparison === 'mismatch' ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="The scraped studio (${escapeHtml(studioName)}) differs from the studio already linked to this scene.">
                    <span>⚠</span><span>Studio Mismatch</span>
                </span>
            ` : '';
            const additionalPerformerBadge = performerPresentation?.additionalCount > 0 ? `
                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #fbbf24; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="The scraped result contains additional performer(s) not currently linked to this scene: ${escapeHtml(performerPresentation.additionalNames.join(', '))}">
                    <span>＋</span><span>${performerPresentation.additionalCount} Additional Performer${performerPresentation.additionalCount === 1 ? '' : 's'}</span>
                </span>
            ` : '';
            const acceptPresentation = getAcceptPresentation(match);

            let durationBadge = '';
            if (scrapedDurSec && localDurSec) {
                const diff = Math.abs(scrapedDurSec - localDurSec);
                if (diff <= 3) {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Duration matches within 3 seconds (${formatDurationSec(scrapedDurSec)})">
                            <span>⏱</span><span>${formatDurationSec(scrapedDurSec)} (Exact Match)</span>
                        </span>
                    `;
                } else if (diff <= 60) {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 500; color: ${isDark ? '#cbd5e1' : '#475569'}; background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.25); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Scraped duration is ${formatDurationSec(scrapedDurSec)}, local is ${formatDurationSec(localDurSec)}">
                            <span>⏱</span><span>${formatDurationSec(scrapedDurSec)} (Local: ${formatDurationSec(localDurSec)})</span>
                        </span>
                    `;
                } else {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #f87171; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Scraped duration is ${formatDurationSec(scrapedDurSec)}, local is ${formatDurationSec(localDurSec)}; the difference is ${formatDurationSec(diff)}.">
                            <span>⚠</span><span>Duration Mismatch (${formatDurationSec(diff)})</span>
                        </span>
                    `;
                }
            } else if (localDurSec) {
                if (matchingDurFps > 0) {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="${matchingDurFps} of ${totalFps} StashDB submissions match your duration (${formatDurationSec(localDurSec)})">
                            <span>⏱</span><span>${formatDurationSec(localDurSec)} (${matchingDurFps}/${totalFps} Match)</span>
                        </span>
                    `;
                } else {
                    durationBadge = `
                        <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 500; color: ${isDark ? '#94a3b8' : '#64748b'}; background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.25); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;">
                            <span>⏱</span><span>${formatDurationSec(localDurSec)}</span>
                        </span>
                    `;
                }
            }

            let savedEmbeddedH = 220;
            try {
                const h = parseInt(root.localStorage.getItem('fasttag_embedded_scraper_h'), 10);
                if (!isNaN(h) && h >= 50 && h <= 520) savedEmbeddedH = h;
            } catch (e) {}

            targetContainer.style.display = isDetached ? 'flex' : 'flex';
            targetContainer.innerHTML = `
                <div style="background: ${isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc'}; border: ${isDetached ? 'none' : (isDark ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid #818cf8')}; border-radius: 8px; box-shadow: ${isDetached ? 'none' : '0 10px 25px rgba(0,0,0,0.5)'}, inset 0 0 0 1px rgba(255,255,255,0.06); padding: 9px 12px 6px 12px; box-sizing: border-box; display: flex; flex-direction: column; gap: 7px; ${isDetached ? 'height: 100%; min-height: 0; flex: 1 1 auto;' : 'height: auto;'} font-family: system-ui, -apple-system, sans-serif; transition: all 0.2s ease;">
                    <!-- Top Navigation & Link Header -->
                    <div id="fasttag-scrape-header" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 4px 6px; flex-wrap: nowrap; user-select: none; white-space: nowrap; overflow: visible; min-height: 26px; padding: 1px 0;">
                        <div id="fasttag-scrape-header-primary" style="display: flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; color: ${isDark ? '#e0e7ff' : '#312e81'}; min-width: 0; flex: 1 1 150px; overflow: hidden;">
                            <span style="font-size: 13px; line-height: 1; flex-shrink: 0;">⚡</span>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 0 48px; width: 48px;" title="${escapeHtml(match._sourceName || 'StashDB')} Match">${escapeHtml(match._sourceName || 'StashDB')} Match</span>
                            ${results.length > 1 ? `
                                <div class="fasttag-match-counter-pulse" style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 92px; box-sizing: border-box; font-size: 11px; font-weight: 700; color: ${isDark ? '#e0e7ff' : '#312e81'}; background: ${isDark ? 'rgba(99, 102, 241, 0.25)' : 'rgba(99, 102, 241, 0.12)'}; border: 1px solid ${isDark ? 'rgba(129, 140, 248, 0.75)' : '#818cf8'}; padding: 2px 5px; border-radius: 5px; margin-left: 2px; user-select: none; flex: 0 0 92px; white-space: nowrap; line-height: 1;">
                                    <button type="button" id="fasttag-scrape-prev" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(148,163,184,0.4); border-radius: 3px; cursor: pointer; color: inherit; padding: 1px 5px; font-size: 9.5px; line-height: 1; transition: all 0.15s ease;" ${currentIndex === 0 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} title="Previous match (Left Arrow)">◀</button>
                                    <span style="min-width: 29px; text-align: center; font-variant-numeric: tabular-nums; letter-spacing: 0.2px; font-size: 11px; font-weight: 700; white-space: nowrap;">${currentIndex + 1}/${results.length}</span>
                                    <button type="button" id="fasttag-scrape-next" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(148,163,184,0.4); border-radius: 3px; cursor: pointer; color: inherit; padding: 1px 5px; font-size: 9.5px; line-height: 1; transition: all 0.15s ease;" ${currentIndex === results.length - 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} title="Next match (Right Arrow)">▶</button>
                                </div>
                            ` : ''}
                        </div>
                        <div id="fasttag-scrape-header-actions" style="display: flex; align-items: center; gap: 4px; flex-shrink: 0; max-width: 100%; margin-left: auto; white-space: nowrap;">
                            ${remoteResultUrl ? `
                                <a href="${remoteResultUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 2px; font-size: 10px; font-weight: 600; color: #818cf8; text-decoration: none; padding: 2.5px 6px; border-radius: 4px; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); transition: background 0.15s ease; white-space: nowrap; line-height: 1;" title="Open in ${escapeHtml(match._sourceName || 'source')} in new tab">
                                    <span>🔗</span><span>↗</span>
                                </a>
                            ` : ''}
                            <button type="button" id="fasttag-scrape-popout-toggle" style="background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 4px; padding: 2.5px 6px; font-size: 10px; font-weight: 700; color: #818cf8; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 3px; line-height: 1; transition: all 0.15s ease; white-space: nowrap;" data-micro-tooltip="${isDetached ? 'Dock scraper inside popup' : 'Pop out scraper into floating window'}">
                                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; pointer-events: none;">
                                    <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" fill="none" stroke-width="2"></rect>
                                    <rect x="12" y="11" width="8" height="7" rx="1.5" fill="currentColor" stroke="none"></rect>
                                </svg>
                                <span>${isDetached ? 'Dock' : 'Pop Out'}</span>
                            </button>
                            <button type="button" id="fasttag-scrape-accept-btn" style="background: ${acceptPresentation.background}; border: 1px solid ${acceptPresentation.border}; color: #ffffff; padding: 2.5px 7px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight: 700; display: inline-flex; align-items: center; gap: 2px; box-shadow: 0 1px 4px ${acceptPresentation.shadow}; line-height: 1.2; transition: all 0.15s ease; white-space: nowrap; flex-shrink: 0;" title="${acceptPresentation.title}">
                                <span>${acceptPresentation.label}</span>
                            </button>
                        </div>
                    </div>

                    <div id="fasttag-scrape-manual-search-form" style="display: flex; align-items: center; gap: 5px;">
                        <input id="fasttag-scrape-manual-query" type="text" value="${escapeHtml(match._searchQuery || '')}" placeholder="Optional: correct the search words" style="flex: 1; min-width: 0; height: 25px; box-sizing: border-box; padding: 3px 7px; border-radius: 5px; border: 1px solid ${isDark ? 'rgba(129,140,248,0.45)' : '#a5b4fc'}; background: ${isDark ? 'rgba(15,23,42,0.8)' : '#ffffff'}; color: ${isDark ? '#e2e8f0' : '#1e293b'}; font-size: 10.5px; outline: none;">
                        <button id="fasttag-scrape-manual-search-btn" type="button" style="height: 25px; padding: 3px 8px; border-radius: 5px; border: 1px solid rgba(129,140,248,0.55); background: rgba(99,102,241,0.18); color: ${isDark ? '#c7d2fe' : '#4338ca'}; font-size: 10px; font-weight: 700; cursor: pointer; white-space: nowrap;">Search</button>
                    </div>

                    ${filterFalsePositives && hiddenResultCount > 0 ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 6px; border-radius: 5px; background: rgba(245,158,11,0.09); border: 1px solid rgba(245,158,11,0.25); color: ${isDark ? '#fcd34d' : '#92400e'}; font-size: 9.5px; line-height: 1.25;">
                            <span>${hiddenResultCount} obvious false positive${hiddenResultCount === 1 ? '' : 's'} ${showingHiddenResults ? 'shown' : 'hidden'}</span>
                            <button id="fasttag-scrape-toggle-hidden" type="button" style="border: 1px solid rgba(245,158,11,0.45); border-radius: 4px; background: rgba(245,158,11,0.12); color: inherit; padding: 2px 6px; font-size: 9.5px; font-weight: 700; cursor: pointer; white-space: nowrap;">${showingHiddenResults ? 'Hide again' : 'Show hidden'}</button>
                        </div>
                    ` : ''}

                    ${overflowResultCount > 0 ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 6px; border-radius: 5px; background: rgba(99,102,241,0.09); border: 1px solid rgba(129,140,248,0.25); color: ${isDark ? '#c7d2fe' : '#3730a3'}; font-size: 9.5px; line-height: 1.25;">
                            <span>${overflowResultCount} lower-ranked result${overflowResultCount === 1 ? '' : 's'} ${showingAllResults ? 'shown' : 'not shown initially'}</span>
                            <button id="fasttag-scrape-toggle-overflow" type="button" style="border: 1px solid rgba(129,140,248,0.45); border-radius: 4px; background: rgba(99,102,241,0.12); color: inherit; padding: 2px 6px; font-size: 9.5px; font-weight: 700; cursor: pointer; white-space: nowrap;">${showingAllResults ? 'Show top 25' : 'Show all'}</button>
                        </div>
                    ` : ''}

                    <div id="fasttag-scrape-body-wrapper" style="display: flex; flex-direction: column; gap: 7px; ${isDetached ? 'flex: 1 1 auto; min-height: 0; overflow: hidden;' : 'height: auto;'} transition: all 0.15s ease;">
                        <!-- Dedicated Verification Badges Row -->
                        <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap; padding: 3px 6px; background: ${isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.03)'}; border-radius: 5px; border: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}; flex-shrink: 0;">
                            ${assessmentBadge}
                            ${sourceBadge}
                            ${isHashMatch ? matchBadges.map(b => `
                                <span style="display: inline-flex; align-items: center; gap: 3px; font-size: 9.5px; font-weight: 600; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); padding: 1px 5px; border-radius: 4px; cursor: help; user-select: none;" data-micro-tooltip="Direct file fingerprint match on StashDB">
                                    <span>✓</span><span>${b}</span>
                                </span>
                            `).join('') : ''}
                            ${unavailableContextBadge}
                            ${performerMatchBadge}
                            ${additionalPerformerBadge}
                            ${studioMismatchBadge}
                            ${durationBadge}
                            <button type="button" id="fasttag-scrape-dismiss-match" style="margin-left: auto; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(248, 113, 113, 0.32); border-radius: 4px; padding: 2px 6px; font-size: 9.5px; font-weight: 700; color: #f87171; cursor: pointer; line-height: 1.2; white-space: nowrap;" title="Remove this result from the current FastTag session">✕ Dismiss</button>
                        </div>

                    <!-- Items Preview Box with Relative Wrapper for Scroll Indicator -->
                    <div style="position: relative; border-radius: 6px; overflow: hidden; ${isDetached ? 'flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;' : 'height: auto;'}">
                        <div id="fasttag-scrape-items-preview" style="display: flex; flex-direction: column; gap: 7px; background: ${isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)'}; padding: 7px 9px 10px 9px; border-radius: 6px; font-size: 11px; box-sizing: border-box; overflow-y: auto; overflow-x: hidden; ${isDetached ? 'flex: 1 1 auto; min-height: 80px; max-height: none;' : `height: ${savedEmbeddedH}px; min-height: 50px; max-height: 520px;`} scrollbar-width: thin; scrollbar-color: ${isDark ? 'rgba(129, 140, 248, 0.65) rgba(0,0,0,0.25)' : '#a5b4fc #f1f5f9'}; transition: opacity 0.1s ease;">
                            ${isDetached ? `
                                <!-- Detached Hero Cover Banner (On its own dedicated line) -->
                                ${match.image ? `
                                    <div class="fasttag-scrape-cover-thumb" style="width: 100%; max-height: clamp(160px, 35vh, 320px); aspect-ratio: 16/9; border-radius: 6px; overflow: hidden; background: #000; border: 1px solid ${isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1'}; display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: all 0.15s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.3); flex-shrink: 0;" title="Hover to view full-size cover">
                                        <img src="${match.image}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" />
                                        <label style="position: absolute; left: 7px; bottom: 7px; z-index: 2; display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: 4px; background: rgba(15, 23, 42, 0.88); color: #e0e7ff; font-size: 10px; font-weight: 700; cursor: pointer; user-select: none;" title="Include this cover image when accepting the match">
                                            <input type="checkbox" id="fasttag-scrape-chk-cover" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #6366f1; margin: 0;">
                                            <span>🖼️ Cover</span>
                                        </label>
                                    </div>
                                ` : ''}

                                <!-- Title & Studio (Clean stacked rows directly below hero cover) -->
                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                    <!-- Title Row -->
                                    <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                        <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 55px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#e0e7ff' : '#312e81'}; font-size: 11px;" title="Check to update scene title">
                                            <input type="checkbox" id="fasttag-scrape-chk-title" style="cursor: pointer; width: 12px; height: 12px; accent-color: #6366f1; margin: 0; position: relative; top: 1.5px;">
                                            <span style="font-size: 11px;">✏️</span>
                                            <span>Title:</span>
                                        </label>
                                        <span style="display: inline-block; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="${escapeHtml(match.title || '')}">${escapeHtml(match.title || 'Untitled Match')}</span>
                                        ${match.date ? `
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; font-size: 10.5px; color: ${isDark ? '#94a3b8' : '#64748b'}; font-weight: 500; cursor: pointer; user-select: none;" title="Include this date when accepting the match">
                                                <input type="checkbox" id="fasttag-scrape-chk-date" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #0ea5e9; margin: 0; position: relative; top: 1px;">
                                                <span>📅 ${escapeHtml(match.date)}</span>
                                            </label>
                                        ` : ''}
                                    </div>

                                    ${studioName ? `
                                        <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 55px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#a5b4fc' : '#4f46e5'}; font-size: 11px;">
                                                <input type="checkbox" id="fasttag-scrape-chk-studio" checked style="cursor: pointer; width: 12px; height: 12px; accent-color: ${isStudioNew ? '#f59e0b' : '#6366f1'}; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">🏢</span>
                                                <span>Studio:</span>
                                            </label>
                                            ${isStudioNew ? `
                                                <span style="display: inline-flex; align-items: baseline; gap: 4px; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px;" title="Not in your local library — will create new studio upon saving">
                                                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(studioName)}</span>
                                                    <span style="font-size: 8.5px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}; padding: 0.5px 3.5px; border-radius: 3px; color: ${isDark ? '#fef08a' : '#78350f'}; flex-shrink: 0;">+ New</span>
                                                </span>
                                            ` : `
                                                <span style="display: inline-block; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="Exists in your local library">${escapeHtml(studioName)}</span>
                                            `}
                                        </div>
                                    ` : ''}
                                </div>
                            ` : `
                                <!-- Docked Mode: Compact Side-by-Side -->
                                <div style="display: flex; gap: 9px; align-items: stretch;">
                                    ${match.image ? `
                                        <div class="fasttag-scrape-cover-thumb" style="flex-shrink: 0; width: 116px; height: 74px; border-radius: 6px; overflow: hidden; background: #000; border: 1px solid ${isDark ? 'rgba(255,255,255,0.18)' : '#cbd5e1'}; display: flex; align-items: center; justify-content: center; align-self: flex-start; cursor: pointer; position: relative; transition: all 0.15s ease;" title="Hover to view full-size cover">
                                            <img src="${match.image}" alt="Cover" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" />
                                            <label style="position: absolute; left: 4px; bottom: 4px; z-index: 2; display: inline-flex; align-items: center; gap: 3px; padding: 2px 5px; border-radius: 3px; background: rgba(15, 23, 42, 0.88); color: #e0e7ff; font-size: 9px; font-weight: 700; cursor: pointer; user-select: none;" title="Include this cover image when accepting the match">
                                                <input type="checkbox" id="fasttag-scrape-chk-cover" checked style="cursor: pointer; width: 10px; height: 10px; accent-color: #6366f1; margin: 0;">
                                                <span>Cover</span>
                                            </label>
                                        </div>
                                    ` : ''}
                                    <div style="display: flex; flex-direction: column; gap: 6px; justify-content: center; flex: 1; min-width: 0;">
                                        <!-- Title Row -->
                                        <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 60px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#e0e7ff' : '#312e81'}; font-size: 11px;" title="Check to update scene title">
                                                <input type="checkbox" id="fasttag-scrape-chk-title" style="cursor: pointer; width: 12px; height: 12px; accent-color: #6366f1; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">✏️</span>
                                                <span>Title:</span>
                                            </label>
                                            <span style="display: inline-block; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 700; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="${escapeHtml(match.title || '')}">${escapeHtml(match.title || 'Untitled Match')}</span>
                                            ${match.date ? `
                                                <label style="display: inline-flex; align-items: baseline; gap: 4px; font-size: 10.5px; color: ${isDark ? '#94a3b8' : '#64748b'}; font-weight: 500; cursor: pointer; user-select: none;" title="Include this date when accepting the match">
                                                    <input type="checkbox" id="fasttag-scrape-chk-date" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #0ea5e9; margin: 0; position: relative; top: 1px;">
                                                    <span>📅 ${escapeHtml(match.date)}</span>
                                                </label>
                                            ` : ''}
                                        </div>

                                        ${studioName ? `
                                            <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                                <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 60px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#a5b4fc' : '#4f46e5'}; font-size: 11px;">
                                                    <input type="checkbox" id="fasttag-scrape-chk-studio" checked style="cursor: pointer; width: 12px; height: 12px; accent-color: ${isStudioNew ? '#f59e0b' : '#6366f1'}; margin: 0; position: relative; top: 1.5px;">
                                                    <span style="font-size: 11px;">🏢</span>
                                                    <span>Studio:</span>
                                                </label>
                                                ${isStudioNew ? `
                                                    <span style="display: inline-flex; align-items: baseline; gap: 4px; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px;" title="Not in your local library — will create new studio upon saving">
                                                        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(studioName)}</span>
                                                        <span style="font-size: 8.5px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}; padding: 0.5px 3.5px; border-radius: 3px; color: ${isDark ? '#fef08a' : '#78350f'}; flex-shrink: 0;">+ New</span>
                                                    </span>
                                                ` : `
                                                    <span style="display: inline-block; max-width: calc(100% - 75px); background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#e0e7ff' : '#312e81'}; padding: 2px 7px; border-radius: 4px; font-weight: 600; font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="Exists in your local library">${escapeHtml(studioName)}</span>
                                                `}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>
                            `}

                            <!-- Full-Width Performers, Tags, Details Sections -->
                            <div style="display: flex; flex-direction: column; gap: 5px; border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}; padding-top: 5px;">
                                ${performers.length > 0 ? `
                                    <div style="display: flex; flex-direction: column; gap: 3px;">
                                        <div style="display: flex; align-items: baseline; justify-content: space-between;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#7dd3fc' : '#0284c7'}; font-size: 11px;">
                                                <input type="checkbox" id="fasttag-scrape-chk-perf-all" checked style="cursor: pointer; width: 12px; height: 12px; accent-color: #0ea5e9; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">👥</span>
                                                <span>Performers (${performers.length}):</span>
                                            </label>
                                        </div>
                                        <div id="fasttag-scrape-perf-pills" style="display: flex; flex-wrap: wrap; gap: 4px;">
                                            ${performers.map((p, pIdx) => {
                                                const isNew = !(p.stored_id || cachedPerformers.some(cp => (cp.name || '').trim().toLowerCase() === (p.name || '').trim().toLowerCase()));
                                                if (isNew) {
                                                    return `
                                                        <label class="fasttag-performer-hover-trigger" data-scrape-performer-index="${pIdx}" style="display: inline-flex; align-items: baseline; gap: 4px; background: ${isDark ? 'rgba(245, 158, 11, 0.12)' : '#fef3c7'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.55)' : '#f59e0b'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; user-select: none;">
                                                            <input type="checkbox" class="fasttag-scrape-perf-item" data-idx="${pIdx}" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #f59e0b; margin: 0; position: relative; top: 1.5px;">
                                                            <span>${escapeHtml(p.name)}</span>
                                                            <span style="font-size: 8.5px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}; padding: 0.5px 3.5px; border-radius: 3px; color: ${isDark ? '#fef08a' : '#78350f'};">+ New</span>
                                                        </label>
                                                    `;
                                                }
                                                return `
                                                    <label class="fasttag-performer-hover-trigger" data-scrape-performer-index="${pIdx}" style="display: inline-flex; align-items: baseline; gap: 4px; background: ${isDark ? 'rgba(14, 165, 233, 0.15)' : '#e0f2fe'}; color: ${isDark ? '#bae6fd' : '#0369a1'}; border: 1px solid ${isDark ? 'rgba(56, 189, 248, 0.35)' : '#7dd3fc'}; padding: 2px 6px; border-radius: 4px; font-size: 10px; cursor: pointer; user-select: none;">
                                                        <input type="checkbox" class="fasttag-scrape-perf-item" data-idx="${pIdx}" checked style="cursor: pointer; width: 11px; height: 11px; accent-color: #0ea5e9; margin: 0; position: relative; top: 1.5px;">
                                                        <span>${escapeHtml(p.name)}</span>
                                                    </label>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}

                                ${tags.length > 0 ? `
                                    <div style="display: flex; flex-direction: column; gap: 3px;">
                                        <div style="display: flex; align-items: baseline; justify-content: space-between;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; cursor: pointer; user-select: none; font-weight: 600; color: ${isDark ? '#cbd5e1' : '#475569'}; font-size: 11px;">
                                                <input type="checkbox" id="fasttag-scrape-chk-tags-all" style="cursor: pointer; width: 12px; height: 12px; accent-color: #64748b; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">🏷️</span>
                                                <span>Tags (${tags.length}):</span>
                                            </label>
                                        </div>
                                        <div id="fasttag-scrape-tags-pills" style="display: flex; flex-wrap: wrap; gap: 3px; align-items: baseline;">
                                            ${tags.map((t, tIdx) => {
                                                const isNew = !(t.stored_id || cachedTags.some(ct => (ct.name || '').trim().toLowerCase() === (t.name || '').trim().toLowerCase()));
                                                if (isNew) {
                                                    return `
                                                        <label style="display: inline-flex; align-items: baseline; gap: 3px; background: ${isDark ? 'rgba(245, 158, 11, 0.1)' : '#fffbeb'}; color: ${isDark ? '#fde68a' : '#92400e'}; border: 1px dashed ${isDark ? 'rgba(245, 158, 11, 0.5)' : '#fbbf24'}; padding: 1.5px 5px; border-radius: 4px; font-size: 9.5px; cursor: pointer; user-select: none;" title="Not in your local library — will create new tag upon saving">
                                                            <input type="checkbox" class="fasttag-scrape-tag-item" data-idx="${tIdx}" style="cursor: pointer; width: 10px; height: 10px; accent-color: #f59e0b; margin: 0; position: relative; top: 1px;">
                                                            <span>${escapeHtml(t.name)}</span>
                                                            <span style="font-size: 8px; font-weight: 700; background: ${isDark ? 'rgba(245, 158, 11, 0.28)' : 'rgba(245, 158, 11, 0.2)'}; padding: 0.5px 3px; border-radius: 2px; color: ${isDark ? '#fef08a' : '#78350f'};">+ New</span>
                                                        </label>
                                                    `;
                                                }
                                                return `
                                                    <label style="display: inline-flex; align-items: baseline; gap: 3px; background: ${isDark ? 'rgba(148, 163, 184, 0.12)' : '#f1f5f9'}; color: ${isDark ? '#cbd5e1' : '#334155'}; border: 1px solid ${isDark ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1'}; padding: 1.5px 5px; border-radius: 4px; font-size: 9.5px; cursor: pointer; user-select: none;" title="Exists in your local library">
                                                        <input type="checkbox" class="fasttag-scrape-tag-item" data-idx="${tIdx}" style="cursor: pointer; width: 10px; height: 10px; accent-color: #64748b; margin: 0; position: relative; top: 1px;">
                                                        <span>${escapeHtml(t.name)}</span>
                                                    </label>
                                                `;
                                            }).join('')}
                                        </div>
                                    </div>
                                ` : ''}

                                ${match.details && match.details.trim() ? `
                                    <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 2px; border-top: 1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}; padding-top: 4px;">
                                        <div style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                                            <label style="display: inline-flex; align-items: baseline; gap: 4px; min-width: 60px; flex-shrink: 0; cursor: pointer; user-select: none; font-weight: 600; font-size: 11px; color: ${isDark ? '#93c5fd' : '#2563eb'};">
                                                <input type="checkbox" id="fasttag-scrape-chk-details" style="cursor: pointer; width: 12px; height: 12px; accent-color: #3b82f6; margin: 0; position: relative; top: 1.5px;">
                                                <span style="font-size: 11px;">📜</span>
                                                <span>Details:</span>
                                            </label>
                                            <span id="fasttag-scrape-toggle-details" style="display: inline-flex; align-items: baseline; gap: 5px; background: ${isDark ? 'rgba(99, 102, 241, 0.2)' : '#e0e7ff'}; color: ${isDark ? '#c7d2fe' : '#3730a3'}; border: 1px solid ${isDark ? 'rgba(99, 102, 241, 0.35)' : '#c7d2fe'}; padding: 2px 7px; border-radius: 4px; font-weight: 500; font-size: 10.5px; cursor: pointer; max-width: 410px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; user-select: none; transition: background 0.15s ease;" title="Click to expand/collapse full synopsis">
                                                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-style: italic;">"${escapeHtml(match.details.trim().replace(/\s+/g, ' '))}"</span>
                                                <span id="fasttag-scrape-details-arrow" style="font-size: 7.5px; color: #818cf8; flex-shrink: 0;">▶</span>
                                            </span>
                                        </div>
                                        <div id="fasttag-scrape-details-content" style="display: none; max-height: 110px; overflow-y: auto; font-size: 11.5px; line-height: 1.5; color: ${isDark ? '#e2e8f0' : '#1e293b'}; background: ${isDark ? 'rgba(0,0,0,0.45)' : '#ffffff'}; padding: 7px 10px; border-radius: 5px; border: 1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}; white-space: pre-wrap; word-break: break-word; font-family: system-ui, -apple-system, sans-serif;">
                                            ${escapeHtml(match.details.trim())}
                                        </div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <!-- Guaranteed Visible Bottom Scroll Indicator -->
                        <div id="fasttag-scrape-scroll-hint" style="display: none; position: absolute; bottom: 0; left: 0; right: 0; height: 28px; background: linear-gradient(to top, ${isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(241, 245, 249, 0.95)'} 25%, transparent 100%); pointer-events: none; align-items: flex-end; justify-content: center; padding-bottom: 2px; transition: opacity 0.2s ease;">
                            <span style="font-size: 9px; font-weight: 600; color: #818cf8; display: inline-flex; align-items: center; gap: 3px; background: ${isDark ? '#1e293b' : '#ffffff'}; padding: 1px 7px; border-radius: 10px; border: 1px solid rgba(129, 140, 248, 0.4); box-shadow: 0 1px 4px rgba(0,0,0,0.3);">
                                <span>⌄</span><span>More below</span>
                            </span>
                        </div>
                    </div>

                    <!-- Seamless Edge Resizer (Zero wasted height, cursor: ns-resize) -->
                    <div id="fasttag-scrape-v-resizer" style="height: 11px; margin: 3px -12px -6px -12px; cursor: ns-resize; border-bottom: 2px solid rgba(99, 102, 241, 0.45); display: ${isDetached ? 'none' : 'flex'}; align-items: center; justify-content: center; user-select: none; transition: border-color 0.15s ease;" title="Drag up or down to resize scraper preview height">
                        <div style="width: 44px; height: 3px; border-radius: 2px; background: rgba(129, 140, 248, 0.6); pointer-events: none; transition: all 0.15s ease;"></div>
                    </div>
                </div>
            `;

            const scraperHeader = targetContainer.querySelector('#fasttag-scrape-header');
            const scraperHeaderPrimary = targetContainer.querySelector('#fasttag-scrape-header-primary');
            const scraperHeaderActions = targetContainer.querySelector('#fasttag-scrape-header-actions');
            const updateScraperHeaderLayout = () => {
                if (!scraperHeader || !scraperHeaderPrimary || !scraperHeaderActions) return;
                const containerWidth = targetContainer.getBoundingClientRect?.().width || targetContainer.clientWidth || 0;
                const compact = containerWidth > 0 && containerWidth < 370;
                scraperHeader.style.flexDirection = compact ? 'column' : 'row';
                scraperHeader.style.alignItems = compact ? 'stretch' : 'center';
                scraperHeaderPrimary.style.flex = compact ? '0 0 auto' : '1 1 150px';
                scraperHeaderPrimary.style.width = compact ? '100%' : 'auto';
                scraperHeaderActions.style.alignSelf = compact ? 'flex-end' : 'auto';
            };
            targetContainer._fastTagScraperHeaderResizeObserver?.disconnect?.();
            updateScraperHeaderLayout();
            if (typeof root.ResizeObserver === 'function') {
                targetContainer._fastTagScraperHeaderResizeObserver = new root.ResizeObserver(updateScraperHeaderLayout);
                targetContainer._fastTagScraperHeaderResizeObserver.observe(targetContainer);
            }

            const previewBox = targetContainer.querySelector('#fasttag-scrape-items-preview');
            const perfPills = targetContainer.querySelector('#fasttag-scrape-perf-pills');
            const tagsPills = targetContainer.querySelector('#fasttag-scrape-tags-pills');

            const runManualSearch = async () => {
                const input = targetContainer.querySelector('#fasttag-scrape-manual-query');
                const searchBtn = targetContainer.querySelector('#fasttag-scrape-manual-search-btn');
                const query = (input?.value || '').trim();
                if (!query) {
                    toastError('Enter the words you want to search for.');
                    input?.focus();
                    return;
                }
                const manualRequestId = beginRequest(popup, sceneId);
                if (manualRequestId == null) return;
                if (searchBtn) {
                    searchBtn.disabled = true;
                    searchBtn.textContent = 'Searching…';
                }
                try {
                    const manualResults = await fetchScraperMatchesForScene(sceneId, null, query);
                    if (!isRequestCurrent(popup, sceneId, manualRequestId)) return;
                    if (!manualResults?.length) {
                        toastError(`No scraper matches found for “${query}”`);
                        if (searchBtn) {
                            searchBtn.disabled = false;
                            searchBtn.textContent = 'Search';
                        }
                        return;
                    }
                    sessionCache.set(sceneId, manualResults);
                    hideScrapeCoverTooltip();
                    await renderMatches(container, manualResults, sceneId, ctx, popup, onDismiss, '', manualRequestId);
                } catch (error) {
                    if (!isRequestCurrent(popup, sceneId, manualRequestId)) return;
                    toastError('Scrape search failed: ' + (error?.message || error));
                    if (searchBtn) {
                        searchBtn.disabled = false;
                        searchBtn.textContent = 'Search';
                    }
                }
            };

            const manualSearchBtn = targetContainer.querySelector('#fasttag-scrape-manual-search-btn');
            if (manualSearchBtn) manualSearchBtn.onclick = runManualSearch;
            const manualSearchInput = targetContainer.querySelector('#fasttag-scrape-manual-query');
            if (manualSearchInput) {
                manualSearchInput.onkeydown = (event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    event.stopPropagation();
                    runManualSearch();
                };
            }

            const toggleHiddenBtn = targetContainer.querySelector('#fasttag-scrape-toggle-hidden');
            if (toggleHiddenBtn) {
                toggleHiddenBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    allResults._fastTagShowHidden = !showingHiddenResults;
                    allResults._fastTagShowAllResults = !showingHiddenResults;
                    hideScrapeCoverTooltip();
                    renderMatches(container, allResults, sceneId, ctx, popup, onDismiss, '', scrapeRequestId);
                };
            }

            const toggleOverflowBtn = targetContainer.querySelector('#fasttag-scrape-toggle-overflow');
            if (toggleOverflowBtn) {
                toggleOverflowBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    allResults._fastTagShowAllResults = !showingAllResults;
                    hideScrapeCoverTooltip();
                    renderMatches(container, allResults, sceneId, ctx, popup, onDismiss, '', scrapeRequestId);
                };
            }

            const dismissMatchBtn = targetContainer.querySelector('#fasttag-scrape-dismiss-match');
            if (dismissMatchBtn) {
                dismissMatchBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    hideScrapeCoverTooltip();
                    const selectedMatch = results[currentIndex];
                    const sourceIndex = allResults.indexOf(selectedMatch);
                    if (sourceIndex >= 0) allResults.splice(sourceIndex, 1);
                    if (allResults.length === 0) {
                        sessionCache.delete(sceneId);
                        renderMatches(container, allResults, sceneId, ctx, popup, onDismiss, '', scrapeRequestId);
                        if (typeof onDismiss === 'function') onDismiss();
                        return;
                    }
                    sessionCache.set(sceneId, allResults);
                    renderMatches(container, allResults, sceneId, ctx, popup, onDismiss, '', scrapeRequestId);
                };
            }

            // Wire popout / dock button
            const popoutToggleBtn = targetContainer.querySelector('#fasttag-scrape-popout-toggle');
            if (popoutToggleBtn) {
                popoutToggleBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    hideScrapeCoverTooltip();
                    const nextState = !getDetachScraper();
                    setDetachScraper(nextState);
                    if (nextState) {
                        if (popup?.scraperCardContainer) {
                            popup.scraperCardContainer.innerHTML = '';
                            popup.scraperCardContainer.style.display = 'none';
                        }
                    } else {
                        closeHud();
                    }
                    renderMatches(popup?.scraperCardContainer || container, allResults, sceneId, ctx, popup, onDismiss, '', scrapeRequestId);
                };
            }

            // Wire dragging when in detached floating window
            if (isDetached && floatingScraperHudElement) {
                const headerEl = targetContainer.querySelector('#fasttag-scrape-header');
                if (headerEl) {
                    headerEl.style.cursor = 'grab';
                    let isDragging = false;
                    let startX = 0, startY = 0, startL = 0, startT = 0;
                    const onMouseMove = (e) => {
                        if (!isDragging || !floatingScraperHudElement) return;
                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;
                        const newLeft = Math.max(8, Math.min(root.innerWidth - floatingScraperHudElement.offsetWidth - 8, startL + dx));
                        const newTop = Math.max(8, Math.min(root.innerHeight - floatingScraperHudElement.offsetHeight - 8, startT + dy));
                        floatingScraperHudElement.style.left = `${newLeft}px`;
                        floatingScraperHudElement.style.top = `${newTop}px`;
                        floatingScraperHudElement.style.right = 'auto';
                        floatingScraperHudPosition = { top: `${newTop}px`, left: `${newLeft}px` };
                        setHudPosition(floatingScraperHudPosition);
                        try {
                            root.localStorage.setItem('fasttag_scraper_hud_pos', JSON.stringify(floatingScraperHudPosition));
                        } catch (e) {}
                    };
                    const onMouseUp = () => {
                        isDragging = false;
                        if (floatingScraperHudElement) floatingScraperHudElement._isDragging = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                        if (headerEl) headerEl.style.cursor = 'grab';
                    };
                    headerEl.onmousedown = (e) => {
                        if (e.target.closest('button, a, input, select')) return;
                        const rect = floatingScraperHudElement.getBoundingClientRect();
                        const isResizeZone = (rect.right - e.clientX) <= 24 && (rect.bottom - e.clientY) <= 24;
                        if (isResizeZone) return;

                        isDragging = true;
                        if (floatingScraperHudElement) floatingScraperHudElement._isDragging = true;
                        startX = e.clientX;
                        startY = e.clientY;
                        startL = rect.left;
                        startT = rect.top;
                        headerEl.style.cursor = 'grabbing';
                        document.body.style.userSelect = 'none';
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    };
                }
            }

            // Wire vertical resize dragging (allows smooth split resizing between scraper card and tags table)
            const resizer = targetContainer.querySelector('#fasttag-scrape-v-resizer');
            if (resizer && previewBox) {
                if (isDetached) {
                    resizer.style.display = 'none';
                } else {
                    resizer.style.display = 'flex';
                }
                let isResizing = false;
                let startY = 0;
                let startPreviewH = 0;

                const onMouseMove = (e) => {
                    if (!isResizing) return;
                    e.preventDefault();
                    const dy = e.clientY - startY;
                    const newPreviewH = Math.max(50, Math.min(520, startPreviewH + dy));
                    previewBox.style.height = `${newPreviewH}px`;
                    try {
                        root.localStorage.setItem('fasttag_embedded_scraper_h', String(newPreviewH));
                    } catch (e) {}
                    if (typeof updateScrollHint === 'function') updateScrollHint();
                    if (activeTableInstance) {
                        try { activeTableInstance.redraw(false); } catch (err) {}
                    }
                    if (popup?.tagsTable) {
                        try { popup.tagsTable.redraw(false); } catch (err) {}
                    }
                    if (popup?.performersTable) {
                        try { popup.performersTable.redraw(false); } catch (err) {}
                    }
                };

                const onMouseUp = () => {
                    if (isResizing) {
                        isResizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';
                        resizer.style.borderBottomColor = 'rgba(99, 102, 241, 0.45)';
                        const bar = resizer.querySelector('div');
                        if (bar) {
                            bar.style.width = '44px';
                            bar.style.background = 'rgba(129, 140, 248, 0.6)';
                        }
                    }
                };

                resizer.addEventListener('mouseenter', () => {
                    resizer.style.borderBottomColor = '#818cf8';
                    const bar = resizer.querySelector('div');
                    if (bar) {
                        bar.style.width = '64px';
                        bar.style.background = '#818cf8';
                    }
                });

                resizer.addEventListener('mouseleave', () => {
                    if (!isResizing) {
                        resizer.style.borderBottomColor = 'rgba(99, 102, 241, 0.45)';
                        const bar = resizer.querySelector('div');
                        if (bar) {
                            bar.style.width = '44px';
                            bar.style.background = 'rgba(129, 140, 248, 0.6)';
                        }
                    }
                });

                resizer.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    isResizing = true;
                    startY = e.clientY;
                    startPreviewH = previewBox.offsetHeight || 180;
                    document.body.style.cursor = 'ns-resize';
                    document.body.style.userSelect = 'none';
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });

                resizer.addEventListener('mouseenter', () => {
                    const bar = resizer.querySelector('div');
                    if (bar) {
                        bar.style.width = '64px';
                        bar.style.background = '#818cf8';
                    }
                });
                resizer.addEventListener('mouseleave', () => {
                    if (!isResizing) {
                        const bar = resizer.querySelector('div');
                        if (bar) {
                            bar.style.width = '44px';
                            bar.style.background = isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8';
                        }
                    }
                });
            }

            // Toggle Synopsis / Details blurb
            const detailsToggleBtn = targetContainer.querySelector('#fasttag-scrape-toggle-details');
            const detailsContent = targetContainer.querySelector('#fasttag-scrape-details-content');
            const detailsArrow = targetContainer.querySelector('#fasttag-scrape-details-arrow');
            if (detailsToggleBtn && detailsContent) {
                detailsToggleBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const isHidden = detailsContent.style.display === 'none';
                    detailsContent.style.display = isHidden ? 'block' : 'none';
                    if (detailsArrow) detailsArrow.textContent = isHidden ? '▼' : '▶';
                    detailsToggleBtn.title = isHidden ? 'Click to collapse synopsis' : 'Click to expand full synopsis';
                };
            }

            // Hover zoom tooltip for cover image
            const thumbEl = targetContainer.querySelector('.fasttag-scrape-cover-thumb');
            if (thumbEl && match.image) {
                thumbEl.onmouseenter = () => showScrapeCoverTooltip(match.image, thumbEl);
                thumbEl.onmouseleave = () => hideScrapeCoverTooltip();
            }

            targetContainer.querySelectorAll('.fasttag-performer-hover-trigger').forEach(trigger => {
                const performerIndex = Number(trigger.getAttribute('data-scrape-performer-index'));
                const performer = performers[performerIndex];
                if (!performer) return;
                trigger.onmouseenter = () => startScrapedPerformerHover(performer, match, cachedPerformers, trigger);
                trigger.onmouseleave = (event) => {
                    if (event.relatedTarget?.closest?.('#fasttag-performer-hover-card')) return;
                    stopScrapedPerformerHover();
                };
            });

            // Bind interactions
            const prevBtn = targetContainer.querySelector('#fasttag-scrape-prev');
            if (prevBtn) {
                prevBtn.onclick = (e) => {
                    e.preventDefault();
                    hideScrapeCoverTooltip();
                    if (currentIndex > 0) {
                        currentIndex--;
                        updateCardView();
                    }
                };
            }

            const nextBtn = targetContainer.querySelector('#fasttag-scrape-next');
            if (nextBtn) {
                nextBtn.onclick = (e) => {
                    e.preventDefault();
                    hideScrapeCoverTooltip();
                    if (currentIndex < results.length - 1) {
                        currentIndex++;
                        updateCardView();
                    }
                };
            }

            const perfAllChk = targetContainer.querySelector('#fasttag-scrape-chk-perf-all');
            if (perfAllChk) {
                perfAllChk.onchange = (e) => {
                    targetContainer.querySelectorAll('.fasttag-scrape-perf-item').forEach(chk => {
                        chk.checked = e.target.checked;
                    });
                };
            }

            const tagsAllChk = targetContainer.querySelector('#fasttag-scrape-chk-tags-all');
            if (tagsAllChk) {
                tagsAllChk.onchange = (e) => {
                    targetContainer.querySelectorAll('.fasttag-scrape-tag-item').forEach(chk => {
                        chk.checked = e.target.checked;
                    });
                };
            }

            const cancelBtn = targetContainer.querySelector('#fasttag-scrape-cancel-btn');
            if (cancelBtn) {
                cancelBtn.onclick = (e) => {
                    e.preventDefault();
                    invalidateRequests(popup);
                    hideScrapeCoverTooltip();
                    restoreSingleWidth();
                    closeHud();
                    targetContainer.innerHTML = '';
                    targetContainer.style.display = 'none';
                    if (typeof onDismiss === 'function') onDismiss();
                };
            }

            const scrollHint = targetContainer.querySelector('#fasttag-scrape-scroll-hint');
            const updateScrollHint = () => {
                if (!previewBox || !scrollHint) return;
                const canScrollDown = previewBox.scrollHeight > (previewBox.clientHeight + 6) && ((previewBox.scrollTop + previewBox.clientHeight) < (previewBox.scrollHeight - 8));
                scrollHint.style.display = canScrollDown ? 'flex' : 'none';
            };

            if (previewBox) {
                previewBox.onscroll = updateScrollHint;
                setTimeout(updateScrollHint, 60);
            }

            const acceptBtn = targetContainer.querySelector('#fasttag-scrape-accept-btn');
            if (acceptBtn) {
                acceptBtn.onclick = async (e) => {
                    e.preventDefault();
                    hideScrapeCoverTooltip();
                    acceptBtn.disabled = true;
                    acceptBtn.innerHTML = `<span>⏳ Saving...</span>`;
                    await acceptMatch(match, targetContainer, sceneId, ctx, popup);
                };
            }

            if (popup && popup.scrapeBtn) {
                popup.scrapeBtn.innerHTML = isEasterEggActive() ? '<span>▲ Hide 🍫</span>' : '<span>▲ Hide</span>';
                popup.scrapeBtn.title = isDetached ? 'Hide detached scraper window' : 'Hide scrape preview';
                if (isDetached) {
                    popup.scrapeBtn.classList.add('fasttag-dock-pulse');
                } else {
                    popup.scrapeBtn.classList.remove('fasttag-dock-pulse');
                }
            }

            if (isDetached && floatingScraperHudElement) {
                attachResizeHandles(floatingScraperHudElement);
            }
        };

        updateCardView();
    }


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
                sessionCache.delete(sceneId);

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
        showLoadingState,
        sessionCache,
        createTrigger,
        renderMatches,
        acceptMatch
    });
}(typeof window !== 'undefined' ? window : globalThis));
