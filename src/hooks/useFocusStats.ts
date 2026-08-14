import { useMemo } from 'react';
import { DailyFocusGoal } from '@/types/focusGoal';
import { FocusSession } from '@/types/focusSession';
import { useDailyFocusGoal } from '@/hooks/useDailyFocusGoal';
import { useFocusSessions } from '@/hooks/useFocusSessions';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

export interface DailyFocusStat {
  dateKey: string;
  label: string;
  dateLabel: string;
  focusMinutes: number;
  sessionCount: number;
  isToday: boolean;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function createDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDateLabel(date: Date) {
  return `${WEEKDAY_LABELS[date.getDay()]}, ${date.getDate()} ${
    MONTH_LABELS[date.getMonth()]
  }`;
}

function getFocusSessionsForDay(sessions: FocusSession[], date: Date) {
  const start = startOfLocalDay(date).getTime();
  const end = start + DAY_MS;

  return sessions.filter(
    (session) =>
      session.mode === 'focus' &&
      session.completedAt >= start &&
      session.completedAt < end
  );
}

function sumFocusMinutes(sessions: FocusSession[]) {
  const totalSeconds = sessions.reduce(
    (total, session) => total + session.durationSeconds,
    0
  );

  return Math.round(totalSeconds / 60);
}

function getGoalValueForDay(
  sessions: FocusSession[],
  date: Date,
  goal: DailyFocusGoal
) {
  const daySessions = getFocusSessionsForDay(sessions, date);

  if (goal.type === 'sessions') {
    return daySessions.length;
  }

  return sumFocusMinutes(daySessions);
}

function calculateCurrentStreak(
  sessions: FocusSession[],
  today: Date,
  goal: DailyFocusGoal
) {
  let streak = 0;

  for (let offset = 0; offset < 365; offset++) {
    const date = new Date(today.getTime() - offset * DAY_MS);
    const goalValue = getGoalValueForDay(sessions, date, goal);

    if (goalValue >= goal.target) {
      streak += 1;
      continue;
    }

    if (offset === 0) {
      continue;
    }

    break;
  }

  return streak;
}

function getPersonalBestDay(sessions: FocusSession[]): DailyFocusStat | null {
  const focusSessions = sessions.filter((session) => session.mode === 'focus');
  const byDate = new Map<
    string,
    {
      date: Date;
      focusSeconds: number;
      sessionCount: number;
    }
  >();

  focusSessions.forEach((session) => {
    const date = startOfLocalDay(new Date(session.completedAt));
    const dateKey = createDateKey(date);
    const current = byDate.get(dateKey) ?? {
      date,
      focusSeconds: 0,
      sessionCount: 0,
    };

    byDate.set(dateKey, {
      date,
      focusSeconds: current.focusSeconds + session.durationSeconds,
      sessionCount: current.sessionCount + 1,
    });
  });

  const best = Array.from(byDate.entries()).sort(
    ([, a], [, b]) =>
      b.focusSeconds - a.focusSeconds ||
      b.sessionCount - a.sessionCount ||
      b.date.getTime() - a.date.getTime()
  )[0];

  if (!best) return null;

  const [dateKey, value] = best;
  const todayKey = createDateKey(startOfLocalDay(new Date()));

  return {
    dateKey,
    label: WEEKDAY_LABELS[value.date.getDay()],
    dateLabel: createDateLabel(value.date),
    focusMinutes: Math.round(value.focusSeconds / 60),
    sessionCount: value.sessionCount,
    isToday: dateKey === todayKey,
  };
}

export function useFocusStats() {
  const { sessions, isLoaded: areSessionsLoaded } = useFocusSessions();
  const { goal, isLoaded: isGoalLoaded, setMinuteGoal } = useDailyFocusGoal();

  return useMemo(() => {
    const today = startOfLocalDay(new Date());
    const todayKey = createDateKey(today);
    const todayFocusSessions = getFocusSessionsForDay(sessions, today);
    const todayFocusMinutes = sumFocusMinutes(todayFocusSessions);
    const todayGoalValue =
      goal.type === 'sessions' ? todayFocusSessions.length : todayFocusMinutes;
    const goalProgressPercent = Math.min(
      100,
      Math.round((todayGoalValue / goal.target) * 100)
    );
    const week = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today.getTime() - (6 - index) * DAY_MS);
      const daySessions = getFocusSessionsForDay(sessions, date);

      return {
        dateKey: createDateKey(date),
        label: WEEKDAY_LABELS[date.getDay()],
        dateLabel: createDateLabel(date),
        focusMinutes: sumFocusMinutes(daySessions),
        sessionCount: daySessions.length,
        isToday: createDateKey(date) === todayKey,
      };
    });

    const weeklyTotalMinutes = week.reduce(
      (total, day) => total + day.focusMinutes,
      0
    );
    const weeklyTotalSessions = week.reduce(
      (total, day) => total + day.sessionCount,
      0
    );
    const maxDailyMinutes = Math.max(
      1,
      ...week.map((day) => day.focusMinutes)
    );
    const activeDaysThisWeek = week.filter(
      (day) => day.focusMinutes > 0
    ).length;
    const bestDayThisWeek = week.reduce<DailyFocusStat | null>(
      (best, day) => {
        if (!best) return day;
        if (day.focusMinutes > best.focusMinutes) return day;
        if (
          day.focusMinutes === best.focusMinutes &&
          day.sessionCount > best.sessionCount
        ) {
          return day;
        }
        return best;
      },
      null
    );

    return {
      isLoaded: areSessionsLoaded && isGoalLoaded,
      goal,
      setMinuteGoal,
      todayFocusMinutes,
      todaySessionCount: todayFocusSessions.length,
      todayGoalValue,
      goalProgressPercent,
      goalRemaining: Math.max(0, goal.target - todayGoalValue),
      isGoalMetToday: todayGoalValue >= goal.target,
      currentStreak: calculateCurrentStreak(sessions, today, goal),
      weeklyTotalMinutes,
      weeklyTotalSessions,
      activeDaysThisWeek,
      averageMinutesPerActiveDay:
        activeDaysThisWeek > 0
          ? Math.round(weeklyTotalMinutes / activeDaysThisWeek)
          : 0,
      bestDayThisWeek,
      personalBestDay: getPersonalBestDay(sessions),
      maxDailyMinutes,
      week,
    };
  }, [sessions, areSessionsLoaded, goal, isGoalLoaded, setMinuteGoal]);
}
