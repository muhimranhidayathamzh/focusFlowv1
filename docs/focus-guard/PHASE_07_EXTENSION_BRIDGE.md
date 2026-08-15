# Phase 7 — Browser Extension Communication Proof

> Quick Capture addendum (extension 0.4.0): bridge protocol is now `4`
> while snapshot schema remains `3`. A separate bounded capture drain/ack
> channel is documented in `GLOBAL_QUICK_CAPTURE.md`; session/config snapshots
> remain free of distraction text.

> Production-origin addendum (extension 0.3.1): the exact origin
> `https://focusflow-fawn-ten.vercel.app` is allowlisted alongside the two
> original development origins. Protocol and snapshot schema remain version 3.

Status: accepted. The user confirmed unpacked-extension connection, sync,
pause/resume, clear, reconnect, and stale-state behavior on 2026-07-13.

Phase 8 subsequently upgrades the installed extension and web bridge together
to protocol/schema version 2 and extension version 0.2.0. The version-1 details
below remain the historical Phase 7 contract; mixed v1/v2 components fail as
incompatible and must be rebuilt/reloaded together.

## Scope boundary

Phase 7 proves a narrow, versioned communication path between the FocusFlow web
app and a Chromium Manifest V3 extension. It does not inspect URLs, tabs,
history, navigation, or page content, and it does not block or redirect any
website. Phase 8 is not part of this implementation.

Initial browser scope:

- Google Chrome;
- Microsoft Edge;
- Chromium Manifest V3;
- development origins `http://localhost:3000` and
  `http://127.0.0.1:3000` only.

Firefox, Safari, mobile browsers, desktop application awareness, and production
origins are outside this phase.

## Permission boundary — approved before extension creation

The Phase 7 manifest may request only:

- `storage`, solely for temporary `chrome.storage.session` state.

The content script matches only:

- `http://localhost:3000/*`;
- `http://127.0.0.1:3000/*`.

It must not request `tabs`, `activeTab`, `history`, `webNavigation`,
`declarativeNetRequest`, `scripting`, `notifications`, `nativeMessaging`, or
`<all_urls>`. There is no speculative host access and no persistent storage
fallback. A different development port or future production origin requires an
explicit manifest match addition and a matching content-script origin allowlist
change, followed by extension reload and security review.

The content script is a transport only. It does not read the DOM, task content,
or `localStorage`, and it injects no visible UI. The service worker does not
query tabs, inspect navigation, redirect, or retain history.

## Architecture

```text
FocusFlow page
  ↕ explicit-origin, versioned window.postMessage envelopes
content script on the two allowed FocusFlow origins
  ↕ allowlisted chrome.runtime messages
Manifest V3 service worker
  ↕ chrome.storage.session
one temporary sanitized protected-session snapshot
```

The content-script bridge removes any need for the web app to know or hardcode
an extension ID. Extension source and build output live under `extension/` and
are not part of the Next.js source tree or production build.

## Version contract

- extension version: `0.1.0`;
- bridge protocol version: `1`;
- sanitized session snapshot schema version: `1`;
- channel: `focusflow-extension-bridge`.

Every envelope contains `channel`, `protocolVersion`, `type`, `requestId`,
`payload`, and `sentAt`. Both page and content script require
`event.source === window`, the exact current allowed origin, the expected
channel, a supported protocol version, an allowlisted message type, bounded
request IDs/strings/rules, and a bounded serialized message size. Unknown,
malformed, oversized, expired, or unsupported input is rejected with a typed
error and cannot mutate extension storage.

Page to extension messages:

- `FOCUSFLOW_BRIDGE_PING`;
- `FOCUSFLOW_SESSION_SYNC`;
- `FOCUSFLOW_SESSION_CLEAR`;
- `FOCUSFLOW_STATUS_REQUEST`.

Extension to page messages:

- `FOCUSFLOW_BRIDGE_READY`;
- `FOCUSFLOW_BRIDGE_PONG`;
- `FOCUSFLOW_SESSION_ACK`;
- `FOCUSFLOW_EXTENSION_STATUS`;
- `FOCUSFLOW_BRIDGE_ERROR`.

