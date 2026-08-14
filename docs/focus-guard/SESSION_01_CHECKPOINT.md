# Focus Guard — Session 01 Checkpoint

Tanggal checkpoint: 2026-07-13 (Asia/Makassar)

Status: **Sesi 1 diterima; Phase 0–3 selesai.** Dokumen ini hanya merangkum
scope dan kondisi repository. Tidak ada pekerjaan Phase 4, staging, atau commit.

## 1. Phase yang selesai

### Phase 0 — Baseline and Safety Contract

- Audit implementasi aktual dan dirty working tree.
- Pemetaan lifecycle timer baseline, storage inventory, hubungan task/target/
  session/stats/goal/sound, compatibility contract, regression risks, dan QA.
- Baseline menegaskan enam legacy storage key yang harus dipertahankan.

Handoff: `docs/focus-guard/PHASE_00_BASELINE.md`.

### Phase 1 — Reliable and Recoverable Timer

- Countdown active berbasis `expectedEndAt`, bukan decrement satu detik.
- Active/paused run dipersistensikan dan dipulihkan setelah refresh.
- Overdue completion memakai expected deadline dan diselesaikan tepat satu kali.
- Completion focus ke-4 menuju Long Break; break selalu prepared/paused.
- Duration/settings/preset dan focus target disnapshot per timer run.
- Web Locks atau expiring localStorage lease memberi single-tab completion owner.
- Completion ledger dan `timerRunId` mencegah duplicate FocusSession/notification.

Handoff: `docs/focus-guard/PHASE_01_RELIABLE_TIMER.md`.

### Phase 2 — Domain and Storage Foundation

- Typed domain untuk profiles, website/application rules, guard sessions,
  interruptions, distraction inbox, dan preferences.
- Canonical built-in profile `Light Protection` selalu tersedia.
- Guard default nonaktif dan hanya satu active guard session diperbolehkan.
- Versioned repositories dengan normalization, invalid-item filtering,
  deterministic duplicate-ID handling, bounded collections, dan idempotent end.
- Same-tab custom events dan cross-tab storage subscriptions.
- Tidak ada UI, attention tracking, timer integration, atau blocking pada fase ini.

Handoff: `docs/focus-guard/PHASE_02_DOMAIN_STORAGE.md`.

### Phase 3 — Focus Contract and Protected Session Lifecycle

- Focus Contract target-wajib dan intention-opsional sebelum protected focus baru.
- Status Guard dekat timer: `Nonaktif`, `Siap`, `Aktif`, dan `Dijeda`.
- Controller tunggal mengoordinasikan timer, Guard, target, profile, dan
  FocusSession tanpa menaruh dual-write langsung di UI.
- Guard/timer berbagi `timerRunId`, timestamps, duration, profile, protection
  level, intention, dan target snapshots.
- Pause/resume, reset, mode switch, explicit stop, natural completion, overdue
  recovery, refresh, dan cross-tab reconciliation sudah terhubung.
- Completed Guard history ditautkan ke completed `FocusSession.id`.
- Break tidak membuat Guard session; Guard-disabled path tetap timer biasa.
- Tidak ada attention signal, interruption automation, distraction UI, bypass
  enforcement, website/application blocking, extension, atau companion.

Handoff: `docs/focus-guard/PHASE_03_FOCUS_CONTRACT.md`.

## 2. Fitur yang tersedia pada checkpoint

- Pomodoro Focus, Short Break, dan Long Break.
- Timestamp-based active countdown dan paused remaining recovery.
- Timer presets, persisted custom preferences, dan immutable active-run snapshot.
- Long Break setiap empat completed focus sessions.
- Completion sound dan browser notification dengan per-run dedupe.
- Task dan checklist steps, active focus target, completion prompt, session
  history, stats, daily goal, ambient sound, dan keyboard shortcuts.
- Optional Focus Guard dengan built-in Light profile dan custom-profile foundation.
- Protected focus contract dengan target/profile/intention snapshot.
- Protected lifecycle pause/resume/reset/mode-switch/stop/completion/recovery.
- Profile/session/interruption/distraction repositories untuk fase berikutnya,
  tetapi belum ada runtime attention/distraction behavior.

## 3. Storage keys

### Namespaced keys baru Sesi 1

| Phase | Key | Fungsi |
| --- | --- | --- |
| 1 | `focusflow-timer-preferences-v1` | Global timer settings dan selected preset |
| 1 | `focusflow-timer-state-v1` | Prepared/active/paused timer run snapshot |
| 1 | `focusflow-timer-completions-v1` | Bounded completion ledger per run ID |
| 1 | `focusflow-timer-lease-v1` | Expiring fallback owner lease |
| 2 | `focusflow-guard-profiles-v1` | Custom Guard profiles; built-in Light disintesis canonical |
| 2 | `focusflow-active-guard-session-v1` | Satu active/paused Guard session |
| 2 | `focusflow-guard-session-history-v1` | Bounded completed/stopped Guard history |
| 2 | `focusflow-guard-interruptions-v1` | Interruption collection foundation |
| 2 | `focusflow-distraction-inbox-v1` | Distraction inbox foundation |
| 2 | `focusflow-guard-preferences-v1` | Opt-in state dan selected profile ID |

