'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Inbox,
  ListPlus,
  Target,
} from 'lucide-react';
import { useDistractionInbox } from '@/hooks/useDistractionInbox';
import { useDistractionTaskConversion } from '@/hooks/useDistractionTaskConversion';
import { useFocusGuardSession } from '@/hooks/useFocusGuardSession';
import { cn } from '@/lib/utils';

function formatCapturedAt(timestamp: number) {
  const captured = new Date(timestamp);
  const now = new Date();
  const sameDay =
    captured.getFullYear() === now.getFullYear() &&
    captured.getMonth() === now.getMonth() &&
    captured.getDate() === now.getDate();
  return new Intl.DateTimeFormat('id-ID',
    sameDay
      ? { hour: '2-digit', minute: '2-digit' }
      : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
  ).format(captured);
}

export default function DistractionInboxPanel() {
  const { inboxItems, isLoaded, dismissItem } = useDistractionInbox();
  const { activeSession, history, isLoaded: sessionsLoaded } =
    useFocusGuardSession();
  const { convertToTask, isConverting } = useDistractionTaskConversion();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => [...inboxItems].sort((a, b) => b.capturedAt - a.capturedAt),
    [inboxItems]
  );
  const visibleItems = showAll ? sortedItems : sortedItems.slice(0, 3);
  const sessionTargets = useMemo(() => {
    const result = new Map<string, string>();
    if (activeSession?.targetSnapshot?.label) {
      result.set(activeSession.id, activeSession.targetSnapshot.label);
    }
    history.forEach((session) => {
      if (session.targetSnapshot?.label) {
        result.set(session.id, session.targetSnapshot.label);
      }
    });
    return result;
  }, [activeSession, history]);

  const handleConvert = useCallback(
    async (itemId: string) => {
      setActionError(null);
      const result = await convertToTask(itemId);
      if (result.ok) return;
      setActionError(
        result.partialTaskId
          ? 'Task sudah dibuat, tetapi status inbox belum diperbarui. Coba lagi; task tidak akan diduplikasi.'
          : 'Item belum dapat dijadikan task. Coba sekali lagi.'
      );
    },
    [convertToTask]
  );

  const handleDismiss = useCallback(
    (itemId: string) => {
      setActionError(null);
      setDismissingIds((current) => new Set(current).add(itemId));
      const dismissed = dismissItem(itemId, Date.now());
      setDismissingIds((current) => {
        const next = new Set(current);
        next.delete(itemId);
        return next;
      });
      if (!dismissed) {
        setActionError('Item belum dapat dihapus dari inbox. Coba sekali lagi.');
      }
    },
    [dismissItem]
  );

  if (!isLoaded || !sessionsLoaded) {
    return (
      <div className="mx-auto w-full animate-pulse rounded-2xl border border-white/5 bg-zinc-900/30 p-4">
        <div className="h-5 w-44 rounded bg-zinc-800" />
        <div className="mt-4 h-16 rounded-2xl bg-zinc-800/40" />
      </div>
    );
  }

  return (
    <section className="mx-auto w-full rounded-2xl border border-white/[0.07] bg-zinc-900/30 p-4 backdrop-blur-xl">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls="distraction-inbox-content"
        onClick={() => {
          setIsExpanded((current) => !current);
          if (isExpanded) setShowAll(false);
        }}
        className="flex w-full items-center justify-between gap-4 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-indigo-300/50"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/5 bg-white/[0.035] text-zinc-400">
            <Inbox size={17} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-zinc-100">
              Distraction Inbox
            </span>
            <span className="mt-0.5 block text-xs text-zinc-500">
              {sortedItems.length === 0
                ? 'Inbox kosong.'
                : `${sortedItems.length} item menunggu ditinjau.`}
            </span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
            {sortedItems.length}
          </span>
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={cn(
              'text-zinc-500 transition-transform motion-reduce:transition-none',
              isExpanded && 'rotate-180'
            )}
          />
        </span>
      </button>

      {isExpanded && (
        <div id="distraction-inbox-content" className="mt-4">
          {actionError && (
            <p
              className="mb-3 rounded-xl border border-red-400/10 bg-red-500/[0.05] px-3 py-2 text-xs leading-relaxed text-red-300/80"
              role="alert"
            >
              {actionError}
            </p>
          )}

          {sortedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/5 px-4 py-3">
              <p className="text-xs text-zinc-500">
                Belum ada yang perlu disimpan untuk nanti.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleItems.map((item) => {
                const converting = isConverting(item.id);
                const dismissing = dismissingIds.has(item.id);
                const targetLabel = item.guardSessionId
                  ? sessionTargets.get(item.guardSessionId)
                  : undefined;
                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-white/5 bg-zinc-950/35 p-4"
                  >
                    <p className="break-words text-sm leading-relaxed text-zinc-200">
                      {item.text}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
                      <time dateTime={new Date(item.capturedAt).toISOString()}>
                        {formatCapturedAt(item.capturedAt)}
                      </time>
                      {targetLabel && (
                        <span className="flex min-w-0 items-center gap-1 text-zinc-500">
                          <Target size={11} aria-hidden="true" />
                          <span className="max-w-[220px] truncate">{targetLabel}</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={converting || dismissing}
                        onClick={() => void handleConvert(item.id)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-indigo-300/10 bg-indigo-400/[0.06] px-3 py-2 text-xs font-medium text-indigo-100 transition-colors hover:bg-indigo-400/[0.1] focus:outline-none focus:ring-2 focus:ring-indigo-300/50 disabled:opacity-50"
                      >
                        <ListPlus size={13} aria-hidden="true" />
                        {converting ? 'Membuat task…' : 'Jadikan task'}
                      </button>
                      <button
                        type="button"
                        disabled={converting || dismissing}
                        onClick={() => handleDismiss(item.id)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/5 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:bg-white/[0.035] hover:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/50 disabled:opacity-50"
                      >
                        <Check size={13} aria-hidden="true" />
                        {dismissing ? 'Menyimpan…' : 'Hapus dari inbox'}
                      </button>
                    </div>
                  </article>
                );
              })}
              {sortedItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAll((current) => !current)}
                  className="mt-2 min-h-10 w-full rounded-xl border border-white/5 px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.035] hover:text-zinc-200"
                >
                  {showAll
                    ? 'Tampilkan tiga terbaru'
                    : `Tampilkan ${sortedItems.length - 3} lainnya`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
