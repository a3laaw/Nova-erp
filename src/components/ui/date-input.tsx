
'use client';

import * as React from 'react';
import { format as formatDate, isValid, parse as parseDate, isBefore, isAfter, startOfDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from './input';

export interface DateInputProps {
  id?: string;
  value?: Date | string;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  placeholder?: string;
}

const parseableFormats = [
    'dd/MM/yyyy', 'd/M/yyyy', 'dd/M/yyyy', 'd/MM/yyyy',
    'dd-MM-yyyy', 'd-M-yyyy', 'dd-M-yyyy', 'd-MM-yyyy',
    'dd.MM.yyyy', 'd.M.yyyy',
    'yyyy-MM-dd',
];

export function DateInput({ 
  id, 
  value, 
  onChange, 
  disabled = false, 
  className, 
  minDate, 
  maxDate, 
  placeholder, 
  required,
  ...props 
}: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const dateValue = React.useMemo(() => {
    if (value instanceof Date && isValid(value)) return value;
    if (typeof value === 'string') {
      const parsed = parseDate(value, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) return parsed;
    }
    return undefined;
  }, [value]);

  React.useEffect(() => {
    if (dateValue) {
      setInputValue(formatDate(dateValue, 'dd/MM/yyyy'));
    } else {
      setInputValue('');
    }
  }, [dateValue]);

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      onChange(undefined);
      return;
    }

    let parsedDate: Date | null = null;
    for (const fmt of parseableFormats) {
      const parsed = parseDate(inputValue, fmt, new Date());
      if (isValid(parsed)) {
        parsedDate = parsed;
        break;
      }
    }

    if (parsedDate) {
      if (minDate && isBefore(startOfDay(parsedDate), startOfDay(minDate))) parsedDate = minDate;
      if (maxDate && isAfter(startOfDay(parsedDate), startOfDay(maxDate))) parsedDate = maxDate;
      onChange(parsedDate);
    } else if (dateValue) {
      setInputValue(formatDate(dateValue, 'dd/MM/yyyy'));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative w-full", className)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute left-0 top-0 h-full px-3 rtl:left-auto rtl:right-0"
            disabled={disabled}
            type="button"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <Input
          id={id}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleInputBlur}
          placeholder={placeholder || `مثال: ${formatDate(new Date(), 'dd/MM/yyyy')}`}
          disabled={disabled}
          required={required}
          className="w-full pl-10 rtl:pr-10 h-11 rounded-xl"
          {...props}
        />
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(d) => { onChange(d); setOpen(false); }}
          initialFocus
          disabled={disabled}
          locale={ar}
        />
      </PopoverContent>
    </Popover>
  );
}
