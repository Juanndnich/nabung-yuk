import React, { useState } from 'react';
import {
  HelpCircle,
  FileText,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Lock,
  Sparkles,
} from 'lucide-react';
import { SoundButton } from '../../components/SoundButton';
import { soundService } from '../../services/audio';
import { AppSettings } from '../../domain/types';

interface AboutPageProps {
  settings?: AppSettings;
  onRestartTour: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ settings, onRestartTour }) => {
  const [openSection, setOpenSection] = useState<string | null>('panduan');

  const toggle = (sec: string) => {
    soundService.play('panel');
    setOpenSection((prev) => (prev === sec ? null : sec));
  };

  const faqs = [
    {
      q: 'Apakah data keuangan saya dikirim ke internet?',
      a: 'Sama sekali tidak. Aplikasi Nubung Yuk 100% offline-first. Semua data disimpan secara lokal di memori browser perangkat Anda (IndexedDB). Tidak ada analitik, tracker, atau akun server.',
    },
    {
      q: 'Apa perbedaan Pos Tabungan dengan Anggaran Bulanan?',
      a: 'Pos Tabungan (amplop) adalah alokasi saldo riil di dalam dompet Anda (uang nyata yang disisihkan untuk pos tertentu, seperti Jajan, Transport, Darurat). Sedangkan Anggaran Bulanan adalah batas maksimal pengeluaran per kategori dalam 1 bulan kalender. Batas bulanan pos menyatu dengan anggaran kategori agar tidak terhitung ganda.',
    },
    {
      q: 'Bagaimana jika saya mengganti HP atau membersihkan browser?',
      a: 'Gunakan fitur "Cadangkan Data (JSON)" di menu Pengaturan secara berkala. File backup bisa Anda simpan di Google Drive pribadi atau flashdisk, dan dipulihkan kapan saja ke perangkat baru.',
    },
    {
      q: 'Bagaimana cara kerja transfer antar tabungan?',
      a: 'Transfer antar tabungan dicatat sebagai transaksi berpasangan (keluar dari tabungan A dan masuk ke tabungan B). Sistem akuntansi Nubung Yuk secara otomatis tidak menghitung transfer sebagai pemasukan atau pengeluaran pada statistik.',
    },
    {
      q: 'Apa fungsi PIN pada aplikasi ini?',
      a: 'PIN melindungi layar aplikasi dari orang lain yang meminjam HP Anda. PIN di-hash menggunakan PBKDF2 (Web Crypto API) dengan 100.000 iterasi dan salt acak, sehingga tidak pernah tersimpan dalam bentuk teks polos.',
    },
  ];

  const guideSteps = [
    {
      title: '1. Membuat Tabungan / Dompet',
      desc: 'Masuk ke menu Tabungan, klik "Tambah Dompet". Beri nama (misal: Rekening Utama, Dompet Tunai, Tabungan Haji) dan tentukan saldo awal Anda.',
    },
    {
      title: '2. Membagi Saldo ke Pos Tabungan (Amplop)',
      desc: 'Bagi tabungan Anda ke beberapa pos alokasi (misal: Jajan, Transportasi, Dana Darurat). Setiap tabungan memiliki pos sistem "Belum dialokasikan". Anda dapat memindahkan dana antar pos kapan saja atau memakai aturan "Bagi Otomatis" saat uang masuk.',
    },
    {
      title: '3. Mencatat Transaksi & Bagi Otomatis',
      desc: 'Gunakan tombol bundar (+) di pojok kanan bawah. Saat mencatat pemasukan, Anda bisa membaginya langsung ke pos secara otomatis atau manual. Pengeluaran dicatat per pos dengan peringatan jika saldo pos tidak mencukupi.',
    },
    {
      title: '4. Mengelola Buku Utang',
      desc: 'Buka menu Utang untuk mencatat pinjaman yang diberikan ke teman (Piutang) atau utang pribadi. Setiap kali teman mencicil, catat pembayaran untuk memperbarui sisa utang dan melihat timeline pelunasan.',
    },
    {
      title: '5. Menentukan Target & Anggaran',
      desc: 'Buat target tabungan dengan tenggat waktu impian Anda, dan pasang batas anggaran bulanan pada kategori pengeluaran agar selalu terkontrol.',
    },
  ];

  return (
    <div className="space-y-6 pb-24 max-w-5xl mx-auto">
      {/* Hero Header */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-3xl bg-[var(--color-primary)] text-white flex items-center justify-center mb-3 shadow-md overflow-hidden">
          {settings?.customAppIcon ? (
            <img src={settings.customAppIcon} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <img
              src="/pwa-192x192.png"
              alt="Logo"
              className="w-12 h-12 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">Nubung Yuk</h1>
        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mt-1 mb-2">
          Versi 1.1.0 (Pos Tabungan & PWA Terkini)
        </span>
        <p className="text-xs text-slate-500 max-w-md leading-relaxed">
          Aplikasi pencatat tabungan pribadi dan buku utang offline-first, mobile-first, tanpa akun,
          dan tanpa server. Hak privasi penuh untuk keuangan Anda.
        </p>

        <div className="mt-4">
          <SoundButton size="sm" variant="outline" sound="click" onClick={onRestartTour}>
            <RotateCcw className="w-4 h-4" />
            <span>Ulangi Tur / Onboarding</span>
          </SoundButton>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-3">
        {/* PANDUAN PENGGUNAAN */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <button
            onClick={() => toggle('panduan')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Panduan Lengkap Cara Pemakaian</span>
            </div>
            {openSection === 'panduan' ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSection === 'panduan' && (
            <div className="p-5 pt-0 space-y-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              {guideSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 space-y-1"
                >
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    {step.title}
                  </h4>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TIPS KEAMANAN & CADANGAN */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <button
            onClick={() => toggle('keamanan')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-emerald-500" />
              <span>Tips Keamanan & Rekomendasi Backup</span>
            </div>
            {openSection === 'keamanan' ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSection === 'keamanan' && (
            <div className="p-5 pt-0 space-y-2.5 border-t border-slate-100 dark:border-slate-800/80 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <p>
                • <strong>Cadangkan Setiap Minggu:</strong> Lakukan ekspor JSON di menu Pengaturan
                dan simpan di folder aman Anda.
              </p>
              <p>
                • <strong>Gunakan Enkripsi AES-GCM:</strong> Saat mencadangkan, Anda dapat memilih
                opsi enkripsi password agar file tidak dapat dibuka oleh sembarang orang.
              </p>
              <p>
                • <strong>Penyimpanan Persisten:</strong> Aplikasi meminta izin browser untuk
                menjaga data IndexedDB tetap utuh meskipun penyimpanan perangkat hampir penuh.
              </p>
            </div>
          )}
        </div>

        {/* FAQ */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <button
            onClick={() => toggle('faq')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-4 h-4 text-sky-500" />
              <span>Pertanyaan yang Sering Diajukan (FAQ)</span>
            </div>
            {openSection === 'faq' ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSection === 'faq' && (
            <div className="p-5 pt-0 space-y-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
              {faqs.map((f, i) => (
                <div key={i} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 space-y-1">
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">{f.q}</h4>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OPEN SOURCE LICENSES */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
          <button
            onClick={() => toggle('lisensi')}
            className="w-full p-4 flex items-center justify-between text-left font-bold text-sm text-slate-900 dark:text-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-purple-500" />
              <span>Daftar Lisensi Pustaka Pihak Ketiga</span>
            </div>
            {openSection === 'lisensi' ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSection === 'lisensi' && (
            <div className="p-5 pt-0 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 space-y-2">
              <p>Nubung Yuk dibangun menggunakan pustaka perangkat lunak bebas & sumber terbuka:</p>
              <ul className="list-disc pl-5 space-y-1 font-mono text-[11px]">
                <li>React 19 & React DOM (MIT)</li>
                <li>Dexie.js (Apache-2.0)</li>
                <li>Tailwind CSS (MIT)</li>
                <li>Lucide React (ISC)</li>
                <li>Motion / Framer Motion (MIT)</li>
                <li>Recharts (MIT)</li>
                <li>React Router (MIT)</li>
                <li>Zod (MIT)</li>
                <li>Plus Jakarta Sans Font (OFL)</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
