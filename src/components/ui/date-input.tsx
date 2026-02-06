'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ar } from 'date-fns/locale';

interface DateInputProps {
  value: string; // Expects "yyyy-MM-dd"
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function DateInput({ value, onChange, disabled }: DateInputProps) {
  const [open, setOpen] = React.useState(false);

  const dateValue = value ? new Date(value) : undefined;
  
  // Ensure we don't pass an invalid date to the calendar
  const isValidDate = dateValue && !isNaN(dateValue.getTime());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground'
          )}
          disabled={disabled}
        >
          <CalendarIcon className="ml-2 h-4 w-4" />
          {isValidDate ? format(dateValue, 'PPP', { locale: ar }) : <span>اختر تاريخًا</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={isValidDate ? dateValue : undefined}
          onSelect={(day) => {
            if (day) {
              onChange(format(day, 'yyyy-MM-dd'));
            }
            setOpen(false);
          }}
          initialFocus
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}
