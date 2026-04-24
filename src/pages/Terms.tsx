import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Shield, FileText, Users, Database, AlertTriangle, Scale } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const sections = [
  {
    icon: Shield,
    title: "1. Penerimaan Ketentuan",
    content: `Dengan mengakses dan menggunakan SIPENA (Sistem Informasi Penilaian Akademik), Anda menyetujui untuk terikat dengan Syarat dan Ketentuan ini. Jika Anda tidak menyetujui ketentuan ini, mohon untuk tidak menggunakan layanan kami.`,
  },
  {
    icon: Users,
    title: "2. Definisi Pengguna",
    content: `SIPENA diperuntukkan bagi tenaga pendidik (guru) yang memerlukan sistem manajemen penilaian akademik. Setiap pengguna bertanggung jawab atas akun, data, dan aktivitasnya di dalam platform.`,
  },
  {
    icon: FileText,
    title: "3. Penggunaan Layanan",
    items: [
      "Pengguna wajib menggunakan layanan sesuai peraturan perundang-undangan yang berlaku.",
      "Dilarang menyalahgunakan layanan untuk tujuan yang melanggar hukum, menyebarkan konten berbahaya, atau mengganggu sistem.",
      "Pengguna bertanggung jawab atas keakuratan data yang dimasukkan ke dalam sistem.",
      "Setiap akun bersifat personal dan tidak boleh dipindahtangankan ke pihak lain.",
      "Pengguna dilarang melakukan reverse engineering, decompiling, atau upaya lain untuk mengakses kode sumber SIPENA.",
    ],
  },
  {
    icon: Database,
    title: "4. Privasi & Perlindungan Data",
    items: [
      "Data pengguna disimpan secara terenkripsi dan dilindungi dengan standar keamanan tinggi.",
      "Kami tidak menjual, menyewakan, atau membagikan data pribadi pengguna kepada pihak ketiga tanpa persetujuan.",
      "Data siswa yang diinput guru merupakan tanggung jawab guru bersangkutan dan dilindungi oleh kebijakan privasi platform.",
      "Pengguna berhak mengajukan penghapusan akun dan seluruh data terkait kapan saja.",
      "Log aktivitas disimpan untuk tujuan keamanan dan audit sistem.",
    ],
  },
  {
    icon: Scale,
    title: "5. Hak Kekayaan Intelektual",
    content: `Seluruh konten, desain, kode program, logo, dan elemen visual SIPENA merupakan hak kekayaan intelektual yang dilindungi. Pengguna tidak diperkenankan menyalin, memodifikasi, atau mendistribusikan bagian manapun dari platform tanpa izin tertulis.`,
  },
  {
    icon: AlertTriangle,
    title: "6. Batasan Tanggung Jawab",
    items: [
      "SIPENA disediakan dalam kondisi \"sebagaimana adanya\" (as-is) tanpa jaminan atas ketersediaan layanan 100%.",
      "Kami tidak bertanggung jawab atas kerugian yang timbul dari penggunaan atau ketidakmampuan menggunakan layanan.",
      "Gangguan teknis, pemeliharaan terjadwal, atau force majeure dapat memengaruhi ketersediaan layanan.",
      "Pengguna disarankan untuk melakukan backup data secara berkala.",
    ],
  },
  {
    icon: Shield,
    title: "7. Keamanan Akun",
    items: [
      "Pengguna wajib menjaga kerahasiaan password dan informasi login.",
      "Segera laporkan jika terjadi akses tidak sah ke akun Anda.",
      "Kami berhak menangguhkan akun yang terindikasi melakukan pelanggaran keamanan.",
      "Sesi login akan otomatis berakhir setelah 12 jam untuk keamanan.",
    ],
  },
  {
    icon: FileText,
    title: "8. Perubahan Ketentuan",
    content: `Kami berhak mengubah Syarat dan Ketentuan ini sewaktu-waktu. Perubahan akan diinformasikan melalui platform. Penggunaan berkelanjutan setelah perubahan dianggap sebagai persetujuan atas ketentuan yang baru.`,
  },
];

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link to="/auth">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-foreground">Syarat & Ketentuan</h1>
            <p className="text-xs text-muted-foreground">SIPENA — Sistem Informasi Penilaian Akademik</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-muted-foreground"
        >
          Terakhir diperbarui: 27 Februari 2026
        </motion.p>

        {sections.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="border border-border shadow-sm">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <section.icon className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground pt-1">{section.title}</h2>
                </div>
                {section.content && (
                  <p className="text-sm text-muted-foreground leading-relaxed pl-11">{section.content}</p>
                )}
                {section.items && (
                  <ul className="space-y-1.5 pl-11">
                    {section.items.map((item, j) => (
                      <li key={j} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center py-6"
        >
          <p className="text-xs text-muted-foreground">
            Jika Anda memiliki pertanyaan mengenai Syarat & Ketentuan ini, silakan hubungi administrator SIPENA.
          </p>
          <Link to="/auth">
            <Button variant="outline" size="sm" className="mt-3 rounded-xl">
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Kembali ke Login
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
