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
        document.getElementById('btn-dive').addEventListener('click', async () => {
            if (isDiving || isGenerating) return;
            const input = document.getElementById('input-opinion').value.trim();
            if (!input) {
                showToast('意見を入力してください');
                return;
            }

            const button = document.getElementById('btn-dive');
            const panel = document.getElementById('input-panel');
            button.disabled = true;
            isGenerating = true;
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
        const reopenPanelsButton = document.getElementById('btn-reopen-panels');
        document.querySelectorAll('[data-close-panel]').forEach(button => {
            button.addEventListener('click', () => {
                const panel = document.getElementById(button.dataset.closePanel);
                if (panel) panel.classList.add('hidden');
                reopenPanelsButton.classList.remove('hidden');
            });
        });
        reopenPanelsButton.addEventListener('click', () => {
            document.querySelectorAll('[data-close-panel]').forEach(button => {
                const panel = document.getElementById(button.dataset.closePanel);
                if (panel) panel.classList.remove('hidden');
            });
            reopenPanelsButton.classList.add('hidden');
        });
        const bgmToggle = document.getElementById('bgm-toggle');
        const volumeControl = document.getElementById('audio-volume');
        const bgmTypeControl = document.getElementById('bgm-type');
        const bgmAutoNextControl = document.getElementById('bgm-auto-next');
        const bgmTransitionControl = document.getElementById('bgm-transition');
        const explorerModeControl = document.getElementById('explorer-mode');
        bgmToggle.checked = bgmEnabled;
        volumeControl.value = String(audioVolume);
        bgmTypeControl.value = bgmType;
        bgmAutoNextControl.checked = bgmAutoNext;
        bgmTransitionControl.value = bgmTransition;
        explorerModeControl.checked = explorerMode;
        document.getElementById('bgm-audio').addEventListener('ended', () => {
            if (!bgmAutoNext) return;
            bgmTrackIndex = (bgmTrackIndex + 1) % bgmTracks.length;
            startBackgroundMusic();
        });
        bgmToggle.addEventListener('change', () => {
            bgmEnabled = bgmToggle.checked;
            localStorage.setItem('bubblebreaker.bgm', bgmEnabled ? 'on' : 'off');
            if (bgmEnabled) startBackgroundMusic(); else stopBackgroundMusic();
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
            if(wheelTimeout) return; 
            wheelTimeout = setTimeout(() => { wheelTimeout = null; }, 1000);

            if (state.screen === 'GROUP' && typeof markGroupCameraInteraction === 'function') {
                markGroupCameraInteraction();
            }

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
