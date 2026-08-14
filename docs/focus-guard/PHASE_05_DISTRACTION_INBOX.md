# Focus Guard Phase 5 — Distraction Inbox

Tanggal implementasi: 2026-07-13 (Asia/Makassar)

## 1. Scope dan hasil

Phase 5 menyediakan jalur cepat untuk menyimpan hal yang muncul saat sesi fokus
tanpa mengubah timer atau target aktif. Implementasi memakai domain/repository
Phase 2, protected-session controller Phase 3, dan attention lifecycle Phase 4.

Hasil utama:

- quick capture dari status Focus Guard dan shortcut `Ctrl + Shift + D`;
- integrasi `Simpan untuk nanti` pada Return to Focus prompt;
- Inbox tenang setelah Task List, berisi item `inbox` terbaru lebih dahulu;
- aksi `Jadikan task` yang idempotent dan tidak mengganti target aktif;
- aksi `Hapus dari inbox` yang menyimpan status `dismissed` secara idempotent;
- same-tab custom event dan cross-tab `storage` event untuk sinkronisasi;
- attention suppression eksplisit saat capture terbuka;
- tidak ada session review, score, analytics, blocking, atau Phase 6.

## 2. Capture eligibility

Quick capture hanya tersedia bila seluruh kondisi berikut benar:

1. timer, Guard storage, FocusSession, dan reconciliation sudah siap;
2. Focus Guard enabled dan Focus Contract tidak terbuka;
3. timer mode `focus` dan run sudah pernah dimulai;
4. timer berstatus `active` atau `paused`;
5. active Guard session berstatus `active` atau `paused`;
6. `timerRunId` Guard sama dengan timer run ID;
7. controller tidak sedang melakukan mutasi.

Eligibility capture sengaja terpisah dari attention tracking: capture boleh saat
protected timer paused, sedangkan attention awareness hanya armed saat active.
Normal timer, break, disabled Guard, prepared run, mismatch, stopped/completed
session, hydration, dan reconciliation tidak menampilkan control capture.

Capture dari Return prompt menambahkan syarat bahwa pending interruption dan
Guard session memiliki `guardSessionId` yang sama. Inbox list tetap tersedia
tanpa active session.

Jika session berhenti/selesai dari tab lain ketika dialog sudah terbuka, request
yang sudah dibuka tetap memegang snapshot `guardSessionId`, target, ID item, dan
`capturedAt`. Submit tetap menyimpan item ke session historis tersebut; dialog
tidak menghidupkan kembali Guard atau timer.

## 3. Quick capture UX

Status Focus Guard active/paused menampilkan `Simpan distraksi` dan hint
`Ctrl ⇧ D`. Dialog capture menyediakan:

- target snapshot read-only;
- satu textarea dengan batas 300 karakter;
- copy “Tidak perlu dikerjakan sekarang”;
- submit `Simpan untuk nanti` atau `Ctrl + Enter`;
- cancel button, close button, dan Escape;
- autofocus pada textarea dan focus restore ke control sebelumnya;
- validasi empty dan defensive over-limit check;
- confirmation singkat setelah write berhasil.

Capture tidak memanggil pause/resume/reset/switch-mode dan tidak mengubah active
target. Draft berada di component UI; persistence dan orchestration berada di
hooks.

## 4. Shortcut behavior

Listener keyboard global dibersihkan saat unmount. `Ctrl + Shift + D` hanya
membuka capture ketika canonical eligibility true dan dialog belum terbuka.
Event dari `input`, `textarea`, `select`, atau `contenteditable` diabaikan.
`preventDefault()` hanya dipanggil bila aplikasi benar-benar membuka dialog,
sehingga shortcut yang ditolak/tidak eligible tidak diklaim dari browser.

Shortcut ini bukan global desktop shortcut. Ia hanya bekerja ketika halaman
FocusFlow menerima keyboard event.

## 5. Return prompt integration

