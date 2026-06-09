'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Search, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './popover';
import { Badge } from './badge';

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
  
  React.useEffect(() => {
    if (!open) setSearchValue('');
  }, [open]);

  const safeOptions = React.useMemo(() => (Array.isArray(options) ? options : []), [options]);

  const displayText = React.useMemo(() => {
    if (!value) return placeholder;
    const option = safeOptions.find((opt) => opt.value === value);
    if (option) return option.label;
    return disabled ? "جاري التحميل..." : (allowCustomValue ? value : "جاري استرجاع الاسم..."); 
  }, [safeOptions, value, placeholder, disabled, allowCustomValue]);

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return safeOptions;
    const searchLower = searchValue.toLowerCase();
    return safeOptions.filter(opt => 
        opt.label.toLowerCase().includes(searchLower) || 
        opt.searchKey?.toLowerCase().includes(searchLower)
    );
  }, [safeOptions, searchValue]);

  const showCustomAdd = React.useMemo(() => {
    if (!allowCustomValue || !searchValue.trim()) return false;
    return !safeOptions.some(opt => opt.label.toLowerCase() === searchValue.toLowerCase().trim());
  }, [allowCustomValue, searchValue, safeOptions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-11 rounded-xl border-2 transition-all px-4 text-right shadow-sm",
            "bg-white border-slate-200 hover:border-primary/40 text-sm font-black text-black",
            !value && "text-muted-foreground font-medium",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40 text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[450px] p-0 z-[999999999] border-2 border-primary/20 shadow-2xl rounded-2xl overflow-hidden bg-white" 
        align="start"
        dir="rtl"
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ pointerEvents: 'auto' }}
      >
        <Command className="bg-white">
          <div className="flex items-center border-b px-3 bg-slate-50/80">
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-40 text-primary" />
            <CommandInput 
                placeholder="ابحث هنا (بالاسم أو الكود)..." 
                value={searchValue}
                onValueChange={setSearchValue}
                className="h-11 text-sm font-black border-none bg-transparent placeholder:text-slate-400 text-black" 
            />
          </div>
          <CommandList className="max-h-[280px] p-2 scrollbar-none">
            {showCustomAdd && (
                <CommandItem
                  value={searchValue}
                  onSelect={() => {
                    onSelect(searchValue.trim());
                    setOpen(false);
                    setSearchValue('');
                  }}
                  className="cursor-pointer font-black text-primary py-3 px-4 rounded-xl mb-2 bg-primary/5 border-2 border-dashed border-primary/20 flex items-center gap-3 text-xs"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>استخدام: "{searchValue}"</span>
                </CommandItem>
            )}

            <CommandEmpty className={cn("py-6 text-center text-xs font-bold text-muted-foreground italic", showCustomAdd && "hidden")}>
                عذراً، لم نجد نتائج مطابقة..
            </CommandEmpty>
            
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label + (option.searchKey || '')}
                  onSelect={() => {
                    onSelect(option.value);
                    setOpen(false);
                    setSearchValue('');
                  }}
                  className="cursor-pointer font-black text-black py-3 px-4 rounded-xl mb-1 aria-selected:bg-primary/10 aria-selected:text-primary transition-all flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="truncate">{option.label}</span>
                    {option.searchKey && (
                        <Badge variant="secondary" className="font-mono text-[9px] h-5 px-2 bg-slate-100 text-slate-500 border-none shrink-0">
                            {option.searchKey}
                        </Badge>
                    )}
                  </div>
                  <Check
                    className={cn(
                      "h-4 w-4 transition-all shrink-0 mr-2",
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