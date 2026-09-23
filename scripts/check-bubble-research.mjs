import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(path.join(root, 'src', 'js', 'research.js'), 'utf8');
const context = { window: {}, console, URL, setTimeout, clearTimeout, Date };
vm.createContext(context);
vm.runInContext(source, context);
const research = context.window.BubbleResearch;

const bubble = { id: 'bubble', name: '生成AI教育', desc: '学校教育における生成AIの効果' };
const group = { id: 'group', title: '教育技術' };
const plan = research.createQueryPlan(bubble, group, '生成AIを学校教育で活用すべき');
assert.deepEqual(Array.from(plan.intents, intent => intent.label), ['SUPPORT', 'CONTRADICT', 'PRIMARY', 'CONTEXT']);
assert.equal(new Set(Array.from(plan.intents, intent => intent.query)).size, 4, 'fan-out queries must be distinct');

function payload(url, title = 'source') {
    return { output: [{ type: 'web_search_call', action: { sources: [{ url, title }] } }] };
}

function imagePayload(index = 1, options = {}) {
    return {
        output: [{
            type: 'web_search_call', results: [
                {
                    type: 'image_result', image_url: `https://images.example/image-${index}.jpg`,
                    thumbnail_url: `https://images.example/thumb-${index}.jpg`, source_website_url: `https://publisher.example/page-${index}`,
                    caption: options.caption || `関連画像 ${index}`
                },
                ...(options.invalid ? [{ type: 'image_result', image_url: 'http://unsafe.example/image.jpg', source_website_url: '' }] : [])
            ]
        }]
    };
}

function candidate(url, title, options = {}) {
    return {
        sourceUrl: url, sourceTitle: title, publisher: options.publisher || title,
        publishedAt: options.publishedAt === undefined ? '2026-01-10' : options.publishedAt,
        sourceType: options.sourceType || 'NEWS', isPrimary: options.isPrimary === true,
        relevantExcerpt: options.excerpt || `${title}の関連する検証可能な記述です。`,
        claimCandidates: options.claims || [`${title}に関する主張`],
        originalSourceUrl: options.originalSourceUrl || null,
        parentSourceUrl: options.parentSourceUrl || null,
        citedSourceUrls: options.citedSourceUrls || []
    };
}

const supportUrl = 'https://government.example/report?utm_source=test';
const primaryUrl = 'https://government.example/report';
const contradictUrl = 'https://university.example/study';
const contextUrl = 'https://news.example/context';
const responses = [
    { intent: plan.intents[0], parsed: { results: [candidate(supportUrl, '政府調査', { sourceType: 'GOVERNMENT', isPrimary: true, claims: ['利用者は30%増加した'] }), candidate('https://invented.example/fake', '未参照') ] }, payload: payload(supportUrl) },
    { intent: plan.intents[1], parsed: { results: [candidate(contradictUrl, '大学研究', { sourceType: 'ACADEMIC', isPrimary: true, claims: ['統計的な有意差は確認されなかった'] })] }, payload: payload(contradictUrl) },
    { intent: plan.intents[2], parsed: { results: [candidate(primaryUrl, '政府調査', { sourceType: 'GOVERNMENT', isPrimary: true, claims: ['利用者は30%増加した'] })] }, payload: payload(primaryUrl) },
    { intent: plan.intents[3], parsed: { results: [candidate(contextUrl, '背景解説', { claims: ['調査は2025年に実施された'] })] }, payload: payload(contextUrl) }
];
const normalized = research.normalizeSearchResponses(plan, responses);
assert.equal(normalized.sources.length, 3, 'canonical URL duplicates must merge');
assert.ok(normalized.excluded.some(item => item.reason === 'not_in_web_search_sources'), 'unconsulted model URLs must be rejected');
const imageRequest = research.buildImageSearchRequest(plan, 'test');
assert.deepEqual(Array.from(imageRequest.tools[0].search_content_types), ['image', 'text']);
assert.equal(imageRequest.tools[0].image_settings.max_results, 8);
assert.deepEqual(Array.from(imageRequest.include), ['web_search_call.results']);
const normalizedImages = research.imageResultsFromPayload(imagePayload(1, { invalid: true }));
assert.equal(normalizedImages.length, 1, 'only HTTPS images with an attribution page should be accepted');
assert.equal(normalizedImages[0].sourceWebsiteUrl, 'https://publisher.example/page-1');
const government = normalized.sources.find(item => item.domain === 'government.example');
assert.deepEqual(Array.from(government.queryIntents).sort(), ['primary', 'support']);

