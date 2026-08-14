'use client';

import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, Clock3, Inbox, ShieldQuestion, Square } from 'lucide-react';
import { ReturnToFocusIntervention } from '@/hooks/useFocusAttentionAwareness';

interface Props {
  intervention: ReturnToFocusIntervention | null;
  error?: string | null;
  onReturn: () => boolean;
  onIntentional: () => boolean;
  captureAvailable: boolean;
  onCapture: () => boolean;
  onDismiss: () => void;
  onStop: () => void | Promise<void>;
}

function formatAwayDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} detik`;
  if (seconds === 0) return `${minutes} menit`;
  return `${minutes} menit ${seconds} detik`;
}

export default function ReturnToFocusPrompt({
  intervention,
  error,
  onReturn,
  onIntentional,
  captureAvailable,
  onCapture,
  onDismiss,
  onStop,
}: Props) {
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const awayDuration = useMemo(
    () => formatAwayDuration(intervention?.awayDurationMs ?? 0),
    [intervention?.awayDurationMs]
  );

  useEffect(() => {
    if (!intervention) return;
    const focusTimer = window.setTimeout(
      () => primaryActionRef.current?.focus(),
      0
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onDismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [intervention, onDismiss]);

  if (!intervention) return null;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="return-to-focus-title"
      aria-describedby="return-to-focus-description"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-md rounded-3xl border border-indigo-300/15 bg-zinc-950/95 p-5 shadow-2xl shadow-black/50 backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[390px] motion-reduce:transition-none"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-indigo-300/15 bg-indigo-400/10 text-indigo-200">
          <ShieldQuestion size={19} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-indigo-300/70">
            Focus Guard
          </p>
          <h2
            id="return-to-focus-title"
            className="mt-1 text-lg font-semibold text-white"
          >
            Siap kembali ke target?
          </h2>
          <p
            id="return-to-focus-description"
            className="mt-1.5 text-sm leading-relaxed text-zinc-400"
          >
            Kamu meninggalkan halaman FocusFlow. Ini belum tentu distraksi.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/5 bg-white/[0.025] p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          Target sesi
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-100">
          {intervention.targetSnapshot?.label ?? 'Target sesi terlindungi'}
        </p>
        {intervention.intention && (
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
            Niat: {intervention.intention}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3 text-xs text-zinc-400">
          <Clock3 size={14} className="text-zinc-500" aria-hidden="true" />
          <span>Waktu di luar halaman</span>
          <span className="ml-auto font-medium tabular-nums text-zinc-200">
            {awayDuration}
          </span>
        </div>
      </div>

      {intervention.excursionCount > 1 && (
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Tidak apa-apa. Ambil satu langkah kecil dan lanjutkan target ini.
        </p>
      )}

      {error && (
        <p className="mt-3 text-xs leading-relaxed text-red-300/80" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4">
        <button
          ref={primaryActionRef}
          type="button"
          onClick={onReturn}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-300/70 focus:ring-offset-2 focus:ring-offset-zinc-950 motion-reduce:transition-none"
        >
          Kembali fokus
          <ArrowRight size={15} aria-hidden="true" />
        </button>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          {captureAvailable && (
            <button
              type="button"
              onClick={onCapture}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-300/15 bg-indigo-400/[0.06] px-4 py-2.5 text-sm font-medium text-indigo-100 transition-colors hover:bg-indigo-400/[0.1] focus:outline-none focus:ring-2 focus:ring-indigo-300/70 focus:ring-offset-2 focus:ring-offset-zinc-950 motion-reduce:transition-none"
            >
              <Inbox size={14} aria-hidden="true" />
              Simpan untuk nanti
            </button>
          )}
          <button
            type="button"
            onClick={onIntentional}
            className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300/70 focus:ring-offset-2 focus:ring-offset-zinc-950 motion-reduce:transition-none"
          >
            Ini bukan distraksi
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void onStop()}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-red-500/[0.05] hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-300/50 motion-reduce:transition-none"
      >
        <Square size={11} aria-hidden="true" />
        Hentikan sesi terlindungi
      </button>
    </section>
  );
}
