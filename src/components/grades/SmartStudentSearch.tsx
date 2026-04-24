import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fuzzySearchStudents, SearchResult } from "@/lib/fuzzySearch";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  nisn: string;
  is_bookmarked?: boolean;
}

interface SmartStudentSearchProps {
  students: Student[];
  onFilter: (filteredStudents: Student[]) => void;
  onSelectStudent?: (student: Student) => void;
  onSearchQueryChange?: (query: string) => void;
  placeholder?: string;
  showSuggestions?: boolean;
  className?: string;
}

export function SmartStudentSearch({
  students,
  onFilter,
  onSelectStudent,
  onSearchQueryChange,
  placeholder = "Cari siswa dengan AI...",
  showSuggestions = true,
  className,
}: SmartStudentSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchResults = useMemo(() => {
    return fuzzySearchStudents(students, query, { minScore: 40, limit: 10 });
  }, [students, query]);

  const filteredStudents = useMemo(() => {
    // If a student was explicitly selected from AI suggestions, show ONLY that student
    if (selectedStudent) {
      return students.filter(s => s.id === selectedStudent.id);
    }
    if (!query.trim()) return students;
    return searchResults.map(r => r.item);
  }, [students, query, searchResults, selectedStudent]);

  useEffect(() => {
    onFilter(filteredStudents);
    onSearchQueryChange?.(query);
  }, [filteredStudents, query, onFilter, onSearchQueryChange]);

  // Track if user is manually typing (not from selection)
  const isManualEditRef = useRef(true);

  useEffect(() => {
    setHighlightedIndex(-1);
    // If user manually edits query after selecting, clear selection
    if (selectedStudent && isManualEditRef.current && query !== selectedStudent.name) {
      setSelectedStudent(null);
    }
  }, [query, selectedStudent]);

  useEffect(() => {
    if (highlightedIndex >= 0 && suggestionsRef.current) {
      const highlightedElement = suggestionsRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      );
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [highlightedIndex]);

  const handleClear = useCallback(() => {
    setQuery("");
    setSelectedStudent(null);
    inputRef.current?.focus();
    onFilter(students);
    onSearchQueryChange?.("");
  }, [students, onFilter, onSearchQueryChange]);



  const handleSelectSuggestion = useCallback((result: SearchResult<Student>) => {
    isManualEditRef.current = false;
    setSelectedStudent(result.item);
    if (onSelectStudent) {
      onSelectStudent(result.item);
    }
    setQuery(result.item.name);
    setIsFocused(false);
    // Show ONLY this exact student
    onFilter([result.item]);
    // Re-enable manual edit tracking after state settles
    setTimeout(() => { isManualEditRef.current = true; }, 50);
  }, [onSelectStudent, onFilter]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || searchResults.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
          handleSelectSuggestion(searchResults[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsFocused(false);
        inputRef.current?.blur();
        break;
    }
  }, [showSuggestions, searchResults, highlightedIndex, handleSelectSuggestion]);

  const getMatchTypeLabel = (matchType: SearchResult<Student>['matchType']) => {
    switch (matchType) {
      case 'exact': return null;
      case 'prefix': return null;
      case 'contains': return null;
      case 'fuzzy': return 'AI';
      case 'nickname': return 'Alias';
    }
  };

  // Don't show dropdown when a student is already selected
  const showDropdown = isFocused && query.length > 0 && showSuggestions && searchResults.length > 0 && !selectedStudent;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
          {query && (
            <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary animate-pulse flex-shrink-0" />
          )}
        </div>
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-8 sm:pl-10 pr-8 sm:pr-9 text-xs sm:text-sm h-8 sm:h-9"
          aria-label="Cari siswa"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
          role="combobox"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0.5 top-1/2 -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7"
            onClick={handleClear}
            aria-label="Hapus pencarian"
            type="button"
          >
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Button>
        )}
      </div>

      {/* Search Results Summary */}
      {query && (
        <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 flex items-center gap-1 px-0.5">
          <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-primary flex-shrink-0" />
          <span>
            {filteredStudents.length}/{students.length} siswa
            {filteredStudents.length === 0 && " - Tidak ditemukan"}
          </span>
        </p>
      )}

      {/* Suggestions Dropdown - Fully Responsive */}
      {showDropdown && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden animate-fade-in"
          role="listbox"
        >
          <ScrollArea className="max-h-[35vh] sm:max-h-56">
            <div className="py-1">
              {searchResults.map((result, index) => (
                <button
                  key={result.item.id}
                  data-index={index}
                  type="button"
                  className={cn(
                    "w-full flex items-center gap-2 px-2 sm:px-3 py-2 text-left hover:bg-accent/50 transition-colors",
                    highlightedIndex === index && "bg-accent"
                  )}
                  onClick={() => handleSelectSuggestion(result)}
                  role="option"
                  aria-selected={highlightedIndex === index}
                >
                  {/* Avatar */}
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                  </div>
                  
                  {/* Student Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] sm:text-xs font-medium truncate">
                      {result.item.name}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate">
                      {result.item.nisn}
                    </p>
                  </div>
                  
                  {/* Match Info - Compact */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {getMatchTypeLabel(result.matchType) && (
                      <Badge 
                        variant="secondary" 
                        className="text-[8px] sm:text-[9px] px-1 py-0 h-4"
                      >
                        {getMatchTypeLabel(result.matchType)}
                      </Badge>
                    )}
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-medium">
                      {Math.round(result.score)}%
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}