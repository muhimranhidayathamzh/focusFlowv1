import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const webSourceUrl = new URL(
  '../src/lib/focusGuardExtensionBridge.ts',
  import.meta.url
);
const webSource = await readFile(webSourceUrl, 'utf8');
const rulesSource = await readFile(
  new URL('../src/lib/focusGuardRules.ts', import.meta.url),
  'utf8'
);
const rulesOutput = ts.transpileModule(rulesSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
globalThis.__phase7Rules = await import(
  `data:text/javascript;base64,${Buffer.from(rulesOutput).toString('base64')}`
);
const webOutput = ts.transpileModule(webSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText.replace(
  /import \{ deriveRuleOrigins, normalizeWebsiteRuleSet \} from '@\/lib\/focusGuardRules';/,
  'const { deriveRuleOrigins, normalizeWebsiteRuleSet } = globalThis.__phase7Rules;'
);
const webBridge = await import(
  `data:text/javascript;base64,${Buffer.from(webOutput).toString('base64')}`
);
const livenessSource = await readFile(
  new URL('../src/lib/focusGuardExtensionLiveness.ts', import.meta.url),
  'utf8'
);
const livenessOutput = ts.transpileModule(livenessSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const liveness = await import(
  `data:text/javascript;base64,${Buffer.from(livenessOutput).toString('base64')}`
);

for (const relativePath of [
  '../extension/src/shared/protocol.js',
  '../extension/src/background/session-store.js',
]) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  vm.runInThisContext(source, { filename: relativePath });
}

const protocol = globalThis.FocusFlowBridgeProtocol;
const sessionStore = globalThis.FocusFlowSessionStore;
const now = 1_000_000;

const contentBridgeSource = await readFile(
  new URL('../extension/src/content/bridge.js', import.meta.url),
  'utf8'
);
let contentMessageListener = null;
const pageMessages = [];
const runtimeMessages = [];
const mockWindow = {
  location: { origin: 'http://localhost:3000' },
  addEventListener(type, listener) {
    if (type === 'message') contentMessageListener = listener;
  },
  postMessage(message, targetOrigin) {
    pageMessages.push({ message, targetOrigin });
  },
};
const contentBridgeContext = {
  FocusFlowBridgeProtocol: protocol,
  window: mockWindow,
  chrome: {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        runtimeMessages.push(message);
        callback(protocol.createEnvelope(protocol.MESSAGE_TYPES.PONG, message.requestId, {
          extensionVersion: protocol.EXTENSION_VERSION,
          protocolVersion: protocol.PROTOCOL_VERSION,
          snapshotSchemaVersion: protocol.SNAPSHOT_SCHEMA_VERSION,
        }, now));
      },
    },
  },
  console,
};
vm.runInNewContext(contentBridgeSource, contentBridgeContext, {
  filename: '../extension/src/content/bridge.js',
});
assert.equal(typeof contentMessageListener, 'function');
assert.equal(pageMessages.length, 1);
assert.equal(pageMessages[0].message.type, protocol.MESSAGE_TYPES.READY);

pageMessages.length = 0;
contentMessageListener({
  source: mockWindow,
  origin: mockWindow.location.origin,
  data: protocol.createEnvelope(protocol.MESSAGE_TYPES.READY, 'ready-response', {
    extensionVersion: protocol.EXTENSION_VERSION,
    protocolVersion: protocol.PROTOCOL_VERSION,
    snapshotSchemaVersion: protocol.SNAPSHOT_SCHEMA_VERSION,
  }, now),
});
contentMessageListener({
  source: mockWindow,
  origin: mockWindow.location.origin,
  data: protocol.createErrorEnvelope('error-response', 'TEST_ERROR', 'Test response.'),
});
assert.equal(runtimeMessages.length, 0);
assert.equal(pageMessages.length, 0);

