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
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const selectedOption = React.useMemo(() => 
    options.find((option) => option.value === value)
  , [options, value]);

  const handleSelect = React.useCallback(
    (optionValue: string) => {
      onSelect(optionValue === value ? "" : optionValue);
      setOpen(false);
      // إعادة التركيز للزر بعد إغلاق القائمة لضمان استقرار تجربة المستخدم
      setTimeout(() => triggerRef.current?.focus(), 0);
    },
    [value, onSelect]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
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
          <div className="flex items-center shrink-0">
            <Check className={cn("ml-2 h-4 w-4 opacity-50", !value && "hidden")} />
            <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 w-[var(--radix-popover-trigger-width)] z-[999999]" 
        align="start"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          // منع إغلاق الـ Popover عند التفاعل مع القائمة نفسها
          if (target.closest('[data-inline-search-list-options]')) {
            e.preventDefault();
          }
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        data-inline-search-list-options
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
                  onPointerDown={(e) => {
                    // الحدث الحاسم: نلتقط النقر قبل أن يفقد الـ Input التركيز
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(option.value);
                  }}
                  onSelect={() => {
                    // دعم الاختيار عبر الكيبورد (Enter)
                    handleSelect(option.value);
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