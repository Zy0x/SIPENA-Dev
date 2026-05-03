import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";

export interface NationalHoliday {
  date: string; // yyyy-MM-dd
  name: string;
  is_national_holiday: boolean;
}

const CACHE_KEY = "sipena_national_holidays";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const API_URLS = [
  "https://api-harilibur.vercel.app/api",
  "https://api-harilibur.pages.dev/api",
  "https://api-harilibur.netlify.app/api",
];

interface CachedData {
  year: number;
  holidays: NationalHoliday[];
  fetchedAt: number;
}

function getCachedHolidays(year: number): NationalHoliday[] | null {
  try {
    const raw = localStorage.getItem(`${CACHE_KEY}_${year}`);
    if (!raw) return null;
    const cached: CachedData = JSON.parse(raw);
    if (cached.year !== year) return null;
    if (Date.now() - cached.fetchedAt > CACHE_DURATION) return null;
    return cached.holidays;
  } catch {
    return null;
  }
}

function setCachedHolidays(year: number, holidays: NationalHoliday[]) {
  try {
    const data: CachedData = { year, holidays, fetchedAt: Date.now() };
    localStorage.setItem(`${CACHE_KEY}_${year}`, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

async function fetchFromAPI(year: number): Promise<NationalHoliday[]> {
  for (const baseUrl of API_URLS) {
    try {
      const res = await fetch(`${baseUrl}?year=${year}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) continue;
      
      return data
        .filter((item: any) => item.is_national_holiday === true)
        .map((item: any) => ({
          date: format(new Date(item.holiday_date), "yyyy-MM-dd"),
          name: item.holiday_name || "Hari Libur Nasional",
          is_national_holiday: true,
        }));
    } catch {
      continue;
    }
  }
  return [];
}

export function useIndonesianHolidays(year: number) {
  const [nationalHolidays, setNationalHolidays] = useState<NationalHoliday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHolidays = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cached = getCachedHolidays(year);
      if (cached) {
        setNationalHolidays(cached);
        setLastSynced(new Date());
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    try {
      const holidays = await fetchFromAPI(year);
      if (holidays.length > 0) {
        setCachedHolidays(year, holidays);
        setNationalHolidays(holidays);
        setLastSynced(new Date());
      } else {
        setError("Tidak dapat mengambil data hari libur nasional");
      }
    } catch (e) {
      setError("Gagal sinkronisasi kalender nasional");
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const isNationalHoliday = useCallback(
    (date: Date): boolean => {
      const dateStr = format(date, "yyyy-MM-dd");
      return nationalHolidays.some((h) => h.date === dateStr);
    },
    [nationalHolidays]
  );

  const getNationalHolidayName = useCallback(
    (date: Date): string | null => {
      const dateStr = format(date, "yyyy-MM-dd");
      const holiday = nationalHolidays.find((h) => h.date === dateStr);
      return holiday?.name || null;
    },
    [nationalHolidays]
  );

  const getMonthNationalHolidays = useCallback(
    (month: Date): NationalHoliday[] => {
      const monthStr = format(month, "yyyy-MM");
      return nationalHolidays.filter((h) => h.date.startsWith(monthStr));
    },
    [nationalHolidays]
  );

  return {
    nationalHolidays,
    isLoading,
    lastSynced,
    error,
    isNationalHoliday,
    getNationalHolidayName,
    getMonthNationalHolidays,
    refresh: () => fetchHolidays(true),
  };
}
