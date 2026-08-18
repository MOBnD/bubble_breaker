import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'src', 'index.html');
const sourceDir = path.dirname(sourcePath);
const outputDir = path.join(root, 'dist');
const outputPath = path.join(outputDir, 'bb_proto4.html');

function readEnvFile(contents) {
    const values = {};
    for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const separator = trimmed.indexOf('=');
        if (separator < 0) continue;
        const key = trimmed.slice(0, separator).trim();
        let value = trimmed.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        values[key] = value;
    }
    return values;
}

let env = {};
try {
    env = readEnvFile(await readFile(path.join(root, '.env'), 'utf8'));
} catch (error) {
    if (error.code !== 'ENOENT') throw error;
}

function usableApiKey(value) {
    const normalized = String(value || '').trim();
    return normalized && normalized !== 'your_api_key_here' ? normalized : '';
}

// プロセス環境変数を優先し、シェルで設定したキーが古い.envに隠れないようにする。
const apiKey = usableApiKey(process.env.OPENAI_API_KEY) || usableApiKey(env.OPENAI_API_KEY);
const model = String(process.env.OPENAI_MODEL || env.OPENAI_MODEL || 'gpt-5.6-luna').trim() || 'gpt-5.6-luna';
const source = await readFile(sourcePath, 'utf8');
const styles = await readFile(path.join(sourceDir, 'styles.css'), 'utf8');
const ngc3324Image = await readFile(path.join(sourceDir, 'assets', 'ngc-3324-nircam-clean-4000.png'));
const ngc3324Texture = `data:image/png;base64,${ngc3324Image.toString('base64')}`;
const localScriptPattern = /<script src="\.\/([^\"]+)"><\/script>/g;
const scriptPaths = [...source.matchAll(localScriptPattern)].map(match => match[1]);
if (scriptPaths.length === 0) throw new Error('No local application scripts were found in src/index.html.');
const scripts = await Promise.all(scriptPaths.map(relativePath => readFile(path.join(sourceDir, relativePath), 'utf8')));
let scriptIndex = 0;
const inlinedSource = source
    .replace('    <link rel="stylesheet" href="./styles.css">', `<style>\n${styles}\n    </style>`)
    .replace(localScriptPattern, () => `<script>\n${scripts[scriptIndex++]}\n    </script>`);
if (scriptIndex !== scripts.length) throw new Error('Not all local application scripts were inlined.');
const output = inlinedSource
    .replace('window.__OPENAI_API_KEY__ = "__OPENAI_API_KEY__";', `window.__OPENAI_API_KEY__ = ${JSON.stringify(apiKey)};`)
    .replace('window.__OPENAI_MODEL__ = "gpt-5.6-luna";', `window.__OPENAI_MODEL__ = ${JSON.stringify(model)};`)
    .replace('window.__NGC3324_TEXTURE__ = "./assets/ngc-3324-nircam-clean-4000.png";', `window.__NGC3324_TEXTURE__ = ${JSON.stringify(ngc3324Texture)};`);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, output, 'utf8');
await rm(path.join(outputDir, 'BGM'), { recursive: true, force: true });
await cp(path.join(root, 'BGM'), path.join(outputDir, 'BGM'), { recursive: true });
console.log(`Built ${path.relative(root, outputPath)}${apiKey ? ' with API key' : ' without API key (fixed-data fallback enabled)'}.`);
