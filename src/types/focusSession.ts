export type FocusSessionMode = 'focus' | 'shortBreak' | 'longBreak';

export interface FocusSession {
  id: string;
  completedAt: number;
  mode: FocusSessionMode;
  durationSeconds: number;
  presetId?: string;
  taskId?: string;
  stepId?: string;
  targetLabel?: string;
  soundId?: string;
  timerRunId?: string;
}

export type NewFocusSession = Omit<FocusSession, 'id' | 'completedAt'> & {
  completedAt?: number;
};
