import { FocusTarget } from '@/types/task';
import {
  PersistedTimerRun,
  PersistedTimerState,
  SelectedTimerPresetId,
  TimerCompletionLedger,
  TimerLease,
  TimerMode,
  TimerPreferences,
  TimerPresetId,
  TimerSettings,
} from '@/types/timer';

export const TIMER_PREFERENCES_STORAGE_KEY =
  'focusflow-timer-preferences-v1';
export const TIMER_STATE_STORAGE_KEY = 'focusflow-timer-state-v1';
export const TIMER_COMPLETIONS_STORAGE_KEY =
  'focusflow-timer-completions-v1';
export const TIMER_LEASE_STORAGE_KEY = 'focusflow-timer-lease-v1';

export const TIMER_STATE_UPDATED_EVENT = 'focusflow-timer-state-updated-v1';
export const TIMER_PREFERENCES_UPDATED_EVENT =
  'focusflow-timer-preferences-updated-v1';

const TIMER_PRESET_IDS: TimerPresetId[] = [
  'quickStart',
  'classicPomodoro',
  'deepWork',
  'recoveryMode',
];
const TIMER_MODES: TimerMode[] = ['focus', 'shortBreak', 'longBreak'];
const MAX_COMPLETION_RECORDS = 200;
const MAX_DURATION_SECONDS = 24 * 60 * 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTimerMode(value: unknown): value is TimerMode {
  return TIMER_MODES.includes(value as TimerMode);
}

function isSelectedPresetId(value: unknown): value is SelectedTimerPresetId {
  return (
    value === 'custom' || TIMER_PRESET_IDS.includes(value as TimerPresetId)
  );
}

function normalizeDuration(value: unknown): number | null {
  if (!isFiniteNumber(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 1 || rounded > MAX_DURATION_SECONDS) return null;
  return rounded;
}

export function normalizeTimerSettings(value: unknown): TimerSettings | null {
  if (!isRecord(value)) return null;

  const focus = normalizeDuration(value.focus);
  const shortBreak = normalizeDuration(value.shortBreak);
  const longBreak = normalizeDuration(value.longBreak);

  if (focus === null || shortBreak === null || longBreak === null) return null;
  return { focus, shortBreak, longBreak };
}

function normalizeFocusTarget(value: unknown): FocusTarget | undefined {
  if (!isRecord(value)) return undefined;
  if (!isNonEmptyString(value.taskId) || !isNonEmptyString(value.label)) {
    return undefined;
  }
  if (value.stepId !== undefined && !isNonEmptyString(value.stepId)) {
    return undefined;
  }

  return {
    taskId: value.taskId,
    stepId: value.stepId as string | undefined,
    label: value.label,
  };
}

export function normalizeTimerPreferences(
  value: unknown,
  fallback: TimerPreferences
): TimerPreferences {
  if (!isRecord(value) || value.version !== 1) return fallback;

  const settings = normalizeTimerSettings(value.settings);
  if (!settings || !isSelectedPresetId(value.selectedPresetId)) return fallback;

  return {
    version: 1,
    settings,
    selectedPresetId: value.selectedPresetId,
  };
}

function normalizeTimerRun(value: unknown): PersistedTimerRun | null {
  if (!isRecord(value)) return null;

  const settingsSnapshot = normalizeTimerSettings(value.settingsSnapshot);
  const durationSeconds = normalizeDuration(value.durationSeconds);
  const pausedRemainingSeconds = normalizeDuration(
    value.pausedRemainingSeconds
  );
  const completedFocusCount = isFiniteNumber(value.completedFocusCount)
    ? Math.round(value.completedFocusCount)
    : -1;

  if (
    !isNonEmptyString(value.id) ||
    !isTimerMode(value.mode) ||
    (value.status !== 'active' && value.status !== 'paused') ||
    typeof value.hasStarted !== 'boolean' ||
    !isFiniteNumber(value.startedAt) ||
    value.startedAt < 0 ||
    !settingsSnapshot ||
    durationSeconds === null ||
    pausedRemainingSeconds === null ||
    pausedRemainingSeconds > durationSeconds ||
    !isSelectedPresetId(value.presetIdSnapshot) ||
    completedFocusCount < 0
  ) {
    return null;
  }

  if (
    value.status === 'active' &&
    (!value.hasStarted ||
      !isFiniteNumber(value.expectedEndAt) ||
      value.expectedEndAt < value.startedAt)
  ) {
    return null;
  }

  if (
    value.status === 'paused' &&
    value.expectedEndAt !== undefined &&
    value.expectedEndAt !== null
  ) {
    return null;
  }

  const focusTargetSnapshot = normalizeFocusTarget(value.focusTargetSnapshot);

  return {
    id: value.id,
    mode: value.mode,
    status: value.status,
    hasStarted: value.hasStarted,
    startedAt: value.startedAt,
    expectedEndAt:
      value.status === 'active' ? (value.expectedEndAt as number) : undefined,
    pausedRemainingSeconds,
    durationSeconds,
    settingsSnapshot,
    presetIdSnapshot: value.presetIdSnapshot,
    completedFocusCount,
    focusTargetSnapshot:
      value.mode === 'focus' && value.hasStarted
        ? focusTargetSnapshot
        : undefined,
  };
}

export function normalizeTimerState(value: unknown): PersistedTimerState | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const run = normalizeTimerRun(value.run);
  if (!run || !isFiniteNumber(value.updatedAt) || value.updatedAt < 0) {
    return null;
  }

  return { version: 1, run, updatedAt: value.updatedAt };
}