Return prompt hanya mengirim intent `openFromReturnPrompt`; prompt tidak menulis
DistractionItem sendiri.

Flow sukses:

1. capture request menyalin pending interruption ID, original `returnedAt`,
   `guardSessionId`, dan Guard target snapshot;
2. DistractionItem disimpan memakai stable request ID;
3. interruption di-update menjadi `resolution: captured` dengan original
   `returnedAt`;
4. pending Return prompt ditutup setelah kedua langkah berhasil.

Cancel sebelum save tidak membuat item dan membuka kembali Return prompt karena
pending intervention dipertahankan selama suppression. Bila item berhasil
disimpan tetapi update interruption gagal, item tidak dihapus, dialog tetap
terbuka, dan pesan meminta retry. Retry memakai ID item yang sama sehingga tidak
membuat duplicate. Bila pengguna membatalkan setelah partial success, item tetap
aman di Inbox dan Return prompt kembali dengan resolution sebelumnya
(`unknown`); item tidak diklaim sebagai `captured` sampai retry berhasil.

## 6. Inbox UX

`DistractionInboxPanel` adalah panel collapsible setelah Task List. Ia:

- menampilkan hanya status `inbox`, newest-first berdasarkan `capturedAt`;
- menampilkan teks, waktu ringkas, dan target snapshot session bila tersedia;
- memakai empty state “Belum ada yang perlu disimpan untuk nanti.”;
- menyembunyikan item converted/dismissed dari UI utama;
- menyediakan `Jadikan task` dan `Hapus dari inbox`.

Dismiss mengubah status menjadi `dismissed`, menyimpan `resolvedAt`, tidak
menghapus task, dan aman dipanggil ulang. Phase 5 tidak membuat archive view atau
undo.

## 7. Conversion transaction dan idempotency

Task mendapat field backward-compatible:

```ts
sourceDistractionId?: string
```

Normalizer task mempertahankan field valid ini dan tetap menerima seluruh task
historis tanpa field tersebut. Storage key task lama tetap digunakan.

Conversion coordinator menjalankan transaksi logis berikut:

```text
read latest DistractionItem
  -> already converted: return convertedTaskId
  -> not inbox: stop safely
  -> create/recover deterministic Task
  -> mark DistractionItem converted-to-task
  -> expose success or partial task ID
```

Task memakai ID deterministik `task-from-<distractionId>` dan menyimpan
`sourceDistractionId`. `addTaskFromDistraction` selalu reread task storage,
mengembalikan existing task bila source/ID sudah ada, dan menulis same-tab event.
Double click/retry tidak membuat task kedua.

Browser dengan Web Locks menjalankan conversion di lock eksklusif:

```text
focusflow-distraction-conversion:<distractionId>
```

Bila task write berhasil tetapi marking item gagal, task dipertahankan dan UI
menampilkan partial-result message. Retry menemukan deterministic task lalu
mencoba marking lagi. Tidak ada rollback yang dapat menghilangkan task pengguna.

Tanpa Web Locks, deterministic identity tetap mencegah dua task dengan source ID
berbeda pada retry normal, tetapi localStorage tidak memiliki transaksi/CAS.
Concurrent write ekstrem antartab masih dapat mengalami last-writer-wins atau
kehilangan unrelated update; ini didokumentasikan sebagai fallback limitation.

## 8. Persistence dan compatibility

Distraction tetap memakai storage key Phase 2:

```text
focusflow-distraction-inbox-v1
```

Tidak ada repository/storage implementation kedua. `AddDistractionInput`
memperoleh optional `id` agar orchestration dapat melakukan idempotent retry.
`addDistractionItem` mengembalikan existing record untuk ID yang sama.
Historical distraction/task records tetap dinormalisasi, invalid sibling fail
safe, history tidak dibersihkan otomatis, dan collection tetap bounded sesuai
Phase 2.

Return capture memakai resolution `captured` yang sudah ada pada domain Phase 2;
tidak ada perubahan schema interruption atau storage key.

