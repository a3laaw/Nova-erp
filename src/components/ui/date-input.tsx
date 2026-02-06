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
  value?: Date;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
}

// The format seen by the user
const displayFormat = 'PPP';
// Formats to try parsing when user types manually
const parseableFormats = [
    // Most common with slashes (4-digit year)
    'dd/MM/yyyy',
    'd/M/yyyy',
    'dd/M/yyyy',
    'd/MM/yyyy',
    // Most common with hyphens (4-digit year)
    'dd-MM-yyyy',
    'd-M-yyyy',
    'dd-M-yyyy',
    'd-MM-yyyy',
    // Most common with dots (4-digit year)
    'dd.MM.yyyy',
    'd.M.yyyy',
    // Most common with slashes (2-digit year)
    'dd/MM/yy',
    'd/M/yy',
    'dd/M/yy',
    'd/MM/yy',
    // Most common with hyphens (2-digit year)
    'dd-MM-yy',
    'd-M-yy',
    'dd-M-yy',
    'd-MM-yy',
    // ISO format
    'yyyy-MM-dd',
    // No separator
    'ddMMyyyy',
    'yyyyMMdd',
];


export function DateInput({ value, onChange, disabled, className }: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState('');

  // When the external `value` (Date object) changes, update the internal text input `inputValue`.
  React.useEffect(() => {
    if (value && isValid(value)) {
      try {
        setInputValue(formatDate(value, displayFormat, { locale: ar }));
      } catch (e) {
        setInputValue('');
      }
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleDateSelect = (newDate: Date | undefined) => {
    onChange(newDate); // Update the external state
    setOpen(false); // Close popover on selection
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  // When the user leaves the input field, try to parse what they typed.
  const handleInputBlur = () => {
    if (!inputValue.trim()) {
      onChange(undefined);
      return;
    }

    let parsedDate: Date | null = null;
    
    // Try parsing with different common formats
    for (const format of parseableFormats) {
      const parsed = parseDate(inputValue, format, new Date());
      if (isValid(parsed)) {
        parsedDate = parsed;
        break;
      }
    }
    
    // As a last resort, try the browser's native, less reliable parser
    if (!parsedDate) {
      const nativeParsed = new Date(inputValue);
      if (isValid(nativeParsed)) {
        parsedDate = nativeParsed;
      }
    }

    if (parsedDate) {
      if (!value || parsedDate.getTime() !== value.getTime()) {
        onChange(parsedDate);
      }
    } else if (value) {
      // If parsing fails, revert to the last valid date to avoid confusion
      setInputValue(formatDate(value, displayFormat, { locale: ar }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur();
      (e.target as HTMLInputElement).blur(); // Remove focus from input
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
          className="w-full pl-10 rtl:pr-10" // Padding to make space for the icon
        />
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
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
