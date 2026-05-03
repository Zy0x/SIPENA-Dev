import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Loader2, 
  UserPlus, 
  Upload, 
  AlertTriangle, 
  Users, 
  X, 
  CheckCircle2, 
  XCircle, 
  Edit3,
  Trash2,
  RefreshCw,
  ArrowRight,
  Info,
} from "lucide-react";
import { useStudents } from "@/hooks/useStudents";
import { useEnhancedToast } from "@/contexts/ToastContext";

interface AddStudentDialogProps {
  classId: string;
  className: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DuplicateInfo {
  type: 'name' | 'nisn' | 'both' | 'similar';
  existingStudent: { name: string; nisn: string };
  similarity?: number;
}

interface BatchDuplicateItem {
  inputName: string;
  inputNisn: string;
  duplicateType: 'name' | 'nisn' | 'both' | 'similar';
  existingStudent: { name: string; nisn: string };
  similarity?: number;
  selected: boolean;
  editedName?: string;
  editedNisn?: string;
  isEditing?: boolean;
}

// Normalize string for comparison
const normalizeString = (str: string): string => {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '');
};

// Calculate similarity between two strings (Levenshtein-based)
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9;
  }
  
  // Simple word overlap check
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w));
  const overlap = commonWords.length / Math.max(words1.length, words2.length);
  
  if (overlap >= 0.6) return overlap;
  
  // Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLen;
};

