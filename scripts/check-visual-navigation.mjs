import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [scene, animation, events, audio, indexHtml, styles, buildScript] = await Promise.all([
    readFile(path.join(root, 'src', 'js', 'scene.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'animation.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'events.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'audio.js'), 'utf8'),
    readFile(path.join(root, 'src', 'index.html'), 'utf8'),
    readFile(path.join(root, 'src', 'styles.css'), 'utf8'),
    readFile(path.join(root, 'scripts', 'build.mjs'), 'utf8')
]);

const shapeMatch = scene.match(/const GALAXY_SHAPE_NAMES\s*=\s*\[([^\]]+)\]/);
assert.ok(shapeMatch, 'galaxy shape names should be declared');
assert.ok((shapeMatch[1].match(/'/g) || []).length >= 10, 'at least five galaxy shapes should be defined');
assert.match(scene, /const starsCount = 18000;/, 'isolated stars should remain a minority layer while reaching galaxy depth');
assert.match(scene, /function createBackgroundStarPosition\(/, 'isolated stars should use a spherical position generator');
assert.match(scene, /starsGeometry\.setAttribute\('aShape'/, 'isolated stars should mix circular and starburst shapes');
assert.match(scene, /starsGeometry\.setAttribute\('aSpike'/, 'starburst intensity should vary per star');
assert.match(scene, /controls\.enableZoom = true;/, 'OrbitControls zoom should be enabled');
assert.match(scene, /controls\.maxDistance = 52000;/, 'upper categories should have a usable zoom-out range');
assert.match(scene, /isGalaxyCenterBlackHole = true/, 'black holes should be marked as galaxy centers');
assert.match(scene, /galaxyBlackHoleTargets\.push\(\{ position: worldBlackHolePosition/, 'loading targets should come from galaxy centers');
assert.doesNotMatch(scene, /createMilkyWayBand|milkyWay|isMilkyWay/, 'the Milky Way should be removed');
assert.match(scene, /const systemCount = 1000;/, 'galaxy-shaping star systems should be dense');
assert.match(scene, /function keepGalaxyCenterClear\(/, 'galaxy centers should remain clear around black holes');
assert.match(scene, /const galaxyStructures = \[\];/, 'galaxy structures should be independently rotatable');
assert.match(scene, /function createNGC3324PhotoDome\(\)/, 'NGC 3324 should be rendered as a surrounding photo dome');
assert.match(scene, /side: THREE\.BackSide/, 'the NGC 3324 photo should surround the camera from inside');
assert.match(scene, /__NGC3324_TEXTURE__/, 'the NGC 3324 photo should use the build-time texture asset');
assert.match(scene, /function softenNGC3324Seam\(/, 'the NGC 3324 horizontal seam should be softened');
assert.match(scene, /new THREE\.SphereGeometry\(70000/, 'the photo dome should stay around the camera during zoom-out');
assert.match(scene, /gasNebulaName = 'NGC 3324'/, 'the farthest nebula should be identified as NGC 3324');
assert.doesNotMatch(scene, /GAS_NEBULA_PRESETS|addGasNebula|nebulaClouds/, 'legacy multiple nebula generation should be removed');
assert.match(scene, /const shootingStars = \[\];/, 'shooting stars should be part of the cosmic background');
assert.match(scene, /const shootingStarColors = \[/, 'shooting stars should use varied colors');
assert.match(scene, /const head = new THREE\.Sprite/, 'shooting stars should have a luminous head');
assert.match(scene, /const tail = new THREE\.Mesh/, 'shooting stars should have a shaped tail');
assert.match(scene, /const tailGlow = new THREE\.Mesh/, 'shooting stars should have a secondary glow tail');
assert.match(scene, /for \(let index = 0; index < 24; index\+\+\)/, 'shooting stars should be numerous enough');
assert.match(animation, /starMesh\.rotation\.y \+=/, 'the starfield should rotate with the background');
assert.match(animation, /cosmicBackgroundGroup\.rotation\.y \+=/, 'the distant background should continuously rotate');
assert.match(animation, /galaxyClusters\.forEach\(\(cluster, index\) =>/, 'galaxy clusters should rotate independently');
assert.match(scene, /function createSphericalBackgroundPosition\(/, 'background objects should use a full-sphere placement helper');
assert.match(scene, /const externalSystemCount = galaxyClusterCenters\.length \* GALAXIES_PER_CLUSTER;/, 'solar systems should match the galaxy count');
assert.match(scene, /Array\.from\(\{ length: externalSystemCount \}/, 'solar systems should surround the bubble groups in every direction');
assert.match(scene, /const GALAXY_CLUSTER_COUNT = 60;/, 'individual galaxies should be distributed in all directions');
assert.match(scene, /const GALAXY_CLUSTER_RADIUS = 9000;/, 'individual galaxies should occupy a broad distance shell');
assert.match(scene, /function createSeparatedGalaxyPositions\(/, 'galaxies should keep a minimum distance from one another');
assert.match(scene, /galaxyIndex \* Math\.PI \* 2 \/ GALAXIES_PER_CLUSTER/, 'galaxies in a cluster should use distinct angular slots');
assert.match(scene, /const GALAXY_COLOR_PROFILES = \[/, 'galaxies should have distinct color profiles');
assert.match(scene, /preserveGalaxyColor/, 'galaxy color profiles should survive depth updates');
assert.match(scene, /function relocateGalaxyUniverse\(/, 'galaxy positions should be regenerated between universes');
assert.match(scene, /relocateGalaxyUniverse\(`category:/, 'category transitions should relocate galaxies');
assert.match(scene, /blackHole\.userData\.eventHorizonRadius = eventHorizonRadius;/, 'black holes should expose their event horizon radius');
assert.doesNotMatch(scene, /const horizon = new THREE\.Mesh/, 'the enclosing wireframe horizon sphere should be removed');
assert.match(scene, /function updateAutomaticBubbleApproach\(\)/, 'automatic bubble proximity handling should exist');
assert.match(scene, /function updateAnalysisGenerationStatus\(\)/, 'analysis generation status should be visible');
assert.match(scene, /stateName === 'loading'/, 'loading analysis should be represented in the UI');
assert.match(scene, /function createAnalysisProbeVisual\(/, 'analysis loading should use a surface probe');
assert.match(scene, /window\.markBubbleAnalysisComplete = function/, 'analysis completion should notify the bubble scene');
assert.match(animation, /analysisProbeAnimation/, 'analysis probes should animate around bubbles');
assert.match(animation, /isCompletionPulse/, 'analysis completion should show a transient pulse');
assert.match(scene, /loadSingle\(nearest\.data\)/, 'proximity should enter the nearest bubble detail view');
assert.match(events, /markGroupCameraInteraction\(e\.deltaY < 0 \? 'zoomIn' : 'zoomOut'\)/, 'only zoom-in wheel input should arm proximity transition');
assert.doesNotMatch(scene.match(/function addSolarSystem[\s\S]*?\n        function createCosmicEnvironment/)?.[0] || '', /blackHole/i, 'solar systems must not create black holes');
assert.match(animation, /getLoadingBlackHoleTarget\(loadingAnimation\.targetIndex\)/, 'warp animation should target galaxy-center black holes');
assert.match(animation, /segmentDuration: 22000/, 'black hole approach should allow a longer exploration route');
assert.match(animation, /approachDistance: 16000/, 'black hole approach should travel through a larger universe volume');
assert.match(animation, /maxSpeed: 1400/, 'black hole approach should have a speed ceiling');
assert.match(animation, /camera\.position\.distanceTo\(blackHole\) <= eventHorizonRadius/, 'warp should transition at the event horizon surface');
assert.match(animation, /new THREE\.CatmullRomCurve3/, 'warp should follow a smooth curve');
assert.match(animation, /desiredCount = 10 \+ Math\.floor\(Math\.random\(\) \* 11\)/, 'warp should visit ten to twenty random stops');
assert.match(animation, /routeStops/, 'warp should retain generated galaxy and stellar-system stops');
assert.match(animation, /routeAvoidsBlackHoles\(/, 'warp routes should be checked against black hole exclusion zones');
assert.match(animation, /initializeLoadingRoute\(firstTarget\)/, 'each dive should receive a multi-stop route');
assert.match(animation, /relocateGalaxyUniverse\('black-hole-universe-switch'\)/, 'black-hole universe switches should relocate galaxies');
assert.doesNotMatch(animation, /nearHole|Math\.pow\(1 - p/, 'warp should not enter the black hole or decelerate at the end');
assert.match(audio, /EDGEWORTH_BGM = 'edgeworth-kuiper-belt\.mp3'/, 'the default BGM should use a stable ASCII filename');
assert.match(audio, /storedBgmType === LEGACY_EDGEWORTH_BGM/, 'legacy BGM selections should migrate safely');
assert.match(indexHtml, /value="edgeworth-kuiper-belt\.mp3">エッジワース・カイパーベルト/, 'the BGM selector should expose the Edgeworth track');
assert.match(buildScript, /ngc-3324-nircam-clean-4000\.png/, 'the build should embed the clean NGC 3324 asset');
assert.match(indexHtml, /id="ngc3324-toggle"/, 'NGC 3324 visibility should have a UI toggle');
assert.match(events, /bubblebreaker\.ngc3324/, 'NGC 3324 visibility should persist in localStorage');
assert.match(scene, /function setNGC3324BackgroundVisible\(visible\)/, 'NGC 3324 visibility should be controlled without rebuilding the scene');
assert.match(indexHtml, /data-panel-size="small"/, 'exploration panel size controls should include small');
assert.match(indexHtml, /data-panel-size="medium"/, 'exploration panel size controls should include medium');
assert.match(indexHtml, /data-panel-size="large"/, 'exploration panel size controls should include large');
assert.match(events, /bubblebreaker\.panelSize/, 'exploration panel size should persist in localStorage');
assert.match(events, /applyExplorationPanelSize\(/, 'exploration panel size should be applied at startup and on selection');
assert.match(indexHtml, /class="[^"]*cosmic-ui/, 'the interface should expose the cosmic network theme hook');
assert.match(indexHtml, /class="[^"]*portal-panel/, 'the input screen should use the network entry panel');
assert.match(indexHtml, /class="[^"]*exploration-panel/, 'category screens should use the exploration panel theme hook');
assert.match(indexHtml, /data-bubble-visual-mode="network"/, 'network bubble visual mode should be selectable');
assert.match(indexHtml, /data-bubble-visual-mode="classic"/, 'classic bubble visual mode should be selectable');
assert.match(indexHtml, /data-bubble-visual-mode="cosmic"/, 'cosmic bubble visual mode should be selectable');
assert.match(indexHtml, /data-bubble-visual-mode="deepSea"/, 'deep sea bubble visual mode should be selectable');
assert.match(indexHtml, /data-bubble-visual-mode="data"/, 'data space bubble visual mode should be selectable');
assert.match(indexHtml, /data-bubble-visual-mode="network"[^>]*>装飾あり/, 'network mode should be labelled as decorated');
assert.match(indexHtml, /data-bubble-visual-mode="classic"[^>]*>装飾なし/, 'classic mode should be labelled as undecorated');
assert.match(indexHtml, /data-bubble-visual-mode="cosmic"[^>]*>宇宙テーマ/, 'cosmic mode should be labelled as space themed');
assert.match(indexHtml, /data-bubble-visual-mode="deepSea"[^>]*>深海/, 'deep sea mode should be labelled');
assert.match(indexHtml, /data-bubble-visual-mode="data"[^>]*>データ空間/, 'data space mode should be labelled');
assert.match(indexHtml, /id="btn-sound-toggle"/, 'sound toggle should remain available');
const cosmicControlStart = indexHtml.indexOf('id="panel-bgm"');
const cosmicControlEnd = indexHtml.indexOf('<audio id="bgm-audio"');
assert.ok(cosmicControlStart >= 0 && cosmicControlEnd > cosmicControlStart, 'Cosmic Control bounds should be present');
assert.ok(indexHtml.slice(cosmicControlStart, cosmicControlEnd).includes('id="btn-sound-toggle"'), 'sound toggle should be inside Cosmic Control');
assert.match(indexHtml, /data-collapse-panel="panel-bgm"/, 'Cosmic Control should have a collapse control');
assert.match(indexHtml, /aria-controls="panel-bgm-content"/, 'collapse control should identify its content');
assert.match(indexHtml, /id="panel-bgm-content"/, 'Cosmic Control should have a collapsible content region');
assert.doesNotMatch(indexHtml.slice(cosmicControlStart, cosmicControlEnd), /data-close-panel="panel-bgm"/, 'Cosmic Control should not close as a panel');
assert.match(indexHtml, /data-collapse-panel="panel-group"/, 'group panel should be collapsible');
assert.match(indexHtml, /data-collapse-panel="panel-single"/, 'single panel should be collapsible');
assert.match(indexHtml, /id="panel-group-content"/, 'group panel should have a collapsible content region');
assert.match(indexHtml, /id="panel-single-content"/, 'single panel should have a collapsible content region');
assert.doesNotMatch(indexHtml, /data-close-panel="panel-group"|data-close-panel="panel-single"/, 'right panels should not close');
assert.match(indexHtml, /id="btn-toggle-title"/, 'title visibility should have a control');
assert.match(indexHtml, /id="btn-toggle-ui"/, 'global UI visibility should have a control');
assert.match(indexHtml, /WASD: 空間移動/, 'keyboard movement help should be visible');
assert.match(indexHtml, /id="bubble-color-theme"/, 'bubble color themes should be independently selectable');
for (const theme of ['legacy', 'neon', 'warm', 'space', 'deepSea', 'data']) {
    assert.match(indexHtml, new RegExp(`value="${theme}"`), `bubble color theme ${theme} should be available`);
}
assert.match(indexHtml, /id="background-theme"/, 'background themes should be independently selectable');
for (const theme of ['space', 'deepSea', 'data']) {
    assert.match(indexHtml, new RegExp(`id="background-theme"[\\s\\S]*value="${theme}"`), `background theme ${theme} should be available`);
}
assert.match(events, /bubblebreaker\.bubbleVisualMode/, 'bubble visual mode should persist in localStorage');
assert.match(events, /bubbleVisualModeOptions = \['network', 'classic', 'cosmic', 'deepSea', 'data'\]/, 'all bubble visual modes should be accepted at startup');
assert.match(events, /data-collapse-panel/, 'panel collapse events should be wired');
assert.match(events, /bubblebreaker\.\$\{panelId\}\.collapsed/, 'panel collapse state should persist for every panel');
assert.match(events, /bubblebreaker\.titleVisible/, 'title visibility should persist');
assert.match(events, /bubblebreaker\.uiVisible/, 'global UI visibility should persist');
assert.match(events, /__bubbleBreakerMovementKeys/, 'WASD key state should be tracked');
assert.match(events, /bubblebreaker\.bubbleColorTheme/, 'bubble color theme should persist in localStorage');
assert.match(events, /bubblebreaker\.backgroundTheme/, 'background theme should persist in localStorage');
assert.match(scene, /function createNetworkBubbleVisual\(/, 'network bubble decorations should be generated');
assert.match(scene, /function createCosmicBubbleVisual\(/, 'cosmic bubble decorations should be generated');
assert.match(scene, /function createDeepSeaBubbleVisual\(/, 'deep sea bubble decorations should be generated');
assert.match(scene, /function createDataBubbleVisual\(/, 'data space bubble decorations should be generated');
assert.match(scene, /BUBBLE_VISUAL_MODE_NAMES = \['network', 'classic', 'cosmic', 'deepSea', 'data'\]/, 'five bubble visual modes should be supported');
assert.match(scene, /deepSeaAnimation/, 'deep sea bubble decorations should expose animation metadata');
assert.match(scene, /dataAnimation/, 'data space bubble decorations should expose animation metadata');
assert.match(scene, /function createDeepSeaBackgroundTheme\(/, 'deep sea background structures should be generated');
assert.match(scene, /function createDataBackgroundTheme\(/, 'data space background structures should be generated');
assert.match(scene, /function createThemeDomeTexture\(theme\)/, 'non-space themes should have their own dome textures');
assert.match(scene, /window\.setBackgroundTheme = function/, 'background theme should switch at runtime');
assert.match(scene, /BACKGROUND_THEME_NAMES = \['space', 'deepSea', 'data'\]/, 'three background themes should be supported');
assert.match(scene, /BUBBLE_COLOR_THEME_NAMES = \['legacy', 'neon', 'warm', 'space', 'deepSea', 'data'\]/, 'six bubble color themes should be supported');
assert.match(scene, /window\.setBubbleColorTheme = function/, 'bubble color theme should switch at runtime');
assert.match(scene, /new THREE\.TorusGeometry/, 'network bubbles should include orbit rings');
assert.match(scene, /new THREE\.Line\(/, 'network bubbles should include connection lines');
assert.match(scene, /function disposeObjectTree\(/, 'network bubble decorations should be disposed with the bubble');
assert.match(scene, /window\.setBubbleVisualMode = function/, 'bubble visual mode should switch without rebuilding the page');
assert.match(animation, /networkVisual\.rotation\.y \+=/, 'network bubble decorations should animate');
assert.match(animation, /networkAnimation\.observerRing/, 'the focus bubble should have an observer ring animation');
assert.match(scene, /const scanRing = new THREE\.Mesh/, 'network bubbles should include an analysis scan ring');
assert.match(animation, /analysisStatus === 'loading'/, 'analysis generation should activate the scan ring');
assert.match(animation, /cosmicAnimation/, 'cosmic bubble decorations should animate');
assert.match(animation, /deepSeaAnimation/, 'deep sea bubble decorations should animate');
assert.match(animation, /dataAnimation/, 'data space bubble decorations should animate');
assert.match(animation, /function updateKeyboardNavigation\(/, 'keyboard navigation should move the camera');
assert.match(animation, /__bubbleBreakerShiftDown/, 'shift should accelerate keyboard navigation');
assert.match(animation, /backgroundThemeGroups/, 'non-space background structures should animate');
assert.match(indexHtml, /id="warp-haze-toggle"/, 'warp haze should have a UI toggle');
assert.match(events, /bubblebreaker\.warpHaze/, 'warp haze preference should persist in localStorage');
assert.match(events, /warp-haze-active/, 'warp haze should be applied through a dedicated loading class');
assert.match(indexHtml, /id="screen-input" class="input-screen screen-container/, 'the input screen should not carry permanent backdrop blur');
assert.match(styles, /#screen-input\.warp-haze-active/, 'warp haze styling should be limited to the active loading state');
assert.match(styles, /\.exploration-panel\.panel-size-small[\s\S]*?height: 42vh/, 'small exploration panels should have a distinct height');
assert.match(styles, /\.exploration-panel\.panel-size-medium[\s\S]*?height: 58vh/, 'medium exploration panels should have a distinct height');
assert.match(styles, /\.exploration-panel\.panel-size-large[\s\S]*?33vw/, 'large exploration panels should occupy about one third of the viewport width');
assert.match(styles, /\.exploration-panel\.panel-size-large[\s\S]*?height: 76vh/, 'large exploration panels should be vertically expanded');
assert.match(styles, /\.exploration-panel\.panel-size-large \.panel-section/, 'large panels should change internal section layout');
assert.match(styles, /\.bubble-visual-options[\s\S]*?grid-template-columns: repeat\(3, 1fr\)/, 'three bubble visual modes should fit the control');

const [api, data] = await Promise.all([
    readFile(path.join(root, 'src', 'js', 'api.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'data.js'), 'utf8')
]);
for (const groupType of ['分散型', '一極集中型', '多極型', '双極対立型', '階層型', '連鎖型']) {
    assert.match(api, new RegExp(groupType), `API should support group type ${groupType}`);
}
assert.match(api, /function arrangeBubblePositions\(group\)/, 'group layout should be type-aware');
assert.match(api, /ordered\[0\]\.pos = \[0, 0, 0\]/, 'one-pole groups should center the largest bubble');
assert.match(scene, /arrangeBubblePositions\(data\)/, 'scene generation should use type-aware layout');
assert.match(data, /type:\s*["']双極対立型["']/, 'fixed data should exercise bipolar layout');
assert.match(data, /type:\s*["']階層型["']/, 'fixed data should exercise hierarchy layout');
assert.match(data, /type:\s*["']連鎖型["']/, 'fixed data should exercise chain layout');

console.log('Visual navigation invariants: OK');
