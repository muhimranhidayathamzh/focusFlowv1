'use client';

import { DailyFocusStat } from '@/hooks/useFocusStats';
import { cn } from '@/lib/utils';

interface Props {
  days: DailyFocusStat[];
  maxDailyMinutes: number;
}

export default function WeeklyFocusChart({ days, maxDailyMinutes }: Props) {
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-label="Grafik fokus tujuh hari">
      {days.map((day) => {
        const height = Math.max(
          day.focusMinutes > 0 ? 16 : 4,
          (day.focusMinutes / maxDailyMinutes) * 42
        );

        return (
          <div key={day.dateKey} className="flex flex-col items-center gap-2">
            <div className="flex h-14 w-full items-end justify-center rounded-lg bg-zinc-950/40 px-1.5 py-1.5 sm:h-16">
              <div
                className={cn(
                  'w-full max-w-5 rounded-full transition-all duration-500',
                  day.focusMinutes > 0
                    ? day.isToday
                      ? 'bg-indigo-400 shadow-[0_0_18px_rgba(129,140,248,0.35)]'
                      : 'bg-zinc-500'
                    : 'bg-zinc-700/80'
                )}
                style={{ height: `${height}px` }}
                title={`${day.dateLabel}: ${day.focusMinutes} menit`}
              />
            </div>
            <div className="flex h-8 flex-col items-center justify-start">
              <span
                className={cn(
                  'text-[11px] font-medium',
                  day.isToday ? 'text-indigo-300' : 'text-zinc-500'
                )}
              >
                {day.label}
              </span>
              <span className="text-[10px] text-zinc-500">
                {day.focusMinutes}m
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