The page tracks request IDs, ignores unknown/replayed responses, times out
unanswered requests without console flooding, and removes listeners and timers
on unmount. Compatible responses establish the connected state; an explicit
unsupported-protocol error establishes the incompatible state.

## Sanitized session snapshot

Only a currently active or paused, reconciled protected Guard session may
produce a snapshot. Schema version 1 contains:

- `schemaVersion`;
- `guardSessionId` and `timerRunId`;
- `status` (`active` or `paused`);
- target label;
- protection level;
- profile ID and display name;
- normalized website-rule snapshot (`id`, pattern, match type, action, optional
  label);
- `startedAt`;
- `expectedEndAt` only while active;
- `pausedRemainingSeconds` only while paused;
- `updatedAt` and `expiresAt`.

The optional Guard intention is deliberately excluded in Phase 7. Application
rules are excluded until desktop scope exists.

The bridge never sends the complete task list, focus history, interruption
history, distraction text, self-rating, target outcome, daily/weekly
statistics, ambient settings, browser history, unrelated page content, or any
other `localStorage` value.

## Heartbeat, expiry, and service-worker lifecycle

The page sends a sync immediately when the protected snapshot changes and a
small heartbeat sync every 12 seconds while it remains active or paused.
Snapshots expire no later than 35 seconds after the latest sync. Active
snapshots also expire at their `expectedEndAt`, whichever occurs first. Paused
snapshots require the same heartbeat and therefore disappear after the page is
gone or disconnected.

Completion, reset, stop, mode switch, Guard disable, or reconciliation to no
protected session sends an explicit clear. Expiry is the fail-safe if clear is
lost. Duplicate sync and clear requests are idempotent.

The service worker reads `chrome.storage.session` on each request and discards
expired or malformed state before reporting status. Runtime messaging wakes a
suspended worker. Worker suspension therefore does not lose session state;
browser/extension restart may clear session storage and the next handshake
requests a resync. No `chrome.storage.local` or cloud-sync fallback is used.

## Connection UI and failure behavior

Focus Guard shows one informational state: `Menghubungkan…`,
`Extension terhubung`, `Extension tidak terdeteksi`, or
`Versi tidak kompatibel`. Missing or disconnected extension state never pauses,
stops, or prevents the web timer or Light Guard flow. There is no blocking
modal. The UI points development users to `extension/README.md`.

The page pings on mount and at a bounded interval. Each request allows six
seconds for an MV3 cold-start response, and the dedicated ping loop never has
more than one ping in flight. A single missed response does not downgrade an
established connection: three consecutive ping failures are required, which
detects a genuinely missing bridge in about 30 seconds under normal timer
scheduling. Any compatible READY, PONG, or acknowledgment resets the failure
counter and restores `connected`; an unsupported protocol remains immediately
`incompatible`. Responses that arrive after their request timed out no longer
have a pending request and are ignored. Unmount removes the listener, clears
every pending timeout, and rejects the pending promises without updating the
unmounted hook.

A ready announcement triggers a new handshake, but responses do not
recursively generate more pings. Extension reload invalidates the old
content-script context; a FocusFlow page reload establishes a new bridge and
resyncs the current protected session. Transient config/session/event request
timeouts do not independently downgrade liveness; the non-overlapping ping is
the single connection authority.

Malformed sync is rejected before storage mutation, so the previous valid
snapshot remains intact. Expired state is inactive and removed when next read.
An unguarded timer never produces an active protection snapshot.

## Build and installation

Source, build commands, Chrome/Edge load-unpacked instructions, worker
inspection, session-state cleanup, origin restrictions, privacy details, and
uninstall steps are documented in `extension/README.md`.

## Verification results

Completed on 2026-07-13:

- `npm run extension:build`: passed; generated `extension/dist` from isolated
  source;
- `npm run extension:check`: passed; Manifest V3, exact `storage` permission,
  two development origins, manifest/protocol version match, and script parsing;
