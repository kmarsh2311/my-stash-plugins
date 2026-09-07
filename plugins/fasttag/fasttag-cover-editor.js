(function initializeFastTagCoverEditor(root) {
    'use strict';

    const DEFAULT_MAX_SOURCE_BYTES = 25 * 1024 * 1024;
    const DEFAULT_MAX_DIMENSION = 1920;
    const DEFAULT_JPEG_QUALITY = 0.9;
    const DEFAULT_EDITOR_WIDTH = 450;
    const DEFAULT_EDITOR_HEIGHT = 740;
    const DEFAULT_COMPACT_EDITOR_HEIGHT = 545;
    const EDITOR_SIZE_STORAGE_KEY = 'fasttag_cover_editor_size';
    const COMPACT_EDITOR_SIZE_STORAGE_KEY = 'fasttag_cover_editor_size_compact_v3';
    let dependencies = null;
    let activeEditor = null;

    function configure(options) {
        dependencies = options || null;
    }

    function calculateImageSize(width, height, maxDimension = DEFAULT_MAX_DIMENSION) {
        const sourceWidth = Number(width);
        const sourceHeight = Number(height);
        const limit = Math.max(1, Number(maxDimension) || DEFAULT_MAX_DIMENSION);
        if (!(sourceWidth > 0) || !(sourceHeight > 0)) return { width: 0, height: 0 };
        const scale = Math.min(1, limit / Math.max(sourceWidth, sourceHeight));
        return {
            width: Math.max(1, Math.round(sourceWidth * scale)),
            height: Math.max(1, Math.round(sourceHeight * scale))
        };
    }

    function validateImageBlob(blob, maxBytes = DEFAULT_MAX_SOURCE_BYTES) {
        if (!blob) return 'No image was provided.';
        if (!String(blob.type || '').toLowerCase().startsWith('image/')) return 'Choose an image file.';
        if (Number(blob.size || 0) > maxBytes) return `The image is larger than ${Math.round(maxBytes / 1048576)} MB.`;
        return '';
    }

    function findClipboardImage(items) {
        return Array.from(items || []).find(item => String(item?.type || '').toLowerCase().startsWith('image/')) || null;
    }

    function escapeAttribute(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function formatTime(seconds) {
        const value = Number(seconds);
        if (!isFinite(value) || value < 0) return '0:00';
        const total = Math.floor(value);
        const hours = Math.floor(total / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        const secs = String(total % 60).padStart(2, '0');
        return hours > 0
            ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
            : `${minutes}:${secs}`;
    }

    function resolveStepSeconds(direction, shiftKey = false, frameDuration = 1 / 30) {
        const sign = Number(direction) < 0 ? -1 : 1;
        return sign * (shiftKey ? Math.max(0, Number(frameDuration) || (1 / 30)) : 1);
    }

    function readBlobAsDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('The image could not be read.'));
            reader.readAsDataURL(blob);
        });
    }

    function loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('The selected image could not be decoded by this browser.'));
            image.src = dataUrl;
        });
    }

    function canvasToDataUrl(source, width, height, quality = DEFAULT_JPEG_QUALITY) {
        const size = calculateImageSize(width, height);
        if (!size.width || !size.height) throw new Error('The image has invalid dimensions.');
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('This browser could not prepare the cover image.');
        context.fillStyle = '#000000';
        context.fillRect(0, 0, size.width, size.height);
        context.drawImage(source, 0, 0, size.width, size.height);
        return canvas.toDataURL('image/jpeg', quality);
    }

    async function normalizeImageBlob(blob) {
        const validationError = validateImageBlob(blob);
        if (validationError) throw new Error(validationError);
        const originalDataUrl = await readBlobAsDataUrl(blob);
        const image = await loadImage(originalDataUrl);
        return canvasToDataUrl(image, image.naturalWidth || image.width, image.naturalHeight || image.height);
    }

    function captureMediaFrame(media) {
        const tagName = String(media?.tagName || '').toUpperCase();
        const isVideo = tagName === 'VIDEO';
        const isImage = tagName === 'IMG';
        if (!isVideo && !isImage) throw new Error('No video or preview frame is available for capture.');
        const width = Number(isVideo ? media.videoWidth : media.naturalWidth) || 0;
        const height = Number(isVideo ? media.videoHeight : media.naturalHeight) || 0;
        const ready = isVideo ? Number(media.readyState || 0) >= 2 : Boolean(media.complete);
        if (!ready || !width || !height) {
            throw new Error(`Wait for the ${isVideo ? 'video' : 'preview'} frame to finish loading.`);
        }
        try {
            return canvasToDataUrl(media, width, height);
        } catch (error) {
            if (error?.name === 'SecurityError') {
                throw new Error('This frame is protected from browser capture. Upload, paste or drop an image instead.');
            }
            throw error;
        }
    }

    const captureVideoFrame = captureMediaFrame;

    function resolveEditorSize(savedSize, viewportWidth, viewportHeight, compactMode = false) {
        const availableWidth = Math.max(300, Number(viewportWidth || 0) - 24);
        const availableHeight = Math.max(320, Number(viewportHeight || 0) - 24);
        const minWidth = Math.min(360, availableWidth);
        const minHeight = Math.min(420, availableHeight);
        const requestedWidth = Number(savedSize?.width) || DEFAULT_EDITOR_WIDTH;
        const requestedHeight = Number(savedSize?.height) || (compactMode ? DEFAULT_COMPACT_EDITOR_HEIGHT : DEFAULT_EDITOR_HEIGHT);
        return {
            width: Math.round(Math.max(minWidth, Math.min(availableWidth, requestedWidth))),
            height: Math.round(Math.max(minHeight, Math.min(availableHeight, requestedHeight))),
            minWidth: Math.round(minWidth),
            minHeight: Math.round(minHeight),
            maxWidth: Math.round(availableWidth),
            maxHeight: Math.round(availableHeight)
        };
    }

    function readSavedEditorSize(compactMode = false) {
        try {
            const storageKey = compactMode ? COMPACT_EDITOR_SIZE_STORAGE_KEY : EDITOR_SIZE_STORAGE_KEY;
            const parsed = JSON.parse(root.localStorage?.getItem(storageKey) || 'null');
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            return null;
        }
    }

    function saveEditorSize(element, compactMode = false) {
        if (!element) return;
        try {
            const storageKey = compactMode ? COMPACT_EDITOR_SIZE_STORAGE_KEY : EDITOR_SIZE_STORAGE_KEY;
            root.localStorage?.setItem(storageKey, JSON.stringify({
                width: Math.round(element.offsetWidth),
                height: Math.round(element.offsetHeight)
            }));
        } catch (error) {}
    }

    function positionEditor(element, anchorElement, compactMode = false) {
        const size = resolveEditorSize(readSavedEditorSize(compactMode), root.innerWidth, root.innerHeight, compactMode);
        const { width, height } = size;
        const margin = 12;
        const anchor = anchorElement?.getBoundingClientRect?.();
        let left = anchor ? anchor.left - width - margin : margin;
        if (left < margin && anchor && anchor.right + width + margin <= root.innerWidth) left = anchor.right + margin;
        left = Math.max(margin, Math.min(root.innerWidth - width - margin, left));
        const top = Math.max(margin, Math.min(root.innerHeight - height - margin, anchor?.top || 60));
        element.style.left = `${Math.round(left)}px`;
        element.style.top = `${Math.round(top)}px`;
        element.style.width = `${Math.round(width)}px`;
        element.style.height = `${Math.round(height)}px`;
        element.style.minWidth = `${size.minWidth}px`;
        element.style.minHeight = `${size.minHeight}px`;
        element.style.maxWidth = `${size.maxWidth}px`;
        element.style.maxHeight = `${size.maxHeight}px`;
    }

    function makeDraggable(element, handle, signal) {
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;
        const move = event => {
            const maxLeft = Math.max(8, root.innerWidth - element.offsetWidth - 8);
            const maxTop = Math.max(8, root.innerHeight - element.offsetHeight - 8);
            element.style.left = `${Math.max(8, Math.min(maxLeft, startLeft + event.clientX - startX))}px`;
            element.style.top = `${Math.max(8, Math.min(maxTop, startTop + event.clientY - startY))}px`;
        };
        const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            document.body.style.userSelect = '';
            handle.style.cursor = 'grab';
        };
        handle.addEventListener('mousedown', event => {
            if (event.button !== 0 || event.target?.closest('button')) return;
            const rect = element.getBoundingClientRect();
            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;
            document.body.style.userSelect = 'none';
            handle.style.cursor = 'grabbing';
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        }, { signal });
        signal.addEventListener('abort', up, { once: true });
    }

    function closeActiveEditor(force = false, preserveOpenState = false) {
        if (!activeEditor) return true;
        const editor = activeEditor;
        if (!force && editor.hasUnsavedChanges?.()) {
            const discard = root.confirm?.('Discard the new cover without saving?');
            if (discard === false) return false;
        }
        activeEditor = null;
        if (!preserveOpenState) dependencies?.setPersistedOpen?.(false);
        editor.restoreBaseSize?.();
        saveEditorSize(editor.element, editor.compactMode);
        editor.mediaController?.releaseFromCoverEditor?.();
        editor.abortController.abort();
        editor.element.remove();
        return true;
    }

    function prepareForSceneNavigation() {
        if (!activeEditor) return true;
        const editor = activeEditor;
        if (editor.isSaving?.()) {
            editor.showStatus?.('Wait for the cover to finish saving before changing scenes.');
            return false;
        }
        if (editor.hasUnsavedChanges?.()) {
            const discard = root.confirm?.('Discard the new cover and continue to the next scene?');
            if (discard === false) return false;
        }
        editor.awaitingNavigation = true;
        editor.beginNavigation?.();
        return true;
    }

    function closeForHost(hostElement) {
        if (activeEditor?.hostElement === hostElement) {
            if (activeEditor.awaitingNavigation) return true;
            return closeActiveEditor(false, true);
        }
        return true;
    }

    function createActionButton(label, accent = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.style.cssText = `border-radius:7px;padding:7px 10px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid ${accent ? '#6366f1' : 'rgba(148,163,184,.35)'};background:${accent ? '#4f46e5' : 'rgba(51,65,85,.75)'};color:#fff;line-height:1.2;`;
        return button;
    }

    function openEditor(options) {
        if (!dependencies) throw new Error('[FastTag] Cover editor is not configured');
        let currentOptions = options;
        let sceneId = String(currentOptions?.sceneId || '');
        if (!sceneId) return;
        if (!closeActiveEditor()) return;

        const abortController = new AbortController();
        const { signal } = abortController;
        const isDark = dependencies.getTheme?.() !== 'light';
        const isCompact = dependencies.getCompactMode?.() === true;
        const panel = document.createElement('section');
        panel.id = 'fasttag-cover-editor-hud';
        panel.tabIndex = -1;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Scene cover editor');
        panel.style.cssText = `position:fixed;z-index:1000007;display:flex;flex-direction:column;overflow:auto;resize:both;box-sizing:border-box;padding:0;background:${isDark ? '#111827' : '#f8fafc'};color:${isDark ? '#f8fafc' : '#0f172a'};border:1px solid ${isDark ? '#475569' : '#94a3b8'};border-radius:11px;box-shadow:0 22px 55px rgba(0,0,0,.7);font-family:system-ui,-apple-system,sans-serif;`;
        if (currentOptions.restoring) {
            panel.style.opacity = '0';
            panel.style.transform = 'scale(.985)';
            panel.style.transition = 'opacity .16s ease, transform .16s ease';
        }
        positionEditor(panel, currentOptions.anchorElement || currentOptions.hostElement, isCompact);
        panel.addEventListener('mousedown', event => event.stopPropagation(), { signal });

        const header = document.createElement('header');
        header.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px;padding:5px 10px;border-bottom:1px solid ${isDark ? '#334155' : '#cbd5e1'};cursor:grab;user-select:none;position:sticky;top:0;background:${isDark ? '#111827' : '#f8fafc'};z-index:2;`;
        header.innerHTML = '<strong style="font-size:13px;">🖼️ Cover Editor</strong><span style="font-size:9px;color:#94a3b8;margin-left:auto;">Drag header · Resize at bottom-right</span>';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '✕';
        closeButton.title = 'Close cover editor';
        closeButton.style.cssText = 'border:0;background:transparent;color:inherit;font-size:15px;cursor:pointer;padding:1px 4px;line-height:1;';
        header.appendChild(closeButton);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = `display:flex;flex-direction:column;gap:${isCompact ? '6px' : '10px'};padding:${isCompact ? '8px' : '11px'};`;
        body.innerHTML = `
            <div>
                ${isCompact ? '' : '<div style="font-size:10px;font-weight:700;color:#a5b4fc;margin-bottom:4px;text-transform:uppercase;">Choose a video frame</div>'}
                <div class="fasttag-cover-video-stage" style="position:relative;width:100%;aspect-ratio:16/9;max-height:410px;background:#020617;border:1px solid #334155;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;"></div>
                <div class="fasttag-cover-playback-controls" style="display:grid;grid-template-columns:auto auto minmax(68px,1fr) auto auto;align-items:center;gap:4px;margin-top:${isCompact ? '4px' : '7px'};white-space:nowrap;"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;min-height:${isCompact ? '156px' : '170px'};">
                <div><div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;">Current cover</div><div class="fasttag-cover-current" style="height:${isCompact ? '148px' : '165px'};background:#020617;border:1px solid #334155;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;"></div></div>
                <div><div style="font-size:10px;font-weight:700;color:#a5b4fc;margin-bottom:4px;text-transform:uppercase;">New cover</div><div class="fasttag-cover-candidate" style="height:${isCompact ? '148px' : '165px'};background:#020617;border:1px dashed #6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#64748b;font-size:11px;text-align:center;padding:8px;box-sizing:border-box;">Capture, upload, paste or drop an image</div></div>
            </div>
            <div class="fasttag-cover-status" role="status" style="font-size:${isCompact ? '9.5px' : '10.5px'};line-height:1.3;height:${isCompact ? '28px' : '44px'};flex:0 0 ${isCompact ? '28px' : '44px'};overflow-y:auto;box-sizing:border-box;display:${isCompact ? 'none' : 'flex'};align-items:center;padding:${isCompact ? '4px 7px' : '7px 8px'};border-radius:6px;background:${isDark ? 'rgba(30,41,59,.8)' : '#e2e8f0'};color:${isDark ? '#cbd5e1' : '#334155'};">Opening the full video for frame capture…</div>
            ${isCompact ? '' : '<div class="fasttag-cover-actions" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>'}
            <input class="fasttag-cover-file" type="file" accept="image/jpeg,image/png,image/webp" style="display:none;">
            ${isCompact ? '' : '<div style="font-size:9.5px;color:#94a3b8;line-height:1.35;">Nothing is changed until you select <strong>Set Cover</strong>. Upload and clipboard remain available when the full video cannot be played.</div>'}
            <div class="fasttag-cover-footer" style="display:${isCompact ? 'grid' : 'flex'};grid-template-columns:${isCompact ? 'auto minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr)' : 'none'};gap:${isCompact ? '5px' : '7px'};border-top:1px solid ${isDark ? '#334155' : '#cbd5e1'};padding-top:${isCompact ? '6px' : '9px'};"></div>
        `;
        panel.appendChild(body);
        document.body.appendChild(panel);

        const currentBox = body.querySelector('.fasttag-cover-current');
        const candidateBox = body.querySelector('.fasttag-cover-candidate');
        const videoStage = body.querySelector('.fasttag-cover-video-stage');
        const playbackControls = body.querySelector('.fasttag-cover-playback-controls');
        const status = body.querySelector('.fasttag-cover-status');
        const actions = body.querySelector('.fasttag-cover-actions');
        const fileInput = body.querySelector('.fasttag-cover-file');
        const footer = body.querySelector('.fasttag-cover-footer');
        if (currentOptions.restoring) {
            const restoringOverlay = document.createElement('div');
            restoringOverlay.className = 'fasttag-cover-restoring-overlay';
            restoringOverlay.textContent = 'Preparing video…';
            restoringOverlay.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:#020617;color:#94a3b8;font-size:11px;font-weight:700;pointer-events:none;';
            videoStage.appendChild(restoringOverlay);
            const reveal = () => {
                panel.style.opacity = '1';
                panel.style.transform = 'scale(1)';
            };
            if (typeof root.requestAnimationFrame === 'function') root.requestAnimationFrame(reveal);
            else root.setTimeout(reveal, 0);
        }
        const renderCurrentCover = coverUrl => {
            currentBox.innerHTML = coverUrl
                ? `<img src="${escapeAttribute(coverUrl)}" alt="Current scene cover" style="width:100%;height:100%;object-fit:contain;">`
                : '<span style="font-size:11px;color:#64748b;">No current cover</span>';
        };
        renderCurrentCover(currentOptions.currentCoverUrl || currentOptions.mediaController?.getCoverUrl?.());

        const captureButton = createActionButton('📷 Capture Frame');
        const uploadButton = createActionButton('⬆ Upload');
        const pasteButton = createActionButton('📋 Paste');
        if (!isCompact) actions.append(uploadButton, pasteButton);
        const playPauseButton = createActionButton('⏸ Pause');
        const stepBackButton = createActionButton('◀');
        const stepForwardButton = createActionButton('▶');
        stepBackButton.style.cssText += 'padding:7px 12px;min-width:44px;';
        stepForwardButton.style.cssText += 'padding:7px 12px;min-width:44px;';
        const timeDisplay = document.createElement('span');
        timeDisplay.style.cssText = `font:600 9.5px ui-monospace,SFMono-Regular,Menlo,monospace;color:${isDark ? '#cbd5e1' : '#334155'};min-width:68px;text-align:center;`;
        captureButton.style.padding = '7px 9px';
        playbackControls.append(playPauseButton, stepBackButton, timeDisplay, stepForwardButton, captureButton);
        const cancelButton = createActionButton('Cancel');
        const saveButton = createActionButton('Set Cover', true);
        if (isCompact) {
            for (const button of [playPauseButton, stepBackButton, stepForwardButton, captureButton, cancelButton, uploadButton, pasteButton]) {
                button.style.background = '#1e293b';
                button.style.borderColor = '#475569';
                button.style.color = '#e2e8f0';
            }
            saveButton.style.background = '#3730a3';
            saveButton.style.borderColor = '#4f46e5';
            saveButton.style.color = '#e0e7ff';
        }
        saveButton.disabled = true;
        saveButton.style.opacity = '0.45';
        saveButton.style.flex = '1';
        footer.append(...(isCompact
            ? [cancelButton, uploadButton, pasteButton, saveButton]
            : [cancelButton, saveButton]));

        let candidateDataUrl = '';
        let candidateSource = '';
        let saving = false;
        let preparingImage = false;
        let statusLocked = false;
        let manualPastePending = false;
        let sceneGeneration = 0;
        let compactStatusExpanded = false;
        let compactBaseHeight = 0;
        let compactBaseTop = 0;

        const setCompactStatusExpanded = visible => {
            if (!isCompact || visible === compactStatusExpanded) return;
            const extraHeight = 34;
            if (visible) {
                compactBaseHeight = panel.offsetHeight;
                compactBaseTop = Number.parseFloat(panel.style.top) || panel.getBoundingClientRect().top;
                const expandedHeight = Math.min(root.innerHeight - 24, compactBaseHeight + extraHeight);
                const overflow = Math.max(0, compactBaseTop + expandedHeight + 12 - root.innerHeight);
                panel.style.top = `${Math.max(12, compactBaseTop - overflow)}px`;
                panel.style.height = `${expandedHeight}px`;
            } else if (compactBaseHeight) {
                panel.style.top = `${compactBaseTop}px`;
                panel.style.height = `${compactBaseHeight}px`;
            }
            compactStatusExpanded = visible;
        };

        const setStatus = (message, error = false, lock = false, showInCompact = false) => {
            if (lock) statusLocked = true;
            status.textContent = message;
            const compactStatusVisible = error || showInCompact;
            setCompactStatusExpanded(compactStatusVisible);
            status.style.display = isCompact && !compactStatusVisible ? 'none' : 'flex';
            status.style.color = error ? '#fca5a5' : (isDark ? '#cbd5e1' : '#334155');
            status.style.border = error ? '1px solid rgba(239,68,68,.45)' : '1px solid transparent';
        };
        const resetCandidate = () => {
            candidateDataUrl = '';
            candidateSource = '';
            saving = false;
            preparingImage = false;
            statusLocked = false;
            manualPastePending = false;
            candidateBox.textContent = 'Capture, upload, paste or drop an image';
            restoreCandidateDropStyle?.();
            pasteButton.textContent = '📋 Paste';
            saveButton.textContent = 'Set Cover';
            saveButton.disabled = true;
            saveButton.style.opacity = '0.45';
        };
        const requestManualPaste = () => {
            manualPastePending = true;
            pasteButton.textContent = isCompact ? '📋 Paste' : '⌨ Press Ctrl+V / Cmd+V';
            const insecureHttp = root.location?.protocol === 'http:' && root.isSecureContext === false;
            setStatus(insecureHttp
                ? 'This HTTP network address cannot read the clipboard directly. Press Ctrl+V or Cmd+V now.'
                : 'Direct clipboard access was unavailable. Press Ctrl+V or Cmd+V now.', false, true, true);
            status.style.border = '1px solid rgba(99,102,241,.7)';
            status.style.color = isDark ? '#c7d2fe' : '#3730a3';
            panel.focus?.({ preventScroll: true });
        };
        const setCandidate = (dataUrl, source) => {
            candidateDataUrl = dataUrl;
            candidateSource = source;
            preparingImage = false;
            statusLocked = true;
            candidateBox.innerHTML = '';
            const image = document.createElement('img');
            image.src = dataUrl;
            image.alt = `Proposed cover from ${source}`;
            image.style.cssText = 'width:100%;height:100%;object-fit:contain;';
            candidateBox.appendChild(image);
            saveButton.disabled = false;
            saveButton.style.opacity = '1';
            setStatus(`${source} is ready. Review it, then select Set Cover.`);
        };
        const useBlob = async (blob, source) => {
            const generation = sceneGeneration;
            try {
                preparingImage = true;
                statusLocked = false;
                setStatus(`Preparing ${source.toLowerCase()}…`);
                const normalized = await normalizeImageBlob(blob);
                if (generation !== sceneGeneration) return;
                setCandidate(normalized, source);
            } catch (error) {
                if (generation !== sceneGeneration) return;
                preparingImage = false;
                setStatus(error?.message || 'The image could not be prepared.', true, true);
            }
        };

        captureButton.onclick = () => {
            try {
                const captureState = currentOptions.mediaController?.getCaptureState?.() || {};
                currentOptions.mediaController?.pause?.();
                const source = captureState.source === 'full-video' ? 'Captured video frame' : 'Captured preview frame';
                setCandidate(captureMediaFrame(currentOptions.mediaController?.getCurrentCaptureMedia?.()), source);
            } catch (error) {
                setStatus(error?.message || 'The video frame could not be captured.', true, true);
            }
        };
        uploadButton.onclick = () => fileInput.click();
        fileInput.onchange = () => {
            const file = fileInput.files?.[0];
            if (file) useBlob(file, 'Uploaded image');
            fileInput.value = '';
        };
        const restoreCandidateDropStyle = () => {
            candidateBox.style.border = '1px dashed #6366f1';
            candidateBox.style.background = '#020617';
        };
        candidateBox.addEventListener('dragover', event => {
            event.preventDefault();
            event.stopPropagation();
            candidateBox.style.border = '2px solid #818cf8';
            candidateBox.style.background = 'rgba(79,70,229,.16)';
        }, { signal });
        candidateBox.addEventListener('dragleave', event => {
            if (!candidateBox.contains(event.relatedTarget)) restoreCandidateDropStyle();
        }, { signal });
        candidateBox.addEventListener('drop', event => {
            event.preventDefault();
            event.stopPropagation();
            restoreCandidateDropStyle();
            const file = Array.from(event.dataTransfer?.files || []).find(item => String(item.type || '').startsWith('image/'));
            if (file) useBlob(file, 'Dropped image');
            else setStatus('Drop a JPEG, PNG or WebP image here.', true, true);
        }, { signal });
        pasteButton.onclick = async () => {
            const generation = sceneGeneration;
            if (!navigator.clipboard?.read) {
                requestManualPaste();
                return;
            }
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const item of clipboardItems) {
                    const type = item.types?.find(value => String(value).startsWith('image/'));
                    if (type) {
                        if (generation !== sceneGeneration) return;
                        await useBlob(await item.getType(type), 'Clipboard image');
                        return;
                    }
                }
                setStatus('The clipboard does not contain an image.', true, true);
            } catch (error) {
                requestManualPaste();
            }
        };
        playPauseButton.onclick = () => {
            const playback = currentOptions.mediaController?.getPlaybackState?.();
            if (!playback?.available) return;
            if (playback.paused) currentOptions.mediaController?.play?.();
            else currentOptions.mediaController?.pause?.();
        };
        const bindStepButton = (button, direction) => {
            let holdDelayTimer = null;
            let repeatTimer = null;
            let activePointerId = null;
            let repeated = false;
            let holdUsesShift = false;
            let suppressClick = false;
            const performStep = shiftKey => currentOptions.mediaController?.stepBy?.(resolveStepSeconds(direction, shiftKey));
            const clearTimers = () => {
                root.clearTimeout(holdDelayTimer);
                root.clearTimeout(repeatTimer);
                holdDelayTimer = null;
                repeatTimer = null;
            };
            const stopHolding = () => {
                clearTimers();
                activePointerId = null;
                repeated = false;
            };
            const repeatStep = () => {
                if (activePointerId === null) return;
                repeated = true;
                performStep(holdUsesShift);
                repeatTimer = root.setTimeout(repeatStep, holdUsesShift ? 100 : 150);
            };
            button.addEventListener('pointerdown', event => {
                if (button.disabled || event.button !== 0) return;
                event.preventDefault();
                activePointerId = event.pointerId;
                repeated = false;
                holdUsesShift = event.shiftKey;
                try { button.setPointerCapture(event.pointerId); } catch (error) {}
                holdDelayTimer = root.setTimeout(repeatStep, 400);
            }, { signal });
            button.addEventListener('pointerup', event => {
                if (event.pointerId !== activePointerId) return;
                event.preventDefault();
                const shouldSingleStep = !repeated;
                const shiftKey = event.shiftKey || holdUsesShift;
                suppressClick = true;
                stopHolding();
                try { button.releasePointerCapture(event.pointerId); } catch (error) {}
                if (shouldSingleStep) performStep(shiftKey);
                root.setTimeout(() => { suppressClick = false; }, 0);
            }, { signal });
            button.addEventListener('pointercancel', stopHolding, { signal });
            button.addEventListener('pointerleave', event => {
                if (event.pointerId === activePointerId) stopHolding();
            }, { signal });
            button.addEventListener('click', event => {
                event.preventDefault();
                if (!suppressClick) performStep(event.shiftKey);
            }, { signal });
            root.addEventListener('blur', stopHolding, { signal });
            signal.addEventListener('abort', clearTimers, { once: true });
        };
        bindStepButton(stepBackButton, -1);
        bindStepButton(stepForwardButton, 1);

        document.addEventListener('paste', event => {
            const item = findClipboardImage(event.clipboardData?.items);
            const blob = item?.getAsFile?.();
            if (!blob) {
                if (manualPastePending) setStatus('The pasted clipboard content is not an image.', true, true);
                return;
            }
            event.preventDefault();
            manualPastePending = false;
            pasteButton.textContent = '📋 Paste';
            useBlob(blob, 'Clipboard image');
        }, { signal });

        saveButton.onclick = async () => {
            if (!candidateDataUrl || saving) return;
            saving = true;
            saveButton.disabled = true;
            saveButton.style.opacity = '0.6';
            saveButton.textContent = 'Saving…';
            setStatus(`Saving ${candidateSource.toLowerCase()} to Stash…`);
            try {
                const response = await dependencies.fetchGQL(`
                    mutation FastTagSetSceneCover($input: SceneUpdateInput!) {
                        sceneUpdate(input: $input) { id }
                    }
                `, { input: { id: sceneId, cover_image: candidateDataUrl } });
                if (response?.errors?.length || !response?.data?.sceneUpdate?.id) {
                    throw new Error(response?.errors?.map(error => error.message).join('; ') || 'Stash did not confirm the new cover.');
                }
                dependencies.showToast?.('Scene cover updated', 'success', 3000);
                await dependencies.refreshSceneCards?.(sceneId);
                const savedCover = candidateDataUrl;
                currentOptions.currentCoverUrl = savedCover;
                renderCurrentCover(savedCover);
                resetCandidate();
                setStatus('Cover saved to Stash. Continue editing or move to another scene.', false, true);
                await currentOptions.onSaved?.({ keepEditorOpen: true, coverUrl: savedCover });
            } catch (error) {
                saving = false;
                saveButton.disabled = false;
                saveButton.style.opacity = '1';
                saveButton.textContent = 'Set Cover';
                setStatus(error?.message || 'Stash could not save the new cover.', true, true);
                dependencies.log?.('ERROR', 'COVER', 'Cover save failed', { sceneId, error: String(error) });
            }
        };

        const refreshCaptureState = () => {
            const state = currentOptions.mediaController?.getCaptureState?.() || { available: false, reason: 'Full video is unavailable.' };
            const playback = currentOptions.mediaController?.getPlaybackState?.() || { available: false, paused: true, currentTime: 0, duration: 0 };
            captureButton.disabled = !state.available;
            captureButton.style.opacity = state.available ? '1' : '0.45';
            captureButton.textContent = state.source === 'full-video' ? '📷 Capture Frame' : '📷 Capture Preview Frame';
            captureButton.title = state.available
                ? (state.source === 'full-video' ? 'Capture the frame currently shown in Full Video' : 'Capture the currently displayed lower-resolution preview frame')
                : (state.reason || 'Video capture is unavailable');
            for (const button of [playPauseButton, stepBackButton, stepForwardButton]) {
                button.disabled = !playback.available;
                button.style.opacity = playback.available ? '1' : '0.45';
            }
            playPauseButton.textContent = playback.paused ? '▶ Play' : '⏸ Pause';
            timeDisplay.textContent = `${formatTime(playback.currentTime)} / ${formatTime(playback.duration)}`;
            if (!candidateDataUrl && !preparingImage && !statusLocked) {
                setStatus(state.reason || (state.available ? 'Seek or scrub to the frame you want, then select Capture Frame.' : 'Preparing full video…'));
            }
        };
        const beginNavigation = () => {
            sceneGeneration += 1;
            currentOptions.mediaController?.releaseFromCoverEditor?.({ forNavigation: true });
            videoStage.querySelector('.fasttag-cover-navigation-overlay')?.remove();
            const overlay = document.createElement('div');
            overlay.className = 'fasttag-cover-navigation-overlay';
            overlay.textContent = 'Loading next scene…';
            overlay.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.38);color:#e2e8f0;font-size:11px;font-weight:700;backdrop-filter:blur(1px);pointer-events:none;';
            videoStage.appendChild(overlay);
            resetCandidate();
            setStatus('Loading the next scene…', false, true);
            for (const button of [playPauseButton, stepBackButton, stepForwardButton, captureButton]) {
                button.disabled = true;
                button.style.opacity = '0.45';
            }
        };
        const rebindScene = nextOptions => {
            if (!nextOptions?.sceneId || !activeEditor) return;
            currentOptions = nextOptions;
            sceneId = String(nextOptions.sceneId);
            activeEditor.hostElement = nextOptions.hostElement;
            activeEditor.mediaController = nextOptions.mediaController;
            activeEditor.awaitingNavigation = false;
            activeEditor.restoring = false;
            videoStage.querySelector('.fasttag-cover-restoring-overlay')?.remove();
            renderCurrentCover(nextOptions.currentCoverUrl || nextOptions.mediaController?.getCoverUrl?.());
            resetCandidate();
            setStatus('Opening the full video for frame capture…');
            nextOptions.mediaController?.mountForCoverEditor?.(videoStage);
            nextOptions.mediaController?.switchToFullVideo?.();
            refreshCaptureState();
        };
        activeEditor = {
            element: panel,
            abortController,
            hostElement: currentOptions.hostElement,
            mediaController: currentOptions.mediaController,
            compactMode: isCompact,
            awaitingNavigation: false,
            restoring: Boolean(currentOptions.restoring),
            hasUnsavedChanges: () => Boolean(candidateDataUrl || preparingImage || saving),
            isSaving: () => saving,
            showStatus: message => setStatus(message, false, true),
            restoreBaseSize: () => {
                if (!compactStatusExpanded || !compactBaseHeight) return;
                panel.style.top = `${compactBaseTop}px`;
                panel.style.height = `${compactBaseHeight}px`;
                compactStatusExpanded = false;
            },
            beginNavigation,
            rebindScene
        };
        dependencies.setPersistedOpen?.(true);
        currentOptions.mediaController?.mountForCoverEditor?.(videoStage);
        currentOptions.mediaController?.switchToFullVideo?.();
        panel.focus({ preventScroll: true });
        refreshCaptureState();
        const capturePoll = root.setInterval(refreshCaptureState, 300);
        signal.addEventListener('abort', () => root.clearInterval(capturePoll), { once: true });
        let sizeSaveTimer = null;
        const queueSizeSave = () => {
            if (compactStatusExpanded) return;
            root.clearTimeout(sizeSaveTimer);
            sizeSaveTimer = root.setTimeout(() => saveEditorSize(panel, isCompact), 180);
        };
        if (typeof root.ResizeObserver === 'function') {
            const resizeObserver = new root.ResizeObserver(queueSizeSave);
            resizeObserver.observe(panel);
            signal.addEventListener('abort', () => resizeObserver.disconnect(), { once: true });
        } else {
            root.addEventListener('mouseup', queueSizeSave, { signal });
        }
        signal.addEventListener('abort', () => root.clearTimeout(sizeSaveTimer), { once: true });

        closeButton.onclick = closeActiveEditor;
        cancelButton.onclick = closeActiveEditor;
        panel.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeActiveEditor();
        }, { signal });
        makeDraggable(panel, header, signal);
    }

    function mountLauncher(options) {
        if (!options?.container) return null;
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'fasttag-cover-editor-btn';
        button.innerHTML = '🖼️';
        button.setAttribute('data-micro-tooltip', 'View or change the scene cover');
        button.style.cssText = 'background:rgba(15,23,42,.78);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:2px 7px;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:.9;min-width:23px;height:20px;line-height:1;';
        button.onclick = event => {
            event.preventDefault();
            event.stopPropagation();
            openEditor(options);
        };
        if (options.beforeElement?.parentNode === options.container) options.container.insertBefore(button, options.beforeElement);
        else options.container.appendChild(button);
        if (activeEditor?.awaitingNavigation || (activeEditor?.restoring && activeEditor.hostElement === options.hostElement)) {
            root.setTimeout(() => {
                if (button.isConnected && (activeEditor?.awaitingNavigation || activeEditor?.restoring)) activeEditor.rebindScene?.(options);
            }, 0);
        } else if (!activeEditor && dependencies?.isPersistedOpen?.()) {
            root.setTimeout(() => {
                if (button.isConnected && !activeEditor && dependencies?.isPersistedOpen?.()) openEditor(options);
            }, 0);
        }
        return button;
    }

    function restoreForHost(options) {
        if (activeEditor || !dependencies?.isPersistedOpen?.() || !options?.hostElement) return false;
        const placeholderController = {
            getCaptureState: () => ({ available: false, reason: 'Preparing video…' }),
            getPlaybackState: () => ({ available: false, paused: true, currentTime: 0, duration: 0 }),
            mountForCoverEditor() {},
            switchToFullVideo() {},
            releaseFromCoverEditor() {}
        };
        openEditor({ ...options, restoring: true, mediaController: placeholderController });
        return true;
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.coverEditor = Object.freeze({
        configure,
        calculateImageSize,
        formatTime,
        resolveStepSeconds,
        resolveEditorSize,
        validateImageBlob,
        findClipboardImage,
        normalizeImageBlob,
        captureVideoFrame,
        captureMediaFrame,
        mountLauncher,
        restoreForHost,
        openEditor,
        closeActiveEditor,
        prepareForSceneNavigation,
        closeForHost
    });
}(typeof window !== 'undefined' ? window : globalThis));