## 9. Attention suppression

Capture open state diteruskan ke attention hook sebagai `isSuppressed`.
Suppression membersihkan blur candidate, pending excursion, dan writer ownership
tanpa menghapus pending Return intervention. Ini menjamin:

- buka/tutup/click dialog tidak membuat excursion baru;
- Return prompt → Capture mempertahankan interruption context;
- cancel dapat kembali ke Return prompt;
- modal tidak memenuhi DOM-event logic di protected-session controller;
- listener attention tetap satu set, latest-state ref tetap digunakan, dan tidak
  ada effect loop.

Focus Contract tetap memakai eligibility suppression Phase 3/4. Capture ketika
paused tidak otomatis me-resume timer.

## 10. Same-tab dan cross-tab synchronization

Distraction repository mengirim custom same-tab event setelah write. Tab lain
menerima native `storage` event. Hook mereload normalized collection, sehingga
capture muncul langsung, resolved item hilang di semua tab, dan repeated event
tidak menambah item.

Task hook memiliki same-tab event `focusflow-tasks-updated` dan cross-tab storage
listener. Task hasil conversion langsung muncul pada Task List di tab yang sama
tanpa mengganti active focus target.

## 11. Privacy behavior

DistractionItem hanya menyimpan:

- teks yang ditulis pengguna;
- `capturedAt`;
- optional `guardSessionId`;
- status, `resolvedAt`, dan optional `convertedTaskId`.

Implementasi tidak membaca atau menyimpan clipboard, URL, browser history, app
aktif, screenshot/screen content, page content, atau keystroke selain shortcut
eksplisit. Tidak ada kategorisasi AI atau klaim psikologis.

## 12. Preflight Phase 4

Sebelum Phase 5, handoff Phase 4 dan implementation path direview ulang:

- hidden adalah source utama dan blur candidate di-upgrade, bukan diduplikasi;
- threshold meaningful excursion tepat 2.000 ms;
- stable excursion ID dan repository dedupe membatasi satu write per cycle;
- `returnedAt` diambil saat return dan dipertahankan oleh resolution update;
- `returned` dan `intentional` ditulis melalui repository yang sama;
- hydration/reconciliation, paused/break/normal timer, reload, completion, dan
  ownership invalidation fail safe.

Tidak ditemukan defect konkret Phase 4. In-app browser tetap tidak menyediakan
kontrol foreground-tab deterministik, sehingga protected leave >2 detik, leave
<2 detik, blur+hidden, dan klik resolution Return prompt tidak diklaim lulus
browser preflight. Hasilnya tetap deterministic code-path review dan ada pada
manual QA.

## 13. Files changed

