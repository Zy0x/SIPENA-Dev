import { Link } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  BarChart3,
  Trophy,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  Star,
  Download,
  Users,
} from "lucide-react";

const reportCards = [
  {
    title: "Laporan Nilai",
    description: "Lihat dan ekspor laporan nilai detail per kelas dan mata pelajaran",
    icon: FileSpreadsheet,
    href: "/reports/grades",
    color: "from-primary to-primary/80",
    features: ["Nilai per BAB", "STS & SAS", "Nilai Rapor", "Ekspor PDF/Excel"],
  },
  {
    title: "Ranking Siswa",
    description: "Peringkat siswa per mata pelajaran dan ranking keseluruhan",
    icon: Trophy,
    href: "/reports/rankings",
    color: "from-amber-500 to-orange-500",
    features: ["Top Siswa per Mapel", "Ranking Keseluruhan", "Visualisasi Carousel", "Ekspor Ranking"],
  },
  {
    title: "Portal Orang Tua",
    description: "Buat dan bagikan laporan perkembangan siswa ke orang tua/wali",
    icon: Users,
    href: "/reports/portal",
    color: "from-emerald-500 to-teal-500",
    features: ["Share Link & QR Code", "Kustomisasi Data", "Nilai & Presensi", "Ranking Kelas"],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Reports() {

  return (
    <>
      <div className="p-3 sm:p-4 lg:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <PageHeader
          icon={<BarChart3 className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />}
          title="Laporan"
          subtitle="Pilih jenis laporan yang ingin Anda lihat"
          breadcrumbs={[{ label: "Laporan" }]}
        />

        {/* Report Cards Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6"
        >
          {reportCards.map((report) => (
            <motion.div key={report.href} variants={itemVariants}>
              <Link to={report.href} className="block group">
                <Card className="h-full overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-xl shadow-sm">
                  {/* Color Bar */}
                  <div className={`h-2 bg-gradient-to-r ${report.color}`} />
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${report.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <report.icon className="w-6 h-6 text-white" />
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                    <CardTitle className="text-xl mt-4 group-hover:text-primary transition-colors">
                      {report.title}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {report.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent>
                    {/* Features */}
                    <div className="flex flex-wrap gap-2">
                      {report.features.map((feature) => (
                        <span
                          key={feature}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground"
                        >
                          <Star className="w-3 h-3" />
                          {feature}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <Button
                      variant="ghost"
                      className="mt-4 w-full justify-between group-hover:bg-primary/10 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" />
                        Buka Laporan
                      </span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick Info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-muted/50 border border-border shadow-sm">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-foreground text-sm">Ekspor Mudah</h3>
                <p className="text-xs text-muted-foreground">
                  Semua laporan dapat diekspor ke format PDF atau Excel untuk keperluan dokumentasi dan pelaporan resmi.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
}
