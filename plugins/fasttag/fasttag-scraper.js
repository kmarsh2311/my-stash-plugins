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

    function enrichScraperMatches(matches, matchType, sourceName, localDuration, localFingerprints) {
        if (!Array.isArray(matches)) return [];
        matches.forEach(match => {
            match._matchType = matchType;
            match._sourceName = sourceName;
            match._localDuration = localDuration;
            match._localFingerprints = localFingerprints;
        });
        return matches;
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

    async function fetchScraperMatchesForScene(sceneId, cardElement) {
        const { fetchGQL } = getDependencies();
        let sceneTitle = '';
        let sceneFileName = '';
        let localDuration = null;
        let localFingerprints = [];

        try {
            const query = 'query ($id: ID!) { findScene(id: $id) { id title details files { path duration fingerprints { type value } } } }';
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
            }
        } catch (e) {}

        const enrich = (matches, matchType, sourceName) => enrichScraperMatches(
            matches, matchType, sourceName, localDuration, localFingerprints
        );

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

        const cardText = cardElement
            ? (cardElement.querySelector('.title, .card-title, .scene-card__title')?.textContent || '').trim()
            : '';
        const candidateQueries = buildScrapeCandidateQueries(sceneTitle, sceneFileName, cardText);

        for (const queryTerm of candidateQueries) {
            if (!queryTerm || queryTerm.length < 2) continue;
            try {
                const response = await fetchGQL(SCRAPE_QUERY, {
                    source: { stash_box_index: 0 },
                    input: { query: queryTerm }
                });
                const matches = response?.data?.scrapeSingleScene;
                if (Array.isArray(matches) && matches.length > 0) return enrich(matches, 'title', 'StashDB');
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
                        if (Array.isArray(matches) && matches.length > 0) return enrich(matches, 'scraper', scraper.name || 'Scraper');
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