contentMessageListener({
  source: mockWindow,
  origin: mockWindow.location.origin,
  data: protocol.createEnvelope(protocol.MESSAGE_TYPES.PING, 'page-ping', {
    pageVersion: '1.0.0',
  }, now),
});
assert.equal(runtimeMessages.length, 1);
assert.equal(runtimeMessages[0].type, protocol.MESSAGE_TYPES.PING);
assert.equal(pageMessages.length, 1);
assert.equal(pageMessages[0].message.type, protocol.MESSAGE_TYPES.PONG);
assert.equal(pageMessages[0].message.requestId, 'page-ping');

assert.equal(liveness.FOCUS_GUARD_EXTENSION_REQUEST_TIMEOUT_MS, 6_000);
assert.equal(liveness.FOCUS_GUARD_EXTENSION_CONNECTION_CHECK_MS, 12_000);
assert.equal(liveness.FOCUS_GUARD_EXTENSION_FAILURE_THRESHOLD, 3);
assert.ok(
  liveness.FOCUS_GUARD_EXTENSION_REQUEST_TIMEOUT_MS +
    (liveness.FOCUS_GUARD_EXTENSION_FAILURE_THRESHOLD - 1) *
      liveness.FOCUS_GUARD_EXTENSION_CONNECTION_CHECK_MS <=
    45_000
);

let livenessState = liveness.createFocusGuardExtensionLivenessState();
livenessState = liveness.recordFocusGuardExtensionFailure(livenessState);
assert.equal(livenessState.connectionState, 'connecting');
assert.equal(livenessState.consecutiveFailures, 1);

livenessState = liveness.recordFocusGuardExtensionSuccess(livenessState, now);
assert.equal(livenessState.connectionState, 'connected');
assert.equal(livenessState.consecutiveFailures, 0);
assert.equal(livenessState.lastSuccessfulResponseAt, now);

livenessState = liveness.recordFocusGuardExtensionFailure(livenessState);
assert.equal(livenessState.connectionState, 'connected');
livenessState = liveness.recordFocusGuardExtensionFailure(livenessState);
assert.equal(livenessState.connectionState, 'connected');
livenessState = liveness.recordFocusGuardExtensionFailure(livenessState);
assert.equal(livenessState.connectionState, 'disconnected');

livenessState = liveness.recordFocusGuardExtensionSuccess(
  livenessState,
  now + 30_000
);
assert.equal(livenessState.connectionState, 'connected');
assert.equal(livenessState.consecutiveFailures, 0);

livenessState = liveness.recordFocusGuardExtensionIncompatible(livenessState);
assert.equal(livenessState.connectionState, 'incompatible');

let pendingResolved = false;
let pendingRejected = null;
const pendingRequests = new Map();
pendingRequests.set('pending-on-unmount', {
  timeoutId: setTimeout(() => {}, 60_000),
  resolve: () => {
    pendingResolved = true;
  },
  reject: (error) => {
    pendingRejected = error;
  },
});
liveness.disposeFocusGuardPendingRequests(pendingRequests);
assert.equal(pendingRequests.size, 0);
assert.equal(pendingResolved, false);
assert.match(pendingRejected.message, /unmounted/i);
assert.equal(
  liveness.settleFocusGuardPendingRequest(
    pendingRequests,
    'pending-on-unmount',
    { type: 'late-response' }
  ),
  false
);
const baseGuardSession = {
  id: 'guard-1',
  timerRunId: 'run-1',
  profileId: 'profile-1',
  profileSnapshot: {
    profileId: 'profile-1',
    name: 'Coding',
    protectionLevel: 'medium',
    websiteRules: [
      {
        id: 'rule-1',
        pattern: 'example.com',
        matchType: 'domain',
        action: 'block',
        label: 'Example',
      },
    ],
    applicationRules: [
      { id: 'app-1', identifier: 'example.exe', label: 'Example', action: 'block' },
    ],
    emergencyBypassAllowed: true,
    bypassDelaySeconds: 10,
    bypassDurationMinutes: 5,
    requireBypassReason: false,
  },
  targetSnapshot: { taskId: 'task-1', label: 'Write proposal' },
  intention: 'Private intention must not leave the page',
  protectionLevel: 'medium',
  status: 'active',
  durationSeconds: 1500,
  startedAt: now - 5_000,
  expectedEndAt: now + 60_000,
};

