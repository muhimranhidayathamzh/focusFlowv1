import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(
  await readFile(path.join(extensionRoot, 'manifest.json'), 'utf8')
);
const allowedMatches = [
  'http://localhost:3000/*',
  'http://127.0.0.1:3000/*',
  'https://focusflow-fawn-ten.vercel.app/*',
];
const forbiddenPermissions = new Set([
  'tabs',
  'activeTab',
  'history',
  'webNavigation',
  'scripting',
  'notifications',
  'nativeMessaging',
  '<all_urls>',
]);

assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage', 'declarativeNetRequest', 'alarms']);
assert.equal(manifest.host_permissions, undefined);
assert.deepEqual(manifest.optional_host_permissions, [
  'http://*/*',
  'https://*/*',
]);
assert.equal(manifest.externally_connectable, undefined);
assert.equal(manifest.content_scripts.length, 1);
assert.deepEqual(manifest.content_scripts[0].matches, allowedMatches);

const manifestText = JSON.stringify(manifest);
for (const permission of forbiddenPermissions) {
  assert.equal(manifest.permissions.includes(permission), false);
  assert.equal(manifestText.includes(`\"${permission}\"`), false);
}

assert.equal(manifestText.includes('<all_urls>'), false);
assert.equal(manifest.action.default_popup, 'src/popup/index.html');
assert.deepEqual(manifest.web_accessible_resources[0].matches, [
  'http://*/*',
  'https://*/*',
]);

async function collectScripts(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) paths.push(...await collectScripts(path.join(directory, entry.name), relative));
    else if (entry.name.endsWith('.js')) paths.push(path.join('src', relative));
  }
  return paths;
}
const scriptPaths = await collectScripts(path.join(extensionRoot, 'src'));
for (const relativePath of new Set(scriptPaths)) {
  const absolutePath = path.join(extensionRoot, relativePath);
  await access(absolutePath);
  const source = await readFile(absolutePath, 'utf8');
  new vm.Script(source, { filename: relativePath });
}

const protocolContext = vm.createContext({
  globalThis: {},
  TextEncoder,
  Date,
  Set,
  Object,
});
const protocolSource = await readFile(
  path.join(extensionRoot, 'src/shared/protocol.js'),
  'utf8'
);
new vm.Script(protocolSource).runInContext(protocolContext);
assert.equal(
  protocolContext.globalThis.FocusFlowBridgeProtocol.EXTENSION_VERSION,
  manifest.version
);

console.log('Extension check passed: MV3 minimum permissions, exact FocusFlow app origins, optional HTTP/HTTPS rule permissions, and all scripts parse.');
