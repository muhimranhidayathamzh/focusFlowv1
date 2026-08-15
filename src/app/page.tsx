import Navbar from '@/components/layout/Navbar';
import PomodoroTimer from '@/components/timer/PomodoroTimer';
import FocusStatsPanel from '@/components/stats/FocusStatsPanel';
import TaskList from '@/components/task/TaskList';
import AmbientSoundPanel from '@/components/ambient/AmbientSoundPanel';
import KeyboardShortcutHint from '@/components/layout/KeyboardShortcutHint';
import DistractionInboxPanel from '@/components/guard/DistractionInboxPanel';
import FocusGuardInsightsPanel from '@/components/stats/FocusGuardInsightsPanel';
import { AmbientSoundProvider } from '@/components/ambient/AmbientSoundProvider';

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-x-clip bg-zinc-950">
      <div
        className="pointer-events-none absolute left-[12%] top-24 -z-0 h-72 w-72 rounded-full bg-indigo-500/[0.055] blur-[110px]"
        aria-hidden="true"
      />

      <Navbar />

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-16 lg:pt-2">
        <header className="mb-5 sm:mb-7 lg:mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300/80">
            Ruang kerja hari ini
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Fokus pada satu hal yang berarti.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Pilih target, mulai timer, dan jaga daftar hari ini tetap sederhana.
          </p>
        </header>

        <AmbientSoundProvider>
          <section
            aria-label="Workspace fokus"
            className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-7 xl:gap-8"
          >
            <div className="timer-sticky-shell min-w-0">
              <PomodoroTimer />
            </div>

            <div className="min-w-0 space-y-5">
              <TaskList />
              <FocusStatsPanel />
              <DistractionInboxPanel />
              <AmbientSoundPanel />
              <FocusGuardInsightsPanel />
            </div>
          </section>
        </AmbientSoundProvider>
      </div>

      <KeyboardShortcutHint />
    </main>
  );
}
