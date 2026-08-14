import type { DistractionItem } from '@/types/distraction';
import type {
  FocusGuardSession,
  FocusInterruption,
  GuardReviewMutationResult,
  GuardTargetOutcome,
  SubmitGuardReviewInput,
} from '@/types/focusGuard';
import type { FocusTarget, Task } from '@/types/task';

export const GUARD_REVIEW_VERSION = 1;

const REVIEW_FIELDS = [
  'reviewStatus',
  'reviewedAt',
  'focusRating',
  'targetOutcome',
  'reviewVersion',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isRating(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
}

function isTargetOutcome(value: unknown): value is GuardTargetOutcome {
  return value === 'completed' || value === 'continue';
}

export type NormalizedGuardReviewMetadata =
  | { kind: 'absent' }
  | { kind: 'invalid' }
  | {
      kind: 'valid';
      value: Pick<FocusGuardSession, 'reviewStatus' | 'reviewVersion'> &
        Partial<
          Pick<
            FocusGuardSession,
            'reviewedAt' | 'focusRating' | 'targetOutcome'
          >
        >;
    };

export function normalizeGuardReviewMetadata(
  value: unknown
): NormalizedGuardReviewMetadata {
  if (!isRecord(value)) return { kind: 'invalid' };
  const hasReviewField = REVIEW_FIELDS.some((field) => field in value);
  if (!hasReviewField) return { kind: 'absent' };

  const version = value.reviewVersion;
  if (
    !Number.isInteger(version) ||
    Number(version) < 1 ||
    Number(version) > GUARD_REVIEW_VERSION
  ) {
    return { kind: 'invalid' };
  }

  if (value.reviewStatus === 'pending') {
    if (
      value.reviewedAt !== undefined ||
      value.focusRating !== undefined ||
      value.targetOutcome !== undefined
    ) {
      return { kind: 'invalid' };
    }
    return {
      kind: 'valid',
      value: {
        reviewStatus: 'pending',
        reviewVersion: Number(version),
      },
    };
  }

  if (value.reviewStatus === 'skipped') {
    if (
      !isFiniteTimestamp(value.reviewedAt) ||
      value.focusRating !== undefined ||
      value.targetOutcome !== undefined
    ) {
      return { kind: 'invalid' };
    }
    return {
      kind: 'valid',
      value: {
        reviewStatus: 'skipped',
        reviewedAt: value.reviewedAt,
        reviewVersion: Number(version),
      },
    };
  }

  if (
    value.reviewStatus !== 'completed' ||
    !isFiniteTimestamp(value.reviewedAt) ||
    !isTargetOutcome(value.targetOutcome) ||
    (value.focusRating !== undefined && !isRating(value.focusRating))
  ) {
    return { kind: 'invalid' };
  }

  return {
    kind: 'valid',
    value: {
      reviewStatus: 'completed',
      reviewedAt: value.reviewedAt,
      focusRating:
        value.focusRating === undefined ? undefined : Number(value.focusRating),
      targetOutcome: value.targetOutcome,
      reviewVersion: Number(version),
    },
  };
}

export function createPendingGuardReview() {
  return {
    reviewStatus: 'pending' as const,
    reviewVersion: GUARD_REVIEW_VERSION,
  };
}

function normalizeSubmission(input: SubmitGuardReviewInput) {
  const reviewedAt = input.reviewedAt ?? Date.now();
  if (
    !isFiniteTimestamp(reviewedAt) ||
    !isTargetOutcome(input.targetOutcome) ||
    (input.focusRating !== undefined && !isRating(input.focusRating))
  ) {
    return null;
  }
  return {
    reviewedAt,
    targetOutcome: input.targetOutcome,
    focusRating: input.focusRating,
  };
}

export function applyGuardReviewSubmission(
  session: FocusGuardSession | undefined,
  input: SubmitGuardReviewInput
): GuardReviewMutationResult {
  if (!session || session.status !== 'completed') {
    return { ok: false, reason: 'session-not-found' };
  }
  if (session.reviewStatus === 'completed') {
    return { ok: true, session, alreadyApplied: true };
  }
  if (session.reviewStatus !== 'pending') {
    return { ok: false, reason: 'review-not-pending' };
  }
  const normalized = normalizeSubmission(input);
  if (!normalized) return { ok: false, reason: 'invalid-input' };

  return {
    ok: true,
    alreadyApplied: false,
    session: {
      ...session,
      reviewStatus: 'completed',
      reviewVersion: GUARD_REVIEW_VERSION,
      reviewedAt: normalized.reviewedAt,
      focusRating: normalized.focusRating,
      targetOutcome: normalized.targetOutcome,
    },
  };
}

export function applyGuardReviewSkip(
  session: FocusGuardSession | undefined,
  reviewedAt = Date.now()
): GuardReviewMutationResult {
  if (!session || session.status !== 'completed') {
    return { ok: false, reason: 'session-not-found' };
  }
  if (session.reviewStatus === 'skipped') {
    return { ok: true, session, alreadyApplied: true };
  }
  if (session.reviewStatus !== 'pending') {
    return { ok: false, reason: 'review-not-pending' };
  }
  if (!isFiniteTimestamp(reviewedAt)) {
    return { ok: false, reason: 'invalid-input' };
  }
  return {
    ok: true,
    alreadyApplied: false,
    session: {
      ...session,
      reviewStatus: 'skipped',
      reviewVersion: GUARD_REVIEW_VERSION,
      reviewedAt,
      focusRating: undefined,
      targetOutcome: undefined,
    },
  };
}

export interface SessionAttentionSummary {
  total: number;
  returned: number;
  intentional: number;
  captured: number;
  unresolved: number;
  blockedSite: number;
  emergencyBypass: number;
}

export function calculateSessionAttentionSummary(
  interruptions: FocusInterruption[]
): SessionAttentionSummary {
  return interruptions.reduce<SessionAttentionSummary>(
    (summary, item) => {
      summary.total += 1;
      if (item.resolution === 'returned') summary.returned += 1;
      if (item.resolution === 'intentional') summary.intentional += 1;
      if (item.resolution === 'captured') summary.captured += 1;
      if (item.type === 'blocked-site') summary.blockedSite += 1;
      if (item.type === 'emergency-bypass') summary.emergencyBypass += 1;
      if (
        (item.type === 'page-hidden' || item.type === 'window-blur') &&
        (!item.resolution || item.resolution === 'unknown')
      ) {
        summary.unresolved += 1;
      }
      return summary;
    },
    {
      total: 0,
      returned: 0,
      intentional: 0,
      captured: 0,
      unresolved: 0,
      blockedSite: 0,
      emergencyBypass: 0,
    }
  );
}

export function createDescriptiveReviewSummary(
  attention: SessionAttentionSummary,
  distractionCount: number
) {
  const lines: string[] = [];
  if (attention.total === 0) {
    lines.push('Sesi berjalan tanpa perpindahan halaman yang tercatat.');
  } else if (attention.returned > 0) {
    lines.push(
      `Kamu kembali ke target setelah ${attention.returned} perpindahan perhatian.`
    );
  }
  if (
    attention.total > 0 &&
    attention.intentional > attention.total / 2
  ) {
    lines.push('Sebagian besar perpindahan ditandai sebagai disengaja.');
  }
  if (distractionCount > 0) {
    lines.push(
      `Kamu menyimpan ${distractionCount} hal untuk dikerjakan nanti.`
    );
  }
  if (attention.unresolved > 0) {
    lines.push(
      `Ada ${attention.unresolved} perpindahan yang belum diklasifikasikan.`
    );
  }
  if (attention.blockedSite > 0) {
    lines.push(`${attention.blockedSite} percobaan membuka situs diblokir.`);
  }
  if (attention.emergencyBypass > 0) {
    lines.push(`${attention.emergencyBypass} emergency bypass digunakan.`);
  }
  return lines;
}

export type FocusTargetState =
  | 'available'
  | 'completed'
  | 'missing'
  | 'none';

export function getFocusTargetState(
  tasks: Task[],
  target?: FocusTarget
): FocusTargetState {
  if (!target) return 'none';
  const task = tasks.find((item) => item.id === target.taskId);
  if (!task) return 'missing';
  if (!target.stepId) return task.completed ? 'completed' : 'available';
  const step = (task.steps ?? []).find((item) => item.id === target.stepId);
  if (!step) return 'missing';
  return step.completed ? 'completed' : 'available';
}

export interface FocusGuardInsights {
  protectedSessionsCompleted: number;
  meaningfulExcursions: number;
  returnedCount: number;
  intentionalCount: number;
  blockedSiteCount: number;
  emergencyBypassCount: number;
  capturedDistractionCount: number;
  averageRating: number | null;
  ratedSessionCount: number;
  reviewedSessionCount: number;
  reviewedPercent: number;
}

function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function calculateFocusGuardInsights(
  history: FocusGuardSession[],
  interruptions: FocusInterruption[],
  distractions: DistractionItem[],
  now = Date.now()
): FocusGuardInsights {
  const windowStartDate = new Date(startOfLocalDay(now));
  windowStartDate.setDate(windowStartDate.getDate() - 6);
  const windowStart = windowStartDate.getTime();
  const completed = history.filter(
    (session) =>
      session.status === 'completed' &&
      session.endedAt !== undefined &&
      session.endedAt >= windowStart &&
      session.endedAt <= now
  );
  const sessionIds = new Set(completed.map((session) => session.id));
  const relatedInterruptions = interruptions.filter((item) =>
    sessionIds.has(item.guardSessionId)
  );
  const ratings = completed
    .map((session) => session.focusRating)
    .filter((rating): rating is number => isRating(rating));
  const reviewedSessionCount = completed.filter(
    (session) => session.reviewStatus === 'completed'
  ).length;

  return {
    protectedSessionsCompleted: completed.length,
    meaningfulExcursions: relatedInterruptions.length,
    returnedCount: relatedInterruptions.filter(
      (item) => item.resolution === 'returned'
    ).length,
    intentionalCount: relatedInterruptions.filter(
      (item) => item.resolution === 'intentional'
    ).length,
    blockedSiteCount: relatedInterruptions.filter(
      (item) => item.type === 'blocked-site'
    ).length,
    emergencyBypassCount: relatedInterruptions.filter(
      (item) => item.type === 'emergency-bypass'
    ).length,
    capturedDistractionCount: distractions.filter(
      (item) => item.guardSessionId && sessionIds.has(item.guardSessionId)
    ).length,
    averageRating:
      ratings.length > 0
        ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length
        : null,
    ratedSessionCount: ratings.length,
    reviewedSessionCount,
    reviewedPercent:
      completed.length > 0
        ? Math.round((reviewedSessionCount / completed.length) * 100)
        : 0,
  };
}
