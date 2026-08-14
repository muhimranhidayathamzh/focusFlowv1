import { useCallback, useMemo } from 'react';
import {
  BUILT_IN_LIGHT_PROFILE_ID,
  GUARD_PREFERENCES_STORAGE_KEY,
  GUARD_PREFERENCES_UPDATED_EVENT,
  GUARD_PROFILES_STORAGE_KEY,
  GUARD_PROFILES_UPDATED_EVENT,
  createCustomFocusGuardProfile,
  deleteCustomFocusGuardProfile,
  duplicateFocusGuardProfile,
  loadFocusGuardPreferences,
  loadFocusGuardProfiles,
  resetBuiltInLightProfile,
  updateCustomFocusGuardProfile,
} from '@/lib/focusGuardPersistence';
import {
  CreateFocusGuardProfileInput,
  UpdateFocusGuardProfileInput,
} from '@/types/focusGuard';
import { useGuardStorageSubscription } from './useGuardStorageSubscription';

const PROFILE_SOURCES = [
  {
    key: GUARD_PROFILES_STORAGE_KEY,
    eventName: GUARD_PROFILES_UPDATED_EVENT,
  },
  {
    key: GUARD_PREFERENCES_STORAGE_KEY,
    eventName: GUARD_PREFERENCES_UPDATED_EVENT,
  },
];

function loadProfileState() {
  return {
    profiles: loadFocusGuardProfiles(),
    preferences: loadFocusGuardPreferences(),
  };
}

export function useFocusGuardProfiles() {
  const { value, isLoaded } = useGuardStorageSubscription(
    loadProfileState,
    PROFILE_SOURCES
  );
  const selectedProfile = useMemo(
    () =>
      value.profiles.find(
        (profile) => profile.id === value.preferences.selectedProfileId
      ) ??
      value.profiles.find(
        (profile) => profile.id === BUILT_IN_LIGHT_PROFILE_ID
      )!,
    [value]
  );

  const createProfile = useCallback(
    (input: CreateFocusGuardProfileInput) =>
      createCustomFocusGuardProfile(input),
    []
  );
  const updateProfile = useCallback(
    (profileId: string, updates: UpdateFocusGuardProfileInput) =>
      updateCustomFocusGuardProfile(profileId, updates),
    []
  );
  const deleteProfile = useCallback(
    (profileId: string) => deleteCustomFocusGuardProfile(profileId),
    []
  );
  const duplicateProfile = useCallback(
    (profileId: string) => duplicateFocusGuardProfile(profileId),
    []
  );
  const resetLightProfile = useCallback(() => resetBuiltInLightProfile(), []);

  return {
    profiles: value.profiles,
    selectedProfile,
    defaultProfileId: BUILT_IN_LIGHT_PROFILE_ID,
    isLoaded,
    createProfile,
    updateProfile,
    deleteProfile,
    duplicateProfile,
    resetLightProfile,
  };
}
