import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [scene, animation, events, audio, indexHtml, buildScript] = await Promise.all([
    readFile(path.join(root, 'src', 'js', 'scene.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'animation.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'events.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'audio.js'), 'utf8'),
    readFile(path.join(root, 'src', 'index.html'), 'utf8'),
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
assert.doesNotMatch(scene, /const horizon = new THREE\.Mesh|wireframe: true/, 'the enclosing wireframe horizon sphere should be removed');
assert.match(scene, /function updateAutomaticBubbleApproach\(\)/, 'automatic bubble proximity handling should exist');
assert.match(scene, /function updateAnalysisGenerationStatus\(\)/, 'analysis generation status should be visible');
assert.match(scene, /stateName === 'loading'/, 'loading analysis should be represented in the UI');
assert.match(scene, /loadSingle\(nearest\.data\)/, 'proximity should enter the nearest bubble detail view');
assert.match(events, /markGroupCameraInteraction\(e\.deltaY < 0 \? 'zoomIn' : 'zoomOut'\)/, 'only zoom-in wheel input should arm proximity transition');
assert.doesNotMatch(scene.match(/function addSolarSystem[\s\S]*?\n        function createCosmicEnvironment/)?.[0] || '', /blackHole/i, 'solar systems must not create black holes');
assert.match(animation, /getLoadingBlackHoleTarget\(loadingAnimation\.targetIndex\)/, 'warp animation should target galaxy-center black holes');
assert.match(animation, /segmentDuration: 12000/, 'black hole approach should allow a longer exploration route');
assert.match(animation, /approachDistance: 16000/, 'black hole approach should travel through a larger universe volume');
assert.match(animation, /maxSpeed: 1400/, 'black hole approach should have a speed ceiling');
assert.match(animation, /camera\.position\.distanceTo\(blackHole\) <= eventHorizonRadius/, 'warp should transition at the event horizon surface');
assert.match(animation, /new THREE\.CatmullRomCurve3/, 'warp should follow a smooth curve');
assert.match(animation, /Math\.random\(\) - 0\.5/, 'warp control points should vary on every dive');
assert.match(animation, /initializeLoadingRoute\(nextTarget\)/, 'each black hole segment should receive a route');
assert.match(animation, /relocateGalaxyUniverse\('black-hole-universe-switch'\)/, 'black-hole universe switches should relocate galaxies');
assert.doesNotMatch(animation, /nearHole|Math\.pow\(1 - p/, 'warp should not enter the black hole or decelerate at the end');
assert.match(audio, /EDGEWORTH_BGM = 'edgeworth-kuiper-belt\.mp3'/, 'the default BGM should use a stable ASCII filename');
assert.match(audio, /storedBgmType === LEGACY_EDGEWORTH_BGM/, 'legacy BGM selections should migrate safely');
assert.match(indexHtml, /value="edgeworth-kuiper-belt\.mp3">エッジワース・カイパーベルト/, 'the BGM selector should expose the Edgeworth track');
assert.match(buildScript, /ngc-3324-nircam-clean-4000\.png/, 'the build should embed the clean NGC 3324 asset');

console.log('Visual navigation invariants: OK');
