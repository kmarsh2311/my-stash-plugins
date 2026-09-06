(function initializeFastTagPopup(root) {
    'use strict';

    let dependencies = null;

    function configure(options) {
        dependencies = options;
    }

    function getSavedSize(type = 'single') {
        if (!dependencies) throw new Error('[FastTag] Popup integration is not configured');
        try {
            const key = type === 'everything' ? 'stash_fast_tag_popup_size_everything' : 'stash_fast_tag_popup_size_single';
            const value = root.localStorage.getItem(key)
                || (type !== 'everything' ? root.localStorage.getItem('stash_fast_tag_popup_size') : null);
            if (value) {
                const parsed = JSON.parse(value);
                if (parsed && parsed.width && parsed.height) return parsed;
            }
        } catch (error) {}
        return dependencies.getOptimalPopupSize(type);
    }

    function setSavedSize(width, height, type = 'single') {
        try {
            const key = type === 'everything' ? 'stash_fast_tag_popup_size_everything' : 'stash_fast_tag_popup_size_single';
            root.localStorage.setItem(key, JSON.stringify({ width: Math.round(width), height: Math.round(height) }));
        } catch (error) {}
    }

    function positionNearCard(form, cardElement) {
        if (!dependencies) throw new Error('[FastTag] Popup integration is not configured');
        const minTop = 8;
        const minLeft = 8;
        const sequentialEditState = dependencies.getSequentialEditState();

        const clampPos = (x, y) => {
            const formW = form.offsetWidth || 400;
            const formH = form.offsetHeight || 500;
            const maxAllowedTop = Math.max(minTop, root.innerHeight - formH - 8);
            const maxAllowedLeft = Math.max(minLeft, root.innerWidth - formW - 8);
            return {
                x: Math.max(minLeft, Math.min(maxAllowedLeft, x)),
                y: Math.max(minTop, Math.min(maxAllowedTop, y))
            };
        };

        const popupType = form.getAttribute('data-popup-type') || dependencies.getActivePopup?.()?.type;
        const isEverythingModal = popupType === 'everything' || popupType === 'bulk-everything';

        if (isEverythingModal) {
            let savedPos = null;
            try {
                savedPos = JSON.parse(root.localStorage.getItem('fasttag_everything_pos') || 'null');
            } catch (error) {}

            let posX = null;
            let posY = null;
            const formW = parseInt(form.style.width, 10) || form.offsetWidth || 660;
            const formH = parseInt(form.style.height, 10) || form.offsetHeight || 520;

            if (savedPos && savedPos.left && savedPos.top) {
                const parsedX = parseInt(savedPos.left, 10);
                const parsedY = parseInt(savedPos.top, 10);
                if (!isNaN(parsedX) && !isNaN(parsedY)) {
                    const pos = clampPos(parsedX, parsedY);
                    posX = pos.x;
                    posY = pos.y;
                }
            }

            if (posX == null || posY == null) {
                const defaultPosition = dependencies.getDefaultEverythingPosition(formW, formH);
                posX = defaultPosition.x;
                posY = defaultPosition.y;
            }

            form.style.left = `${posX}px`;
            form.style.top = `${posY}px`;
            if (sequentialEditState.enabled) {
                sequentialEditState.popupPosition = { left: posX, top: posY };
            }

            root.requestAnimationFrame(() => {
                const actualFormRect = form.getBoundingClientRect();
                const pos = clampPos(actualFormRect.left, actualFormRect.top);
                form.style.left = `${pos.x}px`;
                form.style.top = `${pos.y}px`;
                form.classList.add('popup-visible');
                if (typeof form._fastTagOnResize === 'function') form._fastTagOnResize();
                const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
                if (firstInput) firstInput.focus({ preventScroll: true });
            });
            return;
        }

        if (sequentialEditState.enabled && sequentialEditState.popupPosition.left !== 0) {
            const pos = clampPos(sequentialEditState.popupPosition.left, sequentialEditState.popupPosition.top);
            form.style.left = `${pos.x}px`;
            form.style.top = `${pos.y}px`;
            root.requestAnimationFrame(() => form.classList.add('popup-visible'));
            const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
            return;
        }

        let savedSinglePos = null;
        try {
            savedSinglePos = JSON.parse(root.localStorage.getItem('fasttag_single_pos') || 'null');
        } catch (error) {}

        if (savedSinglePos && savedSinglePos.left && savedSinglePos.top) {
            const parsedX = parseInt(savedSinglePos.left, 10);
            const parsedY = parseInt(savedSinglePos.top, 10);
            if (!isNaN(parsedX) && !isNaN(parsedY)) {
                const pos = clampPos(parsedX, parsedY);
                form.style.left = `${pos.x}px`;
                form.style.top = `${pos.y}px`;
                if (sequentialEditState.enabled) sequentialEditState.popupPosition = { left: pos.x, top: pos.y };
                root.requestAnimationFrame(() => {
                    const actualFormRect = form.getBoundingClientRect();
                    const clamped = clampPos(actualFormRect.left, actualFormRect.top);
                    form.style.left = `${clamped.x}px`;
                    form.style.top = `${clamped.y}px`;
                    form.classList.add('popup-visible');
                    if (typeof form._fastTagOnResize === 'function') form._fastTagOnResize();
                    const firstInput = form.querySelector('input[type="text"], input[type="search"]');
                    if (firstInput) firstInput.focus({ preventScroll: true });
                });
                return;
            }
        }

        const cardRect = cardElement ? cardElement.getBoundingClientRect() : { right: 100, top: 100, left: 100 };
        let popupX = cardRect.right + 10;
        let popupY = Math.max(minTop, cardRect.top);
        form.style.left = `${popupX}px`;
        form.style.top = `${popupY}px`;

        root.requestAnimationFrame(() => {
            const formRect = form.getBoundingClientRect();
            if (cardRect.right + 10 + formRect.width > root.innerWidth) popupX = cardRect.left - formRect.width - 10;
            if (cardRect.top + formRect.height > root.innerHeight) popupY = root.innerHeight - formRect.height - 8;
            const pos = clampPos(popupX, popupY);
            form.style.left = `${pos.x}px`;
            form.style.top = `${pos.y}px`;
            form.classList.add('popup-visible');
            if (typeof form._fastTagOnResize === 'function') form._fastTagOnResize();
            const firstInput = form.querySelector('#everything-global-search, input[type="text"], input[type="search"]');
            if (firstInput) firstInput.focus({ preventScroll: true });
        });
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.popup = Object.freeze({
        configure,
        getSavedSize,
        setSavedSize,
        positionNearCard
    });
}(typeof window !== 'undefined' ? window : globalThis));
