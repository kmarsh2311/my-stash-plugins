'use strict';

const assert = require('node:assert/strict');

global.FastTag = {};
require('../plugins/fasttag/fasttag-entities.js');
const { ENTITY_CONFIG: entities, SCENE_CARD_UPDATE_FIELDS: fields } = global.FastTag.entities;

assert.deepEqual(Object.keys(entities), ['tags', 'performers', 'galleries', 'studios', 'groups']);
assert.ok(fields.includes('performers { id name disambiguation gender image_path }'));
for (const config of Object.values(entities)) {
    assert.ok(config.updateQuery.includes(fields));
    assert.equal(config.columns[0].field, 'id');
}
assert.notStrictEqual(entities.tags.columns[0], entities.performers.columns[0]);
assert.equal(entities.studios.isSingleSelect, true);

assert.deepEqual(entities.tags.updateVariables(7, [1, '2']), { scene_id: '7', tag_ids: ['1', '2'] });
assert.deepEqual(entities.performers.updateVariables(7, [1]), { scene_id: '7', performer_ids: ['1'] });
assert.deepEqual(entities.galleries.updateVariables(7, [1]), { scene_id: '7', gallery_ids: ['1'] });
assert.deepEqual(entities.studios.updateVariables(7, []), { scene_id: '7', studio_id: null });
assert.deepEqual(entities.studios.updateVariables(7, [3]), { scene_id: '7', studio_id: '3' });
assert.deepEqual(entities.groups.updateVariables(7, [4]), { scene_id: '7', groups: [{ group_id: '4' }] });

assert.deepEqual(entities.tags.extractExisting({ findScene: { tags: [{ id: '1' }] } }), ['1']);
assert.deepEqual(entities.groups.extractExisting({ findScene: { groups: [{ group: { id: '2' } }, { group: null }] } }), ['2']);
assert.deepEqual(entities.studios.extractExisting({ findScene: { studio: { id: '3' } } }), ['3']);

const galleries = entities.galleries.extractList({ findGalleries: { galleries: [
    { id: '1', title: ' Named ', created_at: 'a', updated_at: 'b' },
    { id: '2', title: '', folder: { path: 'C:\\Media\\Folder Name' } },
    { id: '3', title: '', files: [], created_at: null }
] } });
assert.deepEqual(galleries, [
    { id: '1', title: 'Named', rawTitle: ' Named ', created_at: 'a', updated_at: 'b' },
    { id: '2', title: 'Folder Name', rawTitle: '', created_at: '', updated_at: '' },
    { id: '3', title: 'Gallery #3', rawTitle: '', created_at: '', updated_at: '' }
]);

assert.deepEqual(entities.studios.extractList({ findStudios: { studios: [
    { id: '4', name: 'Child', parent_studio: { name: 'Parent' }, scene_count: 0 }
] } }), [{ id: '4', name: 'Child', parent_name: 'Parent', scene_count: 0, created_at: '', updated_at: '' }]);

console.log('fasttag-entities tests passed');
