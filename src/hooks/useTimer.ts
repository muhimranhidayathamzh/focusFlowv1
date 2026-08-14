import { useCallback, useEffect, useRef, useState } from 'react';
import { NewFocusSession } from '@/types/focusSession';
import { FocusTarget } from '@/types/task';
import {
  PersistedTimerRun,
  PersistedTimerState,
  ResumeTimerInput,
  SelectedTimerPresetId,
  StartTimerInput,
  TimerActionResult,
  TimerCompletionContext,
  TimerMode,
  TimerPreferences,
  TimerPreset,
  TimerPresetId,
  TimerSettings,
} from '@/types/timer';
import {
  TIMER_PREFERENCES_STORAGE_KEY,
  TIMER_PREFERENCES_UPDATED_EVENT,
  TIMER_STATE_STORAGE_KEY,
  TIMER_STATE_UPDATED_EVENT,
  createPreparedTimerState,
  createRunId,
  hasCompletedRun,
  loadTimerLease,
  loadTimerPreferences,
  loadTimerState,
  normalizeTimerSettings,
  recordCompletedRun,
  releaseTimerLease,
  saveTimerPreferences,
  saveTimerState,
  writeTimerLease,
} from '@/lib/timerPersistence';

export type {
  SelectedTimerPresetId,
  TimerMode,
  TimerPresetId,
  TimerSettings,
} from '@/types/timer';

export const timerPresets: TimerPreset[] = [
  {
    id: 'quickStart',
    label: 'Quick Start',
    description: 'Mulai ringan saat tugas terasa berat',
    settings: {
      focus: 10 * 60,
      shortBreak: 2 * 60,
      longBreak: 8 * 60,
    },
  },
  {
    id: 'classicPomodoro',
    label: 'Classic Pomodoro',
    description: 'Ritme fokus harian yang familiar',
    settings: {
      focus: 25 * 60,
      shortBreak: 5 * 60,
      longBreak: 15 * 60,
    },
  },
  {
    id: 'deepWork',
    label: 'Deep Work',
    description: 'Blok panjang untuk coding, menulis, riset',
    settings: {
      focus: 50 * 60,
      shortBreak: 10 * 60,
      longBreak: 20 * 60,
    },
  },
  {
    id: 'recoveryMode',
    label: 'Recovery Mode',
    description: 'Fokus lembut saat energi sedang rendah',
    settings: {
      focus: 20 * 60,
      shortBreak: 8 * 60,
      longBreak: 15 * 60,
    },
  },
];

const DEFAULT_PRESET_ID: TimerPresetId = 'classicPomodoro';
const LEASE_DURATION_MS = 6_000;
const LEASE_HEARTBEAT_MS = 2_000;
const CLOCK_REFRESH_MS = 250;

export const defaultSettings: TimerSettings =
  timerPresets.find((preset) => preset.id === DEFAULT_PRESET_ID)?.settings ??
  timerPresets[1].settings;

const defaultPreferences: TimerPreferences = {
  version: 1,
  settings: defaultSettings,
  selectedPresetId: DEFAULT_PRESET_ID,
};

function settingsMatchPreset(settings: TimerSettings) {
  return timerPresets.find(
    (preset) =>
      preset.settings.focus === settings.focus &&
      preset.settings.shortBreak === settings.shortBreak &&
      preset.settings.longBreak === settings.longBreak
  );
}

function getActiveRemainingSeconds(run: PersistedTimerRun, now: number) {
  if (run.status !== 'active' || run.expectedEndAt === undefined) {
    return run.pausedRemainingSeconds;
  }
  return Math.max(0, Math.ceil((run.expectedEndAt - now) / 1000));
}

function cloneFocusTarget(target: FocusTarget | null | undefined) {
  if (!target) return undefined;
  const label = target.label.trim();
  if (!target.taskId || !label) return undefined;
  return {
    taskId: target.taskId,
    stepId: target.stepId,
    label,
  } satisfies FocusTarget;
}

interface UseTimerOptions {
  focusTarget?: FocusTarget | null;
  onFocusSessionComplete?: (
    session: NewFocusSession,
    context: TimerCompletionContext
  ) => void | Promise<unknown>;
}

interface WebLockManagerLike {
  request(
    name: string,
    options: { mode: 'exclusive'; signal: AbortSignal },
    callback: () => Promise<void>
  ): Promise<void>;
}

