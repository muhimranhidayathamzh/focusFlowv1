import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(extensionRoot, 'dist');

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });
await cp(path.join(extensionRoot, 'src'), path.join(outputRoot, 'src'), {
  recursive: true,
});
await cp(path.join(extensionRoot, 'manifest.json'), path.join(outputRoot, 'manifest.json'));

const notice = [
  'FocusFlow Guard Bridge — generated unpacked extension',
  'Run npm run extension:build after source edits.',
  'Load this dist directory through chrome://extensions or edge://extensions.',
  '',
].join('\n');
await writeFile(path.join(outputRoot, 'BUILD.txt'), notice, 'utf8');

const manifest = JSON.parse(
  await readFile(path.join(outputRoot, 'manifest.json'), 'utf8')
);
console.log(`Extension build complete: ${manifest.name} ${manifest.version} -> extension/dist`);
