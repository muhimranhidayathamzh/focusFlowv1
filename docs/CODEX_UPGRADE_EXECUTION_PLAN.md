# Codex Upgrade Execution Plan

This document is the working playbook for upgrading FocusFlow through Codex vibe coding sessions.

Use it as the reference before each implementation session.

## Current Status And Continuation

The original upgrade phases in this document have been implemented in the
current working tree: session history, statistics, daily goals, checklist steps,
active focus targets, timer presets, and the Focus Sound Lab are now the product
baseline.

The next product program is Focus Guard. Its product decisions, architecture,
compatibility rules, phased delivery plan, and prompt contract are defined in:

- `docs/FOCUS_GUARD_MASTER_BLUEPRINT.md`

For new implementation work, begin with Focus Guard Phase 0 and do not repeat
the original phases below. The original plan is retained as implementation
history and as a regression reference.

## 1. Execution Style

Work in small, verifiable phases.

For each phase:

1. Read the relevant existing files.
2. Define the smallest useful implementation.
3. Edit only the files needed for that phase.
4. Run lint/build when practical.
5. Manually verify the main flow.
6. Update documentation when behavior changes.

Default technical constraints:

- keep data local-first with localStorage
- do not add Supabase in this upgrade phase
- avoid new dependencies unless clearly useful
- preserve the existing visual direction
- keep components small and readable
- prefer TypeScript types for new data structures

## 2. Target Architecture

Recommended new or changed modules:

```txt
src/
  types/
    task.ts              existing, extend with checklist steps
    focusSession.ts      new session history types
    focusGoal.ts         optional, daily goal type
  hooks/
    useTimer.ts          update to report completed sessions
    useTasks.ts          extend for checklist steps and active target
    useFocusSessions.ts  new local session history hook
    useFocusStats.ts     new derived stats hook
    useAmbientSound.ts   extend for sound lab if needed
  components/
    timer/
      PomodoroTimer.tsx  show active focus target and presets
    task/
      TaskList.tsx       support checklist flow
      TaskItem.tsx       support step expansion
      TaskStepItem.tsx   optional new component
    stats/
      FocusStatsPanel.tsx new stats UI
      WeeklyFocusChart.tsx optional chart component
    ambient/
      AmbientSoundPanel.tsx update sound lab UI
```

## 3. Data Model Draft

### 3.1 Tasks And Checklist Steps

```ts
export interface TaskStep {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  steps?: TaskStep[];
}
```

### 3.2 Active Focus Target

```ts
export interface FocusTarget {
  taskId: string;
  stepId?: string;
  label: string;
}
```

### 3.3 Focus Session

```ts
export interface FocusSession {
  id: string;
  completedAt: number;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  durationSeconds: number;
  presetId?: string;
  taskId?: string;
  stepId?: string;
  targetLabel?: string;
  soundId?: string;
}
```

### 3.4 Daily Goal

```ts
export interface DailyFocusGoal {
  type: 'minutes' | 'sessions';
  target: number;
}
```

## 4. Phase Plan

### Phase 0: Baseline Audit

Goal:

- understand current state and prevent accidental regressions

Tasks:

- inspect current timer, task, sound, and layout files
- run `npm run lint`
- run `npm run build`
- note any existing issues before changing behavior

Codex prompt:

```txt
We are upgrading FocusFlow using docs/FOCUSFLOW_UPGRADE_BLUEPRINT.md and docs/CODEX_UPGRADE_EXECUTION_PLAN.md.

Start with Phase 0 only. Audit the existing project structure, timer flow, task flow, ambient sound flow, and current build/lint status. Do not make product feature changes yet. Summarize risks and the safest first implementation phase.
```

Acceptance:

- current project state is understood
- baseline errors are documented
- no unrelated code changes

### Phase 1: Session History Foundation

Goal:

- save completed focus sessions locally

Tasks:

- create `src/types/focusSession.ts`
- create `src/hooks/useFocusSessions.ts`
- support add, list, clear, and derived daily filtering
- update timer completion flow so a completed focus session can be recorded
- keep the API clean enough for stats later

Codex prompt:

```txt
Implement Phase 1 from docs/CODEX_UPGRADE_EXECUTION_PLAN.md: local session history foundation.

Create typed FocusSession storage using localStorage. Integrate it with the Pomodoro timer so completed focus sessions are saved. Keep the UI changes minimal, preserve current behavior, and verify with lint/build. Do not implement stats UI yet.
```

Acceptance:

- completed focus sessions persist after refresh
- non-focus break sessions are not counted as focus stats unless intentionally stored
- no Supabase or auth added

### Phase 2: Focus Stats Panel

Goal:

- make progress visible and motivating

Tasks:

- create `src/hooks/useFocusStats.ts`
- create `src/components/stats/FocusStatsPanel.tsx`
- optionally create `src/components/stats/WeeklyFocusChart.tsx`
- show today's focus minutes
- show today's completed sessions
- show 7-day focus minutes
- place stats below timer or near task list

Codex prompt:

```txt
Implement Phase 2: Focus Stats Panel.

Use the local FocusSession history from Phase 1 to show motivational stats: focus minutes today, completed sessions today, and a simple 7-day bar chart. Keep the UI calm and consistent with the existing dark FocusFlow design. Do not add external chart libraries unless necessary.
```

Acceptance:

- stats update after a completed focus session
- 7-day chart renders correctly with empty and non-empty data
- mobile layout remains clean

### Phase 3: Daily Goal And Streak

Goal:

- create a light motivation loop

Tasks:

- add localStorage-backed daily goal
- support goal by focus minutes first
- show progress bar
- calculate streak from session history
- add encouraging copy for empty/missed days

