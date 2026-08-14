# Focus Guard Phase 2 — Domain and Storage Foundation

Tanggal implementasi: 2026-07-12 (Asia/Makassar)

## 1. Scope dan outcome

Phase 2 menambahkan typed domain model, normalized localStorage repositories,
dan focused React hooks untuk Focus Guard. Tidak ada UI, Focus Contract,
attention tracking, distraction detection, timer integration, atau blocking.

Foundation yang tersedia:

- profile dan website/application rule management;
- canonical built-in Light Protection profile;
- opt-in preferences dengan safe selected-profile fallback;
- single active guard-session lifecycle dan bounded history;
- interruption event collection;
- standalone/session-linked distraction inbox;
- schema versioning, malformed-record filtering, duplicate-ID handling;
- same-tab custom events dan cross-tab storage subscriptions.

## 2. Phase 1 preflight gate

Phase 1 diinspeksi ulang sebelum Phase 2. Browser QA membuktikan:

- active refresh mempertahankan timer active dan wall-clock remaining
  (`00:58` menjadi `00:57` setelah reload);
- overdue completion menambah satu FocusSession dan repeated recovery reload
  tidak menambah history lagi.

Browser control kemudian tidak stabil sehingga paused refresh, fourth-focus long
break, target snapshot, settings snapshot, two-tab dedupe, dan owner takeover
tidak diklaim lulus manual. Masing-masing menjalani deterministic code-path
review dan tidak ditemukan defect konkret. Detail ditambahkan ke
`PHASE_01_RELIABLE_TIMER.md`.

## 3. Final domain model

### Profiles dan rules

```ts
type ProtectionLevel = 'light' | 'medium' | 'strict';

interface WebsiteRule {
  id: string;
  pattern: string;
  matchType: 'domain' | 'url-prefix' | 'url-pattern';
  action: 'block' | 'allow';
  label?: string;
}

interface ApplicationRule {
  id: string;
  identifier: string;
  label: string;
  action: 'warn' | 'block';
}

interface FocusGuardProfile {
  id: string;
  kind: 'built-in' | 'custom';
  name: string;
  protectionLevel: ProtectionLevel;
  websiteRules: WebsiteRule[];
  applicationRules: ApplicationRule[];
  emergencyBypassAllowed: boolean;
  bypassDelaySeconds: number;
  bypassDurationMinutes: number;
  requireBypassReason: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### Guard session

```ts
interface FocusGuardSession {
  id: string;
  timerRunId?: string;
  focusSessionId?: string;
  profileId: string;
  profileSnapshot: FocusGuardProfileSnapshot;
  targetSnapshot?: FocusTarget;
  intention?: string;
  protectionLevel: ProtectionLevel;
  status: 'active' | 'paused' | 'completed' | 'stopped';
  startedAt: number;
  expectedEndAt: number;
  durationSeconds: number;
  pausedAt?: number;
  pausedRemainingSeconds?: number;
  endedAt?: number;
  endReason?: 'completed' | 'stopped' | 'recovered';
}
```

`profileSnapshot` menyimpan nama, level, rules, dan bypass configuration agar
history tetap bermakna setelah source profile diedit atau dihapus.

Pause/resume hanya foundation API. Phase 2 tidak menghubungkannya ke timer.

### Interruptions dan distractions

```ts
interface FocusInterruption {
  id: string;
  guardSessionId: string;
  occurredAt: number;
  returnedAt?: number;
  type:
    | 'page-hidden'
    | 'window-blur'
    | 'blocked-site'
    | 'blocked-app'
    | 'emergency-bypass'
    | 'thought';
  source?: string;
  note?: string;
  resolution?:
    | 'returned'
    | 'intentional'
    | 'captured'
    | 'bypassed'
    | 'unknown';
}

