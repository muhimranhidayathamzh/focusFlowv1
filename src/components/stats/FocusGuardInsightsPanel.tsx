'use client';

import {
  ArrowLeftToLine,
  ChevronDown,
  EyeOff,
  Inbox,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useFocusGuardInsights } from '@/hooks/useFocusGuardInsights';

export default function FocusGuardInsightsPanel() {
  const insights = useFocusGuardInsights();

  if (!insights.isLoaded) {
    return (
      <section className="mx-auto w-full animate-pulse rounded-2xl border border-white/5 bg-zinc-900/30 p-4">
        <div className="h-5 w-48 rounded bg-zinc-800" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="h-16 rounded-xl bg-zinc-800/50" />
          <div className="h-16 rounded-xl bg-zinc-800/50" />
        </div>
      </section>
    );
  }

  const hasSessions = insights.protectedSessionsCompleted > 0;

  return (
    <details className="group mx-auto w-full rounded-2xl border border-white/[0.07] bg-zinc-900/30 p-4 backdrop-blur-xl">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 rounded-lg [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-300/10 bg-emerald-400/[0.07] text-emerald-300">
            <ShieldCheck size={17} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Focus Guard · 7 hari</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {hasSessions
                ? `${insights.protectedSessionsCompleted} sesi selesai · ${insights.blockedSiteCount} situs diblokir`
                : 'Belum ada sesi terlindungi selesai.'}
            </p>
          </div>
        </div>
        <ChevronDown size={17} className="mt-2 flex-shrink-0 text-zinc-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
      </summary>

      <div className="mt-4 border-t border-white/5 pt-4">
        {!hasSessions ? (
        <div className="rounded-xl border border-dashed border-white/5 px-4 py-3">
          <p className="text-xs leading-relaxed text-zinc-500">Ringkasan lokal akan muncul setelah satu sesi Focus Guard selesai.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Metric icon={<ShieldCheck size={13} />} label="Sesi selesai" value={insights.protectedSessionsCompleted} />
            <Metric icon={<EyeOff size={13} />} label="Perpindahan" value={insights.meaningfulExcursions} />
            <Metric icon={<ArrowLeftToLine size={13} />} label="Kembali" value={insights.returnedCount} />
            <Metric icon={<EyeOff size={13} />} label="Disengaja" value={insights.intentionalCount} />
            <Metric icon={<ShieldCheck size={13} />} label="Diblokir" value={insights.blockedSiteCount} />
            <Metric icon={<EyeOff size={13} />} label="Bypass" value={insights.emergencyBypassCount} />
            <Metric icon={<Inbox size={13} />} label="Disimpan" value={insights.capturedDistractionCount} />
            <Metric
              icon={<Star size={13} />}
              label="Rata-rata rasa"
              value={
                insights.averageRating === null
                  ? '—'
                  : insights.averageRating.toFixed(1)
              }
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
            Rating rata-rata hanya memakai {insights.ratedSessionCount} sesi yang diberi rating. Perpindahan disengaja ditampilkan terpisah dan tidak dinilai sebagai kegagalan fokus.
          </p>
          <p className="mt-2 text-[11px] text-zinc-600">{insights.reviewedPercent}% sesi sudah ditinjau.</p>
        </>
      )}
      </div>
    </details>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950/30 p-3">
      <div className="flex items-center gap-1.5 text-zinc-600">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-zinc-100">{value}</p>
    </div>
  );
}
