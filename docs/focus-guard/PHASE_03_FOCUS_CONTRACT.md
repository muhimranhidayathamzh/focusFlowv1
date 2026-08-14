# Focus Guard Phase 3 — Focus Contract and Protected Session Lifecycle

Tanggal implementasi: 2026-07-13 (Asia/Makassar)

## 1. Scope dan hasil

Phase 3 menghubungkan timer Phase 1 dengan domain/storage Phase 2 melalui satu
controller lifecycle. Focus Guard tetap opt-in dan hanya melindungi mode focus.
Tidak ada attention tracking, distraction capture, website/application blocking,
extension, desktop companion, auth, cloud sync, atau pekerjaan Phase 4.

Hasil utama:

- status `Nonaktif`, `Siap`, `Aktif`, dan `Dijeda` tampil dekat timer;
- focus run baru yang terlindungi wajib melewati Focus Contract;
- kontrak mewajibkan task/checklist target dan menerima intention opsional;
- timer run dan guard session berbagi `timerRunId`, timestamps, duration, profile,
  dan target snapshot yang konsisten;
- pause/resume, reset, manual mode switch, natural completion, dan recovery
  direkonsiliasi antara kedua lifecycle;
- completed guard history ditautkan ke `FocusSession.id`;
- break selalu paused dan tidak memiliki active guard session;
- refresh active/paused memulihkan kedua lifecycle.

## 2. Focus Contract

Kontrak dibuka hanya ketika semua kondisi berikut benar:

1. Guard preference aktif;
2. mode timer `focus`;
3. run berstatus `paused` dan `hasStarted === false`;
4. storage timer/Guard sudah selesai dimuat.

Field yang ditampilkan dan disnapshot saat konfirmasi:

| Field | Aturan |
| --- | --- |
| Target | Wajib; task atau checklist step yang belum selesai |
| Intention | Opsional; trim, maksimum 500 karakter |
| Profile | Selected profile dengan fallback built-in Light Protection |
| Protection level | Berasal dari profile snapshot |
| Duration/preset | Read-only; berasal dari timer run snapshot |
| `timerRunId` | ID prepared run yang sama, bukan ID baru setelah konfirmasi |
| `startedAt` | Timestamp konfirmasi yang sama untuk Guard dan timer |
| `expectedEndAt` | `startedAt + pausedRemainingSeconds` |

Mengganti active target atau mengedit/menghapus profile setelah start tidak
mengubah timer snapshot, guard target snapshot, atau profile snapshot. Dialog
menggunakan `role="dialog"`, label form eksplisit, tombol close ber-`aria-label`,
Escape untuk batal, initial focus, dan copy Indonesia.

## 3. Final lifecycle/state machine

```text
Guard disabled
  fresh focus -- play --> normal timer (tanpa contract/guard)
  break       -- play --> normal break timer

Guard enabled + fresh paused focus
  -- play --> Focus Contract
  -- cancel --> prepared focus tetap paused
  -- confirm invalid --> tetap di contract, tidak membuat guard/timer aktif
  -- confirm valid --> start guard -> persist active timer -> protected active

protected active
  -- pause --> guard paused -> timer paused
  -- reset --> guard stopped -> fresh focus paused
  -- manual mode --> guard stopped -> selected mode paused
  -- explicit stop --> guard stopped -> fresh timer paused
  -- natural/overdue completion --> FocusSession once -> guard completed once
                                 -> short/long break paused, tanpa guard

protected paused
  -- resume --> guard active dengan expectedEndAt baru -> timer active
  -- reset/mode/explicit stop --> guard stopped -> prepared paused run

break
  Guard tidak dibuat; completion kembali ke prepared focus paused.
```

Long break tetap mengikuti keputusan Phase 1: setiap completed focus ke-4.

## 4. Controller dan atomic start

`useProtectedFocusSession` menjadi satu-satunya adapter UI antara
`PomodoroTimer`, `useTimer`, task/target/session hooks, dan Guard hooks. UI tidak
menulis dua lifecycle secara terpisah.

Urutan confirm:

