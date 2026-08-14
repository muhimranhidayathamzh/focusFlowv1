# FocusFlow Upgrade Blueprint

> Status: Implemented baseline. This document records the first product upgrade.
> The continuing anti-distraction roadmap is defined in
> `docs/FOCUS_GUARD_MASTER_BLUEPRINT.md`.

## 1. Product Direction

FocusFlow will evolve from a simple Pomodoro timer into a personal focus companion.

The product should help the user:

- start work when the task feels too large or vague
- stay inside a focused work rhythm
- see visible progress that creates motivation to return tomorrow

The core product promise:

> FocusFlow helps you turn one vague intention into one small focus action, then shows your progress clearly enough to make consistency feel rewarding.

## 2. Research-Informed Principles

### 2.1 Reduce task initiation friction

Many productivity failures happen before the work starts. The app should make the first action smaller, clearer, and less emotionally heavy.

Design implications:

- avoid asking the user to plan too much before starting
- make "next tiny action" visible
- allow short starter sessions
- support incomplete progress without guilt

### 2.2 Make progress visible

Motivation improves when progress is concrete. The app should show small wins without turning productivity into pressure.

Design implications:

- show daily focus minutes
- show completed sessions
- show completed tasks or checklist steps
- show weekly trend
- show personal bests and streaks gently

### 2.3 Keep the product calm

FocusFlow should not become another noisy productivity dashboard. The app should feel like a quiet workspace.

Design implications:

- keep one primary action per section
- avoid excessive gamification
- do not add social features in the personal phase
- keep charts simple and glanceable

### 2.4 Treat sound as personal experimentation

Binaural beats and focus sounds can be useful for some users, but the evidence is mixed. FocusFlow should present them as optional focus environments, not medical claims.

Design implications:

- label binaural beats as experimental
- keep natural sounds and noise options
- allow the user to compare which sound works best for them over time

## 3. Target User For This Phase

Primary user:

- the project owner using FocusFlow for personal productivity

Current phase:

- local-first
- no required login
- no cloud sync
- no public multi-user assumptions

This keeps the upgrade practical and avoids adding authentication complexity before the core workflow is validated.

## 4. Core Feature Set

### 4.1 Adaptive Timer

Current state:

- Focus, Short Break, Long Break
- custom durations
- basic session count

Upgrade direction:

- add timer presets for different mental states
- keep manual customization
- make the chosen preset visible

Recommended presets:

| Preset | Focus | Break | Use Case |
| --- | ---: | ---: | --- |
| Quick Start | 10 min | 2 min | When starting feels hard |
| Classic Pomodoro | 25 min | 5 min | Normal work rhythm |
| Deep Work | 50 min | 10 min | Coding, writing, research |
| Recovery Mode | 20 min | 8 min | Low-energy work |

MVP acceptance:

- user can pick a preset
- timer settings update from the preset
- custom settings still work

### 4.2 Focus Checklist / Nudge-lite

Current state:

- flat task list
- add, edit, complete, delete
- localStorage persistence

Upgrade direction:

- allow a large task to contain small checklist steps
- allow one checklist step to become the active focus target
- connect the active focus target to the timer display

Core use case:

1. User writes a vague task: "Upgrade FocusFlow stats".
2. User breaks it into small steps:
   - define stats data
   - create session history type
   - save completed sessions
   - build DailyStats card
   - test with short timer
3. User selects one step as the active focus target.
4. Timer shows: "Focusing on: build DailyStats card".
5. After the session, user marks the step done or continues.

MVP acceptance:

- task can have checklist steps
- user can add, edit, complete, and delete steps
- user can set a step as the active focus target
- active focus target is visible near the timer

Out of scope for MVP:

- AI-generated checklist
- forced countdown
- complex ADHD coaching flow

### 4.3 Session History

Current state:

- timer state exists only while using the page
- no completed-session history

Upgrade direction:

