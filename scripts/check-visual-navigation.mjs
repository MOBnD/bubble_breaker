import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [scene, animation, events] = await Promise.all([
    readFile(path.join(root, 'src', 'js', 'scene.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'animation.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'events.js'), 'utf8')
]);

const shapeMatch = scene.match(/const GALAXY_SHAPE_NAMES\s*=\s*\[([^\]]+)\]/);
assert.ok(shapeMatch, 'galaxy shape names should be declared');
assert.ok((shapeMatch[1].match(/'/g) || []).length >= 10, 'at least five galaxy shapes should be defined');
assert.match(scene, /const starsCount = 18000;/, 'isolated stars should remain a minority layer while reaching galaxy depth');
assert.match(scene, /function createBackgroundStarPosition\(/, 'isolated stars should use a spherical position generator');
assert.match(scene, /starsGeometry\.setAttribute\('aShape'/, 'isolated stars should mix circular and starburst shapes');
assert.match(scene, /starsGeometry\.setAttribute\('aSpike'/, 'starburst intensity should vary per star');
assert.match(scene, /controls\.enableZoom = true;/, 'OrbitControls zoom should be enabled');
assert.match(scene, /controls\.maxDistance = 24000;/, 'upper categories should have a usable zoom-out range');
assert.match(scene, /isGalaxyCenterBlackHole = true/, 'black holes should be marked as galaxy centers');
assert.match(scene, /galaxyBlackHoleTargets\.push\(\{ position: worldBlackHolePosition/, 'loading targets should come from galaxy centers');
assert.doesNotMatch(scene, /createMilkyWayBand|milkyWay|isMilkyWay/, 'the Milky Way should be removed');
assert.match(scene, /const systemCount = 1000;/, 'galaxy-shaping star systems should be dense');
assert.match(scene, /function keepGalaxyCenterClear\(/, 'galaxy centers should remain clear around black holes');
assert.match(scene, /const galaxyStructures = \[\];/, 'galaxy structures should be independently rotatable');
assert.match(scene, /function createNGC3324Background\(\)/, 'NGC 3324 should be the single farthest nebula');
assert.match(scene, /gasNebulaName = 'NGC 3324'/, 'the farthest nebula should be identified as NGC 3324');
assert.doesNotMatch(scene, /GAS_NEBULA_PRESETS|addGasNebula|nebulaClouds/, 'legacy multiple nebula generation should be removed');
assert.match(scene, /const shootingStars = \[\];/, 'shooting stars should be part of the cosmic background');
assert.match(animation, /starMesh\.rotation\.y \+=/, 'the starfield should rotate with the background');
assert.match(animation, /cosmicBackgroundGroup\.rotation\.y \+=/, 'the distant background should continuously rotate');
assert.match(animation, /galaxyClusters\.forEach\(\(cluster, index\) =>/, 'galaxy clusters should rotate independently');
assert.match(scene, /function createSphericalBackgroundPosition\(/, 'background objects should use a full-sphere placement helper');
assert.match(scene, /const externalSystemCount = galaxyClusterCenters\.length \* GALAXIES_PER_CLUSTER;/, 'solar systems should match the galaxy count');
assert.match(scene, /Array\.from\(\{ length: externalSystemCount \}/, 'solar systems should surround the bubble groups in every direction');
assert.match(scene, /const GALAXY_CLUSTER_COUNT = 12;/, 'galaxy clusters should be distributed in all directions');
assert.match(scene, /const GALAXY_CLUSTER_RADIUS = 8000;/, 'galaxy clusters should occupy a broad distance shell');
assert.match(scene, /galaxyIndex \* Math\.PI \* 2 \/ GALAXIES_PER_CLUSTER/, 'galaxies in a cluster should use distinct angular slots');
assert.match(scene, /const GALAXY_COLOR_PROFILES = \[/, 'galaxies should have distinct color profiles');
assert.match(scene, /preserveGalaxyColor/, 'galaxy color profiles should survive depth updates');
assert.match(scene, /blackHole\.userData\.eventHorizonRadius = eventHorizonRadius;/, 'black holes should expose their event horizon radius');
assert.doesNotMatch(scene, /const horizon = new THREE\.Mesh|wireframe: true/, 'the enclosing wireframe horizon sphere should be removed');
assert.match(scene, /function updateAutomaticBubbleApproach\(\)/, 'automatic bubble proximity handling should exist');
assert.match(scene, /loadSingle\(nearest\.data\)/, 'proximity should enter the nearest bubble detail view');
assert.match(events, /markGroupCameraInteraction\(e\.deltaY < 0 \? 'zoomIn' : 'zoomOut'\)/, 'only zoom-in wheel input should arm proximity transition');
assert.doesNotMatch(scene.match(/function addSolarSystem[\s\S]*?\n        function createCosmicEnvironment/)?.[0] || '', /blackHole/i, 'solar systems must not create black holes');
assert.match(animation, /getLoadingBlackHoleTarget\(loadingAnimation\.targetIndex\)/, 'warp animation should target galaxy-center black holes');
assert.match(animation, /segmentDuration: 10000/, 'black hole approach should take about ten seconds');
assert.match(animation, /maxSpeed: 900/, 'black hole approach should have a speed ceiling');
assert.match(animation, /camera\.position\.distanceTo\(blackHole\) <= eventHorizonRadius/, 'warp should transition at the event horizon surface');
assert.match(animation, /new THREE\.CatmullRomCurve3/, 'warp should follow a smooth curve');
assert.match(animation, /Math\.random\(\) - 0\.5/, 'warp control points should vary on every dive');
assert.match(animation, /initializeLoadingRoute\(nextTarget\)/, 'each black hole segment should receive a route');
assert.doesNotMatch(animation, /nearHole|Math\.pow\(1 - p/, 'warp should not enter the black hole or decelerate at the end');

console.log('Visual navigation invariants: OK');
