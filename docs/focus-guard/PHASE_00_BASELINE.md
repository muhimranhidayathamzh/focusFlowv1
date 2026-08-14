# Focus Guard Phase 0 — Baseline and Safety Contract

Tanggal audit: 2026-07-12 (Asia/Makassar)

## 1. Scope dan metode

Dokumen ini adalah baseline terverifikasi sebelum Focus Guard Phase 1. Sumber
utama audit adalah isi working tree aktual, lalu dibandingkan dengan:

- `docs/CODEX_UPGRADE_EXECUTION_PLAN.md`
- `docs/FOCUS_GUARD_MASTER_BLUEPRINT.md`
- `docs/FOCUSFLOW_UPGRADE_BLUEPRINT.md`
- `docs/UPGRADE_BASELINE_AUDIT.md`

Audit mencakup timer, task/checklist, focus target, focus-session history,
statistik, daily goal, ambient sound, persistence, sinkronisasi tab, dan
verifikasi lint/build. Audit ini tidak mengimplementasikan Focus Guard, tidak
mengubah perilaku produk, dan tidak mengubah kode produk.

### Kondisi working tree saat audit

Working tree sudah dirty sebelum audit dan berisi gabungan perubahan staged,
unstaged, serta file untracked. Di antaranya terdapat perubahan pada timer,
task, sound, layout, package files, dokumentasi, dan file baru untuk session,
stats, goal, checklist, serta focus target. Baseline dalam dokumen ini adalah
isi filesystem aktual tersebut, bukan hanya `HEAD`, bukan hanya staged diff,
dan bukan baseline lama tanggal 2026-07-10.

Seluruh perubahan pengguna dipertahankan. Satu-satunya file yang dibuat oleh
Phase 0 adalah dokumen ini.

## 2. Baseline produk aktual

Fitur yang ada di kode aktual:

- timer tiga mode: `focus`, `shortBreak`, dan `longBreak`;
- empat preset timer dan custom duration;
- start/pause/resume, reset, manual mode switching, dan keyboard shortcuts;
- audio bell sintetis dan browser Notification saat mode selesai;
- pencatatan focus session yang selesai ke localStorage;
- task CRUD, checklist-step CRUD, dan completed timestamps;
- active focus target untuk task atau checklist step;
- prompt opsional untuk menandai target selesai setelah focus session;
- statistik hari ini, tujuh hari, streak, weekly summary, dan personal best;
- daily goal dalam menit di UI, dengan tipe data yang juga menerima sessions;
- ambient sound/noise/binaural sintetis dan persisted volume;
- persistence local-first tanpa auth, Supabase, atau cloud sync.

Timer dan settings-nya sendiri belum dipersist. Tidak ada persisted active timer
record, timestamp deadline, recovery lifecycle, completion token, atau guard
domain data.

## 3. Timer lifecycle map

### State owner dan initial state

`src/hooks/useTimer.ts` memiliki seluruh runtime timer state dalam React:

| State | Nilai awal | Persisted |
| --- | --- | --- |
| `settings` | Classic Pomodoro: 25m/5m/15m | Tidak |
| `selectedPresetId` | `classicPomodoro` | Tidak |
| `mode` | `focus` | Tidak |
| `timeLeft` | 1500 detik | Tidak |
| `isActive` | `false` | Tidak |
| `sessionCount` | `1` | Tidak |

### Transisi aktual

```text
mount/refresh
  -> focus, 25:00, paused, sessionCount 1

Start (button atau Space)
  -> isActive = true
  -> setInterval mengurangi timeLeft tepat 1 setiap callback 1000 ms

Pause (button atau Space)
  -> isActive = false
  -> timeLeft dipertahankan hanya di memory

Resume
  -> isActive = true
  -> tick dilanjutkan dari timeLeft di memory

Reset (button atau R)
  -> isActive = false
  -> timeLeft = settings[mode]
  -> mode, settings, preset, sessionCount tidak berubah

Manual switch (tab mode atau 1/2/3)
  -> mode = mode pilihan
  -> timeLeft = settings[mode pilihan]
  -> isActive = false
  -> progress mode sebelumnya dibuang

Apply preset
  -> settings/preset diganti
  -> current mode di-reset ke durasi preset
  -> isActive = false

Save custom settings
  -> settings diganti; preset exact-match atau `custom`
  -> current mode di-reset ke durasi baru
  -> isActive = false

timeLeft mencapai 0 ketika active
  -> bell + browser notification bila diizinkan
  -> bila focus: simpan satu FocusSession melalui callback
  -> bila focus: naikkan sessionCount
  -> bila focus: pilih short/long break
  -> bila break: pilih focus
  -> switchMode mengisi durasi mode baru dan berhenti (tidak auto-start)
```

