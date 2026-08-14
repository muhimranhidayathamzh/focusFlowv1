(function initializeFocusFlowEventQueue(globalScope) {
  'use strict';

  const MAX_EVENTS = 100;
  const EVENT_TTL_MS = 24 * 60 * 60 * 1000;

  function normalizeEvent(value, now) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const type = value.type;
    if (type !== 'blocked-site' && type !== 'emergency-bypass') return null;
    const requiredStrings = [
      'id', 'guardSessionId', 'configuredRuleId',
      'configuredRuleLabel', 'configuredRuleDomain',
    ];
    for (const key of requiredStrings) {
      if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 160) return null;
    }
    if (!Number.isFinite(value.occurredAt) || value.occurredAt < 0 || now - value.occurredAt > EVENT_TTL_MS) return null;
    if (value.note !== undefined && (typeof value.note !== 'string' || !value.note.trim() || value.note.length > 200)) return null;
    if (value.bypassExpiresAt !== undefined && (!Number.isFinite(value.bypassExpiresAt) || value.bypassExpiresAt < value.occurredAt)) return null;
    return {
      id: value.id.trim(), guardSessionId: value.guardSessionId.trim(),
      occurredAt: value.occurredAt, type,
      configuredRuleId: value.configuredRuleId.trim(),
      configuredRuleLabel: value.configuredRuleLabel.trim(),
      configuredRuleDomain: value.configuredRuleDomain.trim(),
      ...(value.note ? { note: value.note.trim() } : {}),
      ...(value.bypassExpiresAt ? { bypassExpiresAt: value.bypassExpiresAt } : {}),
    };
  }

  function createEventQueue(storage, now = () => Date.now()) {
    async function read() {
      const raw = await storage.get();
      const source = Array.isArray(raw) ? raw : [];
      const seen = new Set();
      const events = [];
      for (const item of source) {
        const normalized = normalizeEvent(item, now());
        if (normalized && !seen.has(normalized.id)) {
          seen.add(normalized.id);
          events.push(normalized);
        }
      }
      return events.slice(-MAX_EVENTS);
    }
    async function enqueue(event) {
      const normalized = normalizeEvent(event, now());
      if (!normalized) return null;
      const current = await read();
      const existing = current.find((item) => item.id === normalized.id);
      if (existing) return existing;
      await storage.set([...current, normalized].slice(-MAX_EVENTS));
      return normalized;
    }
    async function drain() { return read(); }
    async function ack(ids) {
      const idSet = new Set(ids);
      const current = await read();
      const next = current.filter((event) => !idSet.has(event.id));
      if (next.length !== current.length) await storage.set(next);
      return current.length - next.length;
    }
    async function clearSession(guardSessionId) {
      const current = await read();
      await storage.set(current.filter((event) => event.guardSessionId !== guardSessionId));
    }
    return { enqueue, drain, ack, clearSession };
  }

  globalScope.FocusFlowEventQueue = Object.freeze({
    MAX_EVENTS, EVENT_TTL_MS, normalizeEvent, createEventQueue,
  });
})(globalThis);
