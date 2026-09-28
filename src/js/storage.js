        // ==========================================
        // === ローカル探索履歴 (IndexedDB) ===
        // ==========================================
        const BUBBLE_SESSION_SCHEMA_VERSION = 1;
        const BUBBLE_SESSION_DATABASE_NAME = 'bubblebreaker-local';
        const BUBBLE_SESSION_STORE_NAME = 'explorations';
        const BUBBLE_SESSION_SAVE_DELAY_MS = 350;

        let activeBubbleSession = null;
        let bubbleSessionDatabasePromise = null;
        let bubbleSessionSaveWarningShown = false;
        const bubbleSessionByDatabase = new WeakMap();
        const latestDatabaseBySessionId = new Map();
        const bubbleSessionSaveTimers = new Map();

        function cloneBubbleSessionValue(value) {
            if (typeof structuredClone === 'function') return structuredClone(value);
            return JSON.parse(JSON.stringify(value));
        }

        function createBubbleSessionId() {
            if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
            return `exploration-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }

        function isBubbleSessionObject(value) {
            return Boolean(value && typeof value === 'object' && !Array.isArray(value));
        }

        function sanitizeBubbleSessionDatabase(db) {
            if (!isBubbleSessionObject(db)) return db;
            const seenBubbleIds = new Set();
            Object.entries(db).forEach(([groupId, group]) => {
                if (!isBubbleSessionObject(group) || !Array.isArray(group.bubbles)) return;
                const validBubbles = group.bubbles.filter(bubble => {
                    if (!isBubbleSessionObject(bubble) || !String(bubble.id || '').trim() || !String(bubble.name || '').trim()) return false;
                    const bubbleId = String(bubble.id).trim();
                    if (seenBubbleIds.has(bubbleId)) return false;
                    seenBubbleIds.add(bubbleId);
                    bubble.id = bubbleId;
                    bubble.name = String(bubble.name).trim();
                    return true;
                });
                const total = validBubbles.reduce((sum, bubble) => sum + Math.max(0, Number(bubble.size) || 0), 0);
                let assigned = 0;
                group.bubbles = validBubbles.map((bubble, index) => {
                    const weight = total > 0 ? Math.max(0, Number(bubble.size) || 0) : 1;
                    const denominator = total > 0 ? total : validBubbles.length;
                    const size = index === validBubbles.length - 1
                        ? Number((100 - assigned).toFixed(2))
                        : Math.floor((weight / denominator) * 10000) / 100;
                    assigned += size;
                    return { ...bubble, size };
                });
                group.id = String(group.id || groupId).trim();
            });
            Object.keys(db).forEach(groupId => {
                if (!isBubbleSessionObject(db[groupId]) || !db[groupId].bubbles.length) delete db[groupId];
            });
            const groupIds = new Set(Object.keys(db));
            Object.values(db).forEach(group => {
                group.bubbles.forEach(bubble => {
                    if (bubble.childId && !groupIds.has(String(bubble.childId))) bubble.childId = null;
                });
            });
            return db;
        }

        function validateBubbleSessionDatabase(db) {
            if (!isBubbleSessionObject(db) || Object.keys(db).length === 0) throw new Error('保存データにバブル群がありません');
            Object.entries(db).forEach(([groupId, group]) => {
                if (!isBubbleSessionObject(group) || String(group.id || '') !== String(groupId) || !Array.isArray(group.bubbles)) {
                    throw new Error(`バブル群 ${groupId} の構造が不正です`);
                }
                group.bubbles.forEach(bubble => {
                    if (!isBubbleSessionObject(bubble) || !String(bubble.id || '').trim() || !String(bubble.name || '').trim()) {
                        throw new Error(`バブル群 ${groupId} に不正なバブルがあります`);
                    }
                });
            });
            return db;
        }

        function normalizeBubbleSessionRecord(record, options = {}) {
            if (!isBubbleSessionObject(record)) throw new Error('保存データが不正です');
            if (Number(record.schemaVersion) !== BUBBLE_SESSION_SCHEMA_VERSION) throw new Error('未対応の保存データ形式です');
            const db = validateBubbleSessionDatabase(sanitizeBubbleSessionDatabase(cloneBubbleSessionValue(record.db)));
            const groupIds = new Set(Object.keys(db));
            const entryGroupId = groupIds.has(String(record.entryGroupId || '')) ? String(record.entryGroupId) : null;
            if (!entryGroupId) throw new Error('開始バブル群が保存データに存在しません');
            const lastGroupId = groupIds.has(String(record.lastGroupId || '')) ? String(record.lastGroupId) : entryGroupId;
            const entryBubbleId = record.entryBubbleId == null ? null : String(record.entryBubbleId);
            const navigationPath = Array.isArray(record.navigationPath)
                ? record.navigationPath.map(String).filter((groupId, index, items) => groupIds.has(groupId) && items.indexOf(groupId) === index)
                : [];
            if (!navigationPath.includes(lastGroupId)) navigationPath.push(lastGroupId);

            if (options.forRestore) {
                Object.values(db).forEach(group => group.bubbles.forEach(bubble => {
                    if (bubble.analysisStatus === 'loading') bubble.analysisStatus = 'idle';
                    if (bubble.detailResearch && bubble.detailResearch.status === 'loading') bubble.detailResearch.status = 'partial';
                }));
            }

            const now = new Date().toISOString();
            return {
                schemaVersion: BUBBLE_SESSION_SCHEMA_VERSION,
                id: String(record.id || createBubbleSessionId()),
                opinion: String(record.opinion || '').trim(),
                createdAt: String(record.createdAt || now),
                updatedAt: String(record.updatedAt || now),
                lastOpenedAt: String(record.lastOpenedAt || record.updatedAt || now),
                entryGroupId,
                entryBubbleId,
                lastGroupId,
                navigationPath,
                db
            };
        }

        function summarizeBubbleSession(record) {
            let bubbleCount = 0;
            let detailCount = 0;
            Object.values(record.db || {}).forEach(group => (group.bubbles || []).forEach(bubble => {
                bubbleCount += 1;
                if (bubble.analysisStatus === 'ready' || bubble.analysisStatus === 'partial' || bubble.detailResearch) detailCount += 1;
            }));
            return {
                id: record.id,
                opinion: record.opinion,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                lastOpenedAt: record.lastOpenedAt,
                lastGroupId: record.lastGroupId,
                groupCount: Object.keys(record.db || {}).length,
                bubbleCount,
                detailCount
            };
        }

        function openBubbleSessionDatabase() {
            if (bubbleSessionDatabasePromise) return bubbleSessionDatabasePromise;
            bubbleSessionDatabasePromise = new Promise((resolve, reject) => {
                if (!window.indexedDB) {
                    reject(new Error('このブラウザではIndexedDBを利用できません'));
                    return;
                }
                const request = window.indexedDB.open(BUBBLE_SESSION_DATABASE_NAME, BUBBLE_SESSION_SCHEMA_VERSION);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains(BUBBLE_SESSION_STORE_NAME)) {
                        const store = database.createObjectStore(BUBBLE_SESSION_STORE_NAME, { keyPath: 'id' });
                        store.createIndex('updatedAt', 'updatedAt');
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('IndexedDBを開けませんでした'));
                request.onblocked = () => reject(new Error('別のタブが保存領域の更新を妨げています'));
            }).catch(error => {
                bubbleSessionDatabasePromise = null;
                throw error;
            });
            return bubbleSessionDatabasePromise;
        }

        async function runBubbleSessionTransaction(mode, operation) {
            const database = await openBubbleSessionDatabase();
            return new Promise((resolve, reject) => {
                const transaction = database.transaction(BUBBLE_SESSION_STORE_NAME, mode);
                const store = transaction.objectStore(BUBBLE_SESSION_STORE_NAME);
                let request;
                try {
                    request = operation(store);
                } catch (error) {
                    reject(error);
                    return;
                }
                transaction.oncomplete = () => resolve(request && request.result);
                transaction.onerror = () => reject(transaction.error || (request && request.error) || new Error('探索履歴の保存処理に失敗しました'));
                transaction.onabort = () => reject(transaction.error || new Error('探索履歴の保存処理が中断されました'));
            });
        }

        async function saveBubbleSessionRecord(record) {
            const normalized = normalizeBubbleSessionRecord(record);
            await runBubbleSessionTransaction('readwrite', store => store.put(normalized));
            return normalized;
        }

        async function listBubbleSessionRecords() {
            const records = await runBubbleSessionTransaction('readonly', store => store.getAll());
            return (records || [])
                .map(record => {
                    try { return normalizeBubbleSessionRecord(record); } catch (_error) { return null; }
                })
                .filter(Boolean)
                .sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
        }

        async function loadBubbleSessionRecord(sessionId) {
            const record = await runBubbleSessionTransaction('readonly', store => store.get(String(sessionId)));
            if (!record) throw new Error('選択した探索履歴が見つかりません');
            return normalizeBubbleSessionRecord(record, { forRestore: true });
        }

        async function deleteBubbleSessionRecord(sessionId) {
            await runBubbleSessionTransaction('readwrite', store => store.delete(String(sessionId)));
        }

        function getCurrentBubbleNavigationPath() {
            if (typeof window.getBubbleNavigationPath !== 'function') return state.groupId ? [state.groupId] : [];
            return window.getBubbleNavigationPath();
        }

        function createBubbleSessionSnapshot(database) {
            const session = database && bubbleSessionByDatabase.get(database);
            if (!session) return null;
            const isCurrentDatabase = database === activeDB;
            const lastGroupId = isCurrentDatabase && state.groupId && database[state.groupId] ? state.groupId : session.lastGroupId;
            const navigationPath = isCurrentDatabase ? getCurrentBubbleNavigationPath() : session.navigationPath;
            return normalizeBubbleSessionRecord({
                ...session,
                updatedAt: new Date().toISOString(),
                lastGroupId,
                navigationPath,
                db: cloneBubbleSessionValue(database)
            });
        }

        function showBubbleSessionStorageError(error) {
            console.warn('[BubbleBreaker][Storage]', error);
            if (!bubbleSessionSaveWarningShown && typeof showToast === 'function') {
                bubbleSessionSaveWarningShown = true;
                showToast('探索履歴を保存できませんでした。現在の探索はそのまま続けられます');
            }
        }

        async function persistBubbleSessionDatabase(database) {
            const snapshot = createBubbleSessionSnapshot(database);
            if (!snapshot) return null;
            if (latestDatabaseBySessionId.get(snapshot.id) !== database) return null;
            try {
                const saved = await saveBubbleSessionRecord(snapshot);
                const metadata = { ...saved, db: null };
                bubbleSessionByDatabase.set(database, metadata);
                if (database === activeDB) activeBubbleSession = metadata;
                bubbleSessionSaveWarningShown = false;
                void renderBubbleSessionHistory();
                return saved;
            } catch (error) {
                showBubbleSessionStorageError(error);
                return null;
            }
        }

        function persistCurrentBubbleSession() {
            return persistBubbleSessionDatabase(activeDB);
        }

        window.scheduleBubbleDatabaseSessionSave = function(database, _reason = 'update') {
            const session = database && bubbleSessionByDatabase.get(database);
            if (!session || latestDatabaseBySessionId.get(session.id) !== database) return;
            const existingTimer = bubbleSessionSaveTimers.get(session.id);
            if (existingTimer) clearTimeout(existingTimer);
            const timer = setTimeout(() => {
                bubbleSessionSaveTimers.delete(session.id);
                void persistBubbleSessionDatabase(database);
            }, BUBBLE_SESSION_SAVE_DELAY_MS);
            bubbleSessionSaveTimers.set(session.id, timer);
        };

        window.scheduleCurrentBubbleSessionSave = function(_reason = 'update') {
            window.scheduleBubbleDatabaseSessionSave(activeDB, _reason);
        };

        window.startLocalBubbleSession = function(opinion, universe) {
            const now = new Date().toISOString();
            activeBubbleSession = {
                schemaVersion: BUBBLE_SESSION_SCHEMA_VERSION,
                id: createBubbleSessionId(),
                opinion: String(opinion || '').trim(),
                createdAt: now,
                updatedAt: now,
                lastOpenedAt: now,
                entryGroupId: universe.entryGroupId,
                entryBubbleId: universe.entryBubbleId || null,
                lastGroupId: universe.entryGroupId,
                navigationPath: [universe.entryGroupId],
                db: null
            };
            bubbleSessionByDatabase.set(activeDB, activeBubbleSession);
            latestDatabaseBySessionId.set(activeBubbleSession.id, activeDB);
            window.scheduleCurrentBubbleSessionSave('universe-created');
        };

        function setBubbleSessionInputVisibility() {
            const returnButton = document.getElementById('btn-return-current-exploration');
            if (returnButton) returnButton.classList.toggle('hidden', !activeBubbleSession || !state.groupId || !activeDB[state.groupId]);
        }

        function formatBubbleSessionDate(value) {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? '日時不明' : date.toLocaleString('ja-JP');
        }

        async function renderBubbleSessionHistory() {
            const list = document.getElementById('saved-exploration-list');
            const empty = document.getElementById('saved-exploration-empty');
            const status = document.getElementById('saved-exploration-status');
            if (!list || !empty || !status) return;
            status.textContent = '保存済み探索を読み込んでいます…';
            try {
                const records = await listBubbleSessionRecords();
                if (typeof window.onSavedExplorationCountChanged === 'function') window.onSavedExplorationCountChanged(records.length);
                list.innerHTML = '';
                records.forEach(record => {
                    const summary = summarizeBubbleSession(record);
                    const item = document.createElement('article');
                    item.className = 'saved-exploration-item';
                    item.dataset.sessionId = summary.id;
                    const heading = document.createElement('h3');
                    heading.className = 'saved-exploration-title';
                    heading.textContent = summary.opinion || '意見未設定の探索';
                    const meta = document.createElement('p');
                    meta.className = 'saved-exploration-meta';
                    meta.textContent = `最終探索：${formatBubbleSessionDate(summary.updatedAt)}`;
                    const actions = document.createElement('div');
                    actions.className = 'saved-exploration-actions';
                    const restore = document.createElement('button');
                    restore.type = 'button';
                    restore.className = 'saved-exploration-restore';
                    restore.textContent = 'この世界を開く';
                    restore.addEventListener('click', () => void restoreBubbleSession(summary.id));
                    const remove = document.createElement('button');
                    remove.type = 'button';
                    remove.className = 'saved-exploration-delete';
                    remove.textContent = '削除';
                    remove.addEventListener('click', () => void removeBubbleSession(summary.id, summary.opinion));
                    actions.append(restore, remove);
                    item.append(heading, meta, actions);
                    list.appendChild(item);
                });
                empty.classList.toggle('hidden', records.length > 0);
                status.textContent = records.length > 0 ? `${records.length}件の探索を保存しています` : '';
            } catch (error) {
                if (typeof window.onSavedExplorationCountChanged === 'function') window.onSavedExplorationCountChanged(null);
                list.innerHTML = '';
                empty.classList.remove('hidden');
                empty.textContent = '保存済み探索を読み込めませんでした。';
                status.textContent = '';
                showBubbleSessionStorageError(error);
            }
            setBubbleSessionInputVisibility();
        }

        let historyPreviousFocus = null;
        function setSavedExplorationsOpen(open) {
            const overlay = document.getElementById('saved-explorations-overlay');
            if (!overlay) return;
            if (open) {
                historyPreviousFocus = document.activeElement;
                overlay.hidden = false;
                document.body.classList.add('history-open');
                void renderBubbleSessionHistory();
                document.getElementById('btn-close-history')?.focus();
                return;
            }
            overlay.hidden = true;
            document.body.classList.remove('history-open');
            if (historyPreviousFocus && typeof historyPreviousFocus.focus === 'function') historyPreviousFocus.focus();
            if (typeof window.syncApiKeyPrompt === 'function') window.syncApiKeyPrompt();
        }
        window.openBubbleSessionHistory = () => setSavedExplorationsOpen(true);
        document.getElementById('btn-open-history')?.addEventListener('click', () => setSavedExplorationsOpen(true));
        document.getElementById('btn-open-history-from-key')?.addEventListener('click', () => setSavedExplorationsOpen(true));
        document.getElementById('btn-close-history')?.addEventListener('click', () => setSavedExplorationsOpen(false));
        document.getElementById('saved-explorations-overlay')?.addEventListener('click', event => {
            if (event.target === event.currentTarget) setSavedExplorationsOpen(false);
        });
        document.getElementById('saved-explorations-overlay')?.addEventListener('wheel', event => {
            if (event.target === event.currentTarget) setSavedExplorationsOpen(false);
            else event.stopPropagation();
        }, { passive: true });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && !document.getElementById('saved-explorations-overlay')?.hidden) setSavedExplorationsOpen(false);
        });

        async function restoreBubbleSession(sessionId) {
            try {
                const record = await loadBubbleSessionRecord(sessionId);
                activeDB = record.db;
                focusEntryGroupId = record.entryGroupId;
                focusEntryBubbleId = record.entryBubbleId;
                activeAnalysisInput = record.opinion;
                if (typeof window.resetBubbleAnalysisRequests === 'function') window.resetBubbleAnalysisRequests();
                activeBubbleSession = { ...record, db: null, lastOpenedAt: new Date().toISOString() };
                bubbleSessionByDatabase.set(activeDB, activeBubbleSession);
                latestDatabaseBySessionId.set(activeBubbleSession.id, activeDB);
                state.groupId = null;
                state.groupData = null;
                state.bubbleId = null;
                state.bubbleData = null;
                state.analysisCardType = null;
                document.getElementById('input-opinion').value = record.opinion;
                setSavedExplorationsOpen(false);
                const restoreUniverse = {
                    db: record.db,
                    entryGroupId: record.entryGroupId,
                    entryBubbleId: record.entryBubbleId
                };
                const voyageStarted = typeof window.startBubbleSessionRestoreVoyage === 'function'
                    && window.startBubbleSessionRestoreVoyage(restoreUniverse, () => {
                        const restoredPath = typeof window.restoreBubbleNavigationPath === 'function'
                            ? window.restoreBubbleNavigationPath(record.navigationPath, record.lastGroupId)
                            : [];
                        const restoredGroupId = restoredPath[restoredPath.length - 1]
                            || (activeDB[record.lastGroupId] ? String(record.lastGroupId) : record.entryGroupId);
                        if (!restoredGroupId || !activeDB[restoredGroupId]) {
                            showToast('保存した世界の表示先を見つけられませんでした');
                            return;
                        }
                        window.loadGroup(restoredGroupId, true, {
                            preserveNavigationPath: true,
                            viewDirection: new THREE.Vector3(0, 0, 1)
                        });
                        window.scheduleCurrentBubbleSessionSave('restored');
                        showToast('正面から保存したバブル宇宙に到着しました');
                    });
                if (!voyageStarted) throw new Error('保存した世界への渡航ロードを開始できませんでした');
            } catch (error) {
                console.warn('[BubbleBreaker][Storage] restore failed', error);
                showToast(`探索履歴を復元できませんでした: ${error.message}`);
            }
        }

        async function removeBubbleSession(sessionId, opinion) {
            if (!window.confirm(`「${opinion || 'この探索'}」をローカル履歴から削除しますか？`)) return;
            try {
                await deleteBubbleSessionRecord(sessionId);
                const timer = bubbleSessionSaveTimers.get(sessionId);
                if (timer) clearTimeout(timer);
                bubbleSessionSaveTimers.delete(sessionId);
                latestDatabaseBySessionId.delete(sessionId);
                if (activeBubbleSession && activeBubbleSession.id === sessionId) {
                    bubbleSessionByDatabase.delete(activeDB);
                    activeBubbleSession = null;
                }
                await renderBubbleSessionHistory();
                showToast('保存した探索を削除しました');
            } catch (error) {
                showBubbleSessionStorageError(error);
            }
        }

        window.openBubbleInputScreen = function() {
            if (activeBubbleSession) window.scheduleCurrentBubbleSessionSave('input-navigation');
            const panel = document.getElementById('input-panel');
            if (panel) {
                panel.style.transform = '';
                panel.style.opacity = '';
                panel.style.pointerEvents = '';
            }
            switchScreen('INPUT');
            setBubbleSessionInputVisibility();
            void renderBubbleSessionHistory();
        };

        window.initializeBubbleSessionUI = function() {
            const inputButton = document.getElementById('btn-open-input');
            const singleInputButton = document.getElementById('btn-open-input-single');
            const returnButton = document.getElementById('btn-return-current-exploration');
            const inputScreen = document.getElementById('screen-input');
            if (inputButton) inputButton.addEventListener('click', window.openBubbleInputScreen);
            if (singleInputButton) singleInputButton.addEventListener('click', window.openBubbleInputScreen);
            if (returnButton) returnButton.addEventListener('click', () => {
                if (state.groupId && activeDB[state.groupId]) window.loadGroup(state.groupId);
            });
            void renderBubbleSessionHistory();
            if (inputScreen) inputScreen.addEventListener('click', event => {
                if (event.target !== inputScreen || !activeBubbleSession || !state.groupId || !activeDB[state.groupId]) return;
                if (typeof isDiving !== 'undefined' && isDiving) return;
                window.loadGroup(state.groupId);
            });
            setBubbleSessionInputVisibility();
        };

        window.BubbleSessionStorage = {
            normalizeRecord: normalizeBubbleSessionRecord,
            summarizeRecord: summarizeBubbleSession,
            saveRecord: saveBubbleSessionRecord,
            listRecords: listBubbleSessionRecords,
            loadRecord: loadBubbleSessionRecord,
            deleteRecord: deleteBubbleSessionRecord,
            persistCurrent: persistCurrentBubbleSession
        };
