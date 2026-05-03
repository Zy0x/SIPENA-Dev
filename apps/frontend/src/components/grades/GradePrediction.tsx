import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle,
  AlertCircle, Sparkles, RefreshCw,
} from "lucide-react";
import { supabaseExternal as supabase, EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { useEnhancedToast } from "@/contexts/ToastContext";

interface PredictionResult {
  predicted_final: number;
  trend: "naik" | "stabil" | "turun";
  risk_level: "rendah" | "sedang" | "tinggi";
  summary: string;
  recommendation: string;
}

interface GradePredictionProps {
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  kkm: number;
  modelId?: string;
}

export function GradePrediction({
  studentId, studentName, subjectId, subjectName, kkm,
  modelId = "llama-3.3-70b-versatile",
}: GradePredictionProps) {
  const { toast } = useEnhancedToast();
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        setError("Silakan login terlebih dahulu untuk menggunakan prediksi AI.");
        return;
      }

      const response = await fetch(`${EDGE_FUNCTIONS_URL}/predict-grades`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
          apikey: SUPABASE_EXTERNAL_ANON_KEY,
        },
        body: JSON.stringify({
          studentId,
          subjectId,
          modelId,
          user_id: userId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (data.error) { setError(data.error); return; }
      if (data.message) { setError(data.message); return; }

      setPrediction(data.prediction);
    } catch (err: any) {
      console.error("Prediction error:", err);
      setError(err.message || "Gagal mengambil prediksi. Coba lagi nanti.");
      toast({ title: "Error", description: err.message || "Gagal mengambil prediksi nilai", variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "naik": return <TrendingUp className="w-4 h-4 text-grade-pass" />;
      case "turun": return <TrendingDown className="w-4 h-4 text-grade-fail" />;
      default: return <Minus className="w-4 h-4 text-grade-warning" />;
    }
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "rendah": return <Badge variant="pass" className="gap-1"><CheckCircle className="w-3 h-3" />Risiko Rendah</Badge>;
      case "tinggi": return <Badge variant="fail" className="gap-1"><AlertTriangle className="w-3 h-3" />Risiko Tinggi</Badge>;
      default: return <Badge variant="warning" className="gap-1"><AlertCircle className="w-3 h-3" />Risiko Sedang</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score < kkm) return "text-grade-fail";
    if (score <= kkm + 5) return "text-grade-warning";
    return "text-grade-pass";
  };

  if (!prediction && !isLoading && !error) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Brain className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Prediksi AI</h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-xs">
            Analisis tren dan prediksi nilai akhir {studentName} untuk {subjectName}
          </p>
          <Button onClick={fetchPrediction} className="gap-2">
            <Sparkles className="w-4 h-4" /> Generate Prediksi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary animate-pulse" />
            <CardTitle className="text-base">Menganalisis...</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-grade-warning/50">
        <CardContent className="flex flex-col items-center justify-center py-6">
          <AlertCircle className="w-8 h-8 text-grade-warning mb-2" />
          <p className="text-sm text-muted-foreground text-center mb-4">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchPrediction} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Coba Lagi
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  const progressValue = Math.min(100, Math.max(0, (prediction.predicted_final / 100) * 100));

  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Prediksi AI</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchPrediction} className="h-8 w-8">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <CardDescription>{studentName} - {subjectName}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Prediksi Nilai Rapor</p>
          <p className={`text-4xl font-bold ${getScoreColor(prediction.predicted_final)}`}>
            {prediction.predicted_final}
          </p>
          <Progress value={progressValue} className="mt-3 h-2" />
          <p className="text-xs text-muted-foreground mt-2">KKM: {kkm}</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {getTrendIcon(prediction.trend)}
            <span className="text-sm capitalize">Tren {prediction.trend}</span>
          </div>
          {getRiskBadge(prediction.risk_level)}
        </div>
        <div className="p-3 bg-muted/30 rounded-lg">
          <p className="text-sm text-foreground">{prediction.summary}</p>
        </div>
        <div className="p-3 border border-primary/20 bg-primary/5 rounded-lg">
          <p className="text-xs font-medium text-primary mb-1">💡 Rekomendasi</p>
          <p className="text-sm text-foreground">{prediction.recommendation}</p>
        </div>
      </CardContent>
    </Card>
  );
}
