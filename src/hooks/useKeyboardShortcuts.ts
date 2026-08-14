import { useEffect, useCallback } from 'react';

interface KeyboardShortcutActions {
  toggleTimer: () => void;
  resetTimer: () => void;
  switchToFocus: () => void;
  switchToShortBreak: () => void;
  switchToLongBreak: () => void;
  toggleSettings?: () => void;
  openDistractionCapture?: () => boolean;
}

/**
 * Registers global keyboard shortcuts for the Pomodoro timer.
 * Automatically ignores keypresses when the user is typing in an input/textarea.
 */
export function useKeyboardShortcuts(
  actions: KeyboardShortcutActions,
  enabled = true
) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't fire shortcuts when user is typing in an input field
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (
        e.code === 'KeyD' &&
        e.ctrlKey &&
        e.shiftKey &&
        !e.altKey &&
        actions.openDistractionCapture?.()
      ) {
        e.preventDefault();
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault(); // Prevent page scroll
          actions.toggleTimer();
          break;
        case 'KeyR':
          if (!e.ctrlKey && !e.metaKey) {
            actions.resetTimer();
          }
          break;
        case 'Digit1':
          if (!e.ctrlKey && !e.metaKey) {
            actions.switchToFocus();
          }
          break;
        case 'Digit2':
          if (!e.ctrlKey && !e.metaKey) {
            actions.switchToShortBreak();
          }
          break;
        case 'Digit3':
          if (!e.ctrlKey && !e.metaKey) {
            actions.switchToLongBreak();
          }
          break;
        case 'KeyS':
          if (!e.ctrlKey && !e.metaKey) {
            actions.toggleSettings?.();
          }
          break;
      }
    },
    [actions]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);
}
