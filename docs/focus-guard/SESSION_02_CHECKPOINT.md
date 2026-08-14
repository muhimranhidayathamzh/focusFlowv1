# Focus Guard — Session 02 Checkpoint

Tanggal: 2026-07-13

Scope selesai: Phase 4–6

Status: Focus Guard Web MVP dan Sesi 2 selesai; final verification lulus.

## Ringkasan Phase 4–6

### Phase 4 — Web Attention Awareness

- Tracking hanya pada active protected focus session yang reconciled dan memiliki timerRunId cocok.
- `visibilitychange` hidden menjadi sinyal utama; delayed window blur menjadi fallback.
- Minimum-away dua detik, satu stable excursion ID per leave-return, dan satu interruption maksimum.
- Return prompt memakai copy jujur, target snapshot, intention, dan durasi di luar halaman.
- Resolution membedakan returned, intentional, captured, dan unknown.
- Web Lock/lease mengurangi duplicate writer antar-tab tanpa mengumpulkan URL/app/screen content.

### Phase 5 — Distraction Inbox

- Quick capture tersedia saat protected session active/paused, termasuk `Ctrl+Shift+D` saat halaman menerima keyboard event.
- Return prompt dapat meneruskan context interruption ke capture; successful save menyimpan item terlebih dahulu lalu resolution `captured` dengan original `returnedAt`.
- Inbox tersinkron same-tab/cross-tab, newest first, serta mendukung dismiss.
- Conversion menggunakan deterministic task identity/sourceDistractionId dan coordinator idempoten; partial write dapat diretry tanpa membuat task kedua.

### Phase 6 — Session Review and Distraction Insights

- Completion protected baru membuat review pending; stopped/unguarded/legacy history tidak.
- Pending review pulih setelah refresh dan closed setelah completed/skipped.
- Review menggabungkan target/intention/profile/duration, attention summary, DistractionItem, rating opsional, dan target outcome.
- Conversion/dismiss memakai flow Phase 5 yang sama.
- Panel tujuh hari menghitung completed protected sessions, excursions, returned, intentional, captured items, average rating, dan reviewed percentage tanpa Focus Score.

## Web MVP end-to-end

1. User mengaktifkan Guard dan memilih target.
2. Focus Contract membuat protected Guard session yang terikat timerRunId reliable timer.
3. Selama focus, attention awareness hanya mencatat leave-return meaningful dan menawarkan return prompt.
4. Pikiran lain dapat disimpan cepat ke Distraction Inbox tanpa menjeda timer.
5. Natural/recovered completion menyelesaikan Guard, menutup attention intervention, dan membuat review pending.
6. Review dapat menyelesaikan target, membiarkan target untuk nanti, mengolah item Inbox, menyimpan rating opsional, atau dilewati.
7. Insight tujuh hari diturunkan dari data lokal eksplisit dan tidak mengklaim kualitas fokus.

## Storage keys dan schema

Tidak ada key Phase 6 baru. Key MVP:

- `focusflow-timer-v2`;
- `focusflow-sessions-v1`;
- `focusflow-tasks`;
- `focusflow-active-target-v1`;
- `focusflow-guard-profiles-v1`;
- `focusflow-active-guard-session-v1`;
- `focusflow-guard-session-history-v1`;
- `focusflow-guard-interruptions-v1`;
- `focusflow-distraction-inbox-v1`;
- `focusflow-guard-preferences-v1`.

Phase 4 memperluas interruption resolution secara backward-compatible (`intentional`, `captured`). Phase 5 menambahkan optional `Task.sourceDistractionId`. Phase 6 menambahkan optional Guard review fields: `reviewStatus`, `reviewedAt`, `focusRating`, `targetOutcome`, `reviewVersion`. Legacy record tanpa field baru tetap valid.

## Browser QA yang terbukti

Phase 6 in-app browser run membuktikan:

- empty insight state;
- one-minute protected natural completion → satu Session Review;
- direct capture selama timer aktif → satu Inbox item dan timer tetap berjalan;
- pending review bertahan setelah reload;
- review menampilkan target, intention, planned/completed duration, summary, dan item;
- shortcut capture tidak membuka overlay di atas review;
- review conversion membuat task dan mengosongkan active Inbox item;
- rating 4 dan target completion tersimpan;
- insights menunjukkan 1 completed session, 1 captured item, 100% reviewed, average 4.0;
- completed review tidak kembali setelah reload;
- stopped protected session tidak membuka review;
- browser console tidak memiliki warning/error pada flow tersebut.

Phase 4 foreground leave-return dan Phase 5 Return prompt → capture tidak dinyatakan lulus browser karena in-app automation tidak dapat menjamin perpindahan foreground/visibility. Deterministic code-path review tidak menemukan defect konkret: capture memakai guardSessionId yang sama, item stable ID disimpan sebelum interruption update, `returnedAt` asli diteruskan, dan cancel tidak menulis item/resolution.

## Verification

- Phase 6 deterministic harness: 12 check lulus.
- lint: lulus.
- TypeScript: lulus.
- production build: lulus.
- `git diff --check`: lulus (hanya warning line-ending Git yang non-blocking).

## Manual QA tersisa

- real tab leave >2 detik, <2 detik, blur+hidden dedupe, returned/intentional, dan dua-tab attention ownership;
- Return prompt → Simpan untuk nanti dan cancel memakai real visibility transition;
- overdue completion dengan tab benar-benar tertutup/hidden;
- unguarded completion, skip review, continue target, deleted/already-completed target;
- simultaneous two-tab review submit/skip dan fallback tanpa Web Locks;
- completion ketika Capture terbuka;
- keyboard/screen reader, mobile, dan reduced-motion pass lengkap.

## Known risks

- Browser tanpa Web Locks memakai localStorage fallback best-effort untuk concurrent writer.
- Task mutation dan Guard review mutation tidak atomik lintas storage key; retry aman tetapi partial failure dapat meminta aksi ulang.
- Attention data hanya membuktikan halaman FocusFlow ditinggalkan, bukan lokasi atau penyebabnya.
- Bounded history membatasi insight pada data yang masih dipertahankan.

## File utama untuk Sesi 3

- `docs/FOCUS_GUARD_MASTER_BLUEPRINT.md`
- `docs/focus-guard/PHASE_04_ATTENTION_AWARENESS.md`
- `docs/focus-guard/PHASE_05_DISTRACTION_INBOX.md`
- `docs/focus-guard/PHASE_06_SESSION_REVIEW.md`
- `docs/focus-guard/SESSION_02_CHECKPOINT.md`
- `src/hooks/useProtectedFocusSession.ts`
- `src/hooks/useFocusAttentionAwareness.ts`
- `src/hooks/useFocusSessionReview.ts`
- `src/lib/focusGuardPersistence.ts`
- `src/lib/focusGuardReview.ts`
- `src/types/focusGuard.ts`

## Current git status

Working tree tetap dirty dan berisi pekerjaan pengguna/Phase 0–6 yang belum di-reset, di-clean, di-checkout, di-stage ulang, atau di-commit oleh Phase 6. Status aktual harus dibaca dengan `git status --short` sebelum Sesi 3 karena checkpoint ini tidak mengambil ownership atas perubahan yang sudah ada.

## Batas web app menuju extension

Web MVP tidak dapat menginspeksi tab URL lain, aplikasi aktif, atau menerapkan blocking di luar halaman FocusFlow. Kemampuan semacam itu membutuhkan boundary extension/desktop yang eksplisit, permission minimal, privacy contract baru, dan persetujuan Phase 7. Phase 6 tidak memulai pekerjaan tersebut.
