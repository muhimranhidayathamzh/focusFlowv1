# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Reliable wall-clock Pomodoro timer with refresh, sleep, overdue, and multi-tab recovery.
- Task steps, active focus targets, daily goals, streaks, session history, and seven-day statistics.
- Opt-in Focus Contract and protected Focus Guard session lifecycle.
- Privacy-preserving attention awareness, Return to Focus, Quick Capture, and Distraction Inbox.
- Idempotent distraction-to-task conversion and protected-session review.
- Focus Guard seven-day insights without a synthetic Focus Score.
- Manifest V3 Browser Guard extension with versioned bridge, heartbeat, expiry, and recovery.
- Session-scoped website blocking, intervention page, timed emergency bypass, and event deduplication.
- Built-in and custom Guard profiles, rule editor, precedence, import/export, and dynamic permissions.
- Desktop-first responsive workspace, accessibility improvements, and compact secondary panels.
- Focus Sound Lab with natural, noise, and experimental binaural modes.
- Deterministic verification harnesses and explicit resource/storage bounds.
- Indonesian user guide and phase-by-phase architecture documentation.

### Fixed

- Prevented duplicate timer completion and duplicate cross-tab session writes.
- Corrected the long-break transition to occur after every fourth completed focus session.
- Removed extension bridge response recursion that could exhaust browser memory.
- Stabilized extension liveness across Manifest V3 service-worker cold starts.
- Removed Guard Profile Settings render/storage/config-sync loops and reduced modal resource usage.
