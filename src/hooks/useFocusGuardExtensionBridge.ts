import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FOCUS_GUARD_EXTENSION_CHANNEL,
  FOCUS_GUARD_EXTENSION_HEARTBEAT_MS,
  FOCUS_GUARD_EXTENSION_IDLE_EVENT_DRAIN_MS,
  FOCUS_GUARD_EXTENSION_MESSAGES,
  FOCUS_GUARD_EXTENSION_PROTOCOL_VERSION,
  FocusGuardExtensionEnvelope,
  FocusGuardExtensionRequestType,
  FocusGuardExtensionResponseType,
  createFocusGuardExtensionEnvelope,
  createSanitizedFocusGuardProfileConfig,
  createSanitizedFocusGuardSnapshot,
  normalizeFocusGuardExtensionResponse,
} from '@/lib/focusGuardExtensionBridge';
import { addFocusInterruption } from '@/lib/focusGuardPersistence';
import {
  FOCUS_GUARD_EXTENSION_CONNECTION_CHECK_MS,
  FOCUS_GUARD_EXTENSION_MAX_PENDING_REQUESTS,
  FOCUS_GUARD_EXTENSION_REQUEST_TIMEOUT_MS,
  FocusGuardExtensionLivenessConnectionState,
  createFocusGuardExtensionLivenessState,
  disposeFocusGuardPendingRequests,
  recordFocusGuardExtensionFailure,
  recordFocusGuardExtensionIncompatible,
  recordFocusGuardExtensionSuccess,
  settleFocusGuardPendingRequest,
} from '@/lib/focusGuardExtensionLiveness';
import { FocusGuardProfile, FocusGuardSession } from '@/types/focusGuard';

export type FocusGuardExtensionConnectionState =
  FocusGuardExtensionLivenessConnectionState;

export type FocusGuardBrowserProtectionState =
  | 'inactive'
  | 'light'
  | 'permission-required'
  | 'ready'
  | 'protection-active'
  | 'protection-paused'
  | 'bypass-active'
  | 'expired'
  | 'error';

interface Options {
  isReady: boolean;
  guardEnabled: boolean;
  activeSession: FocusGuardSession | null;
  selectedProfile: FocusGuardProfile;
}

interface PendingRequest {
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: (
    response: FocusGuardExtensionEnvelope<FocusGuardExtensionResponseType>
  ) => void;
  reject: (error: Error) => void;
}

