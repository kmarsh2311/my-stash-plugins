(function initializeFastTagEntities(root) {
    'use strict';

    const SCENE_CARD_UPDATE_FIELDS = `
        id
        organized
        tags { id name }
        performers { id name disambiguation gender image_path }
        studio { id name image_path }
    `;

    const commonIdColumn = { title: 'ID', field: 'id', width: 55, hozAlign: 'center', headerHozAlign: 'center', resizable: false, headerSort: false };
    const ENTITY_CONFIG = {
        tags: {
            icon: '🏷️', title: 'Tag', pluralTitle: 'Tags', labelKey: 'name', searchFields: ['name', 'id'],
            columns: [{ ...commonIdColumn }, { title: 'Name', field: 'name', resizable: false, headerSort: false }],
            fetchQuery: 'query { findTags(filter: { per_page: -1 }) { tags { id name sort_name scene_count created_at updated_at } } }',
            extractList: data => data?.findTags?.tags || [],
            fetchExistingQuery: 'query ($id: ID!) { findScene(id: $id) { id title organized files { path } tags { id } } }',
            extractExisting: data => data?.findScene?.tags?.map(tag => tag.id) || [],
            createQuery: 'mutation ($name: String!) { tagCreate(input: { name: $name }) { id name } }',
            createExtract: data => data?.tagCreate?.id,
            createVariables: value => ({ name: value }),
            updateQuery: `mutation ($scene_id: ID!, $tag_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, tag_ids: $tag_ids }) { ${SCENE_CARD_UPDATE_FIELDS} } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), tag_ids: ids.map(String) })
        },
        performers: {
            icon: '⭐', title: 'Performer', pluralTitle: 'Performers', labelKey: 'name', searchFields: ['name', 'disambiguation', 'id'],
            columns: [{ ...commonIdColumn }, { title: 'Name', field: 'name', widthGrow: 2, resizable: true, headerSort: false }, { title: 'Details', field: 'disambiguation', widthGrow: 1, resizable: false, headerSort: false }],
            fetchQuery: 'query { findPerformers(filter: { per_page: -1 }) { performers { id name disambiguation scene_count birthdate rating100 created_at updated_at image_path country gender alias_list } } }',
            extractList: data => data?.findPerformers?.performers || [],
            fetchExistingQuery: 'query ($id: ID!) { findScene(id: $id) { id title organized files { path } performers { id } } }',
            extractExisting: data => data?.findScene?.performers?.map(performer => performer.id) || [],
            createQuery: 'mutation ($name: String!) { performerCreate(input: { name: $name }) { id name } }',
            createExtract: data => data?.performerCreate?.id,
            createVariables: value => ({ name: value }),
            updateQuery: `mutation ($scene_id: ID!, $performer_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, performer_ids: $performer_ids }) { ${SCENE_CARD_UPDATE_FIELDS} } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), performer_ids: ids.map(String) })
        },
        galleries: {
            icon: '🖼️', title: 'Gallery', pluralTitle: 'Galleries', labelKey: 'title', searchFields: ['title', 'id'],
            columns: [{ ...commonIdColumn }, { title: 'Title', field: 'title', resizable: false, headerSort: false }],
            fetchQuery: 'query { findGalleries(filter: { per_page: -1 }) { galleries { id title folder { path } files { path } created_at updated_at } } }',
            extractList: data => (data?.findGalleries?.galleries || []).map(gallery => {
                let displayTitle = gallery.title?.trim() || '';
                if (!displayTitle) {
                    const folderPath = gallery.folder?.path || gallery.files?.[0]?.path || '';
                    if (folderPath) {
                        const parts = folderPath.replace(/\\/g, '/').split('/').filter(Boolean);
                        displayTitle = parts.length > 0 ? parts[parts.length - 1] : `Gallery #${gallery.id}`;
                    } else displayTitle = `Gallery #${gallery.id}`;
                }
                return { id: gallery.id, title: displayTitle, rawTitle: gallery.title || '', created_at: gallery.created_at || '', updated_at: gallery.updated_at || '' };
            }),
            fetchExistingQuery: 'query ($id: ID!) { findScene(id: $id) { id title organized files { path } galleries { id } } }',
            extractExisting: data => data?.findScene?.galleries?.map(gallery => gallery.id) || [],
            createQuery: 'mutation ($title: String!) { galleryCreate(input: { title: $title }) { id title } }',
            createExtract: data => data?.galleryCreate?.id,
            createVariables: value => ({ title: value }),
            updateQuery: `mutation ($scene_id: ID!, $gallery_ids: [ID!]!) { sceneUpdate(input: { id: $scene_id, gallery_ids: $gallery_ids }) { ${SCENE_CARD_UPDATE_FIELDS} } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), gallery_ids: ids.map(String) })
        },
        studios: {
            icon: '🏢', title: 'Studio', pluralTitle: 'Studios', labelKey: 'name', searchFields: ['name', 'parent_name', 'id'], isSingleSelect: true,
            columns: [{ ...commonIdColumn }, { title: 'Name', field: 'name', widthGrow: 2, resizable: true, headerSort: false }, { title: 'Parent Studio', field: 'parent_name', widthGrow: 1, resizable: false, headerSort: false }],
            fetchQuery: 'query { findStudios(filter: { per_page: -1 }) { studios { id name parent_studio { id name } scene_count image_path created_at updated_at } } }',
            extractList: data => (data?.findStudios?.studios || []).map(studio => ({ id: studio.id, name: studio.name, parent_name: studio.parent_studio ? studio.parent_studio.name : '', scene_count: studio.scene_count || 0, created_at: studio.created_at || '', updated_at: studio.updated_at || '' })),
            fetchExistingQuery: 'query ($id: ID!) { findScene(id: $id) { id title organized files { path } studio { id name } } }',
            extractExisting: data => data?.findScene?.studio?.id ? [data.findScene.studio.id] : [],
            createQuery: 'mutation ($name: String!) { studioCreate(input: { name: $name }) { id name } }',
            createExtract: data => data?.studioCreate?.id,
            createVariables: value => ({ name: value }),
            updateQuery: `mutation ($scene_id: ID!, $studio_id: ID) { sceneUpdate(input: { id: $scene_id, studio_id: $studio_id }) { ${SCENE_CARD_UPDATE_FIELDS} } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), studio_id: ids.length > 0 ? String(ids[0]) : null })
        },
        groups: {
            icon: '🎬', title: 'Group', pluralTitle: 'Groups', labelKey: 'name', searchFields: ['name', 'id'],
            columns: [{ ...commonIdColumn }, { title: 'Name', field: 'name', resizable: false, headerSort: false }],
            fetchQuery: 'query { findGroups(filter: { per_page: -1 }) { groups { id name scene_count created_at updated_at } } }',
            extractList: data => data?.findGroups?.groups || [],
            fetchExistingQuery: 'query ($id: ID!) { findScene(id: $id) { id title organized files { path } groups { group { id name } scene_index } } }',
            extractExisting: data => (data?.findScene?.groups || []).map(group => group.group?.id).filter(Boolean),
            createQuery: 'mutation ($name: String!) { groupCreate(input: { name: $name }) { id name } }',
            createExtract: data => data?.groupCreate?.id,
            createVariables: value => ({ name: value }),
            updateQuery: `mutation ($scene_id: ID!, $groups: [SceneGroupInput!]) { sceneUpdate(input: { id: $scene_id, groups: $groups }) { ${SCENE_CARD_UPDATE_FIELDS} } }`,
            updateVariables: (sceneId, ids) => ({ scene_id: String(sceneId), groups: ids.map(id => ({ group_id: String(id) })) })
        }
    };

    root.FastTag = root.FastTag || {};
    root.FastTag.entities = Object.freeze({ SCENE_CARD_UPDATE_FIELDS, ENTITY_CONFIG: Object.freeze(ENTITY_CONFIG) });
}(typeof window !== 'undefined' ? window : globalThis));
