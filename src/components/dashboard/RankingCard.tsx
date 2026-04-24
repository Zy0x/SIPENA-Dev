import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trophy, Medal, Award, TrendingUp, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StudentRanking {
  id: string;
  name: string;
  nisn?: string;
  average: number;
  className?: string;
  subjectCount?: number;
}

interface RankingCardProps {
  title: string;
  description?: string;
  students: StudentRanking[];
  kkm?: number;
  limit?: number;
  showSubjectCount?: boolean;
  showClass?: boolean;
  compact?: boolean;
  className?: string;
}

export function RankingCard({
  title,
  description,
  students,
  kkm = 75,
  limit = 10,
  showSubjectCount = false,
  showClass = false,
  compact = false,
  className,
}: RankingCardProps) {
  const sortedStudents = useMemo(() => {
    return [...students]
      .sort((a, b) => b.average - a.average)
      .slice(0, limit);
  }, [students, limit]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-500" />;
      case 2:
        return <Medal className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-gray-400" />;
      case 3:
        return <Award className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= kkm + 10) return "text-grade-pass";
    if (score >= kkm) return "text-grade-warning";
    return "text-grade-fail";
  };

  if (sortedStudents.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className={cn("pb-2", compact && "p-3 sm:p-4")}>
          <CardTitle className={cn("flex items-center gap-2", compact ? "text-xs sm:text-sm" : "text-sm sm:text-base")}>
            <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            {title}
          </CardTitle>
          {description && <CardDescription className="text-[10px] sm:text-xs">{description}</CardDescription>}
        </CardHeader>
        <CardContent className={compact ? "p-3 pt-0 sm:p-4 sm:pt-0" : ""}>
          <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
            <User className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs text-center">Belum ada data peringkat</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className={cn("pb-2", compact && "p-3 sm:p-4")}>
        <CardTitle className={cn("flex items-center gap-2", compact ? "text-xs sm:text-sm" : "text-sm sm:text-base")}>
          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          {title}
        </CardTitle>
        {description && <CardDescription className="text-[10px] sm:text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className={compact ? "p-3 pt-0 sm:p-4 sm:pt-0" : "pt-0"}>
        <ScrollArea className={compact ? "h-[180px] sm:h-[220px]" : "h-[260px] sm:h-[300px]"}>
          <div className="space-y-0.5 sm:space-y-1">
            {sortedStudents.map((student, index) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                className={cn(
                  "flex items-center gap-2 p-1.5 sm:p-2 rounded-md hover:bg-muted/50 transition-colors",
                  index < 3 && "bg-gradient-to-r from-primary/5 to-transparent"
                )}
              >
                {/* Rank */}
                <div className={cn(
                  "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[9px] sm:text-[10px]",
                  index === 0 && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
                  index === 1 && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                  index === 2 && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                  index > 2 && "bg-muted text-muted-foreground"
                )}>
                  {getRankIcon(index + 1) || (index + 1)}
                </div>

                {/* Student Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium truncate">{student.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {student.nisn && (
                      <span className="text-[8px] sm:text-[9px] text-muted-foreground">{student.nisn}</span>
                    )}
                    {showClass && student.className && (
                      <Badge variant="outline" className="text-[7px] sm:text-[8px] px-1 py-0 h-3">
                        {student.className}
                      </Badge>
                    )}
                    {showSubjectCount && student.subjectCount && (
                      <Badge variant="outline" className="text-[7px] sm:text-[8px] px-1 py-0 h-3">
                        {student.subjectCount} mapel
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="flex-shrink-0 text-right">
                  <span className={cn(
                    "font-bold text-[11px] sm:text-xs",
                    getScoreColor(student.average)
                  )}>
                    {student.average.toFixed(1)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}