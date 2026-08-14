# Phase 9 — Guard Profiles and Rule Refinement

Status: code-complete; combined Phase 8+9 unpacked-extension QA is intentionally deferred.

## Scope and permission boundary

Phase 9 adds local custom-profile management, website-rule refinement, permission requirement synchronization, and profile import/export. It does not start desktop scope, Phase 10, or Phase 11.

Required extension permissions remain `storage`, `declarativeNetRequest`, and `alarms`. To support user-defined domains, the manifest may declare `http://*/*` and `https://*/*` only as `optional_host_permissions`. The popup requests only normalized, profile-derived origins after an explicit user click. Saving/importing/selecting a profile never grants permission and never starts blocking. No tabs, history, webNavigation, webRequest, scripting, required `<all_urls>`, page-content collection, or attempted-full-URL storage is added.

## Version and config boundary

The page/content/worker protocol, sanitized session snapshot schema, and extension move together to version 3 / 3 / 0.3.0. A new config-sync message contains only the selected profile ID/name/protection level, normalized website rules, bypass policy, and derived required origins. Config state is temporary extension session state for popup/status display. Blocking remains exclusively driven by a valid, active protected-session snapshot.

## Supported rule syntax

- `domain`: lowercase hostname such as `tiktok.com`; exact domain and subdomains match, lookalikes do not.
- `url-prefix`: absolute HTTP/HTTPS URL with a hostname and path; matching is anchored and path-sensitive.
- `url-pattern`: safe glob only. Scheme is `http`, `https`, or `*`; host is exact or `*.` subdomain form; path may contain `*`. Arbitrary regex, credentials, fragments, control characters, and regex metacharacter syntax are rejected.

FocusFlow development origins, localhost/loopback targets, and extension URLs are rejected. Equivalent match targets are rejected regardless of action so ambiguous duplicate configuration cannot be installed.

## Deterministic precedence

Every rule gets a deterministic numeric DNR ID in the FocusFlow website-rule range. Priority is derived from match specificity and normalized literal length. URL prefix is more specific than a safe glob with equivalent literal content, and both are more specific than a domain-wide rule. At equal specificity, explicit allow wins. Persisted rule order is the final deterministic tie-breaker. Emergency bypass allow rules remain in a separate higher-priority range.

This permits a narrow allow rule to exclude a URL from a broad block while a narrow block can still override a broad allow. If any rule in a profile is malformed, unsupported, equivalent, or cannot be compiled completely, reconciliation installs none of that profile’s FocusFlow rules and reports an error.

## Import/export and privacy

Export schema version 1 contains only custom profiles plus the selected/default profile preference when relevant. It excludes built-ins, tasks, timer state, sessions/history, interruptions, distraction text, ratings, analytics, extension permission grants, and extension state.

Import is parsed and normalized without mutation, then shown as a preview. Merge is the default. Replacing custom profiles requires an explicit choice. Built-in IDs/namespaces cannot be overwritten. Wrong-version or malformed input causes no storage mutation, permission request, config activation, or Guard start.

## Profile settings UI

`GuardProfileSettings` is opened from the Focus Guard status card. It lists immutable built-ins and custom profiles; supports create, duplicate, rename, Light/Medium/Strict, default selection, emergency-bypass settings, add/edit/delete/reorder website rules, YouTube Shorts preset, custom-profile deletion, export, file/paste import preview, default merge, and explicitly confirmed replace. Built-ins can be duplicated but not edited, deleted, or overwritten by import. Active Guard sessions retain their existing profile snapshot when a stored profile changes.

## Compiler and permission lifecycle

The page sends protocol-v3 config sync whenever the selected profile changes. Config sync is stored separately under `focusflow-selected-profile-config-v1`; it is used only by popup/status and cannot install rules. The popup displays selected/active profile, every required origin with granted/missing state, installed DNR count, active bypass state, grant/revoke actions, and `Bersihkan proteksi lokal` recovery.

The compiler validates the complete active snapshot before checking permissions. Missing any required origin installs no profile rules and reports permission-required. A malformed/equivalent rule set clears all FocusFlow rules and reports error. Granted complete profiles compile domain conditions, anchored URL-prefix filters, or generated safe RE2-compatible glob filters. Allow and redirect rules share the website-rule ID range; bypass remains in its higher reserved range.

## Verification results

Completed deterministic coverage includes:

- profile create/update/delete/duplicate and built-in immutability;
- domain/subdomain/lookalike behavior;
- URL-prefix path sensitivity;
- YouTube Shorts on base/www versus watch, homepage, search, and channel URLs;
- allow/block specificity, priorities, deterministic IDs, and duplicate rejection;
- profile-derived HTTP/HTTPS origins;
- invalid-profile fail-open with no partial DNR rules;
- config-sync privacy;
- export/import schema, preview validation, merge/replace, and built-in overwrite rejection;
- recovery cleanup preserving unrelated DNR IDs;
- Phase 6, 7, and 8 harness compatibility.

The final command matrix and current manual-acceptance status are recorded in `SESSION_03_CHECKPOINT.md`.

Final verification passed: lint, TypeScript no-emit, Next production build, extension build/check, Phase 6 harness, Phase 7–9 harnesses, and `git diff --check`. Manual Chrome/Edge extension acceptance remains intentionally pending.

## Known limitations

- Chromium Chrome/Edge and local FocusFlow origins remain the browser scope.
- Safe glob deliberately supports only scheme, exact/`*.` host, path, and `*`; query-sensitive matching and arbitrary regex are rejected.
- URL prefix targets one explicit scheme/host. Use safe glob when both HTTP/HTTPS or base/subdomains are intended.
- Permission declaration is broad but optional; the popup requests only concrete profile-derived origins.
- Config and extension runtime state remain device/session local; there is no cloud sync.
- Combined real-browser permission, redirect, allow precedence, bypass, recovery, and responsive QA remains pending by user decision.

## Phase 9 boundary

Phase 9 stops here. No desktop companion, application-rule enforcement, Phase 10, or Phase 11 work was started.
