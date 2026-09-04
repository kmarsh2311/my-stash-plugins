(function initializeFastTagIntegrations(root) {
    'use strict';

    const apolloSceneSyncSuccess = new Set();
    let refreshSceneCardsTimer = null;

    function resetRefractSceneCards(sceneId = null) {
        try {
            if (sceneId) {
                const sceneIdStr = String(sceneId);
                root.document.querySelectorAll(
                    `.scene-card a[href^="/scenes/${sceneIdStr}?"], ` +
                    `.scene-card a[href="/scenes/${sceneIdStr}"], ` +
                    `.scene-card a[href^="/scenes/${sceneIdStr}/"]`
                ).forEach(link => {
                    const card = link.closest('.scene-card');
                    if (card) {
                        card.removeAttribute('data-stash-sc');
                        card.querySelectorAll('.stash-performer-circles').forEach(element => element.remove());
                    }
                });
            } else {
                root.document.querySelectorAll('.scene-card').forEach(card => {
                    card.removeAttribute('data-stash-sc');
                    card.querySelectorAll('.stash-performer-circles').forEach(element => element.remove());
                });
            }
        } catch (e) {}
    }

    function syncSceneToApolloCache(sceneData) {
        if (!sceneData || !sceneData.id) return false;
        const sceneIdStr = String(sceneData.id);
        resetRefractSceneCards(sceneIdStr);

        const apollo = root.__APOLLO_CLIENT__;
        if (!apollo || !apollo.cache) return false;

        try {
            const cacheId = (typeof apollo.cache.identify === 'function' && apollo.cache.identify({ __typename: 'Scene', id: sceneIdStr })) || `Scene:${sceneIdStr}`;
            const fieldsToUpdate = {};

            if (sceneData.tags !== undefined) {
                fieldsToUpdate.tags = (existing, { toReference }) => (sceneData.tags || []).map(tag => {
                    const reference = typeof toReference === 'function' ? toReference({ __typename: 'Tag', id: String(tag.id), name: tag.name }) : null;
                    return reference || { __typename: 'Tag', id: String(tag.id), name: tag.name };
                });
            }
            if (sceneData.performers !== undefined) {
                fieldsToUpdate.performers = (existing, { toReference }) => (sceneData.performers || []).map(performer => {
                    const performerObject = {
                        __typename: 'Performer',
                        id: String(performer.id),
                        name: performer.name,
                        disambiguation: performer.disambiguation || null,
                        gender: performer.gender || null,
                        image_path: performer.image_path || null
                    };
                    const reference = typeof toReference === 'function' ? toReference(performerObject) : null;
                    return reference || performerObject;
                });
            }
            if (sceneData.studio !== undefined) {
                fieldsToUpdate.studio = (existing, { toReference }) => {
                    if (!sceneData.studio) return null;
                    const studioObject = {
                        __typename: 'Studio',
                        id: String(sceneData.studio.id),
                        name: sceneData.studio.name,
                        image_path: sceneData.studio.image_path || null
                    };
                    const reference = typeof toReference === 'function' ? toReference(studioObject) : null;
                    return reference || studioObject;
                };
            }
            if (sceneData.organized !== undefined) fieldsToUpdate.organized = () => Boolean(sceneData.organized);
            if (sceneData.title !== undefined) fieldsToUpdate.title = () => sceneData.title;
            if (sceneData.date !== undefined) fieldsToUpdate.date = () => sceneData.date;

            if (Object.keys(fieldsToUpdate).length > 0) {
                apollo.cache.modify({ id: cacheId, fields: fieldsToUpdate });
                apolloSceneSyncSuccess.add(sceneIdStr);
                return true;
            }
        } catch (error) {
            console.warn('[FastTag] Error updating Apollo scene cache directly:', error);
        }
        return false;
    }

    async function refreshSceneCards(sceneId = null) {
        const resetCards = () => resetRefractSceneCards(sceneId);
        resetCards();

        const apollo = root.__APOLLO_CLIENT__;
        if (!apollo || typeof apollo.getObservableQueries !== 'function') return false;
        const sceneQueries = [...apollo.getObservableQueries().values()].filter(query => {
            const queryName = query.queryName || query.options?.query?.definitions?.[0]?.name?.value || '';
            const queryText = query.options?.query?.loc?.source?.body || '';
            return (queryName === 'FindScenes' || queryText.includes('FindScenes') || queryName.includes('Scene')) && typeof query.refetch === 'function';
        });
        if (!sceneQueries.length) return false;
        await Promise.all(sceneQueries.map(query => query.refetch()));
        root.setTimeout(resetCards, 60);
        root.setTimeout(resetCards, 300);
        return true;
    }

    function refreshSceneCardsDebounced(sceneId = null, delayMs = 150) {
        root.clearTimeout(refreshSceneCardsTimer);
        refreshSceneCardsTimer = root.setTimeout(() => refreshSceneCards(sceneId), delayMs);
    }

    root.FastTag = root.FastTag || {};
    root.FastTag.integrations = Object.freeze({
        resetRefractSceneCards,
        syncSceneToApolloCache,
        refreshSceneCards,
        refreshSceneCardsDebounced
    });
}(typeof window !== 'undefined' ? window : globalThis));
