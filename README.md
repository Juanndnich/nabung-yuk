# Nubung Yuk

Aplikasi web progresif (PWA) personal yang dirancang khusus untuk pencatatan tabungan dan pembukuan utang secara mandiri, aman, dan privat. 100% data tersimpan di perangkat pengguna (offline-first & local-first) tanpa akun, tanpa server pihak ketiga, dan tanpa pelacak.

---

## 🌟 Fitur Utama

1. **NOL Data Bawaan (Zero Default Mock Data)**
   - Saat aplikasi pertama kali dibuka, database benar-benar kosong.
   - Pengguna dipandu melalui onboarding singkat untuk mendefinisikan tabungan/dompet pertama, palet warna, preferensi suara, dan PIN.

2. **Buku Tabungan, Multi-Dompet & Pos Tabungan (Amplop)**
   - Mendukung banyak dompet/tabungan dengan saldo independen.
   - **Pos Tabungan (Envelope Budgeting)**: Setiap tabungan dapat dialokasikan ke pos-pos kustom (misal: Jajan, Transport, Darurat) dengan batas bulanan dan target.
   - Pos sistem **"Belum dialokasikan"** otomatis mengawal sisa saldo tabungan yang belum dibagi.
   - **Invarian Wajib**: Saldo tabungan selalu tepat sama dengan jumlah saldo seluruh pos + sisa belum dialokasikan.
   - **Pindah Dana Antar Pos**: Mutasi internal saldo antar-pos dalam tabungan yang sama (bersifat net-zero, bukan pemasukan/pengeluaran).
   - **Aturan Bagi Otomatis**: Alokasi otomatis untuk saldo masuk berdasarkan persentase atau nominal kustom dengan sisa pembulatan diarahkan ke pos belum dialokasikan (total >100% ditolak).
   - Transfer antar-tabungan atomic dengan pilihan pos asal dan pos tujuan.
   - Peringatan saat pengeluaran melebihi saldo tabungan atau batas bulanan pos.
   - Riwayat harian interaktif dikelompokkan per hari (Hari Ini, Kemarin, dst.) dengan subtotal masuk/keluar/selisih dan chip pos + kategori berwarna.

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

6. **Sistem Desain Estetik & Tema (v1.3.0)**
   - **Design Tokens Terpusat**: CSS variables di `src/styles/globals.css` untuk warna, radius kartu (`rounded-3xl`), bayangan lembut (*soft shadows*), dan kurva transisi.
   - **Palet Default Monokrom Hitam-Putih dengan Border Pink Soft**: Kontras tinggi dengan garis rambut (*hairline border*) pink lembut (`#fbcfe8` terang, `#3b1d2e` gelap) yang elegan dan profesional tanpa tabrakan warna.
   - **Kategorisasi Menu & Penamaan Ringkas**: Menu dikelompokkan rapi ke dalam kategori **Utama** (Beranda, Tabungan, Utang), **Perencanaan** (Target, Anggaran, Berulang, Statistik), dan **Sistem** (Sampah, Pengaturan, Tentang).
   - **Kontrol Ringkas Dropdown**: Penggantian tombol-tombol yang memadati layar dengan dropdown select yang bersih dan tertata.
   - **Tipografi Poppins & Tabular Numerals**: Memanfaatkan font lokal Poppins (`@fontsource/poppins`) dengan fitur font `tabular-nums` agar nominal uang sejajar rapi.
   - **Loading Screen Berprogres Nyata & Bebas Bug Refresh**: Diperbaiki secara menyeluruh dengan inisialisasi satu kali (*single boot ref*), *safety fallback*, dan sinkronisasi tema instan tanpa kedipan kontras saat memuat ulang halaman.
   - **Scrollbar Kustom Minimalis**: Scrollbar ramping dengan aksen jempol pink soft yang halus.

