import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'bb_proto4.html'), 'utf8');
const start = html.lastIndexOf('<script>');
const end = html.lastIndexOf('</script>');
if (start < 0 || end <= start) throw new Error('Inline application script was not found.');
new Function(html.slice(start + '<script>'.length, end));
console.log('Inline application script syntax: OK');
