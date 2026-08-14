# Phase 6 — Session Review and Distraction Insights

Status: selesai untuk Focus Guard Web MVP (Sesi 2).

## Tujuan produk

Phase 6 menutup protected focus session dengan ringkasan lokal yang singkat dan nonjudgmental. Review menjelaskan rencana sesi, durasi, perpindahan perhatian yang benar-benar tercatat, hal yang disimpan untuk nanti, outcome target, dan rating opsional. Phase ini tidak membuat Focus Score dan tidak menyimpulkan kualitas fokus dari jumlah event.

## Review eligibility

Review hanya tersedia bila seluruh kondisi berikut benar:

- Guard session berstatus `completed`;
- `endReason` adalah `completed` atau `recovered`;
- `timerRunId` dan `focusSessionId` valid;
- `reviewStatus` adalah `pending`;
- hydration dan reconciliation controller selesai;
- tidak ada overlay dengan prioritas lebih tinggi.

Completion protected session baru menambahkan metadata pending tepat ketika active Guard dipindahkan ke history. Session `stopped`, timer tanpa Guard, break, Guard disabled, dan history lama tanpa metadata review tidak otomatis membuat review. Bila ada beberapa review pending, session dengan waktu selesai terbaru ditampilkan lebih dahulu.

## Persistence dan kompatibilitas schema

Tidak ada storage key baru. Metadata berikut ditambahkan secara opsional pada `FocusGuardSession` di `focusflow-guard-session-history-v1`:

- `reviewStatus: pending | completed | skipped`;
- `reviewedAt` untuk completed/skipped;
- `focusRating` integer opsional 1–5;
- `targetOutcome: completed | continue` untuk submitted review;
- `reviewVersion`, saat ini `1`.

Normalizer membedakan metadata absent, valid, dan invalid. Record historis tanpa field review tetap valid dan tidak menjadi pending. Metadata review invalid dibuang secara fail-safe tanpa membuang base Guard session. Rating di luar 1–5, outcome invalid, timestamp invalid, dan kombinasi field yang tidak cocok dengan status ditolak.

Submit dan skip memakai mutation lock Guard yang sama dengan lifecycle session. Mutation membaca state terbaru di dalam lock, sehingga retry setelah state `completed`/`skipped` bersifat idempoten. Same-tab custom event dan cross-tab `storage` event memperbarui history serta menutup review stale. Web Locks menjadi jaminan writer tunggal saat tersedia; fallback localStorage tetap idempoten untuk retry berurutan, tetapi simultaneous write pada browser tanpa Web Locks bersifat best-effort/last-writer.

## Trigger dan recovery

- Natural completion menulis FocusSession dan completed Guard history, lalu review dibuka setelah reconciliation stabil.
- Overdue recovery menggunakan jalur completion Guard yang sama dengan `endReason: recovered`; notification/chime tidak diputar ulang oleh review.
- Refresh membaca `reviewStatus: pending` dari history dan membuka kembali review setelah hydration.
- Completed/skipped review tidak muncul lagi.
- Duplicate completion menemukan history yang sudah ada dan tidak membuat metadata atau record kedua.
- Completion saat Distraction Capture terbuka tetap menyelesaikan timer; review menunggu hingga capture ditutup/disimpan.
- Pending Return prompt dibersihkan oleh attention lifecycle saat Guard tidak lagi eligible, kemudian review menjadi overlay berikutnya.

## Prioritas overlay

Satu overlay interaktif dijaga dengan urutan:

1. Focus Contract;
2. Return to Focus;
3. Distraction Capture;
4. Session Review.

Review diblokir sementara saat Contract, Return prompt, Capture, atau Timer Settings terbuka. `Ctrl+Shift+D` dinonaktifkan ketika review aktif. Review memakai `role="dialog"`, `aria-modal`, label/deskripsi, initial focus, focus trap, dan focus restoration. Escape berarti skip permanen untuk review tersebut; perilaku ini ditampilkan di UI. Motion mengikuti kelas `motion-reduce` yang ada dan layout memakai breakpoint mobile sederhana.

