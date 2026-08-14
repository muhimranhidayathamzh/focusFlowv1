export type DailyFocusGoalType = 'minutes' | 'sessions';

export interface DailyFocusGoal {
  type: DailyFocusGoalType;
  target: number;
}

export const DEFAULT_DAILY_FOCUS_GOAL: DailyFocusGoal = {
  type: 'minutes',
  target: 60,
};
