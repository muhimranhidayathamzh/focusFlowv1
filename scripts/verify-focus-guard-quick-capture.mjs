import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

for (const relativePath of [
  '../extension/src/shared/protocol.js',
  '../extension/src/background/capture-queue.js',
  '../extension/src/background/session-store.js',
]) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  vm.runInThisContext(source, { filename: relativePath });
}

const protocol = globalThis.FocusFlowBridgeProtocol;
const captureQueueModule = globalThis.FocusFlowCaptureQueue;
const sessionStore = globalThis.FocusFlowSessionStore;
const now = Date.now();

let storedCaptures = null;
const captureStorage = {
  async get() {
    return structuredClone(storedCaptures);
  },
  async set(value) {
    storedCaptures = structuredClone(value);
  },
};
const captureQueue = captureQueueModule.createCaptureQueue(
  captureStorage,
  () => now
);

assert.equal(
  await captureQueue.enqueue({
    id: 'blank',
    text: '   ',
    capturedAt: now,
  }),
  null
);
assert.equal(
  await captureQueue.enqueue({
    id: 'too-long',
    text: 'x'.repeat(301),
    capturedAt: now,
  }),
  null
);

const generalCapture = await captureQueue.enqueue({
  id: 'capture-general',
  text: '  Cek harga laptop nanti  ',
  capturedAt: now,
});
assert.deepEqual(generalCapture, {
  id: 'capture-general',
  text: 'Cek harga laptop nanti',
  capturedAt: now,
});

const sessionCapture = await captureQueue.enqueue({
  id: 'capture-session',
  text: 'Balas pesan setelah fokus',
  capturedAt: now,
  guardSessionId: 'guard-1',
  url: 'https://private.example/path',
  title: 'Private tab title',
});
assert.deepEqual(sessionCapture, {
  id: 'capture-session',
  text: 'Balas pesan setelah fokus',
  capturedAt: now,
  guardSessionId: 'guard-1',
});
assert.deepEqual(
  await captureQueue.enqueue({
    id: 'capture-session',
    text: 'Duplikat harus diabaikan',
    capturedAt: now,
  }),
  sessionCapture
);

await Promise.all(
  Array.from({ length: 55 }, (_, index) =>
    captureQueue.enqueue({
      id: `bounded-${index}`,
      text: `Capture ${index}`,
      capturedAt: now,
    })
  )
);
const boundedCaptures = await captureQueue.drain();
assert.equal(boundedCaptures.length, protocol.MAX_CAPTURE_ITEMS);
assert.equal(boundedCaptures.at(-1).id, 'bounded-54');
assert.equal(new Set(boundedCaptures.map((item) => item.id)).size, 50);

storedCaptures = [
  {
    id: 'expired',
    text: 'Expired capture',
    capturedAt: now - protocol.CAPTURE_TTL_MS - 1,
  },
  {
    id: 'fresh',
    text: 'Fresh capture',
    capturedAt: now,
  },
];
assert.deepEqual(await captureQueue.drain(), [
  { id: 'fresh', text: 'Fresh capture', capturedAt: now },
]);
assert.deepEqual(storedCaptures, [
  { id: 'fresh', text: 'Fresh capture', capturedAt: now },
]);

const captureJson = JSON.stringify(storedCaptures).toLowerCase();
for (const forbidden of [
  'url',
  'title',
  'history',
  'pagecontent',
  'clipboard',
  'keystroke',
]) {
  assert.equal(captureJson.includes(forbidden), false, forbidden);
}

let storedSnapshot = null;
const snapshotStorage = {
  async get() {
    return storedSnapshot;
  },
  async set(value) {
    storedSnapshot = structuredClone(value);
  },
  async remove() {
    storedSnapshot = null;
  },
};
const handler = sessionStore.createMessageHandler({
  storage: snapshotStorage,
  configStorage: { async get() { return null; }, async set() {} },
  engine: {
    async reconcile() {
      return {
        browserGuardState: 'inactive',
        installedRuleCount: 0,
        missingPermissionDomains: [],
      };
    },
    async clearRuntimeState() {},
  },
  eventQueue: { async drain() { return []; }, async ack() { return 0; } },
  captureQueue,
  now: () => now,
  extensionVersion: protocol.EXTENSION_VERSION,
});
const request = (type, payload = {}, id = `request-${type}`) =>
  protocol.createEnvelope(type, id, payload, now);

const batch = await handler(
  request(protocol.MESSAGE_TYPES.CAPTURE_DRAIN, {}, 'capture-drain')
);
assert.equal(batch.type, protocol.MESSAGE_TYPES.CAPTURE_BATCH);
assert.equal(batch.payload.captures.length, 1);
assert.equal(
  protocol.validateExtensionResponseEnvelope(batch).ok,
  true
);

const acknowledged = await handler(
  request(
    protocol.MESSAGE_TYPES.CAPTURE_ACK,
    { captureIds: ['fresh'] },
    'capture-ack'
  )
);
assert.equal(
  acknowledged.type,
  protocol.MESSAGE_TYPES.CAPTURE_ACKNOWLEDGED
);
assert.equal(acknowledged.payload.acknowledgedCount, 1);
assert.equal((await captureQueue.drain()).length, 0);

const invalidAck = protocol.validatePageRequestEnvelope(
  request(protocol.MESSAGE_TYPES.CAPTURE_ACK, {
    captureIds: ['duplicate', 'duplicate'],
  }),
  now
);
assert.equal(invalidAck.ok, false);
assert.equal(invalidAck.code, 'INVALID_PAYLOAD');

const manifest = JSON.parse(
  await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8')
);
assert.equal(manifest.version, '0.4.0');
assert.equal(manifest.permissions.includes('sidePanel'), true);
assert.equal(manifest.permissions.includes('tabs'), false);
assert.equal(
  manifest.side_panel.default_path,
  'src/sidepanel/index.html'
);
assert.equal(
  manifest.commands['quick-capture'].suggested_key.default,
  'Alt+Shift+D'
);

for (const relativePath of [
  '../extension/src/sidepanel/sidepanel.js',
  '../extension/src/popup/popup.js',
  '../extension/src/intervention/intervention.js',
]) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  assert.match(source, /FOCUSFLOW_CAPTURE_ADD/);
  assert.match(source, /captureId/);
  assert.doesNotMatch(source, /document\.title|location\.href|clipboard/i);
}

const serviceWorkerSource = await readFile(
  new URL('../extension/src/background/service-worker.js', import.meta.url),
  'utf8'
);
assert.match(serviceWorkerSource, /requestedId \|\|/);
assert.match(serviceWorkerSource, /captureQueue\.enqueue/);

console.log(
  'Focus Guard Quick Capture harness passed: validation, persistence, serialization, cap/TTL, dedupe, drain/ack, privacy, side panel, popup, and intervention entry points.'
);
