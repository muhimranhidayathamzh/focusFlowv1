'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, ShieldCheck, Target, X } from 'lucide-react';
import {
  FocusContractSubmission,
  GuardProfileOption,
  GuardTargetOption,
} from '@/hooks/useProtectedFocusSession';
import type {
  FocusGuardBrowserProtectionState,
  FocusGuardExtensionConnectionState,
} from '@/hooks/useFocusGuardExtensionBridge';

interface Props {
  isOpen: boolean;
  targetOptions: GuardTargetOption[];
  profileOptions: GuardProfileOption[];
  defaultTargetKey: string;
  defaultProfileId: string;
  durationSeconds: number;
  presetLabel: string;
  error: string | null;
  isSubmitting: boolean;
  extensionConnection: FocusGuardExtensionConnectionState;
  browserProtectionState: FocusGuardBrowserProtectionState;
  onConfirm: (submission: FocusContractSubmission) => Promise<boolean>;
  onCancel: () => void;
}

const PROTECTION_LABELS = {
  light: 'Ringan',
  medium: 'Sedang',
  strict: 'Ketat',
};

function formatDuration(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return `${minutes} menit`;
}

export default function FocusContract({
  isOpen,
  targetOptions,
  profileOptions,
  defaultTargetKey,
  defaultProfileId,
  durationSeconds,
  presetLabel,
  error,
  isSubmitting,
  extensionConnection,
  browserProtectionState,
  onConfirm,
  onCancel,
}: Props) {
  const [targetKey, setTargetKey] = useState(defaultTargetKey);
  const [profileId, setProfileId] = useState(defaultProfileId);
  const [intention, setIntention] = useState('');
  const targetSelectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTargetKey(defaultTargetKey);
    setProfileId(defaultProfileId);
    setIntention('');
    window.setTimeout(() => targetSelectRef.current?.focus(), 0);
  }, [defaultProfileId, defaultTargetKey, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onCancel]);

  const selectedProfile = useMemo(
    () => profileOptions.find((profile) => profile.id === profileId),
    [profileId, profileOptions]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-contract-title"
        aria-describedby="focus-contract-description"
        className="my-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/5 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-indigo-400/15 bg-indigo-500/10 text-indigo-300">
              <ShieldCheck size={17} />
            </div>
            <div>
              <h2 id="focus-contract-title" className="text-lg font-semibold text-white">
                Mulai sesi terlindungi
              </h2>
              <p
                id="focus-contract-description"
                className="mt-1 text-xs leading-relaxed text-zinc-500"
              >
                Tetapkan satu hal yang ingin kamu jaga selama sesi fokus ini.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Batalkan Focus Contract"
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onConfirm({ targetKey, profileId, intention });
          }}
          className="space-y-5 p-5 sm:p-6"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-zinc-950/30 px-4 py-3">
            <Clock3 size={15} className="text-zinc-500" />
            <div>
              <p className="text-xs font-medium text-zinc-300">
                {formatDuration(durationSeconds)} · {presetLabel}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-600">
                Durasi dikunci ketika sesi dimulai.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="focus-contract-target" className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-300">
              <Target size={13} />
              Target fokus
            </label>
            <select
              ref={targetSelectRef}
              id="focus-contract-target"
              value={targetKey}
              onChange={(event) => setTargetKey(event.target.value)}
              disabled={isSubmitting || targetOptions.length === 0}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-400/50 disabled:text-zinc-600"
            >
              <option value="">Pilih task atau langkah...</option>
              {targetOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.kind === 'step' ? 'Langkah: ' : 'Task: '}
                  {option.label}
                </option>
              ))}
            </select>
            {targetOptions.length === 0 && (
              <p className="mt-2 text-xs leading-relaxed text-amber-300/70">
                Belum ada target. Tutup dialog dan buat task terlebih dahulu,
                atau nonaktifkan Guard untuk memakai timer biasa.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="focus-contract-intention" className="mb-2 block text-xs font-medium text-zinc-300">
              Niat sesi <span className="font-normal text-zinc-600">(opsional)</span>
            </label>
            <textarea
              id="focus-contract-intention"
              value={intention}
              onChange={(event) => setIntention(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Contoh: selesaikan satu bagian tanpa membuka hal lain"
              disabled={isSubmitting}
              className="w-full resize-none rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-700 focus:ring-1 focus:ring-indigo-400/50"
            />
            <p className="mt-1 text-right text-[10px] text-zinc-700">
              {intention.length}/500
            </p>
          </div>

          <div>
            <label htmlFor="focus-contract-profile" className="mb-2 block text-xs font-medium text-zinc-300">
              Profil proteksi
            </label>
            <select
              id="focus-contract-profile"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-400/50"
            >
              {profileOptions.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          {selectedProfile && (
            <div className="rounded-2xl border border-indigo-400/10 bg-indigo-500/[0.06] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-indigo-200">
                  Proteksi {PROTECTION_LABELS[selectedProfile.protectionLevel]}
                </p>
                <span className="text-[10px] text-indigo-300/60">
                  Bypass {selectedProfile.bypassDurationMinutes}m
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
                {selectedProfile.websiteRuleCount > 0
                  ? 'Website Guard memerlukan extension dan izin domain. Timer tetap dapat dimulai tanpa izin, tetapi pemblokiran baru aktif setelah popup extension menampilkan izin telah diberikan.'
                  : 'Light Protection mencatat perpindahan perhatian secara lokal tanpa memblokir website.'}
              </p>
              {selectedProfile.websiteRuleCount > 0 && (
                <p className="mt-2 text-[10px] leading-relaxed text-amber-200/70">
                  {extensionConnection !== 'connected'
                    ? 'Extension belum terhubung; sesi akan berjalan tanpa pemblokiran website.'
                    : browserProtectionState === 'permission-required'
                      ? 'Izin situs diperlukan. Klik ikon FocusFlow Guard di toolbar browser, lalu pilih Izinkan pemblokiran.'
                      : 'Status perlindungan website akan dikonfirmasi setelah sesi dimulai; FocusFlow tidak mengklaim terlindungi sebelum DNR aktif.'}
                </p>
              )}
              <p className="mt-2 text-[10px] text-zinc-600">
                Jeda bypass {selectedProfile.bypassDelaySeconds} detik
                {selectedProfile.requireBypassReason
                  ? ' · alasan wajib'
                  : ' · alasan tidak wajib'}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl border border-red-400/10 bg-red-500/[0.06] px-3 py-2 text-xs leading-relaxed text-red-300/80">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || targetOptions.length === 0}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? 'Menyiapkan...' : 'Mulai sesi terlindungi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
