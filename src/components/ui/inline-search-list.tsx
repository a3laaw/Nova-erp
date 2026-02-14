'use client';

import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';

export interface SearchOption {
  value: string;
  label: string;
  searchKey?: string;
}

interface InlineSearchListProps {
  value: string;
  onSelect: (value: string) => void;
  options: SearchOption[];
  placeholder: string;
  disabled?: boolean;
  className?: string;
}

export function InlineSearchList({
  value,
  onSelect,
  options,
  placeholder,
  disabled,
  className,
}: InlineSearchListProps) {
  const [open, setOpen] = React.useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
          disabled={disabled}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 rtl:mr-2 rtl:ml-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(value, search) => {
            const option = options.find(opt => opt.value.toLowerCase() === value.toLowerCase());
            if (!option) return 0;
            const labelMatch = option.label.toLowerCase().includes(search.toLowerCase());
            const searchKeyMatch = option.searchKey?.toLowerCase().includes(search.toLowerCase());
            return labelMatch || searchKeyMatch ? 1 : 0;
          }}
        >
          <CommandInput placeholder="ابحث..." />
          <CommandList>
            <CommandEmpty>لا توجد نتائج.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value} // Use value for logic
                  onSelect={(currentValue) => {
                    onSelect(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 rtl:ml-2 rtl:mr-0",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex justify-between items-center w-full">
                    <span>{option.label}</span>
                    {option.searchKey && <span className="text-xs text-muted-foreground">{option.searchKey}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
