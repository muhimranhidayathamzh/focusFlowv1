# Panduan Penggunaan FocusFlow

FocusFlow adalah ruang kerja produktivitas pribadi berbasis Pomodoro. Alur
utamanya sederhana: tentukan satu target, mulai sesi fokus, simpan gangguan
untuk nanti, lalu tinjau hasil sesi.

## 1. Menjalankan FocusFlow

### Penggunaan harian yang direkomendasikan

Dari folder project:

```powershell
npm install
npm run build
npm run start
```

Buka `http://localhost:3000`.

Gunakan `npm run dev` hanya ketika sedang mengubah kode. Mode development
memakai resource lebih banyak karena menyediakan hot reload dan debugging.

> Browser Guard hanya mengenali `localhost:3000` dan
> `127.0.0.1:3000`. Jika terminal berpindah ke port 3001, hentikan proses yang
> memakai port 3000 terlebih dahulu.

## 2. Memasang Browser Guard

Extension bersifat opsional. Timer, task, statistik, dan Focus Guard level
Light tetap dapat dipakai tanpa extension. Extension diperlukan untuk memblokir
website.

1. Jalankan:

   ```powershell
   npm run extension:build
   ```

2. Buka `chrome://extensions` atau `edge://extensions`.
3. Aktifkan **Developer mode**.
4. Pilih **Load unpacked**.
5. Pilih folder `extension/dist`.
6. Buka atau reload FocusFlow di port 3000.
7. Pastikan status pada kartu Focus Guard menjadi **Extension terhubung**.

Setelah source extension diperbarui, jalankan build kembali, klik **Reload**
pada kartu extension, lalu reload halaman FocusFlow. Selalu muat
`extension/dist`, bukan `extension/src`.

## 3. Alur penggunaan harian

### Langkah 1 — Tulis pekerjaan hari ini

Tambahkan pekerjaan pada **Task Hari Ini**. Gunakan task yang cukup konkret,
misalnya “Tulis bagian kesimpulan laporan”, bukan “Kerjakan laporan”.

- Klik task untuk menandainya selesai.
- Gunakan tombol edit untuk mengubah teks.
- Gunakan checklist untuk memecah task menjadi langkah kecil.
- Gunakan tombol target untuk menjadikan task atau langkah sebagai fokus aktif.

FocusFlow menyimpan maksimal 500 task, 100 langkah per task, dan 300 karakter
per task/langkah.

### Langkah 2 — Pilih target fokus

Pilih satu task atau langkah sebagai target. Target aktif muncul di kartu timer.
Target membantu memastikan sesi memiliki hasil yang jelas.

Timer biasa boleh dimulai tanpa target. Protected session dengan Focus Guard
memerlukan target melalui Focus Contract.

### Langkah 3 — Pilih mode timer

- **Focus**: waktu kerja.
- **Short Break**: istirahat singkat.
- **Long Break**: istirahat panjang setelah empat sesi fokus selesai.

Preset default adalah Classic Pomodoro: 25 menit fokus, 5 menit short break,
dan 15 menit long break. Gunakan tombol pengaturan pada kartu timer untuk
memilih preset atau durasi custom.

### Langkah 4 — Tentukan apakah sesi perlu dilindungi

Jika Focus Guard nonaktif, tombol mulai langsung menjalankan timer biasa.

Jika Focus Guard aktif, tombol mulai membuka **Focus Contract**. Di sini:

1. Pilih target wajib.
2. Tulis intention bila membantu, misalnya “Selesaikan outline tanpa membuka
   media sosial”.
3. Periksa profile, level proteksi, dan durasi.
4. Konfirmasi untuk memulai protected session.

Target, profile, rule, dan durasi disnapshot ketika sesi dimulai. Mengubah
profile atau target setelahnya tidak mengubah sesi yang sedang berlangsung.

## 4. Memahami profile Focus Guard

### Light Protection

Memberikan Focus Contract, attention awareness, distraction capture, review,
dan statistik tanpa memblokir website. Cocok ketika Anda ingin struktur ringan.

