# Phase 8 — Website Blocking MVP

Status: code-complete. Phase 7 manual unpacked-extension acceptance was confirmed by the user on 2026-07-13; Phase 8 manual QA is intentionally combined with the final Phase 8+9 acceptance pass.

## Scope and permission boundary

Phase 8 adds session-scoped main-frame blocking for the canonical Browser Guard profile only. It does not inspect page content, retain attempted URLs, implement path rules, or start Phase 9.

The Manifest V3 extension uses these required permissions:

- `storage` for temporary `chrome.storage.session` snapshot, rule context, bypass, challenge, and bounded event-queue state;
- `declarativeNetRequest` for FocusFlow-owned DNR session rules;
- `alarms` for snapshot and bypass expiry reconciliation across service-worker suspension.

Host access is optional. The manifest declares only the Browser Guard domain patterns:

- `*://tiktok.com/*`
- `*://*.tiktok.com/*`

The extension does not request `tabs`, `activeTab`, `history`, `webNavigation`, `webRequest`, `scripting`, cookies, notifications, native messaging, or required `<all_urls>` access. Optional host permission is requested only from an explicit button click in the extension popup. Permission denial or revocation leaves the web timer and Guard session running and makes blocking fail open.

## Version boundary

Phase 8 moves the page/content/service-worker protocol and session snapshot schema to version 2, and the extension to version 0.2.0. Page and extension versions that do not support protocol 2 report an incompatible state; messages are not silently interpreted using another schema.

## Browser Guard built-in profile

`focusflow-guard-profile-browser-built-in` is synthesized canonically beside the existing Light profile. Browser Guard is Medium protection with one domain block rule for `tiktok.com`, subdomains included, no application rules, and an emergency bypass requiring a reason after 10 seconds for a fixed five-minute duration. Light remains the default profile.

## DNR safety policy

Blocking uses `chrome.declarativeNetRequest.updateSessionRules`. Redirect rules apply only to `main_frame` requests and use the domain-safe `requestDomains` condition. Exact `tiktok.com` and its subdomains match; lookalikes such as `nottiktok.com` do not.

FocusFlow reserves numeric session-rule IDs `100000–199999` for redirect rules and `200000–299999` for temporary bypass allow rules. Redirect priority is 10 and bypass priority is 20. Reconciliation removes or replaces only rules in these ranges, so unrelated extension rules are untouched.

The personal-MVP safety policy is fail open: missing, malformed, paused, Light, expired, or uncertain session state produces no FocusFlow blocking rules. Missing host permission also produces no rule and an honest permission-required status. Snapshot expiry is capped by the active timer deadline. Clear, pause, completion, disable, and expiry remove all FocusFlow block and bypass rules.

## State machine

- no valid snapshot, disconnected, expired, or cleared → no FocusFlow DNR rules;
- active Light → no FocusFlow DNR rules;
- active Medium/Strict without granted domain permission → permission required, no redirect;
- active Medium/Strict with granted permission → scoped redirect rule installed;
- paused → block and bypass rules removed;
- active scoped bypass → redirect remains and a higher-priority allow rule applies only to that configured domain;
- bypass expired while the session remains active → allow rule removed and redirect becomes effective again.

Every transition is idempotent. Startup, installation/update, alarms, permission changes, and every accepted snapshot sync re-read canonical session storage and reconcile the same desired session rules.

## Intervention, event, and privacy contract

The redirect target is an extension-owned page receiving only a validated internal rule token. The full requested URL is neither included in the redirect URL nor stored. The page displays the configured rule label/domain, sanitized target label, profile name, and remaining time.

Opening the page creates a bounded, expiring, deduplicated `blocked-site` event. A valid emergency bypass creates a separate `emergency-bypass` event. The queue is temporary `storage.session` state and is drained through the versioned page bridge; the web app persists records through the existing local FocusInterruption repository and acknowledges event IDs before queue deletion.

The extension receives only the current protected-session snapshot: target label, profile identity and protection/bypass settings, normalized website rules, status, and timing metadata. It does not receive full task lists, distraction content, interruption history, ratings, analytics, ambient settings, browsing history, page content, or full attempted URLs. A bypass reason is user-entered, bounded to 200 characters, and is explicitly persisted locally as the emergency-bypass interruption note.

## Architecture and protocol

```text
FocusFlow page (schema v2 snapshot + event drain/ack)
  ↕ validated window.postMessage on the current FocusFlow origin
content script (no DOM/localStorage reads)
  ↕ chrome.runtime messaging
MV3 service worker
  ├─ chrome.storage.session
  ├─ chrome.permissions
  ├─ DNR session rules
  └─ alarms
       ↕
popup permission UI + intervention page
```

Protocol v2 retains ping, session sync/clear, status, ready/pong, session acknowledgment, status response, and typed errors. It adds `FOCUSFLOW_EVENT_DRAIN` / `FOCUSFLOW_EVENT_BATCH` and `FOCUSFLOW_EVENT_ACK` / `FOCUSFLOW_EVENT_ACKNOWLEDGED`. Every page/content message keeps the Phase 7 channel, origin/source checks, request ID, bounded payload, and allowlist. Unknown or malformed messages do not mutate valid state.