## Target completion

Review menggunakan `targetSnapshot` Guard, bukan active target yang mungkin sudah berubah.

- `Tandai target selesai` memanggil `completeFocusTarget` existing untuk task/step yang persis sama.
- Target yang sudah selesai diterima secara idempoten.
- Target yang hilang atau tidak tersedia menonaktifkan completion dan mengarahkan pengguna ke `Lanjutkan nanti`.
- `Lanjutkan nanti` tidak mengubah task atau active target.
- Active target hanya dibersihkan setelah submit berhasil dan identity-nya masih sama dengan snapshot.
- Bila task completion berhasil tetapi penyimpanan review gagal, review tetap pending. Retry melihat target sudah selesai lalu mencoba penyimpanan review lagi; task tidak diduplikasi.

Completion prompt lama di PomodoroTimer tetap dipakai untuk unguarded focus session. Protected completion tidak membuka prompt lama, sehingga tidak ada dua pertanyaan outcome target.

## Distraction actions

Review menampilkan semua `DistractionItem` milik `guardSessionId` tersebut beserta statusnya. Item `inbox` dapat:

- dikonversi melalui coordinator Phase 5 yang sama (`useDistractionTaskConversion`);
- didismiss melalui repository Phase 5 yang sama.

Tidak ada implementation conversion kedua. Deterministic source identity, `sourceDistractionId`, Web Lock/fallback, partial-result retry, dan same-tab task synchronization tetap mengikuti Phase 5. Review dapat disubmit tanpa memproses item.

## Descriptive summary

Aturan diturunkan langsung dari data eksplisit:

- total 0: `Sesi berjalan tanpa perpindahan halaman yang tercatat.`;
- `returned > 0`: jumlah return disebutkan;
- intentional lebih dari separuh total: mayoritas ditandai disengaja;
- ada DistractionItem session: jumlah hal yang disimpan disebutkan;
- unresolved/unknown: jumlah belum terklasifikasi disebutkan.

Tidak ada Focus Score atau penilaian kualitas fokus.

## Insight tujuh hari

Window dimulai pada awal hari lokal enam tanggal kalender sebelum hari ini dan berakhir pada waktu sekarang.

- protected sessions completed: Guard history `status=completed` dalam window;
- meaningful excursions: semua FocusInterruption untuk session ID tersebut;
- returned: resolution `returned`;
- intentional: resolution `intentional`, ditampilkan terpisah;
- captured distractions: semua DistractionItem yang terhubung ke completed Guard session dalam window, terlepas dari status inbox/converted/dismissed;
- average self-rating: mean hanya dari rating valid 1–5; missing rating tidak menjadi nol;
- reviewed percentage: `reviewStatus=completed / completed Guard sessions`, dibulatkan ke persen terdekat.

Session stopped dan unguarded FocusSession tidak dihitung. Empty state menjelaskan kapan data akan tersedia. Panel tidak menambahkan chart atau dependency baru.

## Privacy

Review dan insight hanya membaca data lokal yang sudah ada: Guard metadata, timestamp/type/resolution attention, teks yang ditulis pengguna, rating opsional, dan outcome task. Tidak ada URL, aplikasi aktif, screenshot, browser history, clipboard, page content, cloud analytics, atau telemetry baru.

## Files changed