const snapshot = webBridge.createSanitizedFocusGuardSnapshot(
  baseGuardSession,
  now
);
assert.ok(snapshot);
assert.deepEqual(Object.keys(snapshot).sort(), [
  'bypass',
  'expectedEndAt',
  'expiresAt',
  'focusFlowOrigin',
  'guardSessionId',
  'profile',
  'protectionLevel',
  'schemaVersion',
  'startedAt',
  'status',
  'targetLabel',
  'timerRunId',
  'updatedAt',
  'websiteRules',
]);
assert.equal(snapshot.expiresAt, now + 35_000);

const snapshotText = JSON.stringify(snapshot).toLowerCase();
for (const forbidden of [
  'intention',
  'applicationrules',
  'distraction',
  'interruption',
  'history',
  'rating',
  'analytics',
  'ambient',
  'taskid',
]) {
  assert.equal(snapshotText.includes(forbidden), false, forbidden);
}

const normalized = protocol.normalizeSessionSnapshot(snapshot, now);
assert.equal(normalized.ok, true);
assert.deepEqual(normalized.snapshot, snapshot);

const productionSnapshot = webBridge.createSanitizedFocusGuardSnapshot(
  baseGuardSession,
  now,
  'https://focusflow-fawn-ten.vercel.app/'
);
assert.equal(productionSnapshot?.focusFlowOrigin, 'https://focusflow-fawn-ten.vercel.app');
assert.equal(protocol.normalizeSessionSnapshot(productionSnapshot, now).ok, true);
assert.equal(
  webBridge.createSanitizedFocusGuardSnapshot(
    baseGuardSession,
    now,
    'https://focusflow-fawn-ten.vercel.app.attacker.example'
  ),
  null
);

let storedSnapshot = null;
const storage = {
  async get() {
    return storedSnapshot;
  },
  async set(next) {
    storedSnapshot = structuredClone(next);
  },
  async remove() {
    storedSnapshot = null;
  },
};
const handler = sessionStore.createMessageHandler({
  storage,
  engine: {
    async reconcile() { return { browserGuardState: 'ready', installedRuleCount: 0, missingPermissionDomains: [] }; },
    async clearRuntimeState() {},
  },
  eventQueue: { async drain() { return []; }, async ack() { return 0; } },
  now: () => now,
  extensionVersion: '0.3.1',
});
const request = (type, payload = {}, requestId = `request-${type}`) =>
  protocol.createEnvelope(type, requestId, payload, now);

const pong = await handler(request(protocol.MESSAGE_TYPES.PING));
assert.equal(pong.type, protocol.MESSAGE_TYPES.PONG);
assert.equal(pong.payload.sessionState, 'inactive');

const firstSync = await handler(
  request(protocol.MESSAGE_TYPES.SESSION_SYNC, { snapshot }, 'sync-1')
);
assert.equal(firstSync.type, protocol.MESSAGE_TYPES.SESSION_ACK);
assert.equal(firstSync.payload.alreadyApplied, false);
assert.deepEqual(storedSnapshot, snapshot);

const repeatedSync = await handler(
  request(protocol.MESSAGE_TYPES.SESSION_SYNC, { snapshot }, 'sync-2')
);
assert.equal(repeatedSync.payload.alreadyApplied, true);

const restartedHandler = sessionStore.createMessageHandler({
  storage,
  engine: {
    async reconcile() { return { browserGuardState: 'ready', installedRuleCount: 0, missingPermissionDomains: [] }; },
    async clearRuntimeState() {},
  },
  eventQueue: { async drain() { return []; }, async ack() { return 0; } },
  now: () => now,
  extensionVersion: '0.3.1',
});
const statusAfterWorkerRestart = await restartedHandler(
  request(protocol.MESSAGE_TYPES.STATUS_REQUEST, {}, 'worker-restart')
);
assert.equal(statusAfterWorkerRestart.payload.sessionState, 'active');
assert.equal(statusAfterWorkerRestart.payload.guardSessionId, snapshot.guardSessionId);

