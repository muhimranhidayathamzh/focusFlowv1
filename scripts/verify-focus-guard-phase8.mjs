import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

for (const relativePath of [
  '../extension/src/shared/protocol.js',
  '../extension/src/background/event-queue.js',
  '../extension/src/background/browser-guard.js',
  '../extension/src/background/guard-engine.js',
]) {
  vm.runInThisContext(await readFile(new URL(relativePath, import.meta.url), 'utf8'), { filename: relativePath });
}

const protocol = globalThis.FocusFlowBridgeProtocol;
const compiler = globalThis.FocusFlowBrowserGuard;
const queueModule = globalThis.FocusFlowEventQueue;
const engineModule = globalThis.FocusFlowGuardEngine;
let clock = 1_000_000;

const persistenceSource = await readFile(new URL('../src/lib/focusGuardPersistence.ts', import.meta.url), 'utf8');
assert.match(persistenceSource, /focusflow-guard-profile-browser-built-in/);
assert.match(persistenceSource, /pattern: 'tiktok\.com'/);
assert.match(persistenceSource, /protectionLevel: 'medium'/);
assert.match(persistenceSource, /requireBypassReason: true/);

assert.equal(compiler.normalizeDomain('TikTok.COM.'), 'tiktok.com');
assert.equal(compiler.hostnameMatchesDomain('tiktok.com', 'tiktok.com'), true);
assert.equal(compiler.hostnameMatchesDomain('www.tiktok.com.', 'tiktok.com'), true);
assert.equal(compiler.hostnameMatchesDomain('nottiktok.com', 'tiktok.com'), false);
assert.equal(compiler.hostnameMatchesDomain('tiktok.com.attacker.test', 'tiktok.com'), false);
assert.equal(
  compiler.deterministicRuleId('focusflow-browser-guard-tiktok', compiler.BLOCK_RULE_MIN, compiler.BLOCK_RULE_MAX),
  compiler.deterministicRuleId('focusflow-browser-guard-tiktok', compiler.BLOCK_RULE_MIN, compiler.BLOCK_RULE_MAX)
);

function storage(initial = null) {
  let value = structuredClone(initial);
  return {
    async get() { return structuredClone(value); },
    async set(next) { value = structuredClone(next); },
    async remove() { value = null; },
  };
}

const snapshot = {
  schemaVersion: 3,
  guardSessionId: 'guard-browser-1', timerRunId: 'timer-1', status: 'active',
  targetLabel: 'Tulis proposal', protectionLevel: 'medium',
  profile: { id: 'focusflow-guard-profile-browser-built-in', displayName: 'Browser Guard' },
  focusFlowOrigin: 'http://localhost:3000',
  bypass: { allowed: true, delaySeconds: 10, durationMinutes: 5, requireReason: true },
  websiteRules: [{ id: 'focusflow-browser-guard-tiktok', pattern: 'tiktok.com', matchType: 'domain', action: 'block', label: 'TikTok' }],
  startedAt: clock - 1_000, expectedEndAt: clock + 20 * 60_000,
  updatedAt: clock, expiresAt: clock + 35_000,
};
assert.equal(protocol.normalizeSessionSnapshot(snapshot, clock).ok, true);
assert.equal(protocol.normalizeSessionSnapshot({ ...snapshot, expiresAt: clock - 1 }, clock).ok, false);

const snapshotStorage = storage(snapshot);
const contextStorage = storage([]);
const bypassStorage = storage([]);
const challengeStorage = storage(null);
const eventStorage = storage([]);
const eventQueue = queueModule.createEventQueue(eventStorage, () => clock);
let permissionGranted = false;
let sessionRules = [{ id: 42, priority: 1, action: { type: 'allow' }, condition: { resourceTypes: ['main_frame'] } }];
let updateCount = 0;
const alarmState = new Map();
const dependencies = {
  snapshotStorage, contextStorage, bypassStorage, challengeStorage,
  permissions: { async contains() { return permissionGranted; } },
  dnr: {
    async getSessionRules() { return structuredClone(sessionRules); },
    async updateSessionRules({ removeRuleIds, addRules }) {
      updateCount += 1;
      sessionRules = sessionRules.filter((rule) => !removeRuleIds.includes(rule.id)).concat(structuredClone(addRules));
    },
  },
  alarms: {
    async create(name, info) { alarmState.set(name, info); },
    async clear(name) { return alarmState.delete(name); },
  },
  runtimeUrl: (path) => `chrome-extension://test/${path}`,
  eventQueue, now: () => clock,
};
const engine = engineModule.createGuardEngine(dependencies);

