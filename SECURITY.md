# Kebijakan Keamanan — Nubung Yuk

Dokumen ini menjelaskan postur keamanan, model ancaman (*threat model*), dan arsitektur perlindungan data pribadi pada aplikasi **Nubung Yuk**.

---

## 1. Prinsip Utama: Kedaulatan Data Penuh (Zero-Knowledge, Offline-First)

1. **Tanpa Server & Tanpa Akun**:
   - Seluruh data transaksi, tabungan, utang, dan kontak disimpan secara lokal di memori peramban Anda menggunakan IndexedDB (Dexie.js).
   - Tidak ada sinkronisasi cloud, tidak ada server backend, dan tidak ada database terpusat milik pengembang.

2. **Tanpa Analitik, Pelacak, atau CDN Pihak Ketiga**:
   - Aplikasi tidak memuat Google Analytics, Meta Pixel, Sentry pihak ketiga, atau skrip eksternal apa pun.
   - Semua font (`@fontsource/plus-jakarta-sans`), ikon (`lucide-react`), dan aset audio disintesis dan dibundel secara lokal.

---

## 2. Fitur Keamanan Kriptografi

### A. Penguncian Aplikasi dengan PIN
- **Algoritma**: PBKDF2 (Password-Based Key Derivation Function 2) dengan SHA-256.
- **Salt**: Nilai acak kriptografis 16-byte (`crypto.getRandomValues`) per perangkat.
- **Iterasi**: 100.000 putaran via Web Crypto API bawaan browser.
- **Penyimpanan**: PIN dalam bentuk teks polos (*plaintext*) **tidak pernah** disimpan. Hanya salt dan hash heksadesimal yang disimpan di IndexedDB.
- **Proteksi Brute-Force**: Jeda waktu bertahap dan pembatasan percobaan gagal.

### B. Enkripsi Berkas Cadangan (Backup)
- **Algoritma**: AES-GCM (Galois/Counter Mode) 256-bit.
- **Kunci Enkripsi**: Diturunkan dari password pengguna via PBKDF2 (100.000 iterasi, SHA-256, salt 16-byte acak).
- **IV (Initialization Vector)**: 12-byte acak unik untuk setiap sesi pencadangan.
- **Integritas**: Menggunakan *Authentication Tag* bawaan AES-GCM untuk mendeteksi modifikasi atau korupsi berkas cadangan.

### C. Mode Privasi Seketika
- Pengguna dapat menyamarkan seluruh nominal angka di antarmuka menjadi `"Rp•••"` dengan satu ketukan tombol di bilah navigasi.

---

## 3. Batas Tanggung Jawab & Model Ancaman (*Threat Model*)

> [!WARNING]
> **Peringatan Keamanan Klien**:
> Enkripsi dan kunci PIN di sisi klien melindungi data dari orang yang meminjam atau membuka aplikasi pada perangkat Anda. Fitur ini **tidak dapat** melindungi data apabila perangkat Anda telah di-*root*, terkena *malware* sistem, atau disita oleh pihak yang memiliki akses fisik tidak terbatas ke berkas internal sistem operasi.

Pengguna disarankan untuk:
1. Memasang kunci layar (biometrik / PIN / pola) pada perangkat fisik ponsel.
2. Melakukan pencadangan berkas JSON secara rutin ke penyimpanan dingin (*cold storage*) atau media eksternal terpercaya.
3. Menjaga kerahasiaan password enkripsi backup, karena password yang hilang tidak dapat dipulihkan oleh siapa pun.

---

## 4. Validasi & Sanitasi Data
- **Skema Zod**: Seluruh masukan form, impor berkas JSON, dan payload transaksi divalidasi secara ketat dengan aturan tipe data, batas minimum, dan bilangan bulat rupiah (*integer*).
- **Cegah Injeksi**: Dilarang menggunakan `eval`, `new Function`, `dangerouslySetInnerHTML` tanpa sanitasi, atau eksekusi kode dinamis.
- **CSP (Content-Security-Policy)**: Kebijakan konten ketat diterapkan tanpa `unsafe-eval` dan memblokir muatan skrip dari luar domain.

---

## 5. Melaporkan Kerentanan Keamanan

Jika Anda menemukan potensi celah keamanan atau kerentanan pada kode aplikasi ini:
1. Laporkan secara bertanggung jawab (*responsible disclosure*) via GitHub Security Advisories atau buat *private issue*.
2. Harap sertakan langkah-langkah reproduksi (PoC) yang jelas.
3. Kami berkomitmen untuk meninjau dan merilis perbaikan secepatnya.
