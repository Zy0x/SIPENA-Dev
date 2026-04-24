import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  Sparkles, 
  Bug, 
  Zap, 
  Shield, 
  Clock,
  Tag,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { APP_VERSION } from "@/config/version";
import { changelogData, type ChangelogEntry } from "@/data/changelog";

// Current version - imported from config
export const CURRENT_VERSION = APP_VERSION;

export default function Changelog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedIds, setExpandedIds] = useState<string[]>([changelogData[0]?.id || ""]);
  const latestEntryRef = useRef<HTMLDivElement>(null);

  // Scroll to latest entry on mount or when navigating with hash
  useEffect(() => {
    const hash = location.hash;
    if (hash === "#latest" && latestEntryRef.current) {
      setTimeout(() => {
        latestEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [location.hash]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "feature":
        return <Sparkles className="w-4 h-4" />;
      case "bugfix":
        return <Bug className="w-4 h-4" />;
      case "improvement":
        return <Zap className="w-4 h-4" />;
      case "security":
        return <Shield className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: string, isCritical: boolean) => {
    const variants: Record<string, string> = {
      feature: "bg-primary/10 text-primary border-primary/20",
      bugfix: "bg-destructive/10 text-destructive border-destructive/20",
      improvement: "bg-grade-pass/10 text-grade-pass border-grade-pass/20",
      security: "bg-grade-warning/10 text-grade-warning border-grade-warning/20",
    };

    const labels: Record<string, string> = {
      feature: "Fitur Baru",
      bugfix: "Perbaikan Bug",
      improvement: "Peningkatan",
      security: "Keamanan",
    };

    return (
      <div className="flex items-center gap-2">
        <Badge className={`gap-1 ${variants[type] || ""}`}>
          {getTypeIcon(type)}
          {labels[type] || type}
        </Badge>
        {isCritical && (
          <Badge variant="destructive" className="gap-1">
            Critical
          </Badge>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Changelog</h1>
            <p className="text-sm text-muted-foreground">
              Riwayat pembaruan SIPENA • Versi saat ini: <span className="font-mono font-semibold text-primary">v{CURRENT_VERSION}</span>
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {changelogData.map((entry, index) => (
            <motion.div
              key={entry.id}
              ref={index === 0 ? latestEntryRef : undefined}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={`overflow-hidden transition-all duration-300 ${
                  entry.is_critical ? "border-primary/50 shadow-lg shadow-primary/10" : ""
                }`}
              >
                <CardHeader
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpand(entry.id)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant="outline" className="font-mono">
                          v{entry.version}
                        </Badge>
                        {getTypeBadge(entry.type, entry.is_critical)}
                      </div>
                      <CardTitle className="text-lg">{entry.title}</CardTitle>
                      <CardDescription>{entry.description}</CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {format(new Date(entry.released_at), "d MMM yyyy", { locale: id })}
                      </div>
                      {expandedIds.includes(entry.id) ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                <AnimatePresence>
                  {expandedIds.includes(entry.id) && entry.details && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Separator />
                      <CardContent className="pt-4">
                        <ul className="space-y-2">
                          {entry.details.map((detail, idx) => (
                            <motion.li
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className="flex items-start gap-2 text-sm text-muted-foreground"
                            >
                              <span className="text-primary mt-1.5">•</span>
                              <span>{detail}</span>
                            </motion.li>
                          ))}
                        </ul>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
