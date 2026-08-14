import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

async function importTypeScript(url, replacements = []) {
  let source = await readFile(url, 'utf8');
  for (const [pattern, replacement] of replacements) source = source.replace(pattern, replacement);
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const rules = await importTypeScript(new URL('../src/lib/focusGuardRules.ts', import.meta.url));
globalThis.__phase9Rules = rules;

assert.equal(rules.normalizeGuardDomain('TikTok.COM.'), 'tiktok.com');
assert.equal(rules.websiteRuleMatches({ id: 'd', action: 'block', matchType: 'domain', pattern: 'tiktok.com' }, 'https://www.tiktok.com/a'), true);
assert.equal(rules.websiteRuleMatches({ id: 'd', action: 'block', matchType: 'domain', pattern: 'tiktok.com' }, 'https://nottiktok.com/'), false);
const shortsRule = { id: 'shorts', label: 'Shorts', action: 'block', matchType: 'url-pattern', pattern: '*://*.youtube.com/shorts/*' };
assert.equal(rules.websiteRuleMatches(shortsRule, 'https://youtube.com/shorts/abc'), true);
assert.equal(rules.websiteRuleMatches(shortsRule, 'https://www.youtube.com/shorts/abc'), true);
for (const allowed of ['https://youtube.com/watch?v=1', 'https://youtube.com/', 'https://youtube.com/results?search_query=a', 'https://youtube.com/@focus']) {
  assert.equal(rules.websiteRuleMatches(shortsRule, allowed), false, allowed);
}
const prefix = { id: 'prefix', action: 'block', matchType: 'url-prefix', pattern: 'https://example.com/focus/' };
assert.equal(rules.websiteRuleMatches(prefix, 'https://example.com/focus/one'), true);
assert.equal(rules.websiteRuleMatches(prefix, 'https://example.com/other'), false);
const precedenceRules = [
  { id: 'broad', action: 'block', matchType: 'domain', pattern: 'youtube.com' },
  { id: 'watch', action: 'allow', matchType: 'url-prefix', pattern: 'https://youtube.com/watch' },
];
assert.equal(rules.resolveWebsiteRule(precedenceRules, 'https://youtube.com/watch?v=1'), 'allow');
assert.equal(rules.resolveWebsiteRule(precedenceRules, 'https://youtube.com/shorts/abc'), 'block');
assert.deepEqual(rules.deriveRuleOrigins([shortsRule]), ['http://*.youtube.com/*', 'http://youtube.com/*', 'https://*.youtube.com/*', 'https://youtube.com/*']);
assert.equal(rules.normalizeWebsiteRuleSet([shortsRule, { ...shortsRule, id: 'duplicate', action: 'allow' }]).ok, false);
assert.equal(rules.validateWebsiteRule({ ...shortsRule, pattern: 'regex:(.*)' }).ok, false);
assert.equal(rules.validateWebsiteRule({ id: 'local', action: 'block', matchType: 'url-prefix', pattern: 'http://localhost:3000/private' }).ok, false);
assert.equal(rules.validateWebsiteRule({ id: 'app-domain', action: 'block', matchType: 'domain', pattern: 'focusflow-fawn-ten.vercel.app' }).ok, false);
assert.equal(rules.validateWebsiteRule({ id: 'app-prefix', action: 'block', matchType: 'url-prefix', pattern: 'https://focusflow-fawn-ten.vercel.app/private' }).ok, false);

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
globalThis.window = { dispatchEvent() {} };
globalThis.__phase9Review = {
  applyGuardReviewSkip() {}, applyGuardReviewSubmission() {}, createPendingGuardReview() { return {}; },
  normalizeGuardReviewMetadata() { return { kind: 'absent' }; },
};
const persistence = await importTypeScript(
  new URL('../src/lib/focusGuardPersistence.ts', import.meta.url),
  [
    [/import \{[\s\S]*?\} from '@\/lib\/focusGuardReview';/, 'const { applyGuardReviewSkip, applyGuardReviewSubmission, createPendingGuardReview, normalizeGuardReviewMetadata } = globalThis.__phase9Review;'],
    [/import \{ normalizeWebsiteRuleSet \} from '@\/lib\/focusGuardRules';/, 'const { normalizeWebsiteRuleSet } = globalThis.__phase9Rules;'],
  ]
);
globalThis.__phase9Persistence = persistence;

let profiles = persistence.loadFocusGuardProfiles();
assert.equal(profiles.length, 2);
assert.equal(profiles[0].id, persistence.BUILT_IN_LIGHT_PROFILE_ID);
assert.equal(profiles[1].id, persistence.BUILT_IN_BROWSER_PROFILE_ID);
assert.equal(persistence.updateCustomFocusGuardProfile(persistence.BUILT_IN_BROWSER_PROFILE_ID, { name: 'Overwrite' }), null);
assert.equal(persistence.deleteCustomFocusGuardProfile(persistence.BUILT_IN_LIGHT_PROFILE_ID), false);
const custom = persistence.createCustomFocusGuardProfile({
  name: 'Shorts Guard', protectionLevel: 'medium', websiteRules: [shortsRule],
  emergencyBypassAllowed: true, bypassDelaySeconds: 10, bypassDurationMinutes: 5,
  requireBypassReason: true,
});
assert.ok(custom);
assert.equal(persistence.updateCustomFocusGuardProfile(custom.id, { name: 'Shorts Refined' }).name, 'Shorts Refined');
const duplicate = persistence.duplicateFocusGuardProfile(persistence.BUILT_IN_BROWSER_PROFILE_ID);
assert.ok(duplicate && duplicate.kind === 'custom' && duplicate.websiteRules[0].pattern === 'tiktok.com');
assert.equal(persistence.deleteCustomFocusGuardProfile(custom.id), true);

const configModel = await importTypeScript(
  new URL('../src/lib/focusGuardProfileConfig.ts', import.meta.url),
  [[/import \{[\s\S]*?\} from '@\/lib\/focusGuardPersistence';/, `const {
    BUILT_IN_BROWSER_PROFILE_ID, BUILT_IN_LIGHT_PROFILE_ID, importCustomFocusGuardProfiles,
    loadFocusGuardPreferences, loadFocusGuardProfiles, normalizeFocusGuardProfile,
    saveFocusGuardPreferences
  } = globalThis.__phase9Persistence;`]]
);
const exported = configModel.createFocusGuardConfigExport(1234);
assert.equal(exported.customProfiles.every((profile) => profile.kind === 'custom'), true);
const exportText = JSON.stringify(exported).toLowerCase();
for (const forbidden of ['tasks', 'history', 'interruptions', 'distraction', 'rating', 'analytics', 'permissions', 'timer']) assert.equal(exportText.includes(forbidden), false, forbidden);
const previewResult = configModel.parseFocusGuardConfigImport(JSON.stringify(exported));
assert.equal(previewResult.ok, true);
assert.equal(configModel.parseFocusGuardConfigImport(JSON.stringify({ ...exported, version: 99 })).ok, false);
const overwrite = { ...exported, customProfiles: [{ ...persistence.DEFAULT_LIGHT_PROFILE, kind: 'custom' }] };
assert.equal(configModel.parseFocusGuardConfigImport(JSON.stringify(overwrite)).ok, false);
assert.equal(configModel.applyFocusGuardConfigImport(previewResult.preview, 'merge'), true);

const webBridge = await importTypeScript(
  new URL('../src/lib/focusGuardExtensionBridge.ts', import.meta.url),
  [[/import \{ deriveRuleOrigins, normalizeWebsiteRuleSet \} from '@\/lib\/focusGuardRules';/, 'const { deriveRuleOrigins, normalizeWebsiteRuleSet } = globalThis.__phase9Rules;']]
);
const syncedConfig = webBridge.createSanitizedFocusGuardProfileConfig(duplicate, 5000);
assert.ok(syncedConfig);
const configText = JSON.stringify(syncedConfig).toLowerCase();
for (const forbidden of ['task', 'history', 'distraction', 'rating', 'analytics', 'permissiongrants']) assert.equal(configText.includes(forbidden), false, forbidden);

for (const relativePath of [
  '../extension/src/shared/protocol.js', '../extension/src/background/event-queue.js',
  '../extension/src/background/browser-guard.js', '../extension/src/background/guard-engine.js',
]) vm.runInThisContext(await readFile(new URL(relativePath, import.meta.url), 'utf8'), { filename: relativePath });
const protocol = globalThis.FocusFlowBridgeProtocol;
const compiler = globalThis.FocusFlowBrowserGuard;
const engineModule = globalThis.FocusFlowGuardEngine;
const compiled = compiler.compileRuleSet({ status: 'active', protectionLevel: 'medium', websiteRules: precedenceRules });
assert.equal(compiled.ok, true);
assert.equal(compiled.contexts.length, 2);
assert.notEqual(compiled.contexts[0].dnrRuleId, compiled.contexts[1].dnrRuleId);
assert.ok(compiled.contexts[1].priority > compiled.contexts[0].priority);
assert.equal(compiled.contexts[1].action, 'allow');
assert.equal(compiler.urlMatchesRule(shortsRule, 'https://www.youtube.com/shorts/x'), true);

function storage(initial = null) { let value = structuredClone(initial); return { async get() { return structuredClone(value); }, async set(next) { value = structuredClone(next); }, async remove() { value = null; } }; }
let clock = 10000;
const invalidSnapshot = {
  schemaVersion: 3, guardSessionId: 'g', timerRunId: 't', status: 'active', targetLabel: 'Target', protectionLevel: 'medium',
  profile: { id: 'p', displayName: 'Invalid' }, focusFlowOrigin: 'http://localhost:3000',
  bypass: { allowed: true, delaySeconds: 10, durationMinutes: 5, requireReason: true },
  websiteRules: [shortsRule, { ...shortsRule, id: 'dup' }], startedAt: 9000,
  expectedEndAt: 50000, updatedAt: clock, expiresAt: 45000,
};
const snapshotStorage = storage(invalidSnapshot);
const contextStorage = storage([]); const bypassStorage = storage([]); const challengeStorage = storage(null);
let dnrRules = [{ id: 42, priority: 1, action: { type: 'allow' }, condition: { resourceTypes: ['main_frame'] } }, { id: 100001, priority: 1, action: { type: 'allow' }, condition: { resourceTypes: ['main_frame'] } }];
const engine = engineModule.createGuardEngine({
  snapshotStorage, contextStorage, bypassStorage, challengeStorage,
  permissions: { async contains() { return true; } },
  dnr: { async getSessionRules() { return structuredClone(dnrRules); }, async updateSessionRules({ removeRuleIds, addRules }) { dnrRules = dnrRules.filter((rule) => !removeRuleIds.includes(rule.id)).concat(structuredClone(addRules)); } },
  alarms: { async create() {}, async clear() {} }, runtimeUrl: (path) => `chrome-extension://test/${path}`,
  eventQueue: { async enqueue() {} }, now: () => clock,
});
assert.equal((await engine.reconcile()).browserGuardState, 'error');
assert.deepEqual(dnrRules.map((rule) => rule.id), [42]);
await engine.clearRuntimeState();
assert.deepEqual(dnrRules.map((rule) => rule.id), [42]);

console.log('Phase 9 deterministic harness passed: profile CRUD/immutability, rule validation/matching/precedence, Shorts refinement, origins, config privacy/import/export, DNR compilation, fail-open invalid config, and recovery cleanup.');
