'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Inbox, Target, X } from 'lucide-react';
import { DISTRACTION_CAPTURE_MAX_LENGTH } from '@/hooks/useDistractionCaptureFlow';

interface Props {
  isOpen: boolean;
  isSubmitting: boolean;
  targetLabel?: string;
  error?: string | null;
  source: 'quick' | 'return-prompt' | null;
  onSubmit: (text: string) => Promise<boolean>;
  onCancel: () => void;
}

export default function DistractionCapture({
  isOpen,
  isSubmitting,
  targetLabel,
  error,
  source,
  onSubmit,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(isSubmitting);

  isSubmittingRef.current = isSubmitting;

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    setDraft('');
    setValidationError(null);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || isSubmittingRef.current) return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscape);
      if (previousFocus?.isConnected) {
        window.setTimeout(() => previousFocus.focus(), 0);
      }
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const submit = async () => {
    const normalized = draft.trim();
    if (!normalized) {
      setValidationError('Tulis satu hal yang ingin disimpan untuk nanti.');
      return;
    }
    if (normalized.length > DISTRACTION_CAPTURE_MAX_LENGTH) {
      setValidationError(
        `Batasi catatan hingga ${DISTRACTION_CAPTURE_MAX_LENGTH} karakter.`
      );
      return;
    }
    setValidationError(null);
    await onSubmit(normalized);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="distraction-capture-title"
        aria-describedby="distraction-capture-description"
        className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl motion-reduce:transition-none sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-indigo-300/15 bg-indigo-400/10 text-indigo-200">
              <Inbox size={18} aria-hidden="true" />
            </div>
            <div>
              <h2
                id="distraction-capture-title"
                className="text-lg font-semibold text-white"
              >
                Simpan untuk nanti
              </h2>
              <p
                id="distraction-capture-description"
                className="mt-1 text-sm leading-relaxed text-zinc-400"
              >
                Tidak perlu dikerjakan sekarang. Catat singkat, lalu kembali ke
                target.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Batalkan simpan distraksi"
            disabled={isSubmitting}
            onClick={onCancel}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300/60 disabled:opacity-50"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-4 py-3">
          <Target size={15} className="flex-shrink-0 text-indigo-300" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Kembali ke target
            </p>
            <p className="truncate text-sm text-zinc-200">
              {targetLabel ?? 'Target sesi terlindungi'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5">
          <label
            htmlFor="distraction-capture-text"
            className="mb-2 block text-xs font-medium text-zinc-300"
          >
            Apa yang ingin kamu simpan?
          </label>
          <textarea
            ref={inputRef}
            id="distraction-capture-text"
            value={draft}
            maxLength={DISTRACTION_CAPTURE_MAX_LENGTH}
            rows={4}
            disabled={isSubmitting}
            onChange={(event) => {
              setDraft(event.target.value);
              setValidationError(null);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Contoh: Balas pesan itu nanti"
            className="w-full resize-none rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-white outline-none placeholder:text-zinc-600 focus:border-indigo-300/30 focus:ring-2 focus:ring-indigo-400/20 disabled:opacity-60"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-600">
              {source === 'return-prompt'
                ? 'Setelah tersimpan, perpindahan ini ditandai sebagai dicatat.'
                : 'Ctrl + Enter untuk menyimpan.'}
            </p>
            <span className="text-[11px] tabular-nums text-zinc-600">
              {draft.length}/{DISTRACTION_CAPTURE_MAX_LENGTH}
            </span>
          </div>

          {(validationError || error) && (
            <p className="mt-3 text-xs leading-relaxed text-red-300/85" role="alert">
              {validationError ?? error}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-300/60 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !draft.trim()}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-300/70 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan…' : 'Simpan untuk nanti'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
