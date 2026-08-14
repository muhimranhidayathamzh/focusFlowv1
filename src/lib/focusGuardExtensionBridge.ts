import type { FocusGuardProfile, FocusGuardSession, WebsiteRule } from '@/types/focusGuard';
import { deriveRuleOrigins, normalizeWebsiteRuleSet } from '@/lib/focusGuardRules';

export const FOCUS_GUARD_EXTENSION_CHANNEL = 'focusflow-extension-bridge';
export const FOCUS_GUARD_EXTENSION_PROTOCOL_VERSION = 3;
export const FOCUS_GUARD_EXTENSION_SNAPSHOT_SCHEMA_VERSION = 3;
export const FOCUS_GUARD_EXTENSION_HEARTBEAT_MS = 12_000;
export const FOCUS_GUARD_EXTENSION_IDLE_EVENT_DRAIN_MS = 60_000;
export const FOCUS_GUARD_EXTENSION_EXPIRY_MS = 35_000;
export const FOCUS_GUARD_EXTENSION_MAX_ENVELOPE_BYTES = 32 * 1024;

const MAX_RULES = 100;

export const FOCUS_GUARD_EXTENSION_MESSAGES = {
  ping: 'FOCUSFLOW_BRIDGE_PING',
  sessionSync: 'FOCUSFLOW_SESSION_SYNC',
  sessionClear: 'FOCUSFLOW_SESSION_CLEAR',
  statusRequest: 'FOCUSFLOW_STATUS_REQUEST',
  eventDrain: 'FOCUSFLOW_EVENT_DRAIN',
  eventAckRequest: 'FOCUSFLOW_EVENT_ACK',
  configSync: 'FOCUSFLOW_CONFIG_SYNC',
  ready: 'FOCUSFLOW_BRIDGE_READY',
  pong: 'FOCUSFLOW_BRIDGE_PONG',
  sessionAck: 'FOCUSFLOW_SESSION_ACK',
  extensionStatus: 'FOCUSFLOW_EXTENSION_STATUS',
  eventBatch: 'FOCUSFLOW_EVENT_BATCH',
  eventAckResponse: 'FOCUSFLOW_EVENT_ACKNOWLEDGED',
  configAck: 'FOCUSFLOW_CONFIG_ACK',
  error: 'FOCUSFLOW_BRIDGE_ERROR',
} as const;

export type FocusGuardExtensionRequestType =
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.ping
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.sessionSync
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.sessionClear
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.statusRequest
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.eventDrain
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.eventAckRequest
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.configSync;

export type FocusGuardExtensionResponseType =
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.ready
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.pong
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.sessionAck
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.extensionStatus
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.eventBatch
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.eventAckResponse
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.configAck
  | typeof FOCUS_GUARD_EXTENSION_MESSAGES.error;

export interface FocusGuardExtensionWebsiteRule {
  id: string;
  pattern: string;
  matchType: WebsiteRule['matchType'];
  action: WebsiteRule['action'];
  label?: string;
}

export interface FocusGuardExtensionSessionSnapshot {
  schemaVersion: 3;
  guardSessionId: string;
  timerRunId: string;
  status: 'active' | 'paused';
  targetLabel: string;
  protectionLevel: FocusGuardSession['protectionLevel'];
  profile: {
    id: string;
    displayName: string;
  };
  focusFlowOrigin: string;
  bypass: {
    allowed: boolean;
    delaySeconds: number;
    durationMinutes: number;
    requireReason: boolean;
  };
  websiteRules: FocusGuardExtensionWebsiteRule[];
  startedAt: number;
  expectedEndAt?: number;
  pausedRemainingSeconds?: number;
  updatedAt: number;
  expiresAt: number;
}

