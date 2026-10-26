# Changelog

Semua perubahan penting pada project **Nubung Yuk** dicatat dalam dokumen ini. Format mengacu pada [Keep a Changelog](https://keepachangelog.com/).

## [1.1.0] - 2026-10-26

### Ditambahkan
- **Fitur Pos Tabungan (Envelope Budgeting)**:
  - Pembagian tabungan ke pos-pos kustom (nama, ikon lucide, warna, batas bulanan, target, urutan, arsip) tanpa data bawaan.
  - Pos sistem **"Belum dialokasikan"** otomatis per tabungan untuk menampung saldo yang belum dibagi.
  - Invarian ketat: saldo tabungan = jumlah seluruh pos + saldo belum dialokasikan.
  - Fitur **Pindah Dana Antar Pos** (mutasi internal berpasangan, bukan pemasukan/pengeluaran).
  - Pilihan alokasi pada pencatatan pemasukan: mode tunggal, aturan bagi otomatis, atau pembagian manual (split).
  - Peringatan defisit saldo pos pada pengeluaran dan peringatan progres batas bulanan pos.
  - Tampilan tab **Pos Tabungan** di Buku Tabungan dengan kartu interaktif, progres batas/target, modal tambah/edit/reorder pos, dan pemindahan saldo wajib saat pos diarsipkan atau dihapus.
  - Wizard onboarding: langkah tur pengenalan konsep Pos Tabungan (amplop).
- **Aturan Bagi Otomatis**:
  - CRUD aturan bagi otomatis di Pengaturan > Pos Tabungan.
  - Mendukung pembagian berbasis persentase (total >100% ditolak) dan nominal riil.
  - Sisa pembulatan atau alokasi otomatis dialihkan secara transparan ke pos sistem "Belum dialokasikan".
  - Pratinjau interaktif hasil alokasi sebelum aturan disimpan.
- **Visualisasi Statistik & Beranda**:
  - Donat komposisi saldo per pos tabungan.
  - Batang pengeluaran per pos berdasarkan filter periode.
  - Kartu indikator status batas bulanan pos (Aman, Hampir Habis, Melebihi Batas).
  - Penjelasan UI hubungan pos dengan anggaran bulanan kategori untuk mencegah penghitungan ganda.
- **Generator Ikon Otomatis & Kustomisasi Ikon (Bagian 13 AGENTS.md)**:
  - Generator skrip terprogram `scripts/generate-icons.js` berbasis `sharp` (`npm run icons`).
  - Menghasilkan favicon (16px, 32px, .ico), PWA icons (192px, 512px), maskable icon (safe zone 80%), apple-touch-icon (180px), dan shortcut icons dari berkas master `public/branding/icon-source.png`.
  - Placeholder sumber ikon berlabel jelas jika berkas master belum disediakan.
  - Fitur kustomisasi ikon logo di dalam aplikasi dengan upload + crop 1:1 via `react-easy-crop`.
- **Database & Migrasi Dexie v2**:
  - Peningkatan skema Dexie ke Versi 2 (`pockets`, `autoAllocationRules`, indeks `posId`/`targetPosId`).
  - Pencadangan otomatis snapshot pra-migrasi ke `localStorage`.
  - Migrasi data lama otomatis membuat pos sistem `pos_sys_${tabunganId}` dan mengaitkan seluruh transaksi lama tanpa mengubah nominal saldo tabungan.
  - Ekspor/impor cadangan JSON dan ekspor CSV kini menyertakan kolom Pos Tabungan.
- **Pengujian (Testing)**:
  - 15 pengujian unit domain akuntansi & pos tabungan.
  - 11 pengujian integrasi database Dexie, migrasi v2, transfer pos, enkripsi cadangan, dan siklus data (total 26 tests lulus).

## [1.0.0] - 2026-10-26

### Ditambahkan
- **Inisialisasi Project**: Setup React + TypeScript (strict) + Vite 8 + Tailwind CSS 4 + Lucide React.
- **Prinsip Nol Data Bawaan**: Build produksi dimulai dengan database IndexedDB yang bersih tanpa dummy data.
- **Database & Domain Akuntansi**:
  - Skema Dexie versi 1 untuk pengaturan, dompet, kategori, tag, transaksi, utang, pembayaran, target, anggaran, transaksi berulang, pengingat, pencapaian, tempat sampah, dan log audit.
  - Perhitungan presisi integer rupiah: saldo riil, sisa utang, pencegahan bayar lebih, transfer berpasangan, progres target, sisa anggaran, dan streak menabung.
- **Sistem Keamanan**:
  - Hashing PIN dengan Web Crypto API PBKDF2 (100.000 iterasi + salt acak).
  - Enkripsi/dekripsi cadangan AES-GCM 256-bit dengan kata sandi.
  - Pembatasan percobaan PIN gagal dan penguncian otomatis saat tidak aktif atau aplikasi beralih ke latar belakang.
  - Mode privasi instan (`Rp•••`).
  - Content Security Policy (CSP) ketat di `index.html`.
- **Sistem Audio Sintetis & Haptik**:
  - Web Audio API synthesizer dengan 4 gaya suara (`modern`, `lembut`, `tegas`, `retro`).
  - Dynamic compressor/limiter untuk mencegah audio clipping.
  - Dukungan getar `navigator.vibrate`.
- **UI & Halaman Fitur**:
  - Wizard onboarding langkah demi langkah yang dapat dilewati.
  - Beranda dengan kartu ringkasan saldo, filter rentang tanggal, grafik Recharts, dan FAB aksi cepat.
  - Buku Tabungan: Multi-dompet, riwayat harian berlipat, filter komprehensif, pencarian teks, penyesuaian saldo.
  - Buku Utang & Piutang: Dua arah, pencatatan cicilan, generator pesan pengingat, tautan ke dompet.
  - Target Tabungan & Anggaran Kategori bulanan.
  - Transaksi Berulang dengan konfirmasi eksekusi manual.
  - Analisis Statistik Lanjutan (rasio menabung, rata-rata harian, hari terboros).
  - Tempat Sampah dengan soft-delete, snackbar undo, pulihkan, dan hapus permanen.
  - Pengaturan komprehensif (6 preset palet tema, ekspor CSV, backup terenkripsi, status persistensi penyimpanan).
  - Halaman Tentang & Bantuan dengan panduan, FAQ, dan lisensi.
- **PWA & Offline Support**:
  - Konfigurasi `vite-plugin-pwa` dengan Workbox precaching offline penuh.
  - Banner update Service Worker otomatis.
- **Pengujian & CI/CD**:
  - Unit test domain akuntansi murni (11 tests).
  - Integration test database, enkripsi, dan soft-delete (7 tests).
  - GitHub Actions CI workflow (lint, test, build, audit) dan Dependabot.
