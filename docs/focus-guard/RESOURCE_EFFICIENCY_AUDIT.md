# FocusFlow Resource Efficiency Audit

## Outcome

FocusFlow now has explicit retention and concurrency bounds. The browser bridge
does not retain one object per heartbeat, and no extension collection is
unbounded.

## Runtime bounds

- Extension liveness ping: every 12 seconds, non-overlapping.
- Protected-session snapshot heartbeat: every 12 seconds only while a protected
  session is active or paused.
- Extension event drain: every 12 seconds during a protected session and every
  60 seconds while idle, with a non-overlapping in-flight guard.
- Pending page-to-extension requests: maximum 8. Every request is settled or
  removed after the 6-second timeout.
- Seen response IDs: maximum 200, pruned back to 100.
- Content bridge: request-direction allowlist prevents response/error echo
  loops.

## Storage bounds

- Extension pending events: 100 records, maximum age 24 hours.
- Timer completion ledger: 200 records.
- Guard session history: 200 records.
- Guard interruptions: 1,000 records.
- Distraction Inbox: 500 records.
- Guard profiles: maximum 200 stored records, maximum 100 website rules per
  profile.
- Guard storage payload: maximum 1,000,000 serialized characters per key.
- Focus session history: 2,000 records and a 1,000,000-character payload
  budget.
- Tasks: 500 records, 100 steps per task, 300 characters per task/step, and a
  1,000,000-character payload budget.
- Guard configuration import: rejected before JSON parsing above 1,000,000
  characters; the file picker rejects files above 1 MB before reading them.

Completed/stopped Guard history keeps profile identity, protection level,
bypass settings, target, intention, timestamps, review metadata, and focus
session linkage. Website/application rule arrays are removed from completed
history because they are only consumed by live protection. Per-interruption
rule identity remains in interruption records. Existing history is compacted
the next time it is saved.

## Regression verification

`npm run verify:resource-bounds` asserts the concurrency, cadence, retention,
payload, import, task, session, and extension queue limits. Phase 7 separately
executes the real content bridge and proves that extension responses are never
forwarded back to the extension.

Protocol version 3, snapshot schema 3, extension version 0.3.0, DNR behavior,
and protected-session business rules are unchanged.