- `npm run verify:focus-guard-phase7`: passed deterministic protocol/runtime
  checks for ping/pong, snapshot normalization, malformed envelope,
  unsupported protocol, unknown type, bounded strings/rules, expired snapshot,
  sync/clear idempotency, worker-restart storage recovery, previous-state
  preservation, and private-field exclusion;
- `npm run lint`: passed with no warnings/errors;
- `npx tsc --noEmit`: passed;
- `npm run build`: passed with Next.js 14.2.35; route `/` is 53.2 kB and first
  load JS is 140 kB;
- `git diff --check`: passed; Git emitted only non-blocking LF-to-CRLF warnings
  for existing working-tree files.

No dependency or test framework was added. The Next production build remains
separate from the extension build.

Liveness regression verification added after the v0.3.0 acceptance covers one
timeout without disconnect, threshold disconnect, successful recovery,
immediate incompatible state, delayed-response rejection, and pending timeout
cleanup on unmount. The protocol and extension version remain unchanged.

A later Chrome out-of-memory regression exposed a directional bridge defect:
the content script received its own response `window.postMessage`, treated the
response type as an unknown page request, and recursively posted error
responses. The content bridge now has an explicit request-type allowlist before
request validation. READY/PONG/ACK/STATUS/ERROR messages are ignored by the
content-side request listener and remain available to the page listener. The
Phase 7 harness executes the real content bridge with mocked page/runtime
boundaries and verifies that responses create zero runtime forwards and zero
error replies, while a valid page PING creates exactly one forward and one
PONG. Protocol version 3, snapshot schema 3, extension version 0.3.0, DNR, and
payload contracts remain unchanged.

## Manual integration QA

The available browser environment could load the FocusFlow page but could not
open a Chromium extension-management surface or install an unpacked extension.
The following was genuinely observed with no extension installed:

- the Focus Guard card reached `Extension tidak terdeteksi` after timeout;
- existing Guard/timer, review, stats, task, inbox, and sound UI rendered;
- after more than one bounded connection-check cycle, the page console contained
  no warning or error flood.

No connected handshake, runtime acknowledgment, storage-session inspection, or
active/pause/resume/clear end-to-end flow is claimed. Those acceptance steps
remain manual and are listed in `extension/README.md`: load the unpacked build,
verify connected status, active sync, pause, resume, reset/stop, natural and
overdue completion, Guard disable, page/extension reload, worker restart,
invalid/expired state, unguarded timer behavior, and both page/worker consoles.

## Known limitations

- Development origins are fixed to port 3000 until explicitly reviewed.
- Content scripts installed or reloaded after a page is already open may need a
  FocusFlow page reload.
- `chrome.storage.session` is temporary by design; browser/extension restart can
  require web-app resync.
- Expired values are removed on the next worker read rather than by a persistent
  background alarm.
- No URL evaluation, rule enforcement, block page, or bypass exists in Phase 7.

## Handoff to Phase 8

Phase 8 may consume only a currently valid schema-1 snapshot after explicit
approval. It must keep expiry checks at enforcement time and separately design
URL-rule precedence, blocking permissions, intervention UI, and safe bypass.
Phase 7 does not grant permission to begin that work.

Phase 7 manual acceptance is complete. Phase 8 was explicitly approved in the
next session and is documented separately in `PHASE_08_BROWSER_BLOCKING.md`.

## Files changed for Phase 7

- `.gitignore`;
- `package.json`;
- `extension/manifest.json`;
- `extension/README.md`;
- `extension/src/shared/protocol.js`;
- `extension/src/content/bridge.js`;
- `extension/src/background/session-store.js`;
- `extension/src/background/service-worker.js`;
- `extension/scripts/build.mjs`;
- `extension/scripts/check.mjs`;
- `scripts/verify-focus-guard-phase7.mjs`;
- `src/lib/focusGuardExtensionBridge.ts`;
- `src/hooks/useFocusGuardExtensionBridge.ts`;
- `src/components/guard/FocusGuardStatus.tsx`;
- `src/components/timer/PomodoroTimer.tsx`;
- `docs/focus-guard/PHASE_07_EXTENSION_BRIDGE.md`.
