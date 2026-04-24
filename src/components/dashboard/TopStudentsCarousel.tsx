import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, Medal, Award, TrendingUp, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useClasses } from "@/hooks/useClasses";
import { useStudentRankings } from "@/hooks/useStudentRankings";

interface TopStudentsCarouselProps {
  kkm?: number;
  limit?: number;
  rotationInterval?: number;
}

export function TopStudentsCarousel({
  kkm = 75,
  limit = 10,
  rotationInterval = 8000,
}: TopStudentsCarouselProps) {
  const { classes, isLoading: classesLoading } = useClasses();
  const [currentClassIndex, setCurrentClassIndex] = useState(0);

  // Rotate through classes
  useEffect(() => {
    if (classes.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentClassIndex((prev) => (prev + 1) % classes.length);
    }, rotationInterval);

    return () => clearInterval(interval);
  }, [classes.length, rotationInterval]);

  const currentClass = classes[currentClassIndex];
  const { overallRankings, isLoading: rankingsLoading } = useStudentRankings({
    classId: currentClass?.id,
  });
  const rankings = overallRankings.slice(0, limit);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-grade-warning" />;
      case 2:
        return <Medal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-muted-foreground" />;
      case 3:
        return <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    const classKkm = currentClass?.class_kkm ?? kkm;
    if (score >= classKkm + 10) return "text-grade-pass";
    if (score >= classKkm) return "text-grade-warning";
    return "text-grade-fail";
  };

  if (classesLoading) {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-4 pb-2">
          <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            Top 10 Siswa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (classes.length === 0) {
    return (
      <Card>
        <CardHeader className="p-3 sm:p-4 pb-2">
          <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            Top 10 Siswa
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <Users className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs text-center">Belum ada kelas</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-3 sm:p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs sm:text-sm flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            Top 10 Siswa
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[9px] sm:text-[10px] gap-1">
              <Zap className="w-2.5 h-2.5" />
              Realtime
            </Badge>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentClass?.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
              >
                <Badge variant="outline" className="text-[9px] sm:text-[10px]">
                  {currentClass?.name}
                </Badge>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        {classes.length > 1 && (
          <div className="flex gap-1 mt-2">
            {classes.map((cls, idx) => (
              <button
                key={cls.id}
                onClick={() => setCurrentClassIndex(idx)}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-300",
                  idx === currentClassIndex
                    ? "bg-primary w-4"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentClass?.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {rankingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : rankings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                <Users className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs text-center">Belum ada data nilai</p>
              </div>
            ) : (
              <ScrollArea className="h-[240px] sm:h-[280px]">
                <div className="space-y-0.5 sm:space-y-1">
                  {rankings.map((student, index) => (
                    <motion.div
                      key={student.student.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className={cn(
                        "flex items-center gap-2 p-1.5 sm:p-2 rounded-md hover:bg-muted/50 transition-colors",
                        index < 3 && "bg-gradient-to-r from-primary/5 to-transparent"
                      )}
                    >
                      {/* Rank */}
                      <div
                        className={cn(
                          "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[9px] sm:text-[10px]",
                          index === 0 && "bg-grade-warning/20 text-grade-warning",
                          index === 1 && "bg-muted text-muted-foreground",
                          index === 2 && "bg-accent/20 text-accent",
                          index > 2 && "bg-muted text-muted-foreground"
                        )}
                      >
                        {getRankIcon(index + 1) || index + 1}
                      </div>

                      {/* Student Info */}
                      <Tooltip delayDuration={200}>
                        <TooltipTrigger asChild>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] sm:text-xs font-medium truncate">
                              {student.student.name}
                            </p>
                            {student.student.nisn && (
                              <span className="text-[8px] sm:text-[9px] text-muted-foreground">
                                {student.student.nisn}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[200px]">
                          <p className="font-medium">{student.student.name}</p>
                          {student.student.nisn && <p className="text-muted-foreground text-[10px]">NISN: {student.student.nisn}</p>}
                          <p className="text-[10px]">Rata-rata: {student.overallAverage.toFixed(1)} ({student.gradedSubjectCount} mapel)</p>
                        </TooltipContent>
                      </Tooltip>

                      {/* Score */}
                      <div className="flex-shrink-0 text-right pl-1">
                        <span
                          className={cn(
                            "font-bold text-[11px] sm:text-xs whitespace-nowrap",
                            getScoreColor(student.overallAverage)
                          )}
                        >
                          {student.overallAverage.toFixed(1)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
