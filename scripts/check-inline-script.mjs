import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src', 'index.html');
const source = await readFile(sourcePath, 'utf8');
const localScriptPattern = /<script src="\.\/([^\"]+)"><\/script>/g;
const scriptPaths = [...source.matchAll(localScriptPattern)].map(match => match[1]);
if (scriptPaths.length === 0) throw new Error('Local application scripts were not found.');
const scripts = await Promise.all(scriptPaths.map(relativePath => readFile(path.join(path.dirname(sourcePath), relativePath), 'utf8')));
new Function(scripts.join('\n;\n'));
console.log('Inline application script syntax: OK');
