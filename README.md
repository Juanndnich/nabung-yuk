# Nubung Yuk

Aplikasi web progresif (PWA) personal yang dirancang khusus untuk pencatatan tabungan dan pembukuan utang secara mandiri, aman, dan privat. 100% data tersimpan di perangkat pengguna (offline-first & local-first) tanpa akun, tanpa server pihak ketiga, dan tanpa pelacak.

---

## 🌟 Fitur Utama

1. **NOL Data Bawaan (Zero Default Mock Data)**
   - Saat aplikasi pertama kali dibuka, database benar-benar kosong.
   - Pengguna dipandu melalui onboarding singkat untuk mendefinisikan tabungan/dompet pertama, palet warna, preferensi suara, dan PIN.

2. **Buku Tabungan & Multi-Dompet**
   - Mendukung banyak dompet/tabungan dengan saldo independen.
   - Pencatatan transaksi Masuk, Keluar, dan Penyesuaian Saldo (beserta alasan koreksi).
   - Transfer antar-tabungan atomic (berpasangan keluar & masuk) yang tidak mengotori statistik pemasukan/pengeluaran.
   - Peringatan saat pengeluaran melebihi saldo tabungan.
   - Riwayat harian interaktif dikelompokkan per hari (Hari Ini, Kemarin, dst.) dengan subtotal masuk/keluar/selisih dan chip kategori berwarna.

3. **Buku Utang & Piutang**
   - Pencatatan utang dua arah: *Orang berutang ke saya* (piutang) dan *Saya berutang ke orang* (utang).
   - Pengingat jatuh tempo otomatis dan status pintar: *Belum Dibayar*, *Dicicil*, *Lunas*, atau *Terlambat*.
   - Validasi ketat penolakan pembayaran yang melebihi sisa pokok utang.
   - Opsional menautkan transaksi peminjaman dan cicilan ke tabungan/dompet secara atomik.
   - Generator teks penagihan/pengingat ramah untuk dikirim melalui pesan instan.

4. **Target Tabungan & Anggaran Bulanan**
   - Pelacak target tabungan dengan indikator progres persentase, sisa waktu, dan nominal yang perlu dicapai.
   - Anggaran bulanan per kategori dengan indikator batas aman dan peringatan over-budget.

5. **Statistik & Analisis Keuangan**
   - Grafik batang perbandingan pemasukan vs pengeluaran.
   - Donat komposisi pengeluaran per kategori.
   - Grafik garis tren saldo kumulatif.
   - Wawasan rasio menabung, rata-rata pengeluaran harian, dan deteksi hari paling boros.
   - Filter periode cepat: Hari Ini, Kemarin, 7 Hari, 30 Hari, Bulan Ini, Bulan Lalu, Tahun Ini.

6. **Keamanan & Privasi Maksimal**
   - **Kunci PIN 4-8 Digit**: Divalidasi dan di-hash menggunakan PBKDF2 (100.000 iterasi, salt acak Web Crypto API). Tidak pernah disimpan dalam bentuk teks polos.
   - **Mode Privasi Satu Ketukan**: Tombol cepat untuk menyamarkan nominal uang (`Rp•••`).
   - **Enkripsi Cadangan (Backup)**: Ekspor dan impor data terenkripsi AES-GCM dengan kata sandi pengguna.
   - **Content Security Policy (CSP) Ketat**: Tanpa `unsafe-eval`, tanpa inline script, tanpa CDN eksternal.

7. **Suara Sintetis & Haptik Bawaan (Web Audio API)**
   - Efek suara sintetis instan tanpa unduh file audio eksternal (`modern`, `lembut`, `tegas`, `retro`).
   - Dilengkapi compressor/limiter dinamis, kontrol volume, dan getar haptik (`navigator.vibrate`).

8. **Tempat Sampah & Audit Log**
   - Soft-delete dengan snackbar urungkan (undo) cepat.
   - Tempat sampah terpadu untuk memulihkan (*restore*) atau menghapus permanen (*purge*).
   - Audit log mencatat riwayat perubahan penting entitas.

---

## 🛠️ Arsitektur & Teknologi

- **Frontend**: React 19 + TypeScript (Strict) + Vite 8
- **Styling**: Tailwind CSS 4 + Lucide React (tanpa emoji di UI)
- **Database**: Dexie.js (IndexedDB) dengan transaksi atomik multi-tabel
- **Audio & Keamanan**: Web Audio API & Web Crypto API bawaan browser
- **Grafik**: Recharts
- **PWA**: `vite-plugin-pwa` dengan Service Worker precaching otomatis

---

## 🚀 Menjalankan Project

### Prasyarat
- Node.js versi 18+ (direkomendasikan Node.js LTS atau terbaru)
- npm

### Instalasi & Pengembangan
```bash
# Instal dependensi
npm install

# Jalankan server pengembangan lokal
npm run dev
```

### Pengujian & Kualitas Kode
```bash
# Jalankan unit test dan integration test
npm test

# Jalankan pengecekan ESLint
npm run lint

# Buat build produksi PWA
npm run build
```

---

## 🔒 Kebijakan Privasi & Keamanan Data
Semua data keuangan Anda disimpan secara lokal di browser perangkat Anda menggunakan IndexedDB. Tidak ada data yang dikirimkan ke server mana pun. Pastikan Anda melakukan ekspor cadangan (backup) secara berkala melalui menu **Pengaturan > Cadangan & Pemulihan Data**.
