import { PanduanIcon } from "@/components/ui/animated-icons";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NAVIGATION_SHORTCUTS, UTILITY_SHORTCUTS } from "@/lib/keyboardShortcuts";
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
  Search,
} from "lucide-react";

export default function Help() {
  const navigate = useNavigate();
  const [guideQuery, setGuideQuery] = useState("");

  const guides = [
    {
      id: "setup",
      icon: Settings,
      title: "Pengaturan Awal Aplikasi",
      description: "Langkah pertama untuk memulai menggunakan SIPENA",
      steps: [
        "Daftar atau masuk ke akun SIPENA Anda melalui halaman login",
        "Setelah login, Anda akan diarahkan ke Dashboard",
        "Tekan pemilih tahun ajaran di bagian atas sidebar",
        "Pilih tahun ajaran yang sedang berjalan (contoh: 2024/2025)",
        "Pilih semester aktif (Ganjil atau Genap)",
        "Perubahan tersimpan otomatis",
      ],
    },
    {
      id: "classes",
      icon: Users,
      title: "Mengelola Kelas & Murid",
      description: "Cara membuat kelas dan menambahkan data murid",
      steps: [
        "Buka menu 'Kelas & Murid' dari sidebar navigasi",
        "Klik tombol 'Tambah Kelas' untuk membuat kelas baru",
        "Masukkan nama kelas (contoh: Kelas 4A, Kelas 5B)",
        "Tambahkan deskripsi kelas jika diperlukan (opsional)",
        "Setelah kelas dibuat, klik pada kartu kelas untuk melihat detail",
        "Pilih 'Tambah Murid' untuk input manual satu per satu",
        "Masukkan nama murid dan NISN (Nomor Induk Siswa Nasional)",
        "Gunakan Import Kelas & Murid untuk menambahkan beberapa kelas dari template resmi",
        "Gunakan Import dari Foto (BETA) bila sumber data berupa foto tabel",
        "Murid dapat diberi tanda favorit untuk memudahkan pencarian",
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
      title: "Input Nilai Murid",
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
      title: "Presensi Murid",
      description: "Kelola kehadiran murid dengan kalender",
      steps: [
        "Buka menu 'Presensi' dari sidebar (ditandai badge Beta)",
        "Pilih kelas yang akan dikelola presensinya",
        "Pilih tanggal menggunakan kalender popup",
        "Klik H/S/I/A/D untuk setiap murid (Hadir/Sakit/Izin/Alpha/Dispensasi)",
        "Gunakan Presensi Massal untuk menerapkan status ke banyak murid",
        "Buka Rekap Bulanan untuk melihat jumlah dan persentase kehadiran",
        "Bulan terkunci secara default; buka kunci hanya saat perlu mengubah data",
        "Gunakan Studio Ekspor untuk membuat PDF, Excel, atau gambar rekap",
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
        "Rumus default: Rapor = (Rata-rata BAB + ((STS + SAS) / 2)) / 2",
        "Jika tanpa BAB: Rapor = (STS + SAS) ÷ 2",
        "Rumus custom per mata pelajaran dipakai juga oleh Ranking dan Laporan",
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
        "Guru tamu dapat melanjutkan dengan akun SIPENA agar akses tersimpan",
        "Masuk Cepat tanpa akun tetap tersedia untuk akses sementara",
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
        "Navigasi halaman memakai Ctrl/Cmd + Shift + huruf:",
        ...NAVIGATION_SHORTCUTS.map((shortcut) => `  ${shortcut.key} = ${shortcut.label}`),
        "",
        "Shortcut Lainnya:",
        ...UTILITY_SHORTCUTS.map((shortcut) => `  ${shortcut.keys} = ${shortcut.label}`),
        "  Enter = Pindah ke sel berikutnya (vertikal)",
        "  Tab = Pindah ke sel berikutnya (horizontal)",
        "  Arrow Keys = Navigasi sel ke segala arah",
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
      description: "Bagikan perkembangan murid ke orang tua/wali",
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
  const normalizedGuideQuery = guideQuery.trim().toLocaleLowerCase("id-ID");
  const filteredGuides = normalizedGuideQuery
    ? allGuides.filter((guide) =>
        [guide.title, guide.description, ...guide.steps]
          .join(" ")
          .toLocaleLowerCase("id-ID")
          .includes(normalizedGuideQuery),
      )
    : allGuides;

  return (
    <>
      <div className="app-page app-page-readable">
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
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 sm:h-14 sm:w-14">
            <PanduanIcon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
          </div>
        </div>

        {/* Quick Start Card */}
        <Card className="animate-fade-in-up delay-100 border border-border shadow-sm">
          <CardHeader className="pb-2 sm:pb-4">
            <h2 className="flex items-center gap-2 text-sm sm:text-base font-semibold text-foreground">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-grade-pass" />
              Mulai Cepat
            </h2>
            <CardDescription className="text-xs">
              Ikuti 4 langkah sederhana untuk memulai menggunakan SIPENA
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4 sm:pb-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                { step: 1, text: "Buat Kelas", link: "/classes" },
                { step: 2, text: "Tambah Murid", link: "/classes" },
                { step: 3, text: "Atur Mapel", link: "/subjects" },
                { step: 4, text: "Input Nilai", link: "/grades" },
              ].map((item) => (
                <Button
                  key={item.step}
                  variant="outline"
                  className="h-auto py-3 sm:py-4 flex flex-col gap-1.5 sm:gap-2 text-foreground hover:border-primary hover:bg-primary/10 hover:text-foreground focus-visible:text-foreground text-xs sm:text-sm"
                  onClick={() => navigate(item.link)}
                >
                  <span className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs sm:text-sm font-bold">
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
            <h2 className="flex items-center gap-2 text-sm sm:text-base font-semibold text-foreground">
              <Keyboard className="w-4 h-4 sm:w-5 sm:h-5 " />
              Shortcut Cepat
            </h2>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Gunakan <strong>Ctrl</strong> di Windows/Linux atau <strong>Cmd</strong> di macOS. Shortcut navigasi tidak aktif saat Anda sedang mengetik di form.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ...NAVIGATION_SHORTCUTS.map((shortcut) => ({
                  keys: `Ctrl/Cmd + Shift + ${shortcut.key}`,
                  label: shortcut.label,
                })),
                ...UTILITY_SHORTCUTS,
              ].map((shortcut) => (
                <div key={shortcut.keys} className="flex min-h-11 items-center gap-2 rounded-md border border-border/70 bg-muted/30 p-2.5">
                  <Badge variant="outline" className="shrink-0 px-1.5 py-0.5 font-mono text-[10px] sm:text-xs">
                    {shortcut.keys}
                  </Badge>
                  <span className="min-w-0 text-xs text-muted-foreground">{shortcut.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accordion Guides */}
        <Card className="animate-fade-in-up delay-200 border border-border shadow-sm">
          <CardHeader className="pb-2 sm:pb-4">
            <h2 className="text-sm sm:text-base font-semibold text-foreground">Panduan Lengkap</h2>
            <CardDescription className="text-xs">
              Cari topik, lalu buka bagian yang ingin dipelajari.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={guideQuery}
                onChange={(event) => setGuideQuery(event.target.value)}
                placeholder="Cari panduan kelas, nilai, presensi, ekspor..."
                className="h-11 pl-10"
                aria-label="Cari topik panduan"
              />
            </div>
            <Accordion type="single" collapsible className="w-full">
              {filteredGuides.map((guide) => (
                <AccordionItem key={guide.id} value={guide.id}>
                  <AccordionTrigger className="hover:no-underline group py-3 sm:py-4">
                    <div className="flex items-center gap-2 sm:gap-3 text-left min-w-0">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors flex-shrink-0">
                        <guide.icon className="w-4 h-4 sm:w-5 sm:h-5 " />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-xs sm:text-sm truncate">{guide.title}</p>
                        <p className="text-xs text-muted-foreground font-normal truncate">
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
                              <span className="text-xs text-muted-foreground pl-4">{step.trim()}</span>
                            ) : (
                              <>
                                <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 text-xs font-medium flex items-center justify-center mt-0.5">
                                  {index + 1}
                                </span>
                                <span className="text-xs text-muted-foreground">{step}</span>
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
            {filteredGuides.length === 0 && (
              <div className="py-10 text-center">
                <HelpCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium text-foreground">Topik belum ditemukan</p>
                <p className="mt-1 text-xs text-muted-foreground">Coba kata yang lebih umum, misalnya kelas, nilai, atau presensi.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contact Support */}
        <Card className="animate-fade-in-up delay-300 border border-border shadow-sm">
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 sm:py-6">
            <div className="text-center sm:text-left min-w-0">
              <h2 className="font-semibold text-foreground text-sm sm:text-base">Butuh Bantuan Lebih?</h2>
              <p className="text-xs text-muted-foreground truncate">
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
