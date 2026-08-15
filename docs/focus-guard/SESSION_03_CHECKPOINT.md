# Focus Guard — Session 3 Checkpoint

> Post-checkpoint addendum: extension 0.4.0 adds browser-wide Quick Capture
> through the `sidePanel` permission and protocol 4. Snapshot schema 3 and the
> existing DNR permission boundary are unchanged. See
> `GLOBAL_QUICK_CAPTURE.md`.

Date: 2026-07-13
Scope completed: Phase 7 communication proof, Phase 8 Website Blocking MVP, Phase 9 Guard Profiles and Rule Refinement.

## Status

- Phase 7: code-complete and manually accepted by the user.
- Phase 8: code-complete; manual QA intentionally deferred into combined final QA.
- Phase 9: code-complete; combined Phase 8+9 manual QA pending.
- Roadmap Phase 0–9: code-complete.
- Phase 10–11 and desktop companion: not started.

## Delivered architecture

FocusFlow uses a versioned page/content/service-worker bridge. Protocol and active snapshot schema are version 3; extension version is 0.3.0. Selected-profile config sync is separate from active-session sync and cannot activate blocking.

The web app owns local canonical profiles, validation, import/export, and active-session snapshots. The extension owns optional host permission prompts, DNR session rules, intervention/bypass state, alarms, and temporary event delivery. Missing/invalid/stale state fails open.

## Profile and rule model

Built-ins remain canonical: Light Protection is the default and never blocks; Browser Guard is immutable and blocks TikTok. Both may be duplicated into custom profiles. Custom profile editing includes protection level, bypass policy, ordered block/allow rules, and default selection.

Supported rule types are domain, absolute HTTP/HTTPS URL prefix, and restricted safe glob. Equivalent targets are rejected. Specificity determines priority; allow wins only at equal specificity, and stored order is the final tie-breaker. The YouTube Shorts preset uses `*://*.youtube.com/shorts/*`, whose semantics include the base domain and subdomains without matching normal YouTube pages.

## Permission and privacy checkpoint

Required manifest permissions: storage, declarativeNetRequest, alarms. Optional declaration: HTTP/HTTPS wildcard host access, never required `<all_urls>`. The popup requests only normalized concrete origins after explicit user gesture and can revoke them.

No attempted full URL, browser history, page content, task list, Guard/session history, distraction text, rating, analytics, screenshot, clipboard, telemetry, or permission grant is included in config export/sync. Import does not grant permission or start Guard.

## Verification checkpoint

Required final commands:

- `npm run lint`;
- `npx tsc --noEmit`;
- `npm run build`;
- `npm run extension:build`;
- `npm run extension:check`;
- Phase 6 deterministic harness;
- `npm run verify:focus-guard-phase7`;
- `npm run verify:focus-guard-phase8`;
- `npm run verify:focus-guard-phase9`;
- `git diff --check`.

All commands passed on 2026-07-13. `git diff --check` emitted only the existing Windows line-ending conversion notices and no whitespace errors. No final manual extension acceptance is claimed.

## Combined manual QA handoff

Use the complete Phase 8+9 checklist in `extension/README.md`. It must cover extension absent/present, dynamic permission grant/deny/revoke, Light and Browser Guard, custom TikTok/YouTube rules, URL-prefix path sensitivity, Shorts versus normal YouTube, allow precedence, pause/resume/clear/stale expiry, worker restart, intervention/event dedupe, bypass timing, recovery cleanup, config sync, import/export preview/merge/replace, built-in immutability, responsive/keyboard behavior, privacy inspection, and clean consoles.

## Dirty-tree and continuation boundary

The pre-existing mixed dirty working tree was preserved. No reset, clean, checkout, stage, or commit was performed. A future session should begin by reading this checkpoint, Phase 8/9 docs, current git status/diff, and the combined QA guide. Do not begin Phase 10–11 without explicit approval after final QA disposition.
