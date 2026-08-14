import { useCallback, useMemo } from 'react';
import {
  GUARD_INTERRUPTION_STORAGE_KEY,
  GUARD_INTERRUPTION_UPDATED_EVENT,
  addFocusInterruption,
  clearFocusInterruptions,
  loadFocusInterruptions,
  updateFocusInterruptionResolution,
} from '@/lib/focusGuardPersistence';
import {
  FocusInterruption,
  InterruptionResolution,
} from '@/types/focusGuard';
import { useGuardStorageSubscription } from './useGuardStorageSubscription';

const INTERRUPTION_SOURCES = [
  {
    key: GUARD_INTERRUPTION_STORAGE_KEY,
    eventName: GUARD_INTERRUPTION_UPDATED_EVENT,
  },
];

export function useFocusInterruptions(guardSessionId?: string) {
  const { value: interruptions, isLoaded } = useGuardStorageSubscription(
    loadFocusInterruptions,
    INTERRUPTION_SOURCES
  );
  const sessionInterruptions = useMemo(
    () =>
      guardSessionId
        ? interruptions.filter(
            (item) => item.guardSessionId === guardSessionId
          )
        : interruptions,
    [guardSessionId, interruptions]
  );
  const addInterruption = useCallback(
    (input: Omit<FocusInterruption, 'id'> & { id?: string }) =>
      addFocusInterruption(input),
    []
  );
  const updateResolution = useCallback(
    (
      interruptionId: string,
      resolution: InterruptionResolution,
      returnedAt?: number
    ) =>
      updateFocusInterruptionResolution(
        interruptionId,
        resolution,
        returnedAt
      ),
    []
  );
  const clearInterruptions = useCallback(
    (sessionId?: string) => clearFocusInterruptions(sessionId),
    []
  );

  return {
    interruptions,
    sessionInterruptions,
    isLoaded,
    addInterruption,
    updateResolution,
    clearInterruptions,
  };
}
