import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusInterruptions } from '@/hooks/useFocusInterruptions';
import {
  getActiveGuardSession,
  loadFocusGuardPreferences,
} from '@/lib/focusGuardPersistence';
import { loadTimerState } from '@/lib/timerPersistence';
import {
  ATTENTION_OWNER_LEASE_MS,
  claimAttentionOwnership,
  releaseAttentionOwnership,
} from '@/lib/attentionOwnership';
import {
  FocusGuardSession,
  InterruptionResolution,
  InterruptionType,
} from '@/types/focusGuard';
import { FocusTarget } from '@/types/task';

const MINIMUM_AWAY_MS = 2_000;
const BLUR_FALLBACK_DELAY_MS = 500;
const OWNERSHIP_RETRY_MS = 2_000;
const ATTENTION_LOCK_PREFIX = 'focusflow-attention-owner';

type AttentionSignalSource =
  | 'document.visibilitychange'
  | 'window.blur';

interface AttentionExcursion {
  id: string;
  guardSessionId: string;
  timerRunId: string;
  occurredAt: number;
  type: Extract<InterruptionType, 'page-hidden' | 'window-blur'>;
  source: AttentionSignalSource;
}

export interface AttentionEligibilityContext {
  isHydrated: boolean;
  isReconciled: boolean;
  isEligible: boolean;
  isContractOpen: boolean;
  isSuppressed?: boolean;
  guardSession: FocusGuardSession | null;
  timerRunId: string;
}

export interface ReturnToFocusIntervention {
  interruptionId: string;
  guardSessionId: string;
  occurredAt: number;
  returnedAt: number;
  awayDurationMs: number;
  targetSnapshot?: FocusTarget;
  intention?: string;
  excursionCount: number;
}

interface WebLockManagerLike {
  request(
    name: string,
    options: { mode: 'exclusive'; ifAvailable: true },
    callback: (lock: unknown | null) => Promise<void>
  ): Promise<void>;
}

function createExcursionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `guard-attention-${crypto.randomUUID()}`;
  }
  return `guard-attention-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function isCanonicalEligibilityValid(
  context: AttentionEligibilityContext,
  now: number,
  guardSessionId = context.guardSession?.id
) {
  if (
    !context.isHydrated ||
    !context.isReconciled ||
    !context.isEligible ||
    context.isContractOpen ||
    context.isSuppressed ||
    !guardSessionId
  ) {
    return false;
  }

  const preferences = loadFocusGuardPreferences();
  const guard = getActiveGuardSession();
  const timer = loadTimerState()?.run;
  return Boolean(
    preferences.guardEnabled &&
      guard?.id === guardSessionId &&
      guard.status === 'active' &&
      guard.timerRunId &&
      guard.timerRunId === context.timerRunId &&
      guard.expectedEndAt > now &&
      timer?.id === context.timerRunId &&
      timer.mode === 'focus' &&
      timer.status === 'active' &&
      timer.hasStarted &&
      timer.expectedEndAt !== undefined &&
      timer.expectedEndAt > now
  );
}

export function useFocusAttentionAwareness(
  context: AttentionEligibilityContext
) {
  const interruptionApi = useFocusInterruptions(context.guardSession?.id);
  const addInterruption = interruptionApi.addInterruption;
  const updateResolution = interruptionApi.updateResolution;
  const [pendingIntervention, setPendingIntervention] =
    useState<ReturnToFocusIntervention | null>(null);
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef(context);
  const interruptionsRef = useRef(interruptionApi.interruptions);
  const pendingInterventionRef = useRef(pendingIntervention);
  const excursionRef = useRef<AttentionExcursion | null>(null);
  const blurTimerRef = useRef<number | null>(null);
  const ownerIdRef = useRef(createExcursionId());
  const ownerSessionIdRef = useRef<string | null>(null);
  const ownershipKindRef = useRef<'web-lock' | 'lease' | null>(null);
  const ownershipRequestRef = useRef(false);
  const ownershipGenerationRef = useRef(0);
  const releaseWebLockRef = useRef<(() => void) | null>(null);
  const webLocksFailedRef = useRef(false);

  contextRef.current = context;
  interruptionsRef.current = interruptionApi.interruptions;
  pendingInterventionRef.current = pendingIntervention;

  const clearBlurTimer = useCallback(() => {
    if (blurTimerRef.current !== null) {
      window.clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
  }, []);

  const setIntervention = useCallback(
    (intervention: ReturnToFocusIntervention | null) => {
      pendingInterventionRef.current = intervention;
      setPendingIntervention(intervention);
    },
    []
  );

  const releaseOwnership = useCallback(() => {
    ownershipGenerationRef.current += 1;
    ownershipRequestRef.current = false;
    const sessionId = ownerSessionIdRef.current;
    const ownershipKind = ownershipKindRef.current;
    ownerSessionIdRef.current = null;
    ownershipKindRef.current = null;

    releaseWebLockRef.current?.();
    releaseWebLockRef.current = null;

    if (sessionId && ownershipKind === 'lease') {
      releaseAttentionOwnership(ownerIdRef.current, sessionId);
    }
  }, []);

  const ensureOwnership = useCallback(() => {
    const latest = contextRef.current;
    const sessionId = latest.guardSession?.id;
    if (
      !sessionId ||
      !isCanonicalEligibilityValid(latest, Date.now(), sessionId) ||
      document.visibilityState !== 'visible'
    ) {
      return;
    }

    if (
      ownerSessionIdRef.current === sessionId &&
      ownershipKindRef.current === 'web-lock'
    ) {
      return;
    }

    if (
      ownerSessionIdRef.current === sessionId &&
      ownershipKindRef.current === 'lease'
    ) {
      if (claimAttentionOwnership(ownerIdRef.current, sessionId)) return;
      releaseOwnership();
    }

    if (ownershipRequestRef.current) return;

    const lockManager = (
      navigator as Navigator & { locks?: WebLockManagerLike }
    ).locks;
    if (lockManager && !webLocksFailedRef.current) {
      const generation = ownershipGenerationRef.current;
      ownershipRequestRef.current = true;
      void lockManager
        .request(
          `${ATTENTION_LOCK_PREFIX}:${sessionId}`,
          { mode: 'exclusive', ifAvailable: true },
          async (lock) => {
            if (
              !lock ||
              generation !== ownershipGenerationRef.current ||
              contextRef.current.guardSession?.id !== sessionId
            ) {
              return;
            }

            ownerSessionIdRef.current = sessionId;
            ownershipKindRef.current = 'web-lock';
            await new Promise<void>((resolve) => {
              releaseWebLockRef.current = resolve;
            });
          }
        )
        .catch(() => {
          webLocksFailedRef.current = true;
        })
        .finally(() => {
          if (generation === ownershipGenerationRef.current) {
            ownershipRequestRef.current = false;
            if (webLocksFailedRef.current) ensureOwnership();
          }
        });
      return;
    }

    if (claimAttentionOwnership(ownerIdRef.current, sessionId)) {
      ownerSessionIdRef.current = sessionId;
      ownershipKindRef.current = 'lease';
    }
  }, [releaseOwnership]);

  const hasOwnership = useCallback((guardSessionId: string) => {
    if (ownerSessionIdRef.current !== guardSessionId) return false;
    if (ownershipKindRef.current === 'web-lock') return true;
    if (ownershipKindRef.current === 'lease') {
      return claimAttentionOwnership(ownerIdRef.current, guardSessionId);
    }
    return false;
  }, []);

  const beginExcursion = useCallback(
    (
      type: AttentionExcursion['type'],
      source: AttentionSignalSource,
      occurredAt = Date.now()
    ) => {
      const latest = contextRef.current;
      const guard = latest.guardSession;
      if (
        !guard?.timerRunId ||
        !hasOwnership(guard.id) ||
        !isCanonicalEligibilityValid(latest, occurredAt, guard.id)
      ) {
        return;
      }

      const existing = excursionRef.current;
      if (existing) {
        if (type === 'page-hidden' && existing.type === 'window-blur') {
          excursionRef.current = {
            ...existing,
            type,
            source,
          };
        }
        return;
      }

      excursionRef.current = {
        id: createExcursionId(),
        guardSessionId: guard.id,
        timerRunId: guard.timerRunId,
        occurredAt,
        type,
        source,
      };
    },
    [hasOwnership]
  );

  const finishExcursion = useCallback(
    (returnedAt = Date.now()) => {
      const excursion = excursionRef.current;
      if (!excursion || document.visibilityState !== 'visible') return;
      excursionRef.current = null;

      const awayDurationMs = returnedAt - excursion.occurredAt;
      const latest = contextRef.current;
      const guard = latest.guardSession;
      if (
        awayDurationMs < MINIMUM_AWAY_MS ||
        guard?.id !== excursion.guardSessionId ||
        guard.timerRunId !== excursion.timerRunId ||
        !hasOwnership(excursion.guardSessionId) ||
        !isCanonicalEligibilityValid(
          latest,
          returnedAt,
          excursion.guardSessionId
        )
      ) {
        return;
      }

      const matchingBlockedAttempt = interruptionsRef.current.some(
        (item) =>
          item.guardSessionId === excursion.guardSessionId &&
          item.type === 'blocked-site' &&
          Math.abs(item.occurredAt - excursion.occurredAt) <= 5_000
      );
      if (matchingBlockedAttempt) return;

      const interruption = addInterruption({
        id: excursion.id,
        guardSessionId: excursion.guardSessionId,
        occurredAt: excursion.occurredAt,
        returnedAt,
        type: excursion.type,
        source: excursion.source,
        resolution: 'unknown',
      });
      if (!interruption) {
        setError('Perpindahan halaman tidak dapat disimpan di perangkat ini.');
        return;
      }

      const excursionCount =
        interruptionsRef.current.filter(
          (item) => item.guardSessionId === excursion.guardSessionId
        ).length + 1;
      setError(null);
      setIntervention({
        interruptionId: interruption.id,
        guardSessionId: interruption.guardSessionId,
        occurredAt: interruption.occurredAt,
        returnedAt,
        awayDurationMs,
        targetSnapshot: guard.targetSnapshot
          ? { ...guard.targetSnapshot }
          : undefined,
        intention: guard.intention,
        excursionCount,
      });
    },
    [addInterruption, hasOwnership, setIntervention]
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearBlurTimer();
        beginExcursion(
          'page-hidden',
          'document.visibilitychange',
          Date.now()
        );
        return;
      }

      finishExcursion(Date.now());
      ensureOwnership();
    };

    const handleWindowBlur = () => {
      clearBlurTimer();
      const blurredAt = Date.now();
      blurTimerRef.current = window.setTimeout(() => {
        blurTimerRef.current = null;
        if (
          document.visibilityState === 'visible' &&
          !document.hasFocus()
        ) {
          beginExcursion('window-blur', 'window.blur', blurredAt);
        }
      }, BLUR_FALLBACK_DELAY_MS);
    };

    const handleWindowFocus = () => {
      clearBlurTimer();
      finishExcursion(Date.now());
      ensureOwnership();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      clearBlurTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [beginExcursion, clearBlurTimer, ensureOwnership, finishExcursion]);

  const eligibilityKey = `${context.isHydrated}:${context.isReconciled}:${context.isEligible}:${context.isContractOpen}:${Boolean(context.isSuppressed)}:${context.guardSession?.id ?? ''}:${context.timerRunId}`;
  useEffect(() => {
    const latest = contextRef.current;
    const sessionId = latest.guardSession?.id;
    if (latest.isSuppressed) {
      clearBlurTimer();
      excursionRef.current = null;
      releaseOwnership();
      return;
    }
    if (
      !sessionId ||
      !isCanonicalEligibilityValid(latest, Date.now(), sessionId)
    ) {
      clearBlurTimer();
      excursionRef.current = null;
      setIntervention(null);
      releaseOwnership();
      return;
    }

    ensureOwnership();
    const retryId = window.setInterval(() => {
      if (
        ownershipKindRef.current === 'lease' &&
        ownerSessionIdRef.current === sessionId
      ) {
        if (!claimAttentionOwnership(ownerIdRef.current, sessionId)) {
          releaseOwnership();
        }
      } else {
        ensureOwnership();
      }
    }, Math.min(OWNERSHIP_RETRY_MS, ATTENTION_OWNER_LEASE_MS / 3));

    return () => {
      window.clearInterval(retryId);
      clearBlurTimer();
      excursionRef.current = null;
      releaseOwnership();
    };
  }, [
    clearBlurTimer,
    eligibilityKey,
    ensureOwnership,
    releaseOwnership,
    setIntervention,
  ]);

  useEffect(() => {
    return () => releaseOwnership();
  }, [releaseOwnership]);

  useEffect(() => {
    const pending = pendingInterventionRef.current;
    if (
      pending &&
      !interruptionApi.interruptions.some(
        (item) => item.id === pending.interruptionId
      )
    ) {
      setIntervention(null);
    }
  }, [interruptionApi.interruptions, setIntervention]);

  const resolveIntervention = useCallback(
    (resolution: Extract<InterruptionResolution, 'returned' | 'intentional'>) => {
      const intervention = pendingInterventionRef.current;
      if (!intervention) return true;
      const updated = updateResolution(
        intervention.interruptionId,
        resolution,
        intervention.returnedAt
      );
      if (!updated) {
        setError('Resolusi belum dapat disimpan. Coba sekali lagi.');
        return false;
      }
      setError(null);
      setIntervention(null);
      return true;
    },
    [setIntervention, updateResolution]
  );

  const dismissUnknown = useCallback(() => {
    setIntervention(null);
  }, [setIntervention]);

  return {
    pendingIntervention,
    error,
    resolveReturned: () => resolveIntervention('returned'),
    resolveIntentional: () => resolveIntervention('intentional'),
    dismissUnknown,
  };
}
