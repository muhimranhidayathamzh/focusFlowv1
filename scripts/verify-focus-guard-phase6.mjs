import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourceUrl = new URL('../src/lib/focusGuardReview.ts', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const review = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
);

const baseSession = {
  id: 'guard-1',
  timerRunId: 'run-1',
  focusSessionId: 'focus-1',
  profileId: 'profile-1',
  profileSnapshot: {
    profileId: 'profile-1',
    name: 'Light Protection',
    protectionLevel: 'light',
    websiteRules: [],
    applicationRules: [],
    emergencyBypassAllowed: true,
    bypassDelaySeconds: 10,
    bypassDurationMinutes: 5,
    requireBypassReason: false,
  },
  protectionLevel: 'light',
  status: 'completed',
  durationSeconds: 1500,
  startedAt: 1_000,
  expectedEndAt: 1_501_000,
  endedAt: 1_501_000,
  endReason: 'completed',
};

assert.deepEqual(review.normalizeGuardReviewMetadata(baseSession), {
  kind: 'absent',
});
assert.equal(
  review.normalizeGuardReviewMetadata({
    ...baseSession,
    reviewStatus: 'completed',
    reviewVersion: 1,
    reviewedAt: 1_600_000,
    targetOutcome: 'continue',
    focusRating: 0,
  }).kind,
  'invalid'
);

const pending = { ...baseSession, ...review.createPendingGuardReview() };
assert.equal(review.normalizeGuardReviewMetadata(pending).kind, 'valid');

const completed = review.applyGuardReviewSubmission(pending, {
  focusRating: 4,
  targetOutcome: 'completed',
  reviewedAt: 1_600_000,
});
assert.equal(completed.ok, true);
assert.equal(completed.session.reviewStatus, 'completed');
assert.equal(completed.session.focusRating, 4);
assert.equal(completed.session.targetOutcome, 'completed');

const repeatedSubmit = review.applyGuardReviewSubmission(completed.session, {
  focusRating: 2,
  targetOutcome: 'continue',
  reviewedAt: 1_700_000,
});
assert.equal(repeatedSubmit.ok, true);
assert.equal(repeatedSubmit.alreadyApplied, true);
assert.equal(repeatedSubmit.session.focusRating, 4);

const skipped = review.applyGuardReviewSkip(pending, 1_600_000);
assert.equal(skipped.ok, true);
assert.equal(skipped.session.reviewStatus, 'skipped');
const repeatedSkip = review.applyGuardReviewSkip(skipped.session, 1_700_000);
assert.equal(repeatedSkip.ok, true);
assert.equal(repeatedSkip.alreadyApplied, true);

const invalidRating = review.applyGuardReviewSubmission(pending, {
  focusRating: 6,
  targetOutcome: 'continue',
  reviewedAt: 1_600_000,
});
assert.deepEqual(invalidRating, { ok: false, reason: 'invalid-input' });

const now = new Date(2026, 6, 13, 12).getTime();
const recentEndedAt = now - 60_000;
const history = [
  {
    ...completed.session,
    endedAt: recentEndedAt,
    reviewedAt: recentEndedAt,
  },
  {
    ...skipped.session,
    id: 'guard-2',
    timerRunId: 'run-2',
    focusSessionId: 'focus-2',
    endedAt: recentEndedAt - 60_000,
    reviewedAt: recentEndedAt,
    focusRating: 0,
  },
  {
    ...baseSession,
    id: 'guard-stopped',
    status: 'stopped',
    endReason: 'stopped',
    endedAt: recentEndedAt,
  },
  {
    ...completed.session,
    id: 'guard-old',
    endedAt: now - 8 * 24 * 60 * 60 * 1000,
  },
];
const interruptions = [
  { id: 'i1', guardSessionId: 'guard-1', occurredAt: now, type: 'page-hidden', resolution: 'returned' },
  { id: 'i2', guardSessionId: 'guard-1', occurredAt: now, type: 'page-hidden', resolution: 'intentional' },
  { id: 'i3', guardSessionId: 'guard-2', occurredAt: now, type: 'window-blur', resolution: 'unknown' },
  { id: 'i4', guardSessionId: 'guard-old', occurredAt: now, type: 'page-hidden', resolution: 'returned' },
];
const distractions = [
  { id: 'd1', text: 'one', capturedAt: now, guardSessionId: 'guard-1', status: 'inbox' },
  { id: 'd2', text: 'two', capturedAt: now, guardSessionId: 'guard-2', status: 'dismissed' },
];
const insights = review.calculateFocusGuardInsights(
  history,
  interruptions,
  distractions,
  now
);
assert.deepEqual(insights, {
  protectedSessionsCompleted: 2,
  meaningfulExcursions: 3,
  returnedCount: 1,
  intentionalCount: 1,
  blockedSiteCount: 0,
  emergencyBypassCount: 0,
  capturedDistractionCount: 2,
  averageRating: 4,
  ratedSessionCount: 1,
  reviewedSessionCount: 1,
  reviewedPercent: 50,
});

assert.deepEqual(
  review.createDescriptiveReviewSummary(
    review.calculateSessionAttentionSummary([]),
    1
  ),
  [
    'Sesi berjalan tanpa perpindahan halaman yang tercatat.',
    'Kamu menyimpan 1 hal untuk dikerjakan nanti.',
  ]
);

console.log('Phase 6 deterministic harness: 12 checks passed.');
