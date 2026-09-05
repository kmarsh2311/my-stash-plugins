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
                performers { stored_id name gender images }
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
        const linkedNames = new Map();

        for (const performer of linked) {
            const names = [performer.name];
            if (Array.isArray(performer.alias_list)) names.push(...performer.alias_list);
            else if (typeof performer.alias_list === 'string') names.push(...performer.alias_list.split(','));
            for (const name of names) {
                const normalized = normalizePerformerName(name);
                if (normalized) linkedNames.set(normalized, performer.name || name);
            }
        }

        const ranked = matches.map((match, originalIndex) => {
            const overlapNames = new Set();
            const additionalNames = new Set();
            for (const remotePerformer of match?.performers || []) {
                const storedId = String(remotePerformer?.stored_id || '');
                const normalizedName = normalizePerformerName(remotePerformer?.name);
                if (storedId && linkedIds.has(storedId)) {
                    overlapNames.add(remotePerformer.name || `Performer #${storedId}`);
                } else if (normalizedName && linkedNames.has(normalizedName)) {
                    overlapNames.add(linkedNames.get(normalizedName));
                } else if (remotePerformer?.name) {
                    additionalNames.add(remotePerformer.name);
                }
            }
            match._hasLinkedPerformers = linked.length > 0;
            match._linkedPerformerCount = linked.length;
            match._performerOverlapNames = Array.from(overlapNames);
            match._performerOverlapCount = overlapNames.size;
            match._additionalPerformerNames = Array.from(additionalNames);
            match._additionalPerformerCount = additionalNames.size;
            return { match, originalIndex };
        });

        ranked.sort((a, b) =>
            b.match._performerOverlapCount - a.match._performerOverlapCount ||
            a.originalIndex - b.originalIndex
        );
        return ranked.map(entry => entry.match);
    }

    const SCRAPE_TITLE_STOP_WORDS = new Set([
        'a', 'an', 'and', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
        'scene', 'video', 'file', 'part', 'episode', '1080p', '720p', '2160p',
        '4k', 'hd', 'uhd', 'fhd', 'xxx', 'mp4', 'mkv', 'avi'
    ]);

    function titleTokens(value, linkedPerformers = []) {
        const performerWords = new Set();
        for (const performer of linkedPerformers || []) {
            const names = [performer?.name];
            if (Array.isArray(performer?.alias_list)) names.push(...performer.alias_list);
            for (const name of names) {
                normalizePerformerName(name).split(/\s+/).filter(Boolean).forEach(word => performerWords.add(word));
            }
        }
        return new Set(normalizePerformerName(value).split(/\s+/).filter(word =>
            word.length >= 3 && !SCRAPE_TITLE_STOP_WORDS.has(word) && !performerWords.has(word)
        ));
    }

    function calculateTitleSimilarity(localValue, remoteValue, linkedPerformers = []) {
        const localTokens = titleTokens(localValue, linkedPerformers);
        const remoteTokens = titleTokens(remoteValue, linkedPerformers);
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
                if (overlap > 0) {
                    const coverage = overlap / linkedPerformers.length;
                    score += 30 + Math.round(30 * coverage);
                    reasons.push(`${overlap}/${linkedPerformers.length} linked performer${linkedPerformers.length === 1 ? '' : 's'} matched`);
                } else {
                    score -= 35;
                    reasons.push('No linked performers matched');
                }
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
                .map(value => calculateTitleSimilarity(value, match?.title || '', linkedPerformers))
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

    function isObviousFalsePositive(match) {
        if (!match || match._matchType === 'scene-id' || match._hasVerifiedFingerprint || hasVerifiedFingerprint(match)) return false;
        const comparison = match._comparisonContext || {};
        const { parseDurationSec } = getDependencies();
        const localDuration = parseDurationSec(match._localDuration);
        const durationThreshold = Math.max(300, localDuration ? localDuration * 0.25 : 0);
        const durationDifference = Number(match._durationDifference);
        const durationUnavailable = match._durationDifference === null
            || match._durationDifference === undefined
            || !Number.isFinite(durationDifference);
        const durationStronglyConflicts = !durationUnavailable && durationDifference > durationThreshold;
        return match._matchAssessment === 'unlikely'
            && comparison.scene === true
            && comparison.performers === true
            && comparison.studio === true
            && Number(match._performerOverlapCount || 0) === 0
            && match._studioComparison === 'mismatch'
            && typeof match._titleSimilarity === 'number'
            && match._titleSimilarity < 0.2
            && (durationUnavailable || durationStronglyConflicts);
    }

    function partitionObviousFalsePositiveMatches(matches) {
        const visible = [];
        const hidden = [];
        if (!Array.isArray(matches)) return { visible, hidden };
        matches.forEach(match => {
            (isObviousFalsePositive(match) ? hidden : visible).push(match);
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
            const response = await deps.fetchGQL(config.fetchQuery);
            cachedEntities = config.extractList(response.data);
            deps.setCache(type, cachedEntities);
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

    async function resolveScrapedEntityIdsResult(type, items, selectedIndices) {
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
                continue;
            }
            const normalizedName = item.name.trim().toLowerCase();
            const found = cachedEntities?.find(cached => (cached.name || '').trim().toLowerCase() === normalizedName);
            if (found) {
                resolvedIds.push(String(found.id));
                continue;
            }
            const response = await deps.fetchGQL(config.createQuery, { name: item.name.trim() });
            const newId = config.createExtract(response?.data);
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

    async function fetchScraperMatchesForScene(sceneId, cardElement, manualQuery = '') {
        const { fetchGQL } = getDependencies();
        const preferredSourcePromise = loadPreferredStashBox();
        let sceneTitle = '';
        let sceneFileName = '';
        let localDuration = null;
        let localFingerprints = [];
        let linkedPerformers = [];
        let localStudio = null;
        let sceneContextLoaded = false;

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
        } catch (e) {}

        const preferredSource = await preferredSourcePromise;
        const enrich = (matches, matchType, sourceName, sourceInfo = null) => enrichScraperMatches(
            matches, matchType, sourceName, localDuration, localFingerprints, linkedPerformers,
            { localStudio, localTitle: sceneTitle, localFileName: sceneFileName, sceneContextLoaded }, sourceInfo
        );

        const cleanedManualQuery = manualQuery ? getDependencies().cleanTitleForScraping(manualQuery) : '';
        if (!cleanedManualQuery) {
            try {
                const response = await fetchGQL(SCRAPE_QUERY, {
                    source: { stash_box_index: preferredSource.index },
                    input: { scene_id: String(sceneId) }
                });
                const matches = response?.data?.scrapeSingleScene;
                if (Array.isArray(matches) && matches.length > 0) return enrich(matches, 'scene-id', preferredSource.name, preferredSource);
            } catch (error) {
                console.log('[FastTag] Scrape by scene_id error/empty:', error);
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
        const candidateQueries = cleanedManualQuery
            ? primaryQueries
            : Array.from(new Set([
                ...primaryQueries,
                ...buildOpaqueRecoveryFallbackQueries(primaryQueries),
                ...studioPerformerQueries,
                contextualSearchQuery,
                ...buildLinkedPerformerFallbackQueries(linkedPerformers, primaryQueries)
            ].filter(Boolean)));

        let weakStashDbMatches = [];

        for (const queryTerm of candidateQueries) {
            if (!queryTerm || queryTerm.length < 2) continue;
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
                    if (hasDecisiveScraperMatch(enriched)) return combined;
                    weakStashDbMatches = combined;
                }
            } catch (error) {
                console.log('[FastTag] Scrape query error:', error);
            }
        }

        if (weakStashDbMatches.length > 0) return weakStashDbMatches;

        try {
            const response = await fetchGQL('query { listScrapers(types: [SCENE]) { id name } }');
            const scrapers = response?.data?.listScrapers || [];
            for (const scraper of scrapers) {
                if (scraper.id === 'builtin_autotag') continue;
                for (const queryTerm of candidateQueries) {
                    if (!queryTerm || queryTerm.length < 2) continue;
                    try {
                        const scrapeResponse = await fetchGQL(SCRAPE_QUERY, {
                            source: { scraper_id: scraper.id },
                            input: { query: queryTerm }
                        });
                        const matches = scrapeResponse?.data?.scrapeSingleScene;
                        if (Array.isArray(matches) && matches.length > 0) {
                            const enriched = enrich(matches, 'scraper', scraper.name || 'Scraper');
                            enriched.forEach(match => {
                                match._matchedSearchQuery = queryTerm;
                                match._searchQuery = editableSearchQuery || queryTerm;
                            });
                            return enriched;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return [];
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.scraper = Object.freeze({
        configure,
        buildScrapeCandidateQueries,
        buildLinkedPerformerFallbackQueries,
        buildStudioPerformerFallbackQueries,
        buildContextualSearchQuery,
        buildOpaqueRecoveryFallbackQueries,
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
        resolveScrapedStudioResult,
        resolveScrapedStudio,
        resolveScrapedEntityIdsResult,
        resolveScrapedEntityIds,
        fetchScraperMatchesForScene
    });
}(typeof window !== 'undefined' ? window : globalThis));
