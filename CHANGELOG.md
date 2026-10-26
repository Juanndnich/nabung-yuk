# Changelog

Semua perubahan penting pada project **Nubung Yuk** dicatat dalam dokumen ini. Format mengacu pada [Keep a Changelog](https://keepachangelog.com/).

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
