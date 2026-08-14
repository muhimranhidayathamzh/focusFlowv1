'use client';

import { useAmbientSound } from '@/hooks/useAmbientSound';
import { AMBIENT_SOUND_GROUPS, AMBIENT_SOUNDS } from '@/types/ambient';
import { ChevronDown, Headphones, Play, Square, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

function getSoundInitial(label: string) {
  return label
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AmbientSoundPanel() {
  const { currentSound, volume, isReady, playSound, stopSound, setVolume } =
    useAmbientSound();

  if (!isReady) return null;

  const isPlaying = currentSound !== null;
  const currentSoundConfig = AMBIENT_SOUNDS.find(
    (sound) => sound.id === currentSound
  );

  return (
    <section className="mx-auto w-full rounded-2xl border border-white/[0.07] bg-zinc-900/30 p-4 backdrop-blur-xl" aria-labelledby="focus-sound-heading">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 transition-colors duration-300',
              isPlaying ? 'bg-indigo-500/20' : 'bg-white/5'
            )}
          >
            <Headphones
              size={16}
              className={cn(
                'transition-colors duration-500',
                isPlaying ? 'text-indigo-400' : 'text-zinc-400'
              )}
            />
          </div>
          <div>
            <h2 id="focus-sound-heading" className="text-sm font-semibold text-white">
              Focus Sound
            </h2>
            <p className="text-xs text-zinc-500">
              {currentSoundConfig?.label ?? 'Tidak ada suara diputar'}
            </p>
          </div>
        </div>
        <button
          onClick={isPlaying ? stopSound : () => playSound('rain')}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.08]"
          id="ambient-stop-btn"
          aria-label={isPlaying ? 'Hentikan focus sound' : 'Putar suara Rain'}
          title={isPlaying ? 'Hentikan focus sound' : 'Putar Rain'}
        >
          {isPlaying ? <Square size={13} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {isPlaying ? 'Stop' : 'Putar'}
        </button>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-black/15 px-3 py-3">
        <button
          onClick={() => setVolume(volume > 0 ? 0 : 0.5)}
          className="rounded-md p-1 text-zinc-400 transition-colors hover:text-white"
          id="ambient-mute-btn"
          aria-label={volume === 0 ? 'Nyalakan volume' : 'Matikan volume'}
        >
          {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <div className="flex-1 relative group">
          <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'absolute left-0 top-0 h-full rounded-full transition-all duration-200',
                isPlaying
                  ? 'bg-indigo-400'
                  : 'bg-zinc-600'
              )}
              style={{ width: `${volume * 100}%` }}
            />
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            id="ambient-volume-slider"
            aria-label="Volume focus sound"
          />
        </div>

        <span className="text-xs text-zinc-500 font-mono w-8 text-right tabular-nums">
          {Math.round(volume * 100)}
        </span>
      </div>

      <details className="group mt-3">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-xl border border-white/5 px-3 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/[0.035] hover:text-zinc-200 [&::-webkit-details-marker]:hidden">
          Pilih suara
          <ChevronDown size={15} className="transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
        </summary>

        <div className="mt-3 space-y-4 border-t border-white/5 pt-4">
          {AMBIENT_SOUND_GROUPS.map((group) => {
            const sounds = AMBIENT_SOUNDS.filter(
              (sound) => sound.group === group.id
            );

            return (
              <div key={group.id}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-300">{group.label}</h3>
                    <p className="mt-0.5 text-[11px] text-zinc-500">{group.description}</p>
                  </div>
                  {group.id === 'binaural' && (
                    <span className="flex flex-shrink-0 items-center gap-1 text-[10px] text-indigo-300">
                      <Headphones size={11} aria-hidden="true" /> Stereo
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {sounds.map((sound) => {
                    const isActive = currentSound === sound.id;
                    return (
                      <button
                        key={sound.id}
                        onClick={() => playSound(sound.id)}
                        className={cn(
                          'min-h-16 rounded-xl border p-3 text-left transition-colors',
                          isActive
                            ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-100'
                            : 'border-white/5 bg-white/[0.02] text-zinc-300 hover:bg-white/[0.05]'
                        )}
                        id={`ambient-${sound.id}`}
                        aria-pressed={isActive}
                        title={`${isActive ? 'Hentikan' : 'Putar'} ${sound.label}`}
                      >
                        <span className="flex items-center gap-2 text-xs font-semibold">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-black/20 text-[10px]">
                            {getSoundInitial(sound.label)}
                          </span>
                          <span className="truncate">{sound.label}</span>
                        </span>
                        <span className="mt-1.5 block text-[10px] leading-relaxed text-zinc-500">
                          {sound.description}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
