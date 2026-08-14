import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

const [bridgeHook, liveness, bridgeContract, persistence, profileConfig, eventQueue, sessions, tasks] = await Promise.all([
  source('src/hooks/useFocusGuardExtensionBridge.ts'),
  source('src/lib/focusGuardExtensionLiveness.ts'),
  source('src/lib/focusGuardExtensionBridge.ts'),
  source('src/lib/focusGuardPersistence.ts'),
  source('src/lib/focusGuardProfileConfig.ts'),
  source('extension/src/background/event-queue.js'),
  source('src/hooks/useFocusSessions.ts'),
  source('src/hooks/useTasks.ts'),
]);

assert.match(liveness, /MAX_PENDING_REQUESTS = 8/);
assert.match(bridgeHook, /pendingRef\.current\.size\s*>=\s*FOCUS_GUARD_EXTENSION_MAX_PENDING_REQUESTS/);
assert.match(bridgeHook, /eventDrainInFlightRef\.current/);
assert.match(bridgeContract, /IDLE_EVENT_DRAIN_MS = 60_000/);
assert.match(bridgeHook, /shouldDrainEventsFrequently/);

assert.match(eventQueue, /MAX_EVENTS = 100/);
assert.match(eventQueue, /EVENT_TTL_MS = 24 \* 60 \* 60 \* 1000/);
assert.match(eventQueue, /slice\(-MAX_EVENTS\)/);

assert.match(persistence, /MAX_HISTORY_ITEMS = 200/);
assert.match(persistence, /MAX_INTERRUPTION_ITEMS = 1_000/);
assert.match(persistence, /MAX_DISTRACTION_ITEMS = 500/);
assert.match(persistence, /MAX_GUARD_STORAGE_PAYLOAD_CHARS = 1_000_000/);
assert.match(persistence, /map\(compactGuardSessionForHistory\)/);
assert.match(persistence, /websiteRules: \[\]/);
assert.match(persistence, /applicationRules: \[\]/);

const importLimitIndex = profileConfig.indexOf('text.length > FOCUS_GUARD_CONFIG_MAX_IMPORT_CHARS');
const parseIndex = profileConfig.indexOf('JSON.parse(text)');
assert.ok(importLimitIndex >= 0 && parseIndex > importLimitIndex);
assert.match(profileConfig, /FOCUS_GUARD_CONFIG_MAX_IMPORT_CHARS = 1_000_000/);

assert.match(sessions, /MAX_FOCUS_SESSION_RECORDS = 2_000/);
assert.match(sessions, /MAX_FOCUS_SESSION_STORAGE_CHARS = 1_000_000/);
assert.match(sessions, /slice\(0, MAX_FOCUS_SESSION_RECORDS\)/);
assert.match(tasks, /MAX_TASK_RECORDS = 500/);
assert.match(tasks, /MAX_TASK_STEPS = 100/);
assert.match(tasks, /MAX_TASK_TEXT_LENGTH = 300/);
assert.match(tasks, /MAX_TASK_STORAGE_CHARS = 1_000_000/);

console.log('FocusFlow resource bounds passed: pending requests, polling cadence, extension queue TTL/cap, Guard storage budget/history compaction, import size, focus-session retention, and task limits.');
