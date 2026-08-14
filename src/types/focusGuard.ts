import { FocusTarget } from '@/types/task';

export type ProtectionLevel = 'light' | 'medium' | 'strict';
export type GuardRuleAction = 'block' | 'allow';
export type ApplicationRuleAction = 'warn' | 'block';

export interface WebsiteRule {
  id: string;
  pattern: string;
  matchType: 'domain' | 'url-prefix' | 'url-pattern';
  action: GuardRuleAction;
  label?: string;
}

export interface ApplicationRule {
  id: string;
  identifier: string;
  label: string;
  action: ApplicationRuleAction;
}

export interface FocusGuardProfile {
  id: string;
  kind: 'built-in' | 'custom';
  name: string;
  protectionLevel: ProtectionLevel;
  websiteRules: WebsiteRule[];
  applicationRules: ApplicationRule[];
  emergencyBypassAllowed: boolean;
  bypassDelaySeconds: number;
  bypassDurationMinutes: number;
  requireBypassReason: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FocusGuardProfileSnapshot {
  profileId: string;
  name: string;
  protectionLevel: ProtectionLevel;
  websiteRules: WebsiteRule[];
  applicationRules: ApplicationRule[];
  emergencyBypassAllowed: boolean;
  bypassDelaySeconds: number;
  bypassDurationMinutes: number;
  requireBypassReason: boolean;
}

export type GuardSessionStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'stopped';

export type GuardSessionEndReason = 'completed' | 'stopped' | 'recovered';
export type GuardReviewStatus = 'pending' | 'completed' | 'skipped';
export type GuardTargetOutcome = 'completed' | 'continue';

export interface FocusGuardSession {
  id: string;
  timerRunId?: string;
  focusSessionId?: string;
  profileId: string;
  profileSnapshot: FocusGuardProfileSnapshot;
  targetSnapshot?: FocusTarget;
  intention?: string;
  protectionLevel: ProtectionLevel;
  status: GuardSessionStatus;
  durationSeconds: number;
  startedAt: number;
  expectedEndAt: number;
  pausedAt?: number;
  pausedRemainingSeconds?: number;
  endedAt?: number;
  endReason?: GuardSessionEndReason;
  reviewStatus?: GuardReviewStatus;
  reviewedAt?: number;
  focusRating?: number;
  targetOutcome?: GuardTargetOutcome;
  reviewVersion?: number;
}

export type InterruptionType =
  | 'page-hidden'
  | 'window-blur'
  | 'blocked-site'
  | 'blocked-app'
  | 'emergency-bypass'
  | 'thought';

export type InterruptionResolution =
  | 'returned'
  | 'intentional'
  | 'captured'
  | 'bypassed'
  | 'unknown';

export interface FocusInterruption {
  id: string;
  guardSessionId: string;
  occurredAt: number;
  returnedAt?: number;
  type: InterruptionType;
  source?: string;
  note?: string;
  resolution?: InterruptionResolution;
  configuredRuleId?: string;
  configuredRuleLabel?: string;
  configuredRuleDomain?: string;
  bypassExpiresAt?: number;
}

export interface FocusGuardPreferences {
  guardEnabled: boolean;
  selectedProfileId: string;
  updatedAt: number;
}

export interface StartGuardSessionInput {
  id?: string;
  timerRunId?: string;
  profileId?: string;
  targetSnapshot?: FocusTarget;
  intention?: string;
  durationSeconds?: number;
  startedAt?: number;
  expectedEndAt: number;
}

export type GuardSessionMutationResult =
  | {
      ok: true;
      session: FocusGuardSession;
      alreadyApplied: boolean;
    }
  | {
      ok: false;
      reason:
        | 'active-session-exists'
        | 'session-conflict'
        | 'session-not-found'
        | 'invalid-input'
        | 'storage-failed';
      activeSession?: FocusGuardSession;
    };

export interface SubmitGuardReviewInput {
  focusRating?: number;
  targetOutcome: GuardTargetOutcome;
  reviewedAt?: number;
}

export type GuardReviewMutationResult =
  | {
      ok: true;
      session: FocusGuardSession;
      alreadyApplied: boolean;
    }
  | {
      ok: false;
      reason:
        | 'session-not-found'
        | 'review-not-pending'
        | 'invalid-input'
        | 'storage-failed';
    };

export interface CreateFocusGuardProfileInput {
  name: string;
  protectionLevel: ProtectionLevel;
  websiteRules?: WebsiteRule[];
  applicationRules?: ApplicationRule[];
  emergencyBypassAllowed?: boolean;
  bypassDelaySeconds?: number;
  bypassDurationMinutes?: number;
  requireBypassReason?: boolean;
}

export type UpdateFocusGuardProfileInput =
  Partial<Omit<CreateFocusGuardProfileInput, 'name'>> & { name?: string };
