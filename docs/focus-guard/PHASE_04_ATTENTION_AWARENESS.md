# Focus Guard Phase 4 — Web Attention Awareness

Tanggal implementasi: 2026-07-13 (Asia/Makassar)

## 1. Scope dan hasil

Phase 4 membantu pengguna kembali ke target setelah meninggalkan halaman
FocusFlow. Web app tidak mengetahui aktivitas di luar halaman, sehingga event
selalu dipresentasikan sebagai attention excursion, bukan bukti distraksi.

Hasil utama:

- lifecycle attention terpisah dari protected-session controller;
- `document.visibilitychange`, `window.blur`, dan `window.focus` ditangani dengan
  latest-state refs dan listener yang dibersihkan saat unmount;
- blur + hidden digabung menjadi satu leave-return cycle;
- excursion di bawah 2 detik diabaikan;
- event valid ditulis ke repository interruption Phase 2 dengan resolution awal
  `unknown`;
- return prompt menampilkan target snapshot, intention, dan waktu di luar halaman;
- `Kembali fokus` menyimpan `returned`, sedangkan `Ini bukan distraksi` menyimpan
  backward-compatible resolution baru `intentional`;
- timer tidak dihentikan, ditambah, dikurangi, atau di-reset oleh attention flow;
- tidak ada Distraction Inbox, capture, review, blocking, extension, atau Phase 5/6.

## 2. Eligibility rules

Tracking hanya armed bila seluruh kondisi berikut benar pada state React dan
dibuktikan ulang dari persisted canonical state:

1. timer, Guard preferences/profiles/session, dan FocusSession sudah hydrated;
2. reconciliation Phase 3 sudah selesai;
3. Focus Guard enabled;
4. Focus Contract tidak terbuka;
5. timer mode `focus`, status `active`, dan `hasStarted === true`;
6. active Guard session berstatus `active`;
7. Guard `timerRunId` sama dengan timer run ID;
8. deadline timer dan Guard belum lewat;
9. tab memegang attention writer ownership untuk Guard session tersebut.

Konsekuensinya, normal timer, paused timer, short/long break, disabled Guard,
prepared run, stopped/completed session, mismatched session, initial hydration,
dan reconciliation window tidak membuat excursion.

## 3. Browser event state machine

```text
ineligible / hydrating / reconciling
  -> no ownership, no excursion, no prompt

eligible protected active focus
  -> acquire one writer for guardSessionId
  -> armed

armed -- window blur --> wait 500 ms
  -> focus kembali / hidden tidak terjadi -> cancel blur candidate
  -> tetap visible + tidak focused -> away(window-blur)

armed -- visibility hidden --> away(page-hidden)
away(window-blur) -- visibility hidden --> upgrade source to page-hidden

away -- repeated blur/hidden --> ignore
away -- visible/focus return --> capture returnedAt once
  -> away < 2 s -> discard
  -> eligibility/session/deadline/ownership invalid -> discard
  -> valid -> persist interruption(resolution=unknown) -> show prompt

prompt -- Kembali fokus --> resolution=returned -> close
prompt -- Ini bukan distraksi --> resolution=intentional -> close
prompt -- Escape --> keep resolution=unknown -> close
prompt -- stop/pause/complete/mode switch/disable --> close safely
```

`returnedAt` diambil saat halaman kembali, bukan saat pengguna menekan tombol.
Resolusi prompt selalu mempertahankan timestamp tersebut.

## 4. Deduplication strategy

- `visibilitychange: hidden` adalah source utama.
- `window.blur` hanya fallback setelah 500 ms bila document tetap visible dan
  `document.hasFocus()` masih false.
- Bila hidden muncul setelah blur candidate/excursion, excursion yang sama
  di-upgrade menjadi `page-hidden`; tidak dibuat ID kedua.
- Satu in-memory `excursionRef` menerima paling banyak satu return.
- Repeated hidden, blur, visible, dan focus events tidak menambah record.
- Stable ID dibuat saat excursion dimulai dan dipakai langsung sebagai ID
  repository. Repository tetap melakukan dedupe ID pada write.
- React Strict Mode/remount membersihkan listener, timer blur, ownership, dan
  pending excursion. Pending excursion tidak ditulis sebelum return valid.
- Minimum-away threshold adalah tepat 2.000 ms. Blur fallback menyimpan waktu
  blur asli, sehingga debounce 500 ms tidak menaikkan threshold efektif.

## 5. Multi-tab strategy

Strong path memakai Web Lock eksklusif:

```text
focusflow-attention-owner:<guardSessionId>
```

Satu tab menjadi writer untuk satu protected Guard session. Tab non-owner tidak
membuat excursion atau interruption. Lock dipertahankan selama session eligible
dan dilepas saat pause/stop/complete/disable/mode switch, session ID berubah,
atau component unmount.

Browser tanpa Web Locks memakai expiring localStorage lease:

```text
focusflow-attention-owner-v1
```

