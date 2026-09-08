(function initializeFastTagUi(root) {
    'use strict';

    let dependencies = null;
    function configure(options) { dependencies = options; }

    function getOptimalPopupSize(type = 'single') {
        const screenWidth = root.innerWidth || 1920;
        const screenHeight = root.innerHeight || 1080;
        if (type === 'everything') {
            const rawWidth = Math.round(screenWidth * 0.40);
            const rawHeight = Math.round(screenHeight * 0.82);
            return {
                width: Math.max(720, Math.min(Math.min(screenWidth - 24, rawWidth), 760)),
                height: Math.max(620, Math.min(Math.min(screenHeight - 24, rawHeight), 760))
            };
        }
        const rawWidth = Math.round(screenWidth * 0.18);
        const rawHeight = Math.round(screenHeight * 0.74);
        return {
            width: Math.max(320, Math.min(Math.min(screenWidth - 24, rawWidth), 345)),
            height: Math.max(540, Math.min(Math.min(screenHeight - 24, rawHeight), 660))
        };
    }

    function getDefaultEverythingPosition(formWidth, formHeight) {
        if (!dependencies) throw new Error('[FastTag] UI module is not configured');
        const screenWidth = root.innerWidth || 1920;
        const screenHeight = root.innerHeight || 1080;
        const videoSize = dependencies.getDefaultPopoutSize();
        const videoWidth = parseInt(videoSize.width, 10) || 600;
        const scraperWidth = 390;
        const margin = 14;
        let x;
        if (screenWidth >= videoWidth + formWidth + scraperWidth + (margin * 3)) {
            x = Math.round((screenWidth - formWidth + videoWidth - scraperWidth) / 2);
        } else if (screenWidth >= videoWidth + formWidth + (margin * 2)) {
            x = Math.round(videoWidth + (margin * 2));
        } else {
            x = Math.round((screenWidth - formWidth) / 2);
        }
        const maxLeft = Math.max(8, screenWidth - formWidth - 8);
        const maxTop = Math.max(8, screenHeight - formHeight - 8);
        x = Math.max(8, Math.min(maxLeft, x));
        const y = Math.max(8, Math.min(maxTop, Math.round((screenHeight - formHeight) / 2)));
        dependencies.log('DEBUG', 'LAYOUT', `Default workstation position calculated: (${x}, ${y}) on ${screenWidth}x${screenHeight}`, {
            screenW: screenWidth,
            screenH: screenHeight,
            formW: formWidth,
            formH: formHeight,
            videoW: videoWidth,
            scraperW: scraperWidth,
            margin,
            posX: x,
            posY: y
        });
        return { x, y };
    }

    function mountMomentaryPeekButton(panelOrGetter, container, beforeElement = null) {
        if (!container || container.querySelector?.('.fasttag-momentary-peek')) return null;
        const button = root.document.createElement('button');
        button.type = 'button';
        button.className = 'fasttag-momentary-peek';
        button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';
        button.title = 'Hold to see behind this window';
        button.setAttribute('aria-label', 'Hold to make this window transparent');
        button.style.cssText = 'border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.55);color:#e2e8f0;border-radius:5px;padding:1px 5px;min-width:24px;height:20px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;line-height:1;flex-shrink:0;';
        const getPanel = () => typeof panelOrGetter === 'function' ? panelOrGetter() : panelOrGetter;
        let activePanel = null;
        let previousOpacity = '';
        let previousTransition = '';
        const restore = () => {
            if (!activePanel) return;
            activePanel.style.opacity = previousOpacity;
            activePanel.style.transition = previousTransition;
            activePanel = null;
            root.removeEventListener('pointerup', restore, true);
            root.removeEventListener('pointercancel', restore, true);
            root.removeEventListener('blur', restore, true);
        };
        const revealBehind = event => {
            if (event.type === 'pointerdown' && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            restore();
            activePanel = getPanel();
            if (!activePanel) return;
            previousOpacity = activePanel.style.opacity;
            previousTransition = activePanel.style.transition;
            activePanel.style.transition = 'opacity .08s ease';
            activePanel.style.opacity = '0.12';
            root.addEventListener('pointerup', restore, true);
            root.addEventListener('pointercancel', restore, true);
            root.addEventListener('blur', restore, true);
        };
        button.addEventListener('pointerdown', revealBehind);
        button.addEventListener('keydown', event => {
            if ((event.key === ' ' || event.key === 'Enter') && !activePanel) revealBehind(event);
        });
        button.addEventListener('keyup', event => {
            if (event.key === ' ' || event.key === 'Enter') restore();
        });
        if (beforeElement?.parentNode === container) container.insertBefore(button, beforeElement);
        else container.appendChild(button);
        return button;
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.ui = Object.freeze({ configure, getOptimalPopupSize, getDefaultEverythingPosition, mountMomentaryPeekButton });
}(typeof window !== 'undefined' ? window : globalThis));
