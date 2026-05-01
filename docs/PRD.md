# 📋 Product Requirements Document (PRD)
## FocusFlow — Pomodoro Web App

**Version:** 1.0  
**Status:** Draft  
**Author:** [Nama Kamu]  
**Created:** May 2026  
**Last Updated:** May 2026

---

## 1. Overview

### 1.1 Latar Belakang
FocusFlow adalah aplikasi web Pomodoro pribadi yang dirancang untuk meningkatkan produktivitas dan fokus kerja. Aplikasi ini menggabungkan teknik Pomodoro klasik dengan fitur manajemen task, ambient sound, dan statistik sesi — dikemas dalam tampilan minimalis yang bersih.

### 1.2 Tujuan
Membangun web app Pomodoro yang profesional, fungsional, dan dapat digunakan secara personal maupun dijadikan portofolio pengembangan profesional.

### 1.3 Target User
- **Primary:** Diri sendiri (developer / pelajar yang ingin meningkatkan fokus)
- **Secondary:** Siapa pun yang membutuhkan tools produktivitas sederhana

---

## 2. Problem Statement

Banyak tools Pomodoro yang ada terlalu kompleks atau terlalu sederhana. FocusFlow hadir sebagai solusi tengah: **sederhana di tampilan, kuat di fungsi**, dengan data yang tersimpan secara personal di cloud.

---

## 3. Goals & Non-Goals

### ✅ Goals
- Timer Pomodoro yang bisa dikustomisasi
- Manajemen task terintegrasi per sesi
- Ambient sound untuk fokus
- Data tersimpan secara online (per user)
- Tampilan minimalis & clean
- Dapat diakses di browser manapun

### ❌ Non-Goals (untuk v1.0)
- Aplikasi mobile native (iOS/Android)
- Kolaborasi / fitur sosial
- Integrasi kalender eksternal (Google Calendar, dll)
- Fitur billing / premium plan

---

## 4. Feature Requirements

### 4.1 Must Have (MVP)

| ID | Fitur | Deskripsi |
|----|-------|-----------|
| F01 | Pomodoro Timer | Timer 25 menit fokus, 5 menit short break, 15 menit long break |
| F02 | Custom Durasi | User dapat mengubah durasi fokus, short break, dan long break |
| F03 | Kontrol Timer | Tombol start, pause, dan reset |
| F04 | Auto Cycle | Long break otomatis setiap 4 sesi selesai |
| F05 | Notifikasi | Browser notification saat timer habis |
| F06 | To-Do List | Tambah, edit, hapus, dan centang task per sesi |
| F07 | Auth User | Login dengan Google (OAuth via Supabase) |
| F08 | Simpan Data | Task dan preferensi tersimpan per akun user di database |

### 4.2 Nice to Have (v1.1+)

| ID | Fitur | Deskripsi |
|----|-------|-----------|
| F09 | Ambient Sound | Pilihan suara: rain, lofi, white noise + volume control |
| F10 | Statistik Sesi | History sesi harian/mingguan (berapa sesi selesai) |
| F11 | Dark / Light Mode | Toggle tema gelap dan terang |
| F12 | Keyboard Shortcut | Kontrol timer via keyboard |

---

## 5. Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| **Frontend** | Next.js 14 + TypeScript | Modern, SEO-friendly, performa tinggi |
| **Styling** | Tailwind CSS | Cepat, konsisten, minimalis |
| **Backend & DB** | Supabase | Gratis, mudah setup, built-in auth |
| **Auth** | Supabase Auth (Google OAuth) | Simpel, aman, tanpa perlu backend custom |
| **Hosting** | Vercel | Gratis, auto-deploy dari GitHub |
| **Version Control** | Git + GitHub | Standar industri |

---

## 6. Desain & UX

### 6.1 Prinsip Desain
- **Minimalis** — tidak ada elemen yang tidak perlu
- **Clean** — whitespace yang lega, tipografi yang jelas
- **Fokus** — UI tidak mengganggu aktivitas fokus user

### 6.2 Halaman Utama
```
┌─────────────────────────────┐
│         FocusFlow           │
│                             │
│      [ FOCUS - 25:00 ]      │
│    ●  ○  ○  ○  (sesi ke-1) │
│                             │
│   [Start]  [Pause]  [Reset] │
│                             │
│  ─── Task Hari Ini ──────   │
│  ☐ Belajar Next.js          │
│  ☐ Review PR                │
│  ☑ Setup project            │
└─────────────────────────────┘
```

---

## 7. Arsitektur Sistem (Sederhana)

```
User Browser
    │
    ▼
Next.js (Vercel)        ← Frontend + SSR
    │
    ▼
Supabase
  ├── Auth              ← Google OAuth
  ├── Database          ← Tasks, Settings, Sessions
  └── Realtime          ← (future: sync antar device)
```

---

## 8. Struktur Folder Project

```
focusflow/
├── docs/
│   ├── PRD.md
│   ├── CHANGELOG.md
│   └── CONTRIBUTING.md
├── src/
│   ├── app/            ← Next.js App Router
│   ├── components/     ← UI Components
│   ├── hooks/          ← Custom React Hooks
│   ├── lib/            ← Supabase client, utils
│   └── types/          ← TypeScript types
├── public/
│   └── sounds/         ← Ambient sound files
├── .env.example
├── .gitignore
├── README.md
└── package.json
```

---

## 9. Git & Development Workflow

### Branch Strategy
```
main        → production (deploy ke Vercel)
dev         → development (staging)
feature/*   → fitur baru (misal: feature/ambient-sound)
bugfix/*    → perbaikan bug
```

### Commit Convention
```
feat: tambah fitur baru
fix: perbaiki bug
docs: update dokumentasi
style: perubahan styling
refactor: refactor kode
```

### Pull Request Flow
```
feature/* → dev → (review) → main → auto deploy
```

---

## 10. Milestone & Timeline

| Milestone | Target | Isi |
|-----------|--------|-----|
| **v0.1** | Week 1 | Setup project, GitHub repo, struktur folder |
| **v0.2** | Week 2 | Timer fungsional + custom durasi |
| **v0.3** | Week 3 | To-do list + auth Google |
| **v0.4** | Week 4 | Simpan data ke Supabase |
| **v1.0** | Week 5 | Polish UI, deploy ke Vercel, README lengkap |
| **v1.1** | TBD | Ambient sound + statistik sesi |

---

## 11. Ukuran Sukses

- [ ] Timer berjalan akurat tanpa bug
- [ ] User bisa login dan data tersimpan
- [ ] Task list berfungsi penuh
- [ ] Bisa diakses dari browser manapun
- [ ] GitHub repo rapi dengan dokumentasi lengkap
- [ ] Deploy live di Vercel

---

## 12. Risiko & Mitigasi

| Risiko | Kemungkinan | Mitigasi |
|--------|-------------|---------|
| Scope creep (fitur terus nambah) | Tinggi | Patuhi PRD ini, fitur baru masuk v1.1+ |
| Supabase quota habis | Rendah | Free tier cukup untuk personal use |
| Kompleksitas teknis | Sedang | Mulai dari MVP, iterasi bertahap |

---

*Dokumen ini adalah living document — diperbarui seiring perkembangan project.*
