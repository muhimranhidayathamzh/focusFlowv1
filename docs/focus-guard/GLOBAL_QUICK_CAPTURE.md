# Global Quick Capture

## Outcome

FocusFlow distractions can be captured from any active Chromium tab without navigating back to the FocusFlow page. Extension version `0.4.0` uses bridge protocol `4`; the protected-session snapshot schema remains `3`.

## Entry points

- `Alt + Shift + D` opens the extension side panel.
- The extension popup includes a compact fallback form.
- The blocked-site intervention page includes **Simpan untuk nanti**.
- The existing web-only `Ctrl + Shift + D` flow remains unchanged.

## Delivery lifecycle

```text
User submit
  -> service worker validates text (1-300 characters)
  -> stable capture ID is queued in chrome.storage.local
  -> connected FocusFlow drains a bounded batch
  -> web writes through addDistractionItem (ID-deduplicated)
  -> web acknowledges stored IDs
  -> extension removes acknowledged queue items
```

The queue is serialized in-memory per service-worker lifetime, capped at 50 items, and prunes records older than seven days. A lost response is safe: delivery retries with the same ID and the existing web persistence returns the previously stored item.

## Privacy boundary

Capture storage contains only:

- stable capture ID;
- user-entered text;
- capture timestamp;
- optional Guard session ID when a live snapshot exists.

It does not inspect or store URL, tab title, browser history, page content, screenshots, clipboard, or keystrokes. Session/config snapshots still exclude distraction text. Text uses dedicated `CAPTURE_DRAIN` / `CAPTURE_ACK` messages only after explicit user submission.

## Permissions

`sidePanel` is added to the existing `storage`, `declarativeNetRequest`, and `alarms` permissions. No `tabs`, `activeTab`, `history`, `webNavigation`, `scripting`, `notifications`, `nativeMessaging`, or required host permission is added.

## Verification

Automated coverage is provided by:

```bash
npm run verify:focus-guard-quick-capture
npm run verify:resource-bounds
```

Real shortcut opening and unpacked-extension delivery still require Chrome/Edge manual QA after rebuilding and reloading `extension/dist`.
