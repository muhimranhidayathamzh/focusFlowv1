import { useCallback } from 'react';
import {
  BUILT_IN_LIGHT_PROFILE_ID,
  GUARD_PREFERENCES_STORAGE_KEY,
  GUARD_PREFERENCES_UPDATED_EVENT,
  GUARD_PROFILES_STORAGE_KEY,
  GUARD_PROFILES_UPDATED_EVENT,
  loadFocusGuardPreferences,
  loadFocusGuardProfiles,
  saveFocusGuardPreferences,
} from '@/lib/focusGuardPersistence';
import { useGuardStorageSubscription } from './useGuardStorageSubscription';

const PREFERENCE_SOURCES = [
  {
    key: GUARD_PREFERENCES_STORAGE_KEY,
    eventName: GUARD_PREFERENCES_UPDATED_EVENT,
  },
  {
    key: GUARD_PROFILES_STORAGE_KEY,
    eventName: GUARD_PROFILES_UPDATED_EVENT,
  },
];

export function useFocusGuardPreferences() {
  const { value: preferences, isLoaded } = useGuardStorageSubscription(
    loadFocusGuardPreferences,
    PREFERENCE_SOURCES
  );

  const setGuardEnabled = useCallback((guardEnabled: boolean) => {
    const current = loadFocusGuardPreferences();
    return saveFocusGuardPreferences({ ...current, guardEnabled });
  }, []);

  const selectProfile = useCallback((profileId: string) => {
    const profiles = loadFocusGuardProfiles();
    const selectedProfileId = profiles.some(
      (profile) => profile.id === profileId
    )
      ? profileId
      : BUILT_IN_LIGHT_PROFILE_ID;
    return saveFocusGuardPreferences({
      ...loadFocusGuardPreferences(),
      selectedProfileId,
    });
  }, []);

  return {
    preferences,
    isLoaded,
    setGuardEnabled,
    selectProfile,
  };
}