Lease berumur 12 detik, diperbarui berkala, diverifikasi setelah write, dan hanya
dihapus oleh owner/session yang cocok. Fallback ini best effort karena
localStorage tidak menyediakan CAS. Bila ownership berpindah saat tab lama
background-throttled, tab lama membuang excursion-nya saat return; ini memilih
missed event daripada duplicate event.

Guarantee: dengan Web Locks, hanya satu writer dapat menulis untuk Guard session
yang sama. Fallback lease mencegah duplicate pada operasi normal, tetapi tidak
memberi hard guarantee saat browser/process gagal tepat di antara read/write.

## 6. Interruption persistence mapping

Phase 4 tetap memakai storage key Phase 2:

```text
focusflow-guard-interruptions-v1
```

Tidak ada interruption-history key baru dan history tidak pernah dibersihkan
otomatis.

| Field | Mapping |
| --- | --- |
| `id` | stable per-excursion ID |
| `guardSessionId` | active canonical Guard session ID |
| `occurredAt` | waktu hidden/blur asli |
| `returnedAt` | waktu visible/focus return |
| `type` | `page-hidden` atau `window-blur` |
| `source` | `document.visibilitychange` atau `window.blur` |
| `resolution` | awal `unknown`; kemudian `returned` atau `intentional` |

`intentional` adalah penambahan enum backward-compatible. Schema envelope tetap
version 1, normalizer menerima seluruh resolution Phase 2 lama, historical record
tanpa resolution tetap valid, unknown field tetap diabaikan, dan invalid record
tetap fail safe tanpa membuang valid sibling.

## 7. Return prompt actions

Prompt non-blocking menampilkan:

- “Kamu meninggalkan halaman FocusFlow”;
- “Siap kembali ke target?”;
- Guard `targetSnapshot`, bukan active target terkini;
- intention snapshot bila ada;
- “Waktu di luar halaman” dengan durasi detik/menit;
- copy pengingat bahwa leave belum tentu distraksi.

Actions:

- `Kembali fokus`: update resolution ke `returned`, mempertahankan `returnedAt`,
  lalu menutup prompt;
- `Ini bukan distraksi`: update resolution ke `intentional`, mempertahankan
  `returnedAt`, lalu menutup prompt;
- Escape: menutup prompt dan membiarkan resolution awal `unknown`;
- `Hentikan sesi terlindungi`: emergency stop Phase 3 tetap tersedia dari dalam
  card agar prompt tidak menutupi satu-satunya exit pada mobile.

Prompt tidak memiliki persistence logic. Semua write dilakukan oleh attention
hook melalui `useFocusInterruptions`. Initial focus masuk ke `Kembali fokus`,
buttons keyboard accessible, dialog memiliki title/description ARIA, tidak ada
full-screen pointer-blocking overlay, dan motion transition menghormati
`prefers-reduced-motion`.

## 8. Refresh, overdue, dan lifecycle edges

- Pending excursion hanya disimpan di memory. Reload/navigation membuang pending
  tanpa write, sehingga refresh biasa tidak menjadi interruption atau prompt.
- Return memvalidasi ulang persisted preferences, active Guard, timer run, mode,
  status, ID pairing, dan kedua deadline sebelum menulis.
- Bila session selesai saat user pergi, deadline/active-state validation membuang
  pending excursion dan Phase 3 tetap menyelesaikan FocusSession/Guard lifecycle.
- Bila Guard dihentikan, dipause, disabled, mode diganti, atau contract dibuka,
  ownership, blur timer, pending excursion, dan prompt dibersihkan.
- Overdue return tidak membuat interruption baru dan tidak membuka stale prompt.
- Perubahan active target tidak memengaruhi prompt karena context berasal dari
  immutable Guard `targetSnapshot`.
- Modal/control internal tidak memicu window blur; eligibility juga secara
  eksplisit false selama Focus Contract terbuka.

## 9. Privacy guarantees

Phase 4 hanya menyimpan timing dan vocabulary attention minimal. Implementasi
tidak membaca atau menyimpan:

- URL/tab title/hostname halaman luar;
- nama website atau aplikasi;
- browser history;
- screenshot, screen capture, atau page content;
- clipboard;
- keyboard input/keystroke;
- nama process atau active app.

UI tidak membuat inferensi bahwa pengguna terdistraksi atau gagal, tidak
menyebut situs tertentu, dan tidak mengklaim melihat aktivitas pengguna. Source
hanya nama API lokal
`document.visibilitychange`/`window.blur`.

## 10. Files changed

- `src/types/focusGuard.ts`
- `src/lib/focusGuardPersistence.ts`
- `src/lib/attentionOwnership.ts` (baru)
- `src/hooks/useFocusAttentionAwareness.ts` (baru)
- `src/hooks/useProtectedFocusSession.ts`
- `src/components/guard/FocusContract.tsx`
- `src/components/guard/ReturnToFocusPrompt.tsx` (baru)
- `src/components/timer/PomodoroTimer.tsx`
- `docs/focus-guard/PHASE_02_DOMAIN_STORAGE.md`
- `docs/focus-guard/PHASE_04_ATTENTION_AWARENESS.md` (baru)

