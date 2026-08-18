import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [scene, animation] = await Promise.all([
    readFile(path.join(root, 'src', 'js', 'scene.js'), 'utf8'),
    readFile(path.join(root, 'src', 'js', 'animation.js'), 'utf8')
]);

const shapeMatch = scene.match(/const GALAXY_SHAPE_NAMES\s*=\s*\[([^\]]+)\]/);
assert.ok(shapeMatch, 'galaxy shape names should be declared');
assert.ok((shapeMatch[1].match(/'/g) || []).length >= 10, 'at least five galaxy shapes should be defined');
assert.match(scene, /const starsCount = 12000;/, 'isolated stars should remain a minority layer');
assert.match(scene, /controls\.enableZoom = true;/, 'OrbitControls zoom should be enabled');
assert.match(scene, /controls\.maxDistance = 24000;/, 'upper categories should have a usable zoom-out range');
assert.match(scene, /isGalaxyCenterBlackHole = true/, 'black holes should be marked as galaxy centers');
assert.match(scene, /galaxyBlackHoleTargets\.push\(\{ position: worldBlackHolePosition/, 'loading targets should come from galaxy centers');
assert.match(scene, /radius = 14000/, 'Milky Way should remain the far background layer');
assert.match(scene, /function createSphericalBackgroundPosition\(/, 'background objects should use a full-sphere placement helper');
assert.match(scene, /Array\.from\(\{ length: 12 \}/, 'nebulae should surround the bubble groups in every direction');
assert.match(scene, /Array\.from\(\{ length: 10 \}/, 'solar systems should surround the bubble groups in every direction');
assert.match(scene, /new THREE\.Vector3\(620, -720, 1180\)/, 'galaxy clusters should also exist behind the initial view');
assert.match(scene, /function updateAutomaticBubbleApproach\(\)/, 'automatic bubble proximity handling should exist');
assert.match(scene, /loadSingle\(nearest\.data\)/, 'proximity should enter the nearest bubble detail view');
assert.doesNotMatch(scene.match(/function addSolarSystem[\s\S]*?\n        function createCosmicEnvironment/)?.[0] || '', /blackHole/i, 'solar systems must not create black holes');
assert.match(animation, /getLoadingBlackHoleTarget\(loadingAnimation\.targetIndex\)/, 'warp animation should target galaxy-center black holes');

console.log('Visual navigation invariants: OK');