export default function AddStudentDialog({
  classId,
  className,
  open,
  onOpenChange,
}: AddStudentDialogProps) {
  const [name, setName] = useState("");
  const [nisn, setNisn] = useState("");
  const [batchData, setBatchData] = useState("");
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [pendingStudent, setPendingStudent] = useState<{ name: string; nisn: string } | null>(null);
  
  // Batch duplicates state
  const [showBatchDuplicateDialog, setShowBatchDuplicateDialog] = useState(false);
  const [batchDuplicates, setBatchDuplicates] = useState<BatchDuplicateItem[]>([]);
  const [pendingBatchStudents, setPendingBatchStudents] = useState<{ class_id: string; name: string; nisn: string }[]>([]);
  
  // Real-time validation state for single student
  const [nameWarning, setNameWarning] = useState<string | null>(null);
  const [nisnWarning, setNisnWarning] = useState<string | null>(null);
  
  const { students, createStudent, createStudentsBatch } = useStudents(classId);
  const { toast } = useEnhancedToast();

  // Real-time validation for single student form
  useEffect(() => {
    if (name.trim().length >= 3) {
      const duplicate = students.find(s => normalizeString(s.name) === normalizeString(name));
      if (duplicate) {
        setNameWarning(`Nama "${duplicate.name}" sudah terdaftar`);
      } else {
        const similar = students.find(s => calculateSimilarity(name, s.name) >= 0.75);
        if (similar) {
          setNameWarning(`Mirip dengan "${similar.name}" (${Math.round(calculateSimilarity(name, similar.name) * 100)}%)`);
        } else {
          setNameWarning(null);
        }
      }
    } else {
      setNameWarning(null);
    }
  }, [name, students]);

  useEffect(() => {
    if (nisn.trim().length >= 5) {
      const duplicate = students.find(s => s.nisn.trim() === nisn.trim());
      if (duplicate) {
        setNisnWarning(`NISN sudah digunakan oleh "${duplicate.name}"`);
      } else {
        setNisnWarning(null);
      }
    } else {
      setNisnWarning(null);
    }
  }, [nisn, students]);

  // Check for duplicates
  const checkDuplicate = useCallback((inputName: string, inputNisn: string): DuplicateInfo | null => {
    const normalizedInputName = normalizeString(inputName);
    const normalizedInputNisn = inputNisn.trim();
    
    for (const student of students) {
      const normalizedExistingName = normalizeString(student.name);
      const normalizedExistingNisn = student.nisn.trim();
      
      // Exact NISN match
      if (normalizedExistingNisn === normalizedInputNisn) {
        // Check if name also matches
        if (normalizedExistingName === normalizedInputName) {
          return {
            type: 'both',
            existingStudent: { name: student.name, nisn: student.nisn },
          };
        }
        return {
          type: 'nisn',
          existingStudent: { name: student.name, nisn: student.nisn },
        };
      }
      
      // Exact name match
      if (normalizedExistingName === normalizedInputName) {
        return {
          type: 'name',
          existingStudent: { name: student.name, nisn: student.nisn },
        };
      }
      
      // Similar name check (using AI-like pattern matching)
      const similarity = calculateSimilarity(inputName, student.name);
      if (similarity >= 0.75) {
        return {
          type: 'similar',
          existingStudent: { name: student.name, nisn: student.nisn },
          similarity: Math.round(similarity * 100),
        };
      }
    }
    
    return null;
  }, [students]);

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !nisn.trim()) {
      toast({
        title: "Data tidak lengkap",
        description: "Nama dan NISN wajib diisi",
        variant: "error",
      });
      return;
    }

    // Check for duplicates
    const duplicate = checkDuplicate(name, nisn);
    if (duplicate) {
      setDuplicateInfo(duplicate);
      setPendingStudent({ name: name.trim(), nisn: nisn.trim() });
      setShowDuplicateAlert(true);
      return;
    }

    await submitStudent(name.trim(), nisn.trim());
  };

  const submitStudent = async (studentName: string, studentNisn: string) => {
    await createStudent.mutateAsync({
      class_id: classId,
      name: studentName,
      nisn: studentNisn,
    });

    setName("");
    setNisn("");
    onOpenChange(false);
  };

  const handleConfirmDuplicate = async () => {
    if (pendingStudent) {
      await submitStudent(pendingStudent.name, pendingStudent.nisn);
    }
    setShowDuplicateAlert(false);
    setDuplicateInfo(null);
    setPendingStudent(null);
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateAlert(false);
    setDuplicateInfo(null);
    setPendingStudent(null);
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!batchData.trim()) {
      toast({
        title: "Data kosong",
        description: "Masukkan data siswa",
        variant: "error",
      });
      return;
    }

    const lines = batchData.trim().split("\n");
    const newStudents: { class_id: string; name: string; nisn: string }[] = [];
    const duplicates: BatchDuplicateItem[] = [];

    for (const line of lines) {
      const parts = line.split(/[,\t;]/).map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const duplicate = checkDuplicate(parts[0], parts[1]);
        if (duplicate) {
          duplicates.push({
            inputName: parts[0],
            inputNisn: parts[1],
            duplicateType: duplicate.type,
            existingStudent: duplicate.existingStudent,
            similarity: duplicate.similarity,
            selected: true, // Default selected (will be excluded)
          });
        }
        newStudents.push({
          class_id: classId,
          name: parts[0],
          nisn: parts[1],
        });
      }
    }

    if (newStudents.length === 0) {
      toast({
        title: "Format tidak valid",
        description: "Pastikan setiap baris berisi Nama dan NISN dipisahkan koma",
        variant: "error",
      });
      return;
    }

    // If there are duplicates, show professional popup
    if (duplicates.length > 0) {
      setBatchDuplicates(duplicates);
      setPendingBatchStudents(newStudents);
      setShowBatchDuplicateDialog(true);
      return;
    }

    // No duplicates, proceed directly
    await createStudentsBatch.mutateAsync(newStudents);
    setBatchData("");
    onOpenChange(false);
  };

  const handleBatchDuplicateToggle = (index: number) => {
    setBatchDuplicates(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleBatchDuplicateRemove = (index: number) => {
    // Also remove from pending students
    const itemToRemove = batchDuplicates[index];
    setPendingBatchStudents(prev => 
      prev.filter(s => !(s.name === itemToRemove.inputName && s.nisn === itemToRemove.inputNisn))
    );
    setBatchDuplicates(prev => prev.filter((_, i) => i !== index));
  };

  const handleBatchDuplicateEdit = (index: number) => {
    setBatchDuplicates(prev =>
      prev.map((item, i) =>
        i === index ? { 
          ...item, 
          isEditing: true, 
          editedName: item.editedName ?? item.inputName,
          editedNisn: item.editedNisn ?? item.inputNisn 
        } : item
      )
    );
  };

  const handleBatchDuplicateSaveEdit = (index: number) => {
    const item = batchDuplicates[index];
    const newName = item.editedName?.trim() || item.inputName;
    const newNisn = item.editedNisn?.trim() || item.inputNisn;
    
    // Update pending students
    setPendingBatchStudents(prev =>
      prev.map(s => 
        s.name === item.inputName && s.nisn === item.inputNisn
          ? { ...s, name: newName, nisn: newNisn }
          : s
      )
    );
    
    // Recheck if still a duplicate
    const newDuplicate = checkDuplicate(newName, newNisn);
    
    if (newDuplicate) {
      // Still a duplicate, update the record
      setBatchDuplicates(prev =>
        prev.map((d, i) =>
          i === index ? {
            ...d,
            inputName: newName,
            inputNisn: newNisn,
            duplicateType: newDuplicate.type,
            existingStudent: newDuplicate.existingStudent,
            similarity: newDuplicate.similarity,
            isEditing: false,
            selected: true,
          } : d
        )
      );
    } else {
      // No longer a duplicate, remove from duplicates list
      setBatchDuplicates(prev => prev.filter((_, i) => i !== index));
      toast({
        title: "Berhasil",
        description: `Siswa "${newName}" sekarang tidak duplikat dan akan ditambahkan.`,
      });
    }
  };

  const handleBatchDuplicateEditChange = (index: number, field: 'name' | 'nisn', value: string) => {
    setBatchDuplicates(prev =>
      prev.map((item, i) =>
        i === index ? { 
          ...item, 
          [field === 'name' ? 'editedName' : 'editedNisn']: value 
        } : item
      )
    );
  };

  const handleSelectAllDuplicates = (selected: boolean) => {
    setBatchDuplicates(prev => prev.map(item => ({ ...item, selected })));
  };

  const handleBatchDuplicateConfirm = async () => {
    // Filter out selected duplicates (ones marked to exclude)
    const selectedDuplicateKeys = new Set(
      batchDuplicates
        .filter(d => d.selected)
        .map(d => `${d.inputName}-${d.inputNisn}`)
    );

    const studentsToAdd = pendingBatchStudents.filter(
      s => !selectedDuplicateKeys.has(`${s.name}-${s.nisn}`)
    );

    if (studentsToAdd.length > 0) {
      await createStudentsBatch.mutateAsync(studentsToAdd);
      toast({
        title: "Berhasil",
        description: `${studentsToAdd.length} siswa berhasil ditambahkan. ${selectedDuplicateKeys.size} siswa duplikat dilewati.`,
      });
    } else {
      toast({
        title: "Info",
        description: "Tidak ada siswa yang ditambahkan karena semua terdeteksi duplikat.",
      });
    }

    setShowBatchDuplicateDialog(false);
    setBatchDuplicates([]);
    setPendingBatchStudents([]);
    setBatchData("");
    onOpenChange(false);
  };

  const handleBatchDuplicateCancel = () => {
    setShowBatchDuplicateDialog(false);
    setBatchDuplicates([]);
    setPendingBatchStudents([]);
  };

  const handleBatchAddAll = async () => {
    // Add all students including duplicates
    await createStudentsBatch.mutateAsync(pendingBatchStudents);
    toast({
      title: "Berhasil",
      description: `${pendingBatchStudents.length} siswa ditambahkan (termasuk yang mungkin duplikat).`,
    });
    
    setShowBatchDuplicateDialog(false);
    setBatchDuplicates([]);
    setPendingBatchStudents([]);
    setBatchData("");
    onOpenChange(false);
  };

  // Get duplicate type badge
  const getDuplicateBadge = (type: BatchDuplicateItem['duplicateType'], similarity?: number) => {
    switch (type) {
      case 'both':
        return <Badge variant="destructive" className="text-xs">Duplikat Penuh</Badge>;
      case 'nisn':
        return <Badge variant="destructive" className="text-xs">NISN Sama</Badge>;
      case 'name':
        return <Badge variant="warning" className="text-xs">Nama Sama</Badge>;
      case 'similar':
        return <Badge variant="warning" className="text-xs">{similarity}% Mirip</Badge>;
    }
  };

  // Get duplicate warning message
  const getDuplicateMessage = () => {
    if (!duplicateInfo) return "";
    
    switch (duplicateInfo.type) {
      case 'both':
        return `Siswa dengan nama "${duplicateInfo.existingStudent.name}" dan NISN "${duplicateInfo.existingStudent.nisn}" sudah terdaftar di kelas ini.`;
      case 'nisn':
        return `NISN "${duplicateInfo.existingStudent.nisn}" sudah digunakan oleh siswa "${duplicateInfo.existingStudent.name}".`;
      case 'name':
        return `Siswa dengan nama "${duplicateInfo.existingStudent.name}" sudah terdaftar dengan NISN "${duplicateInfo.existingStudent.nisn}".`;
      case 'similar':
        return `Ditemukan siswa dengan nama mirip (${duplicateInfo.similarity}% kecocokan): "${duplicateInfo.existingStudent.name}" (NISN: ${duplicateInfo.existingStudent.nisn}).`;
      default:
        return "";
    }
  };

  const selectedDuplicatesCount = batchDuplicates.filter(d => d.selected).length;
  const nonDuplicatesCount = pendingBatchStudents.length - batchDuplicates.length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Tambah Siswa ke {className}</DialogTitle>
            <DialogDescription>
              Tambahkan siswa satu per satu atau masukkan data batch
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="single" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">
                <UserPlus className="w-4 h-4 mr-2" />
                Satu Siswa
              </TabsTrigger>
              <TabsTrigger value="batch">
                <Upload className="w-4 h-4 mr-2" />
                Batch
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="mt-4">
              <form onSubmit={handleSingleSubmit}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="student-name">Nama Siswa *</Label>
                    <Input
                      id="student-name"
                      placeholder="Nama lengkap siswa"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoFocus
                      className={nameWarning ? 'border-amber-500 focus-visible:ring-amber-500' : ''}
                    />
                    {nameWarning && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {nameWarning}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="student-nisn">NISN *</Label>
                    <Input
                      id="student-nisn"
                      placeholder="Nomor Induk Siswa Nasional"
                      value={nisn}
                      onChange={(e) => setNisn(e.target.value)}
                      className={nisnWarning ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    {nisnWarning && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        {nisnWarning}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={!name.trim() || !nisn.trim() || createStudent.isPending}
                  >
                    {createStudent.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Tambah
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>

            <TabsContent value="batch" className="mt-4">
              <form onSubmit={handleBatchSubmit}>
                <div className="grid gap-4">
                  <Alert className="bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                      Sistem akan memeriksa duplikat berdasarkan nama dan NISN secara otomatis.
                    </AlertDescription>
                  </Alert>
                  <div className="grid gap-2">
                    <Label htmlFor="batch-data">Data Siswa</Label>
                    <Textarea
                      id="batch-data"
                      placeholder={`Format: Nama, NISN (satu baris per siswa)\n\nContoh:\nBudi Santoso, 0012345678\nSiti Rahma, 0012345679\nAhmad Fauzi, 0012345680`}
                      value={batchData}
                      onChange={(e) => setBatchData(e.target.value)}
                      rows={8}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Pisahkan Nama dan NISN dengan koma, tab, atau titik koma
                    </p>
                  </div>
                </div>
                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={!batchData.trim() || createStudentsBatch.isPending}
                  >
                    {createStudentsBatch.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Import Semua
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Single Student Duplicate Confirmation Dialog */}
      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Kemungkinan Siswa Duplikat
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>{getDuplicateMessage()}</p>
                
                {/* Comparison Card */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-muted rounded-lg">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Data Baru</p>
                    <p className="text-sm font-medium text-foreground">{pendingStudent?.name}</p>
                    <p className="text-xs text-muted-foreground">NISN: {pendingStudent?.nisn}</p>
                  </div>
                  <div className="space-y-1 border-l pl-3">
                    <p className="text-xs font-medium text-muted-foreground">Data Existing</p>
                    <p className="text-sm font-medium text-foreground">{duplicateInfo?.existingStudent.name}</p>
                    <p className="text-xs text-muted-foreground">NISN: {duplicateInfo?.existingStudent.nisn}</p>
                  </div>
                </div>
                
                <p className="font-medium text-foreground">Apakah Anda tetap ingin menambahkan siswa ini?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDuplicate}>
              Batalkan
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDuplicate}>
              Tetap Tambahkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Duplicates Professional Dialog */}
      <Dialog open={showBatchDuplicateDialog} onOpenChange={setShowBatchDuplicateDialog}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              Verifikasi Data Siswa
            </DialogTitle>
            <DialogDescription>
              Ditemukan {batchDuplicates.length} siswa yang kemungkinan duplikat dari total {pendingBatchStudents.length} siswa.
            </DialogDescription>
          </DialogHeader>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{nonDuplicatesCount}</p>
              <p className="text-xs text-muted-foreground">Siswa Baru</p>
            </div>
            <div className="text-center border-x">
              <p className="text-2xl font-bold text-amber-600">{batchDuplicates.length}</p>
              <p className="text-xs text-muted-foreground">Duplikat Terdeteksi</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{selectedDuplicatesCount}</p>
              <p className="text-xs text-muted-foreground">Akan Dilewati</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectAllDuplicates(true)}
              className="text-xs"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Lewati Semua Duplikat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectAllDuplicates(false)}
              className="text-xs"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Tambahkan Semua Duplikat
            </Button>
          </div>

          {/* Duplicates List */}
          <div className="flex-1 min-h-0">
            <p className="text-sm font-medium mb-2">Daftar Duplikat Terdeteksi:</p>
            <ScrollArea className="h-[280px] border rounded-lg">
              <div className="p-2 space-y-2">
                {batchDuplicates.map((item, index) => (
                  <div 
                    key={index}
                    className={`p-3 rounded-lg border transition-colors ${
                      item.selected 
                        ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' 
                        : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                    }`}
                  >
                    {item.isEditing ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Edit Data Siswa</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs">Nama</Label>
                            <Input
                              value={item.editedName ?? item.inputName}
                              onChange={(e) => handleBatchDuplicateEditChange(index, 'name', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">NISN</Label>
                            <Input
                              value={item.editedNisn ?? item.inputNisn}
                              onChange={(e) => handleBatchDuplicateEditChange(index, 'nisn', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleBatchDuplicateSaveEdit(index)}
                            className="h-7 text-xs"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Cek Ulang & Simpan
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setBatchDuplicates(prev => 
                              prev.map((d, i) => i === index ? { ...d, isEditing: false } : d)
                            )}
                            className="h-7 text-xs"
                          >
                            Batal
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => handleBatchDuplicateToggle(index)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm truncate">{item.inputName}</span>
                              {getDuplicateBadge(item.duplicateType, item.similarity)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              NISN: {item.inputNisn}
                            </p>
                            <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                              <ArrowRight className="w-3 h-3" />
                              <span>Mirip dengan:</span>
                              <span className="font-medium text-foreground">{item.existingStudent.name}</span>
                              <span className="text-muted-foreground">(NISN: {item.existingStudent.nisn})</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            onClick={() => handleBatchDuplicateEdit(index)}
                            title="Edit data siswa"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleBatchDuplicateRemove(index)}
                            title="Hapus dari daftar"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {!item.isEditing && (
                      <p className="text-xs mt-2 ml-8 flex items-center gap-1">
                        {item.selected ? (
                          <>
                            <XCircle className="w-3 h-3 text-red-500" />
                            <span className="text-red-600">Akan dilewati</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            <span className="text-green-600">Akan ditambahkan</span>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <Alert className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Tips:</strong> Centang siswa yang ingin dilewati. Klik ikon edit untuk mengubah nama/NISN agar tidak duplikat.
            </AlertDescription>
          </Alert>

          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleBatchDuplicateCancel}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleBatchAddAll}
              disabled={createStudentsBatch.isPending}
            >
              Tambahkan Semua ({pendingBatchStudents.length})
            </Button>
            <Button
              onClick={handleBatchDuplicateConfirm}
              disabled={createStudentsBatch.isPending || pendingBatchStudents.length - selectedDuplicatesCount === 0}
            >
              {createStudentsBatch.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Tambahkan {pendingBatchStudents.length - selectedDuplicatesCount} Siswa
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