### Completion, break, dan session record

- Hanya completion mode `focus` yang membuat history record. Completion break
  tidak disimpan.
- Record menggunakan full configured `settings.focus`, bukan elapsed time.
- `completedAt` diambil ketika completion handler akhirnya berjalan.
- `presetId` menyimpan preset aktif atau string `custom`.
- Task/step association diambil dari `activeTarget` pada saat completion, bukan
  target pada saat timer dimulai. Label disimpan sebagai snapshot.
- Session ditambahkan di depan array history dengan ID baru. Tidak ada dedupe,
  completion ID, transactional guard, atau idempotency check.
- Completion mengganti mode tetapi selalu berhenti. Istilah "auto-transition"
  di baseline berarti auto-select break/focus, bukan menjalankan mode berikutnya.
- `sessionCount` dimulai dari 1, lalu dinaikkan sebelum `% 4`. Akibatnya long
  break dipilih saat nilai baru menjadi 4, yaitu setelah completion focus ke-3
  sejak mount. Ini perlu diputuskan sebagai kontrak yang dipertahankan atau bug
  yang diperbaiki secara eksplisit pada Phase 1.

### Notification

- Permission Notification diminta otomatis saat mount bila status masih
  `default`; request bukan hasil gesture eksplisit dan dapat ditolak/diabaikan
  oleh browser.
- Browser notification hanya dibuat bila permission sudah `granted`.
- Bell mencoba membuat `AudioContext` baru pada setiap completion dan tidak
  menutup context tersebut. Kegagalan audio hanya dicatat ke console.
- Bell dan browser notification dipanggil untuk focus maupun break completion.
- Tidak ada retry, service worker, persisted notification state, atau fallback
  visual khusus bila notification/audio gagal.

### Background tab, refresh, dan device sleep

| Skenario | Perilaku aktual | Dampak |
| --- | --- | --- |
| Tab background | Timer bergantung pada frekuensi callback `setInterval`; setiap callback hanya mengurangi 1 | Throttling browser dapat memperpanjang sesi secara material |
| Tab kembali visible | Tidak ada `visibilitychange` reconciliation | Waktu yang terlewat tidak dihitung dari clock |
| Device sleep | Callback berhenti; setelah wake countdown melanjutkan sisa lama | Sesi selesai lebih lambat dari durasi wall-clock yang direncanakan |
| Refresh saat active | Semua timer state hilang dan kembali ke initial state | Active session tidak dapat dipulihkan atau diselesaikan |
| Refresh saat paused | Sisa pause, mode, preset/custom settings, dan count hilang | Pause tidak recoverable |
| Close/navigation | Tidak ada `pagehide`/unload persistence | State timer hilang |
| Banyak tab | Setiap tab memiliki timer independen | Dua tab dapat merekam completion terpisah ke history yang sama |

Tidak ada logic khusus untuk `visibilitychange`, `pagehide`, device wake, clock
reconciliation, atau refresh recovery di `src`.

## 4. localStorage inventory

Terdapat enam key aktual. String `*-updated` di bawah adalah custom window event,
bukan storage key.