let state = await engine.reconcile();
assert.equal(state.browserGuardState, 'permission-required');
assert.deepEqual(sessionRules.map((rule) => rule.id), [42]);

permissionGranted = true;
state = await engine.reconcile();
assert.equal(state.browserGuardState, 'protection-active');
const blockRule = sessionRules.find((rule) => compiler.isFocusFlowRuleId(rule.id));
assert.ok(blockRule);
assert.deepEqual(blockRule.condition, { requestDomains: ['tiktok.com'], resourceTypes: ['main_frame'] });
assert.equal(blockRule.action.redirect.url.includes('rule=r-'), true);
assert.equal(blockRule.action.redirect.url.includes('tiktok.com/'), false);
const idempotentCount = updateCount;
await engine.reconcile();
assert.equal(updateCount, idempotentCount);
assert.ok(sessionRules.some((rule) => rule.id === 42));

await snapshotStorage.set({ ...snapshot, protectionLevel: 'light', websiteRules: [] });
assert.equal((await engine.reconcile()).browserGuardState, 'light');
assert.deepEqual(sessionRules.map((rule) => rule.id), [42]);
await snapshotStorage.set({ ...snapshot, status: 'paused', expectedEndAt: undefined, pausedRemainingSeconds: 600 });
assert.equal((await engine.reconcile()).browserGuardState, 'protection-paused');
assert.deepEqual(sessionRules.map((rule) => rule.id), [42]);

await snapshotStorage.set(snapshot);
await engine.reconcile();
const contexts = await contextStorage.get();
const ruleToken = contexts[0].token;
const intervention = await engine.interventionOpened(ruleToken, 'attempt-00000001');
assert.equal(intervention.active, true);
await engine.interventionOpened(ruleToken, 'attempt-00000001');
assert.equal((await eventQueue.drain()).filter((event) => event.type === 'blocked-site').length, 1);

const challenge = await engine.prepareBypass(ruleToken, snapshot.guardSessionId);
await assert.rejects(() => engine.activateBypass({ ruleToken, guardSessionId: snapshot.guardSessionId, challengeId: challenge.challengeId, reason: 'perlu' }));
clock += 10_000;
await assert.rejects(() => engine.activateBypass({ ruleToken, guardSessionId: snapshot.guardSessionId, challengeId: challenge.challengeId, reason: '' }));
const granted = await engine.activateBypass({ ruleToken, guardSessionId: snapshot.guardSessionId, challengeId: challenge.challengeId, reason: 'Perlu verifikasi singkat' });
assert.equal(granted.expiresAt, clock + 5 * 60_000);
const repeated = await engine.activateBypass({ ruleToken, guardSessionId: snapshot.guardSessionId, challengeId: challenge.challengeId, reason: 'Perlu verifikasi singkat' });
assert.equal(repeated.alreadyApplied, true);
assert.equal(repeated.expiresAt, granted.expiresAt);
assert.equal(sessionRules.filter((rule) => rule.id >= compiler.BYPASS_RULE_MIN).length, 1);

const queued = await eventQueue.drain();
assert.equal(queued.filter((event) => event.type === 'emergency-bypass').length, 1);
assert.equal(JSON.stringify(queued).includes('/watch'), false);
assert.equal(Object.hasOwn(queued[0], 'attemptedUrl'), false);
assert.equal(await eventQueue.ack([queued[0].id]), 1);

clock = granted.expiresAt + 1;
await snapshotStorage.set({ ...snapshot, updatedAt: clock, expiresAt: clock + 35_000 });
await engine.reconcile();
assert.equal(sessionRules.filter((rule) => rule.id >= compiler.BYPASS_RULE_MIN).length, 0);
assert.equal(sessionRules.filter((rule) => rule.id >= compiler.WEBSITE_RULE_MIN && rule.id <= compiler.WEBSITE_RULE_MAX).length, 1);

const restartedEngine = engineModule.createGuardEngine(dependencies);
assert.equal((await restartedEngine.reconcile()).browserGuardState, 'protection-active');
await snapshotStorage.remove();
await restartedEngine.clearRuntimeState();
assert.deepEqual(sessionRules.map((rule) => rule.id), [42]);
assert.equal(alarmState.size, 0);

console.log('Phase 8 deterministic harness passed: canonical profile, domain safety, DNR lifecycle, permissions, event dedupe, bypass friction/expiry, restart reconciliation, and URL privacy.');
