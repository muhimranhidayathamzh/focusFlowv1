export type FocusGuardExtensionLivenessConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'incompatible';

export interface FocusGuardExtensionLivenessState {
  connectionState: FocusGuardExtensionLivenessConnectionState;
  consecutiveFailures: number;
  lastSuccessfulResponseAt: number | null;
}

export interface FocusGuardPendingRequest<TResponse> {
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: (response: TResponse) => void;
  reject: (error: Error) => void;
}

export const FOCUS_GUARD_EXTENSION_REQUEST_TIMEOUT_MS = 6_000;
export const FOCUS_GUARD_EXTENSION_CONNECTION_CHECK_MS = 12_000;
export const FOCUS_GUARD_EXTENSION_FAILURE_THRESHOLD = 3;
export const FOCUS_GUARD_EXTENSION_MAX_PENDING_REQUESTS = 8;

export function createFocusGuardExtensionLivenessState(): FocusGuardExtensionLivenessState {
  return {
    connectionState: 'connecting',
    consecutiveFailures: 0,
    lastSuccessfulResponseAt: null,
  };
}

export function recordFocusGuardExtensionSuccess(
  current: FocusGuardExtensionLivenessState,
  now: number
): FocusGuardExtensionLivenessState {
  return {
    connectionState: 'connected',
    consecutiveFailures: 0,
    lastSuccessfulResponseAt: now,
  };
}

export function recordFocusGuardExtensionFailure(
  current: FocusGuardExtensionLivenessState
): FocusGuardExtensionLivenessState {
  if (current.connectionState === 'incompatible') return current;

  const consecutiveFailures = Math.min(
    FOCUS_GUARD_EXTENSION_FAILURE_THRESHOLD,
    current.consecutiveFailures + 1
  );
  return {
    ...current,
    consecutiveFailures,
    connectionState:
      consecutiveFailures >= FOCUS_GUARD_EXTENSION_FAILURE_THRESHOLD
        ? 'disconnected'
        : current.connectionState,
  };
}

export function recordFocusGuardExtensionIncompatible(
  current: FocusGuardExtensionLivenessState
): FocusGuardExtensionLivenessState {
  return {
    ...current,
    connectionState: 'incompatible',
  };
}

export function settleFocusGuardPendingRequest<TResponse>(
  pendingRequests: Map<string, FocusGuardPendingRequest<TResponse>>,
  requestId: string,
  response: TResponse
) {
  const pending = pendingRequests.get(requestId);
  if (!pending) return false;
  clearTimeout(pending.timeoutId);
  pendingRequests.delete(requestId);
  pending.resolve(response);
  return true;
}

export function disposeFocusGuardPendingRequests<TResponse>(
  pendingRequests: Map<string, FocusGuardPendingRequest<TResponse>>,
  error = new Error('Extension bridge unmounted.')
) {
  pendingRequests.forEach((pending) => {
    clearTimeout(pending.timeoutId);
    pending.reject(error);
  });
  pendingRequests.clear();
}