Tidak ada dependency, interruption storage key, atau redesign timer baru.

## 11. Verification

### Automated

- `npm run lint`: lulus tanpa warning/error.
- `npx tsc --noEmit`: lulus tanpa type error.
- `npm run build`: lulus; Next.js 14.2.35, static pages 4/4.
- `git diff --check`: lulus; warning LF→CRLF pada existing working tree tidak
  dihitung sebagai error.
- Repo tidak memiliki test runner/script, sehingga tidak ada unit/integration
  suite yang dapat diklaim.

### Browser QA yang benar-benar dijalankan

- clean hydration: Guard controls enabled setelah hydration; tanpa console
  warning/error;
- Guard disabled + pembukaan/penutupan tab tambahan background >2 detik: tidak
  ada prompt;
- normal active timer tanpa Guard + pembukaan/penutupan tab tambahan background
  >2 detik: tidak ada prompt;
- protected focus dimulai melalui Focus Contract dengan target dan intention;
- protected active refresh: Guard tetap `Aktif`, timer wall-clock berlanjut,
  tidak ada return prompt;
- Timer Settings internal dibuka >2 detik saat protected focus aktif: tidak ada
  false prompt;
- tidak ada console warning/error setelah protected refresh.

Browser in-app membuka tab tambahan sebagai background tab dan tidak mengubah
foreground visibility/focus tab asal secara deterministik. Karena itu leave-return
meaningful, threshold positif, blur+hidden dedupe, prompt resolution, repeated
excursion, two-tab writer, Escape focus, mobile prompt, dan overdue-hidden path
tidak diklaim lulus browser QA. Jalur tersebut menjalani deterministic code-path
review dan tetap ada pada manual QA di bawah.

## 12. Manual QA tersisa

- [ ] Protected active focus: pindah ke tab/app lain >2 detik lalu kembali;
      pastikan satu event dan satu prompt.
- [ ] Pergi <2 detik; pastikan tidak ada event/prompt.
- [ ] Observasi blur lalu hidden pada satu perpindahan; pastikan type final
      `page-hidden` dan hanya satu record.
- [ ] Visible-only window blur >2 detik; pastikan fallback `window-blur` satu kali.
- [ ] Pause protected timer lalu switch tab; tidak ada event.
- [ ] Short/Long Break lalu switch tab; tidak ada event.
- [ ] Resolve `Kembali fokus`; cek resolution `returned` dan `returnedAt` tetap.
- [ ] Resolve `Ini bukan distraksi`; cek resolution `intentional`.
- [ ] Repeated excursions; event terpisah tanpa duplicate/flood.
- [ ] Refresh ketika hidden/away; tidak ada false interruption atau stale prompt.
- [ ] Selesaikan/stop/disable Guard saat away atau prompt terbuka; prompt tertutup.
- [ ] Overdue completion saat hidden; return tidak membuat event/prompt baru.
- [ ] Dua tab FocusFlow; verifikasi hanya lock owner yang menulis.
- [ ] Browser tanpa Web Locks; verifikasi lease takeover tanpa duplicate.
- [ ] Escape, initial focus, tab order, screen reader labels, dan emergency stop.
- [ ] Mobile viewport dan reduced-motion rendering prompt.
- [ ] Notification permission, browser chrome, dan devtools blur di Chrome,
      Firefox, dan Safari.

## 13. Known limitations

- Web apps tidak dapat mengetahui apa yang terjadi di luar halaman. Phase 4 hanya
  mengetahui halaman visible/hidden dan window focused/blurred.
- Visible-only blur tidak memiliki browser API yang dapat membedakan secara pasti
  browser chrome, permission dialog, dan devtools dari perpindahan perhatian.
  Debounce 500 ms dan threshold 2 detik mengurangi noise, tetapi tidak mengubahnya
  menjadi klasifikasi pasti; pengguna selalu dapat memilih `Ini bukan distraksi`.
- Satu writer dipilih per protected session. Jika owner tetap background sementara
  pengguna bekerja dari tab FocusFlow non-owner, sebagian excursion dapat tidak
  dicatat; desain ini sengaja memilih undercount daripada duplicate.
- Web Locks adalah guarantee terkuat. Expiring localStorage lease tidak atomik/CAS
  dan dapat kehilangan event pada crash atau background throttling ekstrem.
- Pending excursion tidak bertahan reload. Ini disengaja untuk kebijakan refresh
  fail-safe dan berarti real leave yang diakhiri navigation tidak dicatat.
- Collection repository tetap bounded 1.000 item sesuai Phase 2.

## 14. Handoff untuk Phase 5

Phase 4 siap menjadi input untuk Distraction Inbox setelah manual QA prioritas
dinilai sesuai risiko. Phase 5 dapat memakai `guardSessionId`, timestamps, target
snapshot, dan resolution `returned`/`intentional` untuk konteks, tetapi tidak
boleh mengubah page leave menjadi distraction secara otomatis.

Phase 5 belum dimulai. Belum ada capture thought, inbox UI, task conversion,
session review, score, enforcement, atau blocking pada repository ini.