1. validasi run, target, dan profile;
2. tetapkan timestamps dan snapshot;
3. `startGuardSession` dengan prepared `timerRunId`;
4. `startTimer(..., requirePersistence: true)` dengan ID/timestamps/target sama;
5. baca ulang active guard dan verifikasi pasangan ID;
6. baru tutup dialog dan set active target/profile preference.

Compensation:

- bila Guard gagal, timer tidak dimulai;
- bila timer persist/verification gagal, Guard langsung dihentikan;
- bila post-write pairing gagal, timer di-reset dan Guard dihentikan;
- tombol/lifecycle action dikunci oleh mutation guard agar double-click tidak
  menjalankan transaksi paralel.

localStorage tidak menyediakan transaksi lintas-key. Karena itu strategi ini
adalah ordered write + verification + compensation, bukan ACID transaction.

## 5. Reconciliation matrix

Reconciliation berjalan setelah timer, Guard, dan FocusSession storage loaded.
Persisted timer state dibaca sebagai sumber kanonik lintas tab.

| Kondisi persisted | Tindakan |
| --- | --- |
| Guard punya `timerRunId` yang sudah ada di FocusSession | Complete Guard dengan `completedAt`, `focusSessionId`, reason `recovered` |
| Guard active + timer pasangan paused | Pause Guard dengan remaining timer |
| Guard paused + timer pasangan active | Resume Guard dengan `expectedEndAt` timer |
| Guard disabled atau pasangan timer tidak valid | Stop Guard sebagai orphan |
| Guard event tiba sebelum write timer pada confirm | Tahan maksimum 2 detik bila prepared run ID sama; tunggu timer event/compensation |
| Timer active tanpa Guard | Jangan membuat Guard diam-diam; tampilkan warning |
| Break prepared/active | Tidak boleh memiliki active Guard |

Canonical timer read memperbaiki race yang ditemukan saat browser QA: tab kedua
dapat menerima Guard event sebelum timer event dan sebelumnya menghentikan sesi
baru yang valid. Tab lain sekarang menilai state persisted terbaru dan mengenali
window transaksi guard-first.

## 6. Completion, idempotency, dan recovery

- Phase 1 timer lease/ledger tetap menjadi gate completion lintas tab.
- `FocusSession` tetap dedupe berdasarkan `timerRunId`.
- Timer completion callback membuat/mengambil FocusSession lebih dahulu, lalu
  complete Guard dengan `focusSessionId` yang sama.
- `completeGuardSession` dan `stopGuardSession` idempotent untuk ID yang sama.
- Repeated complete dapat menambahkan missing `focusSessionId` ke history tanpa
  menduplikasi record.
- Natural completion memakai reason `completed`; overdue/reconciliation memakai
  reason `recovered` dan timestamp deadline dari timer.
- Bila Guard completion gagal, callback melempar sehingga Phase 1 belum menulis
  completion ledger/transisi dan owner dapat retry.
- Tidak ada catch-up beberapa siklus; aturan Phase 1 tetap berlaku.

## 7. Persistence dan backward compatibility

Tidak ada storage key lama yang diganti atau dihapus. Phase 3 tetap memakai key
Phase 1 dan Phase 2 yang sudah namespaced. Guard session schema tetap version 1,
dengan `durationSeconds` divalidasi pada rentang 1..86400. Input Phase 2 yang
belum menyimpan field tersebut tetap dapat dibaca karena normalizer menurunkannya
dari `expectedEndAt - startedAt` dan membatasinya ke rentang valid; persisted
record final selalu memiliki duration valid.

Seluruh loader/normalizer Phase 1–2 tetap menjadi boundary untuk unknown JSON,
invalid enum/number/timestamp, unknown fields, duplicate ID, dan partial-invalid
collection. Phase 3 tidak menulis enam legacy keys dan tidak mengubah timer key
atau Guard key yang sudah ada.

## 8. Files changed

