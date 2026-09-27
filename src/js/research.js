        (function initializeBubbleResearch(global) {
            const INTENTS = [
                { id: 'support', label: 'SUPPORT', suffix: '効果 根拠 実証' },
                { id: 'contradict', label: 'CONTRADICT', suffix: '批判 反証 限界 問題' },
                { id: 'primary', label: 'PRIMARY', suffix: '公式 一次資料 統計 研究論文 原調査' },
                { id: 'context', label: 'CONTEXT', suffix: '定義 背景 統計 時系列' }
            ];
            const SOURCE_TYPES = ['PRIMARY', 'GOVERNMENT', 'ACADEMIC', 'COMPANY', 'NEWS', 'BLOG', 'SOCIAL', 'UNKNOWN'];
            const STANCES = ['supporting', 'contradicting', 'uncertain'];
            const CACHE_TTL_MS = 15 * 60 * 1000;
            const CACHE_MAX_ENTRIES = 50;
            const researchCache = new Map();

            const SEARCH_RESULT_SCHEMA = {
                type: 'object', additionalProperties: false, required: ['results'],
                properties: {
                    results: {
                        type: 'array', maxItems: 3, items: {
                            type: 'object', additionalProperties: false,
                            required: ['sourceUrl', 'sourceTitle', 'publisher', 'publishedAt', 'sourceType', 'isPrimary', 'relevantExcerpt', 'claimCandidates', 'originalSourceUrl', 'parentSourceUrl', 'citedSourceUrls'],
                            properties: {
                                sourceUrl: { type: 'string' }, sourceTitle: { type: 'string' }, publisher: { type: 'string' },
                                publishedAt: { type: ['string', 'null'] }, sourceType: { type: 'string', enum: SOURCE_TYPES },
                                isPrimary: { type: 'boolean' }, relevantExcerpt: { type: 'string' },
                                claimCandidates: { type: 'array', maxItems: 4, items: { type: 'string' } },
                                originalSourceUrl: { type: ['string', 'null'] }, parentSourceUrl: { type: ['string', 'null'] },
                                citedSourceUrls: { type: 'array', maxItems: 5, items: { type: 'string' } }
                            }
                        }
                    }
                }
            };

            const VERIFICATION_SCHEMA = {
                type: 'object', additionalProperties: false, required: ['claims', 'contradictions'],
                properties: {
                    claims: {
                        type: 'array', maxItems: 8, items: {
                            type: 'object', additionalProperties: false, required: ['claimKey', 'text', 'assessments'],
                            properties: {
                                claimKey: { type: 'string' }, text: { type: 'string' },
                                assessments: {
                                    type: 'array', maxItems: 8, items: {
                                        type: 'object', additionalProperties: false,
                                        required: ['sourceId', 'stance', 'evidenceText'],
                                        properties: {
                                            sourceId: { type: 'string' }, stance: { type: 'string', enum: STANCES }, evidenceText: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    contradictions: {
                        type: 'array', maxItems: 8, items: {
                            type: 'object', additionalProperties: false,
                            required: ['claimKey', 'supportingSourceIds', 'contradictingSourceIds', 'summary'],
                            properties: {
                                claimKey: { type: 'string' },
                                supportingSourceIds: { type: 'array', maxItems: 6, items: { type: 'string' } },
                                contradictingSourceIds: { type: 'array', maxItems: 6, items: { type: 'string' } },
                                summary: { type: 'string' }
                            }
                        }
                    }
                }
            };
            const IMAGE_SEARCH_SCHEMA = {
                type: 'object', additionalProperties: false, required: ['completed'],
                properties: { completed: { type: 'boolean' } }
            };

            function stableHash(value) {
                let hash = 2166136261;
                for (const character of String(value || '')) {
                    hash ^= character.charCodeAt(0);
                    hash = Math.imul(hash, 16777619);
                }
                return (hash >>> 0).toString(36);
            }

            function normalizeText(value) {
                return String(value || '').replace(/\s+/g, ' ').trim();
            }

            function canonicalizeUrl(value) {
                try {
                    const url = new URL(String(value || ''));
                    if (!/^https?:$/.test(url.protocol)) return '';
                    url.hash = '';
                    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'].forEach(key => url.searchParams.delete(key));
                    url.searchParams.sort();
                    url.hostname = url.hostname.toLowerCase();
                    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
                    return url.toString();
                } catch (_) { return ''; }
            }

            function sourceDomain(url) {
                try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch (_) { return ''; }
            }

            function safeHttpsUrl(value) {
                try {
                    const url = new URL(String(value || ''));
                    if (url.protocol !== 'https:') return '';
                    url.hash = '';
                    return url.toString();
                } catch (_) { return ''; }
            }

            function createQueryPlan(bubble, group, input) {
                const topic = normalizeText([bubble && bubble.name, group && group.title].filter(Boolean).join(' '));
                const context = normalizeText([input, bubble && bubble.desc].filter(Boolean).join(' / ')).slice(0, 360);
                return {
                    topic,
                    context,
                    intents: INTENTS.map(intent => ({ ...intent, query: `${topic} ${intent.suffix}`.trim() }))
                };
            }

            function buildSearchRequest(plan, intent, model) {
                const purpose = {
                    support: '対象について、根拠付きで支持・確認する資料を探してください。',
                    contradict: '対象への反証、批判、限界、異なる結果を優先して探してください。',
                    primary: '政府、研究論文、公式発表、原調査など原典へ到達してください。',
                    context: '定義、背景、統計、時系列を確認できる資料を探してください。'
                }[intent.id];
                return {
                    model, store: false, reasoning: { effort: 'low' }, max_output_tokens: 3500,
                    tool_choice: 'required',
                    tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' } }],
                    include: ['web_search_call.action.sources'],
                    input: [
                        { role: 'system', content: [{ type: 'input_text', text: 'あなたはBubbleBreakerのEvidence収集器です。Bubbleの説明を生成せず、実際に検索で確認した資料と検証可能な主張候補だけを構造化してください。URLや抜粋を推測しないでください。' }] },
                        { role: 'user', content: [{ type: 'input_text', text: `検索意図: ${intent.label}\n検索クエリ: ${intent.query}\n文脈: ${plan.context}\n${purpose}\n最大3資料。各資料から短い関連抜粋と、原子的に検証できるClaim候補を最大4件抽出してください。転載・引用関係が分かる場合だけoriginalSourceUrl、parentSourceUrl、citedSourceUrlsへ記録してください。` }] }
                    ],
                    text: { format: { type: 'json_schema', name: 'bubble_evidence_search', strict: true, schema: SEARCH_RESULT_SCHEMA } }
                };
            }

            const IMAGE_PANEL_SPECS = [
                { id: 'overview', label: '概要', focus: '主要概念を理解する助けとなる代表的な画像' },
                { id: 'history', label: '形成の歴史', focus: 'テーマの歴史・時系列に関連する画像や資料' },
                { id: 'demographic', label: '構成層・情報源', focus: '研究・統計・情報源の構成を示す図表や資料' },
                { id: 'evaluation', label: '内外からの意見', focus: 'テーマの賛否・議論・異なる立場に関連する画像' }
            ];

            function buildImageSearchRequest(plan, model, panel = IMAGE_PANEL_SPECS[0]) {
                return {
                    model, store: false, reasoning: { effort: 'low' }, max_output_tokens: 500,
                    tool_choice: 'required',
                    tools: [{
                        type: 'web_search', search_content_types: ['image', 'text'],
                        image_settings: { max_results: 3, caption: true },
                        user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' }
                    }],
                    include: ['web_search_call.results'],
                    input: [
                        { role: 'system', content: [{ type: 'input_text', text: 'あなたはBubbleBreakerの画像調査器です。画像を生成せず、必ずWeb Image Searchを実行してください。検索完了後はcompletedだけを返してください。' }] },
                        { role: 'user', content: [{ type: 'input_text', text: `対象: ${plan.topic}\n文脈: ${plan.context}\n表示先: ${panel.label}\n検索する画像の焦点: ${panel.focus}\n対象との関連性が高く、出典ページを確認できる画像を優先してください。検索語は対象と表示先の焦点を組み合わせてください。無関係な画像を選ばないでください。` }] }
                    ],
                    text: { format: { type: 'json_schema', name: 'bubble_image_search', strict: true, schema: IMAGE_SEARCH_SCHEMA } }
                };
            }

            function consultedSourcesFromPayload(payload) {
                const sources = [];
                (Array.isArray(payload && payload.output) ? payload.output : []).forEach(item => {
                    if (!item || item.type !== 'web_search_call' || !item.action || !Array.isArray(item.action.sources)) return;
                    item.action.sources.forEach(source => {
                        const url = canonicalizeUrl(source && source.url);
                        if (url) sources.push({ url, title: normalizeText(source.title) });
                    });
                });
                return sources;
            }

            function imageResultsFromPayload(payload, panelId) {
                const images = [];
                const seen = new Set();
                (Array.isArray(payload && payload.output) ? payload.output : []).forEach(item => {
                    if (!item || item.type !== 'web_search_call' || !Array.isArray(item.results)) return;
                    item.results.forEach(result => {
                        if (!result || result.type !== 'image_result') return;
                        const imageUrl = safeHttpsUrl(result.image_url);
                        const sourceWebsiteUrl = safeHttpsUrl(result.source_website_url);
                        if (!imageUrl || !sourceWebsiteUrl || seen.has(imageUrl)) return;
                        seen.add(imageUrl);
                        const thumbnailUrl = safeHttpsUrl(result.thumbnail_url);
                        images.push({
                            imageId: `img_${stableHash(`${imageUrl}|${sourceWebsiteUrl}`)}`,
                            imageUrl, thumbnailUrl: thumbnailUrl || null, sourceWebsiteUrl,
                            sourceDomain: sourceDomain(sourceWebsiteUrl), caption: normalizeText(result.caption).slice(0, 300),
                            panelIds: [panelId]
                        });
                    });
                });
                return images.slice(0, 3);
            }

            function mergePanelImageResults(results) {
                const byId = new Map();
                const seenImageUrls = new Set();
                results.forEach(image => {
                    // Keep one image in one panel so the four analysis cards never repeat a thumbnail.
                    if (byId.has(image.imageId) || seenImageUrls.has(image.imageUrl)) return;
                    seenImageUrls.add(image.imageUrl);
                    byId.set(image.imageId, { ...image, panelIds: [...image.panelIds] });
                });
                return [...byId.values()].slice(0, 12);
            }

            function selectBalancedSources(allSources, plan) {
                const selected = [];
                const seen = new Set();
                plan.intents.forEach(intent => {
                    const match = allSources.find(source => source.queryIntents.includes(intent.id) && !seen.has(source.sourceId));
                    if (match) { selected.push(match); seen.add(match.sourceId); }
                });
                allSources
                    .slice()
                    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || Number(Boolean(b.relevantExcerpt)) - Number(Boolean(a.relevantExcerpt)))
                    .forEach(source => {
                        if (selected.length < 8 && !seen.has(source.sourceId)) { selected.push(source); seen.add(source.sourceId); }
                    });
                return selected.slice(0, 8);
            }

            function assignIndependenceGroups(sources) {
                const parent = new Map(sources.map(source => [source.sourceId, source.sourceId]));
                const selectedUrls = new Set(sources.map(source => source.canonicalUrl));
                const find = id => {
                    let current = id;
                    while (parent.get(current) !== current) current = parent.get(current);
                    let cursor = id;
                    while (parent.get(cursor) !== current) { const next = parent.get(cursor); parent.set(cursor, current); cursor = next; }
                    return current;
                };
                const union = (left, right) => {
                    const a = find(left); const b = find(right);
                    if (a !== b) parent.set(b, a < b ? a : b);
                };
                for (let left = 0; left < sources.length; left += 1) {
                    for (let right = left + 1; right < sources.length; right += 1) {
                        const a = sources[left]; const b = sources[right];
                        const dependencyUrlsA = new Set([a.originalSourceUrl, a.parentSourceUrl, ...a.citedSourceUrls].filter(Boolean));
                        const dependencyUrlsB = new Set([b.originalSourceUrl, b.parentSourceUrl, ...b.citedSourceUrls].filter(Boolean));
                        const linked = dependencyUrlsA.has(b.canonicalUrl) || dependencyUrlsB.has(a.canonicalUrl)
                            || [...dependencyUrlsA].some(url => dependencyUrlsB.has(url));
                        if (a.contentHash === b.contentHash || (a.domain && a.domain === b.domain) || linked) union(a.sourceId, b.sourceId);
                    }
                }
                sources.forEach(source => {
                    source.independenceGroup = `ind_${stableHash(find(source.sourceId))}`;
                    const dependencyUrls = [source.originalSourceUrl, source.parentSourceUrl, ...source.citedSourceUrls].filter(Boolean);
                    source.independenceEstimated = !dependencyUrls.some(url => selectedUrls.has(url));
                });
                return sources;
            }

            function normalizeSearchResponses(plan, responses) {
                const byUrl = new Map();
                const excluded = [];
                const queryRuns = [];
                responses.forEach(response => {
                    const intent = response.intent;
                    if (response.error) {
                        queryRuns.push({ intent: intent.id, query: intent.query, status: 'failed', resultCount: 0, errorCode: response.error.code || String(response.error.status || 'SEARCH_FAILED') });
                        return;
                    }
                    const consulted = consultedSourcesFromPayload(response.payload);
                    const consultedMap = new Map(consulted.map(source => [source.url, source]));
                    const results = Array.isArray(response.parsed && response.parsed.results) ? response.parsed.results : [];
                    let accepted = 0;
                    results.forEach(candidate => {
                        const canonicalUrl = canonicalizeUrl(candidate.sourceUrl);
                        if (!canonicalUrl || !consultedMap.has(canonicalUrl)) {
                            excluded.push({ intent: intent.id, url: canonicalUrl || null, reason: canonicalUrl ? 'not_in_web_search_sources' : 'invalid_url' });
                            return;
                        }
                        const existing = byUrl.get(canonicalUrl);
                        const claimCandidates = (Array.isArray(candidate.claimCandidates) ? candidate.claimCandidates : []).map(normalizeText).filter(Boolean).slice(0, 4);
                        if (existing) {
                            if (!existing.queryIntents.includes(intent.id)) existing.queryIntents.push(intent.id);
                            existing.claimCandidates = Array.from(new Set([...existing.claimCandidates, ...claimCandidates])).slice(0, 8);
                            accepted += 1;
                            return;
                        }
                        const excerpt = normalizeText(candidate.relevantExcerpt).slice(0, 900);
                        const domain = sourceDomain(canonicalUrl);
                        const normalizedTitle = normalizeText(candidate.sourceTitle);
                        byUrl.set(canonicalUrl, {
                            sourceId: `src_${stableHash(canonicalUrl)}`, title: normalizedTitle || consultedMap.get(canonicalUrl).title || canonicalUrl,
                            url: canonicalUrl, canonicalUrl, domain, publisher: normalizeText(candidate.publisher),
                            publishedAt: candidate.publishedAt ? normalizeText(candidate.publishedAt) : null,
                            sourceType: SOURCE_TYPES.includes(candidate.sourceType) ? candidate.sourceType : 'UNKNOWN',
                            isPrimary: candidate.isPrimary === true, relevantExcerpt: excerpt,
                            queryIntents: [intent.id], claimCandidates,
                            originalSourceUrl: canonicalizeUrl(candidate.originalSourceUrl), parentSourceUrl: canonicalizeUrl(candidate.parentSourceUrl),
                            citedSourceUrls: (Array.isArray(candidate.citedSourceUrls) ? candidate.citedSourceUrls : []).map(canonicalizeUrl).filter(Boolean).slice(0, 5),
                            contentHash: stableHash(`${normalizedTitle.toLowerCase()}|${excerpt.toLowerCase()}|${normalizedTitle || excerpt ? '' : canonicalUrl}`)
                        });
                        accepted += 1;
                    });
                    queryRuns.push({ intent: intent.id, query: intent.query, status: 'success', resultCount: accepted, consultedSourceCount: consulted.length });
                });
                const byContent = new Map();
                Array.from(byUrl.values()).forEach(source => {
                    const existing = byContent.get(source.contentHash);
                    if (!existing) {
                        byContent.set(source.contentHash, source);
                        return;
                    }
                    existing.queryIntents = Array.from(new Set([...existing.queryIntents, ...source.queryIntents]));
                    existing.claimCandidates = Array.from(new Set([...existing.claimCandidates, ...source.claimCandidates])).slice(0, 8);
                    existing.citedSourceUrls = Array.from(new Set([...existing.citedSourceUrls, ...source.citedSourceUrls])).slice(0, 5);
                    existing.isPrimary = existing.isPrimary || source.isPrimary;
                    excluded.push({ intent: source.queryIntents[0] || 'unknown', url: source.canonicalUrl, reason: 'duplicate_content', duplicateOf: existing.canonicalUrl });
                });
                const sources = assignIndependenceGroups(selectBalancedSources(Array.from(byContent.values()), plan));
                return { sources, queryRuns, excluded };
            }

            function compactEvidence(sources) {
                return sources.map(source => ({
                    sourceId: source.sourceId, title: source.title, domain: source.domain, publisher: source.publisher,
                    publishedAt: source.publishedAt, sourceType: source.sourceType, isPrimary: source.isPrimary,
                    excerpt: source.relevantExcerpt, queryIntents: source.queryIntents, claimCandidates: source.claimCandidates,
                    independenceGroup: source.independenceGroup, independenceEstimated: source.independenceEstimated
                }));
            }

            function buildVerificationRequest(plan, sources, model) {
                return {
                    model, store: false, reasoning: { effort: 'low' }, max_output_tokens: 5000,
                    input: [
                        { role: 'system', content: [{ type: 'input_text', text: 'あなたはEvidence比較器です。与えられたEvidenceだけを使い、記事単位ではなく検証可能な原子的Claimへ分解してください。Evidenceにない事実やsource IDを補完しないでください。' }] },
                        { role: 'user', content: [{ type: 'input_text', text: `対象: ${plan.topic}\nEvidence:\n${JSON.stringify(compactEvidence(sources))}\n\n各Claimについて、各sourceが支持、反証、不明のどれかを抜粋に基づいて判定してください。同じClaimへの支持と反証があればcontradictionsにも残してください。最大8 Claimです。` }] }
                    ],
                    text: { format: { type: 'json_schema', name: 'bubble_claim_verification', strict: true, schema: VERIFICATION_SCHEMA } }
                };
            }

            function fallbackVerification(sources) {
                const claims = [];
                const seen = new Set();
                sources.forEach(source => source.claimCandidates.forEach(text => {
                    const key = normalizeText(text).toLowerCase();
                    if (!key || seen.has(key) || claims.length >= 8) return;
                    seen.add(key);
                    const stance = source.queryIntents.includes('contradict') ? 'contradicting'
                        : source.queryIntents.includes('support') ? 'supporting' : 'uncertain';
                    claims.push({ claimKey: `fallback_${stableHash(key)}`, text, assessments: [{ sourceId: source.sourceId, stance, evidenceText: source.relevantExcerpt }] });
                }));
                return { claims, contradictions: [] };
            }

            function verificationStatus(supportGroups, contradictGroups) {
                if (supportGroups.size && contradictGroups.size) return 'mixed';
                if (supportGroups.size >= 2) return 'supporting';
                if (contradictGroups.size >= 2) return 'contradicting';
                return 'uncertain';
            }

            function confidenceForClaim(claim, sourcesById, failedIntentCount) {
                const relevant = claim.assessments.map(item => sourcesById.get(item.sourceId)).filter(Boolean);
                const supporting = claim.assessments.filter(item => item.stance === 'supporting');
                const contradicting = claim.assessments.filter(item => item.stance === 'contradicting');
                const supportGroups = new Set(supporting.map(item => sourcesById.get(item.sourceId)?.independenceGroup).filter(Boolean));
                const contradictGroups = new Set(contradicting.map(item => sourcesById.get(item.sourceId)?.independenceGroup).filter(Boolean));
                const independentGroups = new Set(relevant.map(source => source.independenceGroup));
                const status = verificationStatus(supportGroups, contradictGroups);
                const independentCoverage = Math.min(independentGroups.size / 3, 1);
                const statusEvidence = status === 'mixed' ? Math.min(supportGroups.size, contradictGroups.size) : Math.max(supportGroups.size, contradictGroups.size);
                const corroboration = Math.min(statusEvidence / (status === 'mixed' ? 1 : 2), 1);
                const primaryGroups = new Set(relevant.filter(source => source.isPrimary).map(source => source.independenceGroup));
                const primaryCoverage = primaryGroups.size ? 1 : 0;
                const intentCoverage = new Set(relevant.flatMap(source => source.queryIntents)).size / INTENTS.length;
                const metadataQuality = relevant.length ? relevant.reduce((sum, source) => sum
                    + (source.relevantExcerpt ? 0.5 : 0)
                    + (source.publishedAt ? 0.25 : 0)
                    + (source.sourceType !== 'UNKNOWN' ? 0.25 : 0), 0) / relevant.length : 0;
                const allEstimated = relevant.length > 0 && relevant.every(source => source.independenceEstimated);
                let confidence = 0.35 * independentCoverage + 0.25 * corroboration + 0.15 * primaryCoverage + 0.15 * intentCoverage + 0.10 * metadataQuality;
                confidence -= Math.min(0.24, failedIntentCount * 0.08);
                if (allEstimated) confidence -= 0.10;
                confidence = Math.max(0, Math.min(1, confidence));
                if (status === 'uncertain') confidence = Math.min(confidence, 0.49);
                return {
                    status, confidence: Number(confidence.toFixed(2)),
                    supportingSources: new Set(supporting.map(item => item.sourceId)).size,
                    contradictingSources: new Set(contradicting.map(item => item.sourceId)).size,
                    independentSources: independentGroups.size, primarySources: primaryGroups.size,
                    supportingIndependentSources: supportGroups.size, contradictingIndependentSources: contradictGroups.size,
                    factors: {
                        independentCoverage: Number(independentCoverage.toFixed(2)), corroboration: Number(corroboration.toFixed(2)),
                        primaryCoverage, intentCoverage: Number(intentCoverage.toFixed(2)), metadataQuality: Number(metadataQuality.toFixed(2)),
                        failedIntentPenalty: Number(Math.min(0.24, failedIntentCount * 0.08).toFixed(2)), estimatedIndependencePenalty: allEstimated ? 0.10 : 0
                    }
                };
            }

            function normalizeVerification(raw, sources, failedIntentCount) {
                const sourcesById = new Map(sources.map(source => [source.sourceId, source]));
                const rawClaims = Array.isArray(raw && raw.claims) ? raw.claims : [];
                const claims = rawClaims.slice(0, 8).map((claim, index) => {
                    const assessments = (Array.isArray(claim.assessments) ? claim.assessments : [])
                        .filter(item => sourcesById.has(String(item.sourceId)) && STANCES.includes(item.stance))
                        .map(item => ({ sourceId: String(item.sourceId), stance: item.stance, evidenceText: normalizeText(item.evidenceText).slice(0, 700) }));
                    const normalized = { claimId: `claim_${index + 1}_${stableHash(claim.text)}`, claimKey: normalizeText(claim.claimKey) || `claim_${index + 1}`, text: normalizeText(claim.text), assessments };
                    normalized.verification = confidenceForClaim(normalized, sourcesById, failedIntentCount);
                    return normalized;
                }).filter(claim => claim.text && claim.assessments.length);
                const contradictionByKey = new Map((Array.isArray(raw && raw.contradictions) ? raw.contradictions : []).map(item => [normalizeText(item.claimKey), item]));
                const contradictions = claims.filter(claim => claim.verification.status === 'mixed').map(claim => {
                    const modelItem = contradictionByKey.get(claim.claimKey);
                    return {
                        claimId: claim.claimId, contradiction: true,
                        supportingSourceIds: claim.assessments.filter(item => item.stance === 'supporting').map(item => item.sourceId),
                        contradictingSourceIds: claim.assessments.filter(item => item.stance === 'contradicting').map(item => item.sourceId),
                        summary: normalizeText(modelItem && modelItem.summary) || '独立した情報源の間で、この主張への支持と反証が確認されました。'
                    };
                });
                return { claims, contradictions };
            }

            function perspectiveFromClaims(claims, sources) {
                const byGroup = new Map(sources.map(source => [source.independenceGroup, new Set()]));
                const sourceGroups = new Map(sources.map(source => [source.sourceId, source.independenceGroup]));
                claims.forEach(claim => claim.assessments.forEach(item => {
                    const group = sourceGroups.get(item.sourceId);
                    if (group) byGroup.get(group).add(item.stance);
                }));
                const totals = { support: 0, neutral: 0, contradict: 0 };
                byGroup.forEach(stances => {
                    if (stances.has('supporting') && !stances.has('contradicting')) totals.support += 1;
                    else if (stances.has('contradicting') && !stances.has('supporting')) totals.contradict += 1;
                    else totals.neutral += 1;
                });
                const total = Math.max(1, byGroup.size);
                const support = Number((totals.support / total).toFixed(2));
                const contradict = Number((totals.contradict / total).toFixed(2));
                return { support, neutral: Number(Math.max(0, 1 - support - contradict).toFixed(2)), contradict, basis: 'collected_independent_source_groups', groupCount: byGroup.size };
            }

            function sourceComposition(sources) {
                const labels = { PRIMARY: '一次資料', GOVERNMENT: '政府・公的機関', ACADEMIC: '学術・研究', COMPANY: '企業公式', NEWS: '報道', BLOG: 'ブログ', SOCIAL: 'ソーシャル', UNKNOWN: '分類不明' };
                const priority = { PRIMARY: 0, GOVERNMENT: 1, ACADEMIC: 2, COMPANY: 3, NEWS: 4, BLOG: 5, SOCIAL: 6, UNKNOWN: 7 };
                const groups = new Map();
                sources.forEach(source => {
                    const key = source.independenceGroup || source.sourceId;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(source);
                });
                const byType = new Map();
                groups.forEach(groupSources => {
                    const representative = groupSources.slice().sort((left, right) => (priority[left.sourceType] ?? 99) - (priority[right.sourceType] ?? 99))[0];
                    const sourceType = labels[representative.sourceType] ? representative.sourceType : 'UNKNOWN';
                    if (!byType.has(sourceType)) byType.set(sourceType, { sourceType, label: labels[sourceType], count: 0, sourceIds: [] });
                    const segment = byType.get(sourceType);
                    segment.count += 1;
                    segment.sourceIds.push(...groupSources.map(source => source.sourceId));
                });
                const total = groups.size;
                if (!total) return [];
                const segments = Array.from(byType.values()).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'ja'));
                let assigned = 0;
                return segments.map((segment, index) => {
                    const value = index === segments.length - 1 ? Number((100 - assigned).toFixed(1)) : Number((segment.count / total * 100).toFixed(1));
                    assigned += value;
                    return { ...segment, value, sourceIds: Array.from(new Set(segment.sourceIds)) };
                });
            }

            function sanitizeSynthesisAnalysis(analysis, sources, images, composition) {
                if (!analysis || typeof analysis !== 'object') return null;
                const allowedSourceIds = new Set(sources.map(source => source.sourceId));
                const allowedImageIds = new Set(images.map(image => image.imageId));
                const refs = (items, allowed, maximum) => Array.isArray(items) ? Array.from(new Set(items.map(String).filter(item => allowed.has(item)))).slice(0, maximum) : [];
                const overview = analysis.overview || {};
                const history = analysis.history || {};
                const demographic = analysis.demographic || {};
                const evaluation = analysis.evaluation || {};
                const panelImageRefs = (section, panelId, maximum = 2) => {
                    const requested = refs(section && section.imageIds, allowedImageIds, maximum)
                        .filter(id => images.some(image => image.imageId === id && (!Array.isArray(image.panelIds) || image.panelIds.includes(panelId))));
                    if (requested.length) return requested;
                    return images.filter(image => Array.isArray(image.panelIds) && image.panelIds.includes(panelId)).slice(0, maximum).map(image => image.imageId);
                };
                const perspective = (section, unavailable) => {
                    const sourceIds = refs(section && section.sourceIds, allowedSourceIds, 8);
                    const comments = sourceIds.length && Array.isArray(section && section.comments)
                        ? section.comments.map(comment => ({
                            text: normalizeText(comment && comment.text),
                            sourceIds: refs(comment && comment.sourceIds, allowedSourceIds, 3)
                        })).filter(comment => comment.text && comment.sourceIds.length).slice(0, 4)
                        : [];
                    return {
                        summary: sourceIds.length ? normalizeText(section.summary) : unavailable,
                        comments,
                        sourceIds,
                        imageIds: sourceIds.length ? refs(section.imageIds, allowedImageIds, 2) : []
                    };
                };
                const events = (Array.isArray(history.events) ? history.events : [])
                    .map(event => ({
                        dateLabel: normalizeText(event && event.dateLabel), sortKey: Math.trunc(Number(event && event.sortKey)),
                        title: normalizeText(event && event.title), description: normalizeText(event && event.description),
                        sourceIds: refs(event && event.sourceIds, allowedSourceIds, 4), imageIds: refs(event && event.imageIds, allowedImageIds, 2)
                    }))
                    .filter(event => event.dateLabel && event.title && Number.isFinite(event.sortKey) && event.sourceIds.length)
                    .sort((left, right) => left.sortKey - right.sortKey)
                    .slice(0, 8);
                return {
                    overview: {
                        summary: normalizeText(overview.summary), sourceIds: refs(overview.sourceIds, allowedSourceIds, 8),
                        imageIds: panelImageRefs(overview, 'overview')
                    },
                    history: {
                        summary: normalizeText(history.summary), events, sourceIds: refs(history.sourceIds, allowedSourceIds, 8),
                        imageIds: panelImageRefs(history, 'history')
                    },
                    demographic: {
                        summary: normalizeText(demographic.summary), sourceIds: refs(demographic.sourceIds, allowedSourceIds, 8),
                        imageIds: panelImageRefs(demographic, 'demographic'), segments: composition
                    },
                    evaluation: {
                        opposition: perspective(evaluation.opposition, '反対派の根拠を確認できませんでした。'),
                        support: perspective(evaluation.support, '賛成派の根拠を確認できませんでした。'),
                        imageIds: panelImageRefs(evaluation, 'evaluation'),
                        conversation: (() => {
                            const rawTurns = Array.isArray(evaluation.conversation) ? evaluation.conversation : [];
                            return rawTurns.slice(0, 6).reduce((normalized, turn, index) => {
                                const id = normalizeText(turn && turn.id) || `turn-${index + 1}`;
                                const sourceIds = refs(turn && turn.sourceIds, allowedSourceIds, 3);
                                const side = turn && turn.side === 'support' ? 'support' : 'opposition';
                                const previous = turn && normalized.find(item => item.id === String(turn.respondsTo));
                                const respondsTo = previous && previous.side !== side ? String(turn.respondsTo) : null;
                                const normalizedTurn = { id, side, text: normalizeText(turn && turn.text), respondsTo, sourceIds };
                                if (normalizedTurn.text && normalizedTurn.sourceIds.length) normalized.push(normalizedTurn);
                                return normalized;
                            }, []);
                        })()
                    }
                };
            }

            function buildSynthesisRequest(plan, detailResearch, analysisSchema, model) {
                const schema = {
                    type: 'object', additionalProperties: false, required: ['analysis', 'sourceIds'],
                    properties: { analysis: analysisSchema, sourceIds: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string' } } }
                };
                const evidence = compactEvidence(detailResearch.sources);
                const claims = detailResearch.claims.map(claim => ({ claimId: claim.claimId, text: claim.text, verification: claim.verification, assessments: claim.assessments }));
                const images = detailResearch.images.map(image => ({ imageId: image.imageId, caption: image.caption, sourceWebsiteUrl: image.sourceWebsiteUrl, sourceDomain: image.sourceDomain }));
                return {
                    model, store: false, reasoning: { effort: 'low' }, max_output_tokens: 7000,
                    input: [
                        { role: 'system', content: [{ type: 'input_text', text: 'あなたはBubbleBreakerの統合分析器です。検索は完了しています。与えられたEvidenceと検証結果だけを使い、Evidence外の事実を検索済みであるかのように補完しないでください。各パネルのsourceIdsはそのパネルの主張を直接支える資料だけにし、同じ出典一覧を全パネルへコピーしないでください。同じsourceIdを複数パネルで使うのは、その資料が各パネルの異なる主張も直接支える場合に限ります。' }] },
                        { role: 'user', content: [{ type: 'input_text', text: `対象: ${plan.topic}\nEvidence: ${JSON.stringify(evidence)}\nClaims: ${JSON.stringify(claims)}\nContradictions: ${JSON.stringify(detailResearch.contradictions)}\nPerspective: ${JSON.stringify(detailResearch.perspective)}\n情報源構成: ${JSON.stringify(detailResearch.sourceComposition)}\nImage candidates: ${JSON.stringify(images)}\nLimitations: ${JSON.stringify(detailResearch.limitations)}\n\noverviewは概要、historyは根拠から年月を確認できる出来事だけを最大8件、demographicは今回収集したEvidenceの情報源構成について生成してください。history.sortKeyは年月日をYYYYMMDD整数で表し、不明な月日は00にしてください。evaluationは賛成側と反対側のEvidenceに基づく論点を整理してください。conversationには立場を交互にした最大6ターンを作り、respondsToで直前の相手側の論点へ具体的に応答してください。これは実在人物の会話ではなく、Evidenceから再構成した匿名の立場ごとの主張です。各ターンは根拠となるsourceIdsを必ず付け、根拠が片側しかなければ会話を無理に成立させず、確認できた立場だけ返してください。commentsは説明文や箇条書き調を避け、自然な意見文にしてください。実在人物の直接引用や架空の発言者名は作らず、反対側を藁人形化せず、賛成側もEvidenceなしに補完しないでください。各section・event・立場は根拠となるsourceIdを返し、関連性をcaptionから説明できる場合だけimageIdを返してください。画像は0件でも構いません。AIインサイトや架空の割合は生成しないでください。矛盾があれば一方を消さず明記してください。使用したsourceIdの和集合を最上位sourceIdsへ返してください。` }] }
                    ],
                    text: { format: { type: 'json_schema', name: 'bubble_analysis_synthesis', strict: true, schema } }
                };
            }

            function transientError(error) {
                return !error || ['API_TIMEOUT', 'API_NETWORK_ERROR'].includes(error.code) || [408, 409, 429].includes(error.status) || Number(error.status) >= 500;
            }

            async function withOneRetry(operation) {
                try { return await operation(1); }
                catch (error) {
                    if (!transientError(error)) throw error;
                    await new Promise(resolve => setTimeout(resolve, 500));
                    return operation(2);
                }
            }

            async function runLimited(items, limit, worker) {
                const results = new Array(items.length); let next = 0;
                const run = async () => {
                    while (true) {
                        const index = next; next += 1;
                        if (index >= items.length) return;
                        results[index] = await worker(items[index], index);
                    }
                };
                await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
                return results;
            }

            function cacheKeyFor(bubble, group, input) {
                return stableHash(`${normalizeText(input)}|${normalizeText(group && group.title)}|${normalizeText(bubble && bubble.name)}|${normalizeText(bubble && bubble.desc)}`);
            }

            function pruneCache() {
                const now = Date.now();
                researchCache.forEach((entry, key) => { if (now - entry.createdAt > CACHE_TTL_MS) researchCache.delete(key); });
                while (researchCache.size > CACHE_MAX_ENTRIES) researchCache.delete(researchCache.keys().next().value);
            }

            async function runBubbleResearch(options) {
                const { bubble, group, input, model, analysisSchema, requestResponse, log = () => {}, warn = () => {} } = options;
                const plan = createQueryPlan(bubble, group, input);
                const cacheKey = cacheKeyFor(bubble, group, input);
                pruneCache();
                const cached = researchCache.get(cacheKey);
                if (cached && Date.now() - cached.createdAt <= CACHE_TTL_MS) return cached.promise;
                const promise = (async () => {
                    log('詳細調査のQuery Planを確定しました', { bubbleId: bubble.id, intents: plan.intents.map(intent => intent.id) });
                    const imageSearchPromise = runLimited(IMAGE_PANEL_SPECS, 2, async panel => {
                        try {
                            const result = await withOneRetry(() => requestResponse(buildImageSearchRequest(plan, model, panel), 45000, `bubble-image-search-${panel.id}`));
                            const panelImages = imageResultsFromPayload(result.payload, panel.id);
                            return { panelId: panel.id, status: panelImages.length ? 'success' : 'no_results', images: panelImages, resultCount: panelImages.length };
                        } catch (error) {
                            warn('詳細パネル用の画像検索に失敗しました', { bubbleId: bubble.id, panelId: panel.id, code: error.code || null, status: error.status || null });
                            return { panelId: panel.id, status: 'failed', images: [], resultCount: 0, errorCode: error.code || null, errorStatus: error.status || null };
                        }
                    });
                    const responses = await runLimited(plan.intents, 2, async intent => {
                        try {
                            const response = await withOneRetry(() => requestResponse(buildSearchRequest(plan, intent, model), 45000, `bubble-search-${intent.id}`));
                            return { intent, ...response };
                        } catch (error) {
                            warn('詳細調査の検索意図に失敗しました', { bubbleId: bubble.id, intent: intent.id, code: error.code || null, status: error.status || null });
                            return { intent, error };
                        }
                    });
                    const imageQueries = await imageSearchPromise;
                    const images = mergePanelImageResults(imageQueries.flatMap(result => result.images));
                    const failedImageQueries = imageQueries.filter(result => result.status === 'failed').length;
                    const emptyImageQueries = imageQueries.filter(result => result.status === 'no_results').length;
                    const normalized = normalizeSearchResponses(plan, responses);
                    const failedIntentCount = normalized.queryRuns.filter(run => run.status === 'failed').length;
                    const limitations = [];
                    if (failedIntentCount) limitations.push(`${failedIntentCount}件の検索意図を完了できませんでした。`);
                    if (normalized.sources.some(source => !source.publishedAt)) limitations.push('公開日または更新日が不明な情報源を含みます。');
                    if (normalized.sources.some(source => !source.relevantExcerpt)) limitations.push('本文抜粋を取得できない情報源を含みます。');
                    if (normalized.sources.some(source => source.independenceEstimated)) limitations.push('一部の情報源の独立性は推定です。');
                    if (failedImageQueries) limitations.push(`${failedImageQueries}つの詳細パネルで画像検索に失敗しました。`);
                    if (emptyImageQueries) limitations.push(`${emptyImageQueries}つの詳細パネルでは関連画像が見つかりませんでした。`);
                    if (!normalized.sources.length) {
                        const error = new Error('検索で検証可能なEvidenceを取得できませんでした');
                        error.code = 'RESEARCH_NO_EVIDENCE';
                        error.detailResearch = { version: 2, status: 'failed', queries: normalized.queryRuns, imageQuery: { status: failedImageQueries === IMAGE_PANEL_SPECS.length ? 'failed' : 'partial', resultCount: images.length }, imageQueries, images, sourceComposition: [], sources: [], claims: [], contradictions: [], perspective: { support: 0, neutral: 0, contradict: 0, basis: 'collected_independent_source_groups', groupCount: 0 }, limitations: [...limitations, '検証可能なEvidenceがありません。'], excluded: normalized.excluded };
                        throw error;
                    }
                    let verificationRaw; let verificationPartial = false;
                    try {
                        const response = await withOneRetry(() => requestResponse(buildVerificationRequest(plan, normalized.sources, model), 60000, 'bubble-claim-verification'));
                        verificationRaw = response.parsed;
                    } catch (error) {
                        verificationPartial = true;
                        limitations.push('Claim比較に失敗したため、検索時のClaim候補をuncertain中心で利用しています。');
                        verificationRaw = fallbackVerification(normalized.sources);
                        warn('Claim比較をfallbackしました', { bubbleId: bubble.id, code: error.code || null, status: error.status || null });
                    }
                    const verified = normalizeVerification(verificationRaw, normalized.sources, failedIntentCount);
                    if (!verified.claims.length) limitations.push('検証可能なClaimを抽出できませんでした。');
                    const composition = sourceComposition(normalized.sources);
                    const detailResearch = {
                        version: 2, status: verificationPartial || failedIntentCount ? 'partial' : 'complete',
                        queries: normalized.queryRuns, sources: normalized.sources, claims: verified.claims,
                        contradictions: verified.contradictions, perspective: perspectiveFromClaims(verified.claims, normalized.sources),
                        sourceComposition: composition, images, imageQueries,
                        imageQuery: { status: failedImageQueries === IMAGE_PANEL_SPECS.length ? 'failed' : failedImageQueries || emptyImageQueries ? 'partial' : 'success', resultCount: images.length },
                        limitations, excluded: normalized.excluded, collectedAt: new Date().toISOString()
                    };
                    let synthesis;
                    try {
                        synthesis = await withOneRetry(() => requestResponse(buildSynthesisRequest(plan, detailResearch, analysisSchema, model), 60000, 'bubble-analysis-synthesis'));
                    } catch (error) {
                        detailResearch.status = 'partial';
                        detailResearch.limitations.push('最終統合に失敗したため、既定分析を表示しています。');
                        warn('詳細分析の最終統合に失敗しました', { bubbleId: bubble.id, code: error.code || null, status: error.status || null });
                        return { status: 'partial', analysis: null, sources: normalized.sources, detailResearch };
                    }
                    const allowedSourceIds = new Set(normalized.sources.map(source => source.sourceId));
                    const sourceIds = (Array.isArray(synthesis.parsed && synthesis.parsed.sourceIds) ? synthesis.parsed.sourceIds : []).map(String).filter(id => allowedSourceIds.has(id));
                    if (!synthesis.parsed || !synthesis.parsed.analysis || !sourceIds.length) {
                        detailResearch.status = 'partial';
                        detailResearch.limitations.push('最終統合のsource参照を検証できませんでした。');
                        return { status: 'partial', analysis: null, sources: normalized.sources, detailResearch };
                    }
                    const analysis = sanitizeSynthesisAnalysis(synthesis.parsed.analysis, normalized.sources, images, composition);
                    if (!analysis) {
                        detailResearch.status = 'partial';
                        detailResearch.limitations.push('最終統合の分析構造を検証できませんでした。');
                        return { status: 'partial', analysis: null, sources: normalized.sources, detailResearch };
                    }
                    return {
                        status: detailResearch.status, analysis,
                        sources: normalized.sources.filter(source => sourceIds.includes(source.sourceId)), detailResearch
                    };
                })();
                researchCache.set(cacheKey, { createdAt: Date.now(), promise });
                promise.catch(() => { if (researchCache.get(cacheKey)?.promise === promise) researchCache.delete(cacheKey); });
                return promise;
            }

            global.BubbleResearch = {
                INTENTS, SOURCE_TYPES, SEARCH_RESULT_SCHEMA, VERIFICATION_SCHEMA, IMAGE_SEARCH_SCHEMA,
                createQueryPlan, buildSearchRequest, buildImageSearchRequest, consultedSourcesFromPayload, imageResultsFromPayload, mergePanelImageResults, canonicalizeUrl,
                imagePanelSpecs: IMAGE_PANEL_SPECS,
                normalizeSearchResponses, buildVerificationRequest, fallbackVerification,
                normalizeVerification, perspectiveFromClaims, sourceComposition, sanitizeSynthesisAnalysis, buildSynthesisRequest, runBubbleResearch,
                clearCache() { researchCache.clear(); }
            };
        })(window);
