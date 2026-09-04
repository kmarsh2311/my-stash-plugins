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

    function configure(options) { dependencies = options; }
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
            const isHashMatch = match?._matchType === 'hash';
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

    function enrichScraperMatches(matches, matchType, sourceName, localDuration, localFingerprints, linkedPerformers = [], localContext = {}) {
        if (!Array.isArray(matches)) return [];
        matches.forEach(match => {
            match._matchType = matchType;
            match._sourceName = sourceName;
            match._localDuration = localDuration;
            match._localFingerprints = localFingerprints;
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
        const isHashMatch = match?._matchType === 'hash' || phashMatch || oshashMatch || md5Match;
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

    async function resolveScrapedStudio(studio, selected) {
        if (!selected || !studio?.name) return null;
        if (studio.stored_id) return String(studio.stored_id);
        const deps = getDependencies();
        const { cachedEntities, config } = await loadCachedEntities('studios');
        const normalizedName = studio.name.trim().toLowerCase();
        const found = cachedEntities?.find(item => (item.name || '').trim().toLowerCase() === normalizedName);
        if (found) return String(found.id);
        const response = await deps.fetchGQL(config.createQuery, { name: studio.name.trim() });
        const newId = config.createExtract(response.data);
        if (!newId) return null;
        deps.setCache('studios', null);
        return String(newId);
    }

    async function resolveScrapedEntityIds(type, items, selectedIndices) {
        if (!selectedIndices?.length || !items) return [];
        const deps = getDependencies();
        const { cachedEntities, config } = await loadCachedEntities(type);
        const resolvedIds = [];
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
            const newId = config.createExtract(response.data);
            if (newId) {
                resolvedIds.push(String(newId));
                deps.setCache(type, null);
            }
        }
        return resolvedIds;
    }

    async function fetchScraperMatchesForScene(sceneId, cardElement, manualQuery = '') {
        const { fetchGQL } = getDependencies();
        let sceneTitle = '';
        let sceneFileName = '';
        let localDuration = null;
        let localFingerprints = [];
        let linkedPerformers = [];
        let localStudio = null;

        try {
            const query = 'query ($id: ID!) { findScene(id: $id) { id title details studio { id name } performers { id name alias_list } files { path duration fingerprints { type value } } } }';
            const response = await fetchGQL(query, { id: sceneId });
            const scene = response?.data?.findScene;
            if (scene) {
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

        const enrich = (matches, matchType, sourceName) => enrichScraperMatches(
            matches, matchType, sourceName, localDuration, localFingerprints, linkedPerformers,
            { localStudio, localTitle: sceneTitle, localFileName: sceneFileName }
        );

        const cleanedManualQuery = manualQuery ? getDependencies().cleanTitleForScraping(manualQuery) : '';
        if (!cleanedManualQuery) {
            try {
                const response = await fetchGQL(SCRAPE_QUERY, {
                    source: { stash_box_index: 0 },
                    input: { scene_id: String(sceneId) }
                });
                const matches = response?.data?.scrapeSingleScene;
                if (Array.isArray(matches) && matches.length > 0) return enrich(matches, 'hash', 'StashDB');
            } catch (error) {
                console.log('[FastTag] Scrape by scene_id error/empty:', error);
            }
        }

        const cardText = cardElement
            ? (cardElement.querySelector('.title, .card-title, .scene-card__title')?.textContent || '').trim()
            : '';
        const candidateQueries = cleanedManualQuery
            ? [cleanedManualQuery]
            : buildScrapeCandidateQueries(sceneTitle, sceneFileName, cardText);

        for (const queryTerm of candidateQueries) {
            if (!queryTerm || queryTerm.length < 2) continue;
            try {
                const response = await fetchGQL(SCRAPE_QUERY, {
                    source: { stash_box_index: 0 },
                    input: { query: queryTerm }
                });
                const matches = response?.data?.scrapeSingleScene;
                if (Array.isArray(matches) && matches.length > 0) {
                    const enriched = enrich(matches, 'title', 'StashDB');
                    enriched.forEach(match => { match._searchQuery = queryTerm; });
                    return enriched;
                }
            } catch (error) {
                console.log('[FastTag] Scrape query error:', error);
            }
        }

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
                            enriched.forEach(match => { match._searchQuery = queryTerm; });
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
        rankMatchesByLinkedPerformers,
        calculateTitleSimilarity,
        rankScraperMatchesByEvidence,
        enrichScraperMatches,
        analyzeScraperMatch,
        readScrapeFieldSelection,
        mergeUniqueIds,
        buildScrapeUpdateInput,
        resolveScrapedStudio,
        resolveScrapedEntityIds,
        fetchScraperMatchesForScene
    });
}(typeof window !== 'undefined' ? window : globalThis));