interface DistractionItem {
  id: string;
  text: string;
  capturedAt: number;
  guardSessionId?: string;
  status: 'inbox' | 'converted-to-task' | 'dismissed';
  convertedTaskId?: string;
  resolvedAt?: number;
}
```

Tidak ada code yang otomatis membuat interruption dari page leave/window blur.
Tipe tersebut hanya vocabulary untuk fase mendatang.

Phase 4 menambahkan resolution `intentional` secara backward-compatible untuk
aksi “Ini bukan distraksi”. Schema envelope tetap version 1; record Phase 2
dengan resolution lama atau tanpa resolution tetap valid.

### Preferences

```ts
interface FocusGuardPreferences {
  guardEnabled: boolean;
  selectedProfileId: string;
  updatedAt: number;
}
```

Default adalah `guardEnabled: false`.

## 4. Built-in Light Protection profile

Stable ID:

```text
focusflow-guard-profile-light-built-in
```

Canonical values:

- name: `Light Protection`;
- protection level: `light`;
- website/application rules: kosong;
- emergency bypass: tersedia;
- bypass delay: 10 detik;
- bypass duration: 5 menit;
- bypass reason: tidak wajib;
- stable built-in timestamps: `0`.

Loader selalu menyintesis canonical profile sebagai item pertama. Stored record
dengan built-in ID tidak dipercaya untuk mengubah canonical values. Built-in
tidak dapat di-update/delete melalui custom-profile API dan dapat di-reset
secara eksplisit.

## 5. Storage keys dan schema

Seluruh key menggunakan envelope dengan `schemaVersion: 1` dan `updatedAt`.

| Key | Value |
| --- | --- |
| `focusflow-guard-profiles-v1` | Collection envelope `FocusGuardProfile[]` |
| `focusflow-active-guard-session-v1` | Value envelope `FocusGuardSession \| null` |
| `focusflow-guard-session-history-v1` | Collection envelope ended sessions |
| `focusflow-guard-interruptions-v1` | Collection envelope interruptions |
| `focusflow-distraction-inbox-v1` | Collection envelope distractions |
| `focusflow-guard-preferences-v1` | Value envelope preferences |

Collection envelope:

```ts
{
  schemaVersion: 1;
  items: T[];
  updatedAt: number;
}
```

Value envelope:

```ts
{
  schemaVersion: 1;
  value: T;
  updatedAt: number;
}
```

Bounds:

- session history: 200;
- interruptions: 1,000;
- distraction items: 500;
- profiles: 200 read boundary.

## 6. Normalizer rules

General:

- malformed JSON, wrong envelope, dan wrong schema version fail safe;
- invalid collection item diabaikan tanpa membuang valid siblings;
- duplicate IDs memakai first valid occurrence deterministically;
- required strings di-trim, internal whitespace dipadatkan, dan panjang dibatasi;
- optional blank strings menjadi `undefined`;
- timestamps harus finite dan non-negative;
- enum values harus recognized;
- unknown fields diabaikan dan tidak menyebabkan crash;
- collection writes selalu membaca storage terbaru terlebih dahulu.

Profile/rule-specific:

- bypass delay: integer 0..300 detik;
- bypass duration: integer 1..60 menit;
- `updatedAt >= createdAt`;
- invalid rules dibuang individual;
- duplicate rule IDs memakai first valid rule.

Session-specific:

- profile ID dan snapshot profile ID harus sama;
- session protection level dan snapshot level harus sama;
- `expectedEndAt >= startedAt`;
- active/paused session tidak menerima end metadata;
- paused session wajib memiliki finite `pausedAt` dan remaining 0..86400;
- completed/stopped history wajib memiliki endedAt/endReason konsisten.

Distraction-specific:

- converted item wajib memiliki `convertedTaskId`;
- converted/dismissed item wajib memiliki `resolvedAt`;
- inbox item tidak menyimpan stale resolution metadata.

## 7. Repository dan hook APIs

### `useFocusGuardProfiles`

- `profiles`, `selectedProfile`, `defaultProfileId`;
- `createProfile(input)`;
- `updateProfile(profileId, updates)` untuk custom profile;
- `deleteProfile(profileId)` dengan preference fallback;
- `resetLightProfile()`.

### `useFocusGuardPreferences`

- `preferences`;
- `setGuardEnabled(boolean)`;
- `selectProfile(profileId)` dengan built-in fallback.

### `useFocusGuardSession`

- `activeSession`, `history`;
- `startSession(input)`;
- `pauseSession(sessionId, pausedAt?)`;
- `resumeSession(sessionId, resumedAt?)`;
- `completeSession(sessionId, options?)`;
- `stopSession(sessionId, endedAt?)`.

Session mutation mengembalikan typed result:

```ts
{ ok: true, session, alreadyApplied }
```

atau failure reason:

```text
active-session-exists
session-conflict
session-not-found
invalid-input
storage-failed
```

### `useFocusInterruptions`

- all/session-filtered interruptions;
- `addInterruption`;
- `updateResolution` dan optional `returnedAt`;
- explicit `clearInterruptions(sessionId?)`.

### `useDistractionInbox`

- all, inbox-only, dan session-filtered items;
- `addItem`;
- `markConvertedToTask`;
- `dismissItem`;
- explicit `clearItems(sessionId?)`.

Setiap hook expose `isLoaded` dan subscribe ke same-tab custom event serta
cross-tab `storage` event. Event handler hanya reload; tidak menulis kembali,
sehingga tidak membuat write loop.

## 8. Atomicity, idempotency, dan consistency

- `startSession` berada di exclusive Web Lock
  `focusflow-guard-session-mutation-v1` bila API tersedia.
- Start selalu reread active storage di dalam mutation lock dan mengembalikan
  `active-session-exists`; active record tidak ditimpa diam-diam.
- Start menolak ID yang sudah ada di history dan memverifikasi persisted active
  ID setelah write.
- Pause/resume/complete/stop menggunakan lock yang sama.
- Repeated pause/resume pada state yang sudah sesuai mengembalikan
  `alreadyApplied: true`.
- Complete/stop menulis bounded history sebelum membersihkan active record.
- Repeated complete/stop menemukan historical ID dan mengembalikan success
  idempotent tanpa duplicate history.
- History write deduplicates session ID.
- Menghapus selected custom profile menyimpan preference fallback ke built-in.
- Historical profile snapshot tidak bergantung pada profile collection.

Browser tanpa Web Locks menjalankan optimistic reread/write/verify path. Ini
lebih aman daripada blind overwrite, tetapi localStorage tidak menyediakan CAS;
lihat known limitations.

## 9. Backward compatibility dan product isolation

- Enam storage key baseline tidak diubah/dihapus.
- Empat key reliable timer Phase 1 tidak diubah/dihapus.
- Tidak ada guard hook yang di-import oleh current page/components.
- Tidak ada UI behavior, timer behavior, stats, task, goal, atau sound behavior
  yang berubah pada Phase 2.
- Guard session memiliki optional `timerRunId` dan `focusSessionId`, tetapi belum
  ada integration code.
- Focus Guard tetap opt-in dan default disabled.

## 10. Files changed

Phase 2 files:

- `src/types/focusGuard.ts`;
- `src/types/distraction.ts`;
- `src/lib/focusGuardPersistence.ts`;
- `src/hooks/useGuardStorageSubscription.ts`;
- `src/hooks/useFocusGuardProfiles.ts`;
- `src/hooks/useFocusGuardPreferences.ts`;
- `src/hooks/useFocusGuardSession.ts`;
- `src/hooks/useFocusInterruptions.ts`;
- `src/hooks/useDistractionInbox.ts`;
- `docs/focus-guard/PHASE_02_DOMAIN_STORAGE.md`.

Phase 1 preflight documentation update:

- `docs/focus-guard/PHASE_01_RELIABLE_TIMER.md`.

## 11. Verification results

### Lint dan build

- `npm run lint`: lulus tanpa warning/error.
- Initial build menemukan satu TypeScript narrowing error pada interruption type;
  diperbaiki secara lokal.
- Final `npm run build`: lulus, termasuk TypeScript validation dan static page
  generation 4/4.

### Deterministic in-memory storage harness

Harness mentranspilasi repository TypeScript di memory dan memakai isolated Map
sebagai localStorage; tidak menulis browser/user storage. Sepuluh checks lulus:

1. guard default disabled;
2. default selected profile adalah canonical Light;
3. profile string normalization;
4. malformed/duplicate profile filtering dan built-in restoration;
5. selected-profile fallback setelah deletion;
6. normalized session start;
7. active-session overwrite rejection;
8. idempotent complete dan single history ID;
9. interruption invalid-sibling filtering;
10. distraction invalid-sibling filtering.

Result:

```json
{"passed":true,"checks":10,"history":1,"profiles":1}
```

Tidak ada test runner/script `test` di repo; harness dijalankan sebagai temporary
in-memory command dan tidak menambahkan dependency/file.

## 12. Manual QA checklist

- [ ] Mount profiles hook dengan empty storage; pastikan Light selalu item pertama.
- [ ] Create/update/delete custom profile; verify same-tab hook reload.
- [ ] Pilih custom profile lalu delete; verify persisted preference menjadi Light.
- [ ] Corrupt built-in stored record; verify canonical Light tetap muncul.
- [ ] Inject invalid profile/rule sibling dan duplicate IDs; valid first items tetap.
- [ ] Enable/disable guard preference dan verifikasi refresh/cross-tab sync.
- [ ] Start session lalu start kedua dari tab lain; kedua harus mendapat typed
  conflict, bukan overwrite.
- [ ] Pause/resume dan refresh; verify active value shape.
- [ ] Complete dan stop berulang; history tetap satu ID dan active null.
- [ ] Edit/delete source profile setelah session selesai; history snapshot tetap.
- [ ] Add/update/query/clear interruptions.
- [ ] Add standalone dan session-linked distraction; convert/dismiss/query/clear.
- [ ] Inject malformed JSON/wrong schema/invalid timestamps/enums pada enam key;
  app/hook tidak crash dan valid siblings tetap.
- [ ] Verify dua tab menerima storage changes tanpa event/write loop.
- [ ] Confirm current FocusFlow UI/timer behavior tidak berubah.

## 13. Known limitations

- Cross-tab mutation atomicity paling kuat pada browser dengan Web Locks. Fallback
  optimistic localStorage tidak dapat memberi hard CAS guarantee.
- Repository tidak mengimplementasikan storage quota recovery selain typed
  `storage-failed`/null return.
- Collection bounds memakai newest-array order yang ditulis repository; imported
  data tidak di-sort ulang berdasarkan timestamp.
- Built-in profile belum memiliki localization layer; nama canonical disimpan
  dalam English sesuai keputusan produk.
- Pause/resume guard session tidak terhubung ke reliable timer dan dapat memiliki
  lifecycle independen sampai Phase 3 menetapkan controller.
- Interruption types tidak berarti app sedang melakukan attention tracking.
- Distraction conversion hanya menyimpan task ID; Phase 2 tidak membuat task.
- Browser manual QA Phase 2 belum dijalankan karena tidak ada UI consumer dan
  browser control menjadi tidak stabil pada preflight.

## 14. Handoff untuk Phase 3

Phase 3 dapat membuat Focus Contract dan protected-session controller dengan
foundation ini. Phase 3 harus:

- tetap memerlukan explicit opt-in;
- memilih profile melalui safe selected/default profile;
- memanggil typed `startSession` dan menangani active-session conflict di UI;
- mengikat optional timerRunId/target/intention hanya setelah user mengonfirmasi
  contract;
- menggunakan profile snapshot dari repository, bukan membuat snapshot kedua;
- mengoordinasikan pause/resume/complete dengan timer tanpa mengubah history lama;
- tidak menambahkan attention tracking/blocking yang merupakan fase berikutnya.

Jangan mulai Phase 3 tanpa persetujuan eksplisit.
