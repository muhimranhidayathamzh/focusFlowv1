export const ATTENTION_OWNER_STORAGE_KEY = 'focusflow-attention-owner-v1';
export const ATTENTION_OWNER_LEASE_MS = 12_000;

interface AttentionOwnerLease {
  version: 1;
  ownerId: string;
  guardSessionId: string;
  expiresAt: number;
}

function isValidLease(value: unknown): value is AttentionOwnerLease {
  if (!value || typeof value !== 'object') return false;
  const lease = value as Partial<AttentionOwnerLease>;
  return (
    lease.version === 1 &&
    typeof lease.ownerId === 'string' &&
    lease.ownerId.length > 0 &&
    typeof lease.guardSessionId === 'string' &&
    lease.guardSessionId.length > 0 &&
    typeof lease.expiresAt === 'number' &&
    Number.isFinite(lease.expiresAt) &&
    lease.expiresAt >= 0
  );
}

function loadAttentionOwnerLease(): AttentionOwnerLease | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ATTENTION_OWNER_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidLease(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function claimAttentionOwnership(
  ownerId: string,
  guardSessionId: string,
  now = Date.now()
) {
  if (typeof window === 'undefined' || !ownerId || !guardSessionId) return false;

  try {
    const current = loadAttentionOwnerLease();
    if (
      current &&
      current.expiresAt > now &&
      (current.ownerId !== ownerId ||
        current.guardSessionId !== guardSessionId)
    ) {
      return false;
    }

    const next: AttentionOwnerLease = {
      version: 1,
      ownerId,
      guardSessionId,
      expiresAt: now + ATTENTION_OWNER_LEASE_MS,
    };
    localStorage.setItem(ATTENTION_OWNER_STORAGE_KEY, JSON.stringify(next));
    const verified = loadAttentionOwnerLease();
    return (
      verified?.ownerId === ownerId &&
      verified.guardSessionId === guardSessionId
    );
  } catch {
    return false;
  }
}

export function releaseAttentionOwnership(
  ownerId: string,
  guardSessionId: string
) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadAttentionOwnerLease();
    if (
      current?.ownerId === ownerId &&
      current.guardSessionId === guardSessionId
    ) {
      localStorage.removeItem(ATTENTION_OWNER_STORAGE_KEY);
    }
  } catch {
    // The fallback lease is best effort; Web Locks remains the strong path.
  }
}
