'use client';

import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useAmbientSound } from '@/hooks/useAmbientSound';

type AmbientSoundContextValue = ReturnType<typeof useAmbientSound>;
type AmbientSoundTimerContextValue = Pick<
  AmbientSoundContextValue,
  | 'autoPlayOnFocus'
  | 'isReady'
  | 'playSelectedSound'
  | 'stopSound'
>;

const AmbientSoundContext = createContext<AmbientSoundContextValue | null>(null);
const AmbientSoundTimerContext =
  createContext<AmbientSoundTimerContextValue | null>(null);

export function AmbientSoundProvider({ children }: { children: ReactNode }) {
  const ambientSound = useAmbientSound();
  const timerControls = useMemo<AmbientSoundTimerContextValue>(
    () => ({
      autoPlayOnFocus: ambientSound.autoPlayOnFocus,
      isReady: ambientSound.isReady,
      playSelectedSound: ambientSound.playSelectedSound,
      stopSound: ambientSound.stopSound,
    }),
    [
      ambientSound.autoPlayOnFocus,
      ambientSound.isReady,
      ambientSound.playSelectedSound,
      ambientSound.stopSound,
    ]
  );

  return (
    <AmbientSoundTimerContext.Provider value={timerControls}>
      <AmbientSoundContext.Provider value={ambientSound}>
        {children}
      </AmbientSoundContext.Provider>
    </AmbientSoundTimerContext.Provider>
  );
}

export function useAmbientSoundContext(): AmbientSoundContextValue {
  const context = useContext(AmbientSoundContext);

  if (!context) {
    throw new Error(
      'useAmbientSoundContext must be used within AmbientSoundProvider'
    );
  }

  return context;
}

export function useAmbientSoundTimerContext(): AmbientSoundTimerContextValue {
  const context = useContext(AmbientSoundTimerContext);

  if (!context) {
    throw new Error(
      'useAmbientSoundTimerContext must be used within AmbientSoundProvider'
    );
  }

  return context;
}
