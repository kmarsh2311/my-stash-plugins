(function initializeFastTagScraper(root) {
    'use strict';

    const SCRAPE_QUERY = `
        query FastTagScrapeSingleScene($source: ScraperSourceInput!, $input: ScrapeSingleSceneInput!) {
            scrapeSingleScene(source: $source, input: $input) {
                title
                code
                details
                director
                urls
                date
                image
                remote_site_id
                duration
                fingerprints { algorithm hash duration }
                studio { stored_id name image }
                tags { stored_id name }
                performers { stored_id name gender images remote_site_id urls }
            }
        }
    `;
    let dependencies = null;
    let preferredStashBoxCache = null;

    function configure(options) {
        dependencies = options;
        preferredStashBoxCache = null;
    }
    function getDependencies() {
        if (!dependencies) throw new Error('[FastTag] Scraper integration is not configured');
        return dependencies;
    }
    function getMatchingSettings() {
        const defaults = {
            hideObviousFalsePositives: true,
            singleWordAliasMode: 'weak',
            majorCastConflict: true,
            requireStudioMismatch: true,
            closeDurationProtects: true,
            titleSimilarityThreshold: 0.2,
            durationMismatchThreshold: 300,
            durationMismatchPercent: 25,
            initialResultLimit: 25
        };
        try {
            return { ...defaults, ...(getDependencies().getScraperMatchingSettings?.() || {}) };
        } catch (e) {
            return defaults;
        }
    }

    function buildScrapeCandidateQueries(sceneTitle, sceneFileName, cardText = '') {
        const { cleanTitleForScraping } = getDependencies();
        const candidates = [];
        for (const value of [sceneTitle, sceneFileName, cardText]) {
            if (!value || !value.trim()) continue;
            const cleaned = cleanTitleForScraping(value);
            if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned);
        }
        return candidates;
    }

    function buildLinkedPerformerFallbackQueries(linkedPerformers, primaryQueries = []) {
        const { cleanTitleForScraping } = getDependencies();
        const fallbacks = [];
        const primaryKeys = new Set((primaryQueries || []).map(value => normalizePerformerName(value)));
        const add = (value) => {
            const cleaned = cleanTitleForScraping(value || '');
            const key = normalizePerformerName(cleaned);
            if (cleaned && key.length >= 3 && !primaryKeys.has(key) && !fallbacks.some(item => normalizePerformerName(item) === key)) {
                fallbacks.push(cleaned);
            }
        };

        const performerNames = [];
        for (const performer of linkedPerformers || []) {
            if (performer?.name) performerNames.push(performer.name);
            if (Array.isArray(performer?.alias_list)) performerNames.push(...performer.alias_list);
            else if (typeof performer?.alias_list === 'string') performerNames.push(...performer.alias_list.split(','));
        }
        performerNames.forEach(add);

        const usefulWords = normalizePerformerName((primaryQueries || []).join(' '))
            .split(/\s+/)
            .filter(word => word.length >= 3 && !SCRAPE_TITLE_STOP_WORDS.has(word) && !/\d/.test(word))
            .slice(0, 5);
        if (usefulWords.length > 0) {
            performerNames.forEach(name => add(`${name} ${usefulWords.join(' ')}`));
        }
        return fallbacks;
    }

    function buildStudioPerformerFallbackQueries(localStudio, linkedPerformers, primaryQueries = []) {
        const { cleanTitleForScraping } = getDependencies();
        const studioName = String(localStudio?.name || '').trim();
        if (!studioName) return [];
        const primaryKeys = new Set((primaryQueries || []).map(value => normalizePerformerName(value)));
        const fallbacks = [];
        const add = (value) => {
            const cleaned = cleanTitleForScraping(value || '');
            const key = normalizePerformerName(cleaned);
            if (key.length >= 3 && !primaryKeys.has(key) && !fallbacks.some(item => normalizePerformerName(item) === key)) {
                fallbacks.push(cleaned);
            }
        };
        const performerNames = (linkedPerformers || [])
            .map(performer => String(performer?.name || '').trim())
            .filter(Boolean);
        if (performerNames.length > 1) add(`${studioName} ${performerNames.join(' ')}`);
        performerNames.forEach(name => add(`${studioName} ${name}`));
        return fallbacks;
    }

    function buildContextualSearchQuery(localStudio, linkedPerformers) {
        const { cleanTitleForScraping } = getDependencies();
        const studioName = String(localStudio?.name || '').trim();
        const performerNames = (linkedPerformers || [])
            .map(performer => String(performer?.name || '').trim())
            .filter(Boolean);
        return cleanTitleForScraping([studioName, ...performerNames].filter(Boolean).join(' '));
    }

    function buildOpaqueRecoveryFallbackQueries(primaryQueries = []) {
        const fallbacks = [];
        for (const query of primaryQueries || []) {
            const original = String(query || '').trim();
            if (!original) continue;
            const cleaned = original
                .split(/\s+/)
                .filter(token => !/^(?:[a-z]\d{7,}|\d{10,})$/i.test(token))
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (cleaned.length >= 2 && normalizePerformerName(cleaned) !== normalizePerformerName(original)
                && !fallbacks.some(value => normalizePerformerName(value) === normalizePerformerName(cleaned))) {
                fallbacks.push(cleaned);
            }
        }
        return fallbacks;
    }

    function dedupeScrapeQueryWords(value) {
        const seen = new Set();
        return String(value || '').trim().split(/\s+/).filter(token => {
            const key = normalizePerformerName(token);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        }).join(' ');
    }

    function containsOpaqueScrapeToken(value) {
        return String(value || '').split(/\s+/).some(token => {
            const cleaned = token.replace(/[^a-z0-9]/gi, '');
            return cleaned.length >= 16 && /[a-z]/i.test(cleaned) && /\d/.test(cleaned);
        });
    }

    function retainOneOpaqueQueryWhenAlternatives(candidateQueries) {
        const queries = Array.isArray(candidateQueries) ? candidateQueries : [];
        const meaningfulQueries = queries.filter(query => !containsOpaqueScrapeToken(query));
        if (meaningfulQueries.length === 0) return queries;
        const retainedOpaqueQuery = queries
            .filter(containsOpaqueScrapeToken)
            .sort((left, right) => left.length - right.length)[0] || '';
        return queries.filter(query => !containsOpaqueScrapeToken(query) || query === retainedOpaqueQuery);
    }

    function mergeScraperMatchResults(...resultSets) {
        const merged = [];
        const seen = new Set();
        for (const match of resultSets.flat()) {
            if (!match) continue;
            const stashUrl = (Array.isArray(match.urls) ? match.urls : []).find(url => /stashdb\.org\/scenes\//i.test(String(url || ''))) || '';
            const key = String(match.remote_site_id || stashUrl || `${match.title || ''}|${match.date || ''}|${match.studio?.name || ''}`).trim().toLowerCase();
            if (key && seen.has(key)) continue;
            if (key) seen.add(key);
            merged.push(match);
        }
        return merged.sort((a, b) => Number(b?._matchScore || 0) - Number(a?._matchScore || 0));
    }

    function hasDecisiveScraperMatch(matches) {
        return (Array.isArray(matches) ? matches : []).some(match =>
            match?._matchAssessment === 'strong' || match?._matchAssessment === 'likely'
        );
    }

    function resolvePreferredStashBox(stashBoxes) {
        const boxes = Array.isArray(stashBoxes) ? stashBoxes : [];
        const stashDbIndex = boxes.findIndex(box =>
            /stashdb\.org/i.test(String(box?.endpoint || '')) || /stashdb/i.test(String(box?.name || ''))
        );
        const index = stashDbIndex >= 0 ? stashDbIndex : (boxes.length > 0 ? 0 : 0);
        const box = boxes[index] || null;
        return {
            index,
            name: String(box?.name || (stashDbIndex >= 0 || boxes.length === 0 ? 'StashDB' : `Stash Box ${index + 1}`)),
            endpoint: String(box?.endpoint || '')
        };
    }

    function getScraperResultUrl(match) {
        const urls = Array.isArray(match?.urls) ? match.urls.filter(url => /^https?:\/\//i.test(String(url || ''))) : [];
        const remoteId = String(match?.remote_site_id || '').trim();
        const isStashDbSource = /stashdb/i.test(String(match?._sourceName || ''))
            || /stashdb\.org/i.test(String(match?._sourceEndpoint || ''));
        if (isStashDbSource && remoteId) {
            if (/^https?:\/\/stashdb\.org\/scenes\//i.test(remoteId)) return remoteId;
            if (!/^https?:\/\//i.test(remoteId)) return `https://stashdb.org/scenes/${encodeURIComponent(remoteId)}`;
        }
        return urls[0] || (/^https?:\/\//i.test(remoteId) ? remoteId : '');
    }

    async function loadPreferredStashBox() {
        if (preferredStashBoxCache) return preferredStashBoxCache;
        const { fetchGQL } = getDependencies();
        try {
            const response = await fetchGQL('query FastTagScraperSources { configuration { general { stashBoxes { endpoint name } } } }');
            const boxes = response?.data?.configuration?.general?.stashBoxes;
            if (Array.isArray(boxes) && boxes.length > 0) {
                preferredStashBoxCache = resolvePreferredStashBox(boxes);
                return preferredStashBoxCache;
            }
        } catch (error) {}
        return resolvePreferredStashBox([]);
    }

    function normalizePerformerName(value) {
        if (!value) return '';
        let normalized = String(value);
        try {
            normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        } catch (e) {}
        return normalized.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function rankMatchesByLinkedPerformers(matches, linkedPerformers = []) {
        if (!Array.isArray(matches)) return [];
        const linked = (linkedPerformers || []).filter(Boolean);
        if (linked.length === 0) return matches;
        const linkedIds = new Set(linked.map(item => String(item.id || '')).filter(Boolean));
        const strongLinkedNames = new Map();
        const weakAliasNames = new Map();
        const aliasMode = getMatchingSettings().singleWordAliasMode;

        for (const performer of linked) {
            const primaryName = normalizePerformerName(performer.name);
            if (primaryName) strongLinkedNames.set(primaryName, performer.name);
            let aliases = [];
            if (Array.isArray(performer.alias_list)) aliases = performer.alias_list;
            else if (typeof performer.alias_list === 'string') aliases = performer.alias_list.split(',');
            for (const name of aliases) {
                const normalized = normalizePerformerName(name);
                if (!normalized) continue;
                if (normalized.split(/\s+/).length > 1 || aliasMode === 'strong') {
                    if (!strongLinkedNames.has(normalized)) strongLinkedNames.set(normalized, performer.name || name);
                } else if (aliasMode === 'weak' && !strongLinkedNames.has(normalized)) {
                    const owners = weakAliasNames.get(normalized) || new Set();
                    owners.add(performer.name || name);
                    weakAliasNames.set(normalized, owners);
                }
            }
        }

        const ranked = matches.map((match, originalIndex) => {
            const overlapNames = new Set();
            const weakOverlapNames = new Set();
            const additionalNames = new Set();
            for (const remotePerformer of match?.performers || []) {
                const storedId = String(remotePerformer?.stored_id || '');
                const normalizedName = normalizePerformerName(remotePerformer?.name);
                if (storedId && linkedIds.has(storedId)) {
                    overlapNames.add(remotePerformer.name || `Performer #${storedId}`);
                } else if (normalizedName && strongLinkedNames.has(normalizedName)) {
                    overlapNames.add(strongLinkedNames.get(normalizedName));
                } else if (normalizedName && weakAliasNames.has(normalizedName)) {
                    weakAliasNames.get(normalizedName).forEach(name => weakOverlapNames.add(name));
                } else if (remotePerformer?.name) {
                    additionalNames.add(remotePerformer.name);
                }
            }
            match._hasLinkedPerformers = linked.length > 0;
            match._linkedPerformerCount = linked.length;
            match._performerOverlapNames = Array.from(overlapNames);
            match._performerOverlapCount = overlapNames.size;
            match._weakPerformerOverlapNames = Array.from(weakOverlapNames);
            match._weakPerformerOverlapCount = weakOverlapNames.size;
            match._additionalPerformerNames = Array.from(additionalNames);
            match._additionalPerformerCount = additionalNames.size;
            return { match, originalIndex };
        });

        ranked.sort((a, b) =>
            b.match._performerOverlapCount - a.match._performerOverlapCount ||
            b.match._weakPerformerOverlapCount - a.match._weakPerformerOverlapCount ||
            a.originalIndex - b.originalIndex
        );
        return ranked.map(entry => entry.match);
    }

    const SCRAPE_TITLE_STOP_WORDS = new Set([
        'a', 'an', 'and', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
        'scene', 'video', 'file', 'part', 'episode', '1080p', '720p', '2160p',
        '4k', 'hd', 'uhd', 'fhd', 'xxx', 'mp4', 'mkv', 'avi'
    ]);
    const SCRAPE_TITLE_SCORING_STOP_WORDS = new Set([
        ...SCRAPE_TITLE_STOP_WORDS,
        'from', 'by', 'is', 'are', 'get', 'gets',
        'sex', 'porn', 'fuck', 'fucks', 'fucked', 'fucking', 'raw', 'twink'
    ]);

    function titleTokens(value, linkedPerformers = [], ignoredValues = []) {
        const ignoredWords = new Set();
        for (const performer of linkedPerformers || []) {
            const names = [performer?.name];
            if (Array.isArray(performer?.alias_list)) names.push(...performer.alias_list);
            else if (typeof performer?.alias_list === 'string') names.push(...performer.alias_list.split(','));
            for (const name of names) {
                normalizePerformerName(name).split(/\s+/).filter(Boolean).forEach(word => ignoredWords.add(word));
            }
        }
        for (const ignoredValue of ignoredValues || []) {
            normalizePerformerName(ignoredValue).split(/\s+/).filter(Boolean).forEach(word => ignoredWords.add(word));
        }
        return new Set(normalizePerformerName(value).split(/\s+/).filter(word =>
            word.length >= 3 && !SCRAPE_TITLE_SCORING_STOP_WORDS.has(word) && !ignoredWords.has(word)
        ));
    }

    function calculateTitleSimilarity(localValue, remoteValue, linkedPerformers = [], ignoredValues = []) {
        const localTokens = titleTokens(localValue, linkedPerformers, ignoredValues);
        const remoteTokens = titleTokens(remoteValue, linkedPerformers, ignoredValues);
        if (!localTokens.size || !remoteTokens.size) return null;
        let overlap = 0;
        localTokens.forEach(token => { if (remoteTokens.has(token)) overlap++; });
        return overlap / Math.min(localTokens.size, remoteTokens.size);
    }

    function hasVerifiedFingerprint(match, localFingerprints = match?._localFingerprints || []) {
        const remoteFingerprints = match?.fingerprints || [];
        return localFingerprints.some(local => {
            const localType = String(local?.type || local?.algorithm || '').toLowerCase();
            const localValue = String(local?.value || local?.hash || '').toLowerCase();
            if (!localType || !localValue) return false;
            return remoteFingerprints.some(remote => {
                const remoteType = String(remote?.algorithm || remote?.type || '').toLowerCase();
                const remoteValue = String(remote?.hash || remote?.value || '').toLowerCase();
                const compatibleType = localType === remoteType
                    || (localType === 'oshash' && remoteType === 'md5')
                    || (localType === 'md5' && remoteType === 'oshash');
                return compatibleType && remoteValue === localValue;
            });
        });
    }

    function rankScraperMatchesByEvidence(matches, context = {}) {
        if (!Array.isArray(matches)) return [];
        const { parseDurationSec } = getDependencies();
        const linkedPerformers = context.linkedPerformers || [];
        const localStudio = context.localStudio || null;
        const localDuration = parseDurationSec(context.localDuration);
        const localTitles = [context.localTitle, context.localFileName].filter(Boolean);
        const matchingSettings = getMatchingSettings();
        const performerRanked = rankMatchesByLinkedPerformers(matches, linkedPerformers);

        const ranked = performerRanked.map((match, originalIndex) => {
            let score = 0;
            const reasons = [];
            const isHashMatch = hasVerifiedFingerprint(match);
            match._hasVerifiedFingerprint = isHashMatch;
            if (isHashMatch) {
                score += 1000;
                reasons.push('Fingerprint match');
            }

            if (linkedPerformers.length > 0) {
                const overlap = match._performerOverlapCount || 0;
                const weakOverlap = match._weakPerformerOverlapCount || 0;
                const remotePerformerCount = Array.isArray(match?.performers) ? match.performers.length : 0;
                const performerSetConflict = overlap === 0
                    && weakOverlap === 0
                    && matchingSettings.majorCastConflict
                    && linkedPerformers.length >= 2
                    && remotePerformerCount >= 2;
                match._performerSetConflict = performerSetConflict;
                if (overlap > 0) {
                    const coverage = overlap / linkedPerformers.length;
                    score += 30 + Math.round(30 * coverage);
                    reasons.push(`${overlap}/${linkedPerformers.length} linked performer${linkedPerformers.length === 1 ? '' : 's'} matched`);
                } else if (weakOverlap > 0) {
                    score += Math.min(10, weakOverlap * 5);
                    reasons.push(`${weakOverlap} possible single-word performer alias${weakOverlap === 1 ? '' : 'es'} matched`);
                } else if (performerSetConflict) {
                    score -= 70;
                    reasons.push(`All ${remotePerformerCount} returned performers differ from the ${linkedPerformers.length} linked performers`);
                } else {
                    score -= 35;
                    reasons.push('No linked performers matched');
                }
            } else {
                match._performerSetConflict = false;
            }

            match._studioComparison = 'unknown';
            if (localStudio?.name && match?.studio?.name) {
                const sameId = match.studio.stored_id && String(match.studio.stored_id) === String(localStudio.id);
                const sameName = normalizePerformerName(match.studio.name) === normalizePerformerName(localStudio.name);
                match._studioComparison = sameId || sameName ? 'match' : 'mismatch';
                score += match._studioComparison === 'match' ? 35 : -35;
                reasons.push(match._studioComparison === 'match' ? 'Studio matched' : 'Studio differs');
            }

            const remoteDuration = parseDurationSec(match?.duration);
            match._durationDifference = localDuration && remoteDuration ? Math.abs(localDuration - remoteDuration) : null;
            if (match._durationDifference !== null) {
                if (match._durationDifference <= 15) {
                    score += 30;
                    reasons.push('Duration closely matched');
                } else if (match._durationDifference <= 60) {
                    score += 10;
                    reasons.push('Duration reasonably close');
                } else {
                    score -= match._durationDifference > 300 ? 55 : 30;
                    reasons.push('Duration differs substantially');
                }
            }

            const titleSimilarities = localTitles
                .map(value => calculateTitleSimilarity(value, match?.title || '', linkedPerformers, [localStudio?.name]))
                .filter(value => value !== null);
            match._titleSimilarity = titleSimilarities.length > 0 ? Math.max(...titleSimilarities) : null;
            if (match._titleSimilarity !== null) {
                if (match._titleSimilarity >= 0.6) score += 30;
                else if (match._titleSimilarity >= 0.3) score += 15;
                else score -= 20;
                reasons.push(match._titleSimilarity >= 0.6 ? 'Title closely matched' : match._titleSimilarity >= 0.3 ? 'Title partly matched' : 'Title differs');
            }

            match._matchScore = score;
            match._matchReasons = reasons;
            match._matchAssessment = isHashMatch ? 'strong' : score >= 60 ? 'likely' : score >= 15 ? 'possible' : 'unlikely';
            return { match, originalIndex };
        });

        ranked.sort((a, b) => b.match._matchScore - a.match._matchScore || a.originalIndex - b.originalIndex);
        matches.splice(0, matches.length, ...ranked.map(entry => entry.match));
        return matches;
    }

    function isObviousFalsePositive(match, providedMatchingSettings = null) {
        if (!match || match._matchType === 'scene-id' || match._hasVerifiedFingerprint || hasVerifiedFingerprint(match)) return false;
        const matchingSettings = providedMatchingSettings || getMatchingSettings();
        if (!matchingSettings.hideObviousFalsePositives) return false;
        const comparison = match._comparisonContext || {};
        const { parseDurationSec } = getDependencies();
        const localDuration = parseDurationSec(match._localDuration);
        const durationThreshold = Math.max(
            Number(matchingSettings.durationMismatchThreshold) || 0,
            localDuration ? localDuration * ((Number(matchingSettings.durationMismatchPercent) || 0) / 100) : 0
        );
        const durationDifference = Number(match._durationDifference);
        const durationUnavailable = match._durationDifference === null
            || match._durationDifference === undefined
            || !Number.isFinite(durationDifference);
        const durationStronglyConflicts = !durationUnavailable && durationDifference > durationThreshold;
        return match._matchAssessment === 'unlikely'
            && comparison.scene === true
            && comparison.performers === true
            && Number(match._performerOverlapCount || 0) === 0
            && (!matchingSettings.requireStudioMismatch || (comparison.studio === true && match._studioComparison === 'mismatch'))
            && typeof match._titleSimilarity === 'number'
            && match._titleSimilarity < Number(matchingSettings.titleSimilarityThreshold)
            && (!matchingSettings.closeDurationProtects || durationUnavailable || durationStronglyConflicts);
    }

    function partitionObviousFalsePositiveMatches(matches) {
        const visible = [];
        const hidden = [];
        if (!Array.isArray(matches)) return { visible, hidden };
        const matchingSettings = getMatchingSettings();
        matches.forEach(match => {
            (isObviousFalsePositive(match, matchingSettings) ? hidden : visible).push(match);
        });
        // Never present an empty result set merely because every result was weak.
        if (visible.length === 0 && hidden.length > 0) visible.push(hidden.shift());
        return { visible, hidden };
    }

    function enrichScraperMatches(matches, matchType, sourceName, localDuration, localFingerprints, linkedPerformers = [], localContext = {}, sourceInfo = null) {
        if (!Array.isArray(matches)) return [];
        matches.forEach(match => {
            match._matchType = matchType;
            match._sourceName = sourceName;
            match._sourceEndpoint = String(sourceInfo?.endpoint || '');
            match._sourceIndex = Number.isInteger(sourceInfo?.index) ? sourceInfo.index : null;
            match._localDuration = localDuration;
            match._localFingerprints = localFingerprints;
            match._comparisonContext = {
                scene: localContext.sceneContextLoaded === true,
                performers: linkedPerformers.length > 0,
                studio: Boolean(localContext.localStudio?.name),
                duration: Boolean(getDependencies().parseDurationSec(localDuration)),
                fingerprints: localFingerprints.length > 0
            };
        });
        return rankScraperMatchesByEvidence(matches, { ...localContext, linkedPerformers, localDuration });
    }

    function analyzeScraperMatch(match) {
        const { parseDurationSec } = getDependencies();
        const localFingerprints = match?._localFingerprints || [];
        const localPhash = (localFingerprints.find(item => item.type?.toLowerCase() === 'phash')?.value || '').toLowerCase();
        const localOshash = (localFingerprints.find(item => item.type?.toLowerCase() === 'oshash')?.value || '').toLowerCase();
        const localMd5 = (localFingerprints.find(item => item.type?.toLowerCase() === 'md5')?.value || '').toLowerCase();
        const remoteFingerprints = match?.fingerprints || [];
        const phashMatch = localPhash && remoteFingerprints.some(item => item.algorithm?.toLowerCase() === 'phash' && (item.hash || '').toLowerCase() === localPhash);
        const oshashMatch = localOshash && remoteFingerprints.some(item => (item.algorithm?.toLowerCase() === 'oshash' || item.algorithm?.toLowerCase() === 'md5') && (item.hash || '').toLowerCase() === localOshash);
        const md5Match = localMd5 && remoteFingerprints.some(item => item.algorithm?.toLowerCase() === 'md5' && (item.hash || '').toLowerCase() === localMd5);
        const isHashMatch = Boolean(phashMatch || oshashMatch || md5Match);
        const matchBadges = [];
        if (phashMatch) matchBadges.push('PHash is a match');
        if (oshashMatch || md5Match) matchBadges.push('MD5 Checksum is a match');
        if (matchBadges.length === 0 && isHashMatch) matchBadges.push('Fingerprint is a match');

        const localDurSec = parseDurationSec(match?._localDuration);
        const scrapedDurSec = parseDurationSec(match?.duration);
        const totalFps = remoteFingerprints.length;
        const matchingDurFps = remoteFingerprints.filter(item => {
            const fingerprintDuration = parseDurationSec(item.duration);
            return fingerprintDuration && localDurSec && Math.abs(fingerprintDuration - localDurSec) <= 15;
        }).length;

        return {
            phashMatch,
            oshashMatch,
            md5Match,
            isHashMatch,
            matchBadges,
            localDurSec,
            scrapedDurSec,
            totalFps,
            matchingDurFps
        };
    }

    function readScrapeFieldSelection(container) {
        const checkedIndices = selector => Array.from(container.querySelectorAll(selector))
            .map(element => parseInt(element.getAttribute('data-idx'), 10));
        return {
            studio: container.querySelector('#fasttag-scrape-chk-studio')?.checked ?? false,
            title: container.querySelector('#fasttag-scrape-chk-title')?.checked ?? false,
            date: container.querySelector('#fasttag-scrape-chk-date')?.checked ?? false,
            cover: container.querySelector('#fasttag-scrape-chk-cover')?.checked ?? false,
            details: container.querySelector('#fasttag-scrape-chk-details')?.checked ?? false,
            performerIndices: checkedIndices('.fasttag-scrape-perf-item:checked'),
            tagIndices: checkedIndices('.fasttag-scrape-tag-item:checked')
        };
    }

    function mergeUniqueIds(existingIds, addedIds) {
        return Array.from(new Set([...(existingIds || []).map(String), ...(addedIds || []).map(String)]));
    }

    function buildAcceptedSceneStashIds(existingStashIds, match, stashBoxes) {
        const existing = (Array.isArray(existingStashIds) ? existingStashIds : [])
            .filter(item => item?.endpoint && item?.stash_id)
            .map(item => ({ endpoint: String(item.endpoint), stash_id: String(item.stash_id) }));
        const urls = Array.isArray(match?.urls) ? match.urls.filter(value => typeof value === 'string') : [];
        const remoteSceneUrl = urls.find(value => /\/scenes\//i.test(value)) || '';
        const rawRemoteId = String(match?.remote_site_id || '').trim();
        const remoteUrl = /^https?:\/\//i.test(rawRemoteId) ? rawRemoteId : remoteSceneUrl;
        const urlIdMatch = remoteUrl.match(/\/scenes\/([^/?#]+)/i);
        const stashId = urlIdMatch ? decodeURIComponent(urlIdMatch[1]) : (/^[a-z0-9-]+$/i.test(rawRemoteId) ? rawRemoteId : '');
        const boxes = Array.isArray(stashBoxes) ? stashBoxes : [];
        const reportedEndpoint = /^https?:\/\//i.test(String(match?._sourceEndpoint || '')) ? String(match._sourceEndpoint) : '';
        const sourceName = String(match?._sourceName || '').trim();
        const configuredSource = boxes.find(box => sourceName && String(box?.name || '').trim().toLowerCase() === sourceName.toLowerCase());
        const isConfiguredStashBoxResult = Boolean(reportedEndpoint || configuredSource)
            || /stashdb/i.test(sourceName)
            || /stashdb\.org/i.test(remoteUrl);
        if (!isConfiguredStashBoxResult || !stashId) return { stashIds: existing, added: false, reason: null };

        const endpoint = reportedEndpoint
            || configuredSource?.endpoint
            || boxes.find(box => /stashdb\.org/i.test(String(box?.endpoint || '')))?.endpoint
            || boxes.find(box => /stashdb/i.test(String(box?.name || '')))?.endpoint
            || '';
        if (!endpoint) return { stashIds: existing, added: false, reason: 'the configured scraper endpoint could not be resolved' };

        const endpointKey = String(endpoint).replace(/\/+$/, '').toLowerCase();
        const sameEndpoint = existing.find(item => item.endpoint.replace(/\/+$/, '').toLowerCase() === endpointKey);
        if (sameEndpoint) {
            if (sameEndpoint.stash_id === stashId) return { stashIds: existing, added: false, reason: null };
            return { stashIds: existing, added: false, reason: 'the scene already has a different ID for this scraper source' };
        }
        return { stashIds: [...existing, { endpoint: String(endpoint), stash_id: stashId }], added: true, reason: null };
    }

    function buildScrapeUpdateInput(options) {
        const {
            sceneId,
            match,
            selection,
            studioIdToSet,
            performerIdsToAdd = [],
            tagIdsToAdd = [],
            existingPerformerIds = [],
            existingTagIds = [],
            includeCover = false,
            onlyChangedCollections = true
        } = options;
        const mergedPerformerIds = mergeUniqueIds(existingPerformerIds, performerIdsToAdd);
        const mergedTagIds = mergeUniqueIds(existingTagIds, tagIdsToAdd);
        const updateInput = { id: sceneId };
        if (studioIdToSet) updateInput.studio_id = studioIdToSet;
        if ((onlyChangedCollections ? performerIdsToAdd : mergedPerformerIds).length > 0) updateInput.performer_ids = mergedPerformerIds;
        if ((onlyChangedCollections ? tagIdsToAdd : mergedTagIds).length > 0) updateInput.tag_ids = mergedTagIds;
        if (selection.date && match.date) updateInput.date = match.date;
        if (selection.details && match.details) updateInput.details = match.details;
        if (includeCover && selection.cover && match.image) updateInput.cover_image = match.image;
        if (selection.title && match.title) updateInput.title = match.title;
        return { updateInput, mergedPerformerIds, mergedTagIds };
    }

    async function loadCachedEntities(type) {
        const deps = getDependencies();
        const config = deps.getEntityConfig(type);
        let cachedEntities = deps.getCachedOrNull(type);
        if (!cachedEntities) {
            if (typeof deps.fetchEntityListSafely === 'function') {
                cachedEntities = await deps.fetchEntityListSafely(type);
            } else {
                const response = await deps.fetchGQL(config.fetchQuery);
                cachedEntities = config.extractList(response.data);
            }
            if (cachedEntities) deps.setCache(type, cachedEntities);
        }
        return { cachedEntities, config };
    }

    async function resolveScrapedStudioResult(studio, selected) {
        if (!selected || !studio?.name) return { id: null, failures: [] };
        if (studio.stored_id) return { id: String(studio.stored_id), failures: [] };
        const deps = getDependencies();
        const { cachedEntities, config } = await loadCachedEntities('studios');
        const normalizedName = studio.name.trim().toLowerCase();
        const found = cachedEntities?.find(item => (item.name || '').trim().toLowerCase() === normalizedName);
        if (found) return { id: String(found.id), failures: [] };
        const response = await deps.fetchGQL(config.createQuery, { name: studio.name.trim() });
        const newId = config.createExtract(response?.data);
        if (!newId) return { id: null, failures: [studio.name.trim()] };
        deps.setCache('studios', null);
        return { id: String(newId), failures: [] };
    }

    async function resolveScrapedStudio(studio, selected) {
        return (await resolveScrapedStudioResult(studio, selected)).id;
    }

    function buildScrapedPerformerCreateInput(item, sourceInfo = {}) {
        const input = { name: String(item?.name || '').trim() };
        const image = (Array.isArray(item?.images) ? item.images : [])
            .map(value => String(value || '').trim())
            .find(Boolean);
        if (image) input.image = image;

        const endpoint = String(sourceInfo?.endpoint || '').trim();
        const rawRemoteId = String(item?.remote_site_id || '').trim();
        const urlIdMatch = rawRemoteId.match(/\/performers\/([^/?#]+)/i);
        const remoteId = urlIdMatch
            ? decodeURIComponent(urlIdMatch[1])
            : (/^[a-z0-9-]+$/i.test(rawRemoteId) ? rawRemoteId : '');
        if (/^https?:\/\//i.test(endpoint) && remoteId) {
            input.stash_ids = [{ endpoint, stash_id: remoteId }];
        }
        return input;
    }

    async function createScrapedPerformer(config, item, sourceInfo) {
        const fullInput = buildScrapedPerformerCreateInput(item, sourceInfo);
        const attempts = [];
        if (fullInput.image || fullInput.stash_ids) attempts.push(fullInput);
        if (fullInput.image && fullInput.stash_ids) attempts.push({ name: fullInput.name, image: fullInput.image });
        if (fullInput.image && fullInput.stash_ids) attempts.push({ name: fullInput.name, stash_ids: fullInput.stash_ids });

        for (const input of attempts) {
            try {
                const response = await getDependencies().fetchGQL(`
                    mutation FastTagCreateScrapedPerformer($input: PerformerCreateInput!) {
                        performerCreate(input: $input) { id name }
                    }
                `, { input });
                const newId = response?.data?.performerCreate?.id || config.createExtract(response?.data);
                if (newId) return String(newId);
            } catch (error) {
                console.warn('[FastTag] Performer profile import failed; retrying with fewer fields.', error);
            }
        }

        try {
            const response = await getDependencies().fetchGQL(config.createQuery, { name: fullInput.name });
            const newId = config.createExtract(response?.data);
            return newId ? String(newId) : null;
        } catch (error) {
            return null;
        }
    }

    function isMissingPerformerImage(imagePath) {
        const value = String(imagePath || '').trim();
        return !value || /[?&]default=true(?:&|$)/i.test(value);
    }

    function mergePerformerStashIds(existingStashIds, incomingStashIds) {
        const existing = (Array.isArray(existingStashIds) ? existingStashIds : [])
            .filter(item => item?.endpoint && item?.stash_id)
            .map(item => ({ endpoint: String(item.endpoint), stash_id: String(item.stash_id) }));
        const incoming = (Array.isArray(incomingStashIds) ? incomingStashIds : [])
            .filter(item => item?.endpoint && item?.stash_id);
        for (const item of incoming) {
            const endpointKey = String(item.endpoint).replace(/\/+$/, '').toLowerCase();
            const endpointAlreadyPresent = existing.some(current =>
                current.endpoint.replace(/\/+$/, '').toLowerCase() === endpointKey
            );
            if (!endpointAlreadyPresent) {
                existing.push({ endpoint: String(item.endpoint), stash_id: String(item.stash_id) });
            }
        }
        return existing;
    }

    async function enrichExistingScrapedPerformer(localPerformer, item, sourceInfo) {
        const deps = getDependencies();
        if (deps.getFillMissingPerformerImages?.() === false || !localPerformer?.id) return;
        const scrapedInput = buildScrapedPerformerCreateInput(item, sourceInfo);
        if (!scrapedInput.image) return;

        let current = localPerformer;
        if (typeof current.image_path === 'undefined' || typeof current.stash_ids === 'undefined') {
            try {
                const response = await deps.fetchGQL(`
                    query FastTagExistingPerformerProfile($id: ID!) {
                        findPerformer(id: $id) { id image_path stash_ids { endpoint stash_id } }
                    }
                `, { id: String(localPerformer.id) });
                current = response?.data?.findPerformer || current;
            } catch (error) {
                return;
            }
        }

        if (!isMissingPerformerImage(current.image_path)) return;
        const updateInput = { id: String(localPerformer.id), image: scrapedInput.image };
        const mergedStashIds = mergePerformerStashIds(current.stash_ids, scrapedInput.stash_ids);
        if (mergedStashIds.length > (Array.isArray(current.stash_ids) ? current.stash_ids.length : 0)) {
            updateInput.stash_ids = mergedStashIds;
        }
        if (!updateInput.image && !updateInput.stash_ids) return;

        const attempts = [updateInput];
        if (updateInput.image && updateInput.stash_ids) attempts.push({ id: updateInput.id, image: updateInput.image });
        for (const input of attempts) {
            try {
                const response = await deps.fetchGQL(`
                    mutation FastTagEnrichExistingPerformer($input: PerformerUpdateInput!) {
                        performerUpdate(input: $input) { id image_path stash_ids { endpoint stash_id } }
                    }
                `, { input });
                if (response?.data?.performerUpdate?.id) {
                    deps.setCache('performers', null);
                    return;
                }
            } catch (error) {
                console.warn('[FastTag] Existing performer profile enrichment failed.', error);
            }
        }
    }

    async function resolveScrapedEntityIdsResult(type, items, selectedIndices, sourceInfo = null) {
        if (!selectedIndices?.length || !items) return { ids: [], failures: [] };
        const deps = getDependencies();
        const { cachedEntities, config } = await loadCachedEntities(type);
        const resolvedIds = [];
        const failures = [];
        for (const index of selectedIndices) {
            const item = items[index];
            if (!item || !item.name) continue;
            if (item.stored_id) {
                resolvedIds.push(String(item.stored_id));
                if (type === 'performers') {
                    const localPerformer = cachedEntities?.find(cached => String(cached.id) === String(item.stored_id))
                        || { id: String(item.stored_id) };
                    await enrichExistingScrapedPerformer(localPerformer, item, sourceInfo || {});
                }
                continue;
            }
            const normalizedName = item.name.trim().toLowerCase();
            const found = cachedEntities?.find(cached => (cached.name || '').trim().toLowerCase() === normalizedName);
            if (found) {
                resolvedIds.push(String(found.id));
                if (type === 'performers') {
                    await enrichExistingScrapedPerformer(found, item, sourceInfo || {});
                }
                continue;
            }
            let newId = null;
            if (type === 'performers') {
                newId = await createScrapedPerformer(config, item, sourceInfo || {});
            } else {
                const response = await deps.fetchGQL(config.createQuery, { name: item.name.trim() });
                newId = config.createExtract(response?.data);
            }
            if (newId) {
                resolvedIds.push(String(newId));
                deps.setCache(type, null);
            } else {
                failures.push(item.name.trim());
            }
        }
        return { ids: resolvedIds, failures };
    }

    async function resolveScrapedEntityIds(type, items, selectedIndices) {
        return (await resolveScrapedEntityIdsResult(type, items, selectedIndices)).ids;
    }

    async function fetchScraperMatchesForScene(sceneId, cardElement, manualQuery = '', shouldContinue = null) {
        const scraperDependencies = getDependencies();
        const { fetchGQL } = scraperDependencies;
        const startedAt = Date.now();
        let attemptCount = 0;
        const isStillCurrent = () => typeof shouldContinue !== 'function' || shouldContinue() !== false;
        const debugTiming = (message, data = {}) => {
            if (!scraperDependencies.getDebugMode?.()) return;
            scraperDependencies.log?.('DEBUG', 'SCRAPE_TIMING', message, {
                sceneId: String(sceneId),
                elapsedMs: Date.now() - startedAt,
                ...data
            });
        };
        const finish = (outcome, matches, data = {}) => {
            debugTiming('Scrape search completed', {
                outcome,
                attemptCount,
                resultCount: Array.isArray(matches) ? matches.length : 0,
                ...data
            });
            return matches;
        };
        debugTiming('Scrape search started', { manual: Boolean(manualQuery) });
        const sourceLookupStartedAt = Date.now();
        const preferredSourcePromise = loadPreferredStashBox().then(source => ({
            source,
            durationMs: Date.now() - sourceLookupStartedAt
        }));
        let sceneTitle = '';
        let sceneFileName = '';
        let localDuration = null;
        let localFingerprints = [];
        let linkedPerformers = [];
        let localStudio = null;
        let sceneContextLoaded = false;

        const contextStartedAt = Date.now();
        try {
            const query = 'query ($id: ID!) { findScene(id: $id) { id title details studio { id name } performers { id name alias_list } files { path duration fingerprints { type value } } } }';
            const response = await fetchGQL(query, { id: sceneId });
            const scene = response?.data?.findScene;
            if (scene) {
                sceneContextLoaded = true;
                sceneTitle = scene.title || '';
                const firstFile = scene.files?.[0];
                if (firstFile?.path) {
                    const parts = firstFile.path.split(/[/\\]/);
                    sceneFileName = parts[parts.length - 1] || '';
                }
                if (firstFile?.duration) localDuration = firstFile.duration;
                if (firstFile?.fingerprints) localFingerprints = firstFile.fingerprints;
                linkedPerformers = scene.performers || [];
                localStudio = scene.studio || null;
            }
            debugTiming('Scene context loaded', {
                durationMs: Date.now() - contextStartedAt,
                found: sceneContextLoaded,
                fingerprintCount: localFingerprints.length,
                performerCount: linkedPerformers.length,
                hasStudio: Boolean(localStudio)
            });
        } catch (error) {
            debugTiming('Scene context lookup failed', {
                durationMs: Date.now() - contextStartedAt,
                error: String(error?.message || error)
            });
        }

        const preferredSourceResult = await preferredSourcePromise;
        const preferredSource = preferredSourceResult.source;
        debugTiming('Preferred scraper source resolved', {
            durationMs: preferredSourceResult.durationMs,
            source: preferredSource.name,
            endpoint: preferredSource.endpoint || null
        });
        if (!isStillCurrent()) return finish('superseded', []);
        const enrich = (matches, matchType, sourceName, sourceInfo = null) => enrichScraperMatches(
            matches, matchType, sourceName, localDuration, localFingerprints, linkedPerformers,
            { localStudio, localTitle: sceneTitle, localFileName: sceneFileName, sceneContextLoaded }, sourceInfo
        );

        const cleanedManualQuery = manualQuery ? getDependencies().cleanTitleForScraping(manualQuery) : '';
        if (!cleanedManualQuery) {
            const attemptStartedAt = Date.now();
            attemptCount += 1;
            try {
                const response = await fetchGQL(SCRAPE_QUERY, {
                    source: { stash_box_index: preferredSource.index },
                    input: { scene_id: String(sceneId) }
                });
                const matches = response?.data?.scrapeSingleScene;
                debugTiming('Direct scene lookup completed', {
                    attempt: attemptCount,
                    durationMs: Date.now() - attemptStartedAt,
                    source: preferredSource.name,
                    resultCount: Array.isArray(matches) ? matches.length : 0,
                    errorCount: Array.isArray(response?.errors) ? response.errors.length : 0
                });
                if (!isStillCurrent()) return finish('superseded', []);
                if (Array.isArray(matches) && matches.length > 0) {
                    return finish('direct-match', enrich(matches, 'scene-id', preferredSource.name, preferredSource));
                }
            } catch (error) {
                console.log('[FastTag] Scrape by scene_id error/empty:', error);
                debugTiming('Direct scene lookup failed', {
                    attempt: attemptCount,
                    durationMs: Date.now() - attemptStartedAt,
                    source: preferredSource.name,
                    error: String(error?.message || error)
                });
            }
        }

        const cardText = cardElement
            ? (cardElement.querySelector('.title, .card-title, .scene-card__title')?.textContent || '').trim()
            : '';
        const primaryQueries = cleanedManualQuery
            ? [cleanedManualQuery]
            : buildScrapeCandidateQueries(sceneTitle, sceneFileName, cardText);
        const studioPerformerQueries = cleanedManualQuery
            ? []
            : buildStudioPerformerFallbackQueries(localStudio, linkedPerformers, primaryQueries);
        const contextualSearchQuery = cleanedManualQuery
            ? ''
            : buildContextualSearchQuery(localStudio, linkedPerformers);
        const editableSearchQuery = cleanedManualQuery
            || contextualSearchQuery
            || primaryQueries[0]
            || '';
        let candidateQueries = cleanedManualQuery
            ? primaryQueries
            : Array.from(new Set([
                ...primaryQueries,
                ...buildOpaqueRecoveryFallbackQueries(primaryQueries),
                ...studioPerformerQueries,
                contextualSearchQuery,
                ...buildLinkedPerformerFallbackQueries(linkedPerformers, primaryQueries)
            ].filter(Boolean)));
        candidateQueries = Array.from(new Set(candidateQueries.map(dedupeScrapeQueryWords).filter(Boolean)));
        if (!cleanedManualQuery && linkedPerformers.length > 0) {
            candidateQueries = retainOneOpaqueQueryWhenAlternatives(candidateQueries);
        }

        debugTiming('Scrape fallback queries prepared', {
            candidateCount: candidateQueries.length,
            queries: candidateQueries
        });

        let weakStashDbMatches = [];

        for (const queryTerm of candidateQueries) {
            if (!isStillCurrent()) return finish('superseded', []);
            if (!queryTerm || queryTerm.length < 2) continue;
            const attemptStartedAt = Date.now();
            attemptCount += 1;
            try {
                const response = await fetchGQL(SCRAPE_QUERY, {
                    source: { stash_box_index: preferredSource.index },
                    input: { query: queryTerm }
                });
                const matches = response?.data?.scrapeSingleScene;
                if (Array.isArray(matches) && matches.length > 0) {
                    const enriched = enrich(matches, 'title', preferredSource.name, preferredSource);
                    enriched.forEach(match => {
                        match._matchedSearchQuery = queryTerm;
                        match._searchQuery = editableSearchQuery || queryTerm;
                    });
                    const combined = mergeScraperMatchResults(weakStashDbMatches, enriched);
                    const decisive = hasDecisiveScraperMatch(enriched);
                    debugTiming('Scraper query completed', {
                        attempt: attemptCount,
                        durationMs: Date.now() - attemptStartedAt,
                        source: preferredSource.name,
                        query: queryTerm,
                        resultCount: enriched.length,
                        decisive
                    });
                    if (!isStillCurrent()) return finish('superseded', []);
                    if (decisive) return finish('decisive-fallback-match', combined, { decisiveQuery: queryTerm });
                    weakStashDbMatches = combined;
                } else {
                    debugTiming('Scraper query completed', {
                        attempt: attemptCount,
                        durationMs: Date.now() - attemptStartedAt,
                        source: preferredSource.name,
                        query: queryTerm,
                        resultCount: 0,
                        errorCount: Array.isArray(response?.errors) ? response.errors.length : 0,
                        decisive: false
                    });
                    if (!isStillCurrent()) return finish('superseded', []);
                }
            } catch (error) {
                console.log('[FastTag] Scrape query error:', error);
                debugTiming('Scraper query failed', {
                    attempt: attemptCount,
                    durationMs: Date.now() - attemptStartedAt,
                    source: preferredSource.name,
                    query: queryTerm,
                    error: String(error?.message || error)
                });
            }
        }

        if (weakStashDbMatches.length > 0) return finish('weak-fallback-matches', weakStashDbMatches);

        const scraperListStartedAt = Date.now();
        if (!isStillCurrent()) return finish('superseded', []);
        try {
            const response = await fetchGQL('query { listScrapers(types: [SCENE]) { id name } }');
            const scrapers = response?.data?.listScrapers || [];
            debugTiming('Installed scraper list loaded', {
                durationMs: Date.now() - scraperListStartedAt,
                scraperCount: scrapers.filter(scraper => scraper.id !== 'builtin_autotag').length,
                errorCount: Array.isArray(response?.errors) ? response.errors.length : 0
            });
            if (!isStillCurrent()) return finish('superseded', []);
            for (const scraper of scrapers) {
                if (scraper.id === 'builtin_autotag') continue;
                for (const queryTerm of candidateQueries) {
                    if (!isStillCurrent()) return finish('superseded', []);
                    if (!queryTerm || queryTerm.length < 2) continue;
                    const attemptStartedAt = Date.now();
                    attemptCount += 1;
                    try {
                        const scrapeResponse = await fetchGQL(SCRAPE_QUERY, {
                            source: { scraper_id: scraper.id },
                            input: { query: queryTerm }
                        });
                        const matches = scrapeResponse?.data?.scrapeSingleScene;
                        debugTiming('Installed scraper query completed', {
                            attempt: attemptCount,
                            durationMs: Date.now() - attemptStartedAt,
                            source: scraper.name || scraper.id,
                            query: queryTerm,
                            resultCount: Array.isArray(matches) ? matches.length : 0,
                            errorCount: Array.isArray(scrapeResponse?.errors) ? scrapeResponse.errors.length : 0
                        });
                        if (!isStillCurrent()) return finish('superseded', []);
                        if (Array.isArray(matches) && matches.length > 0) {
                            const enriched = enrich(matches, 'scraper', scraper.name || 'Scraper');
                            enriched.forEach(match => {
                                match._matchedSearchQuery = queryTerm;
                                match._searchQuery = editableSearchQuery || queryTerm;
                            });
                            return finish('installed-scraper-match', enriched, {
                                decisiveQuery: queryTerm,
                                decisiveSource: scraper.name || scraper.id
                            });
                        }
                    } catch (error) {
                        debugTiming('Installed scraper query failed', {
                            attempt: attemptCount,
                            durationMs: Date.now() - attemptStartedAt,
                            source: scraper.name || scraper.id,
                            query: queryTerm,
                            error: String(error?.message || error)
                        });
                    }
                }
            }
        } catch (error) {
            debugTiming('Installed scraper list lookup failed', {
                durationMs: Date.now() - scraperListStartedAt,
                error: String(error?.message || error)
            });
        }
        return finish('no-matches', []);
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.scraper = Object.freeze({
        configure,
        buildScrapeCandidateQueries,
        buildLinkedPerformerFallbackQueries,
        buildStudioPerformerFallbackQueries,
        buildContextualSearchQuery,
        buildOpaqueRecoveryFallbackQueries,
        dedupeScrapeQueryWords,
        containsOpaqueScrapeToken,
        retainOneOpaqueQueryWhenAlternatives,
        mergeScraperMatchResults,
        hasDecisiveScraperMatch,
        resolvePreferredStashBox,
        getScraperResultUrl,
        rankMatchesByLinkedPerformers,
        calculateTitleSimilarity,
        rankScraperMatchesByEvidence,
        isObviousFalsePositive,
        partitionObviousFalsePositiveMatches,
        enrichScraperMatches,
        analyzeScraperMatch,
        readScrapeFieldSelection,
        mergeUniqueIds,
        buildAcceptedSceneStashIds,
        buildScrapeUpdateInput,
        buildScrapedPerformerCreateInput,
        isMissingPerformerImage,
        mergePerformerStashIds,
        resolveScrapedStudioResult,
        resolveScrapedStudio,
        resolveScrapedEntityIdsResult,
        resolveScrapedEntityIds,
        fetchScraperMatchesForScene
    });
}(typeof window !== 'undefined' ? window : globalThis));
