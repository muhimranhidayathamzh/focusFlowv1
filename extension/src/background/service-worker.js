'use strict';

importScripts(
  '../shared/protocol.js',
  './event-queue.js',
  './browser-guard.js',
  './guard-engine.js',
  './session-store.js'
);

const protocol = globalThis.FocusFlowBridgeProtocol;
const eventQueueModule = globalThis.FocusFlowEventQueue;
const engineModule = globalThis.FocusFlowGuardEngine;

function sessionValue(key) {
  return {
    get: () => chrome.storage.session.get(key).then((result) => result[key] ?? null),
    set: (value) => chrome.storage.session.set({ [key]: value }),
    remove: () => chrome.storage.session.remove(key),
  };
}

const snapshotStorage = sessionValue(protocol.SESSION_STORAGE_KEY);
const configStorage = sessionValue(protocol.CONFIG_STORAGE_KEY);
const eventQueue = eventQueueModule.createEventQueue(
  sessionValue('focusflow-pending-events-v1')
);
const engine = engineModule.createGuardEngine({
  snapshotStorage,
  contextStorage: sessionValue('focusflow-rule-contexts-v1'),
  bypassStorage: sessionValue('focusflow-active-bypasses-v1'),
  challengeStorage: sessionValue('focusflow-bypass-challenge-v1'),
  permissions: {
    contains: (request) => chrome.permissions.contains(request),
  },
  dnr: {
    getSessionRules: () => chrome.declarativeNetRequest.getSessionRules(),
    updateSessionRules: (request) => chrome.declarativeNetRequest.updateSessionRules(request),
  },
  alarms: {
    create: async (name, info) => chrome.alarms.create(name, info),
    clear: (name) => chrome.alarms.clear(name),
  },
  runtimeUrl: (path) => chrome.runtime.getURL(path),
  eventQueue,
});

const handlePageMessage = globalThis.FocusFlowSessionStore.createMessageHandler({
  storage: snapshotStorage,
  configStorage,
  engine,
  eventQueue,
  now: () => Date.now(),
  extensionVersion: chrome.runtime.getManifest().version,
});

async function handleInternalMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return { ok: false, error: 'Invalid internal message.' };
  }
  try {
    if (message.internalType === 'FOCUSFLOW_INTERVENTION_OPENED') {
      return { ok: true, context: await engine.interventionOpened(message.ruleToken, message.attemptId) };
    }
    if (message.internalType === 'FOCUSFLOW_BYPASS_PREPARE') {
      return { ok: true, challenge: await engine.prepareBypass(message.ruleToken, message.guardSessionId) };
    }
    if (message.internalType === 'FOCUSFLOW_BYPASS_ACTIVATE') {
      return { ok: true, bypass: await engine.activateBypass(message) };
    }
    if (message.internalType === 'FOCUSFLOW_RECONCILE') {
      return { ok: true, status: await engine.reconcile() };
    }
    if (message.internalType === 'FOCUSFLOW_POPUP_STATUS') {
      const config = await configStorage.get();
      const snapshot = await engine.getSnapshot();
      const status = await engine.reconcile();
      const origins = Array.isArray(config?.requiredOrigins) ? config.requiredOrigins : [];
      const permissionStates = [];
      for (const origin of origins) {
        permissionStates.push({ origin, granted: await chrome.permissions.contains({ origins: [origin] }) });
      }
      return {
        ok: true, config, activeProfile: snapshot?.profile || null, status,
        permissionStates,
        activeBypassCount: status.browserGuardState === 'bypass-active' ? 1 : 0,
      };
    }
    if (message.internalType === 'FOCUSFLOW_RECOVERY_CLEAR') {
      await snapshotStorage.remove();
      await engine.clearRuntimeState();
      return { ok: true, status: await engine.reconcile() };
    }
    return { ok: false, error: 'Unknown internal message.' };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Extension operation failed.' };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id && sender.id !== chrome.runtime.id) return false;
  const task = message?.channel === protocol.CHANNEL
    ? handlePageMessage(message)
    : handleInternalMessage(message);
  void task.then(sendResponse);
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === engineModule.SNAPSHOT_ALARM || alarm.name === engineModule.BYPASS_ALARM) {
    void engine.reconcile();
  }
});

chrome.permissions.onAdded.addListener(() => void engine.reconcile());
chrome.permissions.onRemoved.addListener(() => void engine.reconcile());
chrome.runtime.onStartup.addListener(() => void engine.reconcile());
chrome.runtime.onInstalled.addListener(() => void engine.reconcile());
void engine.reconcile();
