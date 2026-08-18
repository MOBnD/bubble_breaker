import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dataSource, apiSource] = await Promise.all([
    readFile(path.join(root, 'src', 'js', 'data.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'api.js'), 'utf8')
]);

class Color {
    constructor(value = 0x4488ff) { this.value = Number(value) || 0x4488ff; }
    getHSL(target) { target.h = 0.2; target.s = 0.8; target.l = 0.6; }
    setHSL() {}
    getHex() { return this.value; }
}

const context = {
    window: { __OPENAI_API_KEY__: '', __OPENAI_MODEL__: 'test' },
    localStorage: { getItem() { return null; } },
    console,
    URL,
    THREE: { Color },
    performance,
    setTimeout,
    clearTimeout,
    AbortController,
    fetch
};
vm.createContext(context);
vm.runInContext(`${dataSource}\n${apiSource}\nglobalThis.__bubbleBreakerTest = { normalizeGeneratedUniverse, normalizeFallbackUniverse, buildOpenAIRootRequest, buildOpenAICentralGroupRequest, buildOpenAILeafGroupRequest, buildOpenAIBubbleAnalysisRequest, requestBubbleAnalysis, requestBubbleGroupAnalyses };`, context);

const bubble = (id, childId = null) => ({
    id, name: id, size: 1, color: 0x4488ff, htmlColor: '#4488ff',
    pos: [0, 0, 0], childId, desc: id, isEstimated: true,
    confidence: 1, analysis: {}, sources: []
});

const groups = [
    { id: 'root', title: 'root', type: '分散型', level: 'root', parentId: null, parentBubbleId: null, desc: '', bubbles: [bubble('r1', 'central1'), bubble('r2', 'central2')] },
    { id: 'central1', title: 'central1', type: '分散型', level: 'central', parentId: 'root', parentBubbleId: 'r1', desc: '', bubbles: [bubble('entry', 'leaf1'), bubble('c1b', 'leaf2')] },
    { id: 'central2', title: 'central2', type: '分散型', level: 'central', parentId: 'root', parentBubbleId: 'r2', desc: '', bubbles: [bubble('c2b1', 'leaf3'), bubble('c2b2', 'leaf4')] },
    ...['leaf1', 'leaf2', 'leaf3', 'leaf4'].map(id => ({
        id, title: id, type: '分散型', level: 'leaf', parentId: id === 'leaf1' || id === 'leaf2' ? 'central1' : 'central2',
        parentBubbleId: id === 'leaf1' ? 'entry' : id === 'leaf2' ? 'c1b' : id === 'leaf3' ? 'c2b1' : 'c2b2',
        desc: '', bubbles: [bubble(`${id}_option_a`), bubble(`${id}_option_b`)]
    }))
];

const normalize = context.__bubbleBreakerTest.normalizeGeneratedUniverse;
const rootRequest = context.__bubbleBreakerTest.buildOpenAIRootRequest('テスト意見');
assert.equal(rootRequest.reasoning.effort, 'low', 'root generation should use low reasoning effort');
assert.equal(rootRequest.tools[0].search_context_size, 'medium', 'root generation should keep medium web search context');
assert.equal(rootRequest.text.format.name, 'bubble_universe_root', 'root schema should be used');
assert.equal(rootRequest.text.format.schema.properties.groups.maxItems, 1, 'root stage should return one group');
const rootContext = { id: 'root', title: '最上位', bubbles: [bubble('r1'), bubble('r2')] };
const centralRequest = context.__bubbleBreakerTest.buildOpenAICentralGroupRequest('テスト意見', rootContext, rootContext.bubbles[0]);
assert.equal(centralRequest.text.format.name, 'bubble_universe_central_group', 'central schema should be used');
assert.match(centralRequest.input[1].content[0].text, /r1/);
const leafRequest = context.__bubbleBreakerTest.buildOpenAILeafGroupRequest('テスト意見', { id: 'central_test', title: '中央カテゴリ' }, bubble('parent_a'));
assert.equal(leafRequest.text.format.name, 'bubble_universe_leaf_group', 'leaf schema should be used');
assert.match(leafRequest.input[1].content[0].text, /parent_a/);
const analysisRequest = context.__bubbleBreakerTest.buildOpenAIBubbleAnalysisRequest(bubble('analysis_target'), { title: 'テストカテゴリ' }, 'テスト意見');
assert.equal(analysisRequest.reasoning.effort, 'low', 'analysis generation should use low reasoning effort');
assert.equal(analysisRequest.tools[0].search_context_size, 'medium', 'analysis generation should keep medium web search context');
assert.equal(analysisRequest.text.format.name, 'bubble_analysis', 'analysis schema should be used');

let analysisFetchCount = 0;
const analysisContext = {
    ...context,
    window: { __OPENAI_API_KEY__: 'test-key', __OPENAI_MODEL__: 'test' },
    fetch: async () => {
        analysisFetchCount += 1;
        return {
            ok: true,
            status: 200,
            headers: { get() { return 'analysis-request'; } },
            async json() { return { output_text: JSON.stringify({ analysis: {}, sources: [] }) }; }
        };
    }
};
vm.createContext(analysisContext);
vm.runInContext(`${dataSource}\n${apiSource}\nglobalThis.__bubbleBreakerTest = { requestBubbleAnalysis, requestBubbleGroupAnalyses };`, analysisContext);
const analysisBubble = bubble('lazy_analysis_target');
const analysisGroup = { id: 'analysis_group', title: '分析カテゴリ' };
await Promise.all([
    analysisContext.__bubbleBreakerTest.requestBubbleAnalysis(analysisBubble, analysisGroup, 'テスト意見'),
    analysisContext.__bubbleBreakerTest.requestBubbleAnalysis(analysisBubble, analysisGroup, 'テスト意見')
]);
assert.equal(analysisFetchCount, 1, 'the same bubble should not trigger duplicate analysis requests');
assert.equal(analysisBubble.analysisStatus, 'ready', 'lazy analysis should update the bubble status');
const groupAnalysisBubbles = [bubble('group_analysis_a'), bubble('group_analysis_b'), bubble('group_analysis_c')];
await analysisContext.__bubbleBreakerTest.requestBubbleGroupAnalyses({ id: 'group_analysis', title: '分析対象群', bubbles: groupAnalysisBubbles }, 'テスト意見');
assert.equal(analysisFetchCount, 4, 'entering a bubble group should start analysis for every bubble');
assert.ok(groupAnalysisBubbles.every(item => item.analysisStatus === 'ready'), 'all group bubble analyses should complete');
const valid = normalize({ groups, entryGroupId: 'central1', entryBubbleId: 'entry' });
assert.equal(Object.keys(valid.db).length, 7, 'valid three-level hierarchy should be accepted');
const topologyGroups = structuredClone(groups).filter(group => group.level !== 'leaf');
topologyGroups.filter(group => group.level === 'central').forEach(group => group.bubbles.forEach(bubble => { bubble.childId = null; }));
let hierarchyFetchCount = 0;
const stageLog = [];
const leafAttempts = new Map();
const rootResponse = structuredClone(groups.filter(group => group.level === 'root'));
rootResponse[0].bubbles.forEach(item => { item.childId = null; });
const centralResponseByRootBubble = new Map(structuredClone(groups).filter(group => group.level === 'central').map(group => [group.parentBubbleId, group]));
centralResponseByRootBubble.forEach(group => group.bubbles.forEach(item => { item.childId = null; }));
const leafResponseByCentralBubble = new Map(structuredClone(groups).filter(group => group.level === 'leaf').map(group => [group.parentBubbleId, group]));
const hierarchyContext = {
    ...context,
    window: { __OPENAI_API_KEY__: 'test-key', __OPENAI_MODEL__: 'test' },
    fetch: async (_url, options) => {
        hierarchyFetchCount += 1;
        const request = JSON.parse(options.body);
        const stage = request.text.format.name;
        stageLog.push(stage);
        if (stage === 'bubble_universe_root') {
            return { ok: true, status: 200, headers: { get() { return 'topology-request'; } }, async json() {
                return { output_text: JSON.stringify({ groups: rootResponse }) };
            } };
        }
        const prompt = request.input[1].content[0].text;
        if (stage === 'bubble_universe_central_group') {
            const rootBubbleId = prompt.includes('（r1）') ? 'r1' : 'r2';
            const group = structuredClone(centralResponseByRootBubble.get(rootBubbleId));
            return { ok: true, status: 200, headers: { get() { return `central-${rootBubbleId}`; } }, async json() {
                return { output_text: JSON.stringify({ entryBubbleId: group.id === 'central1' ? 'entry' : null, groups: [group] }) };
            } };
        }
        const centralBubbleId = ['entry', 'c1b', 'c2b1', 'c2b2'].find(id => prompt.includes(`（${id}）`));
        const attempt = (leafAttempts.get(centralBubbleId) || 0) + 1;
        leafAttempts.set(centralBubbleId, attempt);
        const group = structuredClone(leafResponseByCentralBubble.get(centralBubbleId));
        if (centralBubbleId === 'entry' && attempt === 1) group.parentBubbleId = 'missing-parent';
        return { ok: true, status: 200, headers: { get() { return `leaf-${centralBubbleId}`; } }, async json() {
            return { output_text: JSON.stringify({ groups: [group] }) };
        } };
    }
};
vm.createContext(hierarchyContext);
vm.runInContext(`${dataSource}\n${apiSource}\nglobalThis.__bubbleBreakerTest = { requestDynamicUniverse };`, hierarchyContext);
const generatedUniverse = await hierarchyContext.__bubbleBreakerTest.requestDynamicUniverse('テスト意見');
assert.equal(hierarchyFetchCount, 8, 'a missing leaf should trigger a retry only for the affected leaf request');
assert.equal(Object.keys(generatedUniverse.db).length, 7, 'staged hierarchy generation should produce all leaf groups');
assert.deepEqual(stageLog.slice(0, 1), ['bubble_universe_root'], 'root must be generated first');
assert.ok(stageLog.slice(1, 3).every(stage => stage === 'bubble_universe_central_group'), 'central groups must follow root');
assert.ok(stageLog.slice(3).every(stage => stage === 'bubble_universe_leaf_group'), 'leaf groups must follow central groups');
assert.equal(leafAttempts.get('entry'), 2, 'only the invalid leaf branch should be retried');
const topology = normalize({ groups: topologyGroups, entryGroupId: 'central1', entryBubbleId: 'entry' }, { topologyOnly: true });
assert.equal(Object.keys(topology.db).length, 3, 'upper topology should be accepted before leaf generation');

const invalidDeclaredLinks = structuredClone(groups);
invalidDeclaredLinks.find(group => group.id === 'central2').parentId = 'unknown-parent';
invalidDeclaredLinks.find(group => group.id === 'central2').bubbles[1].childId = 'unknown-child';
const canonicalized = normalize({ groups: invalidDeclaredLinks, entryGroupId: 'central1', entryBubbleId: 'entry' });
assert.equal(canonicalized.db.central2.parentId, 'root', 'parentId should be canonicalized from parentBubbleId');
assert.equal(canonicalized.db.central2.bubbles[1].childId, 'leaf4', 'childId should be canonicalized from parentBubbleId');

const reciprocalParentLink = structuredClone(groups);
reciprocalParentLink.find(group => group.id === 'leaf4').parentBubbleId = null;
const reciprocalNormalized = normalize({ groups: reciprocalParentLink, entryGroupId: 'central1', entryBubbleId: 'entry' });
assert.equal(reciprocalNormalized.db.leaf4.parentBubbleId, 'c2b2', 'parentBubbleId should be recovered from parentId and childId');

const unresolvableParent = structuredClone(groups);
unresolvableParent.find(group => group.id === 'leaf4').parentBubbleId = null;
unresolvableParent.find(group => group.id === 'leaf4').parentId = null;
unresolvableParent.find(group => group.id === 'central2').bubbles[1].childId = null;
assert.throws(
    () => normalize({ groups: unresolvableParent, entryGroupId: 'central1', entryBubbleId: 'entry' }),
    /親カテゴリ|親バブル|解決/,
    'a child category without any reciprocal parent link must be rejected'
);

const duplicateChild = structuredClone(groups);
duplicateChild.find(group => group.id === 'leaf4').parentBubbleId = 'c2b1';
assert.throws(
    () => normalize({ groups: duplicateChild, entryGroupId: 'central1', entryBubbleId: 'entry' }),
    /複数|重複/,
    'shared child categories must be rejected'
);

const fallback = context.__bubbleBreakerTest.normalizeFallbackUniverse('きのこの山が好き');
assert.ok(fallback.db[fallback.entryGroupId], 'fixed fallback should remain available');

console.log('Universe hierarchy checks: OK');
