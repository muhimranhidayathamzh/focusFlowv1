'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDistractionInbox } from '@/hooks/useDistractionInbox';
import { useDistractionTaskConversion } from '@/hooks/useDistractionTaskConversion';
import { useFocusGuardSession } from '@/hooks/useFocusGuardSession';
import { useFocusInterruptions } from '@/hooks/useFocusInterruptions';
import { useFocusSessions } from '@/hooks/useFocusSessions';
import { useFocusTarget } from '@/hooks/useFocusTarget';
import { useTasks } from '@/hooks/useTasks';
import {
  calculateSessionAttentionSummary,
  createDescriptiveReviewSummary,
  getFocusTargetState,
} from '@/lib/focusGuardReview';
import { GuardTargetOutcome } from '@/types/focusGuard';

interface Options {
  isReconciled: boolean;
  isBlocked: boolean;
}

interface SubmitReviewDraft {
  focusRating?: number;
  targetOutcome: GuardTargetOutcome;
}

function reviewFailureMessage(reason: string) {
  switch (reason) {
    case 'invalid-input':
      return 'Pilihan ulasan belum valid. Periksa rating dan hasil target.';
    case 'review-not-pending':
      return 'Ulasan ini sudah diselesaikan atau dilewati di tab lain.';
    case 'storage-failed':
      return 'Ulasan belum dapat disimpan di perangkat ini. Coba lagi.';
    default:
      return 'Sesi ulasan tidak lagi tersedia.';
  }
}

export function useFocusSessionReview({ isReconciled, isBlocked }: Options) {
  const guardApi = useFocusGuardSession();
  const interruptionApi = useFocusInterruptions();
  const distractionApi = useDistractionInbox();
  const focusSessionsApi = useFocusSessions();
  const tasksApi = useTasks();
  const focusTargetApi = useFocusTarget();
  const conversionApi = useDistractionTaskConversion();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingSessions = useMemo(
    () =>
      guardApi.history
        .filter(
          (session) =>
            session.status === 'completed' &&
            session.reviewStatus === 'pending' &&
            Boolean(session.timerRunId) &&
            Boolean(session.focusSessionId) &&
            (session.endReason === 'completed' ||
              session.endReason === 'recovered')
        )
        .sort(
          (a, b) =>
            (b.endedAt ?? b.expectedEndAt) -
            (a.endedAt ?? a.expectedEndAt)
        ),
    [guardApi.history]
  );

  const isLoaded =
    guardApi.isLoaded &&
    interruptionApi.isLoaded &&
    distractionApi.isLoaded &&
    focusSessionsApi.isLoaded &&
    tasksApi.isLoaded &&
    focusTargetApi.isLoaded;
  const session =
    isLoaded && isReconciled && !isBlocked ? pendingSessions[0] ?? null : null;

  useEffect(() => {
    setError(null);
  }, [session?.id]);

  const interruptions = useMemo(
    () =>
      session
        ? interruptionApi.interruptions.filter(
            (item) => item.guardSessionId === session.id
          )
        : [],
    [interruptionApi.interruptions, session]
  );
  const distractions = useMemo(
    () =>
      session
        ? distractionApi.items
            .filter((item) => item.guardSessionId === session.id)
            .sort((a, b) => b.capturedAt - a.capturedAt)
        : [],
    [distractionApi.items, session]
  );
  const attentionSummary = useMemo(
    () => calculateSessionAttentionSummary(interruptions),
    [interruptions]
  );
  const descriptiveSummary = useMemo(
    () => createDescriptiveReviewSummary(attentionSummary, distractions.length),
    [attentionSummary, distractions.length]
  );
  const targetState = useMemo(
    () => getFocusTargetState(tasksApi.tasks, session?.targetSnapshot),
    [session?.targetSnapshot, tasksApi.tasks]
  );
  const linkedFocusSession = useMemo(
    () =>
      session
        ? focusSessionsApi.sessions.find(
            (item) =>
              item.id === session.focusSessionId ||
              (session.timerRunId && item.timerRunId === session.timerRunId)
          )
        : undefined,
    [focusSessionsApi.sessions, session]
  );

  const submitReview = useCallback(
    async (draft: SubmitReviewDraft) => {
      if (!session || isSubmitting) return false;
      setError(null);
      setIsSubmitting(true);
      try {
        if (draft.targetOutcome === 'completed') {
          if (targetState === 'missing' || targetState === 'none') {
            setError(
              'Target sesi tidak lagi tersedia. Pilih “Lanjutkan nanti” untuk menyimpan ulasan tanpa mengubah task.'
            );
            return false;
          }
          if (
            targetState === 'available' &&
            session.targetSnapshot &&
            !tasksApi.completeFocusTarget(session.targetSnapshot)
          ) {
            setError(
              'Target belum dapat ditandai selesai. Ulasan belum disimpan; coba lagi.'
            );
            return false;
          }
        }

        const result = await guardApi.submitReview(session.id, {
          focusRating: draft.focusRating,
          targetOutcome: draft.targetOutcome,
          reviewedAt: Date.now(),
        });
        if (!result.ok) {
          setError(reviewFailureMessage(result.reason));
          return false;
        }

        const activeTarget = focusTargetApi.activeTarget;
        if (
          draft.targetOutcome === 'completed' &&
          session.targetSnapshot &&
          activeTarget?.taskId === session.targetSnapshot.taskId &&
          activeTarget.stepId === session.targetSnapshot.stepId
        ) {
          focusTargetApi.clearTarget();
        }
        return true;
      } catch {
        setError(
          'Ulasan belum dapat disimpan. Data sesi tetap aman; coba lagi.'
        );
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      focusTargetApi,
      guardApi,
      isSubmitting,
      session,
      targetState,
      tasksApi,
    ]
  );

  const skipReview = useCallback(async () => {
    if (!session || isSubmitting) return false;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await guardApi.skipReview(session.id, Date.now());
      if (!result.ok) {
        setError(reviewFailureMessage(result.reason));
        return false;
      }
      return true;
    } catch {
      setError('Ulasan belum dapat dilewati. Data sesi tetap aman; coba lagi.');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [guardApi, isSubmitting, session]);

  const convertDistraction = useCallback(
    async (itemId: string) => {
      setError(null);
      const result = await conversionApi.convertToTask(itemId);
      if (result.ok) return true;
      setError(
        result.partialTaskId
          ? 'Task sudah dibuat, tetapi status item belum diperbarui. Coba lagi; task tidak akan diduplikasi.'
          : 'Item belum dapat dijadikan task. Coba lagi.'
      );
      return false;
    },
    [conversionApi]
  );

  const dismissDistraction = useCallback(
    (itemId: string) => {
      setError(null);
      const result = distractionApi.dismissItem(itemId, Date.now());
      if (result) return true;
      setError('Item belum dapat dihapus dari Inbox. Coba lagi.');
      return false;
    },
    [distractionApi]
  );

  return {
    isLoaded,
    isOpen: Boolean(session),
    hasPendingReview: pendingSessions.length > 0,
    pendingReviewCount: pendingSessions.length,
    session,
    completedDurationSeconds:
      linkedFocusSession?.durationSeconds ?? session?.durationSeconds ?? 0,
    attentionSummary,
    descriptiveSummary,
    distractions,
    targetState,
    isSubmitting,
    error,
    isConverting: conversionApi.isConverting,
    submitReview,
    skipReview,
    convertDistraction,
    dismissDistraction,
  };
}