| Key | Writer/reader | Bentuk persisted | Load/normalizer | Sinkronisasi |
| --- | --- | --- | --- | --- |
| `focusflow-tasks` | `useTasks` | JSON `Task[]` | Array-only; task/step direkonstruksi dari field yang dikenal; invalid record/step dibuang; missing `steps` menjadi `[]` | Same-tab event `focusflow-tasks-updated` + cross-tab `storage` |
| `focusflow-active-focus-target` | `useFocusTarget` | JSON `FocusTarget`; key dihapus untuk null | Memerlukan string `taskId`, string `label`, optional string `stepId`; invalid menjadi null | Same-tab event `focusflow-active-focus-target-updated` + cross-tab `storage` |
| `focusflow-focus-sessions` | `useFocusSessions` | JSON `FocusSession[]` | Array-only; filter record yang memiliki string ID, numeric completedAt/duration, dan recognized mode | Same-tab event `focusflow-focus-sessions-updated` + cross-tab `storage` |
| `focusflow-daily-focus-goal` | `useDailyFocusGoal` | JSON `{type,target}` | Type minutes/sessions, finite numeric target, lalu clamp integer 5..600; invalid kembali ke default 60 minutes | Tidak ada storage/custom-event listener |
| `focusflow-ambient-volume` | `useAmbientSound` | Raw decimal string, mis. `"0.5"` | `parseFloat`; fallback 0.5 hanya untuk missing/exception; tidak clamp/finite-check saat load | Tidak ada listener |
| `focusflow-ambient-sound` | `useAmbientSound` | Raw sound ID string | Tidak pernah dibaca saat mount; hanya ditulis saat play dan dihapus saat stop/toggle-off | Tidak ada listener |

### Data shapes aktual

```ts
interface TaskStep {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  completedAt?: number;
  steps?: TaskStep[];
}

interface FocusTarget {
  taskId: string;
  stepId?: string;
  label: string;
}

interface FocusSession {
  id: string;
  completedAt: number;
  mode: 'focus' | 'shortBreak' | 'longBreak';
  durationSeconds: number;
  presetId?: string;
  taskId?: string;
  stepId?: string;
  targetLabel?: string;
  soundId?: string;
}

interface DailyFocusGoal {
  type: 'minutes' | 'sessions';
  target: number;
}
```

Ambient sound IDs aktual adalah `rain`, `ocean`, `whiteNoise`, `brownNoise`,
`alpha10`, `beta16`, dan `gamma40`. Key sound dapat berisi nilai lain karena
tidak dinormalisasi, tetapi nilai itu tidak dibaca kembali oleh implementasi.

### Detail normalizer dan malformed data

- Semua JSON reader menangkap parse exception dan fail safe ke empty/default.
- Task normalizer kompatibel dengan task lama tanpa `steps`, tetapi setiap write
  memanggil `loadTasks()` lalu menyimpan hasil normalized. Unknown fields dan
  invalid records/steps karena itu akan hilang pada write task berikutnya.
- Session loader memfilter tanpa merekonstruksi object, sehingga unknown fields
  pada valid record biasanya dipertahankan saat add berikutnya. Optional fields
  tidak divalidasi. `NaN` tidak dapat muncul dari JSON, tetapi infinity juga tidak
  valid JSON; angka negatif dan timestamp/duration tidak masuk akal tetap lolos.
- Malformed session yang diabaikan akan hilang ketika add/clear berikutnya
  menyimpan ulang array hasil load.
- Focus target reader tidak memastikan referenced task/step ada. `TaskList`
  kemudian membersihkan target yang task/step-nya hilang, tetapi hanya setelah
  task list mounted dan loaded. Target ke item completed tetap dapat lolos load.
- Goal fallback tidak menulis perbaikan ke storage. Nilai valid selalu di-clamp
  saat dibaca/ditulis.
- Ambient volume dapat menjadi `NaN` atau di luar 0..1 saat load. Setter UI
  melakukan clamp, tetapi loader tidak. Ambient sound preference tersisa di
  storage setelah refresh walaupun playback/currentSound kembali null.

## 5. Hubungan antardata dan ownership

```text
Task[]
  └─ TaskStep[]
       └─ dapat dipilih sebagai FocusTarget (reference by taskId/stepId + label snapshot)

FocusTarget saat timer selesai
  └─ disalin ke FocusSession sebagai taskId/stepId/targetLabel
       └─ menjadi input derived FocusStats
            └─ dibandingkan dengan DailyFocusGoal

AmbientSound
  └─ berjalan independen dari timer/target/session
     (`FocusSession.soundId` tersedia di type, tetapi tidak pernah diisi)
```

Detail relasi:

- Task adalah owner checklist step. Menyelesaikan task tidak otomatis
  menyelesaikan steps; menyelesaikan seluruh steps tidak otomatis menyelesaikan
  task.
- UI membersihkan active target saat referenced task/step diselesaikan melalui
  TaskList atau dihapus. Rename task/step memperbarui snapshot label target.
