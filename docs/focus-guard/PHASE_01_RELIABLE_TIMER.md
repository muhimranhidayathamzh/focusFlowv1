# Focus Guard Phase 1 — Reliable and Recoverable Timer

Tanggal implementasi: 2026-07-12 (Asia/Makassar)

## 1. Scope dan hasil

Phase 1 mengganti timer berbasis decrement-per-interval dengan timer
timestamp-based yang dapat dipulihkan. Implementasi tetap local-first, tidak
menambahkan dependency, dan tidak membuat domain model atau UI Focus Guard.

Hasil utama:

- active countdown diturunkan dari `expectedEndAt - Date.now()`;
- active dan paused run bertahan setelah refresh;
- overdue run diselesaikan sekali menggunakan expected deadline;
- long break dimulai setelah setiap empat completed focus runs;
- focus target disnapshot ketika focus run pertama kali dimulai;
- custom/preset settings menjadi global persisted preference;
- setiap run mempertahankan settings/duration snapshot sendiri;
- Web Locks dan expiring localStorage lease mengoordinasikan owner lintas tab;
- completion ledger dan `timerRunId` melindungi session history dan notification
  dari duplicate completion.

## 2. Final lifecycle dan state machine

```text
missing/malformed state
  -> prepared focus run, paused, default/persisted preferences

prepared paused run (hasStarted=false)
  -- start --> active run
               - startedAt = now
               - expectedEndAt = now + remaining
               - focus target snapshot diikat bila mode focus

active run
  -- clock refresh --> timeLeft = ceil((expectedEndAt - now) / 1000)
  -- pause --> paused run dengan remaining hasil deadline-now
  -- reset --> fresh prepared paused run, snapshot lama dibuang
  -- manual mode --> fresh prepared paused run pada mode pilihan
  -- deadline --> owner menjalankan idempotent completion

paused started run (hasStarted=true)
  -- resume --> active, run ID/startedAt/snapshot dipertahankan,
               expectedEndAt baru = now + pausedRemainingSeconds
  -- reset/manual mode --> fresh prepared paused run

focus completion
  -> add FocusSession dengan completedAt = expectedEndAt dan timerRunId
  -> completedFocusCount += 1
  -> count % 4 === 0 ? prepared longBreak : prepared shortBreak
  -> next mode paused; tidak auto-start

short/long break completion
  -> tidak menambah FocusSession
  -> prepared focus run, paused
  -> completedFocusCount tidak berubah
```

`setInterval` masih digunakan setiap 250 ms hanya untuk merefresh display dan
memeriksa deadline. Interval bukan lagi sumber kebenaran waktu. Saat callback
ditunda oleh background throttling atau device sleep, callback berikutnya
menghitung ulang dari absolute deadline.

### Action semantics

- **Start:** prepared run menjadi active dan menangkap target saat itu.
- **Pause:** menyimpan remaining wall-clock yang dihitung dari deadline.
- **Resume:** mempertahankan run ID, start time, settings, duration, preset, dan
  target snapshot; hanya deadline yang dihitung ulang.
- **Reset:** membuat run ID baru, paused pada full current preference duration,
  dan menghapus target snapshot/stale deadline.
- **Manual mode switching:** membuat fresh paused run untuk mode pilihan dan
  menghapus stale run/deadline.
- **Settings/preset update:** selalu menyimpan global preference. Prepared run
  yang belum dimulai ikut diperbarui; run yang sudah dimulai, termasuk paused,
  mempertahankan snapshot-nya.
- **Auto-transition:** memilih next mode dalam keadaan paused, sama seperti
  baseline; tidak mengejar siklus tambahan ketika lama berada di background.

## 3. Persisted shapes dan storage keys

Empat namespaced key baru ditambahkan. Enam key baseline tidak diubah atau
dihapus.

### `focusflow-timer-preferences-v1`

```ts
interface TimerPreferences {
  version: 1;
  settings: {
    focus: number;
    shortBreak: number;
    longBreak: number;
  };
  selectedPresetId:
    | 'quickStart'
    | 'classicPomodoro'
    | 'deepWork'
    | 'recoveryMode'
    | 'custom';
}
```

### `focusflow-timer-state-v1`

```ts
interface PersistedTimerState {
  version: 1;
  run: {
    id: string;
    mode: 'focus' | 'shortBreak' | 'longBreak';
    status: 'active' | 'paused';
    hasStarted: boolean;
    startedAt: number;
    expectedEndAt?: number;
    pausedRemainingSeconds: number;
    durationSeconds: number;
    settingsSnapshot: TimerSettings;
    presetIdSnapshot: SelectedTimerPresetId;
    completedFocusCount: number;
    focusTargetSnapshot?: FocusTarget;
  };
  updatedAt: number;
}
```