const validBeforeInvalid = structuredClone(storedSnapshot);
const malformedEnvelope = await handler({
  channel: protocol.CHANNEL,
  protocolVersion: protocol.PROTOCOL_VERSION,
  type: protocol.MESSAGE_TYPES.PING,
  payload: {},
  sentAt: now,
});
assert.equal(malformedEnvelope.type, protocol.MESSAGE_TYPES.ERROR);
assert.equal(malformedEnvelope.payload.code, 'MALFORMED_ENVELOPE');
assert.deepEqual(storedSnapshot, validBeforeInvalid);

const unsupported = await handler({
  ...request(protocol.MESSAGE_TYPES.PING, {}, 'unsupported'),
  protocolVersion: 99,
});
assert.equal(unsupported.payload.code, 'UNSUPPORTED_PROTOCOL');

const unknown = await handler(request('ARBITRARY_COMMAND', {}, 'unknown'));
assert.equal(unknown.payload.code, 'UNKNOWN_MESSAGE');

const oversizedTarget = {
  ...snapshot,
  targetLabel: 'x'.repeat(161),
};
const boundedString = await handler(
  request(
    protocol.MESSAGE_TYPES.SESSION_SYNC,
    { snapshot: oversizedTarget },
    'oversized-string'
  )
);
assert.equal(boundedString.payload.code, 'INVALID_PAYLOAD');
assert.deepEqual(storedSnapshot, validBeforeInvalid);

const tooManyRules = {
  ...snapshot,
  websiteRules: Array.from({ length: 101 }, (_, index) => ({
    id: `rule-${index}`,
    pattern: `site-${index}.test`,
    matchType: 'domain',
    action: 'block',
  })),
};
const boundedRules = await handler(
  request(
    protocol.MESSAGE_TYPES.SESSION_SYNC,
    { snapshot: tooManyRules },
    'too-many-rules'
  )
);
assert.equal(boundedRules.payload.code, 'INVALID_PAYLOAD');
assert.deepEqual(storedSnapshot, validBeforeInvalid);

const expiredSnapshot = {
  ...snapshot,
  updatedAt: now - 4_000,
  expiresAt: now - 1,
};
const expired = await handler(
  request(
    protocol.MESSAGE_TYPES.SESSION_SYNC,
    { snapshot: expiredSnapshot },
    'expired'
  )
);
assert.equal(expired.payload.code, 'SNAPSHOT_EXPIRED');
assert.deepEqual(storedSnapshot, validBeforeInvalid);

const firstClear = await handler(
  request(
    protocol.MESSAGE_TYPES.SESSION_CLEAR,
    { guardSessionId: snapshot.guardSessionId },
    'clear-1'
  )
);
assert.equal(firstClear.payload.cleared, true);
assert.equal(storedSnapshot, null);

const repeatedClear = await handler(
  request(
    protocol.MESSAGE_TYPES.SESSION_CLEAR,
    { guardSessionId: snapshot.guardSessionId },
    'clear-2'
  )
);
assert.equal(repeatedClear.payload.alreadyApplied, true);
assert.equal(storedSnapshot, null);

const pausedSnapshot = webBridge.createSanitizedFocusGuardSnapshot(
  {
    ...baseGuardSession,
    status: 'paused',
    pausedAt: now,
    pausedRemainingSeconds: 900,
  },
  now
);
assert.equal(pausedSnapshot.status, 'paused');
assert.equal(pausedSnapshot.expectedEndAt, undefined);
assert.equal(pausedSnapshot.pausedRemainingSeconds, 900);

console.log(
  'Phase 7 deterministic harness passed: directional message filtering, protocol, liveness hysteresis/recovery, pending cleanup, bounds, privacy, expiry, idempotency, worker restart, and state preservation.'
);
