'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search, PlusCircle } from 'lucide-react';
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
  allowCustomValue?: boolean;
}

/**
 * مكون البحث والاختيار المطور (V22.0):
 * - تم تحسين عرض القيمة المختارة لضمان ظهور النص حتى لو كانت القيمة مخصصة.
 * - استجابة فورية للنقر بالماوس وتحصين ضد اختفاء القيم.
 */
export function InlineSearchList({
  value,
  onSelect,
  options,
  placeholder,
  disabled,
  className,
  allowCustomValue = false,
}: InlineSearchListProps) {
  const [open, setOpen] = React.useState(false);
  const [searchValue, setSearchValue] = React.useState('');
  
  // تصفير نص البحث عند إغلاق القائمة
  React.useEffect(() => {
    if (!open) setSearchValue('');
  }, [open]);

  // البحث عن النص الظاهر المقابل للقيمة أو استخدام القيمة نفسها إذا لم يوجد خيار مطابق
  const displayText = React.useMemo(() => {
    if (!value) return placeholder;
    const option = options.find((opt) => opt.value === value);
    return option ? option.label : value;
  }, [options, value, placeholder]);

  const showCustomAdd = React.useMemo(() => {
    if (!allowCustomValue || !searchValue.trim()) return false;
    return !options.some(opt => opt.label.toLowerCase() === searchValue.toLowerCase().trim());
  }, [allowCustomValue, searchValue, options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-9 rounded-xl border-2 transition-all px-3 text-right",
            "bg-white/90 border-slate-200 hover:border-primary/40 text-[11px] font-bold",
            !value && "text-muted-foreground font-medium",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[--radix-popover-trigger-width] p-0 z-[999999999] border-2 border-primary/20 shadow-2xl rounded-2xl overflow-hidden bg-white" 
        align="start"
        dir="rtl"
        style={{ pointerEvents: 'auto' }}
        onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[role="listbox"]') || target.closest('[data-radix-select-content]')) {
                e.preventDefault();
            }
        }}
      >
        <Command className="bg-white">
          <div className="flex items-center border-b px-2 bg-slate-50/50">
            <Search className="ml-2 h-3.5 w-3.5 shrink-0 opacity-40 text-primary" />
            <CommandInput 
                placeholder="ابحث أو اكتب هنا..." 
                value={searchValue}
                onValueChange={setSearchValue}
                className="h-9 text-[11px] font-bold border-none bg-transparent" 
            />
          </div>
          <CommandList className="max-h-[220px] p-1 scrollbar-none">
            {showCustomAdd && (
                <CommandItem
                  value={searchValue}
                  onSelect={() => {
                    onSelect(searchValue.trim());
                    setOpen(false);
                    setSearchValue('');
                  }}
                  className="cursor-pointer font-black text-primary py-2.5 px-3 rounded-lg mb-1 bg-primary/5 border border-dashed border-primary/30 flex items-center gap-2 text-[10px] animate-in slide-in-from-top-1"
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span>استخدام القيمة: "{searchValue}"</span>
                </CommandItem>
            )}

            <CommandEmpty className={cn("py-4 text-center text-[10px] font-bold text-muted-foreground italic", showCustomAdd && "hidden")}>
                لا توجد نتائج مطابقة..
            </CommandEmpty>
            
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value);
                    setOpen(false);
                    setSearchValue('');
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