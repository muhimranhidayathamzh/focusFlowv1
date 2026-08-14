import { useCallback, useEffect, useMemo, useState } from 'react';
import { FocusSession, NewFocusSession } from '@/types/focusSession';

const STORAGE_KEY = 'focusflow-focus-sessions';
const SESSIONS_UPDATED_EVENT = 'focusflow-focus-sessions-updated';
export const MAX_FOCUS_SESSION_RECORDS = 2_000;
export const MAX_FOCUS_SESSION_STORAGE_CHARS = 1_000_000;

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isFocusSession(value: unknown): value is FocusSession {
  if (!value || typeof value !== 'object') return false;

  const session = value as Partial<FocusSession>;
  return (
    typeof session.id === 'string' &&
    typeof session.completedAt === 'number' &&
    typeof session.durationSeconds === 'number' &&
    (session.mode === 'focus' ||
      session.mode === 'shortBreak' ||
      session.mode === 'longBreak')
  );
}

function loadSessions(): FocusSession[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter(isFocusSession).slice(0, MAX_FOCUS_SESSION_RECORDS)
      : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: FocusSession[]) {
  if (typeof window === 'undefined') return false;
  try {
    const serialized = JSON.stringify(
      sessions.slice(0, MAX_FOCUS_SESSION_RECORDS)
    );
    if (serialized.length > MAX_FOCUS_SESSION_STORAGE_CHARS) return false;
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

function notifySessionsUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(SESSIONS_UPDATED_EVENT));
}

function isSameLocalDay(timestamp: number, date: Date) {
  const value = new Date(timestamp);
  return (
    value.getFullYear() === date.getFullYear() &&
    value.getMonth() === date.getMonth() &&
    value.getDate() === date.getDate()
  );
}

export function useFocusSessions() {
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reloadSessions = () => {
      setSessions(loadSessions());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        reloadSessions();
      }
    };

    window.addEventListener(SESSIONS_UPDATED_EVENT, reloadSessions);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(SESSIONS_UPDATED_EVENT, reloadSessions);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const addSession = useCallback((session: NewFocusSession) => {
    if (session.timerRunId) {
      const existing = loadSessions().find(
        (item) => item.timerRunId === session.timerRunId
      );
      if (existing) return existing;
    }

    const nextSession: FocusSession = {
      ...session,
      id: createId(),
      completedAt: session.completedAt ?? Date.now(),
    };

    const next = [nextSession, ...loadSessions()].slice(
      0,
      MAX_FOCUS_SESSION_RECORDS
    );
    if (!saveSessions(next)) return nextSession;
    setSessions(next);
    notifySessionsUpdated();

    return nextSession;
  }, []);

  const clearSessions = useCallback(() => {
    setSessions([]);
    saveSessions([]);
    notifySessionsUpdated();
  }, []);

  const getSessionsForDate = useCallback(
    (date: Date) =>
      sessions.filter((session) => isSameLocalDay(session.completedAt, date)),
    [sessions]
  );

  const todaySessions = useMemo(
    () => getSessionsForDate(new Date()),
    [getSessionsForDate]
  );

  return {
    sessions,
    isLoaded,
    addSession,
    clearSessions,
    getSessionsForDate,
    todaySessions,
  };
}
