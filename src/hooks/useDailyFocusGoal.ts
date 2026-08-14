import { useCallback, useEffect, useState } from 'react';
import {
  DailyFocusGoal,
  DEFAULT_DAILY_FOCUS_GOAL,
} from '@/types/focusGoal';

const STORAGE_KEY = 'focusflow-daily-focus-goal';

function clampGoalTarget(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_DAILY_FOCUS_GOAL.target;
  return Math.max(5, Math.min(600, Math.round(value)));
}

function isDailyFocusGoal(value: unknown): value is DailyFocusGoal {
  if (!value || typeof value !== 'object') return false;

  const goal = value as Partial<DailyFocusGoal>;
  return (
    (goal.type === 'minutes' || goal.type === 'sessions') &&
    typeof goal.target === 'number' &&
    Number.isFinite(goal.target)
  );
}

function loadGoal(): DailyFocusGoal {
  if (typeof window === 'undefined') return DEFAULT_DAILY_FOCUS_GOAL;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!isDailyFocusGoal(parsed)) return DEFAULT_DAILY_FOCUS_GOAL;

    return {
      type: parsed.type,
      target: clampGoalTarget(parsed.target),
    };
  } catch {
    return DEFAULT_DAILY_FOCUS_GOAL;
  }
}

function saveGoal(goal: DailyFocusGoal) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goal));
}

export function useDailyFocusGoal() {
  const [goal, setGoalState] = useState<DailyFocusGoal>(
    DEFAULT_DAILY_FOCUS_GOAL
  );
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setGoalState(loadGoal());
    setIsLoaded(true);
  }, []);

  const setGoal = useCallback((nextGoal: DailyFocusGoal) => {
    const normalizedGoal: DailyFocusGoal = {
      type: nextGoal.type,
      target: clampGoalTarget(nextGoal.target),
    };

    setGoalState(normalizedGoal);
    saveGoal(normalizedGoal);
  }, []);

  const setMinuteGoal = useCallback(
    (target: number) => {
      setGoal({
        type: 'minutes',
        target,
      });
    },
    [setGoal]
  );

  return {
    goal,
    isLoaded,
    setGoal,
    setMinuteGoal,
  };
}
