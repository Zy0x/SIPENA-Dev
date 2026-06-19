import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minus, Plus, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  clampOcrImageZoom,
  getOcrImageDistance,
  getOcrImageDoubleTapZoom,
  getOcrImageMidpoint,
  type ViewerPoint,
} from "@/lib/ocrImport/imageViewerMath";

interface OcrImageViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl?: string;
  imageName?: string;
  page?: number;
}

interface PinchState {
  distance: number;
  zoom: number;
  midpoint: ViewerPoint;
  pan: ViewerPoint;
}

export default function OcrImageViewerDialog({
  open,
  onOpenChange,
  imageUrl,
  imageName = "Foto sumber OCR",
  page = 1,
}: OcrImageViewerDialogProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<ViewerPoint>({ x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, ViewerPoint>());
  const pinchRef = useRef<PinchState | null>(null);
  const panPointerRef = useRef<{ id: number; point: ViewerPoint; moved: boolean } | null>(null);
  const lastTouchTapRef = useRef(0);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    pointersRef.current.clear();
    pinchRef.current = null;
    panPointerRef.current = null;
  }, []);

  useEffect(() => {
    if (open) resetView();
  }, [imageUrl, open, page, resetView]);

  const applyZoom = useCallback((nextZoom: number) => {
    const safeZoom = clampOcrImageZoom(nextZoom);
    setZoom(safeZoom);
    if (safeZoom <= 1) setPan({ x: 0, y: 0 });
  }, []);

  const toggleDoubleTapZoom = useCallback(() => {
    const nextZoom = getOcrImageDoubleTapZoom(zoom);
    applyZoom(nextZoom);
  }, [applyZoom, zoom]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 1) {
      panPointerRef.current = { id: event.pointerId, point, moved: false };
      pinchRef.current = null;
      return;
    }

    if (pointersRef.current.size === 2) {
      const [first, second] = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: Math.max(1, getOcrImageDistance(first, second)),
        zoom,
        midpoint: getOcrImageMidpoint(first, second),
        pan,
      };
      panPointerRef.current = null;
    }
  }, [pan, zoom]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const previous = pointersRef.current.get(event.pointerId)!;
    const point = { x: event.clientX, y: event.clientY };
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size === 2 && pinchRef.current) {
      event.preventDefault();
      const [first, second] = [...pointersRef.current.values()];
      const currentDistance = Math.max(1, getOcrImageDistance(first, second));
      const currentMidpoint = getOcrImageMidpoint(first, second);
      const nextZoom = clampOcrImageZoom(pinchRef.current.zoom * (currentDistance / pinchRef.current.distance));
      setZoom(nextZoom);
      setPan(nextZoom <= 1
        ? { x: 0, y: 0 }
        : {
            x: pinchRef.current.pan.x + currentMidpoint.x - pinchRef.current.midpoint.x,
            y: pinchRef.current.pan.y + currentMidpoint.y - pinchRef.current.midpoint.y,
          });
      return;
    }

    if (zoom > 1 && panPointerRef.current?.id === event.pointerId) {
      event.preventDefault();
      const deltaX = point.x - previous.x;
      const deltaY = point.y - previous.y;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) panPointerRef.current.moved = true;
      setPan((current) => ({ x: current.x + deltaX, y: current.y + deltaY }));
    }
  }, [zoom]);

  const releasePointer = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const wasSingleTap = pointersRef.current.size === 1
      && panPointerRef.current?.id === event.pointerId
      && !panPointerRef.current.moved;
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    panPointerRef.current = null;

    if (event.pointerType === "touch" && wasSingleTap) {
      const now = Date.now();
      if (now - lastTouchTapRef.current < 320) {
        lastTouchTapRef.current = 0;
        toggleDoubleTapZoom();
      } else {
        lastTouchTapRef.current = now;
      }
    }
  }, [toggleDoubleTapZoom]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      applyZoom(zoom + 0.25);
    } else if (event.key === "-") {
      event.preventDefault();
      applyZoom(zoom - 0.25);
    } else if (event.key === "0") {
      event.preventDefault();
      resetView();
    }
  }, [applyZoom, resetView, zoom]);

  if (!imageUrl) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[calc(100dvh-0.5rem)] w-[calc(100vw-0.5rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-white/15 bg-black/95 p-0 text-white sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:rounded-2xl"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-4 py-3 pr-14 text-left">
          <DialogTitle className="truncate text-sm text-white">Halaman {page}: {imageName}</DialogTitle>
          <DialogDescription className="text-[11px] text-white/60">Cubit atau gunakan tombol untuk memperbesar. Geser gambar saat zoom aktif.</DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center justify-center gap-2 border-b border-white/10 bg-black/60 p-2">
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-white hover:bg-white/10 hover:text-white" onClick={() => applyZoom(zoom - 0.25)} aria-label="Perkecil gambar"><Minus className="h-4 w-4" /></Button>
          <span className="w-14 text-center text-xs tabular-nums text-white/80">{Math.round(zoom * 100)}%</span>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-white hover:bg-white/10 hover:text-white" onClick={() => applyZoom(zoom + 0.25)} aria-label="Perbesar gambar"><Plus className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-white hover:bg-white/10 hover:text-white" onClick={resetView} aria-label="Kembalikan ukuran gambar"><RotateCcw className="h-4 w-4" /></Button>
          <Button type="button" variant="ghost" size="icon" className="h-11 w-11 text-white hover:bg-white/10 hover:text-white" onClick={toggleDoubleTapZoom} aria-label="Alihkan zoom cepat"><Maximize2 className="h-4 w-4" /></Button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
          tabIndex={0}
          role="application"
          aria-label={`Viewer foto OCR halaman ${page}`}
          onDoubleClick={toggleDoubleTapZoom}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releasePointer}
          onPointerCancel={releasePointer}
        >
          <img
            src={imageUrl}
            alt={`Foto sumber OCR halaman ${page}`}
            draggable={false}
            className="block max-h-full max-w-full object-contain will-change-transform"
            style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})` }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