- `src/types/focusGuard.ts`
- `src/lib/focusGuardReview.ts`
- `src/lib/focusGuardPersistence.ts`
- `src/hooks/useFocusGuardSession.ts`
- `src/hooks/useProtectedFocusSession.ts`
- `src/hooks/useFocusSessionReview.ts`
- `src/hooks/useFocusGuardInsights.ts`
- `src/hooks/useTasks.ts`
- `src/hooks/useKeyboardShortcuts.ts`
- `src/components/guard/SessionReview.tsx`
- `src/components/stats/FocusGuardInsightsPanel.tsx`
- `src/components/timer/PomodoroTimer.tsx`
- `src/app/page.tsx`
- `scripts/verify-focus-guard-phase6.mjs`
- `docs/focus-guard/PHASE_06_SESSION_REVIEW.md`
- `docs/focus-guard/SESSION_02_CHECKPOINT.md`

## Verification

Deterministic harness (`node scripts/verify-focus-guard-phase6.mjs`) lulus 12 check:

- review normalizer dan legacy record tanpa metadata;
- pending → completed dan pending → skipped;
- repeated submit/skip;
- invalid rating;
- populated/empty descriptive calculations;
- seven-day formulas;
- stopped/old-session exclusion;
- missing/zero-rating exclusion.

Static verification:

- `npm run lint`: lulus;
- `npx tsc --noEmit`: lulus;
- `npm run build`: lulus;
- `git diff --check`: lulus (hanya warning line-ending Git yang non-blocking).

Browser QA yang benar-benar dibuktikan pada in-app browser:

- insight empty state tampil tanpa Focus Score;
- protected natural completion membuka satu review;
- direct protected capture tetap membiarkan timer berjalan dan item masuk Inbox;
- review menampilkan target/intention/duration/item;
- refresh mempertahankan pending review;
- `Ctrl+Shift+D` tidak membuka capture di atas review;
- conversion dari review membuat satu task dan mengubah status item;
- rating 4 + target complete tersimpan, target yang tepat selesai, active target dibersihkan;
- insight menjadi 1 completed, 1 captured, 100% reviewed, average 4.0;
- refresh setelah submit tidak membuka review lagi;
- stopped protected session tidak membuka review;
- tidak ada warning/error console selama flow tersebut.

## Manual QA tersisa

- unguarded natural completion dan overdue recovery end-to-end;
- skip melalui UI serta repeated refresh;
- target continue, target deleted, dan externally-already-completed target;
- dua tab yang sama-sama terbuka ketika submit/skip berlangsung;
- completion tepat saat capture masih terbuka;
- Return prompt → Capture preflight Phase 5 karena foreground tab automation tidak dapat membuktikan visibility transition;
- keyboard focus trap/Shift+Tab, Escape, screen reader, mobile viewport, dan reduced-motion secara manual;
- populated attention summary dengan returned/intentional/unresolved melalui real browser leave-return.

## Known limitations

- Web app hanya mengetahui visibility/focus halaman FocusFlow; tidak mengetahui URL atau aplikasi luar.
- Writer coordination paling kuat ketika Web Locks tersedia. Browser tanpa Web Locks memakai fallback localStorage best-effort.
- Task storage dan Guard history adalah dua key lokal terpisah, jadi target completion dan review submission bukan transaksi atomik. Retry menjaga target yang sudah selesai dan review pending, tetapi kegagalan storage dapat membutuhkan retry pengguna.
- Model FocusSession menyimpan configured completed duration, bukan breakdown active/paused elapsed yang terpisah.
- Review history dibatasi oleh bounded Guard history yang sudah ada.

## Focus Guard Web MVP status

Phase 0–6 selesai dalam scope web: reliable timer, local domain storage, Focus Contract, attention awareness, Distraction Inbox, Session Review, dan insight tujuh hari. Tidak ada blocking, extension, atau cloud telemetry.

## Handoff Sesi 3 / Phase 7

Sesi 3 boleh dimulai hanya setelah persetujuan eksplisit. Batas utama web app adalah tidak dapat mengetahui atau memblokir website/aplikasi luar secara andal. Phase 7 harus memulai dari kontrak data/privacy dan boundary extension, bukan mengubah interpretasi event Phase 4 menjadi klaim aktivitas yang tidak dapat dibuktikan.
