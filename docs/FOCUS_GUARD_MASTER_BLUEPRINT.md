# FocusFlow Focus Guard Master Blueprint

Status: Planning
Date: 2026-07-12
Product scope: Personal, local-first productivity system

## 1. Purpose

FocusFlow currently helps the user decide what to work on, run a Pomodoro
session, and review completed focus time. The next upgrade should address a
different failure point: the user knows the intended task, but can still leave
it impulsively for scrolling, unrelated browsing, or another application.

Focus Guard will turn FocusFlow from a passive timer into an active focus
environment.

The product promise is:

> FocusFlow keeps the current intention visible, adds deliberate friction before
> distraction, captures unrelated thoughts safely, and helps the user understand
> what interrupted a session without judgment.

Focus Guard is not intended to provide medical treatment, employee monitoring,
surveillance, or an impossible-to-escape computer lock.

## 2. Current Baseline

The following capabilities already exist and must be preserved:

- Pomodoro modes and custom durations
- Quick Start, Classic Pomodoro, Deep Work, and Recovery Mode presets
- tasks and checklist steps
- one active task or step as the focus target
- local completed-session history
- daily goal, streak, and weekly statistics
- ambient and experimental focus sounds
- keyboard shortcuts
- localStorage-based persistence
- a single-page Next.js 14 web application

The existing upgrade blueprint remains the historical reference for these
features. This document governs the Focus Guard upgrade only.

## 3. Product Principles

### 3.1 Protect intention, not control the user

Every intervention should show the active task and make returning to it the
easiest action. Protection may be strict, but an emergency exit must remain
available.

### 3.2 Add friction proportionally

The system should escalate from awareness to blocking:

1. remind the user of the active target
2. offer to capture the distracting thought
3. block a configured website or application
4. require a delay and reason for an emergency bypass

### 3.3 Observe the minimum necessary

Prefer explicit, low-risk signals:

- page visibility changes
- window focus changes
- blocked URL rules in the browser extension
- active application identity in an optional desktop companion

Continuous screenshots, screen recording, keystroke capture, message content,
and cloud activity upload are out of scope.

### 3.4 Local-first and explainable

Activity records should remain on the user's device. Focus scores and
recommendations must be derived from visible rules rather than an opaque score.

### 3.5 Preserve a calm product

Focus Guard should not turn FocusFlow into a noisy monitoring dashboard.
Interventions must be concise, statistics should be useful at a glance, and the
default tone should be supportive rather than punitive.

## 4. System Boundaries

Focus Guard requires three progressively capable surfaces.

```txt
FocusFlow Web App
  - task, timer, focus contract, distraction inbox, review, statistics
  - can detect its own page visibility and window focus

Browser Guard Extension
  - can inspect and block configured browser URLs
  - can show the current target on an intervention page
  - can report block and bypass events to FocusFlow

Desktop Guard Companion (optional)
  - can observe the active desktop application
  - can warn, overlay, or restrict configured applications
  - can provide a global distraction-capture shortcut
```

The web app must remain fully usable without the extension. The extension must
remain useful without the desktop companion.

## 5. Core User Journey

### 5.1 Prepare

1. User selects a task or checklist step.
2. User presses the protected-session action.
3. Focus Contract asks for:
   - focus target
   - optional session intention
   - timer preset or duration
   - guard profile
   - protection level
4. User confirms the contract.

### 5.2 Focus

1. Timer and guard session start together.
2. Current target remains visible.
3. Leaving the page is recorded as an attention event, not automatically judged
   as a distraction.
4. Configured blocked websites or applications trigger an intervention.
5. Unrelated thoughts can be sent to the Distraction Inbox.

### 5.3 Intervene

An intervention should offer:

- `Kembali fokus`
- `Simpan untuk nanti`
- `Buka darurat`, when supported and permitted by the profile

Emergency access should require a short delay, an optional or required reason,
and a bounded access duration.

### 5.4 Review

When a focus session ends, show:

- planned target and intention
- completed focus duration
- attention-return events
- blocked-site or blocked-app attempts
- emergency bypasses
- captured distractions
- target completion action
- optional focus rating from 1 to 5

The user may convert a captured distraction into a task, dismiss it, or leave it
for later review.

## 6. Protection Levels

### Light

- Focus Contract is available
- page-leave events may be recorded
- return reminder is shown
- Distraction Inbox is available
- no blocking

### Medium

- all Light behavior
- configured browser rules are blocked while a protected session is active
- emergency access is available with friction

### Strict

