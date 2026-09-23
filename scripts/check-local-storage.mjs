import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [storageSource, indexHtml, eventsSource, sceneSource, apiSource] = await Promise.all([
    readFile(path.join(root, 'src', 'js', 'storage.js'), 'utf8'),
    readFile(path.join(root, 'src', 'index.html'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'events.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'scene.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'api.js'), 'utf8')
]);

function createFakeIndexedDB() {
    const records = new Map();
    let created = false;
    const database = {
        objectStoreNames: { contains() { return created; } },
        createObjectStore() {
            created = true;
            return { createIndex() {} };
        },
        transaction() {
            const transaction = {
                error: null,
                objectStore() {
                    return {
                        put(value) {
                            const request = { result: value.id };
                            records.set(value.id, structuredClone(value));
                            queueMicrotask(() => transaction.oncomplete?.());
                            return request;
                        },
                        getAll() {
                            const request = { result: [...records.values()].map(value => structuredClone(value)) };
                            queueMicrotask(() => transaction.oncomplete?.());
                            return request;
                        },
                        get(id) {
                            const request = { result: records.has(id) ? structuredClone(records.get(id)) : undefined };
                            queueMicrotask(() => transaction.oncomplete?.());
                            return request;
                        },
                        delete(id) {
                            const request = { result: undefined };
                            records.delete(id);
                            queueMicrotask(() => transaction.oncomplete?.());
                            return request;
                        }
                    };
                }
            };
            return transaction;
        }
    };
    return {
        open() {
            const request = { result: database, error: null };
            queueMicrotask(() => {
                if (!created) request.onupgradeneeded?.();
                request.onsuccess?.();
            });
            return request;
        }
    };
}

let generatedId = 0;
const context = {
    window: {
        indexedDB: createFakeIndexedDB(),
        crypto: { randomUUID() { generatedId += 1; return `generated-session-${generatedId}`; } }
    },
    console,
    structuredClone,
    setTimeout,
    clearTimeout,
    Date,
    Math,
    state: { groupId: null },
    activeDB: {},
    document: { getElementById() { return null; } },
    showToast() {}
};
vm.createContext(context);
vm.runInContext(storageSource, context);

const db = {
    root: {
        id: 'root', title: '最上位', parentId: null, bubbles: [
            { id: 'root-b1', name: '中央へ', childId: 'central', analysisStatus: 'ready', analysis: { overview: { summary: '概要', sourceIds: ['source-1'], imageIds: ['image-1'] } }, sources: [{ sourceId: 'source-1', url: 'https://example.com' }], detailResearch: { status: 'complete', claims: [{ text: '検証済み主張' }], images: [{ imageId: 'image-1', imageUrl: 'https://images.example/image.jpg', sourceWebsiteUrl: 'https://example.com/image-source' }] } }
        ]
    },
    central: {
        id: 'central', title: '中央', parentId: 'root', bubbles: [
            { id: 'central-b1', name: '詳細へ', childId: 'leaf', analysisStatus: 'loading', detailResearch: { status: 'loading', sources: [] } }
        ]
    },
    leaf: {
        id: 'leaf', title: '下位', parentId: 'central', bubbles: [
            { id: 'leaf-b1', name: '選択肢', childId: null }
        ]
    }
};

const baseRecord = {
    schemaVersion: 1,
    id: 'session-1',
    opinion: 'テスト意見',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    lastOpenedAt: '2026-01-02T00:00:00.000Z',
    entryGroupId: 'central',
    entryBubbleId: 'central-b1',
    lastGroupId: 'leaf',
    navigationPath: ['central', 'leaf'],
    db
};

const api = context.window.BubbleSessionStorage;
const normalized = api.normalizeRecord(baseRecord);
assert.equal(normalized.db.root.bubbles[0].detailResearch.claims[0].text, '検証済み主張', 'Bubble detail Evidence should remain in the snapshot');
assert.equal(normalized.db.root.bubbles[0].detailResearch.images[0].sourceWebsiteUrl, 'https://example.com/image-source', 'image attribution metadata should remain in the snapshot');
assert.deepEqual([...normalized.navigationPath], ['central', 'leaf'], 'logical group navigation should remain serializable');
assert.equal(api.summarizeRecord(normalized).detailCount, 2, 'completed and in-progress details should be counted');

