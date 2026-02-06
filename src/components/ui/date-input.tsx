'use client';

import * as React from 'react';
import { format as formatDate, isValid, parse as parseDate } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from './input';

interface DateInputProps {
  value?: Date | string;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

// The format seen by the user
const displayFormat = 'PPP';
// Formats to try parsing when user types manually
const parseableFormats = [
    'dd/MM/yyyy', 'd/M/yyyy', 'dd/M/yyyy', 'd/MM/yyyy',
    'dd-MM-yyyy', 'd-M-yyyy', 'dd-M-yyyy', 'd-MM-yyyy',
    'dd.MM.yyyy', 'd.M.yyyy',
    'dd/MM/yy', 'd/M/yy', 'dd/M/yy', 'd/MM/yy',
    'dd-MM-yy', 'd-M-yy', 'dd-M-yy', 'd-MM-yy',
    'yyyy-MM-dd',
    'ddMMyyyy', 'yyyyMMdd',
];


export function DateInput({ value, onChange, disabled, className, ...props }: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  const dateValue = React.useMemo(() => {
    if (value instanceof Date && isValid(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseDate(value, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) return parsed;
    }
    return undefined;
  }, [value]);

  React.useEffect(() => {
    if (dateValue) {
      try {
        setInputValue(formatDate(dateValue, 'dd/MM/yyyy'));
      } catch (e) {
        setInputValue('');
      }
    } else {
        setInputValue('');
    }
  }, [dateValue]);

  const handleDateSelect = (newDate: Date | undefined) => {
    onChange(newDate); 
    setOpen(false); 
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      onChange(undefined);
      return;
    }

    let parsedDate: Date | null = null;
    
    for (const format of parseableFormats) {
      const parsed = parseDate(inputValue, format, new Date());
      if (isValid(parsed)) {
        parsedDate = parsed;
        break;
      }
    }
    
    if (!parsedDate) {
      const nativeParsed = new Date(inputValue);
      if (isValid(nativeParsed)) {
        parsedDate = nativeParsed;
      }
    }

    if (parsedDate) {
      if (!dateValue || parsedDate.getTime() !== dateValue.getTime()) {
        onChange(parsedDate);
      } else {
        setInputValue(formatDate(parsedDate, 'dd/MM/yyyy'));
      }
    } else if (dateValue) {
      setInputValue(formatDate(dateValue, 'dd/MM/yyyy'));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative w-full", className)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute left-0 top-0 h-full px-3 rtl:left-auto rtl:right-0"
            aria-label="Open calendar"
            disabled={disabled}
            type="button"
          >
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={`مثال: ${formatDate(new Date(), 'dd/MM/yyyy')}`}
          disabled={disabled}
          className="w-full pl-10 rtl:pr-10"
          {...props}
        />
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleDateSelect}
          initialFocus
          disabled={disabled}
          locale={ar}
          captionLayout="dropdown-buttons"
          fromYear={1960}
          toYear={new Date().getFullYear() + 5}
        />
      </PopoverContent>
    </Popover>
  );
}
