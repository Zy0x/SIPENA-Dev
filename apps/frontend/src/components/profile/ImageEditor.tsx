import { useState, useRef, useEffect, useCallback } from "react";
import {
  Stage as StageRaw,
  Layer as LayerRaw,
  Image as KonvaImageRaw,
  Circle as CircleRaw,
  Text as TextRaw,
} from "react-konva";
import Konva from "konva";

// react-konva ships KonvaNodeComponent typings that don't satisfy React 18.3
// JSXElementConstructor in strict TS — alias as any-typed function components
// to keep usage clean while suppressing the type-only mismatch.
const Stage = StageRaw as unknown as React.FC<any>;
const Layer = LayerRaw as unknown as React.FC<any>;
const KonvaImage = KonvaImageRaw as unknown as React.FC<any>;
const Circle = CircleRaw as unknown as React.FC<any>;
const Text = TextRaw as unknown as React.FC<any>;
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Sun,
  Contrast,
  Image as ImageIcon,
  Type,
  Undo2,
  Redo2,
  Save,
  X,
  Move,
  Circle as CircleIcon,
  Square,
  Star,
  Heart,
  Loader2,
  Palette,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageEditorProps {
  imageSrc: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (blob: Blob) => void;
}

interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  fontFamily: string;
}

interface ShapeElement {
  id: string;
  type: "circle" | "square" | "star" | "heart";
  x: number;
  y: number;
  size: number;
  fill: string;
}

interface HistoryState {
  rotation: number;
  scale: number;
  position: { x: number; y: number };
  brightness: number;
  contrast: number;
  saturation: number;
  texts: TextElement[];
  shapes: ShapeElement[];
}

const CROP_SIZE = 256;
const CANVAS_SIZE = 320;

const filters = [
  { id: "normal", name: "Normal", filters: { brightness: 0, contrast: 0, saturation: 0 } },
  { id: "bright", name: "Terang", filters: { brightness: 0.2, contrast: 0, saturation: 0 } },
  { id: "contrast", name: "Kontras", filters: { brightness: 0, contrast: 0.3, saturation: 0 } },
  { id: "grayscale", name: "B&W", filters: { brightness: 0, contrast: 0.1, saturation: -1 } },
  { id: "sepia", name: "Sepia", filters: { brightness: 0.05, contrast: 0.1, saturation: -0.5 } },
  { id: "vintage", name: "Vintage", filters: { brightness: -0.1, contrast: 0.2, saturation: -0.3 } },
];

const fonts = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];
const colors = ["#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"];

