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
 * مكون البحث والاختيار المطور (V14.0):
 * - تم حل مشكلة ظهور المربع فارغاً عند سحب بيانات خارجية (Fallback Display).
 * - استجابة فورية للنقر بالماوس داخل النوافذ المنبثقة.
 * - دعم كامل لعرض النص حتى لو لم تنتهِ قائمة الإعدادات من التحميل.
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
  
  // البحث عن النص الظاهر المقابل للقيمة
  const selectedOption = React.useMemo(() => 
    options.find((option) => option.value === value)
  , [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-9 rounded-xl border-2 transition-all px-3",
            "bg-white/90 border-slate-200 hover:border-primary/40 text-[11px] font-bold",
            !value && "text-muted-foreground font-medium",
            className
          )}
          disabled={disabled}
        >
          {/* ✨ التعديل الجوهري: إظهار القيمة المسحوبة (مثل: تصميم الدور الأرضي) حتى لو لم تكتمل قائمة الإعدادات ✨ */}
          <span className="truncate">{selectedOption ? selectedOption.label : (value || placeholder)}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0 z-[999999999] border-2 border-primary/20 shadow-2xl rounded-2xl overflow-hidden bg-white" 
        align="start"
        dir="rtl"
        style={{ pointerEvents: 'auto' }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <Command className="bg-white">
          <div className="flex items-center border-b px-2 bg-slate-50/50">
            <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40 text-primary" />
            <CommandInput 
                placeholder="ابحث هنا..." 
                className="h-9 text-[11px] font-bold border-none bg-transparent" 
            />
          </div>
          <CommandList className="max-h-[220px] p-1 scrollbar-none">
            <CommandEmpty className="py-4 text-center text-[10px] font-bold text-muted-foreground italic">
                لا توجد نتائج..
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                  className="cursor-pointer font-bold text-[#1e1b4b] py-2 px-3 rounded-lg mb-0.5 aria-selected:bg-primary/10 aria-selected:text-primary transition-colors flex items-center justify-between text-[11px]"
                >
                  <span className="truncate">{option.label}</span>
                  <Check
                    className={cn(
                      "h-3.5 w-3.5 transition-all",
                      value === option.value ? "opacity-100 scale-100" : "opacity-0 scale-50"
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