export function normalizeCompletionLedger(
  value: unknown
): TimerCompletionLedger {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.records)) {
    return { version: 1, records: [] };
  }

  const records = value.records
    .filter(isRecord)
    .filter(
      (record) =>
        isNonEmptyString(record.runId) &&
        isFiniteNumber(record.completedAt) &&
        record.completedAt >= 0 &&
        isFiniteNumber(record.notifiedAt) &&
        record.notifiedAt >= 0
    )
    .map((record) => ({
      runId: record.runId as string,
      completedAt: record.completedAt as number,
      notifiedAt: record.notifiedAt as number,
    }));

  return { version: 1, records: records.slice(0, MAX_COMPLETION_RECORDS) };
}

function normalizeLease(value: unknown): TimerLease | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (
    !isNonEmptyString(value.ownerId) ||
    !isNonEmptyString(value.runId) ||
    !isFiniteNumber(value.expiresAt) ||
    value.expiresAt < 0
  ) {
    return null;
  }

  return {
    version: 1,
    ownerId: value.ownerId,
    runId: value.runId,
    expiresAt: value.expiresAt,
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

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadTimerPreferences(
  fallback: TimerPreferences
): TimerPreferences {
  return normalizeTimerPreferences(
    readJson(TIMER_PREFERENCES_STORAGE_KEY),
    fallback
  );
}

export function saveTimerPreferences(preferences: TimerPreferences): boolean {
  const saved = writeJson(TIMER_PREFERENCES_STORAGE_KEY, preferences);
  if (saved) window.dispatchEvent(new Event(TIMER_PREFERENCES_UPDATED_EVENT));
  return saved;
}

export function loadTimerState(): PersistedTimerState | null {
  return normalizeTimerState(readJson(TIMER_STATE_STORAGE_KEY));
}

export function saveTimerState(state: PersistedTimerState): boolean {
  const saved = writeJson(TIMER_STATE_STORAGE_KEY, state);
  if (saved) window.dispatchEvent(new Event(TIMER_STATE_UPDATED_EVENT));
  return saved;
}

export function loadCompletionLedger(): TimerCompletionLedger {
  return normalizeCompletionLedger(readJson(TIMER_COMPLETIONS_STORAGE_KEY));
}

export function hasCompletedRun(runId: string): boolean {
  return loadCompletionLedger().records.some((record) => record.runId === runId);
}

export function recordCompletedRun(
  runId: string,
  completedAt: number,
  notifiedAt: number
): boolean {
  const ledger = loadCompletionLedger();
  if (ledger.records.some((record) => record.runId === runId)) return false;

  return writeJson(TIMER_COMPLETIONS_STORAGE_KEY, {
    version: 1,
    records: [
      { runId, completedAt, notifiedAt },
      ...ledger.records,
    ].slice(0, MAX_COMPLETION_RECORDS),
  } satisfies TimerCompletionLedger);
}

export function loadTimerLease(): TimerLease | null {
  return normalizeLease(readJson(TIMER_LEASE_STORAGE_KEY));
}

export function writeTimerLease(lease: TimerLease): boolean {
  return writeJson(TIMER_LEASE_STORAGE_KEY, lease);
}

export function releaseTimerLease(ownerId: string, runId: string): void {
  if (typeof window === 'undefined') return;
  const lease = loadTimerLease();
  if (lease?.ownerId !== ownerId || lease.runId !== runId) return;
  try {
    localStorage.removeItem(TIMER_LEASE_STORAGE_KEY);
  } catch {
    // A failed cleanup is bounded by lease expiry.
  }
}

export function createRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `timer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createPreparedTimerState(
  mode: TimerMode,
  preferences: TimerPreferences,
  completedFocusCount: number,
  now: number
): PersistedTimerState {
  const durationSeconds = preferences.settings[mode];
  return {
    version: 1,
    run: {
      id: createRunId(),
      mode,
      status: 'paused',
      hasStarted: false,
      startedAt: now,
      pausedRemainingSeconds: durationSeconds,
      durationSeconds,
      settingsSnapshot: { ...preferences.settings },
      presetIdSnapshot: preferences.selectedPresetId,
      completedFocusCount: Math.max(0, Math.round(completedFocusCount)),
    },
    updatedAt: now,
  };
}
