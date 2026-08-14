import { FocusTarget } from '@/types/task';

export type TimerMode = 'focus' | 'shortBreak' | 'longBreak';

export interface TimerSettings {
  focus: number;
  shortBreak: number;
  longBreak: number;
}

export type TimerPresetId =
  | 'quickStart'
  | 'classicPomodoro'
  | 'deepWork'
  | 'recoveryMode';

export type SelectedTimerPresetId = TimerPresetId | 'custom';

export interface TimerPreset {
  id: TimerPresetId;
  label: string;
  description: string;
  settings: TimerSettings;
}

export interface TimerPreferences {
  version: 1;
  settings: TimerSettings;
  selectedPresetId: SelectedTimerPresetId;
}

export interface PersistedTimerRun {
  id: string;
  mode: TimerMode;
  status: 'active' | 'paused';
  hasStarted: boolean;
  startedAt: number;
  expectedEndAt?: number;
  pausedRemainingSeconds: number;
  durationSeconds: number;
  settingsSnapshot: TimerSettings;
  presetIdSnapshot: SelectedTimerPresetId;
  completedFocusCount: number;
  focusTargetSnapshot?: FocusTarget;
}

export interface PersistedTimerState {
  version: 1;
  run: PersistedTimerRun;
  updatedAt: number;
}

export interface TimerCompletionRecord {
  runId: string;
  completedAt: number;
  notifiedAt: number;
}

export interface TimerCompletionLedger {
  version: 1;
  records: TimerCompletionRecord[];
}

export interface TimerLease {
  version: 1;
  ownerId: string;
  runId: string;
  expiresAt: number;
}

export type TimerCompletionReason = 'natural' | 'recovered';

export interface TimerCompletionContext {
  run: PersistedTimerRun;
  reason: TimerCompletionReason;
}

export interface TimerActionResult {
  ok: boolean;
  run: PersistedTimerRun;
  reason?: 'invalid-state' | 'invalid-input' | 'storage-failed';
}

export interface StartTimerInput {
  focusTarget?: FocusTarget;
  startedAt?: number;
  expectedEndAt?: number;
  requirePersistence?: boolean;
}

export interface ResumeTimerInput {
  resumedAt?: number;
  expectedEndAt?: number;
  requirePersistence?: boolean;
}