Snapshot schema v2 adds only the allowlisted FocusFlow origin and canonical bypass policy. It still excludes intention and application rules. Active expiry is the smaller of the 35-second heartbeat lease and timer deadline; paused state remains fail-open and is refreshed by the 12-second heartbeat.

## Intervention and bypass lifecycle

The extension page is local, responsive, keyboard accessible, reduced-motion aware, Indonesian, and uses no remote asset or inline script. `Kembali fokus` navigates without tabs permission. An expired/unknown rule token produces a generic inactive page.

The service worker creates a server-timed challenge when the user opens bypass. Activation validates the live Guard session, configured rule token, 10-second `availableAt`, required bounded reason, and canonical five-minute duration. Client input cannot choose duration. A repeated activation returns the existing expiry and cannot extend it. A priority-20 allow session rule applies only to the configured domain. Its alarm removes the allow rule; if a live snapshot remains, the priority-10 redirect is effective again.

## Event and review integration

Intervention attempts use a stable page-attempt ID and a deterministic event ID, so reload/retry does not duplicate the queued record. The queue retains at most 100 valid events for at most 24 hours in `storage.session`. The web repository is already ID-idempotent; acknowledgment removes an extension event only after local persistence succeeds.

`blocked-site` and `emergency-bypass` remain separate FocusInterruption types. Session review and seven-day insight summaries expose blocked and bypass counts descriptively. A blocked event removes a nearby unresolved generic page-hidden/window-blur record, and attention awareness skips a nearby known blocked attempt, avoiding presentation as two unrelated distractions.

## Files changed

- extension manifest, shared protocol, content/service-worker pipeline, session handler;
- new DNR compiler/engine and bounded event queue;
- new popup and intervention HTML/CSS/JavaScript;
- Browser Guard canonical profile and interruption persistence fields;
- web bridge hook, Focus Contract/status UI, attention dedupe, review/insights;
- Phase 6/7 compatibility harness updates and new Phase 8 harness;
- extension README and Phase 7/8 documentation.

## Verification results

Completed on 2026-07-13:

- `npm run lint` — passed, no warnings;
- `npx tsc --noEmit` — passed;
- `npm run build` — passed;
- `npm run extension:build` — passed, generated extension 0.2.0 in `extension/dist`;
- `npm run extension:check` — passed: MV3, minimum required permissions, scoped optional hosts, allowed dev origins, and all scripts parse;
- `npm run verify:focus-guard-phase7` — passed after the intentional protocol/schema v2 migration;
- `npm run verify:focus-guard-phase8` — passed for canonical profile, normalization/matching, lookalikes, ID ranges, Light/paused/expired/missing-permission behavior, reconciliation/idempotency, event queue/ack/dedupe, bypass delay/reason/duration/idempotency/expiry, worker restart, rule cleanup, and URL privacy;
- `node scripts/verify-focus-guard-phase6.mjs` — passed, preserving review behavior with explicit block/bypass counts.

- `git diff --check` — passed; Git emitted only existing Windows line-ending conversion notices.

## Manual integration QA

Phase 7 manual unpacked-extension acceptance is confirmed by the user. A local
in-app browser smoke test confirmed that the web app hydrates, reports
`Extension tidak terdeteksi`, keeps the timer controls usable, renders explicit
blocked/bypass insight metrics, and produces no page-console errors. The test
timer was reset immediately after the smoke check.

Phase 8 real-browser acceptance is still pending because this implementation run did not grant a Chrome/Edge optional host permission or navigate a loaded unpacked extension through a real TikTok redirect. The exact 24-step Phase 8 checklist is in `extension/README.md`; build/harness success and the extension-absent smoke test are not presented as end-to-end DNR evidence.

## Known limitations

- Chromium Chrome/Edge and two port-3000 development origins only;
- one canonical built-in TikTok domain rule; no custom editor, allow precedence, or URL-path refinement;
- `storage.session` is temporary and browser restart may require page resync;
- the extension cannot return to an arbitrary production origin until that exact origin is reviewed and allowlisted;
- event delivery waits for a connected FocusFlow page and remains bounded/expiring meanwhile;
- bypass offers the configured domain root, not the original destination, because attempted full URLs are deliberately unavailable;
- optional permission prompt behavior and real DNR intervention/bypass timing still require the documented unpacked-extension QA.

## Handoff to Phase 9

Phase 8 is code-complete once the final verification commands pass. Phase 9 must not begin without explicit approval. A future phase may design additional precedence/path semantics, permission UX for more domains, and broader analytics, but must preserve protocol versioning, fail-open stale-state behavior, reserved DNR ranges, event idempotency, and the no-full-URL privacy boundary.

## Verification and manual QA

See `extension/README.md` for build/install, service-worker inspection, state cleanup, permission grant/revoke, uninstall, and the complete manual checklist. Phase 9 is not part of this change.