`focusflow-guard-session-mutation-v1` adalah nama Web Lock, bukan localStorage
key. String `*-updated-v1` adalah same-tab custom events, bukan storage keys.

### Legacy keys yang tetap dipertahankan

- `focusflow-tasks`
- `focusflow-active-focus-target`
- `focusflow-focus-sessions`
- `focusflow-daily-focus-goal`
- `focusflow-ambient-volume`
- `focusflow-ambient-sound`

Tidak ada key legacy yang diganti atau dihapus.

## 4. Lifecycle timer–Guard final

```text
Guard disabled
  fresh focus/break -- play --> normal timer lifecycle

Guard enabled + fresh paused focus
  -- play --> Focus Contract
  -- cancel/invalid --> tetap prepared paused
  -- confirm --> persist Guard first
                -> persist+verify timer dengan run ID/timestamps sama
                -> protected active
                -> failure: compensation stop/reset

protected active
  -- pause --> Guard paused -> timer paused
  -- reset --> Guard stopped -> fresh timer paused
  -- manual mode --> Guard stopped -> selected mode paused
  -- explicit stop/disable --> Guard stopped -> timer prepared paused
  -- deadline --> FocusSession once -> Guard completed once dan linked
                 -> focus count +1
                 -> count % 4 == 0 ? Long Break : Short Break
                 -> break paused, tanpa Guard

protected paused
  -- resume --> Guard active + expectedEndAt baru -> timer active
  -- refresh --> kedua state tetap paused dan remaining dipertahankan

active refresh/overdue
  -- sebelum deadline --> active dipulihkan dari expectedEndAt
  -- lewat deadline --> owner menyelesaikan satu run, tidak catch-up banyak siklus
```

Reconciliation membaca persisted timer sebagai sumber kanonik lintas tab.
FocusSession `timerRunId`, completion ledger, Guard end idempotency, dan owner
lease/lock menjadi lapisan duplicate prevention. Active timer tanpa matching
Guard tidak membuat sesi proteksi diam-diam; UI memperingatkan kondisi tersebut.

## 5. Hasil verifikasi terakhir

Verifikasi final Phase 3 pada 2026-07-13:

- `npm run lint`: **lulus**, tanpa warning/error.
- `npx tsc --noEmit`: **lulus**, tanpa type error.
- `npm run build`: **lulus**, Next.js 14.2.35, static pages 4/4.
- Route `/`: 36.6 kB; First Load JS 124 kB.
- `git diff --check`: **lulus**; hanya warning line-ending LF→CRLF untuk beberapa
  file existing working tree.
- Repo tidak memiliki automated test runner/script.

Browser QA yang benar-benar lulus:

- clean hydration tanpa runtime/hydration error;
- contract tanpa target menolak start;
- protected start dengan Light profile dan target snapshot;
- pause/resume dan paused/active refresh;
- target A tetap menjadi Guard/completion metadata setelah active target ke B;
- natural completion menambah satu FocusSession;
- focus completion ke-4 menuju paused Long Break tanpa Guard;
- two-tab guard-first start race tidak menghentikan sesi valid;
- manual mode switch dan reset menghentikan Guard lalu menyiapkan timer paused.

Phase 2 juga memiliki deterministic in-memory storage harness 10 checks yang
lulus sebagaimana dicatat di handoff Phase 2.

## 6. Manual QA tersisa

- [ ] Overdue protected run dengan tab benar-benar suspended atau device sleep;
      verifikasi satu FocusSession dan satu completed Guard history.
- [ ] Force-close owner tab dan takeover setelah lease expiry pada browser produksi.
- [ ] Simulasikan localStorage unavailable/quota/security failure saat confirm.
- [ ] Notification permission dan completion chime di Chrome/Firefox/Safari.
- [ ] Dua tab menekan pause/resume/reset/mode controls hampir bersamaan.
- [ ] Seluruh keyboard shortcut ketika Focus Contract terbuka/tertutup.
- [ ] Screen-reader, focus trap, mobile viewport, dan reduced-motion QA.
- [ ] Phase 2 repository manual QA: malformed/partial collections, profile
      create/update/delete fallback, interruption/distraction CRUD, dan cross-tab sync.

## 7. Known risks dan limitations

- localStorage tidak atomik lintas key. Protected start memakai ordered writes,
  read-back verification, compensation, dan two-second guard-first grace.
- Process kill tepat di antara Guard write dan timer write masih dapat menyisakan
  orphan sementara sampai reconciliation/recovery berjalan.
- Browser tanpa Web Locks memakai best-effort expiring localStorage lease; bukan CAS.
- Jika persistence sepenuhnya gagal, hard cross-tab idempotency tidak dapat dijamin.
- Deadline berbasis wall clock terpengaruh perubahan manual system clock.
- Completion callback berjalan saat JavaScript aktif kembali, walau `completedAt`
  tetap expected deadline.