function createRequestId(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`.slice(0, 128);
}

export function useFocusGuardExtensionBridge(options: Options) {
  const shouldDrainEventsFrequently = Boolean(
    options.activeSession &&
      (options.activeSession.status === 'active' ||
        options.activeSession.status === 'paused')
  );
  const [connectionState, setConnectionState] =
    useState<FocusGuardExtensionConnectionState>('connecting');
  const [extensionVersion, setExtensionVersion] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [browserProtectionState, setBrowserProtectionState] =
    useState<FocusGuardBrowserProtectionState>('inactive');
  const [readySequence, setReadySequence] = useState(0);
  const optionsRef = useRef(options);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const livenessRef = useRef(createFocusGuardExtensionLivenessState());
  const isMountedRef = useRef(true);
  const seenResponsesRef = useRef<string[]>([]);
  const pingInFlightRef = useRef(false);
  const eventDrainInFlightRef = useRef(false);
  const lastSyncedSessionIdRef = useRef<string | null>(null);
  const lastAcknowledgedAtRef = useRef<number | null>(null);
  optionsRef.current = options;

  const sendRequest = useCallback(
    (
      type: FocusGuardExtensionRequestType,
      payload: Record<string, unknown>
    ) => {
      if (typeof window === 'undefined') {
        return Promise.reject(new Error('Bridge is unavailable during SSR.'));
      }
      if (
        pendingRef.current.size >=
        FOCUS_GUARD_EXTENSION_MAX_PENDING_REQUESTS
      ) {
        return Promise.reject(
          new Error('Extension bridge pending request limit reached.')
        );
      }
      const requestId = createRequestId('page');
      const envelope = createFocusGuardExtensionEnvelope(
        type,
        requestId,
        payload
      );
      return new Promise<
        FocusGuardExtensionEnvelope<FocusGuardExtensionResponseType>
      >((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          pendingRef.current.delete(requestId);
          reject(new Error('Extension bridge request timed out.'));
        }, FOCUS_GUARD_EXTENSION_REQUEST_TIMEOUT_MS);
        pendingRef.current.set(requestId, { timeoutId, resolve, reject });
        window.postMessage(envelope, window.location.origin);
      });
    },
    []
  );

  useEffect(() => {
    isMountedRef.current = true;

    function handleMessage(event: MessageEvent) {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !event.data ||
        event.data.channel !== FOCUS_GUARD_EXTENSION_CHANNEL
      ) {
        return;
      }

      if (
        event.data.protocolVersion !==
        FOCUS_GUARD_EXTENSION_PROTOCOL_VERSION
      ) {
        livenessRef.current = recordFocusGuardExtensionIncompatible(
          livenessRef.current
        );
        if (isMountedRef.current) setConnectionState('incompatible');
        return;
      }

      const response = normalizeFocusGuardExtensionResponse(event.data);
      if (!response) return;

      if (seenResponsesRef.current.includes(response.requestId)) return;
      seenResponsesRef.current.push(response.requestId);
      if (seenResponsesRef.current.length > 200) {
        seenResponsesRef.current.splice(0, 100);
      }

      if (response.type === FOCUS_GUARD_EXTENSION_MESSAGES.ready) {
        const successfulAt = Date.now();
        livenessRef.current = recordFocusGuardExtensionSuccess(
          livenessRef.current,
          successfulAt
        );
        lastAcknowledgedAtRef.current = successfulAt;
        if (isMountedRef.current) {
          setExtensionVersion(response.payload.extensionVersion as string);
          setConnectionState('connected');
          setLastError(null);
          setReadySequence((current) => current + 1);
        }
        return;
      }

      settleFocusGuardPendingRequest(
        pendingRef.current,
        response.requestId,
        response
      );
    }

    window.addEventListener('message', handleMessage);
    const pendingRequests = pendingRef.current;
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('message', handleMessage);
      disposeFocusGuardPendingRequests(pendingRequests);
    };
  }, []);

  const recordSuccessfulResponse = useCallback(() => {
    const successfulAt = Date.now();
    livenessRef.current = recordFocusGuardExtensionSuccess(
      livenessRef.current,
      successfulAt
    );
    lastAcknowledgedAtRef.current = successfulAt;
    if (!isMountedRef.current) return;
    setConnectionState('connected');
    setLastError(null);
  }, []);

  const recordPingFailure = useCallback(() => {
    livenessRef.current = recordFocusGuardExtensionFailure(
      livenessRef.current
    );
    if (
      isMountedRef.current &&
      livenessRef.current.connectionState === 'disconnected'
    ) {
      setConnectionState('disconnected');
    }
  }, []);

  const recordIncompatibleResponse = useCallback(() => {
    livenessRef.current = recordFocusGuardExtensionIncompatible(
      livenessRef.current
    );
    if (isMountedRef.current) setConnectionState('incompatible');
  }, []);

  const acceptCompatibleResponse = useCallback(
    (response: FocusGuardExtensionEnvelope<FocusGuardExtensionResponseType>) => {
      if (response.type === FOCUS_GUARD_EXTENSION_MESSAGES.error) {
        const code = response.payload.code as string;
        if (isMountedRef.current) {
          setLastError(response.payload.message as string);
        }
        if (code === 'UNSUPPORTED_PROTOCOL') {
          recordIncompatibleResponse();
        }
        return false;
      }
      recordSuccessfulResponse();
      if (!isMountedRef.current) return true;
      setExtensionVersion(response.payload.extensionVersion as string);
      const nextBrowserState = response.payload.browserGuardState;
      if (
        typeof nextBrowserState === 'string' &&
        [
          'inactive',
          'light',
          'permission-required',
          'ready',
          'protection-active',
          'protection-paused',
          'bypass-active',
          'expired',
          'error',
        ].includes(nextBrowserState)
      ) {
        setBrowserProtectionState(
          nextBrowserState as FocusGuardBrowserProtectionState
        );
      }
      return true;
    },
    [recordIncompatibleResponse, recordSuccessfulResponse]
  );

  const ping = useCallback(async () => {
    if (pingInFlightRef.current) return;
    pingInFlightRef.current = true;
    try {
      const response = await sendRequest(
        FOCUS_GUARD_EXTENSION_MESSAGES.ping,
        { pageVersion: '1.0.0' }
      );
      if (!acceptCompatibleResponse(response)) {
        recordPingFailure();
      }
    } catch {
      recordPingFailure();
    } finally {
      pingInFlightRef.current = false;
    }
  }, [acceptCompatibleResponse, recordPingFailure, sendRequest]);

  const syncProfileConfig = useCallback(async () => {
    const config = createSanitizedFocusGuardProfileConfig(
      optionsRef.current.selectedProfile
    );
    if (!config) return;
    try {
      const response = await sendRequest(
        FOCUS_GUARD_EXTENSION_MESSAGES.configSync,
        { config }
      );
      acceptCompatibleResponse(response);
    } catch {
      // Retry after reconnect; config sync never controls the timer.
    }
  }, [acceptCompatibleResponse, sendRequest]);

  useEffect(() => {
    if (connectionState !== 'connected' || !options.isReady) return;
    void syncProfileConfig();
  }, [
    connectionState,
    options.isReady,
    options.selectedProfile,
    syncProfileConfig,
  ]);

  useEffect(() => {
    void ping();
    const intervalId = setInterval(
      () => void ping(),
      FOCUS_GUARD_EXTENSION_CONNECTION_CHECK_MS
    );
    return () => clearInterval(intervalId);
  }, [ping]);

  useEffect(() => {
    if (readySequence > 0) void ping();
  }, [ping, readySequence]);

  const syncCurrentState = useCallback(async () => {
    const current = optionsRef.current;
    if (!current.isReady) return;
    const snapshot = current.guardEnabled
      ? createSanitizedFocusGuardSnapshot(
          current.activeSession,
          Date.now(),
          window.location.origin
        )
      : null;

    try {
      if (snapshot) {
        const response = await sendRequest(
          FOCUS_GUARD_EXTENSION_MESSAGES.sessionSync,
          { snapshot }
        );
        if (acceptCompatibleResponse(response)) {
          lastSyncedSessionIdRef.current = snapshot.guardSessionId;
        }
        return;
      }

      const response = await sendRequest(
        FOCUS_GUARD_EXTENSION_MESSAGES.sessionClear,
        lastSyncedSessionIdRef.current
          ? { guardSessionId: lastSyncedSessionIdRef.current }
          : {}
      );
      if (acceptCompatibleResponse(response)) {
        lastSyncedSessionIdRef.current = null;
      }
    } catch {
      // The dedicated non-overlapping ping owns liveness. A transient sync
      // timeout must not downgrade an otherwise established connection.
    }
  }, [acceptCompatibleResponse, sendRequest]);

  useEffect(() => {
    if (connectionState !== 'connected' || !options.isReady) return;
    void syncCurrentState();
  }, [
    connectionState,
    options.activeSession,
    options.guardEnabled,
    options.isReady,
    syncCurrentState,
  ]);

  useEffect(() => {
    if (connectionState !== 'connected' || !options.isReady) return;
    const intervalId = setInterval(() => {
      const current = optionsRef.current;
      if (
        current.guardEnabled &&
        createSanitizedFocusGuardSnapshot(
          current.activeSession,
          Date.now(),
          window.location.origin
        )
      ) {
        void syncCurrentState();
      }
    }, FOCUS_GUARD_EXTENSION_HEARTBEAT_MS);
    return () => clearInterval(intervalId);
  }, [connectionState, options.isReady, syncCurrentState]);

  const drainEvents = useCallback(async () => {
    if (eventDrainInFlightRef.current) return;
    eventDrainInFlightRef.current = true;
    try {
      const response = await sendRequest(
        FOCUS_GUARD_EXTENSION_MESSAGES.eventDrain,
        {}
      );
      if (!acceptCompatibleResponse(response)) return;
      const events = Array.isArray(response.payload.events)
        ? response.payload.events
        : [];
      const acknowledgedIds: string[] = [];
      for (const event of events) {
        if (!event || typeof event !== 'object' || Array.isArray(event)) continue;
        const candidate = event as Record<string, unknown>;
        if (
          typeof candidate.id !== 'string' ||
          typeof candidate.guardSessionId !== 'string' ||
          typeof candidate.occurredAt !== 'number' ||
          (candidate.type !== 'blocked-site' &&
            candidate.type !== 'emergency-bypass')
        ) {
          continue;
        }
        const stored = addFocusInterruption({
          id: candidate.id,
          guardSessionId: candidate.guardSessionId,
          occurredAt: candidate.occurredAt,
          type: candidate.type,
          source: 'browser-extension',
          resolution:
            candidate.type === 'emergency-bypass' ? 'bypassed' : 'unknown',
          note:
            typeof candidate.note === 'string' ? candidate.note : undefined,
          configuredRuleId:
            typeof candidate.configuredRuleId === 'string'
              ? candidate.configuredRuleId
              : undefined,
          configuredRuleLabel:
            typeof candidate.configuredRuleLabel === 'string'
              ? candidate.configuredRuleLabel
              : undefined,
          configuredRuleDomain:
            typeof candidate.configuredRuleDomain === 'string'
              ? candidate.configuredRuleDomain
              : undefined,
          bypassExpiresAt:
            typeof candidate.bypassExpiresAt === 'number'
              ? candidate.bypassExpiresAt
              : undefined,
        });
        if (stored) acknowledgedIds.push(candidate.id);
      }
      if (acknowledgedIds.length > 0) {
        const ack = await sendRequest(
          FOCUS_GUARD_EXTENSION_MESSAGES.eventAckRequest,
          { eventIds: acknowledgedIds }
        );
        acceptCompatibleResponse(ack);
      }
    } catch {
      // Event delivery retries on the next heartbeat; the timer is unaffected.
    } finally {
      eventDrainInFlightRef.current = false;
    }
  }, [acceptCompatibleResponse, sendRequest]);

  useEffect(() => {
    if (connectionState !== 'connected' || !options.isReady) return;
    void drainEvents();
    const drainIntervalMs = shouldDrainEventsFrequently
      ? FOCUS_GUARD_EXTENSION_HEARTBEAT_MS
      : FOCUS_GUARD_EXTENSION_IDLE_EVENT_DRAIN_MS;
    const intervalId = setInterval(
      () => void drainEvents(),
      drainIntervalMs
    );
    return () => clearInterval(intervalId);
  }, [
    connectionState,
    drainEvents,
    options.isReady,
    shouldDrainEventsFrequently,
  ]);

  return {
    connectionState,
    extensionVersion,
    lastAcknowledgedAt: lastAcknowledgedAtRef.current,
    lastError,
    browserProtectionState,
  };
}
