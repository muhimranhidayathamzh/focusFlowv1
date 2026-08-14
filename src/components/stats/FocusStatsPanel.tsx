'use client';

import { useEffect, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Clock3,
  Flame,
  Trophy,
  Target,
  TimerReset,
} from 'lucide-react';
import { useFocusStats } from '@/hooks/useFocusStats';
import WeeklyFocusChart from './WeeklyFocusChart';

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) return `${hours}j`;
  return `${hours}j ${remainingMinutes}m`;
}

function getWeeklySummary({
  activeDaysThisWeek,
  weeklyTotalMinutes,
  weeklyTotalSessions,
  bestDayLabel,
}: {
  activeDaysThisWeek: number;
  weeklyTotalMinutes: number;
  weeklyTotalSessions: number;
  bestDayLabel?: string;
}) {
  if (weeklyTotalSessions === 0) {
    return 'Mulai dengan satu sesi pendek. Progress minggu ini akan muncul di sini.';
  }

  if (activeDaysThisWeek === 1) {
    return `Kamu sudah mulai minggu ini: ${formatMinutes(
      weeklyTotalMinutes
    )} fokus dari ${weeklyTotalSessions} sesi.`;
  }

  return `Kamu fokus ${activeDaysThisWeek} hari minggu ini. Hari terbaik: ${
    bestDayLabel ?? 'hari ini'
  }.`;
}

export default function FocusStatsPanel() {
  const {
    isLoaded,
    todayFocusMinutes,
    todaySessionCount,
    goal,
    setMinuteGoal,
    goalProgressPercent,
    goalRemaining,
    isGoalMetToday,
    currentStreak,
    weeklyTotalMinutes,
    weeklyTotalSessions,
    activeDaysThisWeek,
    averageMinutesPerActiveDay,
    bestDayThisWeek,
    personalBestDay,
    maxDailyMinutes,
    week,
  } = useFocusStats();
  const [goalInput, setGoalInput] = useState(String(goal.target));

  useEffect(() => {
    setGoalInput(String(goal.target));
  }, [goal.target]);

  const commitGoalInput = () => {
    const nextTarget = Number(goalInput);
    setMinuteGoal(nextTarget);
  };

  if (!isLoaded) {
    return (
      <section className="mx-auto w-full animate-pulse rounded-3xl border border-white/[0.07] bg-zinc-900/40 p-5 sm:p-6">
        <div className="h-6 w-36 bg-zinc-800 rounded-lg mb-6" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 bg-zinc-800/50 rounded-2xl" />
          <div className="h-20 bg-zinc-800/50 rounded-2xl" />
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full rounded-3xl border border-white/[0.07] bg-zinc-900/40 p-5 shadow-xl backdrop-blur-xl sm:p-6" aria-labelledby="today-progress-heading">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-400/10">
            <BarChart3 size={16} className="text-indigo-300" />
          </div>
          <h2 id="today-progress-heading" className="text-lg font-semibold text-white">Progress hari ini</h2>
        </div>
        <span className="text-xs font-medium text-zinc-500">7 hari</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white/[0.025] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-zinc-400">
            <Clock3 size={14} />
            <span className="text-xs font-medium">Hari ini</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-white">
            {formatMinutes(todayFocusMinutes)}
          </p>
          <p className="mt-1 text-xs text-zinc-600">total fokus</p>
        </div>

        <div className="rounded-2xl bg-white/[0.025] p-3.5">
          <div className="mb-2 flex items-center gap-2 text-zinc-400">
            <TimerReset size={14} />
            <span className="text-xs font-medium">Sesi</span>
          </div>
          <p className="text-2xl font-bold tabular-nums text-white">
            {todaySessionCount}
          </p>
          <p className="mt-1 text-xs text-zinc-600">selesai hari ini</p>
        </div>
      </div>

      <div className="mb-4 rounded-2xl border border-white/5 bg-zinc-950/25 p-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Target size={14} />
            <span className="text-sm font-medium">Target harian</span>
          </div>

          <label className="flex items-center gap-1 text-xs text-zinc-500">
            <input
              type="number"
              min="5"
              max="600"
              step="5"
              value={goalInput}
              onChange={(event) => setGoalInput(event.target.value)}
              onBlur={commitGoalInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.currentTarget.blur();
                }

                if (event.key === 'Escape') {
                  setGoalInput(String(goal.target));
                  event.currentTarget.blur();
                }
              }}
              className="w-16 rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-right text-xs font-semibold text-white outline-none focus:ring-1 focus:ring-indigo-400/40"
              aria-label="Target fokus harian dalam menit"
            />
            <span>m</span>
          </label>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-500"
            style={{ width: `${goalProgressPercent}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {isGoalMetToday
              ? 'Target hari ini tercapai.'
              : `${goalRemaining}m lagi menuju target hari ini.`}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400">
            <Flame
              size={13}
              className={currentStreak > 0 ? 'text-orange-300' : 'text-zinc-600'}
            />
            <span>
              {currentStreak > 0
                ? `${currentStreak} hari streak`
                : 'Mulai streak'}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/5 bg-zinc-950/25 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <CalendarDays size={14} />
            <span className="text-sm font-medium">Minggu ini</span>
          </div>
          <span className="text-xs text-zinc-500">
            {formatMinutes(weeklyTotalMinutes)} / {weeklyTotalSessions} sesi
          </span>
        </div>

        <WeeklyFocusChart days={week} maxDailyMinutes={maxDailyMinutes} />

        <div className="mt-3 border-t border-white/5 pt-3">
          <p className="text-xs leading-relaxed text-zinc-500">
            {getWeeklySummary({
              activeDaysThisWeek,
              weeklyTotalMinutes,
              weeklyTotalSessions,
              bestDayLabel:
                bestDayThisWeek && bestDayThisWeek.focusMinutes > 0
                  ? bestDayThisWeek.dateLabel
                  : undefined,
            })}
          </p>
          {weeklyTotalSessions > 0 && (
            <p className="mt-2 text-[11px] text-zinc-600">
              Rata-rata hari aktif: {formatMinutes(averageMinutesPerActiveDay)}
            </p>
          )}
        </div>

      </div>

      {personalBestDay && (
      <div className="mt-4 rounded-2xl border border-white/5 bg-zinc-950/25 p-4">
        <div className="mb-3 flex items-center gap-2 text-zinc-400">
          <Trophy size={14} />
          <span className="text-sm font-medium">Personal best</span>
        </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <p className="text-2xl font-bold tabular-nums text-white">
                {formatMinutes(personalBestDay.focusMinutes)}
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                {personalBestDay.sessionCount} sesi pada{' '}
                {personalBestDay.dateLabel}
              </p>
            </div>
            {personalBestDay.isToday && (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300">
                Hari ini
              </span>
            )}
          </div>
      </div>
      )}
    </section>
  );
}