Active run wajib memiliki `hasStarted=true` dan valid `expectedEndAt`. Paused
run tidak boleh memiliki deadline. `hasStarted=false` menandai prepared run yang
belum mengikat focus target.

### `focusflow-timer-completions-v1`

```ts
interface TimerCompletionLedger {
  version: 1;
  records: Array<{
    runId: string;
    completedAt: number;
    notifiedAt: number;
  }>;
}
```

Ledger dibatasi pada 200 completion records terbaru.

### `focusflow-timer-lease-v1`

```ts
interface TimerLease {
  version: 1;
  ownerId: string;
  runId: string;
  expiresAt: number;
}
```

Lease berdurasi 6 detik dan diperbarui setiap 2 detik oleh owner.

## 4. Normalization dan malformed data

Seluruh key baru dibaca melalui parser/normalizer di
`src/lib/timerPersistence.ts`:

- JSON parse error, wrong version, wrong root shape, atau invalid run menghasilkan
  safe fallback;
- IDs harus non-empty string;
- mode/status/preset harus recognized union value;
- timestamps dan durations harus finite numbers;
- durations dibulatkan, harus 1..86400 detik;
- paused remaining tidak boleh melebihi run duration;
- active run harus started dan memiliki deadline yang tidak lebih awal dari
  `startedAt`;
- paused run tidak menerima persisted deadline;
- completed focus count harus non-negative;
- optional focus target harus memiliki task ID/label valid;
- malformed ledger records dan lease diabaikan.

Jika state baru missing atau malformed, app membuat fresh prepared focus run
dengan preference valid/default. Tidak ada migrasi destructive terhadap data
lama.

## 5. Ownership dan lease strategy

### Browser dengan Web Locks API

Setiap active run menggunakan exclusive lock:

```text
focusflow-timer-owner:<runId>
```

Satu tab memegang lock selama run active. Tab lain menunggu lock yang sama dan
tetap dapat menampilkan countdown dari shared deadline, tetapi tidak menjalankan
completion. Refresh/crash melepaskan Web Lock secara otomatis sehingga waiting
tab atau page yang dipulihkan dapat menjadi owner.

Owner juga menulis expiring lease sebagai observable ownership record dan
fallback boundary. Pause, reset, mode switch, completion, unmount, atau run ID
change melepaskan ownership.

### Browser tanpa Web Locks API

Tab mencoba menulis lease bila lease missing/expired atau dimiliki tab itu
sendiri, lalu reread untuk memverifikasi ownership. Heartbeat memperbarui expiry.
Tab yang crash tidak mengunci timer selamanya karena lease berakhir maksimal
sekitar 6 detik tanpa heartbeat.

`storage` event menyinkronkan runtime/preference antar-tab. Custom same-tab event
menjaga kemungkinan lebih dari satu hook instance pada document yang sama.

## 6. Completion idempotency

Idempotency memiliki beberapa lapisan:

1. hanya owner active run yang memulai completion;
2. in-memory `completingRunIds` mencegah interval/effect/focus event memproses
   run yang sama bersamaan dalam satu tab;
3. completion selalu reread persisted state dan memastikan run ID/status/deadline
   masih cocok;
4. completion ledger menolak run ID yang sudah selesai;
5. `FocusSession.timerRunId` adalah optional compatibility field;
6. `useFocusSessions.addSession` mengembalikan historical record existing bila
   timerRunId yang sama sudah tersimpan;
7. notification/chime hanya dipicu setelah ledger claim berhasil dan dilindungi
   in-memory notified-run set.

FocusSession ditulis sebelum ledger. Bila page gagal di antara kedua write,
recovery boleh mencoba lagi tetapi `timerRunId` dedupe mencegah record kedua.
Ledger kemudian ditulis sebelum notification, sehingga recovery tidak
mengulang notification untuk run yang sudah diklaim.

## 7. Overdue recovery

Ketika persisted active run dibuka setelah deadline:

1. UI menghitung remaining sebagai 0 dari `expectedEndAt`;
2. tab memperoleh ownership atau menunggu owner existing;
3. owner memvalidasi persisted run dan completion ledger;
4. focus run dicatat sekali dengan `completedAt = expectedEndAt`;
5. duration/preset/target metadata berasal dari run snapshot;
6. completed focus count dinaikkan dan next break dipilih;
7. next mode dibuat sebagai prepared paused run;
8. hanya satu completion diproses—tidak ada catch-up untuk siklus lain;
9. chime/notification boleh terjadi saat app kembali aktif, sekali per run ID.

