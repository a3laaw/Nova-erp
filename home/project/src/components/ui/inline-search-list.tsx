'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const isSelectingRef = React.useRef(false);

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isSelectingRef.current) {
          isSelectingRef.current = false;
          return;
        }
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal h-10 px-3 truncate",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{selectedOption?.label || placeholder}</span>
          <div className="flex items-center shrink-0 gap-1">
            {value && <Check className="h-4 w-4 opacity-50" />}
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] z-[999999]"
        align="start"
        onInteractOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <Command dir="rtl" className="w-full">
          <CommandInput placeholder="ابحث..." className="h-9" />
          <CommandList className="max-h-[250px]">
            <CommandEmpty>لا توجد نتائج.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label + (option.searchKey || '')}
                  onPointerDown={() => {
                    isSelectingRef.current = true;
                  }}
                  onPointerUp={() => {
                    isSelectingRef.current = false;
                    onSelect(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                  onSelect={() => {
                    onSelect(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "ml-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
