import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ArrowLeft, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface EmptyStudentsStateProps {
  isGuestMode?: boolean;
  onBack?: () => void;
  className?: string;
  classId?: string;
}

export function EmptyStudentsState({ 
  isGuestMode = false, 
  onBack, 
  className = "",
  classId 
}: EmptyStudentsStateProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (isGuestMode) {
      navigate("/", { replace: true });
    } else if (classId) {
      navigate(`/classes`);
    } else {
      navigate(-1);
    }
  };

  return (
    <Card className={`animate-fade-in ${className}`}>
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-muted-foreground" />
        </div>
        <CardTitle className="text-lg">Belum Ada Siswa</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground text-sm">
          {isGuestMode
            ? "Kelas ini belum memiliki data siswa. Hubungi wali kelas untuk menambahkan siswa."
            : "Tambahkan siswa ke kelas ini untuk mulai menginput nilai."}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            {isGuestMode ? "Kembali ke Beranda" : "Kembali"}
          </Button>
          {!isGuestMode && classId && (
            <Button onClick={() => navigate(`/classes`)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Tambah Siswa
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
