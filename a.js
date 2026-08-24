// ==UserScript==
// @name         Stash Scene Manager Context Menu
// @namespace    http://tampermonkey.net/
// @version      2.4
// @description  Fast scene tagging workflow for Stash: edit tags, performers, and galleries from scene cards with quick search and popups
// @match        http://localhost:*/*
// @match        http://127.0.0.1:*/*
// @grant        none
// @run-at       document-end
// @require      https://unpkg.com/tabulator-tables@5.5.2/dist/js/tabulator.min.js
// @require      https://cdn.jsdelivr.net/npm/toastify-js
// @updateURL    https://raw.githubusercontent.com/kmarsh2311/my-stash-plugins/main/a.js
// @downloadURL  https://raw.githubusercontent.com/kmarsh2311/my-stash-plugins/main/a.js
// ==/UserScript==

(async function() {
    'use strict';

    // Robust auto-restore scroll position after reload (handles SPA async rendering)
    const scrollKey = 'stash_scroll_pos_' + window.location.pathname + window.location.search;
    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll !== null) {
        sessionStorage.removeItem(scrollKey);
        const targetScroll = parseInt(savedScroll, 10);
        let attempts = 0;
        const restoreScroll = () => {
            window.scrollTo(0, targetScroll);
            if (window.scrollY !== targetScroll && attempts < 30) {
                attempts++;
                setTimeout(restoreScroll, 100);
            }
        };
        setTimeout(restoreScroll, 50);
    }

    // Continuously track scroll position so it's always fresh in sessionStorage
    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) {
            sessionStorage.setItem(scrollKey, window.scrollY);
        }
    }, { passive: true });

    let isTabActive = true;
    document.addEventListener('visibilitychange', () => {
        isTabActive = !document.hidden;
    });

    if (!document.getElementById('tabulator-external-css')) {
        const tabulatorCSS = document.createElement('link');
        tabulatorCSS.id = 'tabulator-external-css';
        tabulatorCSS.rel = 'stylesheet';
        tabulatorCSS.href = 'https://unpkg.com/tabulator-tables@5.5.2/dist/css/tabulator.min.css';
        document.head.appendChild(tabulatorCSS);
    }

    if (!document.getElementById('toastify-external-css')) {
        const toastifyCSS = document.createElement('link');
        toastifyCSS.id = 'toastify-external-css';
        toastifyCSS.rel = 'stylesheet';
        toastifyCSS.href = 'https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css';
        document.head.appendChild(toastifyCSS);
    }

    const styleId = 'scenes-manager-modern-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
        #scenes-popup {
            opacity: 0;
            visibility: hidden;
            transform: translateY(4px);
            transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
            will-change: opacity, transform;
        }
        #scenes-popup.popup-visible {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        #scenes-custom-menu {
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 6px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 13px;
            min-width: 150px;
            animation: menuFadeIn 0.15s ease-out;
        }
        #scenes-custom-menu a {
            display: block;
            padding: 8px 12px;
            color: #1e293b;
            text-decoration: none;
            border-radius: 4px;
            transition: background 0.15s, color 0.15s;
        }
        #scenes-custom-menu a:hover {
            background: #f1f5f9;
            color: #0f172a;
        }
        @keyframes menuFadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }

        #scenes-popup .tabulator {
            background-color: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 6px !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            font-size: 12px !important;
        }
        #scenes-popup .tabulator .tabulator-header {
            background-color: #f8fafc !important;
            border-bottom: 1px solid #e2e8f0 !important;
            color: #64748b !important;
        }
        #scenes-popup .tabulator .tabulator-header .tabulator-col {
            background-color: transparent !important;
            border-right: none !important;
        }
        #scenes-popup .tabulator .tabulator-header .tabulator-col-title {
            color: #475569 !important;
            font-weight: 600 !important;
        }
        #scenes-popup .tabulator .tabulator-row {
            background-color: #ffffff !important;
            color: #1e293b !important;
            border-bottom: 1px solid #f1f5f9 !important;
        }
        #scenes-popup .tabulator .tabulator-row:hover {
            background-color: #f1f5f9 !important;
        }
        #scenes-popup .tabulator .tabulator-row.tabulator-selected,
        #scenes-popup .tabulator .tabulator-row.tabulator-selected:hover {
            background-color: #e0e7ff !important;
            color: #1e293b !important;
        }
        #scenes-popup .tabulator .tabulator-placeholder {
            color: #94a3b8 !important;
        }
        #scenes-popup .tabulator-tableholder {
            overflow-x: hidden !important;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar {
            width: 14px;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-track {
            background: #f1f5f9;
            border-radius: 0 6px 6px 0;
            border-left: 1px solid #e2e8f0;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 6px;
            border: 2px solid #f1f5f9;
        }
        #scenes-popup .tabulator-tableholder::-webkit-scrollbar-thumb:hover {
            background: #94a3b8;
        }
        `;
        document.head.appendChild(style);
    }

    const fetchGQL = async (query, variables = {}) => {
        try {
            const res = await fetch('/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables })
            });

            if (!res.ok) {
                return { errors: [{ message: `GraphQL request failed: ${res.status} ${res.statusText}` }] };
            }

            const payload = await res.json();
            if (!payload || typeof payload !== 'object') {
                return { errors: [{ message: 'GraphQL response was not valid JSON.' }] };
            }

            return payload;
        } catch (err) {
            console.error('Stash Scene Manager: Network error', err);
            return { errors: [{ message: err.message || 'Unknown network error' }] };
        }
    };

    function showToast(message, type = "success") {
        if (typeof Toastify === 'undefined') {
            console.log(`[Toast Fallback - ${type}] ${message}`);
            return;
        }
        Toastify({
            text: message,
            duration: 2000,
            gravity: "top",
            position: "center",
            backgroundColor: type === "success" ? "#10b981" : "#ef4444",
        }).showToast();
    }

    function extractPreviewUrlFromCard(cardElement) {
        if (!cardElement) return null;

        const candidates = [
            cardElement.querySelector('video'),
            cardElement.querySelector('img'),
            cardElement.querySelector('source[src]'),
            cardElement.querySelector('[src]'),
            cardElement.querySelector('[poster]')
        ];

        for (const node of candidates) {
            if (!node) continue;
            const src = node.currentSrc || node.src || node.getAttribute('src') || node.getAttribute('poster');
            if (src && /(preview|thumb|screenshot|\.webp|\.mp4|\.webm|\.m4v|\.mov|\.gif)/i.test(src)) {
                return src;
            }
        }

        return null;
    }

    function buildScenePreviewUrl(sceneId) {
        if (!sceneId) return null;
        const base = window.location.origin || 'http://localhost:9999';
        return `${base}/scene/${encodeURIComponent(sceneId)}/preview`;
    }

    async function fetchScenePreviewUrl(sceneId, cardElement) {
        const fromCard = extractPreviewUrlFromCard(cardElement);
        if (fromCard) return fromCard;

        const directUrl = buildScenePreviewUrl(sceneId);
        if (directUrl) return directUrl;

        if (!sceneId) return null;

        const queries = [
            `query ($id: ID!) { findScene(id: $id) { preview screenshot } }`,
            `query ($id: ID!) { findScene(id: $id) { paths { preview screenshot } } }`
        ];

        for (const query of queries) {
            try {
                const res = await fetchGQL(query, { id: sceneId });
                if (res.errors) continue;

                const scene = res.data?.findScene;
                if (!scene) continue;

                const preview = scene.preview || scene.screenshot || scene.paths?.preview || scene.paths?.screenshot;
                if (preview) return preview;
            } catch (error) {
                console.error('Stash Scene Manager: preview fetch failed', error);
            }
        }

        return null;
    }

    async function attachScenePreview(hostContainer, sceneId, cardElement) {
        hostContainer.innerHTML = '';
        hostContainer.style.display = 'block';
        hostContainer.style.position = 'relative';
        hostContainer.style.width = '100%';
        hostContainer.style.minHeight = '150px';
        hostContainer.style.margin = '0 0 10px 0';
        hostContainer.style.borderRadius = '8px';
        hostContainer.style.overflow = 'hidden';
        hostContainer.style.border = '1px solid #e2e8f0';
        hostContainer.style.background = '#0f172a';
        hostContainer.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.05)';

        const previewUrl = await fetchScenePreviewUrl(sceneId, cardElement);
        if (!previewUrl) {
            console.warn('Stash Scene Manager: no preview URL found for scene', sceneId);
            hostContainer.style.display = 'none';
            return;
        }

        const isVideoPreview = /\/preview(?:[?#]|$)|\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(previewUrl);
        const media = isVideoPreview ? document.createElement('video') : document.createElement('img');

        media.style.display = 'block';
        media.style.width = '100%';
        media.style.height = '150px';
        media.style.objectFit = 'cover';
        media.style.background = '#0f172a';
        media.style.pointerEvents = 'none';

        media.onerror = () => {
            console.warn('Stash Scene Manager: preview failed to load', previewUrl);
            hostContainer.style.display = 'none';
        };

        if (isVideoPreview) {
            media.src = previewUrl;
            media.muted = true;
            media.autoplay = true;
            media.loop = true;
            media.playsInline = true;
            media.preload = 'auto';
            media.setAttribute('playsinline', 'true');
            media.setAttribute('webkit-playsinline', 'true');
            media.load();
            media.play().catch(() => {});
        } else {
            media.src = previewUrl;
            media.alt = 'Scene preview';
            media.loading = 'eager';
        }

        hostContainer.appendChild(media);

        if (isVideoPreview) {
            let wasPlaying = false;
            let resumeTimer = null;
            const RESUME_DELAY = 250; 

            let scrubbing = false;
            let originalLoop = !!media.loop;

            let shiftHeld = false;
            const wheelOpts = { passive: false };

            function normalizeNotches(e) {
                if (e.deltaMode === 1) return e.deltaY; 
                return e.deltaY / 100;
            }

            function beginScrubbing(v) {
                if (!scrubbing) {
                    scrubbing = true;
                    originalLoop = !!v.loop;
                    try { v.loop = false; } catch (e) {}
                }
            }

            function endScrubbing(v) {
                scrubbing = false;
                try { v.loop = !!originalLoop; } catch (e) {}
                if (wasPlaying && !shiftHeld) {
                    v.play().catch(() => {});
                    wasPlaying = false;
                }
            }

            function onWheel(e) {
                if (!shiftHeld) return; 
                e.preventDefault();

                const v = media;
                if (!v || v.duration <= 0 || !isFinite(v.duration)) return;

                const notches = normalizeNotches(e);
                if (notches === 0) return;

                beginScrubbing(v);

                const stepSeconds = 1.0; 
                const scrubSeconds = -Math.sign(notches) * stepSeconds * Math.min(Math.abs(notches), 10);

                if (!v.paused && !v.ended) {
                    wasPlaying = true;
                    try { v.pause(); } catch (err) {}
                }

                const newTime = Math.min(v.duration, Math.max(0, v.currentTime + scrubSeconds));
                try { v.currentTime = newTime; } catch (err) {}

                clearTimeout(resumeTimer);
            }

            const onKeyDown = (e) => {
                if (e.key === 'Shift' && !shiftHeld) {
                    shiftHeld = true;
                    beginScrubbing(media);
                    if (!media.paused && !media.ended) {
                        wasPlaying = true;
                        try { media.pause(); } catch (err) {}
                    }
                    try { hostContainer.addEventListener('wheel', onWheel, wheelOpts); } catch (err) { hostContainer.addEventListener('wheel', onWheel, false); }
                }
            };
            const onKeyUp = (e) => {
                if (e.key === 'Shift' && shiftHeld) {
                    shiftHeld = false;
                    try { hostContainer.removeEventListener('wheel', onWheel, wheelOpts); } catch (err) { hostContainer.removeEventListener('wheel', onWheel, false); }
                    clearTimeout(resumeTimer);
                    resumeTimer = setTimeout(() => {
                        try { endScrubbing(media); } catch (err) {}
                    }, RESUME_DELAY);
                }
            };

            const onPointerMove = (ev) => {
                try {
                    if (ev && ev.shiftKey && !shiftHeld) {
                        shiftHeld = true;
                        beginScrubbing(media);
                        if (!media.paused && !media.ended) {
                            wasPlaying = true;
                            try { media.pause(); } catch (err) {}
                        }
                        try { hostContainer.addEventListener('wheel', onWheel, wheelOpts); } catch (err) { hostContainer.addEventListener('wheel', onWheel, false); }
                        try { hostContainer.removeEventListener('pointermove', onPointerMove); } catch (err) {}
                    }
                } catch (e) {}
            };

            const onWindowBlur = () => {
                if (shiftHeld) {
                    shiftHeld = false;
                    try { hostContainer.removeEventListener('wheel', onWheel, wheelOpts); } catch (err) { hostContainer.removeEventListener('wheel', onWheel, false); }
                    clearTimeout(resumeTimer);
                    try { endScrubbing(media); } catch (err) {}
                }
            };

            const onMouseEnter = () => {
                document.addEventListener('keydown', onKeyDown);
                document.addEventListener('keyup', onKeyUp);
                hostContainer.addEventListener('pointermove', onPointerMove);
                window.addEventListener('blur', onWindowBlur);
            };
            const onMouseLeave = (ev) => {
                try { document.removeEventListener('keydown', onKeyDown); } catch (err) {}
                try { hostContainer.removeEventListener('pointermove', onPointerMove); } catch (err) {}

                if (shiftHeld) {
                    try { hostContainer.removeEventListener('wheel', onWheel, wheelOpts); } catch (err) { try { hostContainer.removeEventListener('wheel', onWheel, false); } catch (er) {} }

                    const onWindowKeyUpWhileAway = (evt) => {
                        if (evt && evt.key === 'Shift') {
                            try { onKeyUp(evt); } catch (e) {}
                            try { window.removeEventListener('keyup', onWindowKeyUpWhileAway); } catch (e) {}
                        }
                    };

                    try { window.addEventListener('keyup', onWindowKeyUpWhileAway); } catch (err) { document.addEventListener('keyup', onWindowKeyUpWhileAway); }

                    popupCleanupFns.push(() => { try { window.removeEventListener('keyup', onWindowKeyUpWhileAway); } catch (e) { try { document.removeEventListener('keyup', onWindowKeyUpWhileAway); } catch (er) {} } });
                    try { window.addEventListener('blur', onWindowBlur); } catch (err) {}

                } else {
                    try { document.removeEventListener('keyup', onKeyUp); } catch (err) {}
                    try { hostContainer.removeEventListener('wheel', onWheel, wheelOpts); } catch (err) { try { hostContainer.removeEventListener('wheel', onWheel, false); } catch (er) {} }
                    clearTimeout(resumeTimer);
                    try { endScrubbing(media); } catch (e) {}
                    try { window.removeEventListener('blur', onWindowBlur); } catch (err) {}
                }
            };

            hostContainer.addEventListener('mouseenter', onMouseEnter);
            hostContainer.addEventListener('mouseleave', onMouseLeave);

            popupCleanupFns.push(() => { try { hostContainer.removeEventListener('mouseenter', onMouseEnter); } catch (e) {} });
            popupCleanupFns.push(() => { try { hostContainer.removeEventListener('mouseleave', onMouseLeave); } catch (e) {} });
            popupCleanupFns.push(() => { try { hostContainer.removeEventListener('wheel', onWheel, wheelOpts); } catch (e) { try { hostContainer.removeEventListener('wheel', onWheel, false); } catch (er) {} } });
            popupCleanupFns.push(() => { try { hostContainer.removeEventListener('pointermove', onPointerMove); } catch (e) {} });
            popupCleanupFns.push(() => { try { document.removeEventListener('keydown', onKeyDown); } catch (e) {} });
            popupCleanupFns.push(() => { try { document.removeEventListener('keyup', onKeyUp); } catch (e) {} });
            popupCleanupFns.push(() => { try { window.removeEventListener('blur', onWindowBlur); } catch (e) {} });
            popupCleanupFns.push(() => { try { clearTimeout(resumeTimer); } catch (e) {} });
        }
    }

    const toastSuccess = (message, debug) => {
        showToast(message, 'success');
        if (debug) console.log(debug);
    };

    const toastError = (message, debug) => {
        showToast(message, 'error');
        console.error(debug);
    };

    let currentMenu = null;
    let activePopup = null; // Global reference to track the active popup state (shell + content handles)
    let activeTableInstance = null;
    let menuOutsideClickHandler = null;
    let popupCleanupFns = [];
    
    // Sequential editing state
    let sequentialEditState = {
        enabled: false,
        allSceneCards: [],
        currentIndex: 0,
        currentSceneId: null,
        currentType: null,
        popupPosition: { left: 0, top: 0 },
        initialSelectedIds: new Set()
    };

    function clearPopupCleanupFns() {
        while (popupCleanupFns.length) {
            const cleanup = popupCleanupFns.pop();
            if (typeof cleanup === 'function') cleanup();
        }
    }
    
    function getAllVisibleSceneCards() {
        const cards = document.querySelectorAll('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
        const filteredCards = Array.from(cards).filter(card => {
            const sceneId = extractSceneId(card);
            return sceneId !== null;
        });
        return filteredCards;
    }
    
    function getSceneCardIndex(sceneId, allCards) {
        return allCards.findIndex(card => extractSceneId(card) === sceneId);
    }
    
    function resetSequentialEditState() {
        sequentialEditState = {
            enabled: false,
            allSceneCards: [],
            currentIndex: 0,
            currentSceneId: null,
            currentType: null,
            popupPosition: { left: 0, top: 0 },
            initialSelectedIds: new Set()
        };
    }
    
    function updateSequentialEditUI(form, type) {
        const prevBtn = form.querySelector(`#${type}-prev-btn`);
        const nextBtn = form.querySelector(`#${type}-next-btn`);
        const title = form.querySelector(`#${type}-popup-title`);
        const modeCheckbox = form.querySelector(`#${type}-sequential-mode`);
        const saveBtn = form.querySelector(`#${type}-save-btn`);
        
        if (!sequentialEditState.enabled) {
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (modeCheckbox) modeCheckbox.checked = false;
            if (title) title.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} for Scene`;
            if (saveBtn) {
                saveBtn.textContent = `Save ${type.charAt(0).toUpperCase() + type.slice(1)}`;
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.style.cursor = 'pointer';
            }
            return;
        }
        
        if (prevBtn) prevBtn.style.display = 'block';
        if (nextBtn) nextBtn.style.display = 'block';
        if (modeCheckbox) modeCheckbox.checked = true;
        
        if (saveBtn) {
            saveBtn.textContent = "Auto Save On";
            saveBtn.disabled = true;
            saveBtn.style.opacity = '0.7';
            saveBtn.style.cursor = 'not-allowed';
        }
        
        const currentNum = sequentialEditState.currentIndex + 1;
        const totalNum = sequentialEditState.allSceneCards.length;
        if (title) title.textContent = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} for Scene [${currentNum}/${totalNum}]`;
        
        if (prevBtn) {
            prevBtn.disabled = sequentialEditState.currentIndex === 0;
            prevBtn.style.opacity = sequentialEditState.currentIndex === 0 ? '0.5' : '1';
        }
        
        if (nextBtn) {
            nextBtn.disabled = sequentialEditState.currentIndex >= sequentialEditState.allSceneCards.length - 1;
            nextBtn.style.opacity = sequentialEditState.currentIndex >= sequentialEditState.allSceneCards.length - 1 ? '0.5' : '1';
        }
    }
    
    async function navigateToNextScene(form, type, direction = 1, getSelectedIdsFn) {
        if (!sequentialEditState.enabled) return;
        
        const currentSceneId = sequentialEditState.currentSceneId;
        if (currentSceneId && typeof getSelectedIdsFn === 'function') {
            const currentSelectedIds = Array.from(getSelectedIdsFn());
            
            // Check if data actually changed compared to what was initially loaded
            const currentSet = new Set(currentSelectedIds.map(String));
            const initialSet = sequentialEditState.initialSelectedIds;
            
            let hasChanged = currentSet.size !== initialSet.size;
            if (!hasChanged) {
                for (let id of currentSet) {
                    if (!initialSet.has(id)) {
                        hasChanged = true;
                        break;
                    }
                }
            }

            // Only save and show popup if data has changed
            if (hasChanged) {
                let success = false;
                if (type === 'tags') {
                    success = await updateSceneWithTags(currentSceneId, currentSelectedIds);
                    if (success) toastSuccess('Tag saved');
                } else if (type === 'performers') {
                    success = await updateSceneWithPerformers(currentSceneId, currentSelectedIds);
                    if (success) toastSuccess('Performer saved');
                } else if (type === 'galleries') {
                    success = await updateSceneWithGalleries(currentSceneId, currentSelectedIds);
                    if (success) toastSuccess('Gallery saved');
                }
                
                if (success) {
                    await refreshSceneCards();
                }
            }
        }

        const formRect = form.getBoundingClientRect();
        sequentialEditState.popupPosition = {
            left: formRect.left + window.scrollX,
            top: formRect.top + window.scrollY
        };
        
        const nextIndex = sequentialEditState.currentIndex + direction;
        
        if (nextIndex < 0 || nextIndex >= sequentialEditState.allSceneCards.length) {
            toastError('No more scenes in this direction');
            return;
        }
        
        const nextCard = sequentialEditState.allSceneCards[nextIndex];
        if (!nextCard) {
            toastError('Error finding next scene');
            return;
        }
        
        sequentialEditState.currentIndex = nextIndex;
        
        const nextSceneId = extractSceneId(nextCard);
        if (!nextSceneId) {
            toastError('Error getting next scene ID');
            return;
        }
        
        sequentialEditState.currentSceneId = nextSceneId;
        
        // Load new data into active shell instead of destroying
        if (type === 'tags') {
            await loadTagsDataIntoPopup(nextSceneId, nextCard, activePopup);
        } else if (type === 'performers') {
            await loadPerformersDataIntoPopup(nextSceneId, nextCard, activePopup);
        } else if (type === 'galleries') {
            await loadGalleriesDataIntoPopup(nextSceneId, nextCard, activePopup);
        }
    }
    
    function setupSequentialEditHandlers(form, type, sceneId, cardElement, getSelectedIdsFn) {
        const modeCheckbox = form.querySelector(`#${type}-sequential-mode`);
        const prevBtn = form.querySelector(`#${type}-prev-btn`);
        const nextBtn = form.querySelector(`#${type}-next-btn`);
        
        modeCheckbox.replaceWith(modeCheckbox.cloneNode(true));
        const newModeCheckbox = form.querySelector(`#${type}-sequential-mode`);
        
        newModeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!sequentialEditState.enabled || sequentialEditState.allSceneCards.length === 0) {
                    sequentialEditState.allSceneCards = getAllVisibleSceneCards();
                }
                
                const formRect = form.getBoundingClientRect();
                sequentialEditState.popupPosition = {
                    left: formRect.left + window.scrollX,
                    top: formRect.top + window.scrollY
                };
                
                sequentialEditState.enabled = true;
                sequentialEditState.currentType = type;
                sequentialEditState.currentSceneId = sceneId;
                
                sequentialEditState.currentIndex = getSceneCardIndex(sceneId, sequentialEditState.allSceneCards);
                
                if (sequentialEditState.currentIndex === -1) {
                    sequentialEditState.currentIndex = 0;
                }
                
                updateSequentialEditUI(form, type);
            } else {
                resetSequentialEditState();
                updateSequentialEditUI(form, type);
            }
        });
        
        if (sequentialEditState.enabled) {
            newModeCheckbox.checked = true;
            updateSequentialEditUI(form, type);
        }
        
        if (prevBtn) {
            prevBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToNextScene(form, type, -1, getSelectedIdsFn);
            };
        }
        if (nextBtn) {
            nextBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                navigateToNextScene(form, type, 1, getSelectedIdsFn);
            };
        }
    }

    function closeMenu() {
        if (menuOutsideClickHandler) {
            document.removeEventListener('mousedown', menuOutsideClickHandler);
            menuOutsideClickHandler = null;
        }
        if (currentMenu) {
            currentMenu.remove();
            currentMenu = null;
        }
    }

    function closePopup(resetSequential = true) {
        clearPopupCleanupFns();
        if (activeTableInstance) {
            try { activeTableInstance.destroy(); } catch (e) {}
            activeTableInstance = null;
        }
        if (activePopup && activePopup.element) {
            activePopup.element.classList.remove('popup-visible');
            activePopup.element.remove();
            activePopup = null;
        }
        document.querySelectorAll('#scenes-popup').forEach(el => el.remove());
        
        if (resetSequential) {
            resetSequentialEditState();
        }
    }

    let cacheStore = {
        tags: { data: null, timestamp: 0 },
        performers: { data: null, timestamp: 0 },
        galleries: { data: null, timestamp: 0 }
    };
    const CACHE_TTL = 5 * 60 * 1000;

    function getCachedOrNull(type) {
        const item = cacheStore[type];
        if (item.data && (Date.now() - item.timestamp < CACHE_TTL)) {
            return item.data;
        }
        return null;
    }

    function setCache(type, data) {
        cacheStore[type] = { data, timestamp: Date.now() };
    }

    function invalidateCache() {
        cacheStore = {
            tags: { data: null, timestamp: 0 },
            performers: { data: null, timestamp: 0 },
            galleries: { data: null, timestamp: 0 }
        };
    }

    const recentStorageKeys = {
        tags: 'stash_fast_tag_recent_tags',
        performers: 'stash_fast_tag_recent_performers',
        galleries: 'stash_fast_tag_recent_galleries'
    };

    function readRecentEntries(type) {
        try {
            const raw = localStorage.getItem(recentStorageKeys[type]);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function writeRecentEntries(type, value) {
        try {
            localStorage.setItem(recentStorageKeys[type], JSON.stringify((Array.isArray(value) ? value : []).slice(0, 8)));
        } catch (e) {}
    }

    function addRecentEntry(type, item) {
        if (!item || !item.name) return;
        const list = readRecentEntries(type).filter(entry => entry && entry.name && entry.name !== item.name);
        list.unshift({ id: item.id, name: item.name });
        writeRecentEntries(type, list);
    }

    function addRecentEntriesFromSelection(type, selectedItems) {
        if (!Array.isArray(selectedItems)) return;
        selectedItems.filter(Boolean).forEach(item => addRecentEntry(type, item));
    }

    function getSmartSortComparator(type, term, selectedIds) {
        return (a, b) => {
            const aSel = selectedIds.has(String(a.id));
            const bSel = selectedIds.has(String(b.id));
            if (aSel && !bSel) return -1;
            if (!aSel && bSel) return 1;

            const aName = String(a.name || a.title || '').trim().toLowerCase();
            const bName = String(b.name || b.title || '').trim().toLowerCase();
            if (!term) {
                return aName.localeCompare(bName);
            }

            const aExact = aName === term ? 1 : 0;
            const bExact = bName === term ? 1 : 0;
            if (aExact !== bExact) return bExact - aExact;

            const aStarts = aName.startsWith(term) ? 1 : 0;
            const bStarts = bName.startsWith(term) ? 1 : 0;
            if (aStarts !== bStarts) return bStarts - aStarts;

            const aIncludes = aName.includes(term) ? 1 : 0;
            const bIncludes = bName.includes(term) ? 1 : 0;
            if (aIncludes !== bIncludes) return bIncludes - aIncludes;

            return aName.localeCompare(bName);
        };
    }

    function trySelectRecentChip(type, item, selectedIds, input, onSelected) {
        const table = activeTableInstance;
        const itemName = String(item && item.name ? item.name : '').trim().toLowerCase();

        if (!table) {
            if (input) {
                input.value = itemName;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.focus({ preventScroll: true });
            }
            return false;
        }

        const data = Array.isArray(table.getData()) ? table.getData() : [];
        const normalized = (value) => String(value || '').trim().toLowerCase();

        let match = data.find(row => normalized(row.name || row.title) === itemName);
        if (!match) {
            match = data.find(row => normalized(row.name || row.title).includes(itemName));
        }

        if (match && match.id != null) {
            const rowId = String(match.id);
            selectedIds.add(rowId);
            try {
                table.deselectRow();
                table.selectRow(rowId);
                const row = table.getRow(rowId);
                if (row) {
                    table.scrollToRow(row, 'top', false);
                }
            } catch (e) {}

            if (typeof onSelected === 'function') {
                onSelected();
            }

            if (input) {
                input.value = '';
                input.focus({ preventScroll: true });
            }
            return true;
        }

        if (input) {
            input.value = item && item.name ? item.name : '';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.focus({ preventScroll: true });
        }
        return false;
    }

    function renderQuickActions(form, type, input, selectedIds, sourceItems, labelField, onRecentChipSelect) {
        const target = form.querySelector(`#${type}-quick-actions`);
        if (!target) return;

        const recent = readRecentEntries(type)
            .slice(0, 8)
            .filter(item => item && item.name)
            .map(item => ({ id: item.id, name: item.name }));

        if (!recent.length) {
            target.innerHTML = '';
            target.style.display = 'none';
            return;
        }

        target.innerHTML = '';
        target.style.display = 'flex';
        target.style.flexWrap = 'wrap';
        target.style.gap = '6px';
        target.style.marginBottom = '10px';

        recent.forEach(item => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.textContent = item.name;
            chip.style.cssText = 'padding: 4px 6px; border: 1px solid #dfe3ea; border-radius: 999px; background: #f8fafc; color: #243447; font-size: 10px; cursor: pointer;';
            chip.addEventListener('click', () => {
                trySelectRecentChip(type, item, selectedIds, input, onRecentChipSelect);
            });
            target.appendChild(chip);
        });
    }

    function createCustomMenu(clickEvent, sceneId, cardElement) {
        const menu = document.createElement('div');
        menu.id = 'scenes-custom-menu';
        menu.style.position = 'absolute';
        menu.style.zIndex = '999999';

        const editTagsLink = document.createElement('a');
        editTagsLink.href = '#';
        editTagsLink.textContent = 'Edit Tags...';
        editTagsLink.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            createTagsPopup(sceneId, cardElement);
        });
        menu.appendChild(editTagsLink);

        const editPerformersLink = document.createElement('a');
        editPerformersLink.href = '#';
        editPerformersLink.textContent = 'Edit Performers...';
        editPerformersLink.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            createPerformersPopup(sceneId, cardElement);
        });
        menu.appendChild(editPerformersLink);

        const editGalleriesLink = document.createElement('a');
        editGalleriesLink.href = '#';
        editGalleriesLink.textContent = 'Edit Galleries...';
        editGalleriesLink.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            createGalleriesPopup(sceneId, cardElement);
        });
        menu.appendChild(editGalleriesLink);

        const editSceneLink = document.createElement('a');
        editSceneLink.href = '#';
        editSceneLink.textContent = 'Edit Scene';
        editSceneLink.addEventListener('click', function(e) {
            e.preventDefault();
            closeMenu();
            openEditScenePage(sceneId);
        });
        menu.appendChild(editSceneLink);

        const hr = document.createElement('div');
        hr.style.height = '1px';
        hr.style.background = '#e2e8f0';
        hr.style.margin = '4px 0';
        menu.appendChild(hr);

        const supportLink = document.createElement('a');
        supportLink.href = 'https://www.patreon.com/serechops/membership';
        supportLink.textContent = 'Support';
        supportLink.style.color = '#d97706';
        supportLink.target = '_blank';
        supportLink.addEventListener('click', () => { closeMenu(); });
        menu.appendChild(supportLink);

        document.body.appendChild(menu);
        currentMenu = menu;
        return menu;
    }

    function showCustomMenu(event, sceneId, cardElement) {
        closeMenu();
        closePopup();

        const menu = createCustomMenu(event, sceneId, cardElement);
        event.preventDefault();

        const absX = event.clientX + window.scrollX;
        const absY = event.clientY + window.scrollY;

        menu.style.visibility = 'hidden';
        menu.style.top = `${absY}px`;
        menu.style.left = `${absX}px`;

        requestAnimationFrame(() => {
            const rect = menu.getBoundingClientRect();
            let posX = absX;
            let posY = absY;

            if (event.clientX + rect.width > window.innerWidth) {
                posX = (window.innerWidth + window.scrollX) - rect.width - 10;
            }
            if (event.clientY + rect.height > window.innerHeight) {
                posY = (window.innerHeight + window.scrollY) - rect.height - 10;
            }

            menu.style.top = `${posY}px`;
            menu.style.left = `${posX}px`;
            menu.style.visibility = 'visible';
        });

        const handleOutsideClick = (e) => {
            if (!menu.contains(e.target)) {
                closeMenu();
            }
        };
        menuOutsideClickHandler = handleOutsideClick;
        document.addEventListener('mousedown', handleOutsideClick);
    }

    function extractSceneId(cardElement) {
        const link = cardElement.querySelector('a[href*="/scenes/"]');
        if (link) {
            const match = link.href.match(/scenes\/([a-zA-Z0-9-]+)/);
            if (match) return match[1];
        }
        return null;
    }

    // ==========================================
    // POPUP SHELL CREATION BUILDERS
    // ==========================================
    function createPopupShell(type) {
        const form = document.createElement('form');
        form.id = 'scenes-popup';
        form.setAttribute('autocomplete', 'off');
        form.style.position = 'absolute';
        form.style.zIndex = '1000000';
        form.style.padding = '14px';
        form.style.background = '#ffffff';
        form.style.border = '1px solid #e2e8f0';
        form.style.borderRadius = '10px';
        form.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1)';
        form.style.width = '340px';
        form.style.boxSizing = 'border-box';
        form.style.fontFamily = 'system-ui, -apple-system, sans-serif';
        
        const titleText = `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} for Scene`;
        const buttonText = `Save ${type.charAt(0).toUpperCase() + type.slice(1)}`;

        form.innerHTML = `
            <h2 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; user-select: none; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
                <span id="${type}-popup-title">${titleText}</span>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" id="${type}-prev-btn" style="padding: 2px 6px; cursor: pointer; font-size: 11px; background: #64748b; color: white; border: none; border-radius: 4px; display: none;">◄ Prev</button>
                    <button type="button" id="${type}-next-btn" style="padding: 2px 6px; cursor: pointer; font-size: 11px; background: #64748b; color: white; border: none; border-radius: 4px; display: none;">Next ►</button>
                    <span class="popup-drag-handle" style="font-size: 11px; color: #64748b; font-weight: normal; cursor: grab; user-select: none; padding: 2px 4px; border-radius: 4px;">Draggable</span>
                </div>
            </h2>
            <div id="${type}-preview-container"></div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <label style="font-size: 11px; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <input type="checkbox" id="${type}-sequential-mode" style="cursor: pointer;">
                    Sequential Edit Mode
                </label>
            </div>
            <div style="display: flex; gap: 6px; margin-bottom: 10px; align-items: center;">
                <div style="position: relative; flex: 1;">
                    <input type="text" id="${type}-search-input" autocomplete="off" spellcheck="false" placeholder="Search..." style="width: 100%; padding: 7px 28px 7px 10px; box-sizing: border-box; border-radius: 6px; border: 1px solid #cbd5e1; background: #ffffff; color: #1e293b; font-size: 12px; outline: none;">
                    <span id="${type}-search-clear" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); cursor: pointer; color: #94a3b8; font-size: 16px; line-height: 1; display: none; user-select: none;">&times;</span>
                </div>
                <button type="button" id="${type}-create-btn" style="padding: 7px 8px; cursor: pointer; font-size: 12px; font-weight: 500; background: #10b981; color: white; border: none; border-radius: 6px; white-space: nowrap; display: none;">Create</button>
                <button type="button" id="${type}-refresh-btn" style="padding: 7px 8px; cursor: pointer; font-size: 12px; font-weight: 500; background: #64748b; color: white; border: none; border-radius: 6px; white-space: nowrap;">Refresh</button>
            </div>
            <div id="${type}-quick-actions" style="display: none; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;"></div>
            <div id="${type}-tabulator-table" style="margin-bottom: 10px; width: 100%; box-sizing: border-box;"></div>
            <div style="display: flex; gap: 8px;">
                <button type="button" id="${type}-save-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 12px; font-weight: 500; background: #6366f1; color: white; border: none; border-radius: 6px;">${buttonText}</button>
                <button type="button" id="${type}-cancel-btn" style="flex: 1; padding: 7px; cursor: pointer; font-size: 12px; font-weight: 500; background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; border-radius: 6px;">Close</button>
            </div>
        `;

        document.body.appendChild(form);
        return {
            element: form,
            previewContainer: form.querySelector(`#${type}-preview-container`),
            tableContainer: form.querySelector(`#${type}-tabulator-table`),
            searchInput: form.querySelector(`#${type}-search-input`),
            searchClear: form.querySelector(`#${type}-search-clear`),
            createBtn: form.querySelector(`#${type}-create-btn`),
            refreshBtn: form.querySelector(`#${type}-refresh-btn`),
            saveBtn: form.querySelector(`#${type}-save-btn`),
            cancelBtn: form.querySelector(`#${type}-cancel-btn`)
        };
    }

    // ==========================================
    // 1. TAGS POPUP LOGIC
    // ==========================================
    async function createTagsPopup(sceneId, cardElement) {
        if (typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load.");
            return;
        }
        closePopup(false);

        activePopup = createPopupShell('tags');
        const form = activePopup.element;

        const table = new Tabulator(activePopup.tableContainer, {
            layout: "fitColumns",
            height: "300px",
            placeholder: "No Tags Found",
            selectable: true,
            index: "id",
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true },
                { title: "Name", field: "name", widthGrow: 2, resizable: true },
            ],
            persistence: { columns: true },
            persistenceMode: "local",
        });
        activeTableInstance = table;

        await loadTagsDataIntoPopup(sceneId, cardElement, activePopup);
        positionPopupNearCard(form, cardElement);
    }

    async function loadTagsDataIntoPopup(sceneId, cardElement, popup) {
        const form = popup.element;
        attachScenePreview(popup.previewContainer, sceneId, cardElement);

        const existingIds = await fetchExistingTagIds(sceneId);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        sequentialEditState.initialSelectedIds = new Set(selectedIds);
        let isRestoringSelections = false;

        setupSequentialEditHandlers(form, 'tags', sceneId, cardElement, () => selectedIds);

        setupPopupDragAndClose(form, async () => {
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndRefreshTags(sceneId, selectedIds);
        });

        const filterInput = popup.searchInput;
        const clearBtn = popup.searchClear;
        const createBtn = popup.createBtn;
        const refreshBtn = popup.refreshBtn;

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
        };

        activeTableInstance.off("rowSelected");
        activeTableInstance.off("rowDeselected");

        activeTableInstance.on("rowSelected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.add(String(id));
                
                const hasSearch = filterInput.value.trim().length > 0;
                if (hasSearch) {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData("", false).then(() => {
                        const r = activeTableInstance.getRow(id);
                        if (r) activeTableInstance.scrollToRow(r, "top", false);
                        filterInput.focus({ preventScroll: true });
                    });
                }
            }
        });

        activeTableInstance.on("rowDeselected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                if (filterInput.value.trim().length > 0) {
                    fetchData(filterInput.value.trim(), false);
                }
            }
        });

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull('tags');
            if (!cachedData) {
                cachedData = await fetchTags();
                setCache('tags', cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = cachedData;
            if (term) {
                const tokens = term.split(/\s+/);
                data = cachedData.filter(item => tokens.every(t => (item.name || '').toLowerCase().includes(t)));
            }

            data.sort(getSmartSortComparator('tags', term, selectedIds));

            isRestoringSelections = true;
            try {
                await activeTableInstance.setData(data);
                selectedIds.forEach(id => {
                    const r = activeTableInstance.getRow(id);
                    if (r) activeTableInstance.selectRow(r);
                });
                renderQuickActions(form, 'tags', filterInput, selectedIds, data, 'name', () => {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData('', false);
                    saveTagsWithoutReload(sceneId, selectedIds);
                });
                if (resetScroll && data.length > 0) activeTableInstance.scrollToRow(activeTableInstance.getRows()[0], "top", false);
            } finally {
                isRestoringSelections = false;
            }
        }

        let debounceTimer = null;
        filterInput.oninput = (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData(e.target.value, true);
            }, 150);
        };

        clearBtn.onclick = () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus({ preventScroll: true });
        };

        refreshBtn.onclick = async () => {
            invalidateCache();
            await fetchData(filterInput.value.trim(), false);
        };

        createBtn.onclick = async () => {
            const val = filterInput.value.trim();
            if (!val) return;
            const newId = await createNewTag(val);
            if (newId) {
                invalidateCache();
                selectedIds.add(String(newId));
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                filterInput.focus({ preventScroll: true });
            }
        };

        await fetchData("", true);

        popup.saveBtn.onclick = async () => {
            if (sequentialEditState.enabled) return;
            const selectedItems = Array.from(selectedIds).map(id => {
                const item = getCachedOrNull('tags') || [];
                return item.find(entry => String(entry.id) === String(id));
            }).filter(Boolean);
            addRecentEntriesFromSelection('tags', selectedItems);
            renderQuickActions(form, 'tags', filterInput, selectedIds, selectedItems, 'name', () => {
                filterInput.value = '';
                updateVisibility();
                fetchData('', false);
                saveTagsWithoutReload(sceneId, selectedIds);
            });
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveTagsWithoutReload(sceneId, selectedIds);
        };

        popup.cancelBtn.onclick = () => { closePopup(); };
    }

    async function saveTagsWithoutReload(sceneId, selectedIds) {
        sessionStorage.setItem(scrollKey, window.scrollY);
        const success = await updateSceneWithTags(sceneId, Array.from(selectedIds));
        if (success) {
            await refreshSceneCards();
            toastSuccess('Tag saved');
        }
        return success;
    }

    async function saveAndRefreshTags(sceneId, selectedIds) {
        const success = await updateSceneWithTags(sceneId, Array.from(selectedIds));
        if (success) {
            await refreshSceneCards();
            closePopup();
            toastSuccess('Scene updated');
        }
        return success;
    }

    // ==========================================
    // 2. PERFORMERS POPUP LOGIC
    // ==========================================
    async function createPerformersPopup(sceneId, cardElement) {
        if (typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load.");
            return;
        }
        closePopup(false);

        activePopup = createPopupShell('performers');
        const form = activePopup.element;

        const table = new Tabulator(activePopup.tableContainer, {
            layout: "fitColumns",
            height: "300px",
            placeholder: "No Performers Found",
            selectable: true,
            index: "id",
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true },
                { title: "Name", field: "name", widthGrow: 2, resizable: true },
                { title: "Disambiguation", field: "disambiguation", widthGrow: 1, resizable: true },
            ],
            persistence: { columns: true },
            persistenceMode: "local",
        });
        activeTableInstance = table;

        await loadPerformersDataIntoPopup(sceneId, cardElement, activePopup);
        positionPopupNearCard(form, cardElement);
    }

    async function loadPerformersDataIntoPopup(sceneId, cardElement, popup) {
        const form = popup.element;
        attachScenePreview(popup.previewContainer, sceneId, cardElement);

        const existingIds = await fetchExistingPerformerIds(sceneId);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        sequentialEditState.initialSelectedIds = new Set(selectedIds);
        let isRestoringSelections = false;

        setupSequentialEditHandlers(form, 'performers', sceneId, cardElement, () => selectedIds);

        setupPopupDragAndClose(form, async () => {
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndRefreshPerformers(sceneId, selectedIds);
        });

        const filterInput = popup.searchInput;
        const clearBtn = popup.searchClear;
        const createBtn = popup.createBtn;
        const refreshBtn = popup.refreshBtn;

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
        };

        activeTableInstance.off("rowSelected");
        activeTableInstance.off("rowDeselected");

        activeTableInstance.on("rowSelected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.add(String(id));
                
                const hasSearch = filterInput.value.trim().length > 0;
                if (hasSearch) {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData("", false).then(() => {
                        const r = activeTableInstance.getRow(id);
                        if (r) activeTableInstance.scrollToRow(r, "top", false);
                        filterInput.focus({ preventScroll: true });
                    });
                }
            }
        });

        activeTableInstance.on("rowDeselected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                if (filterInput.value.trim().length > 0) {
                    fetchData(filterInput.value.trim(), false);
                }
            }
        });

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull('performers');
            if (!cachedData) {
                cachedData = await fetchPerformers();
                setCache('performers', cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = cachedData;
            if (term) {
                const tokens = term.split(/\s+/);
                data = cachedData.filter(item => tokens.every(t => (item.name || '').toLowerCase().includes(t)));
            }

            data.sort(getSmartSortComparator('performers', term, selectedIds));

            isRestoringSelections = true;
            try {
                await activeTableInstance.setData(data);
                selectedIds.forEach(id => {
                    const r = activeTableInstance.getRow(id);
                    if (r) activeTableInstance.selectRow(r);
                });
                renderQuickActions(form, 'performers', filterInput, selectedIds, data, 'name', () => {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData('', false);
                    savePerformersWithoutReload(sceneId, selectedIds);
                });
                if (resetScroll && data.length > 0) activeTableInstance.scrollToRow(activeTableInstance.getRows()[0], "top", false);
            } finally {
                isRestoringSelections = false;
            }
        }

        let debounceTimer = null;
        filterInput.oninput = (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData(e.target.value, true);
            }, 150);
        };

        clearBtn.onclick = () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus({ preventScroll: true });
        };

        refreshBtn.onclick = async () => {
            invalidateCache();
            await fetchData(filterInput.value.trim(), false);
        };

        createBtn.onclick = async () => {
            const val = filterInput.value.trim();
            if (!val) return;
            const newId = await createNewPerformer(val);
            if (newId) {
                invalidateCache();
                selectedIds.add(String(newId));
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                filterInput.focus({ preventScroll: true });
            }
        };

        await fetchData("", true);

        popup.saveBtn.onclick = async () => {
            if (sequentialEditState.enabled) return;
            const selectedItems = Array.from(selectedIds).map(id => {
                const item = getCachedOrNull('performers') || [];
                return item.find(entry => String(entry.id) === String(id));
            }).filter(Boolean);
            addRecentEntriesFromSelection('performers', selectedItems);
            renderQuickActions(form, 'performers', filterInput, selectedIds, selectedItems, 'name', () => {
                filterInput.value = '';
                updateVisibility();
                fetchData('', false);
                savePerformersWithoutReload(sceneId, selectedIds);
            });
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await savePerformersWithoutReload(sceneId, selectedIds);
        };

        popup.cancelBtn.onclick = () => { closePopup(); };
    }

    async function savePerformersWithoutReload(sceneId, selectedIds) {
        sessionStorage.setItem(scrollKey, window.scrollY);
        const success = await updateSceneWithPerformers(sceneId, Array.from(selectedIds));
        if (success) {
            await refreshSceneCards();
            toastSuccess('Performer saved');
        }
        return success;
    }

    async function saveAndRefreshPerformers(sceneId, selectedIds) {
        const success = await updateSceneWithPerformers(sceneId, Array.from(selectedIds));
        if (success) {
            await refreshSceneCards();
            closePopup();
            toastSuccess('Scene updated');
        }
        return success;
    }

    // ==========================================
    // 3. GALLERIES POPUP LOGIC
    // ==========================================
    async function createGalleriesPopup(sceneId, cardElement) {
        if (typeof Tabulator === 'undefined') {
            toastError("Tabulator library failed to load.");
            return;
        }
        closePopup(false);

        activePopup = createPopupShell('galleries');
        const form = activePopup.element;

        const table = new Tabulator(activePopup.tableContainer, {
            layout: "fitColumns",
            height: "280px",
            placeholder: "No Galleries Found",
            selectable: true,
            index: "id",
            columns: [
                { title: "ID", field: "id", width: 60, hozAlign: "center", headerHozAlign: "center", resizable: true },
                { title: "Title", field: "title", widthGrow: 2, resizable: true },
            ],
            persistence: { columns: true },
            persistenceMode: "local",
        });
        activeTableInstance = table;

        await loadGalleriesDataIntoPopup(sceneId, cardElement, activePopup);
        positionPopupNearCard(form, cardElement);
    }

    async function loadGalleriesDataIntoPopup(sceneId, cardElement, popup) {
        const form = popup.element;
        attachScenePreview(popup.previewContainer, sceneId, cardElement);

        const existingIds = await fetchExistingGalleryIds(sceneId);
        const selectedIds = new Set(existingIds.map(id => String(id)));
        sequentialEditState.initialSelectedIds = new Set(selectedIds);
        let isRestoringSelections = false;

        setupSequentialEditHandlers(form, 'galleries', sceneId, cardElement, () => selectedIds);

        setupPopupDragAndClose(form, async () => {
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveAndReloadGalleries(sceneId, selectedIds);
        });

        const filterInput = popup.searchInput;
        const clearBtn = popup.searchClear;
        const createBtn = popup.createBtn;
        const refreshBtn = popup.refreshBtn;

        const updateVisibility = () => {
            const hasVal = filterInput.value.trim().length > 0;
            clearBtn.style.display = hasVal ? 'block' : 'none';
            createBtn.style.display = hasVal ? 'block' : 'none';
        };

        activeTableInstance.off("rowSelected");
        activeTableInstance.off("rowDeselected");

        activeTableInstance.on("rowSelected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.add(String(id));
                
                const hasSearch = filterInput.value.trim().length > 0;
                if (hasSearch) {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData("", false).then(() => {
                        const r = activeTableInstance.getRow(id);
                        if (r) activeTableInstance.scrollToRow(r, "top", false);
                        filterInput.focus({ preventScroll: true });
                    });
                }
            }
        });

        activeTableInstance.on("rowDeselected", function(row) {
            if (!isRestoringSelections) {
                const id = row.getData().id;
                if (id) selectedIds.delete(String(id));
                if (filterInput.value.trim().length > 0) {
                    fetchData(filterInput.value.trim(), false);
                }
            }
        });

        async function fetchData(query, resetScroll = true) {
            let cachedData = getCachedOrNull('galleries');
            if (!cachedData) {
                cachedData = await fetchGalleries();
                setCache('galleries', cachedData);
            }
            if (!cachedData) return;

            const term = query.trim().toLowerCase();
            let data = cachedData;
            if (term) {
                const tokens = term.split(/\s+/);
                data = cachedData.filter(item => tokens.every(t => (item.title || '').toLowerCase().includes(t)));
            }

            data.sort(getSmartSortComparator('galleries', term, selectedIds));

            isRestoringSelections = true;
            try {
                await activeTableInstance.setData(data);
                selectedIds.forEach(id => {
                    const r = activeTableInstance.getRow(id);
                    if (r) activeTableInstance.selectRow(r);
                });
                renderQuickActions(form, 'galleries', filterInput, selectedIds, data, 'title', () => {
                    filterInput.value = '';
                    updateVisibility();
                    fetchData('', false);
                    saveGalleriesWithoutReload(sceneId, selectedIds);
                });
                if (resetScroll && data.length > 0) activeTableInstance.scrollToRow(activeTableInstance.getRows()[0], "top", false);
            } finally {
                isRestoringSelections = false;
            }
        }

        let debounceTimer = null;
        filterInput.oninput = (e) => {
            updateVisibility();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData(e.target.value, true);
            }, 150);
        };

        clearBtn.onclick = () => {
            filterInput.value = '';
            updateVisibility();
            fetchData("", true);
            filterInput.focus({ preventScroll: true });
        };

        refreshBtn.onclick = async () => {
            invalidateCache();
            await fetchData(filterInput.value.trim(), false);
        };

        createBtn.onclick = async () => {
            const val = filterInput.value.trim();
            if (!val) return;
            const newId = await createNewGallery(val);
            if (newId) {
                invalidateCache();
                selectedIds.add(String(newId));
                filterInput.value = '';
                updateVisibility();
                await fetchData("", true);
                filterInput.focus({ preventScroll: true });
            }
        };

        await fetchData("", true);

        popup.saveBtn.onclick = async () => {
            if (sequentialEditState.enabled) return;
            const selectedItems = Array.from(selectedIds).map(id => {
                const item = getCachedOrNull('galleries') || [];
                return item.find(entry => String(entry.id) === String(id));
            }).filter(Boolean);
            addRecentEntriesFromSelection('galleries', selectedItems);
            renderQuickActions(form, 'galleries', filterInput, selectedIds, selectedItems, 'title', () => {
                filterInput.value = '';
                updateVisibility();
                fetchData('', false);
                saveGalleriesWithoutReload(sceneId, selectedIds);
            });
            if (!isTabActive) await new Promise(r => setTimeout(r, 200));
            await saveGalleriesWithoutReload(sceneId, selectedIds);
        };

        popup.cancelBtn.onclick = () => { closePopup(); };
    }

    async function saveGalleriesWithoutReload(sceneId, selectedIds) {
        sessionStorage.setItem(scrollKey, window.scrollY);
        const success = await updateSceneWithGalleries(sceneId, Array.from(selectedIds));
        if (success) {
            toastSuccess('Gallery saved');
        }
        return success;
    }

    async function saveAndReloadGalleries(sceneId, selectedIds) {
        const success = await updateSceneWithGalleries(sceneId, Array.from(selectedIds));
        if (success) {
            await refreshSceneCards();
            closePopup();
            toastSuccess('Scene updated');
        }
        return success;
    }

    // ==========================================
    // SHARED HELPER FUNCTIONS
    // ==========================================
    async function refreshSceneCards() {
        const apollo = window.__APOLLO_CLIENT__;
        if (!apollo || typeof apollo.getObservableQueries !== 'function') return false;

        const sceneQueries = [...apollo.getObservableQueries().values()].filter(query => {
            const queryText = query.options?.query?.loc?.source?.body || '';
            return queryText.includes('FindScenes') && typeof query.refetch === 'function';
        });

        if (!sceneQueries.length) return false;
        await Promise.all(sceneQueries.map(query => query.refetch()));
        return true;
    }

    function setupPopupDragAndClose(form, onSaveCallback) {
        const handleOutsideClick = (e) => {
            if (!form.contains(e.target)) {
                closePopup();
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closePopup();
            } else if (e.key === 'Enter') {
                const isSearchFocused = document.activeElement && document.activeElement.tagName === 'INPUT';

                if (isSearchFocused) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }

                if (!isSearchFocused || e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    if (!sequentialEditState.enabled && onSaveCallback) onSaveCallback();
                }
            }
        };

        popupCleanupFns.push(() => document.removeEventListener('mousedown', handleOutsideClick));
        popupCleanupFns.push(() => document.removeEventListener('keydown', handleKeyDown));
        popupCleanupFns.push(() => {
            document.onmousemove = null;
            document.onmouseup = null;
        });

        setTimeout(() => { document.addEventListener('mousedown', handleOutsideClick); }, 0);
        document.addEventListener('keydown', handleKeyDown);

        let isDragging = false;
        let dragOffsetX, dragOffsetY;
        const dragHandle = form.querySelector('h2') || form.querySelector('.popup-drag-handle');
        if (dragHandle) {
            dragHandle.onmousedown = function(e) {
                isDragging = true;
                dragOffsetX = e.clientX - form.offsetLeft;
                dragOffsetY = e.clientY - form.offsetTop;
                document.onmousemove = function(e) {
                    if (isDragging) {
                        form.style.left = `${e.clientX - dragOffsetX}px`;
                        form.style.top = `${e.clientY - dragOffsetY}px`;
                    }
                };
                document.onmouseup = function() {
                    isDragging = false;
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };
        }
    }

    function positionPopupNearCard(form, cardElement) {
        if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0) {
            form.style.left = `${sequentialEditState.popupPosition.left}px`;
            form.style.top = `${sequentialEditState.popupPosition.top}px`;
            
            requestAnimationFrame(() => {
                form.classList.add('popup-visible');
            });
            
            const firstInput = form.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
            return;
        }
        
        const cardRect = cardElement.getBoundingClientRect();
        let popupX = cardRect.right + window.scrollX + 10;
        let popupY = cardRect.top + window.scrollY;

        form.style.left = `${popupX}px`;
        form.style.top = `${popupY}px`;

        requestAnimationFrame(() => {
            const formRect = form.getBoundingClientRect();
            if (cardRect.right + 10 + formRect.width > window.innerWidth) {
                popupX = cardRect.left + window.scrollX - formRect.width - 10;
            }
            if (cardRect.top + formRect.height > window.innerHeight) {
                popupY = (window.innerHeight + window.scrollY) - formRect.height - 10;
            }
            form.style.left = `${popupX}px`;
            form.style.top = `${popupY}px`;
            
            form.classList.add('popup-visible');

            const firstInput = form.querySelector('input[type="text"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
        });
    }

    async function fetchTags() {
        const gqlQuery = `query { findTags(filter: { per_page: -1 }) { tags { id name } } }`;
        const res = await fetchGQL(gqlQuery);
        return res.data?.findTags?.tags || [];
    }

    async function fetchPerformers() {
        const gqlQuery = `query { findPerformers(filter: { per_page: -1 }) { performers { id name disambiguation } } }`;
        const res = await fetchGQL(gqlQuery);
        return res.data?.findPerformers?.performers || [];
    }

    async function fetchGalleries() {
        const gqlQuery = `query { findGalleries(filter: { per_page: -1 }) { galleries { id title } } }`;
        const res = await fetchGQL(gqlQuery);
        return res.data?.findGalleries?.galleries || [];
    }

    async function createNewTag(name) {
        const mutation = `mutation ($name: String!) { tagCreate(input: { name: $name }) { id name } }`;
        const res = await fetchGQL(mutation, { name });
        if (res.errors) { toastError('Failed to create tag', res.errors); return null; }
        toastSuccess('Tag created successfully', res.data.tagCreate);
        return res.data.tagCreate.id;
    }

    async function createNewPerformer(name) {
        const mutation = `mutation ($name: String!) { performerCreate(input: { name: $name }) { id name } }`;
        const res = await fetchGQL(mutation, { name });
        if (res.errors) { toastError('Failed to create performer', res.errors); return null; }
        toastSuccess('Performer created successfully', res.data.performerCreate);
        return res.data.performerCreate.id;
    }

    async function createNewGallery(title) {
        const mutation = `mutation ($title: String!) { galleryCreate(input: { title: $title }) { id title } }`;
        const res = await fetchGQL(mutation, { title });
        if (res.errors) { toastError('Failed to create gallery', res.errors); return null; }
        toastSuccess('Gallery created successfully', res.data.galleryCreate);
        return res.data.galleryCreate.id;
    }

    async function updateSceneWithTags(sceneId, tagIds) {
        const mutationQuery = `mutation ($scene_id: ID!, $tag_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, tag_ids: $tag_ids }) { id } }`;
        const res = await fetchGQL(mutationQuery, { scene_id: sceneId, tag_ids: tagIds });
        if (res.errors) { toastError('Failed to update the scene with tags', res.errors); return false; }
        return true;
    }

    async function updateSceneWithPerformers(sceneId, performerIds) {
        const gqlQuery = `mutation ($scene_id: ID!, $performer_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, performer_ids: $performer_ids }) { id } }`;
        const res = await fetchGQL(gqlQuery, { scene_id: sceneId, performer_ids: performerIds });
        if (res.errors) { toastError('Failed to update the scene with performers', res.errors); return false; }
        return true;
    }

    async function updateSceneWithGalleries(sceneId, galleryIds) {
        const gqlQuery = `mutation ($scene_id: ID!, $gallery_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, gallery_ids: $gallery_ids }) { id } }`;
        const res = await fetchGQL(gqlQuery, { scene_id: sceneId, gallery_ids: galleryIds });
        if (res.errors) { toastError('Failed to update the scene with galleries', res.errors); return false; }
        return true;
    }

    async function fetchExistingTagIds(sceneId) {
        const query = `query ($id: ID!) { findScene(id: $id) { tags { id } } }`;
        const res = await fetchGQL(query, { id: sceneId });
        return res.data?.findScene?.tags?.map(tag => tag.id) || [];
    }

    async function fetchExistingPerformerIds(sceneId) {
        const query = `query ($id: ID!) { findScene(id: $id) { performers { id } } }`;
        const res = await fetchGQL(query, { id: sceneId });
        return res.data?.findScene?.performers?.map(performer => performer.id) || [];
    }

    async function fetchExistingGalleryIds(sceneId) {
        const query = `query ($id: ID!) { findScene(id: $id) { galleries { id } } }`;
        const res = await fetchGQL(query, { id: sceneId });
        return res.data?.findScene?.galleries?.map(gallery => gallery.id) || [];
    }

    function openEditScenePage(sceneId) {
        const editPageUrl = `/scenes/${sceneId}/edit`;
        const newWindow = window.open(editPageUrl, '_blank');
        if (newWindow) {
            newWindow.onload = () => {
                setTimeout(() => {
                    const editTab = newWindow.document.querySelector('[data-rb-event-key="scene-edit-panel"]');
                    if (editTab) editTab.click();
                }, 1000);
            };
        }
    }

    document.addEventListener('contextmenu', async function(event) {
        if (activePopup || currentMenu) return;

        const sceneCard = event.target.closest('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
        if (!sceneCard) return;

        const sceneId = extractSceneId(sceneCard);
        if (sceneId) {
            showCustomMenu(event, sceneId, sceneCard);
        }
    }, true);

    document.addEventListener('click', function(event) {
        if (activePopup) return;

        const sceneCard = event.target.closest('.scene-card, .card, [class*="scene-card"], [class*="SceneCard"]');
        if (!sceneCard) return;

        if (event.target.closest('input[type="checkbox"], .checkbox, [class*="checkbox"]')) {
            return;
        }

        if (event.target.closest('a[href*="/scenes/"]:not([class*="tag"]):not([class*="performer"]):not([class*="gallery"])')) {
            return;
        }

        const targetLink = event.target.closest('a');
        const href = targetLink ? targetLink.getAttribute('href') || '' : '';
        const badgeElement = event.target.closest('.minimal.btn, .btn-primary, .badge-button, .tag-button, .performer-button, .gallery-button, .btn[minimal], button.minimal');

        function isClickWithinButton(element, clickEvent) {
            if (!element) return false;
            
            const rect = element.getBoundingClientRect();
            const clickX = clickEvent.clientX;
            const clickY = clickEvent.clientY;
            
            return clickX >= rect.left && clickX <= rect.right && 
                   clickY >= rect.top && clickY <= rect.bottom;
        }

        const clickedWithinButton = isClickWithinButton(badgeElement, event) || 
                                    isClickWithinButton(event.target, event);

        if (!clickedWithinButton) {
            return; 
        }

        const currentPath = window.location.pathname;
        const isScenesPage = currentPath.startsWith('/scenes');
        const isMainTagsPage = currentPath === '/tags' || currentPath.startsWith('/tags?');
        const isMainPerformersPage = currentPath === '/performers' || currentPath.startsWith('/performers?');
        const isMainGalleriesPage = currentPath === '/galleries' || currentPath.startsWith('/galleries?');
        const isTagDetailPage = currentPath.match(/^\/tags\/\d+\/scenes/);
        const isPerformerDetailPage = currentPath.match(/^\/performers\/\d+\/scenes/);
        const isGalleryDetailPage = currentPath.match(/^\/galleries\/\d+\/scenes/);

        if (isScenesPage || isTagDetailPage || isPerformerDetailPage || isGalleryDetailPage) {
            if (!badgeElement && !href.includes('/tags/') && !href.includes('/performers/') && !href.includes('/galleries/')) {
                return;
            }
        } else if (isMainTagsPage || isMainPerformersPage || isMainGalleriesPage) {
            if (!badgeElement) {
                return;
            }
        } else {
            if (!badgeElement && !href.includes('/tags/') && !href.includes('/performers/') && !href.includes('/galleries/')) {
                return;
            }
        }

        const sceneId = extractSceneId(sceneCard);
        if (!sceneId) return;

        const svg = (badgeElement || targetLink)?.querySelector('svg') || event.target.closest('svg');
        const iconClass = svg ? svg.getAttribute('class') || '' : '';
        const combinedContext = (badgeElement ? badgeElement.outerHTML : '') + ' ' + href + ' ' + iconClass;

        event.preventDefault();
        event.stopImmediatePropagation();
        closeMenu();

        if (combinedContext.includes('/performers/') || iconClass.includes('fa-user') || combinedContext.includes('performer')) {
            createPerformersPopup(sceneId, sceneCard);
        } else if (combinedContext.includes('/galleries/') || iconClass.includes('fa-images') || combinedContext.includes('gallery')) {
            createGalleriesPopup(sceneId, sceneCard);
        } else {
            createTagsPopup(sceneId, sceneCard);
        }
    }, true);

})();