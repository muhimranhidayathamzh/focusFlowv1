import { useCallback, useEffect, useState } from 'react';
import { FocusTarget } from '@/types/task';

const STORAGE_KEY = 'focusflow-active-focus-target';
const TARGET_UPDATED_EVENT = 'focusflow-active-focus-target-updated';

function isFocusTarget(value: unknown): value is FocusTarget {
  if (!value || typeof value !== 'object') return false;

  const target = value as Partial<FocusTarget>;
  return (
    typeof target.taskId === 'string' &&
    typeof target.label === 'string' &&
    (target.stepId === undefined || typeof target.stepId === 'string')
  );
}

function loadFocusTarget(): FocusTarget | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return isFocusTarget(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveFocusTarget(target: FocusTarget | null) {
  if (typeof window === 'undefined') return;

  if (target) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function notifyTargetUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(TARGET_UPDATED_EVENT));
}

export function useFocusTarget() {
  const [activeTarget, setActiveTarget] = useState<FocusTarget | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setActiveTarget(loadFocusTarget());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reloadTarget = () => {
      setActiveTarget(loadFocusTarget());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        reloadTarget();
      }
    };

    window.addEventListener(TARGET_UPDATED_EVENT, reloadTarget);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(TARGET_UPDATED_EVENT, reloadTarget);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setTarget = useCallback((target: FocusTarget) => {
    const normalizedTarget = {
      ...target,
      label: target.label.trim(),
    };

    if (!normalizedTarget.label) return;

    saveFocusTarget(normalizedTarget);
    setActiveTarget(normalizedTarget);
    notifyTargetUpdated();
  }, []);

  const clearTarget = useCallback(() => {
    saveFocusTarget(null);
    setActiveTarget(null);
    notifyTargetUpdated();
  }, []);

  return {
    activeTarget,
    isLoaded,
    setTarget,
    clearTarget,
  };
}
