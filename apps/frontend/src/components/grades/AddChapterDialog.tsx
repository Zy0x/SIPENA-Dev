import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Plus, Trash2, ListPlus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddChapterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (names: string[]) => void;
  subjectName: string;
}

export function AddChapterDialog({
  open,
  onOpenChange,
  onConfirm,
  subjectName,
}: AddChapterDialogProps) {
  const [mode, setMode] = useState<"list" | "bulk">("list");
  const [chapterNames, setChapterNames] = useState<string[]>([""]);
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setChapterNames([""]);
      setBulkText("");
      setError("");
      setMode("list");
    }
  }, [open]);

  const handleAddRow = () => {
    setChapterNames([...chapterNames, ""]);
  };

  const handleRemoveRow = (index: number) => {
    if (chapterNames.length > 1) {
      const newNames = [...chapterNames];
      newNames.splice(index, 1);
      setChapterNames(newNames);
    } else {
      setChapterNames([""]);
    }
  };

  const handleNameChange = (index: number, value: string) => {
    const newNames = [...chapterNames];
    newNames[index] = value;
    setChapterNames(newNames);
    setError("");
  };

  const handleConfirm = () => {
    let names: string[] = [];
    
    if (mode === "list") {
      names = chapterNames.filter(name => name.trim() !== "");
    } else {
      names = bulkText.split("\n").map(name => name.trim()).filter(name => name !== "");
    }

    if (names.length === 0) {
      setError("Masukkan setidaknya satu nama BAB");
      return;
    }

    onConfirm(names);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const totalCount = mode === "list" 
    ? chapterNames.filter(n => n.trim() !== "").length 
    : bulkText.split("\n").map(n => n.trim()).filter(n => n !== "").length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <AlertDialogHeader className="shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <AlertDialogTitle className="text-base sm:text-lg">Tambah BAB</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs sm:text-sm">
            Tambahkan BAB untuk <strong className="text-foreground">{subjectName}</strong>.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "list" | "bulk")} className="flex-1 flex flex-col min-h-0 pt-2">
          <TabsList className="grid w-full grid-cols-2 shrink-0">
            <TabsTrigger value="list" className="gap-1.5 text-xs sm:text-sm">
              <ListPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Satu per satu
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-1.5 text-xs sm:text-sm">
              <Type className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Sekaligus
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="flex-1 flex flex-col min-h-0 mt-3 space-y-3">
            <ScrollArea className="flex-1 max-h-[40vh] pr-3">
              <div className="space-y-2">
                {chapterNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-1.5 sm:gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={name}
                        onChange={(e) => handleNameChange(index, e.target.value)}
                        placeholder={`BAB ${index + 1}`}
                        className="text-sm h-9 sm:h-10"
                        autoFocus={index === chapterNames.length - 1 && index > 0}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(index)}
                      className="text-muted-foreground hover:text-destructive h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                      disabled={chapterNames.length === 1 && name === ""}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              className="w-full border-dashed gap-2 shrink-0 text-xs sm:text-sm"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Tambah Baris
            </Button>
          </TabsContent>

          <TabsContent value="bulk" className="flex-1 flex flex-col min-h-0 mt-3 space-y-2">
            <Label htmlFor="bulkText" className="text-xs sm:text-sm shrink-0">Daftar Nama BAB</Label>
            <Textarea
              id="bulkText"
              placeholder={"BAB 1\nBAB 2 : Geometri\nBAB 3 : Statistika"}
              className="flex-1 min-h-[120px] max-h-[40vh] font-mono text-xs sm:text-sm resize-none"
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setError("");
              }}
            />
            <p className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
              Setiap baris = satu BAB baru.
            </p>
          </TabsContent>
        </Tabs>

        {error && (
          <p className="text-xs sm:text-sm text-destructive shrink-0" role="alert">
            {error}
          </p>
        )}

        <AlertDialogFooter className="shrink-0 pt-2 gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleCancel} className="text-xs sm:text-sm h-9 sm:h-10">Batal</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm} 
            className="gap-1.5 text-xs sm:text-sm h-9 sm:h-10"
            disabled={totalCount === 0}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Tambah {totalCount > 0 ? totalCount : ""} BAB
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
