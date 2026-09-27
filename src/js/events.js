        // ==========================================
        // === 5. イベントリスナー (ユーザー操作の受付) ===
        // ==========================================
        
        // --- 3Dオブジェクト(球体)のクリック判定処理 ---
        const raycaster = new THREE.Raycaster(); // マウス位置から光線を飛ばして交差判定するクラス
        const mouse = new THREE.Vector2();       // マウスの座標(2D)

        window.addEventListener('click', (event) => {
            if (explorationViewMode === '2d') return;
            // UIパネルや文字ラベルをクリックした時は、裏の3D空間のクリック判定を無視する
            if (event.target.closest('.glass-panel') || event.target.closest('button') || event.target.closest('input') || event.target.closest('.bubble-label')) return;

            // マウスの画面上の座標を -1 から 1 の範囲（Three.jsで扱いやすい形式）に変換
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            // カメラからマウスの位置へ光線(レイ)をセット
            raycaster.setFromCamera(mouse, camera);
            
            // 画面に現在表示(visible)されているバブルだけを判定対象にする（透明になって消えているバブルをクリックさせないため）
            const visibleBubbles = currentBubbles.filter(b => b.mesh.visible);
            const intersects = raycaster.intersectObjects(visibleBubbles.map(b => b.mesh));

            // もし光線が何かのバブルとぶつかったら
            if (intersects.length > 0) {
                const clickedMesh = intersects[0].object;
                // クリックされたMesh(3Dモデル)を持つバブルのデータを探す
                const bubbleObj = currentBubbles.find(b => b.mesh === clickedMesh);
                if (bubbleObj) {
                    if (state.screen === 'GROUP') {
                        // バブル群画面でクリックされたら → 個別バブル画面へズームイン
                        selectBubble(bubbleObj.data);
                    } else if (state.screen === 'SINGLE' && bubbleObj.data.id === state.bubbleId) {
                        // 個別バブル画面で、見ているバブル自身をクリックされたら → 解析画面へ移行
                        loadAnalysis();
                    }
                }
            }
        });

        // --- ダイブボタン(入力確定)の処理 ---
        let isGenerating = false;
        const apiKeyInput = document.getElementById('openai-api-key');
        const apiKeySetButton = document.getElementById('btn-set-api-key');
        const apiKeyStatus = document.getElementById('api-key-status');
        const diveButton = document.getElementById('btn-dive');
        const apiKeyOverlay = document.getElementById('api-key-overlay');
        const apiKeyCloseButton = document.getElementById('btn-close-api-key');
        const voyagePanel = document.getElementById('voyage-panel');
        const voyageStatus = document.getElementById('voyage-status');
        const voyageRouteFill = document.getElementById('voyage-route-fill');
        let runtimeKeyConfigured = typeof window.hasRuntimeOpenAIKey === 'function' && window.hasRuntimeOpenAIKey();
        function updateApiKeyUI(configured, message = null) {
            runtimeKeyConfigured = Boolean(configured);
            if (apiKeyStatus) {
                apiKeyStatus.innerText = message || (configured ? 'APIキー設定済み（このページのメモリ内のみ）' : 'APIキー未設定');
                apiKeyStatus.classList.toggle('text-emerald-200', configured);
                apiKeyStatus.classList.toggle('text-amber-200', !configured);
            }
            if (diveButton) diveButton.disabled = !configured || isGenerating;
            if (typeof window.syncApiKeyPrompt === 'function') window.syncApiKeyPrompt();
        }

        const promptExamples = [
            ['最近、気になっていることは？', '例：きのこの山とたけのこの里、どちらが好き？'],
            ['あなたの好きな食べ物は？', '例：たけのこの里が好き'],
            ['最近のマイブームは？', '例：スプラトゥーン3を遊ぶこと'],
            ['なくなると困るものは？', '例：毎朝飲むコーヒー'],
            ['子どものころ夢中だったものは？', '例：ポケモンの図鑑を集めていた'],
            ['最近、誰かに話したくなったことは？', '例：近所に新しいパン屋ができた'],
            ['つい時間を忘れてしまうことは？', '例：好きな音楽を探すこと'],
            ['毎日の小さな楽しみは？', '例：寝る前に漫画を読むこと'],
            ['最近、気になったニュースは？', '例：新しい月探査計画が始まった'],
            ['もっと知りたいと思う場所は？', '例：深海にはどんな生き物がいるの？'],
            ['いま不思議に思っていることは？', '例：猫はどうして箱が好きなの？'],
            ['好きな季節と、その理由は？', '例：秋。散歩が気持ちいいから'],
            ['最近、買ってよかったものは？', '例：耳をふさがないイヤホン'],
            ['つい応援したくなるものは？', '例：地元のサッカーチーム'],
            ['みんなに広めたい作品は？', '例：何度見ても楽しい映画'],
            ['食べてみたい料理は？', '例：本場のスパイスカレー'],
            ['最近、変わったなと思うことは？', '例：現金よりスマホで払うことが増えた'],
            ['あなたの街の好きなところは？', '例：川沿いの桜並木'],
            ['気になっている技術は？', '例：家事を助けるロボット'],
            ['最近、心に残った言葉は？', '例：「ゆっくりでいい」という言葉'],
            ['休日にしてみたいことは？', '例：知らない駅で降りて散歩する'],
            ['好きな動物は？', '例：ラッコの食事風景を見るのが好き'],
            ['最近、考え方が変わったことは？', '例：休むことも大切な予定だと思う'],
            ['身近な人と話してみたい話題は？', '例：子どものころ好きだった遊び']
        ];
        let activePromptIndex = -1;
        function setRandomPrompt() {
            if (promptExamples.length < 2) return;
            let nextIndex = Math.floor(Math.random() * promptExamples.length);
            while (nextIndex === activePromptIndex) nextIndex = Math.floor(Math.random() * promptExamples.length);
            activePromptIndex = nextIndex;
            document.getElementById('input-question').textContent = promptExamples[nextIndex][0];
            document.getElementById('input-example').textContent = promptExamples[nextIndex][1];
        }
        document.getElementById('btn-refresh-prompt')?.addEventListener('click', setRandomPrompt);

        const guideSlides = [
            ['ひとつの意見から、世界が広がる', '気になることや好きなものを入力すると、関連する考えを集めて、探索できる世界をつくります。'],
            ['近い考えも、違う考えも見つかる', 'テーマを小さなバブルに分けて表示します。大きなまとまりから気になる話題へ、少しずつ進めます。'],
            ['4つの窓から、テーマを読み解く', '概要、できごとの流れ、情報源、賛成・反対の見方を比べて、テーマの全体像をつかめます。'],
            ['あなたの好奇心から、さあ行こう', '正解を出す場所ではなく、問いを広げる場所です。まずは気になることをひとつ、宇宙へ放ってみましょう。']
        ];
        const guideOverlay = document.getElementById('first-run-guide');
        let guideSlideIndex = 0;
        let guideIsOpen = false;
        let savedExplorationCountResolved = false;
        function renderGuideSlide() {
            const [title, copy] = guideSlides[guideSlideIndex];
            document.getElementById('guide-title').textContent = title;
            document.getElementById('guide-copy').textContent = copy;
            document.getElementById('guide-step-label').textContent = `${guideSlideIndex + 1} / ${guideSlides.length}`;
            document.getElementById('guide-progress-fill').style.width = `${((guideSlideIndex + 1) / guideSlides.length) * 100}%`;
            document.getElementById('btn-guide-next').innerHTML = guideSlideIndex === guideSlides.length - 1
                ? 'さあ、探索へ <span aria-hidden="true">→</span>'
                : '次へ <span aria-hidden="true">→</span>';
        }
        function setGuideOpen(open, restart = false) {
            if (!guideOverlay) return;
            if (restart) guideSlideIndex = 0;
            guideIsOpen = Boolean(open);
            guideOverlay.hidden = !guideIsOpen;
            if (guideIsOpen) {
                renderGuideSlide();
                requestAnimationFrame(() => document.getElementById('btn-guide-next')?.focus());
            }
            else {
                localStorage.setItem('bubblebreaker.firstGuideSeen', 'on');
            }
            if (typeof window.syncApiKeyPrompt === 'function') window.syncApiKeyPrompt();
        }
        document.getElementById('btn-guide-next')?.addEventListener('click', () => {
            if (guideSlideIndex < guideSlides.length - 1) {
                guideSlideIndex += 1;
                renderGuideSlide();
            } else setGuideOpen(false);
        });
        document.getElementById('btn-close-guide')?.addEventListener('click', () => setGuideOpen(false));
        document.getElementById('btn-reopen-guide')?.addEventListener('click', () => {
            setSettingsOpen(false);
            setGuideOpen(true, true);
        });
        window.onSavedExplorationCountChanged = count => {
            savedExplorationCountResolved = true;
            if (count === 0 && localStorage.getItem('bubblebreaker.firstGuideSeen') !== 'on') setGuideOpen(true, true);
            else if (typeof window.syncApiKeyPrompt === 'function') window.syncApiKeyPrompt();
        };

        const hintByScreen = {
            INPUT: ['意見をひとつ、世界の入口に', '例をヒントに短く書くだけで大丈夫です。「別のお題」で質問を変えられます。前の探索は下の「今まで探索した世界」から開けます。'],
            LOADING: ['テーマを調べて世界を準備中', '入力されたテーマを整理し、関連する視点や情報を集めて、たどれるまとまりにしています。目安は約3分です。'],
            GROUP: ['バブルを選んで、話題を深く見る', '丸は話題のまとまりです。気になる丸を選ぶと内容を読み、上部の道順を押すと前のまとまりへ戻れます。'],
            SINGLE: ['このバブルの内容を確認する', '説明を読み、解析を見ると概要・歴史・情報源・意見の違いを比べられます。子テーマがある場合は上の道順から進めます。'],
            ANALYSIS: ['4つの窓からテーマを読み解く', '気になるカードを選ぶと詳しい内容と出典を確認できます。対象のバブルに戻るには中央のタイトルを選びます。'],
            DETAIL: ['内容と出典を一緒に確認する', '要約、時系列、情報源、意見を読み、気になった点はカード内の出典から確かめられます。']
        };
        const hintPanel = document.getElementById('contextual-hint');
        let hintVisible = localStorage.getItem('bubblebreaker.hintVisible') !== 'off';
        let apiSetupExplicit = false;
        function renderHint(screenName) {
            const key = hintByScreen[screenName] ? screenName : 'INPUT';
            const [title, copy] = hintByScreen[key];
            document.getElementById('hint-screen-label').textContent = key === 'LOADING' ? '探索中' : ({ INPUT: 'スタート', GROUP: 'バブル群', SINGLE: 'バブル', ANALYSIS: '解析', DETAIL: '解析の詳細' }[key] || 'スタート');
            document.getElementById('hint-title').textContent = title;
            const action = document.getElementById('btn-hint-action');
            const needsKey = !runtimeKeyConfigured && key !== 'INPUT';
            document.getElementById('hint-copy').textContent = needsKey ? `${copy} 未生成の解析を調べるには API Key を入力してください。` : copy;
            action.hidden = !needsKey;
            action.textContent = 'API Key を入力する';
        }
        document.getElementById('btn-close-hint')?.addEventListener('click', () => {
            hintVisible = false;
            localStorage.setItem('bubblebreaker.hintVisible', 'off');
            hintPanel.classList.add('hint-is-closed');
            document.getElementById('btn-open-hint').hidden = false;
        });
        document.getElementById('btn-open-hint')?.addEventListener('click', () => {
            hintVisible = true;
            localStorage.setItem('bubblebreaker.hintVisible', 'on');
            hintPanel.classList.remove('hint-is-closed');
            document.getElementById('btn-open-hint').hidden = true;
        });
        window.openApiKeySetup = () => {
            apiSetupExplicit = true;
            if (typeof window.syncApiKeyPrompt === 'function') window.syncApiKeyPrompt();
            else if (apiKeyOverlay) apiKeyOverlay.hidden = false;
            apiKeyInput?.focus();
        };
        document.getElementById('btn-close-api-key')?.addEventListener('click', () => {
            apiSetupExplicit = false;
            if (apiKeyOverlay) apiKeyOverlay.hidden = true;
            if (typeof window.syncApiKeyPrompt === 'function') window.syncApiKeyPrompt();
        });
        document.getElementById('btn-hint-action')?.addEventListener('click', () => window.openApiKeySetup());
        window.syncApiKeyPrompt = () => {
            if (!apiKeyOverlay) return;
            if (runtimeKeyConfigured) apiSetupExplicit = false;
            const shouldShow = !runtimeKeyConfigured && !isDiving && !guideIsOpen
                && savedExplorationCountResolved && (state.screen === 'INPUT' || apiSetupExplicit);
            const wasHidden = apiKeyOverlay.hidden;
            apiKeyOverlay.hidden = !shouldShow;
            if (apiKeyCloseButton) apiKeyCloseButton.hidden = !apiSetupExplicit;
            if (!shouldShow && apiKeyInput) apiKeyInput.value = '';
            if (shouldShow && wasHidden) requestAnimationFrame(() => apiKeyInput?.focus());
            renderHint(window.__bubbleBreakerLoading ? 'LOADING' : state.screen);
        };
        window.updateAppChromeForScreen = screenName => {
            const header = document.querySelector('.brand-hud');
            const loading = Boolean(window.__bubbleBreakerLoading || isDiving);
            const headerVisible = ['INPUT', 'GROUP'].includes(screenName) || loading;
            if (header) header.classList.toggle('chrome-hidden', !headerVisible);
            if (hintPanel) {
                hintPanel.classList.toggle('hint-is-closed', !hintVisible);
                document.getElementById('btn-open-hint').hidden = hintVisible;
            }
            renderHint(loading && screenName === 'INPUT' ? 'LOADING' : screenName);
            if (typeof window.syncApiKeyPrompt === 'function') window.syncApiKeyPrompt();
        };
        window.updateVoyageProgress = progress => {
            if (!progress) return;
            const step = Math.max(0, Math.min(2, Number(progress.step) || 0));
            document.querySelectorAll('.voyage-step').forEach(item => {
                const itemStep = Number(item.dataset.voyageStep);
                item.classList.toggle('is-active', itemStep === step);
                item.classList.toggle('is-complete', itemStep < step);
            });
            if (voyageRouteFill) voyageRouteFill.style.width = `${step * 50}%`;
            if (voyageStatus && progress.message) voyageStatus.textContent = progress.message;
        };

        window.updateAppChromeForScreen(state.screen || 'INPUT');
        updateApiKeyUI(runtimeKeyConfigured);
        if (typeof window.initializeBubbleSessionUI === 'function') window.initializeBubbleSessionUI();
        apiKeySetButton?.addEventListener('click', () => {
            const value = apiKeyInput.value.trim();
            if (value.length < 10) {
                if (typeof window.setRuntimeOpenAIKey === 'function') window.setRuntimeOpenAIKey('');
                updateApiKeyUI(false, 'APIキーを入力してください');
                return;
            }
            const configured = typeof window.setRuntimeOpenAIKey === 'function' && window.setRuntimeOpenAIKey(value);
            apiKeyInput.value = '';
            updateApiKeyUI(configured, configured ? 'APIキー設定済み（このページのメモリ内のみ）' : 'APIキーを確認してください');
            if (configured && apiKeyOverlay) apiKeyOverlay.hidden = true;
            if (configured && state.groupData && typeof requestBubbleGroupAnalyses === 'function') {
                void requestBubbleGroupAnalyses(state.groupData);
                if (state.bubbleData && typeof requestBubbleAnalysis === 'function') void requestBubbleAnalysis(state.bubbleData, state.groupData);
            }
        });
        apiKeyInput?.addEventListener('keydown', event => {
            if (event.key === 'Enter') apiKeySetButton.click();
        });
        document.getElementById('btn-dive').addEventListener('click', async () => {
            if (isDiving || isGenerating) return;
            if (typeof window.hasRuntimeOpenAIKey !== 'function' || !window.hasRuntimeOpenAIKey()) {
                updateApiKeyUI(false, '探索を始めるには API Key を入力してください');
                apiKeyInput.focus();
                return;
            }
            const input = document.getElementById('input-opinion').value.trim();
            if (!input) {
                showToast('意見を入力してください');
                return;
            }

            const button = document.getElementById('btn-dive');
            const panel = document.getElementById('input-panel');
            button.disabled = true;
            isGenerating = true;
            window.__bubbleBreakerLoading = true;
            if (voyagePanel) voyagePanel.hidden = false;
            window.updateVoyageProgress({ step: 0, message: '入力したテーマを整理しています…' });
            updateApiKeyUI(true);
            startBackgroundMusic();

            // API応答をワープ演出と並行して取得する。API失敗時は既存モックDBへ戻す。
            const universePromise = requestDynamicUniverse(input, window.updateVoyageProgress).then(result => {
                if (result) {
                    showToast('関連する情報を集めて、探索する世界をつくりました');
                    return result;
                }
                showToast('すべての情報を集められなかったため、用意済みの世界を表示します');
                return normalizeFallbackUniverse(input);
            }).catch(error => {
                apiError('Dynamic BubbleBreaker data generation failed。固定データを使用します', { status: error.status || null, requestId: error.requestId || null, message: redactApiLog(error.message), body: error.body || null });
                showToast('検索に失敗したため、用意済みの世界を表示します');
                return normalizeFallbackUniverse(input);
            });
            universePromise.then(universe => {
                pendingUniverse = universe;
                window.updateVoyageProgress({ step: 2, message: '世界の準備ができました。中心のバブルへ向かっています…' });
                if (typeof window.markLoadingUniverseReady === 'function') window.markLoadingUniverseReady();
            });

            panel.style.transform = 'scale(0.5)';
            panel.style.opacity = '0';
            panel.style.pointerEvents = 'none';
            showToast('入力したテーマをもとに、新しい世界をつくっています… 🚀');

            startLoadingAnimation();
            updateWarpHazeLayer();
            window.updateAppChromeForScreen('INPUT');
            loadingAnimation.onReady = () => {
                const universe = pendingUniverse;
                pendingUniverse = null;
                if (!universe) return;
                if (voyagePanel) voyagePanel.hidden = true;
                window.__bubbleBreakerLoading = false;
                activeDB = universe.db;
                focusEntryGroupId = universe.entryGroupId;
                focusEntryBubbleId = universe.entryBubbleId || null;
                if (typeof window.startLocalBubbleSession === 'function') window.startLocalBubbleSession(input, universe);
                document.getElementById('screen-input').classList.remove('screen-active');
                document.getElementById('screen-input').classList.add('screen-hidden');
                camera.rotation.set(0, 0, 0);
                isGenerating = false;
                button.disabled = false;
                updateApiKeyUI(true);
                updateWarpHazeLayer();
                loadGroup(universe.entryGroupId, true);
            };
        });

        document.getElementById('input-opinion').addEventListener('keydown', event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                document.getElementById('btn-dive').click();
            }
        });

        // --- 各種UIボタンのクリックイベント ---
        document.getElementById('btn-analyze').addEventListener('click', () => loadAnalysis());
        document.getElementById('analysis-center-title').addEventListener('click', () => loadSingle(state.bubbleData));
        document.getElementById('btn-back-detail').addEventListener('click', () => switchScreen('ANALYSIS'));
        const aboutOverlay = document.getElementById('about-overlay');
        const aboutOpenButton = document.getElementById('btn-open-about');
        const aboutCloseButton = document.getElementById('btn-close-about');
        const aboutMenuButton = document.getElementById('btn-about-menu');
        const aboutMenu = document.getElementById('about-menu');
        let aboutPreviousFocus = null;
        function setAboutOpen(open) {
            if (!aboutOverlay) return;
            if (open) {
                aboutPreviousFocus = document.activeElement;
                aboutOverlay.hidden = false;
                aboutOverlay.scrollTop = 0;
                requestAnimationFrame(() => aboutOverlay.classList.add('is-open'));
                document.body.classList.add('about-open');
                aboutCloseButton?.focus();
            } else {
                aboutOverlay.classList.remove('is-open');
                document.body.classList.remove('about-open');
                window.setTimeout(() => { aboutOverlay.hidden = true; }, 220);
                if (aboutPreviousFocus && typeof aboutPreviousFocus.focus === 'function') aboutPreviousFocus.focus();
            }
        }
        aboutOpenButton?.addEventListener('click', () => setAboutOpen(true));
        aboutCloseButton?.addEventListener('click', () => setAboutOpen(false));
        aboutMenuButton?.addEventListener('click', () => {
            const open = aboutMenuButton.getAttribute('aria-expanded') !== 'true';
            aboutMenuButton.setAttribute('aria-expanded', String(open));
            aboutMenu.hidden = !open;
        });
        aboutMenu?.addEventListener('click', event => {
            if (!event.target.closest('a')) return;
            aboutMenu.hidden = true;
            aboutMenuButton?.setAttribute('aria-expanded', 'false');
        });
        document.addEventListener('click', event => {
            if (!aboutMenu || aboutMenu.hidden || event.target.closest('#about-menu, #btn-about-menu')) return;
            aboutMenu.hidden = true;
            aboutMenuButton?.setAttribute('aria-expanded', 'false');
        });
        aboutOverlay?.addEventListener('click', event => {
            if (event.target === aboutOverlay) setAboutOpen(false);
        });
        aboutOverlay?.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
        aboutOverlay?.addEventListener('touchmove', event => event.stopPropagation(), { passive: true });
        const settingsOverlay = document.getElementById('settings-overlay');
        const settingsOpenButton = document.getElementById('btn-open-settings');
        const settingsCloseButton = document.getElementById('btn-close-settings');
        let settingsPreviousFocus = null;
        function setSettingsOpen(open) {
            if (!settingsOverlay) return;
            if (open) {
                settingsPreviousFocus = document.activeElement;
                settingsOverlay.hidden = false;
                document.body.classList.add('settings-open');
                settingsOpenButton?.setAttribute('aria-expanded', 'true');
                settingsCloseButton?.focus();
                return;
            }
            settingsOverlay.hidden = true;
            document.body.classList.remove('settings-open');
            settingsOpenButton?.setAttribute('aria-expanded', 'false');
            if (settingsPreviousFocus && typeof settingsPreviousFocus.focus === 'function') settingsPreviousFocus.focus();
        }
        settingsOpenButton?.addEventListener('click', () => setSettingsOpen(true));
        settingsCloseButton?.addEventListener('click', () => setSettingsOpen(false));
        settingsOverlay?.addEventListener('click', event => {
            if (event.target === settingsOverlay) setSettingsOpen(false);
        });
        settingsOverlay?.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
        settingsOverlay?.addEventListener('touchmove', event => event.stopPropagation(), { passive: true });
        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && settingsOverlay && !settingsOverlay.hidden) {
                event.preventDefault();
                setSettingsOpen(false);
            }
        });
        window.addEventListener('keydown', event => {
            if (event.key === 'Escape' && aboutOverlay && !aboutOverlay.hidden) {
                event.preventDefault();
                setAboutOpen(false);
            }
        });
        document.getElementById('btn-sound-toggle').addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('bubblebreaker.sound', soundEnabled ? 'on' : 'off');
            document.getElementById('btn-sound-toggle').innerText = soundEnabled ? '🔊 効果音ON' : '🔇 効果音OFF';
            if (soundEnabled) playSound('ui');
        });
        document.getElementById('btn-sound-toggle').innerText = soundEnabled ? '🔊 効果音ON' : '🔇 効果音OFF';
        const collapsiblePanelButtons = [...document.querySelectorAll('[data-collapse-panel]')];
        const explorationPanelIds = new Set(['panel-group', 'panel-single']);
        function setPanelCollapsed(panelId, collapsed, persist = true) {
            const panel = document.getElementById(panelId);
            const button = document.querySelector(`[data-collapse-panel="${panelId}"]`);
            if (!panel || !button) return false;
            const closesWholePanel = explorationPanelIds.has(panelId);
            panel.classList.toggle(closesWholePanel ? 'panel-is-closed' : 'panel-is-collapsed', collapsed);
            button.setAttribute('aria-expanded', String(!collapsed));
            button.textContent = collapsed ? '+' : '−';
            button.title = closesWholePanel ? 'パネルを閉じる' : (collapsed ? 'パネルを展開' : 'パネルを畳む');
            const reopenButton = document.querySelector(`[data-reopen-panel="${panelId}"]`);
            if (reopenButton) {
                reopenButton.setAttribute('aria-expanded', String(!collapsed));
                reopenButton.tabIndex = collapsed ? 0 : -1;
            }
            if (persist) localStorage.setItem(`bubblebreaker.${panelId}.collapsed`, collapsed ? 'on' : 'off');
            return collapsed;
        }
        collapsiblePanelButtons.forEach(button => {
            button.addEventListener('click', () => {
                const panel = document.getElementById(button.dataset.collapsePanel);
                if (!panel) return;
                const closedClass = explorationPanelIds.has(button.dataset.collapsePanel) ? 'panel-is-closed' : 'panel-is-collapsed';
                setPanelCollapsed(button.dataset.collapsePanel, !panel.classList.contains(closedClass));
            });
        });
        document.querySelectorAll('[data-reopen-panel]').forEach(button => {
            button.addEventListener('click', () => {
                if (selectedPanelSize === 'none') setPanelSize(lastVisiblePanelSize);
                setPanelCollapsed(button.dataset.reopenPanel, false);
            });
        });
        collapsiblePanelButtons.forEach(button => {
            const panelId = button.dataset.collapsePanel;
            const storedCollapsed = localStorage.getItem(`bubblebreaker.${panelId}.collapsed`) === 'on';
            setPanelCollapsed(panelId, storedCollapsed, false);
        });
        const ngc3324Toggle = document.getElementById('ngc3324-toggle');
        const warpHazeToggle = document.getElementById('warp-haze-toggle');
        const motionBlurRange = document.getElementById('motion-blur-range');
        const motionBlurValue = document.getElementById('motion-blur-value');
        const savedMotionBlurStrength = localStorage.getItem('bubblebreaker.warpRadialBlurStrength');
        let motionBlurStrength = Math.max(0, Math.min(100, savedMotionBlurStrength === null ? 50 : (Number(savedMotionBlurStrength) || 0)));
        if (motionBlurRange) motionBlurRange.value = String(motionBlurStrength);
        if (motionBlurValue) motionBlurValue.value = `${motionBlurStrength}%`;
        if (typeof window.setWarpBlurStrength === 'function') window.setWarpBlurStrength(motionBlurStrength);
        motionBlurRange?.addEventListener('input', () => {
            motionBlurStrength = Math.max(0, Math.min(100, Number(motionBlurRange.value) || 0));
            if (motionBlurValue) motionBlurValue.value = `${motionBlurStrength}%`;
            localStorage.setItem('bubblebreaker.warpRadialBlurStrength', String(motionBlurStrength));
            if (typeof window.setWarpBlurStrength === 'function') window.setWarpBlurStrength(motionBlurStrength);
            document.documentElement.style.setProperty('--warp-blur-opacity', String(motionBlurStrength / 100 * 0.58));
        });
        const bubbleVisualModeButtons = [...document.querySelectorAll('[data-bubble-visual-mode]')];
        const viewModeButtons = [...document.querySelectorAll('[data-view-mode]')];
        const backgroundThemeControl = document.getElementById('background-theme');
        const bgmTypeControl = document.getElementById('bgm-type');
        const panelSizeControl = document.getElementById('right-panel-size');
        const panelSizeOptions = new Set(['large', 'medium', 'small', 'none']);
        const storedPanelSize = localStorage.getItem('bubblebreaker.rightPanelSize');
        let selectedPanelSize = panelSizeOptions.has(storedPanelSize) ? storedPanelSize : 'medium';
        let lastVisiblePanelSize = ['large', 'medium', 'small'].includes(storedPanelSize)
            ? storedPanelSize
            : (localStorage.getItem('bubblebreaker.rightPanelLastVisibleSize') || 'medium');
        function setPanelSize(size, persist = true) {
            selectedPanelSize = panelSizeOptions.has(size) ? size : 'medium';
            if (selectedPanelSize !== 'none') lastVisiblePanelSize = selectedPanelSize;
            document.querySelectorAll('#panel-group, #panel-single').forEach(panel => {
                panel.dataset.panelSize = selectedPanelSize;
                panel.classList.toggle('panel-size-none', selectedPanelSize === 'none');
            });
            if (panelSizeControl) panelSizeControl.value = selectedPanelSize;
            if (persist) {
                localStorage.setItem('bubblebreaker.rightPanelSize', selectedPanelSize);
                localStorage.setItem('bubblebreaker.rightPanelLastVisibleSize', lastVisiblePanelSize);
            }
        }
        panelSizeControl?.addEventListener('change', () => setPanelSize(panelSizeControl.value));
        setPanelSize(selectedPanelSize, false);
        const movementKeys = window.__bubbleBreakerMovementKeys || new Set();
        window.__bubbleBreakerMovementKeys = movementKeys;
        function isTextEditingTarget(target) {
            return Boolean(target && (target.matches('input, textarea, select, button, [contenteditable="true"]') || target.isContentEditable));
        }
        window.addEventListener('keydown', event => {
            if (document.body.classList.contains('about-open')) return;
            if (isTextEditingTarget(event.target)) return;
            window.__bubbleBreakerShiftDown = event.shiftKey || event.key === 'Shift';
            const key = event.key.toLowerCase();
            if (['w', 'a', 's', 'd'].includes(key)) {
                movementKeys.add(key);
                event.preventDefault();
            }
        });
        window.addEventListener('keyup', event => {
            movementKeys.delete(event.key.toLowerCase());
            if (event.key === 'Shift') window.__bubbleBreakerShiftDown = false;
        });
        window.addEventListener('blur', () => {
            movementKeys.clear();
            window.__bubbleBreakerShiftDown = false;
        });
        const storedNGC3324Visibility = localStorage.getItem('bubblebreaker.ngc3324');
        const ngc3324Visible = storedNGC3324Visibility !== 'off';
        ngc3324Toggle.checked = ngc3324Visible;
        if (typeof setNGC3324BackgroundVisible === 'function') setNGC3324BackgroundVisible(ngc3324Visible);
        const storedWarpHaze = localStorage.getItem('bubblebreaker.warpHaze');
        let warpHazeEnabled = storedWarpHaze !== 'off';
        warpHazeToggle.checked = warpHazeEnabled;
        function updateWarpHazeLayer() {
            const inputScreen = document.getElementById('screen-input');
            if (!inputScreen) return;
            inputScreen.classList.toggle('warp-haze-active', Boolean(isDiving && warpHazeEnabled));
            const blurLayer = document.getElementById('warp-blur-2d');
            if (blurLayer) blurLayer.classList.toggle('is-active', Boolean(isDiving && warpHazeEnabled && selectedViewMode === '2d'));
            document.documentElement.style.setProperty('--warp-blur-opacity', String(motionBlurStrength / 100 * 0.58));
        }
        const bubbleVisualModeOptions = ['network', 'classic', 'deepSea', 'data'];
        let storedBubbleVisualMode = localStorage.getItem('bubblebreaker.bubbleVisualMode');
        if (localStorage.getItem('bubblebreaker.bubbleVisualModeVersion') !== '3') {
            storedBubbleVisualMode = 'network';
            localStorage.setItem('bubblebreaker.bubbleVisualMode', 'network');
            localStorage.setItem('bubblebreaker.bubbleVisualModeVersion', '3');
        }
        let selectedBubbleVisualMode = typeof setBubbleVisualMode === 'function'
            ? setBubbleVisualMode(bubbleVisualModeOptions.includes(storedBubbleVisualMode) ? storedBubbleVisualMode : 'network')
            : 'network';
        bubbleVisualModeButtons.forEach(button => {
            const isSelected = button.dataset.bubbleVisualMode === selectedBubbleVisualMode;
            button.setAttribute('aria-pressed', String(isSelected));
            button.classList.toggle('is-selected', isSelected);
        });
        const backgroundThemeOptions = ['space', 'data'];
        const storedBackgroundTheme = localStorage.getItem('bubblebreaker.backgroundTheme');
        let selectedBackgroundTheme = backgroundThemeOptions.includes(storedBackgroundTheme) ? storedBackgroundTheme : 'space';
        if (storedBackgroundTheme === 'deepSea') localStorage.setItem('bubblebreaker.backgroundTheme', 'space');
        if (typeof setBackgroundTheme === 'function') selectedBackgroundTheme = setBackgroundTheme(selectedBackgroundTheme);
        backgroundThemeControl.value = selectedBackgroundTheme;
        bgmTypeControl.value = bgmType;
        [
            'bubblebreaker.fov',
            'bubblebreaker.warpSpeed',
            'bubblebreaker.warpStops',
            'bubblebreaker.motionBlur',
            'bubblebreaker.motionBlurStrength',
            'bubblebreaker.bubbleColorTheme',
            'bubblebreaker.volume',
            'bubblebreaker.bgm',
            'bubblebreaker.bgmAutoNext',
            'bubblebreaker.bgmTransition',
            'bubblebreaker.explorerMode',
            'bubblebreaker.titleVisible',
            'bubblebreaker.uiVisible'
        ].forEach(key => localStorage.removeItem(key));
        const bgmAudioElement = document.getElementById('bgm-audio');
        bgmAudioElement.addEventListener('error', () => {
            console.warn('[BubbleBreaker][Audio] BGMファイルを読み込めません', { src: bgmAudioElement.currentSrc || bgmAudioElement.src });
        });
        bgmAudioElement.addEventListener('canplay', () => {
            console.info('[BubbleBreaker][Audio] BGMを再生可能になりました', { src: bgmAudioElement.currentSrc || bgmAudioElement.src });
        });
        ngc3324Toggle.addEventListener('change', () => {
            const visible = ngc3324Toggle.checked;
            localStorage.setItem('bubblebreaker.ngc3324', visible ? 'on' : 'off');
            if (typeof setNGC3324BackgroundVisible === 'function') setNGC3324BackgroundVisible(visible);
            if (typeof window.syncTwoDExplorationMode === 'function' && explorationViewMode === '2d') window.syncTwoDExplorationMode('2d', false);
            showToast(visible ? 'NGC 3324背景を表示しました' : 'NGC 3324背景を非表示にしました');
        });
        warpHazeToggle.addEventListener('change', () => {
            warpHazeEnabled = warpHazeToggle.checked;
            localStorage.setItem('bubblebreaker.warpHaze', warpHazeEnabled ? 'on' : 'off');
            updateWarpHazeLayer();
            showToast(warpHazeEnabled ? 'ワープ中の靄を表示します' : 'ワープ中の靄を非表示にします');
        });
        bubbleVisualModeButtons.forEach(button => {
            button.addEventListener('click', () => {
                selectedBubbleVisualMode = typeof setBubbleVisualMode === 'function'
                    ? setBubbleVisualMode(button.dataset.bubbleVisualMode)
                    : 'network';
                localStorage.setItem('bubblebreaker.bubbleVisualMode', selectedBubbleVisualMode);
                bubbleVisualModeButtons.forEach(option => {
                    const isSelected = option.dataset.bubbleVisualMode === selectedBubbleVisualMode;
                    option.setAttribute('aria-pressed', String(isSelected));
                    option.classList.toggle('is-selected', isSelected);
                });
                const visualLabel = selectedBubbleVisualMode === 'network' ? '装飾あり' : selectedBubbleVisualMode === 'classic' ? '装飾なし' : selectedBubbleVisualMode === 'deepSea' ? '深海テーマ' : 'データ空間テーマ';
                showToast(`${visualLabel}を表示しました`);
            });
        });
        const storedViewMode = localStorage.getItem('bubblebreaker.viewMode') === '2d' ? '2d' : '3d';
        let selectedViewMode = typeof setExplorationViewMode === 'function'
            ? setExplorationViewMode(storedViewMode, false)
            : storedViewMode;
        if (selectedViewMode === '2d' && window.innerWidth <= 720) setPanelCollapsed('panel-bgm', true, false);
        function updateViewModeButtons() {
            viewModeButtons.forEach(button => {
                const selected = button.dataset.viewMode === selectedViewMode;
                button.setAttribute('aria-pressed', String(selected));
                button.classList.toggle('is-selected', selected);
            });
        }
        updateViewModeButtons();
        viewModeButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (loadingAnimation || isGenerating) {
                    showToast('情報宇宙の生成中は表示モードを変更できません');
                    return;
                }
                selectedViewMode = typeof setExplorationViewMode === 'function'
                    ? setExplorationViewMode(button.dataset.viewMode, true)
                    : button.dataset.viewMode;
                localStorage.setItem('bubblebreaker.viewMode', selectedViewMode);
                if (typeof window.onSceneBubbleScreenChanged === 'function') window.onSceneBubbleScreenChanged(state.screen);
                if (selectedViewMode === '2d' && window.innerWidth <= 720) {
                    setPanelCollapsed('panel-bgm', true, false);
                } else {
                    setPanelCollapsed('panel-bgm', localStorage.getItem('bubblebreaker.panel-bgm.collapsed') === 'on', false);
                }
                updateViewModeButtons();
                showToast(selectedViewMode === '2d' ? '2D探索表示へ切り替えました' : '奥行きのある3D表示へ切り替えました');
            });
        });
        backgroundThemeControl.addEventListener('change', () => {
            selectedBackgroundTheme = typeof setBackgroundTheme === 'function'
                ? setBackgroundTheme(backgroundThemeControl.value)
                : backgroundThemeControl.value;
            localStorage.setItem('bubblebreaker.backgroundTheme', selectedBackgroundTheme);
            showToast(`背景テーマを「${backgroundThemeControl.options[backgroundThemeControl.selectedIndex].text}」へ変更しました`);
        });
        bgmTypeControl.addEventListener('change', () => {
            bgmType = bgmTypeControl.value;
            localStorage.setItem('bubblebreaker.bgmType', bgmType);
            if (bgmType === 'none') stopBackgroundMusic(); else startBackgroundMusic();
        });
        // --- マウスホイール・ピンチ操作によるズーム/階層移動 ---
        let wheelTimeout; // 連続スクロールの過剰反応を防ぐためのタイマー

        function handleZoomNavigation(direction) {
            if (state.screen === 'GROUP' && typeof markGroupCameraInteraction === 'function') {
                markGroupCameraInteraction(direction);
            }

            if (direction === 'zoomOut') {
                // 下スクロール（手前に引く）＝ズームアウト（親階層へ戻る）
                if (state.screen === 'DETAIL') switchScreen('ANALYSIS');
                else if (state.screen === 'ANALYSIS') loadSingle(state.bubbleData);
                else if (state.screen === 'SINGLE') loadGroup(state.groupId);
                else if (state.screen === 'GROUP' && state.groupData && state.groupData.parentId) {
                    // 最初の操作は現在のバブル群全体を収める俯瞰に使い、
                    // 俯瞰完了後の追加操作で親カテゴリへ戻る。
                    if (explorationViewMode === '2d' || typeof requestGroupZoomOut !== 'function' || requestGroupZoomOut()) {
                        loadGroup(state.groupData.parentId);
                    }
                }
                return;
            }

            // 上スクロール（奥へ押し込む）＝ズームイン（子階層へ進む）
            if (state.screen === 'SINGLE' && state.bubbleData && state.bubbleData.childId) {
                loadGroup(state.bubbleData.childId);
            }
        }

        const canvasElement = document.querySelector('#canvas-container canvas');
        const touchZoomState = { lastDistance: null, handled: false };
        function getTouchDistance(touches) {
            if (!touches || touches.length < 2) return null;
            const first = touches[0];
            const second = touches[1];
            return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
        }
        if (canvasElement) {
            canvasElement.addEventListener('touchstart', event => {
                if (event.touches.length !== 2) return;
                touchZoomState.lastDistance = getTouchDistance(event.touches);
                touchZoomState.handled = false;
                event.preventDefault();
            }, { passive: false });
            canvasElement.addEventListener('touchmove', event => {
                if (event.touches.length !== 2) return;
                const currentDistance = getTouchDistance(event.touches);
                if (currentDistance === null || touchZoomState.lastDistance === null) return;
                const distanceDelta = currentDistance - touchZoomState.lastDistance;
                touchZoomState.lastDistance = currentDistance;
                event.preventDefault();
                if (touchZoomState.handled || Math.abs(distanceDelta) < 8) return;
                touchZoomState.handled = true;
                handleZoomNavigation(distanceDelta > 0 ? 'zoomIn' : 'zoomOut');
            }, { passive: false });
            const resetTouchZoom = () => {
                touchZoomState.lastDistance = null;
                touchZoomState.handled = false;
            };
            canvasElement.addEventListener('touchend', resetTouchZoom, { passive: false });
            canvasElement.addEventListener('touchcancel', resetTouchZoom, { passive: false });
        }

        window.addEventListener('wheel', (e) => {
            if (e.target.closest('#about-overlay')) return;
            if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (e.target.closest('.saved-explorations-dialog, .saved-exploration-list, .api-key-card, .first-run-guide-card, .contextual-hint-content, .detail-timeline')) return;
            // スクロール可能なUI領域（右側のリストなど）を操作している場合は、階層移動を発生させない
            const cosmicControl = e.target.closest('#panel-bgm');
            if (cosmicControl) {
                if (e.ctrlKey) e.preventDefault(); // Ctrlキー押下時のブラウザの文字拡大は防ぐ
                return;
            }
            const scrollable = e.target.closest('.exploration-panel, .overflow-y-auto, #screen-analysis, #screen-detail, .detail-main');
            if (scrollable) {
                if(e.ctrlKey) e.preventDefault(); // Ctrlキー押下時のブラウザの文字拡大は防ぐ
                return;
            }

            // それ以外の空間をホイールした場合は、ブラウザのデフォルトスクロールを止める
            e.preventDefault();

            // 一度スクロール判定したら、1秒間は次の判定を受け付けない（誤作動防止）
            if(wheelTimeout) return;
            wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 1000);
            if (e.deltaY !== 0) handleZoomNavigation(e.deltaY > 0 ? 'zoomOut' : 'zoomIn');
        }, { passive: false }); // e.preventDefault()を機能させるために必要
