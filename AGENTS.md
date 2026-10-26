# Nubung Yuk — Aturan Permanen Project

Dokumen ini berlaku untuk SEMUA tugas di project ini, termasuk prompt berikutnya. Baca dan patuhi sebelum mengerjakan apa pun. Jika prompt baru bertentangan dengan dokumen ini, ikuti prompt baru lalu perbarui dokumen ini agar tetap sinkron.

## 1. Identitas
- Nama aplikasi: "Nubung Yuk" (persis seperti ini). Pakai di UI, title, manifest, README.
- Fungsi: aplikasi pribadi untuk mencatat tabungan (saldo masuk, saldo keluar, dan untuk apa dipakai) dan buku utang (siapa yang berutang ke pengguna, sudah dibayar berapa, sisa berapa). Satu pengguna, tanpa akun, tanpa server.
- Bahasa UI, pesan error, dan laporan: Bahasa Indonesia. Bahasa gaya ramah dan singkat.
- Format uang: "Rp320.000". Zona waktu: Asia/Jakarta. Format tanggal bisa diatur pengguna.

## 2. Prinsip Utama: NOL DATA BAWAAN
- Aplikasi dimulai KOSONG. Dilarang ada tabungan, kategori, saldo, orang, utang, atau transaksi bawaan/contoh/dummy di build produksi.
- Jika data belum ada, tampilkan empty state yang menuntun pengguna mengisinya, bukan angka tebakan.
- Angka contoh hanya boleh ada di file test dan berlabel fixture.
- Kategori, warna, ikon kategori, dan target semuanya dibuat pengguna lewat UI.

## 3. Stack (wajib terbaru & stabil)
Sebelum menginstal, cek versi stabil terbaru lewat `npm view <paket> version` dan baca catatan rilis/breaking changes. Jangan mengandalkan ingatan versi. Jangan pakai paket beta/rc/deprecated. Pin versi di package.json dan commit lockfile.
- React + TypeScript (strict) + Vite
- Tailwind CSS (stabil terbaru) + komponen aksesibel berbasis Radix UI / shadcn/ui
- lucide-react untuk SEMUA ikon (DILARANG emoji di UI)
- motion (Framer Motion) untuk animasi halus; hormati `prefers-reduced-motion`
- Dexie (IndexedDB) untuk database lokal persisten dengan transaksi atomik
- Zod untuk validasi; react-hook-form untuk form
- Recharts untuk grafik (garis, batang, donat)
- React Router atau TanStack Router (pilih yang stabil terbaru, jelaskan alasan)
- react-easy-crop untuk crop foto/ikon
- vite-plugin-pwa (Workbox) untuk PWA dan update otomatis
- Web Audio API (bawaan browser) untuk suara; Web Crypto API (bawaan) untuk hash PIN dan enkripsi backup
- Vitest + Testing Library; ESLint + Prettier
- Font di-host lokal lewat @fontsource (tanpa CDN)
Minimalkan dependency. Jika memilih paket lain, jelaskan alasan singkat.

## 4. Keamanan (wajib)
- Semua data hanya di perangkat. Tidak ada pengiriman data ke server, tidak ada analytics/tracker/CDN pihak ketiga.
- Satu-satunya request jaringan: cek update aplikasi (file versi milik project sendiri / GitHub Releases). Opsional, gagal dengan tenang saat offline.
- Content-Security-Policy ketat (tanpa 'unsafe-eval', tanpa inline script, tanpa sumber eksternal yang tidak perlu), referrer-policy, dan header lain yang memungkinkan untuk hosting statis.
- Dilarang: eval, new Function, dangerouslySetInnerHTML tanpa sanitasi, innerHTML dari input pengguna.
- Semua input (form, impor JSON, file gambar) divalidasi dengan Zod serta pemeriksaan tipe dan ukuran file.
- Kunci aplikasi: PIN 4-8 digit (opsional diaktifkan pengguna). PIN di-hash dengan PBKDF2 (Web Crypto, salt acak, iterasi tinggi), TIDAK pernah disimpan polos. Batasi percobaan salah (jeda bertahap). Kunci otomatis setelah tidak aktif (durasi diatur pengguna) dan saat aplikasi ke latar belakang. Opsional: buka kunci dengan biometrik lewat WebAuthn jika didukung perangkat; jelaskan jujur batasannya.
- Mode privasi: tombol cepat untuk menyembunyikan semua nominal (tampil "Rp•••"), dan sembunyikan konten di tampilan app switcher bila memungkinkan.
- Backup bisa dienkripsi dengan password pengguna (AES-GCM, kunci dari PBKDF2). Peringatkan bahwa password yang hilang tidak bisa dipulihkan.
- Jujurkan di UI bahwa enkripsi/PIN di sisi klien melindungi dari orang yang membuka aplikasi, bukan dari orang yang punya akses penuh ke perangkat yang sudah terbuka.
- Dependency: jalankan `npm audit`, perbaiki temuan High/Critical atau jelaskan. Pakai `npm ci` di CI. Hindari paket dengan postinstall mencurigakan dan paket yang jarang dipelihara. Siapkan Dependabot dan workflow CI (lint, test, build, audit).
- Jangan taruh data sensitif di console log. Jangan hardcode secret.

