import { useCallback, useMemo } from 'react';
import {
  DISTRACTION_INBOX_STORAGE_KEY,
  DISTRACTION_INBOX_UPDATED_EVENT,
  addDistractionItem,
  clearDistractionItems,
  dismissDistractionItem,
  loadDistractionItems,
  markDistractionConvertedToTask,
} from '@/lib/focusGuardPersistence';
import { AddDistractionInput } from '@/types/distraction';
import { useGuardStorageSubscription } from './useGuardStorageSubscription';

const DISTRACTION_SOURCES = [
  {
    key: DISTRACTION_INBOX_STORAGE_KEY,
    eventName: DISTRACTION_INBOX_UPDATED_EVENT,
  },
];

export function useDistractionInbox(guardSessionId?: string) {
  const { value: items, isLoaded } = useGuardStorageSubscription(
    loadDistractionItems,
    DISTRACTION_SOURCES
  );
  const inboxItems = useMemo(
    () => items.filter((item) => item.status === 'inbox'),
    [items]
  );
  const sessionItems = useMemo(
    () =>
      guardSessionId
        ? items.filter((item) => item.guardSessionId === guardSessionId)
        : items,
    [guardSessionId, items]
  );
  const addItem = useCallback(
    (input: AddDistractionInput) => addDistractionItem(input),
    []
  );
  const markConvertedToTask = useCallback(
    (itemId: string, taskId: string, resolvedAt?: number) =>
      markDistractionConvertedToTask(itemId, taskId, resolvedAt),
    []
  );
  const dismissItem = useCallback(
    (itemId: string, resolvedAt?: number) =>
      dismissDistractionItem(itemId, resolvedAt),
    []
  );
  const clearItems = useCallback(
    (sessionId?: string) => clearDistractionItems(sessionId),
    []
  );

  return {
    items,
    inboxItems,
    sessionItems,
    isLoaded,
    addItem,
    markConvertedToTask,
    dismissItem,
    clearItems,
  };
}
