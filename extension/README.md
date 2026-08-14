# FocusFlow Browser Guard — Phase 8+9 Final QA Guide

This isolated Chromium Manifest V3 extension implements the versioned FocusFlow bridge, active-session DNR protection, intervention/bypass flow, dynamic profile permission UI, and local recovery. Phase 7 was manually accepted. Phase 8+9 manual acceptance is intentionally pending this combined checklist.

## Build, install, and reload

From the repository root:

```bash
npm run extension:build
npm run extension:check
npm run verify:focus-guard-phase7
npm run verify:focus-guard-phase8
npm run verify:focus-guard-phase9
```

Load `extension/dist`, not `extension/src`. Next.js does not bundle the extension. After edits, rebuild, click **Reload** on the extension card, and reload FocusFlow so page/content/worker all use protocol v3.

Chrome: open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `extension/dist`. Edge uses the same process at `edge://extensions`. Open `https://focusflow-fawn-ten.vercel.app`, `http://localhost:3000`, or `http://127.0.0.1:3000` and confirm `Extension terhubung`.

## Permission model

Required permissions are `storage`, `declarativeNetRequest`, and `alarms`. The manifest declares `http://*/*` and `https://*/*` only as optional host permissions so custom profiles can name domains. This declaration does not grant access automatically.

The toolbar popup lists the selected/active profile and concrete required origins. Only **Izinkan origin yang belum tersedia** may call `chrome.permissions.request`, from that explicit gesture. It also shows granted/missing state, active DNR count, bypass state, revoke, and **Bersihkan proteksi lokal**. Saving, selecting, syncing, or importing a profile never prompts, grants permission, starts Guard, or installs blocking rules.

The extension never requests tabs, activeTab, history, webNavigation, webRequest, scripting, required `<all_urls>`, cookies, native messaging, notifications, screenshots, clipboard, browser-history, or page-content access.

## Rule syntax and precedence

- Domain: `tiktok.com` matches that domain and subdomains, never `nottiktok.com`.
- URL prefix: an absolute HTTP/HTTPS URL such as `https://youtube.com/shorts/`; matching is anchored and path-sensitive.
- Safe glob: for example `*://*.youtube.com/shorts/*`. Only HTTP/HTTPS or `*` scheme, exact/`*.` host, path, and `*` wildcard are supported. No arbitrary regex.

FocusFlow/localhost/extension origins, malformed URLs, equivalent rules, unsafe glob syntax, credentials, and fragments are rejected. Specificity wins; allow wins at equal specificity; order breaks remaining ties. Any invalid active profile fails open without partial FocusFlow rules.

## Temporary extension state

Inspect the service worker from the extension card. Session keys include:

```text
focusflow-active-protected-session-v3
focusflow-selected-profile-config-v1
focusflow-rule-contexts-v1
focusflow-active-bypasses-v1
focusflow-bypass-challenge-v1
focusflow-pending-events-v1
```

Use `chrome.storage.session.get(null)` for inspection. Normal pause/stop/completion/disable/expiry/recovery clears FocusFlow DNR state. Website rules use IDs `100000–199999`; bypass rules use `200000–299999`; unrelated DNR IDs are preserved.

## Privacy and import/export

Session/config sync contains only current profile identity, protection/bypass settings, normalized website rules, derived origins, target/timing/status metadata needed for active protection. It excludes full tasks, intention, history, distraction text, ratings, analytics, attempted full URL, browser history, DOM/page content, screenshots, clipboard, and telemetry.

Export contains only custom profiles and selected/default profile preference. Import requires a valid versioned file/paste preview. Merge is default; replacing custom profiles requires explicit confirmation. Built-ins cannot be overwritten. Import never exports/imports extension permissions and never starts protection.

## Combined Phase 8+9 manual QA

Do not mark final acceptance complete until all applicable steps are observed in Chrome or Edge:

1. Extension absent: FocusFlow reports disconnected; normal and Light timers work.
2. Load/reload `extension/dist`: protocol v3 connects without console loops.
3. Open Guard Profile Settings; verify Light and Browser Guard are immutable and Light remains default unless explicitly changed.
4. Duplicate each built-in; rename/edit/delete only the custom copy.
5. Create a Medium custom profile, edit bypass delay/duration/reason, reorder rules, save, and make it default.
6. Add malformed domain, URL, unsafe glob, localhost/FocusFlow origin, and equivalent rules; verify Indonesian validation and no save/partial protection.
7. Add TikTok domain block; verify popup lists concrete HTTP/HTTPS base/subdomain origins.
8. Deny permission: timer starts, status says permission required, TikTok is allowed.
9. Grant from popup gesture: granted origins and DNR count update; no silent prompts occur.
10. Active Medium/Strict + complete permission redirects TikTok; `nottiktok.com` remains allowed.
11. Light, paused, breaks, stopped, completed, disabled, expired, or disconnected state never blocks.
12. Create Shorts-only safe-glob rule. Verify base and `www` `/shorts/...` redirect while homepage, search, channel, and `/watch?...` remain allowed.
13. Verify an absolute URL-prefix rule is path-sensitive and does not affect sibling paths.
14. Add broad block plus narrower allow; verify the allow exception wins. Reverse specificity and verify the narrower block wins.
15. Reorder rules and verify deterministic behavior remains consistent with documented priority.
16. Inspect DNR rules: explicit priorities/IDs, main-frame only, no unrelated rule removal.
17. Intervention page shows target/profile/rule/remaining time, is responsive/keyboard usable, and stores no attempted URL.
18. One blocked navigation appears once in interruption/review without a duplicate generic excursion.
19. Bypass before delay and empty required reason are rejected; valid reason grants configured duration without retry extension.
20. Bypass expiry restores blocking while the active heartbeat remains valid; stopping during bypass clears both rule classes.
21. Stop heartbeats for more than 35 seconds; stale blocking fails open.
22. Suspend/reload worker during active session; reconciliation restores only valid current rules.
23. Revoke one required origin: all profile blocking fails open and status becomes permission-required; timer continues.
24. Use **Bersihkan proteksi lokal**: snapshot/block/bypass/alarms clear, unrelated rules and permission grants remain; a live page may safely resync later.
25. Export config and inspect JSON: only custom profiles/preference are present.
26. Import malformed/wrong-version/built-in overwrite files: preview rejects and storage remains unchanged.
27. Import valid config with merge, then explicitly replace custom profiles; built-ins remain canonical and no permission prompt/Guard start occurs.
28. Change a stored profile during an active session; the active session snapshot/history remains unchanged until a new session.
29. Reload page/extension, deny/grant/revoke origins, and repeat active/pause/resume/clear transitions without error floods.
30. Confirm page, popup, intervention, and service-worker consoles are clean.

Record browser/version, origins tested, and any skipped step. Code/harness success is not end-to-end acceptance.

## Development origins and uninstall

The content script only runs on the exact production origin and the two port-3000 development origins. To use another origin, add that exact origin to the manifest content-script matches and both bridge allowlists, then rebuild/reload; never add required `<all_urls>`.

To uninstall, choose **Remove** on `chrome://extensions` or `edge://extensions`. Extension permissions and temporary state are removed; FocusFlow website data remains local and its timer continues without the extension.