Break overdue mengikuti alur yang sama tanpa menambah FocusSession, lalu kembali
ke prepared paused focus mode.

## 8. Backward compatibility

- Key lama `focusflow-tasks`, `focusflow-active-focus-target`,
  `focusflow-focus-sessions`, `focusflow-daily-focus-goal`,
  `focusflow-ambient-volume`, dan `focusflow-ambient-sound` tidak diganti.
- Historical FocusSession tanpa `timerRunId` tetap lolos reader existing.
- `timerRunId` optional dan hanya ditambahkan untuk completion dari reliable
  timer.
- Task, checklist, stats, daily goal, dan ambient persistence tidak dimigrasi.
- Tanpa key timer baru, app menggunakan Classic Pomodoro default seperti
  baseline, lalu membuat state version 1.
- Focus timer tanpa active target tetap valid dan menghasilkan session tanpa
  task/step metadata.
- Existing keyboard shortcut, notification, completion sound, target completion
  prompt, dan focus-only session-history behavior dipertahankan.

## 9. Files changed

- `src/hooks/useTimer.ts` — timestamp lifecycle, recovery, ownership,
  preferences, transition, dan idempotent completion.
- `src/lib/timerPersistence.ts` — storage keys, normalizers, repositories,
  completion ledger, dan lease helpers.
- `src/types/timer.ts` — persisted/runtime/preference/lease types.
- `src/components/timer/PomodoroTimer.tsx` — memberikan active target ke timer
  untuk snapshot dan menggunakan completed session snapshot untuk prompt.
- `src/types/focusSession.ts` — optional `timerRunId`.
- `src/hooks/useFocusSessions.ts` — dedupe by optional `timerRunId`.
- `docs/focus-guard/PHASE_01_RELIABLE_TIMER.md` — handoff ini.

Tidak ada dependency baru dan tidak ada perubahan Focus Guard Phase 2.

## 10. Verification results

### `npm run lint`

Lulus setelah final hook dependency correction:

```text
✔ No ESLint warnings or errors
```

### `npm run build`

Lulus dengan Next.js 14.2.35:

- production compilation berhasil;
- lint dan TypeScript validity check berhasil;
- static page generation 4/4 berhasil;
- route `/` size 27.8 kB, First Load JS 115 kB.

### Automated/runtime tests

Tidak terdapat test runner atau script `test` di `package.json`. Percobaan smoke
test melalui browser lokal tidak dapat dimulai karena runtime browser host gagal
terhubung sebelum membuka aplikasi (`EPERM` pada environment host). Tidak ada
hasil browser yang diklaim lulus. Deterministic manual QA di bawah tetap wajib.

## 11. Manual QA checklist

Gunakan custom duration pendek bila perlu, lalu bersihkan hanya empat key timer
baru secara sengaja di DevTools ketika mengulang dari fresh state. Jangan hapus
enam key aplikasi lama.

### Lifecycle dasar

- [ ] Start focus; pastikan countdown berkurang sesuai wall clock.
- [ ] Pause 10 detik; pastikan remaining tidak berubah.
- [ ] Resume; pastikan deadline baru sesuai remaining.
- [ ] Reset saat active dan paused; pastikan run ID baru/full duration/paused.
- [ ] Switch ketiga mode saat active dan paused; pastikan stale deadline tidak
  menyelesaikan run lama.
- [ ] Uji Space, R, 1, 2, 3, dan S serta suppression ketika mengetik.

### Refresh dan overdue

- [ ] Refresh active sebelum deadline; pastikan kembali active dengan remaining
  yang sesuai wall clock.
- [ ] Refresh paused; pastikan tetap paused dengan exact remaining.
- [ ] Refresh setelah deadline terlewati; pastikan tepat satu FocusSession,
  completedAt sama dengan persisted expectedEndAt, dan next mode paused.
- [ ] Sleep device melewati deadline; pastikan tidak ada duration extension dan
  tidak ada multi-cycle catch-up.
- [ ] Refresh berulang ketika overdue; pastikan session dan notification tidak
  bertambah untuk run ID yang sama.

### Cycle dan target snapshot

- [ ] Selesaikan focus ke-1, ke-2, ke-3: masing-masing menuju short break.
- [ ] Selesaikan focus ke-4: menuju long break.
- [ ] Mulai focus dengan target A, lalu ubah active target ke B; completed session
  harus tetap menyimpan A.
- [ ] Pause/resume dan refresh setelah target berubah; snapshot A harus tetap.
- [ ] Mulai tanpa target; session harus selesai tanpa task metadata.

### Settings snapshot