Codex prompt:

```txt
Implement Phase 3: Daily Goal and Streak.

Add a local daily focus goal, defaulting to a reasonable personal goal. Show progress toward the goal in the stats panel and calculate a gentle current streak from local focus session history. Keep copy encouraging and avoid shame or failure language.
```

Acceptance:

- user can understand today's progress immediately
- streak is calculated from days where the goal was met
- missing days do not produce harsh messaging

### Phase 4: Focus Checklist MVP

Goal:

- turn vague tasks into actionable steps

Tasks:

- extend task type with `steps`
- update `useTasks` to add, update, complete, and delete steps
- update task UI to display expandable checklist steps
- add a "Start" or "Focus" action for a task or step
- store active focus target locally or in parent page state

Codex prompt:

```txt
Implement Phase 4: Focus Checklist MVP.

Extend the current task list so each task can contain small checklist steps. Add UI for adding, completing, editing, and deleting steps. Add a way to set a task or step as the active focus target. Preserve existing task behavior and localStorage compatibility as much as possible.
```

Acceptance:

- old flat tasks still load safely
- new checklist steps persist
- user can choose one step as the active focus target
- UI remains readable in the existing card layout

### Phase 5: Timer And Focus Target Integration

Goal:

- connect the selected checklist step to the focus session

Tasks:

- show active focus target in `PomodoroTimer`
- include target info in saved `FocusSession`
- after session completion, offer or enable step completion
- keep flow optional so timer still works without a target

Codex prompt:

```txt
Implement Phase 5: Timer and Focus Target Integration.

Show the active focus target near the timer and include the selected task/step metadata in completed focus sessions. The timer must still work when no target is selected. Keep the completion flow simple and avoid modal-heavy UX unless needed.
```

Acceptance:

- active target is visible before/during focus
- completed sessions store target metadata
- stats still work
- no target remains a valid flow

### Phase 6: Adaptive Timer Presets

Goal:

- make timer duration match the user's current energy

Tasks:

- add preset definitions
- add preset selector in timer settings or timer card
- support Quick Start, Classic Pomodoro, Deep Work, Recovery Mode
- preserve custom duration editing

Codex prompt:

```txt
Implement Phase 6: Adaptive Timer Presets.

Add timer presets for Quick Start, Classic Pomodoro, Deep Work, and Recovery Mode. Presets should update timer durations while preserving the existing custom settings flow. Make the UI compact and consistent with the current timer card.
```

Acceptance:

- selecting a preset updates timer durations
- custom settings still work
- current mode resets cleanly when durations change

### Phase 7: Focus Sound Lab

Goal:

- upgrade ambient sound into intentional focus sound modes

Tasks:

- add binaural beat sound types
- implement stereo oscillator behavior in `AudioEngine`
- update ambient sound metadata and UI grouping
- add headphone recommendation copy for binaural sounds

Codex prompt:

```txt
Implement Phase 7: Focus Sound Lab.

Extend the existing Web Audio sound engine with optional binaural beat modes: Alpha 10Hz, Beta 16Hz, and Gamma 40Hz. Keep existing natural/noise sounds. Label binaural modes as experimental and recommend headphones. Do not make medical claims.
```

Acceptance:

- existing sounds still work
- binaural modes play without breaking stop/volume controls
- UI clearly separates natural/noise sounds from experimental focus tones

### Phase 8: Weekly Review Polish

Goal:

- make the app feel complete and motivating

Tasks:

- improve stats empty states
- add personal best
- add simple weekly summary text
- polish spacing and responsive behavior
- optionally add local export/import

Codex prompt:

```txt
Implement Phase 8: Weekly Review Polish.

Polish the upgraded FocusFlow experience around stats, checklist, and timer. Add a simple weekly summary and personal best if the data is available. Improve empty states and responsive layout. Keep the app quiet, focused, and personal.
```

Acceptance:

- app feels cohesive
- no overlapping UI on mobile
- empty states are useful
- no unnecessary feature bloat

## 5. Session Prompt Template

Use this general prompt when starting any Codex implementation session:

```txt
We are upgrading FocusFlow according to:
- docs/FOCUSFLOW_UPGRADE_BLUEPRINT.md
- docs/CODEX_UPGRADE_EXECUTION_PLAN.md

Work only on Phase [PHASE NUMBER]: [PHASE NAME].

Before editing, inspect the relevant existing files and summarize the intended change. Then implement the smallest complete version, verify with available checks, and report:
1. files changed
2. behavior added
3. verification result
4. next recommended phase

Keep the app local-first. Do not add Supabase/auth unless explicitly requested.
```

## 6. QA Checklist

Run these checks after meaningful code changes:

```txt
npm run lint
npm run build
```

Manual checks:

- timer starts, pauses, resets
- mode switching works
- task add/edit/delete/complete works
- localStorage data survives refresh
- stats update after completing a short test session
- ambient sound plays, stops, and changes volume
- mobile layout does not overlap

## 7. Implementation Notes

Use short test durations during development by temporarily setting timer durations through the UI.

Do not hardcode personal productivity claims in the UI. Keep copy simple:

- "Today's focus"
- "Goal progress"
- "A small start still counts"
- "Ready for the next step?"

Avoid copy like:

- "You failed"
- "You are behind"
- "Scientifically proven to make you focus"

## 8. Definition Of Done For The Upgrade

The upgrade phase is complete when:

- completed sessions are saved locally
- stats panel shows daily and weekly progress
- user can create checklist steps under tasks
- user can focus on one selected task or step
- sound panel includes the Focus Sound Lab options
- the app remains usable without login
- build and lint pass or known issues are documented