## 5. Arsitektur Kode
- Modular per fitur: src/features/<nama>/{components,hooks,services,schemas,types}. Logika bisnis murni (hitung saldo, cicilan, statistik) di src/domain/ tanpa dependensi UI agar mudah di-test.
- Semua akses database lewat repository/service. Komponen UI tidak boleh memanggil Dexie langsung.
- Operasi yang mengubah lebih dari satu tabel WAJIB dalam satu transaksi Dexie (atomik).
- CRUD penuh untuk SETIAP entitas: buat, lihat, ubah, hapus. Hapus memakai konfirmasi dan fitur batal cepat (undo snackbar beberapa detik) lewat soft-delete; tersedia "Tempat Sampah" untuk pulihkan/hapus permanen.
- Setiap entitas punya id unik (ULID/UUID), createdAt, updatedAt. Ada audit log perubahan penting.
- Skema database berversi dengan migrasi; backup otomatis sebelum migrasi.

## 6. Aturan Uang & Akuntansi Pribadi (wajib)
- Semua nominal disimpan sebagai INTEGER rupiah. Pembulatan konsisten.
- Cegah NaN, Infinity, nol/negatif tidak valid, dan pembagian dengan nol. Data kurang tampil "Data belum cukup".
- Saldo tabungan = saldo awal + total masuk − total keluar. Saldo dihitung dari catatan transaksi, bukan angka yang diketik manual. Koreksi saldo dicatat sebagai transaksi "penyesuaian" bersama alasan.
- Transfer antar tabungan = satu transaksi berpasangan (keluar dari A, masuk ke B), tidak dihitung sebagai pemasukan atau pengeluaran di statistik.
- Saldo tidak boleh negatif diam-diam: tampilkan peringatan dan minta konfirmasi/penyesuaian bila pengeluaran melebihi saldo.
- Buku utang: sisa utang = nominal pokok − total pembayaran/cicilan. Pembayaran tidak boleh melebihi sisa (tolak atau tawarkan sebagai pelunasan). Status otomatis: belum dibayar, dicicil, lunas, jatuh tempo/terlambat.
- Utang yang diberikan pengguna ke orang lain memengaruhi saldo hanya bila pengguna memilih menghubungkannya ke tabungan (uang keluar saat meminjamkan, uang masuk saat dibayar). Pilihan ini eksplisit dan tidak dihitung ganda. Setiap catatan hasil tautan punya referensi sumber unik.
- Setiap perubahan data menjaga konsistensi saldo, sisa utang, dan statistik.

## 7. Suara & Haptik
- Setiap tombol, menu, tab, toggle, dan aksi penting mengeluarkan suara klik singkat. Suara disintesis lewat Web Audio API (tanpa file audio eksternal, offline) dengan beberapa jenis: klik, sukses, peringatan/error, buka-tutup panel, hapus.
- Volume DEFAULT cukup keras dan jelas, tetapi tidak memekakkan (batasi puncak dengan compressor/limiter). Pengguna bisa mengatur volume 0-100%, mematikan suara (mute) cepat, memilih gaya suara (mis. lembut, tegas, retro), dan tombol "Tes suara". Pengaturan tersimpan.
- Patuhi kebijakan autoplay browser (inisialisasi AudioContext setelah interaksi pertama). Jangan memutar suara saat aplikasi di latar belakang.
- Haptik getar ringan (navigator.vibrate) bila didukung dan bisa dimatikan.
- Suara tidak boleh menghambat UI (tanpa lag, tanpa tumpukan suara berlebihan).