export function useTimer(options: UseTimerOptions = {}) {
  const [preferences, setPreferences] =
    useState<TimerPreferences>(defaultPreferences);
  const [timerState, setTimerState] = useState<PersistedTimerState>(() =>
    createPreparedTimerState('focus', defaultPreferences, 0, 0)
  );
  const [timeLeft, setTimeLeft] = useState(defaultSettings.focus);
  const [isLoaded, setIsLoaded] = useState(false);

  const timerStateRef = useRef(timerState);
  const preferencesRef = useRef(preferences);
  const focusTargetRef = useRef(options.focusTarget);
  const completionCallbackRef = useRef(options.onFocusSessionComplete);
  const ownerRef = useRef(false);
  const completingRunIdsRef = useRef(new Set<string>());
  const notifiedRunIdsRef = useRef(new Set<string>());
  const recoveredRunIdsRef = useRef(new Set<string>());
  const tabIdRef = useRef(createRunId());

  timerStateRef.current = timerState;
  preferencesRef.current = preferences;
  focusTargetRef.current = options.focusTarget;
  completionCallbackRef.current = options.onFocusSessionComplete;

  const commitTimerState = useCallback((
    nextState: PersistedTimerState,
    requirePersistence = false
  ) => {
    const previousState = timerStateRef.current;
    timerStateRef.current = nextState;
    const saved = saveTimerState(nextState);
    if (requirePersistence) {
      const verified = saved ? loadTimerState() : null;
      if (
        !verified ||
        verified.run.id !== nextState.run.id ||
        verified.run.status !== nextState.run.status ||
        verified.run.expectedEndAt !== nextState.run.expectedEndAt
      ) {
        timerStateRef.current = previousState;
        return false;
      }
    }
    setTimerState(nextState);
    setTimeLeft(
      nextState.run.status === 'active'
        ? getActiveRemainingSeconds(nextState.run, Date.now())
        : nextState.run.pausedRemainingSeconds
    );
    return true;
  }, []);

  const playNotification = useCallback((completedMode: TimerMode) => {
    if (typeof window === 'undefined') return;

    try {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();

      const playTone = (
        frequency: number,
        type: OscillatorType,
        delay = 0
      ) => {
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        oscillator.type = type;
        oscillator.frequency.value = frequency;
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime + delay;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
        oscillator.start(now);
        oscillator.stop(now + 2);
      };

      playTone(880, 'sine');
      playTone(1760, 'sine');
      playTone(1318.51, 'sine', 0.2);
    } catch (error) {
      console.error('Audio playback failed:', error);
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('FocusFlow', {
        body: `Waktu ${
          completedMode === 'focus' ? 'Fokus' : 'Istirahat'
        } sudah habis!`,
      });
    }
  }, []);

  const createCompletionTransition = useCallback(
    (completedRun: PersistedTimerRun, completedAt: number) => {
      const completedFocusCount =
        completedRun.completedFocusCount +
        (completedRun.mode === 'focus' ? 1 : 0);
      const nextMode: TimerMode =
        completedRun.mode === 'focus'
          ? completedFocusCount % 4 === 0
            ? 'longBreak'
            : 'shortBreak'
          : 'focus';

      return createPreparedTimerState(
        nextMode,
        preferencesRef.current,
        completedFocusCount,
        completedAt
      );
    },
    []
  );

  const completeRun = useCallback(
    async (candidateRun: PersistedTimerRun) => {
      if (!ownerRef.current) return;
      if (completingRunIdsRef.current.has(candidateRun.id)) return;
      completingRunIdsRef.current.add(candidateRun.id);

      try {
        const persistedState = loadTimerState();
        const persistedRun = persistedState?.run;

        if (
          !persistedRun ||
          persistedRun.id !== candidateRun.id ||
          persistedRun.status !== 'active' ||
          persistedRun.expectedEndAt === undefined
        ) {
          return;
        }

        if (persistedRun.expectedEndAt > Date.now()) return;

        const completedAt = persistedRun.expectedEndAt;
        const nextState = createCompletionTransition(persistedRun, completedAt);

        if (hasCompletedRun(persistedRun.id)) {
          commitTimerState(nextState);
          return;
        }

        if (persistedRun.mode === 'focus') {
          const target = persistedRun.focusTargetSnapshot;
          const completionObservedAt = Date.now();
          await completionCallbackRef.current?.(
            {
              mode: 'focus',
              durationSeconds: persistedRun.durationSeconds,
              presetId: persistedRun.presetIdSnapshot,
              completedAt,
              taskId: target?.taskId,
              stepId: target?.stepId,
              targetLabel: target?.label,
              timerRunId: persistedRun.id,
            },
            {
              run: persistedRun,
              reason:
                recoveredRunIdsRef.current.has(persistedRun.id) ||
                completionObservedAt - completedAt > 1_000
                  ? 'recovered'
                  : 'natural',
            }
          );
        }

        const recorded = recordCompletedRun(
          persistedRun.id,
          completedAt,
          Date.now()
        );
        commitTimerState(nextState);

        if (recorded && !notifiedRunIdsRef.current.has(persistedRun.id)) {
          notifiedRunIdsRef.current.add(persistedRun.id);
          playNotification(persistedRun.mode);
        }
      } finally {
        completingRunIdsRef.current.delete(candidateRun.id);
      }
    },
    [commitTimerState, createCompletionTransition, playNotification]
  );

  useEffect(() => {
    const loadedPreferences = loadTimerPreferences(defaultPreferences);
    const loadedState =
      loadTimerState() ??
      createPreparedTimerState('focus', loadedPreferences, 0, Date.now());

    preferencesRef.current = loadedPreferences;
    timerStateRef.current = loadedState;
    if (
      loadedState.run.status === 'active' &&
      loadedState.run.expectedEndAt !== undefined &&
      loadedState.run.expectedEndAt <= Date.now()
    ) {
      recoveredRunIdsRef.current.add(loadedState.run.id);
    }
    setPreferences(loadedPreferences);
    setTimerState(loadedState);
    setTimeLeft(
      loadedState.run.status === 'active'
        ? getActiveRemainingSeconds(loadedState.run, Date.now())
        : loadedState.run.pausedRemainingSeconds
    );
    setIsLoaded(true);

    if (!loadTimerState()) saveTimerState(loadedState);
  }, []);

  useEffect(() => {
    if (!isLoaded) return;

    const reloadState = () => {
      const stored = loadTimerState();
      if (!stored || stored.updatedAt < timerStateRef.current.updatedAt) return;
      timerStateRef.current = stored;
      setTimerState(stored);
      setTimeLeft(
        stored.run.status === 'active'
          ? getActiveRemainingSeconds(stored.run, Date.now())
          : stored.run.pausedRemainingSeconds
      );
    };
    const reloadPreferences = () => {
      const stored = loadTimerPreferences(defaultPreferences);
      preferencesRef.current = stored;
      setPreferences(stored);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === TIMER_STATE_STORAGE_KEY) reloadState();
      if (event.key === TIMER_PREFERENCES_STORAGE_KEY) reloadPreferences();
    };

    window.addEventListener(TIMER_STATE_UPDATED_EVENT, reloadState);
    window.addEventListener(
      TIMER_PREFERENCES_UPDATED_EVENT,
      reloadPreferences
    );
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(TIMER_STATE_UPDATED_EVENT, reloadState);
      window.removeEventListener(
        TIMER_PREFERENCES_UPDATED_EVENT,
        reloadPreferences
      );
      window.removeEventListener('storage', handleStorage);
    };
  }, [isLoaded]);

  useEffect(() => {
    const run = timerState.run;
    if (!isLoaded || run.status !== 'active') {
      ownerRef.current = false;
      return;
    }

    const ownerId = tabIdRef.current;
    let disposed = false;
    let releaseHeldLock: (() => void) | undefined;
    let heartbeatId: number | undefined;
    const lockName = `focusflow-timer-owner:${run.id}`;
    const lockManager = (
      navigator as Navigator & { locks?: WebLockManagerLike }
    ).locks;

    const heartbeat = () => {
      const currentRun = timerStateRef.current.run;
      if (
        disposed ||
        currentRun.id !== run.id ||
        currentRun.status !== 'active'
      ) {
        releaseHeldLock?.();
        return;
      }

      writeTimerLease({
        version: 1,
        ownerId,
        runId: run.id,
        expiresAt: Date.now() + LEASE_DURATION_MS,
      });
    };

    if (lockManager) {
      const controller = new AbortController();
      void lockManager
        .request(
          lockName,
          { mode: 'exclusive', signal: controller.signal },
          async () => {
            if (disposed) return;
            ownerRef.current = true;
            heartbeat();
            heartbeatId = window.setInterval(
              heartbeat,
              LEASE_HEARTBEAT_MS
            );
            await new Promise<void>((resolve) => {
              releaseHeldLock = resolve;
            });
            if (heartbeatId !== undefined) window.clearInterval(heartbeatId);
            if (ownerRef.current) ownerRef.current = false;
            releaseTimerLease(ownerId, run.id);
          }
        )
        .catch((error: unknown) => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) {
            console.error('Timer ownership lock failed:', error);
          }
        });

      return () => {
        disposed = true;
        controller.abort();
        releaseHeldLock?.();
        if (heartbeatId !== undefined) window.clearInterval(heartbeatId);
        ownerRef.current = false;
        releaseTimerLease(ownerId, run.id);
      };
    }

    const tryAcquireFallbackLease = () => {
      const now = Date.now();
      const currentLease = loadTimerLease();
      if (
        currentLease &&
        currentLease.expiresAt > now &&
        currentLease.ownerId !== ownerId
      ) {
        ownerRef.current = false;
        return;
      }

      writeTimerLease({
        version: 1,
        ownerId,
        runId: run.id,
        expiresAt: now + LEASE_DURATION_MS,
      });
      const verifiedLease = loadTimerLease();
      ownerRef.current =
        verifiedLease?.ownerId === ownerId && verifiedLease.runId === run.id;
    };

    tryAcquireFallbackLease();
    heartbeatId = window.setInterval(
      tryAcquireFallbackLease,
      LEASE_HEARTBEAT_MS
    );

    return () => {
      disposed = true;
      if (heartbeatId !== undefined) window.clearInterval(heartbeatId);
      ownerRef.current = false;
      releaseTimerLease(ownerId, run.id);
    };
  }, [isLoaded, timerState.run]);

  useEffect(() => {
    const run = timerState.run;
    if (!isLoaded || run.status !== 'active') {
      setTimeLeft(run.pausedRemainingSeconds);
      return;
    }

    const refreshClock = () => {
      const currentRun = timerStateRef.current.run;
      if (currentRun.id !== run.id || currentRun.status !== 'active') return;
      const remaining = getActiveRemainingSeconds(currentRun, Date.now());
      setTimeLeft(remaining);
      if (remaining === 0 && ownerRef.current) {
        void completeRun(currentRun);
      }
    };

    refreshClock();
    const intervalId = window.setInterval(refreshClock, CLOCK_REFRESH_MS);
    document.addEventListener('visibilitychange', refreshClock);
    window.addEventListener('focus', refreshClock);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshClock);
      window.removeEventListener('focus', refreshClock);
    };
  }, [completeRun, isLoaded, timerState.run]);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission !== 'granted' &&
      Notification.permission !== 'denied'
    ) {
      void Notification.requestPermission();
    }
  }, []);

  const pauseTimer = useCallback((requirePersistence = false): TimerActionResult => {
    const currentRun = timerStateRef.current.run;
    const now = Date.now();
    if (currentRun.status !== 'active') {
      return { ok: false, run: currentRun, reason: 'invalid-state' };
    }
    const remaining = getActiveRemainingSeconds(currentRun, now);
    if (remaining === 0) {
      if (ownerRef.current) void completeRun(currentRun);
      return { ok: false, run: currentRun, reason: 'invalid-state' };
    }

    const pausedRun: PersistedTimerRun = {
      ...currentRun,
      status: 'paused',
      expectedEndAt: undefined,
      pausedRemainingSeconds: remaining,
    };
    const ok = commitTimerState(
      { version: 1, run: pausedRun, updatedAt: now },
      requirePersistence
    );
    return ok
      ? { ok: true, run: pausedRun }
      : { ok: false, run: currentRun, reason: 'storage-failed' };
  }, [commitTimerState, completeRun]);

  const resumeTimer = useCallback((
    input: ResumeTimerInput = {}
  ): TimerActionResult => {
    const currentRun = timerStateRef.current.run;
    if (currentRun.status !== 'paused' || !currentRun.hasStarted) {
      return { ok: false, run: currentRun, reason: 'invalid-state' };
    }
    const resumedAt = input.resumedAt ?? Date.now();
    const expectedEndAt =
      input.expectedEndAt ??
      resumedAt + currentRun.pausedRemainingSeconds * 1000;
    if (
      !Number.isFinite(resumedAt) ||
      !Number.isFinite(expectedEndAt) ||
      resumedAt < 0 ||
      expectedEndAt < resumedAt
    ) {
      return { ok: false, run: currentRun, reason: 'invalid-input' };
    }

    const resumedRun: PersistedTimerRun = {
      ...currentRun,
      status: 'active',
      expectedEndAt,
    };
    const ok = commitTimerState(
      { version: 1, run: resumedRun, updatedAt: resumedAt },
      input.requirePersistence
    );
    return ok
      ? { ok: true, run: resumedRun }
      : { ok: false, run: currentRun, reason: 'storage-failed' };
  }, [commitTimerState]);

  const startTimer = useCallback((
    input: StartTimerInput = {}
  ): TimerActionResult => {
    const currentRun = timerStateRef.current.run;
    if (currentRun.status !== 'paused') {
      return { ok: false, run: currentRun, reason: 'invalid-state' };
    }
    if (currentRun.hasStarted) {
      return resumeTimer({
        resumedAt: input.startedAt,
        expectedEndAt: input.expectedEndAt,
        requirePersistence: input.requirePersistence,
      });
    }

    const startedAt = input.startedAt ?? Date.now();
    const expectedEndAt =
      input.expectedEndAt ??
      startedAt + currentRun.pausedRemainingSeconds * 1000;
    if (
      !Number.isFinite(startedAt) ||
      !Number.isFinite(expectedEndAt) ||
      startedAt < 0 ||
      expectedEndAt < startedAt
    ) {
      return { ok: false, run: currentRun, reason: 'invalid-input' };
    }

    const activeRun: PersistedTimerRun = {
      ...currentRun,
      status: 'active',
      hasStarted: true,
      startedAt,
      expectedEndAt,
      focusTargetSnapshot:
        currentRun.mode === 'focus'
          ? cloneFocusTarget(input.focusTarget ?? focusTargetRef.current)
          : undefined,
    };
    const ok = commitTimerState(
      { version: 1, run: activeRun, updatedAt: startedAt },
      input.requirePersistence
    );
    return ok
      ? { ok: true, run: activeRun }
      : { ok: false, run: currentRun, reason: 'storage-failed' };
  }, [commitTimerState, resumeTimer]);

  const toggleTimer = useCallback(() => {
    const currentRun = timerStateRef.current.run;
    return currentRun.status === 'active' ? pauseTimer() : startTimer();
  }, [pauseTimer, startTimer]);

  const resetTimer = useCallback((requirePersistence = false) => {
    const currentRun = timerStateRef.current.run;
    return commitTimerState(
      createPreparedTimerState(
        currentRun.mode,
        preferencesRef.current,
        currentRun.completedFocusCount,
        Date.now()
      ),
      requirePersistence
    );
  }, [commitTimerState]);

  const switchMode = useCallback(
    (newMode: TimerMode, requirePersistence = false) => {
      const currentRun = timerStateRef.current.run;
      return commitTimerState(
        createPreparedTimerState(
          newMode,
          preferencesRef.current,
          currentRun.completedFocusCount,
          Date.now()
        ),
        requirePersistence
      );
    },
    [commitTimerState]
  );

  const savePreferences = useCallback(
    (settings: TimerSettings, selectedPresetId: SelectedTimerPresetId) => {
      const normalizedSettings = normalizeTimerSettings(settings);
      if (!normalizedSettings) return;

      const nextPreferences: TimerPreferences = {
        version: 1,
        settings: normalizedSettings,
        selectedPresetId,
      };
      preferencesRef.current = nextPreferences;
      saveTimerPreferences(nextPreferences);
      setPreferences(nextPreferences);

      const currentRun = timerStateRef.current.run;
      if (!currentRun.hasStarted) {
        commitTimerState(
          createPreparedTimerState(
            currentRun.mode,
            nextPreferences,
            currentRun.completedFocusCount,
            Date.now()
          )
        );
      }
    },
    [commitTimerState]
  );

  const updateSettings = useCallback(
    (newSettings: TimerSettings) => {
      const normalizedSettings = normalizeTimerSettings(newSettings);
      if (!normalizedSettings) return;
      savePreferences(
        normalizedSettings,
        settingsMatchPreset(normalizedSettings)?.id ?? 'custom'
      );
    },
    [savePreferences]
  );

  const applyPreset = useCallback(
    (presetId: TimerPresetId) => {
      const preset = timerPresets.find((item) => item.id === presetId);
      if (!preset) return;
      savePreferences(preset.settings, preset.id);
    },
    [savePreferences]
  );

  const run = timerState.run;
  return {
    mode: run.mode,
    timeLeft,
    isActive: run.status === 'active',
    sessionCount: run.completedFocusCount + 1,
    settings: preferences.settings,
    selectedPresetId: preferences.selectedPresetId,
    run,
    isLoaded,
    toggleTimer,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    switchMode,
    updateSettings,
    applyPreset,
  };
}
