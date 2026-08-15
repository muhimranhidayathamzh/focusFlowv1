(function initializeFocusFlowCaptureQueue(globalScope) {
  'use strict';

  const protocol = globalScope.FocusFlowBridgeProtocol;
  if (!protocol) throw new Error('FocusFlow bridge protocol is unavailable.');

  function createCaptureQueue(storage, now = () => Date.now()) {
    let mutationChain = Promise.resolve();

    function withMutation(task) {
      const result = mutationChain.then(task, task);
      mutationChain = result.then(() => undefined, () => undefined);
      return result;
    }

    async function read() {
      const raw = await storage.get();
      const source = Array.isArray(raw) ? raw : [];
      const captures = [];
      const seen = new Set();

      for (const candidate of source) {
        const normalized = protocol.normalizeQueuedCapture(candidate, now());
        if (normalized && !seen.has(normalized.id)) {
          seen.add(normalized.id);
          captures.push(normalized);
        }
      }

      const bounded = captures.slice(-protocol.MAX_CAPTURE_ITEMS);
      if (JSON.stringify(source) !== JSON.stringify(bounded)) {
        await storage.set(bounded);
      }
      return bounded;
    }

    function enqueue(candidate) {
      return withMutation(async () => {
        const normalized = protocol.normalizeQueuedCapture(candidate, now());
        if (!normalized) return null;
        const current = await read();
        const existing = current.find((item) => item.id === normalized.id);
        if (existing) return existing;
        const next = [...current, normalized].slice(-protocol.MAX_CAPTURE_ITEMS);
        await storage.set(next);
        return normalized;
      });
    }

    async function drain() {
      await mutationChain;
      return read();
    }

    function ack(ids) {
      return withMutation(async () => {
        const idSet = new Set(ids);
        const current = await read();
        const next = current.filter((item) => !idSet.has(item.id));
        if (next.length !== current.length) await storage.set(next);
        return current.length - next.length;
      });
    }

    async function count() {
      await mutationChain;
      return (await read()).length;
    }

    return { enqueue, drain, ack, count };
  }

  globalScope.FocusFlowCaptureQueue = Object.freeze({ createCaptureQueue });
})(globalThis);
