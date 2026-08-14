import {
  ApplicationRule,
  CreateFocusGuardProfileInput,
  FocusGuardPreferences,
  FocusGuardProfile,
  FocusGuardProfileSnapshot,
  FocusGuardSession,
  FocusInterruption,
  GuardReviewMutationResult,
  GuardSessionEndReason,
  GuardSessionMutationResult,
  InterruptionResolution,
  InterruptionType,
  ProtectionLevel,
  StartGuardSessionInput,
  SubmitGuardReviewInput,
  UpdateFocusGuardProfileInput,
  WebsiteRule,
} from '@/types/focusGuard';
import {
  AddDistractionInput,
  DistractionItem,
} from '@/types/distraction';
import { FocusTarget } from '@/types/task';
import {
  applyGuardReviewSkip,
  applyGuardReviewSubmission,
  createPendingGuardReview,
  normalizeGuardReviewMetadata,
} from '@/lib/focusGuardReview';
import { normalizeWebsiteRuleSet } from '@/lib/focusGuardRules';

export const GUARD_PROFILES_STORAGE_KEY = 'focusflow-guard-profiles-v1';
export const ACTIVE_GUARD_SESSION_STORAGE_KEY =
  'focusflow-active-guard-session-v1';
export const GUARD_SESSION_HISTORY_STORAGE_KEY =
  'focusflow-guard-session-history-v1';
export const GUARD_INTERRUPTION_STORAGE_KEY =
  'focusflow-guard-interruptions-v1';
export const DISTRACTION_INBOX_STORAGE_KEY =
  'focusflow-distraction-inbox-v1';
export const GUARD_PREFERENCES_STORAGE_KEY =
  'focusflow-guard-preferences-v1';

export const GUARD_PROFILES_UPDATED_EVENT =
  'focusflow-guard-profiles-updated-v1';
export const ACTIVE_GUARD_SESSION_UPDATED_EVENT =
  'focusflow-active-guard-session-updated-v1';
export const GUARD_SESSION_HISTORY_UPDATED_EVENT =
  'focusflow-guard-session-history-updated-v1';
export const GUARD_INTERRUPTION_UPDATED_EVENT =
  'focusflow-guard-interruptions-updated-v1';
export const DISTRACTION_INBOX_UPDATED_EVENT =
  'focusflow-distraction-inbox-updated-v1';
export const GUARD_PREFERENCES_UPDATED_EVENT =
  'focusflow-guard-preferences-updated-v1';

export const BUILT_IN_LIGHT_PROFILE_ID =
  'focusflow-guard-profile-light-built-in';
export const BUILT_IN_BROWSER_PROFILE_ID =
  'focusflow-guard-profile-browser-built-in';

const SCHEMA_VERSION = 1;
const MAX_HISTORY_ITEMS = 200;
const MAX_INTERRUPTION_ITEMS = 1_000;
const MAX_DISTRACTION_ITEMS = 500;
const MAX_NAME_LENGTH = 80;
const MAX_LABEL_LENGTH = 160;
const MAX_INTENTION_LENGTH = 500;
const MAX_NOTE_LENGTH = 1_000;
const MAX_PATTERN_LENGTH = 2_048;
const MAX_GUARD_STORAGE_PAYLOAD_CHARS = 1_000_000;
const GUARD_SESSION_MUTATION_LOCK = 'focusflow-guard-session-mutation-v1';

export const DEFAULT_LIGHT_PROFILE: FocusGuardProfile = {
  id: BUILT_IN_LIGHT_PROFILE_ID,
  kind: 'built-in',
  name: 'Light Protection',
  protectionLevel: 'light',
  websiteRules: [],
  applicationRules: [],
  emergencyBypassAllowed: true,
  bypassDelaySeconds: 10,
  bypassDurationMinutes: 5,
  requireBypassReason: false,
  createdAt: 0,
  updatedAt: 0,
};

export const DEFAULT_BROWSER_GUARD_PROFILE: FocusGuardProfile = {
  id: BUILT_IN_BROWSER_PROFILE_ID,
  kind: 'built-in',
  name: 'Browser Guard',
  protectionLevel: 'medium',
  websiteRules: [
    {
      id: 'focusflow-browser-guard-tiktok',
      pattern: 'tiktok.com',
      matchType: 'domain',
      action: 'block',
      label: 'TikTok',
    },
  ],
  applicationRules: [],
  emergencyBypassAllowed: true,
  bypassDelaySeconds: 10,
  bypassDurationMinutes: 5,
  requireBypassReason: true,
  createdAt: 0,
  updatedAt: 0,
};

interface CollectionEnvelope<T> {
  schemaVersion: 1;
  items: T[];
  updatedAt: number;
}

interface ValueEnvelope<T> {
  schemaVersion: 1;
  value: T;
  updatedAt: number;
}

interface WebLockManagerLike {
  request<T>(
    name: string,
    options: { mode: 'exclusive' },
    callback: () => Promise<T>
  ): Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeRequiredString(
  value: unknown,
  maxLength: number
): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
  return normalized || null;
}

function normalizeOptionalString(
  value: unknown,
  maxLength: number
): string | undefined {
  if (value === undefined || value === null) return undefined;
  return normalizeRequiredString(value, maxLength) ?? undefined;
}

function normalizeInteger(
  value: unknown,
  minimum: number,
  maximum: number
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < minimum || rounded > maximum) return null;
  return rounded;
}

function isProtectionLevel(value: unknown): value is ProtectionLevel {
  return value === 'light' || value === 'medium' || value === 'strict';
}

