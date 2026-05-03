import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ZoomIn, ZoomOut, RotateCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    url: string;
    name: string;
    type: string; // mime type or extension
  } | null;
}

export function FilePreviewDialog({ open, onOpenChange, file }: FilePreviewDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  if (!file) return null;

  const isImage = file.type.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name);
  const isPdf = file.type === "application/pdf" || file.name.endsWith(".pdf");
  const isOffice = /\.(docx?|xlsx?|pptx?)$/i.test(file.name);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.name;
    a.target = "_blank";
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0 overflow-hidden bg-black/95">
        {/* Toolbar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/80 to-transparent">
          <span className="text-xs text-white/80 truncate max-w-[50%]">{file.name}</span>
          <div className="flex items-center gap-1">
            {isImage && (
              <>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10" onClick={handleZoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-[10px] text-white/60 w-10 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10" onClick={handleZoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10" onClick={handleRotate}>
                  <RotateCw className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10" onClick={handleDownload}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex items-center justify-center w-full h-full overflow-auto p-8 pt-14">
          {isImage && (
            <img
              src={file.url}
              alt={file.name}
              className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
                cursor: zoom > 1 ? "grab" : "default",
              }}
              draggable={false}
            />
          )}

          {isPdf && (
            <iframe
              src={file.url}
              title={file.name}
              className="w-full h-full border-0 rounded-lg bg-white"
              style={{ minHeight: "70vh" }}
            />
          )}

          {isOffice && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-sm text-white font-medium mb-1">{file.name}</p>
                <p className="text-xs text-white/60 mb-4">
                  Preview dokumen Office tidak tersedia di browser.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" variant="secondary" onClick={handleDownload} className="gap-1.5 text-xs">
                    <Download className="w-3.5 h-3.5" /> Unduh File
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => window.open(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file.url)}`, "_blank")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka di Office Online
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!isImage && !isPdf && !isOffice && (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-white/80">{file.name}</p>
              <p className="text-xs text-white/50">Tipe file ini belum didukung untuk preview.</p>
              <Button size="sm" variant="secondary" onClick={handleDownload} className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Unduh File
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