export function ImageEditor({ imageSrc, isOpen, onClose, onSave }: ImageEditorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const imageRef = useRef<Konva.Image>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Editor state
  const [rotation, setRotation] = useState(0);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);

  // Force update trigger
  const [forceUpdate, setForceUpdate] = useState(0);

  // Elements
  const [texts, setTexts] = useState<TextElement[]>([]);
  const [shapes, setShapes] = useState<ShapeElement[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState("adjust");
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [newTextInput, setNewTextInput] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textFont, setTextFont] = useState("Arial");
  const [textSize, setTextSize] = useState(24);
  const [shapeColor, setShapeColor] = useState("#FF0000");

  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Touch state
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);

  // Load image
  useEffect(() => {
    if (!imageSrc) return;
    setIsLoading(true);

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImage(img);
      
      // Calculate initial scale to fit
      const minDim = Math.min(img.width, img.height);
      const initialScale = (CROP_SIZE * 1.2) / minDim;
      setScale(initialScale);
      
      setIsLoading(false);
      
      // Save initial state
      setTimeout(() => saveToHistory(), 100);
    };
    img.onerror = () => {
      setIsLoading(false);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Apply filters to image node in real-time
  useEffect(() => {
    if (!imageRef.current) return;

    const imageNode = imageRef.current;
    
    // Set filter values
    imageNode.brightness(brightness);
    imageNode.contrast(contrast);
    imageNode.saturation(saturation);
    
    // Force cache clear and re-render
    imageNode.cache();
    imageNode.getLayer()?.batchDraw();
    
  }, [brightness, contrast, saturation, forceUpdate]);

  // Update canvas when state changes
  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.getLayer()?.batchDraw();
    }
  }, [rotation, scale, position]);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    const state: HistoryState = {
      rotation,
      scale,
      position,
      brightness,
      contrast,
      saturation,
      texts: [...texts],
      shapes: [...shapes],
    };

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      return [...newHistory, state];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [rotation, scale, position, brightness, contrast, saturation, texts, shapes, historyIndex]);

  // Undo
  const handleUndo = () => {
    if (historyIndex <= 0) return;
    
    const prevState = history[historyIndex - 1];
    applyState(prevState);
    setHistoryIndex((prev) => prev - 1);
  };

  // Redo
  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    
    const nextState = history[historyIndex + 1];
    applyState(nextState);
    setHistoryIndex((prev) => prev + 1);
  };

  // Apply state
  const applyState = (state: HistoryState) => {
    setRotation(state.rotation);
    setScale(state.scale);
    setPosition(state.position);
    setBrightness(state.brightness);
    setContrast(state.contrast);
    setSaturation(state.saturation);
    setTexts(state.texts);
    setShapes(state.shapes);
    setForceUpdate(prev => prev + 1);
  };

  // Rotate 90 degrees
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    setTimeout(() => saveToHistory(), 100);
  };

  // Apply filter preset with immediate visual feedback
  const applyFilter = (filter: typeof filters[0]) => {
    setBrightness(filter.filters.brightness);
    setContrast(filter.filters.contrast);
    setSaturation(filter.filters.saturation);
    setForceUpdate(prev => prev + 1);
    setTimeout(() => saveToHistory(), 100);
  };

  // Handle slider changes with immediate feedback
  const handleBrightnessChange = (value: number[]) => {
    setBrightness(value[0]);
    setForceUpdate(prev => prev + 1);
  };

  const handleContrastChange = (value: number[]) => {
    setContrast(value[0]);
    setForceUpdate(prev => prev + 1);
  };

  const handleSaturationChange = (value: number[]) => {
    setSaturation(value[0]);
    setForceUpdate(prev => prev + 1);
  };

  // Save history when slider interaction ends
  const handleSliderCommit = () => {
    setTimeout(() => saveToHistory(), 100);
  };

  // Add text
  const handleAddText = () => {
    if (!newTextInput.trim()) return;

    const newText: TextElement = {
      id: `text-${Date.now()}`,
      text: newTextInput,
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      fontSize: textSize,
      fill: textColor,
      fontFamily: textFont,
    };

    setTexts((prev) => [...prev, newText]);
    setNewTextInput("");
    setTimeout(() => saveToHistory(), 100);
  };

  // Add shape
  const handleAddShape = (type: ShapeElement["type"]) => {
    const newShape: ShapeElement = {
      id: `shape-${Date.now()}`,
      type,
      x: CANVAS_SIZE / 2,
      y: CANVAS_SIZE / 2,
      size: 30,
      fill: shapeColor,
    };

    setShapes((prev) => [...prev, newShape]);
    setTimeout(() => saveToHistory(), 100);
  };

  // Handle stage touch
  const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length === 2) {
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      setLastTouchDistance(distance);
    }
    setIsDragging(true);
  };

  const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length === 2) {
      // Pinch to zoom
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      
      if (lastTouchDistance > 0) {
        const scaleDelta = (distance - lastTouchDistance) * 0.01;
        setScale((prev) => Math.max(0.5, Math.min(3, prev + scaleDelta)));
      }
      
      setLastTouchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(0);
    setTimeout(() => saveToHistory(), 100);
  };

  // Handle wheel zoom
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? scale * scaleBy : scale / scaleBy;
    setScale(Math.max(0.5, Math.min(3, newScale)));
  };

  // Save image
  const handleSave = async () => {
    if (!stageRef.current) return;
    setIsSaving(true);

    try {
      // Create a temporary canvas for the final circular crop
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = CROP_SIZE;
      exportCanvas.height = CROP_SIZE;
      const ctx = exportCanvas.getContext("2d");
      
      if (!ctx) {
        setIsSaving(false);
        return;
      }

      // Create circular clip
      ctx.beginPath();
      ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
      ctx.clip();

      // Get stage data
      const stageCanvas = stageRef.current.toCanvas({
        pixelRatio: 2,
        x: (CANVAS_SIZE - CROP_SIZE) / 2,
        y: (CANVAS_SIZE - CROP_SIZE) / 2,
        width: CROP_SIZE,
        height: CROP_SIZE,
      });

      // Draw to export canvas
      ctx.drawImage(stageCanvas, 0, 0, CROP_SIZE, CROP_SIZE);

      // Convert to blob
      exportCanvas.toBlob(
        (blob) => {
          if (blob) {
            onSave(blob);
          }
          setIsSaving(false);
        },
        "image/png",
        0.95
      );
    } catch (error) {
      console.error("Error saving image:", error);
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[95vh] p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Edit Foto Profil
          </DialogTitle>
        </DialogHeader>

        {/* Main Content */}
        <div className="flex flex-col h-full">
          {/* Canvas Area */}
          <div className="relative flex items-center justify-center p-4 bg-muted/50">
            {isLoading ? (
              <div className="w-[320px] h-[320px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="relative">
                {/* Circular overlay guide */}
                <div 
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                  style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
                >
                  <div 
                    className="border-2 border-dashed border-white/50 rounded-full shadow-inner"
                    style={{ width: CROP_SIZE, height: CROP_SIZE }}
                  />
                </div>

                {/* Konva Stage */}
                <Stage
                  ref={stageRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  onWheel={handleWheel}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="rounded-xl overflow-hidden bg-black"
                >
                  <Layer ref={layerRef}>
                    {image && (
                      <KonvaImage
                        ref={imageRef}
                        image={image}
                        x={CANVAS_SIZE / 2 + position.x}
                        y={CANVAS_SIZE / 2 + position.y}
                        offsetX={image.width / 2}
                        offsetY={image.height / 2}
                        scaleX={scale}
                        scaleY={scale}
                        rotation={rotation}
                        draggable
                        onDragEnd={(e) => {
                          setPosition({
                            x: e.target.x() - CANVAS_SIZE / 2,
                            y: e.target.y() - CANVAS_SIZE / 2,
                          });
                          setTimeout(() => saveToHistory(), 100);
                        }}
                        filters={[
                          Konva.Filters.Brighten,
                          Konva.Filters.Contrast,
                          Konva.Filters.HSL,
                        ]}
                        brightness={brightness}
                        contrast={contrast}
                        saturation={saturation}
                      />
                    )}

                    {/* Render shapes */}
                    {shapes.map((shape) => (
                      <Circle
                        key={shape.id}
                        x={shape.x}
                        y={shape.y}
                        radius={shape.size}
                        fill={shape.fill}
                        draggable
                        onDragEnd={(e) => {
                          setShapes((prev) =>
                            prev.map((s) =>
                              s.id === shape.id
                                ? { ...s, x: e.target.x(), y: e.target.y() }
                                : s
                            )
                          );
                          setTimeout(() => saveToHistory(), 100);
                        }}
                      />
                    ))}

                    {/* Render texts */}
                    {texts.map((text) => (
                      <Text
                        key={text.id}
                        x={text.x}
                        y={text.y}
                        text={text.text}
                        fontSize={text.fontSize}
                        fill={text.fill}
                        fontFamily={text.fontFamily}
                        draggable
                        onClick={() => setSelectedTextId(text.id)}
                        onDragEnd={(e) => {
                          setTexts((prev) =>
                            prev.map((t) =>
                              t.id === text.id
                                ? { ...t, x: e.target.x(), y: e.target.y() }
                                : t
                            )
                          );
                          setTimeout(() => saveToHistory(), 100);
                        }}
                      />
                    ))}
                  </Layer>
                </Stage>

                {/* Instructions */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs text-white/80 bg-black/50 px-2 py-1 rounded-full">
                  <Move className="w-3 h-3" />
                  <span>Geser • Pinch zoom</span>
                </div>
              </div>
            )}
          </div>

          {/* Toolbar */}
          <div className="p-4 space-y-4 overflow-hidden">
            {/* Undo/Redo */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  <X className="w-4 h-4 mr-2" />
                  Batal
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Simpan
                </Button>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="adjust" className="gap-1 text-xs">
                  <Sun className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Adjust</span>
                </TabsTrigger>
                <TabsTrigger value="filters" className="gap-1 text-xs">
                  <Palette className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Filter</span>
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-1 text-xs">
                  <Type className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Teks</span>
                </TabsTrigger>
                <TabsTrigger value="shapes" className="gap-1 text-xs">
                  <CircleIcon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bentuk</span>
                </TabsTrigger>
              </TabsList>

              {/* Adjust Tab */}
              <TabsContent value="adjust" className="space-y-4 mt-4">
                {/* Rotate */}
                <Button variant="outline" size="sm" onClick={handleRotate} className="gap-2">
                  <RotateCw className="w-4 h-4" />
                  Putar 90°
                </Button>

                {/* Zoom */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <ZoomIn className="w-3.5 h-3.5" />
                    Zoom: {Math.round(scale * 100)}%
                  </Label>
                  <div className="flex items-center gap-2">
                    <ZoomOut className="w-4 h-4 text-muted-foreground" />
                    <Slider
                      value={[scale]}
                      onValueChange={([val]) => setScale(val)}
                      onValueCommit={handleSliderCommit}
                      min={0.5}
                      max={3}
                      step={0.1}
                      className="flex-1"
                    />
                    <ZoomIn className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                {/* Brightness */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <Sun className="w-3.5 h-3.5" />
                    Kecerahan: {Math.round(brightness * 100)}%
                  </Label>
                  <Slider
                    value={[brightness]}
                    onValueChange={handleBrightnessChange}
                    onValueCommit={handleSliderCommit}
                    min={-0.5}
                    max={0.5}
                    step={0.05}
                  />
                </div>

                {/* Contrast */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <Contrast className="w-3.5 h-3.5" />
                    Kontras: {Math.round(contrast * 100)}%
                  </Label>
                  <Slider
                    value={[contrast]}
                    onValueChange={handleContrastChange}
                    onValueCommit={handleSliderCommit}
                    min={-0.5}
                    max={0.5}
                    step={0.05}
                  />
                </div>

                {/* Saturation (hidden slider, controlled by filters) */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5" />
                    Saturasi: {Math.round(saturation * 100)}%
                  </Label>
                  <Slider
                    value={[saturation]}
                    onValueChange={handleSaturationChange}
                    onValueCommit={handleSliderCommit}
                    min={-1}
                    max={1}
                    step={0.1}
                  />
                </div>
              </TabsContent>

              {/* Filters Tab */}
              <TabsContent value="filters" className="mt-4">
                <ScrollArea className="w-full">
                  <div className="flex gap-2 pb-2">
                    {filters.map((filter) => {
                      const isActive = 
                        Math.abs(brightness - filter.filters.brightness) < 0.01 &&
                        Math.abs(contrast - filter.filters.contrast) < 0.01 &&
                        Math.abs(saturation - filter.filters.saturation) < 0.01;

                      return (
                        <button
                          key={filter.id}
                          onClick={() => applyFilter(filter)}
                          className={cn(
                            "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all min-w-[70px]",
                            isActive
                              ? "border-primary bg-primary/10 ring-2 ring-primary"
                              : "border-transparent hover:border-muted-foreground/30"
                          )}
                        >
                          <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                            {image && (
                              <img
                                src={imageSrc}
                                alt={filter.name}
                                className="w-full h-full object-cover"
                                style={{
                                  filter: `brightness(${1 + filter.filters.brightness}) contrast(${1 + filter.filters.contrast}) saturate(${1 + filter.filters.saturation})`,
                                }}
                              />
                            )}
                          </div>
                          <span className="text-xs font-medium">{filter.name}</span>
                        </button>
                      );
                    })}
                  </div>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </TabsContent>

              {/* Text Tab */}
              <TabsContent value="text" className="space-y-3 mt-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Ketik teks..."
                    value={newTextInput}
                    onChange={(e) => setNewTextInput(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleAddText} disabled={!newTextInput.trim()}>
                    Tambah
                  </Button>
                </div>

                {/* Color picker */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Warna:</Label>
                  <div className="flex gap-1">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setTextColor(color)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all",
                          textColor === color ? "border-primary scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Font size */}
                <div className="space-y-1">
                  <Label className="text-xs">Ukuran: {textSize}px</Label>
                  <Slider
                    value={[textSize]}
                    onValueChange={([val]) => setTextSize(val)}
                    min={12}
                    max={48}
                    step={2}
                  />
                </div>
              </TabsContent>

              {/* Shapes Tab */}
              <TabsContent value="shapes" className="space-y-3 mt-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleAddShape("circle")}>
                    <CircleIcon className="w-5 h-5" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleAddShape("square")}>
                    <Square className="w-5 h-5" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleAddShape("star")}>
                    <Star className="w-5 h-5" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleAddShape("heart")}>
                    <Heart className="w-5 h-5" />
                  </Button>
                </div>

                {/* Color picker */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Warna:</Label>
                  <div className="flex gap-1">
                    {colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setShapeColor(color)}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all",
                          shapeColor === color ? "border-primary scale-110" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