- [ ] Simpan custom settings, refresh, dan pastikan preference bertahan.
- [ ] Ubah settings ketika run active; current deadline/duration/target tidak
  berubah.
- [ ] Setelah reset atau completion transition, pastikan preference baru dipakai.
- [ ] Apply semua preset dan custom duration; refresh masing-masing.

### Multi-tab dan malformed data

- [ ] Buka dua tab pada origin yang sama; mulai satu run dan biarkan selesai.
  Pastikan hanya satu history record dengan satu timerRunId.
- [ ] Tutup/crash owner tab; pastikan tab lain mengambil alih dan menyelesaikan
  run setelah lock release/lease expiry.
- [ ] Inject malformed JSON, wrong version, invalid mode/status, missing deadline,
  invalid duration, dan invalid target ke setiap key timer baru; refresh dan
  pastikan fallback tanpa crash atau perubahan pada enam key lama.
- [ ] Deny Notification permission; completion/session transition harus tetap
  bekerja.

## 12. Known limitations dan residual risks

- Web Locks adalah coordination path terkuat. Browser tanpa Web Locks memakai
  localStorage lease yang bersifat best-effort; post-write verification, ledger,
  dan timerRunId dedupe mengurangi race tetapi localStorage bukan transaksi CAS.
- Bila localStorage sepenuhnya unavailable/quota-failed, persistence dan hard
  cross-tab idempotency tidak dapat dijamin; in-memory timer masih dapat tampil.
- Completion terjadi ketika JavaScript mendapat kesempatan berjalan kembali,
  walaupun timestamp session tetap expected deadline.
- Perubahan manual system clock memengaruhi deadline berbasis wall clock.
- Completion ledger dibatasi 200 record. Runtime normal seharusnya bertransisi
  jauh sebelum record relevan ter-evict.
- Notification permission masih diminta saat mount sesuai baseline. Browser dapat
  menolak request non-gesture dan audio policy dapat menahan chime.
- Jika page crash setelah ledger ditulis tetapi sebelum chime dijalankan, chime
  dapat tidak terdengar; desain memprioritaskan tidak mengulang notification.
- Saat global preference diubah di tengah started run, settings panel/preset label
  menunjukkan preference baru sementara countdown tetap memakai run snapshot.

## 13. Phase 2 preflight acceptance

Preflight dilakukan pada 2026-07-12 sebelum Phase 2. Current implementation dan
dirty diff diperiksa ulang tanpa reset/cleanup.

Browser QA berhasil menjalankan dua jalur prioritas:

- active refresh sebelum deadline: display berubah `00:58` menjadi `00:57`
  setelah reload dan timer tetap active;
- overdue/idempotency: custom one-minute focus run diselesaikan, statistik naik
  satu record, lalu recovery reload berulang mempertahankan jumlah 2 sessions
  tanpa record tambahan untuk run yang sudah selesai.

Observasi `25:00` tepat setelah salah satu reload terbukti merupakan SSR/hydration
frame awal; setelah menunggu hydration, persisted custom state kembali. Ini
bukan defect timer persistence.

Browser control kemudian berulang kali timeout pada click dan screenshot, jadi
enam skenario berikut tidak diklaim lulus manual: paused refresh, fourth-focus
long break, target A snapshot, settings snapshot, two-tab dedupe, dan owner
takeover. Deterministic code-path review mengonfirmasi:

- paused run menyimpan `pausedRemainingSeconds` dan tidak menyimpan deadline;
- completed count dinaikkan sebelum modulo empat;
- target hanya dicapture pada `firstStart` dan disimpan di run;
- started run tidak diganti ketika preference berubah;
- Web Lock memberi satu owner per run dan timerRunId/ledger memberi dedupe;
- lock release dan expiring lease memberi crash recovery path.

Tidak ditemukan defect konkret yang menghalangi Phase 2. Manual coverage yang
belum selesai tetap menjadi regression checklist, bukan dianggap passed.

## 14. Handoff untuk Phase 2

Phase 1 siap diserahkan setelah manual QA kritis—khususnya overdue refresh,
four-focus cycle, target snapshot, dan two-tab duplicate test—dinyatakan lulus.

Phase 2 dapat membangun Focus Guard domain/storage di key terpisah. Phase 2 harus:

- memperlakukan reliable timer run ID sebagai integration reference, bukan
  mengganti timer state owner;
- tidak memasukkan guard fields ke existing task records;
- menambah optional metadata pada FocusSession bila diperlukan;
- mengikuti normalizer/versioning dan same/cross-tab synchronization pattern;
- tetap opt-in dan tidak mengubah timer-only flow.

Jangan mulai Phase 2 tanpa persetujuan eksplisit.
