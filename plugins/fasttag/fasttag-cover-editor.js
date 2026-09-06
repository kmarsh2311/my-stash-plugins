(function initializeFastTagCoverEditor(root) {
    'use strict';

    const DEFAULT_MAX_SOURCE_BYTES = 25 * 1024 * 1024;
    const DEFAULT_MAX_DIMENSION = 1920;
    const DEFAULT_JPEG_QUALITY = 0.9;
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

    function captureVideoFrame(video) {
        if (!video || String(video.tagName || '').toUpperCase() !== 'VIDEO') {
            throw new Error('Full video is not available for frame capture.');
        }
        const width = Number(video.videoWidth || 0);
        const height = Number(video.videoHeight || 0);
        if (Number(video.readyState || 0) < 2 || !width || !height) {
            throw new Error('Wait for the full video frame to finish loading.');
        }
        try {
            return canvasToDataUrl(video, width, height);
        } catch (error) {
            if (error?.name === 'SecurityError') {
                throw new Error('This video frame is protected from browser capture. Upload or paste an image instead.');
            }
            throw error;
        }
    }

    function positionEditor(element, anchorElement) {
        const width = Math.min(470, Math.max(330, root.innerWidth - 24));
        const height = Math.min(590, Math.max(420, root.innerHeight - 24));
        const margin = 12;
        const anchor = anchorElement?.getBoundingClientRect?.();
        let left = anchor ? anchor.left - width - margin : margin;
        if (left < margin && anchor && anchor.right + width + margin <= root.innerWidth) left = anchor.right + margin;
        left = Math.max(margin, Math.min(root.innerWidth - width - margin, left));
        const top = Math.max(margin, Math.min(root.innerHeight - height - margin, anchor?.top || 60));
        element.style.left = `${Math.round(left)}px`;
        element.style.top = `${Math.round(top)}px`;
        element.style.width = `${Math.round(width)}px`;
        element.style.maxHeight = `${Math.round(height)}px`;
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

    function closeActiveEditor() {
        if (!activeEditor) return;
        const editor = activeEditor;
        activeEditor = null;
        editor.abortController.abort();
        editor.element.remove();
    }

    function closeForHost(hostElement) {
        if (activeEditor?.hostElement === hostElement) closeActiveEditor();
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
        const sceneId = String(options?.sceneId || '');
        if (!sceneId) return;
        closeActiveEditor();

        const abortController = new AbortController();
        const { signal } = abortController;
        const isDark = dependencies.getTheme?.() !== 'light';
        const panel = document.createElement('section');
        panel.id = 'fasttag-cover-editor-hud';
        panel.tabIndex = -1;
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Scene cover editor');
        panel.style.cssText = `position:fixed;z-index:1000007;display:flex;flex-direction:column;overflow:auto;box-sizing:border-box;padding:0;background:${isDark ? '#111827' : '#f8fafc'};color:${isDark ? '#f8fafc' : '#0f172a'};border:1px solid ${isDark ? '#475569' : '#94a3b8'};border-radius:11px;box-shadow:0 22px 55px rgba(0,0,0,.7);font-family:system-ui,-apple-system,sans-serif;`;
        positionEditor(panel, options.anchorElement || options.hostElement);
        panel.addEventListener('mousedown', event => event.stopPropagation(), { signal });

        const header = document.createElement('header');
        header.style.cssText = `display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 11px;border-bottom:1px solid ${isDark ? '#334155' : '#cbd5e1'};cursor:grab;user-select:none;position:sticky;top:0;background:${isDark ? '#111827' : '#f8fafc'};z-index:2;`;
        header.innerHTML = '<strong style="font-size:13px;">🖼️ Cover Editor</strong>';
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = '✕';
        closeButton.title = 'Close cover editor';
        closeButton.style.cssText = 'border:0;background:transparent;color:inherit;font-size:15px;cursor:pointer;padding:2px 4px;';
        header.appendChild(closeButton);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:11px;';
        body.innerHTML = `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;min-height:150px;">
                <div><div style="font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;text-transform:uppercase;">Current cover</div><div class="fasttag-cover-current" style="height:145px;background:#020617;border:1px solid #334155;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;"></div></div>
                <div><div style="font-size:10px;font-weight:700;color:#a5b4fc;margin-bottom:4px;text-transform:uppercase;">New cover</div><div class="fasttag-cover-candidate" style="height:145px;background:#020617;border:1px dashed #6366f1;border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;color:#64748b;font-size:11px;text-align:center;padding:8px;box-sizing:border-box;">Capture, upload or paste an image</div></div>
            </div>
            <div class="fasttag-cover-status" role="status" style="font-size:10.5px;line-height:1.35;padding:7px 8px;border-radius:6px;background:${isDark ? 'rgba(30,41,59,.8)' : '#e2e8f0'};color:${isDark ? '#cbd5e1' : '#334155'};">Opening the full video for frame capture…</div>
            <div class="fasttag-cover-actions" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;"></div>
            <input class="fasttag-cover-file" type="file" accept="image/jpeg,image/png,image/webp" style="display:none;">
            <div style="font-size:9.5px;color:#94a3b8;line-height:1.35;">Nothing is changed until you select <strong>Set Cover</strong>. Upload and clipboard remain available when the full video cannot be played.</div>
            <div class="fasttag-cover-footer" style="display:flex;gap:7px;border-top:1px solid ${isDark ? '#334155' : '#cbd5e1'};padding-top:9px;"></div>
        `;
        panel.appendChild(body);
        document.body.appendChild(panel);

        const currentBox = body.querySelector('.fasttag-cover-current');
        const candidateBox = body.querySelector('.fasttag-cover-candidate');
        const status = body.querySelector('.fasttag-cover-status');
        const actions = body.querySelector('.fasttag-cover-actions');
        const fileInput = body.querySelector('.fasttag-cover-file');
        const footer = body.querySelector('.fasttag-cover-footer');
        const currentCoverUrl = options.currentCoverUrl || options.mediaController?.getCoverUrl?.();
        currentBox.innerHTML = currentCoverUrl
            ? `<img src="${escapeAttribute(currentCoverUrl)}" alt="Current scene cover" style="width:100%;height:100%;object-fit:contain;">`
            : '<span style="font-size:11px;color:#64748b;">No current cover</span>';

        const captureButton = createActionButton('📷 Capture Frame');
        const uploadButton = createActionButton('⬆ Upload');
        const pasteButton = createActionButton('📋 Paste');
        actions.append(captureButton, uploadButton, pasteButton);
        const cancelButton = createActionButton('Cancel');
        const saveButton = createActionButton('Set Cover', true);
        saveButton.disabled = true;
        saveButton.style.opacity = '0.45';
        saveButton.style.flex = '1';
        footer.append(cancelButton, saveButton);

        let candidateDataUrl = '';
        let candidateSource = '';
        let saving = false;
        let preparingImage = false;
        let statusLocked = false;

        const setStatus = (message, error = false, lock = false) => {
            if (lock) statusLocked = true;
            status.textContent = message;
            status.style.color = error ? '#fca5a5' : (isDark ? '#cbd5e1' : '#334155');
            status.style.border = error ? '1px solid rgba(239,68,68,.45)' : '1px solid transparent';
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
            try {
                preparingImage = true;
                statusLocked = false;
                setStatus(`Preparing ${source.toLowerCase()}…`);
                setCandidate(await normalizeImageBlob(blob), source);
            } catch (error) {
                preparingImage = false;
                setStatus(error?.message || 'The image could not be prepared.', true, true);
            }
        };

        captureButton.onclick = () => {
            try {
                setCandidate(captureVideoFrame(options.mediaController?.getCurrentVideo?.()), 'Captured video frame');
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
        pasteButton.onclick = async () => {
            if (!navigator.clipboard?.read) {
                setStatus('Click this panel and press Ctrl+V or Cmd+V to paste an image.', false, true);
                panel.focus?.();
                return;
            }
            try {
                const clipboardItems = await navigator.clipboard.read();
                for (const item of clipboardItems) {
                    const type = item.types?.find(value => String(value).startsWith('image/'));
                    if (type) {
                        await useBlob(await item.getType(type), 'Clipboard image');
                        return;
                    }
                }
                setStatus('The clipboard does not contain an image.', true, true);
            } catch (error) {
                setStatus('Clipboard access was unavailable. Click this panel and press Ctrl+V or Cmd+V.', true, true);
            }
        };

        document.addEventListener('paste', event => {
            const item = findClipboardImage(event.clipboardData?.items);
            const blob = item?.getAsFile?.();
            if (!blob) return;
            event.preventDefault();
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
                closeActiveEditor();
                await options.onSaved?.();
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
            const state = options.mediaController?.getCaptureState?.() || { available: false, reason: 'Full video is unavailable.' };
            captureButton.disabled = !state.available;
            captureButton.style.opacity = state.available ? '1' : '0.45';
            captureButton.title = state.available ? 'Capture the frame currently shown in Full Video' : (state.reason || 'Full video is unavailable');
            if (!candidateDataUrl && !preparingImage && !statusLocked) {
                setStatus(state.available ? 'Seek or scrub to the frame you want, then select Capture Frame.' : (state.reason || 'Preparing full video…'));
            }
        };
        options.mediaController?.switchToFullVideo?.();
        refreshCaptureState();
        const capturePoll = root.setInterval(refreshCaptureState, 300);
        signal.addEventListener('abort', () => root.clearInterval(capturePoll), { once: true });

        closeButton.onclick = closeActiveEditor;
        cancelButton.onclick = closeActiveEditor;
        panel.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeActiveEditor();
        }, { signal });
        makeDraggable(panel, header, signal);
        activeEditor = { element: panel, abortController, hostElement: options.hostElement };
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
        return button;
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.coverEditor = Object.freeze({
        configure,
        calculateImageSize,
        validateImageBlob,
        findClipboardImage,
        normalizeImageBlob,
        captureVideoFrame,
        mountLauncher,
        openEditor,
        closeActiveEditor,
        closeForHost
    });
}(typeof window !== 'undefined' ? window : globalThis));
