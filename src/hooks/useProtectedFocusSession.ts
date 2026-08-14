import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTimer } from '@/hooks/useTimer';
import { useTasks } from '@/hooks/useTasks';
import { useFocusTarget } from '@/hooks/useFocusTarget';
import { useFocusSessions } from '@/hooks/useFocusSessions';
import { useFocusGuardProfiles } from '@/hooks/useFocusGuardProfiles';
import { useFocusGuardPreferences } from '@/hooks/useFocusGuardPreferences';
import { useFocusGuardSession } from '@/hooks/useFocusGuardSession';
import { getActiveGuardSession } from '@/lib/focusGuardPersistence';
import { loadTimerState } from '@/lib/timerPersistence';
import { FocusSession, NewFocusSession } from '@/types/focusSession';
import { FocusTarget } from '@/types/task';
import {
  GuardSessionMutationResult,
  ProtectionLevel,
} from '@/types/focusGuard';
import {
  TimerCompletionContext,
  TimerMode,
} from '@/types/timer';

export interface GuardTargetOption {
  key: string;
  label: string;
  kind: 'task' | 'step';
  target: FocusTarget;
}

export interface GuardProfileOption {
  id: string;
  name: string;
  protectionLevel: ProtectionLevel;
  bypassDelaySeconds: number;
  bypassDurationMinutes: number;
  requireBypassReason: boolean;
  websiteRuleCount: number;
}

export interface FocusContractSubmission {
  targetKey: string;
  profileId: string;
  intention?: string;
}

interface UseProtectedFocusSessionOptions {
  onFocusSessionRecorded?: (
    session: FocusSession,
    context: { guardSessionId?: string }
  ) => void;
}

function guardFailureMessage(result: GuardSessionMutationResult) {
  if (result.ok) return null;
  switch (result.reason) {
    case 'active-session-exists':
      return 'Masih ada sesi terlindungi aktif. Hentikan atau pulihkan sesi itu terlebih dahulu.';
    case 'session-conflict':
      return 'Status sesi berubah di tab lain. Muat ulang lalu coba lagi.';
    case 'storage-failed':
      return 'Sesi tidak dapat disimpan di perangkat ini. Timer belum dimulai.';
    case 'invalid-input':
      return 'Detail sesi belum valid. Periksa target, profil, dan durasi.';
    case 'session-not-found':
      return 'Sesi terlindungi tidak ditemukan. Muat ulang untuk menyelaraskan status.';
  }
}