const university = normalized.sources.find(item => item.domain === 'university.example');
const news = normalized.sources.find(item => item.domain === 'news.example');
const mirroredPlan = research.createQueryPlan({ name: '同一記事' }, { title: '重複検査' }, '');
const mirroredResponses = mirroredPlan.intents.slice(0, 2).map((intent, index) => {
    const url = `https://mirror${index + 1}.example/article`;
    return { intent, parsed: { results: [candidate(url, '同一見出し', { excerpt: '完全に同一の本文抜粋です。', claims: ['同一Claim'] })] }, payload: payload(url) };
});
const mirrored = research.normalizeSearchResponses(mirroredPlan, mirroredResponses);
assert.equal(mirrored.sources.length, 1, 'identical content on different URLs must deduplicate');
assert.ok(mirrored.excluded.some(item => item.reason === 'duplicate_content'));

const verificationRaw = {
    claims: [
        {
            claimKey: 'usage_change', text: '生成AIの導入後に利用者が増加した。',
            assessments: [
                { sourceId: government.sourceId, stance: 'supporting', evidenceText: '利用者は30%増加した' },
                { sourceId: university.sourceId, stance: 'contradicting', evidenceText: '有意差は確認されなかった' },
                { sourceId: news.sourceId, stance: 'uncertain', evidenceText: '調査背景のみを説明している' }
            ]
        },
        {
            claimKey: 'survey_date', text: '調査は2025年に実施された。',
            assessments: [{ sourceId: news.sourceId, stance: 'supporting', evidenceText: '2025年に実施' }]
        }
    ],
    contradictions: [{ claimKey: 'usage_change', supportingSourceIds: [government.sourceId], contradictingSourceIds: [university.sourceId], summary: '利用者増加の有無について結果が分かれている。' }]
};
const verified = research.normalizeVerification(verificationRaw, normalized.sources, 0);
assert.equal(verified.claims.length, 2, 'multiple atomic claims should survive normalization');
assert.equal(verified.claims[0].verification.status, 'mixed');
assert.equal(verified.contradictions[0].contradiction, true);
assert.notEqual(verified.claims[0].verification.confidence, verified.claims[1].verification.confidence, 'confidence must be evidence-derived, not fixed');
assert.ok(verified.claims[0].verification.supportingSources > 0 && verified.claims[0].verification.contradictingSources > 0);

const dependencyPlan = research.createQueryPlan({ name: '転載関係' }, { title: '情報流通' }, '');
const origin = 'https://original.example/study';
const dependencyResponses = dependencyPlan.intents.slice(0, 2).map((intent, index) => {
    const url = `https://news${index + 1}.example/article`;
    return { intent, parsed: { results: [candidate(url, `転載${index + 1}`, { originalSourceUrl: origin, claims: ['同じ原調査を引用している'] })] }, payload: payload(url) };
});
const dependencies = research.normalizeSearchResponses(dependencyPlan, dependencyResponses);
assert.equal(new Set(Array.from(dependencies.sources, item => item.independenceGroup)).size, 1, 'sources sharing an original source must not count as independent');
const composition = research.sourceComposition(normalized.sources);
assert.equal(Number(composition.reduce((sum, segment) => sum + segment.value, 0).toFixed(1)), 100, 'source composition must total 100 percent');
assert.equal(composition.reduce((sum, segment) => sum + segment.count, 0), new Set(Array.from(normalized.sources, source => source.independenceGroup)).size, 'source composition should count independent groups');

const ANALYSIS_SCHEMA = {
    type: 'object', additionalProperties: false,
    required: ['overview', 'history', 'demographic', 'evaluation'],
    properties: {
        overview: { type: 'object' }, history: { type: 'object' }, demographic: { type: 'object' }, evaluation: { type: 'object' }
    }
};

