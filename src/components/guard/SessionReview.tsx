'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  ListPlus,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FocusGuardSession, GuardTargetOutcome } from '@/types/focusGuard';
import { DistractionItem } from '@/types/distraction';
import {
  FocusTargetState,
  SessionAttentionSummary,
} from '@/lib/focusGuardReview';

interface Props {
  session: FocusGuardSession | null;
  completedDurationSeconds: number;
  attentionSummary: SessionAttentionSummary;
  descriptiveSummary: string[];
  distractions: DistractionItem[];
  targetState: FocusTargetState;
  pendingReviewCount: number;
  isSubmitting: boolean;
  error?: string | null;
  isConverting: (itemId: string) => boolean;
  onSubmit: (draft: {
    focusRating?: number;
    targetOutcome: GuardTargetOutcome;
  }) => Promise<boolean>;
  onSkip: () => Promise<boolean>;
  onConvertDistraction: (itemId: string) => Promise<boolean>;
  onDismissDistraction: (itemId: string) => boolean;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}j ${remainder}m` : `${hours} jam`;
}

function formatCompletion(timestamp?: number) {
  if (timestamp === undefined) return 'Waktu selesai tidak tersedia';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

const DISTRACTION_STATUS_LABELS = {
  inbox: 'Di Inbox',
  'converted-to-task': 'Sudah menjadi task',
  dismissed: 'Dihapus dari Inbox',
};

export default function SessionReview({
  session,
  completedDurationSeconds,
  attentionSummary,
  descriptiveSummary,
  distractions,
  targetState,
  pendingReviewCount,
  isSubmitting,
  error,
  isConverting,
  onSubmit,
  onSkip,
  onConvertDistraction,
  onDismissDistraction,
}: Props) {
  const [rating, setRating] = useState<number | undefined>();
  const [targetOutcome, setTargetOutcome] =
    useState<GuardTargetOutcome>('continue');
  const dialogRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(isSubmitting);
  const skipRef = useRef(onSkip);

  submittingRef.current = isSubmitting;
  skipRef.current = onSkip;

  useEffect(() => {
    if (!session) return;
    setRating(undefined);
    setTargetOutcome(targetState === 'completed' ? 'completed' : 'continue');
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submittingRef.current) {
        event.preventDefault();
        void skipRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('hidden'));
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) {
        window.setTimeout(() => previousFocus.focus(), 0);
      }
    };
  }, [session, targetState]);

  if (!session) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/75 px-4 py-6 backdrop-blur-sm">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-review-title"
        aria-describedby="session-review-description"
        className="mx-auto w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl outline-none motion-reduce:transition-none sm:p-7"
      >
        <header className="flex items-start gap-3">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-emerald-300/15 bg-emerald-400/10 text-emerald-200">
            <CheckCircle2 size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-emerald-300/70">
              Focus Guard
            </p>
            <h2 id="session-review-title" className="mt-1 text-xl font-semibold text-white">
              Sesi fokus selesai
            </h2>
            <p
              id="session-review-description"
              className="mt-1.5 text-sm leading-relaxed text-zinc-400"
            >
              Ini ringkasan singkat sesi kamu. Tidak semua perpindahan perhatian
              adalah distraksi.
            </p>
          </div>
        </header>

        <section className="mt-5 rounded-2xl border border-indigo-300/10 bg-indigo-400/[0.05] p-4">
          <div className="flex items-start gap-3">
            <Target size={16} className="mt-0.5 flex-shrink-0 text-indigo-300" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-300/65">
                Target sesi
              </p>
              <p className="mt-1 break-words text-sm font-medium text-zinc-100">
                {session.targetSnapshot?.label ?? 'Target tidak tersedia'}
              </p>
              {session.intention && (
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
                  Niat: {session.intention}
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 grid gap-2 border-t border-white/5 pt-4 sm:grid-cols-3">
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">Direncanakan</p>
              <p className="mt-1 text-sm text-zinc-200">{formatDuration(session.durationSeconds)}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">Fokus selesai</p>
              <p className="mt-1 text-sm text-zinc-200">{formatDuration(completedDurationSeconds)}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600">Selesai pada</p>
              <p className="mt-1 text-sm text-zinc-200">{formatCompletion(session.endedAt)}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck size={13} aria-hidden="true" />
            <span>
              {session.profileSnapshot.name} · proteksi {session.protectionLevel}
            </span>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-zinc-200">Ringkasan perhatian</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['Total', attentionSummary.total],
              ['Kembali', attentionSummary.returned],
              ['Disengaja', attentionSummary.intentional],
              ['Dicatat', attentionSummary.captured],
              ['Diblokir', attentionSummary.blockedSite],
              ['Bypass', attentionSummary.emergencyBypass],
              ['Belum jelas', attentionSummary.unresolved],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-black/20 px-3 py-2.5">
                <p className="text-lg font-semibold tabular-nums text-white">{value}</p>
                <p className="text-[10px] text-zinc-600">{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1.5">
            {descriptiveSummary.map((line) => (
              <p key={line} className="text-xs leading-relaxed text-zinc-500">
                {line}
              </p>
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-center gap-2">
            <Inbox size={15} className="text-zinc-500" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-zinc-200">Disimpan untuk nanti</h3>
            <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
              {distractions.length}
            </span>
          </div>
          {distractions.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-600">Tidak ada item yang dicatat pada sesi ini.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {distractions.map((item) => {
                const converting = isConverting(item.id);
                return (
                  <article key={item.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
                    <p className="break-words text-sm text-zinc-300">{item.text}</p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <span className="text-[10px] text-zinc-600">
                        {DISTRACTION_STATUS_LABELS[item.status]}
                      </span>
                      {item.status === 'inbox' && (
                        <div className="flex gap-2 sm:ml-auto">
                          <button
                            type="button"
                            disabled={isSubmitting || converting}
                            onClick={() => void onConvertDistraction(item.id)}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-300/10 px-2.5 py-1.5 text-[11px] text-indigo-200 hover:bg-indigo-400/[0.08] focus:outline-none focus:ring-2 focus:ring-indigo-300/50 disabled:opacity-50 sm:flex-none"
                          >
                            <ListPlus size={12} aria-hidden="true" />
                            {converting ? 'Membuat…' : 'Jadikan task'}
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting || converting}
                            onClick={() => onDismissDistraction(item.id)}
                            className="flex-1 rounded-lg border border-white/5 px-2.5 py-1.5 text-[11px] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 disabled:opacity-50 sm:flex-none"
                          >
                            Hapus dari Inbox
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            Kamu tetap dapat menyimpan ulasan tanpa memproses semua item.
          </p>
        </section>

        <section className="mt-4 grid gap-4 sm:grid-cols-2">
          <fieldset className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <legend className="px-1 text-sm font-semibold text-zinc-200">Bagaimana rasanya?</legend>
            <p className="mt-1 text-[11px] text-zinc-600">Rating opsional, 1 sampai 5.</p>
            <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Rating fokus sesi">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={rating === value}
                  aria-label={`Rating fokus ${value} dari 5`}
                  disabled={isSubmitting}
                  onClick={() => setRating(value)}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300/60 disabled:opacity-50',
                    rating === value
                      ? 'border-indigo-300/30 bg-indigo-400/15 text-indigo-100'
                      : 'border-white/5 text-zinc-500 hover:bg-white/[0.04]'
                  )}
                >
                  {value}
                </button>
              ))}
            </div>
            {rating !== undefined && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setRating(undefined)}
                className="mt-2 text-[11px] text-zinc-600 hover:text-zinc-400"
              >
                Hapus rating
              </button>
            )}
          </fieldset>

          <fieldset className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
            <legend className="px-1 text-sm font-semibold text-zinc-200">Bagaimana dengan target?</legend>
            <div className="mt-3 space-y-2">
              <label className={cn(
                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs',
                targetOutcome === 'completed'
                  ? 'border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100'
                  : 'border-white/5 text-zinc-500',
                (targetState === 'missing' || targetState === 'none') && 'cursor-not-allowed opacity-50'
              )}>
                <input
                  type="radio"
                  name="target-outcome"
                  value="completed"
                  checked={targetOutcome === 'completed'}
                  disabled={isSubmitting || targetState === 'missing' || targetState === 'none'}
                  onChange={() => setTargetOutcome('completed')}
                />
                {targetState === 'completed' ? 'Target sudah selesai' : 'Tandai target selesai'}
              </label>
              <label className={cn(
                'flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs',
                targetOutcome === 'continue'
                  ? 'border-indigo-300/20 bg-indigo-400/[0.08] text-indigo-100'
                  : 'border-white/5 text-zinc-500'
              )}>
                <input
                  type="radio"
                  name="target-outcome"
                  value="continue"
                  checked={targetOutcome === 'continue'}
                  disabled={isSubmitting}
                  onChange={() => setTargetOutcome('continue')}
                />
                Lanjutkan nanti
              </label>
            </div>
            {(targetState === 'missing' || targetState === 'none') && (
              <p className="mt-2 text-[11px] leading-relaxed text-amber-200/65">
                Target tidak lagi tersedia. Ulasan tetap dapat disimpan tanpa mengubah task.
              </p>
            )}
          </fieldset>
        </section>

        {error && (
          <p className="mt-4 rounded-xl border border-red-400/10 bg-red-500/[0.05] px-3 py-2 text-xs leading-relaxed text-red-300/80" role="alert">
            {error}
          </p>
        )}

        {pendingReviewCount > 1 && (
          <p className="mt-4 text-center text-[11px] text-zinc-600">
            Ada {pendingReviewCount - 1} ringkasan sesi lain setelah ini.
          </p>
        )}

        <footer className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void onSkip()}
            className="rounded-xl px-4 py-2.5 text-sm text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 disabled:opacity-50"
          >
            Lewati ulasan
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void onSubmit({ focusRating: rating, targetOutcome })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-300/70 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50"
          >
            {isSubmitting ? 'Menyimpan…' : 'Simpan ulasan'}
            {!isSubmitting && <ArrowRight size={15} aria-hidden="true" />}
          </button>
        </footer>
        <p className="mt-2 text-center text-[10px] text-zinc-700">
          Escape melewati ulasan ini. Semua data tetap tersimpan lokal.
        </p>
      </div>
    </div>
  );
}