- all Medium behavior
- configured desktop applications may be restricted when the companion exists
- bypass requires a reason and cooldown
- session cannot silently disable itself
- emergency stop remains available and is recorded

Strict mode is not part of the initial web MVP.

## 7. Domain Model

Draft types:

```ts
export type ProtectionLevel = 'light' | 'medium' | 'strict';

export interface FocusGuardProfile {
  id: string;
  name: string;
  protectionLevel: ProtectionLevel;
  websiteRules: WebsiteRule[];
  applicationRules: ApplicationRule[];
  bypassDelaySeconds: number;
  bypassDurationMinutes: number;
  requireBypassReason: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface WebsiteRule {
  id: string;
  pattern: string;
  matchType: 'domain' | 'url-prefix' | 'url-pattern';
  action: 'block' | 'allow';
  label?: string;
}

export interface ApplicationRule {
  id: string;
  identifier: string;
  label: string;
  action: 'warn' | 'block';
}

export interface FocusGuardSession {
  id: string;
  focusSessionId?: string;
  profileId: string;
  target?: FocusTarget;
  intention?: string;
  protectionLevel: ProtectionLevel;
  startedAt: number;
  expectedEndAt: number;
  endedAt?: number;
  endReason?: 'completed' | 'stopped' | 'recovered';
  status: 'active' | 'paused' | 'completed' | 'stopped';
}

export type InterruptionType =
  | 'page-hidden'
  | 'window-blur'
  | 'blocked-site'
  | 'blocked-app'
  | 'emergency-bypass'
  | 'thought';

export interface FocusInterruption {
  id: string;
  guardSessionId: string;
  occurredAt: number;
  returnedAt?: number;
  type: InterruptionType;
  source?: string;
  note?: string;
  resolution?: 'returned' | 'captured' | 'bypassed' | 'unknown';
}

export interface DistractionItem {
  id: string;
  text: string;
  capturedAt: number;
  guardSessionId?: string;
  status: 'inbox' | 'converted-to-task' | 'dismissed';
  convertedTaskId?: string;
}
```

Final types may be split by module, but their responsibilities should remain
separate: configuration, active session, observed event, and captured thought.

## 8. Persistence and Compatibility

Existing localStorage keys and existing records must not be renamed or erased.

Recommended new keys:

```txt
focusflow-guard-profiles
focusflow-active-guard-session
focusflow-guard-interruptions
focusflow-distraction-inbox
focusflow-guard-preferences
```

Compatibility rules:

- all additions to the existing `FocusSession` shape are optional
- new persisted data must pass a normalizer before use
- malformed records should be ignored safely
- unknown future fields should not break older readers
- timer-only sessions remain valid
- Focus Guard is opt-in during the first release
- no migration may delete existing tasks, sessions, goals, or settings

## 9. Timer Reliability Requirement

The current interval-driven timer must be upgraded before guarded sessions are
trusted. Browser throttling, refreshes, or device sleep must not extend the
planned session accidentally.

The reliable timer should use timestamps:

```txt
startedAt
expectedEndAt
pausedAt
pausedRemainingSeconds
```

`timeLeft` should be derived from `expectedEndAt - Date.now()` while active.
The timer should recover safely after refresh and complete no more than once.

This work must preserve:

- start, pause, resume, and reset
- manual mode switching
- preset and custom durations
- notification behavior
- focus-session recording
- break transitions

## 10. Proposed Web Architecture

Suggested modules, subject to implementation-time inspection:

```txt
src/
  types/
    focusGuard.ts
    distraction.ts
  hooks/
    useFocusGuardProfiles.ts
    useFocusGuardSession.ts
    useAttentionEvents.ts
    useDistractionInbox.ts
  components/
    guard/
      FocusContract.tsx
      FocusGuardStatus.tsx
      ReturnToFocusPrompt.tsx
      DistractionCapture.tsx
      SessionReview.tsx
      GuardProfileSettings.tsx
```

Avoid turning `PomodoroTimer.tsx` into the owner of all guard logic. Timer UI may
trigger or display guard state, while persistence and lifecycle logic belong in
dedicated hooks. A higher-level session controller may be introduced only when
coordination becomes complex enough to justify it.

## 11. Browser Extension Architecture

The first extension should target Chromium Manifest V3 so it can run on Chrome
and Edge.

Proposed structure:

```txt
extension/
  manifest.json
  src/
    background/
    content/
    block-page/
    options/
    shared/
```

Responsibilities:

- store or receive the active guarded-session snapshot
- evaluate domain and URL-path rules
- redirect blocked navigation to a local intervention page
- show target, intention, and remaining time
- implement bounded emergency bypass
- report block and bypass events to the web app