- Completion focus tidak otomatis menyelesaikan target. UI menawarkan
  "Tandai selesai" atau "Lanjutkan". Jika dipilih, target ditandai selesai dan
  active target dibersihkan bila masih menunjuk item yang sama.
- Timer menangkap target yang aktif saat completion. Mengganti atau menghapus
  target selama timer berjalan mengubah/menghilangkan association session.
- Menghapus task/step tidak menghapus historical session. Ini menjaga history,
  dan `targetLabel` tetap menjadi snapshot walaupun source diubah/dihapus.
- `useTasks`, `useFocusTarget`, dan `useFocusSessions` dapat memiliki beberapa
  hook instance. Custom same-tab events membuat instance di Timer, TaskList,
  dan Stats reload dari localStorage.
- Stats hanya menghitung record mode `focus`. Minutes adalah round dari total
  seconds per bucket, session count adalah jumlah record.
- Daily goal tidak punya relasi persisted per tanggal; satu preference global
  diterapkan retroaktif ke streak/history. UI saat ini selalu menulis goal tipe
  `minutes`.
- Perhitungan bucket menggunakan local time. Window tujuh hari memakai
  `24h` milliseconds dari local midnight; transisi DST dapat menghasilkan batas
  hari yang tidak tepat pada timezone yang menerapkan DST.
- Ambient audio tidak start/stop bersama timer, break, focus target, atau page
  visibility. Volume persisted; playback tidak dipulihkan.

## 6. Compatibility contract

Phase berikutnya wajib mematuhi kontrak berikut kecuali owner menyetujui
perubahan perilaku secara eksplisit:

1. Jangan rename, reuse untuk makna lain, atau hapus enam key existing.
2. Jangan melakukan destructive migration terhadap tasks, steps, sessions,
   target, goal, volume, atau sound preference.
3. Task lama tanpa `steps` harus tetap load sebagai task valid dengan empty steps.
4. Semua penambahan field pada existing persisted shapes harus optional dan
   pembaca lama/baru harus tetap menerima record lama.
5. Jangan menaruh field Focus Guard baru di `Task` tanpa mengatasi fakta bahwa
   normalizer task saat ini menghapus unknown fields pada write berikutnya.
6. Timer-only focus session tanpa guard ID/metadata tetap valid. Historical
   session tidak boleh diubah, di-duplikasi, atau dihapus oleh timer recovery.
7. New Focus Guard records wajib melalui normalizer; malformed record diabaikan
   dengan aman dan unknown future fields sebaiknya dipertahankan.
8. Tetap gunakan local time semantics untuk stats sampai perubahan timezone/day
   bucketing dirancang dan diuji secara eksplisit.
9. Pertahankan same-tab custom-event dan cross-tab storage behavior untuk task,
   target, dan session. Tentukan concurrency policy timer sebelum menambah active
   timer persistence.
10. Goal dan ambient preferences saat ini tidak cross-tab reactive; Phase 1
    tidak perlu memperluas scope ini.
11. Preserve manual mode switching, presets/custom duration, notification,
    focus-only history recording, target completion prompt, keyboard shortcuts,
    dan transition yang berhenti pada mode berikutnya.
12. Active-timer persistence baru harus menggunakan key baru dan schema/version
    yang jelas. Jangan mencampurkannya dengan `focusflow-focus-sessions`.
13. Completion harus idempotent: recovery, repeated render/effect, banyak tab,
    atau wake-after-deadline tidak boleh membuat lebih dari satu history record
    untuk logical session yang sama.
14. Focus Guard tetap opt-in. Phase 1 memperbaiki timer reliability saja dan
    tidak membuat profile, contract UI, interruption tracking, blocking, auth,
    atau cloud sync.

## 7. Regression risks

### Critical

- **Wall-clock tidak akurat:** interval throttling dan device sleep memperpanjang
  sesi; refresh menghapus sesi aktif/paused sepenuhnya.
- **Completion tidak idempotent:** tidak ada stable logical session ID atau
  completion marker; recovery naïf dapat menggandakan history/stats.
- **Long-break boundary ambigu/off-by-one:** implementasi aktual memilih long
  break setelah completion focus ke-3 sejak mount, bukan jelas setelah empat
  completed focus sessions.
