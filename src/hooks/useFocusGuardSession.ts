import { useCallback } from 'react';
import {
  ACTIVE_GUARD_SESSION_STORAGE_KEY,
  ACTIVE_GUARD_SESSION_UPDATED_EVENT,
  GUARD_SESSION_HISTORY_STORAGE_KEY,
  GUARD_SESSION_HISTORY_UPDATED_EVENT,
  completeGuardSession,
  getActiveGuardSession,
  loadGuardSessionHistory,
  pauseGuardSession,
  resumeGuardSession,
  skipGuardSessionReview,
  startGuardSession,
  stopGuardSession,
  submitGuardSessionReview,
} from '@/lib/focusGuardPersistence';
import {
  StartGuardSessionInput,
  SubmitGuardReviewInput,
} from '@/types/focusGuard';
import { useGuardStorageSubscription } from './useGuardStorageSubscription';

const SESSION_SOURCES = [
  {
    key: ACTIVE_GUARD_SESSION_STORAGE_KEY,
    eventName: ACTIVE_GUARD_SESSION_UPDATED_EVENT,
  },
  {
    key: GUARD_SESSION_HISTORY_STORAGE_KEY,
    eventName: GUARD_SESSION_HISTORY_UPDATED_EVENT,
  },
];

function loadSessionState() {
  return {
    activeSession: getActiveGuardSession(),
    history: loadGuardSessionHistory(),
  };
}

export function useFocusGuardSession() {
  const { value, isLoaded } = useGuardStorageSubscription(
    loadSessionState,
    SESSION_SOURCES
  );
  const startSession = useCallback(
    (input: StartGuardSessionInput) => startGuardSession(input),
    []
  );
  const pauseSession = useCallback(
    (
      sessionId: string,
      pausedAt?: number,
      pausedRemainingSeconds?: number
    ) => pauseGuardSession(sessionId, pausedAt, pausedRemainingSeconds),
    []
  );
  const resumeSession = useCallback(
    (sessionId: string, resumedAt?: number, expectedEndAt?: number) =>
      resumeGuardSession(sessionId, resumedAt, expectedEndAt),
    []
  );
  const completeSession = useCallback(
    (
      sessionId: string,
      options?: {
        endedAt?: number;
        endReason?: 'completed' | 'recovered';
        focusSessionId?: string;
      }
    ) => completeGuardSession(sessionId, options),
    []
  );
  const stopSession = useCallback(
    (sessionId: string, endedAt?: number) =>
      stopGuardSession(sessionId, endedAt),
    []
  );
  const submitReview = useCallback(
    (sessionId: string, input: SubmitGuardReviewInput) =>
      submitGuardSessionReview(sessionId, input),
    []
  );
  const skipReview = useCallback(
    (sessionId: string, reviewedAt?: number) =>
      skipGuardSessionReview(sessionId, reviewedAt),
    []
  );

  return {
    activeSession: value.activeSession,
    history: value.history,
    isLoaded,
    startSession,
    pauseSession,
    resumeSession,
    completeSession,
    stopSession,
    submitReview,
    skipReview,
  };
}
