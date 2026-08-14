'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDistractionInbox } from '@/hooks/useDistractionInbox';
import { useFocusInterruptions } from '@/hooks/useFocusInterruptions';
import { ReturnToFocusIntervention } from '@/hooks/useFocusAttentionAwareness';
import { createFocusGuardId } from '@/lib/focusGuardPersistence';
import { FocusGuardSession } from '@/types/focusGuard';
import { FocusTarget } from '@/types/task';

export const DISTRACTION_CAPTURE_MAX_LENGTH = 300;

interface CaptureRequest {
  id: string;
  capturedAt: number;
  guardSessionId: string;
  targetSnapshot?: FocusTarget;
  source: 'quick' | 'return-prompt';
  interruptionId?: string;
  interruptionReturnedAt?: number;
  itemSaved: boolean;
}

interface Options {
  isEligible: boolean;
  guardSession: FocusGuardSession | null;
  pendingIntervention: ReturnToFocusIntervention | null;
  onOpenChange: (isOpen: boolean) => void;
  onReturnCaptureComplete: () => void;
}

export function useDistractionCaptureFlow({
  isEligible,
  guardSession,
  pendingIntervention,
  onOpenChange,
  onReturnCaptureComplete,
}: Options) {
  const { addItem } = useDistractionInbox(guardSession?.id);
  const { updateResolution } = useFocusInterruptions(guardSession?.id);
  const [request, setRequest] = useState<CaptureRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestRef = useRef<CaptureRequest | null>(null);

  requestRef.current = request;

  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => setConfirmation(null), 3_500);
    return () => window.clearTimeout(timer);
  }, [confirmation]);

  const beginRequest = useCallback(
    (next: CaptureRequest) => {
      if (requestRef.current) return false;
      requestRef.current = next;
      setRequest(next);
      setError(null);
      setConfirmation(null);
      onOpenChange(true);
      return true;
    },
    [onOpenChange]
  );

  const openQuickCapture = useCallback(() => {
    if (!isEligible || !guardSession || requestRef.current) return false;
    return beginRequest({
      id: createFocusGuardId('distraction'),
      capturedAt: Date.now(),
      guardSessionId: guardSession.id,
      targetSnapshot: guardSession.targetSnapshot
        ? { ...guardSession.targetSnapshot }
        : undefined,
      source: 'quick',
      itemSaved: false,
    });
  }, [beginRequest, guardSession, isEligible]);

  const openFromReturnPrompt = useCallback(() => {
    if (
      !isEligible ||
      !guardSession ||
      !pendingIntervention ||
      pendingIntervention.guardSessionId !== guardSession.id ||
      requestRef.current
    ) {
      return false;
    }

    return beginRequest({
      id: createFocusGuardId('distraction'),
      capturedAt: Date.now(),
      guardSessionId: pendingIntervention.guardSessionId,
      targetSnapshot: pendingIntervention.targetSnapshot
        ? { ...pendingIntervention.targetSnapshot }
        : guardSession.targetSnapshot
          ? { ...guardSession.targetSnapshot }
          : undefined,
      source: 'return-prompt',
      interruptionId: pendingIntervention.interruptionId,
      interruptionReturnedAt: pendingIntervention.returnedAt,
      itemSaved: false,
    });
  }, [beginRequest, guardSession, isEligible, pendingIntervention]);

  const closeRequest = useCallback(() => {
    requestRef.current = null;
    setRequest(null);
    setError(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const cancelCapture = useCallback(() => {
    if (isSubmitting) return;
    closeRequest();
  }, [closeRequest, isSubmitting]);

  const submitCapture = useCallback(
    async (text: string) => {
      const current = requestRef.current;
      const normalizedText = text.trim();
      if (!current || isSubmitting) return false;
      if (!normalizedText) {
        setError('Tulis satu hal yang ingin disimpan untuk nanti.');
        return false;
      }
      if (normalizedText.length > DISTRACTION_CAPTURE_MAX_LENGTH) {
        setError(
          `Batasi catatan hingga ${DISTRACTION_CAPTURE_MAX_LENGTH} karakter.`
        );
        return false;
      }

      setIsSubmitting(true);
      setError(null);
      try {
        const item = addItem({
          id: current.id,
          text: normalizedText,
          capturedAt: current.capturedAt,
          guardSessionId: current.guardSessionId,
        });
        if (!item) {
          setError('Catatan belum dapat disimpan di perangkat ini.');
          return false;
        }

        if (!current.itemSaved) {
          const savedRequest = { ...current, itemSaved: true };
          requestRef.current = savedRequest;
          setRequest(savedRequest);
        }

        if (
          current.source === 'return-prompt' &&
          current.interruptionId &&
          current.interruptionReturnedAt !== undefined
        ) {
          const interruption = updateResolution(
            current.interruptionId,
            'captured',
            current.interruptionReturnedAt
          );
          if (!interruption) {
            setError(
              'Catatan sudah tersimpan, tetapi status perpindahan belum diperbarui. Coba simpan sekali lagi; catatan tidak akan diduplikasi.'
            );
            return false;
          }
          onReturnCaptureComplete();
        }

        setConfirmation('Tersimpan. Tidak perlu dikerjakan sekarang.');
        closeRequest();
        return true;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      addItem,
      closeRequest,
      isSubmitting,
      onReturnCaptureComplete,
      updateResolution,
    ]
  );

  return {
    isOpen: Boolean(request),
    isSubmitting,
    error,
    confirmation,
    source: request?.source ?? null,
    targetSnapshot: request?.targetSnapshot,
    openQuickCapture,
    openFromReturnPrompt,
    submitCapture,
    cancelCapture,
  };
}