export interface FocusGuardExtensionEnvelope<TType extends string = string> {
  channel: typeof FOCUS_GUARD_EXTENSION_CHANNEL;
  protocolVersion: 3;
  type: TType;
  requestId: string;
  payload: Record<string, unknown>;
  sentAt: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(
  value: unknown,
  maximumLength: number,
  optional = false
) {
  if (value === undefined || value === null) return optional ? undefined : null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length > maximumLength) return null;
  return normalized;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function serializedSize(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function normalizeWebsiteRules(
  rules: WebsiteRule[]
): FocusGuardExtensionWebsiteRule[] | null {
  if (rules.length > MAX_RULES) return null;
  const result: FocusGuardExtensionWebsiteRule[] = [];
  const ids = new Set<string>();
  for (const rule of rules) {
    const id = normalizeString(rule.id, 160);
    const pattern = normalizeString(rule.pattern, 2048);
    const label = normalizeString(rule.label, 160, true);
    if (!id || !pattern || label === null || ids.has(id)) return null;
    if (
      !['domain', 'url-prefix', 'url-pattern'].includes(rule.matchType) ||
      !['block', 'allow'].includes(rule.action)
    ) {
      return null;
    }
    ids.add(id);
    result.push({
      id,
      pattern,
      matchType: rule.matchType,
      action: rule.action,
      ...(label ? { label } : {}),
    });
  }
  return result;
}

export interface FocusGuardExtensionProfileConfig {
  schemaVersion: 1;
  profile: { id: string; displayName: string; protectionLevel: FocusGuardProfile['protectionLevel'] };
  websiteRules: FocusGuardExtensionWebsiteRule[];
  requiredOrigins: string[];
  bypass: { allowed: boolean; delaySeconds: number; durationMinutes: number; requireReason: boolean };
  updatedAt: number;
}

export function createSanitizedFocusGuardProfileConfig(
  profile: FocusGuardProfile,
  now = Date.now()
): FocusGuardExtensionProfileConfig | null {
  const checked = normalizeWebsiteRuleSet(profile.websiteRules);
  if (!checked.ok) return null;
  const websiteRules = normalizeWebsiteRules(checked.rules);
  const id = normalizeString(profile.id, 160);
  const displayName = normalizeString(profile.name, 80);
  if (!websiteRules || !id || !displayName || !isTimestamp(now)) return null;
  return {
    schemaVersion: 1,
    profile: { id, displayName, protectionLevel: profile.protectionLevel },
    websiteRules,
    requiredOrigins:
      profile.protectionLevel === 'light'
        ? []
        : deriveRuleOrigins(checked.rules),
    bypass: {
      allowed: profile.emergencyBypassAllowed,
      delaySeconds: profile.bypassDelaySeconds,
      durationMinutes: profile.bypassDurationMinutes,
      requireReason: profile.requireBypassReason,
    },
    updatedAt: now,
  };
}

export function createSanitizedFocusGuardSnapshot(
  session: FocusGuardSession | null,
  now = Date.now(),
  focusFlowOrigin = 'http://localhost:3000'
): FocusGuardExtensionSessionSnapshot | null {
  if (
    !session ||
    !session.timerRunId ||
    !session.targetSnapshot?.label ||
    (session.status !== 'active' && session.status !== 'paused') ||
    !isTimestamp(session.startedAt) ||
    !isTimestamp(now)
  ) {
    return null;
  }

  const guardSessionId = normalizeString(session.id, 160);
  const timerRunId = normalizeString(session.timerRunId, 160);
  const targetLabel = normalizeString(session.targetSnapshot.label, 160);
  const profileId = normalizeString(session.profileSnapshot.profileId, 160);
  const profileDisplayName = normalizeString(session.profileSnapshot.name, 80);
  const websiteRules = normalizeWebsiteRules(
    session.profileSnapshot.websiteRules
  );
  const normalizedOrigin = (() => {
    try {
      const origin = new URL(focusFlowOrigin).origin;
      return origin === 'http://localhost:3000' ||
        origin === 'http://127.0.0.1:3000'
        ? origin
        : null;
    } catch {
      return null;
    }
  })();
  if (
    !guardSessionId ||
    !timerRunId ||
    !targetLabel ||
    !profileId ||
    !profileDisplayName ||
    !websiteRules ||
    !normalizedOrigin
  ) {
    return null;
  }

  const base = {
    schemaVersion: FOCUS_GUARD_EXTENSION_SNAPSHOT_SCHEMA_VERSION,
    guardSessionId,
    timerRunId,
    targetLabel,
    protectionLevel: session.protectionLevel,
    profile: { id: profileId, displayName: profileDisplayName },
    focusFlowOrigin: normalizedOrigin,
    bypass: {
      allowed: session.profileSnapshot.emergencyBypassAllowed,
      delaySeconds: session.profileSnapshot.bypassDelaySeconds,
      durationMinutes: session.profileSnapshot.bypassDurationMinutes,
      requireReason: session.profileSnapshot.requireBypassReason,
    },
    websiteRules,
    startedAt: session.startedAt,
    updatedAt: now,
  } as const;

  if (session.status === 'active') {
    if (!isTimestamp(session.expectedEndAt) || session.expectedEndAt <= now) {
      return null;
    }
    const expiresAt = Math.min(
      now + FOCUS_GUARD_EXTENSION_EXPIRY_MS,
      session.expectedEndAt
    );
    return {
      ...base,
      status: 'active',
      expectedEndAt: session.expectedEndAt,
      expiresAt,
    };
  }

  if (
    !Number.isInteger(session.pausedRemainingSeconds) ||
    (session.pausedRemainingSeconds ?? -1) < 0 ||
    (session.pausedRemainingSeconds ?? 0) > 24 * 60 * 60
  ) {
    return null;
  }
  return {
    ...base,
    status: 'paused',
    pausedRemainingSeconds: session.pausedRemainingSeconds,
    expiresAt: now + FOCUS_GUARD_EXTENSION_EXPIRY_MS,
  };
}

export function createFocusGuardExtensionEnvelope(
  type: FocusGuardExtensionRequestType,
  requestId: string,
  payload: Record<string, unknown>,
  sentAt = Date.now()
): FocusGuardExtensionEnvelope<FocusGuardExtensionRequestType> {
  return {
    channel: FOCUS_GUARD_EXTENSION_CHANNEL,
    protocolVersion: FOCUS_GUARD_EXTENSION_PROTOCOL_VERSION,
    type,
    requestId,
    payload,
    sentAt,
  };
}

const RESPONSE_TYPES = new Set<FocusGuardExtensionResponseType>([
  FOCUS_GUARD_EXTENSION_MESSAGES.ready,
  FOCUS_GUARD_EXTENSION_MESSAGES.pong,
  FOCUS_GUARD_EXTENSION_MESSAGES.sessionAck,
  FOCUS_GUARD_EXTENSION_MESSAGES.extensionStatus,
  FOCUS_GUARD_EXTENSION_MESSAGES.eventBatch,
  FOCUS_GUARD_EXTENSION_MESSAGES.eventAckResponse,
  FOCUS_GUARD_EXTENSION_MESSAGES.configAck,
  FOCUS_GUARD_EXTENSION_MESSAGES.error,
]);

export function normalizeFocusGuardExtensionResponse(
  value: unknown
): FocusGuardExtensionEnvelope<FocusGuardExtensionResponseType> | null {
  if (
    !isRecord(value) ||
    serializedSize(value) > FOCUS_GUARD_EXTENSION_MAX_ENVELOPE_BYTES ||
    value.channel !== FOCUS_GUARD_EXTENSION_CHANNEL ||
    value.protocolVersion !== FOCUS_GUARD_EXTENSION_PROTOCOL_VERSION ||
    typeof value.type !== 'string' ||
    !RESPONSE_TYPES.has(value.type as FocusGuardExtensionResponseType) ||
    !normalizeString(value.requestId, 128) ||
    !isRecord(value.payload) ||
    !isTimestamp(value.sentAt)
  ) {
    return null;
  }

  if (value.type === FOCUS_GUARD_EXTENSION_MESSAGES.error) {
    if (
      !normalizeString(value.payload.code, 64) ||
      !normalizeString(value.payload.message, 240)
    ) {
      return null;
    }
  } else if (
    !normalizeString(value.payload.extensionVersion, 32) ||
    value.payload.protocolVersion !== FOCUS_GUARD_EXTENSION_PROTOCOL_VERSION ||
    value.payload.snapshotSchemaVersion !==
      FOCUS_GUARD_EXTENSION_SNAPSHOT_SCHEMA_VERSION
  ) {
    return null;
  }

  return value as unknown as FocusGuardExtensionEnvelope<FocusGuardExtensionResponseType>;
}
