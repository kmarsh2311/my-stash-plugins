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

    root.FastTag = root.FastTag || {};
    root.FastTag.ui = Object.freeze({ configure, getOptimalPopupSize, getDefaultEverythingPosition });
}(typeof window !== 'undefined' ? window : globalThis));
