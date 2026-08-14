'use client';

import { useMemo } from 'react';
import { useDistractionInbox } from '@/hooks/useDistractionInbox';
import { useFocusGuardSession } from '@/hooks/useFocusGuardSession';
import { useFocusInterruptions } from '@/hooks/useFocusInterruptions';
import { calculateFocusGuardInsights } from '@/lib/focusGuardReview';

export function useFocusGuardInsights() {
  const guardApi = useFocusGuardSession();
  const interruptionApi = useFocusInterruptions();
  const distractionApi = useDistractionInbox();

  const insights = useMemo(
    () =>
      calculateFocusGuardInsights(
        guardApi.history,
        interruptionApi.interruptions,
        distractionApi.items
      ),
    [distractionApi.items, guardApi.history, interruptionApi.interruptions]
  );

  return {
    isLoaded:
      guardApi.isLoaded &&
      interruptionApi.isLoaded &&
      distractionApi.isLoaded,
    ...insights,
  };
}
