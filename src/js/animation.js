        // ==========================================
        // === 6. アニメーションループ (毎フレームの描画更新) ===
        // ==========================================
        const clock = new THREE.Clock(); // 経過時間を計るためのクラス

        function getLoadingBlackHoleTarget(index) {
            if (galaxyBlackHoleTargets[index]) {
                const target = galaxyBlackHoleTargets[index];
                if (target.galaxy && target.blackHole) target.blackHole.getWorldPosition(target.position);
                return target;
            }
            if (loadingBlackHoles[index]) return { position: loadingBlackHoles[index], galaxy: null, blackHole: null };
            return { position: new THREE.Vector3(0, 0, -90), galaxy: null, blackHole: null };
        }

        function startLoadingAnimation() {
            // ひとつの銀河の中心ブラックホールだけを航路に固定する。
            // 入口・出口を大きく離し、周囲の意見（星）を横切る高速移動を見せる。
            const now = performance.now();
            const firstTarget = getLoadingBlackHoleTarget(0);
            loadingAnimation = {
                startedAt: now,
                segmentStartedAt: now,
                segmentDuration: 10000,
                approachDistance: 5000,
                maxSpeed: 900,
                approachDirection: new THREE.Vector3(0, 0, 1),
                targetIndex: 0,
                onReady: null
            };
            isDiving = true;
            startZoomSound('warp');
            controls.enabled = false;
            camera.position.copy(firstTarget.position).addScaledVector(loadingAnimation.approachDirection, loadingAnimation.approachDistance);
            targetControlTarget.copy(firstTarget.position);
            if (firstTarget.galaxy) firstTarget.galaxy.visible = true;
            camera.lookAt(targetControlTarget);
            galaxyClusters.forEach(cluster => { cluster.visible = true; });
        }

        function updateLoadingAnimation() {
            if (!loadingAnimation) return;
            const elapsed = performance.now() - loadingAnimation.segmentStartedAt;
            const phase = Math.min(1, elapsed / loadingAnimation.segmentDuration);
            updateZoomSound(phase);
            const target = getLoadingBlackHoleTarget(loadingAnimation.targetIndex);
            const blackHole = target.position;
            const eventHorizonRadius = target.blackHole?.userData?.eventHorizonRadius || 10;
            const travelDistance = Math.max(1, loadingAnimation.approachDistance - eventHorizonRadius);
            // 速度は初速から単調増加し、最終速度は約900 units/secを上限にする。
            const durationSeconds = loadingAnimation.segmentDuration / 1000;
            const initialSpeedRatio = Math.max(0.05, Math.min(0.5, 2 - loadingAnimation.maxSpeed * durationSeconds / travelDistance));
            const distanceProgress = Math.min(1, initialSpeedRatio * phase + (1 - initialSpeedRatio) * phase * phase);
            const remainingDistance = eventHorizonRadius + travelDistance * (1 - distanceProgress);
            camera.position.copy(blackHole).addScaledVector(loadingAnimation.approachDirection, remainingDistance);
            targetControlTarget.copy(blackHole);
            camera.lookAt(targetControlTarget);

            // カメラが事象の地平面表面へ触れた瞬間に切り替える。内部座標は一度も生成しない。
            if (remainingDistance <= eventHorizonRadius + 0.05 || phase >= 1) {
                loadingAnimation.targetIndex = (loadingAnimation.targetIndex + 1) % loadingBlackHoles.length;
                loadingAnimation.segmentStartedAt = performance.now();
                const nextTarget = getLoadingBlackHoleTarget(loadingAnimation.targetIndex);
                camera.position.copy(nextTarget.position).addScaledVector(loadingAnimation.approachDirection, loadingAnimation.approachDistance);
                targetControlTarget.copy(nextTarget.position);
                if (nextTarget.galaxy) nextTarget.galaxy.visible = true;
                if (pendingUniverse && typeof loadingAnimation.onReady === 'function') {
                    const onReady = loadingAnimation.onReady;
                    loadingAnimation = null;
                    isDiving = false;
                    onReady();
                    return;
                }
            }
        }

        function updateGroupTransition() {
            if (!transitionState) return;
            const progress = Math.min(1, (performance.now() - transitionState.startedAt) / transitionState.duration);
            const eased = progress * progress * (3 - 2 * progress);
            const cameraStep = transitionState.type === 'zoomOut' ? 0.04 : 0.08;
            camera.position.lerp(targetCameraPos, cameraStep);
            controls.target.lerp(targetControlTarget, cameraStep);
            camera.lookAt(controls.target);
            transitionState.incoming.forEach(bubble => {
                const finalScale = bubble.mesh.userData.finalScale || bubble.mesh.scale.x;
                bubble.mesh.scale.setScalar(finalScale * (0.12 + eased * 0.88));
                bubble.mesh.material.opacity = 0.02 + eased * 0.93;
            });
            transitionState.outgoing.forEach(bubble => {
                // 親（または子）のバブル壁を薄く残したまま通過する。暗転や画面切替を起こさず、
                // 既存空間の内側が開くフラクタル遷移にする。
                bubble.mesh.material.opacity = 0.72 - eased * 0.22;
                bubble.mesh.visible = true;
            });
            if (progress >= 1) {
                transitionState.outgoing.forEach(disposeBubble);
                transitionState = null;
                stopZoomSound();
                isZoomingIntoGroup = false;
                controls.enabled = true;
            }
        }

        function updateGroupOverview() {
            if (!groupOverviewState) return;
            const elapsed = performance.now() - groupOverviewState.startedAt;
            const progress = Math.min(1, elapsed / 900);
            const eased = progress * progress * (3 - 2 * progress);
            camera.position.lerp(groupOverviewState.cameraPosition, 0.08 + eased * 0.08);
            controls.target.lerp(groupOverviewState.controlTarget, 0.08 + eased * 0.08);
            camera.lookAt(controls.target);
            const cameraReady = camera.position.distanceTo(groupOverviewState.cameraPosition) < 0.45;
            const targetReady = controls.target.distanceTo(groupOverviewState.controlTarget) < 0.2;
            if ((progress >= 1 && cameraReady && targetReady) || (cameraReady && targetReady)) {
                camera.position.copy(groupOverviewState.cameraPosition);
                controls.target.copy(groupOverviewState.controlTarget);
                camera.lookAt(controls.target);
                groupOverviewState = null;
                groupZoomOutReady = true;
                controls.enabled = true;
                stopZoomSound();
            }
        }

        function updateCosmicEnvironment(time) {
            starMesh.rotation.y += 0.000004;
            starMesh.rotation.x += 0.000001;
            galaxyStructures.forEach((entry, index) => {
                entry.galaxy.rotation.y += entry.speed;
                entry.galaxy.rotation.z = Math.sin(time * 0.08 + entry.phase) * 0.025;
            });
            galaxyClusters.forEach((cluster, index) => {
                cluster.rotation.y += 0.000008 + index * 0.0000015;
            });
            shootingStars.forEach((entry, index) => {
                entry.streak.position.add(entry.velocity);
                entry.life -= 0.016;
                entry.streak.material.opacity = Math.min(0.78, Math.max(0, entry.life * 0.28));
                if (entry.life <= 0 || entry.streak.position.length() > 9200) resetShootingStar(entry, index);
            });
            cosmicSystems.forEach((entry, index) => {
                entry.system.rotation.y += 0.00018 + index * 0.00003;
                entry.planets.forEach(planet => {
                    const angle = planet.angle + time * planet.speed;
                    planet.mesh.position.set(Math.cos(angle) * planet.radius, Math.sin(angle * 1.7) * planet.radius * 0.08, Math.sin(angle) * planet.radius);
                });
                const cometAngle = entry.phase + time * 0.12;
                entry.comet.position.set(Math.cos(cometAngle) * entry.scale * 1.75, Math.sin(cometAngle * 1.4) * entry.scale * 0.24, Math.sin(cometAngle) * entry.scale * 1.75);
                entry.comet.rotation.y = cometAngle + Math.PI;
            });
            cosmicBackgroundGroup.rotation.y += 0.000012;
            cosmicBackgroundGroup.rotation.x += 0.0000025;
        }

        function animate() {
            // ブラウザの描画タイミングに合わせて次のフレームを予約（ループの仕組み）
            requestAnimationFrame(animate);
            const time = clock.getElapsedTime(); // アプリ起動からの経過秒数
            updateCosmicEnvironment(time);

            // --- 状態に応じたカメラ・演出の制御 ---
            if (loadingAnimation) {
                updateLoadingAnimation();
            } else if (transitionState) {
                updateGroupTransition();
            } else if (groupOverviewState) {
                updateGroupOverview();
            } else if (isDiving) {
                // 【ダイブアニメーション中】
                // 経過時間(0~4秒)から進捗率(0~1)を計算
                const t = time - diveStartTime; 
                const progress = Math.min(t / 4.0, 1.0); 
                
                // 加速度を指数関数(8乗)で爆発的に上げ、最後の瞬間に光速へ到達するような動きにする
                diveVelocity = 0.5 + Math.pow(progress, 8) * 300; 
                
                // カメラをZ軸の奥方向マイナスへ猛烈な速度で進める
                camera.position.z -= diveVelocity; 
                // 視野角(FOV)も極端に広げて歪ませることで、スピード感を強調
                camera.fov = 60 + Math.pow(progress, 8) * 120; 
                camera.updateProjectionMatrix(); // カメラ設定を変更した時はこれを呼ぶ必要がある
                
                // 星は回転させず、カメラの移動だけで同一3D空間を横切る速度感を出す。
                
            } else if (isZoomingIntoGroup) {
                // 【ワープ明けの自動ズームイン中】
                // 遠距離(Z=400)から目標(Z=25)へ、毎フレーム0.02の割合で滑らかに(Lerp)接近させる
                camera.position.lerp(targetCameraPos, 0.02); 
                controls.target.lerp(targetControlTarget, 0.02);
                updateZoomSound(1 - Math.min(1, camera.position.distanceTo(targetCameraPos) / 70));
                camera.lookAt(controls.target); // 常に目標を睨み続ける
                
                // 目的地に十分近づいたら自動ズームイン演出を終了し、手動操作(controls)を解禁する
                if (camera.position.distanceTo(targetCameraPos) < 1.0) {
                    isZoomingIntoGroup = false;
                    controls.enabled = true;
                }
            } else if (controls.enabled) {
                // 【ユーザー操作中（通常時）】
                // マウスドラッグでの視点移動を滑らかに更新
                controls.update();
                if (state.screen === 'SINGLE') {
                    const direction = camera.position.clone().sub(controls.target).normalize();
                    if (direction.lengthSq() > 0.01) singleViewDirection.copy(direction);
                }
            } else {
                // 【画面遷移のカメラ移動中】(loadSingleなどで指定された位置へ移動)
                camera.position.lerp(targetCameraPos, 0.05);
                controls.target.lerp(targetControlTarget, 0.05);
                camera.lookAt(controls.target);
                updateZoomSound(1 - Math.min(1, camera.position.distanceTo(targetCameraPos) / 50));
                if (camera.position.distanceTo(targetCameraPos) < 0.6) {
                    stopZoomSound();
                    if (state.screen === 'SINGLE') controls.enabled = true;
                }
            }
            
            // ダイブ中以外は、背景の星屑宇宙をゆっくり回転させて雄大さを出す
            // 星・銀河・バブルは同一ワールドの固定オブジェクトとして扱う。

            // 現在が解析画面系かどうかを判定（他のバブルを消す処理に使う）
            const isAnalysisOrDetail = (state.screen === 'ANALYSIS' || state.screen === 'DETAIL');

            // --- 現在表示されている各バブルごとの更新処理 ---
            currentBubbles.forEach(b => {
                // 初期Y座標を基準に絶対値で更新し、長時間実行時のdriftを防ぐ
                b.mesh.position.y = b.baseY + Math.sin(time * 2 + b.baseX) * 0.005;
                
                // --- 解析画面時の他バブル透過処理 ---
                const isTarget = (state.bubbleId === b.data.id);
                // 対象バブル以外は目標不透明度を 0 にしてフェードアウトさせる
                const targetOpacity = (isAnalysisOrDetail && !isTarget) ? 0.0 : 0.9;

                // グループ遷移中は専用アニメーションが不透明度と縮尺を制御する。
                if (!transitionState) b.mesh.material.opacity += (targetOpacity - b.mesh.material.opacity) * 0.1;
                // 完全に透明になったら、3D的な描画やクリック判定の対象から外す
                b.mesh.visible = b.mesh.material.opacity > 0.01; 
                
                // --- HTML文字ラベルの追従処理 ---
                // バブル群画面で、かつ自動ズーム演出中でない時だけラベルを表示する
                if (state.screen === 'GROUP' && !isAnalysisOrDetail && !isZoomingIntoGroup) {
                    // 3D空間の座標を、2Dの画面上の座標(-1〜1)に投影・変換する
                    const pos = b.mesh.position.clone().project(camera);
                    // カメラの背後にバブルがある場合はラベルを非表示にする
                    if (pos.z > 1) { b.label.style.opacity = '0'; return; }
                    
                    // -1〜1の座標を、実際のピクセル座標（X,Y）に変換
                    const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
                    const y = -(pos.y * 0.5 - 0.5) * window.innerHeight;
                    
                    // カメラからの距離に応じてラベルの大きさを変える（遠くにあると文字も小さくなる）
                    const dist = camera.position.distanceTo(b.mesh.position);
                    let scale = Math.max(0.5, 15 / dist) * (1 + b.mesh.scale.x * 0.1);
                    
                    // スタイルを適用してラベルを配置
                    b.label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
                    b.label.style.opacity = '1';
                    b.label.style.pointerEvents = 'auto'; // クリックを受け付ける
                } else {
                    // それ以外の画面ではラベルを消す
                    b.label.style.opacity = '0'; 
                    b.label.style.pointerEvents = 'none';
                }
            });

            // バブル未選択時も、利用者が意図して近づけた最寄りバブルへ自動遷移する。
            updateAutomaticBubbleApproach();

            // --- 接近ズームイン判定 (カメラが近づいたら自動遷移) ---
            // 自動ズーム中(isZoomingIntoGroup)は、まだ到着していないのに吸い込まれるのを防ぐために除外
            // カテゴリ移動後は自動的に個別バブルへ飛ばさず、バブル群全体を見せる。
            // 個別画面への遷移はクリック、ラベル選択、または意図した近接ズームで行う。

            // 最後に、全ての計算結果をもとに画面を描画（レンダリング）する
            renderer.render(scene, camera);
        }

        // --- 画面サイズが変更された時の対応処理 ---
        window.addEventListener('resize', () => {
            const width = Math.max(1, container.clientWidth || window.innerWidth);
            const height = Math.max(1, container.clientHeight || window.innerHeight);
            camera.aspect = width / height; // カメラの縦横比を修正
            camera.updateProjectionMatrix(); // カメラ設定を更新
            renderer.setSize(width, height); // レンダラーのサイズを更新
        });

        // アニメーションループを開始！
        animate();
