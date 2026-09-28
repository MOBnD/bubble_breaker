        // ==========================================
        // === 3. Three.js セットアップ (3D空間の構築) ===
        // ==========================================
        const container = document.getElementById('canvas-container');
        const labelsContainer = document.getElementById('labels-container'); // バブルの名前(HTMLタグ)を置くコンテナ
        
        const scene = new THREE.Scene();
        // 宇宙空間の奥が徐々に暗くなるフォグ（霧）効果を設定
        scene.background = new THREE.Color(0x10182d);
        scene.fog = new THREE.FogExp2(0x10182d, 0.0003);

        // カメラ（視点）の設定
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 140000);
        
        // レンダラー（描画エンジン）の設定
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setClearColor(0x10182d, 1);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 高解像度ディスプレイ対応
        container.appendChild(renderer.domElement);

        const warpBlurTarget = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            depthBuffer: true,
            stencilBuffer: false
        });
        const warpBlurScene = new THREE.Scene();
        const warpBlurCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const warpBlurMaterial = new THREE.ShaderMaterial({
            uniforms: { tDiffuse: { value: warpBlurTarget.texture }, strength: { value: 0 } },
            vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float strength;
                varying vec2 vUv;
                void main() {
                    vec2 radial = vUv - vec2(0.5);
                    float edge = smoothstep(0.08, 0.72, length(radial));
                    vec2 stretch = radial * strength * edge;
                    vec4 color = vec4(0.0);
                    for (int sampleIndex = 0; sampleIndex < 5; sampleIndex++) {
                        float sampleOffset = float(sampleIndex) / 4.0;
                        color += texture2D(tDiffuse, clamp(vUv - stretch * sampleOffset, 0.0, 1.0));
                    }
                    gl_FragColor = color / 5.0;
                }
            `,
            depthTest: false,
            depthWrite: false,
            toneMapped: false
        });
        const warpBlurQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), warpBlurMaterial);
        warpBlurScene.add(warpBlurQuad);
        let warpBlurStrength = 50;
        function resizeWarpBlurTarget() {
            const width = Math.max(1, container.clientWidth || window.innerWidth);
            const height = Math.max(1, container.clientHeight || window.innerHeight);
            const scale = Math.min(1, 1280 / width);
            warpBlurTarget.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
        }
        resizeWarpBlurTarget();
        window.setWarpBlurStrength = value => {
            warpBlurStrength = Math.max(0, Math.min(100, Number(value) || 0));
            return warpBlurStrength;
        };
        window.renderSceneFrame = (isWarping, travelSpeed = 1) => {
            if (!isWarping || warpBlurStrength <= 0 || explorationViewMode === '2d') {
                renderer.setRenderTarget(null);
                renderer.render(scene, camera);
                return;
            }
            renderer.setRenderTarget(warpBlurTarget);
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);
            warpBlurMaterial.uniforms.tDiffuse.value = warpBlurTarget.texture;
            warpBlurMaterial.uniforms.strength.value = Math.min(0.105, warpBlurStrength / 100 * 0.09 * Math.max(0.72, Math.min(1.25, travelSpeed)));
            renderer.render(warpBlurScene, warpBlurCamera);
        };

        // OrbitControls：マウスのドラッグで視点移動するための標準プラグイン
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // 視点移動に滑らかな慣性をつける
        controls.dampingFactor = 0.05;
        // ホイールは階層移動だけでなく、全カテゴリ共通のカメラズームにも使う。
        controls.enableZoom = true;
        controls.maxDistance = 52000;
        controls.minDistance = 0.000001;
        camera.near = 0.00001;
        camera.far = 1000000;
        camera.updateProjectionMatrix();
        controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;

        // 照明の設定
        scene.add(new THREE.AmbientLight(0xffffff, 0.7)); // 全体を照らす環境光
        scene.add(new THREE.HemisphereLight(0x8fa8ff, 0x0b0820, 0.7)); // 宇宙色の上空光と反射光
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.0); // 陰影をつける平行光源
        dirLight.position.set(10, 20, 10);
        scene.add(dirLight);
        
        // --- 背景のバブル星屑（銀河）の生成 ---
        // 星をただの四角ではなく、丸いバブルの形にするためのテクスチャをCanvasで動的に作成
        function createCircleTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 32; canvas.height = 32;
            const ctx = canvas.getContext('2d');
            ctx.beginPath();
            ctx.arc(16, 16, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            return new THREE.CanvasTexture(canvas);
        }

        function backgroundRandom(seed) {
            const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return value - Math.floor(value);
        }

        function createBackgroundStarPosition(index, count) {
            const t = (index + 0.5) / count;
            const y = 1 - 2 * t;
            const radial = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = index * Math.PI * (3 - Math.sqrt(5)) + backgroundRandom(index * 0.37 + 11);
            const radius = 500 + Math.cbrt(backgroundRandom(index * 1.91 + 23)) * 13500;
            return new THREE.Vector3(
                Math.cos(theta) * radial * radius,
                y * radius,
                Math.sin(theta) * radial * radius
            );
        }

        // 星の数と位置・色を定義
        const starsGeometry = new THREE.BufferGeometry();
        // 単独星は背景全体の約2割に抑えつつ、銀河位置まで星の層を連続させる。
        const starsCount = 18000;
        const posArray = new Float32Array(starsCount * 3);
        const colorsArray = new Float32Array(starsCount * 3);
        const sizesArray = new Float32Array(starsCount);
        const shapesArray = new Float32Array(starsCount);
        const spikesArray = new Float32Array(starsCount);
        const STAR_SPECTRAL_PALETTE = [0x9ecbff, 0xd9e9ff, 0xffffff, 0xfff1b0, 0xffc27a, 0xff8d70];

        for(let starIndex = 0; starIndex < starsCount; starIndex++) {
            const i = starIndex * 3;
            // 星はカメラの全周を包む球殻に固定する。背後を向いても空白にならず、
            // 銀河・バブルと同じワールド空間を共有する。
            const position = createBackgroundStarPosition(starIndex, starsCount);
            posArray[i] = position.x;
            posArray[i+1] = position.y;
            posArray[i+2] = position.z;

            // 星のスペクトルを青白色から赤色まで広げ、恒星ごとに明度と大きさを変える。
            const color = new THREE.Color(STAR_SPECTRAL_PALETTE[Math.floor(backgroundRandom(starIndex * 2.1 + 31) * STAR_SPECTRAL_PALETTE.length)]);
            color.multiplyScalar(0.58 + backgroundRandom(starIndex * 2.7 + 47) * 0.52);
            colorsArray[i] = color.r;
            colorsArray[i+1] = color.g;
            colorsArray[i+2] = color.b;
            sizesArray[starIndex] = 8 + Math.pow(backgroundRandom(starIndex * 3.3 + 61), 1.8) * 40;
            shapesArray[starIndex] = backgroundRandom(starIndex * 4.1 + 73) > 0.7 ? 1 : 0;
            spikesArray[starIndex] = 0.7 + backgroundRandom(starIndex * 5.7 + 89) * 0.8;
        }
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
        starsGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizesArray, 1));
        starsGeometry.setAttribute('aShape', new THREE.BufferAttribute(shapesArray, 1));
        starsGeometry.setAttribute('aSpike', new THREE.BufferAttribute(spikesArray, 1));

        // 星の質感（マテリアル）の設定
        const starsMaterial = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { pixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
            vertexColors: true,
            vertexShader: `
                attribute float aSize;
                attribute float aShape;
                attribute float aSpike;
                varying vec3 vColor;
                varying float vShape;
                varying float vSpike;
                uniform float pixelRatio;
                void main() {
                    vColor = color;
                    vShape = aShape;
                    vSpike = aSpike;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * pixelRatio * (420.0 / max(1.0, -mvPosition.z));
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vShape;
                varying float vSpike;
                void main() {
                    vec2 centered = gl_PointCoord - vec2(0.5);
                    float radius = length(centered);
                    if (radius > 0.5) discard;
                    float circleGlow = 1.0 - smoothstep(0.04, 0.5, radius);
                    float rayWidth = 0.035 + vSpike * 0.025;
                    float horizontalRay = exp(-abs(centered.y) / rayWidth) * (1.0 - smoothstep(0.08, 0.5, abs(centered.x)));
                    float verticalRay = exp(-abs(centered.x) / rayWidth) * (1.0 - smoothstep(0.08, 0.5, abs(centered.y)));
                    float starGlow = max(horizontalRay, verticalRay);
                    float glow = mix(circleGlow, max(circleGlow * 0.34, starGlow), step(0.5, vShape));
                    gl_FragColor = vec4(vColor, glow * 0.86);
                }
            `
        });
        const starMesh = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(starMesh);

        const galaxyClusters = [];
        const galaxyStructures = [];
        const loadingBlackHoles = [];
        const galaxyBlackHoleTargets = [];
        const galaxyGlowSprites = [];
        const GALAXY_SHAPE_NAMES = ['楕円銀河', '球状銀河', '渦巻銀河', '棒渦巻銀河', 'レンズ状銀河', '不規則銀河'];
        const GALAXY_COLOR_PROFILES = [
            { name: '青白', primaryHue: 0.61, secondaryHue: 0.55, saturation: 0.92, coreColor: 0xb9dcff, diskColor: 0x73b9ff, photonColor: 0xe6f5ff },
            { name: '紫青', primaryHue: 0.74, secondaryHue: 0.66, saturation: 0.9, coreColor: 0xc4a8ff, diskColor: 0x8b63ff, photonColor: 0xf0d9ff },
            { name: '赤橙', primaryHue: 0.035, secondaryHue: 0.09, saturation: 0.94, coreColor: 0xffbd82, diskColor: 0xff6d3f, photonColor: 0xffe0a0 },
            { name: '金色', primaryHue: 0.12, secondaryHue: 0.18, saturation: 0.9, coreColor: 0xffdf8c, diskColor: 0xffad3e, photonColor: 0xfff2ae },
            { name: '青緑', primaryHue: 0.49, secondaryHue: 0.42, saturation: 0.88, coreColor: 0x8fe8d7, diskColor: 0x20b9b3, photonColor: 0xc6fff1 },
            { name: 'マゼンタ', primaryHue: 0.91, secondaryHue: 0.83, saturation: 0.93, coreColor: 0xff9ecb, diskColor: 0xff4fa1, photonColor: 0xffd5f2 }
        ];
        // 1つの親Groupに複数銀河を詰め込まず、60個の銀河を個別スロットとして扱う。
        // 既存の配列名はロード対象との互換性のため残すが、各スロットは1銀河だけを持つ。
        const GALAXIES_PER_CLUSTER = 1;
        const GALAXY_CLUSTER_COUNT = 60;
        const GALAXY_CLUSTER_RADIUS = 9000;
        const galaxyClusterCenters = Array.from({ length: GALAXY_CLUSTER_COUNT }, (_, index) => {
            const t = (index + 0.5) / GALAXY_CLUSTER_COUNT;
            const y = 1 - 2 * t;
            const radial = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = index * Math.PI * (3 - Math.sqrt(5)) + 0.37;
            return new THREE.Vector3(
                Math.cos(theta) * radial * GALAXY_CLUSTER_RADIUS,
                y * GALAXY_CLUSTER_RADIUS,
                Math.sin(theta) * radial * GALAXY_CLUSTER_RADIUS
            );
        });

        function getGalaxyStarPosition(shape, index, count, radius, seed, galaxyIndex) {
            const u = (index + 0.5) / count;
            const random = cosmicRandom(seed * 17.3 + index * 2.17 + galaxyIndex * 4.1);
            const secondRandom = cosmicRandom(seed * 9.1 + index * 3.71 + galaxyIndex * 1.9);
            let x = 0;
            let y = 0;
            let z = 0;
            if (shape === 0) {
                const r = Math.sqrt(u) * radius;
                const angle = random * Math.PI * 2;
                x = Math.cos(angle) * r;
                z = Math.sin(angle) * r * 0.72;
                y = (secondRandom - 0.5) * Math.max(8, radius * 0.12);
            } else if (shape === 1) {
                const r = Math.cbrt(random) * radius;
                const theta = Math.acos(2 * secondRandom - 1);
                const angle = cosmicRandom(seed + index * 5.3) * Math.PI * 2;
                x = Math.sin(theta) * Math.cos(angle) * r;
                y = Math.cos(theta) * r;
                z = Math.sin(theta) * Math.sin(angle) * r;
            } else if (shape === 2 || shape === 3) {
                const armCount = shape === 3 ? 2 : 3;
                const r = Math.sqrt(u) * radius;
                const arm = index % armCount;
                const angle = arm * Math.PI * 2 / armCount + r / radius * (shape === 3 ? 3.8 : 5.2) + (random - 0.5) * 0.32;
                const bar = shape === 3 && u < 0.34 ? (random - 0.5) * radius * 1.2 : 0;
                x = Math.cos(angle) * r + bar;
                z = Math.sin(angle) * r;
                y = (secondRandom - 0.5) * Math.max(5, radius * (shape === 3 && u < 0.34 ? 0.08 : 0.1));
            } else if (shape === 4) {
                const r = radius * (0.18 + Math.sqrt(u) * 0.82);
                const angle = random * Math.PI * 2;
                x = Math.cos(angle) * r;
                z = Math.sin(angle) * r;
                y = (secondRandom - 0.5) * Math.max(4, radius * 0.065);
            } else {
                const clump = index % 5;
                const clumpAngle = clump * Math.PI * 0.4 + seed * 0.07;
                const clumpRadius = radius * (0.22 + (clump % 3) * 0.18);
                x = Math.cos(clumpAngle) * clumpRadius + (random - 0.5) * radius * 0.48;
                y = (secondRandom - 0.5) * radius * 0.5;
                z = Math.sin(clumpAngle) * clumpRadius + (cosmicRandom(index + seed * 3.4) - 0.5) * radius * 0.48;
            }
            return new THREE.Vector3(x, y, z);
        }

        function keepGalaxyCenterClear(position, radius, seed) {
            const minimumRadius = radius * 0.2;
            const length = position.length();
            if (length >= minimumRadius) return position;
            const direction = length > 0.001
                ? position.normalize()
                : new THREE.Vector3(1, (cosmicRandom(seed) - 0.5) * 0.2, cosmicRandom(seed + 1) - 0.5).normalize();
            return direction.multiplyScalar(minimumRadius + cosmicRandom(seed + 2) * radius * 0.08);
        }

        function createGalaxyCluster(center, seed) {
            const cluster = new THREE.Group();
            // 球面上に十分な間隔で置いたクラスターをそのままワールド座標へ配置する。
            cluster.position.copy(center);
            for (let galaxyIndex = 0; galaxyIndex < GALAXIES_PER_CLUSTER; galaxyIndex++) {
                const galaxyAngle = galaxyIndex * Math.PI * 2 / GALAXIES_PER_CLUSTER + seed * 0.13;
                const galaxyOffset = new THREE.Vector3(Math.cos(galaxyAngle) * (700 + galaxyIndex * 100), Math.sin(galaxyAngle * 1.7) * (180 + seed * 22), Math.sin(galaxyAngle) * (700 + galaxyIndex * 100));
                const shape = (seed + galaxyIndex) % 6;
                const galaxyRadius = 220 + ((seed * 43 + galaxyIndex * 67) % 95);
                const tilt = 0.18 + ((seed * 0.37 + galaxyIndex * 0.71) % 1) * 1.1;
                const spin = ((seed * 1.91 + galaxyIndex * 2.37) % 1) * Math.PI * 2;
                const systemCount = 1000;
                const colorProfile = GALAXY_COLOR_PROFILES[(seed * 3 + galaxyIndex) % GALAXY_COLOR_PROFILES.length];
                const galaxy = new THREE.Group();
                galaxy.position.copy(galaxyOffset);
                galaxy.rotation.set(tilt, spin, tilt * 0.63);
                galaxy.userData.shape = GALAXY_SHAPE_NAMES[shape];
                galaxy.userData.galaxyRadius = galaxyRadius;
                galaxy.userData.colorProfile = colorProfile.name;

                // 銀河の恒星は必ず形状に沿って配置する。惑星を伴う恒星系は銀河外へ分離する。
                const starSystems = new THREE.InstancedMesh(
                    new THREE.SphereGeometry(3.2, 8, 8),
                    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, fog: false }),
                    systemCount
                );
                starSystems.userData.preserveInstanceColors = true;
                const dummy = new THREE.Object3D();
                for (let i = 0; i < systemCount; i++) {
                    const position = keepGalaxyCenterClear(getGalaxyStarPosition(shape, i, systemCount, galaxyRadius, seed, galaxyIndex), galaxyRadius, seed + i * 0.43);
                    dummy.position.copy(position);
                    const sizeVariation = 0.45 + Math.pow(cosmicRandom(seed * 1.7 + i * 2.31), 0.62) * 2.75;
                    dummy.scale.setScalar(sizeVariation);
                    dummy.updateMatrix();
                    starSystems.setMatrixAt(i, dummy.matrix);
                    const spectralHue = (colorProfile.primaryHue + ((i % 6) - 2.5) * 0.035 + seed * 0.009) % 1;
                    const spectralLightness = 0.48 + cosmicRandom(seed * 2.7 + i * 0.91) * 0.46;
                    starSystems.setColorAt(i, new THREE.Color().setHSL(spectralHue, colorProfile.saturation, Math.min(0.94, spectralLightness)));
                }
                starSystems.instanceMatrix.needsUpdate = true;
                if (starSystems.instanceColor) starSystems.instanceColor.needsUpdate = true;
                galaxy.add(starSystems);

                // 恒星点だけでも銀河の輪郭が読めるよう、同じ形状の淡い恒星雲を重ねる。
                const dustCount = 3200;
                const dustPositions = new Float32Array(dustCount * 3);
                for (let i = 0; i < dustCount; i++) {
                    const position = keepGalaxyCenterClear(getGalaxyStarPosition(shape, i, dustCount, galaxyRadius * 1.04, seed + 31, galaxyIndex), galaxyRadius, seed + i * 0.71 + 31);
                    dustPositions[i * 3] = position.x;
                    dustPositions[i * 3 + 1] = position.y;
                    dustPositions[i * 3 + 2] = position.z;
                }
                const dustGeometry = new THREE.BufferGeometry();
                dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
                const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
                    size: 4.8, color: new THREE.Color().setHSL(colorProfile.secondaryHue, colorProfile.saturation, 0.62),
                    transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, map: createCircleTexture(), fog: false
                }));
                dust.userData.preserveGalaxyColor = true;
                galaxy.add(dust);

                const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: createGlowTexture('rgba(255,245,220,1)'), color: colorProfile.coreColor,
                    transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
                }));
                coreGlow.userData.preserveGalaxyColor = true;
                coreGlow.scale.set(galaxyRadius * 0.42, galaxyRadius * 0.42, 1);
                galaxy.add(coreGlow);

                // ブラックホールは銀河の中心に1つだけ置く。恒星系や星雲には生成しない。
                const eventHorizonRadius = Math.max(10, galaxyRadius * 0.055);
                const blackHole = new THREE.Mesh(new THREE.SphereGeometry(eventHorizonRadius, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
                blackHole.position.set(0, 0, 0);
                blackHole.userData.isGalaxyCenterBlackHole = true;
                blackHole.userData.eventHorizonRadius = eventHorizonRadius;
                galaxy.add(blackHole);
                const disk = new THREE.Mesh(
                    new THREE.RingGeometry(eventHorizonRadius * 1.05, eventHorizonRadius * 2.5, 128),
                    new THREE.MeshBasicMaterial({ color: colorProfile.diskColor, transparent: true, opacity: 0.32, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
                );
                disk.userData.preserveGalaxyColor = true;
                disk.rotation.x = Math.PI * 0.5;
                galaxy.add(disk);
                const photonRing = new THREE.Mesh(
                    new THREE.TorusGeometry(eventHorizonRadius * 1.16, Math.max(0.9, eventHorizonRadius * 0.045), 10, 96),
                    new THREE.MeshBasicMaterial({ color: colorProfile.photonColor, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
                );
                photonRing.userData.preserveGalaxyColor = true;
                galaxy.add(photonRing);
                cluster.add(galaxy);
                galaxyStructures.push({ galaxy, speed: 0.00012 + galaxyIndex * 0.000018, phase: cosmicRandom(seed + galaxyIndex * 4.7) * Math.PI * 2 });
                const worldBlackHolePosition = new THREE.Vector3().copy(cluster.position).add(galaxyOffset);
                loadingBlackHoles.push(worldBlackHolePosition);
                galaxyBlackHoleTargets.push({ position: worldBlackHolePosition, galaxy, blackHole });
            }
            scene.add(cluster);
            galaxyClusters.push(cluster);
        }

        function randomUnitVector() {
            const y = Math.random() * 2 - 1;
            const angle = Math.random() * Math.PI * 2;
            const radial = Math.sqrt(Math.max(0, 1 - y * y));
            return new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial);
        }

        function createSeparatedGalaxyPositions(count) {
            const positions = [];
            const minimumDistance = 1850;
            let attempts = 0;
            while (positions.length < count && attempts < count * 120) {
                attempts += 1;
                const radius = 7600 + Math.random() * 4200;
                const candidate = randomUnitVector().multiplyScalar(radius);
                if (positions.every(position => position.distanceTo(candidate) >= minimumDistance)) positions.push(candidate);
            }
            // 極端な乱数列でも全銀河が生成されるよう、最後は均等球面で補完する。
            for (let index = positions.length; index < count; index++) {
                const t = (index + 0.5) / count;
                const y = 1 - 2 * t;
                const radial = Math.sqrt(Math.max(0, 1 - y * y));
                const theta = index * Math.PI * (3 - Math.sqrt(5)) + Math.random() * Math.PI * 2;
                positions.push(new THREE.Vector3(
                    Math.cos(theta) * radial * 9000,
                    y * 9000,
                    Math.sin(theta) * radial * 9000
                ));
            }
            return positions;
        }

        // カテゴリを移動した時は、同じ宇宙を見続けるのではなく、全銀河を
        // 1つずつ別の球面位置へ移す。銀河同士の最低距離を検査するため、
        // 複数銀河が塊になる以前の問題も同時に解消する。
        function relocateGalaxyUniverse(reason = 'transition') {
            const count = galaxyClusters.length;
            if (!count) return;
            const positions = createSeparatedGalaxyPositions(count);
            galaxyClusters.forEach((cluster, clusterIndex) => {
                cluster.position.copy(positions[clusterIndex]);
                cluster.rotation.set(
                    (Math.random() - 0.5) * 0.24,
                    Math.random() * Math.PI * 2,
                    (Math.random() - 0.5) * 0.24
                );
                const galaxies = cluster.children.filter(child => child.userData && child.userData.galaxyRadius);
                galaxies.forEach((galaxy, galaxyIndex) => {
                    galaxy.position.set(
                        (Math.random() - 0.5) * 180,
                        (Math.random() - 0.5) * 180,
                        (Math.random() - 0.5) * 180
                    );
                    galaxy.rotation.set(
                        (Math.random() - 0.5) * 1.6,
                        Math.random() * Math.PI * 2,
                        (Math.random() - 0.5) * 1.2
                    );
                });
                cluster.updateMatrixWorld(true);
                galaxies.forEach(galaxy => {
                    const target = galaxyBlackHoleTargets.find(entry => entry.galaxy === galaxy);
                    if (target) {
                        target.blackHole.getWorldPosition(target.position);
                    }
                });
            });
            galaxyGlowSprites.forEach(entry => {
                const cluster = galaxyClusters[entry.clusterIndex];
                if (cluster) entry.sprite.position.copy(cluster.position);
            });
            apiLog('銀河を個別に再配置しました', { reason, galaxyCount: count, minimumDistance: 1850 });
        }

        // --- 遠景の宇宙構造（画像素材を使わない手続き生成） ---
        // 固定シードにすることで、カテゴリを再表示しても宇宙の配置がちらつかない。
        const cosmicBackgroundGroup = new THREE.Group();
        const cosmicSystems = [];
        const shootingStars = [];
        const cosmicNebulae = [];
        let ngc3324Dome = null;
        const dataBackgroundGroup = new THREE.Group();
        const backgroundThemeGroups = { data: dataBackgroundGroup };
        const BACKGROUND_THEME_NAMES = ['space', 'data'];
        let backgroundTheme = BACKGROUND_THEME_NAMES.includes(localStorage.getItem('bubblebreaker.backgroundTheme'))
            ? localStorage.getItem('bubblebreaker.backgroundTheme')
            : 'space';
        scene.add(cosmicBackgroundGroup);
        scene.add(dataBackgroundGroup);

        function cosmicRandom(seed) {
            const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
            return value - Math.floor(value);
        }

        // 背景天体を半径の異なる球殻へ決定論的に散らす。Fibonacci sphere
        // により、正面・背面・上下左右のどの方向にも空白が偏らない。
        function createSphericalBackgroundPosition(index, count, minRadius, maxRadius, seed = 0) {
            const t = (index + 0.5) / count;
            const y = 1 - 2 * t;
            const radial = Math.sqrt(Math.max(0, 1 - y * y));
            const theta = index * Math.PI * (3 - Math.sqrt(5)) + seed;
            const radius = minRadius + (maxRadius - minRadius) * cosmicRandom(seed * 17.1 + index * 9.37);
            return new THREE.Vector3(
                Math.cos(theta) * radial * radius,
                y * radius,
                Math.sin(theta) * radial * radius
            );
        }

        function createGlowTexture(innerColor, outerColor = 'rgba(0,0,0,0)') {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const context = canvas.getContext('2d');
            const softenedInnerColor = String(innerColor).replace(
                /rgba\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([\d.]+)\s*\)/i,
                (_, red, green, blue, alpha) => `rgba(${red},${green},${blue},${Math.max(0, Math.min(1, Number(alpha) * 0.55))})`
            );
            const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
            gradient.addColorStop(0, innerColor);
            gradient.addColorStop(0.28, softenedInnerColor);
            gradient.addColorStop(0.72, outerColor);
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, 128, 128);
            return new THREE.CanvasTexture(canvas);
        }

        function createThemeDomeTexture(theme) {
            const canvas = document.createElement('canvas');
            canvas.width = 2048;
            canvas.height = 1024;
            const context = canvas.getContext('2d');
            const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
                gradient.addColorStop(0, '#05071e');
                gradient.addColorStop(0.5, '#11134a');
                gradient.addColorStop(1, '#03050f');
                context.fillStyle = gradient;
                context.fillRect(0, 0, canvas.width, canvas.height);
                context.strokeStyle = 'rgba(91, 220, 255, 0.12)';
                context.lineWidth = 2;
                for (let x = 0; x < canvas.width; x += 96) {
                    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, canvas.height); context.stroke();
                }
                for (let y = 0; y < canvas.height; y += 96) {
                    context.beginPath(); context.moveTo(0, y); context.lineTo(canvas.width, y); context.stroke();
                }
                for (let index = 0; index < 36; index++) {
                    const x = cosmicRandom(index * 5.2 + 80) * canvas.width;
                    const y = cosmicRandom(index * 8.7 + 90) * canvas.height;
                    context.fillStyle = index % 3 === 0 ? 'rgba(240, 119, 255, 0.7)' : 'rgba(76, 229, 255, 0.64)';
                    context.fillRect(x, y, 4 + (index % 3) * 2, 4 + (index % 3) * 2);
                }
            const texture = new THREE.CanvasTexture(canvas);
            texture.encoding = THREE.sRGBEncoding;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.needsUpdate = true;
            return texture;
        }

        function createThemeDome(theme, group) {
            const dome = new THREE.Mesh(
                new THREE.SphereGeometry(70000, 96, 64),
                new THREE.MeshBasicMaterial({ map: createThemeDomeTexture(theme), side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: false })
            );
            dome.renderOrder = -999;
            group.add(dome);
            return dome;
        }

        function createDataBackgroundTheme() {
            const group = dataBackgroundGroup;
            const nodeCount = 260;
            const positions = new Float32Array(nodeCount * 3);
            const nodePositions = [];
            for (let index = 0; index < nodeCount; index++) {
                const position = createSphericalBackgroundPosition(index, nodeCount, 1200, 13500, 113);
                positions[index * 3] = position.x; positions[index * 3 + 1] = position.y; positions[index * 3 + 2] = position.z;
                nodePositions.push(position);
            }
            const nodeGeometry = new THREE.BufferGeometry();
            nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            group.add(new THREE.Points(nodeGeometry, new THREE.PointsMaterial({ color: 0x55e9ff, size: 24, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending })));
            const linePositions = [];
            for (let index = 0; index < nodePositions.length; index += 3) {
                const next = nodePositions[(index + 1) % nodePositions.length];
                linePositions.push(nodePositions[index], next);
            }
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePositions);
            group.add(new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: 0x9a79ff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending })));
            const dataDome = createThemeDome('data', group);
            group.userData.themeAnimation = { rotationSpeed: 0.00001, nodeCloud: group.children[0], dataDome, phase: 1.3 };
        }

        function createAdditionalBackgroundThemes() {
            createDataBackgroundTheme();
        }

        function setThemeObjectsVisible(theme) {
            const isSpace = theme === 'space';
            starMesh.visible = isSpace;
            galaxyClusters.forEach(cluster => { cluster.visible = isSpace; });
            cosmicBackgroundGroup.visible = isSpace;
            dataBackgroundGroup.visible = theme === 'data';
        }

        window.setBackgroundTheme = function(theme = 'space') {
            backgroundTheme = BACKGROUND_THEME_NAMES.includes(theme) ? theme : 'space';
            const colors = {
                space: { clear: 0x10182d, fog: 0x10182d, density: 0.0003 },
                data: { clear: 0x06081e, fog: 0x0b0d32, density: 0.00018 }
            }[backgroundTheme];
            scene.background.set(colors.clear);
            scene.fog.color.set(colors.fog);
            scene.fog.density = colors.density;
            renderer.setClearColor(colors.clear, 1);
            setThemeObjectsVisible(backgroundTheme);
            if (ngc3324Dome) ngc3324Dome.visible = backgroundTheme === 'space' && window.__bubbleBreakerNGC3324Visible !== false;
            return backgroundTheme;
        };
        function softenNGC3324Seam(texture) {
            const source = texture.image;
            if (!source || !source.width || !source.height) return texture;
            const canvas = document.createElement('canvas');
            canvas.width = source.width;
            canvas.height = source.height;
            const context = canvas.getContext('2d', { willReadFrequently: true });
            context.drawImage(source, 0, 0);
            const image = context.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = image.data;
            const width = canvas.width;
            const feather = Math.max(24, Math.floor(width * 0.06));
            for (let y = 0; y < canvas.height; y++) {
                const left = (y * width) * 4;
                const right = (y * width + width - 1) * 4;
                const seam = [
                    (pixels[left] + pixels[right]) * 0.5,
                    (pixels[left + 1] + pixels[right + 1]) * 0.5,
                    (pixels[left + 2] + pixels[right + 2]) * 0.5
                ];
                for (let x = 0; x < feather; x++) {
                    const t = x / feather;
                    const eased = t * t * (3 - 2 * t);
                    const leftIndex = (y * width + x) * 4;
                    const rightIndex = (y * width + width - feather + x) * 4;
                    for (let channel = 0; channel < 3; channel++) {
                        pixels[leftIndex + channel] = seam[channel] * (1 - eased) + pixels[leftIndex + channel] * eased;
                        pixels[rightIndex + channel] = pixels[rightIndex + channel] * eased + seam[channel] * (1 - eased);
                    }
                }
            }
            context.putImageData(image, 0, 0);
            texture.image = canvas;
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
            texture.needsUpdate = true;
            return texture;
        }

        function createNGC3324PhotoDome() {
            const dome = new THREE.Mesh(
                new THREE.SphereGeometry(70000, 128, 80),
                new THREE.MeshBasicMaterial({
                    // Keep the dome dark until the photo arrives so a failed image
                    // request can never turn the entire scene into a white sphere.
                    color: 0x10182d,
                    side: THREE.BackSide,
                    transparent: true,
                    opacity: 0.88,
                    depthWrite: false,
                    depthTest: false,
                    fog: false,
                    toneMapped: false
                })
            );
            dome.userData.gasNebulaName = 'NGC 3324';
            dome.userData.isFarthestBackground = true;
            dome.userData.isNGC3324Photo = true;
            dome.renderOrder = -1000;
            ngc3324Dome = dome;
            scene.add(dome);
            const textureUrl = window.__NGC3324_TEXTURE__ || '';
            if (textureUrl) {
                const applyLoadedTexture = texture => {
                    if (!texture.image || !texture.image.width || !texture.image.height) {
                        dome.visible = false;
                        console.warn('[BubbleBreaker][Cosmos] NGC 3324画像に有効な画素がありません', textureUrl);
                        return;
                    }
                    texture.encoding = THREE.sRGBEncoding;
                    try {
                        dome.material.map = softenNGC3324Seam(texture);
                    } catch (error) {
                        // Local-file origins can block canvas pixel reads. The source
                        // image is still usable as a texture without seam processing.
                        console.warn('[BubbleBreaker][Cosmos] NGC 3324の境界補正を省略しました', error);
                        dome.material.map = texture;
                    }
                    dome.material.color.set(0xffffff);
                    dome.material.needsUpdate = true;
                    dome.visible = window.__bubbleBreakerNGC3324Visible !== false && backgroundTheme === 'space';
                    window.__bubbleBreakerNGC3324Loaded = true;
                };
                const handleLoadError = error => {
                    dome.visible = false;
                    window.__bubbleBreakerNGC3324Loaded = false;
                    console.warn('[BubbleBreaker][Cosmos] NGC 3324写真の読み込みに失敗しました。星空背景を表示します', error);
                };
                if (window.location.protocol === 'file:') {
                    // WebGL refuses file:/// image textures even when an <img>
                    // element can display the source. Decode the bundled bytes to
                    // a Blob URL created by this document so the texture is local.
                    const loadEmbeddedTexture = () => {
                        try {
                            const encodedImage = window.__NGC3324_FILE_TEXTURE_BASE64__;
                            if (!encodedImage) throw new Error('埋め込みNGCテクスチャがありません');
                            const binaryImage = window.atob(encodedImage);
                            const imageBytes = new Uint8Array(binaryImage.length);
                            for (let index = 0; index < binaryImage.length; index += 1) imageBytes[index] = binaryImage.charCodeAt(index);
                            const blobUrl = URL.createObjectURL(new Blob([imageBytes], { type: 'image/jpeg' }));
                            dome.userData.ngcTextureObjectUrl = blobUrl;
                            const image = new Image();
                            image.onload = () => {
                                const texture = new THREE.Texture(image);
                                texture.needsUpdate = true;
                                applyLoadedTexture(texture);
                            };
                            image.onerror = error => {
                                URL.revokeObjectURL(blobUrl);
                                delete dome.userData.ngcTextureObjectUrl;
                                handleLoadError(error);
                            };
                            image.src = blobUrl;
                        } catch (error) {
                            handleLoadError(error);
                        }
                    };
                    if (window.__NGC3324_FILE_TEXTURE_BASE64__) {
                        loadEmbeddedTexture();
                    } else {
                        const dataScript = document.createElement('script');
                        dataScript.onload = loadEmbeddedTexture;
                        dataScript.onerror = handleLoadError;
                        dataScript.src = new URL('./assets/ngc-3324-file-texture.js', document.baseURI).href;
                        document.head.appendChild(dataScript);
                    }
                } else {
                    // Same-origin app assets need no explicit crossOrigin override.
                    new THREE.TextureLoader().load(textureUrl, applyLoadedTexture, undefined, handleLoadError);
                }
            }
        }

        function setNGC3324BackgroundVisible(visible) {
            const nextVisible = Boolean(visible);
            if (ngc3324Dome) ngc3324Dome.visible = nextVisible && backgroundTheme === 'space';
            window.__bubbleBreakerNGC3324Visible = nextVisible;
            return nextVisible;
        }

        function addGalaxyGlow(position, scale, hue) {
            const color = new THREE.Color().setHSL(hue, 0.78, 0.58);
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
                map: createGlowTexture(`rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},1)`),
                color, transparent: true, opacity: 0.2, depthWrite: false,
                blending: THREE.AdditiveBlending, fog: false
            }));
            sprite.position.copy(position);
            sprite.scale.set(scale * 2.2, scale, 1);
            sprite.rotation.z = hue * Math.PI * 2;
            cosmicBackgroundGroup.add(sprite);
            galaxyGlowSprites.push({ sprite, clusterIndex: galaxyGlowSprites.length });
        }

        function addProceduralNebula(center, scale, seed) {
            const nebula = new THREE.Group();
            nebula.position.copy(center);
            nebula.rotation.set(cosmicRandom(seed + 1) * 0.9, cosmicRandom(seed + 2) * Math.PI * 2, cosmicRandom(seed + 3) * 0.7);
            nebula.userData.rotationSpeed = (cosmicRandom(seed + 4) - 0.5) * 0.000035;
            const hues = [0.57, 0.62, 0.79, 0.91, 0.08];
            const hue = hues[Math.floor(cosmicRandom(seed + 5) * hues.length)];
            const cloudColor = new THREE.Color().setHSL(hue, 0.82, 0.58);
            const cloudTexture = createGlowTexture(`rgba(255,255,255,${0.78 + cosmicRandom(seed + 6) * 0.22})`);
            const lobeCount = 5 + Math.floor(cosmicRandom(seed + 7) * 7);
            const angle = cosmicRandom(seed + 8) * Math.PI * 2;
            for (let index = 0; index < lobeCount; index += 1) {
                const progress = index / Math.max(1, lobeCount - 1);
                const wave = Math.sin(index * 2.1 + seed) * scale * 0.14;
                const radius = scale * (0.24 + cosmicRandom(seed + index * 4.3) * 0.46);
                const lobeColor = cloudColor.clone().offsetHSL((cosmicRandom(seed + index * 5.1) - 0.5) * 0.16, 0, (cosmicRandom(seed + index * 6.9) - 0.5) * 0.18);
                const lobe = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: cloudTexture, color: lobeColor, transparent: true,
                    opacity: 0.095 + cosmicRandom(seed + index * 8.1) * 0.12,
                    depthWrite: false, blending: THREE.AdditiveBlending, fog: false
                }));
                const along = (progress - 0.5) * scale * (0.72 + cosmicRandom(seed + index * 9.7) * 0.28);
                lobe.position.set(Math.cos(angle) * along - Math.sin(angle) * wave, wave * 0.45, Math.sin(angle) * along + Math.cos(angle) * wave);
                const aspect = 0.32 + cosmicRandom(seed + index * 11.3) * 0.52;
                lobe.scale.set(radius, radius * aspect, 1);
                lobe.material.rotation = angle + (cosmicRandom(seed + index * 13.1) - 0.5) * 1.1;
                nebula.add(lobe);
            }
            const dustCount = 220;
            const dustPositions = new Float32Array(dustCount * 3);
            for (let index = 0; index < dustCount; index += 1) {
                const t = cosmicRandom(seed + index * 17.7) * Math.PI * 2;
                const radial = Math.sqrt(cosmicRandom(seed + index * 18.9));
                const along = (cosmicRandom(seed + index * 20.3) - 0.5) * scale * 0.75;
                dustPositions[index * 3] = Math.cos(angle) * along - Math.sin(t) * radial * scale * 0.28;
                dustPositions[index * 3 + 1] = (cosmicRandom(seed + index * 22.1) - 0.5) * scale * 0.24;
                dustPositions[index * 3 + 2] = Math.sin(angle) * along + Math.cos(t) * radial * scale * 0.28;
            }
            const dustGeometry = new THREE.BufferGeometry();
            dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
            nebula.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({
                color: cloudColor, size: Math.max(2, scale * 0.006), transparent: true, opacity: 0.42,
                depthWrite: false, blending: THREE.AdditiveBlending, fog: false
            })));
            cosmicNebulae.push(nebula);
            cosmicBackgroundGroup.add(nebula);
        }

        function addSolarSystem(center, scale, seed) {
            const system = new THREE.Group();
            system.position.copy(center);
            system.rotation.set(cosmicRandom(seed) * 0.6, cosmicRandom(seed + 1) * Math.PI, cosmicRandom(seed + 2) * 0.4);
            const starSpectra = [0.60, 0.63, 0.08, 0.13, 0.04, 0.98];
            const starHue = starSpectra[seed % starSpectra.length];
            const starColor = new THREE.Color().setHSL(starHue, 0.82, 0.58 + cosmicRandom(seed + 3) * 0.26);
            const star = new THREE.Sprite(new THREE.SpriteMaterial({
                map: createGlowTexture('rgba(255,245,190,1)'), color: starColor,
                transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending,
                depthWrite: false, fog: false
            }));
            star.scale.set(scale * (0.28 + cosmicRandom(seed + 4) * 0.12), scale * (0.28 + cosmicRandom(seed + 4) * 0.12), 1);
            const elements = [star];
            const planets = [];
            const planetCount = 2 + Math.floor(cosmicRandom(seed + 14) * 5);
            for (let index = 0; index < planetCount; index++) {
                const radiusX = scale * (0.52 + index * 0.3 + cosmicRandom(seed + index * 5.3) * 0.54);
                const radiusZ = radiusX * (0.56 + cosmicRandom(seed + index * 6.7) * 0.43);
                const plane = new THREE.Group();
                plane.rotation.set((cosmicRandom(seed + index * 7.9) - 0.5) * Math.PI / 3, cosmicRandom(seed + index * 9.1) * Math.PI * 2, 0);
                const orbitCurve = new THREE.EllipseCurve(0, 0, radiusX, radiusZ, 0, Math.PI * 2, false, 0);
                const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitCurve.getPoints(64).map(point => new THREE.Vector3(point.x, 0, point.y)));
                const orbit = new THREE.LineLoop(orbitGeometry, new THREE.LineBasicMaterial({ color: 0x8da7d8, transparent: true, opacity: 0.16, depthWrite: false }));
                plane.add(orbit);
                const planet = new THREE.Mesh(
                    new THREE.SphereGeometry(Math.max(1.2, scale * (0.018 + cosmicRandom(seed + index * 11.2) * 0.025)), 12, 10),
                    new THREE.MeshBasicMaterial({
                        color: new THREE.Color().setHSL((cosmicRandom(seed + index * 13.7) + seed * 0.01) % 1, 0.72, 0.58),
                        transparent: true, opacity: 0.9, fog: false
                    })
                );
                planets.push({ mesh: planet, radiusX, radiusZ, angle: cosmicRandom(seed + index * 4) * Math.PI * 2, speed: (0.11 + cosmicRandom(seed + index * 15.1) * 0.15) / Math.sqrt(0.5 + index * 0.45) });
                plane.add(planet);
                elements.push(plane);
            }
            if (cosmicRandom(seed + 81) > 0.32) {
                const beltPlane = new THREE.Group();
                beltPlane.rotation.x = (cosmicRandom(seed + 82) - 0.5) * Math.PI / 3;
                beltPlane.rotation.y = cosmicRandom(seed + 83) * Math.PI * 2;
                const beltGeometry = new THREE.BufferGeometry();
                const beltCount = 220 + Math.floor(cosmicRandom(seed + 84) * 260);
                const beltPositions = new Float32Array(beltCount * 3);
                for (let index = 0; index < beltCount; index++) {
                    const angle = cosmicRandom(seed + index * 0.71) * Math.PI * 2;
                    const radius = scale * (0.95 + cosmicRandom(seed + index * 1.41) * 1.1);
                    beltPositions[index * 3] = Math.cos(angle) * radius;
                    beltPositions[index * 3 + 1] = (cosmicRandom(seed + index * 1.93) - 0.5) * scale * 0.08;
                    beltPositions[index * 3 + 2] = Math.sin(angle) * radius;
                }
                beltGeometry.setAttribute('position', new THREE.BufferAttribute(beltPositions, 3));
                beltPlane.add(new THREE.Points(beltGeometry, new THREE.PointsMaterial({ size: Math.max(1.2, scale * 0.018), color: 0xc9a77e, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
                elements.push(beltPlane);
            }
            let comet = null;
            let cometPlane = null;
            let cometRadiusX = scale * 2;
            let cometRadiusZ = scale * 2;
            const trailParticles = [];
            if (cosmicRandom(seed + 91) > 0.22) {
                cometPlane = new THREE.Group();
                const nearStarOrbit = cosmicRandom(seed + 92) < 0.22;
                cometRadiusX = scale * (nearStarOrbit ? 0.42 + cosmicRandom(seed + 93) * 0.4 : 1.55 + cosmicRandom(seed + 94) * 1.55);
                cometRadiusZ = cometRadiusX * (0.38 + cosmicRandom(seed + 95) * 0.52);
                const inclination = (cosmicRandom(seed + 96) - 0.5) * Math.PI / 3;
                cometPlane.rotation.set(inclination, cosmicRandom(seed + 97) * Math.PI * 2, 0);
                const cometOrbit = new THREE.EllipseCurve(0, 0, cometRadiusX, cometRadiusZ, 0, Math.PI * 2, false, 0);
                const cometOrbitGeometry = new THREE.BufferGeometry().setFromPoints(cometOrbit.getPoints(80).map(point => new THREE.Vector3(point.x, 0, point.y)));
                cometPlane.add(new THREE.LineLoop(cometOrbitGeometry, new THREE.LineBasicMaterial({ color: 0xa6c8e7, transparent: true, opacity: 0.11, depthWrite: false })));
                comet = new THREE.Group();
                comet.add(new THREE.Mesh(new THREE.SphereGeometry(Math.max(2, scale * 0.04), 10, 8), new THREE.MeshBasicMaterial({ color: 0xc7efff, transparent: true, opacity: 0.98 })));
                cometPlane.add(comet);
                const trailTexture = createGlowTexture('rgba(190,235,255,1)');
                const trailCount = 30;
                for (let index = 0; index < trailCount; index++) {
                    const particle = new THREE.Sprite(new THREE.SpriteMaterial({ map: trailTexture, color: index % 3 ? 0x83c8ff : 0xe6fbff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
                    particle.scale.setScalar(Math.max(1, scale * (0.008 + cosmicRandom(seed + index * 3.7) * 0.018)));
                    particle.userData.baseScale = particle.scale.x;
                    particle.userData.age = Infinity;
                    cometPlane.add(particle);
                    trailParticles.push(particle);
                }
                elements.push(cometPlane);
            }
            for (let index = elements.length - 1; index > 0; index--) {
                const swapIndex = Math.floor(cosmicRandom(seed + index * 31.7) * (index + 1));
                [elements[index], elements[swapIndex]] = [elements[swapIndex], elements[index]];
            }
            elements.forEach(element => system.add(element));
            cosmicSystems.push({
                system, planets, comet, cometPlane, trailParticles, trailCursor: 0, trailClock: 0, scale,
                cometRadiusX,
                cometRadiusZ,
                phase: cosmicRandom(seed + 8) * Math.PI * 2,
                cometSpeed: 0.08 + cosmicRandom(seed + 99) * 0.16
            });
            cosmicBackgroundGroup.add(system);
        }

        function resetShootingStar(entry, index) {
            const origin = createSphericalBackgroundPosition(index, 24, 2600, 7200, 900 + index * 23 + entry.respawnCount * 41);
            const direction = new THREE.Vector3(
                cosmicRandom(index * 3.7 + entry.respawnCount * 5.1) - 0.5,
                cosmicRandom(index * 4.9 + entry.respawnCount * 6.3) - 0.5,
                cosmicRandom(index * 6.1 + entry.respawnCount * 7.7) - 0.5
            ).normalize();
            entry.streak.position.copy(origin);
            // 尾はローカル+Zへ伸びるため、+Zを進行方向の反対へ向ける。
            entry.streak.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction.clone().negate());
            entry.direction.copy(direction);
            entry.velocity.copy(direction).multiplyScalar(1.4 + cosmicRandom(index + entry.respawnCount * 2.7) * 5.8);
            entry.life = 8 + cosmicRandom(index + entry.respawnCount * 3.9) * 14;
            entry.maxLife = entry.life;
            entry.respawnCount += 1;
            const length = 110 + cosmicRandom(index * 2.4 + entry.respawnCount * 1.7) * 150;
            entry.head.scale.setScalar(18 + cosmicRandom(index + entry.respawnCount) * 12);
            entry.tail.scale.set(1, length, 1);
            entry.tailGlow.scale.set(1, length * 1.04, 1);
            entry.tail.position.z = length * 0.5;
            entry.tailGlow.position.z = length * 0.5;
            entry.tailParticles.scale.setScalar(Math.max(0.7, length / 150));
            entry.head.material.opacity = 0.94;
            entry.tail.material.opacity = 0.58;
            entry.tailGlow.material.opacity = 0.2;
            entry.tailParticles.material.opacity = 0.32;
        }

        function createShootingStars() {
            const shootingStarColors = [0xb9e6ff, 0xffd9a3, 0xffffff, 0xc9b8ff];
            for (let index = 0; index < 24; index++) {
                const streak = new THREE.Group();
                const color = shootingStarColors[index % shootingStarColors.length];
                const head = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: createGlowTexture('rgba(255,255,255,1)'), color,
                    transparent: true, opacity: 0.94, depthWrite: false,
                    blending: THREE.AdditiveBlending, fog: false
                }));
                const tail = new THREE.Mesh(
                    new THREE.ConeGeometry(1.3, 1, 8, 1, true),
                    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.58, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
                );
                const tailGlow = new THREE.Mesh(
                    new THREE.ConeGeometry(2.8, 1, 8, 1, true),
                    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
                );
                // Groupの正面は-lookAt方向。尾は+Z側へ伸ばすので、必ず頭の後ろへ流れる。
                tail.rotation.x = Math.PI * 0.5;
                tailGlow.rotation.x = Math.PI * 0.5;
                const tailParticles = new THREE.Points(
                    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 12 }, (_, particleIndex) => {
                        const progress = particleIndex / 11;
                        return new THREE.Vector3(
                            (cosmicRandom(index * 7.1 + particleIndex * 2.3) - 0.5) * 1.8,
                            (cosmicRandom(index * 9.7 + particleIndex * 1.7) - 0.5) * 1.4,
                            progress
                        );
                    })),
                    new THREE.PointsMaterial({ map: createCircleTexture(), color, size: 8, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
                );
                streak.add(head, tail, tailGlow, tailParticles);
                const entry = { streak, head, tail, tailGlow, tailParticles, direction: new THREE.Vector3(), velocity: new THREE.Vector3(), life: 0, respawnCount: index };
                cosmicBackgroundGroup.add(streak);
                shootingStars.push(entry);
                resetShootingStar(entry, index);
            }
        }

        function runCosmicSetupStep(label, setup) {
            try {
                return setup();
            } catch (error) {
                console.error(`[BubbleBreaker][Cosmos] ${label}の初期化に失敗しました`, error);
                return null;
            }
        }

        function createCosmicEnvironment() {
            runCosmicSetupStep('NGC 3324背景', createNGC3324PhotoDome);
            runCosmicSetupStep('データ背景', createAdditionalBackgroundThemes);
            galaxyClusterCenters.forEach((center, index) => runCosmicSetupStep(`銀河光 ${index + 1}`, () => addGalaxyGlow(center, 180 + index * 22, (0.58 + index * 0.047) % 1)));
            const nebulaCount = 8 + Math.floor(cosmicRandom(1441) * 6);
            Array.from({ length: nebulaCount }, (_, index) => {
                const seed = 1301 + index * 37;
                runCosmicSetupStep(`星雲 ${index + 1}`, () => addProceduralNebula(
                    createSphericalBackgroundPosition(index, nebulaCount, 2200, 14800, seed),
                    380 + cosmicRandom(seed + 1) * 1180,
                    seed
                ));
            });
            const externalSystemCount = galaxyClusterCenters.length * GALAXIES_PER_CLUSTER;
            Array.from({ length: externalSystemCount }, (_, index) => {
                const nearby = index < Math.ceil(externalSystemCount * 0.22);
                return [
                    createSphericalBackgroundPosition(index, externalSystemCount, nearby ? 1200 : 3600, nearby ? 2800 : 12500, 601 + index * 19),
                    26 + (index % 7) * 3,
                    601 + index * 17
                ];
            }).forEach(([center, scale, seed], index) => runCosmicSetupStep(`恒星系 ${index + 1}`, () => addSolarSystem(center, scale, seed)));
            runCosmicSetupStep('流れ星', createShootingStars);
        }

        runCosmicSetupStep('宇宙背景一式', createCosmicEnvironment);

        galaxyClusterCenters.forEach((center, index) => runCosmicSetupStep(`銀河団 ${index + 1}`, () => createGalaxyCluster(center, index)));
        runCosmicSetupStep('背景テーマ', () => setBackgroundTheme(backgroundTheme));

        // --- 個別のバブル（球体）を生成・管理する仕組み ---
        let currentBubbles = []; // 現在画面に表示されているバブルの配列を保存
        let targetCameraPos = new THREE.Vector3(0, 0, 25);     // カメラが移動する目標地点
        let targetControlTarget = new THREE.Vector3(0, 0, 0);  // カメラが向くべき注視点の目標地点
        const BUBBLE_GROUP_WORLD_SCALE = 1.75;
        let groupWorldOffset = new THREE.Vector3(0, 0, 0);
        let groupWorldScale = BUBBLE_GROUP_WORLD_SCALE;
        let navigationStack = [];
        let transitionState = null;
        let groupOverviewState = null;
        let loadingAnimation = null;
        let pendingUniverse = null;
        let groupZoomOutReady = false;
        let groupCameraInteractionArmed = false;
        let groupEntryCameraDistance = 25;
        let singleViewDirection = new THREE.Vector3(0, 0, 1);
        const configuredFieldOfView = 60;
        let last3DViewDirection = new THREE.Vector3(0, 0, 1);
        const warpSpeedFactor = 1;
        const warpStopCount = 3;
        camera.fov = configuredFieldOfView;
        camera.updateProjectionMatrix();

        function getExplorationFieldOfView() {
            return configuredFieldOfView;
        }

        function getExplorationViewDirection(candidate = null) {
            const direction = candidate ? candidate.clone() : camera.position.clone().sub(controls.target);
            if (direction.lengthSq() < 0.01 || !Number.isFinite(direction.x)) direction.copy(last3DViewDirection);
            return direction.normalize();
        }

        function applyExplorationViewControls() {
            controls.enableRotate = true;
            controls.enablePan = true;
            controls.screenSpacePanning = false;
        }

        function finishHierarchyTransitionForModeSwitch() {
            if (!transitionState) return;
            transitionState.outgoing.forEach(disposeBubble);
            transitionState.incoming.forEach(bubble => {
                bubble.mesh.material.opacity = 0.95;
                bubble.mesh.visible = true;
            });
            if (transitionState.shell) {
                scene.remove(transitionState.shell);
                disposeObjectTree(transitionState.shell);
            }
            transitionState = null;
            stopZoomSound();
        }

        function restoreThreeDViewForCurrentScreen() {
            if (!state || !currentBubbles.length) return;
            let center = null;
            let distance = null;
            if (state.screen === 'GROUP') {
                const overview = getGroupOverviewTarget(last3DViewDirection);
                if (overview) {
                    center = overview.center;
                    distance = overview.cameraPosition.distanceTo(center);
                }
            } else if (state.bubbleId) {
                const current = currentBubbles.find(bubble => bubble.data.id === state.bubbleId);
                if (current) {
                    center = current.mesh.position;
                    const radius = current.mesh.userData.finalScale || current.mesh.scale.x;
                    distance = state.screen === 'SINGLE' ? getSingleBubbleViewingDistance(radius) : radius * 3.5;
                }
            }
            if (!center || !Number.isFinite(distance)) return;
            camera.position.copy(center).addScaledVector(last3DViewDirection, distance);
            controls.target.copy(center);
            targetCameraPos.copy(camera.position);
            targetControlTarget.copy(center);
            camera.lookAt(center);
            controls.update();
        }

        window.setExplorationViewMode = function(mode = '3d', animate = true) {
            const nextMode = mode === '2d' ? '2d' : '3d';
            const previousMode = explorationViewMode;
            const currentDirection = camera.position.clone().sub(controls.target);
            if (explorationViewMode === '3d' && currentDirection.lengthSq() > 0.01) last3DViewDirection.copy(currentDirection).normalize();
            if (nextMode === '2d') {
                finishHierarchyTransitionForModeSwitch();
                groupOverviewState = null;
                isZoomingIntoGroup = false;
            }
            explorationViewMode = nextMode;
            camera.fov = configuredFieldOfView;
            camera.updateProjectionMatrix();
            if (nextMode === '3d') {
                applyExplorationViewControls();
                if (previousMode === '2d') restoreThreeDViewForCurrentScreen();
            }
            if (typeof window.syncTwoDExplorationMode === 'function') window.syncTwoDExplorationMode(nextMode, animate);
            return explorationViewMode;
        };
        window.setExplorationViewMode(explorationViewMode, false);
        window.markBubbleAnalysisComplete = function(bubbleId) {
            const bubble = activeDB && Object.values(activeDB).flatMap(group => group.bubbles || []).find(item => String(item.id) === String(bubbleId));
            if (bubble) bubble.analysisCompletionAt = performance.now();
            const visibleBubble = currentBubbles.find(item => String(item.data && item.data.id) === String(bubbleId));
            if (visibleBubble && visibleBubble.mesh && visibleBubble.mesh.userData.analysisProbe) {
                visibleBubble.mesh.userData.analysisProbe.userData.analysisProbeAnimation.completionStartedAt = performance.now();
            }
        };
        const BUBBLE_VISUAL_MODE_NAMES = ['network', 'classic', 'deepSea', 'data'];
        const storedSceneBubbleVisualMode = localStorage.getItem('bubblebreaker.bubbleVisualMode');
        let bubbleVisualMode = BUBBLE_VISUAL_MODE_NAMES.includes(storedSceneBubbleVisualMode) ? storedSceneBubbleVisualMode : 'network';

        function getGroupOverviewTarget(directionOverride = null) {
            if (!currentBubbles.length) return null;
            const bounds = new THREE.Box3();
            currentBubbles.filter(bubble => bubble.groupId === state.groupId).forEach(bubble => {
                if (!bubble.mesh.visible) return;
                const radius = Math.max(0.01, bubble.mesh.userData.finalScale || bubble.mesh.scale.x);
                const position = bubble.mesh.position;
                bounds.expandByPoint(position.clone().addScalar(radius));
                bounds.expandByPoint(position.clone().addScalar(-radius));
            });
            if (bounds.isEmpty()) return null;
            const sphere = bounds.getBoundingSphere(new THREE.Sphere());
            const verticalHalfFov = THREE.MathUtils.degToRad(getExplorationFieldOfView() * 0.5);
            const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(0.1, camera.aspect));
            const requiredDistance = Math.max(
                sphere.radius / Math.max(0.08, Math.tan(verticalHalfFov)),
                sphere.radius / Math.max(0.08, Math.tan(horizontalHalfFov))
            ) * 1.28;
            const direction = directionOverride
                ? directionOverride.clone()
                : camera.position.clone().sub(controls.target);
            direction.copy(getExplorationViewDirection(direction));
            return {
                center: sphere.center,
                cameraPosition: sphere.center.clone().add(direction.multiplyScalar(Math.max(0.05, requiredDistance))),
                radius: sphere.radius
            };
        }

        function beginGroupOverview() {
            const target = getGroupOverviewTarget();
            if (!target) {
                groupZoomOutReady = true;
                return;
            }
            groupOverviewState = {
                cameraPosition: target.cameraPosition,
                controlTarget: target.center,
                startedAt: performance.now()
            };
            targetCameraPos.copy(target.cameraPosition);
            targetControlTarget.copy(target.center);
            controls.enabled = false;
        }

        window.requestGroupZoomOut = function() {
            if (state.screen !== 'GROUP' || !state.groupData || !state.groupData.parentId) return false;
            if (transitionState || isZoomingIntoGroup || loadingAnimation) return false;
            if (!groupZoomOutReady) {
                if (!groupOverviewState) beginGroupOverview();
                return false;
            }
            return true;
        };

        window.markGroupCameraInteraction = function(direction = 'zoomIn') {
            if (direction !== 'zoomIn') {
                groupCameraInteractionArmed = false;
                return;
            }
            if (state.screen !== 'GROUP' || transitionState || isZoomingIntoGroup || loadingAnimation) return;
            groupCameraInteractionArmed = true;
        };

        function getSingleBubbleViewingDistance(radius) {
            const verticalFov = THREE.MathUtils.degToRad(getExplorationFieldOfView());
            const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.5, camera.aspect));
            const limitingFov = Math.min(verticalFov, horizontalFov);
            return Math.max(0.00002, radius / Math.sin(limitingFov * 0.45) * 1.02 + radius * 0.05);
        }

        function getNearestApproachingBubble() {
            if (state.screen !== 'GROUP' || state.bubbleId || !groupCameraInteractionArmed || transitionState || groupOverviewState || isZoomingIntoGroup) return null;
            let nearest = null;
            let nearestDistance = Infinity;
            const viewDirection = controls.target.clone().sub(camera.position).normalize();
            currentBubbles.forEach(bubble => {
                if (!bubble.mesh.visible) return;
                const radius = Math.max(0.01, bubble.mesh.scale.x);
                const toBubble = bubble.mesh.position.clone().sub(camera.position);
                const distance = toBubble.length();
                if (distance <= 0.01 || viewDirection.dot(toBubble.normalize()) < 0.82) return;
                const singleViewDistance = getSingleBubbleViewingDistance(radius);
                const reachedSingleApparentSize = distance <= singleViewDistance * 1.05;
                if (reachedSingleApparentSize && distance < nearestDistance) {
                    nearest = bubble;
                    nearestDistance = distance;
                }
            });
            return nearest;
        }

        function updateAutomaticBubbleApproach() {
            const nearest = getNearestApproachingBubble();
            if (!nearest) return;
            groupCameraInteractionArmed = false;
            window.loadSingle(nearest.data);
        }

        function hashBubbleValue(value) {
            let hash = 2166136261;
            for (let index = 0; index < String(value || '').length; index++) {
                hash ^= String(value || '').charCodeAt(index);
                hash = Math.imul(hash, 16777619);
            }
            return hash >>> 0;
        }

        function getBubbleDisplayColor(colorHex) {
            return new THREE.Color(Number(colorHex) || 0x66ccff);
        }

        function applyBubbleMeshColor(mesh, bubbleData) {
            if (!mesh || !mesh.material) return;
            const color = getBubbleDisplayColor(mesh.userData.sourceColor, bubbleData);
            mesh.material.color.copy(color);
            if (mesh.material.emissive) mesh.material.emissive.copy(color);
            const visuals = [
                mesh.userData.networkVisual,
                mesh.userData.deepSeaVisual,
                mesh.userData.dataVisual,
                mesh.userData.analysisProbe
            ].filter(Boolean);
            visuals.forEach(visual => visual.traverse(child => {
                if (!child.material || !child.material.color) return;
                const animation = visual.userData.networkAnimation || visual.userData.deepSeaAnimation || visual.userData.dataAnimation;
                if (animation && (child === animation.observerRing || child === animation.scanRing)) return;
                child.material.color.copy(color);
            }));
        }

        function createAnalysisProbeVisual(isFocus = false) {
            const visual = new THREE.Group();
            visual.scale.setScalar(isFocus ? 2.55 : 2.05);
            visual.userData.baseScale = visual.scale.x;
            const orbit = new THREE.Mesh(
                new THREE.TorusGeometry(1.04, isFocus ? 0.05 : 0.04, 8, 72),
                new THREE.MeshBasicMaterial({ color: 0xffa94d, transparent: true, opacity: isFocus ? 1 : 0.88, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            orbit.rotation.x = Math.PI * 0.5;
            visual.add(orbit);
            const probe = new THREE.Group();
            const body = new THREE.Mesh(
                new THREE.SphereGeometry(isFocus ? 0.105 : 0.085, 12, 10),
                new THREE.MeshBasicMaterial({ color: 0xdffaff, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            const nose = new THREE.Mesh(
                new THREE.ConeGeometry(isFocus ? 0.045 : 0.032, isFocus ? 0.16 : 0.11, 7, 1),
                new THREE.MeshBasicMaterial({ color: 0xffb84d, transparent: true, opacity: 0.96, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            nose.rotation.z = -Math.PI * 0.5;
            nose.position.x = isFocus ? 0.075 : 0.055;
            const antenna = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.025, 0), new THREE.Vector3(0, isFocus ? 0.14 : 0.1, 0)]),
                new THREE.LineBasicMaterial({ color: 0x9beeff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            probe.add(body, nose, antenna);
            visual.add(probe);
            const scanBeam = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -0.52)]),
                new THREE.LineBasicMaterial({ color: 0x9beeff, transparent: true, opacity: isFocus ? 0.9 : 0.62, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            probe.add(scanBeam);
            const completionFlash = new THREE.Mesh(
                new THREE.TorusGeometry(0.94, isFocus ? 0.07 : 0.05, 10, 72),
                new THREE.MeshBasicMaterial({ color: 0x8dffca, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            completionFlash.rotation.x = Math.PI * 0.5;
            completionFlash.visible = false;
            visual.add(completionFlash);
            visual.userData.analysisProbeAnimation = {
                phase: Math.random() * Math.PI * 2,
                orbit,
                probe,
                completionFlash
            };
            return visual;
        }

        function createNetworkBubbleVisual(displayColor, bubbleData, level = 'central', isFocus = false) {
            const seed = hashBubbleValue(bubbleData && bubbleData.id);
            const visual = new THREE.Group();
            const profile = level === 'root'
                ? { nodes: 4, rings: 2, particles: 12 }
                : level === 'leaf'
                    ? { nodes: 4, rings: 2, particles: 10 }
                    : { nodes: 7, rings: 3, particles: 18 };
            const accent = displayColor.clone();
            accent.offsetHSL(((seed % 17) - 8) / 360, 0.08, 0.12);
            const lineMaterial = new THREE.LineBasicMaterial({
                color: accent,
                transparent: true,
                opacity: isFocus ? 0.78 : 0.42,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const nodeMaterial = new THREE.MeshBasicMaterial({
                color: accent,
                transparent: true,
                opacity: isFocus ? 0.95 : 0.76,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const shellMaterial = new THREE.MeshBasicMaterial({
                color: accent,
                transparent: true,
                opacity: isFocus ? 0.22 : 0.11,
                wireframe: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const shell = new THREE.Mesh(new THREE.SphereGeometry(1.08, 24, 16), shellMaterial);
            visual.add(shell);

            const ringGeometry = new THREE.TorusGeometry(1.22, isFocus ? 0.026 : 0.018, 6, 48);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: isFocus ? 0xffe38a : accent,
                transparent: true,
                opacity: isFocus ? 0.92 : 0.48,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const rings = [];
            for (let index = 0; index < profile.rings; index++) {
                const ring = new THREE.Mesh(ringGeometry, ringMaterial);
                ring.rotation.set(
                    Math.PI * (0.22 + ((seed + index * 13) % 37) / 100),
                    Math.PI * ((seed + index * 29) % 100) / 100,
                    Math.PI * ((seed + index * 7) % 100) / 100
                );
                ring.scale.setScalar(1 + index * 0.065);
                visual.add(ring);
                rings.push(ring);
            }

            const nodeGeometry = new THREE.SphereGeometry(isFocus ? 0.075 : 0.055, 10, 8);
            const nodes = [];
            const nodePositions = [];
            for (let index = 0; index < profile.nodes; index++) {
                const latitude = 0.25 + ((seed + index * 31) % 50) / 100;
                const theta = ((seed + index * 137) % 360) * Math.PI / 180;
                const y = (index % 2 === 0 ? 1 : -1) * latitude;
                const radial = Math.sqrt(Math.max(0.1, 1 - y * y));
                const nodePosition = new THREE.Vector3(
                    Math.cos(theta) * radial * 1.34,
                    y * 1.34,
                    Math.sin(theta) * radial * 1.34
                );
                const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
                node.position.copy(nodePosition);
                visual.add(node);
                nodes.push(node);
                nodePositions.push(nodePosition);
                const linkGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), nodePosition]);
                visual.add(new THREE.Line(linkGeometry, lineMaterial));
            }

            for (let index = 1; index < nodePositions.length; index += 2) {
                const linkGeometry = new THREE.BufferGeometry().setFromPoints([nodePositions[index - 1], nodePositions[index]]);
                visual.add(new THREE.Line(linkGeometry, lineMaterial));
            }

            const particlePositions = new Float32Array(profile.particles * 3);
            for (let index = 0; index < profile.particles; index++) {
                const theta = ((seed + index * 47) % 360) * Math.PI / 180;
                const y = (((seed + index * 19) % 200) / 100) - 1;
                const radial = Math.sqrt(Math.max(0.05, 1 - y * y));
                const radius = 1.12 + ((seed + index * 23) % 32) / 100;
                particlePositions[index * 3] = Math.cos(theta) * radial * radius;
                particlePositions[index * 3 + 1] = y * radius;
                particlePositions[index * 3 + 2] = Math.sin(theta) * radial * radius;
            }
            const particleGeometry = new THREE.BufferGeometry();
            particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
            const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
                color: accent,
                size: isFocus ? 0.07 : 0.045,
                transparent: true,
                opacity: isFocus ? 0.72 : 0.38,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            }));
            visual.add(particles);

            let observerRing = null;
            if (isFocus) {
                observerRing = new THREE.Mesh(
                    new THREE.TorusGeometry(1.42, 0.035, 8, 64),
                    new THREE.MeshBasicMaterial({ color: 0xffe38a, transparent: true, opacity: 0.86, depthWrite: false, blending: THREE.AdditiveBlending })
                );
                observerRing.rotation.x = Math.PI * 0.5;
                visual.add(observerRing);
            }
            const scanRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.88, 0.018, 6, 48),
                new THREE.MeshBasicMaterial({ color: 0x9beeff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            scanRing.rotation.x = Math.PI * 0.5;
            scanRing.visible = false;
            visual.add(scanRing);
            visual.userData.networkAnimation = {
                phase: (seed % 1000) / 1000 * Math.PI * 2,
                rings,
                nodes,
                particles,
                observerRing,
                scanRing
            };
            visual.userData.bubbleVisualMode = 'network';
            return visual;
        }

        function createDeepSeaBubbleVisual(displayColor, bubbleData, level = 'central', isFocus = false) {
            const seed = hashBubbleValue(`${bubbleData && bubbleData.id}:deep-sea`);
            const visual = new THREE.Group();
            const accent = displayColor.clone().offsetHSL(0.04, 0.08, 0.04);
            const glowMaterial = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: isFocus ? 0.3 : 0.16, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending });
            visual.add(new THREE.Mesh(new THREE.SphereGeometry(1.12, 24, 16), glowMaterial));
            const current = new THREE.Mesh(
                new THREE.TorusGeometry(1.16, isFocus ? 0.035 : 0.024, 7, 56),
                new THREE.MeshBasicMaterial({ color: 0x7dffe6, transparent: true, opacity: isFocus ? 0.82 : 0.5, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            current.rotation.x = Math.PI * 0.5;
            visual.add(current);

            const bubbleCount = level === 'central' ? 16 : 10;
            const bubbleGeometry = new THREE.SphereGeometry(isFocus ? 0.055 : 0.04, 8, 6);
            const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0x9dfff1, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending });
            const bubbles = [];
            for (let index = 0; index < bubbleCount; index++) {
                const bubble = new THREE.Mesh(bubbleGeometry, bubbleMaterial);
                visual.add(bubble);
                bubbles.push({ mesh: bubble, phase: (seed + index * 37) % 100 / 100 * Math.PI * 2, radius: 0.62 + (index % 5) * 0.12, height: 0.78 + (index % 4) * 0.15, speed: 0.18 + (index % 3) * 0.07 });
            }

            const tendrils = [];
            const tendrilMaterial = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: isFocus ? 0.72 : 0.42, depthWrite: false, blending: THREE.AdditiveBlending });
            for (let index = 0; index < 6; index++) {
                const points = [];
                const angle = (seed % 360) * Math.PI / 180 + index * Math.PI / 3;
                for (let pointIndex = 0; pointIndex < 6; pointIndex++) {
                    const progress = pointIndex / 5;
                    const radius = 0.34 + progress * 0.86;
                    points.push(new THREE.Vector3(
                        Math.cos(angle + progress * 0.9) * radius,
                        -0.25 - progress * 0.8,
                        Math.sin(angle + progress * 0.9) * radius
                    ));
                }
                const tendril = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), tendrilMaterial);
                visual.add(tendril);
                tendrils.push(tendril);
            }
            const fish = [];
            const fishCount = level === 'central' ? 7 : 4;
            for (let index = 0; index < fishCount; index++) {
                const fishGroup = new THREE.Group();
                const fishBody = new THREE.Mesh(
                    new THREE.SphereGeometry(isFocus ? 0.075 : 0.055, 10, 7),
                    new THREE.MeshBasicMaterial({ color: index % 2 ? 0x8dfff0 : 0xb9d6ff, transparent: true, opacity: 0.86, depthWrite: false, blending: THREE.AdditiveBlending })
                );
                fishBody.scale.set(1.45, 0.68, 0.68);
                const fishTail = new THREE.Mesh(
                    new THREE.ConeGeometry(isFocus ? 0.07 : 0.05, isFocus ? 0.2 : 0.14, 4, 1),
                    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.72, depthWrite: false, blending: THREE.AdditiveBlending })
                );
                fishTail.rotation.z = -Math.PI * 0.5;
                fishTail.position.x = isFocus ? -0.14 : -0.1;
                fishGroup.add(fishBody, fishTail);
                visual.add(fishGroup);
                fish.push({ mesh: fishGroup, phase: (seed + index * 61) % 360 * Math.PI / 180, radius: 0.65 + (index % 3) * 0.16, height: -0.15 + (index % 4) * 0.2, speed: 0.24 + (index % 3) * 0.06, direction: index % 2 ? 1 : -1 });
            }
            const jellies = [];
            const jellyCount = level === 'central' ? 3 : 2;
            for (let index = 0; index < jellyCount; index++) {
                const jelly = new THREE.Group();
                const bell = new THREE.Mesh(
                    new THREE.SphereGeometry(isFocus ? 0.12 : 0.085, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.58),
                    new THREE.MeshBasicMaterial({ color: 0xd09dff, transparent: true, opacity: 0.68, depthWrite: false, blending: THREE.AdditiveBlending })
                );
                const tentacleMaterial = new THREE.LineBasicMaterial({ color: 0x9dfff1, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
                const tentacles = [];
                for (let tentacleIndex = 0; tentacleIndex < 3; tentacleIndex++) {
                    const points = [new THREE.Vector3((tentacleIndex - 1) * 0.055, -0.05, 0), new THREE.Vector3((tentacleIndex - 1) * 0.08, -0.22, (tentacleIndex % 2 ? 0.04 : -0.04))];
                    const tentacle = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), tentacleMaterial);
                    jelly.add(tentacle);
                    tentacles.push(tentacle);
                }
                jelly.add(bell);
                visual.add(jelly);
                jellies.push({ mesh: jelly, phase: (seed + index * 97) % 360 * Math.PI / 180, radius: 0.72 + index * 0.2, speed: 0.16 + index * 0.04, tentacles });
            }
            const coral = [];
            const coralMaterial = new THREE.MeshBasicMaterial({ color: 0xff7fc8, transparent: true, opacity: 0.58, depthWrite: false, blending: THREE.AdditiveBlending });
            for (let index = 0; index < (level === 'central' ? 8 : 5); index++) {
                const angle = (seed + index * 43) % 360 * Math.PI / 180;
                const coralMesh = new THREE.Mesh(new THREE.ConeGeometry(0.05 + (index % 3) * 0.018, 0.32 + (index % 4) * 0.09, 5, 1), coralMaterial);
                coralMesh.position.set(Math.cos(angle) * (0.72 + (index % 2) * 0.18), -0.72 + (index % 3) * 0.04, Math.sin(angle) * (0.72 + (index % 2) * 0.18));
                visual.add(coralMesh);
                coral.push(coralMesh);
            }
            const planktonPositions = new Float32Array((level === 'central' ? 90 : 55) * 3);
            for (let index = 0; index < planktonPositions.length / 3; index++) {
                const angle = cosmicRandom(seed + index * 1.7) * Math.PI * 2;
                const radius = 0.45 + cosmicRandom(seed + index * 2.3) * 0.92;
                planktonPositions[index * 3] = Math.cos(angle) * radius;
                planktonPositions[index * 3 + 1] = (cosmicRandom(seed + index * 3.1) - 0.5) * 1.8;
                planktonPositions[index * 3 + 2] = Math.sin(angle) * radius;
            }
            const planktonGeometry = new THREE.BufferGeometry();
            planktonGeometry.setAttribute('position', new THREE.BufferAttribute(planktonPositions, 3));
            const plankton = new THREE.Points(planktonGeometry, new THREE.PointsMaterial({ color: 0xb5fff4, size: isFocus ? 0.035 : 0.024, transparent: true, opacity: 0.52, depthWrite: false, blending: THREE.AdditiveBlending }));
            visual.add(plankton);
            const scanRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.92, 0.018, 6, 48),
                new THREE.MeshBasicMaterial({ color: 0xb5fff4, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            scanRing.visible = false;
            visual.add(scanRing);
            visual.userData.deepSeaAnimation = { phase: (seed % 1000) / 1000 * Math.PI * 2, current, bubbles, tendrils, fish, jellies, coral, plankton, scanRing };
            visual.userData.bubbleVisualMode = 'deepSea';
            return visual;
        }

        function createDataBubbleVisual(displayColor, bubbleData, level = 'central', isFocus = false) {
            const seed = hashBubbleValue(`${bubbleData && bubbleData.id}:data-space`);
            const visual = new THREE.Group();
            const accent = displayColor.clone().offsetHSL(0.08, 0.1, 0.08);
            const shell = new THREE.Mesh(
                new THREE.SphereGeometry(1.1, 16, 12),
                new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: isFocus ? 0.16 : 0.08, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            visual.add(shell);
            const nodeCount = level === 'central' ? 9 : 6;
            const nodeGeometry = new THREE.SphereGeometry(isFocus ? 0.075 : 0.055, 8, 6);
            const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x9afcff, transparent: true, opacity: 0.88, depthWrite: false, blending: THREE.AdditiveBlending });
            const nodes = [];
            const positions = [];
            for (let index = 0; index < nodeCount; index++) {
                const angle = (seed + index * 137) % 360 * Math.PI / 180;
                const latitude = (((seed + index * 29) % 100) / 100 - 0.5) * 1.5;
                const radius = Math.sqrt(Math.max(0.18, 1 - latitude * latitude)) * 1.02;
                const position = new THREE.Vector3(Math.cos(angle) * radius, latitude, Math.sin(angle) * radius);
                const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
                node.position.copy(position);
                visual.add(node);
                nodes.push(node);
                positions.push(position);
            }
            const linkMaterial = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: isFocus ? 0.7 : 0.4, depthWrite: false, blending: THREE.AdditiveBlending });
            const links = [];
            positions.forEach((position, index) => {
                const next = positions[(index + 1) % positions.length];
                const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([position, next]), linkMaterial);
                visual.add(line);
                links.push(line);
            });
            const packetGeometry = new THREE.SphereGeometry(isFocus ? 0.045 : 0.032, 7, 5);
            const packetMaterial = new THREE.MeshBasicMaterial({ color: 0xffe38a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
            const packets = Array.from({ length: Math.min(4, nodeCount) }, (_, index) => {
                const packet = new THREE.Mesh(packetGeometry, packetMaterial);
                visual.add(packet);
                return { mesh: packet, edge: index, progress: (seed % 100) / 100 + index * 0.19 };
            });
            const grids = [];
            const gridMaterial = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: isFocus ? 0.36 : 0.2, depthWrite: false, blending: THREE.AdditiveBlending });
            [0.58, 0.82, 1.06].forEach((radius, index) => {
                const grid = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008 + index * 0.003, 5, 40), gridMaterial);
                grid.rotation.set(index * 0.72, index * 0.43, index * 0.31);
                visual.add(grid);
                grids.push(grid);
            });
            const streams = [];
            const streamPackets = [];
            const streamMaterial = new THREE.LineBasicMaterial({ color: 0x67e8ff, transparent: true, opacity: 0.54, depthWrite: false, blending: THREE.AdditiveBlending });
            for (let streamIndex = 0; streamIndex < (level === 'central' ? 5 : 3); streamIndex++) {
                const streamPoints = [];
                const streamAngle = (seed + streamIndex * 71) % 360 * Math.PI / 180;
                for (let pointIndex = 0; pointIndex < 7; pointIndex++) {
                    const progress = pointIndex / 6;
                    const radius = 0.28 + progress * 0.96;
                    streamPoints.push(new THREE.Vector3(
                        Math.cos(streamAngle + progress * 1.5) * radius,
                        Math.sin(streamAngle * 0.7 + progress * 2.2) * 0.46,
                        Math.sin(streamAngle + progress * 1.5) * radius
                    ));
                }
                const stream = new THREE.Line(new THREE.BufferGeometry().setFromPoints(streamPoints), streamMaterial);
                visual.add(stream);
                streams.push(stream);
                for (let packetIndex = 0; packetIndex < 4; packetIndex++) {
                    const packet = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), packetMaterial);
                    visual.add(packet);
                    streamPackets.push({ mesh: packet, streamIndex, progress: packetIndex * 0.23 + (seed % 50) / 100 });
                }
            }
            const dataCubes = [];
            for (let index = 0; index < (level === 'central' ? 6 : 3); index++) {
                const cube = new THREE.Mesh(
                    new THREE.BoxGeometry(0.11, 0.11, 0.11),
                    new THREE.MeshBasicMaterial({ color: index % 2 ? 0xffe38a : 0xff7bd8, transparent: true, opacity: 0.72, wireframe: true, depthWrite: false, blending: THREE.AdditiveBlending })
                );
                const angle = (seed + index * 53) % 360 * Math.PI / 180;
                cube.position.set(Math.cos(angle) * (0.72 + index * 0.03), Math.sin(angle * 1.8) * 0.58, Math.sin(angle) * (0.72 + index * 0.03));
                visual.add(cube);
                dataCubes.push(cube);
            }
            const scanRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.9, 0.018, 6, 48),
                new THREE.MeshBasicMaterial({ color: 0x9afcff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            scanRing.visible = false;
            visual.add(scanRing);
            visual.userData.dataAnimation = { phase: (seed % 1000) / 1000 * Math.PI * 2, nodes, links, positions, packets, grids, streams, streamPackets, dataCubes, scanRing };
            visual.userData.bubbleVisualMode = 'data';
            return visual;
        }

        function ensureNetworkBubbleVisual(mesh, bubbleData, level, isFocus = false) {
            if (!mesh || !bubbleData) return null;
            if (!mesh.userData.networkVisual) {
                const displayColor = mesh.material && mesh.material.color ? mesh.material.color.clone() : new THREE.Color(0x66ccff);
                mesh.userData.networkVisual = createNetworkBubbleVisual(displayColor, bubbleData, level, isFocus);
                mesh.add(mesh.userData.networkVisual);
            }
            mesh.userData.networkVisual.visible = bubbleVisualMode === 'network';
            return mesh.userData.networkVisual;
        }

        function ensureDeepSeaBubbleVisual(mesh, bubbleData, level, isFocus = false) {
            if (!mesh || !bubbleData) return null;
            if (!mesh.userData.deepSeaVisual) {
                const displayColor = mesh.material && mesh.material.color ? mesh.material.color.clone() : new THREE.Color(0x66ccff);
                mesh.userData.deepSeaVisual = createDeepSeaBubbleVisual(displayColor, bubbleData, level, isFocus);
                mesh.add(mesh.userData.deepSeaVisual);
            }
            mesh.userData.deepSeaVisual.visible = bubbleVisualMode === 'deepSea';
            return mesh.userData.deepSeaVisual;
        }

        function ensureDataBubbleVisual(mesh, bubbleData, level, isFocus = false) {
            if (!mesh || !bubbleData) return null;
            if (!mesh.userData.dataVisual) {
                const displayColor = mesh.material && mesh.material.color ? mesh.material.color.clone() : new THREE.Color(0x66ccff);
                mesh.userData.dataVisual = createDataBubbleVisual(displayColor, bubbleData, level, isFocus);
                mesh.add(mesh.userData.dataVisual);
            }
            mesh.userData.dataVisual.visible = bubbleVisualMode === 'data';
            return mesh.userData.dataVisual;
        }

        function ensureBubbleVisual(mesh, bubbleData, level, isFocus = false) {
            if (!mesh || !bubbleData) return null;
            const visual = bubbleVisualMode === 'classic'
                ? null
                : bubbleVisualMode === 'deepSea'
                ? ensureDeepSeaBubbleVisual(mesh, bubbleData, level, isFocus)
                : bubbleVisualMode === 'data'
                    ? ensureDataBubbleVisual(mesh, bubbleData, level, isFocus)
                    : ensureNetworkBubbleVisual(mesh, bubbleData, level, isFocus);
            if (mesh.userData.networkVisual) mesh.userData.networkVisual.visible = bubbleVisualMode === 'network';
            if (mesh.userData.deepSeaVisual) mesh.userData.deepSeaVisual.visible = bubbleVisualMode === 'deepSea';
            if (mesh.userData.dataVisual) mesh.userData.dataVisual.visible = bubbleVisualMode === 'data';
            return visual;
        }

        window.setBubbleVisualMode = function(mode = 'network') {
            bubbleVisualMode = BUBBLE_VISUAL_MODE_NAMES.includes(mode) ? mode : 'network';
            const bubbles = [...currentBubbles];
            if (transitionState) bubbles.push(...(transitionState.outgoing || []));
            bubbles.forEach(bubble => {
                if (!bubble || !bubble.mesh) return;
                ensureBubbleVisual(bubble.mesh, bubble.data, bubble.level, bubble.isFocus);
                const ornament = bubble.mesh.userData.networkVisual || bubble.mesh.userData.deepSeaVisual || bubble.mesh.userData.dataVisual;
                if (ornament && bubble.mesh.userData.ornamentRotation) {
                    ornament.rotation.copy(bubble.mesh.userData.ornamentRotation);
                    ornament.scale.setScalar(bubble.mesh.userData.ornamentScale || 1);
                }
            });
            return bubbleVisualMode;
        };

        function createChildBubblePreview(bubbleData) {
            // 子テーマは固有の階層として保持し、表示時にそのグループだけを描画する。
            return null;
        }

        function createHierarchyTransitionShell(position, radius, color = 0x9beeff) {
            const shell = new THREE.Mesh(
                new THREE.SphereGeometry(1, 32, 22),
                new THREE.MeshBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.16,
                    side: THREE.DoubleSide,
                    wireframe: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                    fog: false
                })
            );
            shell.position.copy(position);
            shell.scale.setScalar(Math.max(0.0000001, radius));
            shell.userData.baseScale = Math.max(0.01, radius);
            scene.add(shell);
            return shell;
        }

        // バブルの3Dモデル(Mesh)を作る関数
        function createBubbleMesh(size, colorHex, position, bubbleData = null, level = 'central', isFocus = false) {
            // ガラスのような質感を出すための物理ベースマテリアル設定
            const sourceColor = new THREE.Color(colorHex);
            const displayColor = getBubbleDisplayColor(colorHex, bubbleData);
            const hsl = {};
            displayColor.getHSL(hsl);
            displayColor.setHSL(hsl.h, Math.max(0.58, hsl.s), Math.max(0.48, hsl.l));
            const material = new THREE.MeshPhysicalMaterial({
                color: displayColor, metalness: 0.05, roughness: 0.2, transmission: 0.18,
                transparent: true, opacity: 0.95, ior: 1.5, clearcoat: 1.0, clearcoatRoughness: 0.1,
                emissive: displayColor, emissiveIntensity: 0.22
            });
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), material);
            // 占有率の差を視覚的に誇張する。sizeはグループ内で100に正規化済み。
            const radius = Math.max(1.15, Math.pow(Math.max(1, size), 0.62));
            mesh.scale.set(radius, radius, radius);
            mesh.position.set(...position);
            mesh.userData.bubbleId = bubbleData && bubbleData.id ? bubbleData.id : null;
            mesh.userData.sourceColor = sourceColor.getHex();
            mesh.userData.networkVisual = null;
            mesh.userData.deepSeaVisual = null;
            mesh.userData.dataVisual = null;
            mesh.userData.analysisProbe = createAnalysisProbeVisual(isFocus);
            mesh.add(mesh.userData.analysisProbe);
            mesh.userData.childPreview = null;
            if (bubbleData) ensureBubbleVisual(mesh, bubbleData, level, isFocus);
            const ornament = mesh.userData.networkVisual || mesh.userData.deepSeaVisual || mesh.userData.dataVisual;
            if (ornament) ornament.scale.setScalar(mesh.userData.ornamentScale || (0.82 + (hashBubbleValue(bubbleData && bubbleData.id) % 37) / 100));
            return mesh;
        }

        function getTypeBubbleScale(group, bubbleData) {
            if (!group || !bubbleData || !Array.isArray(group.bubbles)) return 1;
            const rank = group.bubbles.slice().sort((a, b) => Number(b.size || 0) - Number(a.size || 0)).findIndex(item => item.id === bubbleData.id);
            if (group.type === '一極集中型') return rank === 0 ? 1.42 : 0.9 + (rank % 3) * 0.05;
            if (group.type === '双極対立型') return rank < 2 ? 1.24 : 0.88 + (rank % 2) * 0.08;
            if (group.type === '多極型') return rank < Math.min(4, group.bubbles.length) ? 1.14 : 0.91;
            if (group.type === '階層型') return rank === 0 ? 1.32 : Math.max(0.82, 1.05 - rank * 0.045);
            if (group.type === '連鎖型') return 0.92 + (rank % 3) * 0.08;
            return 0.9 + (hashBubbleValue(bubbleData.id) % 17) / 100;
        }

        function getBubbleLocalRadius(group, bubbleData) {
            return Math.max(1.15, Math.pow(Math.max(1, Number(bubbleData && bubbleData.size) || 1), 0.62)) * getTypeBubbleScale(group, bubbleData);
        }

        function getGroupLocalExtent(group) {
            if (!group || !Array.isArray(group.bubbles)) return 1;
            arrangeBubblePositions(group);
            return Math.max(1, ...group.bubbles.filter(isRenderableBubbleData).map(bubble => {
                const position = Array.isArray(bubble.pos) ? bubble.pos : [0, 0, 0];
                return Math.hypot(Number(position[0]) || 0, Number(position[1]) || 0, Number(position[2]) || 0) + getBubbleLocalRadius(group, bubble);
            }));
        }

        function getNestedGroupWorldScale(group, parentBubbleWorldRadius) {
            return Math.max(0.012, (Math.max(0.1, parentBubbleWorldRadius) * 0.56) / getGroupLocalExtent(group));
        }

        function buildNavigationEntries(path) {
            let offset = new THREE.Vector3(0, 0, 0);
            let scale = BUBBLE_GROUP_WORLD_SCALE;
            return path.map((groupId, index) => {
                const group = activeDB[groupId];
                let anchorBubble = null;
                if (index > 0) {
                    const parent = activeDB[path[index - 1]];
                    arrangeBubblePositions(parent);
                    anchorBubble = parent && parent.bubbles.find(bubble => bubble.childId === groupId);
                    if (anchorBubble) {
                        const parentRadius = getBubbleLocalRadius(parent, anchorBubble) * scale;
                        offset = offset.clone().add(new THREE.Vector3(...anchorBubble.pos).multiplyScalar(scale));
                        scale = getNestedGroupWorldScale(group, parentRadius);
                    }
                }
                return {
                    groupId,
                    parentGroupId: group.parentId || null,
                    anchorBubbleId: anchorBubble ? anchorBubble.id : null,
                    worldPosition: offset.clone(),
                    worldScale: scale,
                    depth: index
                };
            });
        }

        function buildCurrentGroupBubbles(group, center, worldScale) {
            const rendered = [];
            labelsContainer.replaceChildren();
            arrangeBubblePositions(group);
            const validBubbles = group.bubbles.filter(isRenderableBubbleData);
            ensureDistinctBubbleColors(validBubbles);
            const isLowestLayer = group.level === 'leaf'
                || (Boolean(group.parentId) && !validBubbles.some(bubble => bubble.childId && activeDB[bubble.childId]));

            validBubbles.forEach(bubbleData => {
                const local = Array.isArray(bubbleData.pos) ? bubbleData.pos : [0, 0, 0];
                const position = center.clone().add(new THREE.Vector3(...local).multiplyScalar(worldScale));
                const isFocus = isFocusPathBubble(group, bubbleData);
                const bubbleLevel = isLowestLayer ? 'leaf' : (group.level || 'central');
                const mesh = createBubbleMesh(bubbleData.size, bubbleData.color, position.toArray(), bubbleData, bubbleLevel, isFocus);
                mesh.position.copy(position);
                mesh.scale.multiplyScalar(worldScale * getTypeBubbleScale(group, bubbleData));
                mesh.userData.finalScale = mesh.scale.x;
                const seed = hashBubbleValue(bubbleData.id);
                mesh.userData.rotationVector = new THREE.Vector3(
                    ((seed % 17) - 8) * 0.000035,
                    ((Math.floor(seed / 7) % 19) - 9) * 0.000035,
                    ((Math.floor(seed / 13) % 15) - 7) * 0.000025
                );
                mesh.userData.ornamentScale = 0.82 + (seed % 37) / 100;
                mesh.userData.bubbleVariant = seed % 4;
                mesh.userData.ornamentRotation = new THREE.Euler(
                    ((Math.floor(seed / 5) % 17) - 8) * 0.055,
                    ((Math.floor(seed / 11) % 23) - 11) * 0.065,
                    ((Math.floor(seed / 19) % 15) - 7) * 0.055
                );
                const ornament = mesh.userData.networkVisual || mesh.userData.deepSeaVisual || mesh.userData.dataVisual;
                if (ornament) {
                    ornament.scale.setScalar(mesh.userData.ornamentScale);
                    ornament.rotation.copy(mesh.userData.ornamentRotation);
                }
                scene.add(mesh);

                const label = document.createElement('div');
                label.className = 'bubble-label' + (isLowestLayer ? ' is-leaf-label' : '');
                label.dataset.level = group.level || '';
                const name = document.createElement('span');
                name.className = 'bubble-label-name';
                name.textContent = isLowestLayer && window.BubbleBreakerText
                    ? window.BubbleBreakerText.formatBubbleDisplayName(bubbleData.name)
                    : bubbleData.name;
                label.appendChild(name);
                const status = document.createElement('span');
                status.className = 'bubble-generation-status';
                status.dataset.bubbleStatus = bubbleData.id;
                label.appendChild(status);
                label.title = `${bubbleData.name} — 選択して詳しく見る`;
                label.onclick = event => {
                    event.stopPropagation();
                    selectBubble(bubbleData);
                };
                labelsContainer.appendChild(label);
                rendered.push({
                    mesh,
                    label,
                    data: bubbleData,
                    level: bubbleLevel,
                    isFocus,
                    groupId: group.id,
                    groupData: group,
                    baseX: position.x,
                    baseY: position.y
                });
            });
            return rendered;
        }

        // ==========================================
        // === 4. 画面遷移ロジック (カメラワークとデータ読み込み) ===
        // ==========================================

        function disposeMaterial(material) {
            if (!material) return;
            if (Array.isArray(material)) material.forEach(disposeMaterial);
            else if (typeof material.dispose === 'function') material.dispose();
        }

        function disposeObjectTree(object) {
            if (!object) return;
            const geometries = new Set();
            const materials = new Set();
            object.traverse(child => {
                if (child.geometry) geometries.add(child.geometry);
                if (Array.isArray(child.material)) child.material.forEach(material => materials.add(material));
                else if (child.material) materials.add(child.material);
            });
            geometries.forEach(geometry => geometry.dispose());
            materials.forEach(material => {
                ['map', 'alphaMap', 'emissiveMap'].forEach(textureKey => {
                    if (material[textureKey] && typeof material[textureKey].dispose === 'function') material[textureKey].dispose();
                });
                material.dispose();
            });
        }

        function disposeBubble(bubble) {
            if (!bubble) return;
            scene.remove(bubble.mesh);
            if (bubble.mesh.userData && bubble.mesh.userData.childPreview) {
                disposeObjectTree(bubble.mesh.userData.childPreview);
                bubble.mesh.remove(bubble.mesh.userData.childPreview);
                bubble.mesh.userData.childPreview = null;
            }
            ['networkVisual', 'deepSeaVisual', 'dataVisual', 'analysisProbe'].forEach(key => {
                if (!bubble.mesh.userData || !bubble.mesh.userData[key]) return;
                disposeObjectTree(bubble.mesh.userData[key]);
                bubble.mesh.remove(bubble.mesh.userData[key]);
                bubble.mesh.userData[key] = null;
            });
            if (bubble.mesh.geometry && typeof bubble.mesh.geometry.dispose === 'function') bubble.mesh.geometry.dispose();
            disposeMaterial(bubble.mesh.material);
            if (bubble.label) bubble.label.remove();
        }

        function isFocusPathBubble(group, bubble) {
            if (!focusEntryGroupId) return false;
            if (group.id === focusEntryGroupId) return bubble.id === focusEntryBubbleId;
            let targetGroupId = focusEntryGroupId;
            while (activeDB[targetGroupId] && activeDB[targetGroupId].parentId !== group.id) {
                targetGroupId = activeDB[targetGroupId].parentId;
            }
            return Boolean(activeDB[targetGroupId] && activeDB[targetGroupId].parentId === group.id && bubble.childId === targetGroupId);
        }
        function selectBubble(bubbleData) {
            const selected = currentBubbles.find(bubble => bubble.data.id === bubbleData.id);
            const selectedGroup = selected && selected.groupData || state.groupData;
            if (selectedGroup && selectedGroup.id !== state.groupId) {
                state.groupId = selectedGroup.id;
                state.groupData = selectedGroup;
                const path = getGroupHierarchyPath(selectedGroup.id).map(group => group.id);
                if (path.length) navigationStack = buildNavigationEntries(path);
                const entry = navigationStack.find(item => item.groupId === selectedGroup.id);
                if (entry) {
                    groupWorldOffset.copy(entry.worldPosition);
                    groupWorldScale = entry.worldScale;
                }
            }
            if (typeof requestBubbleAnalysis === 'function' && state.groupData) {
                void requestBubbleAnalysis(bubbleData, state.groupData);
            }
            window.loadSingle(bubbleData);
        }

        window.interruptSceneMotion = function() {
            if (transitionState) {
                const active = new Set(currentBubbles.map(bubble => bubble.mesh));
                transitionState.outgoing.forEach(bubble => { if (!active.has(bubble.mesh)) disposeBubble(bubble); });
                if (transitionState.shell) {
                    scene.remove(transitionState.shell);
                    disposeObjectTree(transitionState.shell);
                }
                transitionState = null;
                currentBubbles.forEach(bubble => {
                    bubble.mesh.visible = true;
                    bubble.mesh.material.opacity = 0.95;
                });
            }
            if (groupOverviewState) groupOverviewState = null;
            if (universeRevealState) {
                if (universeRevealState.beacon) {
                    scene.remove(universeRevealState.beacon);
                    disposeObjectTree(universeRevealState.beacon);
                }
                universeRevealState = null;
            }
            isZoomingIntoGroup = false;
            controls.enabled = true;
            applyExplorationViewControls();
            controls.update();
            return true;
        };

        window.getBubbleNavigationPath = function() {
            if (activeDB && state.groupId && activeDB[state.groupId]) {
                return getRestorableGroupPath(state.groupId).map(group => group.id);
            }
            return navigationStack.map(entry => entry.groupId).filter(groupId => activeDB && activeDB[groupId]);
        };

        window.restoreBubbleNavigationPath = function(savedPath, lastGroupId) {
            const targetGroupId = activeDB && activeDB[lastGroupId]
                ? String(lastGroupId)
                : (Array.isArray(savedPath) ? savedPath.map(String).find(groupId => activeDB && activeDB[groupId]) : null);
            const path = targetGroupId
                ? getRestorableGroupPath(targetGroupId).map(group => group.id)
                : [];
            if (path.length === 0) return [];

            navigationStack = buildNavigationEntries(path);
            const current = navigationStack[navigationStack.length - 1];
            groupWorldOffset.copy(current.worldPosition);
            groupWorldScale = current.worldScale;
            return path;
        };

        function getGroupDisplayTitle(group) {
            if (!group) return '';
            const parent = group.parentId && activeDB[group.parentId];
            const anchor = parent && parent.bubbles.find(bubble => bubble.childId === group.id);
            return String(anchor && anchor.name || group.title || group.id).trim();
        }

        function getGroupHierarchyPath(groupId) {
            const path = [];
            const visited = new Set();
            let current = activeDB && activeDB[groupId];
            while (current && !visited.has(current.id)) {
                visited.add(current.id);
                path.unshift(current);
                current = current.parentId ? activeDB[current.parentId] : null;
            }
            return path;
        }

        function getRestorableGroupPath(groupId) {
            const path = [];
            const visited = new Set();
            let current = activeDB && activeDB[groupId];
            while (current && !visited.has(current.id)) {
                visited.add(current.id);
                path.unshift(current);
                const declaredParent = current.parentId && activeDB[current.parentId];
                const declaredAnchor = declaredParent && declaredParent.bubbles && declaredParent.bubbles.some(bubble => String(bubble.childId || '') === String(current.id));
                const linkedParent = declaredAnchor
                    ? declaredParent
                    : Object.values(activeDB || {}).find(group => Array.isArray(group.bubbles)
                        && group.bubbles.some(bubble => String(bubble.childId || '') === String(current.id)));
                current = linkedParent || null;
            }
            return path;
        }

        function renderGroupBreadcrumb(groupId, containerId = 'group-breadcrumb', currentBubble = null) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.replaceChildren();
            const path = getGroupHierarchyPath(groupId);
            path.forEach((group, index) => {
                if (index) {
                    const separator = document.createElement('span');
                    separator.className = 'group-breadcrumb-separator';
                    separator.textContent = '→';
                    container.appendChild(separator);
                }
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = getGroupDisplayTitle(group);
                button.title = button.textContent;
                if (group.id === groupId) {
                    button.setAttribute('aria-current', 'page');
                    button.disabled = true;
                } else {
                    button.addEventListener('click', () => window.navigateToBreadcrumbGroup(group.id));
                }
                container.appendChild(button);
            });
            if (currentBubble) {
                const separator = document.createElement('span');
                separator.className = 'group-breadcrumb-separator';
                separator.textContent = '→';
                container.appendChild(separator);
                const current = document.createElement('button');
                current.type = 'button';
                current.textContent = currentBubble.name;
                current.title = currentBubble.name;
                current.disabled = true;
                current.setAttribute('aria-current', 'page');
                container.appendChild(current);
                const childId = currentBubble.childId && String(currentBubble.childId);
                const childGroup = childId && activeDB[childId];
                if (childGroup) {
                    const nextSeparator = document.createElement('span');
                    nextSeparator.className = 'group-breadcrumb-separator';
                    nextSeparator.textContent = '→';
                    container.appendChild(nextSeparator);
                    const next = document.createElement('button');
                    next.type = 'button';
                    next.className = 'is-next';
                    next.textContent = 'さらに詳しい話題を見る';
                    next.title = `${childGroup.title || currentBubble.name}を探索`;
                    next.setAttribute('aria-label', `${childGroup.title || currentBubble.name}の中を探索する`);
                    next.addEventListener('click', () => window.loadGroup(childId));
                    container.appendChild(next);
                }
            }
        }

        window.navigateToBreadcrumbGroup = function(groupId) {
            if (!activeDB || !activeDB[groupId] || groupId === state.groupId) return false;
            const entryIndex = navigationStack.findIndex(entry => entry.groupId === groupId);
            if (entryIndex >= 0) {
                const entry = navigationStack[entryIndex];
                navigationStack = navigationStack.slice(0, entryIndex + 1);
                groupWorldOffset.copy(entry.worldPosition);
                groupWorldScale = entry.worldScale;
            }
            window.loadGroup(groupId);
            return true;
        };

        function createGroupComposition(bubbles) {
            const valid = bubbles.filter(isRenderableBubbleData);
            const total = valid.reduce((sum, bubble) => sum + Math.max(0, Number(bubble.size) || 0), 0);
            if (!total) return [];
            let assigned = 0;
            return valid.map((bubble, index) => {
                const value = index === valid.length - 1
                    ? Number((100 - assigned).toFixed(2))
                    : Math.floor((Math.max(0, Number(bubble.size) || 0) / total) * 10000) / 100;
                assigned += value;
                return { bubble, value };
            });
        }

        const GROUP_CHART_SVG_NS = 'http://www.w3.org/2000/svg';

        function createGroupChartElement(tagName, attributes = {}, textContent = '') {
            const element = document.createElementNS(GROUP_CHART_SVG_NS, tagName);
            Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
            if (textContent) element.textContent = textContent;
            return element;
        }

        function distributeGroupChartLabels(items) {
            if (!items.length) return;
            const minimumY = 21;
            const maximumY = 229;
            const gap = items.length > 1 ? Math.min(45, (maximumY - minimumY) / (items.length - 1)) : 0;
            items.sort((left, right) => left.targetY - right.targetY);
            items.forEach((item, index) => {
                item.labelY = Math.max(item.targetY, index === 0 ? minimumY : items[index - 1].labelY + gap);
            });
            const overflow = items[items.length - 1].labelY - maximumY;
            if (overflow > 0) items.forEach(item => { item.labelY -= overflow; });
            for (let index = items.length - 2; index >= 0; index -= 1) {
                items[index].labelY = Math.min(items[index].labelY, items[index + 1].labelY - gap);
            }
        }

        function renderGroupComposition(bubbles, options = {}) {
            const chart = document.getElementById(options.chartId || 'group-composition-chart');
            const fallback = document.getElementById(options.fallbackId || 'group-list');
            const activeBubbleId = options.activeBubbleId ? String(options.activeBubbleId) : null;
            if (!chart || !fallback) return;
            const composition = createGroupComposition(bubbles);
            chart.replaceChildren();
            fallback.replaceChildren();
            if (!composition.length) {
                chart.setAttribute('aria-label', '表示できる構成要素はありません');
                fallback.hidden = false;
                fallback.textContent = '表示できる構成要素はありません';
                return;
            }

            fallback.hidden = true;
            chart.setAttribute('aria-label', `${state.groupData?.title || '現在のバブル群'}の構成要素と占有率`);
            chart.appendChild(createGroupChartElement('title', {}, '構成要素を選択すると対応するバブルへズームします'));
            const centerX = 196;
            const centerY = 125;
            const radius = 48;
            const outerRadius = 64;
            const circumference = 2 * Math.PI * radius;
            chart.appendChild(createGroupChartElement('circle', {
                class: 'group-composition-track', cx: centerX, cy: centerY, r: radius
            }));

            let cursor = 0;
            const labels = composition.map(({ bubble, value }) => {
                const midpoint = cursor + value / 2;
                const angle = (midpoint * 3.6 - 90) * Math.PI / 180;
                const item = {
                    bubble,
                    value,
                    cursor,
                    angle,
                    side: Math.cos(angle) >= 0 ? 'right' : 'left',
                    targetY: centerY + Math.sin(angle) * 92,
                    labelY: centerY
                };
                cursor += value;
                return item;
            });
            distributeGroupChartLabels(labels.filter(item => item.side === 'left'));
            distributeGroupChartLabels(labels.filter(item => item.side === 'right'));

            labels.forEach(item => {
                const { bubble, value } = item;
                const isFocus = isFocusPathBubble(state.groupData, bubble);
                const isCurrent = activeBubbleId === String(bubble.id);
                const slice = createGroupChartElement('circle', {
                    class: `group-composition-slice${isFocus ? ' is-focus' : ''}${isCurrent ? ' is-current' : ''}`,
                    cx: centerX,
                    cy: centerY,
                    r: radius,
                    pathLength: 100,
                    'stroke-dasharray': `${Math.max(0, value)} ${Math.max(0, 100 - value)}`,
                    'stroke-dashoffset': -item.cursor,
                    stroke: bubble.htmlColor,
                    transform: `rotate(-90 ${centerX} ${centerY})`,
                    tabindex: 0,
                    role: 'button',
                    'aria-label': `${bubble.name} ${value.toLocaleString('ja-JP')}%、このバブルへズーム`
                });
                const activate = event => {
                    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
                    event.preventDefault();
                    selectBubble(bubble);
                };
                slice.addEventListener('click', activate);
                slice.addEventListener('keydown', activate);
                chart.appendChild(slice);
                const percentageRadius = value < 8 ? (Math.round(item.cursor) % 2 ? 43 : 62) : radius;
                chart.appendChild(createGroupChartElement('text', {
                    class: 'group-composition-segment-value',
                    x: centerX + Math.cos(item.angle) * percentageRadius,
                    y: centerY + Math.sin(item.angle) * percentageRadius + 3,
                    'text-anchor': 'middle',
                    'aria-hidden': 'true',
                    style: value < 5 ? 'font-size:8px' : value < 9 ? 'font-size:9px' : ''
                }, `${value.toLocaleString('ja-JP')}%`));

                const startX = centerX + Math.cos(item.angle) * outerRadius;
                const startY = centerY + Math.sin(item.angle) * outerRadius;
                const rightSide = item.side === 'right';
                const elbowX = rightSide ? 248 : 144;
                const labelEdgeX = rightSide ? 258 : 134;
                chart.appendChild(createGroupChartElement('polyline', {
                    class: 'group-composition-leader',
                    points: `${startX.toFixed(1)},${startY.toFixed(1)} ${elbowX},${item.labelY.toFixed(1)} ${labelEdgeX},${item.labelY.toFixed(1)}`,
                    stroke: bubble.htmlColor
                }));
                chart.appendChild(createGroupChartElement('circle', {
                    class: 'group-composition-endpoint', cx: labelEdgeX, cy: item.labelY, r: 3.5, fill: bubble.htmlColor
                }));

                const labelX = rightSide ? 258 : 2;
                const displayName = window.BubbleBreakerText
                    ? window.BubbleBreakerText.formatBubbleDisplayName(bubble.name, 8)
                    : bubble.name;
                const label = createGroupChartElement('g', {
                    class: `group-composition-label-button${isFocus ? ' is-focus' : ''}${isCurrent ? ' is-current' : ''}`,
                    role: 'button',
                    tabindex: 0,
                    'aria-label': `${bubble.name}へズーム`
                });
                label.addEventListener('click', activate);
                label.addEventListener('keydown', activate);
                label.appendChild(createGroupChartElement('title', {}, bubble.name));
                label.appendChild(createGroupChartElement('rect', {
                    x: labelX,
                    y: item.labelY - 19,
                    width: 132,
                    height: 38,
                    rx: 8
                }));
                label.appendChild(createGroupChartElement('text', {
                    class: 'group-composition-label-name',
                    x: labelX + 66,
                    y: item.labelY - 3,
                    'text-anchor': 'middle'
                }, displayName));
                label.appendChild(createGroupChartElement('text', {
                    class: 'group-composition-label-value',
                    x: labelX + 66,
                    y: item.labelY + 14,
                    'text-anchor': 'middle'
                }, `${value.toLocaleString('ja-JP')}%${isCurrent ? '・現在' : isFocus ? '・入力意見' : ''}`));
                chart.appendChild(label);
            });

            chart.appendChild(createGroupChartElement('circle', {
                class: 'group-composition-center', cx: centerX, cy: centerY, r: 29
            }));
        }

        // 【バブル群画面】 を読み込んで表示する関数
        // isAfterDive: ワープ直後に遠くからズームインしてくる演出を入れるかどうかのフラグ
        window.loadGroup = function(groupId, isAfterDive = false, loadOptions = {}) {
            const data = activeDB[groupId];
            if(!data) return;
            const validBubbles = data.bubbles.filter(isRenderableBubbleData);
            if (validBubbles.length !== data.bubbles.length) {
                data.bubbles = validBubbles.length ? normalizeBubblePercentages(validBubbles) : [];
                if (typeof window.scheduleCurrentBubbleSessionSave === 'function') window.scheduleCurrentBubbleSessionSave('empty-bubble-cleanup');
            }
            if (!data.bubbles.length) {
                showToast('表示できる構成要素がないため、この階層を開けません');
                return;
            }
            arrangeBubblePositions(data);
            stopZoomSound();
            // 連続入力で遷移が重なった場合も、前のincoming/outgoingを必ず破棄する。
            // これにより見えないラベルなしバブルがシーンに残らない。
            if (transitionState) {
                const activeMeshes = new Set(currentBubbles.map(bubble => bubble.mesh));
                transitionState.outgoing.forEach(bubble => { if (!activeMeshes.has(bubble.mesh)) disposeBubble(bubble); });
                if (transitionState.shell) {
                    scene.remove(transitionState.shell);
                    disposeObjectTree(transitionState.shell);
                }
                transitionState = null;
            }
            groupZoomOutReady = false;
            groupOverviewState = null;
            groupCameraInteractionArmed = false;
            const previousGroupId = state.groupId;
            const previousScreen = state.screen;
            const previousBubbleData = state.bubbleData;
            const requestedViewDirection = loadOptions && loadOptions.viewDirection;
            const preservedViewDirection = requestedViewDirection && requestedViewDirection.isVector3
                ? getExplorationViewDirection(requestedViewDirection)
                : getExplorationViewDirection(previousScreen === 'SINGLE'
                    ? singleViewDirection.clone().normalize()
                    : camera.position.clone().sub(controls.target).normalize());
            if (!Number.isFinite(preservedViewDirection.x) || preservedViewDirection.lengthSq() < 0.01) preservedViewDirection.set(0, 0, 1);
            const previousOffset = groupWorldOffset.clone();
            const previousScale = groupWorldScale;
            let nextOffset = previousOffset.clone();
            let nextScale = previousScale;
            let transitionType = 'instant';
            if (isAfterDive) {
                const restoredPath = getRestorableGroupPath(groupId).map(group => group.id);
                navigationStack = buildNavigationEntries(restoredPath);
                if (loadOptions.preserveNavigationPath) {
                    const restoredEntry = navigationStack[navigationStack.length - 1];
                    if (restoredEntry) {
                        nextOffset.copy(restoredEntry.worldPosition);
                        nextScale = restoredEntry.worldScale;
                    }
                } else {
                    nextOffset.set(0, 0, 0);
                    nextScale = BUBBLE_GROUP_WORLD_SCALE;
                }
                transitionType = 'dive';
            } else if (previousScreen === 'SINGLE' && groupId === previousGroupId) {
                transitionType = 'reveal';
            } else if (previousScreen === 'SINGLE' && state.bubbleData && state.bubbleData.childId === groupId) {
                const parentGroup = activeDB[previousGroupId];
                const parentBubbleMesh = currentBubbles.find(bubble => bubble.data.id === state.bubbleData.id);
                if (parentBubbleMesh) nextOffset.copy(parentBubbleMesh.mesh.position);
                const parentWorldRadius = parentBubbleMesh
                    ? (parentBubbleMesh.mesh.userData.finalScale || parentBubbleMesh.mesh.scale.x)
                    : getBubbleLocalRadius(parentGroup, state.bubbleData) * previousScale;
                nextScale = getNestedGroupWorldScale(data, parentWorldRadius);
                navigationStack = buildNavigationEntries(getRestorableGroupPath(groupId).map(group => group.id));
                transitionType = 'zoomIn';
            } else if ((previousScreen === 'GROUP' || previousScreen === 'SINGLE') && previousGroupId !== groupId) {
                const previousPath = getRestorableGroupPath(previousGroupId).map(group => group.id);
                const targetPath = getRestorableGroupPath(groupId).map(group => group.id);
                const targetEntryPath = buildNavigationEntries(targetPath);
                const targetEntry = targetEntryPath[targetEntryPath.length - 1];
                navigationStack = targetEntryPath;
                if (targetEntry) {
                    nextOffset.copy(targetEntry.worldPosition);
                    nextScale = targetEntry.worldScale;
                }
                const targetIsAncestor = targetPath.length < previousPath.length
                    && targetPath.every((id, index) => previousPath[index] === id);
                const currentIsAncestor = previousPath.length < targetPath.length
                    && previousPath.every((id, index) => targetPath[index] === id);
                if (targetIsAncestor) transitionType = 'zoomOut';
                else if (currentIsAncestor) transitionType = 'zoomIn';
            }
            groupWorldOffset.copy(nextOffset);
            groupWorldScale = nextScale;
            const useThreeDTransition = explorationViewMode === '3d' && transitionType !== 'instant';
            relocateGalaxyUniverse(`category:${groupId}`);
            state.groupId = groupId;
            state.groupData = data;
            state.bubbleId = null;
            state.bubbleData = null;
            state.analysisCardType = null;
            if (typeof requestBubbleGroupAnalyses === 'function') {
                void requestBubbleGroupAnalyses(data);
            }
            // 古いバブル（3DモデルとHTMLラベル）を画面から削除
            const outgoingBubbles = currentBubbles;
            currentBubbles = [];
            currentBubbles = buildCurrentGroupBubbles(data, nextOffset, nextScale);
            if (useThreeDTransition) currentBubbles.forEach(bubble => { bubble.mesh.material.opacity = 0.02; });

            if (!useThreeDTransition) {
                outgoingBubbles.forEach(disposeBubble);
            } else {
                let shell = null;
                if (transitionType === 'zoomIn' && previousBubbleData) {
                    const parentBubble = outgoingBubbles.find(bubble => bubble.data.id === previousBubbleData.id);
                    if (parentBubble) {
                        const center = parentBubble.mesh.position.clone();
                        const radius = parentBubble.mesh.userData.finalScale || parentBubble.mesh.scale.x;
                        shell = createHierarchyTransitionShell(center, radius, parentBubble.data.color);
                    }
                } else if (transitionType === 'zoomOut') {
                    const containingBubble = currentBubbles.find(bubble => bubble.data.childId === previousGroupId);
                    if (containingBubble) {
                        const center = containingBubble.mesh.position.clone();
                        const radius = containingBubble.mesh.userData.finalScale || containingBubble.mesh.scale.x;
                        shell = createHierarchyTransitionShell(center, radius, containingBubble.data.color);
                    }
                }
                transitionState = {
                    outgoing: outgoingBubbles,
                    incoming: currentBubbles,
                    shell,
                    anchorBubbleId: previousBubbleData && previousBubbleData.id,
                    startedAt: performance.now(),
                    duration: 650,
                    type: transitionType
                };
            }

            // UIパネルの情報を更新
            const parentAnchor = data.parentId && activeDB[data.parentId]
                ? activeDB[data.parentId].bubbles.find(bubble => bubble.childId === data.id)
                : null;
            const groupDisplayTitle = parentAnchor ? parentAnchor.name : data.title;
            const groupDisplayDescription = parentAnchor && parentAnchor.desc
                ? parentAnchor.desc
                : (data.desc || `${groupDisplayTitle}に関する意見のまとまりを観測しています。`);
            document.getElementById('group-title').innerText = groupDisplayTitle;
            document.getElementById('group-desc').innerText = groupDisplayDescription;
            renderGroupBreadcrumb(groupId);
            
            // 右側のリスト（構成要素と占有率）を生成
            renderGroupComposition(data.bubbles);

            // 現在の構成要素全体が画角に収まる距離を実測し、階層の深さに依存した過剰ズームを避ける。
            const overviewTarget = getGroupOverviewTarget(preservedViewDirection);
            const groupCenter = overviewTarget ? overviewTarget.center : nextOffset;
            const desiredCameraPosition = overviewTarget
                ? overviewTarget.cameraPosition
                : nextOffset.clone().add(preservedViewDirection.clone().multiplyScalar(32));
            const viewingDistance = desiredCameraPosition.distanceTo(groupCenter);
            camera.fov = getExplorationFieldOfView();
            camera.updateProjectionMatrix();
            applyExplorationViewControls();
            if (transitionState) {
                transitionState.cameraStart = camera.position.clone();
                transitionState.controlStart = controls.target.clone();
                transitionState.cameraEnd = desiredCameraPosition.clone();
                transitionState.controlEnd = groupCenter.clone();
                if (transitionState.shell) {
                    const limitingFov = Math.min(
                        THREE.MathUtils.degToRad(camera.fov),
                        2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * Math.max(0.5, camera.aspect))
                    );
                    const shellCenter = transitionState.shell.position.clone();
                    const shellRadius = transitionState.shell.userData.baseScale || transitionState.shell.scale.x;
                    transitionState.portalCamera = shellCenter.clone().add(preservedViewDirection.clone().multiplyScalar(Math.max(0.05, shellRadius / Math.sin(limitingFov / 2) * 0.68)));
                    transitionState.portalTarget = shellCenter;
                }
            }
            if (isAfterDive && explorationViewMode === '3d') {
                // 銀河団の中心から中央カテゴリへ滑らかに接近する。
                controls.enabled = false;
                camera.position.copy(groupCenter).add(preservedViewDirection.clone().multiplyScalar(Math.max(70, viewingDistance * 2.8)));
                targetCameraPos.copy(desiredCameraPosition);
                isZoomingIntoGroup = true;
                groupEntryCameraDistance = viewingDistance;
            } else {
                controls.enabled = explorationViewMode === '3d' && !useThreeDTransition;
                if (!useThreeDTransition) camera.position.copy(desiredCameraPosition);
                targetCameraPos.copy(desiredCameraPosition);
                groupEntryCameraDistance = viewingDistance;
                if (!useThreeDTransition) stopZoomSound();
            }
            // 個別バブルから戻るときも、正面へリセットせず元の視線方向を維持する。
            controls.target.copy(groupCenter);
            targetControlTarget.copy(groupCenter);
            controls.update();
            
            // 画面UIをバブル群画面(GROUP)に切り替え
            if (typeof window.renderTwoDGroup === 'function') window.renderTwoDGroup(data, transitionType);
            switchScreen('GROUP');
            if (typeof window.scheduleCurrentBubbleSessionSave === 'function') window.scheduleCurrentBubbleSessionSave('group-navigation');
            showToast(`${groupDisplayTitle} の宇宙を観測中`);
        }

        // 【個別バブル画面】 を読み込んで表示する関数
        // 特定のバブルにカメラがグーッと寄っていく演出を行います。
        window.loadSingle = function(bubbleData) {
            const bObj = currentBubbles.find(b => b.data.id === bubbleData.id);
            if (!bObj) return;
            if (transitionState || groupOverviewState || universeRevealState) window.interruptSceneMotion();
            state.groupId = bObj.groupId;
            state.groupData = bObj.groupData;
            state.bubbleId = bubbleData.id;
            state.bubbleData = bubbleData;

            // 選択されたバブルの3Dモデルを探す
            const radius = bObj.mesh.scale.x;
            const targetPos = bObj.mesh.position.clone();
            const currentDirection = camera.position.clone().sub(controls.target);
            if (currentDirection.lengthSq() > 0.01 && Number.isFinite(currentDirection.x)) {
                singleViewDirection.copy(getExplorationViewDirection(currentDirection));
            }
            const viewDirection = getExplorationViewDirection(singleViewDirection);
            controls.enabled = false; // マウスによる視点操作を一時無効化
            // 現在の視線方向を維持したまま対象バブルへ寄る。固定の正面方向は使わない。
            targetControlTarget.copy(targetPos);
            const viewingDistance = getSingleBubbleViewingDistance(radius);
            targetCameraPos.copy(targetPos).add(viewDirection.multiplyScalar(viewingDistance));

            // UIパネルの情報を更新
            document.getElementById('single-title').innerText = bubbleData.name;
            const bubbleStatus = bubbleData.analysisStatus;
            document.getElementById('single-generation-status').textContent = bubbleStatus === 'loading' ? '探査中' : (bubbleStatus === 'ready' || bubbleStatus === 'partial' ? '探査完了' : '探査機待ち');
            document.getElementById('single-desc').innerText = bubbleData.desc || `${bubbleData.name}に関する意見や評価が集まるバブルです。`;
            document.getElementById('single-panel-title').innerText = bubbleData.name;
            document.getElementById('single-panel-desc').innerText = bubbleData.desc || `${bubbleData.name}に関する意見や評価が集まるバブルです。`;

            renderGroupBreadcrumb(state.groupId, 'single-breadcrumb', bubbleData);
            renderGroupComposition(state.groupData.bubbles, {
                chartId: 'single-composition-chart',
                fallbackId: 'single-group-list',
                activeBubbleId: bubbleData.id
            });

            if (typeof window.renderTwoDSingle === 'function') window.renderTwoDSingle(bubbleData, state.groupData);
            switchScreen('SINGLE');
            showToast(`個別バブル「${bubbleData.name}」にズームしました`);
        }

        // 【個別バブル解析画面】 を読み込んで表示する関数
        // 四隅に解析カードが広がり、対象のバブルが中央に配置される画面。
        function updateAnalysisGenerationStatus() {
            const status = document.getElementById('analysis-status');
            const detailStatus = document.getElementById('detail-status');
            const stateName = state.bubbleData && state.bubbleData.analysisStatus;
            const loading = stateName === 'loading' || stateName === 'queued';
            const failed = stateName === 'error';
            const partial = stateName === 'partial';
            const message = loading ? '4つの見方をまとめています…' : (failed ? '分析をまとめられませんでした。戻ってもう一度開くと再試行します' : (partial ? '一部の情報を確認できました。出典と合わせてご覧ください' : ''));
            [status, detailStatus].forEach(element => {
                if (!element) return;
                element.innerText = message;
                element.classList.toggle('hidden', !message);
                element.classList.toggle('text-red-200', failed);
                element.classList.toggle('text-cyan-200', !failed && !partial);
                element.classList.toggle('text-amber-200', partial);
            });
            const label = stateName === 'loading' ? '探査中' : (stateName === 'ready' || stateName === 'partial' ? '探査完了' : '探査機待ち');
            document.querySelectorAll('[data-analysis-generation-status]').forEach(node => {
                node.textContent = label;
                node.classList.toggle('is-loading', loading);
                node.closest('.analysis-card-image')?.classList.toggle('is-analysis-pending', loading || failed);
            });
            const singleStatus = document.getElementById('single-generation-status');
            if (singleStatus) singleStatus.textContent = label;
        }

        function updateAnalysisCardPreviews() {
            if (!state.bubbleData) return;
            const analysis = normalizeAnalysis(state.bubbleData.analysis);
            const researchImages = state.bubbleData.detailResearch && Array.isArray(state.bubbleData.detailResearch.images)
                ? state.bubbleData.detailResearch.images : [];
            const imageMap = new Map(researchImages.filter(image => image && image.imageId).map(image => [String(image.imageId), image]));
            const usedImages = new Set();
            const previews = [
                ['overview', 'このテーマの要点と、確認できた事実。'],
                ['history', '根拠をたどれる出来事の流れ。'],
                ['demographic', 'どんな資料や発信元が見つかったか。'],
                ['evaluation', '賛成・反対それぞれの主張と根拠。']
            ];
            previews.forEach(([panelId, fallback]) => {
                const section = analysis[panelId] || {};
                const summary = String(section.summary || section.overview || section.conclusion || fallback).trim();
                const summaryNode = document.querySelector(`[data-analysis-summary="${panelId}"]`);
                if (summaryNode) summaryNode.textContent = summary.length > 180 ? `${Array.from(summary).slice(0, 177).join('')}…` : summary;
                const imageNode = document.querySelector(`[data-analysis-thumb="${panelId}"]`);
                if (!imageNode) return;
                const wrapper = imageNode.closest('.analysis-card-image');
                const candidates = Array.from(new Set(Array.isArray(section.imageIds) ? section.imageIds.map(String) : []))
                    .map(id => imageMap.get(id)).filter(image => image && image.imageUrl && image.sourceWebsiteUrl)
                    .concat(researchImages.filter(image => image && image.imageUrl && image.sourceWebsiteUrl && Array.isArray(image.panelIds) && image.panelIds.includes(panelId)));
                const image = candidates.find(candidate => !usedImages.has(candidate.thumbnailUrl || candidate.imageUrl));
                if (!image) {
                    imageNode.hidden = true;
                    wrapper?.classList.remove('has-thumbnail');
                    return;
                }
                usedImages.add(image.thumbnailUrl || image.imageUrl);
                imageNode.hidden = false;
                imageNode.alt = '';
                imageNode.onerror = () => {
                    imageNode.hidden = true;
                    wrapper?.classList.remove('has-thumbnail');
                };
                imageNode.onload = () => wrapper?.classList.add('has-thumbnail');
                imageNode.src = image.thumbnailUrl || image.imageUrl;
            });
        }

        window.onSceneBubbleScreenChanged = screenName => {
            if (screenName === 'SINGLE') {
                camera.setViewOffset(window.innerWidth, window.innerHeight, Math.round(window.innerWidth * 0.15), 0, window.innerWidth, window.innerHeight);
            } else if (camera.view && camera.view.enabled) camera.clearViewOffset();
            camera.updateProjectionMatrix();
        };

        window.loadAnalysis = function() {
            if(state.screen !== 'SINGLE') return;
            
            const bObj = currentBubbles.find(b => b.data.id === state.bubbleData.id);
            if(!bObj) return;

            if (typeof requestBubbleAnalysis === 'function' && state.groupData && state.bubbleData.analysisStatus !== 'ready') {
                void requestBubbleAnalysis(state.bubbleData, state.groupData);
                showToast('このテーマに関する情報を調べています…');
            }

            const radius = bObj.mesh.scale.x;
            const targetPos = bObj.mesh.position.clone();
            
            // 対象バブルを小さく中央に置き、4枚の解析カードを主役にする。
            targetControlTarget.copy(targetPos); 
            const direction = getExplorationViewDirection(camera.position.clone().sub(controls.target));
            targetCameraPos.copy(targetPos).add(direction.multiplyScalar(Math.max(0.0001, radius * 12)));
            controls.enabled = false;

            // 中央のテキスト表示を更新
            document.getElementById('analysis-center-title').innerText = state.bubbleData.name;
            updateAnalysisGenerationStatus();
            updateAnalysisCardPreviews();

            switchScreen('ANALYSIS');
            showToast('知りたい見方を選んでください');
        }

        function createDetailElement(tagName, className = '', text = '') {
            const element = document.createElement(tagName);
            if (className) element.className = className;
            if (text) element.textContent = text;
            return element;
        }

        function getDetailSourceMap() {
            const researchSources = state.bubbleData && state.bubbleData.detailResearch && Array.isArray(state.bubbleData.detailResearch.sources)
                ? state.bubbleData.detailResearch.sources : [];
            const visibleSources = state.bubbleData && Array.isArray(state.bubbleData.sources) ? state.bubbleData.sources : [];
            return new Map([...researchSources, ...visibleSources].filter(source => source && source.sourceId).map(source => [String(source.sourceId), source]));
        }

        function getDetailImageMap() {
            const images = state.bubbleData && state.bubbleData.detailResearch && Array.isArray(state.bubbleData.detailResearch.images)
                ? state.bubbleData.detailResearch.images : [];
            return new Map(images.filter(image => image && image.imageId).map(image => [String(image.imageId), image]));
        }

        function appendDetailSourceLinks(container, sourceIds, sourceMap, label = '根拠') {
            const sources = Array.from(new Set(Array.isArray(sourceIds) ? sourceIds.map(String) : [])).map(id => sourceMap.get(id)).filter(Boolean);
            if (!sources.length) return;
            const block = createDetailElement('div', 'detail-source-block');
            block.appendChild(createDetailElement('div', 'detail-source-label', label));
            const links = createDetailElement('div', 'detail-source-links');
            sources.forEach(source => {
                const link = createDetailElement('a', 'detail-source-link', source.title || source.publisher || source.domain || source.url);
                link.href = source.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                links.appendChild(link);
            });
            block.appendChild(links);
            container.appendChild(block);
        }

        function createDetailImageFigure(image) {
            if (!image || !image.imageUrl || !image.sourceWebsiteUrl) return null;
            const figure = createDetailElement('figure', 'detail-image-card');
            const visual = createDetailElement('img', 'detail-image');
            visual.src = image.thumbnailUrl || image.imageUrl;
            visual.alt = image.caption || '関連画像';
            visual.loading = 'lazy';
            visual.decoding = 'async';
            visual.referrerPolicy = 'no-referrer';
            visual.addEventListener('error', () => {
                if (visual.src !== image.imageUrl && !visual.dataset.fullImageTried) {
                    visual.dataset.fullImageTried = 'true';
                    visual.src = image.imageUrl;
                    return;
                }
                figure.remove();
            });
            const caption = createDetailElement('figcaption', 'detail-image-caption');
            if (image.caption) caption.appendChild(createDetailElement('span', 'detail-image-description', image.caption));
            const sourceLink = createDetailElement('a', 'detail-image-source', `画像出典: ${image.sourceDomain || '出典ページ'}`);
            sourceLink.href = image.sourceWebsiteUrl;
            sourceLink.target = '_blank';
            sourceLink.rel = 'noopener noreferrer';
            caption.appendChild(sourceLink);
            figure.append(visual, caption);
            return figure;
        }

        function appendDetailImages(container, imageIds, imageMap) {
            const images = Array.from(new Set(Array.isArray(imageIds) ? imageIds.map(String) : [])).map(id => imageMap.get(id)).filter(Boolean);
            if (!images.length) return null;
            const gallery = createDetailElement('div', 'detail-image-gallery');
            images.forEach(image => {
                const figure = createDetailImageFigure(image);
                if (figure) gallery.appendChild(figure);
            });
            if (gallery.childElementCount) container.appendChild(gallery);
            return gallery;
        }

        function imageSearchStatusText(panelId) {
            const detailResearch = state.bubbleData && state.bubbleData.detailResearch;
            const query = detailResearch && Array.isArray(detailResearch.imageQueries)
                ? detailResearch.imageQueries.find(item => item.panelId === panelId) : null;
            if (!query) return 'このパネル用の画像検索結果は保存されていません。画像検索の利用状況を確認してください。';
            if (query.status === 'failed') {
                const details = [query.errorCode, query.errorStatus ? `HTTP ${query.errorStatus}` : null].filter(Boolean).join(' / ');
                return `関連画像を取得できませんでした。Web画像検索に失敗しました${details ? `（${details}）` : ''}。`;
            }
            if (query.status === 'no_results') return 'Web画像検索を実行しましたが、出典ページを確認できる関連画像は見つかりませんでした。';
            return '検索結果に含まれる画像を読み込めませんでした。画像URLが期限切れ、または配信元が外部表示を許可していない可能性があります。';
        }

        function appendPanelImages(container, imageIds, imageMap, panelId) {
            const requested = Array.from(new Set(Array.isArray(imageIds) ? imageIds.map(String) : []))
                .map(id => imageMap.get(id)).filter(image => image && (!Array.isArray(image.panelIds) || image.panelIds.includes(panelId)));
            const candidates = requested.length ? requested : [...imageMap.values()].filter(image => !Array.isArray(image.panelIds) || image.panelIds.includes(panelId)).slice(0, 2);
            const wrap = createDetailElement('div', 'detail-panel-image-section');
            const gallery = createDetailElement('div', 'detail-image-gallery');
            candidates.forEach(image => {
                const figure = createDetailImageFigure(image);
                if (!figure) return;
                const visual = figure.querySelector('img');
                visual?.addEventListener('error', () => {
                    window.setTimeout(() => {
                        if (!gallery.querySelector('.detail-image-card')) {
                            status.hidden = false;
                            status.textContent = imageSearchStatusText(panelId);
                        }
                    }, 0);
                });
                gallery.appendChild(figure);
            });
            const status = createDetailElement('p', 'detail-image-unavailable', imageSearchStatusText(panelId));
            status.hidden = gallery.childElementCount > 0;
            if (gallery.childElementCount) wrap.appendChild(gallery);
            wrap.appendChild(status);
            container.appendChild(wrap);
            return gallery.childElementCount > 0;
        }

        function renderOverviewDetail(container, section, sourceMap, imageMap) {
            const overview = createDetailElement('section', 'detail-overview-section');
            overview.appendChild(createDetailElement('h3', '', 'このバブルを理解する'));
            overview.appendChild(createDetailElement('p', 'detail-summary', section.summary));
            appendPanelImages(overview, section.imageIds, imageMap, 'overview');
            const research = state.bubbleData && state.bubbleData.detailResearch;
            const claims = research && Array.isArray(research.claims) ? research.claims.slice(0, 4) : [];
            if (claims.length) {
                overview.appendChild(createDetailElement('h3', '', '根拠から見える要点'));
                const points = createDetailElement('ul', 'detail-overview-points');
                const statusLabels = { supported: '複数の根拠で支持', mixed: '支持と反証が混在', uncertain: '根拠が限定的', unsupported: '裏付け未確認' };
                claims.forEach(claim => {
                    const item = createDetailElement('li', 'detail-overview-claim');
                    item.appendChild(createDetailElement('strong', 'detail-claim-status', statusLabels[claim.verification && claim.verification.status] || '検証結果'));
                    item.appendChild(createDetailElement('p', '', claim.text));
                    appendDetailSourceLinks(item, (claim.assessments || []).map(assessment => assessment.sourceId), sourceMap, '照合した情報源');
                    points.appendChild(item);
                });
                overview.appendChild(points);
                overview.appendChild(createDetailElement('p', 'detail-data-note', 'ここに表示する要点は、今回収集した情報源の主張照合結果です。真実性の保証ではありません。'));
            }
            container.appendChild(overview);
            appendDetailSourceLinks(container, section.sourceIds, sourceMap, '概要の参照ソース');
        }

        function getTimelineEventYear(event) {
            const sortKeyText = String(event && event.sortKey || '');
            const sortKeyYear = Number(sortKeyText.slice(0, 4));
            if (Number.isInteger(sortKeyYear) && sortKeyYear >= 1 && sortKeyYear <= 9999) return sortKeyYear;
            const labelMatch = String(event && event.dateLabel || '').match(/(?:^|\D)(\d{4})(?:年|\D|$)/);
            return labelMatch ? Number(labelMatch[1]) : null;
        }

        function createTimelineYearScale(events) {
            const eventYears = events.map(getTimelineEventYear).filter(Number.isFinite);
            if (!eventYears.length) return { start: 0, end: Math.max(1, events.length - 1), interval: 1, ticks: [], hasYears: false };
            const years = Array.from(new Set(eventYears)).sort((left, right) => left - right);
            if (years.length === 1) return { start: years[0] - 1, end: years[0] + 1, ticks: years, hasYears: true, positionFor: () => 0.5, breaks: [] };
            const gaps = years.slice(1).map((year, index) => year - years[index]).filter(gap => gap > 0).sort((a, b) => a - b);
            const medianGap = gaps[Math.floor(gaps.length / 2)] || 1;
            const longGapThreshold = Math.max(12, Math.min(50, medianGap * 3));
            const positions = new Map([[years[0], 0]]);
            const breaks = [];
            let compressedEnd = 0;
            years.slice(1).forEach((year, index) => {
                const previousYear = years[index];
                const actualGap = year - previousYear;
                const isLongGap = actualGap > longGapThreshold;
                const displayedGap = isLongGap ? Math.max(4, Math.min(8, medianGap * 2)) : actualGap;
                const previousPosition = compressedEnd;
                compressedEnd += displayedGap;
                positions.set(year, compressedEnd);
                if (isLongGap) breaks.push({ from: previousYear, to: year, position: (previousPosition + compressedEnd) / 2 });
            });
            const stride = Math.max(1, Math.ceil(years.length / 6));
            const ticks = years.filter((_, index) => index === 0 || index === years.length - 1 || index % stride === 0);
            const positionFor = year => {
                if (positions.has(year)) return positions.get(year);
                let rightIndex = years.findIndex(item => item > year);
                if (rightIndex <= 0) return year < years[0] ? 0 : compressedEnd;
                const leftYear = years[rightIndex - 1];
                const rightYear = years[rightIndex];
                const ratio = (year - leftYear) / Math.max(1, rightYear - leftYear);
                return positions.get(leftYear) + (positions.get(rightYear) - positions.get(leftYear)) * ratio;
            };
            return { start: 0, end: Math.max(1, compressedEnd), ticks, hasYears: true, positionFor, breaks };
        }

        function renderHistoryDetail(container, section, sourceMap, imageMap) {
            container.appendChild(createDetailElement('p', 'detail-summary', section.summary));
            if (!section.events.length) {
                container.appendChild(createDetailElement('div', 'detail-empty-state', '根拠付きの時系列イベントを確認できませんでした。'));
                appendPanelImages(container, section.imageIds, imageMap, 'history');
                appendDetailSourceLinks(container, section.sourceIds, sourceMap, '形成史の参照ソース');
                return;
            }
            const timelineShell = createDetailElement('div', 'detail-timeline-shell');
            const timeline = createDetailElement('div', 'detail-timeline');
            timeline.id = 'detail-history-timeline';
            timeline.setAttribute('aria-label', 'バブル形成の時系列');
            timeline.tabIndex = 0;
            const scale = createTimelineYearScale(section.events);
            const trackWidth = Math.max(760, section.events.length * 270, scale.ticks.length * 150, (scale.breaks || []).length * 135 + 760);
            const horizontalPadding = 54;
            const timelineCardWidth = window.matchMedia('(max-width: 700px)').matches ? 180 : 210;
            const trackHeight = window.matchMedia('(max-width: 700px)').matches ? 600 : 700;
            const track = createDetailElement('div', 'detail-timeline-track');
            track.style.width = `${trackWidth}px`;
            track.style.height = `${trackHeight}px`;
            const axis = createDetailElement('div', 'detail-timeline-axis');
            axis.style.left = `${horizontalPadding}px`;
            axis.style.right = `${horizontalPadding}px`;
            const eventPositions = section.events.map((event, index) => {
                const year = getTimelineEventYear(event);
                const ratio = scale.hasYears && Number.isFinite(year)
                    ? scale.positionFor(year) / Math.max(1, scale.end - scale.start)
                    : (index + 0.5) / Math.max(1, section.events.length);
                return { event, index, ratio: Math.max(0, Math.min(1, ratio)) };
            }).sort((left, right) => left.ratio - right.ratio || left.index - right.index);
            const laneCenters = [[], []];
            const minimumCardCenter = horizontalPadding + timelineCardWidth / 2;
            const maximumCardCenter = trackWidth - horizontalPadding - timelineCardWidth / 2;
            const cardGap = 24;
            function findOpenCardCenter(desiredCenter, lane) {
                const blockedRadius = timelineCardWidth / 2 + cardGap / 2;
                const occupied = laneCenters[lane].slice().sort((left, right) => left - right);
                const available = [];
                let start = minimumCardCenter;
                occupied.forEach(center => {
                    const end = center - blockedRadius;
                    if (end >= start) available.push({ start, end });
                    start = Math.max(start, center + blockedRadius);
                });
                if (maximumCardCenter >= start) available.push({ start, end: maximumCardCenter });
                const candidates = available.map(range => Math.max(range.start, Math.min(range.end, desiredCenter)));
                if (!candidates.length) return Math.max(minimumCardCenter, Math.min(maximumCardCenter, desiredCenter));
                return candidates.reduce((best, candidate) => Math.abs(candidate - desiredCenter) < Math.abs(best - desiredCenter) ? candidate : best);
            }
            const positionedEvents = eventPositions.map((entry, positionIndex) => {
                const lane = positionIndex % 2;
                const naturalX = horizontalPadding + entry.ratio * (trackWidth - horizontalPadding * 2);
                const cardCenter = findOpenCardCenter(naturalX, lane);
                laneCenters[lane].push(cardCenter);
                return { ...entry, lane, naturalX, cardCenter };
            });
            const connectors = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            connectors.setAttribute('class', 'detail-timeline-connectors');
            connectors.setAttribute('viewBox', `0 0 ${trackWidth} ${trackHeight}`);
            connectors.setAttribute('preserveAspectRatio', 'none');
            connectors.setAttribute('aria-hidden', 'true');
            const axisY = trackHeight / 2;
            positionedEvents.forEach(({ lane, naturalX, cardCenter }) => {
                const direction = lane === 0 ? -1 : 1;
                const turnY = axisY + direction * 18;
                const cardEdgeY = axisY + direction * 38;
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${naturalX} ${axisY} V ${turnY} H ${cardCenter} V ${cardEdgeY}`);
                path.setAttribute('class', 'detail-timeline-connector');
                connectors.appendChild(path);
                const point = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                point.setAttribute('cx', String(naturalX));
                point.setAttribute('cy', String(axisY));
                point.setAttribute('r', '5');
                point.setAttribute('class', 'detail-timeline-connector-point');
                connectors.appendChild(point);
            });
            track.appendChild(connectors);
            if (scale.hasYears) {
                scale.ticks.forEach(year => {
                    const ratio = scale.positionFor(year) / Math.max(1, scale.end - scale.start);
                    const tick = createDetailElement('div', 'detail-timeline-tick');
                    tick.style.left = `${ratio * (trackWidth - horizontalPadding * 2)}px`;
                    tick.appendChild(createDetailElement('span', 'detail-timeline-tick-mark'));
                    tick.appendChild(createDetailElement('time', 'detail-timeline-tick-label', `${year}年`));
                    axis.appendChild(tick);
                });
                (scale.breaks || []).forEach(gap => {
                    const marker = createDetailElement('span', 'detail-timeline-break', '~~~~');
                    marker.style.left = `${(gap.position / Math.max(1, scale.end - scale.start)) * (trackWidth - horizontalPadding * 2)}px`;
                    marker.title = `${gap.from}年から${gap.to}年の間に、今回確認できる根拠付きイベントがありません`;
                    marker.setAttribute('aria-label', marker.title);
                    axis.appendChild(marker);
                });
            }
            track.appendChild(axis);
            positionedEvents.forEach(({ event, lane, cardCenter }) => {
                const card = createDetailElement('article', `detail-timeline-event ${lane === 0 ? 'is-above' : 'is-below'}`);
                card.style.left = `${cardCenter}px`;
                card.appendChild(createDetailElement('time', 'detail-timeline-date', event.dateLabel));
                card.appendChild(createDetailElement('h3', 'detail-timeline-title', event.title));
                card.appendChild(createDetailElement('p', 'detail-timeline-description', event.description));
                appendDetailSourceLinks(card, event.sourceIds, sourceMap, '出来事の根拠');
                track.appendChild(card);
            });
            timeline.appendChild(track);

            const scrollbar = createDetailElement('div', 'detail-timeline-scrollbar');
            scrollbar.setAttribute('role', 'scrollbar');
            scrollbar.setAttribute('aria-label', '年表を左右にスクロール');
            scrollbar.setAttribute('aria-orientation', 'horizontal');
            scrollbar.setAttribute('aria-controls', timeline.id);
            scrollbar.tabIndex = 0;
            const scrollbarThumb = createDetailElement('div', 'detail-timeline-scrollbar-thumb');
            scrollbar.appendChild(scrollbarThumb);
            const updateTimelineScrollbar = () => {
                const visibleWidth = Math.max(1, timeline.clientWidth);
                const contentWidth = Math.max(visibleWidth, timeline.scrollWidth);
                const thumbRatio = visibleWidth / contentWidth;
                const thumbWidth = Math.max(12, thumbRatio * 100);
                const travel = Math.max(0, 100 - thumbWidth);
                const maxScroll = Math.max(0, timeline.scrollWidth - timeline.clientWidth);
                const progress = maxScroll ? timeline.scrollLeft / maxScroll : 0;
                scrollbarThumb.style.width = `${thumbWidth}%`;
                scrollbarThumb.style.left = `${travel * progress}%`;
                scrollbar.setAttribute('aria-valuemin', '0');
                scrollbar.setAttribute('aria-valuemax', String(Math.round(maxScroll)));
                scrollbar.setAttribute('aria-valuenow', String(Math.round(timeline.scrollLeft)));
            };
            let scrollbarDrag = null;
            scrollbar.addEventListener('pointerdown', event => {
                const thumbRect = scrollbarThumb.getBoundingClientRect();
                const onThumb = event.target === scrollbarThumb || scrollbarThumb.contains(event.target);
                if (onThumb) {
                    scrollbarDrag = { pointerX: event.clientX, scrollLeft: timeline.scrollLeft };
                    scrollbar.setPointerCapture(event.pointerId);
                } else {
                    const railRect = scrollbar.getBoundingClientRect();
                    const thumbWidth = thumbRect.width;
                    const travel = Math.max(1, railRect.width - thumbWidth);
                    const targetLeft = Math.max(0, Math.min(travel, event.clientX - railRect.left - thumbWidth / 2));
                    const maxScroll = Math.max(0, timeline.scrollWidth - timeline.clientWidth);
                    timeline.scrollLeft = targetLeft / travel * maxScroll;
                }
                event.preventDefault();
            });
            scrollbar.addEventListener('pointermove', event => {
                if (!scrollbarDrag) return;
                const railWidth = Math.max(1, scrollbar.clientWidth);
                const maxScroll = Math.max(0, timeline.scrollWidth - timeline.clientWidth);
                timeline.scrollLeft = scrollbarDrag.scrollLeft + (event.clientX - scrollbarDrag.pointerX) / railWidth * timeline.scrollWidth;
            });
            const finishScrollbarDrag = () => { scrollbarDrag = null; };
            scrollbar.addEventListener('pointerup', finishScrollbarDrag);
            scrollbar.addEventListener('pointercancel', finishScrollbarDrag);
            scrollbar.addEventListener('keydown', event => {
                const maxScroll = Math.max(0, timeline.scrollWidth - timeline.clientWidth);
                if (!['ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                if (event.key === 'Home') timeline.scrollLeft = 0;
                else if (event.key === 'End') timeline.scrollLeft = maxScroll;
                else timeline.scrollLeft += ['ArrowRight', 'PageDown'].includes(event.key) ? 180 : -180;
            });
            timeline.addEventListener('scroll', updateTimelineScrollbar, { passive: true });
            if (typeof ResizeObserver === 'function') {
                timelineShell.scrollbarResizeObserver = new ResizeObserver(updateTimelineScrollbar);
                timelineShell.scrollbarResizeObserver.observe(timeline);
                timelineShell.scrollbarResizeObserver.observe(track);
            }
            timelineShell.append(timeline, scrollbar);
            timeline.addEventListener('keydown', event => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                timeline.scrollLeft += event.key === 'ArrowRight' ? 160 : -160;
            });
            container.appendChild(timelineShell);
            updateTimelineScrollbar();
            appendPanelImages(container, section.imageIds, imageMap, 'history');
        }

        function createEvidenceCompositionChart(segments) {
            const colors = ['#48e5ff', '#f6c85f', '#9b8cff', '#ff7f91', '#63d69f', '#f39c5a', '#6fa8ff', '#95a3b8'];
            const usable = segments.map(segment => ({ ...segment, rawValue: Math.max(0, Number(segment.value) || 0) })).filter(segment => segment.rawValue > 0);
            const total = usable.reduce((sum, segment) => sum + segment.rawValue, 0);
            const chart = createGroupChartElement('svg', { class: 'group-composition-chart detail-evidence-composition-chart', viewBox: '0 0 360 250', role: 'img' });
            chart.setAttribute('aria-label', usable.map(segment => `${segment.label} ${Math.round(segment.rawValue / total * 100)}%`).join('、'));
            chart.appendChild(createGroupChartElement('title', {}, '今回収集した独立Evidence群の構成割合'));
            const centerX = 180; const centerY = 125; const radius = 55; const outerRadius = 73;
            chart.appendChild(createGroupChartElement('circle', { class: 'group-composition-track', cx: centerX, cy: centerY, r: radius }));
            let cursor = 0;
            const labels = usable.map((segment, index) => {
                const value = segment.rawValue / total * 100;
                const midpoint = cursor + value / 2;
                const angle = (midpoint * 3.6 - 90) * Math.PI / 180;
                const item = { segment, value, color: colors[index % colors.length], cursor, angle, side: Math.cos(angle) >= 0 ? 'right' : 'left', targetY: centerY + Math.sin(angle) * 92, labelY: centerY };
                cursor += value;
                return item;
            });
            distributeGroupChartLabels(labels.filter(item => item.side === 'left'));
            distributeGroupChartLabels(labels.filter(item => item.side === 'right'));
            labels.forEach(item => {
                chart.appendChild(createGroupChartElement('circle', {
                    class: 'group-composition-slice detail-evidence-slice', cx: centerX, cy: centerY, r: radius,
                    pathLength: 100, 'stroke-dasharray': `${item.value} ${100 - item.value}`,
                    'stroke-dashoffset': -item.cursor, stroke: item.color, transform: `rotate(-90 ${centerX} ${centerY})`
                }));
                const labelRadius = item.value < 7 ? 43 : 55;
                chart.appendChild(createGroupChartElement('text', {
                    class: 'group-composition-segment-value', x: centerX + Math.cos(item.angle) * labelRadius,
                    y: centerY + Math.sin(item.angle) * labelRadius + 3, 'text-anchor': 'middle', 'aria-hidden': 'true',
                    style: item.value < 5 ? 'font-size:7px' : item.value < 9 ? 'font-size:8px' : ''
                }, `${Math.round(item.value)}%`));
                const rightSide = item.side === 'right';
                const startX = centerX + Math.cos(item.angle) * outerRadius;
                const startY = centerY + Math.sin(item.angle) * outerRadius;
                const elbowX = rightSide ? 238 : 122;
                const labelEdgeX = rightSide ? 252 : 108;
                chart.appendChild(createGroupChartElement('polyline', {
                    class: 'group-composition-leader', points: `${startX.toFixed(1)},${startY.toFixed(1)} ${elbowX},${item.labelY.toFixed(1)} ${labelEdgeX},${item.labelY.toFixed(1)}`, stroke: item.color
                }));
                chart.appendChild(createGroupChartElement('circle', { class: 'group-composition-endpoint', cx: labelEdgeX, cy: item.labelY, r: 3.5, fill: item.color }));
                const label = createGroupChartElement('g', { class: 'group-composition-label-button detail-evidence-label', 'aria-label': `${item.segment.label} ${Math.round(item.value)}%` });
                const labelX = rightSide ? 252 : 4;
                label.appendChild(createGroupChartElement('rect', { x: labelX, y: item.labelY - 16, width: 104, height: 32, rx: 8 }));
                const name = Array.from(String(item.segment.label || '不明'));
                label.appendChild(createGroupChartElement('text', { x: labelX + 52, y: item.labelY + 4, 'text-anchor': 'middle' }, name.length > 9 ? `${name.slice(0, 8).join('')}…` : name.join('')));
                chart.appendChild(label);
            });
            chart.appendChild(createGroupChartElement('circle', { class: 'group-composition-center', cx: centerX, cy: centerY, r: 29 }));
            return chart;
        }

        function renderDemographicDetail(container, section, sourceMap, imageMap) {
            container.appendChild(createDetailElement('p', 'detail-summary', section.summary));
            const researchSources = state.bubbleData.detailResearch && Array.isArray(state.bubbleData.detailResearch.sources)
                ? state.bubbleData.detailResearch.sources : [];
            const visibleSources = Array.isArray(state.bubbleData.sources) ? state.bubbleData.sources : [];
            const sources = [...researchSources, ...visibleSources];
            const uniqueSources = new Map(sources.filter(source => source && source.url).map(source => [source.url, source]));
            const publishers = new Set(Array.from(uniqueSources.values()).map(source => String(source.domain || source.publisher || '').trim().toLowerCase()).filter(Boolean));
            const stats = createDetailElement('div', 'detail-evidence-stats');
            stats.append(
                createDetailElement('article', '', `${uniqueSources.size}件の出典`),
                createDetailElement('article', '', `${publishers.size}種類の発信元`),
                createDetailElement('article', '', `${Array.isArray(section.sourceIds) ? section.sourceIds.length : 0}件の分析根拠`)
            );
            container.appendChild(stats);
            const domainCounts = new Map();
            uniqueSources.forEach(source => {
                const domain = String(source.domain || source.publisher || '発信元不明').trim();
                domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
            });
            const sourceProfile = createDetailElement('section', 'detail-source-profile');
            sourceProfile.appendChild(createDetailElement('strong', '', '今回見つかった発信元'));
            const sourceProfileItems = createDetailElement('div', 'detail-source-profile-items');
            Array.from(domainCounts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 5).forEach(([domain, count]) => {
                sourceProfileItems.appendChild(createDetailElement('span', '', `${domain} · ${count}件`));
            });
            if (!domainCounts.size) sourceProfileItems.appendChild(createDetailElement('span', '', '情報源の分類は未取得です'));
            sourceProfile.appendChild(sourceProfileItems);
            container.appendChild(sourceProfile);
            const segments = Array.isArray(section.segments) && section.segments.length
                ? section.segments
                : (state.bubbleData.detailResearch && Array.isArray(state.bubbleData.detailResearch.sourceComposition) ? state.bubbleData.detailResearch.sourceComposition : []);
            if (segments.length) {
                const chartLayout = createDetailElement('div', 'detail-composition-layout');
                chartLayout.appendChild(createEvidenceCompositionChart(segments));
                const legend = createDetailElement('div', 'detail-pie-legend');
                const palette = ['#48e5ff', '#f6c85f', '#9b8cff', '#ff7f91', '#63d69f', '#f39c5a', '#6fa8ff', '#95a3b8'];
                const total = segments.reduce((sum, segment) => sum + Math.max(0, Number(segment.value) || 0), 0) || 1;
                segments.forEach((segment, index) => {
                    const item = createDetailElement('div', 'detail-pie-legend-item');
                    const swatch = createDetailElement('span', 'detail-pie-swatch');
                    swatch.style.backgroundColor = palette[index % palette.length];
                    const share = Math.round(Math.max(0, Number(segment.value) || 0) / total * 100);
                    item.append(swatch, createDetailElement('span', 'detail-pie-label', segment.label), createDetailElement('strong', '', `${share}%`), createDetailElement('small', '', `${segment.count}独立群`));
                    legend.appendChild(item);
                });
                chartLayout.appendChild(legend);
                container.appendChild(chartLayout);
            } else {
                container.appendChild(createDetailElement('div', 'detail-empty-state', '円グラフを作成できる情報源データがありません。'));
            }
            container.appendChild(createDetailElement('p', 'detail-data-note', 'この割合は今回収集した独立Evidence群の内訳であり、社会全体の世論や利用者属性の割合ではありません。'));
            appendPanelImages(container, section.imageIds, imageMap, 'demographic');
            appendDetailSourceLinks(container, section.sourceIds, sourceMap, '構成分析の参照ソース');
        }

        function createPerspectivePanel(title, section, tone, sourceMap, imageMap) {
            const panel = createDetailElement('section', `detail-perspective detail-perspective-${tone}`);
            panel.appendChild(createDetailElement('h3', 'detail-perspective-title', title));
            panel.appendChild(createDetailElement('p', 'detail-perspective-summary', section.summary));
            if (section.comments.length) {
                const comments = createDetailElement('div', 'detail-comments');
                section.comments.forEach(comment => {
                    const card = createDetailElement('article', 'detail-comment');
                    card.appendChild(createDetailElement('p', '', comment.text));
                    appendDetailSourceLinks(card, comment.sourceIds, sourceMap, 'この意見の根拠');
                    comments.appendChild(card);
                });
                panel.appendChild(comments);
            }
            appendDetailImages(panel, section.imageIds, imageMap);
            appendDetailSourceLinks(panel, section.sourceIds, sourceMap, `${title}の根拠`);
            return panel;
        }

        function renderEvaluationDetail(container, section, sourceMap, imageMap) {
            const transcript = createDetailElement('div', 'detail-conversation');
            transcript.setAttribute('aria-label', '賛成側と反対側の根拠に基づく主張のやり取り');
            let turns = Array.isArray(section.conversation) ? section.conversation.filter(turn => turn && turn.text) : [];
            const hasEvidenceConversation = turns.length > 0;
            if (!hasEvidenceConversation) {
                transcript.appendChild(createDetailElement('p', 'detail-conversation-note', '保存済み分析の主張を左右交互に表示しています。元データに発言への応答関係は記録されていません。'));
                turns = [];
                const opposition = section.opposition && section.opposition.comments || [];
                const support = section.support && section.support.comments || [];
                const maxTurns = Math.min(6, Math.max(opposition.length, support.length) * 2);
                for (let index = 0; index < maxTurns; index += 1) {
                    const side = index % 2 === 0 ? 'opposition' : 'support';
                    const item = (side === 'opposition' ? opposition : support)[Math.floor(index / 2)];
                    if (item) turns.push({ id: `legacy-${index}`, side, text: item.text, sourceIds: item.sourceIds || [], respondsTo: null });
                }
            }
            turns.slice(0, 6).forEach(turn => {
                const side = turn.side === 'support' ? 'support' : 'opposition';
                const turnNode = createDetailElement('article', `detail-conversation-turn is-${side}`);
                turnNode.appendChild(createDetailElement('div', 'detail-conversation-label', side === 'support' ? '賛成側の主張' : '反対側の主張'));
                const comment = createDetailElement('div', `detail-comment detail-comment-${side}`);
                comment.appendChild(createDetailElement('p', '', turn.text));
                appendDetailSourceLinks(comment, turn.sourceIds, sourceMap, 'この主張を支える情報源');
                turnNode.appendChild(comment);
                transcript.appendChild(turnNode);
            });
            if (!turns.length) transcript.appendChild(createDetailElement('div', 'detail-empty-state', '比較できる根拠付きの意見を確認できませんでした。'));
            container.appendChild(transcript);
            appendPanelImages(container, section.imageIds, imageMap, 'evaluation');
            const sourceIds = [...new Set([...(section.opposition.sourceIds || []), ...(section.support.sourceIds || []), ...turns.flatMap(turn => turn.sourceIds || [])])];
            appendDetailSourceLinks(container, sourceIds, sourceMap, '内外の論争の参照ソース');
        }

        // 【解析バブル詳細表示画面】(一番最後の詳細テキスト画面)を表示する関数
        window.showDetail = function(cardType) {
            state.analysisCardType = cardType;
            const titles = {
                'overview': 'バブルの概要と特徴',
                'history': '形成の歴史と拡大要因',
                'demographic': '構成層・情報源の分析',
                'evaluation': '内外の論争'
            };
            const normalizedAnalysis = normalizeAnalysis(state.bubbleData && state.bubbleData.analysis);
            const analysis = normalizedAnalysis[cardType] || DEFAULT_ANALYSIS[cardType];
            updateAnalysisGenerationStatus();
            // どのカードがクリックされたかに応じてタイトルを変更
            document.getElementById('detail-tag').innerText = state.groupData.title;
            document.getElementById('detail-title').innerText = titles[cardType] || '詳細解析';
            document.getElementById('detail-origin-title').innerText = state.bubbleData.name;
            const content = document.getElementById('detail-content');
            const sourcesContainer = document.getElementById('detail-sources');
            content.replaceChildren();
            sourcesContainer.replaceChildren();
            const sourceMap = getDetailSourceMap();
            const imageMap = getDetailImageMap();
            if (cardType === 'overview') renderOverviewDetail(content, analysis, sourceMap, imageMap);
            else if (cardType === 'history') renderHistoryDetail(content, analysis, sourceMap, imageMap);
            else if (cardType === 'demographic') renderDemographicDetail(content, analysis, sourceMap, imageMap);
            else if (cardType === 'evaluation') renderEvaluationDetail(content, analysis, sourceMap, imageMap);

            const limitations = state.bubbleData.detailResearch && Array.isArray(state.bubbleData.detailResearch.limitations)
                ? state.bubbleData.detailResearch.limitations : [];
            if (limitations.length) {
                sourcesContainer.appendChild(createDetailElement('div', 'detail-limitations-title', '取得・検証上の制限'));
                const list = createDetailElement('ul', 'detail-limitations-list');
                limitations.forEach(item => list.appendChild(createDetailElement('li', '', item)));
                sourcesContainer.appendChild(list);
            }

            switchScreen('DETAIL');
        }

        window.refreshAnalysisView = function(bubbleId) {
            if (!state.bubbleData || state.bubbleData.id !== bubbleId) return;
            updateAnalysisGenerationStatus();
            updateAnalysisCardPreviews();
            if (state.screen === 'DETAIL' && state.analysisCardType) showDetail(state.analysisCardType);
        };
