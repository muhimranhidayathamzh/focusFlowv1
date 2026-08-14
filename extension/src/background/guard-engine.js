(function initializeFocusFlowGuardEngine(globalScope) {
  'use strict';

  const protocol = globalScope.FocusFlowBridgeProtocol;
  const compiler = globalScope.FocusFlowBrowserGuard;
  const SNAPSHOT_ALARM = 'focusflow:snapshot-expiry';
  const BYPASS_ALARM = 'focusflow:bypass-expiry';

  function rulesEqual(left, right) {
    const sort = (items) => [...items].sort((a, b) => a.id - b.id);
    return JSON.stringify(sort(left)) === JSON.stringify(sort(right));
  }

  function createGuardEngine(options) {
    const {
      snapshotStorage, contextStorage, bypassStorage, challengeStorage,
      permissions, dnr, alarms, runtimeUrl, eventQueue, now = () => Date.now(),
    } = options;

    async function getSnapshot() {
      const raw = await snapshotStorage.get();
      if (!raw) return null;
      const normalized = protocol.normalizeSessionSnapshot(raw, now());
      if (!normalized.ok) {
        await snapshotStorage.remove();
        return null;
      }
      return normalized.snapshot;
    }

    async function ownRules() {
      return (await dnr.getSessionRules()).filter((rule) => compiler.isFocusFlowRuleId(rule.id));
    }

    async function applyRules(desiredRules) {
      const current = await ownRules();
      if (rulesEqual(current, desiredRules)) return false;
      await dnr.updateSessionRules({
        removeRuleIds: current.map((rule) => rule.id),
        addRules: desiredRules,
      });
      return true;
    }

    async function clearRuntimeState() {
      await applyRules([]);
      await Promise.all([
        contextStorage.remove(), bypassStorage.remove(), challengeStorage.remove(),
        alarms.clear(SNAPSHOT_ALARM), alarms.clear(BYPASS_ALARM),
      ]);
    }

    async function reconcile() {
      const snapshot = await getSnapshot();
      if (!snapshot) {
        await clearRuntimeState();
        return { browserGuardState: 'inactive', installedRuleCount: 0, missingPermissionDomains: [] };
      }
      await alarms.create(SNAPSHOT_ALARM, { when: snapshot.expiresAt });
      if (snapshot.status === 'paused') {
        await clearRuntimeState();
        return { browserGuardState: 'protection-paused', installedRuleCount: 0, missingPermissionDomains: [] };
      }
      if (snapshot.protectionLevel === 'light') {
        await clearRuntimeState();
        return { browserGuardState: 'light', installedRuleCount: 0, missingPermissionDomains: [] };
      }

      const compiled = compiler.compileRuleSet(snapshot);
      if (!compiled.ok) {
        await clearRuntimeState();
        return { browserGuardState: 'error', installedRuleCount: 0, missingPermissionDomains: [], errorCode: compiled.error };
      }
      const contexts = compiled.contexts;
      const grantedContexts = [];
      const missingPermissionDomains = [];
      for (const context of contexts) {
        const granted = await permissions.contains({ origins: context.requiredOrigins });
        if (granted) grantedContexts.push(context);
        else missingPermissionDomains.push(context.domain);
      }
      if (missingPermissionDomains.length > 0) {
        await applyRules([]);
        await contextStorage.remove();
        await bypassStorage.remove();
        await challengeStorage.remove();
        await alarms.clear(BYPASS_ALARM);
        return { browserGuardState: 'permission-required', installedRuleCount: 0, missingPermissionDomains: [...new Set(missingPermissionDomains)] };
      }
      await contextStorage.set(grantedContexts);

      const rawBypasses = await bypassStorage.get();
      const bypasses = Array.isArray(rawBypasses)
        ? rawBypasses.filter((item) => item && item.guardSessionId === snapshot.guardSessionId &&
          typeof item.ruleToken === 'string' && Number.isFinite(item.expiresAt) && item.expiresAt > now())
        : [];
      await bypassStorage.set(bypasses);
      const desiredRules = grantedContexts.map((context) =>
        compiler.createSessionRule(
          context,
          runtimeUrl(`src/intervention/index.html?rule=${encodeURIComponent(context.token)}`)
        )
      );
      for (const bypass of bypasses) {
        const context = grantedContexts.find((item) => item.token === bypass.ruleToken);
        if (context) desiredRules.push(compiler.createBypassRule(context));
      }
      await applyRules(desiredRules);
      if (bypasses.length > 0) {
        await alarms.create(BYPASS_ALARM, { when: Math.min(...bypasses.map((item) => item.expiresAt)) });
      } else await alarms.clear(BYPASS_ALARM);

      const blockCount = grantedContexts.filter((context) => context.action === 'block').length;
      return {
        browserGuardState: bypasses.length > 0
          ? 'bypass-active'
          : blockCount > 0
            ? 'protection-active'
            : 'ready',
        installedRuleCount: desiredRules.length,
        missingPermissionDomains,
      };
    }

    async function interventionOpened(ruleToken, attemptId) {
      const snapshot = await getSnapshot();
      if (!snapshot || snapshot.status !== 'active' || snapshot.protectionLevel === 'light') {
        await reconcile();
        return { active: false, focusFlowOrigin: snapshot?.focusFlowOrigin || 'http://localhost:3000' };
      }
      const contexts = await contextStorage.get();
      const context = Array.isArray(contexts) ? contexts.find((item) => item.token === ruleToken && item.action === 'block') : null;
      if (!context) return { active: false, focusFlowOrigin: snapshot.focusFlowOrigin };
      const safeAttemptId = typeof attemptId === 'string' && /^[a-zA-Z0-9-]{8,80}$/.test(attemptId) ? attemptId : null;
      if (!safeAttemptId) throw new Error('Invalid intervention attempt.');
      await eventQueue.enqueue({
        id: `blocked-${snapshot.guardSessionId}-${context.token}-${safeAttemptId}`.slice(0, 160),
        guardSessionId: snapshot.guardSessionId, occurredAt: now(), type: 'blocked-site',
        configuredRuleId: context.configuredRuleId,
        configuredRuleLabel: context.label,
        configuredRuleDomain: context.domain,
      });
      return {
        active: true, guardSessionId: snapshot.guardSessionId,
        targetLabel: snapshot.targetLabel, profileName: snapshot.profile.displayName,
        expectedEndAt: snapshot.expectedEndAt, focusFlowOrigin: snapshot.focusFlowOrigin,
        rule: { token: context.token, label: context.label, domain: context.domain },
        bypass: snapshot.bypass,
      };
    }

    async function prepareBypass(ruleToken, guardSessionId) {
      const snapshot = await getSnapshot();
      const contexts = await contextStorage.get();
      const context = Array.isArray(contexts) ? contexts.find((item) => item.token === ruleToken && item.action === 'block') : null;
      if (!snapshot || snapshot.status !== 'active' || snapshot.guardSessionId !== guardSessionId ||
        !snapshot.bypass.allowed || !context) throw new Error('Bypass is unavailable.');
      const challengeId = globalThis.crypto.randomUUID();
      const challenge = {
        challengeId, guardSessionId, ruleToken,
        createdAt: now(), availableAt: now() + snapshot.bypass.delaySeconds * 1000,
      };
      await challengeStorage.set(challenge);
      return challenge;
    }

    async function activateBypass(input) {
      const snapshot = await getSnapshot();
      const challenge = await challengeStorage.get();
      const contexts = await contextStorage.get();
      const context = Array.isArray(contexts) ? contexts.find((item) => item.token === input.ruleToken && item.action === 'block') : null;
      const reason = typeof input.reason === 'string' ? input.reason.trim().replace(/\s+/g, ' ') : '';
      if (!snapshot || snapshot.status !== 'active' || snapshot.guardSessionId !== input.guardSessionId ||
        !snapshot.bypass.allowed || !context || reason.length > 200 ||
        (snapshot.bypass.requireReason && !reason)) {
        throw new Error('Bypass request is invalid or too early.');
      }
      const rawBypasses = await bypassStorage.get();
      const bypasses = Array.isArray(rawBypasses) ? rawBypasses : [];
      const existing = bypasses.find((item) => item.guardSessionId === snapshot.guardSessionId && item.ruleToken === input.ruleToken && item.expiresAt > now());
      if (existing) return { alreadyApplied: true, expiresAt: existing.expiresAt, domain: context.domain };
      if (!challenge || challenge.challengeId !== input.challengeId ||
        challenge.guardSessionId !== snapshot.guardSessionId || challenge.ruleToken !== input.ruleToken ||
        now() < challenge.availableAt) {
        throw new Error('Bypass request is invalid or too early.');
      }
      const expiresAt = Math.min(
        now() + snapshot.bypass.durationMinutes * 60 * 1000,
        snapshot.expectedEndAt
      );
      const next = { guardSessionId: snapshot.guardSessionId, ruleToken: input.ruleToken, expiresAt };
      await bypassStorage.set([...bypasses.filter((item) => item.expiresAt > now()), next]);
      await challengeStorage.remove();
      await eventQueue.enqueue({
        id: `bypass-${snapshot.guardSessionId}-${context.token}-${challenge.challengeId}`.slice(0, 160),
        guardSessionId: snapshot.guardSessionId, occurredAt: now(), type: 'emergency-bypass',
        configuredRuleId: context.configuredRuleId,
        configuredRuleLabel: context.label,
        configuredRuleDomain: context.domain,
        ...(reason ? { note: reason } : {}), bypassExpiresAt: expiresAt,
      });
      await reconcile();
      return { alreadyApplied: false, expiresAt, domain: context.domain };
    }

    return { getSnapshot, reconcile, clearRuntimeState, interventionOpened, prepareBypass, activateBypass };
  }

  globalScope.FocusFlowGuardEngine = Object.freeze({
    SNAPSHOT_ALARM, BYPASS_ALARM, rulesEqual, createGuardEngine,
  });
})(globalThis);
