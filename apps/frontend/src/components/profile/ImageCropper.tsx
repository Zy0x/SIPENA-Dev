import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Check, 
  X,
  Move
} from "lucide-react";

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const CROP_SIZE = 256;

  // Load and draw image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
      
      // Calculate initial scale to fit image
      const minDimension = Math.min(img.width, img.height);
      const initialScale = CROP_SIZE / minDimension * 1.2;
      setScale(initialScale);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imageRef.current;
    
    if (!canvas || !ctx || !img) return;

    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    
    // Create circular clip
    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw image with transformations
    ctx.save();
    ctx.translate(CROP_SIZE / 2, CROP_SIZE / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-CROP_SIZE / 2 + position.x, -CROP_SIZE / 2 + position.y);
    
    const drawWidth = img.width;
    const drawHeight = img.height;
    const offsetX = (CROP_SIZE - drawWidth) / 2;
    const offsetY = (CROP_SIZE - drawHeight) / 2;
    
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    ctx.restore();
  }, [scale, rotation, position]);

  useEffect(() => {
    if (imageLoaded) {
      drawCanvas();
    }
  }, [imageLoaded, drawCanvas]);

  // Mouse/Touch handlers
  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    handleDragStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete(blob);
      }
    }, "image/jpeg", 0.9);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  return (
    <div className="space-y-4">
      {/* Preview Container */}
      <div 
        ref={containerRef}
        className="relative mx-auto bg-muted/50 rounded-2xl overflow-hidden touch-none select-none"
        style={{ width: CROP_SIZE + 32, height: CROP_SIZE + 32 }}
      >
        {/* Crop overlay guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div 
            className="border-2 border-dashed border-white/50 rounded-full"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
          />
        </div>

        {/* Canvas */}
        <div 
          className="absolute inset-4 cursor-move"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleDragEnd}
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full rounded-full shadow-lg"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
          />
        </div>

        {/* Drag indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-full">
          <Move className="w-3 h-3" />
          <span>Geser untuk mengatur posisi</span>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4 px-2">
        {/* Zoom */}
        <div className="flex items-center gap-3">
          <ZoomOut className="w-4 h-4 text-muted-foreground" />
          <Slider
            value={[scale]}
            onValueChange={([val]) => setScale(val)}
            min={0.5}
            max={3}
            step={0.1}
            className="flex-1"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground" />
        </div>

        {/* Rotate */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRotate}
            className="gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Putar 90°
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-2">
        <Button 
          variant="outline" 
          className="flex-1" 
          onClick={onCancel}
        >
          <X className="w-4 h-4 mr-2" />
          Batal
        </Button>
        <Button 
          className="flex-1" 
          onClick={handleCrop}
        >
          <Check className="w-4 h-4 mr-2" />
          Terapkan
        </Button>
      </div>
    </div>
  );
}