export function useProtectedFocusSession(
  options: UseProtectedFocusSessionOptions = {}
) {
  const tasksApi = useTasks();
  const focusTargetApi = useFocusTarget();
  const focusSessionsApi = useFocusSessions();
  const profileApi = useFocusGuardProfiles();
  const preferenceApi = useFocusGuardPreferences();
  const guardSessionApi = useFocusGuardSession();
  const [isContractOpen, setIsContractOpen] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [controllerError, setControllerError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [isReconciliationReady, setIsReconciliationReady] = useState(false);
  const mutationRef = useRef(false);
  const reconciliationRef = useRef(false);
  const recordedCallbackRef = useRef(options.onFocusSessionRecorded);
  recordedCallbackRef.current = options.onFocusSessionRecorded;

  const handleFocusSessionComplete = useCallback(
    async (session: NewFocusSession, context: TimerCompletionContext) => {
      const storedSession = focusSessionsApi.addSession(session);
      const activeGuard = getActiveGuardSession();

      if (
        activeGuard &&
        session.timerRunId &&
        activeGuard.timerRunId === session.timerRunId
      ) {
        const result = await guardSessionApi.completeSession(activeGuard.id, {
          endedAt: session.completedAt,
          endReason:
            context.reason === 'recovered' ? 'recovered' : 'completed',
          focusSessionId: storedSession.id,
        });
        if (!result.ok) {
          const message =
            guardFailureMessage(result) ??
            'Sesi fokus selesai, tetapi proteksi belum dapat ditutup.';
          setControllerError(message);
          throw new Error(message);
        }
      }

      recordedCallbackRef.current?.(storedSession, {
        guardSessionId: activeGuard?.id,
      });
    },
    [focusSessionsApi, guardSessionApi]
  );

  const timer = useTimer({
    focusTarget: focusTargetApi.activeTarget,
    onFocusSessionComplete: handleFocusSessionComplete,
  });

  const targetOptions = useMemo<GuardTargetOption[]>(() => {
    const options: GuardTargetOption[] = [];
    tasksApi.tasks
      .filter((task) => !task.completed)
      .forEach((task) => {
        options.push({
          key: `task:${task.id}`,
          label: task.text,
          kind: 'task',
          target: { taskId: task.id, label: task.text },
        });
        (task.steps ?? [])
          .filter((step) => !step.completed)
          .forEach((step) =>
            options.push({
              key: `step:${task.id}:${step.id}`,
              label: `${task.text} — ${step.text}`,
              kind: 'step',
              target: {
                taskId: task.id,
                stepId: step.id,
                label: step.text,
              },
            })
          );
      });
    return options;
  }, [tasksApi.tasks]);

  const profileOptions = useMemo<GuardProfileOption[]>(
    () =>
      profileApi.profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        protectionLevel: profile.protectionLevel,
        bypassDelaySeconds: profile.bypassDelaySeconds,
        bypassDurationMinutes: profile.bypassDurationMinutes,
        requireBypassReason: profile.requireBypassReason,
        websiteRuleCount: profile.websiteRules.filter(
          (rule) => rule.action === 'block' && rule.matchType === 'domain'
        ).length,
      })),
    [profileApi.profiles]
  );

  const defaultTargetKey = useMemo(() => {
    const active = focusTargetApi.activeTarget;
    if (!active) return '';
    return (
      targetOptions.find(
        (option) =>
          option.target.taskId === active.taskId &&
          option.target.stepId === active.stepId
      )?.key ?? ''
    );
  }, [focusTargetApi.activeTarget, targetOptions]);

  const matchingGuardSession =
    guardSessionApi.activeSession?.timerRunId === timer.run.id
      ? guardSessionApi.activeSession
      : null;
  const guardStorageReady =
    preferenceApi.isLoaded && profileApi.isLoaded && guardSessionApi.isLoaded;
  const reconcileActiveSession = guardSessionApi.activeSession;
  const reconcileCompleteSession = guardSessionApi.completeSession;
  const reconcilePauseSession = guardSessionApi.pauseSession;
  const reconcileResumeSession = guardSessionApi.resumeSession;
  const reconcileStopSession = guardSessionApi.stopSession;

  useEffect(() => {
    if (
      !timer.isLoaded ||
      !guardSessionApi.isLoaded ||
      !focusSessionsApi.isLoaded
    ) {
      setIsReconciliationReady(false);
      return;
    }

    if (mutationRef.current || reconciliationRef.current) {
      setIsReconciliationReady(false);
      return;
    }

    const activeGuard = reconcileActiveSession;
    if (!activeGuard) {
      setIsReconciliationReady(true);
      return;
    }

    setIsReconciliationReady(false);
    reconciliationRef.current = true;
    void (async () => {
      try {
        const completedFocusSession = focusSessionsApi.sessions.find(
          (session) =>
            session.timerRunId &&
            session.timerRunId === activeGuard.timerRunId
        );
        if (completedFocusSession) {
          await reconcileCompleteSession(activeGuard.id, {
            endedAt: completedFocusSession.completedAt,
            endReason: 'recovered',
            focusSessionId: completedFocusSession.id,
          });
          return;
        }

        // A second tab can receive the Guard event before the immediately
        // following timer event. Persisted timer state is the cross-tab source
        // of truth, so transaction ordering cannot stop a valid new session.
        const canonicalRun = loadTimerState()?.run ?? timer.run;
        const matchesTimer =
          activeGuard.timerRunId === canonicalRun.id &&
          canonicalRun.mode === 'focus' &&
          canonicalRun.hasStarted;

        const isGuardFirstTransaction =
          activeGuard.timerRunId === canonicalRun.id &&
          canonicalRun.mode === 'focus' &&
          !canonicalRun.hasStarted &&
          Date.now() - activeGuard.startedAt < 2_000;

        if (isGuardFirstTransaction) return;

        if (!preferenceApi.preferences.guardEnabled || !matchesTimer) {
          await reconcileStopSession(activeGuard.id, Date.now());
          return;
        }

        if (canonicalRun.status === 'paused' && activeGuard.status === 'active') {
          await reconcilePauseSession(
            activeGuard.id,
            Date.now(),
            canonicalRun.pausedRemainingSeconds
          );
          return;
        }

        if (
          canonicalRun.status === 'active' &&
          activeGuard.status === 'paused' &&
          canonicalRun.expectedEndAt !== undefined
        ) {
          await reconcileResumeSession(
            activeGuard.id,
            Date.now(),
            canonicalRun.expectedEndAt
          );
        }
      } finally {
        reconciliationRef.current = false;
        setIsReconciliationReady(true);
      }
    })();
  }, [
    focusSessionsApi.isLoaded,
    focusSessionsApi.sessions,
    reconcileActiveSession,
    reconcileCompleteSession,
    guardSessionApi.isLoaded,
    reconcilePauseSession,
    reconcileResumeSession,
    reconcileStopSession,
    isMutating,
    preferenceApi.preferences.guardEnabled,
    timer.isLoaded,
    timer.run,
  ]);

  const openContract = useCallback(() => {
    setContractError(
      targetOptions.length === 0
        ? 'Buat satu task atau checklist yang belum selesai sebelum memulai sesi terlindungi.'
        : null
    );
    setIsContractOpen(true);
  }, [targetOptions.length]);

  const cancelContract = useCallback(() => {
    if (mutationRef.current) return;
    setIsContractOpen(false);
    setContractError(null);
  }, []);

  const confirmContract = useCallback(
    async (submission: FocusContractSubmission) => {
      if (mutationRef.current) return false;
      const currentRun = timer.run;
      const targetOption = targetOptions.find(
        (option) => option.key === submission.targetKey
      );
      const profile = profileApi.profiles.find(
        (item) => item.id === submission.profileId
      );
      const intention = submission.intention?.trim().slice(0, 500);

      if (!targetOption) {
        setContractError('Pilih task atau langkah yang akan dilindungi.');
        return false;
      }
      if (!profile) {
        setContractError('Profil proteksi tidak tersedia. Pilih profil lain.');
        return false;
      }
      if (
        currentRun.mode !== 'focus' ||
        currentRun.status !== 'paused' ||
        currentRun.hasStarted
      ) {
        setContractError('Status timer berubah. Tutup dialog lalu coba lagi.');
        return false;
      }

      mutationRef.current = true;
      setIsMutating(true);
      setContractError(null);
      setControllerError(null);
      const startedAt = Date.now();
      const expectedEndAt =
        startedAt + currentRun.pausedRemainingSeconds * 1000;

      try {
        const guardResult = await guardSessionApi.startSession({
          timerRunId: currentRun.id,
          profileId: profile.id,
          targetSnapshot: targetOption.target,
          intention: intention || undefined,
          durationSeconds: currentRun.durationSeconds,
          startedAt,
          expectedEndAt,
        });
        if (!guardResult.ok) {
          setContractError(
            guardFailureMessage(guardResult) ??
              'Sesi terlindungi belum dapat dimulai.'
          );
          return false;
        }

        const timerResult = timer.startTimer({
          focusTarget: targetOption.target,
          startedAt,
          expectedEndAt,
          requirePersistence: true,
        });
        if (!timerResult.ok) {
          await guardSessionApi.stopSession(guardResult.session.id, Date.now());
          setContractError(
            'Timer tidak dapat diaktifkan. Sesi proteksi sudah dibatalkan dengan aman.'
          );
          return false;
        }

        const verifiedGuard = getActiveGuardSession();
        if (
          verifiedGuard?.id !== guardResult.session.id ||
          verifiedGuard.timerRunId !== timerResult.run.id
        ) {
          timer.resetTimer(true);
          await guardSessionApi.stopSession(guardResult.session.id, Date.now());
          setContractError(
            'Timer dan proteksi tidak dapat diselaraskan. Keduanya telah dihentikan.'
          );
          return false;
        }

        focusTargetApi.setTarget(targetOption.target);
        preferenceApi.selectProfile(profile.id);
        setIsContractOpen(false);
        return true;
      } finally {
        mutationRef.current = false;
        setIsMutating(false);
      }
    },
    [
      focusTargetApi,
      guardSessionApi,
      preferenceApi,
      profileApi.profiles,
      targetOptions,
      timer,
    ]
  );

  const handlePrimaryAction = useCallback(async () => {
    if (mutationRef.current || !guardStorageReady) return;
    setControllerError(null);
    const run = timer.run;
    const guard = getActiveGuardSession();
    const matchingGuard = guard?.timerRunId === run.id ? guard : null;

    if (run.status === 'active') {
      if (!matchingGuard) {
        timer.pauseTimer();
        return;
      }
      mutationRef.current = true;
      setIsMutating(true);
      try {
        const now = Date.now();
        const result = await guardSessionApi.pauseSession(
          matchingGuard.id,
          now,
          timer.timeLeft
        );
        if (!result.ok) {
          setControllerError(guardFailureMessage(result));
          return;
        }
        const timerResult = timer.pauseTimer(true);
        if (!timerResult.ok) {
          await guardSessionApi.resumeSession(
            matchingGuard.id,
            now,
            run.expectedEndAt
          );
          setControllerError('Timer gagal dipause; status proteksi dipulihkan.');
        }
      } finally {
        mutationRef.current = false;
        setIsMutating(false);
      }
      return;
    }

    if (run.hasStarted) {
      if (!matchingGuard) {
        timer.resumeTimer();
        return;
      }
      mutationRef.current = true;
      setIsMutating(true);
      try {
        const resumedAt = Date.now();
        const expectedEndAt =
          resumedAt + run.pausedRemainingSeconds * 1000;
        const result = await guardSessionApi.resumeSession(
          matchingGuard.id,
          resumedAt,
          expectedEndAt
        );
        if (!result.ok) {
          setControllerError(guardFailureMessage(result));
          return;
        }
        const timerResult = timer.resumeTimer({
          resumedAt,
          expectedEndAt,
          requirePersistence: true,
        });
        if (!timerResult.ok) {
          await guardSessionApi.pauseSession(
            matchingGuard.id,
            Date.now(),
            run.pausedRemainingSeconds
          );
          setControllerError('Timer gagal dilanjutkan; proteksi tetap dipause.');
        }
      } finally {
        mutationRef.current = false;
        setIsMutating(false);
      }
      return;
    }

    if (
      preferenceApi.preferences.guardEnabled &&
      run.mode === 'focus'
    ) {
      openContract();
      return;
    }

    timer.startTimer();
  }, [
    guardSessionApi,
    guardStorageReady,
    openContract,
    preferenceApi.preferences.guardEnabled,
    timer,
  ]);

  const stopMatchingGuard = useCallback(async () => {
    const guard = getActiveGuardSession();
    if (!guard || guard.timerRunId !== timer.run.id) return true;
    const result = await guardSessionApi.stopSession(guard.id, Date.now());
    if (!result.ok) {
      setControllerError(guardFailureMessage(result));
      return false;
    }
    return true;
  }, [guardSessionApi, timer.run.id]);

  const resetProtectedTimer = useCallback(async () => {
    if (mutationRef.current) return;
    mutationRef.current = true;
    setIsMutating(true);
    try {
      const activeGuard = getActiveGuardSession();
      const wasProtected = activeGuard?.timerRunId === timer.run.id;
      if (!(await stopMatchingGuard())) return;
      if (!timer.resetTimer(Boolean(wasProtected))) {
        setControllerError('Timer tidak dapat direset di penyimpanan lokal.');
      }
    } finally {
      mutationRef.current = false;
      setIsMutating(false);
    }
  }, [stopMatchingGuard, timer]);

  const switchProtectedMode = useCallback(
    async (mode: TimerMode) => {
      if (mutationRef.current || mode === timer.run.mode) return;
      mutationRef.current = true;
      setIsMutating(true);
      try {
        const activeGuard = getActiveGuardSession();
        const wasProtected = activeGuard?.timerRunId === timer.run.id;
        if (!(await stopMatchingGuard())) return;
        if (!timer.switchMode(mode, Boolean(wasProtected))) {
          setControllerError('Mode timer tidak dapat disimpan. Coba lagi.');
        }
      } finally {
        mutationRef.current = false;
        setIsMutating(false);
      }
    },
    [stopMatchingGuard, timer]
  );

  const stopProtectedSession = useCallback(async () => {
    if (mutationRef.current) return;
    mutationRef.current = true;
    setIsMutating(true);
    try {
      if (!(await stopMatchingGuard())) return;
      timer.resetTimer(true);
    } finally {
      mutationRef.current = false;
      setIsMutating(false);
    }
  }, [stopMatchingGuard, timer]);

  const toggleGuardEnabled = useCallback(async () => {
    if (mutationRef.current || !guardStorageReady) return;
    const nextEnabled = !preferenceApi.preferences.guardEnabled;
    mutationRef.current = true;
    setIsMutating(true);
    try {
      if (!nextEnabled && !(await stopMatchingGuard())) return;
      const saved = preferenceApi.setGuardEnabled(nextEnabled);
      if (!saved) {
        setControllerError('Preferensi Focus Guard tidak dapat disimpan.');
      }
    } finally {
      mutationRef.current = false;
      setIsMutating(false);
    }
  }, [guardStorageReady, preferenceApi, stopMatchingGuard]);

  // Persisted browser state must not change the first client render relative
  // to the server render. Reveal it after all Guard subscriptions have mounted.
  const visibleGuardEnabled =
    guardStorageReady && preferenceApi.preferences.guardEnabled;

  const status: 'disabled' | 'ready' | 'active' | 'paused' =
    !visibleGuardEnabled
      ? 'disabled'
      : matchingGuardSession?.status === 'active'
        ? 'active'
        : matchingGuardSession?.status === 'paused'
          ? 'paused'
          : 'ready';

  const protectionMissing = Boolean(
    visibleGuardEnabled &&
      timer.run.mode === 'focus' &&
      timer.run.hasStarted &&
      !matchingGuardSession
  );

  const attentionEligible = Boolean(
    timer.isLoaded &&
      guardStorageReady &&
      focusSessionsApi.isLoaded &&
      isReconciliationReady &&
      !isMutating &&
      !isContractOpen &&
      visibleGuardEnabled &&
      timer.run.mode === 'focus' &&
      timer.run.status === 'active' &&
      timer.run.hasStarted &&
      matchingGuardSession?.status === 'active' &&
      matchingGuardSession.timerRunId === timer.run.id
  );

  const captureEligible = Boolean(
    timer.isLoaded &&
      guardStorageReady &&
      focusSessionsApi.isLoaded &&
      isReconciliationReady &&
      !isMutating &&
      !isContractOpen &&
      visibleGuardEnabled &&
      timer.run.mode === 'focus' &&
      timer.run.hasStarted &&
      (timer.run.status === 'active' || timer.run.status === 'paused') &&
      (matchingGuardSession?.status === 'active' ||
        matchingGuardSession?.status === 'paused') &&
      matchingGuardSession.timerRunId === timer.run.id
  );

  return {
    timer,
    activeTarget: focusTargetApi.activeTarget,
    clearTarget: focusTargetApi.clearTarget,
    completeFocusTarget: tasksApi.completeFocusTarget,
    guardEnabled: visibleGuardEnabled,
    selectedGuardProfile: profileApi.selectedProfile,
    guardStatus: status,
    protectionMissing,
    matchingGuardSession,
    controllerError,
    isMutating: isMutating || !guardStorageReady,
    toggleGuardEnabled,
    handlePrimaryAction,
    resetProtectedTimer,
    switchProtectedMode,
    stopProtectedSession,
    attention: {
      isHydrated:
        timer.isLoaded && guardStorageReady && focusSessionsApi.isLoaded,
      isReconciled: isReconciliationReady,
      isEligible: attentionEligible,
      isContractOpen,
      guardSession: matchingGuardSession,
      timerRunId: timer.run.id,
    },
    capture: {
      isEligible: captureEligible,
      guardSession: matchingGuardSession,
    },
    contract: {
      isOpen: isContractOpen,
      error: contractError,
      isSubmitting: isMutating,
      targetOptions,
      profileOptions,
      defaultTargetKey,
      defaultProfileId: profileApi.selectedProfile.id,
      durationSeconds: timer.run.durationSeconds,
      presetId: timer.run.presetIdSnapshot,
      confirm: confirmContract,
      cancel: cancelContract,
    },
  };
}