- Completion ledger bounded 200 records dan Guard history bounded oleh repository.
- Notification/audio dipengaruhi permission dan autoplay policy browser.
- Hanya satu global persisted timer run dan satu active Guard session.
- Belum ada attention tracking, page-leave classification, automatic interruption,
  distraction capture UI, bypass enforcement, blocking, extension, atau desktop app.

## 8. File utama untuk dibaca pada Sesi 2

Urutan yang disarankan:

1. `docs/focus-guard/SESSION_01_CHECKPOINT.md`
2. `docs/FOCUS_GUARD_MASTER_BLUEPRINT.md`
3. `docs/CODEX_UPGRADE_EXECUTION_PLAN.md`
4. `docs/focus-guard/PHASE_03_FOCUS_CONTRACT.md`
5. `docs/focus-guard/PHASE_02_DOMAIN_STORAGE.md`
6. `docs/focus-guard/PHASE_01_RELIABLE_TIMER.md`
7. `src/hooks/useProtectedFocusSession.ts`
8. `src/hooks/useTimer.ts`
9. `src/lib/timerPersistence.ts`
10. `src/lib/focusGuardPersistence.ts`
11. `src/types/timer.ts`
12. `src/types/focusGuard.ts`
13. `src/types/distraction.ts`
14. `src/components/guard/FocusContract.tsx`
15. `src/components/guard/FocusGuardStatus.tsx`
16. `src/components/timer/PomodoroTimer.tsx`

Phase 0 tetap menjadi compatibility/baseline reference bila Sesi 2 menyentuh
legacy task, session, goal, atau sound behavior.

## 9. Current git status

Snapshot `git status --short` pada checkpoint:

```text
 M .gitignore
 M README.md
 M docs/CHANGELOG.md
M  package-lock.json
M  package.json
MM src/app/globals.css
M  src/app/layout.tsx
MM src/app/page.tsx
AM src/components/ambient/AmbientSoundPanel.tsx
A  src/components/layout/KeyboardShortcutHint.tsx
A  src/components/layout/Navbar.tsx
A  src/components/task/TaskInput.tsx
AM src/components/task/TaskItem.tsx
AM src/components/task/TaskList.tsx
AM src/components/timer/PomodoroTimer.tsx
AM src/components/timer/TimerSettings.tsx
A  src/hooks/useAmbientSound.ts
A  src/hooks/useKeyboardShortcuts.ts
AM src/hooks/useTasks.ts
AM src/hooks/useTimer.ts
AM src/lib/audioEngine.ts
A  src/lib/utils.ts
AM src/types/ambient.ts
AM src/types/task.ts
M  tailwind.config.ts
?? .eslintrc.json
?? docs/CODEX_UPGRADE_EXECUTION_PLAN.md
?? docs/FOCUSFLOW_UPGRADE_BLUEPRINT.md
?? docs/FOCUS_GUARD_MASTER_BLUEPRINT.md
?? docs/UPGRADE_BASELINE_AUDIT.md
?? docs/focus-guard/
?? docs/understanding_focusflow.md
?? src/components/guard/
?? src/components/stats/
?? src/components/task/TaskStepItem.tsx
?? src/hooks/useDailyFocusGoal.ts
?? src/hooks/useDistractionInbox.ts
?? src/hooks/useFocusGuardPreferences.ts
?? src/hooks/useFocusGuardProfiles.ts
?? src/hooks/useFocusGuardSession.ts
?? src/hooks/useFocusInterruptions.ts
?? src/hooks/useFocusSessions.ts
?? src/hooks/useFocusStats.ts
?? src/hooks/useFocusTarget.ts
?? src/hooks/useGuardStorageSubscription.ts
?? src/hooks/useProtectedFocusSession.ts
?? src/lib/focusGuardPersistence.ts
?? src/lib/timerPersistence.ts
?? src/types/distraction.ts
?? src/types/focusGoal.ts
?? src/types/focusGuard.ts
?? src/types/focusSession.ts
?? src/types/timer.ts
```

Interpretasi status:

- working tree memang dirty dan mencampur perubahan pengguna dengan Sesi 1;
- terdapat staged (`M ` / `A `), unstaged (` M`), mixed (`MM` / `AM`), dan
  untracked (`??`) content;
- seluruh `docs/focus-guard/`, termasuk checkpoint ini, masih berada di dalam
  untracked directory pada status ringkas;
- tidak ada file yang di-stage atau di-commit saat membuat checkpoint ini;
- status tersebut tidak boleh dibersihkan, di-reset, atau ditimpa pada Sesi 2.

## 10. Session boundary

Sesi 1 berhenti setelah checkpoint ini. Phase 4 belum dimulai dan membutuhkan
scope serta persetujuan eksplisit baru sebelum perubahan apa pun dilakukan.
