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
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 140000);
        
        // レンダラー（描画エンジン）の設定
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setClearColor(0x10182d, 1);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 高解像度ディスプレイ対応
        container.appendChild(renderer.domElement);

        // OrbitControls：マウスのドラッグで視点移動するための標準プラグイン
        const controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // 視点移動に滑らかな慣性をつける
        controls.dampingFactor = 0.05;
        // ホイールは階層移動だけでなく、全カテゴリ共通のカメラズームにも使う。
        controls.enableZoom = true;
        controls.minDistance = 0.5;
        controls.maxDistance = 52000;

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
        let ngc3324Dome = null;
        const deepSeaBackgroundGroup = new THREE.Group();
        const dataBackgroundGroup = new THREE.Group();
        const backgroundThemeGroups = { deepSea: deepSeaBackgroundGroup, data: dataBackgroundGroup };
        const BACKGROUND_THEME_NAMES = ['space', 'deepSea', 'data'];
        let backgroundTheme = BACKGROUND_THEME_NAMES.includes(localStorage.getItem('bubblebreaker.backgroundTheme'))
            ? localStorage.getItem('bubblebreaker.backgroundTheme')
            : 'space';
        scene.add(cosmicBackgroundGroup);
        scene.add(deepSeaBackgroundGroup, dataBackgroundGroup);

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
            const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 64);
            gradient.addColorStop(0, innerColor);
            gradient.addColorStop(0.28, innerColor.replace('1)', '0.55)'));
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
            if (theme === 'deepSea') {
                gradient.addColorStop(0, '#02182e');
                gradient.addColorStop(0.5, '#043f5a');
                gradient.addColorStop(1, '#010817');
                context.fillStyle = gradient;
                context.fillRect(0, 0, canvas.width, canvas.height);
                for (let index = 0; index < 28; index++) {
                    const x = cosmicRandom(index * 4.3 + 20) * canvas.width;
                    const y = (0.2 + cosmicRandom(index * 7.1 + 40) * 0.72) * canvas.height;
                    const radius = 70 + cosmicRandom(index * 2.7 + 60) * 220;
                    const glow = context.createRadialGradient(x, y, 0, x, y, radius);
                    glow.addColorStop(0, 'rgba(54, 231, 218, 0.42)');
                    glow.addColorStop(0.45, 'rgba(17, 155, 180, 0.14)');
                    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    context.fillStyle = glow;
                    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
                }
            } else {
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

        function createDeepSeaBackgroundTheme() {
            const group = deepSeaBackgroundGroup;
            const positions = new Float32Array(1600 * 3);
            const colors = new Float32Array(1600 * 3);
            for (let index = 0; index < 1600; index++) {
                const position = createSphericalBackgroundPosition(index, 1600, 800, 14500, 77);
                positions[index * 3] = position.x;
                positions[index * 3 + 1] = position.y;
                positions[index * 3 + 2] = position.z;
                const color = new THREE.Color().setHSL(0.43 + cosmicRandom(index * 1.7) * 0.13, 0.82, 0.48 + cosmicRandom(index * 2.9) * 0.3);
                colors[index * 3] = color.r; colors[index * 3 + 1] = color.g; colors[index * 3 + 2] = color.b;
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            const plankton = new THREE.Points(geometry, new THREE.PointsMaterial({ size: 18, vertexColors: true, transparent: true, opacity: 0.66, depthWrite: false, blending: THREE.AdditiveBlending }));
            group.add(plankton);
            const beacons = [];
            for (let index = 0; index < 18; index++) {
                const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: createGlowTexture('rgba(64,255,226,1)'), color: 0x52f0d2, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
                beacon.position.copy(createSphericalBackgroundPosition(index, 18, 3000, 11500, 177));
                beacon.scale.setScalar(90 + (index % 5) * 22);
                group.add(beacon);
                beacons.push(beacon);
            }
            group.userData.themeAnimation = { rotationSpeed: 0.000006, plankton, beacons, phase: 0.4 };
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
            createThemeDome('deepSea', deepSeaBackgroundGroup);
            createDeepSeaBackgroundTheme();
            createDataBackgroundTheme();
        }

        function setThemeObjectsVisible(theme) {
            const isSpace = theme === 'space';
            starMesh.visible = isSpace;
            galaxyClusters.forEach(cluster => { cluster.visible = isSpace; });
            cosmicBackgroundGroup.visible = isSpace;
            deepSeaBackgroundGroup.visible = theme === 'deepSea';
            dataBackgroundGroup.visible = theme === 'data';
        }

        window.setBackgroundTheme = function(theme = 'space') {
            backgroundTheme = BACKGROUND_THEME_NAMES.includes(theme) ? theme : 'space';
            const colors = {
                space: { clear: 0x10182d, fog: 0x10182d, density: 0.0003 },
                deepSea: { clear: 0x021426, fog: 0x03283b, density: 0.00022 },
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
                    color: 0xffffff,
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
                new THREE.TextureLoader().load(textureUrl, texture => {
                    texture.encoding = THREE.sRGBEncoding;
                    dome.material.map = softenNGC3324Seam(texture);
                    dome.material.needsUpdate = true;
                }, undefined, error => console.warn('[BubbleBreaker][Cosmos] NGC 3324写真の読み込みに失敗しました', error));
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
            system.add(star);
            const planets = [];
            for (let index = 0; index < 4; index++) {
                const radius = scale * (0.65 + index * 0.38);
                const orbitCurve = new THREE.EllipseCurve(0, 0, radius, radius * (0.8 + index * 0.03), 0, Math.PI * 2, false, 0);
                const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitCurve.getPoints(48).map(point => new THREE.Vector3(point.x, 0, point.y)));
                const orbit = new THREE.LineLoop(orbitGeometry, new THREE.LineBasicMaterial({ color: 0x8da7d8, transparent: true, opacity: 0.16, depthWrite: false }));
                system.add(orbit);
                const planet = new THREE.Mesh(
                    new THREE.SphereGeometry(Math.max(1.2, scale * (0.022 + index * 0.006)), 10, 8),
                    new THREE.MeshBasicMaterial({
                        color: new THREE.Color().setHSL((0.1 + index * 0.14 + seed * 0.01) % 1, 0.72, 0.58),
                        transparent: true, opacity: 0.9, fog: false
                    })
                );
                planets.push({ mesh: planet, radius, angle: cosmicRandom(seed + index * 4) * Math.PI * 2, speed: 0.05 + index * 0.018 });
                system.add(planet);
            }
            const beltGeometry = new THREE.BufferGeometry();
            const beltCount = 360;
            const beltPositions = new Float32Array(beltCount * 3);
            for (let index = 0; index < beltCount; index++) {
                const angle = cosmicRandom(seed + index * 0.71) * Math.PI * 2;
                const radius = scale * (1.28 + cosmicRandom(seed + index * 1.41) * 0.18);
                beltPositions[index * 3] = Math.cos(angle) * radius;
                beltPositions[index * 3 + 1] = (cosmicRandom(seed + index * 1.93) - 0.5) * scale * 0.08;
                beltPositions[index * 3 + 2] = Math.sin(angle) * radius;
            }
            beltGeometry.setAttribute('position', new THREE.BufferAttribute(beltPositions, 3));
            system.add(new THREE.Points(beltGeometry, new THREE.PointsMaterial({ size: Math.max(1.2, scale * 0.018), color: 0xc9a77e, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));

            const comet = new THREE.Group();
            comet.add(new THREE.Mesh(new THREE.SphereGeometry(Math.max(2, scale * 0.04), 8, 6), new THREE.MeshBasicMaterial({ color: 0xbbe8ff, transparent: true, opacity: 0.95 })));
            const tailGeometry = new THREE.BufferGeometry();
            const tailPositions = new Float32Array(36 * 3);
            for (let index = 0; index < 36; index++) {
                tailPositions[index * 3] = -index * scale * 0.045;
                tailPositions[index * 3 + 1] = (cosmicRandom(seed + index * 2.2) - 0.5) * scale * 0.06;
                tailPositions[index * 3 + 2] = (cosmicRandom(seed + index * 3.4) - 0.5) * scale * 0.06;
            }
            tailGeometry.setAttribute('position', new THREE.BufferAttribute(tailPositions, 3));
            comet.add(new THREE.Points(tailGeometry, new THREE.PointsMaterial({ size: Math.max(1.5, scale * 0.022), color: 0x9bdcff, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending })));
            system.add(comet);
            cosmicSystems.push({ system, planets, comet, scale, phase: cosmicRandom(seed + 8) * Math.PI * 2 });
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
            entry.streak.lookAt(origin.clone().add(direction));
            entry.direction.copy(direction);
            entry.velocity.copy(direction).multiplyScalar(2.2 + cosmicRandom(index + entry.respawnCount * 2.7) * 2.4);
            entry.life = 2.8 + cosmicRandom(index + entry.respawnCount * 3.9) * 3.2;
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

        function createCosmicEnvironment() {
            createNGC3324PhotoDome();
            createAdditionalBackgroundThemes();
            galaxyClusterCenters.forEach((center, index) => addGalaxyGlow(center, 180 + index * 22, (0.58 + index * 0.047) % 1));
            const externalSystemCount = galaxyClusterCenters.length * GALAXIES_PER_CLUSTER;
            Array.from({ length: externalSystemCount }, (_, index) => {
                const nearby = index < Math.ceil(externalSystemCount * 0.22);
                return [
                    createSphericalBackgroundPosition(index, externalSystemCount, nearby ? 1200 : 3600, nearby ? 2800 : 12500, 601 + index * 19),
                    26 + (index % 7) * 3,
                    601 + index * 17
                ];
            }).forEach(([center, scale, seed]) => addSolarSystem(center, scale, seed));
            createShootingStars();
        }

        createCosmicEnvironment();

        function updateCosmicDepthVisual(depth) {
            const variant = (depth * 0.217 + 0.11) % 1;
            const hue = (0.58 + variant * 0.32) % 1;
            galaxyClusters.forEach((cluster, clusterIndex) => {
                cluster.scale.setScalar(1 + Math.min(0.65, depth * 0.08));
                cluster.rotation.set(variant * 0.18 + clusterIndex * 0.03, variant * Math.PI * 2 + clusterIndex * 0.17, variant * 0.11);
                cluster.traverse(child => {
                    if (!child.material || !child.material.color) return;
                    if (child.userData && child.userData.isGalaxyCenterBlackHole) {
                        child.material.color.set(0x010107);
                        if (child.material.opacity !== undefined) child.material.opacity = 1;
                        return;
                    }
                    if (child.userData && child.userData.preserveGalaxyColor) {
                        return;
                    }
                    if (child.userData && child.userData.preserveInstanceColors) {
                        if (child.material.opacity !== undefined) child.material.opacity = 0.84 + variant * 0.14;
                        return;
                    }
                    const lightness = child.material.wireframe ? 0.72 : 0.68;
                    child.material.color.setHSL((hue + clusterIndex * 0.041) % 1, 0.78, lightness);
                    if (child.material.opacity !== undefined) child.material.opacity = child.material.wireframe ? 0.22 + variant * 0.2 : 0.72 + variant * 0.2;
                });
            });
            cosmicBackgroundGroup.scale.setScalar(1 + Math.min(0.2, depth * 0.025));
        }

        galaxyClusterCenters.forEach((center, index) => createGalaxyCluster(center, index));
        setBackgroundTheme(backgroundTheme);

        // --- 個別のバブル（球体）を生成・管理する仕組み ---
        let currentBubbles = []; // 現在画面に表示されているバブルの配列を保存
        let targetCameraPos = new THREE.Vector3(0, 0, 25);     // カメラが移動する目標地点
        let targetControlTarget = new THREE.Vector3(0, 0, 0);  // カメラが向くべき注視点の目標地点
        let groupWorldOffset = new THREE.Vector3(0, 0, 0);
        let groupWorldScale = 1;
        let navigationStack = [];
        let transitionState = null;
        let groupOverviewState = null;
        let loadingAnimation = null;
        let pendingUniverse = null;
        let groupZoomOutReady = false;
        let groupCameraInteractionArmed = false;
        let groupEntryCameraDistance = 25;
        let singleViewDirection = new THREE.Vector3(0, 0, 1);
        let explorerSelectedBubbleId = null;
        let bubbleVisualMode = localStorage.getItem('bubblebreaker.bubbleVisualMode') === 'classic' ? 'classic' : 'network';
        const BUBBLE_COLOR_THEME_NAMES = ['legacy', 'neon', 'warm', 'space', 'deepSea', 'data'];
        let bubbleColorTheme = BUBBLE_COLOR_THEME_NAMES.includes(localStorage.getItem('bubblebreaker.bubbleColorTheme'))
            ? localStorage.getItem('bubblebreaker.bubbleColorTheme')
            : 'legacy';

        function getGroupOverviewTarget() {
            if (!currentBubbles.length) return null;
            const bounds = new THREE.Box3();
            currentBubbles.forEach(bubble => {
                if (!bubble.mesh.visible) return;
                const radius = Math.max(0.5, bubble.mesh.scale.x);
                bounds.expandByPoint(bubble.mesh.position.clone().addScalar(radius));
                bounds.expandByPoint(bubble.mesh.position.clone().addScalar(-radius));
            });
            if (bounds.isEmpty()) return null;
            const sphere = bounds.getBoundingSphere(new THREE.Sphere());
            const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
            const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * Math.max(0.1, camera.aspect));
            const requiredDistance = Math.max(
                sphere.radius / Math.max(0.08, Math.tan(verticalHalfFov)),
                sphere.radius / Math.max(0.08, Math.tan(horizontalHalfFov))
            ) * 1.28;
            const direction = camera.position.clone().sub(controls.target);
            if (direction.lengthSq() < 0.01 || !Number.isFinite(direction.x)) direction.set(0, 0, 1);
            direction.normalize();
            return {
                center: sphere.center,
                cameraPosition: sphere.center.clone().add(direction.multiplyScalar(Math.max(12, requiredDistance))),
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

        function getNearestApproachingBubble() {
            if (state.screen !== 'GROUP' || state.bubbleId || !groupCameraInteractionArmed || transitionState || groupOverviewState || isZoomingIntoGroup) return null;
            let nearest = null;
            let nearestDistance = Infinity;
            const viewDirection = controls.target.clone().sub(camera.position).normalize();
            currentBubbles.forEach(bubble => {
                if (!bubble.mesh.visible) return;
                const radius = Math.max(0.5, bubble.mesh.scale.x);
                const toBubble = bubble.mesh.position.clone().sub(camera.position);
                const distance = toBubble.length();
                if (distance <= 0.01 || viewDirection.dot(toBubble.normalize()) < 0.2) return;
                const nearEnough = distance <= radius * 1.65 + 2.5;
                const movedIntoGroup = distance <= Math.max(4, groupEntryCameraDistance * 0.86);
                if (nearEnough && movedIntoGroup && distance < nearestDistance) {
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
            loadSingle(nearest.data);
        }

        function hashBubbleValue(value) {
            let hash = 2166136261;
            for (let index = 0; index < String(value || '').length; index++) {
                hash ^= String(value || '').charCodeAt(index);
                hash = Math.imul(hash, 16777619);
            }
            return hash >>> 0;
        }

        function getBubbleThemeColor(colorHex, bubbleData = null) {
            const base = new THREE.Color(Number(colorHex) || 0x66ccff);
            if (bubbleColorTheme === 'legacy') return base;
            const hsl = {};
            base.getHSL(hsl);
            const seed = hashBubbleValue(bubbleData && bubbleData.id);
            const variation = (seed % 100) / 100;
            if (bubbleColorTheme === 'neon') {
                hsl.h = (0.46 + variation * 0.48) % 1;
                hsl.s = 0.88;
                hsl.l = 0.62 + (seed % 12) / 100;
            } else if (bubbleColorTheme === 'warm') {
                hsl.h = 0.015 + variation * 0.13;
                hsl.s = 0.86;
                hsl.l = 0.58 + (seed % 15) / 100;
            } else if (bubbleColorTheme === 'space') {
                hsl.h = (0.57 + variation * 0.27) % 1;
                hsl.s = 0.78;
                hsl.l = 0.58 + (seed % 14) / 100;
            } else if (bubbleColorTheme === 'deepSea') {
                hsl.h = 0.43 + variation * 0.13;
                hsl.s = 0.78;
                hsl.l = 0.48 + (seed % 15) / 100;
            } else if (bubbleColorTheme === 'data') {
                hsl.h = (0.48 + variation * 0.39) % 1;
                hsl.s = 0.92;
                hsl.l = 0.59 + (seed % 13) / 100;
            }
            return base.setHSL(hsl.h, hsl.s, hsl.l);
        }

        function applyBubbleMeshColor(mesh, bubbleData) {
            if (!mesh || !mesh.material) return;
            const color = getBubbleThemeColor(mesh.userData.sourceColor, bubbleData);
            mesh.material.color.copy(color);
            if (mesh.material.emissive) mesh.material.emissive.copy(color);
            const visuals = [mesh.userData.networkVisual, mesh.userData.cosmicVisual].filter(Boolean);
            visuals.forEach(visual => visual.traverse(child => {
                if (!child.material || !child.material.color) return;
                const animation = visual.userData.networkAnimation || visual.userData.cosmicAnimation;
                if (animation && (child === animation.observerRing || child === animation.scanRing)) return;
                child.material.color.copy(color);
            }));
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

        function createCosmicBubbleVisual(displayColor, bubbleData, level = 'central', isFocus = false) {
            const seed = hashBubbleValue(`${bubbleData && bubbleData.id}:cosmic`);
            const visual = new THREE.Group();
            const atmosphere = new THREE.Mesh(
                new THREE.SphereGeometry(1.11, 28, 18),
                new THREE.MeshBasicMaterial({ color: displayColor, transparent: true, opacity: isFocus ? 0.2 : 0.11, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            visual.add(atmosphere);
            const orbitMaterial = new THREE.MeshBasicMaterial({ color: displayColor, transparent: true, opacity: isFocus ? 0.78 : 0.42, depthWrite: false, blending: THREE.AdditiveBlending });
            const orbitRings = [];
            [1.22, 1.43].forEach((radius, index) => {
                const orbit = new THREE.Mesh(new THREE.TorusGeometry(radius, index === 0 ? 0.022 : 0.014, 6, 56), orbitMaterial);
                orbit.rotation.set(
                    Math.PI * (0.26 + ((seed + index * 11) % 30) / 100),
                    Math.PI * ((seed + index * 37) % 100) / 100,
                    Math.PI * ((seed + index * 17) % 100) / 100
                );
                visual.add(orbit);
                orbitRings.push(orbit);
            });
            const moonMaterial = new THREE.MeshBasicMaterial({ color: displayColor, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending });
            const moonGeometry = new THREE.SphereGeometry(isFocus ? 0.09 : 0.07, 10, 8);
            const moons = [];
            const moonCount = level === 'central' ? 3 : 2;
            for (let index = 0; index < moonCount; index++) {
                const moon = new THREE.Mesh(moonGeometry, moonMaterial);
                visual.add(moon);
                moons.push({ mesh: moon, radius: 1.28 + index * 0.13, angle: ((seed + index * 113) % 360) * Math.PI / 180, speed: 0.34 + index * 0.11, height: (index - 1) * 0.12 });
            }
            const asteroidCount = level === 'central' ? 44 : 28;
            const asteroidPositions = new Float32Array(asteroidCount * 3);
            for (let index = 0; index < asteroidCount; index++) {
                const angle = ((seed + index * 71) % 360) * Math.PI / 180;
                const radius = 1.48 + ((seed + index * 19) % 28) / 100;
                asteroidPositions[index * 3] = Math.cos(angle) * radius;
                asteroidPositions[index * 3 + 1] = (cosmicRandom(seed + index * 2.7) - 0.5) * 0.12;
                asteroidPositions[index * 3 + 2] = Math.sin(angle) * radius;
            }
            const asteroidGeometry = new THREE.BufferGeometry();
            asteroidGeometry.setAttribute('position', new THREE.BufferAttribute(asteroidPositions, 3));
            const asteroidCloud = new THREE.Points(asteroidGeometry, new THREE.PointsMaterial({ color: displayColor, size: isFocus ? 0.065 : 0.045, transparent: true, opacity: 0.58, depthWrite: false, blending: THREE.AdditiveBlending }));
            visual.add(asteroidCloud);

            const comet = new THREE.Mesh(
                new THREE.ConeGeometry(0.07, 0.62, 7, 1, true),
                new THREE.MeshBasicMaterial({ color: isFocus ? 0xffe38a : 0xd4f7ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            visual.add(comet);
            const scanRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.94, 0.018, 6, 48),
                new THREE.MeshBasicMaterial({ color: 0x9beeff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
            );
            scanRing.visible = false;
            visual.add(scanRing);
            visual.userData.cosmicAnimation = {
                phase: (seed % 1000) / 1000 * Math.PI * 2,
                orbitRings,
                moons,
                asteroidCloud,
                comet,
                scanRing
            };
            visual.userData.bubbleVisualMode = 'cosmic';
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

        function ensureCosmicBubbleVisual(mesh, bubbleData, level, isFocus = false) {
            if (!mesh || !bubbleData) return null;
            if (!mesh.userData.cosmicVisual) {
                const displayColor = mesh.material && mesh.material.color ? mesh.material.color.clone() : new THREE.Color(0x66ccff);
                mesh.userData.cosmicVisual = createCosmicBubbleVisual(displayColor, bubbleData, level, isFocus);
                mesh.add(mesh.userData.cosmicVisual);
            }
            mesh.userData.cosmicVisual.visible = bubbleVisualMode === 'cosmic';
            return mesh.userData.cosmicVisual;
        }

        function ensureBubbleVisual(mesh, bubbleData, level, isFocus = false) {
            if (!mesh || !bubbleData) return null;
            if (bubbleVisualMode === 'network') {
                const visual = ensureNetworkBubbleVisual(mesh, bubbleData, level, isFocus);
                if (mesh.userData.cosmicVisual) mesh.userData.cosmicVisual.visible = false;
                return visual;
            }
            if (bubbleVisualMode === 'cosmic') {
                const visual = ensureCosmicBubbleVisual(mesh, bubbleData, level, isFocus);
                if (mesh.userData.networkVisual) mesh.userData.networkVisual.visible = false;
                return visual;
            }
            if (mesh.userData.networkVisual) mesh.userData.networkVisual.visible = false;
            if (mesh.userData.cosmicVisual) mesh.userData.cosmicVisual.visible = false;
            return null;
        }

        window.setBubbleVisualMode = function(mode = 'network') {
            bubbleVisualMode = mode === 'classic' ? 'classic' : 'network';
            const bubbles = [...currentBubbles];
            if (transitionState) bubbles.push(...(transitionState.outgoing || []));
            bubbles.forEach(bubble => {
                if (!bubble || !bubble.mesh) return;
                ensureBubbleVisual(bubble.mesh, bubble.data, bubble.level, bubble.isFocus);
            });
            return bubbleVisualMode;
        };

        window.setBubbleColorTheme = function(theme = 'legacy') {
            bubbleColorTheme = BUBBLE_COLOR_THEME_NAMES.includes(theme) ? theme : 'legacy';
            const bubbles = [...currentBubbles];
            if (transitionState) bubbles.push(...(transitionState.outgoing || []));
            bubbles.forEach(bubble => applyBubbleMeshColor(bubble.mesh, bubble.data));
            return bubbleColorTheme;
        };

        // バブルの3Dモデル(Mesh)を作る関数
        function createBubbleMesh(size, colorHex, position, bubbleData = null, level = 'central', isFocus = false) {
            // ガラスのような質感を出すための物理ベースマテリアル設定
            const sourceColor = new THREE.Color(colorHex);
            const displayColor = getBubbleThemeColor(colorHex, bubbleData);
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
            mesh.userData.cosmicVisual = null;
            if (bubbleData && bubbleVisualMode !== 'classic') ensureBubbleVisual(mesh, bubbleData, level, isFocus);
            return mesh;
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
            ['networkVisual', 'cosmicVisual'].forEach(key => {
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
            if (typeof requestBubbleAnalysis === 'function' && state.groupData) {
                void requestBubbleAnalysis(bubbleData, state.groupData);
            }
            if (explorerMode && bubbleData.childId && activeDB[bubbleData.childId]) {
                explorerSelectedBubbleId = bubbleData.id;
                loadGroup(bubbleData.childId);
            }
            else if (!explorerMode) loadSingle(bubbleData);
        }

        function getExplorerZoomTarget() {
            if (!state.groupData || !Array.isArray(state.groupData.bubbles)) return null;
            const selected = state.groupData.bubbles.find(bubble => bubble.id === explorerSelectedBubbleId && bubble.childId && activeDB[bubble.childId]);
            if (selected) return selected;
            const focus = state.groupData.bubbles.find(bubble => isFocusPathBubble(state.groupData, bubble) && bubble.childId && activeDB[bubble.childId]);
            if (focus) return focus;
            return state.groupData.bubbles
                .filter(bubble => bubble.childId && activeDB[bubble.childId])
                .sort((a, b) => (Number(b.size) || 0) - (Number(a.size) || 0))[0] || null;
        }

        // 【バブル群画面】 を読み込んで表示する関数
        // isAfterDive: ワープ直後に遠くからズームインしてくる演出を入れるかどうかのフラグ
        window.loadGroup = function(groupId, isAfterDive = false) {
            const data = activeDB[groupId];
            if(!data) return;
            if (bgmTransition === 'change' && !isAfterDive && bgmEnabled) {
                bgmTrackIndex = (bgmTrackIndex + 1) % bgmTracks.length;
                startBackgroundMusic();
            }
            stopZoomSound();
            // 連続入力で遷移が重なった場合も、前のincoming/outgoingを必ず破棄する。
            // これにより見えないラベルなしバブルがシーンに残らない。
            if (transitionState) {
                const activeMeshes = new Set(currentBubbles.map(bubble => bubble.mesh));
                transitionState.outgoing.forEach(bubble => { if (!activeMeshes.has(bubble.mesh)) disposeBubble(bubble); });
                transitionState = null;
            }
            groupZoomOutReady = false;
            groupOverviewState = null;
            groupCameraInteractionArmed = false;
            const previousGroupId = state.groupId;
            const previousScreen = state.screen;
            const preservedViewDirection = previousScreen === 'SINGLE'
                ? singleViewDirection.clone().normalize()
                : camera.position.clone().sub(controls.target).normalize();
            if (!Number.isFinite(preservedViewDirection.x) || preservedViewDirection.lengthSq() < 0.01) preservedViewDirection.set(0, 0, 1);
            const previousOffset = groupWorldOffset.clone();
            const previousScale = groupWorldScale;
            let nextOffset = previousOffset.clone();
            let nextScale = previousScale;
            let transitionType = 'instant';
            if (isAfterDive) {
                nextOffset.set(0, 0, 0);
                nextScale = 1;
                navigationStack = [{ groupId, parentGroupId: data.parentId || null, anchorBubbleId: null, worldPosition: nextOffset.clone(), worldScale: nextScale, depth: 0 }];
                transitionType = 'dive';
            } else if (previousScreen === 'SINGLE' && groupId === previousGroupId) {
                transitionType = 'reveal';
            } else if (previousScreen === 'SINGLE' && state.bubbleData && state.bubbleData.childId === groupId) {
                const anchorPosition = new THREE.Vector3(...state.bubbleData.pos).multiplyScalar(previousScale);
                nextOffset.copy(previousOffset).add(anchorPosition);
                nextScale = Math.max(0.42, previousScale * 0.9);
                navigationStack.push({ groupId, parentGroupId: data.parentId || previousGroupId, anchorBubbleId: state.bubbleData.id, worldPosition: nextOffset.clone(), worldScale: nextScale, depth: navigationStack.length });
                transitionType = 'zoomIn';
            } else if (explorerMode && previousScreen === 'GROUP' && state.groupData) {
                const anchorBubble = state.groupData.bubbles.find(bubble => bubble.childId === groupId);
                if (anchorBubble) {
                    const anchorPosition = new THREE.Vector3(...anchorBubble.pos).multiplyScalar(previousScale);
                    nextOffset.copy(previousOffset).add(anchorPosition);
                    nextScale = Math.max(0.42, previousScale * 0.9);
                    navigationStack.push({ groupId, parentGroupId: data.parentId || previousGroupId, anchorBubbleId: anchorBubble.id, worldPosition: nextOffset.clone(), worldScale: nextScale, depth: navigationStack.length });
                    transitionType = 'zoomIn';
                }
            } else if (previousScreen === 'GROUP' && state.groupData && state.groupData.parentId === groupId) {
                const parentEntryIndex = navigationStack.findIndex(entry => entry.groupId === groupId);
                const parentEntry = parentEntryIndex >= 0 ? navigationStack[parentEntryIndex] : null;
                if (parentEntry) {
                    nextOffset.copy(parentEntry.worldPosition);
                    nextScale = parentEntry.worldScale;
                    navigationStack = navigationStack.slice(0, parentEntryIndex + 1);
                } else {
                    const parentBubble = data.bubbles.find(bubble => bubble.childId === previousGroupId);
                    if (parentBubble) nextOffset.copy(previousOffset).sub(new THREE.Vector3(...parentBubble.pos).multiplyScalar(previousScale));
                    navigationStack = [{ groupId, parentGroupId: data.parentId || null, anchorBubbleId: parentBubble ? parentBubble.id : null, worldPosition: nextOffset.clone(), worldScale: nextScale, depth: 0 }];
                }
                transitionType = 'zoomOut';
            }
            groupWorldOffset.copy(nextOffset);
            groupWorldScale = nextScale;
            updateCosmicDepthVisual(Math.max(0, navigationStack.length - 1));
            relocateGalaxyUniverse(`category:${groupId}`);
            state.groupId = groupId;
            state.groupData = data;
            state.bubbleId = null;
            state.bubbleData = null;
            state.analysisCardType = null;
            if (typeof requestBubbleGroupAnalyses === 'function') {
                void requestBubbleGroupAnalyses(data);
            }
            explorerSelectedBubbleId = null;

            // 古いバブル（3DモデルとHTMLラベル）を画面から削除
            const outgoingBubbles = currentBubbles;
            currentBubbles = [];
            labelsContainer.innerHTML = '';

            // 新しいバブル群を生成して配置
            // 固定DBとAPIデータのどちらでも、球体の半径を考慮して重なりを解消する。
            ensureDistinctBubbleColors(data.bubbles);
            arrangeBubblePositions(data);
            data.bubbles.forEach(bData => {
                const worldPosition = new THREE.Vector3(...bData.pos).multiplyScalar(nextScale).add(nextOffset);
                const isFocus = isFocusPathBubble(data, bData);
                const mesh = createBubbleMesh(bData.size, bData.color, worldPosition.toArray(), bData, data.level, isFocus);
                mesh.scale.multiplyScalar(nextScale);
                const finalRadius = mesh.scale.x;
                mesh.userData.finalScale = finalRadius;
                if (transitionType !== 'instant') {
                    mesh.scale.setScalar(finalRadius * 0.12);
                    mesh.material.opacity = 0.02;
                }
                scene.add(mesh);

                // 3Dバブルに追従させるためのHTMLラベルを作成
                const label = document.createElement('div');
                label.className = 'bubble-label';
                label.innerText = bData.name;
                // ラベルがクリックされたら、そのバブルの個別画面に飛ぶ
                label.onclick = (e) => {
                    e.stopPropagation(); // 貫通して裏のバブルもクリックされるのを防ぐ
                    selectBubble(bData);
                };
                labelsContainer.appendChild(label);

                // 生成したデータを配列に保存
                currentBubbles.push({ mesh, label, data: bData, level: data.level, isFocus, baseX: mesh.position.x, baseY: mesh.position.y });
            });

            if (transitionType === 'instant') {
                outgoingBubbles.forEach(disposeBubble);
            } else {
                transitionState = { outgoing: outgoingBubbles, incoming: currentBubbles, startedAt: performance.now(), duration: transitionType === 'dive' ? 1800 : 1350, type: transitionType };
            }

            // UIパネルの情報を更新
            const parentAnchor = data.parentId && activeDB[data.parentId]
                ? activeDB[data.parentId].bubbles.find(bubble => bubble.childId === data.id)
                : null;
            const groupDisplayTitle = parentAnchor ? parentAnchor.name : data.title;
            document.getElementById('group-title').innerText = groupDisplayTitle;
            document.getElementById('group-type').innerText = data.type;
            document.getElementById('btn-zoomout-group').style.display = data.parentId ? 'flex' : 'none';
            
            // 右側のリスト（構成要素と占有率）を生成
            const listContainer = document.getElementById('group-list');
            listContainer.innerHTML = '';
            data.bubbles.forEach(bData => {
                const item = document.createElement('div');
                const isFocus = isFocusPathBubble(data, bData);
                item.className = `flex items-center gap-3 cursor-pointer group ${isFocus ? 'rounded-lg border border-yellow-300/80 bg-yellow-300/20 px-2 py-1 shadow-[0_0_14px_rgba(253,224,71,0.45)]' : ''}`;
                item.onclick = () => selectBubble(bData);
                item.innerHTML = `
                    <div class="w-3 h-3 rounded-full shadow-[0_0_8px_${bData.htmlColor}]" style="background-color: ${bData.htmlColor};"></div>
                    <div class="flex-1 text-sm group-hover:text-white truncate">${bData.name}</div>
                    <div class="text-sm font-bold w-8 text-right">${bData.size}%</div>${isFocus ? '<span class="text-[10px] text-yellow-200">入力意見</span>' : ''}
                `;
                listContainer.appendChild(item);
            });

            // カメラ位置の設定（ダイブ後か、通常の移動かで動きを変える）
            if (isAfterDive) {
                // 銀河団の中心から中央カテゴリへ滑らかに接近する。
                controls.enabled = false;
                camera.position.copy(nextOffset).add(new THREE.Vector3(0, 0, 70 * nextScale));
                targetCameraPos.copy(nextOffset).add(new THREE.Vector3(0, 0, 25 * nextScale));
                isZoomingIntoGroup = true;
                groupEntryCameraDistance = 25 * nextScale;
            } else {
                controls.enabled = transitionType === 'instant';
                const viewingDistance = 25 * nextScale;
                if (transitionType === 'instant') camera.position.copy(nextOffset).add(preservedViewDirection.clone().multiplyScalar(viewingDistance));
                targetCameraPos.copy(nextOffset).add(preservedViewDirection.clone().multiplyScalar(viewingDistance));
                groupEntryCameraDistance = viewingDistance;
                if (transitionType === 'instant') stopZoomSound();
            }
            // 個別バブルから戻るときも、正面へリセットせず元の視線方向を維持する。
            controls.target.copy(nextOffset);
            targetControlTarget.copy(nextOffset);
            controls.update();
            
            // 画面UIをバブル群画面(GROUP)に切り替え
            switchScreen('GROUP');
            showToast(`${groupDisplayTitle} の宇宙を観測中`);
        }

        // 【個別バブル画面】 を読み込んで表示する関数
        // 特定のバブルにカメラがグーッと寄っていく演出を行います。
        window.loadSingle = function(bubbleData) {
            state.bubbleId = bubbleData.id;
            state.bubbleData = bubbleData;

            // 選択されたバブルの3Dモデルを探す
            const bObj = currentBubbles.find(b => b.data.id === bubbleData.id);
            if(!bObj) return;

            const radius = bObj.mesh.scale.x;
            const targetPos = bObj.mesh.position.clone();
            const currentDirection = camera.position.clone().sub(controls.target);
            if (currentDirection.lengthSq() > 0.01 && Number.isFinite(currentDirection.x)) {
                singleViewDirection.copy(currentDirection.normalize());
            }
            const viewDirection = singleViewDirection.clone().normalize();
            controls.enabled = false; // マウスによる視点操作を一時無効化
            // 現在の視線方向を維持したまま対象バブルへ寄る。固定の正面方向は使わない。
            targetControlTarget.copy(targetPos);
            targetCameraPos.copy(targetPos).add(viewDirection.multiplyScalar(radius * 1.5 + 2));

            // UIパネルの情報を更新
            document.getElementById('single-title').innerText = bubbleData.name;
            document.getElementById('single-desc').innerText = bubbleData.desc || "このバブルの簡易説明です。";
            document.getElementById('single-percent').innerText = bubbleData.size;
            document.getElementById('single-estimated').classList.toggle('hidden', bubbleData.isEstimated !== true);
            
            // さらにズームできる子階層がある場合はボタンを表示
            const hasChild = !!bubbleData.childId;
            document.getElementById('btn-zoomin-single').style.display = hasChild ? 'block' : 'none';
            document.getElementById('btn-zoomin-single').innerText = hasChild && activeDB[bubbleData.childId]
                ? `↑ ${activeDB[bubbleData.childId].title}へ (上スクロール)` : '';

            // 偏り度メーターのバー幅を計算（占有率sizeをもとに適当な割合を算出）
            const biasWidth = Math.min(100, Math.max(20, bubbleData.size * 1.5));
            document.getElementById('bias-meter').style.width = `${biasWidth}%`;

            switchScreen('SINGLE');
            showToast(`個別バブル「${bubbleData.name}」にズームしました`);
        }

        // 【個別バブル解析画面】 を読み込んで表示する関数
        // 四隅に解析カードが広がり、対象のバブルが中央に配置される画面。
        function updateAnalysisGenerationStatus() {
            const status = document.getElementById('analysis-status');
            const detailStatus = document.getElementById('detail-status');
            const stateName = state.bubbleData && state.bubbleData.analysisStatus;
            const loading = stateName === 'loading';
            const failed = stateName === 'error';
            const message = loading ? '分析生成中…' : (failed ? '分析生成に失敗しました。再試行できます' : '');
            [status, detailStatus].forEach(element => {
                if (!element) return;
                element.innerText = message;
                element.classList.toggle('hidden', !message);
                element.classList.toggle('text-red-200', failed);
                element.classList.toggle('text-cyan-200', !failed);
            });
        }

        window.loadAnalysis = function() {
            if(state.screen !== 'SINGLE') return;
            
            const bObj = currentBubbles.find(b => b.data.id === state.bubbleData.id);
            if(!bObj) return;

            if (typeof requestBubbleAnalysis === 'function' && state.groupData && state.bubbleData.analysisStatus !== 'ready') {
                void requestBubbleAnalysis(state.bubbleData, state.groupData);
                showToast('バブルの分析をWeb Searchで生成しています...');
            }

            const radius = bObj.mesh.scale.x;
            const targetPos = bObj.mesh.position.clone();
            
            // バブルが画面の「ど真ん中」に来るようにカメラを少し引き、真正面から見据える
            targetControlTarget.copy(targetPos); 
            targetCameraPos.copy(targetPos).add(new THREE.Vector3(0, 0, radius * 3.5));

            // 中央のテキスト表示を更新
            document.getElementById('analysis-center-title').innerText = state.bubbleData.name;
            updateAnalysisGenerationStatus();

            switchScreen('ANALYSIS');
            showToast(`解析モードへ移行しました`);
        }

        // 【解析バブル詳細表示画面】(一番最後の詳細テキスト画面)を表示する関数
        window.showDetail = function(cardType) {
            state.analysisCardType = cardType;
            const titles = {
                'overview': 'バブルの概要と特徴',
                'history': '形成の歴史と拡大要因',
                'demographic': '構成層・情報源の分析',
                'evaluation': '内と外からの評価のギャップ'
            };
            const analysis = state.bubbleData && state.bubbleData.analysis
                ? state.bubbleData.analysis[cardType] || DEFAULT_ANALYSIS[cardType]
                : DEFAULT_ANALYSIS[cardType];
            updateAnalysisGenerationStatus();
            // どのカードがクリックされたかに応じてタイトルを変更
            document.getElementById('detail-tag').innerText = state.groupData.title;
            document.getElementById('detail-title').innerText = titles[cardType] || '詳細解析';
            document.getElementById('detail-origin-title').innerText = state.bubbleData.name;
            document.getElementById('detail-description').innerText = analysis.summary;
            document.getElementById('detail-insight').innerText = analysis.insight;

            const metrics = Array.isArray(analysis.metrics) ? analysis.metrics : [];
            const metricText = metrics.length
                ? metrics.map(metric => `${metric.label}: ${Number(metric.value).toLocaleString('ja-JP')}`).join('\n')
                : '検索ソースから利用可能なグラフデータがありません';
            document.getElementById('detail-chart-a').innerText = `検索データ\n${metricText}`;
            document.getElementById('detail-chart-b').innerText = analysis.isEstimated ? '推定値（Web Search由来）' : '参照ソースに基づく値';

            const sourcesContainer = document.getElementById('detail-sources');
            sourcesContainer.innerHTML = '';
            const sources = state.bubbleData.sources || [];
            if (sources.length === 0) {
                sourcesContainer.innerText = '参照ソースはありません。';
            } else {
                const heading = document.createElement('div');
                heading.innerText = '参照ソース';
                sourcesContainer.appendChild(heading);
                sources.forEach(source => {
                    const link = document.createElement('a');
                    link.href = source.url;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.className = 'block text-blue-300 hover:text-blue-200 truncate';
                    link.innerText = source.title;
                    sourcesContainer.appendChild(link);
                });
            }

            switchScreen('DETAIL');
        }

        window.refreshAnalysisView = function(bubbleId) {
            if (!state.bubbleData || state.bubbleData.id !== bubbleId) return;
            updateAnalysisGenerationStatus();
            if (state.screen === 'DETAIL' && state.analysisCardType) showDetail(state.analysisCardType);
        };
