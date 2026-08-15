import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioEngine } from '@/lib/audioEngine';
import { AMBIENT_SOUNDS, AmbientSoundType } from '@/types/ambient';

const VOLUME_STORAGE_KEY = 'focusflow-ambient-volume';
const SOUND_STORAGE_KEY = 'focusflow-ambient-sound';
const AUTO_PLAY_STORAGE_KEY = 'focusflow-ambient-autoplay-focus-v1';
const DEFAULT_SOUND: AmbientSoundType = 'rain';

function loadSavedVolume(): number {
  if (typeof window === 'undefined') return 0.5;
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    const parsed = saved ? Number.parseFloat(saved) : 0.5;
    return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : 0.5;
  } catch {
    return 0.5;
  }
}

function loadSavedSound(): AmbientSoundType {
  if (typeof window === 'undefined') return DEFAULT_SOUND;
  try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    return AMBIENT_SOUNDS.some((sound) => sound.id === saved)
      ? (saved as AmbientSoundType)
      : DEFAULT_SOUND;
  } catch {
    return DEFAULT_SOUND;
  }
}

function loadAutoPlayPreference(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(AUTO_PLAY_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function persistPreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sound remains usable when storage is unavailable.
  }
}

export function useAmbientSound() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [currentSound, setCurrentSound] = useState<AmbientSoundType | null>(null);
  const [selectedSound, setSelectedSound] =
    useState<AmbientSoundType>(DEFAULT_SOUND);
  const [volume, setVolumeState] = useState<number>(0.5);
  const [autoPlayOnFocus, setAutoPlayOnFocusState] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Initialize engine and load saved preferences
  useEffect(() => {
    engineRef.current = new AudioEngine();
    const savedVolume = loadSavedVolume();
    const savedSound = loadSavedSound();
    setVolumeState(savedVolume);
    setSelectedSound(savedSound);
    setAutoPlayOnFocusState(loadAutoPlayPreference());
    engineRef.current.setVolume(savedVolume);
    setIsReady(true);

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const startSound = useCallback((soundType: AmbientSoundType) => {
    if (!engineRef.current) return;

    if (engineRef.current.getCurrentSound() === soundType) return;

    engineRef.current.play(soundType);
    setCurrentSound(soundType);
  }, []);

  const stopSound = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    setCurrentSound(null);
  }, []);

  const playSound = useCallback((soundType: AmbientSoundType) => {
    if (!engineRef.current) return;

    setSelectedSound(soundType);
    persistPreference(SOUND_STORAGE_KEY, soundType);

    if (engineRef.current.getCurrentSound() === soundType) {
      // Toggle off if same sound
      stopSound();
    } else {
      startSound(soundType);
    }
  }, [startSound, stopSound]);

  const playSelectedSound = useCallback(() => {
    startSound(selectedSound);
  }, [selectedSound, startSound]);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    engineRef.current?.setVolume(clamped);
    persistPreference(VOLUME_STORAGE_KEY, clamped.toString());
  }, []);

  const setAutoPlayOnFocus = useCallback((enabled: boolean) => {
    setAutoPlayOnFocusState(enabled);
    persistPreference(AUTO_PLAY_STORAGE_KEY, enabled.toString());
  }, []);

  return {
    currentSound,
    selectedSound,
    volume,
    autoPlayOnFocus,
    isReady,
    playSound,
    playSelectedSound,
    stopSound,
    setVolume,
    setAutoPlayOnFocus,
  };
}