The exact web-to-extension communication mechanism must be proven in a small
prototype before the full blocker is built. Candidate mechanisms include
extension messaging with an allowed web origin or a localhost-compatible bridge.

## 12. Desktop Companion Architecture

The desktop companion is optional and should be evaluated only after the browser
extension is stable. Tauri is the preferred initial candidate because FocusFlow
already has a web UI and the companion should remain lightweight.

Prototype responsibilities:

- detect active process/window identity on Windows
- match it against local application rules
- send only the minimum event metadata to FocusFlow
- show a warning before any restrictive behavior
- provide a global shortcut for distraction capture

Force-closing applications is excluded from the first prototype. Overlay or
warning behavior should be evaluated before stronger restriction.

## 13. Delivery Roadmap

### Phase 0 — Focus Guard baseline and safety contract

Goal: establish a verified starting point without product changes.

Deliverables:

- current build, lint, and type status
- current timer lifecycle map
- storage-key inventory
- regression checklist
- documented compatibility contract

Exit criteria:

- known baseline failures are recorded
- no feature behavior changes
- the safest Phase 1 edit surface is identified

### Phase 1 — Reliable and recoverable timer

Goal: make session time accurate outside the active tab.

Deliverables:

- timestamp-based active countdown
- pause and resume semantics
- refresh recovery
- completion idempotency
- tests where practical or a deterministic timer test plan

Exit criteria:

- background throttling does not materially extend a session
- refresh restores the correct active or paused state
- a completed session is recorded once
- existing timer features still work

### Phase 2 — Focus Guard domain and storage foundation

Goal: implement safe local data primitives without blocking behavior.

Deliverables:

- typed profiles, guard sessions, interruptions, and distractions
- normalized localStorage repositories/hooks
- a default Light profile
- storage synchronization consistent with existing hooks

Exit criteria:

- malformed new data fails safely
- old FocusFlow data continues to load
- no significant UI behavior is introduced

### Phase 3 — Focus Contract and protected-session lifecycle

Goal: let the user intentionally start a protected session.

Deliverables:

- Focus Contract UI
- target, intention, profile, and protection selection
- atomic timer and guard start
- visible protected-session status
- safe stop and completion lifecycle

Exit criteria:

- a normal timer session remains possible
- a protected session has one linked target and lifecycle
- refresh does not orphan an active guard session

### Phase 4 — Web attention awareness

Goal: help the user return after leaving FocusFlow without pretending to know
what happened outside the page.

Deliverables:

- page visibility and window focus event handling
- deduplication/debouncing of noisy browser events
- return-to-focus prompt
- event resolution actions

Exit criteria:

- ordinary browser focus events do not create duplicate floods
- copy distinguishes `left page` from `was distracted`
- attention tracking stops when the guarded session stops

### Phase 5 — Distraction Inbox

Goal: let the user defer unrelated thoughts without losing them.

Deliverables:

- quick capture during a session
- keyboard shortcut inside the web app
- inbox list and session association
- convert item to task
- dismiss item

Exit criteria:

- capture requires minimal interruption
- conversion uses the existing task system
- inbox survives refresh

### Phase 6 — Session Review and distraction insights

Goal: close the focus loop with a useful, nonjudgmental review.

Deliverables:

- post-session review
- interruption and capture summary
- optional rating
- target completion action
- transparent Focus Score or descriptive summary
- basic historical guard statistics

Exit criteria:

- historical unguarded sessions still render
- users can understand why a score or summary was produced
- review can be skipped safely

### Phase 7 — Browser extension communication proof

Goal: validate communication and session synchronization before blocking.

Deliverables:

- minimal Manifest V3 extension
- development install instructions
- active-session synchronization proof
- connection state in FocusFlow
- documented failure behavior

Exit criteria:

- web app remains usable when extension is absent or disconnected
- extension receives only required session information
- stale session state expires safely

### Phase 8 — Browser blocking MVP

Goal: block configured websites during protected sessions.

Deliverables:

- domain and URL-prefix rules
- block/intervention page
- current target and timer context
- return-to-focus action
- emergency bypass with expiry
- event reporting

Exit criteria:

- configured sites are blocked only during applicable sessions
- allow rules take precedence predictably
- bypass expires automatically
- disabling or uninstalling the extension cannot corrupt web data

### Phase 9 — Profiles and browser rule refinement

Goal: make protection practical across different work modes.

Deliverables:

- Coding, Belajar, and custom profiles
- domain/path rule editor
- YouTube Shorts-style path blocking with regular YouTube allowed
- import/export of guard configuration