- save completed focus sessions locally
- use this data as the foundation for statistics

Recommended local data shape:

```ts
export interface FocusSession {
  id: string;
  completedAt: number;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  durationSeconds: number;
  presetId?: string;
  taskId?: string;
  stepId?: string;
  soundId?: string;
}
```

MVP acceptance:

- when a focus session completes, a session record is saved
- records persist after refresh
- stats can read from the saved history

### 4.4 Focus Stats

Current state:

- task completion count exists inside the task list
- no daily or weekly stats

Upgrade direction:

- add a motivational stats panel based on local session history

Recommended stats:

- focus minutes today
- focus sessions today
- completed tasks or steps today
- daily goal progress
- current streak
- 7-day focus chart
- personal best focus day

MVP acceptance:

- stats panel shows today's focus minutes
- stats panel shows today's completed focus sessions
- stats panel shows a 7-day chart
- values persist across refresh through localStorage history

### 4.5 Daily Goal And Streak

Current state:

- no goal or streak system

Upgrade direction:

- let user set a simple daily goal
- show progress without shame language

Recommended goal types:

- focus minutes per day
- completed focus sessions per day

MVP acceptance:

- user can set daily goal
- progress bar updates from session history
- streak counts days where goal was met

Tone rules:

- use encouraging copy
- avoid punishment for missed days
- support "comeback" messaging

### 4.6 Focus Sound Lab

Current state:

- rain, ocean, white noise, brown noise
- synthesized with Web Audio API

Upgrade direction:

- keep natural sounds
- add optional binaural beat modes
- make sound choices intentional

Recommended sounds:

| Sound | Purpose | Notes |
| --- | --- | --- |
| Rain | Calm focus | Keep current |
| Ocean | Relaxed work | Keep current |
| Brown Noise | Deep steady focus | Keep current |
| White Noise | Mask distractions | Keep current |
| Alpha 10Hz | Calm focus experiment | Requires stereo headphones |
| Beta 16Hz | Alert focus experiment | Requires stereo headphones |
| Gamma 40Hz | Experimental deep focus | Requires stereo headphones |

MVP acceptance:

- new sound options appear in the panel
- binaural sounds are generated through Web Audio API
- UI labels indicate headphone recommendation

### 4.7 Login And Cloud Sync

Decision for this phase:

- defer login
- defer Supabase
- keep local-first data

Reason:

- current goal is validating the personal workflow
- auth adds complexity without improving the immediate personal loop

Revisit login when:

- app is used across multiple devices
- user wants backup
- product is prepared for public usage

## 5. Recommended Roadmap

### Phase 1: Measurement Foundation

Goal:

- create session history and stats foundation

Deliverables:

- FocusSession type
- useFocusSessions hook
- localStorage persistence
- timer completion saves focus session

### Phase 2: Motivational Stats

Goal:

- make progress visible

Deliverables:

- DailyStats panel
- 7-day chart
- daily goal setting
- streak calculation

### Phase 3: Focus Checklist

Goal:

- help the user start from small actions

Deliverables:

- checklist steps inside tasks
- active focus target
- timer shows current target
- step completion flow

### Phase 4: Focus Sound Lab

Goal:

- upgrade sound from ambience to intentional focus environment

Deliverables:

- binaural beat modes
- headphone guidance
- better sound grouping

### Phase 5: Review And Polish

Goal:

- make the experience feel cohesive

Deliverables:

- copy polish
- responsive QA
- empty states
- local data export/import if needed

## 6. Product Success Criteria

The upgrade is successful if:

- the user can start a session from one small next action
- completed sessions are saved
- daily and weekly progress is visible
- statistics feel motivating, not judgmental
- the app remains simple enough to open daily

## 7. Current Non-Goals

- Google login
- Supabase sync
- AI-generated breakdown
- public leaderboard
- mobile native app
- complex analytics dashboard
- medical claims about ADHD or binaural beats
