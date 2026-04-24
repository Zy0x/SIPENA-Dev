import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HelpCircle,
  BookOpen,
  Users,
  FileSpreadsheet,
  Calculator,
  Download,
  Settings,
  GraduationCap,
  Plus,
  CheckCircle,
  ArrowRight,
  Share2,
  Maximize2,
  Keyboard,
  Smartphone,
  Lock,
  MessageCircle,
  Github,
  ExternalLink,
  CalendarDays,
} from "lucide-react";

export default function Help() {
  const navigate = useNavigate();

  const guides = [
    {
      id: "setup",
      icon: Settings,
      title: "Setup Awal Aplikasi",
      description: "Langkah pertama untuk memulai menggunakan SIPENA",
      steps: [
        "Daftar atau masuk ke akun SIPENA Anda melalui halaman login",
        "Setelah login, Anda akan diarahkan ke Dashboard",
        "Buka menu 'Pengaturan Awal' untuk mengatur tahun ajaran dan semester aktif",
        "Pilih tahun ajaran yang sedang berjalan (contoh: 2024/2025)",
        "Pilih semester aktif (Ganjil atau Genap)",
        "Perubahan tersimpan otomatis",
      ],
    },
    {
      id: "classes",
      icon: Users,
      title: "Mengelola Kelas & Siswa",
      description: "Cara membuat kelas dan menambahkan data siswa",
      steps: [
        "Buka menu 'Kelas & Siswa' dari sidebar navigasi",
        "Klik tombol 'Tambah Kelas' untuk membuat kelas baru",
        "Masukkan nama kelas (contoh: Kelas 4A, Kelas 5B)",
        "Tambahkan deskripsi kelas jika diperlukan (opsional)",
        "Setelah kelas dibuat, klik pada kartu kelas untuk melihat detail",
        "Pilih 'Tambah Siswa' untuk input manual satu per satu",
        "Masukkan Nama Siswa dan NISN (Nomor Induk Siswa Nasional)",
        "Atau gunakan 'Import Excel/CSV' untuk tambah banyak siswa sekaligus",
        "Format CSV/Excel: Kolom A = Nama, Kolom B = NISN",
        "Siswa dapat diberi bookmark (⭐) untuk penandaan khusus",
      ],
    },
    {
      id: "subjects",
      icon: BookOpen,
      title: "Mengatur Mata Pelajaran",
      description: "Cara membuat dan mengelola mata pelajaran per kelas",
      steps: [
        "Buka menu 'Mata Pelajaran' dari sidebar",
        "Pilih kelas yang akan ditambahkan mata pelajaran menggunakan dropdown",
        "Klik tombol 'Tambah Mata Pelajaran'",
        "Pilih nama mata pelajaran dari dropdown atau ketik nama baru",
        "Atur nilai KKM (Kriteria Ketuntasan Minimal), default: 75",
        "Klik 'Simpan' untuk menyimpan mata pelajaran",
        "Untuk langsung input nilai, klik ikon 'Input Nilai' pada kartu mapel",
        "Untuk berbagi akses ke guru tamu, klik ikon 'Share Link'",
      ],
    },
    {
      id: "chapters",
      icon: Plus,
      title: "Membuat BAB dan Tugas",
      description: "Struktur penilaian per mata pelajaran",
      steps: [
        "Di halaman 'Input Nilai', pilih kelas dan mata pelajaran",
        "Buka tab 'Struktur BAB' untuk mengatur struktur penilaian",
        "Klik 'Tambah BAB' dan masukkan jumlah BAB yang diinginkan",
        "Nama BAB akan otomatis terisi (BAB 1, BAB 2, dst.)",
        "Untuk menambah tugas per BAB, klik 'Tambah Tugas' pada BAB tersebut",
        "Masukkan jumlah tugas yang diinginkan",
        "Nama tugas otomatis: Tugas 1, Tugas 2, dst.",
        "Nama BAB dan Tugas dapat diedit dengan mengklik nama tersebut",
        "Struktur dapat dihapus dengan tombol hapus (ikon tempat sampah)",
      ],
    },
    {
      id: "grades",
      icon: FileSpreadsheet,
      title: "Input Nilai Siswa",
      description: "Cara memasukkan dan mengedit nilai dengan cepat",
      steps: [
        "Buka menu 'Input Nilai' dari sidebar atau tombol pada kartu mapel",
        "Pilih kelas dan mata pelajaran yang akan diinput",
        "Beralih ke tab 'Input Nilai' untuk melihat tabel nilai",
        "Klik pada sel nilai untuk mengedit (rentang 0-100)",
        "Nilai otomatis tersimpan setelah selesai edit (Auto-Save)",
        "Gunakan tombol 'Fullscreen' untuk mode layar penuh",
        "Di mode fullscreen: Tekan Enter untuk pindah ke baris berikutnya (vertikal)",
        "Gunakan fitur 'Mark Baris' untuk menandai baris dengan warna",
        "Pinch untuk zoom di layar sentuh (Android/tablet)",
        "Kolom STS = Sumatif Tengah Semester",
        "Kolom SAS = Sumatif Akhir Semester",
      ],
    },
    {
      id: "attendance",
      icon: CalendarDays,
      title: "Presensi Siswa (Beta)",
      description: "Kelola kehadiran siswa dengan kalender",
      steps: [
        "Buka menu 'Presensi' dari sidebar (ditandai badge Beta)",
        "Pilih kelas yang akan dikelola presensinya",
        "Pilih tanggal menggunakan kalender popup",
        "Klik tombol H/I/S/A untuk setiap siswa (Hadir/Izin/Sakit/Alpha)",
        "Gunakan 'Semua Hadir' untuk presensi massal",
        "Lihat rekap bulanan di bagian bawah halaman",
        "Klik tombol Kunci untuk mengunci rekap bulanan",
        "Ekspor data presensi ke Excel untuk dokumentasi",
        "Statistik otomatis terhitung per bulan",
      ],
    },
    {
      id: "fullscreen",
      icon: Maximize2,
      title: "Mode Fullscreen Input Nilai",
      description: "Fitur lengkap untuk input nilai di layar penuh",
      steps: [
        "Klik tombol 'Fullscreen' di halaman Input Nilai",
        "Mode fullscreen mendukung layar sentuh dan keyboard",
        "Gunakan tombol +/- untuk zoom in/out tabel",
        "Tombol 'Fit' untuk menyesuaikan tabel ke lebar layar",
        "Klik baris untuk memilih, lalu pilih warna dan klik 'Mark Baris'",
        "Tombol 'Reset' untuk menghapus semua penandaan warna",
        "Tombol kunci untuk freeze/unfreeze kolom No dan Nama",
        "Tekan Enter pada keyboard untuk navigasi vertikal otomatis",
        "Di Android, tombol 'Next' pada keyboard juga berfungsi sama",
        "Pinch dengan dua jari untuk zoom di layar sentuh",
      ],
    },
    {
      id: "calculation",
      icon: Calculator,
      title: "Perhitungan Nilai Rapor",
      description: "Rumus dan logika perhitungan nilai akhir",
      steps: [
        "Rata-rata per BAB = Jumlah nilai tugas ÷ Jumlah tugas",
        "Grand Average = Rata-rata dari semua rata-rata BAB",
        "⚠️ Nilai kosong pada tugas dianggap 0 untuk perhitungan",
        "⚠️ Nilai STS/SAS kosong dianggap 0 untuk rapor",
        "Rumus default: Rapor = (Rata-rata BAB + STS + SAS) ÷ 3",
        "Jika tanpa BAB: Rapor = (STS + SAS) ÷ 2",
        "Rumus dapat dikustomisasi via tombol 'Pengaturan Rumus'",
        "Warna status berdasarkan KKM:",
        "🟢 Hijau: Nilai > KKM + 5 (Lulus)",
        "🟡 Kuning: KKM ≤ Nilai ≤ KKM + 5 (Cukup)",
        "🔴 Merah: Nilai < KKM (Belum Lulus)",
      ],
    },
    {
      id: "sharing",
      icon: Share2,
      title: "Berbagi Akses ke Guru Tamu",
      description: "Cara mengundang guru tamu untuk input nilai",
      steps: [
        "Buka halaman 'Mata Pelajaran'",
        "Klik ikon 'Link' pada kartu mata pelajaran yang ingin dibagikan",
        "Link akses akan dibuat otomatis dengan masa berlaku 7 hari",
        "Salin link dan bagikan ke guru tamu via WhatsApp/Email",
        "Guru tamu dapat mengakses tanpa perlu login",
        "Guru tamu diminta mengisi nama dan email saat pertama kali akses",
        "Anda akan menerima notifikasi saat guru tamu mulai input nilai",
        "Link dapat dicabut aksesnya kapan saja",
      ],
    },
    {
      id: "reports",
      icon: Download,
      title: "Ekspor Laporan",
      description: "Cara mengunduh dan mencetak laporan nilai",
      steps: [
        "Buka menu 'Laporan' dari sidebar",
        "Pilih kelas dan mata pelajaran yang akan dieksport",
        "Pilih format ekspor: PDF, Excel, atau CSV",
        "Centang komponen nilai yang ingin disertakan",
        "Klik 'Ekspor' untuk mengunduh file",
        "File PDF siap cetak dengan format rapor",
        "File Excel dapat diedit lebih lanjut",
        "File CSV untuk integrasi dengan sistem lain",
      ],
    },
    {
      id: "keyboard",
      icon: Keyboard,
      title: "Shortcut Keyboard",
      description: "Pintasan keyboard untuk navigasi cepat",
      steps: [
        "Navigasi Halaman (Ctrl/Cmd + Shift + Key):",
        "  D = Dashboard",
        "  K = Kelas & Siswa",
        "  M = Mata Pelajaran",
        "  N = Input Nilai",
        "  L = Laporan",
        "  P = Presensi",
        "  S = Setup Awal",
        "  H = Panduan (Halaman ini)",
        "  T = Pengaturan",
        "  A = Tentang",
        "",
        "Shortcut Lainnya:",
        "  Ctrl/Cmd + / = Fokus ke kolom pencarian",
        "  Enter = Pindah ke sel berikutnya (vertikal)",
        "  Tab = Pindah ke sel berikutnya (horizontal)",
        "  Arrow Keys = Navigasi sel ke segala arah",
        "  Escape = Tutup dialog/keluar mode",
      ],
    },
    {
      id: "mobile",
      icon: Smartphone,
      title: "Penggunaan di Android/Tablet",
      description: "Tips optimal untuk perangkat mobile",
      steps: [
        "SIPENA mendukung PWA - dapat dipasang seperti aplikasi native",
        "Buka situs di Chrome, lalu pilih 'Tambahkan ke Layar Utama'",
        "Mode fullscreen dioptimalkan untuk layar sentuh",
        "Pinch dengan dua jari untuk zoom in/out tabel",
        "Scroll horizontal dan vertikal untuk navigasi tabel",
        "Keyboard virtual otomatis muncul saat mengedit nilai",
        "Tombol 'Next' pada keyboard untuk pindah sel vertikal",
        "Tap baris untuk memilih sebelum menandai dengan warna",
        "Jika layar dimiringkan (landscape), akan muncul saran rotasi",
      ],
    },
    {
      id: "profile",
      icon: GraduationCap,
      title: "Pengaturan Profil",
      description: "Cara mengubah data profil dan tampilan",
      steps: [
        "Buka menu 'Pengaturan' dari sidebar",
        "Di bagian Profil, Anda dapat mengubah nama tampilan",
        "Klik 'Ubah Foto' untuk upload foto profil baru",
        "Format foto: JPG atau PNG, maksimal 2MB",
        "Foto akan otomatis di-crop menjadi persegi",
        "Aktifkan 'Mode Gelap' untuk tampilan mata nyaman",
        "Perubahan tersimpan otomatis",
      ],
    },
    {
      id: "security",
      icon: Lock,
      title: "Keamanan & Privasi",
      description: "Informasi tentang keamanan data Anda",
      steps: [
        "Semua data disimpan di server yang aman dan terenkripsi",
        "Hanya Anda yang dapat mengakses data kelas dan nilai Anda",
        "Link berbagi memiliki masa berlaku dan dapat dicabut",
        "Guru tamu hanya dapat mengakses data yang dibagikan",
        "Logout otomatis setelah periode tidak aktif",
        "Gunakan password yang kuat dan unik",
        "Jangan bagikan akun Anda ke orang lain",
      ],
    },
  ];

  const additionalGuides = [
    {
      id: "morphe",
      icon: MessageCircle,
      title: "Menggunakan Morphe AI",
      description: "Asisten AI cerdas untuk membantu tugas mengajar",
      steps: [
        "Buka menu 'Morphe AI' dari sidebar navigasi",
        "Pilih mode: 'Chat' untuk percakapan umum, 'SIPENA' untuk analisis data akademik",
        "Ketik pertanyaan atau gunakan Quick Prompt yang tersedia",
        "Lampirkan gambar, dokumen, atau kode menggunakan tombol klip",
        "Mode SIPENA mengakses data kelas, nilai, dan presensi Anda",
        "Setiap sesi disimpan otomatis dan dapat diakses kembali",
        "Klik kanan sesi di sidebar untuk rename, pin, atau hapus",
        "Buka Pengaturan untuk atur system prompt dan knowledge kustom",
        "Export/import sesi percakapan untuk backup",
      ],
    },
    {
      id: "portal",
      icon: Users,
      title: "Portal Orang Tua",
      description: "Bagikan perkembangan siswa ke orang tua/wali",
      steps: [
        "Buka Laporan > Portal Orang Tua dari sidebar",
        "Pilih kelas yang akan dibagikan",
        "Atur data apa saja yang ditampilkan (nilai, presensi, ranking)",
        "Buat link portal unik untuk setiap kelas",
        "QR Code otomatis digenerate untuk kemudahan akses",
        "Orang tua dapat melihat perkembangan anak tanpa login",
        "Link memiliki masa berlaku dan dapat dicabut kapan saja",
      ],
    },
    {
      id: "backup",
      icon: Download,
      title: "Backup & Ekspor Data",
      description: "Cara mengamankan dan mengekspor seluruh data",
      steps: [
        "Setiap data tersimpan otomatis di cloud (Supabase)",
        "Ekspor nilai ke PDF/Excel dari halaman Laporan",
        "Ekspor presensi ke Excel dari halaman Presensi",
        "Admin dapat backup database lengkap via Panel Admin",
        "File backup dienkripsi dan dikompresi untuk keamanan",
        "Restore data dari backup jika diperlukan",
      ],
    },
    {
      id: "pwa",
      icon: Smartphone,
      title: "Instalasi PWA",
      description: "Pasang SIPENA sebagai aplikasi di perangkat Anda",
      steps: [
        "Buka SIPENA di Chrome (Android) atau Safari (iOS)",
        "Klik menu browser (⋮) > 'Tambahkan ke Layar Utama'",
        "Aplikasi akan muncul di layar utama seperti aplikasi native",
        "Buka melalui ikon untuk pengalaman fullscreen",
        "Beberapa fitur tersedia offline setelah caching awal",
        "Notifikasi install akan muncul otomatis saat pertama kali",
      ],
    },
  ];

  const allGuides = [...guides, ...additionalGuides];

  return (
    <>
      <div className="p-3 sm:p-4 lg:p-8 max-w-4xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">
              Panduan Penggunaan
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
              Pelajari cara menggunakan SIPENA dengan mudah
            </p>
          </div>
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
            <HelpCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        </div>

        {/* Quick Start Card */}
        <Card className="animate-fade-in-up delay-100 bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 shadow-sm">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-grade-pass" />
              Mulai Cepat
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-xs">
              Ikuti 4 langkah sederhana untuk memulai menggunakan SIPENA
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4 sm:pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                { step: 1, text: "Buat Kelas", link: "/classes" },
                { step: 2, text: "Tambah Siswa", link: "/classes" },
                { step: 3, text: "Atur Mapel", link: "/subjects" },
                { step: 4, text: "Input Nilai", link: "/grades" },
              ].map((item) => (
                <Button
                  key={item.step}
                  variant="outline"
                  className="h-auto py-3 sm:py-4 flex flex-col gap-1.5 sm:gap-2 hover:bg-primary/10 hover:border-primary text-xs sm:text-sm"
                  onClick={() => navigate(item.link)}
                >
                  <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] sm:text-sm font-bold">
                    {item.step}
                  </span>
                  <span className="font-medium truncate">{item.text}</span>
                  <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Keyboard Shortcut Quick Reference */}
        <Card className="animate-fade-in-up delay-150 border border-border shadow-sm">
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Keyboard className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              Shortcut Cepat
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {[
                { keys: "Ctrl+Shift+D", label: "Dashboard" },
                { keys: "Ctrl+Shift+N", label: "Input Nilai" },
                { keys: "Ctrl+Shift+L", label: "Laporan" },
                { keys: "Ctrl+Shift+P", label: "Presensi" },
                { keys: "Ctrl+Shift+K", label: "Kelas" },
                { keys: "Ctrl+Shift+M", label: "Mapel" },
                { keys: "Ctrl+/", label: "Pencarian" },
                { keys: "Escape", label: "Tutup" },
              ].map((shortcut) => (
                <div key={shortcut.keys} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                  <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1.5 py-0.5 font-mono">
                    {shortcut.keys}
                  </Badge>
                  <span className="text-[10px] sm:text-xs text-muted-foreground truncate">{shortcut.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accordion Guides */}
        <Card className="animate-fade-in-up delay-200 border border-border shadow-sm">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="text-sm sm:text-base">Panduan Lengkap</CardTitle>
            <CardDescription className="text-[10px] sm:text-xs">
              Klik pada topik untuk melihat panduan detail
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <Accordion type="single" collapsible className="w-full">
              {allGuides.map((guide) => (
                <AccordionItem key={guide.id} value={guide.id}>
                  <AccordionTrigger className="hover:no-underline group py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3 text-left min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                        <guide.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-xs sm:text-sm truncate">{guide.title}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground font-normal truncate">
                          {guide.description}
                        </p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-10 sm:pl-13 ml-4 sm:ml-5 border-l-2 border-primary/20 py-2">
                      <ol className="space-y-2 sm:space-y-3">
                        {guide.steps.map((step, index) => (
                          <li key={index} className="flex items-start gap-2 sm:gap-3 pl-3 sm:pl-4">
                            {step.trim() === "" ? (
                              <div className="h-2" />
                            ) : step.startsWith("  ") ? (
                              <span className="text-[10px] sm:text-xs text-muted-foreground pl-4">{step.trim()}</span>
                            ) : (
                              <>
                                <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-medium flex items-center justify-center mt-0.5">
                                  {index + 1}
                                </span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground">{step}</span>
                              </>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="animate-fade-in-up delay-300 border border-border shadow-sm">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 sm:py-6">
            <div className="text-center sm:text-left min-w-0">
              <h3 className="font-semibold text-foreground text-sm sm:text-base">Butuh Bantuan Lebih?</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                Hubungi tim support kami jika ada pertanyaan
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm">
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  Hubungi Support
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 sm:w-56">
                <DropdownMenuItem 
                  onClick={() => window.open("https://t.me/thuandmuda?text=Saya%20perlu%20bantuan%20terkait%20SIPENA,%20mengenai%20....", "_blank")}
                  className="cursor-pointer text-xs sm:text-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-blue-500" />
                  <span>Telegram</span>
                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => window.open("https://github.com/Zy0x", "_blank")}
                  className="cursor-pointer text-xs sm:text-sm"
                >
                  <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                  <span>GitHub</span>
                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto text-muted-foreground" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      </div>
    </>
  );
}