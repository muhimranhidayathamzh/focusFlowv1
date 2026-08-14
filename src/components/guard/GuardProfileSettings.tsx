'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Download, Plus, Trash2, Upload, X } from 'lucide-react';
import { useFocusGuardProfiles } from '@/hooks/useFocusGuardProfiles';
import { useFocusGuardPreferences } from '@/hooks/useFocusGuardPreferences';
import {
  applyFocusGuardConfigImport,
  createFocusGuardConfigExport,
  FOCUS_GUARD_CONFIG_MAX_IMPORT_CHARS,
  FocusGuardImportPreview,
  parseFocusGuardConfigImport,
} from '@/lib/focusGuardProfileConfig';
import { normalizeWebsiteRuleSet, validateWebsiteRule } from '@/lib/focusGuardRules';
import type { FocusGuardProfile, WebsiteRule } from '@/types/focusGuard';

interface Props { onClose: () => void }
type SettingsTab = 'profile' | 'rules' | 'import-export';

function cloneProfile(profile: FocusGuardProfile): FocusGuardProfile {
  return {
    ...profile,
    websiteRules: profile.websiteRules.map((rule) => ({ ...rule })),
    applicationRules: profile.applicationRules.map((rule) => ({ ...rule })),
  };
}

function createRuleId() {
  return `website-rule-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

const inputClass = 'w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-400/50 disabled:cursor-not-allowed disabled:text-zinc-500';
const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'rules', label: 'Website Rules' },
  { id: 'import-export', label: 'Import / Export' },
];

export default function GuardProfileSettings({ onClose }: Props) {
  const profilesApi = useFocusGuardProfiles();
  const preferencesApi = useFocusGuardPreferences();
  const [selectedId, setSelectedId] = useState(profilesApi.selectedProfile.id);
  const [draft, setDraft] = useState<FocusGuardProfile>(() => cloneProfile(profilesApi.selectedProfile));
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [error, setError] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<FocusGuardImportPreview | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const immutable = draft.kind === 'built-in';
  const ruleErrors = useMemo(
    () => activeTab === 'rules' ? draft.websiteRules.map((rule) => validateWebsiteRule(rule).error) : [],
    [activeTab, draft.websiteRules]
  );

  const selectProfile = (profile: FocusGuardProfile) => {
    setSelectedId(profile.id);
    setDraft(cloneProfile(profile));
    setError(null);
  };

  const patchRule = (index: number, updates: Partial<WebsiteRule>) => {
    setDraft((current) => ({
      ...current,
      websiteRules: current.websiteRules.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...updates } : rule),
    }));
  };

  const moveRule = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.websiteRules.length) return current;
      const websiteRules = [...current.websiteRules];
      [websiteRules[index], websiteRules[target]] = [websiteRules[target], websiteRules[index]];
      return { ...current, websiteRules };
    });
  };

  const save = () => {
    const checked = normalizeWebsiteRuleSet(draft.websiteRules);
    if (!checked.ok) {
      setError(checked.error ?? 'Rule profile tidak valid.');
      return;
    }
    const saved = draft.kind === 'custom' ? profilesApi.updateProfile(draft.id, {
      name: draft.name,
      protectionLevel: draft.protectionLevel,
      websiteRules: checked.rules,
      applicationRules: [],
      emergencyBypassAllowed: draft.emergencyBypassAllowed,
      bypassDelaySeconds: draft.bypassDelaySeconds,
      bypassDurationMinutes: draft.bypassDurationMinutes,
      requireBypassReason: draft.requireBypassReason,
    }) : null;
    if (!saved) {
      setError('Profile tidak dapat disimpan. Periksa nama dan semua rule.');
      return;
    }
    setDraft(cloneProfile(saved));
    setError(null);
  };

  const exportConfig = () => {
    const config = createFocusGuardConfigExport();
    const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'focusflow-guard-config.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/75 p-3">
      <div role="dialog" aria-modal="true" aria-labelledby="guard-profile-settings-title" className="mx-auto my-4 w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/5 p-5">
          <div>
            <h2 id="guard-profile-settings-title" className="text-lg font-semibold text-white">Guard Profile Settings</h2>
            <p className="mt-1 text-xs text-zinc-500">Profile tersimpan lokal. Perubahan tidak mengubah snapshot sesi yang sedang aktif.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup pengaturan profile" className="rounded-full p-2 text-zinc-500 hover:bg-white/5 hover:text-white"><X size={18} /></button>
        </header>

        <div className="grid md:grid-cols-[240px_1fr]">
          <aside className="border-b border-white/5 p-4 md:border-b-0 md:border-r">
            <button type="button" onClick={() => {
              const created = profilesApi.createProfile({ name: 'Profile Baru', protectionLevel: 'medium', websiteRules: [], emergencyBypassAllowed: true, bypassDelaySeconds: 10, bypassDurationMinutes: 5, requireBypassReason: true });
              if (created) selectProfile(created);
            }} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-black"><Plus size={14} />Profile baru</button>
            <div className="mt-3 space-y-1">
              {profilesApi.profiles.map((profile) => (
                <button key={profile.id} type="button" onClick={() => selectProfile(profile)} className={`w-full rounded-xl px-3 py-2 text-left text-xs ${profile.id === selectedId ? 'bg-indigo-500/15 text-indigo-200' : 'text-zinc-400 hover:bg-white/5'}`}>
                  <span className="block truncate font-medium">{profile.name}</span>
                  <span className="text-[10px] text-zinc-600">{profile.kind === 'built-in' ? 'Built-in' : 'Custom'} · {profile.protectionLevel}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 border-t border-white/5 pt-4">
              <button type="button" onClick={() => { const copy = profilesApi.duplicateProfile(draft.id); if (copy) selectProfile(copy); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-zinc-400 hover:bg-white/5"><Copy size={13} />Duplicate</button>
            </div>
          </aside>

          <div className="max-h-[78vh] overflow-y-auto p-5 sm:p-6">
            <div role="tablist" aria-label="Bagian pengaturan Guard profile" className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-white/5 bg-zinc-950/50 p-1">
              {tabs.map((tab) => (
                <button key={tab.id} id={`guard-settings-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`guard-settings-panel-${tab.id}`} onClick={() => setActiveTab(tab.id)} className={`min-w-max flex-1 rounded-lg px-3 py-2 text-xs font-medium ${activeTab === tab.id ? 'bg-white text-black' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>{tab.label}</button>
              ))}
            </div>

            {activeTab === 'profile' && (
              <ProfilePanel draft={draft} immutable={immutable} isDefault={preferencesApi.preferences.selectedProfileId === draft.id} onDefault={() => preferencesApi.selectProfile(draft.id)} onChange={setDraft} />
            )}

            {activeTab === 'rules' && (
              <RulesPanel draft={draft} immutable={immutable} errors={ruleErrors} onChange={setDraft} onPatch={patchRule} onMove={moveRule} />
            )}

            {activeTab === 'import-export' && (
              <ImportExportPanel importText={importText} preview={importPreview} onTextChange={(value) => { setImportText(value); setImportPreview(null); }} onPreview={setImportPreview} onError={setError} onExport={exportConfig} />
            )}

            {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/10 bg-red-500/5 p-3 text-xs text-red-300/80">{error}</p>}
            <footer className="mt-5 flex flex-wrap justify-between gap-2 border-t border-white/5 pt-4">
              <div>{draft.kind === 'custom' && <button type="button" onClick={() => {
                if (!window.confirm(`Hapus profile ${draft.name}?`) || !profilesApi.deleteProfile(draft.id)) return;
                const fallback = profilesApi.profiles.find((profile) => profile.id === profilesApi.defaultProfileId);
                if (fallback) selectProfile(fallback);
              }} className="rounded-xl border border-red-400/15 px-3 py-2 text-xs text-red-300">Hapus profile</button>}</div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-zinc-400">Tutup</button>
                {!immutable && <button type="button" onClick={save} className="rounded-xl bg-white px-4 py-2 text-xs font-semibold text-black">Simpan profile</button>}
              </div>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ProfilePanelProps {
  draft: FocusGuardProfile;
  immutable: boolean;
  isDefault: boolean;
  onDefault: () => void;
  onChange: React.Dispatch<React.SetStateAction<FocusGuardProfile>>;
}

function ProfilePanel({ draft, immutable, isDefault, onDefault, onChange }: ProfilePanelProps) {
  const patch = (updates: Partial<FocusGuardProfile>) => onChange((current) => ({ ...current, ...updates }));
  return (
    <section id="guard-settings-panel-profile" role="tabpanel" aria-labelledby="guard-settings-tab-profile">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs text-zinc-400">Nama profile</label>
          <input value={draft.name} disabled={immutable} maxLength={80} onChange={(event) => patch({ name: event.target.value })} className={inputClass} />
        </div>
        <button type="button" onClick={onDefault} className="mt-5 rounded-xl border border-indigo-400/20 px-3 py-2 text-xs text-indigo-200">{isDefault ? 'Default terpilih' : 'Jadikan default'}</button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-zinc-400">Level
          <select disabled={immutable} value={draft.protectionLevel} onChange={(event) => patch({ protectionLevel: event.target.value as FocusGuardProfile['protectionLevel'] })} className={`${inputClass} mt-1`}>
            <option value="light">Light</option><option value="medium">Medium</option><option value="strict">Strict</option>
          </select>
        </label>
        <label className="text-xs text-zinc-400">Delay bypass
          <input disabled={immutable || !draft.emergencyBypassAllowed} type="number" min={0} max={300} value={draft.bypassDelaySeconds} onChange={(event) => patch({ bypassDelaySeconds: Number(event.target.value) })} className={`${inputClass} mt-1`} />
        </label>
        <label className="text-xs text-zinc-400">Durasi bypass (menit)
          <input disabled={immutable || !draft.emergencyBypassAllowed} type="number" min={1} max={60} value={draft.bypassDurationMinutes} onChange={(event) => patch({ bypassDurationMinutes: Number(event.target.value) })} className={`${inputClass} mt-1`} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-zinc-400">
        <label><input disabled={immutable} type="checkbox" checked={draft.emergencyBypassAllowed} onChange={(event) => patch({ emergencyBypassAllowed: event.target.checked })} /> <span className="ml-1">Emergency bypass</span></label>
        <label><input disabled={immutable || !draft.emergencyBypassAllowed} type="checkbox" checked={draft.requireBypassReason} onChange={(event) => patch({ requireBypassReason: event.target.checked })} /> <span className="ml-1">Alasan wajib</span></label>
      </div>
    </section>
  );
}

interface RulesPanelProps {
  draft: FocusGuardProfile;
  immutable: boolean;
  errors: Array<string | undefined>;
  onChange: React.Dispatch<React.SetStateAction<FocusGuardProfile>>;
  onPatch: (index: number, updates: Partial<WebsiteRule>) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}

function RulesPanel({ draft, immutable, errors, onChange, onPatch, onMove }: RulesPanelProps) {
  const addRule = (rule: WebsiteRule) => onChange((current) => ({ ...current, websiteRules: [...current.websiteRules, rule] }));
  return (
    <section id="guard-settings-panel-rules" role="tabpanel" aria-labelledby="guard-settings-tab-rules">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h3 className="text-sm font-semibold text-white">Website rules</h3><p className="text-[11px] text-zinc-600">Allow/block, domain, URL prefix, atau safe glob.</p></div>
        {!immutable && <div className="flex gap-2">
          <button type="button" onClick={() => addRule({ id: createRuleId(), label: 'Rule baru', action: 'block', matchType: 'domain', pattern: '' })} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-zinc-300">Tambah rule</button>
          <button type="button" onClick={() => addRule({ id: createRuleId(), label: 'YouTube Shorts', action: 'block', matchType: 'url-pattern', pattern: '*://*.youtube.com/shorts/*' })} className="rounded-lg border border-white/10 px-2 py-1.5 text-xs text-zinc-300">Preset Shorts</button>
        </div>}
      </div>
      <div className="mt-3 space-y-3">
        {draft.websiteRules.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-zinc-500">Belum ada website rule pada profile ini.</p>}
        {draft.websiteRules.map((rule, index) => (
          <div key={rule.id} className="rounded-2xl border border-white/5 bg-zinc-950/35 p-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_110px_130px_auto]">
              <input disabled={immutable} value={rule.label ?? ''} maxLength={160} onChange={(event) => onPatch(index, { label: event.target.value })} placeholder="Label" className={inputClass} />
              <select disabled={immutable} value={rule.action} onChange={(event) => onPatch(index, { action: event.target.value as WebsiteRule['action'] })} className={inputClass}><option value="block">Block</option><option value="allow">Allow</option></select>
              <select disabled={immutable} value={rule.matchType} onChange={(event) => onPatch(index, { matchType: event.target.value as WebsiteRule['matchType'], pattern: '' })} className={inputClass}><option value="domain">Domain</option><option value="url-prefix">URL prefix</option><option value="url-pattern">Safe pattern</option></select>
              {!immutable && <div className="flex">
                <button type="button" aria-label="Naikkan rule" disabled={index === 0} onClick={() => onMove(index, -1)} className="p-2 text-zinc-500 disabled:opacity-30"><ArrowUp size={14} /></button>
                <button type="button" aria-label="Turunkan rule" disabled={index === draft.websiteRules.length - 1} onClick={() => onMove(index, 1)} className="p-2 text-zinc-500 disabled:opacity-30"><ArrowDown size={14} /></button>
                <button type="button" aria-label="Hapus rule" onClick={() => onChange((current) => ({ ...current, websiteRules: current.websiteRules.filter((_, ruleIndex) => ruleIndex !== index) }))} className="p-2 text-red-300/70"><Trash2 size={14} /></button>
              </div>}
            </div>
            <input disabled={immutable} value={rule.pattern} maxLength={2048} onChange={(event) => onPatch(index, { pattern: event.target.value })} placeholder={rule.matchType === 'domain' ? 'contoh.com' : rule.matchType === 'url-prefix' ? 'https://youtube.com/shorts/' : '*://*.youtube.com/shorts/*'} className={`${inputClass} mt-2 font-mono text-xs`} />
            {errors[index] && <p className="mt-1 text-[11px] text-red-300/80">{errors[index]}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

interface ImportExportPanelProps {
  importText: string;
  preview: FocusGuardImportPreview | null;
  onTextChange: (value: string) => void;
  onPreview: (preview: FocusGuardImportPreview | null) => void;
  onError: (error: string | null) => void;
  onExport: () => void;
}

function ImportExportPanel({ importText, preview, onTextChange, onPreview, onError, onExport }: ImportExportPanelProps) {
  const applyImport = (mode: 'merge' | 'replace') => {
    if (!preview || !applyFocusGuardConfigImport(preview, mode)) return;
    onPreview(null);
    onTextChange('');
    onError(null);
  };
  return (
    <section id="guard-settings-panel-import-export" role="tabpanel" aria-labelledby="guard-settings-tab-import-export">
      <h3 className="text-sm font-semibold text-white">Import / Export configuration</h3>
      <p className="mt-1 text-xs text-zinc-500">Export hanya memuat custom profile dan preference profile yang relevan.</p>
      <button type="button" onClick={onExport} className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300"><Download size={13} />Export custom profiles</button>
      <div className="mt-6 border-t border-white/5 pt-5">
        <input type="file" accept="application/json,.json" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > FOCUS_GUARD_CONFIG_MAX_IMPORT_CHARS) {
            onPreview(null);
            onError('File konfigurasi terlalu besar. Maksimum 1 MB.');
            return;
          }
          onTextChange(await file.text());
        }} className="block w-full text-xs text-zinc-500 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-zinc-300" />
        <textarea value={importText} maxLength={FOCUS_GUARD_CONFIG_MAX_IMPORT_CHARS} onChange={(event) => onTextChange(event.target.value)} rows={5} placeholder="Pilih file atau tempel JSON export di sini" className={`${inputClass} mt-3 font-mono text-xs`} />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => {
            const result = parseFocusGuardConfigImport(importText);
            if (result.ok) {
              onPreview(result.preview);
              onError(null);
            } else {
              onPreview(null);
              onError(result.error);
            }
          }} className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300"><Upload size={13} />Preview import</button>
          {preview && <>
            <button type="button" onClick={() => applyImport('merge')} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black">Merge</button>
            <button type="button" onClick={() => { if (window.confirm('Ganti semua custom profile? Built-in tetap dipertahankan.')) applyImport('replace'); }} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-200">Replace custom</button>
          </>}
        </div>
        {preview && <p className="mt-2 rounded-xl border border-indigo-400/10 bg-indigo-500/5 p-3 text-xs text-zinc-400">Preview: {preview.profileNames.length} custom profile ({preview.profileNames.join(', ') || 'kosong'}). Default: {preview.selectedProfileId}.</p>}
      </div>
    </section>
  );
}