7. **Keamanan & Privasi Maksimal**
   - **Kunci PIN 4-8 Digit**: Divalidasi dan di-hash menggunakan PBKDF2 (100.000 iterasi, salt acak Web Crypto API). Tidak pernah disimpan dalam bentuk teks polos.
   - **Mode Privasi Satu Ketukan**: Tombol cepat untuk menyamarkan nominal uang (`Rp•••`).
   - **Enkripsi Cadangan (Backup)**: Ekspor dan impor data terenkripsi AES-GCM dengan kata sandi pengguna.
   - **Content Security Policy (CSP) Ketat**: Tanpa `unsafe-eval`, tanpa inline script, tanpa CDN eksternal.

8. **Suara Sintetis & Haptik Bawaan (Web Audio API)**
   - Efek suara sintetis instan tanpa unduh file audio eksternal (`modern`, `lembut`, `tegas`, `retro`).
   - Dilengkapi compressor/limiter dinamis, kontrol volume, dan getar haptik (`navigator.vibrate`).

9. **Tempat Sampah & Audit Log**
   - Soft-delete dengan snackbar urungkan (undo) cepat.
   - Tempat sampah terpadu untuk memulihkan (*restore*) atau menghapus permanen (*purge*).
   - Audit log mencatat riwayat perubahan penting entitas.

10. **Ikon & Identitas Visual Aplikasi**
   - **Generator Ikon Otomatis**: Menghasilkan seluruh ukuran ikon PWA (192px, 512px, maskable 512px dengan safe-zone 80%, apple-touch-icon 180px, favicon 32px & 16px, favicon.ico, serta shortcut icons) secara terprogram melalui `npm run icons` berbasis `sharp`.
   - **Kustomisasi In-App**: Pengguna dapat mengunggah dan memotong (crop 1:1) foto/logo kustom langsung dari menu **Pengaturan > Ikon Aplikasi** menggunakan `react-easy-crop`.

---

## 🛠️ Arsitektur & Teknologi

- **Frontend**: React 19 + TypeScript (Strict) + Vite 8
- **Styling**: Tailwind CSS 4 + Lucide React (tanpa emoji di UI)
- **Database**: Dexie.js (IndexedDB) dengan transaksi atomik multi-tabel & migrasi skema v2
- **Audio & Keamanan**: Web Audio API & Web Crypto API bawaan browser
- **Grafik**: Recharts
- **PWA**: `vite-plugin-pwa` dengan Service Worker precaching otomatis
- **Image Processing**: `sharp` (devDependency build script) & `react-easy-crop`

---

## 🚀 Menjalankan Project

### Prasyarat
- Node.js versi 18+ (direkomendasikan Node.js LTS atau terbaru)
- npm

### Instalasi & Pengembangan
```bash
# Instal dependensi
npm install

# Hasilkan varian ikon PWA dari public/branding/icon-source.png
npm run icons

# Jalankan server pengembangan lokal
npm run dev
```

### Mengganti Ikon Default Aplikasi
Untuk mengganti ikon master aplikasi:
1. Ganti berkas sumber `public/branding/icon-source.png` (disarankan gambar PNG 1024x1024 px).
2. Jalankan perintah `npm run icons` (atau otomatis saat `npm run build`). Seluruh favicon, apple-touch-icon, dan manifest ikon akan diperbarui secara otomatis.
3. *Catatan:* Saat ini `public/branding/icon-source.png` menggunakan ikon placeholder berlabel "Nubung Yuk" dan dapat Anda gantikan kapan saja.

### Pengujian & Kualitas Kode
```bash
# Jalankan unit test dan integration test (Vitest)
npm test

# Jalankan pengecekan ESLint
npm run lint

# Buat build produksi PWA (otomatis memproses ikon)
npm run build
```

---

## 🔒 Kebijakan Privasi & Keamanan Data
Semua data keuangan Anda disimpan secara lokal di browser perangkat Anda menggunakan IndexedDB. Tidak ada data yang dikirimkan ke server mana pun. Pastikan Anda melakukan ekspor cadangan (backup) secara berkala melalui menu **Pengaturan > Cadangan & Pemulihan Data**.
"# nabung-yuk" 