- `src/types/timer.ts`
- `src/types/focusGuard.ts`
- `src/lib/focusGuardPersistence.ts`
- `src/hooks/useTimer.ts`
- `src/hooks/useFocusGuardSession.ts`
- `src/hooks/useProtectedFocusSession.ts` (baru)
- `src/components/guard/FocusContract.tsx` (baru)
- `src/components/guard/FocusGuardStatus.tsx` (baru)
- `src/components/timer/PomodoroTimer.tsx`
- `docs/focus-guard/PHASE_02_DOMAIN_STORAGE.md`
- `docs/focus-guard/PHASE_03_FOCUS_CONTRACT.md` (baru)

Tidak ada dependency baru dan tidak ada refactor UI besar.

## 9. Verification results

### Automated

- `npm run lint`: lulus, tanpa warning/error.
- `npx tsc --noEmit`: lulus, tanpa type error.
- `npm run build`: lulus; Next.js 14.2.35, static pages 4/4, route `/` 36.6 kB,
  First Load JS 124 kB.
- Repo tidak memiliki test runner/script, sehingga tidak ada unit/integration
  test suite yang dapat diklaim.

### Browser QA yang benar-benar dijalankan

- clean hydration: lulus; hanya log React DevTools, tanpa hydration/runtime error;
- Guard enabled + tanpa task: contract tampil, warning target tampil, submit disabled;
- confirm dengan task A: Guard `Aktif`, Light profile dan target A tampil;
- pause/resume: Guard dan timer berubah `Dijeda`/`Aktif` bersama;
- paused refresh: `00:58` pulih sebagai `00:58` setelah storage hydration;
- active refresh: `00:57` menjadi `00:53`, tetap `Aktif`;
- target snapshot: active target diganti ke B tetapi Guard tetap menampilkan A;
- natural completion: completion prompt tetap A dan FocusSession bertambah satu;
- completed focus ke-4: Long Break terpilih, timer paused, Guard kembali `Siap`;
- two-tab start race: sesi tetap `Aktif` setelah fix canonical persisted read;
- manual switch ke Short Break: Guard berhenti dan break paused;
- reset protected focus: Guard berhenti dan prepared focus paused.

Deterministic review juga mencakup disabled normal timer path, compensation saat
storage write gagal, overdue callback, missing/mismatched pair, duplicate
completion, and malformed Guard/timer boundaries.

## 10. Manual QA checklist tersisa

- [ ] Uji overdue protected run dengan tab benar-benar suspended/device sleep,
      lalu pastikan satu FocusSession dan satu completed Guard history.
- [ ] Uji owner tab crash/force-close ketika protected run aktif dan takeover
      setelah lease expiry pada browser produksi.
- [ ] Simulasikan quota/security failure localStorage saat confirm untuk melihat
      pesan compensation di UI.
- [ ] Uji notification permission dan completion chime pada Chrome/Firefox/Safari.
- [ ] Uji seluruh keyboard shortcut saat contract terbuka/tertutup.
- [ ] Lakukan screen-reader, focus trap, mobile viewport, dan reduced-motion QA.
- [ ] Verifikasi dua tab yang menekan lifecycle controls hampir bersamaan.

## 11. Known limitations dan risk

- localStorage cross-key update tidak atomik; compensation mengurangi tetapi
  tidak menghilangkan risiko process kill tepat di antara writes;
- 2-second guard-first grace mengandalkan timer write segera atau compensation;
- hanya satu active Guard session global dan satu persisted timer run global;
- contract menampilkan task/step incomplete saat dialog dibuka; perubahan list
  dari tab lain ketika dialog sedang terbuka divalidasi kembali saat confirm;
- Guard UI sengaja disabled selama subscription hydration untuk menjaga SSR dan
  first client render konsisten;
- belum ada attention signal, interruption automation, distraction UI, bypass
  enforcement, atau blocking.

## 12. Handoff

Phase 3 siap diajukan untuk acceptance setelah manual QA tersisa dinilai sesuai
risiko produk. Phase berikutnya tidak boleh dimulai tanpa persetujuan eksplisit.
Fondasi yang tersedia untuk fase lanjutan: stable protected lifecycle,
profile/target/intention snapshots, linked timer/FocusSession/Guard IDs, recovery
reason, serta typed interruption/distraction repositories yang belum diaktifkan.
