# FocusFlow

FocusFlow adalah aplikasi produktivitas pribadi berbasis Pomodoro dengan task,
Focus Guard, Browser Guard, distraction capture, session review, statistik, dan
focus sound.

## Fitur utama

- Reliable Pomodoro timer dengan recovery setelah refresh/sleep.
- Task, checklist langkah kecil, dan active focus target.
- Opt-in Focus Contract dan protected focus session.
- Browser Guard extension untuk block/allow website secara session-scoped.
- Attention awareness tanpa membaca URL, layar, clipboard, atau keystroke.
- Quick Capture dan Distraction Inbox.
- Session Review dan insight tujuh hari.
- Ambient sound dan keyboard shortcuts.
- Seluruh data tersimpan lokal dengan retention/resource limits.

## Menjalankan aplikasi

```powershell
npm install
npm run build
npm run start
```

Buka `http://localhost:3000`.

Untuk development gunakan `npm run dev`. Browser extension hanya mendukung
origin development pada port 3000.

## Browser Guard extension

```powershell
npm run extension:build
npm run extension:check
```

Buka `chrome://extensions` atau `edge://extensions`, aktifkan Developer mode,
lalu **Load unpacked** dari folder `extension/dist`.

## Dokumentasi

- [Panduan penggunaan](docs/USER_GUIDE.md)
- [Panduan extension dan QA](extension/README.md)
- [Audit efisiensi resource](docs/focus-guard/RESOURCE_EFFICIENCY_AUDIT.md)
- [Focus Guard master blueprint](docs/FOCUS_GUARD_MASTER_BLUEPRINT.md)

## Verifikasi

```powershell
npm run lint
npx tsc --noEmit
npm run build
npm run extension:build
npm run extension:check
npm run verify:focus-guard-phase6
npm run verify:focus-guard-phase7
npm run verify:focus-guard-phase8
npm run verify:focus-guard-phase9
npm run verify:resource-bounds
```

Project menggunakan Next.js 14, React, TypeScript, Tailwind CSS, dan Chromium
Manifest V3. Versi saat ini tidak memakai akun atau cloud sync.