### Browser Guard

Profile bawaan untuk proteksi browser. Secara default memiliki rule TikTok.
Profile bawaan tidak dapat diedit; duplicate profile terlebih dahulu bila ingin
menyesuaikan rule.

### Custom profile

Buka **Kelola Guard profiles & rules**, lalu:

1. Pilih **Profile baru** atau duplicate profile bawaan.
2. Atur nama, level, emergency bypass, delay, durasi, dan kewajiban alasan.
3. Buka tab **Website Rules**.
4. Tambahkan block/allow rule.
5. Simpan profile dan jadikan default bila diperlukan.

Tipe rule yang tersedia:

- **Domain**: `tiktok.com`, termasuk subdomain tetapi tidak mencocokkan domain
  tiruan seperti `nottiktok.com`.
- **URL prefix**: URL absolut dan sensitif terhadap path.
- **Safe pattern**: misalnya `*://*.youtube.com/shorts/*`.

Jika profile memiliki rule invalid, proteksi website fail open: timer tetap
berjalan, tetapi rule tidak dipasang sebagian.

## 5. Memberikan izin website

Membuat atau memilih profile tidak otomatis memberikan permission.

1. Klik ikon FocusFlow Browser Guard pada toolbar browser.
2. Periksa daftar **Required origins**.
3. Klik **Izinkan origin yang belum tersedia**.
4. Kembali ke FocusFlow dan periksa status proteksi.

Jika permission ditolak atau dicabut, timer tetap berjalan tetapi blocking
tidak diaktifkan. FocusFlow tidak meminta akses browser history, tab aktif,
clipboard, screenshot, keystroke, atau isi halaman.

## 6. Ketika website diblokir

Website yang cocok dengan rule akan diarahkan ke halaman intervensi. Halaman
ini menampilkan target, profile, rule, dan sisa waktu fokus.

Pilihan yang tersedia:

- Kembali ke FocusFlow dan lanjut bekerja.
- Gunakan emergency bypass bila profile mengizinkannya.

Bypass dapat memiliki delay, alasan wajib, dan durasi terbatas. Setelah bypass
berakhir, blocking aktif kembali selama protected session masih valid.

## 7. Menangani gangguan tanpa kehilangan fokus

### Quick Capture

Saat protected session aktif atau paused, tekan `Ctrl + Shift + D` untuk
menyimpan pikiran tanpa meninggalkan pekerjaan utama.

Contoh:

- “Balas pesan Andi setelah sesi.”
- “Cari referensi desain nanti.”
- “Ingat bayar tagihan.”

Tekan `Ctrl + Enter` untuk menyimpan dan `Escape` untuk membatalkan. Capture
tidak menjeda timer atau mengganti target aktif.

### Return to Focus

Jika Anda meninggalkan FocusFlow lebih dari sekitar dua detik selama protected
session, FocusFlow dapat menampilkan prompt ketika Anda kembali.

- **Kembali fokus**: gangguan dicatat sebagai kembali bekerja.
- **Ini bukan distraksi**: perpindahan dianggap disengaja.
- **Simpan untuk nanti**: simpan pikiran ke Distraction Inbox.

FocusFlow hanya mencatat waktu dan jenis perpindahan minimal. FocusFlow tidak
mengetahui URL, aplikasi lain, isi layar, atau apa yang Anda ketik di luar app.

## 8. Distraction Inbox

Inbox berada setelah Task Hari Ini dan dapat dibuka/tutup.

- **Ubah menjadi task** membuat satu task baru.
- **Dismiss** menandai item selesai tanpa membuat task.

Konversi bersifat idempotent: klik ganda atau retry tidak membuat task duplikat.

## 9. Session Review

Setelah protected focus selesai, FocusFlow membuka review.

Anda dapat:

- memberi rating fokus 1–5;
- menandai target selesai atau melanjutkannya nanti;
- memproses distraction menjadi task atau dismiss;
- submit atau skip review.

Review yang belum selesai pulih setelah refresh dan tidak muncul dua kali setelah
submit/skip berhasil.

