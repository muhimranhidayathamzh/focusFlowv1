'use client';

import { Check, X } from 'lucide-react';
import {
  SelectedTimerPresetId,
  TimerPresetId,
  TimerSettings as SettingsType,
  timerPresets,
} from '@/hooks/useTimer';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsType;
  selectedPresetId: SelectedTimerPresetId;
  onApplyPreset: (presetId: TimerPresetId) => void;
  onSave: (newSettings: SettingsType) => void;
}

function toMinuteSettings(settings: SettingsType): SettingsType {
  return {
    focus: settings.focus / 60,
    shortBreak: settings.shortBreak / 60,
    longBreak: settings.longBreak / 60,
  };
}

export default function TimerSettings({
  isOpen,
  onClose,
  settings,
  selectedPresetId,
  onApplyPreset,
  onSave,
}: Props) {
  const [localSettings, setLocalSettings] = useState<SettingsType>(
    toMinuteSettings(settings)
  );

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(toMinuteSettings(settings));
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleApplyPreset = (presetId: TimerPresetId) => {
    const preset = timerPresets.find((item) => item.id === presetId);
    if (!preset) return;

    setLocalSettings(toMinuteSettings(preset.settings));
    onApplyPreset(presetId);
  };

  const handleSave = () => {
    onSave({
      focus: localSettings.focus * 60,
      shortBreak: localSettings.shortBreak * 60,
      longBreak: localSettings.longBreak * 60,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-3xl border border-white/10 bg-zinc-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200" role="dialog" aria-modal="true" aria-labelledby="timer-settings-heading">
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h2 id="timer-settings-heading" className="text-xl font-semibold text-white">Pengaturan Timer</h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-800"
            aria-label="Tutup pengaturan timer"
            title="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-300">Preset</p>
              {selectedPresetId === 'custom' && (
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                  Custom
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {timerPresets.map((preset) => {
                const isSelected = selectedPresetId === preset.id;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset.id)}
                    className={cn(
                      'min-h-[98px] rounded-2xl border p-3 text-left transition-all duration-200',
                      isSelected
                        ? 'border-indigo-400/40 bg-indigo-500/15 text-white'
                        : 'border-white/5 bg-zinc-950/30 text-zinc-400 hover:border-white/10 hover:bg-white/[0.04]'
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-tight">
                        {preset.label}
                      </span>
                      {isSelected && (
                        <Check
                          size={14}
                          className="mt-0.5 flex-shrink-0 text-indigo-300"
                        />
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed text-zinc-500">
                      {preset.settings.focus / 60}m fokus /{' '}
                      {preset.settings.shortBreak / 60}m jeda
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">Focus (menit)</label>
              <input
                type="number"
                value={localSettings.focus}
                onChange={(e) => setLocalSettings(s => ({...s, focus: Number(e.target.value)}))}
                className="w-20 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-white/20"
                min="1"
                max="60"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">Short Break (menit)</label>
              <input
                type="number"
                value={localSettings.shortBreak}
                onChange={(e) => setLocalSettings(s => ({...s, shortBreak: Number(e.target.value)}))}
                className="w-20 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-white/20"
                min="1"
                max="30"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-300">Long Break (menit)</label>
              <input
                type="number"
                value={localSettings.longBreak}
                onChange={(e) => setLocalSettings(s => ({...s, longBreak: Number(e.target.value)}))}
                className="w-20 bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-white/20"
                min="1"
                max="60"
              />
            </div>
          </div>
        </div>

        <div className="p-6 pt-0">
          <button
            onClick={handleSave}
            className="w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 transition-colors"
          >
            Simpan Perubahan
          </button>
        </div>
      </div>
    </div>
  );
}