- **Cross-tab ownership belum ada:** persisted active timer tanpa lease/owner
  policy dapat membuat dua tab sama-sama menyelesaikan dan mencatat satu sesi.

### High

- Target session dipilih saat completion, sehingga association dapat berbeda
  dari intention saat start.
- Refresh menghapus custom settings dan preset selection; desain recovery harus
  membedakan timer snapshot dari preference yang memang belum persisted.
- Task normalizer menghapus unknown fields saat write; penambahan metadata ke
  task berisiko silent data loss.
- Completion yang terjadi setelah wake harus menetapkan `completedAt` semantics
  secara eksplisit: expected deadline atau waktu recovery. Pilihan ini mengubah
  daily stats di batas tengah malam.

### Medium

- Notification permission diminta pada mount dan audio context baru tidak
  ditutup; notification/audio dapat gagal karena browser policy.
- Custom timer input mengandalkan batas HTML dan tidak melakukan validation/clamp
  di hook sebelum settings digunakan.
- Session validator menerima negative/non-sensible numeric values dan tidak
  memvalidasi optional metadata, sehingga malformed-but-shaped record dapat
  merusak stats.
- Daily goal tidak cross-tab reactive; ambient volume/sound juga tidak.
- Persisted ambient sound tidak dibaca kembali dan dapat menjadi stale.
- Prompt completed target dapat menjadi stale bila source task berubah dari
  jalur lain setelah completion.
- Statistik local-day memakai fixed 24-hour arithmetic, berisiko pada DST.

## 8. QA checklist baseline dan regression

### Timer dasar

- [ ] Start focus dari default, pastikan countdown bergerak.
- [ ] Pause lalu tunggu; pastikan remaining tidak berubah.
- [ ] Resume; pastikan melanjutkan remaining yang sama.
- [ ] Reset saat active dan paused; pastikan mode tetap dan full duration kembali.
- [ ] Switch focus/short/long saat active dan paused; pastikan timer berhenti dan
  durasi mode pilihan dimuat.
- [ ] Jalankan shortcut Space, R, 1, 2, 3, S di luar input.
- [ ] Pastikan shortcut tidak aktif saat mengetik di input/textarea.
- [ ] Apply setiap preset; pastikan label/durasi dan reset behavior benar.
- [ ] Save custom duration; uji batas min/max dan input kosong/desimal.

### Completion dan recovery

- [ ] Selesaikan focus; pastikan tepat satu record, bell/notification, target
  snapshot, count, dan break transition.
- [ ] Selesaikan short dan long break; pastikan tidak ada focus record dan mode
  kembali focus dalam keadaan berhenti.
- [ ] Catat urutan break untuk focus completion 1..4 untuk memutuskan expected
  long-break boundary.
- [ ] Background-kan tab beberapa menit dan bandingkan dengan wall clock.
- [ ] Sleep/wake melewati deadline dan catat remaining/completion aktual.
- [ ] Refresh saat active dan paused; baseline saat ini kembali ke default.
- [ ] Uji completion dekat tengah malam dan timezone/local-day stats.
- [ ] Uji dua tab aktif agar risiko duplicate completion terlihat.

### Storage dan relasi

- [ ] Load task legacy tanpa `steps`; edit lalu pastikan task tetap valid.
- [ ] Create/edit/complete/reopen/delete task dan checklist step.
- [ ] Set, rename, complete, delete, dan clear task/step active target.
- [ ] Ganti target di tengah focus; konfirmasi session memakai target saat selesai.
- [ ] Setelah completion pilih "Tandai selesai" dan "Lanjutkan" secara terpisah.
- [ ] Hapus source task setelah session; pastikan historical stats tetap ada.
- [ ] Buka dua tab; uji sync task, target, dan session events.
- [ ] Inject malformed JSON dan shaped-invalid records per key; pastikan app tidak
  crash dan data existing lain tidak terhapus tanpa write eksplisit.
- [ ] Uji unknown fields agar kebijakan preservation terverifikasi.

### Stats, goal, dan sound

- [ ] Pastikan hanya focus-mode records berkontribusi ke stats.
- [ ] Verifikasi today, 7-day chart, streak, weekly summary, dan personal best
  dari fixture history yang diketahui.
