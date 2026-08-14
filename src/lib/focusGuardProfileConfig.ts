import {
  BUILT_IN_BROWSER_PROFILE_ID,
  BUILT_IN_LIGHT_PROFILE_ID,
  importCustomFocusGuardProfiles,
  loadFocusGuardPreferences,
  loadFocusGuardProfiles,
  normalizeFocusGuardProfile,
  saveFocusGuardPreferences,
} from '@/lib/focusGuardPersistence';
import type { FocusGuardProfile } from '@/types/focusGuard';

export const FOCUS_GUARD_CONFIG_FORMAT = 'focusflow-guard-config';
export const FOCUS_GUARD_CONFIG_VERSION = 1;
export const FOCUS_GUARD_CONFIG_MAX_IMPORT_CHARS = 1_000_000;

export interface FocusGuardConfigExport {
  format: typeof FOCUS_GUARD_CONFIG_FORMAT;
  version: typeof FOCUS_GUARD_CONFIG_VERSION;
  exportedAt: number;
  customProfiles: FocusGuardProfile[];
  preferences: { selectedProfileId: string };
}

export interface FocusGuardImportPreview {
  config: FocusGuardConfigExport;
  profileNames: string[];
  selectedProfileId: string;
}

const BUILT_INS = new Set([
  BUILT_IN_LIGHT_PROFILE_ID,
  BUILT_IN_BROWSER_PROFILE_ID,
]);

export function createFocusGuardConfigExport(
  now = Date.now()
): FocusGuardConfigExport {
  const profiles = loadFocusGuardProfiles();
  const selectedProfileId = loadFocusGuardPreferences().selectedProfileId;
  return {
    format: FOCUS_GUARD_CONFIG_FORMAT,
    version: FOCUS_GUARD_CONFIG_VERSION,
    exportedAt: now,
    customProfiles: profiles
      .filter((profile) => profile.kind === 'custom')
      .map((profile) => structuredClone(profile)),
    preferences: { selectedProfileId },
  };
}

export function parseFocusGuardConfigImport(
  text: string
): { ok: true; preview: FocusGuardImportPreview } | { ok: false; error: string } {
  if (text.length > FOCUS_GUARD_CONFIG_MAX_IMPORT_CHARS) {
    return {
      ok: false,
      error: 'File konfigurasi terlalu besar. Maksimum 1 MB.',
    };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File konfigurasi bukan JSON yang valid.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Struktur konfigurasi tidak valid.' };
  }
  const record = raw as Record<string, unknown>;
  if (
    record.format !== FOCUS_GUARD_CONFIG_FORMAT ||
    record.version !== FOCUS_GUARD_CONFIG_VERSION ||
    !Number.isFinite(record.exportedAt) ||
    !Array.isArray(record.customProfiles) ||
    record.customProfiles.length > 200 ||
    !record.preferences ||
    typeof record.preferences !== 'object' ||
    Array.isArray(record.preferences)
  ) return { ok: false, error: 'Versi atau struktur konfigurasi tidak didukung.' };

  const profiles: FocusGuardProfile[] = [];
  const ids = new Set<string>();
  for (const item of record.customProfiles) {
    const profile = normalizeFocusGuardProfile(item);
    if (
      !profile ||
      profile.kind !== 'custom' ||
      BUILT_INS.has(profile.id) ||
      ids.has(profile.id)
    ) return { ok: false, error: 'Import berisi profile invalid atau mencoba menimpa built-in.' };
    ids.add(profile.id);
    profiles.push(profile);
  }
  const preference = record.preferences as Record<string, unknown>;
  const selectedProfileId = typeof preference.selectedProfileId === 'string'
    ? preference.selectedProfileId
    : BUILT_IN_LIGHT_PROFILE_ID;
  if (
    !BUILT_INS.has(selectedProfileId) &&
    !profiles.some((profile) => profile.id === selectedProfileId)
  ) return { ok: false, error: 'Default profile pada import tidak tersedia.' };

  const config: FocusGuardConfigExport = {
    format: FOCUS_GUARD_CONFIG_FORMAT,
    version: FOCUS_GUARD_CONFIG_VERSION,
    exportedAt: record.exportedAt as number,
    customProfiles: profiles,
    preferences: { selectedProfileId },
  };
  return {
    ok: true,
    preview: {
      config,
      profileNames: profiles.map((profile) => profile.name),
      selectedProfileId,
    },
  };
}

export function applyFocusGuardConfigImport(
  preview: FocusGuardImportPreview,
  mode: 'merge' | 'replace'
) {
  const imported = importCustomFocusGuardProfiles(
    preview.config.customProfiles,
    mode
  );
  if (!imported) return false;
  const available = loadFocusGuardProfiles();
  const selectedProfileId = available.some(
    (profile) => profile.id === preview.selectedProfileId
  )
    ? preview.selectedProfileId
    : BUILT_IN_LIGHT_PROFILE_ID;
  return Boolean(
    saveFocusGuardPreferences({
      ...loadFocusGuardPreferences(),
      selectedProfileId,
    })
  );
}
