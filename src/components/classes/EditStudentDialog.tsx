import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { useStudents, Student } from "@/hooks/useStudents";

interface EditStudentDialogProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditStudentDialog({
  student,
  open,
  onOpenChange,
}: EditStudentDialogProps) {
  const [name, setName] = useState("");
  const [nisn, setNisn] = useState("");
  const { updateStudent } = useStudents(student?.class_id);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setNisn(student.nisn);
    }
  }, [student]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!student || !name.trim() || !nisn.trim()) return;

    await updateStudent.mutateAsync({
      id: student.id,
      name: name.trim(),
      nisn: nisn.trim(),
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Siswa</DialogTitle>
          <DialogDescription>
            Perbarui informasi siswa di bawah ini
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-student-name">Nama Siswa *</Label>
              <Input
                id="edit-student-name"
                placeholder="Nama lengkap siswa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-student-nisn">NISN *</Label>
              <Input
                id="edit-student-nisn"
                placeholder="Nomor Induk Siswa Nasional"
                value={nisn}
                onChange={(e) => setNisn(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !nisn.trim() || updateStudent.isPending}
            >
              {updateStudent.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Simpan
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
