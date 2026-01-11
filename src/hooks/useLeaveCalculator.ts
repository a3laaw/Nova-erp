
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, getDocs, query, type DocumentData } from 'firebase/firestore';
import { eachDayOfInterval, format, isFriday } from 'date-fns';
import type { Holiday } from '@/lib/types';

// Simple in-memory cache for holidays to prevent re-fetching on every date change.
let holidayCache: Set<string> | null = null;
let cacheTimestamp: number | null = null;
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

async function getHolidays(firestore: DocumentData): Promise<Set<string>> {
  const now = Date.now();
  if (holidayCache && cacheTimestamp && (now - cacheTimestamp < CACHE_DURATION)) {
    return holidayCache;
  }

  const holidaysQuery = query(collection(firestore, 'holidays'));
  const holidaysSnapshot = await getDocs(holidaysQuery);
  const holidayDates = new Set<string>();
  holidaysSnapshot.forEach(doc => {
    const data = doc.data() as Holiday;
    // Store date in 'yyyy-MM-dd' format for easy comparison
    holidayDates.add(format(new Date(data.date), 'yyyy-MM-dd'));
  });

  holidayCache = holidayDates;
  cacheTimestamp = now;
  return holidayDates;
}

export function useLeaveCalculator(startDate: string, endDate: string) {
  const firestore = useFirestore();
  const [workingDays, setWorkingDays] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculate = async () => {
      if (!startDate || !endDate || !firestore) {
        setWorkingDays(0);
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        setWorkingDays(0);
        setError('تاريخ البداية يجب أن يكون قبل تاريخ النهاية.');
        return;
      }
      
      setLoading(true);
      setError(null);

      try {
        const holidays = await getHolidays(firestore);
        const interval = eachDayOfInterval({ start, end });
        
        const calculatedWorkingDays = interval.reduce((count, day) => {
          const dayStr = format(day, 'yyyy-MM-dd');
          
          // Day is NOT a Friday and is NOT a public holiday
          if (!isFriday(day) && !holidays.has(dayStr)) {
            return count + 1;
          }
          return count;
        }, 0);
        
        setWorkingDays(calculatedWorkingDays);

      } catch (err) {
        console.error("Failed to calculate working days:", err);
        setError('فشل في حساب أيام العمل. لا يمكن الوصول إلى قائمة العطلات.');
        setWorkingDays(0);
      } finally {
        setLoading(false);
      }
    };

    calculate();
  }, [startDate, endDate, firestore]);

  return { workingDays, loading, error };
}
