(function initializeFastTagPreview(root) {
    'use strict';

    let dependencies = null;
    function configure(options) { dependencies = options; }

    function getDominantWheelDelta(deltaX, deltaY) {
        const rawDelta = Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : deltaX;
        return !rawDelta || isNaN(rawDelta) ? null : rawDelta;
    }

    function getWheelNotches(rawDelta, deltaMode) {
        const notches = deltaMode === 1 ? rawDelta : (rawDelta / 60);
        return Math.abs(notches) < 0.05 ? null : notches;
    }

    function selectScrubStep(scrubSpeeds, timeDelta, shiftHeld) {
        if (shiftHeld) return scrubSpeeds.freeze;
        const slow = scrubSpeeds.slow > 0 ? scrubSpeeds.slow : 0;
        const normal = scrubSpeeds.normal > 0 ? scrubSpeeds.normal : 0;
        const fast = scrubSpeeds.fast > 0 ? scrubSpeeds.fast : 0;
        if (timeDelta < 80) return fast || normal || slow || 10.0;
        if (timeDelta < 200) return normal || slow || fast || 10.0;
        return slow || normal || fast || 10.0;
    }

    function calculateScrubTarget(currentTime, duration, notches, step) {
        const direction = -Math.sign(notches);
        return Math.min(duration, Math.max(0, currentTime + (direction * step)));
    }

    function calculateSeekTarget(clientX, trackLeft, trackWidth, duration) {
        const width = Number(trackWidth);
        const length = Number(duration);
        if (!(width > 0) || !(length > 0) || !isFinite(length)) return null;
        const ratio = Math.min(1, Math.max(0, (Number(clientX) - Number(trackLeft || 0)) / width));
        return ratio * length;
    }

    function shouldResumeAfterTimelineSeek(isPaused, wheelScrubWasPlaying, shiftHeld, isCoverEditing) {
        if (!isCoverEditing) return true;
        return !isPaused || (Boolean(wheelScrubWasPlaying) && !shiftHeld);
    }

    function getDefaultPopoutSize() {
        const screenWidth = root.innerWidth;
        let targetWidth = 600;
        if (screenWidth >= 2200) targetWidth = 760;
        else if (screenWidth >= 1600) targetWidth = 600;
        else if (screenWidth >= 1300) targetWidth = 520;
        else if (screenWidth >= 1000) targetWidth = 460;
        else targetWidth = Math.max(300, Math.round(screenWidth * 0.40));
        return { width: `${targetWidth}px`, height: `${Math.round(targetWidth * (9 / 16))}px` };
    }

    function calculateVideoPopoutPosition(options) {
        const {
            formRect,
            scraperRect = null,
            hudWidth = 600,
            hudHeight = 338,
            screenWidth = root.innerWidth,
            screenHeight = root.innerHeight,
            margin = 14
        } = options || {};
        if (!formRect) return { left: '20px', top: '70px', width: `${hudWidth}px`, height: `${hudHeight}px` };

        const spaceLeft = Math.max(0, formRect.left - margin);
        const spaceRight = Math.max(0, screenWidth - formRect.right - margin);
        const clampedTop = Math.max(margin, Math.min(screenHeight - hudHeight - margin, Math.round(formRect.top)));
        if (spaceLeft >= hudWidth + margin) {
            return {
                left: `${Math.round(formRect.left - hudWidth - margin)}px`,
                top: `${clampedTop}px`,
                width: `${hudWidth}px`,
                height: `${hudHeight}px`
            };
        }
        if (spaceRight >= hudWidth + margin && (!scraperRect || scraperRect.right <= formRect.left)) {
            return {
                left: `${Math.round(formRect.right + margin)}px`,
                top: `${clampedTop}px`,
                width: `${hudWidth}px`,
                height: `${hudHeight}px`
            };
        }
        const left = Math.max(margin, Math.min(screenWidth - hudWidth - margin, Math.round(formRect.left - hudWidth - margin)));
        return { left: `${left}px`, top: `${clampedTop}px`, width: `${hudWidth}px`, height: `${hudHeight}px` };
    }

    function extractMediaUrlsFromCard(cardElement) {
        if (!cardElement) return { previewUrl: null, coverUrl: null };
        let previewUrl = null;
        let coverUrl = null;
        const videoNode = cardElement.querySelector('video');
        if (videoNode) {
            const source = videoNode.currentSrc || videoNode.src || videoNode.getAttribute('src');
            if (source && /(preview|\.mp4|\.webm|\.m4v|\.mov|\.webp|\.gif)/i.test(source)) previewUrl = source;
            const poster = videoNode.getAttribute('poster') || videoNode.poster;
            if (poster) coverUrl = poster;
        }
        for (const node of cardElement.querySelectorAll('source[src]')) {
            const source = node.getAttribute('src') || node.src;
            if (source && !previewUrl && /(preview|\.mp4|\.webm|\.m4v|\.mov|\.webp|\.gif)/i.test(source)) previewUrl = source;
        }
        for (const node of cardElement.querySelectorAll('img')) {
            const source = node.currentSrc || node.src || node.getAttribute('src');
            if (!source) continue;
            if (!previewUrl && /(preview|\.mp4|\.webm|\.webp|\.gif)/i.test(source)) previewUrl = source;
            else if (!coverUrl && /(screenshot|thumb|image|cover|\.jpe?g|\.png)/i.test(source)) coverUrl = source;
            else if (!coverUrl) coverUrl = source;
        }
        for (const node of cardElement.querySelectorAll('[style*="background"]')) {
            const background = node.style.backgroundImage || node.getAttribute('style') || '';
            const match = background.match(/url\(['"]?([^'"]+)['"]?\)/i);
            if (match?.[1] && !coverUrl && /(screenshot|thumb|image|cover|\/scene\/)/i.test(match[1])) coverUrl = match[1];
        }
        return { previewUrl, coverUrl };
    }

    function toRelativeMediaUrl(url) {
        if (!url) return url;
        try {
            const parsed = new URL(url, root.location.href);
            return parsed.pathname + parsed.search;
        } catch (e) {
            return url;
        }
    }

    async function fetchSceneMediaUrls(sceneId, cardElement) {
        if (!dependencies) throw new Error('[FastTag] Preview integration is not configured');
        const cardMedia = extractMediaUrlsFromCard(cardElement);
        let previewUrl = cardMedia.previewUrl;
        let coverUrl = cardMedia.coverUrl;
        let streamUrl = null;
        let previewExplicitlyMissing = false;
        if (sceneId) {
            const queries = [
                'query ($id: ID!) { findScene(id: $id) { paths { preview screenshot webp stream } } }',
                'query ($id: ID!) { findScene(id: $id) { paths { preview screenshot stream } } }',
                'query ($id: ID!) { findScene(id: $id) { paths { preview screenshot } } }',
                'query ($id: ID!) { findScene(id: $id) { preview screenshot } }'
            ];
            for (const query of queries) {
                try {
                    const response = await dependencies.fetchGQL(query, { id: sceneId });
                    if (response.errors) continue;
                    const scene = response.data?.findScene;
                    if (!scene) continue;
                    const gqlPreview = scene.paths?.preview || scene.preview || scene.paths?.webp || null;
                    const gqlScreenshot = scene.paths?.screenshot || scene.screenshot || null;
                    const gqlStream = scene.paths?.stream || null;
                    if (gqlPreview) previewUrl = gqlPreview;
                    else if (scene.paths && ('preview' in scene.paths) && !scene.paths.preview && !scene.paths.webp) {
                        previewUrl = null;
                        previewExplicitlyMissing = true;
                    }
                    if (gqlScreenshot) coverUrl = gqlScreenshot;
                    if (gqlStream) streamUrl = gqlStream;
                    break;
                } catch (error) {
                    console.error('FastTag: preview fetch failed', error);
                }
            }
        }
        const baseOrigin = root.location.origin || 'http://localhost:9999';
        if (!coverUrl && sceneId) coverUrl = `${baseOrigin}/scene/${encodeURIComponent(sceneId)}/screenshot`;
        if (!streamUrl && sceneId) streamUrl = `${baseOrigin}/scene/${encodeURIComponent(sceneId)}/stream`;
        if (!previewUrl && !previewExplicitlyMissing && sceneId) previewUrl = `${baseOrigin}/scene/${encodeURIComponent(sceneId)}/preview`;
        return {
            previewUrl: toRelativeMediaUrl(previewUrl),
            coverUrl: toRelativeMediaUrl(coverUrl),
            streamUrl: toRelativeMediaUrl(streamUrl)
        };
    }

    let hasShownScrubCueThisSession = false;
    let isVideoPoppedOut = false;
    let floatingHudElement = null;
    let floatingHudPosition = null;
    let floatingHudSize = null;
    let currentPreviewAbortController = null;

    function getInitialPopoutPosition(hudWidth = 600, hudHeight = 338) {
        const activePopup = dependencies?.getActivePopup?.();
        const document = root.document;
        const activeForm = activePopup?.element || document.querySelector('#scenes-popup');
        const scraperHudElement = dependencies?.getFloatingScraperHudElement?.() || null;
        const isScraperOpen = scraperHudElement && document.body.contains(scraperHudElement);
        const scraperRect = isScraperOpen ? scraperHudElement.getBoundingClientRect() : null;
        let rect = null;
        if (activeForm) {
            rect = activeForm.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.left <= 0) {
                const formW = parseInt(activeForm.style.width, 10) || 760;
                const formH = parseInt(activeForm.style.height, 10) || 760;
                const defPos = dependencies.getDefaultEverythingPosition(formW, formH);
                rect = { left: defPos.x, right: defPos.x + formW, top: defPos.y, bottom: defPos.y + formH, width: formW, height: formH };
            }
        }
        return calculateVideoPopoutPosition({
            formRect: rect,
            scraperRect,
            hudWidth,
            hudHeight,
            screenWidth: root.innerWidth,
            screenHeight: root.innerHeight
        });
    }

    function closeFloatingVideoHud(fullReset = false) {
        if (floatingHudElement) {
            floatingHudElement.remove();
            floatingHudElement = null;
        }
        isVideoPoppedOut = false;
    }

    function abortCurrentPreview() {
        if (currentPreviewAbortController) {
            currentPreviewAbortController.abort();
            currentPreviewAbortController = null;
        }
    }

    function resetSessionCue() {
        hasShownScrubCueThisSession = false;
    }

    function resetLayoutState() {
        floatingHudPosition = null;
        floatingHudSize = null;
    }

    function isPoppedOut() {
        return Boolean(isVideoPoppedOut);
    }

    function getFloatingHudElement() {
        return floatingHudElement;
    }

    async function attachScenePreview(hostContainer, sceneId, cardElement) {
        if (!dependencies) throw new Error('[FastTag] Preview integration is not configured');
        const {
            coverEditor: FastTagCoverEditor,
            getSceneUrl,
            getScrubSpeeds,
            getScrubCueCount,
            incrementScrubCueCount,
            MAX_SCRUB_CUE_DISPLAYS,
            isVideoHudPersistedOpen,
            setVideoHudPersistedOpen,
            getAlwaysPlayFullVideo,
            showToast,
            log: ftLog
        } = dependencies;
        const window = root;
        const document = root.document;
        const localStorage = root.localStorage;
        const AbortController = root.AbortController;
        const ResizeObserver = root.ResizeObserver;
        const setTimeout = (...args) => root.setTimeout(...args);
        const clearTimeout = (...args) => root.clearTimeout(...args);
        if (!hostContainer) return;
        if (hostContainer._previewAbortController) {
            hostContainer._previewAbortController.abort();
        }
        const previewAbort = new AbortController();
        hostContainer._previewAbortController = previewAbort;
        currentPreviewAbortController = previewAbort;
        const { signal } = previewAbort;

        hostContainer.innerHTML = '';
        hostContainer.style.display = 'block';
        hostContainer.style.position = 'relative';
        hostContainer.style.width = '100%';
        hostContainer.style.height = 'auto';
        hostContainer.style.aspectRatio = '16 / 9';
        const isEverythingHost = hostContainer.id === 'everything-preview-container';
        hostContainer.style.maxHeight = isEverythingHost ? '205px' : '280px';
        hostContainer.style.margin = '0 0 8px 0';
        hostContainer.style.borderRadius = '8px';
        hostContainer.style.overflow = 'hidden';
        hostContainer.style.border = 'none';
        hostContainer.style.background = '#0f172a';
        hostContainer.style.boxShadow = 'none';
        hostContainer.style.cursor = 'pointer';

        // Media container holds the active video/img, progress bar, cue badge, and top-right controls
        const mediaContainer = document.createElement('div');
        mediaContainer.id = 'fasttag-media-container';
        mediaContainer.style.cssText = 'position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #0f172a; cursor: pointer;';

        let isDragging = false;
        let hasDragged = false;
        let dragStartX = 0, dragStartY = 0;
        let startLeft = 0, startTop = 0;

        mediaContainer.onclick = (e) => {
            if (isVideoPoppedOut || coverEditing) return; // Keep floating and cover-editor video clicks inside their HUDs
            if (e.shiftKey || hasDragged || isDragging) return;
            if (e.target && (e.target.closest('#fasttag-stream-toggle-pill') || e.target.closest('#fasttag-stream-popout-btn') || e.target.closest('#fasttag-hud-close-btn') || e.target.closest('#fasttag-inline-dock-btn'))) return;
            const sceneUrl = getSceneUrl(sceneId, cardElement);
            if (sceneUrl) {
                window.open(sceneUrl, '_blank');
            }
        };

        const mediaUrls = await fetchSceneMediaUrls(sceneId, cardElement);
        const { previewUrl, coverUrl, streamUrl } = mediaUrls;
        if (signal.aborted) return;

        if (!previewUrl && !coverUrl && !streamUrl) {
            hostContainer.style.display = 'none';
            return;
        }

        let currentMode = 'preview'; // 'preview' or 'stream'
        let currentMedia = null;
        let currentMediaSource = '';
        let wheelListenerAttached = false;
        let resumeTimer = null;
        let hudTimer = null;
        let scrubbing = false;
        let wasPlaying = false;
        let originalLoop = true;
        let shiftHeld = false;
        let isHovered = false;
        let streamCaptureFailure = '';
        let coverEditing = false;
        let coverEditorPreviousMode = null;
        let coverEditorWasPoppedOut = false;
        const hasControllableVideo = () => Boolean(
            currentMedia?.tagName === 'VIDEO' &&
            (currentMode === 'stream' || (coverEditing && currentMediaSource === 'preview-video'))
        );

        // Slim Progress Bar at the very bottom edge (no text/numbers)
        const progressBarBg = document.createElement('div');
        progressBarBg.id = 'fasttag-progress-bar-bg';
        progressBarBg.style.cssText = 'position: absolute; bottom: 0; left: 0; right: 0; height: 16px; background: transparent; z-index: 30; pointer-events: none; cursor: pointer; opacity: 0; transition: opacity 0.2s ease;';

        const progressBarTrack = document.createElement('div');
        progressBarTrack.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(0,0,0,0.62);pointer-events:none;transition:height .14s ease,background .14s ease;';

        const progressBarFill = document.createElement('div');
        progressBarFill.id = 'fasttag-progress-bar-fill';
        progressBarFill.style.cssText = 'height: 100%; width: 0%; background: #6366f1; border-radius: 0 2px 2px 0; transition: width 0.08s linear;';
        progressBarTrack.appendChild(progressBarFill);
        progressBarBg.appendChild(progressBarTrack);

        const updateProgressBar = () => {
            if (currentMedia && currentMedia.tagName === 'VIDEO' && currentMedia.duration > 0 && isFinite(currentMedia.duration)) {
                const pct = Math.min(100, Math.max(0, (currentMedia.currentTime / currentMedia.duration) * 100));
                progressBarFill.style.width = `${pct}%`;
            }
        };

        let progressBarTimer = null;
        const showProgressBar = () => {
            if (!hasControllableVideo()) return;
            updateProgressBar();
            progressBarBg.style.opacity = '1';
            clearTimeout(progressBarTimer);
            if (!shiftHeld) {
                progressBarTimer = setTimeout(() => {
                    if (!isTimelineSeeking && !progressBarBg.matches(':hover')) progressBarBg.style.opacity = '0';
                }, 3500);
            }
        };

        let isTimelineSeeking = false;
        let timelineWasPlaying = false;
        let timelineMedia = null;
        const seekTimelineToPointer = event => {
            if (!hasControllableVideo()) return;
            const rect = progressBarBg.getBoundingClientRect();
            const target = calculateSeekTarget(event.clientX, rect.left, rect.width, currentMedia.duration);
            if (target === null) return;
            currentMedia.currentTime = target;
            updateProgressBar();
            progressBarBg.style.opacity = '1';
        };
        progressBarBg.addEventListener('pointerdown', event => {
            if (event.button !== 0 || !hasControllableVideo()) return;
            event.preventDefault();
            event.stopPropagation();
            isTimelineSeeking = true;
            timelineMedia = currentMedia;
            timelineWasPlaying = shouldResumeAfterTimelineSeek(
                currentMedia.paused,
                scrubbing && wasPlaying,
                shiftHeld,
                coverEditing
            );
            clearTimeout(resumeTimer);
            scrubbing = false;
            wasPlaying = false;
            clearTimeout(progressBarTimer);
            progressBarTrack.style.height = '7px';
            progressBarTrack.style.background = 'rgba(0,0,0,0.72)';
            try { currentMedia.pause(); } catch (error) {}
            try { progressBarBg.setPointerCapture(event.pointerId); } catch (error) {}
            seekTimelineToPointer(event);
        }, { signal });
        progressBarBg.addEventListener('pointermove', event => {
            if (!isTimelineSeeking) return;
            event.preventDefault();
            event.stopPropagation();
            seekTimelineToPointer(event);
        }, { signal });
        const finishTimelineSeek = (event, applyFinalPosition = true) => {
            if (!isTimelineSeeking) return;
            event?.preventDefault?.();
            event?.stopPropagation?.();
            if (applyFinalPosition) seekTimelineToPointer(event);
            isTimelineSeeking = false;
            try { progressBarBg.releasePointerCapture(event.pointerId); } catch (error) {}
            const mediaToResume = timelineMedia;
            if (timelineWasPlaying && mediaToResume === currentMedia && mediaToResume?.tagName === 'VIDEO') {
                mediaToResume.play().catch(() => {});
            }
            timelineWasPlaying = false;
            timelineMedia = null;
            progressBarTrack.style.height = progressBarBg.matches(':hover') ? '7px' : '4px';
            progressBarTrack.style.background = progressBarBg.matches(':hover') ? 'rgba(0,0,0,0.72)' : 'rgba(0,0,0,0.62)';
            showProgressBar();
        };
        progressBarBg.addEventListener('pointerup', finishTimelineSeek, { signal });
        progressBarBg.addEventListener('pointercancel', event => finishTimelineSeek(event, false), { signal });
        progressBarBg.addEventListener('lostpointercapture', event => finishTimelineSeek(event, false), { signal });
        window.addEventListener('pointerup', finishTimelineSeek, { signal });
        window.addEventListener('pointercancel', event => finishTimelineSeek(event, false), { signal });
        progressBarBg.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
        }, { signal });
        progressBarBg.addEventListener('mouseenter', () => {
            progressBarTrack.style.height = '7px';
            progressBarTrack.style.background = 'rgba(0,0,0,0.72)';
            showProgressBar();
        }, { signal });
        progressBarBg.addEventListener('mouseleave', () => {
            if (!isTimelineSeeking) {
                progressBarTrack.style.height = '4px';
                progressBarTrack.style.background = 'rgba(0,0,0,0.62)';
            }
            showProgressBar();
        }, { signal });

        // Floating Stream Cue Hint (appears once per session on switching to Full Video)
        const cueBadge = document.createElement('div');
        cueBadge.id = 'fasttag-scrub-cue-badge';
        cueBadge.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.85); z-index: 25; pointer-events: none; opacity: 0; transition: opacity 0.4s ease-out, transform 0.4s ease-out; display: flex; flex-direction: column; align-items: center; gap: 7px; user-select: none; white-space: nowrap;';
        cueBadge.innerHTML = `
            <div style="width: 86px; height: 74px; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1.5px solid rgba(255, 255, 255, 0.22); border-radius: 15px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 28px rgba(0,0,0,0.6), inset 0 0 0 1.5px rgba(8, 168, 138, 0.28);">
                <svg width="29" height="55" viewBox="0 0 24 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <!-- Static Top Arrow (Teal) -->
                    <path d="M7 5.5L12 1.5L17 5.5" stroke="#08a88a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>

                    <!-- Outer Capsule Body -->
                    <rect x="2.5" y="8.5" width="19" height="29" rx="9.5" stroke="#f8fafc" stroke-width="2.4"/>

                    <!-- Curved Horizontal Divider Arc -->
                    <path d="M2.5 19.5C6.5 22 17.5 22 21.5 19.5" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/>

                    <!-- Center Vertical Split Line -->
                    <line x1="12" y1="8.5" x2="12" y2="21" stroke="#f8fafc" stroke-width="2.4" stroke-linecap="round"/>

                    <!-- Animated Lordicon Teal Wheel Pill -->
                    <g>
                        <rect x="9.2" y="11.5" width="5.6" height="10" rx="2.8" stroke="#08a88a" stroke-width="2.2" fill="rgba(15, 23, 42, 0.6)">
                            <animateTransform attributeName="transform" type="translate" values="0,0; 0,3.5; 0,0" dur="1.2s" repeatCount="indefinite" />
                        </rect>
                    </g>

                    <!-- Static Bottom Arrow (Teal) -->
                    <path d="M7 40.5L12 44.5L17 40.5" stroke="#08a88a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div style="background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.24); border-radius: 20px; padding: 3px 10px; font-size: 11px; font-weight: 600; color: #ffffff; text-shadow: 0 1px 3px rgba(0,0,0,0.95); display: flex; align-items: center; gap: 5px; box-shadow: 0 4px 14px rgba(0,0,0,0.65);">
                <span style="color: #ffffff;">Scroll to scrub</span>
                <span style="opacity: 0.4;">•</span>
                <span style="color: #e2e8f0; font-weight: 500;">Hold <kbd style="background: rgba(255,255,255,0.18); padding: 0.5px 4px; border-radius: 3px; font-family: monospace; font-size: 10px; color: #38bdf8; border: 1px solid rgba(255,255,255,0.25);">Shift</kbd> to freeze</span>
            </div>
        `;

        let cueTimer = null;
        let cueDelayTimer = null;
        const showCueOnce = () => {
            if (hasShownScrubCueThisSession) return;
            if (getScrubCueCount() >= MAX_SCRUB_CUE_DISPLAYS) return;

            hasShownScrubCueThisSession = true;

            clearTimeout(cueDelayTimer);
            clearTimeout(cueTimer);
            cueBadge.style.transition = 'opacity 1.5s cubic-bezier(0.16, 1, 0.3, 1), transform 1.5s cubic-bezier(0.16, 1, 0.3, 1)';
            cueBadge.style.opacity = '0';
            cueBadge.style.transform = 'translate(-50%, -50%) scale(0.88)';

            // 3000ms (3.0s) breathing room for the stream video to transition & start playing first
            cueDelayTimer = setTimeout(() => {
                cueBadge.style.opacity = '1';
                cueBadge.style.transform = 'translate(-50%, -50%) scale(1)';
                incrementScrubCueCount();

                cueTimer = setTimeout(() => {
                    cueBadge.style.transition = 'opacity 0.9s cubic-bezier(0.2, 0.8, 0.4, 1), transform 0.9s cubic-bezier(0.2, 0.8, 0.4, 1)';
                    cueBadge.style.opacity = '0';
                    cueBadge.style.transform = 'translate(-50%, -50%) scale(0.9)';
                }, 4500);
            }, 3000);
        };
        const hideCueImmediate = () => {
            clearTimeout(cueTimer);
            cueBadge.style.transition = 'opacity 0.15s ease';
            cueBadge.style.opacity = '0';
        };

        // Controls row at top-right of media container
        const controlsRow = document.createElement('div');
        controlsRow.id = 'fasttag-media-controls-row';
        controlsRow.style.cssText = 'position: absolute; top: 5px; right: 5px; z-index: 20; display: flex; align-items: center; gap: 4px; pointer-events: auto;';

        // Floating Mode Toggle Pill (compact & clear)
        const pillBtn = document.createElement('div');
        pillBtn.id = 'fasttag-stream-toggle-pill';
        pillBtn.style.cssText = 'background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; padding: 2.5px 8px; font-size: 10px; font-weight: 600; cursor: pointer; user-select: none; display: flex; align-items: center; gap: 4px; opacity: 0.85; box-shadow: 0 2px 6px rgba(0,0,0,0.4); transition: all 0.15s ease; line-height: 1;';

        pillBtn.onmouseenter = () => {
            pillBtn.style.opacity = '1';
            pillBtn.style.background = '#6366f1';
            pillBtn.style.borderColor = '#818cf8';
            pillBtn.style.transform = 'scale(1.04)';
        };
        pillBtn.onmouseleave = () => {
            pillBtn.style.opacity = '0.85';
            pillBtn.style.background = 'rgba(15, 23, 42, 0.78)';
            pillBtn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            pillBtn.style.transform = 'scale(1)';
        };

        const updatePill = (mode) => {
            if (mode === 'stream') {
                pillBtn.style.display = 'none';
            } else {
                pillBtn.style.display = 'flex';
                pillBtn.innerHTML = '🎬 Full Video';
                pillBtn.removeAttribute('title');
                pillBtn.setAttribute('data-micro-tooltip', 'Switch to full scene video stream (Scroll to scrub, Hold Shift to freeze)');
            }
        };

        pillBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            renderMedia('stream');
        };

        // Popout Button (YouTube Picture-in-Picture overlapping screens icon)
        const popoutBtn = document.createElement('button');
        popoutBtn.type = 'button';
        popoutBtn.id = 'fasttag-stream-popout-btn';
        popoutBtn.style.cssText = 'background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); color: #ffffff; text-shadow: 0 1px 2px rgba(0,0,0,0.85); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; padding: 2px 7px; font-size: 11.5px; font-weight: 600; cursor: pointer; user-select: none; display: flex; align-items: center; justify-content: center; opacity: 0.85; box-shadow: 0 2px 6px rgba(0,0,0,0.4); transition: all 0.15s ease; line-height: 1; min-width: 23px; height: 20px;';
        popoutBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; pointer-events: none;">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" fill="none" stroke-width="2"></rect>
                <rect x="12" y="11" width="8" height="7" rx="1.5" fill="currentColor" stroke="none"></rect>
            </svg>
        `;
        popoutBtn.setAttribute('data-micro-tooltip', 'Pop out video into floating HUD');

        popoutBtn.onmouseenter = () => {
            popoutBtn.style.opacity = '1';
            popoutBtn.style.background = '#6366f1';
            popoutBtn.style.borderColor = '#818cf8';
            popoutBtn.style.transform = 'scale(1.08)';
        };
        popoutBtn.onmouseleave = () => {
            popoutBtn.style.opacity = '0.85';
            popoutBtn.style.background = 'rgba(15, 23, 42, 0.78)';
            popoutBtn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            popoutBtn.style.transform = 'scale(1)';
        };

        controlsRow.appendChild(pillBtn);
        controlsRow.appendChild(popoutBtn);

        const togglePopout = (enable) => {
            if (enable) {
                isVideoPoppedOut = true;
                setVideoHudPersistedOpen(true);
                ftLog('ACTION', 'HUD', 'Video HUD popped out');

                let isDragging = false;
                let hasDragged = false;
                let dragStartX = 0;
                let dragStartY = 0;
                let startLeft = 0;
                let startTop = 0;

                const onHudMouseMove = (e) => {
                    if (!floatingHudElement) return;
                    const dx = e.clientX - dragStartX;
                    const dy = e.clientY - dragStartY;
                    if (!isDragging && Math.hypot(dx, dy) > 4) {
                        isDragging = true;
                        hasDragged = true;
                        floatingHudElement.style.cursor = 'grabbing';
                        document.body.style.cursor = 'grabbing';
                        document.body.style.userSelect = 'none';
                    }
                    if (isDragging) {
                        const newLeft = Math.max(8, Math.min(window.innerWidth - floatingHudElement.offsetWidth - 8, startLeft + dx));
                        const newTop = Math.max(8, Math.min(window.innerHeight - floatingHudElement.offsetHeight - 8, startTop + dy));
                        floatingHudElement.style.left = `${newLeft}px`;
                        floatingHudElement.style.top = `${newTop}px`;
                        floatingHudElement.style.right = 'auto';
                        floatingHudPosition = { top: `${newTop}px`, left: `${newLeft}px` };
                        try {
                            localStorage.setItem('fasttag_video_hud_pos', JSON.stringify(floatingHudPosition));
                        } catch (e) {}
                    }
                };

                const onHudMouseUp = () => {
                    document.removeEventListener('mousemove', onHudMouseMove);
                    document.removeEventListener('mouseup', onHudMouseUp);
                    if (floatingHudElement) {
                        floatingHudElement.style.cursor = 'default';
                    }
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                    if (isDragging && floatingHudElement) {
                        floatingHudSize = { width: `${floatingHudElement.offsetWidth}px`, height: `${floatingHudElement.offsetHeight}px` };
                        try {
                            localStorage.setItem('fasttag_video_hud_size', JSON.stringify(floatingHudSize));
                        } catch (e) {}
                    }
                    setTimeout(() => { isDragging = false; hasDragged = false; }, 60);
                };

                if (!floatingHudElement || !document.body.contains(floatingHudElement)) {
                    floatingHudElement = document.createElement('div');
                    floatingHudElement.id = 'fasttag-floating-video-hud';
                    const defaultSize = getDefaultPopoutSize(hostContainer);
                    const defaultPos = getInitialPopoutPosition(parseInt(defaultSize.width, 10) || 600, parseInt(defaultSize.height, 10) || 338);

                    let finalWidth = defaultPos.width || defaultSize.width;
                    let finalHeight = defaultPos.height || defaultSize.height;
                    let finalLeft = defaultPos.left;
                    let finalTop = defaultPos.top;
                    let finalRight = defaultPos.right;

                    let savedPos = floatingHudPosition;
                    if (!savedPos) {
                        try {
                            savedPos = JSON.parse(localStorage.getItem('fasttag_video_hud_pos') || 'null');
                        } catch (e) {}
                    }
                    let savedSize = floatingHudSize;
                    if (!savedSize) {
                        try {
                            savedSize = JSON.parse(localStorage.getItem('fasttag_video_hud_size') || 'null');
                        } catch (e) {}
                    }

                    if (savedPos && savedPos.left && savedPos.top) {
                        const pLeft = parseInt(savedPos.left, 10);
                        const pTop = parseInt(savedPos.top, 10);
                        const pW = savedSize?.width ? parseInt(savedSize.width, 10) : (parseInt(defaultSize.width, 10) || 600);
                        const pH = savedSize?.height ? parseInt(savedSize.height, 10) : (parseInt(defaultSize.height, 10) || 338);
                        if (!isNaN(pLeft) && !isNaN(pTop)) {
                            finalLeft = `${Math.max(8, Math.min(window.innerWidth - pW - 8, pLeft))}px`;
                            finalTop = `${Math.max(8, Math.min(window.innerHeight - pH - 8, pTop))}px`;
                            finalRight = null;
                            finalWidth = `${pW}px`;
                            finalHeight = `${pH}px`;
                            floatingHudPosition = { left: finalLeft, top: finalTop };
                            if (savedSize) floatingHudSize = savedSize;
                        }
                    }

                    floatingHudElement.style.cssText = `position: fixed; top: ${finalTop}; ${finalLeft ? `left: ${finalLeft};` : `right: ${finalRight};`} width: ${finalWidth}; height: ${finalHeight}; min-width: 260px; min-height: 150px; max-width: 90vw; max-height: 85vh; z-index: 1000000; background: #0f172a; border: 2px solid #000000; border-radius: 10px; box-shadow: 0 20px 50px rgba(0,0,0,0.85); overflow: hidden; resize: both; cursor: default;`;
                    document.body.appendChild(floatingHudElement);

                    // Draggable logic directly on floating video
                    floatingHudElement.onmousedown = (e) => {
                        e.stopPropagation();
                        if (e.target && e.target.closest('#fasttag-stream-toggle-pill')) {
                            return;
                        }
                        const rect = floatingHudElement.getBoundingClientRect();
                        // Don't initiate drag if clicking in the bottom-right corner resize zone
                        const isResizeZone = (rect.right - e.clientX) <= 24 && (rect.bottom - e.clientY) <= 24;
                        if (isResizeZone) {
                            return;
                        }

                        dragStartX = e.clientX;
                        dragStartY = e.clientY;
                        startLeft = floatingHudElement.offsetLeft;
                        startTop = floatingHudElement.offsetTop;
                        isDragging = false;
                        document.addEventListener('mousemove', onHudMouseMove);
                        document.addEventListener('mouseup', onHudMouseUp);
                    };

                    document.body.appendChild(floatingHudElement);

                    const resizeObserver = new ResizeObserver((entries) => {
                        for (let entry of entries) {
                            if (floatingHudElement && isVideoPoppedOut) {
                                floatingHudSize = { width: `${floatingHudElement.offsetWidth}px`, height: `${floatingHudElement.offsetHeight}px` };
                                try {
                                    localStorage.setItem('fasttag_video_hud_size', JSON.stringify(floatingHudSize));
                                } catch (e) {}
                            }
                        }
                    });
                    resizeObserver.observe(floatingHudElement);
                }

                // Smoothly swap content inside floating window
                floatingHudElement.innerHTML = '';
                mediaContainer.style.cursor = 'default';
                mediaContainer.title = '';
                floatingHudElement.appendChild(mediaContainer);

                // Switch popout button to PiP Dock button directly on floating video player
                popoutBtn.style.display = 'flex';
                popoutBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; pointer-events: none;">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" fill="none" stroke-width="2"></rect>
                        <path d="M12 12l-4 4m0 0h3.5m-3.5 0v-3.5" stroke="currentColor" stroke-width="2"></path>
                    </svg>
                `;
                popoutBtn.setAttribute('data-micro-tooltip', 'Dock video back into popup');

                // 5-Second Inactivity Fade for Floating Video Controls
                let controlsFadeTimer = null;
                const resetControlsFade = () => {
                    if (!isVideoPoppedOut) return;
                    clearTimeout(controlsFadeTimer);
                    controlsRow.style.transition = 'opacity 0.2s ease';
                    controlsRow.style.opacity = '0.9';
                    controlsFadeTimer = setTimeout(() => {
                        if (isVideoPoppedOut) {
                            controlsRow.style.transition = 'opacity 1s ease';
                            controlsRow.style.opacity = '0.15';
                        }
                    }, 5000);
                };

                floatingHudElement.onmousemove = resetControlsFade;
                floatingHudElement.onmouseenter = resetControlsFade;
                controlsRow.onmouseenter = () => {
                    clearTimeout(controlsFadeTimer);
                    controlsRow.style.transition = 'opacity 0.15s ease';
                    controlsRow.style.opacity = '1';
                };
                controlsRow.onmouseleave = resetControlsFade;

                resetControlsFade();

                // Collapse preview container completely so tables get 100% full height
                hostContainer.innerHTML = '';
                hostContainer.style.display = 'none';
                hostContainer.style.margin = '0';
                hostContainer.style.height = '0';
                hostContainer.style.maxHeight = '0';
                hostContainer.onclick = null;
            } else {
                isVideoPoppedOut = false;
                setVideoHudPersistedOpen(false);
                ftLog('ACTION', 'HUD', 'Video HUD docked back into popup');
                controlsRow.style.transition = 'all 0.15s ease';
                controlsRow.style.opacity = '0.9';
                controlsRow.onmouseenter = null;
                controlsRow.onmouseleave = null;
                if (floatingHudElement) {
                    floatingHudElement.onmousemove = null;
                    floatingHudElement.onmouseenter = null;
                    floatingHudElement.onmouseleave = null;
                    floatingHudElement.remove();
                    floatingHudElement = null;
                }
                hostContainer.onclick = null;
                hostContainer.innerHTML = '';
                hostContainer.style.display = 'block';
                hostContainer.style.position = 'relative';
                hostContainer.style.width = '100%';
                hostContainer.style.height = 'auto';
                hostContainer.style.aspectRatio = '16 / 9';
                const isEvHost = hostContainer.id === 'everything-preview-container';
                hostContainer.style.maxHeight = isEvHost ? '205px' : '280px';
                hostContainer.style.margin = '0 0 8px 0';
                hostContainer.style.borderRadius = '8px';
                hostContainer.style.overflow = 'hidden';
                hostContainer.style.border = 'none';
                hostContainer.style.background = '#0f172a';
                hostContainer.style.boxShadow = 'none';
                hostContainer.style.padding = '0';
                hostContainer.style.cursor = 'pointer';
                hostContainer.title = '';
                mediaContainer.style.cursor = 'pointer';
                mediaContainer.title = 'Click to open scene in new tab';
                hostContainer.appendChild(mediaContainer);
                popoutBtn.style.display = 'flex';
                popoutBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: block; pointer-events: none;">
                        <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" fill="none" stroke-width="2"></rect>
                        <rect x="12" y="11" width="8" height="7" rx="1.5" fill="currentColor" stroke="none"></rect>
                    </svg>
                `;
                popoutBtn.setAttribute('data-micro-tooltip', 'Pop out video into floating HUD');
            }
        };

        popoutBtn.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            togglePopout(!isVideoPoppedOut);
        };

        const detachWheel = () => {
            if (wheelListenerAttached) {
                mediaContainer.removeEventListener('wheel', onWheel);
                wheelListenerAttached = false;
            }
        };

        const attachWheel = () => {
            if (!wheelListenerAttached && hasControllableVideo()) {
                mediaContainer.addEventListener('wheel', onWheel, { passive: false, signal });
                wheelListenerAttached = true;
            }
        };

        const endScrubbing = () => {
            scrubbing = false;
            if (currentMedia && currentMedia.tagName === 'VIDEO' && !shiftHeld) {
                try { currentMedia.loop = !!originalLoop; } catch (err) {}
                if (!coverEditing || wasPlaying) {
                    currentMedia.play().catch(() => {});
                    wasPlaying = false;
                }
            }
        };

        let lastWheelTimestamp = 0;

        var onWheel = (e) => {
            if (!hasControllableVideo()) return;
            e.preventDefault();
            hideCueImmediate();
            if (!currentMedia || currentMedia.tagName !== 'VIDEO' || currentMedia.duration <= 0 || !isFinite(currentMedia.duration)) return;

            // Handle both vertical deltaY and horizontal deltaX across all mouse types
            const rawDelta = getDominantWheelDelta(e.deltaX, e.deltaY);
            if (rawDelta === null) return;

            const now = performance.now();
            const timeDelta = lastWheelTimestamp > 0 ? (now - lastWheelTimestamp) : 300;
            lastWheelTimestamp = now;

            const scrubSpeeds = getScrubSpeeds();

            const step = selectScrubStep(scrubSpeeds, timeDelta, shiftHeld);
            const notches = getWheelNotches(rawDelta, e.deltaMode);
            if (notches === null) return;

            if (!scrubbing) {
                scrubbing = true;
                originalLoop = !!currentMedia.loop;
                try { currentMedia.loop = false; } catch (err) {}
            }

            if (!currentMedia.paused && !currentMedia.ended) {
                wasPlaying = true;
                try { currentMedia.pause(); } catch (err) {}
            }

            currentMedia.currentTime = calculateScrubTarget(currentMedia.currentTime, currentMedia.duration, notches, step);
            clearTimeout(resumeTimer);

            showProgressBar();

            // If Shift is NOT held to freeze, automatically resume playback 300ms after scrolling stops
            if (!shiftHeld) {
                resumeTimer = setTimeout(endScrubbing, 300);
            }
        };

        const renderMedia = (mode) => {
            if (signal.aborted) return;
            currentMode = mode;
            progressBarBg.style.pointerEvents = 'none';
            updatePill(mode);

            // Teardown previous media
            if (currentMedia) {
                if (currentMedia.tagName === 'VIDEO') {
                    try {
                        currentMedia.pause();
                        currentMedia.onerror = null;
                        currentMedia.removeAttribute('src');
                        currentMedia.load();
                    } catch (e) {}
                }
                currentMedia.remove();
                currentMedia = null;
                currentMediaSource = '';
            }

            detachWheel();
            clearTimeout(resumeTimer);
            clearTimeout(progressBarTimer);

            if (mode === 'stream') {
                streamCaptureFailure = '';
                if (!streamUrl) {
                    streamCaptureFailure = 'This scene has no full-video stream. Upload or paste an image instead.';
                    showToast('Stream URL not available', 'warning');
                    renderMedia('preview');
                    return;
                }

                showCueOnce();

                const video = document.createElement('video');
                video.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain; background: #0f172a; pointer-events: none;';
                video.muted = true;
                video.defaultMuted = true;
                video.volume = 0;
                video.autoplay = true;
                video.loop = true;
                video.playsInline = true;
                video.preload = 'auto';
                video.setAttribute('playsinline', 'true');
                video.setAttribute('webkit-playsinline', 'true');
                video.setAttribute('muted', '');
                video.src = streamUrl;

                let hasRetriedStream = false;
                video.onerror = () => {
                    // If transient network glitch or drive spin-up delay, retry once after 800ms
                    if (!hasRetriedStream && video.error && (video.error.code === 2 || video.error.code === 1)) {
                        hasRetriedStream = true;
                        setTimeout(() => {
                            if (currentMedia === video && !signal.aborted) {
                                video.load();
                                video.play().catch(() => {});
                            }
                        }, 800);
                        return;
                    }
                    const errCode = video.error ? video.error.code : 0;
                    const msg = errCode === 4
                        ? 'Full video format not supported by browser — showing preview'
                        : 'Full stream unavailable — showing preview';
                    streamCaptureFailure = errCode === 4
                        ? 'This video format cannot be played by the browser. Upload or paste an image instead.'
                        : 'The full-video stream is unavailable. Upload or paste an image instead.';
                    showToast(msg, 'info', 3000);
                    renderMedia('preview');
                };

                video.addEventListener('timeupdate', updateProgressBar);
                video.onloadedmetadata = () => {
                    streamCaptureFailure = '';
                    showProgressBar();
                };

                currentMedia = video;
                currentMediaSource = 'full-video';
                mediaContainer.insertBefore(video, mediaContainer.firstChild);
                progressBarBg.style.pointerEvents = 'auto';
                video.load();
                video.play().catch(() => {});
                if (isHovered) attachWheel();
            } else {
                hideCueImmediate();
                progressBarBg.style.opacity = '0';
                progressBarFill.style.width = '0%';

                // Preview mode. The /preview endpoint can return MP4 or animated WebP,
                // so try video first and fall back to an image if decoding fails.
                if (previewUrl) {
                    const forceImage = mode === 'preview-image';
                    const isVideo = !forceImage && /\/preview(?:[?#]|$)|\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(previewUrl);
                    if (isVideo) {
                        const video = document.createElement('video');
                        video.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain; background: #0f172a; pointer-events: none;';
                        video.muted = true;
                        video.defaultMuted = true;
                        video.volume = 0;
                        video.autoplay = true;
                        video.loop = true;
                        video.playsInline = true;
                        video.preload = 'auto';
                        video.setAttribute('playsinline', 'true');
                        video.setAttribute('webkit-playsinline', 'true');
                        video.setAttribute('muted', '');
                        video.src = previewUrl;

                        video.onerror = () => {
                            if (currentMedia === video) renderMedia('preview-image');
                        };
                        video.addEventListener('loadedmetadata', () => {
                            if (coverEditing && currentMedia === video) {
                                progressBarBg.style.pointerEvents = 'auto';
                                showProgressBar();
                                if (isHovered) attachWheel();
                            }
                        });
                        video.addEventListener('timeupdate', updateProgressBar);

                        currentMedia = video;
                        currentMediaSource = 'preview-video';
                        mediaContainer.insertBefore(video, mediaContainer.firstChild);
                        video.load();
                        video.play().catch(() => {});
                    } else {
                        // Image/webp preview
                        const img = document.createElement('img');
                        img.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain; background: #0f172a; pointer-events: none;';
                        img.alt = 'Scene preview';
                        img.loading = 'eager';
                        img.src = previewUrl;
                        img.onerror = () => {
                            if (streamUrl && !streamCaptureFailure) {
                                renderMedia('stream');
                            } else {
                                renderCoverOnly();
                            }
                        };
                        currentMedia = img;
                        currentMediaSource = 'preview-image';
                        mediaContainer.insertBefore(img, mediaContainer.firstChild);
                    }
                } else if (streamUrl) {
                    renderMedia('stream');
                } else {
                    renderCoverOnly();
                }
            }
        };

        const renderCoverOnly = () => {
            hideCueImmediate();
            progressBarBg.style.opacity = '0';
            clearTimeout(progressBarTimer);
            if (currentMedia) {
                if (currentMedia.tagName === 'VIDEO') {
                    try { currentMedia.pause(); currentMedia.removeAttribute('src'); currentMedia.load(); } catch (e) {}
                }
                currentMedia.remove();
                currentMedia = null;
            }
            if (!coverUrl) {
                hostContainer.style.display = 'none';
                return;
            }
            const img = document.createElement('img');
            img.style.cssText = 'display: block; width: 100%; height: 100%; object-fit: contain; background: #0f172a; pointer-events: none;';
            img.alt = 'Scene cover';
            img.loading = 'eager';
            img.onerror = () => {
                hostContainer.style.display = 'none';
            };
            img.src = coverUrl;
            currentMedia = img;
            currentMediaSource = 'cover';
            mediaContainer.insertBefore(img, mediaContainer.firstChild);
        };

        // Append Progress Bar, Cue Badge, and Controls Row into mediaContainer
        mediaContainer.appendChild(progressBarBg);
        mediaContainer.appendChild(cueBadge);
        mediaContainer.appendChild(controlsRow);

        // Hover & Key Listeners for Scrubbing & Hold-to-Freeze attached to mediaContainer
        mediaContainer.onmouseenter = () => {
            isHovered = true;
            if (hasControllableVideo()) {
                attachWheel();
            }
        };

        mediaContainer.onmouseleave = () => {
            isHovered = false;
            detachWheel();
            if (shiftHeld) {
                shiftHeld = false;
                clearTimeout(resumeTimer);
                clearTimeout(progressBarTimer);
                progressBarBg.style.opacity = '0';
                if (currentMedia && currentMedia.tagName === 'VIDEO') {
                    if (!coverEditing || wasPlaying) currentMedia.play().catch(() => {});
                }
            }
            endScrubbing();
        };

        const onKeyDown = (e) => {
            if (!hasControllableVideo()) return;
            if (e.key === 'Shift' && !shiftHeld && isHovered) {
                shiftHeld = true;
                hideCueImmediate();
                clearTimeout(resumeTimer);
                clearTimeout(progressBarTimer);
                progressBarBg.style.opacity = '1';
                updateProgressBar();
                if (currentMedia && currentMedia.tagName === 'VIDEO') {
                    if (!currentMedia.paused && !currentMedia.ended) {
                        wasPlaying = true;
                        try { currentMedia.pause(); } catch (err) {}
                    }
                }
            }
        };

        const onKeyUp = (e) => {
            if (!hasControllableVideo()) return;
            if (e.key === 'Shift' && shiftHeld) {
                shiftHeld = false;
                clearTimeout(resumeTimer);
                clearTimeout(progressBarTimer);
                progressBarTimer = setTimeout(() => {
                    if (!isTimelineSeeking && !progressBarBg.matches(':hover')) progressBarBg.style.opacity = '0';
                }, 3500);
                if (currentMedia && currentMedia.tagName === 'VIDEO') {
                    try { currentMedia.loop = !!originalLoop; } catch (err) {}
                    if (!coverEditing || wasPlaying) currentMedia.play().catch(() => {});
                    wasPlaying = false;
                }
            }
        };

        const onWindowBlur = () => {
            if (shiftHeld) {
                shiftHeld = false;
                clearTimeout(resumeTimer);
                clearTimeout(progressBarTimer);
                progressBarBg.style.opacity = '0';
                if (currentMedia && currentMedia.tagName === 'VIDEO') {
                    if (!coverEditing || wasPlaying) currentMedia.play().catch(() => {});
                }
            }
        };

        document.addEventListener('keydown', onKeyDown, { signal });
        document.addEventListener('keyup', onKeyUp, { signal });
        window.addEventListener('blur', onWindowBlur, { signal });

        window._fastTagActiveToggleVideoMode = () => {
            if (currentMode === 'stream') {
                renderMedia('preview');
                showToast('Switched to Video Preview', 'info', 1500);
            } else {
                renderMedia('stream');
                showToast('Streaming Full Video', 'info', 1500);
            }
        };

        signal.addEventListener('abort', () => {
            if (window._fastTagActiveToggleVideoMode) {
                window._fastTagActiveToggleVideoMode = null;
            }
        });

        const mediaController = {
            switchToFullVideo: () => renderMedia('stream'),
            getCurrentCaptureMedia: () => {
                if (currentMediaSource === 'full-video' && currentMedia?.tagName === 'VIDEO') return currentMedia;
                if (coverEditing && ['preview-video', 'preview-image'].includes(currentMediaSource)) return currentMedia;
                return null;
            },
            getCoverUrl: () => coverUrl,
            mountForCoverEditor: target => {
                if (!target) return;
                coverEditorWasPoppedOut = isVideoPoppedOut;
                if (isVideoPoppedOut) togglePopout(false);
                coverEditorPreviousMode = currentMode;
                coverEditing = true;
                hostContainer.style.display = 'none';
                hostContainer.style.height = '0';
                hostContainer.style.maxHeight = '0';
                hostContainer.style.margin = '0';
                mediaContainer.style.cursor = 'default';
                mediaContainer.title = '';
                const launcher = mediaContainer.querySelector('#fasttag-cover-editor-btn');
                if (launcher) launcher.style.display = 'none';
                popoutBtn.style.display = 'none';
                target.innerHTML = '';
                target.appendChild(mediaContainer);
            },
            releaseFromCoverEditor: (releaseOptions = {}) => {
                coverEditing = false;
                if (!hostContainer.isConnected) return;
                progressBarBg.style.pointerEvents = currentMode === 'stream' ? 'auto' : 'none';
                if (currentMode !== 'stream') progressBarBg.style.opacity = '0';
                detachWheel();
                if (releaseOptions.forNavigation) {
                    if (currentMedia?.tagName === 'VIDEO') {
                        try { currentMedia.pause(); } catch (error) {}
                    }
                    coverEditorPreviousMode = null;
                    coverEditorWasPoppedOut = false;
                    return;
                }
                hostContainer.innerHTML = '';
                hostContainer.style.display = 'block';
                hostContainer.style.position = 'relative';
                hostContainer.style.width = '100%';
                hostContainer.style.height = 'auto';
                hostContainer.style.aspectRatio = '16 / 9';
                hostContainer.style.maxHeight = '205px';
                hostContainer.style.margin = '0 0 8px 0';
                hostContainer.style.borderRadius = '8px';
                hostContainer.style.overflow = 'hidden';
                hostContainer.style.background = '#0f172a';
                hostContainer.style.padding = '0';
                hostContainer.style.cursor = 'pointer';
                mediaContainer.style.cursor = 'pointer';
                mediaContainer.title = 'Click to open scene in new tab';
                hostContainer.appendChild(mediaContainer);
                const launcher = mediaContainer.querySelector('#fasttag-cover-editor-btn');
                if (launcher) launcher.style.display = 'flex';
                popoutBtn.style.display = 'flex';
                const restoreMode = coverEditorPreviousMode;
                const restorePopout = coverEditorWasPoppedOut;
                coverEditorPreviousMode = null;
                coverEditorWasPoppedOut = false;
                if (restoreMode && restoreMode !== currentMode) renderMedia(restoreMode);
                if (restorePopout) togglePopout(true);
            },
            pause: () => {
                const video = hasControllableVideo() ? currentMedia : null;
                if (!video) return false;
                clearTimeout(resumeTimer);
                wasPlaying = false;
                try { video.pause(); } catch (error) {}
                return true;
            },
            play: () => {
                const video = hasControllableVideo() ? currentMedia : null;
                if (!video) return false;
                clearTimeout(resumeTimer);
                video.play().catch(() => {});
                return true;
            },
            stepBy: seconds => {
                const video = hasControllableVideo() ? currentMedia : null;
                if (!video || !isFinite(video.duration)) return false;
                clearTimeout(resumeTimer);
                wasPlaying = false;
                try { video.pause(); } catch (error) {}
                video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + Number(seconds || 0)));
                showProgressBar();
                return true;
            },
            getPlaybackState: () => {
                const video = hasControllableVideo() ? currentMedia : null;
                return video ? {
                    available: true,
                    paused: video.paused,
                    currentTime: Number(video.currentTime || 0),
                    duration: Number(video.duration || 0)
                } : { available: false, paused: true, currentTime: 0, duration: 0 };
            },
            getCaptureState: () => {
                if (currentMediaSource === 'full-video') {
                    const video = currentMedia?.tagName === 'VIDEO' ? currentMedia : null;
                    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
                        return { available: false, reason: 'Loading the full video for frame capture…', source: 'full-video' };
                    }
                    return { available: true, reason: '', source: 'full-video' };
                }
                if (coverEditing && currentMediaSource === 'preview-video') {
                    const ready = currentMedia?.readyState >= 2 && currentMedia.videoWidth && currentMedia.videoHeight;
                    return ready
                        ? { available: true, reason: 'Full video unavailable — using the lower-resolution MP4 preview.', source: 'preview-video' }
                        : { available: false, reason: 'Loading the MP4 preview…', source: 'preview-video' };
                }
                if (coverEditing && currentMediaSource === 'preview-image') {
                    const ready = currentMedia?.complete && currentMedia.naturalWidth && currentMedia.naturalHeight;
                    return ready
                        ? { available: true, reason: 'Full video unavailable — capture the currently visible preview frame.', source: 'preview-image' }
                        : { available: false, reason: 'Loading the animated preview…', source: 'preview-image' };
                }
                return { available: false, reason: streamCaptureFailure || 'No playable video or preview is available. Upload, paste or drop an image instead.', source: '' };
            }
        };
        hostContainer._fastTagMediaController = mediaController;
        if (isEverythingHost) {
            FastTagCoverEditor.mountLauncher({
                container: controlsRow,
                beforeElement: popoutBtn,
                hostElement: hostContainer,
                anchorElement: hostContainer.closest('form') || hostContainer,
                sceneId,
                currentCoverUrl: coverUrl,
                mediaController,
                onSaved: async saveOptions => {
                    if (!saveOptions?.keepEditorOpen && !signal.aborted) await attachScenePreview(hostContainer, sceneId, cardElement);
                }
            });
        }
        signal.addEventListener('abort', () => {
            FastTagCoverEditor.closeForHost(hostContainer);
            if (hostContainer._fastTagMediaController === mediaController) delete hostContainer._fastTagMediaController;
        }, { once: true });

        // Initial render (honors Always Play Full Video setting)
        renderMedia(getAlwaysPlayFullVideo() ? 'stream' : 'preview');

        // Initial Popout State sync
        if (isVideoPoppedOut || isVideoHudPersistedOpen()) {
            togglePopout(true);
        } else {
            hostContainer.appendChild(mediaContainer);
        }
    }


    root.FastTag = root.FastTag || {};
    root.FastTag.preview = Object.freeze({
        configure,
        getDominantWheelDelta,
        getWheelNotches,
        selectScrubStep,
        calculateScrubTarget,
        calculateSeekTarget,
        shouldResumeAfterTimelineSeek,
        getDefaultPopoutSize,
        calculateVideoPopoutPosition,
        extractMediaUrlsFromCard,
        toRelativeMediaUrl,
        fetchSceneMediaUrls,
        attachScenePreview,
        closeFloatingVideoHud,
        abortCurrentPreview,
        resetSessionCue,
        resetLayoutState,
        isPoppedOut,
        getFloatingHudElement
    });
}(typeof window !== 'undefined' ? window : globalThis));
