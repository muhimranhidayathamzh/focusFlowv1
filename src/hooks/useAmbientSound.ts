import { useState, useEffect, useRef, useCallback } from 'react';
import { AudioEngine } from '@/lib/audioEngine';
import { AmbientSoundType } from '@/types/ambient';

const VOLUME_STORAGE_KEY = 'focusflow-ambient-volume';
const SOUND_STORAGE_KEY = 'focusflow-ambient-sound';

function loadSavedVolume(): number {
  if (typeof window === 'undefined') return 0.5;
  try {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    return saved ? parseFloat(saved) : 0.5;
  } catch {
    return 0.5;
  }
}

export function useAmbientSound() {
  const engineRef = useRef<AudioEngine | null>(null);
  const [currentSound, setCurrentSound] = useState<AmbientSoundType | null>(null);
  const [volume, setVolumeState] = useState<number>(0.5);
  const [isReady, setIsReady] = useState(false);

  // Initialize engine and load saved preferences
  useEffect(() => {
    engineRef.current = new AudioEngine();
    const savedVolume = loadSavedVolume();
    setVolumeState(savedVolume);
    engineRef.current.setVolume(savedVolume);
    setIsReady(true);

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const playSound = useCallback((soundType: AmbientSoundType) => {
    if (!engineRef.current) return;

    if (currentSound === soundType) {
      // Toggle off if same sound
      engineRef.current.stop();
      setCurrentSound(null);
      localStorage.removeItem(SOUND_STORAGE_KEY);
    } else {
      engineRef.current.play(soundType);
      setCurrentSound(soundType);
      localStorage.setItem(SOUND_STORAGE_KEY, soundType);
    }
  }, [currentSound]);

  const stopSound = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.stop();
    setCurrentSound(null);
    localStorage.removeItem(SOUND_STORAGE_KEY);
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(1, value));
    setVolumeState(clamped);
    engineRef.current?.setVolume(clamped);
    localStorage.setItem(VOLUME_STORAGE_KEY, clamped.toString());
  }, []);

  return {
    currentSound,
    volume,
    isReady,
    playSound,
    stopSound,
    setVolume,
  };
}
