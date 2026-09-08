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
    const momentaryPeekState = {
        panels: [],
        pointerId: null,
        shield: null,
        suppressContextMenu: false,
        suppressContextMenuUntil: 0,
        contextMenuGuardMounted: false
    };

    function isMomentaryPeekActive() {
        return momentaryPeekState.panels.length > 0;
    }

    function stopMomentaryPeekEvent(event) {
        event?.preventDefault?.();
        event?.stopImmediatePropagation?.();
    }

    function isSecondaryPointerEvent(event) {
        return event?.button === 2 || Boolean(event?.buttons & 2) || event?.type === 'contextmenu';
    }

    function blockMomentaryPeekContextMenu(event) {
        if (isMomentaryPeekActive() && isSecondaryPointerEvent(event)) {
            momentaryPeekState.suppressContextMenu = true;
        }
        if (!isMomentaryPeekActive()
            && !momentaryPeekState.suppressContextMenu
            && Date.now() > momentaryPeekState.suppressContextMenuUntil) return;
        stopMomentaryPeekEvent(event);
    }

    function blockMomentaryPeekInteraction(event) {
        if (!isMomentaryPeekActive()) return;
        if (isSecondaryPointerEvent(event)) momentaryPeekState.suppressContextMenu = true;
        stopMomentaryPeekEvent(event);
    }

    function forwardMomentaryPeekWheel(event) {
        if (!isMomentaryPeekActive()) return;
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

    function trackMomentaryPeekButtons(event) {
        if (!isMomentaryPeekActive() || !(event.buttons & 2)) return;
        momentaryPeekState.suppressContextMenu = true;
        stopMomentaryPeekEvent(event);
    }

    function removeMomentaryPeekListeners() {
        root.removeEventListener('pointerup', finishMomentaryPeek, true);
        root.removeEventListener('pointercancel', finishMomentaryPeek, true);
        root.removeEventListener('blur', finishMomentaryPeek, true);
        root.removeEventListener('pointermove', trackMomentaryPeekButtons, true);
        root.removeEventListener('pointerdown', blockMomentaryPeekInteraction, true);
        root.removeEventListener('mousedown', blockMomentaryPeekInteraction, true);
        root.removeEventListener('auxclick', blockMomentaryPeekInteraction, true);
        root.removeEventListener('click', blockMomentaryPeekInteraction, true);
        root.removeEventListener('wheel', forwardMomentaryPeekWheel, true);
    }

    function finishMomentaryPeek(event) {
        if (!isMomentaryPeekActive()) return;
        if (event?.type === 'pointerup') {
            const releasedInitiatingPointer = event.button === 0
                && momentaryPeekState.pointerId !== null
                && event.pointerId === momentaryPeekState.pointerId;
            if (!releasedInitiatingPointer) {
                if (isSecondaryPointerEvent(event)) momentaryPeekState.suppressContextMenu = true;
                stopMomentaryPeekEvent(event);
                return;
            }
        }
        const normalPointerRelease = event?.type === 'pointerup';
        if (normalPointerRelease && momentaryPeekState.suppressContextMenu) {
            momentaryPeekState.suppressContextMenuUntil = Date.now() + 500;
        } else if (!normalPointerRelease) {
            momentaryPeekState.suppressContextMenuUntil = 0;
        }
        momentaryPeekState.suppressContextMenu = false;
        momentaryPeekState.panels.forEach(({ panel, opacity, transition, pointerEvents }) => {
            panel.style.opacity = opacity;
            panel.style.transition = transition;
            panel.style.pointerEvents = pointerEvents;
        });
        momentaryPeekState.panels = [];
        momentaryPeekState.pointerId = null;
        momentaryPeekState.shield?.remove();
        momentaryPeekState.shield = null;
        removeMomentaryPeekListeners();
        if (normalPointerRelease) stopMomentaryPeekEvent(event);
    }

    function startMomentaryPeek(event) {
        if (event.type === 'pointerdown' && event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        finishMomentaryPeek();
        const seenPanels = new Set();
        momentaryPeekTargets.forEach(target => {
            const panel = target.getPanel();
            if (!panel || panel.isConnected === false) {
                momentaryPeekTargets.delete(target);
                return;
            }
            if (seenPanels.has(panel)) return;
            seenPanels.add(panel);
            momentaryPeekState.panels.push({
                panel,
                opacity: panel.style.opacity,
                transition: panel.style.transition,
                pointerEvents: panel.style.pointerEvents
            });
            panel.style.transition = 'opacity .08s ease';
            panel.style.opacity = '0.15';
            panel.style.pointerEvents = 'none';
        });
        if (!isMomentaryPeekActive()) return;
        momentaryPeekState.pointerId = event.type === 'pointerdown' ? event.pointerId : null;
        momentaryPeekState.shield = root.document.createElement('div');
        momentaryPeekState.shield.setAttribute('aria-hidden', 'true');
        momentaryPeekState.shield.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:transparent;cursor:default;';
        momentaryPeekState.shield.addEventListener('mouseleave', finishMomentaryPeek);
        root.document.body.appendChild(momentaryPeekState.shield);
        root.addEventListener('pointerup', finishMomentaryPeek, true);
        root.addEventListener('pointercancel', finishMomentaryPeek, true);
        root.addEventListener('blur', finishMomentaryPeek, true);
        root.addEventListener('pointermove', trackMomentaryPeekButtons, true);
        root.addEventListener('pointerdown', blockMomentaryPeekInteraction, true);
        root.addEventListener('mousedown', blockMomentaryPeekInteraction, true);
        root.addEventListener('auxclick', blockMomentaryPeekInteraction, true);
        root.addEventListener('click', blockMomentaryPeekInteraction, true);
        root.addEventListener('wheel', forwardMomentaryPeekWheel, { capture: true, passive: false });
    }

    function ensureMomentaryPeekContextMenuGuard() {
        if (momentaryPeekState.contextMenuGuardMounted) return;
        root.addEventListener('contextmenu', blockMomentaryPeekContextMenu, true);
        momentaryPeekState.contextMenuGuardMounted = true;
    }

    function registerMomentaryPeekTarget(getPanel) {
        const initialPanel = getPanel();
        const existingTarget = initialPanel
            ? Array.from(momentaryPeekTargets).find(candidate => candidate.getPanel() === initialPanel)
            : null;
        momentaryPeekTargets.add(existingTarget || { getPanel });
    }

    function mountMomentaryPeekButton(panelOrGetter, container, beforeElement = null) {
        if (!container || container.querySelector?.('.fasttag-momentary-peek')) return null;
        ensureMomentaryPeekContextMenuGuard();
        const button = root.document.createElement('button');
        button.type = 'button';
        button.className = 'fasttag-momentary-peek';
        button.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>';
        button.title = 'Hold to see and scroll behind FastTag windows';
        button.setAttribute('aria-label', 'Hold to make all open FastTag windows transparent and scroll behind them');
        button.style.cssText = 'border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.55);color:#e2e8f0;border-radius:5px;padding:1px 5px;min-width:24px;height:20px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;line-height:1;flex-shrink:0;';
        const getPanel = () => typeof panelOrGetter === 'function' ? panelOrGetter() : panelOrGetter;
        registerMomentaryPeekTarget(getPanel);
        button.addEventListener('pointerdown', startMomentaryPeek);
        button.addEventListener('keydown', event => {
            if ((event.key === ' ' || event.key === 'Enter') && !isMomentaryPeekActive()) startMomentaryPeek(event);
        });
        button.addEventListener('keyup', event => {
            if (event.key === ' ' || event.key === 'Enter') finishMomentaryPeek(event);
        });
        if (beforeElement?.parentNode === container) container.insertBefore(button, beforeElement);
        else container.appendChild(button);
        return button;
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.ui = Object.freeze({ configure, getOptimalPopupSize, getDefaultEverythingPosition, mountMomentaryPeekButton });
}(typeof window !== 'undefined' ? window : globalThis));
