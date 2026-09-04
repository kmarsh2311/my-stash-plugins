(function initializeFastTagCore(root) {
    'use strict';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const totalSecs = Math.floor(seconds);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        if (hrs > 0) {
            return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
        }
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    }

    function formatDurationSec(sec) {
        if (!sec || isNaN(sec)) return '';
        const s = Math.round(Number(sec));
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        if (hrs > 0) {
            return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
        return `${mins}:${String(secs).padStart(2, '0')}`;
    }

    function parseDurationSec(val) {
        if (!val) return null;
        if (typeof val === 'number') return val;
        const str = String(val).trim();
        if (/^\d+(\.\d+)?$/.test(str)) return Math.round(Number(str));
        const parts = str.split(':').map(Number);
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return null;
    }

    function cleanFilenameForSuggestions(rawName) {
        if (!rawName) return '';
        let name = rawName.replace(/\.[^/.]+$/, '');
        name = name.replace(/\b(1080p|720p|2160p|4k|uhd|fhd|hd|sd|x264|x265|h264|h265|hevc|aac|mp4|mkv|avi|wmv|60fps|120fps|fps|xxx|rip|webrip|bluray|dvdrip|sdh)\b/gi, ' ');
        return name;
    }

    function normalizeTextForSuggestions(str) {
        if (!str) return '';
        let splitStr = String(str)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
            .replace(/([0-9])([a-zA-Z])/g, '$1 $2');

        try {
            splitStr = splitStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) {}

        return splitStr.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function extractSceneId(cardElement) {
        if (!cardElement) return null;
        const link = cardElement.querySelector('a[href*="/scenes/"]');
        if (link) {
            const match = link.href.match(/scenes\/([a-zA-Z0-9-]+)/);
            if (match) return match[1];
        }
        return null;
    }

    function resolveElement(target) {
        return target?.nodeType === 1 ? target : target?.parentElement;
    }

    function findSceneCardForContextTarget(target) {
        const element = resolveElement(target);
        if (!element || typeof element.closest !== 'function') return null;

        const knownCard = element.closest('.scene-card, [class*="scene-card"], [class*="SceneCard"]');
        if (knownCard && extractSceneId(knownCard)) return knownCard;

        const genericCard = element.closest('.card, [class*="grid-card"]');
        return genericCard && extractSceneId(genericCard) ? genericCard : null;
    }

    function isScenePreviewContextTarget(target, sceneCard) {
        const element = resolveElement(target);
        if (!element || !sceneCard || typeof element.closest !== 'function') return false;

        const mediaArea = element.closest([
            '.thumbnail-section',
            '.scene-card-preview',
            '[class*="scene-card-preview"]',
            '[class*="video-preview"]',
            '[class*="media-preview"]',
            '.video-js',
            '[class*="video-controls"]',
            '[class*="player-controls"]',
            'video',
            'audio'
        ].join(', '));

        return Boolean(mediaArea && sceneCard.contains(mediaArea));
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.core = Object.freeze({
        escapeHtml,
        formatTime,
        formatDurationSec,
        parseDurationSec,
        cleanFilenameForSuggestions,
        normalizeTextForSuggestions,
        extractSceneId,
        findSceneCardForContextTarget,
        isScenePreviewContextTarget
    });
}(typeof window !== 'undefined' ? window : globalThis));
