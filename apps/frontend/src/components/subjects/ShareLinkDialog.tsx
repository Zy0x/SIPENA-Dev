import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useSharedLinks, SharedLink } from "@/hooks/useSharedLinks";
import {
  Link2,
  Copy,
  Check,
  XCircle,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Shield,
  Clock,
  ExternalLink,
  BookOpen,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
  classId,
  className,
}: ShareLinkDialogProps) {
  const { toast } = useEnhancedToast();
  const {
    createSharedLink,
    revokeSharedLink,
    reactivateSharedLink,
    deleteSharedLink,
    getSharedLinkForSubject,
  } = useSharedLinks();

  const [copied, setCopied] = useState(false);
  const [showConfirmRevoke, setShowConfirmRevoke] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const existingLink = getSharedLinkForSubject(subjectId, classId);
  const isExpired = existingLink
    ? new Date(existingLink.expired_at) < new Date()
    : false;
  const isActive = existingLink && !existingLink.revoked && !isExpired;

  const shareUrl = existingLink
    ? `${window.location.origin}/share?token=${existingLink.token}`
    : "";

  const handleCreateLink = async () => {
    try {
      await createSharedLink.mutateAsync({
        subject_id: subjectId,
        class_id: classId,
      });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast({
        title: "Link Disalin",
        description: "Link berhasil disalin ke clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Gagal Menyalin",
        description: "Tidak dapat menyalin link",
        variant: "error",
      });
    }
  };

  const handleRevoke = async () => {
    if (!existingLink) return;
    await revokeSharedLink.mutateAsync(existingLink.id);
    setShowConfirmRevoke(false);
  };

  const handleReactivate = async () => {
    if (!existingLink) return;
    await reactivateSharedLink.mutateAsync(existingLink.id);
  };

  const handleDelete = async () => {
    if (!existingLink) return;
    await deleteSharedLink.mutateAsync(existingLink.id);
    setShowConfirmDelete(false);
    onOpenChange(false);
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Bagikan Akses Input Nilai
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Buat link akses untuk guru tamu agar dapat menginput nilai pada mata pelajaran dan kelas tertentu.
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="gap-1">
                    <BookOpen className="w-3 h-3" />
                    {subjectName}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Users className="w-3 h-3" />
                    {className}
                  </Badge>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            {/* Privacy Notice */}
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Keamanan Link</p>
                <p className="text-muted-foreground">
                  Link ini hanya memberikan akses input nilai untuk mata
                  pelajaran ini saja. Data siswa lain tidak dapat diakses.
                </p>
              </div>
            </div>

            {/* No Link Yet */}
            {!existingLink && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Link2 className="w-8 h-8 text-primary" />
                </div>
                <p className="text-muted-foreground mb-4">
                  Belum ada link yang dibuat untuk mapel ini
                </p>
                <Button
                  onClick={handleCreateLink}
                  disabled={createSharedLink.isPending}
                >
                  {createSharedLink.isPending ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4 mr-2" />
                  )}
                  Buat Link Akses
                </Button>
              </div>
            )}

            {/* Link Exists */}
            {existingLink && (
              <div className="space-y-4">
                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  {isActive ? (
                    <Badge variant="pass" className="gap-1">
                      <Check className="w-3 h-3" />
                      Aktif
                    </Badge>
                  ) : existingLink.revoked ? (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="w-3 h-3" />
                      Dicabut
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1">
                      <Clock className="w-3 h-3" />
                      Kadaluarsa
                    </Badge>
                  )}
                </div>

                {/* Link URL */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Link Akses</label>
                  <div className="flex gap-2">
                    <Input
                      value={shareUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                      disabled={!isActive}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-grade-pass" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expiry Info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {isExpired ? "Kadaluarsa pada" : "Berlaku hingga"}{" "}
                    {format(new Date(existingLink.expired_at), "dd MMMM yyyy", {
                      locale: localeId,
                    })}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {isActive && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(shareUrl, "_blank")}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        Buka Link
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowConfirmRevoke(true)}
                        className="text-destructive hover:text-destructive"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Cabut Akses
                      </Button>
                    </>
                  )}

                  {(existingLink.revoked || isExpired) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleReactivate}
                      disabled={reactivateSharedLink.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Aktifkan Kembali
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowConfirmDelete(true)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Hapus Link
                  </Button>
                </div>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Tutup</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Revoke Dialog */}
      <AlertDialog open={showConfirmRevoke} onOpenChange={setShowConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Cabut Akses?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Guru tamu tidak akan dapat mengakses input nilai setelah link
              dicabut. Anda dapat mengaktifkan kembali link ini kapan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-destructive hover:bg-destructive/90"
            >
              Cabut Akses
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Hapus Link Permanen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Link akan dihapus secara permanen. Jika Anda ingin membagikan
              akses lagi, Anda perlu membuat link baru.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus Permanen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
