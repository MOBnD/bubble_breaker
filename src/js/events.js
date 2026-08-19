        // ==========================================
        // === 5. イベントリスナー (ユーザー操作の受付) ===
        // ==========================================
        
        // --- 3Dオブジェクト(球体)のクリック判定処理 ---
        const raycaster = new THREE.Raycaster(); // マウス位置から光線を飛ばして交差判定するクラス
        const mouse = new THREE.Vector2();       // マウスの座標(2D)

        window.addEventListener('click', (event) => {
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
        function updateApiKeyUI(configured, message = null) {
            if (apiKeyStatus) {
                apiKeyStatus.innerText = message || (configured ? 'APIキー設定済み（このページのメモリ内のみ）' : 'APIキー未設定');
                apiKeyStatus.classList.toggle('text-emerald-200', configured);
                apiKeyStatus.classList.toggle('text-amber-200', !configured);
            }
            if (diveButton) diveButton.disabled = !configured || isGenerating;
        }
        const bootstrapKeyConfigured = typeof window.hasRuntimeOpenAIKey === 'function' && window.hasRuntimeOpenAIKey();
        updateApiKeyUI(bootstrapKeyConfigured);
        apiKeySetButton.addEventListener('click', () => {
            const value = apiKeyInput.value.trim();
            if (value.length < 10) {
                if (typeof window.setRuntimeOpenAIKey === 'function') window.setRuntimeOpenAIKey('');
                updateApiKeyUI(false, 'APIキーを入力してください');
                return;
            }
            const configured = typeof window.setRuntimeOpenAIKey === 'function' && window.setRuntimeOpenAIKey(value);
            apiKeyInput.value = '';
            updateApiKeyUI(configured, configured ? 'APIキー設定済み（このページのメモリ内のみ）' : 'APIキーを確認してください');
        });
        apiKeyInput.addEventListener('keypress', event => {
            if (event.key === 'Enter') apiKeySetButton.click();
        });
        document.getElementById('btn-dive').addEventListener('click', async () => {
            if (isDiving || isGenerating) return;
            if (typeof window.hasRuntimeOpenAIKey !== 'function' || !window.hasRuntimeOpenAIKey()) {
                updateApiKeyUI(false, '意見入力の前にAPIキーを設定してください');
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
            updateApiKeyUI(true);
            startBackgroundMusic();

            // API応答をワープ演出と並行して取得する。API失敗時は既存モックDBへ戻す。
            const universePromise = requestDynamicUniverse(input).then(result => {
                if (result) {
                    showToast('Web Searchでバブル宇宙を生成しました');
                    return result;
                }
                showToast('階層生成を完了できなかったため固定データを使用します');
                return normalizeFallbackUniverse(input);
            }).catch(error => {
                apiError('Dynamic BubbleBreaker data generation failed。固定データを使用します', { status: error.status || null, requestId: error.requestId || null, message: redactApiLog(error.message), body: error.body || null });
                showToast('検索に失敗したため固定データを使用します');
                return normalizeFallbackUniverse(input);
            });
            universePromise.then(universe => { pendingUniverse = universe; });

            panel.style.transform = 'scale(0.5)';
            panel.style.opacity = '0';
            panel.style.pointerEvents = 'none';
            showToast('Web Searchで対象のバブル宇宙を調査しています... 🚀');

            startLoadingAnimation();
            updateWarpHazeLayer();
            loadingAnimation.onReady = () => {
                const universe = pendingUniverse;
                pendingUniverse = null;
                if (!universe) return;
                activeDB = universe.db;
                focusEntryGroupId = universe.entryGroupId;
                focusEntryBubbleId = universe.entryBubbleId || null;
                document.getElementById('screen-input').classList.remove('screen-active');
                document.getElementById('screen-input').classList.add('screen-hidden');
                camera.fov = 60;
                camera.updateProjectionMatrix();
                camera.rotation.set(0, 0, 0);
                isGenerating = false;
                button.disabled = false;
                updateApiKeyUI(true);
                updateWarpHazeLayer();
                loadGroup(universe.entryGroupId, true);
            };
        });

        // テキストボックスでEnterキーを押した時もダイブボタンをクリックした扱いにする
        document.getElementById('input-opinion').addEventListener('keypress', (e) => {
            if(e.key === 'Enter') document.getElementById('btn-dive').click();
        });

        // --- 各種UIボタンのクリックイベント ---
        document.getElementById('btn-zoomout-group').addEventListener('click', () => {
            if (state.groupData && state.groupData.parentId && typeof requestGroupZoomOut === 'function' && requestGroupZoomOut()) {
                loadGroup(state.groupData.parentId);
            }
        });
        document.getElementById('btn-zoomout-single').addEventListener('click', () => loadGroup(state.groupId));
        document.getElementById('btn-zoomin-single').addEventListener('click', () => {
            if(state.bubbleData && state.bubbleData.childId) loadGroup(state.bubbleData.childId);
        });
        document.getElementById('btn-analyze').addEventListener('click', () => loadAnalysis());
        document.getElementById('analysis-center-title').addEventListener('click', () => loadSingle(state.bubbleData));
        document.getElementById('btn-back-detail').addEventListener('click', () => switchScreen('ANALYSIS'));
        document.getElementById('btn-sound-toggle').addEventListener('click', () => {
            soundEnabled = !soundEnabled;
            localStorage.setItem('bubblebreaker.sound', soundEnabled ? 'on' : 'off');
            document.getElementById('btn-sound-toggle').innerText = soundEnabled ? '🔊 効果音ON' : '🔇 効果音OFF';
            if (soundEnabled) playSound('ui');
        });
        document.getElementById('btn-sound-toggle').innerText = soundEnabled ? '🔊 効果音ON' : '🔇 効果音OFF';
        const collapsiblePanelButtons = [...document.querySelectorAll('[data-collapse-panel]')];
        function setPanelCollapsed(panelId, collapsed, persist = true) {
            const panel = document.getElementById(panelId);
            const button = document.querySelector(`[data-collapse-panel="${panelId}"]`);
            if (!panel || !button) return false;
            panel.classList.toggle('panel-is-collapsed', collapsed);
            button.setAttribute('aria-expanded', String(!collapsed));
            button.textContent = collapsed ? '+' : '−';
            button.title = collapsed ? 'パネルを展開' : 'パネルを畳む';
            if (persist) localStorage.setItem(`bubblebreaker.${panelId}.collapsed`, collapsed ? 'on' : 'off');
            return collapsed;
        }
        collapsiblePanelButtons.forEach(button => {
            button.addEventListener('click', () => {
                const panel = document.getElementById(button.dataset.collapsePanel);
                if (!panel) return;
                setPanelCollapsed(button.dataset.collapsePanel, !panel.classList.contains('panel-is-collapsed'));
            });
        });
        collapsiblePanelButtons.forEach(button => {
            const panelId = button.dataset.collapsePanel;
            const storedCollapsed = localStorage.getItem(`bubblebreaker.${panelId}.collapsed`) === 'on';
            setPanelCollapsed(panelId, storedCollapsed, false);
        });
        const bgmToggle = document.getElementById('bgm-toggle');
        const ngc3324Toggle = document.getElementById('ngc3324-toggle');
        const warpHazeToggle = document.getElementById('warp-haze-toggle');
        const bubbleVisualModeButtons = [...document.querySelectorAll('[data-bubble-visual-mode]')];
        const bubbleColorThemeControl = document.getElementById('bubble-color-theme');
        const backgroundThemeControl = document.getElementById('background-theme');
        const panelSizeButtons = [...document.querySelectorAll('[data-panel-size]')];
        const volumeControl = document.getElementById('audio-volume');
        const bgmTypeControl = document.getElementById('bgm-type');
        const bgmAutoNextControl = document.getElementById('bgm-auto-next');
        const bgmTransitionControl = document.getElementById('bgm-transition');
        const explorerModeControl = document.getElementById('explorer-mode');
        const titleToggleButton = document.getElementById('btn-toggle-title');
        const uiToggleButton = document.getElementById('btn-toggle-ui');
        const movementKeys = window.__bubbleBreakerMovementKeys || new Set();
        window.__bubbleBreakerMovementKeys = movementKeys;
        function isTextEditingTarget(target) {
            return Boolean(target && (target.matches('input, textarea, select, button, [contenteditable="true"]') || target.isContentEditable));
        }
        window.setTitleVisibility = function(visible, persist = true) {
            const brandHud = document.querySelector('.brand-hud');
            if (brandHud) brandHud.classList.toggle('ui-title-hidden', !visible);
            if (titleToggleButton) {
                titleToggleButton.setAttribute('aria-pressed', String(visible));
                titleToggleButton.textContent = `タイトル表示 ${visible ? 'ON' : 'OFF'}`;
            }
            if (persist) localStorage.setItem('bubblebreaker.titleVisible', visible ? 'on' : 'off');
            return visible;
        }
        window.setUIVisibility = function(visible, persist = true) {
            const uiLayer = document.getElementById('ui-layer');
            const labels = document.getElementById('labels-container');
            if (uiLayer) uiLayer.classList.toggle('ui-all-hidden', !visible);
            if (labels) labels.classList.toggle('ui-all-hidden', !visible);
            if (uiToggleButton) {
                uiToggleButton.setAttribute('aria-pressed', String(visible));
                uiToggleButton.textContent = `UI表示 ${visible ? 'ON' : 'OFF'}`;
            }
            if (persist) localStorage.setItem('bubblebreaker.uiVisible', visible ? 'on' : 'off');
            return visible;
        }
        const titleVisible = localStorage.getItem('bubblebreaker.titleVisible') !== 'off';
        const uiVisible = localStorage.getItem('bubblebreaker.uiVisible') !== 'off';
        window.setTitleVisibility(titleVisible, false);
        window.setUIVisibility(uiVisible, false);
        window.toggleTitleVisibility = () => window.setTitleVisibility(!document.querySelector('.brand-hud').classList.contains('ui-title-hidden'));
        window.toggleUIVisibility = () => window.setUIVisibility(!document.getElementById('ui-layer').classList.contains('ui-all-hidden'));
        if (titleToggleButton) titleToggleButton.addEventListener('click', window.toggleTitleVisibility);
        if (uiToggleButton) uiToggleButton.addEventListener('click', window.toggleUIVisibility);
        window.addEventListener('keydown', event => {
            if (isTextEditingTarget(event.target)) return;
            window.__bubbleBreakerShiftDown = event.shiftKey || event.key === 'Shift';
            const key = event.key.toLowerCase();
            if (key === 'h') {
                event.preventDefault();
                window.toggleTitleVisibility();
                return;
            }
            if (key === 'u') {
                event.preventDefault();
                window.toggleUIVisibility();
                return;
            }
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
        bgmToggle.checked = bgmEnabled;
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
        }
        const allowedPanelSizes = new Set(['small', 'medium', 'large']);
        const storedPanelSize = localStorage.getItem('bubblebreaker.panelSize');

        function applyExplorationPanelSize(size) {
            const nextSize = allowedPanelSizes.has(size) ? size : 'medium';
            document.querySelectorAll('.exploration-panel').forEach(panel => {
                panel.classList.remove('panel-size-small', 'panel-size-medium', 'panel-size-large');
                panel.classList.add(`panel-size-${nextSize}`);
            });
            panelSizeButtons.forEach(button => {
                const isSelected = button.dataset.panelSize === nextSize;
                button.setAttribute('aria-pressed', String(isSelected));
                button.classList.toggle('is-selected', isSelected);
            });
            return nextSize;
        }

        let explorationPanelSize = applyExplorationPanelSize(storedPanelSize || 'medium');
        const bubbleVisualModeOptions = ['network', 'classic', 'cosmic', 'deepSea', 'data'];
        const storedBubbleVisualMode = localStorage.getItem('bubblebreaker.bubbleVisualMode');
        let selectedBubbleVisualMode = typeof setBubbleVisualMode === 'function'
            ? setBubbleVisualMode(bubbleVisualModeOptions.includes(storedBubbleVisualMode) ? storedBubbleVisualMode : 'network')
            : 'network';
        bubbleVisualModeButtons.forEach(button => {
            const isSelected = button.dataset.bubbleVisualMode === selectedBubbleVisualMode;
            button.setAttribute('aria-pressed', String(isSelected));
            button.classList.toggle('is-selected', isSelected);
        });
        const bubbleColorThemeOptions = ['legacy', 'neon', 'warm', 'space', 'deepSea', 'data'];
        const storedBubbleColorTheme = localStorage.getItem('bubblebreaker.bubbleColorTheme');
        let selectedBubbleColorTheme = bubbleColorThemeOptions.includes(storedBubbleColorTheme) ? storedBubbleColorTheme : 'legacy';
        if (typeof setBubbleColorTheme === 'function') selectedBubbleColorTheme = setBubbleColorTheme(selectedBubbleColorTheme);
        bubbleColorThemeControl.value = selectedBubbleColorTheme;
        const backgroundThemeOptions = ['space', 'deepSea', 'data'];
        const storedBackgroundTheme = localStorage.getItem('bubblebreaker.backgroundTheme');
        let selectedBackgroundTheme = backgroundThemeOptions.includes(storedBackgroundTheme) ? storedBackgroundTheme : 'space';
        if (typeof setBackgroundTheme === 'function') selectedBackgroundTheme = setBackgroundTheme(selectedBackgroundTheme);
        backgroundThemeControl.value = selectedBackgroundTheme;
        volumeControl.value = String(audioVolume);
        bgmTypeControl.value = bgmType;
        bgmAutoNextControl.checked = bgmAutoNext;
        bgmTransitionControl.value = bgmTransition;
        explorerModeControl.checked = explorerMode;
        const bgmAudioElement = document.getElementById('bgm-audio');
        bgmAudioElement.addEventListener('error', () => {
            console.warn('[BubbleBreaker][Audio] BGMファイルを読み込めません', { src: bgmAudioElement.currentSrc || bgmAudioElement.src });
        });
        bgmAudioElement.addEventListener('canplay', () => {
            console.info('[BubbleBreaker][Audio] BGMを再生可能になりました', { src: bgmAudioElement.currentSrc || bgmAudioElement.src });
        });
        bgmAudioElement.addEventListener('ended', () => {
            if (!bgmAutoNext) return;
            bgmTrackIndex = (bgmTrackIndex + 1) % bgmTracks.length;
            startBackgroundMusic();
        });
        bgmToggle.addEventListener('change', () => {
            bgmEnabled = bgmToggle.checked;
            localStorage.setItem('bubblebreaker.bgm', bgmEnabled ? 'on' : 'off');
            if (bgmEnabled) startBackgroundMusic(); else stopBackgroundMusic();
        });
        ngc3324Toggle.addEventListener('change', () => {
            const visible = ngc3324Toggle.checked;
            localStorage.setItem('bubblebreaker.ngc3324', visible ? 'on' : 'off');
            if (typeof setNGC3324BackgroundVisible === 'function') setNGC3324BackgroundVisible(visible);
            showToast(visible ? 'NGC 3324背景を表示しました' : 'NGC 3324背景を非表示にしました');
        });
        warpHazeToggle.addEventListener('change', () => {
            warpHazeEnabled = warpHazeToggle.checked;
            localStorage.setItem('bubblebreaker.warpHaze', warpHazeEnabled ? 'on' : 'off');
            updateWarpHazeLayer();
            showToast(warpHazeEnabled ? 'ワープ中の靄を表示します' : 'ワープ中の靄を非表示にします');
        });
        panelSizeButtons.forEach(button => {
            button.addEventListener('click', () => {
                explorationPanelSize = applyExplorationPanelSize(button.dataset.panelSize);
                localStorage.setItem('bubblebreaker.panelSize', explorationPanelSize);
                showToast(`探索パネルを${explorationPanelSize === 'small' ? '小' : explorationPanelSize === 'large' ? '大' : '中'}サイズに変更しました`);
            });
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
                const visualLabel = selectedBubbleVisualMode === 'network'
                    ? '装飾あり'
                    : selectedBubbleVisualMode === 'classic'
                        ? '装飾なし'
                        : selectedBubbleVisualMode === 'cosmic'
                            ? '宇宙テーマ'
                            : selectedBubbleVisualMode === 'deepSea'
                                ? '深海テーマ'
                                : 'データ空間テーマ';
                showToast(`${visualLabel}を表示しました`);
            });
        });
        bubbleColorThemeControl.addEventListener('change', () => {
            selectedBubbleColorTheme = typeof setBubbleColorTheme === 'function'
                ? setBubbleColorTheme(bubbleColorThemeControl.value)
                : bubbleColorThemeControl.value;
            localStorage.setItem('bubblebreaker.bubbleColorTheme', selectedBubbleColorTheme);
            showToast(`球色テーマを「${bubbleColorThemeControl.options[bubbleColorThemeControl.selectedIndex].text}」へ変更しました`);
        });
        backgroundThemeControl.addEventListener('change', () => {
            selectedBackgroundTheme = typeof setBackgroundTheme === 'function'
                ? setBackgroundTheme(backgroundThemeControl.value)
                : backgroundThemeControl.value;
            localStorage.setItem('bubblebreaker.backgroundTheme', selectedBackgroundTheme);
            showToast(`背景テーマを「${backgroundThemeControl.options[backgroundThemeControl.selectedIndex].text}」へ変更しました`);
        });
        volumeControl.addEventListener('input', () => {
            audioVolume = Number(volumeControl.value);
            localStorage.setItem('bubblebreaker.volume', String(audioVolume));
            if (bgmEnabled) startBackgroundMusic();
        });
        bgmTypeControl.addEventListener('change', () => {
            bgmType = bgmTypeControl.value;
            bgmTrackIndex = Math.max(0, bgmTracks.indexOf(bgmType));
            localStorage.setItem('bubblebreaker.bgmType', bgmType);
            if (bgmEnabled) startBackgroundMusic();
        });
        bgmAutoNextControl.addEventListener('change', () => {
            bgmAutoNext = bgmAutoNextControl.checked;
            localStorage.setItem('bubblebreaker.bgmAutoNext', bgmAutoNext ? 'on' : 'off');
            if (bgmEnabled) startBackgroundMusic();
        });
        bgmTransitionControl.addEventListener('change', () => {
            bgmTransition = bgmTransitionControl.value;
            localStorage.setItem('bubblebreaker.bgmTransition', bgmTransition);
        });
        explorerModeControl.addEventListener('change', () => {
            explorerMode = explorerModeControl.checked;
            localStorage.setItem('bubblebreaker.explorerMode', explorerMode ? 'on' : 'off');
            if (explorerMode && state.screen === 'SINGLE' && state.groupId) loadGroup(state.groupId);
        });

        // --- マウスホイール(トラックパッドのスワイプ)操作によるズーム/階層移動 ---
        let wheelTimeout; // 連続スクロールの過剰反応を防ぐためのタイマー

        window.addEventListener('wheel', (e) => {
            // スクロール可能なUI領域（右側のリストなど）を操作している場合は、階層移動を発生させない
            const scrollable = e.target.closest('.overflow-y-auto');
            if(scrollable && state.screen !== 'SINGLE' && state.screen !== 'ANALYSIS') {
                if(e.ctrlKey) e.preventDefault(); // Ctrlキー押下時のブラウザの文字拡大は防ぐ
                return; 
            }
            
            // それ以外の空間をホイールした場合は、ブラウザのデフォルトスクロールを止める
            e.preventDefault();
            
            // 一度スクロール判定したら、1秒間は次の判定を受け付けない（誤作動防止）
            if (state.screen === 'GROUP' && typeof markGroupCameraInteraction === 'function') {
                markGroupCameraInteraction(e.deltaY < 0 ? 'zoomIn' : 'zoomOut');
            }
            if(wheelTimeout) return;
            wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 1000);

            if (e.deltaY > 0) { 
                // 下スクロール（手前に引く）＝ ズームアウト（親階層へ戻る）
                if (state.screen === 'DETAIL') switchScreen('ANALYSIS');
                else if (state.screen === 'ANALYSIS') loadSingle(state.bubbleData);
                else if (state.screen === 'SINGLE') loadGroup(state.groupId);
                else if (state.screen === 'GROUP' && state.groupData && state.groupData.parentId) {
                    // 最初の操作は現在のバブル群全体を収める俯瞰に使い、
                    // 俯瞰完了後の追加操作で親カテゴリへ戻る。
                    if (typeof requestGroupZoomOut !== 'function' || requestGroupZoomOut()) {
                        loadGroup(state.groupData.parentId);
                    }
                }
            } else if (e.deltaY < 0) { 
                // 上スクロール（奥へ押し込む）＝ ズームイン（子階層へ進む）
                if (state.screen === 'SINGLE' && state.bubbleData && state.bubbleData.childId) {
                    loadGroup(state.bubbleData.childId);
                } else if (state.screen === 'GROUP' && explorerMode) {
                    const targetBubble = getExplorerZoomTarget();
                    if (targetBubble) {
                        explorerSelectedBubbleId = targetBubble.id;
                        loadGroup(targetBubble.childId);
                    }
                }
            }
        }, { passive: false }); // e.preventDefault()を機能させるために必要
