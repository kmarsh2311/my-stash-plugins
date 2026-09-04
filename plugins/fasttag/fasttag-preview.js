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

    root.FastTag = root.FastTag || {};
    root.FastTag.preview = Object.freeze({
        configure,
        getDominantWheelDelta,
        getWheelNotches,
        selectScrubStep,
        calculateScrubTarget,
        getDefaultPopoutSize,
        extractMediaUrlsFromCard,
        toRelativeMediaUrl,
        fetchSceneMediaUrls
    });
}(typeof window !== 'undefined' ? window : globalThis));
