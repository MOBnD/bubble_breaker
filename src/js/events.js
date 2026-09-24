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
        if (typeof window.initializeBubbleSessionUI === 'function') window.initializeBubbleSessionUI();
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
            universePromise.then(universe => {
                pendingUniverse = universe;
                if (typeof window.markLoadingUniverseReady === 'function') window.markLoadingUniverseReady();
            });

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

        // テキストボックスでEnterキーを押した時もダイブボタンをクリックした扱いにする
        document.getElementById('input-opinion').addEventListener('keypress', (e) => {
            if(e.key === 'Enter') document.getElementById('btn-dive').click();
        });

        // --- 各種UIボタンのクリックイベント ---
        document.getElementById('btn-zoomout-group').addEventListener('click', () => {
            if (explorationViewMode === '2d' && state.groupData && state.groupData.parentId) {
                loadGroup(state.groupData.parentId);
                return;
            }
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
            if (e.target.closest('.detail-timeline')) return;
            // スクロール可能なUI領域（右側のリストなど）を操作している場合は、階層移動を発生させない
            const cosmicControl = e.target.closest('#panel-bgm');
            if (cosmicControl) {
                if (e.ctrlKey) e.preventDefault(); // Ctrlキー押下時のブラウザの文字拡大は防ぐ
                return;
            }
            const scrollable = e.target.closest('.exploration-panel, .overflow-y-auto');
            if(scrollable && state.screen !== 'SINGLE' && state.screen !== 'ANALYSIS') {
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
