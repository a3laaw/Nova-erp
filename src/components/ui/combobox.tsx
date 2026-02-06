"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
    value: string;
    label: string;
}

interface ComboboxProps {
    options: ComboboxOption[];
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    notFoundMessage?: string;
    disabled?: boolean;
    className?: string;
}

export function Combobox({
    options,
    value,
    onValueChange,
    placeholder = "Select an option...",
    searchPlaceholder = "Search...",
    notFoundMessage = "No option found.",
    disabled = false,
    className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)

  const selectedLabel = options.find((option) => option.value === value)?.label

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* 5. الزر الذي يفتح القائمة المنسدلة */}
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
          disabled={disabled}
        >
          {/* عرض النص المختار أو النص الافتراضي */}
          {selectedLabel || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      {/* 6. محتوى القائمة المنسدلة الذي يظهر عند النقر */}
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          {/* 7. مربع الكتابة الفعلي للبحث داخل القائمة */}
          <CommandInput placeholder={searchPlaceholder} />

          {/* 8. قائمة الخيارات التي سيتم فلترتها */}
          <CommandList>
            {/* رسالة تظهر عند عدم وجود نتائج */}
            <CommandEmpty>{notFoundMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  // 9. ✨ الجزء الأهم: نستخدم label هنا ليتم البحث بالنص الظاهر
                  value={option.label}
                  // 10. عند اختيار عنصر، نقوم بتحديث القيمة وإغلاق القائمة
                  onSelect={(currentLabel) => {
                    const selectedOption = options.find(
                      (opt) => opt.label.toLowerCase() === currentLabel.toLowerCase()
                    );
                    
                    if (selectedOption && onValueChange) {
                       onValueChange(selectedOption.value === value ? "" : selectedOption.value);
                    }
                    setOpen(false);
                  }}
                >
                  {/* 11. أيقونة ✔ التي تظهر بجانب العنصر المختار فقط */}
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 transition-opacity",
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
  )
}