function sourceIdsFromPrompt(body) {
    return Array.from(new Set(Array.from(body.input[1].content[0].text.matchAll(/"sourceId":"([^"]+)"/g), match => match[1])));
}

async function runIntegration({ failIntent = null, failSynthesis = false, failImage = false, empty = false } = {}) {
    research.clearCache();
    const calls = [];
    let searchIndex = 0;
    const requestResponse = async (body, _timeout, stage) => {
        calls.push({ body, stage });
        if (body.text.format.name === 'bubble_image_search') {
            if (failImage) { const error = new Error('image search failed'); error.status = 503; throw error; }
            return { parsed: { completed: true }, payload: imagePayload(1) };
        }
        if (body.text.format.name === 'bubble_evidence_search') {
            searchIndex += 1;
            if (stage === `bubble-search-${failIntent}`) { const error = new Error('temporary'); error.status = 503; throw error; }
            if (empty) return { parsed: { results: [] }, payload: payload(`https://empty${searchIndex}.example/no-result`) };
            const url = `https://source${searchIndex}.example/evidence`;
            return { parsed: { results: [candidate(url, `Evidence ${searchIndex}`, { sourceType: searchIndex === 3 ? 'PRIMARY' : 'ACADEMIC', isPrimary: searchIndex === 3, claims: [`Claim ${searchIndex}`] })] }, payload: payload(url) };
        }
        const ids = sourceIdsFromPrompt(body);
        if (body.text.format.name === 'bubble_claim_verification') {
            return { parsed: { claims: [{ claimKey: 'shared', text: '検証対象のClaim', assessments: ids.map((id, index) => ({ sourceId: id, stance: index === 1 ? 'contradicting' : 'supporting', evidenceText: `evidence ${index}` })) }], contradictions: [] }, payload: {} };
        }
        assert.equal(Object.hasOwn(body, 'tools'), false, 'synthesis must not receive web search tools');
        if (failSynthesis) { const error = new Error('synthesis failed'); error.status = 400; throw error; }
        const imageIds = Array.from(new Set(Array.from(body.input[1].content[0].text.matchAll(/"imageId":"([^"]+)"/g), match => match[1])));
        const analysis = {
            overview: { summary: 'overview', sourceIds: ids.slice(0, 2), imageIds: imageIds.slice(0, 1) },
            history: {
                summary: 'history', sourceIds: ids.slice(0, 3),
                events: [
                    { dateLabel: '2025年', sortKey: 20250000, title: '後の出来事', description: '後', sourceIds: ids.slice(0, 1), imageIds: imageIds.slice(0, 1) },
                    { dateLabel: '2020年', sortKey: 20200000, title: '先の出来事', description: '先', sourceIds: ids.slice(1, 2), imageIds: [] },
                    { dateLabel: '不明', sortKey: 0, title: '無効参照', description: '除外', sourceIds: ['invented-source'], imageIds: ['invented-image'] }
                ]
            },
            demographic: { summary: 'demographic', sourceIds: ids.slice(0, 4), imageIds: imageIds.slice(0, 1) },
            evaluation: {
                opposition: {
                    summary: 'opposition',
                    comments: [
                        { text: '反対論点', sourceIds: ids.slice(1, 2) },
                        { text: '無効参照', sourceIds: ['invented-source'] }
                    ],
                    sourceIds: ids.slice(1, 2), imageIds: imageIds.slice(0, 1)
                },
                support: { summary: 'support', comments: [{ text: '賛成論点', sourceIds: ids.slice(0, 1) }], sourceIds: ids.slice(0, 1), imageIds: [] }
            }
        };
        return { parsed: { analysis, sourceIds: ids.slice(0, 4) }, payload: {} };
    };
    const result = await research.runBubbleResearch({ bubble: { ...bubble, id: `run-${failIntent || failSynthesis || empty || 'ok'}` }, group, input: 'integration', model: 'test', analysisSchema: ANALYSIS_SCHEMA, requestResponse });
    return { result, calls };
}

const integrated = await runIntegration();
assert.equal(integrated.calls.filter(call => call.body.text.format.name === 'bubble_evidence_search').length, 4);
assert.equal(integrated.calls.filter(call => call.body.text.format.name === 'bubble_image_search').length, 1);
assert.equal(integrated.calls.length, 7, 'pipeline should use four evidence searches, one image search, one verification and one synthesis');
assert.equal(integrated.result.detailResearch.queries.length, 4);
assert.ok(integrated.result.detailResearch.claims.length > 0);
assert.equal(integrated.result.detailResearch.images.length, 1);
assert.deepEqual(Array.from(integrated.result.analysis.history.events, event => event.sortKey), [20200000, 20250000], 'timeline should be chronological and omit invalid refs');
assert.equal(Number(integrated.result.analysis.demographic.segments.reduce((sum, segment) => sum + segment.value, 0).toFixed(1)), 100);
assert.equal(integrated.result.analysis.evaluation.opposition.comments.length, 1, 'comments without valid Evidence refs should be removed');
assert.equal(integrated.result.analysis.evaluation.support.comments[0].text, '賛成論点');

const partialSearch = await runIntegration({ failIntent: 'contradict' });
assert.equal(partialSearch.result.status, 'partial', 'one failed search intent should preserve partial results');
assert.ok(partialSearch.result.detailResearch.limitations.some(item => item.includes('検索意図')));

const partialSynthesis = await runIntegration({ failSynthesis: true });
assert.equal(partialSynthesis.result.status, 'partial');
assert.equal(partialSynthesis.result.analysis, null);
assert.ok(partialSynthesis.result.sources.length > 0, 'Evidence should survive synthesis failure');

const noImages = await runIntegration({ failImage: true });
assert.equal(noImages.result.status, 'complete', 'optional image search failure should not downgrade verified text analysis');
assert.equal(noImages.result.detailResearch.images.length, 0);
assert.ok(noImages.result.detailResearch.limitations.some(item => item.includes('画像検索')));

await assert.rejects(() => runIntegration({ empty: true }), error => error.code === 'RESEARCH_NO_EVIDENCE');

console.log('Bubble research pipeline checks: OK');