## 10. Statistik

**Progress hari ini** menampilkan menit fokus, sesi selesai, target harian,
streak, grafik tujuh hari, dan personal best bila tersedia.

**Focus Guard · 7 hari** menampilkan ringkasan protected session, interruption,
distraction, rating rata-rata, dan persentase review. Tidak ada Focus Score.

Hanya focus session yang selesai yang dihitung. Pause, stop, atau timer yang
belum selesai tidak menambah statistik completion.

## 11. Focus Sound

Buka selector **Focus Sound** untuk memilih Rain, Ocean, White Noise, Brown
Noise, atau eksperimen binaural. Gunakan tombol play/stop dan slider volume.

Gunakan headphone untuk mode binaural. Sound bersifat opsional dan tidak
memengaruhi timer atau Guard.

## 12. Keyboard shortcuts

Shortcut tidak aktif ketika sedang mengetik di input, textarea, select, atau
editor teks.

| Shortcut | Fungsi |
| --- | --- |
| `Space` | Mulai/pause timer |
| `R` | Reset timer |
| `1` | Mode Focus |
| `2` | Mode Short Break |
| `3` | Mode Long Break |
| `S` | Buka/tutup pengaturan timer |
| `Ctrl + Shift + D` | Buka Quick Capture |
| `Ctrl + Enter` | Simpan Quick Capture |
| `Escape` | Tutup dialog/cancel bila didukung |

## 13. Data, backup, dan privasi

Data FocusFlow disimpan lokal di browser yang sedang digunakan. Tidak ada akun,
cloud sync, atau telemetry pada versi ini.

Konsekuensinya:

- data tidak otomatis muncul di komputer/browser lain;
- menghapus site data browser dapat menghapus task dan history;
- uninstall extension menghapus permission dan state extension, tetapi tidak
  otomatis menghapus data web FocusFlow;
- import/export Guard hanya mencakup custom profile dan preference profile,
  bukan task, history, distraction, rating, atau permission extension.

## 14. Troubleshooting cepat

### Extension tidak terdeteksi

1. Pastikan URL memakai port 3000, bukan 3001.
2. Jalankan `npm run extension:build`.
3. Klik **Reload** di `chrome://extensions`.
4. Reload halaman FocusFlow.
5. Pastikan yang dimuat adalah `extension/dist`.

### Website tidak diblokir

Periksa bahwa:

- protected session sedang aktif, bukan paused/break;
- profile bukan Light;
- rule cocok dengan website;
- seluruh required origin sudah diberi izin;
- status tidak menunjukkan permission required atau expired.

### Timer salah setelah refresh/sleep

Reload halaman sekali. Timer aktif dihitung dari deadline wall-clock, sedangkan
timer paused memakai remaining time tersimpan. Jika masalah berulang, catat mode,
waktu sebelum refresh, waktu setelah refresh, dan apakah ada dua tab terbuka.

### Halaman lambat atau crash

1. Pastikan extension dan halaman sudah direload setelah update.
2. Tutup tab FocusFlow lama yang memuat content script versi sebelumnya.
3. Gunakan production mode untuk pemakaian harian.
4. Buka Chrome Task Manager dengan `Shift + Esc` untuk melihat apakah memory
   terus tumbuh atau sudah stabil.

## 15. Rutinitas yang direkomendasikan

1. Tulis maksimal beberapa task penting untuk hari ini.
2. Pilih satu target kecil dan konkret.
3. Gunakan Light untuk pekerjaan ringan atau Browser Guard ketika risiko
   distraksi tinggi.
4. Simpan pikiran lewat Quick Capture; jangan langsung mengerjakannya.
5. Gunakan break untuk berdiri, minum, dan menjauh dari layar.
6. Isi review secara jujur dan singkat.
7. Proses Distraction Inbox setelah sesi atau pada akhir hari.

Tujuan FocusFlow bukan membuat setiap menit sempurna, tetapi mengurangi jumlah
keputusan ketika Anda sedang berusaha fokus.
