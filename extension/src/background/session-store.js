(function initializeFocusFlowSessionStore(globalScope) {
  'use strict';
  const protocol = globalScope.FocusFlowBridgeProtocol;
  if (!protocol) throw new Error('FocusFlow bridge protocol is unavailable.');

  function versionPayload(extensionVersion) {
    return {
      extensionVersion,
      protocolVersion: protocol.PROTOCOL_VERSION,
      snapshotSchemaVersion: protocol.SNAPSHOT_SCHEMA_VERSION,
    };
  }

  function snapshotsEqual(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

  function createMessageHandler(options) {
    const { storage, configStorage, engine, eventQueue, now, extensionVersion = protocol.EXTENSION_VERSION } = options;

    async function getLiveSnapshot() {
      const raw = await storage.get();
      if (!raw) return null;
      const normalized = protocol.normalizeSessionSnapshot(raw, now());
      if (!normalized.ok) {
        await storage.remove();
        await engine.clearRuntimeState();
        return null;
      }
      return normalized.snapshot;
    }

    async function statusPayload(snapshot) {
      const browserStatus = await engine.reconcile();
      return {
        ...versionPayload(extensionVersion), connected: true,
        sessionState: snapshot?.status || 'inactive', ...browserStatus,
        ...(snapshot ? { guardSessionId: snapshot.guardSessionId, expiresAt: snapshot.expiresAt } : {}),
      };
    }

    return async function handleMessage(rawMessage) {
      const checked = protocol.validatePageRequestEnvelope(rawMessage, now());
      if (!checked.ok) return protocol.createErrorEnvelope(checked.requestId || `error-${now()}`, checked.code, checked.message);
      const request = checked.envelope;
      try {
        if (request.type === protocol.MESSAGE_TYPES.PING || request.type === protocol.MESSAGE_TYPES.STATUS_REQUEST) {
          const snapshot = await getLiveSnapshot();
          return protocol.createEnvelope(
            request.type === protocol.MESSAGE_TYPES.PING ? protocol.MESSAGE_TYPES.PONG : protocol.MESSAGE_TYPES.EXTENSION_STATUS,
            request.requestId,
            await statusPayload(snapshot)
          );
        }
        if (request.type === protocol.MESSAGE_TYPES.EVENT_DRAIN) {
          const snapshot = await getLiveSnapshot();
          return protocol.createEnvelope(protocol.MESSAGE_TYPES.EVENT_BATCH, request.requestId, {
            ...(await statusPayload(snapshot)), events: await eventQueue.drain(),
          });
        }
        if (request.type === protocol.MESSAGE_TYPES.EVENT_ACK) {
          const snapshot = await getLiveSnapshot();
          const acknowledgedCount = await eventQueue.ack(request.payload.eventIds);
          return protocol.createEnvelope(protocol.MESSAGE_TYPES.EVENT_ACKNOWLEDGED, request.requestId, {
            ...(await statusPayload(snapshot)), acknowledgedCount,
          });
        }
        if (request.type === protocol.MESSAGE_TYPES.CONFIG_SYNC) {
          const compiler = globalScope.FocusFlowBrowserGuard;
          const config = request.payload.config;
          const compiled = compiler?.compileRuleSet({
            status: 'active',
            protectionLevel:
              config.profile.protectionLevel === 'light'
                ? 'light'
                : config.profile.protectionLevel,
            websiteRules: config.websiteRules,
          });
          const expectedOrigins = compiled?.ok ? compiled.requiredOrigins : null;
          if (
            !expectedOrigins ||
            JSON.stringify(expectedOrigins) !==
              JSON.stringify(config.requiredOrigins)
          ) {
            return protocol.createErrorEnvelope(
              request.requestId,
              'INVALID_CONFIG',
              'Profile config rules and origins are inconsistent.'
            );
          }
          await configStorage.set(request.payload.config);
          const snapshot = await getLiveSnapshot();
          return protocol.createEnvelope(protocol.MESSAGE_TYPES.CONFIG_ACK, request.requestId, {
            ...(await statusPayload(snapshot)), configured: true,
            selectedProfileId: request.payload.config.profile.id,
          });
        }
        if (request.type === protocol.MESSAGE_TYPES.SESSION_SYNC) {
          const snapshot = request.payload.snapshot;
          const current = await getLiveSnapshot();
          const alreadyApplied = Boolean(current && snapshotsEqual(current, snapshot));
          if (!alreadyApplied) await storage.set(snapshot);
          return protocol.createEnvelope(protocol.MESSAGE_TYPES.SESSION_ACK, request.requestId, {
            ...(await statusPayload(snapshot)), action: 'sync', stored: true, alreadyApplied,
          });
        }
        const current = await getLiveSnapshot();
        const requestedSessionId = request.payload.guardSessionId;
        const currentPreserved = Boolean(current && requestedSessionId && current.guardSessionId !== requestedSessionId);
        if (current && !currentPreserved) {
          await storage.remove();
          await engine.clearRuntimeState();
        }
        const remaining = currentPreserved ? current : null;
        return protocol.createEnvelope(protocol.MESSAGE_TYPES.SESSION_ACK, request.requestId, {
          ...(await statusPayload(remaining)), action: 'clear', stored: Boolean(remaining),
          alreadyApplied: !current, cleared: Boolean(current && !currentPreserved), currentPreserved,
        });
      } catch {
        return protocol.createErrorEnvelope(request.requestId, 'EXTENSION_STATE_FAILED', 'Temporary extension state could not be reconciled.');
      }
    };
  }

  globalScope.FocusFlowSessionStore = Object.freeze({ createMessageHandler });
})(globalThis);