function cloneWebsiteRule(rule: WebsiteRule): WebsiteRule {
  return { ...rule };
}

function cloneApplicationRule(rule: ApplicationRule): ApplicationRule {
  return { ...rule };
}

function cloneProfile(profile: FocusGuardProfile): FocusGuardProfile {
  return {
    ...profile,
    websiteRules: profile.websiteRules.map(cloneWebsiteRule),
    applicationRules: profile.applicationRules.map(cloneApplicationRule),
  };
}

function cloneDefaultProfile() {
  return cloneProfile(DEFAULT_LIGHT_PROFILE);
}

function cloneBrowserGuardProfile() {
  return cloneProfile(DEFAULT_BROWSER_GUARD_PROFILE);
}

function isBuiltInProfileId(profileId: string) {
  return (
    profileId === BUILT_IN_LIGHT_PROFILE_ID ||
    profileId === BUILT_IN_BROWSER_PROFILE_ID
  );
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function normalizeApplicationRule(value: unknown): ApplicationRule | null {
  if (!isRecord(value)) return null;
  const id = normalizeRequiredString(value.id, MAX_LABEL_LENGTH);
  const identifier = normalizeRequiredString(value.identifier, MAX_PATTERN_LENGTH);
  const label = normalizeRequiredString(value.label, MAX_LABEL_LENGTH);
  if (
    !id ||
    !identifier ||
    !label ||
    (value.action !== 'warn' && value.action !== 'block')
  ) {
    return null;
  }

  return { id, identifier, label, action: value.action };
}

function normalizeApplicationRules(value: unknown): ApplicationRule[] {
  if (!Array.isArray(value)) return [];
  return dedupeById(
    value
      .map(normalizeApplicationRule)
      .filter((rule): rule is ApplicationRule => Boolean(rule))
  );
}

export function normalizeFocusGuardProfile(
  value: unknown
): FocusGuardProfile | null {
  if (!isRecord(value)) return null;
  const id = normalizeRequiredString(value.id, MAX_LABEL_LENGTH);
  const name = normalizeRequiredString(value.name, MAX_NAME_LENGTH);
  const bypassDelaySeconds = normalizeInteger(
    value.bypassDelaySeconds,
    0,
    300
  );
  const bypassDurationMinutes = normalizeInteger(
    value.bypassDurationMinutes,
    1,
    60
  );
  const websiteRules = normalizeWebsiteRuleSet(value.websiteRules);

  if (
    !id ||
    !name ||
    (value.kind !== 'built-in' && value.kind !== 'custom') ||
    !isProtectionLevel(value.protectionLevel) ||
    typeof value.emergencyBypassAllowed !== 'boolean' ||
    bypassDelaySeconds === null ||
    bypassDurationMinutes === null ||
    typeof value.requireBypassReason !== 'boolean' ||
    !isFiniteTimestamp(value.createdAt) ||
    !isFiniteTimestamp(value.updatedAt) ||
    value.updatedAt < value.createdAt ||
    !websiteRules.ok
  ) {
    return null;
  }

  return {
    id,
    kind: value.kind,
    name,
    protectionLevel: value.protectionLevel,
    websiteRules: websiteRules.rules,
    applicationRules: normalizeApplicationRules(value.applicationRules),
    emergencyBypassAllowed: value.emergencyBypassAllowed,
    bypassDelaySeconds,
    bypassDurationMinutes,
    requireBypassReason: value.requireBypassReason,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function createProfileSnapshot(
  profile: FocusGuardProfile
): FocusGuardProfileSnapshot {
  return {
    profileId: profile.id,
    name: profile.name,
    protectionLevel: profile.protectionLevel,
    websiteRules: profile.websiteRules.map(cloneWebsiteRule),
    applicationRules: profile.applicationRules.map(cloneApplicationRule),
    emergencyBypassAllowed: profile.emergencyBypassAllowed,
    bypassDelaySeconds: profile.bypassDelaySeconds,
    bypassDurationMinutes: profile.bypassDurationMinutes,
    requireBypassReason: profile.requireBypassReason,
  };
}

function compactGuardSessionForHistory(
  session: FocusGuardSession
): FocusGuardSession {
  if (session.status === 'active' || session.status === 'paused') return session;
  if (
    session.profileSnapshot.websiteRules.length === 0 &&
    session.profileSnapshot.applicationRules.length === 0
  ) {
    return session;
  }
  return {
    ...session,
    profileSnapshot: {
      ...session.profileSnapshot,
      websiteRules: [],
      applicationRules: [],
    },
  };
}

function normalizeProfileSnapshot(
  value: unknown
): FocusGuardProfileSnapshot | null {
  if (!isRecord(value)) return null;
  const profileId = normalizeRequiredString(value.profileId, MAX_LABEL_LENGTH);
  const name = normalizeRequiredString(value.name, MAX_NAME_LENGTH);
  const bypassDelaySeconds = normalizeInteger(
    value.bypassDelaySeconds,
    0,
    300
  );
  const bypassDurationMinutes = normalizeInteger(
    value.bypassDurationMinutes,
    1,
    60
  );
  const websiteRules = normalizeWebsiteRuleSet(value.websiteRules);
  if (
    !profileId ||
    !name ||
    !isProtectionLevel(value.protectionLevel) ||
    typeof value.emergencyBypassAllowed !== 'boolean' ||
    bypassDelaySeconds === null ||
    bypassDurationMinutes === null ||
    typeof value.requireBypassReason !== 'boolean' ||
    !websiteRules.ok
  ) {
    return null;
  }

  return {
    profileId,
    name,
    protectionLevel: value.protectionLevel,
    websiteRules: websiteRules.rules,
    applicationRules: normalizeApplicationRules(value.applicationRules),
    emergencyBypassAllowed: value.emergencyBypassAllowed,
    bypassDelaySeconds,
    bypassDurationMinutes,
    requireBypassReason: value.requireBypassReason,
  };
}

function normalizeFocusTarget(value: unknown): FocusTarget | undefined {
  if (!isRecord(value)) return undefined;
  const taskId = normalizeRequiredString(value.taskId, MAX_LABEL_LENGTH);
  const label = normalizeRequiredString(value.label, MAX_LABEL_LENGTH);
  const stepId = normalizeOptionalString(value.stepId, MAX_LABEL_LENGTH);
  if (!taskId || !label) return undefined;
  return { taskId, stepId, label };
}

export function normalizeFocusGuardSession(
  value: unknown
): FocusGuardSession | null {
  if (!isRecord(value)) return null;
  const id = normalizeRequiredString(value.id, MAX_LABEL_LENGTH);
  const profileId = normalizeRequiredString(value.profileId, MAX_LABEL_LENGTH);
  const profileSnapshot = normalizeProfileSnapshot(value.profileSnapshot);
  if (
    !id ||
    !profileId ||
    !profileSnapshot ||
    profileSnapshot.profileId !== profileId ||
    !isProtectionLevel(value.protectionLevel) ||
    profileSnapshot.protectionLevel !== value.protectionLevel ||
    (value.status !== 'active' &&
      value.status !== 'paused' &&
      value.status !== 'completed' &&
      value.status !== 'stopped') ||
    !isFiniteTimestamp(value.startedAt) ||
    !isFiniteTimestamp(value.expectedEndAt) ||
    value.expectedEndAt < value.startedAt
  ) {
    return null;
  }

  const derivedLegacyDuration = Math.min(
    24 * 60 * 60,
    Math.max(1, Math.round((value.expectedEndAt - value.startedAt) / 1000))
  );
  const durationSeconds =
    normalizeInteger(value.durationSeconds, 1, 24 * 60 * 60) ??
    derivedLegacyDuration;

  const base = {
    id,
    timerRunId: normalizeOptionalString(value.timerRunId, MAX_LABEL_LENGTH),
    focusSessionId: normalizeOptionalString(
      value.focusSessionId,
      MAX_LABEL_LENGTH
    ),
    profileId,
    profileSnapshot,
    targetSnapshot: normalizeFocusTarget(value.targetSnapshot),
    intention: normalizeOptionalString(value.intention, MAX_INTENTION_LENGTH),
    protectionLevel: value.protectionLevel,
    durationSeconds,
    startedAt: value.startedAt,
    expectedEndAt: value.expectedEndAt,
  };

  if (value.status === 'active') {
    if (value.endedAt !== undefined || value.endReason !== undefined) return null;
    return { ...base, status: 'active' };
  }

  if (value.status === 'paused') {
    const pausedRemainingSeconds = normalizeInteger(
      value.pausedRemainingSeconds,
      0,
      24 * 60 * 60
    );
    if (
      !isFiniteTimestamp(value.pausedAt) ||
      pausedRemainingSeconds === null ||
      value.endedAt !== undefined ||
      value.endReason !== undefined
    ) {
      return null;
    }
    return {
      ...base,
      status: 'paused',
      pausedAt: value.pausedAt,
      pausedRemainingSeconds,
    };
  }

  if (
    !isFiniteTimestamp(value.endedAt) ||
    value.endedAt < value.startedAt ||
    (value.endReason !== 'completed' &&
      value.endReason !== 'stopped' &&
      value.endReason !== 'recovered')
  ) {
    return null;
  }
  if (value.status === 'completed' && value.endReason === 'stopped') return null;
  if (value.status === 'stopped' && value.endReason !== 'stopped') return null;

  const reviewMetadata =
    value.status === 'completed'
      ? normalizeGuardReviewMetadata(value)
      : { kind: 'absent' as const };

  return {
    ...base,
    status: value.status,
    endedAt: value.endedAt,
    endReason: value.endReason,
    ...(reviewMetadata.kind === 'valid' ? reviewMetadata.value : {}),
  };
}

export function normalizeFocusInterruption(
  value: unknown
): FocusInterruption | null {
  if (!isRecord(value)) return null;
  const id = normalizeRequiredString(value.id, MAX_LABEL_LENGTH);
  const guardSessionId = normalizeRequiredString(
    value.guardSessionId,
    MAX_LABEL_LENGTH
  );
  const validType =
    value.type === 'page-hidden' ||
    value.type === 'window-blur' ||
    value.type === 'blocked-site' ||
    value.type === 'blocked-app' ||
    value.type === 'emergency-bypass' ||
    value.type === 'thought';
  const validResolution =
    value.resolution === undefined ||
    value.resolution === 'returned' ||
    value.resolution === 'intentional' ||
    value.resolution === 'captured' ||
    value.resolution === 'bypassed' ||
    value.resolution === 'unknown';
  if (
    !id ||
    !guardSessionId ||
    !validType ||
    !validResolution ||
    !isFiniteTimestamp(value.occurredAt) ||
    (value.returnedAt !== undefined &&
      (!isFiniteTimestamp(value.returnedAt) ||
        value.returnedAt < value.occurredAt))
  ) {
    return null;
  }

  return {
    id,
    guardSessionId,
    occurredAt: value.occurredAt,
    returnedAt: value.returnedAt as number | undefined,
    type: value.type as InterruptionType,
    source: normalizeOptionalString(value.source, MAX_PATTERN_LENGTH),
    note: normalizeOptionalString(value.note, MAX_NOTE_LENGTH),
    resolution: value.resolution as InterruptionResolution | undefined,
    configuredRuleId: normalizeOptionalString(
      value.configuredRuleId,
      MAX_LABEL_LENGTH
    ),
    configuredRuleLabel: normalizeOptionalString(
      value.configuredRuleLabel,
      MAX_LABEL_LENGTH
    ),
    configuredRuleDomain: normalizeOptionalString(
      value.configuredRuleDomain,
      MAX_PATTERN_LENGTH
    ),
    bypassExpiresAt: isFiniteTimestamp(value.bypassExpiresAt)
      ? value.bypassExpiresAt
      : undefined,
  };
}

export function normalizeDistractionItem(
  value: unknown
): DistractionItem | null {
  if (!isRecord(value)) return null;
  const id = normalizeRequiredString(value.id, MAX_LABEL_LENGTH);
  const text = normalizeRequiredString(value.text, MAX_NOTE_LENGTH);
  if (
    !id ||
    !text ||
    !isFiniteTimestamp(value.capturedAt) ||
    (value.status !== 'inbox' &&
      value.status !== 'converted-to-task' &&
      value.status !== 'dismissed')
  ) {
    return null;
  }

  const convertedTaskId = normalizeOptionalString(
    value.convertedTaskId,
    MAX_LABEL_LENGTH
  );
  if (value.status === 'converted-to-task' && !convertedTaskId) return null;
  if (
    value.status !== 'inbox' &&
    !isFiniteTimestamp(value.resolvedAt)
  ) {
    return null;
  }

  return {
    id,
    text,
    capturedAt: value.capturedAt,
    guardSessionId: normalizeOptionalString(
      value.guardSessionId,
      MAX_LABEL_LENGTH
    ),
    status: value.status,
    convertedTaskId:
      value.status === 'converted-to-task' ? convertedTaskId : undefined,
    resolvedAt:
      value.status === 'inbox' ? undefined : (value.resolvedAt as number),
  };
}

function readJson(key: string): unknown {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown, eventName: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length > MAX_GUARD_STORAGE_PAYLOAD_CHARS) return false;
    localStorage.setItem(key, serialized);
    window.dispatchEvent(new Event(eventName));
    return true;
  } catch {
    return false;
  }
}

function loadCollection<T>(
  key: string,
  normalizer: (value: unknown) => T | null,
  maximumItems: number
): T[] {
  const raw = readJson(key);
  if (
    !isRecord(raw) ||
    raw.schemaVersion !== SCHEMA_VERSION ||
    !Array.isArray(raw.items)
  ) {
    return [];
  }

  const normalized = raw.items
    .map(normalizer)
    .filter((item): item is T => Boolean(item));
  return normalized.slice(0, maximumItems);
}

function saveCollection<T>(
  key: string,
  items: T[],
  eventName: string
): boolean {
  return writeJson(
    key,
    {
      schemaVersion: 1,
      items,
      updatedAt: Date.now(),
    } satisfies CollectionEnvelope<T>,
    eventName
  );
}

export function createFocusGuardId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function loadFocusGuardProfiles(): FocusGuardProfile[] {
  const stored = loadCollection(
    GUARD_PROFILES_STORAGE_KEY,
    normalizeFocusGuardProfile,
    200
  );
  const customProfiles = dedupeById(
    stored.filter(
      (profile) =>
        profile.kind === 'custom' && !isBuiltInProfileId(profile.id)
    )
  );
  return [cloneDefaultProfile(), cloneBrowserGuardProfile(), ...customProfiles];
}

function saveFocusGuardProfiles(profiles: FocusGuardProfile[]) {
  const customProfiles = dedupeById(
    profiles.filter(
      (profile) =>
        profile.kind === 'custom' && !isBuiltInProfileId(profile.id)
    )
  );
  return saveCollection(
    GUARD_PROFILES_STORAGE_KEY,
    [cloneDefaultProfile(), cloneBrowserGuardProfile(), ...customProfiles],
    GUARD_PROFILES_UPDATED_EVENT
  );
}

export function ensureBuiltInLightProfile() {
  const profiles = loadFocusGuardProfiles();
  saveFocusGuardProfiles(profiles);
  return cloneDefaultProfile();
}

function normalizeCreateProfileInput(
  input: CreateFocusGuardProfileInput,
  id: string,
  now: number
): FocusGuardProfile | null {
  return normalizeFocusGuardProfile({
    id,
    kind: 'custom',
    name: input.name,
    protectionLevel: input.protectionLevel,
    websiteRules: input.websiteRules ?? [],
    applicationRules: input.applicationRules ?? [],
    emergencyBypassAllowed: input.emergencyBypassAllowed ?? true,
    bypassDelaySeconds: input.bypassDelaySeconds ?? 10,
    bypassDurationMinutes: input.bypassDurationMinutes ?? 5,
    requireBypassReason: input.requireBypassReason ?? false,
    createdAt: now,
    updatedAt: now,
  });
}

export function createCustomFocusGuardProfile(
  input: CreateFocusGuardProfileInput
): FocusGuardProfile | null {
  const current = loadFocusGuardProfiles();
  const profile = normalizeCreateProfileInput(
    input,
    createFocusGuardId('guard-profile'),
    Date.now()
  );
  if (!profile) return null;
  return saveFocusGuardProfiles([...current, profile]) ? profile : null;
}

export function duplicateFocusGuardProfile(profileId: string) {
  const source = loadFocusGuardProfiles().find(
    (profile) => profile.id === profileId
  );
  if (!source) return null;
  return createCustomFocusGuardProfile({
    name: `${source.name} Copy`.slice(0, MAX_NAME_LENGTH),
    protectionLevel: source.protectionLevel,
    websiteRules: source.websiteRules.map(cloneWebsiteRule),
    applicationRules: source.applicationRules.map(cloneApplicationRule),
    emergencyBypassAllowed: source.emergencyBypassAllowed,
    bypassDelaySeconds: source.bypassDelaySeconds,
    bypassDurationMinutes: source.bypassDurationMinutes,
    requireBypassReason: source.requireBypassReason,
  });
}

export function importCustomFocusGuardProfiles(
  input: unknown[],
  mode: 'merge' | 'replace'
) {
  const normalized: FocusGuardProfile[] = [];
  const ids = new Set<string>();
  for (const value of input) {
    const profile = normalizeFocusGuardProfile(value);
    if (
      !profile ||
      profile.kind !== 'custom' ||
      isBuiltInProfileId(profile.id) ||
      ids.has(profile.id)
    ) return null;
    ids.add(profile.id);
    normalized.push(profile);
  }
  const currentCustom = loadFocusGuardProfiles().filter(
    (profile) => profile.kind === 'custom'
  );
  const nextCustom = mode === 'replace'
    ? normalized
    : [
        ...currentCustom.filter((profile) => !ids.has(profile.id)),
        ...normalized,
      ];
  return saveFocusGuardProfiles(nextCustom) ? nextCustom : null;
}

export function updateCustomFocusGuardProfile(
  profileId: string,
  updates: UpdateFocusGuardProfileInput
): FocusGuardProfile | null {
  if (isBuiltInProfileId(profileId)) return null;
  const current = loadFocusGuardProfiles();
  const existing = current.find(
    (profile) => profile.id === profileId && profile.kind === 'custom'
  );
  if (!existing) return null;

  const candidate = normalizeFocusGuardProfile({
    ...existing,
    ...updates,
    websiteRules: updates.websiteRules ?? existing.websiteRules,
    applicationRules: updates.applicationRules ?? existing.applicationRules,
    updatedAt: Date.now(),
  });
  if (!candidate) return null;
  const next = current.map((profile) =>
    profile.id === profileId ? candidate : profile
  );
  return saveFocusGuardProfiles(next) ? candidate : null;
}

function defaultGuardPreferences(): FocusGuardPreferences {
  return {
    guardEnabled: false,
    selectedProfileId: BUILT_IN_LIGHT_PROFILE_ID,
    updatedAt: 0,
  };
}

export function loadFocusGuardPreferences(): FocusGuardPreferences {
  const raw = readJson(GUARD_PREFERENCES_STORAGE_KEY);
  if (
    !isRecord(raw) ||
    raw.schemaVersion !== SCHEMA_VERSION ||
    !isRecord(raw.value)
  ) {
    return defaultGuardPreferences();
  }

  const selectedProfileId = normalizeRequiredString(
    raw.value.selectedProfileId,
    MAX_LABEL_LENGTH
  );
  const profiles = loadFocusGuardProfiles();
  return {
    guardEnabled:
      typeof raw.value.guardEnabled === 'boolean'
        ? raw.value.guardEnabled
        : false,
    selectedProfileId:
      selectedProfileId &&
      profiles.some((profile) => profile.id === selectedProfileId)
        ? selectedProfileId
        : BUILT_IN_LIGHT_PROFILE_ID,
    updatedAt: isFiniteTimestamp(raw.value.updatedAt)
      ? raw.value.updatedAt
      : 0,
  };
}

export function saveFocusGuardPreferences(
  preferences: FocusGuardPreferences
) {
  const profiles = loadFocusGuardProfiles();
  const selectedProfileId = profiles.some(
    (profile) => profile.id === preferences.selectedProfileId
  )
    ? preferences.selectedProfileId
    : BUILT_IN_LIGHT_PROFILE_ID;
  const normalized: FocusGuardPreferences = {
    guardEnabled: Boolean(preferences.guardEnabled),
    selectedProfileId,
    updatedAt: Date.now(),
  };
  return writeJson(
    GUARD_PREFERENCES_STORAGE_KEY,
    {
      schemaVersion: 1,
      value: normalized,
      updatedAt: normalized.updatedAt,
    } satisfies ValueEnvelope<FocusGuardPreferences>,
    GUARD_PREFERENCES_UPDATED_EVENT
  )
    ? normalized
    : null;
}

export function deleteCustomFocusGuardProfile(profileId: string) {
  if (isBuiltInProfileId(profileId)) return false;
  const current = loadFocusGuardProfiles();
  const preferencesBeforeDelete = loadFocusGuardPreferences();
  if (!current.some((profile) => profile.id === profileId)) return false;
  if (!saveFocusGuardProfiles(current.filter((profile) => profile.id !== profileId))) {
    return false;
  }

  if (preferencesBeforeDelete.selectedProfileId === profileId) {
    saveFocusGuardPreferences({
      ...preferencesBeforeDelete,
      selectedProfileId: BUILT_IN_LIGHT_PROFILE_ID,
    });
  }
  return true;
}

export function resetBuiltInLightProfile() {
  saveFocusGuardProfiles(loadFocusGuardProfiles());
  return cloneDefaultProfile();
}

function loadActiveGuardSession(): FocusGuardSession | null {
  const raw = readJson(ACTIVE_GUARD_SESSION_STORAGE_KEY);
  if (
    !isRecord(raw) ||
    raw.schemaVersion !== SCHEMA_VERSION ||
    !('value' in raw)
  ) {
    return null;
  }
  if (raw.value === null) return null;
  const session = normalizeFocusGuardSession(raw.value);
  return session && (session.status === 'active' || session.status === 'paused')
    ? session
    : null;
}

function saveActiveGuardSession(session: FocusGuardSession | null) {
  return writeJson(
    ACTIVE_GUARD_SESSION_STORAGE_KEY,
    {
      schemaVersion: 1,
      value: session,
      updatedAt: Date.now(),
    } satisfies ValueEnvelope<FocusGuardSession | null>,
    ACTIVE_GUARD_SESSION_UPDATED_EVENT
  );
}

export function getActiveGuardSession() {
  return loadActiveGuardSession();
}

export function loadGuardSessionHistory() {
  return dedupeById(
    loadCollection(
      GUARD_SESSION_HISTORY_STORAGE_KEY,
      normalizeFocusGuardSession,
      MAX_HISTORY_ITEMS
    ).filter(
      (session) =>
        session.status === 'completed' || session.status === 'stopped'
    )
  );
}

function saveGuardSessionHistory(history: FocusGuardSession[]) {
  return saveCollection(
    GUARD_SESSION_HISTORY_STORAGE_KEY,
    dedupeById(history)
      .slice(0, MAX_HISTORY_ITEMS)
      .map(compactGuardSessionForHistory),
    GUARD_SESSION_HISTORY_UPDATED_EVENT
  );
}

async function withGuardSessionMutationLock<T>(operation: () => Promise<T>) {
  if (typeof navigator === 'undefined') return operation();
  const locks = (navigator as Navigator & { locks?: WebLockManagerLike }).locks;
  if (!locks) return operation();
  return locks.request(
    GUARD_SESSION_MUTATION_LOCK,
    { mode: 'exclusive' },
    operation
  );
}

export async function startGuardSession(
  input: StartGuardSessionInput
): Promise<GuardSessionMutationResult> {
  return withGuardSessionMutationLock(async () => {
    const activeSession = loadActiveGuardSession();
    if (activeSession) {
      return {
        ok: false,
        reason: 'active-session-exists',
        activeSession,
      };
    }

    const profiles = loadFocusGuardProfiles();
    const preferences = loadFocusGuardPreferences();
    const profileId = input.profileId ?? preferences.selectedProfileId;
    const profile = profiles.find((item) => item.id === profileId);
    const startedAt = input.startedAt ?? Date.now();
    const id = input.id
      ? normalizeRequiredString(input.id, MAX_LABEL_LENGTH)
      : createFocusGuardId('guard-session');
    if (
      !profile ||
      !id ||
      !isFiniteTimestamp(startedAt) ||
      !isFiniteTimestamp(input.expectedEndAt) ||
      input.expectedEndAt < startedAt ||
      loadGuardSessionHistory().some((session) => session.id === id)
    ) {
      return { ok: false, reason: 'invalid-input' };
    }

    const session = normalizeFocusGuardSession({
      id,
      timerRunId: input.timerRunId,
      profileId: profile.id,
      profileSnapshot: createProfileSnapshot(profile),
      targetSnapshot: input.targetSnapshot,
      intention: input.intention,
      protectionLevel: profile.protectionLevel,
      status: 'active',
      durationSeconds:
        input.durationSeconds ??
        Math.max(1, Math.round((input.expectedEndAt - startedAt) / 1000)),
      startedAt,
      expectedEndAt: input.expectedEndAt,
    });
    if (!session) return { ok: false, reason: 'invalid-input' };
    if (!saveActiveGuardSession(session)) {
      return { ok: false, reason: 'storage-failed' };
    }

    const verified = loadActiveGuardSession();
    if (verified?.id !== session.id) {
      return {
        ok: false,
        reason: 'session-conflict',
        activeSession: verified ?? undefined,
      };
    }
    return { ok: true, session, alreadyApplied: false };
  });
}

export async function pauseGuardSession(
  sessionId: string,
  pausedAt = Date.now(),
  pausedRemainingSeconds?: number
): Promise<GuardSessionMutationResult> {
  return withGuardSessionMutationLock(async () => {
    const active = loadActiveGuardSession();
    if (!active) return { ok: false, reason: 'session-not-found' };
    if (active.id !== sessionId) {
      return {
        ok: false,
        reason: 'session-conflict',
        activeSession: active,
      };
    }
    if (active.status === 'paused') {
      return { ok: true, session: active, alreadyApplied: true };
    }
    if (!isFiniteTimestamp(pausedAt)) {
      return { ok: false, reason: 'invalid-input' };
    }

    const normalizedRemaining =
      pausedRemainingSeconds === undefined
        ? Math.max(0, Math.ceil((active.expectedEndAt - pausedAt) / 1000))
        : normalizeInteger(pausedRemainingSeconds, 0, 24 * 60 * 60);
    if (normalizedRemaining === null) {
      return { ok: false, reason: 'invalid-input' };
    }

    const paused: FocusGuardSession = {
      ...active,
      status: 'paused',
      pausedAt,
      pausedRemainingSeconds: normalizedRemaining,
    };
    if (!saveActiveGuardSession(paused)) {
      return { ok: false, reason: 'storage-failed' };
    }
    return { ok: true, session: paused, alreadyApplied: false };
  });
}

export async function resumeGuardSession(
  sessionId: string,
  resumedAt = Date.now(),
  expectedEndAt?: number
): Promise<GuardSessionMutationResult> {
  return withGuardSessionMutationLock(async () => {
    const active = loadActiveGuardSession();
    if (!active) return { ok: false, reason: 'session-not-found' };
    if (active.id !== sessionId) {
      return {
        ok: false,
        reason: 'session-conflict',
        activeSession: active,
      };
    }
    if (active.status === 'active') {
      return { ok: true, session: active, alreadyApplied: true };
    }
    if (!isFiniteTimestamp(resumedAt)) {
      return { ok: false, reason: 'invalid-input' };
    }

    const nextExpectedEndAt =
      expectedEndAt ??
      resumedAt + (active.pausedRemainingSeconds ?? 0) * 1000;
    if (
      !isFiniteTimestamp(nextExpectedEndAt) ||
      nextExpectedEndAt < resumedAt
    ) {
      return { ok: false, reason: 'invalid-input' };
    }

    const resumed: FocusGuardSession = {
      ...active,
      status: 'active',
      expectedEndAt: nextExpectedEndAt,
      pausedAt: undefined,
      pausedRemainingSeconds: undefined,
    };
    if (!saveActiveGuardSession(resumed)) {
      return { ok: false, reason: 'storage-failed' };
    }
    return { ok: true, session: resumed, alreadyApplied: false };
  });
}

async function endGuardSession(
  sessionId: string,
  status: 'completed' | 'stopped',
  endReason: GuardSessionEndReason,
  endedAt: number,
  focusSessionId?: string
): Promise<GuardSessionMutationResult> {
  return withGuardSessionMutationLock(async () => {
    const history = loadGuardSessionHistory();
    const historical = history.find((session) => session.id === sessionId);
    const active = loadActiveGuardSession();

    if (historical) {
      const normalizedFocusSessionId = normalizeOptionalString(
        focusSessionId,
        MAX_LABEL_LENGTH
      );
      const linked =
        normalizedFocusSessionId &&
        historical.focusSessionId !== normalizedFocusSessionId
          ? { ...historical, focusSessionId: normalizedFocusSessionId }
          : historical;
      if (linked !== historical) {
        const nextHistory = history.map((session) =>
          session.id === sessionId ? linked : session
        );
        if (!saveGuardSessionHistory(nextHistory)) {
          return { ok: false, reason: 'storage-failed' };
        }
      }
      if (active?.id === sessionId && !saveActiveGuardSession(null)) {
        return { ok: false, reason: 'storage-failed' };
      }
      return { ok: true, session: linked, alreadyApplied: true };
    }

    if (!active) {
      return { ok: false, reason: 'session-not-found' };
    }
    if (active.id !== sessionId) {
      return {
        ok: false,
        reason: 'session-conflict',
        activeSession: active,
      };
    }
    if (!isFiniteTimestamp(endedAt) || endedAt < active.startedAt) {
      return { ok: false, reason: 'invalid-input' };
    }

    const normalizedEnded = normalizeFocusGuardSession({
      ...active,
      status,
      focusSessionId: focusSessionId ?? active.focusSessionId,
      pausedAt: undefined,
      pausedRemainingSeconds: undefined,
      endedAt,
      endReason,
      ...(status === 'completed' ? createPendingGuardReview() : {}),
    });
    if (!normalizedEnded) return { ok: false, reason: 'invalid-input' };
    const ended = compactGuardSessionForHistory(normalizedEnded);
    const nextHistory = [ended, ...history];
    if (!saveGuardSessionHistory(nextHistory)) {
      return { ok: false, reason: 'storage-failed' };
    }
    if (!saveActiveGuardSession(null)) {
      return { ok: false, reason: 'storage-failed' };
    }
    return { ok: true, session: ended, alreadyApplied: false };
  });
}

export function completeGuardSession(
  sessionId: string,
  options: {
    endedAt?: number;
    endReason?: 'completed' | 'recovered';
    focusSessionId?: string;
  } = {}
) {
  return endGuardSession(
    sessionId,
    'completed',
    options.endReason ?? 'completed',
    options.endedAt ?? Date.now(),
    options.focusSessionId
  );
}

export function stopGuardSession(sessionId: string, endedAt = Date.now()) {
  return endGuardSession(sessionId, 'stopped', 'stopped', endedAt);
}

export async function submitGuardSessionReview(
  sessionId: string,
  input: SubmitGuardReviewInput
): Promise<GuardReviewMutationResult> {
  return withGuardSessionMutationLock(async () => {
    const history = loadGuardSessionHistory();
    const current = history.find((session) => session.id === sessionId);
    const result = applyGuardReviewSubmission(current, input);
    if (!result.ok || result.alreadyApplied) return result;

    const nextHistory = history.map((session) =>
      session.id === sessionId ? result.session : session
    );
    if (!saveGuardSessionHistory(nextHistory)) {
      return { ok: false, reason: 'storage-failed' };
    }
    return result;
  });
}

export async function skipGuardSessionReview(
  sessionId: string,
  reviewedAt = Date.now()
): Promise<GuardReviewMutationResult> {
  return withGuardSessionMutationLock(async () => {
    const history = loadGuardSessionHistory();
    const current = history.find((session) => session.id === sessionId);
    const result = applyGuardReviewSkip(current, reviewedAt);
    if (!result.ok || result.alreadyApplied) return result;

    const nextHistory = history.map((session) =>
      session.id === sessionId ? result.session : session
    );
    if (!saveGuardSessionHistory(nextHistory)) {
      return { ok: false, reason: 'storage-failed' };
    }
    return result;
  });
}

export function loadFocusInterruptions() {
  return dedupeById(
    loadCollection(
      GUARD_INTERRUPTION_STORAGE_KEY,
      normalizeFocusInterruption,
      MAX_INTERRUPTION_ITEMS
    )
  );
}

function saveFocusInterruptions(items: FocusInterruption[]) {
  return saveCollection(
    GUARD_INTERRUPTION_STORAGE_KEY,
    dedupeById(items).slice(0, MAX_INTERRUPTION_ITEMS),
    GUARD_INTERRUPTION_UPDATED_EVENT
  );
}

export function addFocusInterruption(
  input: Omit<FocusInterruption, 'id'> & { id?: string }
) {
  const item = normalizeFocusInterruption({
    ...input,
    id: input.id ?? createFocusGuardId('guard-interruption'),
  });
  if (!item) return null;
  const current = loadFocusInterruptions();
  if (current.some((existing) => existing.id === item.id)) {
    return current.find((existing) => existing.id === item.id) ?? null;
  }
  const withoutDuplicateAttention =
    item.type === 'blocked-site'
      ? current.filter(
          (existing) =>
            !(
              existing.guardSessionId === item.guardSessionId &&
              (existing.type === 'page-hidden' ||
                existing.type === 'window-blur') &&
              Math.abs(existing.occurredAt - item.occurredAt) <= 5_000 &&
              (existing.resolution ?? 'unknown') === 'unknown'
            )
        )
      : current;
  return saveFocusInterruptions([item, ...withoutDuplicateAttention])
    ? item
    : null;
}

export function updateFocusInterruptionResolution(
  interruptionId: string,
  resolution: InterruptionResolution,
  returnedAt?: number
) {
  const current = loadFocusInterruptions();
  const existing = current.find((item) => item.id === interruptionId);
  if (!existing) return null;
  const updated = normalizeFocusInterruption({
    ...existing,
    resolution,
    returnedAt,
  });
  if (!updated) return null;
  const next = current.map((item) =>
    item.id === interruptionId ? updated : item
  );
  return saveFocusInterruptions(next) ? updated : null;
}

export function clearFocusInterruptions(guardSessionId?: string) {
  const current = loadFocusInterruptions();
  const next = guardSessionId
    ? current.filter((item) => item.guardSessionId !== guardSessionId)
    : [];
  return saveFocusInterruptions(next);
}

export function loadDistractionItems() {
  return dedupeById(
    loadCollection(
      DISTRACTION_INBOX_STORAGE_KEY,
      normalizeDistractionItem,
      MAX_DISTRACTION_ITEMS
    )
  );
}

function saveDistractionItems(items: DistractionItem[]) {
  return saveCollection(
    DISTRACTION_INBOX_STORAGE_KEY,
    dedupeById(items).slice(0, MAX_DISTRACTION_ITEMS),
    DISTRACTION_INBOX_UPDATED_EVENT
  );
}

export function addDistractionItem(input: AddDistractionInput) {
  const item = normalizeDistractionItem({
    id: input.id ?? createFocusGuardId('distraction'),
    text: input.text,
    capturedAt: input.capturedAt ?? Date.now(),
    guardSessionId: input.guardSessionId,
    status: 'inbox',
  });
  if (!item) return null;
  const current = loadDistractionItems();
  const existing = current.find((currentItem) => currentItem.id === item.id);
  if (existing) return existing;
  return saveDistractionItems([item, ...current]) ? item : null;
}

export function markDistractionConvertedToTask(
  distractionId: string,
  convertedTaskId: string,
  resolvedAt = Date.now()
) {
  const current = loadDistractionItems();
  const existing = current.find((item) => item.id === distractionId);
  if (!existing) return null;
  if (existing.status === 'converted-to-task') return existing;
  if (existing.status !== 'inbox') return null;
  const updated = normalizeDistractionItem({
    ...existing,
    status: 'converted-to-task',
    convertedTaskId,
    resolvedAt,
  });
  if (!updated) return null;
  const next = current.map((item) =>
    item.id === distractionId ? updated : item
  );
  return saveDistractionItems(next) ? updated : null;
}

export function dismissDistractionItem(
  distractionId: string,
  resolvedAt = Date.now()
) {
  const current = loadDistractionItems();
  const existing = current.find((item) => item.id === distractionId);
  if (!existing) return null;
  if (existing.status !== 'inbox') return existing;
  const updated = normalizeDistractionItem({
    ...existing,
    status: 'dismissed',
    convertedTaskId: undefined,
    resolvedAt,
  });
  if (!updated) return null;
  const next = current.map((item) =>
    item.id === distractionId ? updated : item
  );
  return saveDistractionItems(next) ? updated : null;
}

export function clearDistractionItems(guardSessionId?: string) {
  const current = loadDistractionItems();
  const next = guardSessionId
    ? current.filter((item) => item.guardSessionId !== guardSessionId)
    : [];
  return saveDistractionItems(next);
}
