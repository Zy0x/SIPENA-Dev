import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Eye, FileSpreadsheet, Info, School, ShieldCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildGuestSessionPayload,
  type GuestAccessClass,
  type GuestAccessSubject,
} from "@/hooks/useGuestAccesses";

interface GuestClassCardProps {
  access: GuestAccessClass;
  onTouchAccess?: (sharedLinkId: string) => void;
}

function ownerLabel(access: GuestAccessClass) {
  return access.ownerName || access.ownerEmail || "Guru pemilik";
}

export default function GuestClassCard({ access, onTouchAccess }: GuestClassCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [detailOpen, setDetailOpen] = useState(false);
  const [subjectsOpen, setSubjectsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const activeSubjects = useMemo(
    () => access.subjects.filter((subject) => subject.isActive),
    [access.subjects],
  );

  const openGuestGrades = (subject: GuestAccessSubject) => {
    const sessionPayload = buildGuestSessionPayload({
      userId: user?.id,
      userName: user?.user_metadata?.full_name || user?.email,
      userEmail: user?.email,
      access,
      subject,
    });
    sessionStorage.setItem("guest_session", JSON.stringify(sessionPayload));
    onTouchAccess?.(subject.sharedLinkId);
    navigate(`/guest/grades?token=${encodeURIComponent(subject.token)}`);
  };

  const handleNilai = () => {
    if (activeSubjects.length === 1) {
      openGuestGrades(activeSubjects[0]);
      return;
    }
    setPickerOpen(true);
  };

  return (
    <>
      <Card className="group overflow-hidden border border-sky-300/60 bg-sky-50/50 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-sky-400/30 dark:bg-sky-950/20">
        <CardContent className="flex h-full flex-col gap-2.5 p-3">
          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 ring-1 ring-sky-500/20 sm:h-11 sm:w-11">
              <ShieldCheck className="h-5 w-5 text-sky-600 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-base font-bold leading-snug text-foreground sm:text-lg">
                  {access.name}
                </h3>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge
                  className="bg-sky-600 text-white hover:bg-sky-600"
                  title="Data tetap milik guru pemilik. Anda hanya bisa mengakses mapel yang dibagikan."
                >
                  Guru Tamu
                </Badge>
                <span className="truncate text-[11px] text-muted-foreground">
                  Dibagikan oleh {ownerLabel(access)}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full border border-sky-200/80 bg-background/80 text-sky-700 shadow-sm"
              aria-label="Informasi akses guru tamu"
              title="Data tetap milik guru pemilik. Anda hanya bisa mengakses mapel yang dibagikan."
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1 px-1.5 sm:px-2">
            <div className="flex items-center gap-2 text-foreground">
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs font-semibold sm:text-sm">
                {access.studentCount} murid
              </span>
            </div>
            <div className="flex items-center gap-2 text-foreground">
              <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="text-xs font-semibold sm:text-sm">
                {activeSubjects.length} mapel dibagikan
              </span>
            </div>
            {access.description && (
              <p className="line-clamp-2 break-words text-justify text-xs leading-5 text-muted-foreground sm:text-sm">
                {access.description}
              </p>
            )}
          </div>

          <div className="mt-auto grid grid-cols-3 gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full gap-0.5 px-1 text-[10px] sm:h-9 sm:gap-1 sm:px-2 sm:text-xs"
              onClick={() => setDetailOpen(true)}
            >
              <Eye className="h-3 w-3 shrink-0" />
              <span className="truncate">Detail</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-full gap-0.5 px-1 text-[10px] sm:h-9 sm:gap-1 sm:px-2 sm:text-xs"
              onClick={() => setSubjectsOpen(true)}
            >
              <BookOpen className="h-3 w-3 shrink-0" />
              <span className="truncate">Mapel</span>
            </Button>
            <Button
              size="sm"
              className="h-8 w-full gap-0.5 px-1 text-[10px] sm:h-9 sm:gap-1 sm:px-2 sm:text-xs"
              disabled={activeSubjects.length === 0}
              onClick={handleNilai}
            >
              <FileSpreadsheet className="h-3 w-3 shrink-0" />
              <span className="truncate">Nilai</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <School className="h-5 w-5 text-sky-600" />
              Detail Akses Guru Tamu
            </DialogTitle>
            <DialogDescription>
              Shortcut ini hanya membuka mapel yang dibagikan. Data kelas, murid, dan nilai tetap milik guru pemilik.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border/70 p-3">
              <p className="font-semibold text-foreground">{access.name}</p>
              <p className="mt-1 text-muted-foreground">Dibagikan oleh {ownerLabel(access)}</p>
              <p className="mt-1 text-muted-foreground">{access.studentCount} murid</p>
            </div>
            <div className="rounded-xl border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-400/30 dark:bg-sky-950/20">
              <p className="font-semibold text-foreground">Mapel yang bisa diakses</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeSubjects.map((subject) => (
                  <Badge key={subject.sharedLinkId} variant="secondary">
                    {subject.name} (KKM {subject.kkm})
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subjectsOpen} onOpenChange={setSubjectsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Mapel Guru Tamu</DialogTitle>
            <DialogDescription>
              Pilih mapel yang dibagikan untuk membuka Input Nilai mode guru tamu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {activeSubjects.map((subject) => (
              <div key={subject.sharedLinkId} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{subject.name}</p>
                  <p className="text-xs text-muted-foreground">KKM {subject.kkm}</p>
                </div>
                <Button size="sm" onClick={() => openGuestGrades(subject)}>
                  Buka Nilai
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pilih Mapel</DialogTitle>
            <DialogDescription>
              Kelas ini memiliki beberapa mapel yang dibagikan. Pilih mapel yang ingin diisi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {activeSubjects.map((subject) => (
              <Button
                key={subject.sharedLinkId}
                variant="outline"
                className="h-auto justify-start gap-3 rounded-xl p-3 text-left"
                onClick={() => openGuestGrades(subject)}
              >
                <BookOpen className="h-4 w-4 shrink-0 text-sky-600" />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{subject.name}</span>
                  <span className="block text-xs text-muted-foreground">KKM {subject.kkm}</span>
                </span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
