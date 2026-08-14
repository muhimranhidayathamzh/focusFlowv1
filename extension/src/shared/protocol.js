(function initializeFocusFlowBridgeProtocol(globalScope) {
  'use strict';

  const CHANNEL = 'focusflow-extension-bridge';
  const PROTOCOL_VERSION = 3;
  const SNAPSHOT_SCHEMA_VERSION = 3;
  const EXTENSION_VERSION = '0.3.1';
  const SESSION_STORAGE_KEY = 'focusflow-active-protected-session-v3';
  const CONFIG_STORAGE_KEY = 'focusflow-selected-profile-config-v1';
  const MAX_ENVELOPE_BYTES = 32 * 1024;
  const MAX_RULES = 100;
  const ALLOWED_FOCUSFLOW_ORIGINS = new Set([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://focusflow-fawn-ten.vercel.app',
  ]);

  const MESSAGE_TYPES = Object.freeze({
    PING: 'FOCUSFLOW_BRIDGE_PING',
    SESSION_SYNC: 'FOCUSFLOW_SESSION_SYNC',
    SESSION_CLEAR: 'FOCUSFLOW_SESSION_CLEAR',
    STATUS_REQUEST: 'FOCUSFLOW_STATUS_REQUEST',
    EVENT_DRAIN: 'FOCUSFLOW_EVENT_DRAIN',
    EVENT_ACK: 'FOCUSFLOW_EVENT_ACK',
    CONFIG_SYNC: 'FOCUSFLOW_CONFIG_SYNC',
    READY: 'FOCUSFLOW_BRIDGE_READY',
    PONG: 'FOCUSFLOW_BRIDGE_PONG',
    SESSION_ACK: 'FOCUSFLOW_SESSION_ACK',
    EXTENSION_STATUS: 'FOCUSFLOW_EXTENSION_STATUS',
    EVENT_BATCH: 'FOCUSFLOW_EVENT_BATCH',
    EVENT_ACKNOWLEDGED: 'FOCUSFLOW_EVENT_ACKNOWLEDGED',
    CONFIG_ACK: 'FOCUSFLOW_CONFIG_ACK',
    ERROR: 'FOCUSFLOW_BRIDGE_ERROR',
  });

  const REQUEST_TYPES = new Set([
    MESSAGE_TYPES.PING,
    MESSAGE_TYPES.SESSION_SYNC,
    MESSAGE_TYPES.SESSION_CLEAR,
    MESSAGE_TYPES.STATUS_REQUEST,
    MESSAGE_TYPES.EVENT_DRAIN,
    MESSAGE_TYPES.EVENT_ACK,
    MESSAGE_TYPES.CONFIG_SYNC,
  ]);
  const RESPONSE_TYPES = new Set([
    MESSAGE_TYPES.READY,
    MESSAGE_TYPES.PONG,
    MESSAGE_TYPES.SESSION_ACK,
    MESSAGE_TYPES.EXTENSION_STATUS,
    MESSAGE_TYPES.EVENT_BATCH,
    MESSAGE_TYPES.EVENT_ACKNOWLEDGED,
    MESSAGE_TYPES.CONFIG_ACK,
    MESSAGE_TYPES.ERROR,
  ]);

  function isRecord(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function isTimestamp(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  }

  function normalizeString(value, maximumLength, optional) {
    if (value === undefined || value === null) return optional ? undefined : null;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized || normalized.length > maximumLength) return null;
    return normalized;
  }

  function serializedSize(value) {
    try {
      return new TextEncoder().encode(JSON.stringify(value)).byteLength;
    } catch {
      return Number.POSITIVE_INFINITY;
    }
  }

  function normalizeWebsiteRule(value) {
    if (!isRecord(value)) return null;
    const id = normalizeString(value.id, 160, false);
    const pattern = normalizeString(value.pattern, 2048, false);
    const label = normalizeString(value.label, 160, true);
    if (
      !id ||
      !pattern ||
      label === null ||
      !['domain', 'url-prefix', 'url-pattern'].includes(value.matchType) ||
      !['block', 'allow'].includes(value.action)
    ) return null;
    return { id, pattern, matchType: value.matchType, action: value.action, ...(label ? { label } : {}) };
  }

  function normalizeSessionSnapshot(value, now) {
    if (!isRecord(value) || value.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Snapshot schema is invalid.' };
    }
    const guardSessionId = normalizeString(value.guardSessionId, 160, false);
    const timerRunId = normalizeString(value.timerRunId, 160, false);
    const targetLabel = normalizeString(value.targetLabel, 160, false);
    if (!isRecord(value.profile) || !isRecord(value.bypass)) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Profile snapshot is invalid.' };
    }
    const profileId = normalizeString(value.profile.id, 160, false);
    const profileDisplayName = normalizeString(value.profile.displayName, 80, false);
    const focusFlowOrigin = normalizeString(value.focusFlowOrigin, 80, false);
    if (
      !guardSessionId || !timerRunId || !targetLabel || !profileId ||
      !profileDisplayName || !focusFlowOrigin ||
      !ALLOWED_FOCUSFLOW_ORIGINS.has(focusFlowOrigin) ||
      !['active', 'paused'].includes(value.status) ||
      !['light', 'medium', 'strict'].includes(value.protectionLevel) ||
      typeof value.bypass.allowed !== 'boolean' ||
      !Number.isInteger(value.bypass.delaySeconds) || value.bypass.delaySeconds < 0 || value.bypass.delaySeconds > 300 ||
      !Number.isInteger(value.bypass.durationMinutes) || value.bypass.durationMinutes < 1 || value.bypass.durationMinutes > 60 ||
      typeof value.bypass.requireReason !== 'boolean' ||
      !isTimestamp(value.startedAt) || !isTimestamp(value.updatedAt) ||
      !isTimestamp(value.expiresAt) || value.updatedAt < value.startedAt ||
      value.expiresAt <= value.updatedAt
    ) return { ok: false, code: 'INVALID_PAYLOAD', message: 'Snapshot fields are invalid.' };
    if (value.expiresAt <= now) {
      return { ok: false, code: 'SNAPSHOT_EXPIRED', message: 'Snapshot has expired.' };
    }
    if (!Array.isArray(value.websiteRules) || value.websiteRules.length > MAX_RULES) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Website rules are invalid.' };
    }
    const websiteRules = [];
    const ruleIds = new Set();
    for (const rawRule of value.websiteRules) {
      const rule = normalizeWebsiteRule(rawRule);
      if (!rule || ruleIds.has(rule.id)) {
        return { ok: false, code: 'INVALID_PAYLOAD', message: 'Website rule is malformed or duplicated.' };
      }
      ruleIds.add(rule.id);
      websiteRules.push(rule);
    }
    const base = {
      schemaVersion: SNAPSHOT_SCHEMA_VERSION, guardSessionId, timerRunId,
      status: value.status, targetLabel, protectionLevel: value.protectionLevel,
      profile: { id: profileId, displayName: profileDisplayName },
      focusFlowOrigin,
      bypass: {
        allowed: value.bypass.allowed,
        delaySeconds: value.bypass.delaySeconds,
        durationMinutes: value.bypass.durationMinutes,
        requireReason: value.bypass.requireReason,
      },
      websiteRules, startedAt: value.startedAt, updatedAt: value.updatedAt,
      expiresAt: value.expiresAt,
    };
    if (value.status === 'active') {
      if (!isTimestamp(value.expectedEndAt) || value.expectedEndAt <= now ||
        value.expectedEndAt < value.startedAt || value.expiresAt > value.expectedEndAt ||
        value.pausedRemainingSeconds !== undefined) {
        return { ok: false, code: 'SNAPSHOT_EXPIRED', message: 'Active snapshot deadline is invalid or expired.' };
      }
      return { ok: true, snapshot: { ...base, status: 'active', expectedEndAt: value.expectedEndAt } };
    }
    if (!Number.isInteger(value.pausedRemainingSeconds) || value.pausedRemainingSeconds < 0 ||
      value.pausedRemainingSeconds > 86400 || value.expectedEndAt !== undefined) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Paused snapshot timing is invalid.' };
    }
    return { ok: true, snapshot: { ...base, status: 'paused', pausedRemainingSeconds: value.pausedRemainingSeconds } };
  }

  function normalizeProfileConfig(value) {
    if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.profile) || !isRecord(value.bypass)) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Profile config schema is invalid.' };
    }
    const id = normalizeString(value.profile.id, 160, false);
    const displayName = normalizeString(value.profile.displayName, 80, false);
    if (!id || !displayName || !['light', 'medium', 'strict'].includes(value.profile.protectionLevel) ||
      typeof value.bypass.allowed !== 'boolean' || !Number.isInteger(value.bypass.delaySeconds) ||
      value.bypass.delaySeconds < 0 || value.bypass.delaySeconds > 300 ||
      !Number.isInteger(value.bypass.durationMinutes) || value.bypass.durationMinutes < 1 ||
      value.bypass.durationMinutes > 60 || typeof value.bypass.requireReason !== 'boolean' ||
      !isTimestamp(value.updatedAt) || !Array.isArray(value.websiteRules) ||
      value.websiteRules.length > MAX_RULES || !Array.isArray(value.requiredOrigins) ||
      value.requiredOrigins.length > MAX_RULES * 2) {
      return { ok: false, code: 'INVALID_PAYLOAD', message: 'Profile config fields are invalid.' };
    }
    const rules = [];
    const ids = new Set();
    for (const rawRule of value.websiteRules) {
      const rule = normalizeWebsiteRule(rawRule);
      if (!rule || ids.has(rule.id)) return { ok: false, code: 'INVALID_PAYLOAD', message: 'Profile config rules are invalid.' };
      ids.add(rule.id);
      rules.push(rule);
    }
    const origins = [];
    const seenOrigins = new Set();
    for (const rawOrigin of value.requiredOrigins) {
      const origin = normalizeString(rawOrigin, 300, false);
      if (!origin || !/^(?:https?|\*):\/\/(?:\*\.)?[a-z0-9.-]+\/\*$/.test(origin) ||
        origin.includes('localhost') || origin.includes('127.0.0.1') ||
        origin.includes('focusflow-fawn-ten.vercel.app') || seenOrigins.has(origin)) {
        return { ok: false, code: 'INVALID_PAYLOAD', message: 'Required origins are invalid.' };
      }
      seenOrigins.add(origin);
      origins.push(origin);
    }
    return { ok: true, config: {
      schemaVersion: 1,
      profile: { id, displayName, protectionLevel: value.profile.protectionLevel },
      websiteRules: rules,
      requiredOrigins: origins.sort(),
      bypass: {
        allowed: value.bypass.allowed, delaySeconds: value.bypass.delaySeconds,
        durationMinutes: value.bypass.durationMinutes, requireReason: value.bypass.requireReason,
      },
      updatedAt: value.updatedAt,
    } };
  }

  function errorResult(raw, code, message) {
    const requestId = isRecord(raw) ? normalizeString(raw.requestId, 128, true) : undefined;
    return { ok: false, code, message, requestId: requestId || undefined };
  }

  function validateBaseEnvelope(raw, allowedTypes) {
    if (!isRecord(raw) || serializedSize(raw) > MAX_ENVELOPE_BYTES) return errorResult(raw, 'MALFORMED_ENVELOPE', 'Envelope is malformed or too large.');
    if (raw.channel !== CHANNEL) return errorResult(raw, 'MALFORMED_ENVELOPE', 'Bridge channel is invalid.');
    if (raw.protocolVersion !== PROTOCOL_VERSION) return errorResult(raw, 'UNSUPPORTED_PROTOCOL', 'Bridge protocol version is unsupported.');
    const requestId = normalizeString(raw.requestId, 128, false);
    if (!requestId || (raw.sentAt !== undefined && !isTimestamp(raw.sentAt))) return errorResult(raw, 'MALFORMED_ENVELOPE', 'Request metadata is invalid.');
    if (typeof raw.type !== 'string' || !allowedTypes.has(raw.type)) return errorResult(raw, 'UNKNOWN_MESSAGE', 'Message type is not allowlisted.');
    if (raw.payload !== undefined && !isRecord(raw.payload)) return errorResult(raw, 'INVALID_PAYLOAD', 'Message payload must be an object.');
    return { ok: true, requestId };
  }

  function validatePageRequestEnvelope(raw, now) {
    const base = validateBaseEnvelope(raw, REQUEST_TYPES);
    if (!base.ok) return base;
    const payload = raw.payload || {};
    if (raw.type === MESSAGE_TYPES.PING) {
      const pageVersion = normalizeString(payload.pageVersion, 32, true);
      if (pageVersion === null) return errorResult(raw, 'INVALID_PAYLOAD', 'Page version is invalid.');
      return { ok: true, envelope: { ...raw, payload: pageVersion ? { pageVersion } : {} } };
    }
    if (raw.type === MESSAGE_TYPES.STATUS_REQUEST || raw.type === MESSAGE_TYPES.EVENT_DRAIN) return { ok: true, envelope: { ...raw, payload: {} } };
    if (raw.type === MESSAGE_TYPES.EVENT_ACK) {
      if (!Array.isArray(payload.eventIds) || payload.eventIds.length > 100) return errorResult(raw, 'INVALID_PAYLOAD', 'Event acknowledgment is invalid.');
      const eventIds = payload.eventIds.map((id) => normalizeString(id, 160, false));
      if (eventIds.some((id) => !id) || new Set(eventIds).size !== eventIds.length) return errorResult(raw, 'INVALID_PAYLOAD', 'Event acknowledgment IDs are invalid.');
      return { ok: true, envelope: { ...raw, payload: { eventIds } } };
    }
    if (raw.type === MESSAGE_TYPES.CONFIG_SYNC) {
      const normalizedConfig = normalizeProfileConfig(payload.config);
      if (!normalizedConfig.ok) return errorResult(raw, normalizedConfig.code, normalizedConfig.message);
      return { ok: true, envelope: { ...raw, payload: { config: normalizedConfig.config } } };
    }
    if (raw.type === MESSAGE_TYPES.SESSION_CLEAR) {
      const guardSessionId = normalizeString(payload.guardSessionId, 160, true);
      if (guardSessionId === null) return errorResult(raw, 'INVALID_PAYLOAD', 'Clear session ID is invalid.');
      return { ok: true, envelope: { ...raw, payload: guardSessionId ? { guardSessionId } : {} } };
    }
    const normalizedSnapshot = normalizeSessionSnapshot(payload.snapshot, now);
    if (!normalizedSnapshot.ok) return errorResult(raw, normalizedSnapshot.code, normalizedSnapshot.message);
    return { ok: true, envelope: { ...raw, payload: { snapshot: normalizedSnapshot.snapshot } } };
  }

  function validateExtensionResponseEnvelope(raw) {
    const base = validateBaseEnvelope(raw, RESPONSE_TYPES);
    if (!base.ok) return base;
    const payload = raw.payload || {};
    if (raw.type === MESSAGE_TYPES.ERROR) {
      if (!normalizeString(payload.code, 64, false) || !normalizeString(payload.message, 240, false)) return errorResult(raw, 'INVALID_PAYLOAD', 'Error response is invalid.');
    } else if (!normalizeString(payload.extensionVersion, 32, false) ||
      payload.protocolVersion !== PROTOCOL_VERSION || payload.snapshotSchemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
      return errorResult(raw, 'INVALID_PAYLOAD', 'Extension version response is invalid.');
    }
    return { ok: true, envelope: raw };
  }

  function createEnvelope(type, requestId, payload, sentAt) {
    return { channel: CHANNEL, protocolVersion: PROTOCOL_VERSION, type, requestId, payload: payload || {}, sentAt: sentAt === undefined ? Date.now() : sentAt };
  }
  function createErrorEnvelope(requestId, code, message) { return createEnvelope(MESSAGE_TYPES.ERROR, requestId, { code, message }); }

  globalScope.FocusFlowBridgeProtocol = Object.freeze({
    CHANNEL, PROTOCOL_VERSION, SNAPSHOT_SCHEMA_VERSION, EXTENSION_VERSION,
    SESSION_STORAGE_KEY, CONFIG_STORAGE_KEY, MAX_ENVELOPE_BYTES, MESSAGE_TYPES, createEnvelope,
    createErrorEnvelope, normalizeSessionSnapshot, validatePageRequestEnvelope,
    validateExtensionResponseEnvelope, normalizeProfileConfig, normalizeString, isRecord,
  });
})(globalThis);