- [ ] Edit daily minute goal; refresh dan cek clamp 5..600.
- [ ] Play/change/stop setiap ambient sound; uji mute dan volume persistence.
- [ ] Refresh ketika sound aktif; baseline saat ini tidak melanjutkan playback.
- [ ] Uji browser tanpa Notification permission dan dengan audio autoplay policy.

### Verifikasi otomatis

- [x] `npm run lint`
- [x] `npm run build`
- [ ] Belum ada automated test script di `package.json`; lifecycle/recovery Phase
  1 memerlukan deterministic test plan atau test yang dapat dijalankan dengan
  tooling existing tanpa menambah dependency bila memungkinkan.

## 9. Hasil verifikasi 2026-07-12

### `npm run lint`

Lulus (exit code 0):

```text
✔ No ESLint warnings or errors
```

### `npm run build`

Lulus (exit code 0) dengan Next.js 14.2.35:

- optimized production build compiled successfully;
- lint dan TypeScript validity check lulus;
- 4/4 static pages generated;
- route `/` diprerender sebagai static content;
- reported `/` size 25.6 kB dan First Load JS 113 kB.

Tidak ada script `test` atau standalone `typecheck` di `package.json`. Production
build sudah menjalankan TypeScript validity check.

## 10. Rekomendasi edit surface untuk Phase 1

Phase 1 sebaiknya tetap sempit dan berpusat pada reliable/recoverable timer:

### Primary edit surface

- `src/hooks/useTimer.ts`: ubah state machine/tick menjadi timestamp-based,
  definisikan start/pause/resume/reset/switch/recovery/completion semantics, dan
  expose state yang dibutuhkan UI.
- Modul type/storage baru yang khusus untuk recoverable active timer, misalnya
  `src/types/timer.ts` dan/atau repository/hook kecil. Nama final ditentukan saat
  Phase 1 setelah memilih schema dan ownership; jangan gunakan guard-domain key.

### Integration surface yang mungkin perlu perubahan minimal

- `src/components/timer/PomodoroTimer.tsx`: wiring recovery/completion dan UI
  state saja; jangan jadikan komponen ini owner seluruh lifecycle.
- `src/components/timer/TimerSettings.tsx`: hanya jika kontrak apply/custom
  settings perlu disesuaikan dengan active/paused persisted timer.
- `src/hooks/useFocusSessions.ts`: idealnya API existing `addSession` tetap;
  sentuh hanya bila stable logical session ID/dedupe harus ditegakkan di boundary
  persistence. Historical record compatibility wajib dipertahankan.
- `src/types/focusSession.ts`: hanya optional metadata bila benar-benar diperlukan
  untuk idempotency; record lama harus tetap valid.

### Jangan disentuh pada Phase 1 kecuali bukti implementasi mengharuskan

- task/checklist UI dan task storage;
- focus stats/daily goal behavior;
- ambient engine/sound UI;
- Focus Guard profiles, contract, interruptions, inbox, browser extension;
- layout/visual redesign, dependencies, auth, Supabase, atau cloud sync.

### Keputusan yang harus dikunci sebelum implementasi Phase 1

1. Long break adalah setelah empat completed focus sessions atau apakah baseline
   setelah tiga completion sengaja dipertahankan.
2. Setelah refresh/wake melewati deadline, apakah mode berikutnya hanya dipilih
   dan paused (konsisten baseline), serta apakah notification langsung dipicu.
3. `completedAt` recovery memakai expected deadline atau actual recovery time.
4. Active target diikat saat start atau tetap dibaca saat completion.
5. Satu-tab owner/lease policy untuk active timer dan duplicate prevention.
6. Apakah preset/custom settings dipersist sebagai bagian snapshot active timer
   saja atau juga menjadi preference global baru.

## 11. Phase 0 exit dan handoff

Phase 0 selesai bila dokumen ini diterima. Kode aktual telah diaudit, seluruh
storage key dan lifecycle timer telah dicatat, lint/build lulus, compatibility
contract dan regression checklist tersedia, serta safe Phase 1 edit surface
telah diidentifikasi.

Kesiapan menuju Phase 1: **siap bersyarat**. Implementasi dapat dimulai setelah
owner menyetujui keputusan lifecycle pada bagian 10, terutama long-break
boundary, recovery completion time, target snapshot timing, dan cross-tab
ownership. Jangan mulai Phase 1 tanpa persetujuan eksplisit.
