import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StudentSearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  resultCount?: number;
  totalCount?: number;
}

export function StudentSearchBar({
  onSearch,
  placeholder = "Cari siswa...",
  resultCount,
  totalCount,
}: StudentSearchBarProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    onSearch(query);
  }, [query, onSearch]);

  const handleClear = () => {
    setQuery("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
          aria-label="Cari nama siswa"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={handleClear}
            aria-label="Hapus pencarian"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {query && resultCount !== undefined && totalCount !== undefined && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Menampilkan {resultCount} dari {totalCount} siswa
          {resultCount === 0 && " - Tidak ditemukan"}
        </p>
      )}
    </div>
  );
}
