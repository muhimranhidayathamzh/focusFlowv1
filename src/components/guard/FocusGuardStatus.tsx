'use client';

import { AlertTriangle, Inbox, Settings2, Shield, ShieldCheck, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FocusGuardSession } from '@/types/focusGuard';
import type {
  FocusGuardBrowserProtectionState,
  FocusGuardExtensionConnectionState,
} from '@/hooks/useFocusGuardExtensionBridge';

interface Props {
  enabled: boolean;
  status: 'disabled' | 'ready' | 'active' | 'paused';
  activeSession: FocusGuardSession | null;
  protectionMissing: boolean;
  error?: string | null;
  busy: boolean;
  captureAvailable: boolean;
  captureConfirmation?: string | null;
  extensionConnection: {
    state: FocusGuardExtensionConnectionState;
    version: string | null;
    browserProtectionState: FocusGuardBrowserProtectionState;
  };
  onToggle: () => void | Promise<void>;
  onCapture: () => boolean;
  onStop: () => void | Promise<void>;
  onManageProfiles: () => void;
}

const STATUS_LABELS = {
  disabled: 'Nonaktif',
  ready: 'Siap',
  active: 'Aktif',
  paused: 'Dijeda',
};

export default function FocusGuardStatus({
  enabled,
  status,
  activeSession,
  protectionMissing,
  error,
  busy,
  captureAvailable,
  captureConfirmation,
  extensionConnection,
  onToggle,
  onCapture,
  onStop,
  onManageProfiles,
}: Props) {
  const isProtected = status === 'active' || status === 'paused';
  const extensionLabel = {
    connecting: 'Menghubungkan…',
    connected: 'Extension terhubung',
    disconnected: enabled
      ? 'Focus Guard aktif — proteksi browser belum tersedia'
      : 'Extension tidak terdeteksi',
    incompatible: 'Versi tidak kompatibel',
  }[extensionConnection.state];
  const browserProtectionLabel = {
    inactive: 'Browser Guard tidak aktif',
    light: 'Light: tanpa pemblokiran',
    'permission-required': 'Izin situs diperlukan',
    ready: 'Browser Guard siap',
    'protection-active': 'Protection active',
    'protection-paused': 'Protection paused',
    'bypass-active': 'Emergency bypass aktif',
    expired: 'Extension state expired',
    error: 'Extension state error',
  }[extensionConnection.browserProtectionState];

  return (
    <div className="w-full rounded-2xl border border-white/[0.07] bg-zinc-950/35 p-3.5 lg:p-2.5">
      <div className="flex items-center justify-between gap-3 lg:gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border lg:h-7 lg:w-7',
              isProtected
                ? 'border-emerald-400/15 bg-emerald-500/10 text-emerald-300'
                : 'border-white/5 bg-white/[0.03] text-zinc-500'
            )}
          >
            {isProtected ? <ShieldCheck size={15} /> : <Shield size={15} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-zinc-200">Focus Guard</p>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium',
                  isProtected
                    ? 'bg-emerald-500/10 text-emerald-300'
                    : enabled
                      ? 'bg-indigo-500/10 text-indigo-300'
                      : 'bg-white/5 text-zinc-500'
                )}
              >
                {STATUS_LABELS[status]}
              </span>
            </div>
            {activeSession ? (
              <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                {activeSession.profileSnapshot.name} ·{' '}
                {activeSession.targetSnapshot?.label ?? 'Tanpa target'}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] text-zinc-600">
                {enabled
                  ? 'Kontrak akan muncul sebelum fokus baru.'
                  : 'Timer biasa tetap tersedia.'}
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? 'Nonaktifkan Focus Guard' : 'Aktifkan Focus Guard'}
          disabled={busy}
          onClick={() => void onToggle()}
          className={cn(
            'relative h-6 w-11 flex-shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            enabled
              ? 'border-indigo-400/30 bg-indigo-500/30'
              : 'border-white/10 bg-zinc-800'
          )}
        >
          <span
            className={cn(
              'absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform',
              enabled ? 'translate-x-5' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {protectionMissing && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/10 bg-amber-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/70 lg:mt-2 lg:py-1.5">
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
          Timer ini berjalan tanpa sesi proteksi. Focus Guard tidak membuat sesi
          baru secara diam-diam.
        </div>
      )}

      {error && (
        <p className="mt-3 text-[11px] leading-relaxed text-red-300/80" role="alert">
          {error}
        </p>
      )}

      {captureConfirmation && (
        <p
          className="mt-3 rounded-xl border border-emerald-400/10 bg-emerald-500/[0.06] px-3 py-2 text-[11px] leading-relaxed text-emerald-200/75"
          role="status"
        >
          {captureConfirmation}
        </p>
      )}

      {isProtected && captureAvailable && (
        <button
          type="button"
          disabled={busy}
          onClick={onCapture}
          className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-indigo-300/10 bg-indigo-400/[0.06] px-3 py-2.5 text-left transition-colors hover:border-indigo-300/20 hover:bg-indigo-400/[0.1] focus:outline-none focus:ring-2 focus:ring-indigo-300/50 disabled:opacity-50 lg:mt-2 lg:py-2"
        >
          <span className="flex items-center gap-2 text-xs font-medium text-indigo-100">
            <Inbox size={14} aria-hidden="true" />
            Simpan distraksi
          </span>
          <kbd className="rounded-md border border-white/10 bg-black/20 px-1.5 py-0.5 text-[9px] font-medium text-zinc-500">
            Ctrl ⇧ D
          </kbd>
        </button>
      )}

      {isProtected && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onStop()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 px-3 py-2 text-[11px] font-medium text-zinc-500 transition-colors hover:border-red-400/10 hover:bg-red-500/[0.05] hover:text-red-300 disabled:opacity-50 lg:mt-2 lg:py-1.5"
        >
          <Square size={11} />
          Hentikan sesi terlindungi
        </button>
      )}

      <div className="mt-3 border-t border-white/5 pt-3 lg:mt-2 lg:pt-2" aria-live="polite">
        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <span
            className={cn(
              'h-2 w-2 flex-shrink-0 rounded-full',
              extensionConnection.state === 'connected'
                ? 'bg-emerald-400'
                : extensionConnection.state === 'connecting'
                  ? 'bg-amber-300'
                  : extensionConnection.state === 'incompatible'
                    ? 'bg-red-400'
                    : 'bg-zinc-600'
            )}
            aria-hidden="true"
          />
          <span>{extensionLabel}</span>
          {extensionConnection.state === 'connected' &&
            extensionConnection.version && (
              <span className="text-zinc-700">
                v{extensionConnection.version}
              </span>
            )}
        </div>
        {extensionConnection.state === 'disconnected' && (
          <p className="mt-1.5 text-[10px] leading-relaxed text-zinc-600 lg:hidden xl:mt-1 xl:block">
            Development: muat <code>extension/dist</code>; panduan lengkap ada
            di <code>extension/README.md</code>.
          </p>
        )}
        {extensionConnection.state === 'connected' && (
          <p
            className={cn(
              'mt-1.5 text-[10px] leading-relaxed',
              extensionConnection.browserProtectionState ===
                'protection-active'
                ? 'text-emerald-300/75'
                : extensionConnection.browserProtectionState ===
                      'permission-required' ||
                    extensionConnection.browserProtectionState === 'error' ||
                    extensionConnection.browserProtectionState === 'expired'
                  ? 'text-amber-200/70'
                  : 'text-zinc-600'
            )}
          >
            {browserProtectionLabel}
            {extensionConnection.browserProtectionState ===
              'permission-required' &&
              ' — buka ikon FocusFlow Guard di toolbar untuk memberi izin domain.'}
          </p>
        )}
        <button type="button" onClick={onManageProfiles} className="mt-2 flex min-h-8 items-center gap-1.5 rounded-md text-xs text-zinc-500 hover:text-zinc-200 lg:mt-1 lg:min-h-7">
          <Settings2 size={11} /> Kelola Guard profiles & rules
        </button>
      </div>
    </div>
  );
}
