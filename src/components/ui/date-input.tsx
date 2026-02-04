'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { format, parse, isValid } from 'date-fns';

interface DateInputProps {
  value: string; // expects "yyyy-MM-dd"
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DateInput({ value, onChange, disabled, className }: DateInputProps) {
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  // Effect to sync component state with parent's value prop
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      try {
        const date = parse(value, 'yyyy-MM-dd', new Date());
        if (isValid(date)) {
          setYear(format(date, 'yyyy'));
          setMonth(format(date, 'MM'));
          setDay(format(date, 'dd'));
        }
      } catch (e) {
        // ignore invalid date from parent
      }
    } else if (!value) {
      setDay('');
      setMonth('');
      setYear('');
    }
  }, [value]);

  const updateParent = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const dateStr = `${y}-${m}-${d}`;
      // Basic validation
      const date = new Date(dateStr);
      if (!isNaN(date.getTime()) && format(date, 'yyyy-MM-dd') === dateStr) {
        onChange(dateStr);
      }
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 2) {
      setDay(val);
      if (val.length === 2) {
        monthRef.current?.focus();
      }
      updateParent(val, month, year);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 2) {
      setMonth(val);
      if (val.length === 2) {
        yearRef.current?.focus();
      }
      updateParent(day, val, year);
    }
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val.length <= 4) {
      setYear(val);
      updateParent(day, month, val);
    }
  };
  
  return (
    <div className={cn("flex items-center gap-1 rounded-md border border-input bg-background h-10 px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2", className)} dir="ltr">
      <Input
        ref={dayRef}
        value={day}
        onChange={handleDayChange}
        placeholder="DD"
        maxLength={2}
        className="w-10 border-none text-center shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
        disabled={disabled}
      />
      <span className="text-muted-foreground">/</span>
      <Input
        ref={monthRef}
        value={month}
        onChange={handleMonthChange}
        placeholder="MM"
        maxLength={2}
        className="w-10 border-none text-center shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
        disabled={disabled}
      />
      <span className="text-muted-foreground">/</span>
      <Input
        ref={yearRef}
        value={year}
        onChange={handleYearChange}
        placeholder="YYYY"
        maxLength={4}
        className="w-16 border-none text-center shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent"
        disabled={disabled}
      />
    </div>
  );
}
