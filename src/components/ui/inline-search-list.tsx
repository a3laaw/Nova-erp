'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

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

/**
 * مكون البحث والاختيار المطور (Pro Edition):
 * - تم تصغير الحجم وتحسين الأبعاد ليكون أكثر أناقة.
 * - إحكام منطق النقر لضمان استجابة فورية للماوس.
 */
export function InlineSearchList({
  value,
  onSelect,
  options,
  placeholder,
  disabled,
  className,
}: InlineSearchListProps) {
  const [open, setOpen] = React.useState(false);
  
  const selectedOption = React.useMemo(() => 
    options.find((option) => option.value === value)
  , [options, value]);

  const handleSelect = React.useCallback((optionValue: string) => {
    onSelect(optionValue === value ? "" : optionValue);
    setOpen(false);
  }, [onSelect, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-bold h-10 rounded-2xl border-2 transition-all shadow-sm",
            "bg-white/80 backdrop-blur-sm border-slate-100 hover:border-primary/30",
            !value && "text-muted-foreground font-medium",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate text-xs">{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-40 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0 z-[999999999] border-2 border-primary/20 shadow-2xl rounded-[1.5rem] overflow-hidden bg-white" 
        align="start"
        dir="rtl"
        style={{ pointerEvents: 'auto' }}
      >
        <Command className="bg-white">
          <div className="flex items-center border-b px-3 bg-slate-50/50">
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-40 text-primary" />
            <CommandInput 
                placeholder="ابحث هنا..." 
                className="h-10 text-xs font-bold border-none bg-transparent" 
            />
          </div>
          <CommandList className="max-h-[280px] p-1.5 scrollbar-none">
            <CommandEmpty className="py-6 text-center text-xs font-bold text-muted-foreground italic">
                لا توجد نتائج مطابقة..
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  // 🛡️ استخدام onSelect المدمج مع التحقق من القيمة لضمان تسجيل النقرة
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer font-black text-[#1e1b4b] py-2.5 px-4 rounded-xl mb-1 aria-selected:bg-primary/5 aria-selected:text-primary transition-colors flex items-center justify-between"
                >
                  <span className="text-xs">{option.label}</span>
                  <Check
                    className={cn(
                      "h-4 w-4 transition-all",
                      value === option.value ? "opacity-100 scale-110" : "opacity-0 scale-50"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
