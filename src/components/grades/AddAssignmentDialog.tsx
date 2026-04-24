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
import { FileText, Plus, Trash2, ListPlus, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface AddAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (names: string[]) => void;
  chapterName: string;
}

export function AddAssignmentDialog({
  open,
  onOpenChange,
  onConfirm,
  chapterName,
}: AddAssignmentDialogProps) {
  const [mode, setMode] = useState<"list" | "bulk">("list");
  const [assignmentNames, setAssignmentNames] = useState<string[]>([""]);
  const [bulkText, setBulkText] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAssignmentNames([""]);
      setBulkText("");
      setError("");
      setMode("list");
    }
  }, [open]);

  const handleAddRow = () => {
    setAssignmentNames([...assignmentNames, ""]);
  };

  const handleRemoveRow = (index: number) => {
    if (assignmentNames.length > 1) {
      const newNames = [...assignmentNames];
      newNames.splice(index, 1);
      setAssignmentNames(newNames);
    } else {
      setAssignmentNames([""]);
    }
  };

  const handleNameChange = (index: number, value: string) => {
    const newNames = [...assignmentNames];
    newNames[index] = value;
    setAssignmentNames(newNames);
    setError("");
  };

  const handleConfirm = () => {
    let names: string[] = [];
    
    if (mode === "list") {
      names = assignmentNames.filter(name => name.trim() !== "");
    } else {
      names = bulkText.split("\n").map(name => name.trim()).filter(name => name !== "");
    }

    if (names.length === 0) {
      setError("Masukkan setidaknya satu nama tugas");
      return;
    }

    onConfirm(names);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const totalCount = mode === "list" 
    ? assignmentNames.filter(n => n.trim() !== "").length 
    : bulkText.split("\n").map(n => n.trim()).filter(n => n !== "").length;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden">
        <AlertDialogHeader className="shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            </div>
            <AlertDialogTitle className="text-base sm:text-lg">Tambah Tugas</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs sm:text-sm">
            Tambahkan tugas untuk <strong className="text-foreground">{chapterName}</strong>.
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
                {assignmentNames.map((name, index) => (
                  <div key={index} className="flex items-center gap-1.5 sm:gap-2">
                    <div className="flex-1 min-w-0">
                      <Input
                        value={name}
                        onChange={(e) => handleNameChange(index, e.target.value)}
                        placeholder={`Tugas ${index + 1}`}
                        className="text-sm h-9 sm:h-10"
                        autoFocus={index === assignmentNames.length - 1 && index > 0}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(index)}
                      className="text-muted-foreground hover:text-destructive h-9 w-9 sm:h-10 sm:w-10 shrink-0"
                      disabled={assignmentNames.length === 1 && name === ""}
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
            <Label htmlFor="bulkText" className="text-xs sm:text-sm shrink-0">Daftar Nama Tugas</Label>
            <Textarea
              id="bulkText"
              placeholder={"Tugas 1\nTugas 2\nUlangan Harian"}
              className="flex-1 min-h-[120px] max-h-[40vh] font-mono text-xs sm:text-sm resize-none"
              value={bulkText}
              onChange={(e) => {
                setBulkText(e.target.value);
                setError("");
              }}
            />
            <p className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
              Setiap baris = satu tugas baru.
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
            Tambah {totalCount > 0 ? totalCount : ""} Tugas
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
