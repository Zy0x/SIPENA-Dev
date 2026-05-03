import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeSelectionDialogProps {
  isOpen: boolean;
  onSelect: (mode: "light" | "dark") => Promise<void>;
}

export function ThemeSelectionDialog({ isOpen, onSelect }: ThemeSelectionDialogProps) {
  const [selectedMode, setSelectedMode] = useState<"light" | "dark">("light");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    await onSelect(selectedMode);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl">Selamat Datang di SIPENA!</DialogTitle>
          <DialogDescription className="text-center">
            Pilih tampilan yang nyaman untuk Anda. Pengaturan ini dapat diubah kapan saja di menu Pengaturan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* Light Mode Option */}
          <button
            type="button"
            onClick={() => setSelectedMode("light")}
            className={cn(
              "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
              selectedMode === "light"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                selectedMode === "light"
                  ? "bg-amber-100 text-amber-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Sun className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Mode Terang</p>
              <p className="text-xs text-muted-foreground">Nyaman untuk siang hari</p>
            </div>
            {selectedMode === "light" && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>

          {/* Dark Mode Option */}
          <button
            type="button"
            onClick={() => setSelectedMode("dark")}
            className={cn(
              "relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200",
              selectedMode === "dark"
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <div
              className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                selectedMode === "dark"
                  ? "bg-slate-800 text-blue-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Moon className="w-7 h-7" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm">Mode Gelap</p>
              <p className="text-xs text-muted-foreground">Nyaman untuk malam hari</p>
            </div>
            {selectedMode === "dark" && (
              <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm} disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Lanjutkan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