const legacyWithEmptyBubble = structuredClone(baseRecord);
legacyWithEmptyBubble.db.leaf.bubbles.push({ id: '   ', name: '   ', size: 40, childId: null });
legacyWithEmptyBubble.db.leaf.bubbles[0].size = 60;
const cleanedLegacy = api.normalizeRecord(legacyWithEmptyBubble);
assert.equal(cleanedLegacy.db.leaf.bubbles.length, 1, 'legacy empty bubbles should be removed during normalization');
assert.equal(cleanedLegacy.db.leaf.bubbles[0].size, 100, 'remaining legacy bubble percentages should be normalized');

await api.saveRecord(baseRecord);
assert.equal((await api.listRecords()).length, 1, 'saved exploration should appear in history');
const restored = await api.loadRecord('session-1');
assert.equal(restored.db.central.bubbles[0].analysisStatus, 'idle', 'interrupted analysis should become retryable after restore');
assert.equal(restored.db.central.bubbles[0].detailResearch.status, 'partial', 'interrupted Evidence should not remain loading forever');
assert.equal(restored.db.root.bubbles[0].analysisStatus, 'ready', 'completed detail should remain completed');
assert.doesNotMatch(JSON.stringify(restored), /apiKey|authorization|sk-secret/i, 'session storage must not add API credentials');

await api.deleteRecord('session-1');
assert.equal((await api.listRecords()).length, 0, 'deleted exploration should disappear from history');
await assert.rejects(() => api.loadRecord('session-1'), /見つかりません/);
assert.throws(() => api.normalizeRecord({ ...baseRecord, schemaVersion: 99 }), /未対応/);
assert.throws(() => api.normalizeRecord({ ...baseRecord, entryGroupId: 'missing' }), /開始バブル群/);

const firstDatabase = structuredClone(db);
context.activeDB = firstDatabase;
context.state.groupId = 'central';
context.window.startLocalBubbleSession('最初の探索', { entryGroupId: 'central', entryBubbleId: 'central-b1' });
await api.persistCurrent();
const firstSessionId = (await api.listRecords())[0].id;
const secondDatabase = structuredClone(db);
context.activeDB = secondDatabase;
context.window.startLocalBubbleSession('次の探索', { entryGroupId: 'central', entryBubbleId: 'central-b1' });
await api.persistCurrent();
firstDatabase.root.bubbles[0].detailResearch.claims.push({ text: '切替後に完了した主張' });
context.window.scheduleBubbleDatabaseSessionSave(firstDatabase, 'background-analysis-complete');
await new Promise(resolve => setTimeout(resolve, 450));
const backgroundSaved = await api.loadRecord(firstSessionId);
assert.equal(backgroundSaved.db.root.bubbles[0].detailResearch.claims.at(-1).text, '切替後に完了した主張', 'late details should be saved to the exploration that started them');

assert.match(indexHtml, /id="saved-exploration-list"/, 'input screen should expose saved exploration history');
assert.match(indexHtml, /id="btn-open-input"/, 'group screen should navigate back to opinion input');
assert.ok(indexHtml.indexOf('src="./js/storage.js"') < indexHtml.indexOf('src="./js/scene.js"'), 'storage module should load before scene integration');
assert.match(eventsSource, /startLocalBubbleSession\(input, universe\)/, 'new universes should start an autosave session');
assert.match(sceneSource, /scheduleCurrentBubbleSessionSave\('group-navigation'\)/, 'group navigation should trigger autosave');
assert.match(sceneSource, /window\.restoreBubbleNavigationPath/, 'logical navigation should be restorable');
assert.match(apiSource, /scheduleBubbleDatabaseSessionSave\(analysisSessionDatabase, 'bubble-analysis-complete'\)/, 'completed Bubble details should save to their originating exploration');
assert.match(apiSource, /bubble\.analysisStatus === 'ready'.*bubble\.analysisStatus === 'partial'/s, 'restored completed details should be reused');
assert.doesNotMatch(storageSource, /localStorage|sessionStorage/, 'exploration payloads should use IndexedDB rather than small synchronous storage');

console.log('Local exploration storage checks: OK');
