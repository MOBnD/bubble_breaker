        const OPENAI_GROUP_TYPES = ['分散型', '一極集中型', '多極型', '双極対立型', '階層型', '連鎖型'];
        const OPENAI_GROUP_TYPE_GUIDANCE = `typeは次の6種類から、バブルの支持分布に最も合うものを1つ選んでください: 分散型（均等に散らばる）、一極集中型（最大勢力が1つ）、多極型（3つ以上の勢力）、双極対立型（2つの対立勢力）、階層型（上位から下位へ段階的）、連鎖型（隣接関係・流れが重要）。`;
        const OPENAI_GROUP_LEVELS = ['root', 'central', 'leaf'];
        const OPENAI_MODEL = window.__OPENAI_MODEL__ || 'gpt-5.6-luna';
        const OPENAI_API_KEY = window.__OPENAI_API_KEY__ || '';
        const OPENAI_STRUCTURE_TIMEOUT_MS = 90000;
        const OPENAI_ANALYSIS_TIMEOUT_MS = 60000;
        const OPENAI_STRUCTURE_MAX_ATTEMPTS = 2;
        const OPENAI_ANALYSIS_MAX_ATTEMPTS = 3;
        const OPENAI_ANALYSIS_RETRY_DELAY_MS = 1200;
        const OPENAI_STRUCTURE_MAX_BUBBLES = 5;
        const OPENAI_LOG_PREFIX = '[BubbleBreaker][OpenAI]';
        let activeAnalysisInput = '';
        const bubbleAnalysisRequests = new Map();

        function truncateApiLog(value, maxLength = 2000) {
            const text = String(value == null ? '' : value);
            return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
        }

        function redactApiLog(value) {
            let text = String(value == null ? '' : value);
            if (OPENAI_API_KEY && OPENAI_API_KEY !== '__OPENAI_API_KEY__') {
                text = text.split(OPENAI_API_KEY).join('[REDACTED_API_KEY]');
            }
            return text.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
        }

        function apiLog(message, details) { console.info(OPENAI_LOG_PREFIX, message, details || ''); }
        function apiWarn(message, details) { console.warn(OPENAI_LOG_PREFIX, message, details || ''); }
        function apiError(message, details) { console.error(OPENAI_LOG_PREFIX, message, details || ''); }

        const apiKeyConfigured = Boolean(OPENAI_API_KEY && OPENAI_API_KEY !== '__OPENAI_API_KEY__');
        if (apiKeyConfigured) {
            apiLog('API設定を検出しました', { model: OPENAI_MODEL, apiKeyConfigured: true });
        } else {
            apiWarn('APIキーが未設定またはプレースホルダーです。npm run build後にdist/bb_proto4.htmlを開いてください。', { model: OPENAI_MODEL, apiKeyConfigured: false });
        }

        // Responses APIのStructured Outputsで利用するスキーマ。
        // すべてのプロパティをrequiredにし、API応答をそのまま画面データへ変換できる形にする。
        const OPENAI_METRIC_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['label', 'value'],
            properties: { label: { type: 'string' }, value: { type: 'number' } }
        };
        const OPENAI_SOURCE_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['title', 'url', 'domain', 'publishedAt', 'claims'],
            properties: {
                title: { type: 'string' },
                url: { type: 'string' },
                domain: { type: 'string' },
                publishedAt: { type: ['string', 'null'] },
                claims: { type: 'array', items: { type: 'string' }, maxItems: 2 }
            }
        };
        const OPENAI_ANALYSIS_SECTION_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['summary', 'insight', 'metrics', 'isEstimated'],
            properties: {
                summary: { type: 'string' },
                insight: { type: 'string' },
            metrics: { type: 'array', items: OPENAI_METRIC_SCHEMA, maxItems: 3 },
                isEstimated: { type: 'boolean' }
            }
        };
        const OPENAI_ANALYSIS_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['overview', 'history', 'demographic', 'evaluation'],
            properties: {
                overview: OPENAI_ANALYSIS_SECTION_SCHEMA,
                history: OPENAI_ANALYSIS_SECTION_SCHEMA,
                demographic: OPENAI_ANALYSIS_SECTION_SCHEMA,
                evaluation: OPENAI_ANALYSIS_SECTION_SCHEMA
            }
        };
        // 階層は一度に全体をモデルへ委ねず、直上の実体を確定してから
        // 次の一段だけを生成する。これにより、別経路のカテゴリを
        // 入力意見の経路へ誤接続する余地をなくす。
        const OPENAI_STAGE_BUBBLE_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['id', 'name', 'size', 'childId'],
            properties: {
                id: { type: 'string' }, name: { type: 'string' }, size: { type: 'number' },
                childId: { type: 'null' }
            }
        };
        const OPENAI_ROOT_GROUP_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['id', 'title', 'type', 'level', 'parentId', 'parentBubbleId', 'desc', 'bubbles'],
            properties: {
                id: { type: 'string' }, title: { type: 'string' }, type: { type: 'string', enum: OPENAI_GROUP_TYPES },
                level: { type: 'string', enum: ['root'] }, parentId: { type: 'null' }, parentBubbleId: { type: 'null' },
                desc: { type: 'string' }, bubbles: { type: 'array', minItems: 2, maxItems: OPENAI_STRUCTURE_MAX_BUBBLES, items: OPENAI_STAGE_BUBBLE_SCHEMA }
            }
        };
        const OPENAI_CENTRAL_GROUP_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['id', 'title', 'type', 'level', 'parentId', 'parentBubbleId', 'desc', 'bubbles'],
            properties: {
                id: { type: 'string' }, title: { type: 'string' }, type: { type: 'string', enum: OPENAI_GROUP_TYPES },
                level: { type: 'string', enum: ['central'] }, parentId: { type: 'string' }, parentBubbleId: { type: 'string' },
                desc: { type: 'string' }, bubbles: { type: 'array', minItems: 2, maxItems: OPENAI_STRUCTURE_MAX_BUBBLES, items: OPENAI_STAGE_BUBBLE_SCHEMA }
            }
        };
        const OPENAI_LEAF_GROUP_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['id', 'title', 'type', 'level', 'parentId', 'parentBubbleId', 'desc', 'bubbles'],
            properties: {
                id: { type: 'string' }, title: { type: 'string' }, type: { type: 'string', enum: OPENAI_GROUP_TYPES },
                level: { type: 'string', enum: ['leaf'] }, parentId: { type: 'string' }, parentBubbleId: { type: 'string' },
                desc: { type: 'string' }, bubbles: { type: 'array', minItems: 2, maxItems: OPENAI_STRUCTURE_MAX_BUBBLES, items: OPENAI_STAGE_BUBBLE_SCHEMA }
            }
        };
        const OPENAI_ROOT_RESPONSE_SCHEMA = {
            type: 'object', additionalProperties: false, required: ['entryRootBubbleId', 'groups'],
            properties: {
                entryRootBubbleId: { type: 'string' },
                groups: { type: 'array', minItems: 1, maxItems: 1, items: OPENAI_ROOT_GROUP_SCHEMA }
            }
        };
        const OPENAI_CENTRAL_RESPONSE_SCHEMA = {
            type: 'object', additionalProperties: false, required: ['entryBubbleId', 'groups'],
            properties: {
                entryBubbleId: { type: ['string', 'null'] },
                groups: { type: 'array', minItems: 1, maxItems: 1, items: OPENAI_CENTRAL_GROUP_SCHEMA }
            }
        };
        const OPENAI_LEAF_RESPONSE_SCHEMA_V2 = {
            type: 'object', additionalProperties: false, required: ['groups'],
            properties: { groups: { type: 'array', minItems: 1, maxItems: 1, items: OPENAI_LEAF_GROUP_SCHEMA } }
        };
        const OPENAI_BUBBLE_ANALYSIS_RESPONSE_SCHEMA = {
            type: 'object', additionalProperties: false,
            required: ['analysis', 'sources'],
            properties: {
                analysis: OPENAI_ANALYSIS_SCHEMA,
                sources: { type: 'array', items: OPENAI_SOURCE_SCHEMA, maxItems: 3 }
            }
        };

        const DEFAULT_ANALYSIS = {
            overview: { summary: 'このバブルを形成する主な意見の概要です。', insight: '公開情報が十分でないため、一般的な説明を表示しています。', metrics: [], isEstimated: true },
            history: { summary: '形成時期を確認できる公開情報がありません。', insight: '検索結果が増えると形成の歴史を推定できます。', metrics: [], isEstimated: true },
            demographic: { summary: '構成層・情報源を確認できる公開情報がありません。', insight: '検索で得られた情報源の傾向から推定します。', metrics: [], isEstimated: true },
            evaluation: { summary: '内外からの評価を確認できる公開情報がありません。', insight: '異なる立場の公開情報を比較して表示します。', metrics: [], isEstimated: true }
        };

        function fallbackEntryGroupId(input) {
            if (input.includes('なろう') || input.includes('小説')) return 'narou_group';
            if (input.includes('米') || input.includes('パン') || input.includes('主食') || input.includes('食事')) return 'staple_group';
            return 'kinoko_takenoko_group';
        }
        function fallbackEntryBubbleId(groupId, input) {
            const group = DB[groupId];
            if (!group || !group.bubbles.length) return null;
            const normalized = String(input || '').toLowerCase();
            return (group.bubbles.find(bubble => normalized.includes(String(bubble.name).toLowerCase()) || String(bubble.name).toLowerCase().includes(normalized)) || group.bubbles[0]).id;
        }

        function normalizeFallbackUniverse(input) {
            const entryGroupId = fallbackEntryGroupId(input);
            const entryBubbleId = fallbackEntryBubbleId(entryGroupId, input);
            const groups = JSON.parse(JSON.stringify(Object.values(DB)));
            return normalizeGeneratedUniverse({ groups, entryGroupId, entryBubbleId }, { allowSyntheticFallback: true });
        }

        function normalizeColor(value, fallback = 0x4488ff) {
            const numeric = Number(value);
            if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 0xffffff) return numeric;
            return fallback;
        }

        function colorFromText(text) {
            let hash = 0;
            for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
            return Math.abs(hash) % 0xffffff;
        }

        function normalizeHtmlColor(value, numericColor) {
            return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value) : `#${numericColor.toString(16).padStart(6, '0')}`;
        }

        function ensureDistinctBubbleColors(bubbles) {
            const usedHues = [];
            bubbles.forEach((bubble, index) => {
                const color = new THREE.Color(bubble.color);
                const hsl = {};
                color.getHSL(hsl);
                const collides = usedHues.some(hue => Math.abs(hsl.h - hue) < 0.075 || Math.abs(Math.abs(hsl.h - hue) - 1) < 0.075);
                if (collides) hsl.h = (index * 0.61803398875 + 0.08) % 1;
                hsl.s = Math.max(0.72, hsl.s);
                hsl.l = Math.max(0.58, hsl.l);
                color.setHSL(hsl.h, hsl.s, hsl.l);
                bubble.color = color.getHex();
                bubble.htmlColor = `#${bubble.color.toString(16).padStart(6, '0')}`;
                usedHues.push(hsl.h);
            });
        }

        function normalizeAnalysis(analysis) {
            const result = {};
            ['overview', 'history', 'demographic', 'evaluation'].forEach(key => {
                const section = analysis && analysis[key] ? analysis[key] : {};
                result[key] = {
                    summary: String(section.summary || DEFAULT_ANALYSIS[key].summary),
                    insight: String(section.insight || DEFAULT_ANALYSIS[key].insight),
                    metrics: Array.isArray(section.metrics) ? section.metrics
                        .filter(metric => metric && Number.isFinite(Number(metric.value)))
                        .slice(0, 8)
                        .map(metric => ({ label: String(metric.label || '指標'), value: Number(metric.value) })) : [],
                    isEstimated: section.isEstimated !== false
                };
            });
            return result;
        }

        function normalizeSources(sources) {
            if (!Array.isArray(sources)) return [];
            return sources.filter(source => source && /^https?:\/\//i.test(String(source.url || ''))).slice(0, 8).map(source => ({
                title: String(source.title || source.url),
                url: String(source.url),
                domain: String(source.domain || (() => { try { return new URL(source.url).hostname; } catch (_) { return ''; } })()),
                publishedAt: source.publishedAt ? String(source.publishedAt) : null,
                claims: Array.isArray(source.claims) ? source.claims.slice(0, 5).map(String) : []
            }));
        }

        function stableTextHash(value) {
            let hash = 2166136261;
            for (const character of String(value || '')) {
                hash ^= character.charCodeAt(0);
                hash = Math.imul(hash, 16777619);
            }
            return hash >>> 0;
        }

        // APIが全バブルへ同じsizeを返しても、画面上で「全部同じ大きさ」に
        // ならないよう、カテゴリ自身の文字列から再現可能な重みを作る。
        // ランダム値ではないため、再描画や再試行で占有率が変わらない。
        function inferBubbleWeight(bubble, index) {
            const text = `${bubble && bubble.id || ''}|${bubble && bubble.name || ''}|${bubble && bubble.desc || ''}|${index}`;
            const hash = stableTextHash(text);
            const spread = 0.72 + ((hash % 1001) / 1000) * 1.78;
            const lengthHint = Math.min(0.32, String(bubble && bubble.name || '').length * 0.018);
            return spread + lengthHint;
        }

        function normalizeBubblePercentages(bubbles) {
            const declared = bubbles.map(bubble => Math.max(0, Number(bubble && bubble.size) || 0));
            const max = Math.max(...declared, 0);
            const min = Math.min(...declared, 0);
            const unique = new Set(declared.map(value => value.toFixed(4))).size;
            const nearlyFlat = declared.length > 1 && (unique <= 1 || max - min < Math.max(0.5, max * 0.12));
            const weights = declared.map((value, index) => {
                if (nearlyFlat || value <= 0) return inferBubbleWeight(bubbles[index], index);
                return value;
            });
            const total = weights.reduce((sum, value) => sum + value, 0);
            if (!Number.isFinite(total) || total <= 0) throw new Error('バブルのsize合計が不正です');
            let assigned = 0;
            return bubbles.map((bubble, index) => {
                const percentage = index === bubbles.length - 1
                    ? Number((100 - assigned).toFixed(2))
                    : Math.floor((weights[index] / total) * 10000) / 100;
                assigned += percentage;
                return { ...bubble, size: Math.max(0, Number(percentage.toFixed(2))) };
            });
        }

        function separateBubblePositions(bubbles, options = {}) {
            if (bubbles.length < 2) return;
            const lockedIds = new Set(options.lockedIds || []);
            const spread = bubbles.reduce((max, bubble, index) => {
                return Math.max(max, Math.hypot(bubble.pos[0] - bubbles[0].pos[0], bubble.pos[1] - bubbles[0].pos[1], bubble.pos[2] - bubbles[0].pos[2]));
            }, 0);
            if (spread < 2) {
                const radius = Math.max(14, bubbles.length * 3.2);
                bubbles.forEach((bubble, index) => {
                    const angle = (Math.PI * 2 * index) / bubbles.length;
                    bubble.pos = [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.65, Math.sin(angle * 1.7) * 3];
                });
            }
            for (let iteration = 0; iteration < 24; iteration++) {
                let changed = false;
                for (let i = 0; i < bubbles.length; i++) {
                    for (let j = i + 1; j < bubbles.length; j++) {
                        const a = bubbles[i];
                        const b = bubbles[j];
                        let dx = b.pos[0] - a.pos[0];
                        let dy = b.pos[1] - a.pos[1];
                        let dz = b.pos[2] - a.pos[2];
                        let distance = Math.hypot(dx, dy, dz);
                        if (distance < 0.001) {
                            const angle = (i + j + 1) * 1.618;
                            dx = Math.cos(angle); dy = Math.sin(angle); dz = Math.cos(angle * 0.7); distance = Math.hypot(dx, dy, dz);
                        }
                        const required = Math.max(3, Math.pow(Math.max(1, a.size), 0.62) + Math.pow(Math.max(1, b.size), 0.62) + 1);
                        if (distance >= required) continue;
                        const push = (required - distance) / distance / 2;
                        const aLocked = lockedIds.has(a.id);
                        const bLocked = lockedIds.has(b.id);
                        if (!aLocked && !bLocked) {
                            a.pos[0] -= dx * push; a.pos[1] -= dy * push; a.pos[2] -= dz * push;
                            b.pos[0] += dx * push; b.pos[1] += dy * push; b.pos[2] += dz * push;
                        } else if (aLocked && !bLocked) {
                            b.pos[0] += dx * push * 2; b.pos[1] += dy * push * 2; b.pos[2] += dz * push * 2;
                        } else if (!aLocked && bLocked) {
                            a.pos[0] -= dx * push * 2; a.pos[1] -= dy * push * 2; a.pos[2] -= dz * push * 2;
                        }
                        changed = true;
                    }
                }
                if (!changed) break;
            }
            bubbles.forEach(bubble => { bubble.pos = bubble.pos.map(value => Math.max(-90, Math.min(90, value))); });
        }

        function arrangeBubblePositions(group) {
            const bubbles = group && Array.isArray(group.bubbles) ? group.bubbles : [];
            if (bubbles.length < 2) return;
            const ordered = bubbles.slice().sort((a, b) => Number(b.size || 0) - Number(a.size || 0));
            const type = OPENAI_GROUP_TYPES.includes(group.type) ? group.type : '分散型';
            const lockedIds = [];
            const count = ordered.length;
            const placeRing = (items, radius, angleOffset = 0, yScale = 0.72) => {
                items.forEach((bubble, index) => {
                    const angle = angleOffset + Math.PI * 2 * index / Math.max(1, items.length);
                    bubble.pos = [Math.cos(angle) * radius, Math.sin(angle) * radius * yScale, Math.sin(angle * 1.7) * 3];
                });
            };
            if (type === '一極集中型') {
                ordered[0].pos = [0, 0, 0];
                lockedIds.push(ordered[0].id);
                placeRing(ordered.slice(1), 22, Math.PI * 0.25);
            } else if (type === '双極対立型') {
                ordered[0].pos = [-20, 0, 0];
                if (ordered[1]) ordered[1].pos = [20, 0, 0];
                placeRing(ordered.slice(2), 16, Math.PI * 0.5, 0.9);
            } else if (type === '多極型') {
                const poleCount = Math.min(3, count);
                placeRing(ordered.slice(0, poleCount), 17, Math.PI * 0.5, 0.78);
                placeRing(ordered.slice(poleCount), 28, 0.1, 0.7);
            } else if (type === '階層型') {
                ordered.forEach((bubble, index) => {
                    const row = Math.floor(index / 2);
                    const side = index % 2 === 0 ? -1 : 1;
                    bubble.pos = [side * (row === 0 ? 0 : 12 + row * 2), 18 - row * 12, row * 3 - 3];
                });
                ordered[0].pos = [0, 20, 0];
                lockedIds.push(ordered[0].id);
            } else if (type === '連鎖型') {
                ordered.forEach((bubble, index) => {
                    const centered = index - (count - 1) / 2;
                    bubble.pos = [centered * 12, Math.sin(index * 1.25) * 7, Math.cos(index * 1.1) * 5];
                });
            } else {
                placeRing(ordered, 20, Math.PI * 0.37, 0.78);
            }
            separateBubblePositions(bubbles, { lockedIds });
            lockedIds.forEach(id => {
                const bubble = bubbles.find(item => item.id === id);
                if (bubble && type === '一極集中型') bubble.pos = [0, 0, 0];
                if (bubble && type === '階層型') bubble.pos = [0, 20, 0];
            });
        }

        // 固定DBの緊急フォールバック専用。API生成データでは呼び出さない。
        function createFallbackChildGroup(parentGroup, bubble, index) {
            const childId = `${parentGroup.id}__generated_child_${bubble.id}`;
            const baseColor = normalizeColor(bubble.color, colorFromText(bubble.name));
            const makeBubble = (suffix, name, size, color, pos, desc) => ({
                id: `${childId}__${suffix}`,
                name,
                size,
                color,
                htmlColor: normalizeHtmlColor(null, color),
                pos,
                childId: null,
                desc,
                isEstimated: true,
                confidence: bubble.confidence,
                analysis: normalizeAnalysis(bubble.analysis),
                sources: bubble.sources
            });
            const evidenceLabels = [
                ...(bubble.sources || []).map(source => String(source.title || '').trim()),
                ...['overview', 'history', 'demographic', 'evaluation'].flatMap(key => (bubble.analysis && bubble.analysis[key] && bubble.analysis[key].metrics || []).map(metric => String(metric.label || '').trim()))
            ].filter(label => label && !/特徴|評価|理由|支持|見た目|歴史/.test(label));
            const variantLabels = [...new Set(evidenceLabels)].slice(0, 5);
            while (variantLabels.length < 5) variantLabels.push(['代表的な系統', '主流の方式', '地域・流派', '専門分野', '関連する選択肢'][variantLabels.length]);
            return {
                id: childId,
                title: `${bubble.name}の詳細`,
                type: '分散型',
                parentId: parentGroup.id,
                desc: `${bubble.name}を具体的な選択肢へ分解した下位カテゴリです。`,
                bubbles: [
                    makeBubble('variant_1', `${bubble.name}の${variantLabels[0]}`, 24, baseColor, [-6, 3, 1], `${bubble.name}に属する代表的な下位選択肢。`),
                    makeBubble('variant_2', `${bubble.name}の${variantLabels[1]}`, 21, baseColor ^ 0x222222, [-2, -2, -1], `${bubble.name}に属する別の下位選択肢。`),
                    makeBubble('variant_3', `${bubble.name}の${variantLabels[2]}`, 19, baseColor ^ 0x444444, [3, 3, 2], `${bubble.name}に属する下位選択肢。`),
                    makeBubble('variant_4', `${bubble.name}の${variantLabels[3]}`, 18, baseColor ^ 0x666666, [6, -2, -2], `${bubble.name}に属する下位選択肢。`),
                    makeBubble('variant_5', `${bubble.name}の${variantLabels[4]}`, 18, baseColor ^ 0x888888, [0, -5, 3], `${bubble.name}に属する下位選択肢。`)
                ],
                generatedFromBubble: bubble.id,
                generatedIndex: index
            };
        }

        // parentId/childId/parentBubbleIdはモデルが相互参照を誤ることがあるため、
        // 既に生成されたグループとバブルの相互参照だけから正規の接続を解決する。
        // カテゴリ名・説明・分析内容は生成結果をそのまま保持し、合成しない。
        function canonicalizeGeneratedLinks(db, declaredParentIds, options = {}) {
            const requireLeafLinks = options.requireLeafLinks !== false;
            const groups = Object.values(db);
            const bubbleOwners = new Map();
            groups.forEach(group => group.bubbles.forEach(bubble => {
                if (bubbleOwners.has(bubble.id)) throw new Error('バブルIDが重複しています');
                bubbleOwners.set(bubble.id, group);
            }));
            const childGroupsByParentBubble = new Map();
            groups.forEach(group => {
                if (!OPENAI_GROUP_LEVELS.includes(group.level)) throw new Error('グループのlevelが不正です');
                const declaredParentId = declaredParentIds.get(group.id);
                if (group.level === 'root') {
                    if (group.parentBubbleId !== null) throw new Error('親カテゴリのparentBubbleIdはnullである必要があります');
                    if (declaredParentId !== null) {
                        apiWarn('親カテゴリのparentIdをnullへ正規化しました', { groupId: group.id, declaredParentId });
                    }
                    group.parentId = null;
                    return;
                }
                const expectedParentLevel = group.level === 'central' ? 'root' : 'central';
                const parentFromBubble = group.parentBubbleId ? bubbleOwners.get(group.parentBubbleId) : null;
                const parentFromId = declaredParentId ? db[declaredParentId] : null;
                const validParentFromBubble = parentFromBubble && parentFromBubble.level === expectedParentLevel ? parentFromBubble : null;
                const validParentFromId = parentFromId && parentFromId.level === expectedParentLevel ? parentFromId : null;
                if (validParentFromBubble && validParentFromId && validParentFromBubble.id !== validParentFromId.id) {
                    throw new Error('グループのparentIdとparentBubbleIdが一致しません');
                }
                const parentGroup = validParentFromBubble || validParentFromId;
                if (!parentGroup) {
                    throw new Error(group.parentBubbleId ? 'グループのparentBubbleIdが不正です' : 'グループの親カテゴリが解決できません');
                }
                let parentBubble = validParentFromBubble
                    ? parentGroup.bubbles.find(bubble => bubble.id === group.parentBubbleId)
                    : null;
                if (!parentBubble) {
                    const linkedBubbles = parentGroup.bubbles.filter(bubble => bubble.childId === group.id);
                    if (linkedBubbles.length !== 1) {
                        throw new Error('親グループから対応する親バブルを解決できません');
                    }
                    parentBubble = linkedBubbles[0];
                }
                if (childGroupsByParentBubble.has(parentBubble.id) && childGroupsByParentBubble.get(parentBubble.id).id !== group.id) {
                    throw new Error('同じ親バブルに複数の下位カテゴリが接続されています');
                }
                if (declaredParentId !== parentGroup.id || group.parentBubbleId !== parentBubble.id) {
                    apiWarn('モデルのparentIdをparentBubbleIdから正規化しました', {
                        groupId: group.id,
                        declaredParentId: declaredParentId || null,
                        canonicalParentId: parentGroup.id,
                        declaredParentBubbleId: group.parentBubbleId || null,
                        canonicalParentBubbleId: parentBubble.id
                    });
                }
                group.parentId = parentGroup.id;
                group.parentBubbleId = parentBubble.id;
                childGroupsByParentBubble.set(parentBubble.id, group);
            });

            groups.forEach(group => {
                if (group.level === 'leaf') {
                    group.bubbles.forEach(bubble => {
                        if (bubble.childId) {
                            apiWarn('leafグループのchildIdをnullへ正規化しました', { groupId: group.id, bubbleId: bubble.id });
                        }
                        bubble.childId = null;
                    });
                    return;
                }
                const expectedChildLevel = group.level === 'root' ? 'central' : 'leaf';
                group.bubbles.forEach(bubble => {
                    let childGroup = childGroupsByParentBubble.get(bubble.id);
                    if (!childGroup && bubble.childId && db[bubble.childId]) {
                        const declaredChildGroup = db[bubble.childId];
                        if (declaredChildGroup.level === expectedChildLevel && declaredChildGroup.parentId === group.id) {
                            if (declaredChildGroup.parentBubbleId && declaredChildGroup.parentBubbleId !== bubble.id) {
                                throw new Error('バブルのchildIdと子カテゴリのparentBubbleIdが一致しません');
                            }
                            declaredChildGroup.parentBubbleId = bubble.id;
                            childGroupsByParentBubble.set(bubble.id, declaredChildGroup);
                            childGroup = declaredChildGroup;
                        }
                    }
                    if (!childGroup && group.level === 'central' && !requireLeafLinks) {
                        bubble.childId = null;
                        return;
                    }
                    if (!childGroup) throw new Error('親バブルに対応する下位カテゴリがありません');
                    if (bubble.childId !== childGroup.id) {
                        apiWarn('モデルのchildIdを親バブルIDから正規化しました', {
                            groupId: group.id,
                            bubbleId: bubble.id,
                            declaredChildId: bubble.childId || null,
                            canonicalChildId: childGroup.id
                        });
                    }
                    bubble.childId = childGroup.id;
                });
            });
        }

        // API生成データは、入力意見の経路だけでなく全経路が同じ階層品質を
        // 満たしている場合だけ受け入れる。欠損をテンプレートで補完しない。
        function validateGeneratedHierarchy(db, entryGroupId, entryBubbleId) {
            const groups = Object.values(db);
            const roots = groups.filter(group => group.parentId === null);
            if (roots.length !== 1) throw new Error('親カテゴリは1つだけ必要です');
            const root = roots[0];
            if (root.bubbles.length < 2) throw new Error('上位カテゴリのバブルが不足しています');

            const referencedIds = new Set([root.id]);
            const requireUniqueChild = (parentGroup, bubble, level) => {
                if (!bubble.childId) throw new Error(`${level}のバブルに下位カテゴリ接続がありません`);
                const child = db[bubble.childId];
                if (!child) throw new Error(`${level}のchildIdが存在しません`);
                if (child.level !== (level === '親カテゴリ' ? 'central' : 'leaf')) {
                    throw new Error(`${level}のchildIdが一つ下のカテゴリではありません`);
                }
                if (child.parentId !== parentGroup.id) throw new Error(`${level}のchildIdの親カテゴリが不正です`);
                if (referencedIds.has(child.id)) throw new Error(`${level}の下位カテゴリが重複しています`);
                referencedIds.add(child.id);
                return child;
            };

            const centralGroups = root.bubbles.map(bubble => requireUniqueChild(root, bubble, '親カテゴリ'));
            centralGroups.forEach(group => {
                if (group.parentId !== root.id) throw new Error('中央カテゴリの親カテゴリが不正です');
                group.bubbles.forEach(bubble => {
                    const childGroup = requireUniqueChild(group, bubble, '中央カテゴリ');
                    if (childGroup.bubbles.some(childBubble => childBubble.childId)) {
                        throw new Error('下位カテゴリからさらに下のカテゴリへ接続されています');
                    }
                });
            });

            if (referencedIds.size !== groups.length) throw new Error('親カテゴリから到達できないカテゴリがあります');
            const entryGroup = db[String(entryGroupId || '')];
            const entryBubble = entryGroup && entryGroup.bubbles.find(bubble => bubble.id === String(entryBubbleId || ''));
            if (!entryGroup || entryGroup.parentId !== root.id || !entryBubble) {
                throw new Error('入力意見の中央カテゴリまたはバブルが階層内にありません');
            }
            if (!entryBubble.childId || !db[entryBubble.childId] || db[entryBubble.childId].parentId !== entryGroup.id) {
                throw new Error('入力意見バブルに固有の下位カテゴリ接続がありません');
            }
        }

        function validateGeneratedTopology(db, entryGroupId, entryBubbleId) {
            const groups = Object.values(db);
            const roots = groups.filter(group => group.parentId === null);
            if (roots.length !== 1) throw new Error('親カテゴリは1つだけ必要です');
            const root = roots[0];
            if (root.level !== 'root' || root.bubbles.length < 2) throw new Error('上位カテゴリの構造が不正です');
            const referencedIds = new Set([root.id]);
            root.bubbles.forEach(bubble => {
                if (!bubble.childId || !db[bubble.childId]) throw new Error('親カテゴリの中央カテゴリ接続がありません');
                const central = db[bubble.childId];
                if (central.level !== 'central' || central.parentId !== root.id || central.parentBubbleId !== bubble.id) {
                    throw new Error('中央カテゴリの親接続が不正です');
                }
                if (referencedIds.has(central.id)) throw new Error('中央カテゴリが重複しています');
                referencedIds.add(central.id);
            });
            if (referencedIds.size !== groups.length) throw new Error('親カテゴリから到達できない中央カテゴリがあります');
            const entryGroup = db[String(entryGroupId || '')];
            const entryBubble = entryGroup && entryGroup.bubbles.find(bubble => bubble.id === String(entryBubbleId || ''));
            if (!entryGroup || entryGroup.level !== 'central' || entryGroup.parentId !== root.id || !entryBubble) {
                throw new Error('入力意見の中央カテゴリまたはバブルが階層内にありません');
            }
        }

        function normalizeGeneratedUniverse(raw, options = {}) {
            if (!raw || !Array.isArray(raw.groups) || raw.groups.length === 0) throw new Error('API応答にグループがありません');
            const allowSyntheticFallback = options.allowSyntheticFallback === true;
            const topologyOnly = options.topologyOnly === true;
            const groups = raw.groups;
            const groupIds = new Set();
            const bubbleIds = new Set();
            groups.forEach(group => {
                if (!group || !group.id || groupIds.has(group.id)) throw new Error('グループIDが不正です');
                if (!OPENAI_GROUP_TYPES.includes(group.type)) throw new Error('バブル群の型が不正です');
                if (!Array.isArray(group.bubbles) || group.bubbles.length < 1 || group.bubbles.length > 10) {
                    const error = new Error('バブル数が不正です');
                    error.code = 'API_INVALID_BUBBLE_COUNT';
                    throw error;
                }
                groupIds.add(String(group.id));
            });
            if (!allowSyntheticFallback && groups.some(group => group.bubbles.length > 10)) {
                const error = new Error('API応答のバブル数が最大10個を超えています');
                error.code = 'API_INVALID_BUBBLE_COUNT';
                throw error;
            }
            const db = {};
            const declaredParentIds = new Map();
            groups.forEach(group => {
                const weightedBubbles = normalizeBubblePercentages(group.bubbles);
                const bubbles = weightedBubbles.map((bubble, index) => {
                    if (!bubble || !bubble.id || bubbleIds.has(bubble.id)) throw new Error('バブルIDが不正です');
                    bubbleIds.add(String(bubble.id));
                    const numericColor = normalizeColor(bubble.color, colorFromText(String(bubble.name || bubble.id)));
                    const pos = Array.isArray(bubble.pos) && bubble.pos.length === 3 ? bubble.pos.map(value => Math.max(-90, Math.min(90, Number(value) || 0))) : [0, 0, 0];
                    return {
                        id: String(bubble.id), name: String(bubble.name || '名称未設定'), size: bubble.size,
                        color: numericColor, htmlColor: normalizeHtmlColor(bubble.htmlColor, numericColor), pos,
                        childId: bubble.childId ? String(bubble.childId) : null, desc: String(bubble.desc || '公開情報から生成された説明です。'),
                        isEstimated: bubble.isEstimated !== false, confidence: Math.max(0, Math.min(1, Number(bubble.confidence) || 0)),
                        analysis: normalizeAnalysis(bubble.analysis), sources: normalizeSources(bubble.sources)
                    };
                });
                ensureDistinctBubbleColors(bubbles);
                separateBubblePositions(bubbles);
                const groupId = String(group.id);
                const declaredParentId = group.parentId === null ? null : String(group.parentId || '');
                const level = allowSyntheticFallback ? null : String(group.level || '');
                const parentBubbleId = allowSyntheticFallback
                    ? null
                    : (group.parentBubbleId === null || group.parentBubbleId === undefined ? null : String(group.parentBubbleId || ''));
                if (!allowSyntheticFallback && !OPENAI_GROUP_LEVELS.includes(level)) {
                    throw new Error('グループのlevelが不正です');
                }
                if (!allowSyntheticFallback && level === 'root' && parentBubbleId !== null) {
                    throw new Error('親カテゴリのparentBubbleIdはnullである必要があります');
                }
                if (allowSyntheticFallback && declaredParentId !== null && !groupIds.has(declaredParentId)) {
                    throw new Error('グループのparentIdが不正です');
                }
                declaredParentIds.set(groupId, declaredParentId);
                db[groupId] = {
                    id: groupId, title: String(group.title || group.id), type: group.type,
                    level, parentBubbleId,
                    parentId: allowSyntheticFallback ? declaredParentId : null,
                    desc: String(group.desc || ''), bubbles
                };
            });
            Object.values(db).forEach(group => group.bubbles.forEach(bubble => {
                if (bubble.childId && !groupIds.has(bubble.childId)) {
                    if (allowSyntheticFallback) bubble.childId = null;
                }
            }));
            if (!allowSyntheticFallback) canonicalizeGeneratedLinks(db, declaredParentIds, { requireLeafLinks: !topologyOnly });
            const entryGroupId = String(raw.entryGroupId || '');
            const entryBubbleId = String(raw.entryBubbleId || '');
            const entryGroup = db[entryGroupId];
            const entryBubble = entryGroup && entryGroup.bubbles.find(bubble => bubble.id === entryBubbleId);
            const parentGroup = entryGroup && entryGroup.parentId ? db[entryGroup.parentId] : null;
            if (!entryGroup || !entryBubble || !parentGroup || parentGroup.parentId !== null) {
                throw new Error('entryGroupIdは入力意見を含む中間カテゴリである必要があります');
            }
            if (parentGroup.bubbles.length < 2) throw new Error('上位カテゴリのバブルが不足しています');
            if (allowSyntheticFallback) {
                let repairedChildLinks = false;
                const ensureDirectChildren = (group) => {
                const usedChildIds = new Set();
                const directChildren = () => Object.values(db).filter(child => child.parentId === group.id);
                group.bubbles.forEach((bubble, index) => {
                    const linkedGroup = bubble.childId && db[bubble.childId];
                    if (linkedGroup && linkedGroup.parentId === group.id && !usedChildIds.has(linkedGroup.id)) {
                        usedChildIds.add(linkedGroup.id);
                        return;
                    }
                    const reusableGroup = directChildren().find(child => !usedChildIds.has(child.id));
                    if (reusableGroup) {
                        bubble.childId = reusableGroup.id;
                        usedChildIds.add(reusableGroup.id);
                        repairedChildLinks = true;
                        return;
                    }
                    const generatedGroup = createFallbackChildGroup(group, bubble, index);
                    db[generatedGroup.id] = generatedGroup;
                    bubble.childId = generatedGroup.id;
                    usedChildIds.add(generatedGroup.id);
                    repairedChildLinks = true;
                });
                return group.bubbles.map(bubble => db[bubble.childId]).filter(Boolean);
                };

                // 固定DBだけは、API失敗時にも探索できるよう不足接続を補完する。
                if (!parentGroup.bubbles.some(bubble => bubble.childId === entryGroupId)) {
                    const anchor = parentGroup.bubbles.find(bubble => !bubble.childId || !db[bubble.childId] || db[bubble.childId].parentId !== parentGroup.id)
                        || parentGroup.bubbles[0];
                    anchor.childId = entryGroupId;
                    repairedChildLinks = true;
                }

                const centralGroups = ensureDirectChildren(parentGroup);
                centralGroups.forEach(group => ensureDirectChildren(group));

                const repairedChildIds = entryGroup.bubbles.map(bubble => bubble.childId);
                const repairedChildGroups = Object.values(db).filter(group => group.parentId === entryGroupId && repairedChildIds.includes(group.id));
                if (repairedChildIds.some(childId => !childId) || new Set(repairedChildIds).size !== entryGroup.bubbles.length || repairedChildGroups.length !== entryGroup.bubbles.length) {
                    throw new Error('固定DBの中央カテゴリに下位カテゴリ接続が必要です');
                }
                if (!entryBubble.childId || !repairedChildGroups.some(group => group.id === entryBubble.childId)) {
                    throw new Error('固定DBの入力意見バブルに下位カテゴリ接続が必要です');
                }
                if (repairedChildLinks) apiWarn('固定DBのカテゴリ階層を補完しました', { entryGroupId, centralGroupCount: centralGroups.length });
            } else if (topologyOnly) {
                validateGeneratedTopology(db, entryGroupId, entryBubbleId);
            } else {
                // APIデータは、入力意見以外の経路も含めて全階層が実データで
                // 構成されている場合だけ受け入れる。補完・再割り当てはしない。
                validateGeneratedHierarchy(db, entryGroupId, entryBubbleId);
            }

            // 親カテゴリから到達できない余分なグループを除去し、各バブル群を一つの木にする。
            const connectedIds = new Set([parentGroup.id]);
            const pendingIds = [parentGroup.id];
            while (pendingIds.length) {
                const currentId = pendingIds.shift();
                const currentGroup = db[currentId];
                if (!currentGroup) continue;
                currentGroup.bubbles.forEach(bubble => {
                    if (bubble.childId && db[bubble.childId] && !connectedIds.has(bubble.childId)) {
                        connectedIds.add(bubble.childId);
                        pendingIds.push(bubble.childId);
                    }
                });
            }
            Object.keys(db).forEach(id => { if (!connectedIds.has(id)) delete db[id]; });
            Object.values(db).forEach(group => group.bubbles.forEach(bubble => {
                if (bubble.childId && !db[bubble.childId]) bubble.childId = null;
            }));
            return { db, entryGroupId, entryBubbleId: entryBubble.id };
        }

        function buildOpenAIRootRequest(input, options = {}) {
            const repairInstruction = options.repair
                ? '\n- 前回のroot応答を検証できませんでした。rootだけを再生成し、childIdを必ずnullにしてください。'
                : '';
            const prompt = `ユーザーの意見: ${input}\n\nWeb Searchを使って、入力意見を含むテーマ全体の最上位カテゴリだけを生成してください。\n- groupsはroot 1つだけにし、rootのバブルは2〜${OPENAI_STRUCTURE_MAX_BUBBLES}個の意味的に異なる上位分類にしてください。\n- ${OPENAI_GROUP_TYPE_GUIDANCE}\n- rootバブル名は下位候補を列挙せず、全体を包む短い名称にしてください。原則24文字以内にし、「・」「、」などで3つ以上の候補を並べないでください。\n- 入力意見が意味的に属するrootバブルを1つ選び、その実在するバブルIDをentryRootBubbleIdに設定してください。entryRootBubbleIdは必須で、曖昧でもnullにしてはいけません。\n- levelはroot、parentIdとparentBubbleIdはnull、すべてのchildIdはnullにしてください。中央・下位カテゴリはこの要求では生成しないでください。\n- 入力意見の経路だけを特別扱いせず、あとで各rootバブルを同じ調査深度で展開できる分類軸にしてください。\n- カテゴリ名・バブル名は具体的な意味内容を持たせ、テンプレート名、機械的な接尾辞、代表的な系統などの汎用ラベルは禁止です。\n- 全IDは一意な短いASCII文字列にし、analysis、metrics、sourcesは生成しないでください。JSON Schema以外の文章は出力しないでください。${repairInstruction}`;
            return {
                model: OPENAI_MODEL, store: false, reasoning: { effort: 'low' }, max_output_tokens: 7000,
                tool_choice: 'required',
                tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' } }],
                input: [
                    { role: 'system', content: [{ type: 'input_text', text: 'あなたはBubbleBreakerのrootカテゴリ生成エンジンです。rootだけを具体的に返し、下位階層やテンプレートによる穴埋めをしないでください。' }] },
                    { role: 'user', content: [{ type: 'input_text', text: prompt }] }
                ],
                text: { format: { type: 'json_schema', name: 'bubble_universe_root', strict: true, schema: OPENAI_ROOT_RESPONSE_SCHEMA } }
            };
        }

        function buildOpenAICentralGroupRequest(input, rootGroup, rootBubble, options = {}) {
            const isEntryBranch = options.isEntryBranch === true;
            const repairInstruction = options.repair
                ? `\n- 前回のcentral応答を検証できませんでした。指定されたrootバブルだけを親として、central groupを1つ再生成してください。${isEntryBranch ? '入力意見に対応するentryBubbleIdも実在確認してください。' : 'entryBubbleIdはnullにしてください。'}`
                : '';
            const entryInstruction = isEntryBranch
                ? '- このcentralはroot段階で入力意見の所属先として指定された枝です。入力意見に対応するcentralバブルを必ず1つ含め、その実在IDをentryBubbleIdに設定してください。'
                : '- このcentralは入力意見の所属先ではありません。entryBubbleIdは必ずnullにし、入力意見バブルを作らないでください。';
            const prompt = `ユーザーの意見: ${input}\nrootカテゴリ: ${rootGroup.title}（${rootGroup.id}）\n展開対象のrootバブル: ${rootBubble.name}（${rootBubble.id}）\n\nWeb Searchを使って、指定されたrootバブルの直下にあるcentralカテゴリを1つだけ生成してください。\n- groupsはcentral 1つだけにし、levelはcentral、parentIdは${rootGroup.id}、parentBubbleIdは${rootBubble.id}と完全一致させてください。\n- centralのバブルは2〜${OPENAI_STRUCTURE_MAX_BUBBLES}個の具体的な、互いに意味の異なる内容にしてください。各childIdはnullにしてください。\n- ${OPENAI_GROUP_TYPE_GUIDANCE}\n- centralバブル名は下位候補をすべて列挙せず、意味を包む短い名称にしてください。原則24文字以内にし、「・」「、」などで3つ以上の候補を並べないでください。\n${entryInstruction}\n- rootバブルの意味に直接包含される一段下だけを生成し、二段下の内容をcentralバブルに混ぜないでください。\n- 入力意見の経路だけを特別扱いせず、他のrootバブルと同じ具体性で生成してください。テンプレート名、親名への機械的な接尾辞、汎用ラベルは禁止です。\n- 全IDは一意な短いASCII文字列にし、analysis、metrics、sourcesは生成しないでください。JSON Schema以外の文章は出力しないでください。${repairInstruction}`;
            return {
                model: OPENAI_MODEL, store: false, reasoning: { effort: 'low' }, max_output_tokens: 7000,
                tool_choice: 'required',
                tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' } }],
                input: [
                    { role: 'system', content: [{ type: 'input_text', text: 'あなたはBubbleBreakerのcentralカテゴリ生成エンジンです。指定されたrootバブルの直下だけを、意味的に具体的な実データ分類として生成してください。' }] },
                    { role: 'user', content: [{ type: 'input_text', text: prompt }] }
                ],
                text: { format: { type: 'json_schema', name: 'bubble_universe_central_group', strict: true, schema: OPENAI_CENTRAL_RESPONSE_SCHEMA } }
            };
        }

        function buildOpenAILeafGroupRequest(input, centralGroup, centralBubble, options = {}) {
            const repairInstruction = options.repair
                ? '\n- 前回のleaf応答を検証できませんでした。指定されたcentralバブルだけを親として、leaf groupを1つ再生成してください。'
                : '';
            const prompt = `ユーザーの意見: ${input}\ncentralカテゴリ: ${centralGroup.title}（${centralGroup.id}）\n展開対象のcentralバブル: ${centralBubble.name}（${centralBubble.id}）\n\nWeb Searchを使って、指定されたcentralバブルの直下にあるleafカテゴリを1つだけ生成してください。\n- groupsはleaf 1つだけにし、levelはleaf、parentIdは${centralGroup.id}、parentBubbleIdは${centralBubble.id}と完全一致させてください。\n- leafのバブルは2〜${OPENAI_STRUCTURE_MAX_BUBBLES}個の、親バブルに意味的に包含される具体的な選択肢・方式・製品・作品・派閥などにしてください。各childIdはnullにしてください。\n- ${OPENAI_GROUP_TYPE_GUIDANCE}\n- centralバブルより一段下の内容だけを生成し、親の説明や二段上の分類をそのまま繰り返さないでください。\n- 入力意見の経路だけを特別扱いせず、すべてのcentralバブルを同じ調査深度・具体性で生成してください。テンプレート名、親名への機械的な接尾辞、汎用ラベルは禁止です。\n- 全IDは一意な短いASCII文字列にし、analysis、metrics、sourcesは生成しないでください。JSON Schema以外の文章は出力しないでください。${repairInstruction}`;
            return {
                model: OPENAI_MODEL, store: false, reasoning: { effort: 'low' }, max_output_tokens: 7000,
                tool_choice: 'required',
                tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' } }],
                input: [
                    { role: 'system', content: [{ type: 'input_text', text: 'あなたはBubbleBreakerのleafカテゴリ生成エンジンです。指定されたcentralバブルの直下だけを具体的に返し、テンプレートで補完しないでください。' }] },
                    { role: 'user', content: [{ type: 'input_text', text: prompt }] }
                ],
                text: { format: { type: 'json_schema', name: 'bubble_universe_leaf_group', strict: true, schema: OPENAI_LEAF_RESPONSE_SCHEMA_V2 } }
            };
        }

        function buildOpenAIBubbleAnalysisRequest(bubble, group, input, options = {}) {
            const repairInstruction = options.repair
                ? '\n前回の応答を検証できなかったため、今回は必ず指定スキーマのJSONオブジェクトだけを返してください。4セクションすべてを埋め、metricsのvalueは数値、sourcesのurlは完全なhttp(s) URLにしてください。'
                : '';
            const prompt = `ユーザーの意見: ${input}\n所属カテゴリ: ${group.title}\n対象バブル: ${bubble.name}\n対象バブルの説明: ${bubble.desc || 'なし'}\n\nWeb Searchを使い、対象バブルだけの分析を生成してください。overview、history、demographic、evaluationの各summary・insight・metricsを具体的な公開情報に基づいて作成し、参照した公開ソースをsourcesに入れてください。分析項目名をバブル名にせず、根拠が足りない値はisEstimated=trueにしてください。JSON Schema以外の文章は出力しないでください。${repairInstruction}`;
            return {
                model: OPENAI_MODEL,
                store: false,
                reasoning: { effort: 'low' },
                max_output_tokens: options.repair ? 6500 : 5000,
                tool_choice: 'required',
                tools: [{ type: 'web_search', search_context_size: 'medium', user_location: { type: 'approximate', country: 'JP', timezone: 'Asia/Tokyo' } }],
                input: [
                    { role: 'system', content: [{ type: 'input_text', text: 'あなたはBubbleBreakerのバブル分析エンジンです。対象バブル以外の階層を生成せず、公開情報と推定を区別した短い構造化分析を返してください。' }] },
                    { role: 'user', content: [{ type: 'input_text', text: prompt }] }
                ],
                text: { format: { type: 'json_schema', name: 'bubble_analysis', strict: true, schema: OPENAI_BUBBLE_ANALYSIS_RESPONSE_SCHEMA } }
            };
        }

        async function fetchWithTimeout(url, options, timeoutMs = OPENAI_STRUCTURE_TIMEOUT_MS) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                return await fetch(url, { ...options, signal: controller.signal });
            } catch (error) {
                if (controller.signal.aborted) {
                    const timeoutError = new Error(`OpenAI APIが${timeoutMs / 1000}秒以内に応答しませんでした`);
                    timeoutError.code = 'API_TIMEOUT';
                    timeoutError.timeoutMs = timeoutMs;
                    timeoutError.cause = error;
                    throw timeoutError;
                }
                const networkError = new Error(error && error.message ? error.message : 'OpenAI APIへのネットワーク接続に失敗しました');
                networkError.code = 'API_NETWORK_ERROR';
                networkError.cause = error;
                throw networkError;
            }
            finally { clearTimeout(timer); }
        }

        function extractResponseText(response) {
            if (typeof response.output_text === 'string') return response.output_text;
            const output = Array.isArray(response.output) ? response.output : [];
            return output.flatMap(item => Array.isArray(item && item.content) ? item.content : [])
                .filter(item => item && (item.type === 'output_text' || typeof item.text === 'string'))
                .map(item => String(item.text || ''))
                .join('');
        }

        function isRetryableAnalysisError(error) {
            if (!error) return true;
            if (error.status === 401 || error.status === 403) return false;
            if (error.code === 'API_ABORTED_BY_USER') return false;
            return true;
        }

        function waitForAnalysisRetry(delayMs) {
            return new Promise(resolve => setTimeout(resolve, delayMs));
        }

        async function requestOpenAIJson(requestBody, timeoutMs, stage) {
            const startedAt = performance.now();
            const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
                body: JSON.stringify(requestBody)
            }, timeoutMs);
            const requestId = response.headers.get('x-request-id');
            const elapsedMs = Math.round(performance.now() - startedAt);
            if (!response.ok) {
                const errorBody = redactApiLog(truncateApiLog(await response.text()));
                const error = new Error(`OpenAI API ${response.status}`);
                error.status = response.status;
                error.requestId = requestId;
                error.body = errorBody;
                error.stage = stage;
                throw error;
            }
            const payload = await response.json();
            const text = extractResponseText(payload);
            const incompleteReason = payload.incomplete_details && payload.incomplete_details.reason ? payload.incomplete_details.reason : null;
            if (payload.status === 'incomplete' || incompleteReason) {
                const error = new Error(`OpenAI APIの${stage}出力が未完了です${incompleteReason ? `（${incompleteReason}）` : ''}`);
                error.code = 'API_INCOMPLETE_OUTPUT';
                error.reason = incompleteReason;
                error.stage = stage;
                throw error;
            }
            if (!text) {
                const error = new Error(`OpenAI APIの${stage}出力が空です`);
                error.code = 'API_EMPTY_OUTPUT';
                error.stage = stage;
                throw error;
            }
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (parseError) {
                const error = new Error(`${stage} JSON解析に失敗しました: ${parseError.message}`);
                error.code = 'API_JSON_PARSE_ERROR';
                error.cause = parseError;
                error.stage = stage;
                throw error;
            }
            apiLog('API構造化応答を受信しました', { stage, status: response.status, requestId, elapsedMs, outputTextLength: text.length });
            return { parsed, requestId, elapsedMs };
        }

        function markHierarchyError(error, stage) {
            if (!error.code && error.message.includes('バブル数')) error.code = 'API_INVALID_BUBBLE_COUNT';
            if (!error.code) error.code = 'API_INVALID_UNIVERSE';
            error.stage = stage;
            return error;
        }

        function compactHierarchyBubbleName(value, level) {
            const name = String(value || '').replace(/\s+/g, ' ').trim();
            if (!name || !['root', 'central'].includes(level)) return name || '名称未設定';
            const limit = 24;
            const segments = name.split(/[・、,，／/|]/).map(segment => segment.trim()).filter(Boolean);
            if (segments.length >= 3) {
                const compact = `${segments.slice(0, 2).join('・')}など`;
                return compact.length <= limit ? compact : `${segments[0].slice(0, limit - 2)}など`;
            }
            if (name.length <= limit) return name;
            if (segments.length > 1) {
                const compact = `${segments[0]}など`;
                return compact.length <= limit ? compact : `${segments[0].slice(0, limit - 2)}など`;
            }
            return `${name.slice(0, limit - 1)}…`;
        }

        function validateStageGroup(group, expectedLevel, expectedParentId, expectedParentBubbleId) {
            if (!group || !group.id || !group.title || !group.level) throw new Error(`${expectedLevel}カテゴリの構造が空です`);
            if (group.level !== expectedLevel) throw new Error(`${expectedLevel}カテゴリのlevelが不正です`);
            const expectedParent = expectedParentId === null ? null : String(expectedParentId);
            const expectedParentBubble = expectedParentBubbleId === null ? null : String(expectedParentBubbleId);
            if ((group.parentId === null ? null : String(group.parentId)) !== expectedParent) {
                throw new Error(`${expectedLevel}カテゴリのparentIdが不正です`);
            }
            if ((group.parentBubbleId === null ? null : String(group.parentBubbleId)) !== expectedParentBubble) {
                throw new Error(`${expectedLevel}カテゴリのparentBubbleIdが不正です`);
            }
            if (!Array.isArray(group.bubbles) || group.bubbles.length < 2 || group.bubbles.length > OPENAI_STRUCTURE_MAX_BUBBLES) {
                throw new Error(`${expectedLevel}カテゴリのバブル数が不正です`);
            }
            const bubbleIds = new Set();
            group.bubbles.forEach(bubble => {
                if (!bubble || !bubble.id || bubbleIds.has(String(bubble.id))) throw new Error(`${expectedLevel}カテゴリのバブルIDが不正です`);
                if (bubble.childId !== null) throw new Error(`${expectedLevel}カテゴリのchildIdはnullである必要があります`);
                bubbleIds.add(String(bubble.id));
            });
            return {
                ...group,
                id: String(group.id),
                parentId: expectedParent,
                parentBubbleId: expectedParentBubble,
                bubbles: group.bubbles.map(bubble => ({
                    ...bubble,
                    id: String(bubble.id),
                    name: compactHierarchyBubbleName(bubble.name, expectedLevel),
                    childId: null
                }))
            };
        }

        // central/leafは別リクエストで生成されるため、モデルが各応答で
        // 同じ短いIDを再利用しても、全体マージ時に衝突しないようにする。
        // モデルIDは段階内の対応確認にだけ使い、統合後はこの正規IDを使う。
        function canonicalizeStageGroupIds(group, canonicalGroupId, canonicalParentId, canonicalParentBubbleId) {
            const modelToCanonicalBubbleId = new Map();
            const bubbles = group.bubbles.map((bubble, index) => {
                const canonicalBubbleId = `${canonicalGroupId}_b${index + 1}`;
                modelToCanonicalBubbleId.set(bubble.id, canonicalBubbleId);
                return { ...bubble, id: canonicalBubbleId, childId: null };
            });
            return {
                group: {
                    ...group,
                    id: canonicalGroupId,
                    parentId: canonicalParentId,
                    parentBubbleId: canonicalParentBubbleId,
                    bubbles
                },
                modelToCanonicalBubbleId
            };
        }

        function isRetryableHierarchyError(error) {
            return error.code === 'API_TIMEOUT' || error.code === 'API_NETWORK_ERROR' || error.code === 'API_INCOMPLETE_OUTPUT' || error.code === 'API_JSON_PARSE_ERROR' || error.code === 'API_EMPTY_OUTPUT' || error.code === 'API_INVALID_BUBBLE_COUNT' || error.code === 'API_INVALID_UNIVERSE' || error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500;
        }

        async function requestStage(stage, buildRequest, validate) {
            let lastError = null;
            for (let attempt = 0; attempt < OPENAI_STRUCTURE_MAX_ATTEMPTS; attempt++) {
                try {
                    const result = await requestOpenAIJson(buildRequest({ repair: attempt > 0 }), OPENAI_STRUCTURE_TIMEOUT_MS, stage);
                    try {
                        return validate(result.parsed);
                    } catch (error) {
                        throw markHierarchyError(error, stage);
                    }
                } catch (error) {
                    lastError = error;
                    const retryable = isRetryableHierarchyError(error);
                    apiWarn('階層生成API試行に失敗しました', { stage, attempt: attempt + 1, maxAttempts: OPENAI_STRUCTURE_MAX_ATTEMPTS, code: error.code || null, message: redactApiLog(error.message), retryable });
                    if (!retryable || attempt === OPENAI_STRUCTURE_MAX_ATTEMPTS - 1) break;
                    await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
                }
            }
            throw lastError || new Error(`${stage}カテゴリを生成できませんでした`);
        }

        async function requestRootGroup(input) {
            const result = await requestStage('root', options => buildOpenAIRootRequest(input, options), parsed => {
                if (!parsed || !Array.isArray(parsed.groups) || parsed.groups.length !== 1) throw new Error('rootカテゴリは1つだけ必要です');
                const group = validateStageGroup(parsed.groups[0], 'root', null, null);
                const entryRootBubbleId = parsed.entryRootBubbleId == null ? '' : String(parsed.entryRootBubbleId);
                if (!entryRootBubbleId || !group.bubbles.some(bubble => bubble.id === entryRootBubbleId)) {
                    throw new Error('entryRootBubbleIdがrootバブルに存在しません');
                }
                const canonicalized = canonicalizeStageGroupIds(group, 'root', null, null);
                return {
                    group: canonicalized.group,
                    entryRootBubbleId: canonicalized.modelToCanonicalBubbleId.get(entryRootBubbleId)
                };
            });
            apiLog('rootカテゴリを確定しました', { groupId: result.group.id, bubbleCount: result.group.bubbles.length, entryRootBubbleId: result.entryRootBubbleId });
            return result;
        }

        async function requestCentralGroup(input, rootGroup, rootBubble, isEntryBranch) {
            const result = await requestStage('central', options => buildOpenAICentralGroupRequest(input, rootGroup, rootBubble, { ...options, isEntryBranch }), parsed => {
                if (!parsed || !Array.isArray(parsed.groups) || parsed.groups.length !== 1) throw new Error('centralカテゴリは1つだけ必要です');
                const group = validateStageGroup(parsed.groups[0], 'central', rootGroup.id, rootBubble.id);
                const entryBubbleId = parsed.entryBubbleId == null ? null : String(parsed.entryBubbleId);
                if (isEntryBranch && !entryBubbleId) throw new Error('入力意見のcentralバブルが指定されていません');
                if (!isEntryBranch && entryBubbleId) throw new Error('入力意見ではないcentralにentryBubbleIdがあります');
                if (entryBubbleId && !group.bubbles.some(bubble => bubble.id === entryBubbleId)) throw new Error('entryBubbleIdがcentralバブルに存在しません');
                const canonicalized = canonicalizeStageGroupIds(group, `central_${rootBubble.id}`, rootGroup.id, rootBubble.id);
                return {
                    group: canonicalized.group,
                    entryBubbleId: entryBubbleId ? canonicalized.modelToCanonicalBubbleId.get(entryBubbleId) : null
                };
            });
            apiLog('centralカテゴリを確定しました', { groupId: result.group.id, parentBubbleId: rootBubble.id, bubbleCount: result.group.bubbles.length, isEntryBranch, hasEntryBubble: Boolean(result.entryBubbleId) });
            return result;
        }

        async function requestLeafGroup(input, centralGroup, centralBubble) {
            const result = await requestStage('leaf', options => buildOpenAILeafGroupRequest(input, centralGroup, centralBubble, options), parsed => {
                if (!parsed || !Array.isArray(parsed.groups) || parsed.groups.length !== 1) throw new Error('leafカテゴリは1つだけ必要です');
                const group = validateStageGroup(parsed.groups[0], 'leaf', centralGroup.id, centralBubble.id);
                return canonicalizeStageGroupIds(group, `leaf_${centralBubble.id}`, centralGroup.id, centralBubble.id).group;
            });
            apiLog('leafカテゴリを確定しました', { groupId: result.id, parentBubbleId: centralBubble.id, bubbleCount: result.bubbles.length });
            return result;
        }

        async function runWithConcurrency(items, limit, worker) {
            const results = new Array(items.length);
            let nextIndex = 0;
            const runWorker = async () => {
                while (true) {
                    const index = nextIndex++;
                    if (index >= items.length) return;
                    results[index] = await worker(items[index], index);
                }
            };
            await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
            return results;
        }

        async function requestDynamicUniverse(input) {
            activeAnalysisInput = String(input || '');
            bubbleAnalysisRequests.clear();
            if (!apiKeyConfigured) {
                apiWarn('階層生成APIをスキップします（APIキー未設定）');
                return null;
            }
            const generationProgress = { root: false, centralCount: 0, leafCount: 0 };
            try {
                // 依存関係を固定する: root確定 → rootの各バブルのcentral確定
                // → 各centralバブルのleaf確定。siblingsだけを並列化する。
                const rootResult = await requestRootGroup(activeAnalysisInput);
                generationProgress.root = true;
                const root = rootResult.group;
                const centralResults = await runWithConcurrency(root.bubbles, 3, rootBubble => requestCentralGroup(activeAnalysisInput, root, rootBubble, rootBubble.id === rootResult.entryRootBubbleId));
                generationProgress.centralCount = centralResults.length;
                const entryResults = centralResults.filter(result => result.entryBubbleId);
                if (entryResults.length !== 1) throw new Error('入力意見を含むcentralカテゴリは1つだけ必要です');
                const entryResult = entryResults[0];
                const centralGroups = centralResults.map(result => result.group);
                root.bubbles.forEach((bubble, index) => { bubble.childId = centralGroups[index].id; });

                const leafRequests = centralGroups.flatMap(centralGroup => centralGroup.bubbles.map(centralBubble => ({ centralGroup, centralBubble })));
                const leafGroups = await runWithConcurrency(leafRequests, 3, ({ centralGroup, centralBubble }) => requestLeafGroup(activeAnalysisInput, centralGroup, centralBubble));
                generationProgress.leafCount = leafGroups.length;
                const leafByParentBubble = new Map(leafRequests.map((request, index) => [request.centralBubble.id, leafGroups[index]]));
                centralGroups.forEach(centralGroup => centralGroup.bubbles.forEach(bubble => {
                    const leafGroup = leafByParentBubble.get(bubble.id);
                    if (!leafGroup) throw new Error('親バブルに対応する下位カテゴリがありません');
                    bubble.childId = leafGroup.id;
                }));

                const mergedGroups = [root, ...centralGroups, ...leafGroups];
                const universe = normalizeGeneratedUniverse({
                    groups: mergedGroups,
                    entryGroupId: entryResult.group.id,
                    entryBubbleId: entryResult.entryBubbleId
                });
                apiLog('root → central → leafの段階生成と検証に成功しました', { groupCount: Object.keys(universe.db).length, centralGroupCount: centralGroups.length, leafGroupCount: leafGroups.length });
                return universe;
            } catch (error) {
                apiWarn('段階生成したカテゴリを確定できないため固定DBへフォールバックします', {
                    stage: error.stage || 'hierarchy-merge',
                    code: error.code || 'API_INVALID_UNIVERSE',
                    centralGroupId: error.centralGroupId || null,
                    errorName: error.name || 'Error',
                    message: redactApiLog(error.message || '不明なエラー'),
                    generationProgress
                });
                return null;
            }
        }

        async function requestBubbleAnalysis(bubble, group, input = activeAnalysisInput) {
            if (!bubble || !group || !apiKeyConfigured) return null;
            const bubbleId = String(bubble.id || '');
            if (!bubbleId) return null;
            if (bubbleAnalysisRequests.has(bubbleId)) return bubbleAnalysisRequests.get(bubbleId);
            let request;
            request = (async () => {
                const startedAt = performance.now();
                bubble.analysisStatus = 'loading';
                if (typeof window.refreshAnalysisView === 'function') window.refreshAnalysisView(bubbleId);
                for (let attempt = 1; attempt <= OPENAI_ANALYSIS_MAX_ATTEMPTS; attempt++) {
                    let requestId = null;
                    try {
                        const response = await fetchWithTimeout('https://api.openai.com/v1/responses', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
                            body: JSON.stringify(buildOpenAIBubbleAnalysisRequest(bubble, group, String(input || ''), { repair: attempt > 1 }))
                        }, OPENAI_ANALYSIS_TIMEOUT_MS);
                        requestId = response.headers.get('x-request-id');
                        if (!response.ok) {
                            const errorBody = redactApiLog(truncateApiLog(await response.text()));
                            const error = new Error(`OpenAI API ${response.status}`);
                            error.status = response.status;
                            error.requestId = requestId;
                            error.body = errorBody;
                            throw error;
                        }
                        const payload = await response.json();
                        const incompleteReason = payload && payload.incomplete_details && payload.incomplete_details.reason;
                        if (payload && (payload.status === 'incomplete' || incompleteReason)) {
                            const error = new Error(`OpenAI APIの分析出力が未完了です${incompleteReason ? `（${incompleteReason}）` : ''}`);
                            error.code = 'API_INCOMPLETE_OUTPUT';
                            error.reason = incompleteReason || null;
                            error.requestId = requestId;
                            throw error;
                        }
                        const text = extractResponseText(payload);
                        if (!text) {
                            const error = new Error('OpenAI APIの分析出力が空です');
                            error.code = 'API_EMPTY_OUTPUT';
                            throw error;
                        }
                        let parsed;
                        try {
                            parsed = JSON.parse(text);
                        } catch (parseError) {
                            const error = new Error(`バブル分析JSON解析に失敗しました: ${parseError.message}`);
                            error.code = 'API_JSON_PARSE_ERROR';
                            error.cause = parseError;
                            throw error;
                        }
                        if (!parsed || !parsed.analysis || typeof parsed.analysis !== 'object') {
                            const error = new Error('バブル分析のanalysisオブジェクトがありません');
                            error.code = 'API_INVALID_ANALYSIS';
                            throw error;
                        }
                        bubble.analysis = normalizeAnalysis(parsed.analysis);
                        bubble.sources = normalizeSources(parsed.sources);
                        bubble.analysisStatus = 'ready';
                        apiLog('バブル分析の遅延生成に成功', { bubbleId, groupId: group.id, attempt, requestId, elapsedMs: Math.round(performance.now() - startedAt) });
                        if (typeof window.refreshAnalysisView === 'function') window.refreshAnalysisView(bubbleId);
                        return { analysis: bubble.analysis, sources: bubble.sources };
                    } catch (error) {
                        const retryable = isRetryableAnalysisError(error);
                        apiWarn('バブル分析の生成に失敗しました。再試行を判定します', {
                            bubbleId, groupId: group.id, attempt, maxAttempts: OPENAI_ANALYSIS_MAX_ATTEMPTS,
                            retryable, requestId: error.requestId || requestId || null,
                            code: error.code || null, status: error.status || null,
                            timeoutMs: error.timeoutMs || null, body: error.body || null,
                            message: redactApiLog(error.message || '不明なエラー')
                        });
                        if (!retryable || attempt >= OPENAI_ANALYSIS_MAX_ATTEMPTS) break;
                        bubble.analysisStatus = 'loading';
                        if (typeof window.refreshAnalysisView === 'function') window.refreshAnalysisView(bubbleId);
                        await waitForAnalysisRetry(OPENAI_ANALYSIS_RETRY_DELAY_MS * attempt);
                    }
                }
                {
                    bubble.analysisStatus = 'error';
                    if (typeof window.refreshAnalysisView === 'function') window.refreshAnalysisView(bubbleId);
                    if (bubbleAnalysisRequests.get(bubbleId) === request) bubbleAnalysisRequests.delete(bubbleId);
                    return null;
                }
            })();
            bubbleAnalysisRequests.set(bubbleId, request);
            return request;
        }

        async function requestBubbleGroupAnalyses(group, input = activeAnalysisInput) {
            if (!group || !Array.isArray(group.bubbles) || !apiKeyConfigured) return [];
            return runWithConcurrency(group.bubbles, 3, bubble => requestBubbleAnalysis(bubble, group, input));
        }