- `src/types/distraction.ts`
- `src/types/task.ts`
- `src/lib/focusGuardPersistence.ts`
- `src/hooks/useTasks.ts`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/hooks/useProtectedFocusSession.ts`
- `src/hooks/useFocusAttentionAwareness.ts`
- `src/hooks/useDistractionCaptureFlow.ts` (baru)
- `src/hooks/useDistractionTaskConversion.ts` (baru)
- `src/components/guard/DistractionCapture.tsx` (baru)
- `src/components/guard/DistractionInboxPanel.tsx` (baru)
- `src/components/guard/FocusGuardStatus.tsx`
- `src/components/guard/ReturnToFocusPrompt.tsx`
- `src/components/timer/PomodoroTimer.tsx`
- `src/app/page.tsx`
- `docs/focus-guard/PHASE_05_DISTRACTION_INBOX.md` (baru)

Tidak ada dependency atau storage key baru.

## 14. Verification

### Automated

- `npm run lint`: lulus tanpa warning/error.
- `npx tsc --noEmit`: lulus tanpa type error.
- `npm run build`: lulus; Next.js 14.2.35, static pages 4/4.
- `git diff --check`: dijalankan kembali setelah dokumentasi final.
- Repo tidak memiliki test runner/script, sehingga tidak ada unit/integration
  suite yang diklaim.

### Browser QA yang benar-benar dijalankan

Pada origin localhost terpisah:

- Guard disabled: protected quick-capture control tidak tersedia;
- protected active: control tersedia, dialog autofocus, target snapshot benar,
  empty submit disabled, Ctrl+Enter menyimpan satu item, confirmation tampil,
  dan wall-clock timer tetap berjalan;
- shortcut pada textarea tidak membuka duplicate dialog;
- input 301 karakter ditolak dengan pesan batas 300;
- protected paused: control dan `Ctrl + Shift + D` tetap membuka dialog, Escape
  cancel, item count tidak berubah, dan timer tidak resume;
- refresh mempertahankan item, Guard paused, target, dan Inbox;
- conversion langsung menambah task ke Task List dan mengosongkan Inbox;
- double-click conversion pada item lain menambah tepat satu task;
- dismiss menghilangkan item tanpa menambah task;
- tab kedua menerima capture, dan dismiss dari tab kedua menghilangkan item dari
  tab pertama;
- capture modal saat active tidak menghasilkan Return prompt;
- session QA dihentikan melalui control Guard;
- tidak ada console warning/error pada kedua tab.

Return prompt → Capture/resolution `captured`, active-session completion ketika
dialog terbuka, Web Lock race simultan, foreground attention events, dan mobile/
reduced-motion tidak diklaim lulus browser QA. Viewport override browser tidak
mengubah viewport halaman secara terukur, sehingga mobile tetap manual.

## 15. Manual QA tersisa

- [ ] Phase 4 foreground preflight: leave >2 detik, <2 detik, blur+hidden, dan
      resolution `returned`/`intentional`.
- [ ] Return prompt → `Simpan untuk nanti`; cek satu item, resolution `captured`,
      original `returnedAt`, dan prompt tertutup.
- [ ] Cancel Return capture; cek tidak ada item dan Return prompt muncul kembali.
- [ ] Simulasikan item-save sukses/interruption-update gagal; cek retry tidak
      menduplikasi item dan partial item tetap aman.
- [ ] Stop/complete session dari tab lain ketika capture terbuka; submit tetap
      terkait historical `guardSessionId` dan tidak menghidupkan session.
- [ ] Concurrent conversion benar-benar simultan pada dua tab dengan Web Locks.
- [ ] Browser tanpa Web Locks; evaluasi last-writer-wins fallback.
- [ ] Guard disabled dengan normal timer active dan break modes; shortcut/control
      capture tetap tidak tersedia.
- [ ] Keyboard focus trap expectation, tab order, screen-reader labels, dan focus
      restore lintas browser.
- [ ] Mobile viewport dan `prefers-reduced-motion` visual QA.

## 16. Known limitations

- Quick capture hanya tersedia untuk protected active/paused session; tidak ada
  standalone composer di luar session pada Phase 5.
- Capture request hanya hidup di memory. Reload saat dialog terbuka membuang draft
  yang belum disubmit.
- Cross-storage conversion bukan transaksi atomik. Web Lock mengoordinasikan
  writer modern-browser; fallback localStorage tetap best effort.
- Partial task/item state dipertahankan dan dapat diretry, tetapi Phase 5 tidak
  menyediakan background retry queue.
- Resolved item disimpan tetapi tidak memiliki archive/history UI.
- Tidak ada undo dismiss, bulk actions, search, categorization, analytics, atau
  post-session review.
- Collection DistractionItem tetap dibatasi 500 record oleh repository Phase 2.

## 17. Handoff untuk Phase 6

Phase 5 siap menjadi sumber data review setelah manual QA prioritas di atas.
Phase 6 dapat membaca immutable Guard target snapshot, interruption resolution,
dan resolved DistractionItem tanpa mengubah storage key. Review harus tetap
bersifat reflektif, bukan scoring/shaming, dan harus menghormati partial-result
serta local-only privacy guarantees.

Phase 6 belum dimulai.