Exit criteria:

- rule precedence is documented and testable
- profile switching does not mutate other profiles
- invalid patterns are rejected clearly

### Phase 10 — Desktop companion feasibility prototype

Goal: prove safe Windows active-application awareness.

Deliverables:

- Tauri feasibility spike
- active-app detection
- local rule matching
- warning-only intervention
- privacy and permission documentation

Exit criteria:

- detection is reliable enough for personal use
- no screenshots or content capture
- companion failures do not affect the web timer
- decision recorded: proceed, revise, or stop desktop work

### Phase 11 — Optional desktop protection

Goal: add stronger application-level protection only if the prototype succeeds.

Deliverables:

- configurable warning or overlay behavior
- global distraction shortcut
- strict-profile integration
- emergency stop and crash recovery

Exit criteria:

- the user cannot be permanently locked out
- protection always has a visible recovery path
- restrictive actions are opt-in

## 14. Phase Execution Contract for Vibe Coding

Every implementation prompt must include:

1. the phase name and objective
2. the files or systems likely in scope
3. behavior that must remain unchanged
4. explicit non-goals
5. acceptance criteria
6. required verification
7. documentation updates

Every phase should follow this workflow:

```txt
Inspect relevant code
  -> state assumptions and risks
  -> implement the smallest complete slice
  -> run verification
  -> review the diff for unrelated changes
  -> update phase documentation
  -> stop before the next phase
```

Prompt template:

```txt
We are upgrading FocusFlow according to
docs/FOCUS_GUARD_MASTER_BLUEPRINT.md.

Work only on Phase [NUMBER]: [NAME].

Before editing:
- inspect the relevant existing implementation and current git diff
- identify compatibility risks and confirm the smallest safe approach

Implement the phase as a backward-compatible update. Preserve existing timer,
task, statistics, sound, keyboard shortcut, and localStorage behavior unless the
phase explicitly changes one of them.

Do not implement later phases. Do not add Supabase, authentication, cloud sync,
screen recording, screenshot capture, or unrelated dependencies.

Acceptance criteria:
- [PHASE-SPECIFIC CRITERIA]

Verification:
- run the available lint/build/type checks
- perform or document the relevant manual flows
- report files changed, behavior added, compatibility decisions, verification
  results, and remaining risks
```

## 15. Cross-Phase QA Matrix

These flows must be checked after any meaningful lifecycle or storage change:

- start, pause, resume, reset, and complete each timer mode
- manually switch modes
- apply a timer preset and custom duration
- refresh during active and paused states
- create, edit, complete, and delete tasks and checklist steps
- set and clear an active focus target
- record one completed focus session only
- load historical sessions and statistics
- play, change, and stop ambient sound
- operate with Focus Guard disabled
- operate with Focus Guard enabled and no extension
- recover from malformed new localStorage data
- verify responsive layout and keyboard navigation

## 16. Privacy and Safety Requirements

- local-only by default
- no screenshots, screen video, clipboard capture, or keystroke logging
- no collection of page contents or private message contents
- store URL/application identifiers only when needed for configured rules or an
  explicit interruption record
- provide clear deletion for guard history and distraction items
- provide an emergency exit from restrictive modes
- never describe attention inference as certainty
- do not make medical or ADHD-treatment claims

## 17. Success Metrics

For personal validation, success should be measured by behavior rather than
feature count:

- protected sessions started and completed
- percentage of blocked attempts followed by return to focus
- number of distractions captured instead of acted on immediately
- emergency bypass frequency
- target completion after protected sessions
- self-rated focus trend
- whether the user continues using protected sessions voluntarily

These metrics remain local and should be presented as reflection tools, not
performance judgments.

## 18. Explicit Non-Goals

- public accounts or social features
- employee or family surveillance
- cloud screen monitoring
- hidden background tracking
- continuous screenshots or AI vision monitoring
- mobile-device blocking in the initial roadmap
- an unbreakable lock mode
- force-closing desktop applications in the prototype
- AI-generated psychological or medical conclusions

## 19. Definition of Done

The Focus Guard program is considered functionally complete when:

- timer sessions remain accurate across backgrounding and refresh
- the user can start a protected session from a clear Focus Contract
- the user can capture distractions and review them later
- web attention events are handled honestly and calmly
- session review connects interruptions back to the intended task
- the browser extension blocks configured sites and supports safe bypass
- all existing FocusFlow features and historical local data remain usable
- extension and desktop integrations fail safely when unavailable

Desktop strict protection is optional and is not required for the web and
browser Focus Guard experience to be considered successful.