## 8. UI/UX
- Mobile-first, terasa seperti aplikasi mobile profesional, tetap rapi di tablet/desktop.
- Bersih, tidak menumpuk: navigasi lewat bottom navigation + drawer/hamburger, aksi sekunder di dropdown/menu titik tiga, detail di bottom sheet/accordion, tabel jadi kartu di HP, tombol tambah cepat (FAB).
- Animasi halus dan singkat (transisi halaman, sheet naik, kartu muncul bertahap, angka menghitung naik, grafik tumbuh, mikro-interaksi tombol), hormati reduced-motion.
- Tema: Terang, Gelap, Ikuti sistem (default), plus beberapa preset warna (minimal 6 palet bagus, tiap palet punya mode terang & gelap), warna aksen kustom (color picker), dan pilihan font. Kontras aksesibel. Terapkan tanpa kedip saat load.
- Skeleton/loading state, empty state ramah, toast, dialog konfirmasi untuk tindakan berbahaya. Target sentuh minimal 44px. Input uang memakai inputmode numerik dan pemformat otomatis.
- Semua ikon lucide-react, TANPA emoji.

## 9. Online vs Offline (keputusan final)
- OFFLINE penuh untuk semua fitur data, suara, tema, font, grafik, backup/restore. Semua aset dibundel lokal.
- ONLINE hanya untuk cek update dan unduh versi baru; opsional.
- Tidak ada sinkronisasi cloud, tidak ada login.

## 10. Cara Memahami Prompt Berikutnya
- Anggap setiap prompt baru sebagai perubahan pada project yang ada. Baca kode dan dokumen ini dulu; jangan buat ulang dari nol dan jangan hapus data pengguna.
- Kerjakan semua poin sampai selesai tanpa menunggu persetujuan tiap langkah. Bila ambigu, ambil asumsi paling aman dan catat di laporan akhir.
- Setelah setiap perubahan: jalankan lint, test, build; perbaiki sampai lulus. Jangan klaim berhasil tanpa benar-benar menjalankannya.
- Jujur: jika ada fitur belum selesai atau terbatas platform, katakan apa adanya.
- Perbarui README dan CHANGELOG pada setiap perubahan berarti.

## 11. Definisi Selesai
Lint, test, build lulus; fitur diuji lewat alur nyata; tidak ada data palsu pada penggunaan pertama; data tetap ada setelah aplikasi ditutup-dibuka; semua alur utama jalan saat offline; laporan akhir menyebut file yang diubah, hasil perintah yang benar-benar dijalankan, batasan, dan masalah tersisa.

## 12. Pos Tabungan (Amplop) — Aturan Permanen
- Setiap tabungan dapat dibagi menjadi beberapa POS (contoh: jajan, transportasi, darurat). Nama, ikon, warna, batas bulanan (opsional), dan target (opsional) dibuat pengguna. DILARANG ada pos bawaan, kecuali pos sistem "Belum dialokasikan".
- Pos sistem "Belum dialokasikan" selalu ada per tabungan, tidak bisa dihapus/diubah namanya, dan menampung sisa saldo yang belum dibagi.
- Invarian wajib: saldo tabungan = jumlah saldo semua pos + Belum dialokasikan. Saldo pos dihitung dari catatan transaksi, bukan angka yang diketik manual.
- Setiap transaksi masuk/keluar WAJIB punya pos (default: Belum dialokasikan). Pengeluaran dari pos yang saldonya kurang memicu peringatan dan butuh konfirmasi atau pemindahan dana, bukan menjadi negatif diam-diam.
- Pindah dana antar pos (dalam tabungan yang sama) = transaksi berpasangan, BUKAN pemasukan/pengeluaran, tidak masuk statistik.
- Transfer antar tabungan harus menentukan pos asal dan pos tujuan.
- Aturan bagi otomatis (mis. pemasukan dibagi ke beberapa pos dengan persentase atau nominal) dibuat pengguna, tanpa nilai bawaan. Total persentase tidak boleh melebihi 100%; sisanya masuk Belum dialokasikan. Hasil pembagian dicatat sebagai alokasi transparan (bisa dilihat dan diubah), bukan transaksi ganda.
- Pos yang dihapus/diarsipkan: sisa saldonya wajib dipindahkan dulu ke pos lain atau Belum dialokasikan.
- Anggaran bulanan dan pos TIDAK boleh menghitung dua kali: batas bulanan pos menggantikan/menyatu dengan anggaran kategori yang terkait, dan UI harus menjelaskannya.
- Migrasi: transaksi lama otomatis masuk "Belum dialokasikan"; tidak ada data pengguna yang hilang atau berubah saldonya.

## 13. Ikon Aplikasi
- Sumber ikon dari pengguna ada di public/branding/icon-source.png (disarankan 1024x1024 PNG). Jangan menimpa file ini.
- Semua ukuran ikon (favicon, PWA 192/512, maskable, apple-touch-icon) dihasilkan dari file sumber lewat skrip build/generator (devDependency saja), bukan ditulis manual.
- Pengguna juga dapat mengganti ikon dari dalam aplikasi (upload + crop); ikon default tetap file sumber.