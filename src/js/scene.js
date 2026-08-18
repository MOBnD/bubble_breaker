        // ==========================================
        // === 3. Three.js セットアップ (3D空間の構築) ===
        // ==========================================
        const container = document.getElementById('canvas-container');
        const labelsContainer = document.getElementById('labels-container'); // バブルの名前(HTMLタグ)を置くコンテナ
        
        const scene = new THREE.Scene();
        // 宇宙空間の奥が徐々に暗くなるフォグ（霧）効果を設定
        scene.background = new THREE.Color(0x050510);
        scene.fog = new THREE.FogExp2(0x050510, 0.00045);

        // カメラ（視点）の設定
        const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 30000);
        
        // レンダラー（描画エンジン）の設定
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setClearColor(0x050510, 1);
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
        controls.maxDistance = 24000;

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

        // 星の数と位置・色を定義
        const starsGeometry = new THREE.BufferGeometry();
        // 単独星は背景全体の約2割に抑え、銀河内の恒星系・惑星・星雲を主役にする。
        const starsCount = 12000;
        const posArray = new Float32Array(starsCount * 3);
        const colorsArray = new Float32Array(starsCount * 3);
        const sizesArray = new Float32Array(starsCount);
        const STAR_SPECTRAL_PALETTE = [0x9ecbff, 0xd9e9ff, 0xffffff, 0xfff1b0, 0xffc27a, 0xff8d70];

        for(let i=0; i<starsCount * 3; i+=3) {
            // 星はカメラの全周を包む球殻に固定する。背後を向いても空白にならず、
            // 銀河・バブルと同じワールド空間を共有する。
            const radius = 500 + Math.random() * 2500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            posArray[i] = radius * Math.sin(phi) * Math.cos(theta);
            posArray[i+1] = radius * Math.cos(phi);
            posArray[i+2] = radius * Math.sin(phi) * Math.sin(theta);

            // 星のスペクトルを青白色から赤色まで広げ、恒星ごとに明度と大きさを変える。
            const color = new THREE.Color(STAR_SPECTRAL_PALETTE[Math.floor(Math.random() * STAR_SPECTRAL_PALETTE.length)]);
            color.multiplyScalar(0.58 + Math.random() * 0.52);
            colorsArray[i] = color.r;
            colorsArray[i+1] = color.g;
            colorsArray[i+2] = color.b;
            sizesArray[i / 3] = 7 + Math.pow(Math.random(), 2.2) * 26;
        }
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
        starsGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizesArray, 1));

        // 星の質感（マテリアル）の設定
        const starsMaterial = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { pixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
            vertexColors: true,
            vertexShader: `
                attribute float aSize;
                varying vec3 vColor;
                uniform float pixelRatio;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = aSize * pixelRatio * (420.0 / max(1.0, -mvPosition.z));
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                void main() {
                    vec2 centered = gl_PointCoord - vec2(0.5);
                    float glow = 1.0 - smoothstep(0.05, 0.5, dot(centered, centered));
                    gl_FragColor = vec4(vColor, glow * 0.72);
                }
            `
        });
        const starMesh = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(starMesh);

        const galaxyClusters = [];
        const galaxyStructures = [];
        const loadingBlackHoles = [];
        const galaxyBlackHoleTargets = [];
        const GALAXY_SHAPE_NAMES = ['楕円銀河', '球状銀河', '渦巻銀河', '棒渦巻銀河', 'レンズ状銀河', '不規則銀河'];
        const GALAXIES_PER_CLUSTER = 5;
        const GALAXY_CLUSTER_SPREAD = 4;
        const galaxyClusterCenters = [
            // 初期カメラの正面だけに偏らないよう、前後・上下・左右へ配置する。
            new THREE.Vector3(0, 0, -1260), new THREE.Vector3(1120, 490, -980),
            new THREE.Vector3(-1190, -560, -840), new THREE.Vector3(910, -910, -1470),
            new THREE.Vector3(-980, 945, -1085), new THREE.Vector3(1540, -110, -1750),
            new THREE.Vector3(-1540, 280, -1330), new THREE.Vector3(210, 1330, -2030),
            new THREE.Vector3(620, -720, 1180), new THREE.Vector3(-1380, 260, 920),
            new THREE.Vector3(1480, 880, 760), new THREE.Vector3(-540, -1240, 1560)
        ];

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
            // クラスター間の余白を確保し、外縁の銀河同士が接触しない距離へ広げる。
            cluster.position.copy(center).multiplyScalar(GALAXY_CLUSTER_SPREAD);
            for (let galaxyIndex = 0; galaxyIndex < GALAXIES_PER_CLUSTER; galaxyIndex++) {
                const galaxyAngle = galaxyIndex * Math.PI * 2 / GALAXIES_PER_CLUSTER + seed * 0.13;
                const galaxyOffset = new THREE.Vector3(Math.cos(galaxyAngle) * (700 + galaxyIndex * 100), Math.sin(galaxyAngle * 1.7) * (180 + seed * 22), Math.sin(galaxyAngle) * (700 + galaxyIndex * 100));
                const shape = (seed + galaxyIndex) % 6;
                const galaxyRadius = 220 + ((seed * 43 + galaxyIndex * 67) % 95);
                const tilt = 0.18 + ((seed * 0.37 + galaxyIndex * 0.71) % 1) * 1.1;
                const spin = ((seed * 1.91 + galaxyIndex * 2.37) % 1) * Math.PI * 2;
                const systemCount = 1000;
                const galaxy = new THREE.Group();
                galaxy.position.copy(galaxyOffset);
                galaxy.rotation.set(tilt, spin, tilt * 0.63);
                galaxy.userData.shape = GALAXY_SHAPE_NAMES[shape];
                galaxy.userData.galaxyRadius = galaxyRadius;

                // 銀河の恒星は必ず形状に沿って配置する。惑星を伴う恒星系は銀河外へ分離する。
                const starSystems = new THREE.InstancedMesh(
                    new THREE.SphereGeometry(2.8 + galaxyIndex * 0.18, 8, 8),
                    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, fog: false }),
                    systemCount
                );
                starSystems.userData.preserveInstanceColors = true;
                const dummy = new THREE.Object3D();
                for (let i = 0; i < systemCount; i++) {
                    const position = keepGalaxyCenterClear(getGalaxyStarPosition(shape, i, systemCount, galaxyRadius, seed, galaxyIndex), galaxyRadius, seed + i * 0.43);
                    dummy.position.copy(position);
                    dummy.scale.setScalar(0.78 + (i % 7) * 0.07);
                    dummy.updateMatrix();
                    starSystems.setMatrixAt(i, dummy.matrix);
                    const spectralHue = (0.58 + (i % 6) * 0.083 + seed * 0.017 + galaxyIndex * 0.031) % 1;
                    const spectralLightness = 0.58 + ((i * 7 + seed) % 7) * 0.055;
                    starSystems.setColorAt(i, new THREE.Color().setHSL(spectralHue, 0.78, Math.min(0.94, spectralLightness)));
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
                galaxy.add(new THREE.Points(dustGeometry, new THREE.PointsMaterial({
                    size: 3.4, color: new THREE.Color().setHSL((0.04 + seed * 0.07 + galaxyIndex * 0.12) % 1, 0.78, 0.66),
                    transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending, map: createCircleTexture(), fog: false
                })));

                const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
                    map: createGlowTexture('rgba(255,210,150,1)'), color: 0xffb36a,
                    transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false
                }));
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
                    new THREE.MeshBasicMaterial({ color: 0xff8e4a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
                );
                disk.rotation.x = Math.PI * 0.5;
                galaxy.add(disk);
                const photonRing = new THREE.Mesh(
                    new THREE.TorusGeometry(eventHorizonRadius * 1.16, Math.max(0.9, eventHorizonRadius * 0.045), 10, 96),
                    new THREE.MeshBasicMaterial({ color: 0xffc36b, transparent: true, opacity: 0.76, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
                );
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

        // --- 遠景の宇宙構造（画像素材を使わない手続き生成） ---
        // 固定シードにすることで、カテゴリを再表示しても宇宙の配置がちらつかない。
        const cosmicBackgroundGroup = new THREE.Group();
        const cosmicSystems = [];
        const shootingStars = [];
        scene.add(cosmicBackgroundGroup);

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

        function createNGC3324Background() {
            const cloud = new THREE.Group();
            // NGC 3324を他の天体より十分遠い背面へ置き、宇宙の奥行きを作る。
            cloud.position.set(0, 900, -18500);
            cloud.rotation.set(-0.18, 0.24, -0.12);
            cloud.userData.gasNebulaName = 'NGC 3324';
            cloud.userData.isFarthestBackground = true;
            const scale = 3600;
            const primaryColor = new THREE.Color().setHSL(0.98, 0.9, 0.56);
            const secondaryColor = new THREE.Color().setHSL(0.58, 0.86, 0.58);
            const warmColor = new THREE.Color().setHSL(0.07, 0.88, 0.58);
            const primaryTexture = createGlowTexture(`rgba(${Math.round(primaryColor.r * 255)},${Math.round(primaryColor.g * 255)},${Math.round(primaryColor.b * 255)},1)`);
            const secondaryTexture = createGlowTexture(`rgba(${Math.round(secondaryColor.r * 255)},${Math.round(secondaryColor.g * 255)},${Math.round(secondaryColor.b * 255)},1)`);
            const warmTexture = createGlowTexture(`rgba(${Math.round(warmColor.r * 255)},${Math.round(warmColor.g * 255)},${Math.round(warmColor.b * 255)},1)`);
            const primaryCloud = new THREE.Sprite(new THREE.SpriteMaterial({
                map: primaryTexture, color: primaryColor, transparent: true, opacity: 0.28,
                blending: THREE.AdditiveBlending, depthWrite: false, fog: false
            }));
            primaryCloud.scale.set(scale * 2.5, scale * 1.35, 1);
            cloud.add(primaryCloud);
            const secondaryCloud = new THREE.Sprite(new THREE.SpriteMaterial({
                map: secondaryTexture, color: secondaryColor, transparent: true, opacity: 0.16,
                blending: THREE.AdditiveBlending, depthWrite: false, fog: false
            }));
            secondaryCloud.scale.set(scale * 1.65, scale * 2.1, 1);
            secondaryCloud.rotation.z = 1.12;
            cloud.add(secondaryCloud);
            const warmCloud = new THREE.Sprite(new THREE.SpriteMaterial({
                map: warmTexture, color: warmColor, transparent: true, opacity: 0.18,
                blending: THREE.AdditiveBlending, depthWrite: false, fog: false
            }));
            warmCloud.scale.set(scale * 1.15, scale * 0.74, 1);
            warmCloud.rotation.z = -0.42;
            cloud.add(warmCloud);

            const geometry = new THREE.BufferGeometry();
            const count = 6200;
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            for (let index = 0; index < count; index++) {
                const filament = cosmicRandom(3324 + index * 0.71);
                const radius = Math.sqrt(filament) * scale;
                const angle = cosmicRandom(3324 + index * 4.7) * Math.PI * 2 + radius / scale * 2.4;
                positions[index * 3] = Math.cos(angle) * radius;
                positions[index * 3 + 1] = Math.sin(angle) * radius * (0.34 + cosmicRandom(3324 + index * 1.7) * 0.62);
                positions[index * 3 + 2] = (cosmicRandom(3324 + index * 2.3) - 0.5) * scale * 0.55;
                const pointColor = new THREE.Color().setHSL(
                    filament > 0.74 ? 0.07 : (filament > 0.38 ? 0.98 : 0.58),
                    0.78,
                    0.42 + cosmicRandom(3324 + index * 0.5) * 0.34
                );
                colors[index * 3] = pointColor.r;
                colors[index * 3 + 1] = pointColor.g;
                colors[index * 3 + 2] = pointColor.b;
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            cloud.add(new THREE.Points(geometry, new THREE.PointsMaterial({
                size: Math.max(3, scale * 0.022), vertexColors: true,
                transparent: true, opacity: 0.42, depthWrite: false,
                blending: THREE.AdditiveBlending, map: createCircleTexture(), fog: false
            })));
            cosmicBackgroundGroup.add(cloud);
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
            const origin = createSphericalBackgroundPosition(index, 12, 2600, 7200, 900 + index * 23 + entry.respawnCount * 41);
            const direction = new THREE.Vector3(
                cosmicRandom(index * 3.7 + entry.respawnCount * 5.1) - 0.5,
                cosmicRandom(index * 4.9 + entry.respawnCount * 6.3) - 0.5,
                cosmicRandom(index * 6.1 + entry.respawnCount * 7.7) - 0.5
            ).normalize();
            entry.streak.position.copy(origin);
            entry.streak.lookAt(origin.clone().add(direction));
            entry.velocity.copy(direction).multiplyScalar(2.2 + cosmicRandom(index + entry.respawnCount * 2.7) * 2.4);
            entry.life = 2.8 + cosmicRandom(index + entry.respawnCount * 3.9) * 3.2;
            entry.respawnCount += 1;
            entry.streak.material.opacity = 0.72;
        }

        function createShootingStars() {
            for (let index = 0; index < 14; index++) {
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(0, 0, 0),
                    new THREE.Vector3(0, 0, -150 - (index % 4) * 45)
                ]);
                const streak = new THREE.Line(geometry, new THREE.LineBasicMaterial({
                color: index % 3 === 0 ? 0xb9e6ff : (index % 3 === 1 ? 0xffd9a3 : 0xffffff),
                    transparent: true, opacity: 0.72, depthWrite: false,
                    blending: THREE.AdditiveBlending
                }));
                const entry = { streak, velocity: new THREE.Vector3(), life: 0, respawnCount: index };
                cosmicBackgroundGroup.add(streak);
                shootingStars.push(entry);
                resetShootingStar(entry, index);
            }
        }

        function createCosmicEnvironment() {
            createNGC3324Background();
            galaxyClusterCenters.forEach((center, index) => addGalaxyGlow(center.clone().multiplyScalar(GALAXY_CLUSTER_SPREAD), 180 + index * 22, (0.58 + index * 0.047) % 1));
            const externalSystemCount = galaxyClusterCenters.length * GALAXIES_PER_CLUSTER;
            Array.from({ length: externalSystemCount }, (_, index) => [
                createSphericalBackgroundPosition(index, externalSystemCount, 1450, 5200, 601 + index * 19),
                34 + (index % 5) * 4,
                601 + index * 17
            ]).forEach(([center, scale, seed]) => addSolarSystem(center, scale, seed));
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

        // バブルの3Dモデル(Mesh)を作る関数
        function createBubbleMesh(size, colorHex, position) {
            // ガラスのような質感を出すための物理ベースマテリアル設定
            const displayColor = new THREE.Color(colorHex);
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

        function disposeBubble(bubble) {
            if (!bubble) return;
            scene.remove(bubble.mesh);
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
            separateBubblePositions(data.bubbles);
            data.bubbles.forEach(bData => {
                const worldPosition = new THREE.Vector3(...bData.pos).multiplyScalar(nextScale).add(nextOffset);
                const mesh = createBubbleMesh(bData.size, bData.color, worldPosition.toArray());
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
                currentBubbles.push({ mesh, label, data: bData, baseX: mesh.position.x, baseY: mesh.position.y });
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
            if (state.screen === 'DETAIL' && state.analysisCardType) showDetail(state.analysisCardType);
        };
