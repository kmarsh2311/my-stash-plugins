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

    const momentaryPeekTargets = new Set();
    let activeMomentaryPeekPanels = [];
    let activeMomentaryPeekButtons = 0;

    function blockMomentaryPeekClick(event) {
        if (!activeMomentaryPeekPanels.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function forwardMomentaryPeekWheel(event) {
        if (!activeMomentaryPeekPanels.length) return;
        const document = root.document;
        const elements = document.elementsFromPoint?.(event.clientX, event.clientY) || [];
        let scrollTarget = null;
        for (const element of elements) {
            let candidate = element;
            while (candidate && candidate !== document.body && candidate !== document.documentElement) {
                const style = root.getComputedStyle?.(candidate);
                const canScrollY = candidate.scrollHeight > candidate.clientHeight + 1
                    && /auto|scroll|overlay/.test(style?.overflowY || '');
                const canScrollX = candidate.scrollWidth > candidate.clientWidth + 1
                    && /auto|scroll|overlay/.test(style?.overflowX || '');
                if (canScrollY || canScrollX) {
                    scrollTarget = candidate;
                    break;
                }
                candidate = candidate.parentElement;
            }
            if (scrollTarget) break;
        }
        scrollTarget ||= document.scrollingElement || document.documentElement;
        if (!scrollTarget) return;
        const scale = event.deltaMode === 1
            ? 16
            : (event.deltaMode === 2 ? Math.max(1, scrollTarget.clientHeight || root.innerHeight || 1) : 1);
        scrollTarget.scrollTop += event.deltaY * scale;
        scrollTarget.scrollLeft += event.deltaX * scale;
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function cancelUnexpectedMomentaryPeekInput(event) {
        if (!activeMomentaryPeekPanels.length) return;
        if (event.type === 'pointermove' && (!activeMomentaryPeekButtons || event.buttons === activeMomentaryPeekButtons)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        restoreMomentaryPeek();
    }

    function restoreMomentaryPeek(event) {
        const wasActive = activeMomentaryPeekPanels.length > 0;
        activeMomentaryPeekPanels.forEach(({ panel, opacity, transition, pointerEvents }) => {
            panel.style.opacity = opacity;
            panel.style.transition = transition;
            panel.style.pointerEvents = pointerEvents;
        });
        activeMomentaryPeekPanels = [];
        activeMomentaryPeekButtons = 0;
        root.removeEventListener('pointerup', restoreMomentaryPeek, true);
        root.removeEventListener('pointercancel', restoreMomentaryPeek, true);
        root.removeEventListener('mouseup', restoreMomentaryPeek, true);
        root.removeEventListener('blur', restoreMomentaryPeek, true);
        root.removeEventListener('pointermove', cancelUnexpectedMomentaryPeekInput, true);
        root.removeEventListener('contextmenu', cancelUnexpectedMomentaryPeekInput, true);
        root.removeEventListener('auxclick', cancelUnexpectedMomentaryPeekInput, true);
        root.removeEventListener('pointerdown', blockMomentaryPeekClick, true);
        root.removeEventListener('click', blockMomentaryPeekClick, true);
        root.removeEventListener('wheel', forwardMomentaryPeekWheel, true);
        if (wasActive && (event?.type === 'pointerup' || event?.type === 'mouseup')) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    function mountMomentaryPeekButton(panelOrGetter, container, beforeElement = null) {
        if (!container || container.querySelector?.('.fasttag-momentary-peek')) return null;
        const button = root.document.createElement('button');
        button.type = 'button';
        button.className = 'fasttag-momentary-peek';
        button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';
        button.title = 'Hold to see and scroll behind FastTag windows';
        button.setAttribute('aria-label', 'Hold to make all open FastTag windows transparent and scroll behind them');
        button.style.cssText = 'border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.55);color:#e2e8f0;border-radius:5px;padding:1px 5px;min-width:24px;height:20px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;line-height:1;flex-shrink:0;';
        const getPanel = () => typeof panelOrGetter === 'function' ? panelOrGetter() : panelOrGetter;
        const initialPanel = getPanel();
        const existingTarget = initialPanel
            ? Array.from(momentaryPeekTargets).find(candidate => candidate.getPanel() === initialPanel)
            : null;
        momentaryPeekTargets.add(existingTarget || { getPanel });
        const revealBehind = event => {
            if (event.type === 'pointerdown' && event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();
            restoreMomentaryPeek();
            const seenPanels = new Set();
            momentaryPeekTargets.forEach(candidate => {
                const panel = candidate.getPanel();
                if (!panel || panel.isConnected === false) {
                    momentaryPeekTargets.delete(candidate);
                    return;
                }
                if (seenPanels.has(panel)) return;
                seenPanels.add(panel);
                activeMomentaryPeekPanels.push({
                    panel,
                    opacity: panel.style.opacity,
                    transition: panel.style.transition,
                    pointerEvents: panel.style.pointerEvents
                });
                panel.style.transition = 'opacity .08s ease';
                panel.style.opacity = '0.15';
                panel.style.pointerEvents = 'none';
            });
            if (!activeMomentaryPeekPanels.length) return;
            activeMomentaryPeekButtons = event.type === 'pointerdown' ? event.buttons : 0;
            root.addEventListener('pointerup', restoreMomentaryPeek, true);
            root.addEventListener('pointercancel', restoreMomentaryPeek, true);
            root.addEventListener('mouseup', restoreMomentaryPeek, true);
            root.addEventListener('blur', restoreMomentaryPeek, true);
            root.addEventListener('pointermove', cancelUnexpectedMomentaryPeekInput, true);
            root.addEventListener('contextmenu', cancelUnexpectedMomentaryPeekInput, true);
            root.addEventListener('auxclick', cancelUnexpectedMomentaryPeekInput, true);
            root.addEventListener('pointerdown', blockMomentaryPeekClick, true);
            root.addEventListener('click', blockMomentaryPeekClick, true);
            root.addEventListener('wheel', forwardMomentaryPeekWheel, { capture: true, passive: false });
        };
        button.addEventListener('pointerdown', revealBehind);
        button.addEventListener('keydown', event => {
            if ((event.key === ' ' || event.key === 'Enter') && !activeMomentaryPeekPanels.length) revealBehind(event);
        });
        button.addEventListener('keyup', event => {
            if (event.key === ' ' || event.key === 'Enter') restoreMomentaryPeek();
        });
        if (beforeElement?.parentNode === container) container.insertBefore(button, beforeElement);
        else container.appendChild(button);
        return button;
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.ui = Object.freeze({ configure, getOptimalPopupSize, getDefaultEverythingPosition, mountMomentaryPeekButton });
}(typeof window !== 'undefined' ? window : globalThis));
