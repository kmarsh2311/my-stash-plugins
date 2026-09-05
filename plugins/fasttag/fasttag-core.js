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

    function cleanTitleForScraping(rawStr) {
        if (!rawStr) return '';
        let clean = String(rawStr).replace(/\.[a-zA-Z0-9]{2,5}$/, '');
        clean = clean.replace(/(^|[\s._-])(2160p|1080p|720p|480p|4k|uhd|hd|sd|fhd|hevc|x264|x265|h264|h265|aac|dvdrip|webrip|bluray|mp4|mkv|avi|wmv)(?=$|[\s._-])/gi, '$1');
        clean = clean.replace(/[\._\-+]/g, ' ');
        clean = clean.replace(/\s+/g, ' ').trim();
        return clean;
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
        name = name.replace(/(^|[._\-\s])(1080p|720p|2160p|4k|uhd|fhd|hd|sd|x264|x265|h264|h265|hevc|aac|mp4|mkv|avi|wmv|60fps|120fps|fps|xxx|rip|webrip|bluray|dvdrip|sdh)(?=$|[._\-\s])/gi, '$1');
        return name;
    }

    function normalizeTextForSuggestions(str) {
        if (!str) return '';
        let splitStr = String(str);

        // Strip combining marks before camel-case detection so accented lowercase
        // letters retain the same word-boundary behaviour as plain ASCII letters.
        try {
            splitStr = splitStr.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) {}

        splitStr = splitStr
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
            .replace(/([0-9])([a-zA-Z])/g, '$1 $2');

        return splitStr.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    const SUGGESTION_STOP_WORDS = new Set([
        'a', 'an', 'and', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'from', 'as', 'is', 'it', 'or', 'be', 'are', 'was', 'were', 'not', 'no',
        'he', 'she', 'his', 'her', 'my', 'me', 'you', 'your', 'we', 'our', 'they',
        'them', 'their', 'this', 'that', 'these', 'those', 'all', 'any', 'some',
        'new', 'top', 'hot', 'big', 'get', 'set', 'out', 'up', 'down', 'man', 'men',
        'full', 'clip', 'part', 'scene', 'video', 'best', 'good', 'raw', 'free', 'one', 'two'
    ]);

    function isSuggestionMatch(item, normalizedSpaced, tokenSet, tokens = null) {
        if (!item) return false;
        if (!tokens) {
            tokens = normalizedSpaced.trim().split(/\s+/).filter(Boolean);
        }
        const namesToCheck = [];
        if (item.name) namesToCheck.push({ name: item.name, isPrimary: true });
        if (item.title && item.title !== item.name) namesToCheck.push({ name: item.title, isPrimary: true });
        if (item.sort_name && item.sort_name !== item.name) namesToCheck.push({ name: item.sort_name, isPrimary: false });

        if (Array.isArray(item.alias_list)) {
            item.alias_list.forEach(a => { if (a && typeof a === 'string') namesToCheck.push({ name: a, isPrimary: false }); });
        } else if (typeof item.alias_list === 'string' && item.alias_list.trim()) {
            item.alias_list.split(',').forEach(a => { if (a.trim()) namesToCheck.push({ name: a.trim(), isPrimary: false }); });
        }

        if (Array.isArray(item.aliases)) {
            item.aliases.forEach(a => { if (a && typeof a === 'string') namesToCheck.push({ name: a, isPrimary: false }); });
        } else if (typeof item.aliases === 'string' && item.aliases.trim()) {
            item.aliases.split(',').forEach(a => { if (a.trim()) namesToCheck.push({ name: a.trim(), isPrimary: false }); });
        }

        for (const { name: raw, isPrimary } of namesToCheck) {
            const clean = normalizeTextForSuggestions(raw);
            if (!clean || clean.length < 2) continue;

            if (!isPrimary) {
                const aliasWords = clean.split(/\s+/).filter(Boolean);
                // A single-word alias is too ambiguous for automatic suggestions
                // (for example, performer Clayton having the alias "Danny").
                // Genuine single-name performers still match through their primary name.
                if (aliasWords.length === 1) continue;
                if (clean.length <= 3 || SUGGESTION_STOP_WORDS.has(clean)) continue;
            }

            if (normalizedSpaced.includes(' ' + clean + ' ')) return true;

            const words = clean.split(/\s+/).filter(Boolean);
            const compact = clean.replace(/\s+/g, '');
            if (words.length > 1) {
                if (compact.length >= 4 && tokenSet.has(compact)) return true;
                if (words.every(w => tokenSet.has(w))) return true;
            } else if (words.length === 1 && clean.length >= 3 && !SUGGESTION_STOP_WORDS.has(clean)) {
                if (tokenSet.has(clean)) return true;
            }

            if (compact.length >= 4 && tokens && tokens.length > 1) {
                for (let i = 0; i < tokens.length - 1; i++) {
                    if (tokens[i] + tokens[i + 1] === compact) return true;
                    if (i < tokens.length - 2 && tokens[i] + tokens[i + 1] + tokens[i + 2] === compact) return true;
                }
            }

            if (clean.length >= 4 && !SUGGESTION_STOP_WORDS.has(clean)) {
                if (clean.endsWith('s')) {
                    const singular = clean.slice(0, -1);
                    if (singular.length >= 3 && (tokenSet.has(singular) || normalizedSpaced.includes(' ' + singular + ' '))) return true;
                } else {
                    const plural = clean + 's';
                    if (tokenSet.has(plural) || normalizedSpaced.includes(' ' + plural + ' ')) return true;
                    const pluralEs = clean + 'es';
                    if (tokenSet.has(pluralEs) || normalizedSpaced.includes(' ' + pluralEs + ' ')) return true;
                }
            }
        }
        return false;
    }

    function rankSuggestionItems(items, primaryText, detailsText, existingIds = null, limit = 20) {
        const normalizeSource = (value) => {
            const normalized = normalizeTextForSuggestions(value || '');
            const tokens = normalized.split(/\s+/).filter(Boolean);
            return { spaced: normalized ? ` ${normalized} ` : '', tokens, tokenSet: new Set(tokens) };
        };
        const primary = normalizeSource(primaryText);
        const details = normalizeSource(detailsText);
        const selected = existingIds ? new Set(Array.from(existingIds, String)) : new Set();

        const exactDetailsMatch = (item) => {
            if (!details.spaced) return false;
            const names = [];
            if (item?.name) names.push({ value: item.name, primary: true });
            if (item?.title && item.title !== item.name) names.push({ value: item.title, primary: true });
            if (item?.sort_name && item.sort_name !== item.name) names.push({ value: item.sort_name, primary: false });
            const appendAliases = (aliases) => {
                if (Array.isArray(aliases)) aliases.forEach(value => names.push({ value, primary: false }));
                else if (typeof aliases === 'string') aliases.split(',').forEach(value => names.push({ value: value.trim(), primary: false }));
            };
            appendAliases(item?.alias_list);
            appendAliases(item?.aliases);

            return names.some(({ value, primary: isPrimary }) => {
                const clean = normalizeTextForSuggestions(value);
                if (!clean) return false;
                if (!isPrimary && clean.split(/\s+/).length === 1) return false;
                return details.spaced.includes(` ${clean} `);
            });
        };

        return (Array.isArray(items) ? items : [])
            .map((item, originalIndex) => {
                if (!item?.id || selected.has(String(item.id))) return null;
                const primaryName = normalizeTextForSuggestions(item.name || item.title || '');
                const exactPrimary = primaryName && primary.spaced.includes(` ${primaryName} `);
                const primaryMatch = primary.tokens.length > 0
                    && isSuggestionMatch(item, primary.spaced, primary.tokenSet, primary.tokens);
                const detailsMatch = exactDetailsMatch(item);
                const score = exactPrimary ? 3 : primaryMatch ? 2 : detailsMatch ? 1 : 0;
                const specificity = primaryName ? primaryName.split(/\s+/).length * 1000 + primaryName.length : 0;
                return score ? { item, originalIndex, score, specificity } : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score || b.specificity - a.specificity || a.originalIndex - b.originalIndex)
            .slice(0, Math.max(0, Number(limit) || 0))
            .map(entry => entry.item);
    }

    function findUniqueSelectedPerformerComponentMatch(performers, selectedIds, aiName) {
        const normalizedAiName = normalizeTextForSuggestions(aiName || '');
        const aiWords = normalizedAiName.split(/\s+/).filter(Boolean);
        if (aiWords.length !== 1 || normalizedAiName.length < 4) return null;

        const selected = selectedIds ? new Set(Array.from(selectedIds, String)) : new Set();
        const candidates = (Array.isArray(performers) ? performers : []).filter(performer => {
            if (!performer?.id || !selected.has(String(performer.id))) return false;
            const nameWords = normalizeTextForSuggestions(performer.name || '').split(/\s+/).filter(Boolean);
            return nameWords.length > 1 && nameWords.includes(normalizedAiName);
        });
        return candidates.length === 1 ? candidates[0] : null;
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
        cleanTitleForScraping,
        formatTime,
        formatDurationSec,
        parseDurationSec,
        cleanFilenameForSuggestions,
        normalizeTextForSuggestions,
        isSuggestionMatch,
        rankSuggestionItems,
        findUniqueSelectedPerformerComponentMatch,
        extractSceneId,
        findSceneCardForContextTarget,
        isScenePreviewContextTarget
    });
}(typeof window !== 'undefined' ? window : globalThis));
